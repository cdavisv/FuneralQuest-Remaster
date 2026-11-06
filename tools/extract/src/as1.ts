import { latin1 } from "./reader.js";

/**
 * ActionScript 1 (Flash 5 action bytecode) decompiler. Stack-simulates each action and folds
 * conditional jumps into if/else, while and do-while blocks. Jumps it cannot fold stay as
 * `goto` with labels, so the output is always a complete picture of the bytecode.
 */

interface Expr {
  s: string;
  /** Operator precedence; 100 for atoms. */
  p: number;
  /** Set for string literals: the raw value. */
  str?: string;
  /** Set for numeric literals. */
  num?: number;
}

type Stmt =
  | { k: "line"; text: string; at: number }
  | { k: "cjump"; cond: Expr; to: number; at: number }
  | { k: "jump"; to: number; at: number }
  | { k: "label"; at: number }
  | { k: "block"; head: string; body: Stmt[]; tail?: string; at: number }
  | { k: "ifelse"; cond: string; yes: Stmt[]; no: Stmt[]; at: number };

const PROPS = [
  "_x",
  "_y",
  "_xscale",
  "_yscale",
  "_currentframe",
  "_totalframes",
  "_alpha",
  "_visible",
  "_width",
  "_height",
  "_rotation",
  "_target",
  "_framesloaded",
  "_name",
  "_droptarget",
  "_url",
  "_highquality",
  "_focusrect",
  "_soundbuftime",
  "_quality",
  "_xmouse",
  "_ymouse",
];

const BIN: Record<number, [string, number]> = {
  10: ["+", 70],
  11: ["-", 70],
  12: ["*", 80],
  13: ["/", 80],
  14: ["==", 55],
  15: ["<", 60],
  16: ["&&", 40],
  17: ["||", 30],
  19: ["eq", 55],
  33: ["add", 70],
  41: ["lt", 60],
  63: ["%", 80],
  71: ["+", 70],
  72: ["<", 60],
  73: ["==", 55],
  84: ["instanceof", 60],
  96: ["&", 50],
  97: ["|", 46],
  98: ["^", 48],
  99: ["<<", 65],
  100: [">>", 65],
  101: [">>>", 65],
  102: ["===", 55],
  103: [">", 60],
  104: ["gt", 60],
};

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const PATH = /^[A-Za-z_/.$:][A-Za-z0-9_$./:]*$/;

const atom = (s: string): Expr => ({ s, p: 100 });
/** A movie clip target: a literal path, "" for the current timeline, or a dynamic expression. */
const target = (e: Expr): string =>
  e.str !== undefined ? (e.str === "" ? "this" : e.str) : `eval(${e.s})`;
const quote = (v: string): string =>
  `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t")}"`;
const strLit = (v: string): Expr => ({ s: quote(v), p: 100, str: v });
const wrap = (e: Expr, p: number): string => (e.p < p ? `(${e.s})` : e.s);

function negate(e: Expr): Expr {
  if (e.s.startsWith("!") && e.p === 90) {
    const rest = e.s.slice(1);
    if (rest.startsWith("(") && rest.endsWith(")") && balanced(rest.slice(1, -1))) {
      return { s: rest.slice(1, -1), p: 0 };
    }
    return { s: rest, p: rest.startsWith("!") ? 90 : 100 };
  }
  const m = /^(.*) (==|<|>|<=|>=|!=) (.*)$/.exec(e.s);
  if (m && e.p >= 55 && e.p <= 60 && !/[&|]{2}|[()]/.test(e.s)) {
    const flip: Record<string, string> = { "==": "!=", "!=": "==", "<": ">=", ">": "<=" };
    const f = flip[m[2] as string];
    if (f) return { s: `${m[1]} ${f} ${m[3]}`, p: e.p };
  }
  return { s: `!${wrap(e, 90)}`, p: 90 };
}

function balanced(s: string): boolean {
  let d = 0;
  for (const ch of s) {
    if (ch === "(") d++;
    else if (ch === ")" && --d < 0) return false;
  }
  return d === 0;
}

interface Instr {
  at: number;
  op: number;
  data: Uint8Array;
  next: number;
}

function decode(b: Uint8Array): Instr[] {
  const out: Instr[] = [];
  let i = 0;
  while (i < b.length) {
    const at = i;
    const op = b[i++] as number;
    if (op === 0) break;
    let data: Uint8Array = new Uint8Array();
    if (op >= 0x80) {
      const len = (b[i] as number) | ((b[i + 1] as number) << 8);
      i += 2;
      data = b.subarray(i, i + len);
      i += len;
    }
    out.push({ at, op, data, next: i });
  }
  return out;
}

const u16 = (d: Uint8Array, o = 0): number => (d[o] ?? 0) | ((d[o + 1] ?? 0) << 8);
const s16 = (d: Uint8Array, o = 0): number => {
  const v = u16(d, o);
  return v >= 0x8000 ? v - 0x10000 : v;
};

class Decompiler {
  pool: string[] = [];
  constructor(pool: string[] = []) {
    this.pool = pool;
  }

  /** Decompile a code block to a statement tree. */
  run(code: Uint8Array, depth = 0): Stmt[] {
    const ins = decode(code);
    const stmts: Stmt[] = [];
    const st: Expr[] = [];
    const pop = (): Expr => st.pop() ?? atom("<empty-stack>");
    const emit = (at: number, text: string): void => {
      stmts.push({ k: "line", text, at });
    };
    const regs = new Map<number, Expr>();
    const popArgs = (n: number): string => {
      const a: string[] = [];
      for (let i = 0; i < n; i++) a.push(pop().s);
      return a.join(", ");
    };
    const count = (e: Expr): number => (e.num !== undefined ? e.num : Number(e.s) || 0);
    const varName = (e: Expr): string => {
      if (e.str !== undefined && PATH.test(e.str)) return e.str;
      return `eval(${e.s})`;
    };
    const targets = new Set<number>();
    for (const i of ins) if (i.op === 0x99 || i.op === 0x9d) targets.add(i.next + s16(i.data));
    for (let n = 0; n < ins.length; n++) {
      const i = ins[n] as Instr;
      if (targets.has(i.at)) stmts.push({ k: "label", at: i.at });
      const { op, data } = i;
      switch (op) {
        case 0x04:
          emit(i.at, "nextFrame();");
          break;
        case 0x05:
          emit(i.at, "prevFrame();");
          break;
        case 0x06:
          emit(i.at, "play();");
          break;
        case 0x07:
          emit(i.at, "stop();");
          break;
        case 0x08:
          emit(i.at, "toggleHighQuality();");
          break;
        case 0x09:
          emit(i.at, "stopAllSounds();");
          break;
        case 0x12: {
          const e = pop();
          st.push({ s: `!${wrap(e, 90)}`, p: 90 });
          break;
        }
        case 0x14:
        case 0x31:
          st.push(atom(`length(${pop().s})`));
          break;
        case 0x15:
        case 0x35: {
          const c = pop();
          const ix = pop();
          const s = pop();
          st.push(atom(`substring(${s.s}, ${ix.s}, ${c.s})`));
          break;
        }
        case 0x17: {
          const e = pop();
          // A pushed value that is discarded: print it if it has effects (calls, assignments).
          if (/[()=]/.test(e.s)) emit(i.at, `${e.s.replace(/^\((r\d+ = .*)\)$/, "$1")};`);
          break;
        }
        case 0x18:
          st.push(atom(`int(${pop().s})`));
          break;
        case 0x1c: {
          const n2 = pop();
          st.push(atom(varName(n2)));
          break;
        }
        case 0x1d: {
          const v = pop();
          const n2 = pop();
          emit(i.at, `${varName(n2)} = ${v.s};`);
          break;
        }
        case 0x20: {
          const t = pop();
          emit(i.at, `setTarget(${t.s});`);
          break;
        }
        case 0x22: {
          const pr = pop();
          const t = pop();
          st.push(atom(`${target(t)}.${PROPS[count(pr)] ?? `prop${pr.s}`}`));
          break;
        }
        case 0x23: {
          const v = pop();
          const pr = pop();
          const t = pop();
          emit(i.at, `${target(t)}.${PROPS[count(pr)] ?? `prop${pr.s}`} = ${v.s};`);
          break;
        }
        case 0x24: {
          const d = pop();
          const t = pop();
          const s = pop();
          emit(i.at, `duplicateMovieClip(${s.s}, ${t.s}, ${d.s});`);
          break;
        }
        case 0x25:
          emit(i.at, `removeMovieClip(${pop().s});`);
          break;
        case 0x26:
          emit(i.at, `trace(${pop().s});`);
          break;
        case 0x27: {
          const t = pop();
          const lock = pop();
          const cons = count(pop());
          if (cons) {
            const y2 = pop();
            const x2 = pop();
            const y1 = pop();
            const x1 = pop();
            emit(i.at, `startDrag(${t.s}, ${lock.s}, ${x1.s}, ${y1.s}, ${x2.s}, ${y2.s});`);
          } else emit(i.at, `startDrag(${t.s}, ${lock.s});`);
          break;
        }
        case 0x28:
          emit(i.at, "stopDrag();");
          break;
        case 0x30:
          st.push(atom(`random(${pop().s})`));
          break;
        case 0x32:
        case 0x36:
          st.push(atom(`ord(${pop().s})`));
          break;
        case 0x33:
        case 0x37:
          st.push(atom(`chr(${pop().s})`));
          break;
        case 0x34:
          st.push(atom("getTimer()"));
          break;
        case 0x3a: {
          const m = pop();
          const o = pop();
          emit(i.at, `delete ${wrap(o, 100)}.${m.str ?? m.s};`);
          break;
        }
        case 0x3b:
          emit(i.at, `delete ${varName(pop())};`);
          break;
        case 0x3c: {
          const v = pop();
          const n2 = pop();
          emit(i.at, `var ${n2.str ?? n2.s} = ${v.s};`);
          break;
        }
        case 0x41:
          emit(i.at, `var ${pop().str ?? "?"};`);
          break;
        case 0x3d: {
          const n2 = pop();
          const c = count(pop());
          st.push(atom(`${n2.str && PATH.test(n2.str) ? n2.str : n2.s}(${popArgs(c)})`));
          break;
        }
        case 0x3e:
          emit(i.at, `return ${pop().s};`);
          break;
        case 0x40: {
          const n2 = pop();
          const c = count(pop());
          st.push(atom(`new ${n2.str ?? n2.s}(${popArgs(c)})`));
          break;
        }
        case 0x53: {
          const m = pop();
          const o = pop();
          const c = count(pop());
          const nm = m.str === "" || m.s === "undefined" ? "" : `.${m.str ?? m.s}`;
          st.push(atom(`new ${wrap(o, 100)}${nm}(${popArgs(c)})`));
          break;
        }
        case 0x42: {
          const c = count(pop());
          st.push(atom(`[${popArgs(c)}]`));
          break;
        }
        case 0x43: {
          const c = count(pop());
          const parts: string[] = [];
          for (let k = 0; k < c; k++) {
            const v = pop();
            const key = pop();
            parts.push(`${key.str ?? key.s}: ${v.s}`);
          }
          st.push(atom(`{${parts.join(", ")}}`));
          break;
        }
        case 0x44:
          st.push(atom(`typeof(${pop().s})`));
          break;
        case 0x45:
          st.push(atom(`targetPath(${pop().s})`));
          break;
        case 0x46: {
          const n2 = pop();
          st.push(atom("<enumerate>"));
          emit(i.at, `/* enumerate ${n2.s} */`);
          break;
        }
        case 0x4a:
          st.push(atom(`Number(${pop().s})`));
          break;
        case 0x4b:
          st.push(atom(`String(${pop().s})`));
          break;
        case 0x4c: {
          const e = pop();
          st.push(e, e);
          break;
        }
        case 0x4d: {
          const a = pop();
          const b2 = pop();
          st.push(a, b2);
          break;
        }
        case 0x4e: {
          const m = pop();
          const o = pop();
          if (m.str !== undefined && IDENT.test(m.str)) st.push(atom(`${wrap(o, 100)}.${m.str}`));
          else st.push(atom(`${wrap(o, 100)}[${m.s}]`));
          break;
        }
        case 0x4f: {
          const v = pop();
          const m = pop();
          const o = pop();
          const lhs =
            m.str !== undefined && IDENT.test(m.str)
              ? `${wrap(o, 100)}.${m.str}`
              : `${wrap(o, 100)}[${m.s}]`;
          emit(i.at, `${lhs} = ${v.s};`);
          break;
        }
        case 0x50:
          st.push({ s: `${wrap(pop(), 70)} + 1`, p: 70 });
          break;
        case 0x51:
          st.push({ s: `${wrap(pop(), 70)} - 1`, p: 70 });
          break;
        case 0x52: {
          const m = pop();
          const o = pop();
          const c = count(pop());
          const args = popArgs(c);
          if (m.str === "" || m.s === "undefined") st.push(atom(`${wrap(o, 100)}(${args})`));
          else if (m.str !== undefined && IDENT.test(m.str))
            st.push(atom(`${wrap(o, 100)}.${m.str}(${args})`));
          else st.push(atom(`${wrap(o, 100)}[${m.s}](${args})`));
          break;
        }
        case 0x81:
          emit(i.at, `gotoFrame(${u16(data) + 1});`);
          break;
        case 0x83: {
          const parts = latin1(data).split("\0");
          emit(i.at, `getURL(${quote(parts[0] ?? "")}, ${quote(parts[1] ?? "")});`);
          break;
        }
        case 0x87: {
          const reg = data[0] as number;
          const top = st[st.length - 1] ?? atom("<empty-stack>");
          regs.set(reg, top);
          st[st.length - 1] = { s: `(r${reg} = ${top.s})`, p: 100 };
          break;
        }
        case 0x88: {
          const n2 = u16(data);
          this.pool = latin1(data.subarray(2)).split("\0").slice(0, n2);
          break;
        }
        case 0x8a: {
          const frame = u16(data) + 1;
          const skip = data[2] as number;
          const inner = ins.slice(n + 1, n + 1 + skip);
          const innerCode = sliceCode(code, inner);
          const body = this.run(innerCode, depth + 1);
          stmts.push({ k: "block", head: `ifFrameLoaded(${frame}) {`, body, at: i.at });
          n += skip;
          break;
        }
        case 0x8b: {
          const t = latin1(data).split("\0")[0] ?? "";
          emit(i.at, t === "" ? 'setTarget(""); // end tellTarget' : `setTarget(${quote(t)});`);
          break;
        }
        case 0x8c:
          emit(i.at, `gotoLabel(${quote(latin1(data).split("\0")[0] ?? "")});`);
          break;
        case 0x8d: {
          const skip = data[0] as number;
          const fr = pop();
          const inner = ins.slice(n + 1, n + 1 + skip);
          const body = this.run(sliceCode(code, inner), depth + 1);
          stmts.push({ k: "block", head: `ifFrameLoaded(${fr.s}) {`, body, at: i.at });
          n += skip;
          break;
        }
        case 0x94: {
          const size = u16(data);
          const obj = pop();
          const body = this.run(code.subarray(i.next, i.next + size), depth + 1);
          stmts.push({ k: "block", head: `with (${obj.s}) {`, body, at: i.at });
          while (n + 1 < ins.length && (ins[n + 1] as Instr).at < i.next + size) n++;
          break;
        }
        case 0x96: {
          let j = 0;
          while (j < data.length) {
            const t = data[j++] as number;
            if (t === 0) {
              let k = j;
              while (k < data.length && data[k] !== 0) k++;
              st.push(strLit(latin1(data.subarray(j, k))));
              j = k + 1;
            } else if (t === 1) {
              const v = new DataView(data.buffer, data.byteOffset + j, 4).getFloat32(0, true);
              st.push({ s: fmtNum(v), p: 100, num: v });
              j += 4;
            } else if (t === 2) st.push(atom("null"));
            else if (t === 3) st.push(atom("undefined"));
            else if (t === 4) {
              const r = data[j++] as number;
              st.push(regs.get(r) ? atom(`r${r}`) : atom(`r${r}`));
            } else if (t === 5) st.push(atom(data[j++] ? "true" : "false"));
            else if (t === 6) {
              const dv = new DataView(data.buffer, data.byteOffset + j, 8);
              const hi = dv.getUint32(0, true);
              const lo = dv.getUint32(4, true);
              const buf = new DataView(new ArrayBuffer(8));
              buf.setUint32(0, lo);
              buf.setUint32(4, hi);
              const v = buf.getFloat64(0);
              st.push({ s: fmtNum(v), p: 100, num: v });
              j += 8;
            } else if (t === 7) {
              const v = new DataView(data.buffer, data.byteOffset + j, 4).getInt32(0, true);
              st.push({ s: String(v), p: v < 0 ? 90 : 100, num: v });
              j += 4;
            } else if (t === 8 || t === 9) {
              const idx = t === 8 ? (data[j] as number) : u16(data, j);
              j += t === 8 ? 1 : 2;
              const v = this.pool[idx];
              st.push(v === undefined ? atom(`pool[${idx}]`) : strLit(v));
            } else {
              emit(i.at, `/* unknown push type ${t} */`);
              break;
            }
          }
          break;
        }
        case 0x99:
          stmts.push({ k: "jump", to: i.next + s16(data), at: i.at });
          break;
        case 0x9a: {
          const f = data[0] as number;
          const t = pop();
          const u = pop();
          const method = ["", "GET", "POST"][f & 3] ?? "";
          const m = method ? `, ${quote(method)}` : "";
          if (f & 0x80) emit(i.at, `loadVariables(${u.s}, ${t.s}${m});`);
          else if (f & 0x40) emit(i.at, `loadMovie(${u.s}, ${t.s}${m});`);
          else emit(i.at, `getURL(${u.s}, ${t.s}${m});`);
          break;
        }
        case 0x9b: {
          let p = 0;
          let name = "";
          while (data[p] !== 0) name += String.fromCharCode(data[p++] as number);
          p++;
          const np = u16(data, p);
          p += 2;
          const params: string[] = [];
          for (let k = 0; k < np; k++) {
            let s = "";
            while (data[p] !== 0) s += String.fromCharCode(data[p++] as number);
            p++;
            params.push(s);
          }
          const size = u16(data, p);
          const sub = new Decompiler([...this.pool]);
          const body = sub.run(code.subarray(i.next, i.next + size), depth + 1);
          if (name) {
            stmts.push({
              k: "block",
              head: `function ${name}(${params.join(", ")}) {`,
              body,
              at: i.at,
            });
          } else {
            const text = renderStmts(body, "  ").join("\n");
            st.push({ s: `function(${params.join(", ")}) {\n${text}\n}`, p: 100 });
          }
          while (n + 1 < ins.length && (ins[n + 1] as Instr).at < i.next + size) n++;
          break;
        }
        case 0x9d: {
          const c = pop();
          stmts.push({ k: "cjump", cond: c, to: i.next + s16(data), at: i.at });
          break;
        }
        case 0x9e:
          emit(i.at, `call(${pop().s});`);
          break;
        case 0x9f: {
          const flags = data[0] as number;
          const fr = pop();
          const fn = flags & 1 ? "gotoAndPlay" : "gotoAndStop";
          emit(i.at, `${fn}(${fr.s});`);
          break;
        }
        default: {
          const bin = BIN[op];
          if (bin) {
            const y = pop();
            const x = pop();
            const [sym, prec] = bin;
            const fx = wrap(x, prec);
            // Left-assoc: parenthesise an equal-precedence right operand.
            const fy = y.p <= prec ? `(${y.s})` : y.s;
            st.push({ s: `${fx} ${sym} ${fy}`, p: prec });
          } else {
            emit(i.at, `/* unknown action 0x${op.toString(16)} (${data.length} bytes) */`);
          }
        }
      }
    }
    const endAt = ins.length ? (ins[ins.length - 1] as Instr).next : 0;
    for (const t of [...targets].sort((a, b) => a - b))
      if (t >= endAt) stmts.push({ k: "label", at: t });
    if (st.length)
      stmts.push({
        k: "line",
        text: `/* stack left: ${st.map((e) => e.s).join(", ")} */`,
        at: code.length,
      });
    return structure(stmts);
  }
}

function sliceCode(code: Uint8Array, inner: Instr[]): Uint8Array {
  if (!inner.length) return new Uint8Array();
  return code.subarray((inner[0] as Instr).at, (inner[inner.length - 1] as Instr).next);
}

function fmtNum(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 1e6) / 1e6);
}

/** Fold forward and backward jumps into if/else, while and do-while. */
function structure(stmts: Stmt[]): Stmt[] {
  const out: Stmt[] = [];
  const labelIdx = new Map<number, number>();
  stmts.forEach((s, i) => {
    if (s.k === "label") labelIdx.set(s.at, i);
  });
  const gotoTargets = new Set<number>();
  const fold = (lo: number, hi: number): Stmt[] => {
    const res: Stmt[] = [];
    let i = lo;
    while (i < hi) {
      const s = stmts[i] as Stmt;
      if (s.k === "label") {
        // A backward jump to this label closes a loop.
        let last = -1;
        for (let j = i + 1; j < hi; j++) {
          const t = stmts[j] as Stmt;
          if ((t.k === "jump" || t.k === "cjump") && t.to === s.at) last = j;
        }
        if (last >= 0) {
          const back = stmts[last] as Stmt;
          if (back.k === "jump") {
            const first = stmts[i + 1];
            const exitLabel = stmts[last + 1];
            if (first?.k === "cjump" && exitLabel?.k === "label" && first.to === exitLabel.at) {
              const body = fold(i + 2, last);
              res.push({ k: "block", head: `while (${negate(first.cond).s}) {`, body, at: s.at });
            } else {
              res.push({ k: "block", head: "while (true) {", body: fold(i + 1, last), at: s.at });
            }
          } else if (back.k === "cjump") {
            res.push({
              k: "block",
              head: "do {",
              body: fold(i + 1, last),
              tail: `} while (${back.cond.s});`,
              at: s.at,
            });
          }
          i = last + 1;
          continue;
        }
        res.push(s);
        i++;
        continue;
      }
      if (s.k === "cjump") {
        const t = labelIdx.get(s.to);
        if (t !== undefined && t > i && t <= hi) {
          const bodyEnd = t;
          const lastBody = stmts[bodyEnd - 1];
          const cond = negate(s.cond).s;
          if (lastBody?.k === "jump" && lastBody.to > s.to) {
            const e = labelIdx.get(lastBody.to);
            if (e !== undefined && e <= hi && e >= t) {
              res.push({
                k: "ifelse",
                cond,
                yes: fold(i + 1, bodyEnd - 1),
                no: fold(t + 1, e),
                at: s.at,
              });
              i = e;
              continue;
            }
          }
          res.push({ k: "block", head: `if (${cond}) {`, body: fold(i + 1, bodyEnd), at: s.at });
          i = t;
          continue;
        }
      }
      if (s.k === "jump" || s.k === "cjump") gotoTargets.add(s.to);
      res.push(s);
      i++;
    }
    return res;
  };
  out.push(...fold(0, stmts.length));
  // Drop labels no goto refers to.
  const strip = (list: Stmt[]): Stmt[] => {
    const r: Stmt[] = [];
    for (const s of list) {
      if (s.k === "label" && !gotoTargets.has(s.at)) continue;
      if (s.k === "block") r.push({ ...s, body: strip(s.body) });
      else if (s.k === "ifelse") r.push({ ...s, yes: strip(s.yes), no: strip(s.no) });
      else r.push(s);
    }
    return r;
  };
  return strip(out);
}

function renderStmts(stmts: Stmt[], ind: string): string[] {
  const out: string[] = [];
  for (const s of stmts) {
    switch (s.k) {
      case "line":
        out.push(...s.text.split("\n").map((l) => ind + l));
        break;
      case "label":
        out.push(`${ind.slice(0, -2)}L_${s.at.toString(16).padStart(4, "0")}:`);
        break;
      case "jump":
        out.push(`${ind}goto L_${s.to.toString(16).padStart(4, "0")};`);
        break;
      case "cjump":
        out.push(`${ind}if (${s.cond.s}) goto L_${s.to.toString(16).padStart(4, "0")};`);
        break;
      case "block":
        out.push(ind + s.head);
        out.push(...renderStmts(s.body, `${ind}  `));
        out.push(`${ind}${s.tail ?? "}"}`);
        break;
      case "ifelse":
        out.push(`${ind}if (${s.cond}) {`);
        out.push(...renderStmts(s.yes, `${ind}  `));
        out.push(`${ind}} else {`);
        out.push(...renderStmts(s.no, `${ind}  `));
        out.push(`${ind}}`);
        break;
    }
  }
  return out;
}

/** Decompile one block of action bytecode to text. */
export function decompile(code: Uint8Array): string {
  return renderStmts(new Decompiler().run(code), "").join("\n");
}

/** Constant strings pushed or pooled by a block, for the string inventory. */
export function stringsIn(code: Uint8Array): string[] {
  const out: string[] = [];
  for (const i of decode(code)) {
    if (i.op === 0x88) out.push(...latin1(i.data.subarray(2)).split("\0").slice(0, u16(i.data)));
    else if (i.op === 0x96) {
      let j = 0;
      const d = i.data;
      while (j < d.length) {
        const t = d[j++] as number;
        if (t === 0) {
          let k = j;
          while (k < d.length && d[k] !== 0) k++;
          out.push(latin1(d.subarray(j, k)));
          j = k + 1;
        } else if (t === 1 || t === 7) j += 4;
        else if (t === 6) j += 8;
        else if (t === 4 || t === 5 || t === 8) j += 1;
        else if (t === 9) j += 2;
      }
    } else if (i.op === 0x9b) {
      // nested function bodies are covered when the body is scanned below
    }
  }
  return out;
}
