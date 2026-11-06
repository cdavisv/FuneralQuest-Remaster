import type { OracleReply } from "./oracle.js";
import { OracleProcess } from "./oracleProcess.js";
import { PortDriver, START_CLOCK_S } from "./port.js";
import {
  diffValues,
  type FieldDiff,
  fromOracle,
  fromPort as snapPort,
  type TownSnap,
} from "./snapshot.js";
import { buttons, fromPort, get, parseOriginal, query, type Vars } from "./vars.js";

/** What a client does. Both sides get the same action; each turns it into its own request. */
export type Step =
  | { kind: "checklogon"; p: number }
  | { kind: "new"; p: number; name: string; parlor: string; male: boolean }
  | { kind: "logon"; p: number }
  | { kind: "cmd"; p: number; command: number; extra?: Record<string, string | number> }
  /** Press the plaque button with this label (trimmed, case-insensitive) on the last screen. */
  | { kind: "press"; p: number; label: string }
  /** Answer the last screen's text prompt (`i_get_text`); null is the client's Abort. */
  | { kind: "text"; p: number; text: string | null }
  /**
   * A name prompt (`i_getname`): the client sends the text (`c_request_getname`),
   * the server answers "Do you mean X?" (`i_namenext`), and on Yes the client
   * sends the prompt's return command with the player id found.
   */
  | { kind: "name"; p: number; text: string; accept: boolean; cancel?: boolean }
  /** The desk's pen: find a player by name (as above), then send the letter (`c_request_send_mail`). */
  | { kind: "mail"; p: number; to: string; text: string }
  /**
   * The Reply button on a letter (`c_request_reply`, handled in the client:
   * welcome.swf sprite 450 opens the pad with the quote), then the letter is
   * sent to the response's `i_his_id`, then the desk (the pad's callback).
   */
  | { kind: "reply"; p: number; text: string }
  /** Close a rankings-style list: the client sends that response's `i_rank_command`. */
  | { kind: "rankClose"; p: number }
  | { kind: "drop"; p: number }
  | { kind: "midnight" };

export interface SideResult {
  /** Every response sent during the step (usually one). */
  responses: Vars[];
  /** The original's log lines during the step (`LogMsg`), for coverage. */
  log?: string[];
  /** The requests sent (after "request.xp?"). */
  queries?: string[];
  town: TownSnap;
  rng: { mt: number; crt: number };
  /** Set when the side could not perform the step (for example, no such button). */
  refused?: string;
}

export interface StepRecord {
  index: number;
  step: Step;
  original: SideResult;
  port: SideResult;
  state: FieldDiff[];
  rng: FieldDiff[];
}

export const ABORT = "12ABORT12";

function ipOf(p: number): string {
  return `10.0.0.${p + 1}`;
}

function logonOf(p: number): string {
  return `player${p + 1}`;
}

/**
 * Runs the original (the oracle process) and the port side by side. Each
 * keeps its own last response per player, because a button press sends the
 * command number that side's own last response gave the button.
 */
export class Pair {
  readonly oracle = new OracleProcess();
  readonly port = new PortDriver();
  private readonly lastOriginal = new Map<number, Vars>();
  private readonly lastPort = new Map<number, Vars>();
  /**
   * The client's root variables, per side and player. The Flash client loads
   * every response into _level0, where values stay until overwritten, and
   * sends some of them back (welcome.swf, the i_sender sprites): a value the
   * last response did not set can be an old one.
   */
  private readonly roots = new Map<string, Map<string, string>>();
  private clock = START_CLOCK_S;
  readonly records: StepRecord[] = [];

  async start(mtSeed: number, crtSeed: number): Promise<StepRecord> {
    await this.oracle.send(`clock ${this.clock}`);
    await this.oracle.send(`seed ${mtSeed} ${crtSeed}`);
    const init = await this.oracle.send("init");
    this.port.setClock(this.clock);
    this.port.seed(mtSeed, crtSeed);
    this.port.init();
    return this.record({ kind: "midnight" }, this.originalResult(init), this.portResult([]));
  }

  close(): void {
    this.oracle.close();
  }

  /** Test set-up on both sides: one field of player `id`'s record. */
  async grant(id: number, field: string, value: number): Promise<void> {
    await this.oracle.send(`grant ${id} ${field} ${value}`);
    this.port.grant(id, field, value);
  }

  /** Changes a Game Setting on both sides (not a step: no state is compared). */
  async set(key: string, value: number | boolean): Promise<void> {
    await this.oracle.send(`set ${key} ${typeof value === "boolean" ? Number(value) : value}`);
    this.port.set(key, value);
  }

  /** The last response a side sent to player p. */
  last(side: "original" | "port", p: number): Vars {
    return (side === "original" ? this.lastOriginal : this.lastPort).get(p) ?? [];
  }

  async run(step: Step): Promise<StepRecord> {
    const original = await this.runOriginal(step);
    const port = await this.runPort(step);
    return this.record(step, original, port);
  }

  private record(step: Step, original: SideResult, port: SideResult): StepRecord {
    const rec: StepRecord = {
      index: this.records.length,
      step,
      original,
      port,
      state: diffValues(original.town, port.town),
      rng: diffValues(original.rng, port.rng),
    };
    this.records.push(rec);
    return rec;
  }

  private originalResult(reply: OracleReply, refused?: string | undefined): SideResult {
    if (!reply.town) throw new Error(`oracle reply without town: ${reply.op}`);
    return {
      responses: reply.responses.map(parseOriginal),
      ...(reply.log ? { log: reply.log } : {}),
      town: fromOracle(reply.town),
      rng: reply.rng,
      ...(refused ? { refused } : {}),
    };
  }

  private portResult(responses: Vars[], refused?: string | undefined): SideResult {
    return {
      responses,
      town: snapPort(this.port.current()),
      rng: this.port.draws,
      ...(refused ? { refused } : {}),
    };
  }

  private root(side: string, p: number): Map<string, string> {
    const key = `${side}:${p}`;
    let r = this.roots.get(key);
    if (!r) {
      r = new Map();
      this.roots.set(key, r);
    }
    return r;
  }

  /**
   * A request as the i_sender sprite builds it (welcome.swf sprite 374 frame
   * 36): `i_command` and the root's `i_command_sub` always, and with prompt
   * answers `st_input`, `st_extra_text` and `i_his_id`. It also blanks the
   * buttons and pictures of the root before sending.
   */
  private send(
    side: string,
    p: number,
    command: string | number,
    sub: string | undefined,
    input?: Record<string, string | number>,
  ): string {
    const r = this.root(side, p);
    r.set("i_command_sub", sub ?? "");
    for (const k of ["st_option_a", "st_option_0", "st_option_1", "st_option_2", "st_option_3"]) {
      r.set(k, "");
    }
    return query("command", { i_command: command, i_command_sub: sub ?? "", ...(input ?? {}) });
  }

  /** The request a side sends for a step, from its own last response. */
  private requestFor(
    step: Step,
    last: Vars,
    side: string,
  ): { query: string } | { refused: string } {
    const r = step.kind === "midnight" ? new Map<string, string>() : this.root(side, step.p);
    switch (step.kind) {
      case "checklogon":
        return { query: "checklogon" };
      case "new":
        return {
          query: query("new", {
            logon: logonOf(step.p),
            name: step.name,
            f_name: step.parlor,
            password: "pw",
            password_v: "pw",
            b_male: step.male ? 1 : 0,
            email: `${logonOf(step.p)}@example.com`,
          }),
        };
      case "logon":
        return { query: query("logon", { st_logon: logonOf(step.p), st_password: "pw" }) };
      case "cmd":
        // contact_server(code): only i_command changes.
        return {
          query: this.send(side, step.p, step.command, r.get("i_command_sub"), step.extra),
        };
      case "press": {
        const want = step.label.trim().toLowerCase();
        const b = buttons(last).find((x) => x.label.toLowerCase() === want);
        if (!b) return { refused: `no button "${step.label}"` };
        // Buttons 1-5 (welcome.swf, sprite 450): i_command_sub = i_command_sub_N, old or new.
        return { query: this.send(side, step.p, b.command, r.get(`i_command_sub_${b.key}`)) };
      }
      case "rankClose":
        return {
          query: this.send(side, step.p, get(last, "i_rank_command") ?? 4, r.get("i_command_sub")),
        };
      case "text": {
        if (get(last, "i_return_command") === undefined) return { refused: "no text prompt" };
        // special_callback: i_command(_sub) = i_return_command(_sub), with the input fields.
        return {
          query: this.send(
            side,
            step.p,
            r.get("i_return_command") ?? "",
            r.get("i_return_command_sub"),
            {
              st_input: r.get("st_input") ?? "",
              st_extra_text: step.text ?? ABORT,
              i_his_id: r.get("i_his_id") ?? "",
            },
          ),
        };
      }
      default:
        return { refused: `not a request: ${step.kind}` };
    }
  }

  /** Loads a response into the client's root variables. */
  private noteReturn(side: string, p: number, vars: Vars): void {
    const r = this.root(side, p);
    for (const [k, v] of vars) r.set(k, v);
  }

  /** Sends a letter; on `c_command_callback` the pad asks for the desk (welcome.swf sprite 456). */
  private async sendLetter(
    side: string,
    p: number,
    send: (q: string) => Promise<Vars | undefined>,
    text: string,
    to: string | number,
  ): Promise<void> {
    const r = this.root(side, p);
    const sent = await send(
      this.send(side, p, 20, r.get("i_command_sub"), {
        st_input: text,
        st_extra_text: r.get("st_extra_text") ?? "",
        i_his_id: to,
      }),
    );
    if (get(sent ?? [], "i_sent") === "16")
      await send(this.send(side, p, 4, r.get("i_command_sub")));
  }

  /** The requests of a name, mail or reply step, sent one after another through `send`. */
  private async nameFlow(
    side: string,
    step: Extract<Step, { kind: "name" | "mail" | "reply" }>,
    send: (q: string) => Promise<Vars | undefined>,
  ): Promise<string | undefined> {
    const r = this.root(side, step.p);
    if (step.kind === "reply") {
      const to = r.get("i_his_id");
      if (to === undefined) return "no letter to reply to";
      await this.sendLetter(side, step.p, send, (r.get("st_quote") ?? "") + step.text, to);
      return undefined;
    }
    // The name box (welcome.swf sprite 498, buttons 495/496) asks
    // c_request_getname with the text and where to start; "Do you mean X?"
    // (sprite 508): Yes (486) sends the box's return command with the id, No
    // (501) asks again from the next slot, and "nobody" (504) or Cancel (496)
    // calls callback_email_fail: at the desk's pen that only redraws the desk,
    // elsewhere it sends the return command with i_his_id -1.
    const text = step.kind === "name" ? step.text : step.to;
    const fail = async (): Promise<undefined> => {
      if (step.kind === "mail") return undefined;
      const command = r.get("i_return_command");
      if (command === undefined) return undefined;
      await send(
        this.send(side, step.p, command, r.get("i_return_command_sub"), {
          st_input: text,
          st_extra_text: r.get("st_extra_text") ?? "",
          i_his_id: -1,
        }),
      );
      return undefined;
    };
    if (step.kind === "name" && step.cancel) return fail();
    const ask = (from: number) =>
      this.send(side, step.p, 17, r.get("i_command_sub"), {
        st_input: text,
        st_extra_text: r.get("st_extra_text") ?? "",
        i_his_id: from,
      });
    let id = Number(get((await send(ask(0))) ?? [], "i_his_id") ?? -1);
    if (id >= 0 && step.kind === "name" && !step.accept) {
      id = Number(get((await send(ask(id + 1))) ?? [], "i_his_id") ?? -1);
    }
    if (id < 0) return fail();
    if (step.kind === "mail") {
      await this.sendLetter(side, step.p, send, step.text, id);
      return undefined;
    }
    const command = r.get("i_return_command");
    if (command === undefined) return "no return command for the name prompt";
    await send(
      this.send(side, step.p, command, r.get("i_return_command_sub"), {
        st_input: text,
        st_extra_text: r.get("st_extra_text") ?? "",
        i_his_id: id,
      }),
    );
    return undefined;
  }

  private async runOriginal(step: Step): Promise<SideResult> {
    if (step.kind === "name" || step.kind === "mail" || step.kind === "reply") {
      const responses: Vars[] = [];
      const queries: string[] = [];
      const logs: string[] = [];
      const holder: { last: OracleReply | null } = { last: null };
      const refused = await this.nameFlow("original", step, async (q) => {
        const reply = await this.oracle.send(`req ${ipOf(step.p)} ${q}`);
        holder.last = reply;
        queries.push(q);
        logs.push(...(reply.log ?? []));
        const vars = reply.responses.map(parseOriginal);
        responses.push(...vars);
        const v = vars[vars.length - 1];
        if (v) {
          this.lastOriginal.set(step.p, v);
          this.noteReturn("original", step.p, v);
        }
        return v;
      });
      const result = this.originalResult(holder.last ?? (await this.oracle.send("state")), refused);
      result.responses = responses;
      result.queries = queries;
      result.log = logs;
      return result;
    }
    if (step.kind === "midnight") {
      const reply = await this.oracle.send("midnight");
      this.clock = (reply as OracleReply & { clock?: number }).clock ?? this.clock;
      return this.originalResult(reply);
    }
    if (step.kind === "drop") {
      const reply = await this.oracle.send(`drop ${ipOf(step.p)}`);
      this.lastOriginal.delete(step.p);
      this.roots.delete(`original:${step.p}`);
      return this.originalResult(reply);
    }
    const req = this.requestFor(step, this.lastOriginal.get(step.p) ?? [], "original");
    if ("refused" in req) {
      return this.originalResult(await this.oracle.send("state"), req.refused);
    }
    const reply = await this.oracle.send(`req ${ipOf(step.p)} ${req.query}`);
    const result = this.originalResult(reply);
    result.queries = [req.query];
    const lastVars = result.responses[result.responses.length - 1];
    if (lastVars) {
      this.lastOriginal.set(step.p, lastVars);
      this.noteReturn("original", step.p, lastVars);
    }
    return result;
  }

  private async runPort(step: Step): Promise<SideResult> {
    if (step.kind === "name" || step.kind === "mail" || step.kind === "reply") {
      const responses: Vars[] = [];
      const refused = await this.nameFlow("port", step, async (q) => {
        const vars = fromPort(await this.port.request(step.p, q));
        responses.push(vars);
        this.lastPort.set(step.p, vars);
        this.noteReturn("port", step.p, vars);
        return vars;
      });
      return this.portResult(responses, refused);
    }
    if (step.kind === "midnight") {
      this.port.midnight(this.clock);
      return this.portResult([]);
    }
    if (step.kind === "drop") {
      const id = this.playerIdOf(step.p);
      this.port.drop(step.p, id);
      this.lastPort.delete(step.p);
      this.roots.delete(`port:${step.p}`);
      return this.portResult([]);
    }
    const req = this.requestFor(step, this.lastPort.get(step.p) ?? [], "port");
    if ("refused" in req) return this.portResult([], req.refused);
    const vars = fromPort(await this.port.request(step.p, req.query));
    this.lastPort.set(step.p, vars);
    this.noteReturn("port", step.p, vars);
    return this.portResult([vars]);
  }

  /** The port's player id for client p (by log-on name). */
  private playerIdOf(p: number): number | null {
    const town = this.port.current();
    const logon = logonOf(p);
    const found = town.players.find((x) => x.active && x.logon.toLowerCase() === logon);
    return found ? found.id : null;
  }
}
