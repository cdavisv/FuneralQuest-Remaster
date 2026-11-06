import { isIPv4, isIPv6 } from "node:net";

/**
 * IP address rules for bans.
 *
 * The original server's ban filter matched with a substring search, so
 * banning "10.1.1" also banned "210.1.1.9" and "10.1.100.4". Here a rule is
 * always a CIDR block:
 *  - a full address bans exactly that address;
 *  - a dotted prefix such as "192.168.1" or "192.168." means 192.168.1.0/24
 *    (whole octets only, so it never matches "192.168.10.1");
 *  - a colon prefix such as "2001:db8" means a whole-group IPv6 prefix;
 *  - "10.0.0.0/8" and "2001:db8::/32" are taken as written.
 */

export interface ParsedAddress {
  family: 4 | 6;
  value: bigint;
}

export interface IpRule {
  family: 4 | 6;
  value: bigint;
  bits: number;
}

function parseV4(text: string): bigint | null {
  if (!isIPv4(text)) return null;
  let value = 0n;
  for (const part of text.split(".")) value = (value << 8n) | BigInt(Number(part));
  return value;
}

function parseV6(text: string): bigint | null {
  let s = text;
  const zone = s.indexOf("%");
  if (zone !== -1) s = s.slice(0, zone);
  if (!isIPv6(s)) return null;
  // An embedded IPv4 tail becomes two groups.
  const lastColon = s.lastIndexOf(":");
  const tail = s.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseV4(tail);
    if (v4 === null) return null;
    s = `${s.slice(0, lastColon + 1)}${(v4 >> 16n).toString(16)}:${(v4 & 0xffffn).toString(16)}`;
  }
  const [head = "", rest] = s.split("::");
  const left = head === "" ? [] : head.split(":");
  const right = rest === undefined || rest === "" ? [] : rest.split(":");
  const missing = 8 - left.length - right.length;
  const groups = rest === undefined ? left : [...left, ...Array(missing).fill("0"), ...right];
  if (groups.length !== 8) return null;
  let value = 0n;
  for (const g of groups) value = (value << 16n) | BigInt(Number.parseInt(g, 16));
  return value;
}

/** Parses an address; IPv4-mapped IPv6 (::ffff:a.b.c.d) is treated as IPv4. */
export function parseAddress(ip: string): ParsedAddress | null {
  const v4 = parseV4(ip);
  if (v4 !== null) return { family: 4, value: v4 };
  const v6 = parseV6(ip);
  if (v6 === null) return null;
  if (v6 >> 32n === 0xffffn) return { family: 4, value: v6 & 0xffffffffn };
  return { family: 6, value: v6 };
}

/** Parses a ban rule; null when it is not a valid address, prefix or CIDR. */
export function parseIpRule(text: string): IpRule | null {
  const rule = text.trim();
  if (rule === "" || rule.length > 64) return null;
  const slash = rule.indexOf("/");
  if (slash !== -1) {
    const addr = parseAddress(rule.slice(0, slash));
    const lenText = rule.slice(slash + 1);
    if (!addr || !/^\d{1,3}$/.test(lenText)) return null;
    const len = Number(lenText);
    const total = addr.family === 4 ? 32 : 128;
    // "::ffff:1.2.3.4/104" style rules count from the mapped form; keep it simple.
    if (len > total) return null;
    return { family: addr.family, value: mask(addr.value, total, len), bits: len };
  }
  const full = parseAddress(rule);
  if (full) return { family: full.family, value: full.value, bits: full.family === 4 ? 32 : 128 };
  if (/^\d{1,3}(\.\d{1,3}){0,3}\.?$/.test(rule)) {
    const parts = rule.replace(/\.$/, "").split(".").map(Number);
    if (parts.some((n) => n > 255) || parts.length > 4) return null;
    let value = 0n;
    for (let i = 0; i < 4; i++) value = (value << 8n) | BigInt(parts[i] ?? 0);
    return { family: 4, value, bits: parts.length * 8 };
  }
  if (rule.includes(":") && /^[0-9a-f]{1,4}(:[0-9a-f]{1,4}){0,6}:?$/i.test(rule)) {
    const parts = rule.replace(/:$/, "").split(":");
    let value = 0n;
    for (let i = 0; i < 8; i++)
      value = (value << 16n) | BigInt(Number.parseInt(parts[i] ?? "0", 16));
    return { family: 6, value, bits: parts.length * 16 };
  }
  return null;
}

function mask(value: bigint, total: number, bits: number): bigint {
  if (bits === 0) return 0n;
  const shift = BigInt(total - bits);
  return (value >> shift) << shift;
}

export function ruleMatches(rule: IpRule, address: ParsedAddress): boolean {
  if (rule.family !== address.family) return false;
  const total = rule.family === 4 ? 32 : 128;
  return mask(address.value, total, rule.bits) === rule.value;
}
