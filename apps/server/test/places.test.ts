import { classicPack, vintagePack } from "@fq/content";
import { CLASSIC_TEXT, richTextToPlain } from "@fq/core";
import type { Action, View } from "@fq/protocol";
import { afterEach, describe, expect, it } from "vitest";
import type { TownInfo } from "../src/wire.js";
import { buttonIds, type Harness, startServer, TestPlayer, toDesk } from "./support/harness.js";

let h: Harness | null = null;
afterEach(async () => {
  await h?.stop();
  h = null;
});

const text = (view: View): string =>
  [view.text, view.note ?? [], view.status ?? []].map((t) => richTextToPlain(t)).join("\n");

/** A screen with missing text shows up as an empty string, "undefined", or a bare {placeholder}. */
function expectNoMissingText(view: View, where: string): void {
  const shown = [
    text(view),
    view.title,
    ...view.buttons.map((b) => b.label),
    view.overlay?.kind === "message" || view.overlay?.kind === "confirm"
      ? richTextToPlain(view.overlay.text)
      : "",
    view.overlay?.kind === "textInput" || view.overlay?.kind === "playerPicker"
      ? view.overlay.prompt
      : "",
  ].join("\n");
  expect(shown, where).not.toMatch(/undefined|\[object|NaN|\{[A-Za-z]+\}/);
  expect(view.title.trim(), `${where}: title`).not.toBe("");
  for (const b of view.buttons) expect(b.label.trim(), `${where}: button ${b.id}`).not.toBe("");
}

async function send(p: TestPlayer, action: Action, where: string): Promise<View> {
  const r = await p.act(action);
  expect(r.status, `${where}: ${JSON.stringify(r.body)}`).toBe(200);
  expectNoMissingText(r.body.view, where);
  return r.body.view;
}

const press = (p: TestPlayer, id: string, where = id) =>
  send(p, { type: "press", buttonId: id }, where);
const visit = (p: TestPlayer, placeId: string) =>
  send(p, { type: "visit", placeId }, `visit ${placeId}`);

describe("the built-in packs cover the engine's whole text table", () => {
  it("the server's default pack is the real classicPack, with places and social text", async () => {
    h = await startServer();
    expect(h.server.host.get("main")?.contentPack).toBe("classic");
    expect(Object.keys(classicPack.text)).toEqual(Object.keys(CLASSIC_TEXT));
    expect(Object.keys(vintagePack.text)).toEqual(Object.keys(CLASSIC_TEXT));
    expect(Object.keys(classicPack.text.places)).toEqual(Object.keys(CLASSIC_TEXT.places));
    expect(Object.keys(classicPack.text.social)).toEqual(Object.keys(CLASSIC_TEXT.social));
  });
});

describe("the public town endpoint carries the engine's lobbyStatus", () => {
  it("gives the game line, the refusal reason and presence-based counts", async () => {
    h = await startServer({
      towns: [{ id: "main", seed: 5, settings: { maxPlayers: 1 } }],
    });
    const anon = new TestPlayer(h, "nobody");
    const empty = await anon.request<TownInfo>("GET", "/api/towns/main");
    expect(empty.status).toBe(200);
    expect(richTextToPlain(empty.body.lobby.gameInfo)).toMatch(/^Game Info: /);
    expect(empty.body.lobby).toMatchObject({ closed: null, online: 0, players: 0 });

    const me = await new TestPlayer(h, "skelly").signUp();
    await me.enter();
    const full = await anon.request<TownInfo>("GET", "/api/towns/main");
    expect(full.body.lobby).toMatchObject({ online: 1, players: 1 });
    expect(full.body.players).toMatchObject({ registered: 1, online: 1, max: 1 });
    expect(richTextToPlain(full.body.lobby.closed ?? [])).toBe(
      "The town is full.  (this server allows 1 players max)  Come back later!",
    );
    expect(richTextToPlain(full.body.lobby.gameInfo)).toContain("1 of 1 players on now");

    // The list endpoint carries the same field.
    const list = await anon.request<{ towns: TownInfo[] }>("GET", "/api/towns");
    expect(list.body.towns[0]?.lobby.online).toBe(1);
  });
});

describe("walking into the new places with the real classicPack", () => {
  it("the cafe, the visit screen, Yang's and the bank all show their text", async () => {
    h = await startServer({ towns: [{ id: "main", seed: 77 }] });
    const me = await new TestPlayer(h, "skelly").signUp();
    const rival = await new TestPlayer(h, "morticia", undefined, "10.0.0.2").signUp();
    await rival.enter();
    await me.enter();
    const desk = await toDesk(me);
    expect(buttonIds(desk)).toContain("desk:wait");

    // The map offers every place.
    const map = await press(me, "go:map");
    const places = (map.map ?? []).map((p) => p.id);
    for (const id of ["cafe", "competitors", "yangs", "bank"]) expect(places, id).toContain(id);

    // The cafe: intro, other people here, the help line and a chat line.
    const cafe = await visit(me, "cafe");
    expect(cafe.scene).toBe("cafe");
    expect(text(cafe)).toContain("Pale Horse");
    expect(text(cafe)).toContain("You are the only one here.");
    const help = await send(me, { type: "chat", text: "/?" }, "cafe help");
    expect((help.chat ?? []).map((c) => richTextToPlain(c.text)).join("\n")).toContain(
      "Cafe chat help",
    );
    const said = await send(me, { type: "chat", text: "hello there" }, "cafe chat");
    expect((said.chat ?? []).map((c) => richTextToPlain(c.text)).join("\n")).toContain(
      "hello there",
    );
    await press(me, "go:map", "leave cafe");

    // The visit screen: the row of parlors, then Visit by name.
    const row = await visit(me, "competitors");
    expect(text(row)).toContain("fog covers the row upon row");
    expect(buttonIds(row)).toContain("competitors:visit");
    const ask = await press(me, "competitors:visit");
    expect(ask.overlay).toMatchObject({ kind: "textInput", id: "competitors:getname" });
    const next = await send(
      me,
      { type: "submitText", overlayId: "competitors:getname", text: "mort" },
      "visit: name",
    );
    expect(next.overlay?.kind).toBe("confirm");
    const front = await send(
      me,
      { type: "confirm", overlayId: "competitors:namenext", accepted: true },
      "visit: confirm",
    );
    expect(text(front)).toContain("morticia Rest");
    // The rival is on now, so the door stays shut; Leave goes back to the row, then the map.
    const back = await press(me, "go:competitors", "leave the front door");
    expect(buttonIds(back)).toContain("go:map");
    await press(me, "go:map", "leave the row");

    // Yang's: the menu with the three dishes, then an order that needs a picker.
    const yangs = await visit(me, "yangs");
    expect(yangs.title).toBe("Yang's");
    expect(text(yangs)).toContain("The Menu");
    expect(text(yangs)).toContain("Lucky Dragon");
    expect(buttonIds(yangs)).toEqual(
      expect.arrayContaining(["yangs:dragon", "yangs:sparrow", "yangs:tiger"]),
    );
    const sparrow = await press(me, "yangs:sparrow");
    expect(sparrow.overlay).toMatchObject({ kind: "playerPicker", id: "yangs:sparrow-target" });
    expect(sparrow.overlay?.kind === "playerPicker" && sparrow.overlay.prompt).toContain(
      "Who's the lucky person",
    );
    await send(me, { type: "pickPlayer", overlayId: "yangs:sparrow-target", playerId: null }, "x");
    await press(me, "go:map", "leave Yang's");

    // The bank: the teller and the three tag kinds.
    const bank = await visit(me, "bank");
    expect(bank.title).toBe("Bank");
    expect(text(bank)).toContain("Teller");
    const exchange = await press(me, "bank:exchange");
    expect(text(exchange)).toContain("Which kind tag would you like to exchange?");
  });
});
