import { describe, expect, it } from "vitest";
import { leaveGame } from "../src/index.js";
import { socialTown } from "./support/social.js";

/**
 * The idle time-out (`CFqDlg::user_list_update_time`, legacy/source/user_list.cpp:160-171) says
 * "<name> got kicked for inactivity" to everyone (`broadcast`, :167) before it deletes the online
 * record (`online_delete_guy`, :168). A dropped connection (`leaveGame` with no option) and the
 * sysop's Kick (dlg_edit_choose.cpp:257-278, user_list.cpp:307-335) call only the second.
 */
describe("leaveGame for the idle time-out (user_list.cpp:160-171)", () => {
  it("announces the kick to the players online, then logs the player off", () => {
    const { town, ctx } = socialTown(21, 3, { online: [0, 1, 2] });
    const r = leaveGame(town, 1, ctx, { inactive: true });
    expect(r.town.sessions["1"]).toBeUndefined();
    const name = town.players[1]?.name;
    const said = r.effects.flatMap((e) => (e.kind === "broadcast" ? [e.text] : []));
    expect(said).toEqual([`${name} got kicked for inactivity`]);
    // The others have it as a normal-importance line; the kicked player's own copy is dropped with
    // the rest of the normal-importance mail (online_util.cpp:158-163).
    expect(r.town.sessions["0"]).toBeDefined();
    expect(r.town.sessions["2"]).toBeDefined();
    expect(r.town.players[1]?.mail.some((m) => m.importance === "normal")).toBe(false);
    expect(r.effects.at(-1)).toMatchObject({ kind: "sessionEnded", playerId: 1 });
  });

  it("is silent for a dropped connection or a sysop's Kick", () => {
    const { town, ctx } = socialTown(22, 2, { online: [0, 1] });
    const r = leaveGame(town, 1, ctx);
    expect(r.effects.some((e) => e.kind === "broadcast")).toBe(false);
    expect(r.town.sessions["1"]).toBeUndefined();
  });

  it("uses the pack's wording when it has one, else the original's", () => {
    const { town, ctx } = socialTown(23, 2, { online: [0, 1] });
    const text = { ...ctx.content.text, session: { ...ctx.content.text.session } };
    text.session.kickedForInactivity = "{name} was sent home";
    const custom = { ...ctx, content: { ...ctx.content, text } };
    const r = leaveGame(town, 1, custom, { inactive: true });
    const said = r.effects.flatMap((e) => (e.kind === "broadcast" ? [e.text] : []));
    expect(said).toEqual([`${town.players[1]?.name} was sent home`]);
  });
});
