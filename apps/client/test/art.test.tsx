import type { View } from "@fq/protocol";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ArtProvider, useArt } from "../src/art/ArtContext.js";
import { cabinetVars, placeArt, toStage } from "../src/art/geometry.js";
import { buildPacks, DEFAULT_PACK_ID, getPack, PACKS } from "../src/art/packs.js";
import { type PackJson, PIECE_NAMES } from "../src/art/types.js";
import { cabinetVariant } from "../src/Game.js";
import { FIXTURES } from "../src/mock/fixtures.js";
import { defaultSettings, loadSettings, SettingsProvider } from "../src/settings/settings.js";
import { renderGame, ScriptedTransport } from "./helpers.js";

const classic = getPack("classic");

function ArtProbe() {
  useArt();
  return null;
}

describe("art packs", () => {
  it("ships Classic (first, the default), Remastered, and the hand-drawn fallback", () => {
    expect(PACKS.map((p) => p.id)).toEqual(["classic", "remastered", "handdrawn"]);
    expect(DEFAULT_PACK_ID).toBe("classic");
    expect(defaultSettings().artPack).toBe("classic");
    expect(Object.keys(getPack("handdrawn").pieces)).toHaveLength(0);
  });

  it("Classic supplies a piece for every role its geometry and scenes use", () => {
    for (const spec of Object.values(classic.cabinets)) {
      expect(classic.pieces[spec.piece], spec.piece).toBeTruthy();
    }
    for (const name of PIECE_NAMES) expect(classic.pieces[name], name).toBeTruthy();
    expect(classic.map?.buildings).toBeTruthy();
    expect(classic.news).toBeTruthy();
  });

  it("falls back to Classic for an unknown id", () => {
    expect(getPack("does-not-exist").id).toBe("classic");
    expect(getPack(undefined).id).toBe("classic");
  });

  it("a future pack is just files: a manifest and some ui/*.svg pieces", () => {
    const manifest: PackJson = { id: "remastered", name: "Remastered" };
    const packs = buildPacks(
      {
        "./packs/classic/pack.json": { id: "classic", name: "Classic" },
        "./packs/remastered/pack.json": manifest,
        "./packs/handdrawn/pack.json": { id: "handdrawn", name: "Hand-drawn" },
      },
      {
        "./packs/remastered/ui/plaque-button.svg": "/x/plaque.svg",
        "./packs/remastered/ui/not-a-role.svg": "/x/nope.svg",
        "./packs/classic/ui/logo.svg": "/x/logo.svg",
      },
    );
    expect(packs.map((p) => p.id)).toEqual(["classic", "remastered", "handdrawn"]);
    expect(packs[1]?.pieces).toEqual({ "plaque-button": "/x/plaque.svg" });
    expect(packs[0]?.pieces).toEqual({ logo: "/x/logo.svg" });
  });
});

describe("the art pack setting", () => {
  it("is stored, restored, and sanitised", () => {
    const store = (v: unknown) => ({ getItem: () => JSON.stringify({ artPack: v }) });
    expect(loadSettings(store("handdrawn")).artPack).toBe("handdrawn");
    expect(loadSettings(store("remastered")).artPack).toBe("remastered");
    expect(loadSettings(store("../etc")).artPack).toBe("classic");
    expect(loadSettings(store(7)).artPack).toBe("classic");
  });

  it("Classic draws the cabinet from art; Hand-drawn draws it with CSS", async () => {
    const { unmount } = renderGame(new ScriptedTransport(FIXTURES.desk));
    await screen.findByRole("heading", { level: 1, name: "Your Desk" });
    const app = document.querySelector(".fq-app");
    expect(app).toHaveAttribute("data-art", "pieces");
    expect(app).toHaveAttribute("data-art-pack", "classic");
    const piece = document.querySelector("img.fq-cabinet-piece");
    expect(piece?.getAttribute("src")).toContain("cabinet-main");
    expect(document.querySelector("svg.fq-cabinet-art")).toBeNull();
    unmount();

    renderGame(new ScriptedTransport(FIXTURES.desk), { settings: { artPack: "handdrawn" } });
    await screen.findByRole("heading", { level: 1, name: "Your Desk" });
    expect(document.querySelector(".fq-app")).toHaveAttribute("data-art", "drawn");
    expect(document.querySelector("img.fq-cabinet-piece")).toBeNull();
    expect(document.querySelector("svg.fq-cabinet-art")).not.toBeNull();
    // The same live content either way.
    expect(screen.getByText("Turns left")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: /Luck meter/ })).toBeInTheDocument();
  });

  it("switches in Settings and is saved", async () => {
    const user = userEvent.setup();
    renderGame(new ScriptedTransport(FIXTURES.desk));
    await user.click(await screen.findByRole("button", { name: "Settings" }));
    const dialog = screen.getByRole("dialog", { name: "Settings" });
    const group = within(dialog).getByRole("group", { name: "Art style" });
    expect(within(group).getByRole("radio", { name: "Classic" })).toBeChecked();
    await user.click(within(group).getByRole("radio", { name: "Hand-drawn" }));
    expect(document.querySelector(".fq-app")).toHaveAttribute("data-art", "drawn");
    expect(JSON.parse(window.localStorage.getItem("fq.settings.v1") ?? "{}").artPack).toBe(
      "handdrawn",
    );
    await user.click(within(group).getByRole("radio", { name: "Classic" }));
    expect(document.querySelector(".fq-app")).toHaveAttribute("data-art", "pieces");
  });

  it("an unknown stored pack still renders (as Classic)", async () => {
    renderGame(new ScriptedTransport(FIXTURES.desk), { settings: { artPack: "gone" } });
    await screen.findByRole("heading", { level: 1, name: "Your Desk" });
    expect(document.querySelector(".fq-app")).toHaveAttribute("data-art-pack", "classic");
  });

  it("useArt needs its provider", () => {
    expect(() => render(<ArtProbe />)).toThrow(/ArtProvider/);
    render(
      <SettingsProvider>
        <ArtProvider>
          <p>ok</p>
        </ArtProvider>
      </SettingsProvider>,
    );
  });
});

describe("which cabinet a screen sits on", () => {
  const v = (patch: Partial<View>): View => ({ ...FIXTURES.desk, ...patch });
  it("stats on the stats parchment; room notes on the plain one; sheets and chat have their own", () => {
    expect(cabinetVariant(FIXTURES.desk)).toBe("main");
    expect(cabinetVariant(FIXTURES.negotiation)).toBe("main");
    expect(cabinetVariant(FIXTURES.shop)).toBe("generic");
    expect(cabinetVariant(v({ hud: undefined as never }))).toBe("generic");
    expect(cabinetVariant(FIXTURES.cafe)).toBe("chat");
    expect(cabinetVariant(FIXTURES.rankings)).toBe("rankings");
    expect(cabinetVariant(FIXTURES.stats)).toBe("status");
  });

  it("each layout puts the art on the cabinet it was designed for", async () => {
    for (const layout of ["classic", "wide"] as const) {
      const { unmount } = renderGame(new ScriptedTransport(FIXTURES.shop), {
        settings: { layout },
      });
      await screen.findByRole("heading", { level: 1, name: "Di-Mart" });
      expect(document.querySelector(".fq-cabinet")).toHaveAttribute("data-cab", "generic");
      expect(document.querySelector("img.fq-cabinet-piece")?.getAttribute("src")).toContain(
        "cabinet-generic",
      );
      expect(document.querySelector(".fq-r-sidelog") !== null).toBe(layout === "wide");
      unmount();
    }
    // Phone is stacked pieces, not a cabinet.
    renderGame(new ScriptedTransport(FIXTURES.shop), { settings: { layout: "phone" } });
    await screen.findByRole("heading", { level: 1, name: "Di-Mart" });
    expect(document.querySelector(".fq-cabinet")).not.toHaveAttribute("data-cab");
    expect(document.querySelector("img.fq-cabinet-piece")).toBeNull();
    expect(document.querySelector(".fq-app")).toHaveAttribute("data-art", "pieces");
  });
});

describe("art geometry", () => {
  const spec = classic.cabinets.main;
  const fit = classic.fits.classic;

  it("fills the 4:3 stage at the original's scale and centres the cabinet", () => {
    expect(spec && fit).toBeTruthy();
    if (!spec || !fit) return;
    const p = placeArt(spec, fit, "classic");
    expect(p.w).toBeCloseTo(671 * 1.43, 1);
    expect(p.x).toBeCloseTo((1024 - p.w) / 2, 1);
    expect(p.y).toBeCloseTo((745 - p.h) / 2, 1);
    // The picture window lands where the 2001 screenshot has it.
    const frame = spec.regions.frame;
    if (!frame) throw new Error("no frame");
    const f = toStage(frame, spec, p);
    expect(f.x).toBeGreaterThan(560);
    expect(f.x).toBeLessThan(580);
    expect(f.y).toBeGreaterThan(195);
    expect(f.y).toBeLessThan(215);
  });

  it("leaves the wide stage room for the side panel", () => {
    const wide = classic.fits.wide;
    if (!spec || !wide) throw new Error("no wide fit");
    const vars = cabinetVars(spec, wide, "wide") as Record<string, string>;
    expect(Number(vars["--log-x"])).toBeGreaterThan(900);
    expect(Number(vars["--log-x"]) + Number(vars["--log-w"])).toBeLessThanOrEqual(1280);
  });
});

describe("Classic art on screen", () => {
  it("the desk puts live numbers over the stats parchment and no placeholder text anywhere", async () => {
    renderGame(new ScriptedTransport(FIXTURES.desk));
    await screen.findByRole("meter", { name: /Luck meter, 58/ });
    const stats = document.querySelector(".fq-stats-art");
    expect(stats).not.toBeNull();
    const numbers = Array.from(stats?.querySelectorAll(".fq-num") ?? []).map((n) => n.textContent);
    expect(numbers).toEqual(["16", "13"]);
    // Tag counts are live too; the coffin icons are the art's.
    expect(screen.getByLabelText("Silver casket tags: 1")).toHaveTextContent("1");
    expect(document.querySelector("svg.fq-coffin")).toBeNull();
    expect(document.body.textContent).not.toMatch(/temptext/i);
  });

  it("plaque buttons keep their live labels and keys", async () => {
    const t = new ScriptedTransport(FIXTURES.desk);
    renderGame(t);
    const nav = await screen.findByRole("navigation", { name: "Choices" });
    expect(within(nav).getAllByRole("button")).toHaveLength(5);
    await userEvent.click(within(nav).getByRole("button", { name: /Visit Town/ }));
    expect(t.sent).toEqual([{ type: "press", buttonId: "map" }]);
  });

  it("the cafe's chat room leaves out the picture and note, and still chats", async () => {
    renderGame(new ScriptedTransport(FIXTURES.cafe));
    expect(await screen.findByRole("textbox", { name: "Say something" })).toBeInTheDocument();
    expect(document.querySelector(".fq-cabinet")).toHaveAttribute("data-cab", "chat");
    expect(document.querySelector(".fq-r-frame")).toBeNull();
  });
});

describe("the Deathville map", () => {
  const ids = [
    "funeral-home",
    "bank",
    "store",
    "cafe",
    "yangs",
    "competitors",
    "church",
    "hospital",
    "spirit-university",
  ];

  it("places the fixed ids on the original's buildings", async () => {
    expect(FIXTURES.map.map.map((p) => p.id)).toEqual(ids);
    const t = new ScriptedTransport(FIXTURES.map);
    renderGame(t);
    const spots = await screen.findAllByRole("button", { name: /^Go to / });
    expect(spots).toHaveLength(9);
    expect(document.querySelectorAll("img.fq-building")).toHaveLength(9);
    expect(document.querySelector("img.fq-map-base")?.getAttribute("src")).toContain(
      "deathville-map-base",
    );
    for (const id of ids) {
      expect(classic.map?.buildings[id], id).toBeTruthy();
      expect(classic.pieces[`building-${id}` as keyof typeof classic.pieces], id).toBeTruthy();
    }
    fireEvent.click(screen.getByRole("button", { name: "Go to Bank" }));
    expect(t.sent).toEqual([{ type: "visit", placeId: "bank" }]);
  });

  it("an unknown place still gets a visible, usable control", async () => {
    const view: View = {
      ...FIXTURES.map,
      map: [...FIXTURES.map.map, { id: "observatory", label: "The Observatory" }],
    };
    const t = new ScriptedTransport(view);
    renderGame(t);
    const pin = await screen.findByRole("button", { name: "Go to The Observatory" });
    expect(pin).toHaveTextContent("The Observatory");
    expect(pin.querySelector(".fq-pin-label")).not.toBeNull();
    expect(document.querySelectorAll("img.fq-building")).toHaveLength(9);
    fireEvent.click(pin);
    expect(t.sent).toEqual([{ type: "visit", placeId: "observatory" }]);
  });

  it("the hand-drawn pack keeps every place reachable too", async () => {
    renderGame(new ScriptedTransport(FIXTURES.map), { settings: { artPack: "handdrawn" } });
    expect(await screen.findAllByRole("button", { name: /^Go to / })).toHaveLength(9);
    expect(document.querySelectorAll("img.fq-building")).toHaveLength(0);
  });
});

describe("dialogs and the notepad", () => {
  it("the notepad is the original art with live prompt, field and buttons", async () => {
    const view: View = {
      ...FIXTURES.news,
      overlay: {
        kind: "textInput",
        id: "announce",
        prompt: "What do you say?",
        maxLength: 50,
        multiline: true,
      },
    };
    const t = new ScriptedTransport(view);
    renderGame(t);
    const dialog = await screen.findByRole("dialog", { name: "What do you say?" });
    expect(dialog.querySelector("img.fq-notepad-img")?.getAttribute("src")).toContain("notepad");
    expect(dialog.querySelector(".fq-spiral")).toBeNull();
    await userEvent.type(within(dialog).getByRole("textbox"), "hello");
    await userEvent.click(within(dialog).getByRole("button", { name: "Submit" }));
    expect(t.sent).toEqual([{ type: "submitText", overlayId: "announce", text: "hello" }]);
  });

  it("the drawn pack keeps the drawn spiral", async () => {
    renderGame(new ScriptedTransport(FIXTURES.news), { settings: { artPack: "handdrawn" } });
    await screen.findByRole("heading", { level: 1, name: "Funeral Times" });
    expect(document.querySelector("svg.fq-wall")).not.toBeNull();
  });
});

describe("the lobby and the newspaper", () => {
  it("the lobby is the logon backdrop with the clerk and plaque on 4:3 and wide, stacked on phone", async () => {
    const { unmount } = renderGame(new ScriptedTransport(FIXTURES.lobby));
    await screen.findByRole("heading", { level: 1, name: "Welcome" });
    expect(document.querySelector("img.fq-lobby-bg")?.getAttribute("src")).toContain(
      "logon-screen",
    );
    expect(document.querySelector("img.fq-lobby-clerk")).not.toBeNull();
    expect(screen.getByRole("button", { name: /Log In/ })).toBeInTheDocument();
    unmount();
    renderGame(new ScriptedTransport(FIXTURES.lobby), { settings: { layout: "phone" } });
    await screen.findByRole("heading", { level: 1, name: "Welcome" });
    expect(document.querySelector("img.fq-lobby-bg")).toBeNull();
    expect(screen.getByRole("button", { name: /Log In/ })).toBeInTheDocument();
  });

  it("the newspaper draws on the original and keeps its live bar and links", async () => {
    renderGame(new ScriptedTransport(FIXTURES.news));
    await screen.findByText("Day 16");
    expect(document.querySelector("img.fq-news-img")?.getAttribute("src")).toContain("newspaper");
    expect(screen.getByRole("button", { name: "Make Announcement" })).toBeInTheDocument();
  });
});
