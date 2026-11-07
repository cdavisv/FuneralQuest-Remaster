import type { Turn } from "../engine/turn.js";
import type { CustomerState } from "../state/types.js";
import type { AgedPool, AgeLimits } from "./content/types.js";
import { xc } from "./players.js";

/**
 * Age-aware content (docs/expanded-rules.md 13.5): lines and traits that
 * suit only some customers. Only the Expanded negotiation reads these;
 * Classic's pools are untouched.
 */

/** Whether `limits` names any bound. */
export function hasAgeLimits(limits: AgeLimits): boolean {
  return (
    limits.minCustomerAge !== undefined ||
    limits.maxCustomerAge !== undefined ||
    limits.minDeceasedAge !== undefined ||
    limits.maxDeceasedAge !== undefined
  );
}

/** Whether the customer and the deceased are inside `limits` (inclusive; absent bounds pass). */
export function fitsAges(
  limits: AgeLimits,
  c: Pick<CustomerState, "customerAge" | "deceasedAge">,
): boolean {
  const within = (age: number, min?: number, max?: number) =>
    (min === undefined || age >= min) && (max === undefined || age <= max);
  return (
    within(c.customerAge, limits.minCustomerAge, limits.maxCustomerAge) &&
    within(c.deceasedAge, limits.minDeceasedAge, limits.maxDeceasedAge)
  );
}

/**
 * The lines to draw from for `pool`: the plain list `base` (always
 * eligible) plus the pack's `agedLines` for that pool that fit this
 * customer. When that leaves nothing, the pool's unrestricted lines are used,
 * then (a pool made only of restricted lines, none fitting) all of them, so a
 * screen never goes without its line. With no aged lines for the pool the
 * result is `base` itself, so the draw is exactly what it was before.
 */
export function agedPool(
  turn: Turn,
  c: CustomerState,
  pool: AgedPool,
  base: readonly string[],
): readonly string[] {
  const aged = (xc(turn).text.negotiation.agedLines ?? []).filter((l) => l.pool === pool);
  if (aged.length === 0) return base;
  // Owner's rule: a restriction never touches an original line. The plain list (Classic's
  // original lines and the pack's plain lines) is always eligible as it stands, and an aged
  // line that repeats one of them is ignored, so it cannot change how that line is drawn.
  const plain = new Set(base);
  const fit = aged.filter((l) => fitsAges(l, c) && !plain.has(l.text)).map((l) => l.text);
  const out = [...base, ...fit];
  if (out.length > 0) return out;
  const open = aged.filter((l) => !hasAgeLimits(l)).map((l) => l.text);
  return open.length > 0 ? open : aged.map((l) => l.text);
}
