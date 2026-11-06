import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from "vitest";
import { ABORT_TEXT, PLACE_COMMANDS, RETURN_COMMAND, Request, Sent } from "../src/commands.js";
import { createDevHost, type DevHost } from "../src/devHost.js";
import { legacyCompat } from "../src/plugin.js";
import { FlashClient, plain } from "./support/flashClient.js";

/**
 * A random player at the real client's controls. Each step it looks at what
 * the last response put on screen (which screen object, which plaque buttons,
 * which overlay) and does something the client lets a player do there. Over
 * a few hundred steps it must never see a fatal error, an unknown object, a
 * screen with more than five plaque buttons, or a request the bridge could
 * not map (the bridge logs those).
 */

const KNOWN_OBJECTS = new Set([
  "m_main",
  "i_generic",
  "i_map",
  "i_chat",
  "i_getname",
  "i_namenext",
  "i_get_text",
  "i_message",
]);

type Screen =
  | "logon"
  | "news"
  | "m_main"
  | "i_generic"
  | "i_map"
  | "i_chat"
  | "rankings"
  | "stats"
  | "overlay";

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

let app: FastifyInstance;
let host: DevHost;
let notes: string[];

beforeAll(async () => {
  notes = [];
  host = await createDevHost({ seed: 99, rivals: 3 });
  app = Fastify();
  await app.register(legacyCompat, { host, enabled: true, log: (line) => notes.push(line) });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

class Walker {
  readonly flash: FlashClient;
  screen: Screen = "logon";
  overlay: "getname" | "namenext" | "get_text" | "noname" | "message" | "pad" | null = null;
  readonly seen = new Set<string>();
  /** Engine modules the player's session has been in (`session.scene`). */
  readonly modules = new Set<string>();
  /** Distinct (screen object, button label) pairs pressed. */
  readonly pressed = new Set<string>();
  readonly sentCodes = new Set<number>();
  steps = 0;
  /** Bridge log lines that mean a request had no use, with what the walker had just done. */
  readonly problems: string[] = [];
  readonly recent: string[] = [];

  constructor(
    private readonly rand: () => number,
    app: FastifyInstance,
  ) {
    this.flash = new FlashClient(app);
  }

  private pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.rand() * list.length)] as T;
  }

  private visibleKeys(): ("a" | "0" | "1" | "2" | "3")[] {
    return (["a", "0", "1", "2", "3"] as const).filter(
      (k) => this.flash.get(`st_option_${k}`) !== "",
    );
  }

  /** Reads a response the way the movie's handlers do and works out where the client is now. */
  private update(): void {
    const f = this.flash;
    const sent = f.num("i_sent");
    this.sentCodes.add(sent);
    expect(sent, "a fatal error").not.toBe(Sent.fatal);
    expect([1, 2, 3, 5, 9, 10, 14, 16, 24, 33, 0], `i_sent ${sent}`).toContain(sent);
    const keys = this.visibleKeys();
    expect(keys.length).toBeLessThanOrEqual(5);
    switch (sent) {
      case Sent.quit:
        this.screen = "logon";
        break;
      case Sent.news:
        this.screen = "news";
        break;
      case Sent.ranking:
        this.screen = "rankings";
        break;
      case Sent.stats:
        this.screen = "stats";
        break;
      case Sent.object: {
        const object = f.get("st_object");
        expect(KNOWN_OBJECTS.has(object), `object ${object}`).toBe(true);
        this.screen = object as Screen;
        this.overlay = null;
        this.seen.add(object);
        break;
      }
      case Sent.objectAdd: {
        const object = f.get("st_object");
        expect(KNOWN_OBJECTS.has(object), `object ${object}`).toBe(true);
        this.seen.add(object);
        this.overlay =
          object === "i_getname"
            ? "getname"
            : object === "i_get_text"
              ? "get_text"
              : object === "i_message"
                ? "message"
                : f.num("i_his_id") < 0
                  ? "noname"
                  : "namenext";
        break;
      }
      case Sent.generic:
      case Sent.loadMovie:
        this.overlay = null;
        break;
      case Sent.callback:
        break;
      case Sent.pending:
        // Reply: the client opens its mail pad and nothing is drawn by the server.
        this.overlay = "pad";
        break;
      default:
        break;
    }
  }

  async start(): Promise<void> {
    await this.flash.checkLogon();
    await this.flash.newUser({
      logon: `walker${Math.floor(this.rand() * 1e6)}`,
      password: "pw",
      name: `Walker ${Math.floor(this.rand() * 1e4)}`,
      parlor: "Walkers Rest",
      email: "walker@example.com",
    });
    this.update();
    expect(this.screen).toBe("news");
  }

  /** One thing a player could do now. */
  async step(): Promise<string> {
    this.steps++;
    const noteCount = notes.length;
    const f = this.flash;
    const r = this.rand;
    let what = "";
    if (this.overlay) {
      what = await this.answerOverlay();
    } else if (this.screen === "news") {
      const choices = [
        Request.crime,
        Request.front,
        Request.yesterday,
        Request.news,
        Request.main,
        Request.main,
        Request.main,
        Request.announcement,
      ];
      const c = this.pick(choices);
      what = `news ${c}`;
      await f.command(c, c === Request.announcement ? { note: `Notice ${this.steps}` } : {});
    } else if (this.screen === "i_map") {
      const places = Object.values(PLACE_COMMANDS);
      const c = this.pick(places);
      what = `map ${c}`;
      await f.command(c, c === Request.script ? { extraText: "church.c" } : {});
    } else if (this.screen === "i_chat") {
      if (r() < 0.25) {
        what = "leave cafe";
        await f.command(Request.map);
      } else {
        what = "chat";
        await f.command(Request.chatUpdate, { input: r() < 0.5 ? `hello ${this.steps}` : "" });
      }
    } else if (this.screen === "rankings") {
      what = "rankings continue";
      await f.command(f.num("i_rank_command"));
    } else if (this.screen === "m_main" && f.num("b_kill_buttons") === 0) {
      const menu = [
        Request.waitForCustomer,
        Request.waitForCustomer,
        Request.waitForCustomer,
        Request.map,
        Request.news,
        Request.stats,
        Request.ranking,
        Request.getName,
      ];
      const c = this.pick(menu);
      what = `menu ${c}`;
      // The pen opens the name prompt inside the client; its first request is the search.
      if (c === Request.getName)
        await f.command(c, { input: this.pick(["morti", "digby", "walker", "q"]), hisId: 0 });
      else await f.command(c);
    } else {
      const keys = this.visibleKeys();
      expect(keys.length, `buttons on ${this.screen}`).toBeGreaterThan(0);
      const key = this.pick(keys);
      what = `button ${key} "${f.get(`st_option_${key}`).trim()}"`;
      await f.click(key);
    }
    if (f.num("i_sent") === Sent.callback) {
      // The mail pad is done; it asks for the desk itself (welcome.swf sprite 456, callback).
      this.update();
      await f.command(Request.main);
      what += " + desk";
    }
    for (const line of notes.slice(noteCount)) {
      const view = Object.values(host.town().sessions).map(
        (x) =>
          `${x.scene}:${x.view?.scene}:${x.view?.buttons.map((b) => b.id).join("/")}:${x.view?.overlay?.id ?? ""}`,
      );
      const last = this.flash.log
        .slice(-4)
        .map(
          (e) =>
            `${e.request.replace(/&key=[^&]*/, "").slice(0, 90)} => ${e.reply.raw.slice(-160)}`,
        );
      this.problems.push(
        `${what} [on ${this.screen}] ${line} ${view.join(" ")}\n  recent: ${this.recent.slice(-6).join(" | ")}\n  ${last.join("\n  ")}`,
      );
    }
    this.update();
    for (const session of Object.values(host.town().sessions)) this.modules.add(session.scene);
    this.pressed.add(what.replace(/\d+/g, "#"));
    this.recent.push(what);
    return what;
  }

  private async answerOverlay(): Promise<string> {
    const f = this.flash;
    const r = this.rand;
    const returnCommand = f.num("i_return_command") || RETURN_COMMAND;
    const sub = f.num("i_return_command_sub") || 0;
    switch (this.overlay) {
      case "getname": {
        const names = ["morti", "digby", "graves", "walker", "zzz", "a"];
        if (r() < 0.2) {
          await f.command(returnCommand, { sub, hisId: -1 });
          return "getname abort";
        }
        await f.command(Request.getName, { input: this.pick(names), hisId: 0 });
        return "getname search";
      }
      case "namenext": {
        const id = f.num("i_his_id");
        if (r() < 0.5) {
          // Yes: the mail pad opens in the client (a desk screen) and Send follows; elsewhere the return command is sent.
          if (f.get("st_message") !== "" && this.screen === "m_main") {
            await f.command(Request.sendMail, { input: "A letter.", hisId: id });
            return "mail send";
          }
          await f.command(returnCommand, { sub, hisId: id });
          return "namenext yes";
        }
        await f.command(Request.getName, { input: "a", hisId: id + 1 });
        return "namenext no";
      }
      case "noname":
        await f.command(returnCommand, { sub, hisId: -1 });
        return "noname ok";
      case "get_text": {
        const text = r() < 0.3 ? ABORT_TEXT : String(Math.floor(r() * 5));
        await f.command(returnCommand, { sub, extraText: text });
        return `get_text ${text}`;
      }
      case "pad": {
        if (r() < 0.5) {
          await f.command(Request.sendMail, { input: "Re: your letter", hisId: f.num("i_his_id") });
          return "pad send";
        }
        // Cancel closes the pad; the client then shows the capsule menu again.
        this.overlay = null;
        f.root.set("b_kill_buttons", "0");
        return "pad cancel";
      }
      default: {
        // A pop-up the client closes by itself; nothing is sent.
        this.overlay = null;
        return "close popup";
      }
    }
  }
}

const coverage: string[] = [];

const STEPS = Number(process.env.FQ_WALK_STEPS ?? 400);
const SEEDS = Number(process.env.FQ_WALK_SEEDS ?? 6);

describe("random walk over the client's controls", () => {
  for (const seed of Array.from({ length: SEEDS }, (_, i) => i + 1)) {
    it(`seed ${seed}: ${STEPS} steps without a fatal error or an unmapped request`, async () => {
      const walker = new Walker(rng(seed), app);
      const trail: string[] = [];
      onTestFailed(() => {
        process.stderr.write(
          `\nlast steps (${walker.screen}, overlay ${walker.overlay}):\n${trail.slice(-8).join("\n")}\n`,
        );
        for (const e of walker.flash.log.slice(-3)) {
          process.stderr.write(
            `> ${e.request.slice(0, 160)}\n< ${plain(e.reply.raw).slice(0, 500)}\n`,
          );
        }
        process.stderr.write(`bridge notes: ${notes.slice(-6).join(" | ")}\n`);
      });
      await walker.start();
      for (let i = 0; i < STEPS; i++) {
        trail.push(await walker.step());
        // Midnight now and then, so the morning screens, mail and new-day text are walked too.
        if (i % 120 === 119) host.newDay();
      }
      expect(walker.problems).toEqual([]);
      // The walk has to have actually gone places.
      expect(walker.seen.size).toBeGreaterThanOrEqual(4);
      coverage.push(...walker.modules);
      if (process.env.FQ_WALK_REPORT) {
        process.stderr.write(
          `seed ${seed}: modules ${[...walker.modules].sort().join(",")} objects ${[...walker.seen].join(",")} i_sent ${[...walker.sentCodes].join(",")}\n`,
        );
      }
    });
  }
});
