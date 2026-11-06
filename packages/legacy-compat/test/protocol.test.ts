import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFailed } from "vitest";
import { BUTTON_COMMANDS, PLACE_COMMANDS, Request, Sent } from "../src/commands.js";
import { createDevHost, type DevHost } from "../src/devHost.js";
import { legacyCompat } from "../src/plugin.js";
import { FlashClient, plain } from "./support/flashClient.js";

/**
 * Drives the plugin over HTTP the way welcome.swf does, in the order of the
 * decompiled script (docs/reference/welcome-actionscript.md), and checks that
 * every response carries what the movie reads at that point: `i_sent`,
 * `st_object` and the variables its text fields and buttons are bound to.
 */

let app: FastifyInstance;
let host: DevHost;
let flash: FlashClient;

beforeAll(async () => {
  host = await createDevHost({ seed: 4242, rivals: 2 });
  app = Fastify();
  await app.register(legacyCompat, { host, enabled: true });
  await app.ready();
  flash = new FlashClient(app);
});

afterAll(async () => {
  await app.close();
});

// When a step fails, show the last requests and replies of the conversation.
beforeEach(() => {
  const from = flash.log.length;
  onTestFailed(() => {
    for (const entry of flash.log.slice(from).slice(-4)) {
      process.stderr.write(
        `\n> ${entry.request.replace(/&key=[\d.e-]+/, "")}\n< ${entry.reply.raw.slice(0, 700)}\n`,
      );
    }
  });
});

/** A response that creates a screen object (`i_sent` 10) named `object`. */
function expectObject(object: string) {
  expect(flash.num("i_sent")).toBe(Sent.object);
  expect(flash.get("st_object")).toBe(object);
}

function expectVars(...names: string[]) {
  for (const name of names) expect(flash.root.has(name), `variable ${name}`).toBe(true);
}

describe("log on screen (sprite 114)", () => {
  it("checklogon: sends the intro text, game line and i_sent 1, with real HTTP headers", async () => {
    const r = await flash.checkLogon();
    expect(r.status).toBe(200);
    expect(String(r.headers["content-type"])).toContain("application/x-www-form-urlencoded");
    expect(String(r.headers["cache-control"])).toContain("no-store");
    expect(String(r.headers["set-cookie"])).toMatch(
      /^fq_legacy=[0-9a-f]{32}; Path=\/; HttpOnly; SameSite=Lax/,
    );
    // No stray trailer after the last variable (the original sent a literal "/r/n").
    expect(r.raw.endsWith("&")).toBe(true);
    expect(r.raw).not.toContain("/r/n");
    expect(flash.num("i_sent")).toBe(1);
    expectVars("st_intro_news", "st_server_news", "st_game_stats", "st_no_more");
    expect(plain(flash.get("st_game_stats"))).toContain("players on now");
    expect(flash.get("st_no_more")).toBe("");
  });

  it("logon with a name nobody has: i_sent 2 (sprite 114 frame 33 shows 'bad name or password')", async () => {
    await flash.logon("nobody", "nothing");
    expect(flash.num("i_sent")).toBe(2);
  });

  it("a command before logging on is a fatal error with g_st_error (i_sent -1)", async () => {
    await flash.command(Request.main);
    expect(flash.num("i_sent")).toBe(-1);
    expect(flash.get("g_st_error")).toContain("not logged on");
  });
});

describe("new user (sprite 113)", () => {
  it("sends the name errors back to page one (i_sent 4) with g_st_error", async () => {
    await flash.newUser({
      logon: "tester",
      password: "pw",
      name: "Xy",
      parlor: "Parlor X",
      email: "a@b.cc",
    });
    expect(flash.num("i_sent")).toBe(4);
    expect(plain(flash.get("g_st_error"))).toContain("too short");
  });

  it("sends the other errors back to page two (i_sent 3)", async () => {
    await flash.newUser({
      logon: "te",
      password: "pw",
      name: "Tess Tester",
      parlor: "Parlor X",
      email: "a@b.cc",
    });
    expect(flash.num("i_sent")).toBe(3);
    expect(plain(flash.get("g_st_error"))).toContain("logon name is too short");
    await flash.newUser({
      logon: "tester",
      password: "pw",
      passwordVerify: "other",
      name: "Tess Tester",
      parlor: "Parlor X",
      email: "a@b.cc",
    });
    expect(flash.num("i_sent")).toBe(3);
    expect(plain(flash.get("g_st_error"))).toContain("passwords don't match");
  });

  it("creates the account and shows the paper (i_sent 5)", async () => {
    await flash.newUser({
      logon: "tester",
      password: "pw",
      name: "Tess Tester",
      parlor: "Tess and Sons",
      email: "tess@example.com",
    });
    expect(flash.num("i_sent")).toBe(Sent.news);
    expectVars("st_news", "st_date", "st_top_today", "st_top_yesterday", "i_yesterday");
    expect(flash.get("st_date")).toBe("Day 1");
    expect(flash.num("i_yesterday")).toBe(0);
    // A rival parlor's "&" arrives intact: as an entity, since the field is HTML, and escaped on the wire.
    expect(flash.get("st_news")).toContain("Vance &amp; Daughters");
    expect(plain(flash.get("st_news"))).toContain("Vance & Daughters");
  });
});

describe("the newspaper (sprite 255)", () => {
  it("shows the crime page (41/42), yesterday (7), today (5)", async () => {
    await flash.command(Request.crime);
    expect(flash.num("i_sent")).toBe(Sent.news);
    expect(plain(flash.get("st_news"))).toContain("no crime");
    await flash.command(Request.front);
    expect(flash.num("i_sent")).toBe(Sent.news);
    expect(flash.get("st_news")).not.toBe("");
    await flash.command(Request.yesterday);
    expect(flash.num("i_sent")).toBe(Sent.news);
    expect(flash.num("i_yesterday")).toBe(1);
    expect(flash.get("st_date")).toBe("Day 0");
    await flash.command(Request.news);
    expect(flash.num("i_yesterday")).toBe(0);
    expect(flash.get("st_date")).toBe("Day 1");
  });

  it("an announcement (8) goes in the paper; the notepad is the client's", async () => {
    await flash.command(Request.announcement, { note: "Sale on caskets!" });
    expect(flash.num("i_sent")).toBe(Sent.news);
    expect(plain(flash.get("st_news"))).toContain("Sale on caskets");
    expect(plain(flash.get("st_news"))).toContain("Tess Tester of Tess and Sons");
  });
});

describe("the desk (sprite 450)", () => {
  it("Continue (4) from the paper is the morning screen: m_main, Continue button, buttons killed", async () => {
    await flash.command(Request.main);
    expectObject("m_main");
    expect(flash.get("st_url")).toBe("flash/morning_coffee.swf");
    expect(flash.num("i_turns")).toBe(15);
    expect(flash.num("i_luck")).toBe(50);
    expectVars("i_sp", "i_exp", "i_coffin_wood", "i_coffin_silver", "i_coffin_gold");
    expect(flash.num("b_kill_buttons")).toBe(1);
    expect(flash.buttons()).toEqual(["Continue"]);
    expect(flash.num("i_command_3")).toBe(Request.main);
    expect(plain(flash.get("st_main"))).toContain("Welcome to Funeral Quest, Tess Tester");
  });

  it("Continue (4) again is the desk: the capsule menu, no plaque buttons, kill 0", async () => {
    await flash.click("3");
    expectObject("m_main");
    expect(flash.get("st_url")).toBe("flash/places/desk.swf");
    expect(flash.num("b_kill_buttons")).toBe(0);
    expect(flash.buttons()).toEqual([]);
    expect(flash.num("b_show_stats")).toBe(0);
    expect(plain(flash.get("st_main"))).toContain("moved into town");
  });
});

describe("a day at the desk", () => {
  const pressed = new Set<string>();
  let sales = 0;

  /** Waits for a customer (2) until one wants to talk; returns once the five buttons are showing. */
  async function nextCustomer() {
    for (let i = 0; i < 20; i++) {
      await flash.command(Request.waitForCustomer);
      if (flash.get("st_option_a") !== "") return;
      // A free event, a risk or "no turns": carry on from whatever buttons it shows.
      if (flash.buttons().length === 1) await flash.click("3");
      else if (flash.buttons().length > 1) await flash.click("3");
    }
    throw new Error("No customer came");
  }

  it("Wait for customers (2): the customer screen has class, mood, the stats panel and five buttons", async () => {
    await nextCustomer();
    expect([2, 10]).toContain(flash.num("i_sent"));
    expectVars("st_main", "st_url", "st_class", "st_mood");
    expect(flash.num("b_show_stats")).toBe(1);
    expect(flash.num("b_kill_buttons")).toBe(1);
    expect(flash.buttons().map((b) => b.trim())).toEqual([
      "Guilt",
      "Sympathy",
      "Hard Sell",
      "Soft Sell",
      "Done",
    ]);
    // The five buttons carry the numbers the original used.
    expect([
      flash.num("i_command_a"),
      flash.num("i_command_0"),
      flash.num("i_command_1"),
      flash.num("i_command_2"),
      flash.num("i_command_3"),
    ]).toEqual([
      Request.guilt,
      Request.sympathy,
      Request.hardSell,
      Request.softSell,
      Request.finishSale,
    ]);
    expect(flash.get("st_url_bg")).toMatch(/^flash\/background\/background_\d\.swf$/);
    expect(flash.get("st_url")).toMatch(/^flash\/people\/.*\.swf$/);
    expect(plain(flash.get("st_main"))).toContain("Total: $");
    expect(flash.num("i_turns")).toBe(14);
  });

  it("each of the five buttons works, and Done closes a sale with the money bag and Continue", async () => {
    const order: ("a" | "0" | "1" | "2")[] = ["a", "0", "1", "2"];
    const names = {
      a: "Guilt",
      "0": "Sympathy",
      "1": "Hard Sell",
      "2": "Soft Sell",
      "3": "Done",
    } as const;
    for (let customers = 0; customers < 12 && sales === 0; customers++) {
      if (flash.get("st_option_a") === "") await nextCustomer();
      for (const key of order) {
        if (flash.get("st_option_a") === "") break; // the customer walked out
        await flash.click(key);
        expect([Sent.loadMovie, Sent.object]).toContain(flash.num("i_sent"));
        expect(flash.get("st_main")).not.toBe("");
        pressed.add(names[key]);
      }
      if (flash.get("st_option_a") !== "") {
        await flash.click("3");
        pressed.add("Done");
        expect([Sent.loadMovie, Sent.object]).toContain(flash.num("i_sent"));
        if (plain(flash.get("st_main")).includes("The service is a success")) {
          sales++;
          expect(flash.get("st_url")).toMatch(/money_bag/);
          expect(flash.num("b_show_stats")).toBe(0);
          expect(flash.buttons()).toEqual(["Continue"]);
          expect(flash.num("i_sp")).toBeGreaterThan(0);
        }
      }
      // A walk-out or a finished sale leaves Continue; click it to get to the desk again.
      if (flash.buttons().length === 1) {
        await flash.click("3");
        expect(flash.num("b_kill_buttons")).toBe(0);
      }
    }
    expect(sales).toBeGreaterThan(0);
    expect([...pressed].sort()).toEqual(["Done", "Guilt", "Hard Sell", "Soft Sell", "Sympathy"]);
  });
});

describe("the map and the places (sprites 337 and 374)", () => {
  it("Map (12) creates i_map", async () => {
    await flash.command(Request.map);
    expectObject("i_map");
  });

  it("the bank (39) is an i_generic screen with note, tags, picture and buttons", async () => {
    await flash.command(Request.bank);
    expectObject("i_generic");
    expectVars("st_main", "st_generic_info", "st_generic_status", "st_url_bg", "i_coffin_wood");
    expect(flash.num("b_show_tags")).toBe(1);
    expect(plain(flash.get("st_main"))).toContain("Teller");
    expect(plain(flash.get("st_generic_info"))).toContain("city bank");
    expect(flash.get("st_url_bg")).toBe("flash/places/bank.swf");
    expect(flash.buttons().map((b) => b.trim())).toEqual([
      "All to wood",
      "All to gold",
      "Exchange",
      "Leave",
    ]);
  });

  it("a button on a place refreshes it (i_sent 33), and a text prompt (i_get_text) comes back with i_return_command", async () => {
    await flash.click(flash.keyOf("Exchange") === "2" ? "2" : flash.keyOf("Exchange"));
    expect(flash.num("i_sent")).toBe(Sent.generic);
    expect(flash.buttons().map((b) => b.trim())).toContain("Wood");
    const silver = flash.get("i_coffin_silver");
    expect(silver).not.toBe("");
  });

  it("Leave goes back to the map (12), then the store (40)", async () => {
    // Back out of the exchange menu first.
    await flash.click(flash.keyOf("Back"));
    await flash.click(flash.keyOf("Leave"));
    expectObject("i_map");
    await flash.command(Request.store);
    expectObject("i_generic");
    expect(plain(flash.get("st_main"))).toContain("Elijah");
    expect(flash.get("st_url_bg")).toBe("flash/places/store.swf");
    expect(flash.buttons().map((b) => b.trim())).toEqual([
      "Security",
      "Supplies",
      "Hearses",
      "Leave",
    ]);
    await flash.click(flash.keyOf("Hearses"));
    expect(flash.num("i_sent")).toBe(Sent.generic);
    expect(plain(flash.get("st_main"))).toContain("Budget Hearse");
    await flash.click(flash.keyOf("Back"));
    await flash.click(flash.keyOf("Leave"));
    expectObject("i_map");
  });

  it("every building of the map reaches a screen (church is c_request_script with church.c)", async () => {
    for (const [place, command] of Object.entries(PLACE_COMMANDS)) {
      if (place === "funeral-home" || place === "cafe") continue;
      await flash.command(Request.map);
      expectObject("i_map");
      await flash.command(command, command === Request.script ? { extraText: "church.c" } : {});
      expectObject("i_generic");
      expect(flash.get("st_main"), place).not.toBe("");
    }
    await flash.command(Request.map);
  });
});

describe("the name search and text prompts (sprites 492, 498, 508)", () => {
  it("Yang's delivery: i_getname, then Do you mean (i_namenext), then the fortune prompt (i_get_text)", async () => {
    await flash.command(Request.yangs);
    expectObject("i_generic");
    // Order #2 (Lucky Sparrow, for delivery) asks who the lucky person is.
    await flash.click(flash.keyOf("Order #2"));
    expect(flash.num("i_sent")).toBe(Sent.objectAdd);
    expect(flash.get("st_object")).toBe("i_getname");
    expect(plain(flash.get("st_message"))).toContain("lucky person");
    const returnCommand = flash.num("i_return_command");
    expect(returnCommand).toBeGreaterThan(0);
    // Enter: command 17 with the typed name and i_his_id 0.
    await flash.command(Request.getName, { input: "morti", hisId: 0 });
    expect(flash.num("i_sent")).toBe(Sent.objectAdd);
    expect(flash.get("st_object")).toBe("i_namenext");
    expect(plain(flash.get("st_message"))).toBe("Morticia Vance");
    const found = flash.num("i_his_id");
    expect(found).toBeGreaterThanOrEqual(0);
    // No: i_his_id + 1, the same text. Nobody else matches.
    await flash.command(Request.getName, { input: "morti", hisId: found + 1 });
    expect(flash.get("st_object")).toBe("i_namenext");
    expect(flash.num("i_his_id")).toBe(-1);
    // OK on "nobody by that name" sends i_return_command with i_his_id -1: back to the menu.
    await flash.command(returnCommand, { hisId: -1, input: "morti" });
    expect(flash.num("i_sent")).toBe(Sent.generic);
    await flash.command(Request.map);
  });

  it("the bank's count prompt: i_get_text, answered through i_return_command in st_extra_text", async () => {
    await flash.command(Request.bank);
    await flash.click(flash.keyOf("Exchange"));
    // Whichever tag the player has most of, convert some of it.
    const tiers = ["Wood", "Silver", "Gold"];
    const have = [
      flash.num("i_coffin_wood"),
      flash.num("i_coffin_silver"),
      flash.num("i_coffin_gold"),
    ];
    const from = have.findIndex((n) => n > 0);
    expect(from).toBeGreaterThanOrEqual(0);
    await flash.click(flash.keyOf(tiers[from] ?? "Wood"));
    const to = tiers
      .filter((t) => t !== tiers[from])
      .find((t) =>
        flash
          .buttons()
          .map((b) => b.trim())
          .includes(t),
      );
    await flash.click(flash.keyOf(to ?? "Wood"));
    expect(flash.num("i_sent")).toBe(Sent.objectAdd);
    expect(flash.get("st_object")).toBe("i_get_text");
    expectVars("st_message", "i_return_command", "i_return_command_sub");
    // The Abort button sends 12ABORT12 and the menu comes back.
    await flash.command(flash.num("i_return_command"), {
      sub: flash.num("i_return_command_sub"),
      extraText: "12ABORT12",
    });
    expect(flash.num("i_sent")).toBe(Sent.generic);
    await flash.click(flash.keyOf("Back"));
    await flash.click(flash.keyOf("Leave"));
    expectObject("i_map");
  });
});

describe("the cafe (sprite 469)", () => {
  it("chat start (23) creates i_chat; chat update (24) sends lines out and brings st_message back", async () => {
    await flash.command(Request.chatStart);
    expectObject("i_chat");
    expectVars("st_message", "i_chat_speed");
    expect(plain(flash.get("st_message"))).toContain("Pale Horse");
    expect(plain(flash.get("st_message"))).toContain("saunters in");
    await flash.command(Request.chatUpdate, { input: "hello Deathville" });
    expect(flash.num("i_sent")).toBe(Request.chatUpdate);
    expect(plain(flash.get("st_message"))).toContain("Tess Tester: hello Deathville");
    // An empty poll returns nothing new.
    await flash.command(Request.chatUpdate, { input: "" });
    expect(flash.num("i_sent")).toBe(Request.chatUpdate);
    expect(flash.get("st_message")).toBe("");
    // Exit sends the map command.
    await flash.command(Request.map);
    expectObject("i_map");
  });
});

describe("mail (sprites 456, 498, 508)", () => {
  it("write a letter: name search (17), then send (20) with st_input and i_his_id", async () => {
    await flash.command(Request.main);
    await flash.command(Request.getName, { input: "digby", hisId: 0 });
    expect(flash.get("st_object")).toBe("i_namenext");
    expect(plain(flash.get("st_message"))).toBe("Digby Cross");
    const target = flash.num("i_his_id");
    // "Yes" opens the pad locally; Send is command 20.
    await flash.command(Request.sendMail, { input: "Dear Digby, a test letter.", hisId: target });
    expect(flash.num("i_sent")).toBe(Sent.callback);
    // The pad then asks for the desk (4).
    await flash.command(Request.main);
    expectObject("m_main");
    expect(flash.num("b_kill_buttons")).toBe(0);
  });
});

describe("stats, rankings and quitting", () => {
  it("Inventory (3) is the status screen: i_sent 3, st_temp and the stat variables", async () => {
    await flash.command(Request.stats);
    expect(flash.num("i_sent")).toBe(Sent.stats);
    expectVars(
      "st_temp",
      "i_exp",
      "i_turns",
      "i_lockpick",
      "i_coffin_wood",
      "i_coffin_silver",
      "i_coffin_gold",
      "st_ride",
      "i_plots",
      "i_psych",
      "i_hit_max",
      "i_strength",
      "i_visits",
      "i_yangs",
      "i_sp",
      "st_rating",
    );
    expect(flash.get("i_psych")).toBe("Level 1");
    expect(flash.get("st_ride")).toBe("Bicycle");
    expect(flash.get("st_rating")).toMatch(/^#\d+ - /);
    expect(flash.buttons().map((b) => b.trim())).toEqual(["Name", "Back"]);
  });

  it("Back (4) returns to the desk", async () => {
    await flash.click(flash.keyOf("Back"));
    expectObject("m_main");
  });

  it("Rankings (9): i_sent 9, st_date, st_news lines and i_rank_command; Continue sends i_rank_command", async () => {
    await flash.command(Request.ranking);
    expect(flash.num("i_sent")).toBe(Sent.ranking);
    expectVars("st_date", "st_news", "i_rank_command");
    const lines = plain(flash.get("st_news")).split("\n");
    expect(lines.some((l) => l.startsWith("Tess Tester"))).toBe(true);
    expect(lines.some((l) => l.startsWith("Morticia Vance"))).toBe(true);
    // The list is padded to a multiple of 19 lines, as add_rankings does (rankings.cpp:107-111).
    expect((lines.length - 1) % 19).toBe(0);
    await flash.command(flash.num("i_rank_command"));
    expectObject("m_main");
  });

  it("Exit (1): i_sent 1, the engine logs the player off, and the same name can log on again", async () => {
    await flash.command(Request.quit);
    expect(flash.num("i_sent")).toBe(Sent.quit);
    const town = host.town();
    const me = town.players.find((p) => p.name === "Tess Tester");
    expect(me).toBeDefined();
    expect(town.sessions[String(me?.id)]).toBeUndefined();
    await flash.checkLogon();
    await flash.logon("tester", "pw");
    expect(flash.num("i_sent")).toBe(Sent.news);
    expect(flash.get("st_date")).toBe("Day 1");
    // A wrong password is refused.
    await flash.checkLogon();
    await flash.logon("tester", "wrong");
    expect(flash.num("i_sent")).toBe(2);
  });
});

describe("a new day", () => {
  it("the next day's log on gets the morning screen and fresh turns", async () => {
    host.newDay();
    await flash.checkLogon();
    await flash.logon("tester", "pw");
    expect(flash.num("i_sent")).toBe(Sent.news);
    expect(flash.get("st_date")).toBe("Day 2");
    await flash.command(Request.main);
    expectObject("m_main");
    expect(flash.num("i_turns")).toBe(15);
    expect(flash.buttons()).toEqual(["Continue"]);
  });
});

describe("the command numbers", () => {
  it("only use numbers the client script cannot mistake for something else", () => {
    // 21 opens the mail pad in the client and 110 ends i_getname; no engine button may take them.
    const taken = new Set(Object.values(BUTTON_COMMANDS));
    expect(taken.has(Request.reply)).toBe(false);
    expect(taken.has(110)).toBe(false);
  });
});
