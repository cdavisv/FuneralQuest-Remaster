import { Pair, type Pair as PairType, type Step, type StepRecord } from "./session.js";
import { plainText, type Vars, wordsOnly } from "./vars.js";
import { Dice, Walker } from "./walker.js";

export interface PlayerSpec {
  name: string;
  parlor: string;
  male: boolean;
}

export interface WalkSpec {
  name: string;
  mtSeed: number;
  crtSeed: number;
  players: readonly PlayerSpec[];
  days: number;
  /** Actions per player per day (the walker's choices, not counting log-on). */
  actions: number;
  walkSeed: number;
  waitWeight?: number;
  places?: readonly (readonly [number, number])[];
  prefer?: readonly string[];
  /** Game Settings changed (on both sides) right after the town starts. */
  settings?: Readonly<Record<string, number | boolean>>;
  /** Players take turns, each logging off before the next logs on (so visits are possible). */
  sequential?: boolean;
  /** Player record fields set (on both sides) after the players are created: [player, field, value]. */
  grants?: readonly (readonly [number, string, number])[];
}

export interface Divergence {
  index: number;
  step: Step;
  rng: StepRecord["rng"];
  state: StepRecord["state"];
  refused: { original?: string; port?: string };
  /** The steps just before, for context. */
  context: StepRecord[];
  record: StepRecord;
}

/** A difference in what the player is shown, with the rules (state and draws) still in step. */
export interface TextDiff {
  index: number;
  step: Step;
  name: string;
  original: string;
  port: string;
}

/** A step one side could not take (its screen differed) while the rules were still in step. */
export interface FlowDiff {
  index: number;
  step: Step;
  refused: { original?: string; port?: string };
  original: Vars;
  port: Vars;
}

/** A state difference that closed again within MAX_TRANSIENT steps, draws in step throughout. */
export interface TransientDiff {
  index: number;
  steps: number;
  step: Step;
  state: StepRecord["state"];
}

export interface WalkResult {
  flowDiffs: FlowDiff[];
  transients: TransientDiff[];
  /** The port's town after the last step (for debugging a divergence). */
  portTown?: unknown;
  name: string;
  steps: number;
  /** Steps after which state and draw counts were identical. */
  matched: number;
  divergence: Divergence | null;
  textDiffs: TextDiff[];
  records: StepRecord[];
}

/** Variables carrying text the player reads; compared word for word without markup. */
const TEXT_VARS = ["st_main", "st_message", "st_news", "st_generic_info", "st_temp", "g_st_error"];

function lastVars(vs: readonly Vars[]): Vars {
  return vs[vs.length - 1] ?? [];
}

/**
 * Oracle finding D5, the one exempted text: the 2019 source release answers
 * `/?` with "Unknown command" because its replacement `GetField`
 * (FakeCStringEx.cpp:52-67) returns "" for a one-character string, where the
 * 2001 server showed the help (commands_bar.cpp:247-258). For a chat step whose
 * input is exactly "/?", that answer and the port's help are removed before
 * comparing; the rest of the poll must still match.
 */
function exemptHelp(rec: StepRecord, original: string, port: string): [string, string] {
  const s = rec.step;
  if (s.kind !== "cmd" || s.command !== 24 || s.extra?.st_input !== "/?") return [original, port];
  return [
    original.replace("Unknown command. Do /? for the list.", ""),
    port.replace(/\*\* Cafe chat help \*\*[\s\S]*?\/tv on \(or off\) to control the cafe tv\./, ""),
  ];
}

function textDiffs(rec: StepRecord): TextDiff[] {
  const out: TextDiff[] = [];
  // A step one side refused has no response to compare (it is a screen-flow difference).
  if (rec.original.refused || rec.port.refused) return out;
  const o = lastVars(rec.original.responses);
  const p = lastVars(rec.port.responses);
  for (const name of TEXT_VARS) {
    const a = o.find(([k]) => k === name)?.[1];
    const b = p.find(([k]) => k === name)?.[1];
    // A variable the original did not send keeps its old value on the client;
    // the bridge restating it is not a difference the player sees.
    if (a === undefined) continue;
    const [pa, pb] = exemptHelp(rec, plainText(a ?? ""), plainText(b ?? ""));
    if (wordsOnly(pa) !== wordsOnly(pb)) {
      out.push({ index: rec.index, step: rec.step, name, original: pa, port: pb });
    }
  }
  return out;
}

/**
 * The longest run of steps a state difference may last with the draws still
 * in step before it counts as a divergence. Only steps taken by a player whose
 * record differs (and midnights) count. Some differences are only a
 * matter of when a queued reward is applied (the port reads past an empty
 * Continue stop, desk.ts); they close at the next click.
 */
export const MAX_TRANSIENT = 4;

function drawsDiffer(rec: StepRecord): boolean {
  return rec.rng.length > 0;
}

function refusedOnOneSide(rec: StepRecord): boolean {
  return Boolean(rec.original.refused) !== Boolean(rec.port.refused);
}

/**
 * Plays a town with random clients (the walker reads the original's screens)
 * and stops at the first step where the port's state or draw counts differ
 * from the original's.
 */
export async function runWalk(
  spec: WalkSpec,
  onStep?: (rec: StepRecord) => void,
): Promise<WalkResult> {
  const pair: PairType = new Pair();
  const dice = new Dice(spec.walkSeed);
  const names = spec.players.map((pl) => pl.name.slice(0, 3));
  const walkers = spec.players.map(
    (_, p) =>
      new Walker(p, dice, {
        names,
        ...(spec.waitWeight !== undefined ? { waitWeight: spec.waitWeight } : {}),
        ...(spec.places ? { places: spec.places } : {}),
        ...(spec.prefer ? { prefer: spec.prefer } : {}),
      }),
  );
  const diffs: TextDiff[] = [];
  const flows: FlowDiff[] = [];
  const transients: TransientDiff[] = [];
  let open: { rec: StepRecord; steps: number } | null = null;
  let divergence: Divergence | null = null;
  const diverge = (rec: StepRecord): false => {
    divergence = {
      index: rec.index,
      step: rec.step,
      rng: rec.rng,
      state: rec.state,
      refused: {
        ...(rec.original.refused ? { original: rec.original.refused } : {}),
        ...(rec.port.refused ? { port: rec.port.refused } : {}),
      },
      context: pair.records.slice(Math.max(0, rec.index - 4), rec.index),
      record: rec,
    };
    return false;
  };
  const step = async (s: Step, resync = true): Promise<boolean> => {
    const before =
      s.kind === "midnight" ? null : { o: pair.last("original", s.p), p: pair.last("port", s.p) };
    const rec = await pair.run(s);
    onStep?.(rec);
    if (s.kind !== "midnight") {
      const walker = walkers[s.p];
      for (const v of rec.original.responses) walker?.model.apply(v);
    }
    diffs.push(...textDiffs(rec));
    if (drawsDiffer(rec)) return diverge(open ? open.rec : rec);
    if (rec.state.length > 0) {
      if (!open) open = { rec, steps: 0 };
      const involved = new Set(
        rec.state.map((d) => Number(/^players\[(\d+)\]/.exec(d.path)?.[1] ?? Number.NaN)),
      );
      if (s.kind === "midnight" || involved.has(s.p) || involved.has(Number.NaN)) open.steps++;
      if (open.steps > MAX_TRANSIENT) return diverge(open.rec);
    } else if (open) {
      transients.push({
        index: open.rec.index,
        steps: open.steps,
        step: open.rec.step,
        state: open.rec.state,
      });
      open = null;
    }
    if (refusedOnOneSide(rec) && before && s.kind !== "midnight") {
      // The screens differ but the rules agree: note it, and bring both
      // clients back in step by dropping the connection and logging on again
      // (the original accepts any command at any time, the port only what the
      // screen offers, so no single command is safe on both).
      flows.push({
        index: rec.index,
        step: s,
        refused: {
          ...(rec.original.refused ? { original: rec.original.refused } : {}),
          ...(rec.port.refused ? { port: rec.port.refused } : {}),
        },
        original: before.o,
        port: before.p,
      });
      if (!resync) return true;
      const walker = walkers[s.p] as Walker;
      if (!(await step({ kind: "drop", p: s.p }, false))) return false;
      walker.model.object = null;
      return step({ kind: "logon", p: s.p }, false);
    }
    return true;
  };
  try {
    const first = await pair.start(spec.mtSeed, spec.crtSeed);
    if (drawsDiffer(first) || first.state.length > 0) diverge(first);
    for (const [key, value] of Object.entries(spec.settings ?? {})) await pair.set(key, value);
    const play = async (players: readonly number[]): Promise<boolean> => {
      const budget = players.map(() => spec.actions);
      while (budget.some((b) => b > 0)) {
        const live = budget.flatMap((b, i) => (b > 0 ? [i] : []));
        const i = dice.pick(live);
        budget[i] = (budget[i] ?? 0) - 1;
        const walker = walkers[players[i] as number] as Walker;
        if (walker.model.object === null) continue; // logged off (or refused at log-on)
        if (!(await step(walker.next()))) return false;
      }
      return true;
    };
    const drop = async (p: number): Promise<boolean> => {
      if (!(await step({ kind: "drop", p }))) return false;
      (walkers[p] as Walker).model.object = null;
      return true;
    };
    const everyone = spec.players.map((_, p) => p);
    outer: for (let day = 1; day <= spec.days && !divergence; day++) {
      if (day === 1) {
        for (const p of everyone) {
          const pl = spec.players[p] as PlayerSpec;
          if (!(await step({ kind: "new", p, name: pl.name, parlor: pl.parlor, male: pl.male }))) {
            break outer;
          }
        }
        for (const [p, field, value] of spec.grants ?? []) await pair.grant(p, field, value);
        if (spec.sequential) for (const p of everyone) if (!(await drop(p))) break outer;
      } else if (!spec.sequential) {
        for (const p of everyone) if (!(await step({ kind: "logon", p }))) break outer;
      }
      if (spec.sequential) {
        // One at a time, the others offline: their parlors can be visited.
        for (const p of everyone) {
          if (!(await step({ kind: "logon", p }))) break outer;
          if (!(await play([p]))) break outer;
          if (!(await drop(p))) break outer;
        }
      } else {
        if (!(await play(everyone))) break;
        for (const p of everyone) if (!(await drop(p))) break outer;
      }
      if (!(await step({ kind: "midnight" }))) break;
    }
    const stillOpen = open as { rec: StepRecord; steps: number } | null;
    if (!divergence && stillOpen) diverge(stillOpen.rec);
  } finally {
    pair.close();
  }
  const portTown = pair.port.current();
  const records = pair.records;
  const d = divergence as Divergence | null;
  return {
    name: spec.name,
    steps: records.length,
    matched: d ? d.index : records.length,
    divergence: d,
    textDiffs: diffs,
    flowDiffs: flows,
    transients,
    records,
    portTown,
  };
}
