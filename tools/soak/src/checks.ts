import type { Transcript } from "./transcript.js";

/** One broken invariant, with enough context to find it in the transcript. */
export interface Violation {
  invariant: string;
  message: string;
  day: number | null;
  detail?: unknown;
}

/**
 * The invariants of the soak run and the record of every check made. A check that passes is
 * counted; one that fails is kept with its context and written to the transcript.
 */
export class Checks {
  readonly violations: Violation[] = [];
  readonly passed = new Map<string, number>();
  readonly notes: { what: string; detail?: unknown }[] = [];
  day: number | null = null;

  constructor(private readonly transcript: Transcript) {}

  ok(invariant: string, condition: boolean, message: string, detail?: unknown): boolean {
    if (condition) {
      this.passed.set(invariant, (this.passed.get(invariant) ?? 0) + 1);
      return true;
    }
    this.fail(invariant, message, detail);
    return false;
  }

  fail(invariant: string, message: string, detail?: unknown): void {
    const v: Violation = {
      invariant,
      message,
      day: this.day,
      ...(detail !== undefined ? { detail } : {}),
    };
    this.violations.push(v);
    this.transcript.write({
      kind: "check",
      name: invariant,
      ok: false,
      detail: { message, detail },
    });
    if (process.env.SOAK_VERBOSE !== "0") {
      console.error(`  ! ${invariant}: ${message}`);
    }
  }

  note(what: string, detail?: unknown): void {
    this.notes.push({ what, ...(detail !== undefined ? { detail } : {}) });
    this.transcript.write({ kind: "event", what: `note:${what}`, data: detail });
  }

  /** Every check of `invariant`: how many passed and how many failed. */
  tally(): Record<string, { passed: number; failed: number }> {
    const out: Record<string, { passed: number; failed: number }> = {};
    for (const [name, n] of this.passed) out[name] = { passed: n, failed: 0 };
    for (const v of this.violations) {
      const t = out[v.invariant] ?? { passed: 0, failed: 0 };
      t.failed++;
      out[v.invariant] = t;
    }
    return out;
  }
}

/** Compares two JSON values; returns the paths that differ (at most `limit`). */
export function diffJson(
  a: unknown,
  b: unknown,
  ignore: ReadonlySet<string> = new Set(),
  limit = 20,
): string[] {
  const out: string[] = [];
  const walk = (x: unknown, y: unknown, path: string) => {
    if (out.length >= limit) return;
    const key = path.split(".").at(-1) ?? "";
    if (ignore.has(key) || ignore.has(path)) return;
    if (x === y) return;
    if (typeof x !== typeof y || x === null || y === null || typeof x !== "object") {
      out.push(`${path || "(root)"}: ${short(x)} != ${short(y)}`);
      return;
    }
    if (Array.isArray(x) !== Array.isArray(y)) {
      out.push(`${path}: array/object mismatch`);
      return;
    }
    const keys = new Set([...Object.keys(x as object), ...Object.keys(y as object)]);
    for (const k of keys) {
      walk(
        (x as Record<string, unknown>)[k],
        (y as Record<string, unknown>)[k],
        path === "" ? k : `${path}.${k}`,
      );
    }
  };
  walk(a, b, "");
  return out;
}

function short(v: unknown): string {
  const s = JSON.stringify(v) ?? String(v);
  return s.length > 80 ? `${s.slice(0, 77)}...` : s;
}
