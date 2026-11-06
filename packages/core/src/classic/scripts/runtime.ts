import type { AssetId, Button, SceneKind, View } from "@fq/protocol";
import type { Turn } from "../../engine/turn.js";
import { button, freezeView, hud, legacy } from "../../engine/view.js";
import type { Json } from "../../state/types.js";
import { broadcastTv, mailContinue, mailPicture, mailText } from "../mail.js";
import { addToNews } from "../news.js";
import { isPresent } from "../presence.js";
import { statLines } from "../statLines.js";

/**
 * Scene scripts: the TypeScript replacement for the original C-like script
 * engine (legacy/source/command_script*.cpp, scripts in legacy/dist/script).
 *
 * A script is a generator. It never touches state directly: every read,
 * write and random draw is an operation it yields (`yield* s.getTags(...)`),
 * and `yield* s.show(screen)` sends a screen and waits for the reply, like
 * `SendPacketAndWait`. The runner records the result of every operation and
 * every reply in a journal stored in `SessionState.script`. To resume after a
 * reply (or after the town was saved and loaded), the runner restarts the
 * generator and feeds it the journal without running the operations again,
 * then carries on live. The journal is plain JSON, so a script survives a
 * round trip, and replays are exact.
 *
 * Rule for script authors: compute only from values that came through an
 * operation or from constants. Reading `turn` outside `s.op` breaks replay.
 */
export type ScriptOp =
  | { kind: "do"; run: (turn: Turn) => Json }
  | { kind: "show"; screen: ScriptScreen };

export type ScriptGen<R = void> = Generator<ScriptOp, R, Json>;

export interface ScriptDef {
  /** For example "script_event" or "events/arson". */
  id: string;
  /** `init_location_info` name while it runs. */
  location: string;
  main(s: ScriptApi): ScriptGen;
}

/** Where a script button leads. */
export type ScriptTarget =
  /** `AddButton`: resumes the script with this result (`i_my_result`). */
  | { result: number }
  /** `AddButtonHome`, `AddButtonTownMap`, ...: leaves the script for a module. */
  | { go: string };

export interface ScriptButton {
  /** 1 to 5 as in `add_button`: 1 is the rightmost slot, 5 the leftmost. */
  slot: number;
  label: string;
  target: ScriptTarget;
}

/**
 * One packet. Fields left out keep their value from the screen already shown,
 * as the original's `c_command_generic` refresh did; buttons always replace
 * (every Classic script sets `b_kill_buttons`).
 */
export interface ScriptScreen {
  /** `SendPacketAndWait` (screen), `SendPacketAndWaitOverlay` (overlay), `SendPacketAndWaitStats` (stats). */
  mode: "screen" | "overlay" | "stats";
  /** `st_main` (or `st_temp` on the stats screen), legacy markup. */
  text?: string;
  /** `st_url`; null clears it. */
  picture?: AssetId | null;
  /** `st_url_bg`; null clears it. */
  background?: AssetId | null;
  buttons: ScriptButton[];
  /** `st_message` of the `i_getname` overlay. */
  prompt?: string;
  /** `st_generic_info`: the parchment note. "" blanks it. */
  note?: string;
  /** `st_generic_status`: the status line. "" blanks it. */
  status?: string;
  /** `st_object` = `i_generic`: start a new generic screen instead of refreshing the one shown. */
  fresh?: boolean;
}

/** The functions the original exposed to scripts, as yieldable operations. */
export class ScriptApi {
  constructor(readonly myId: number) {}

  /** Runs `run` live, or returns its recorded result during replay. */
  *op<T extends Json>(run: (turn: Turn) => T): ScriptGen<T> {
    return (yield { kind: "do", run }) as T;
  }

  /** `SendPacketAndWait` and friends: shows a screen, returns the reply. */
  *show(screen: ScriptScreen): ScriptGen<number> {
    return (yield { kind: "show", screen }) as number;
  }

  /** `RandomRange` (shared/CScriptEngine.cpp:54-59). */
  randomRange(low: number, high: number): ScriptGen<number> {
    return this.op((t) => t.rng.randomRange(low, high));
  }

  /** `GetTags` (command_script_vars.cpp:501-519). */
  getTags(id: number, tier: number): ScriptGen<number> {
    return this.op((t) => t.town.players[id]?.tags[tier] ?? 0);
  }

  /** `ModTags` (command_script_vars.cpp:521-541): no clamping. */
  modTags(id: number, tier: number, amount: number): ScriptGen<number> {
    return this.op((t) => {
      const p = t.town.players[id];
      if (!p?.active) return 0;
      p.tags[tier] = (p.tags[tier] ?? 0) + amount;
      return p.tags[tier] as number;
    });
  }

  /** `SetTags` (command_script_vars.cpp:544-564). */
  setTags(id: number, tier: number, amount: number): ScriptGen<number> {
    return this.op((t) => {
      const p = t.town.players[id];
      if (!p?.active) return 0;
      p.tags[tier] = amount;
      return amount;
    });
  }

  /** `IsPlayerOnNow` (command_script_vars.cpp:567-589). */
  isPlayerOnNow(id: number): ScriptGen<number> {
    return this.op((t) => (t.town.players[id]?.active && isPresent(t.town, id) ? 1 : 0));
  }

  /** `GetNameFromID` */
  getName(id: number): ScriptGen<string> {
    return this.op((t) => t.town.players[id]?.name ?? "");
  }

  /** `GetHomeNameFromID` */
  getHomeName(id: number): ScriptGen<string> {
    return this.op((t) => t.town.players[id]?.parlor ?? "");
  }

  /** `GetCustomByID` */
  getCustom(id: number, index: number): ScriptGen<number> {
    return this.op((t) => t.town.players[id]?.custom[index] ?? 0);
  }

  /** `GetTotalBurials` (command_script_vars.cpp:717-731): plots. */
  getTotalBurials(id: number): ScriptGen<number> {
    return this.op((t) => t.town.players[id]?.plots ?? 0);
  }

  /** `ModTotalBurials` (command_script_vars.cpp:734-750): never below 0. */
  modTotalBurials(id: number, amount: number): ScriptGen<number> {
    return this.op((t) => {
      const p = t.town.players[id];
      if (!p?.active) return 0;
      p.plots = Math.max(0, p.plots + amount);
      return p.plots;
    });
  }

  /** `AddToNews` (command_script_misc.cpp:43-46). */
  addToNews(text: string): ScriptGen<null> {
    return this.op((t) => {
      addToNews(t.town, text);
      return null;
    });
  }

  /** `BroadCastTV` (command_script_misc.cpp:48-51). */
  broadcastTv(text: string): ScriptGen<null> {
    return this.op((t) => {
      broadcastTv(t, text);
      return null;
    });
  }

  /** `MailText` (command_script_misc.cpp:53-65). */
  mailText(id: number, text: string): ScriptGen<null> {
    return this.op((t) => {
      mailText(t.town, id, text);
      return null;
    });
  }

  /** `MailPicture` (command_script_misc.cpp:67-79). */
  mailPicture(id: number, picture: AssetId): ScriptGen<null> {
    return this.op((t) => {
      mailPicture(t.town, id, picture);
      return null;
    });
  }

  /** `MailContinueButton` (command_script_misc.cpp:81-93). */
  mailContinueButton(id: number): ScriptGen<null> {
    return this.op((t) => {
      mailContinue(t, id);
      return null;
    });
  }

  /** `LogMsg` */
  logMsg(text: string): ScriptGen<null> {
    return this.op((t) => {
      t.log(text);
      return null;
    });
  }
}

/** Slot order of `add_button` (funeral_util.cpp:10-31) from left to right: 5, 4, 3, 2, 1. */
function orderButtons(buttons: ScriptButton[]): Button[] {
  return [...buttons]
    .sort((a, b) => b.slot - a.slot)
    .map((b) => {
      const id = "result" in b.target ? `script:${b.target.result}` : `go:${b.target.go}`;
      return button(id, b.label);
    });
}

/** Builds the view for a screen packet, refreshing the screen already shown. */
function renderScreen(turn: Turn, screen: ScriptScreen): View {
  const session = turn.session;
  const previous = session.view;
  const fresh = screen.fresh === true;
  const scene: SceneKind = fresh
    ? "location"
    : screen.mode === "stats"
      ? "stats"
      : (previous?.scene ?? "desk");
  const base: View = fresh
    ? { scene, title: session.location, text: [], buttons: [] }
    : screen.mode === "stats" || !previous
      ? { scene, title: turn.text.stats.title, text: [], buttons: [] }
      : { ...previous };
  const view: View = { ...base, scene, hud: hud(turn.player) };
  delete view.overlay;
  delete view.customer;
  if (screen.text !== undefined) view.text = legacy(screen.text);
  if (screen.note !== undefined) {
    if (screen.note === "") delete view.note;
    else view.note = legacy(screen.note);
  }
  if (screen.status !== undefined) {
    if (screen.status === "") delete view.status;
    else view.status = legacy(screen.status);
  }
  if (screen.picture !== undefined || screen.background !== undefined) {
    const pic = { ...(previous && screen.mode !== "stats" && !fresh ? previous.picture : {}) };
    if (screen.picture !== undefined) {
      if (screen.picture === null) delete pic.fg;
      else pic.fg = screen.picture;
    }
    if (screen.background !== undefined) {
      if (screen.background === null) delete pic.bg;
      else pic.bg = screen.background;
    }
    view.picture = pic;
  }
  view.buttons = orderButtons(screen.buttons);
  if (screen.mode === "overlay") {
    view.buttons = [];
    view.overlay = {
      kind: "playerPicker",
      id: "script:getname",
      prompt: screen.prompt ?? "",
      players: turn.town.players.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name })),
    };
  }
  if (screen.mode === "stats") view.stats = statLines(turn);
  return freezeView(view);
}

/** What happens when a script's main function returns: back to the desk. */
function exit(turn: Turn): View {
  const desk = turn.registry.module("desk");
  if (!desk?.enter) throw new Error("No desk module registered");
  return desk.enter(turn, undefined);
}

/** Runs (or replays then continues) the session's script until it waits. */
export function runScript(turn: Turn): View {
  const state = turn.session.script;
  if (!state) return exit(turn);
  const def = turn.registry.script(state.id);
  if (!def) {
    turn.session.script = null;
    return exit(turn);
  }
  const gen = def.main(new ScriptApi(turn.playerId));
  let cursor = 0;
  let result = gen.next();
  for (;;) {
    if (result.done) {
      turn.session.script = null;
      return exit(turn);
    }
    const op = result.value;
    if (cursor < state.journal.length) {
      result = gen.next(state.journal[cursor++] as Json);
      continue;
    }
    if (op.kind === "do") {
      const value = op.run(turn);
      state.journal.push(value);
      cursor++;
      result = gen.next(value);
      continue;
    }
    return renderScreen(turn, op.screen);
  }
}

/**
 * `online_struct::InitScript` (legacy/source/online_struct.cpp:13-64): stops
 * any running script and starts `id` from the top.
 */
export function startScript(turn: Turn, id: string): View {
  turn.session.script = { id, journal: [] };
  const def = turn.registry.script(id);
  if (def) turn.session.location = def.location;
  return runScript(turn);
}

/** `CommandScriptCallback` (legacy/source/command_script.cpp:100-119): resume with a reply. */
export function resumeScript(turn: Turn, reply: number): View {
  const state = turn.session.script;
  if (!state) return exit(turn);
  state.journal.push(reply);
  return runScript(turn);
}

/** `KillActiveScript` (online_struct.cpp:73-82). No Classic script has an OnKill body. */
export function killScript(turn: Turn): void {
  turn.session.script = null;
}
