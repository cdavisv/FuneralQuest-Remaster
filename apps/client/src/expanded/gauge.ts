import type { CustomerPanel } from "@fq/protocol";

/**
 * The estimate gauge (docs/expanded-rules.md 3.6, 3.7). The View gives a range that holds the
 * customer's hidden limit and the running total. The bill can never pass the limit, so the
 * limit is somewhere between the total and the top of the range. The closeness bonuses are
 * measured under the limit (`CustomerPanel.bands`, nearest first: exact, then each tier by how
 * close the bill is to it, as a share of the limit). So for the current total the limits that
 * would pay a bonus lie just above it, and the gauge draws those bands there. The widths come
 * from the engine's own bands; the client keeps no copy of them.
 */
export type BandKey = "exact" | "great" | "nice";

export interface BandSpan {
  key: BandKey;
  /** How close under the limit the bill must be, as a share of the limit (the engine's number). */
  within: number;
  /** Dollars of limit that would earn this band at the current total (clipped to the estimate). */
  from: number;
  to: number;
  /** Axis positions, 0 to 1. */
  fromPos: number;
  toPos: number;
}

export interface GaugeModel {
  low: number;
  high: number;
  total: number;
  /** Where the total sits against the estimate. */
  state: "below" | "inside" | "above";
  /** Dollars from the total up to the bottom of the estimate (0 unless below). */
  gap: number;
  /** Axis positions, 0 to 1. */
  lowPos: number;
  highPos: number;
  totalPos: number;
  /** Bonus bands above the total, great then nice, only the ones that fall inside the estimate. */
  bands: BandSpan[];
  /** Share of the estimate above the total that would earn some bonus (0 to 1). */
  chance: number;
  /** Where the zero point of a compressed lead-in lies, 0 when the axis starts at the estimate. */
  leadIn: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** The positions the three zones of the axis take, in axis shares. */
const AXIS = { lead: 0.2, pad: 0.04, top: 0.96, overshoot: 0.8 } as const;

export function gaugeModel(
  estimate: { low: number; high: number },
  total: number,
  bands: readonly { key: BandKey; within: number }[] = [],
): GaugeModel {
  const low = Math.min(estimate.low, estimate.high);
  const high = Math.max(estimate.low, estimate.high);
  const span = Math.max(1, high - low);
  const state = total < low ? "below" : total > high ? "above" : "inside";
  const leadIn = state === "below" ? AXIS.lead : 0;
  const top = state === "above" ? AXIS.overshoot : AXIS.top;
  const start = state === "below" ? AXIS.lead + 0.02 : AXIS.pad;

  const pos = (v: number): number => {
    if (v <= low) {
      if (state !== "below") return start;
      return clamp((AXIS.lead * Math.max(0, v)) / Math.max(1, low), 0.012, AXIS.lead);
    }
    if (v <= high) return start + ((v - low) / span) * (top - start);
    return clamp(top + ((v - high) / span) * (AXIS.top + 0.03 - top), top, 0.99);
  };

  // The limit lies in [max(total, low), high]; the bands sit just above the total.
  const floor = Math.max(total, low);
  const spans: BandSpan[] = [];
  let reached = total;
  let earned = 0;
  // Nearest first; an "exact" band is a single amount, so it has no width to draw.
  for (const band of [...bands].sort((a, b) => a.within - b.within)) {
    if (band.within <= 0) continue;
    const upper = total / (1 - band.within);
    const from = Math.max(reached, floor);
    const to = Math.min(upper, high);
    if (to > from && total > 0) {
      spans.push({
        key: band.key,
        within: band.within,
        from: Math.round(from),
        to: Math.round(to),
        fromPos: pos(from),
        toPos: pos(to),
      });
      earned += to - from;
    }
    reached = Math.max(reached, upper);
  }
  const room = Math.max(0, high - floor);
  return {
    low,
    high,
    total,
    state,
    gap: state === "below" ? low - total : 0,
    lowPos: pos(low),
    highPos: pos(high),
    totalPos: pos(total),
    bands: spans,
    chance: room > 0 ? clamp(earned / room, 0, 1) : total >= high && total > 0 ? 1 : 0,
    leadIn,
  };
}

/** The gauge for a customer panel, or null when it has no estimate (Classic) or is not a haggle. */
export function gaugeFor(customer: CustomerPanel): GaugeModel | null {
  return customer.estimate && customer.haggle !== false
    ? gaugeModel(customer.estimate, customer.total, customer.bands ?? [])
    : null;
}
