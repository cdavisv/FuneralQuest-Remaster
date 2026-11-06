import type { FastifyInstance } from "fastify";
import { decodeBody } from "../../src/escape.js";

/** Flash's own escaping of a variable value in a GET query: everything but letters and digits is %XX, space is +. */
export function flashEscape(value: string): string {
  let out = "";
  for (const byte of new TextEncoder().encode(value)) {
    const ch = String.fromCharCode(byte);
    if (/[A-Za-z0-9]/.test(ch)) out += ch;
    else if (ch === " ") out += "+";
    else out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return out;
}

export interface Reply {
  status: number;
  headers: Record<string, unknown>;
  raw: string;
  vars: Map<string, string>;
}

/**
 * Plays the part of welcome.swf: it keeps the root variables the movie keeps
 * (a response sets variables, later requests read them), sends requests the
 * way the movie's `loadVariables` calls do, and "clicks" plaque buttons by
 * reading `i_command_<key>` / `i_command_sub_<key>` from what the server
 * last sent. Cookies are kept like a browser.
 */
export class FlashClient {
  /** Root variables (`/:name`). */
  readonly root = new Map<string, string>();
  private cookie = "";
  readonly log: { request: string; reply: Reply }[] = [];

  /** `prefix` is where the bridge is mounted, such as "/museum" (default: the root). */
  constructor(
    private readonly app: FastifyInstance,
    private readonly prefix = "",
  ) {}

  get(name: string): string {
    return this.root.get(name) ?? "";
  }

  num(name: string): number {
    return Number(this.root.get(name) ?? Number.NaN);
  }

  private async send(verb: string, vars: [string, string | number][]): Promise<Reply> {
    this.root.set("i_sent", "0");
    const query = [
      verb,
      ...vars.map(([n, v]) => `${n}=${flashEscape(String(v))}`),
      `key=${Math.random()}`,
    ].join("&");
    const url = `${this.prefix}/request.xp?${query}`;
    const res = await this.app.inject({
      method: "GET",
      url,
      headers: this.cookie ? { cookie: this.cookie } : {},
    });
    const set = res.headers["set-cookie"];
    const first = Array.isArray(set) ? set[0] : set;
    if (typeof first === "string") this.cookie = first.split(";")[0] ?? "";
    const vars2 = decodeBody(res.body);
    for (const [name, value] of vars2) this.root.set(name, value);
    const reply: Reply = {
      status: res.statusCode,
      headers: res.headers,
      raw: res.body,
      vars: vars2,
    };
    this.log.push({ request: url, reply });
    return reply;
  }

  /** welcome.swf sprite 114, frame 1. */
  checkLogon(): Promise<Reply> {
    return this.send("checklogon", [["i_sent", 0]]);
  }

  /** sprite 114 frame 21, the `m_link_logon` clip. */
  logon(name: string, password: string): Promise<Reply> {
    return this.send("logon", [
      ["st_logon", name],
      ["st_password", password],
    ]);
  }

  /** sprite 113 frame 20. */
  newUser(f: {
    logon: string;
    password: string;
    passwordVerify?: string;
    name: string;
    parlor: string;
    male?: boolean;
    email: string;
  }): Promise<Reply> {
    return this.send("new", [
      ["logon", f.logon],
      ["password", f.password],
      ["password_v", f.passwordVerify ?? f.password],
      ["name", f.name],
      ["f_name", f.parlor],
      ["b_male", f.male === false ? 0 : 1],
      ["email", f.email],
    ]);
  }

  /** The `onClipEvent(load)` of the f_message frames: `request.xp?command` with the clip's variables. */
  command(
    i_command: number,
    extra: { sub?: number; input?: string; extraText?: string; hisId?: number; note?: string } = {},
  ): Promise<Reply> {
    const vars: [string, string | number][] = [["i_command", i_command]];
    if (extra.sub !== undefined) vars.push(["i_command_sub", extra.sub]);
    if (extra.input !== undefined) vars.push(["st_input", extra.input]);
    if (extra.extraText !== undefined) vars.push(["st_extra_text", extra.extraText]);
    if (extra.hisId !== undefined) vars.push(["i_his_id", extra.hisId]);
    if (extra.note !== undefined) vars.push(["st_note", extra.note]);
    // The sender clears these before asking (welcome.swf sprite 374 frame 36).
    this.root.set("b_kill_buttons", "0");
    for (const name of [
      "st_option_a",
      "st_option_0",
      "st_option_1",
      "st_option_2",
      "st_option_3",
      "st_url",
      "st_url_bg",
    ]) {
      this.root.set(name, "");
    }
    return this.send("command", vars);
  }

  /** Clicks the plaque button with key letter `key` (buttons 126-138 of welcome.swf). */
  click(
    key: "a" | "0" | "1" | "2" | "3",
    extra: Parameters<FlashClient["command"]>[1] = {},
  ): Promise<Reply> {
    const command = this.num(`i_command_${key}`);
    if (!Number.isFinite(command)) throw new Error(`There is no button ${key} on screen`);
    const subVar = this.root.get(`i_command_sub_${key}`);
    return this.command(command, {
      ...extra,
      ...(subVar !== undefined ? { sub: Number(subVar) } : {}),
    });
  }

  /** The labels of the visible plaque buttons, left to right. */
  buttons(): string[] {
    return (["a", "0", "1", "2", "3"] as const)
      .map((k) => this.get(`st_option_${k}`).trim())
      .filter((t) => t !== "");
  }

  /** The key letter of the plaque button whose label (stripped of markup) is `label`. */
  keyOf(label: string): "a" | "0" | "1" | "2" | "3" {
    for (const k of ["a", "0", "1", "2", "3"] as const) {
      if (this.get(`st_option_${k}`).trim() === label) return k;
    }
    throw new Error(`No button "${label}" in ${JSON.stringify(this.buttons())}`);
  }
}

/** Visible text of an HTML text field value. */
export function plain(html: string): string {
  return html
    .replace(/<br>/g, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
