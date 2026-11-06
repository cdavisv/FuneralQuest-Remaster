/**
 * What the original client sees through the bridge, for the differences the
 * differential oracle found (tools/oracle, docs/classic-fidelity.md D2, D6-D9
 * and the log-on lock). Each case drives `LegacyBridge` directly over a town in
 * memory.
 */
import {
  type ClassicRules,
  classicContext,
  createClassicRegistry,
  createTown,
  type EngineContext,
  originalClassicRules,
  type TownState,
} from "@fq/core";
import { beforeEach, describe, expect, it } from "vitest";
import { LegacyAssets } from "../src/assets.js";
import { LegacyBridge } from "../src/bridge.js";
import { loadLegacyContent } from "../src/content.js";
import type { LegacyHost } from "../src/host.js";
import { richTextToPlain } from "../src/richText.js";

const content = loadLegacyContent();
const NOW = Date.UTC(2001, 0, 1, 0, 5);

class Rig {
  town: TownState;
  readonly bridge: LegacyBridge;
  private readonly tokens = new Map<number, string>();
  private readonly passwords = new Map<string, number>();
  private readonly registry = createClassicRegistry();

  constructor(private readonly rules?: ClassicRules) {
    this.town = createTown({ seed: 7 }, this.context()).town;
    const host: LegacyHost = {
      context: () => this.context(),
      getTown: () => this.town,
      persist: (next) => {
        this.town = next;
      },
      accounts: {
        verify: (logon) => this.passwords.get(logon) ?? null,
        register: (id, logon) => {
          this.passwords.set(logon, id);
        },
      },
    };
    this.bridge = new LegacyBridge({ host, assets: new LegacyAssets({}), now: () => NOW });
  }

  context(): EngineContext {
    return {
      ...classicContext(content, {
        registry: this.registry,
        now: NOW,
        ...(this.rules ? { rules: this.rules } : {}),
      }),
      localTimeOffsetMinutes: 0,
    };
  }

  async send(p: number, query: string): Promise<Map<string, string>> {
    const reply = await this.bridge.handle(this.tokens.get(p), query);
    this.tokens.set(p, reply.token);
    return new Map(reply.vars.map(([k, v]) => [k, String(v)]));
  }

  newPlayer(p: number, name: string) {
    return this.send(
      p,
      `new&logon=player${p}&name=${name}&f_name=${name}+Rest&password=pw&password_v=pw&b_male=1&email=p${p}%40x.com`,
    );
  }

  cmd(p: number, command: number, extra = "") {
    return this.send(p, `command&i_command=${command}${extra}`);
  }

  /** Clicks the plaque button labelled `label` in `vars`. */
  async press(p: number, vars: Map<string, string>, label: string) {
    for (const key of ["3", "2", "1", "0", "a"]) {
      if (vars.get(`st_option_${key}`)?.trim() === label) {
        const sub = vars.get(`i_command_sub_${key}`);
        return this.cmd(
          p,
          Number(vars.get(`i_command_${key}`)),
          sub ? `&i_command_sub=${sub}` : "",
        );
      }
    }
    throw new Error(`no button ${label}`);
  }

  /** From the paper after log-on to the desk proper (morning coffee, Continue). */
  async toDesk(p: number) {
    const coffee = await this.cmd(p, 4);
    return this.press(p, coffee, "Continue");
  }
}

const text = (html: string | undefined) =>
  (html ?? "")
    .replace(/<br>/g, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&");

describe("the paper's own controls show the current page (D7)", () => {
  it("front page again after another player's announcement", async () => {
    const rig = new Rig();
    await rig.newPlayer(0, "Alice");
    await rig.newPlayer(1, "Bob");
    await rig.cmd(1, 8, "&st_note=Grand+opening+today");
    // Alice is still on the paper she got at log-on; the client's Front button sends 41.
    const front = await rig.cmd(0, 41);
    expect(text(front.get("st_news"))).toContain("Grand opening today");
    // Yesterday (7) is always the front page of yesterday (commands_news.cpp:163-170).
    await rig.cmd(0, 42);
    const yesterday = await rig.cmd(0, 7);
    expect(yesterday.get("st_date")).toBe(`Day ${rig.town.day - 1}`);
    expect(text(yesterday.get("st_news"))).not.toContain("There has been no crime reported today.");
  });
});

describe("letters are drawn as the original's desk text (D9)", () => {
  it("no Reply question, quotes with a plain >, Reply and Continue", async () => {
    const rig = new Rig();
    await rig.newPlayer(0, "Alice");
    await rig.newPlayer(1, "Bob");
    await rig.toDesk(1);
    await rig.cmd(1, 17, "&st_input=Ali&i_his_id=0");
    await rig.cmd(1, 20, "&st_input=%3Eold%0D%0Dnew&i_his_id=0");
    const desk = await rig.toDesk(0);
    const shown = desk.get("st_main") ?? "";
    expect(text(shown)).toContain("You have received a letter from Bob:");
    expect(shown).toContain(">old");
    expect(shown).not.toContain("&gt;");
    expect(text(shown)).not.toContain("Reply to this letter?");
    expect(desk.get("st_option_2")?.trim()).toBe("Reply");
  });
});

describe("Yang's name search reads the players as they are now (D6)", () => {
  it("a rename after the box opened is found under the new name only", async () => {
    const rig = new Rig();
    await rig.newPlayer(0, "Alice");
    await rig.newPlayer(1, "Bob");
    await rig.toDesk(0);
    await rig.cmd(0, 12);
    const yangs = await rig.cmd(0, 13);
    await rig.press(0, yangs, "Order #3");
    // Bob becomes Zed while Alice's box is open.
    const t = rig.town;
    rig.town = { ...t, players: t.players.map((p) => (p.id === 1 ? { ...p, name: "Zed" } : p)) };
    const old = await rig.cmd(0, 17, "&st_input=Bob&i_his_id=0");
    expect(old.get("i_his_id")).toBe("-1");
    const now = await rig.cmd(0, 17, "&st_input=Zed&i_his_id=0");
    expect(now.get("st_message")).toBe("Zed");
  });
});

describe("the cafe reads one queue in order (D8)", () => {
  let rig: Rig;
  beforeEach(async () => {
    rig = new Rig();
    await rig.newPlayer(0, "Alice");
  });
  it("arrival on the first poll, after the notices waiting, before what the poll said", async () => {
    await rig.toDesk(0);
    await rig.cmd(0, 12);
    await rig.newPlayer(1, "Bob"); // queues "12:05 AM:Bob has just moved into town!" for Alice
    const enter = await rig.cmd(0, 23);
    expect(text(enter.get("st_message"))).not.toContain("saunters in");
    const poll = text((await rig.cmd(0, 24, "&st_input=hello")).get("st_message"));
    const notice = poll.indexOf("12:05 AM:Bob has just moved into town!");
    const arrival = poll.indexOf("Alice saunters in.");
    const said = poll.indexOf("Alice: hello");
    expect(notice).toBeGreaterThanOrEqual(0);
    expect(arrival).toBeGreaterThan(notice);
    expect(said).toBeGreaterThan(arrival);
  });
});

describe("the empty Continue at the start of a gift mail (D2)", () => {
  it("original rules: the desk with only Continue, as commands_main.cpp:89-108 drew it", async () => {
    const rig = new Rig(originalClassicRules());
    await rig.newPlayer(0, "Alice");
    await rig.toDesk(0);
    const me = rig.town.players[0];
    if (!me) throw new Error("no player");
    const base = { importance: "high" as const, from: -1, expireDay: null };
    me.mail = [
      { type: "buttons", buttons: [{ id: "go:desk", label: "Continue" }], ...base },
      { type: "text", text: "The zoo calls.", ...base },
      { type: "buttons", buttons: [{ id: "go:desk", label: "Continue" }], ...base },
    ];
    await rig.cmd(0, 12);
    const desk = await rig.cmd(0, 4);
    expect(text(desk.get("st_main"))).toBe("You are sitting at your desk.\n");
    expect(desk.get("st_option_3")?.trim()).toBe("Continue");
    expect(desk.get("b_kill_buttons")).toBe("1");
    const next = await rig.press(0, desk, "Continue");
    expect(text(next.get("st_main"))).toContain("The zoo calls.");
  });
});

describe("log-on while someone is inside the parlor", () => {
  it("is the original's error box (funeral.cpp:357-363)", async () => {
    const rig = new Rig();
    await rig.newPlayer(0, "Alice");
    await rig.newPlayer(1, "Bob");
    await rig.cmd(1, 1); // Bob quits
    const s = rig.town.sessions["0"];
    if (!s) throw new Error("no session");
    s.hisId = 1;
    s.locked = true;
    const refused = await rig.send(1, "logon&st_logon=player1&st_password=pw");
    expect(refused.get("i_sent")).toBe("-1");
    expect(richTextToPlain([{ text: refused.get("g_st_error") ?? "" }])).toContain(
      "Someone is currently poking around your parlor",
    );
  });
});
