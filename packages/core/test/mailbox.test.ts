import { describe, expect, it } from "vitest";
import {
  type EngineContext,
  enterGame,
  originalClassicRules,
  richTextToPlain,
  type StepResult,
  type TownState,
} from "../src/index.js";
import { context } from "./support/harness.js";
import { act, chatFor, edit, ids, press, socialTown, submit } from "./support/social.js";

const plain = richTextToPlain;

/** `from` (at the desk) writes `text` to the first player matching `name`. */
function write(town: TownState, from: number, name: string, text: string, ctx: EngineContext) {
  const pen = press(town, from, "go:mailbox", ctx);
  const asked = act(pen.town, from, submit("mailbox:getname", name), ctx);
  const yes = act(
    asked.town,
    from,
    { type: "confirm", overlayId: "mailbox:namenext", accepted: true },
    ctx,
  );
  expect(yes.view.overlay?.kind).toBe("textInput");
  return act(yes.town, from, submit("mailbox:compose", text), ctx);
}

/** Logs `id` on and walks to the desk, where the mail is read. */
function readMail(town: TownState, id: number, ctx: EngineContext): StepResult {
  const on = enterGame(town, id, ctx);
  const coffee = press(on.town, id, "go:desk", ctx);
  return press(coffee.town, id, "go:desk", ctx);
}

describe("letters (commands_getname.cpp, commands_send_mail.cpp, broadcast.cpp:254-303)", () => {
  it("the pen asks who; No searches on, Yes opens the notepad; the letter waits with Reply (Flash i_getname / i_namenext / i_mail)", () => {
    const { town, ctx } = socialTown(1, 4);
    expect(ids(town.sessions["0"]?.view ?? ({ buttons: [] } as never))).toContain("go:mailbox");
    const pen = press(town, 0, "go:mailbox", ctx);
    expect(pen.view.overlay?.kind === "textInput" && pen.view.overlay.prompt).toContain(
      "Who would you like to mail?",
    );
    const asked = act(pen.town, 0, submit("mailbox:getname", "r"), ctx);
    expect(asked.view.overlay?.kind === "confirm" && plain(asked.view.overlay.text)).toBe(
      "Do you mean Morticia?",
    );
    const next = act(
      asked.town,
      0,
      { type: "confirm", overlayId: "mailbox:namenext", accepted: false },
      ctx,
    );
    expect(next.view.overlay?.kind === "confirm" && plain(next.view.overlay.text)).toBe(
      "Do you mean Graves?",
    );
    const yes = act(
      next.town,
      0,
      { type: "confirm", overlayId: "mailbox:namenext", accepted: true },
      ctx,
    );
    const sent = act(yes.town, 0, submit("mailbox:compose", "Nice hearse.\r\nSee you."), ctx);
    expect(sent.view.scene).toBe("desk");
    const mail = sent.town.players[3]?.mail ?? [];
    expect(mail.map((m) => m.type)).toEqual(["text", "quote", "buttons"]);
    expect(mail[0]?.type === "text" && mail[0].text).toBe(
      "`$You have received a letter from `wSkelly`$:\n\nNice hearse.\nSee you.",
    );
    expect(mail[1]?.type === "quote" && mail[1].text).toBe(">Nice hearse.\n>See you.\n\n");
    expect(
      sent.effects.some((e) => e.kind === "log" && e.text.includes("wrote email to Graves")),
    ).toBe(true);
  });

  it("nobody by that name: the message box, then back to the desk", () => {
    const { town, ctx } = socialTown(1, 2);
    const pen = press(town, 0, "go:mailbox", ctx);
    const none = act(pen.town, 0, submit("mailbox:getname", "zzz"), ctx);
    expect(none.view.overlay?.kind === "message" && plain(none.view.overlay.text)).toBe(
      "Sorry, nobody by that name lives around here!",
    );
    const back = act(none.town, 0, { type: "dismiss", overlayId: "mailbox:noname" }, ctx);
    expect(back.view.scene).toBe("desk");
    expect(back.view.overlay).toBeUndefined();
    const cancelled = act(pen.town, 0, submit("mailbox:getname", null), ctx);
    expect(cancelled.view.overlay).toBeUndefined();
  });

  it("reading: one letter per overlay; Reply opens the notepad with the quote, and the reply arrives (Flash quote_message)", () => {
    const { town, ctx } = socialTown(2, 3);
    let t = write(town, 0, "Morticia", "First letter", ctx).town;
    t = write(t, 0, "Morticia", "Second letter", ctx).town;
    const desk = readMail(t, 1, ctx);
    expect(desk.view.overlay?.kind).toBe("confirm");
    expect(desk.view.overlay?.kind === "confirm" && plain(desk.view.overlay.text)).toContain(
      "First letter",
    );
    expect(desk.view.overlay?.kind === "confirm" && plain(desk.view.overlay.text)).not.toContain(
      "Second letter",
    );
    // Continue reads the next one.
    const second = act(
      desk.town,
      1,
      { type: "confirm", overlayId: "mailbox:reply", accepted: false },
      ctx,
    );
    expect(second.view.overlay?.kind === "confirm" && plain(second.view.overlay.text)).toContain(
      "Second letter",
    );
    const reply = act(
      second.town,
      1,
      { type: "confirm", overlayId: "mailbox:reply", accepted: true },
      ctx,
    );
    expect(reply.view.overlay?.kind === "textInput" && reply.view.overlay.initial).toBe(
      ">Second letter\n\n",
    );
    const sent = act(reply.town, 1, submit("mailbox:compose", ">Second letter\n\nThanks!"), ctx);
    const back = (sent.town.players[0]?.mail ?? []).filter((m) => m.type !== "simpleText");
    expect(back[0]?.type === "text" && back[0].text).toContain("letter from `wMorticia");
    // ReverseFindString looks for "\n>"; a quote at the very start has no "\n" before it, so
    // the whole letter is quoted again (broadcast.cpp:268-285), as in the original.
    expect(back[1]?.type === "quote" && back[1].text).toBe(">>Second letter\n>\n>Thanks!\n\n");
    const later = act(reply.town, 1, submit("mailbox:compose", "Hi\n>old\n\nnew"), ctx);
    const quote = later.town.players[0]?.mail.find((m) => m.type === "quote");
    expect(quote?.type === "quote" && quote.text).toBe(">new\n\n");
    const empty = act(
      second.town,
      1,
      { type: "confirm", overlayId: "mailbox:reply", accepted: false },
      ctx,
    );
    expect(empty.view.overlay).toBeUndefined();
    expect(ids(empty.view)).toContain("desk:wait");
  });

  it("game letters (Continue only) are message overlays; their rewards apply as they are read (broadcast.cpp:14-100)", () => {
    const { town, ctx } = socialTown(3, 2, { online: [0] });
    const t = structuredClone(town);
    const p = t.players[1];
    if (!p) throw new Error("no player");
    p.mail.push(
      { type: "text", text: "Prize one", importance: "high", from: -1, expireDay: null },
      { type: "varMod", stat: "bp", amount: 7, importance: "high", from: -1, expireDay: null },
      {
        type: "picture",
        layer: "fg",
        picture: "stuff/money_bag",
        importance: "high",
        from: -1,
        expireDay: null,
      },
      {
        type: "buttons",
        buttons: [{ id: "go:desk", label: "Continue" }],
        importance: "high",
        from: -1,
        expireDay: null,
      },
      { type: "text", text: "Prize two", importance: "high", from: -1, expireDay: null },
      { type: "varMod", stat: "bp", amount: 5, importance: "high", from: -1, expireDay: null },
      {
        type: "buttons",
        buttons: [{ id: "go:desk", label: "Continue" }],
        importance: "high",
        from: -1,
        expireDay: null,
      },
    );
    const bp = p.bp;
    const first = readMail(t, 1, ctx);
    expect(first.view.overlay?.kind).toBe("message");
    expect(first.view.overlay?.kind === "message" && plain(first.view.overlay.text)).toBe(
      "Prize one\n",
    );
    expect(first.view.overlay?.kind === "message" && first.view.overlay.picture?.fg).toBe(
      "stuff/money_bag",
    );
    expect(first.town.players[1]?.bp).toBe(bp + 7);
    const second = act(first.town, 1, { type: "dismiss", overlayId: "mailbox:letter" }, ctx);
    expect(second.view.overlay?.kind === "message" && plain(second.view.overlay.text)).toBe(
      "Prize two\n",
    );
    expect(second.town.players[1]?.bp).toBe(bp + 12);
    const done = act(second.town, 1, { type: "dismiss", overlayId: "mailbox:letter" }, ctx);
    expect(done.view.overlay).toBeUndefined();
    expect(done.town.players[1]?.mail).toEqual([]);
  });

  it("a recipient in the cafe hears that mail is waiting (commands_send_mail.cpp:28)", () => {
    const { town, ctx } = socialTown(4, 2, { online: [0, 1] });
    const map = press(town, 1, "go:map", ctx);
    const inCafe = act(map.town, 1, { type: "visit", placeId: "cafe" }, ctx).town;
    const r = write(inCafe, 0, "Morticia", "psst", ctx);
    expect(chatFor(r, 1)).toEqual(["You have mail waiting for you at your parlor."]);
  });

  it("mail is swear-filtered by default (filterUserText) and left alone with the original rules", () => {
    const filtered = socialTown(5, 2);
    const a = write(filtered.town, 0, "Morticia", "you shit", filtered.ctx);
    const m = a.town.players[1]?.mail[0];
    expect(m?.type === "text" && m.text).toContain("you shoot");
    const ctx = context(originalClassicRules());
    const orig = socialTown(5, 2, { rules: originalClassicRules() });
    const b = write(orig.town, 0, "Morticia", "you shit", ctx);
    const n = b.town.players[1]?.mail[0];
    expect(n?.type === "text" && n.text).toContain("you shit");
  });

  it("a recipient deleted meanwhile: Can't email (commands_send_mail.cpp:12-20)", () => {
    const { town, ctx } = socialTown(6, 2);
    const pen = press(town, 0, "go:mailbox", ctx);
    const asked = act(pen.town, 0, submit("mailbox:getname", "Morticia"), ctx);
    const yes = act(
      asked.town,
      0,
      { type: "confirm", overlayId: "mailbox:namenext", accepted: true },
      ctx,
    );
    const gone = edit(yes.town, 1, { active: false });
    const r = act(gone, 0, submit("mailbox:compose", "hello?"), ctx);
    expect(r.view.overlay?.kind === "message" && plain(r.view.overlay.text)).toBe(
      "Can't email, player doesn't exist?",
    );
  });
});
