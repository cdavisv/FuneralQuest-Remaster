/**
 * Port differences found by the differential oracle (tools/oracle: the
 * original server compiled for Linux, driven side by side with this engine).
 * Each test cites the C++ and the oracle run that showed the difference;
 * docs/classic-fidelity.md lists them with their evidence.
 */
import { describe, expect, it } from "vitest";
import { showTime } from "../src/classic/clock.js";
import {
  type EngineContext,
  enterGame,
  originalClassicRules,
  richTextToPlain,
  type TownState,
} from "../src/index.js";
import { context } from "./support/harness.js";
import { act, press, socialTown, submit } from "./support/social.js";

describe("mail is read only when the original asked for the desk (oracle finding 1)", () => {
  // The desk's pen is the client's own (welcome.swf button 396). The name box's
  // Cancel and its "nobody by that name" box (buttons 496 and 504) call
  // callback_email_fail, which at the pen only replays m_main from frame 1, and
  // the notepad's close button (451) only deletes the pad: none of them sends a
  // request, so command_main (commands_main.cpp:5-109, the only reader of the
  // queue via add_que_messages, broadcast.cpp:14-100) does not run. Oracle run
  // "tournament 2" step 51-52: a mail to "zzz" at the desk, then Wait; the
  // original still held a queued 6 BP reward, the port had applied it.
  function withReward() {
    const { town, ctx } = socialTown(1, 2);
    const me = town.players[0];
    if (!me) throw new Error("no player");
    // A rival's walk-out sends this player a BP reward (pissed_over_limit,
    // commands_complicated.cpp:224-288, send_packet_var_mod).
    me.mail.push({
      type: "varMod",
      stat: "bp",
      amount: 6,
      importance: "high",
      from: -1,
      expireDay: null,
    });
    return { town, ctx, bp: me.bp };
  }

  it("closing 'nobody by that name' leaves the reward queued", () => {
    const { town, ctx, bp } = withReward();
    const pen = press(town, 0, "go:mailbox", ctx);
    const none = act(pen.town, 0, submit("mailbox:getname", "zzz"), ctx);
    const back = act(none.town, 0, { type: "dismiss", overlayId: "mailbox:noname" }, ctx);
    expect(back.view.scene).toBe("desk");
    expect(back.town.players[0]?.bp).toBe(bp);
    expect(back.town.players[0]?.mail.some((m) => m.type === "varMod")).toBe(true);
    // The next desk visit (command_main) reads it.
    const desk = press(back.town, 0, "go:map", ctx);
    const home = act(desk.town, 0, { type: "visit", placeId: "funeral-home" }, ctx);
    expect(home.town.players[0]?.bp).toBe(bp + 6);
  });

  it("cancelling the name box leaves the reward queued", () => {
    const { town, ctx, bp } = withReward();
    const pen = press(town, 0, "go:mailbox", ctx);
    const cancelled = act(pen.town, 0, submit("mailbox:getname", null), ctx);
    expect(cancelled.view.overlay).toBeUndefined();
    expect(cancelled.town.players[0]?.bp).toBe(bp);
  });

  it("closing the notepad leaves the reward queued", () => {
    const { town, ctx, bp } = withReward();
    const pen = press(town, 0, "go:mailbox", ctx);
    const asked = act(pen.town, 0, submit("mailbox:getname", "r"), ctx);
    const yes = act(
      asked.town,
      0,
      { type: "confirm", overlayId: "mailbox:namenext", accepted: true },
      ctx,
    );
    const closed = act(yes.town, 0, submit("mailbox:compose", null), ctx);
    expect(closed.town.players[0]?.bp).toBe(bp);
  });
});

describe("the news blurb's gift mail starts with an empty Continue stop (oracle finding D2, fixes.emptyMailStop)", () => {
  // maint.cpp:33-95 queues Continue, text, rewards, picture, Continue, news line.
  // command_main (commands_main.cpp:89-108) reads the queue with add_que_messages
  // (broadcast.cpp:14-100), which stops at the first Continue: nothing was read,
  // so the desk says "You are sitting at your desk." with only Continue, and the
  // gift's BP and luck come at the next click. Oracle: the 23 "transient"
  // differences of the first suite run (for example "crowd 4" step 182).
  function giftTown(rules?: ReturnType<typeof originalClassicRules>) {
    const { town, ctx } = socialTown(1, 2, rules ? { rules } : {});
    const me = town.players[0];
    if (!me) throw new Error("no player");
    const base = { importance: "high" as const, from: -1, expireDay: null };
    me.mail.length = 0; // the log-off notices of the set-up
    me.mail.push(
      { type: "buttons", buttons: [{ id: "go:desk", label: "Continue" }], ...base },
      { type: "text", text: "The zoo calls.", ...base },
      { type: "varMod", stat: "bp", amount: 34, ...base },
      { type: "buttons", buttons: [{ id: "go:desk", label: "Continue" }], ...base },
    );
    return { town, ctx, bp: me.bp };
  }
  function toDeskAgain(town: TownState, ctx: EngineContext) {
    const map = press(town, 0, "go:map", ctx);
    return act(map.town, 0, { type: "visit", placeId: "funeral-home" }, ctx);
  }

  it("original rules: the desk with only Continue, the gift at the next click", () => {
    const { town, ctx, bp } = giftTown(originalClassicRules());
    const desk = toDeskAgain(town, ctx);
    expect(desk.view.overlay).toBeUndefined();
    expect(richTextToPlain(desk.view.text)).toBe("You are sitting at your desk.\n");
    expect(desk.view.buttons.map((b) => b.id)).toEqual(["go:desk"]);
    expect(desk.town.players[0]?.bp).toBe(bp);
    const next = press(desk.town, 0, "go:desk", ctx);
    expect(next.town.players[0]?.bp).toBe(bp + 34);
  });

  it("fixed (default): read past the empty stop, the gift at once", () => {
    const { town, ctx, bp } = giftTown();
    const desk = toDeskAgain(town, ctx);
    expect(desk.town.players[0]?.bp).toBe(bp + 34);
  });
});

describe("notices carry the server's local time (oracle finding D3)", () => {
  // broadcast (broadcast.cpp:391-407) formats "%s:%s" of show_time() and the
  // text; show_time (shared/std_all.cpp:328-347) is GetTimeFormat with the
  // picture "h':'mm' 'tt". Oracle: "12:00 AM:Bob logged on." where the port
  // printed "Bob logged on.".
  const at = (h: number, m: number) => Date.UTC(2001, 0, 1, h, m, 30);
  it("formats the time as h:mm AM/PM", () => {
    const ctx = context(undefined, at(0, 5));
    expect(showTime(ctx)).toBe("12:05 AM");
    expect(showTime({ ...ctx, now: at(9, 7) })).toBe("9:07 AM");
    expect(showTime({ ...ctx, now: at(12, 0) })).toBe("12:00 PM");
    expect(showTime({ ...ctx, now: at(23, 59) })).toBe("11:59 PM");
    // The host passes the server's offset from UTC.
    expect(showTime({ ...ctx, now: at(4, 30), localTimeOffsetMinutes: -300 })).toBe("11:30 PM");
  });

  it("log-on notices are queued with the time in front", () => {
    const { town, ctx } = socialTown(1, 2, { online: [0] });
    const later = { ...ctx, now: at(15, 41) };
    const on = enterGame(town, 1, later);
    const mail = on.town.players[0]?.mail ?? [];
    const notice = mail.find((m) => m.type === "simpleText" && m.text.endsWith("logged on."));
    expect(notice?.type === "simpleText" && notice.text).toBe(
      `3:41 PM:${on.town.players[1]?.name} logged on.`,
    );
  });
});

describe("cancelling Old Papers (fixes.oldPapersCancel, oracle finding D4)", () => {
  // command_spirit_paper (commands_spirit.cpp:390-437) reads st_extra_text with
  // atoi; the client's Cancel sends "12ABORT12" (welcome.swf button 487), so the
  // original looked for day 12. Oracle: "town 2" step 543.
  function toPaperPrompt(rules?: ReturnType<typeof originalClassicRules>) {
    const { town, ctx } = socialTown(1, 1, rules ? { rules } : {});
    const map = press(town, 0, "go:map", ctx);
    const su = act(map.town, 0, { type: "visit", placeId: "spirit-university" }, ctx);
    const lib = press(su.town, 0, "spirit-university:library", ctx);
    const ask = press(lib.town, 0, "spirit-university:paper-start", ctx);
    return { town: ask.town, ctx };
  }
  it("original rules: the abort marker is day 12", () => {
    const { town, ctx } = toPaperPrompt(originalClassicRules());
    const r = act(town, 0, submit("spirit-university:paper", null), ctx);
    expect(richTextToPlain(r.view.text)).toBe(
      "You desperately hunt around for anything dealing with a day 12 but fail.",
    );
  });
  it("fixed (default): back to the library", () => {
    const { town, ctx } = toPaperPrompt();
    const r = act(town, 0, submit("spirit-university:paper", null), ctx);
    expect(richTextToPlain(r.view.text)).toContain("You are in the library.");
  });
});

describe("no log-on while someone is inside the parlor (text audit finding)", () => {
  // check_name_and_password (funeral.cpp:357-363) refuses with
  // send_error_message when get_player_who_locked_this_guy (misc_utils.cpp:
  // 279-301) finds a visitor holding the parlor (b_locked). The port let the
  // owner log on; the static text audit found the message missing.
  it("refuses with the original's message, and allows it once the visitor leaves", () => {
    const { town, ctx } = socialTown(1, 2, { online: [0] });
    const visitor = town.sessions["0"];
    if (!visitor) throw new Error("no session");
    visitor.hisId = 1;
    visitor.locked = true;
    const refused = enterGame(town, 1, ctx);
    expect(refused.rejected).toBeDefined();
    expect(refused.message && richTextToPlain(refused.message)).toBe(
      "Someone is currently poking around your parlor...please log back on in a few minutes!",
    );
    expect(refused.town.sessions["1"]).toBeUndefined();
    visitor.locked = false;
    expect(enterGame(town, 1, ctx).rejected).toBeUndefined();
  });
});
