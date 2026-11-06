import type { AssetId } from "@fq/protocol";
import type { ClassicText } from "../content/classicText.js";
import type { EventEntry, RangedTable } from "../content/types.js";
import type { ClassicRandom } from "../rng/classicRandom.js";
import { fill } from "../text/format.js";

/** An event with the `CEvent` defaults filled in (legacy/source/CEvent.cpp:9-23). */
export interface ResolvedEvent {
  message: string;
  title: string;
  giveRandom: string;
  addLog: string;
  picture: AssetId;
  modBp: [number, number];
  modLuck: [number, number];
  modTurns: [number, number];
}

/**
 * `CEvent::compute_event` (legacy/source/CEvent.cpp:115-210): pick one entry
 * of the first range containing `value`, with one `random(count)` draw. If no
 * range matches or it is empty, nothing is drawn and the defaults stand.
 */
export function computeEvent(
  rng: ClassicRandom,
  table: RangedTable<EventEntry>,
  value: number,
  defaults: { message: string; picture: AssetId },
  /** Expanded only: entries that may run today (absent in Classic, so the draw is the original's). */
  accept?: (entry: EventEntry) => boolean,
): ResolvedEvent {
  const out: ResolvedEvent = {
    message: defaults.message,
    title: "",
    giveRandom: "",
    addLog: "",
    picture: defaults.picture,
    modBp: [0, 0],
    modLuck: [0, 0],
    modTurns: [0, 0],
  };
  const block = table.ranges.find((r) => value >= r.low && value <= r.high);
  const entries = accept ? block?.entries.filter(accept) : block?.entries;
  if (!entries || entries.length === 0) return out;
  const entry = entries[rng.random(entries.length)] as EventEntry;
  if (entry.message !== undefined) out.message = entry.message;
  if (entry.title !== undefined) out.title = entry.title;
  if (entry.giveRandom !== undefined) out.giveRandom = entry.giveRandom;
  if (entry.addLog !== undefined) out.addLog = entry.addLog;
  if (entry.picture !== undefined) out.picture = entry.picture;
  if (entry.modBp) out.modBp = entry.modBp;
  if (entry.modLuck) out.modLuck = entry.modLuck;
  if (entry.modTurns) out.modTurns = entry.modTurns;
  return out;
}

/**
 * `add_reward_text` (legacy/source/misc_utils.cpp:50-91): builds
 * "You earn 5 Bury Points and 2 luck" piece by piece. Zero amounts add nothing.
 */
export class RewardText {
  text = "";
  count = 0;

  constructor(private readonly t: ClassicText) {}

  add(what: string, amount: number): void {
    if (amount === 0) return;
    this.count++;
    const vars = { amount: Math.abs(amount), what };
    const w = this.t.wait;
    if (this.count === 1) {
      this.text += fill(amount > 0 ? w.rewardFirstGain : w.rewardFirstLoss, vars);
    } else {
      this.text += fill(amount > 0 ? w.rewardNextGain : w.rewardNextLoss, vars);
    }
  }

  /** The text with the closing period the callers add when anything changed. */
  finish(): string {
    return this.count > 0 ? this.text + this.t.wait.rewardEnd : this.text;
  }
}
