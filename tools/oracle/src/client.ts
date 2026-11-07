import { type Button, buttons, get, type Vars } from "./vars.js";

/** `i_sent` values (commands.h:62-72 and the client's handlers). */
export const SENT = {
  quit: 1,
  loadMovie: 2,
  stats: 3,
  main: 4,
  news: 5,
  ranking: 9,
  object: 10,
  objectAdd: 14,
  callback: 16,
  chatUpdate: 24,
  generic: 33,
  fatal: -1,
} as const;

export type Overlay = "i_get_text" | "i_getname" | "i_namenext" | "i_message" | "i_mail";

/**
 * What the original Flash client is showing, followed from the responses it
 * receives (welcome.swf's handlers as legacy-compat documents them): the
 * screen object, its plaque buttons, whether the desk menu is hidden
 * (`b_kill_buttons`), and any overlay.
 */
export class ClientModel {
  object: string | null = null;
  plaque: Button[] = [];
  kill = false;
  overlay: Overlay | null = null;
  /** The command a text or name prompt answers with (`i_return_command`). */
  returnTo: { command: string; sub: string | undefined } | null = null;
  turns = 0;
  /** What the rankings screen's close button sends (`i_rank_command`, default the desk). */
  rankCommand = 4;

  apply(vars: Vars): void {
    const sent = Number(get(vars, "i_sent") ?? Number.NaN);
    const object = get(vars, "st_object");
    const kill = get(vars, "b_kill_buttons");
    const turns = get(vars, "i_turns");
    if (turns !== undefined) this.turns = Number(turns.replace(/,/g, ""));
    const ret = get(vars, "i_return_command");
    if (ret !== undefined) this.returnTo = { command: ret, sub: get(vars, "i_return_command_sub") };
    switch (sent) {
      case SENT.quit:
      case SENT.fatal:
        this.object = null;
        this.plaque = [];
        this.overlay = null;
        this.kill = false;
        return;
      case SENT.news:
        this.object = "news";
        this.plaque = [];
        this.overlay = null;
        return;
      case SENT.ranking:
        this.rankCommand = Number(get(vars, "i_rank_command") ?? 4);
        this.object = "rankings";
        this.plaque = [];
        this.overlay = null;
        return;
      case SENT.objectAdd:
        this.overlay = (object as Overlay | undefined) ?? null;
        return;
      case SENT.callback:
        this.overlay = null;
        return;
      case SENT.object:
        this.object = object ?? this.object;
        this.overlay = null;
        this.plaque = buttons(vars);
        this.kill = kill === "1";
        return;
      case SENT.stats:
        this.object = "stats";
        this.overlay = null;
        this.plaque = buttons(vars);
        return;
      default:
        // A refresh of the current screen (load movie, generic, chat update).
        this.overlay = null;
        this.plaque = buttons(vars);
        if (kill !== undefined) this.kill = kill === "1";
    }
  }

  /** The desk's own menu (wait, map, news...) is on screen. */
  get deskMenu(): boolean {
    return this.object === "m_main" && !this.kill && this.overlay === null;
  }
}
