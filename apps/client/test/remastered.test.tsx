import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArtProvider } from "../src/art/ArtContext.js";
import { CLASSIC_IDS, classicMayHave } from "../src/art/classicIds.js";
import {
  buildPacks,
  getPack,
  PACKS,
  pictureMap,
  pictureSources,
  shareAcross,
} from "../src/art/packs.js";
import { ICON_NAMES, type PackJson } from "../src/art/types.js";
import { AssetBaseContext } from "../src/components/AssetContext.js";
import { XIcon } from "../src/components/ExpandedIcons.js";
import { PictureLayers } from "../src/components/Picture.js";
import { I18nProvider } from "../src/i18n/I18nContext.js";
import { FIXTURES } from "../src/mock/fixtures.js";
import { SettingsProvider } from "../src/settings/settings.js";
import { renderGame, ScriptedTransport } from "./helpers.js";

const classic = getPack("classic");
const remastered = getPack("remastered");

/** A picture in a given pack, outside the game. */
const inPack = (ui: React.ReactElement, artPack: string, base = "/classic") =>
  render(
    <I18nProvider>
      <SettingsProvider initial={{ artPack }}>
        <ArtProvider>
          <AssetBaseContext.Provider value={base}>{ui}</AssetBaseContext.Provider>
        </ArtProvider>
      </SettingsProvider>
    </I18nProvider>,
  );

describe("the Remastered pack", () => {
  it("is registered, selectable by id, and named Remastered", () => {
    expect(remastered.id).toBe("remastered");
    expect(remastered.name).toBe("Remastered");
    expect(remastered.extends).toBe("classic");
    expect(PACKS.map((p) => p.id)).toContain("remastered");
  });

  it("keeps the original chrome: every Classic piece, cabinet, fit, map and newspaper is inherited", () => {
    for (const [name, url] of Object.entries(classic.pieces)) {
      if (
        name === "building-city-hall" ||
        name === "building-reaper-club" ||
        name === "capsule-parlor"
      )
        continue;
      expect(remastered.pieces[name as keyof typeof classic.pieces], name).toBe(url);
    }
    expect(remastered.cabinets).toEqual(classic.cabinets);
    expect(remastered.fits).toEqual(classic.fits);
    expect(remastered.map).toEqual(classic.map);
    expect(remastered.news).toEqual(classic.news);
  });

  it("replaces the Classic stand-ins with its own drawings, so none is left a placeholder", () => {
    for (const name of ["building-city-hall", "building-reaper-club", "capsule-parlor"] as const) {
      expect(remastered.pieces[name], name).toBeTruthy();
      // Classic has no stand-in left either: it borrows the Remastered piece.
      expect(classic.pieces[name]).toBe(remastered.pieces[name]);
    }
    expect(remastered.placeholders ?? []).toEqual([]);
    expect(classic.placeholders ?? []).toEqual([]);
  });

  it("draws every icon the client knows, and every other pack borrows them", () => {
    for (const name of ICON_NAMES) {
      expect(remastered.icons?.[name], name).toBeTruthy();
      expect(classic.icons?.[name], name).toBe(remastered.icons?.[name]);
      expect(getPack("handdrawn").icons?.[name], name).toBe(remastered.icons?.[name]);
    }
  });

  it("redraws the twelve traced photographs and adds the Expanded places", () => {
    const traced = [
      "places/store",
      "places/palors",
      "places/bank",
      "places/fire",
      "background/background_1",
      "background/background_2",
      "background/background_3",
      "background/background_4",
      "background/background_5",
      "background/background_7",
      "background/background_church",
      "background/background_celemony",
    ];
    for (const id of traced) expect(remastered.pictures?.[id], id).toBeTruthy();
    for (const id of [
      "places/graveyard",
      "places/city-hall",
      "places/reaper-club",
      "people/mayor-grubb",
    ]) {
      expect(remastered.pictures?.[id], id).toBeTruthy();
    }
    // chrome and icons are bundled from the pack folder, never as pictures
    expect(Object.keys(remastered.pictures ?? {}).some((id) => /^(ui|icons)\//.test(id))).toBe(
      false,
    );
    expect(classic.pictures).toBeUndefined();
  });
});

describe("art shared across packs", () => {
  const a = { id: "a", name: "A", description: "", pieces: {}, cabinets: {}, fits: {} };

  it("fills a missing icon from another pack and keeps a pack's own", () => {
    const [x, y] = shareAcross([
      { ...a, id: "x", icons: { money: "/x/money.svg" } },
      { ...a, id: "y", icons: { money: "/y/money.svg", karma: "/y/karma.svg" } },
    ]);
    expect(x?.icons).toEqual({ money: "/x/money.svg", karma: "/y/karma.svg" });
    expect(y?.icons).toEqual({ money: "/y/money.svg", karma: "/y/karma.svg" });
  });

  it("replaces a stand-in piece with another pack's real one, and keeps it when there is none", () => {
    const [x, y, z] = shareAcross([
      {
        ...a,
        id: "x",
        pieces: { "building-city-hall": "/x/stand-in.svg" },
        placeholders: ["building-city-hall" as const, "capsule-parlor" as const],
      },
      { ...a, id: "y", pieces: { "building-city-hall": "/y/real.svg" } },
      {
        ...a,
        id: "z",
        pieces: { "building-city-hall": "/z/stand-in.svg" },
        placeholders: ["building-city-hall" as const],
      },
    ]);
    expect(x?.pieces["building-city-hall"]).toBe("/y/real.svg");
    expect(x?.placeholders).toEqual(["capsule-parlor"]);
    expect(y?.pieces["building-city-hall"]).toBe("/y/real.svg");
    // z's only other candidates are a real piece (y's) too, so it borrows it as well.
    expect(z?.pieces["building-city-hall"]).toBe("/y/real.svg");
    expect(z?.placeholders).toBeUndefined();
    // Two stand-ins and no real piece anywhere stay stand-ins.
    const [p, q] = shareAcross([
      {
        ...a,
        id: "p",
        pieces: { "capsule-parlor": "/p.svg" },
        placeholders: ["capsule-parlor" as const],
      },
      {
        ...a,
        id: "q",
        pieces: { "capsule-parlor": "/q.svg" },
        placeholders: ["capsule-parlor" as const],
      },
    ]);
    expect(p?.placeholders).toEqual(["capsule-parlor"]);
    expect(q?.pieces["capsule-parlor"]).toBe("/q.svg");
  });

  it("orders a picture's sources: the pack, the Classic art, then any other pack", () => {
    const sel = { ...a, id: "sel", pictures: { "places/store": "/sel/store.svg" } };
    const other = {
      ...a,
      id: "other",
      pictures: { "places/store": "/o/store.svg", "places/graveyard": "/o/gy.svg" },
    };
    expect(pictureSources(sel, "places/store", "/classic/places/store.svg", [other, sel])).toEqual([
      "/sel/store.svg",
      "/classic/places/store.svg",
      "/o/store.svg",
    ]);
    // A pack with nothing of its own: the Classic art first, the other pack's as the last resort.
    expect(pictureSources(a, "places/store", "/classic/places/store.svg", [other])).toEqual([
      "/classic/places/store.svg",
      "/o/store.svg",
    ]);
    // The Classic art does not have the id (the caller left it out): straight to the other pack.
    expect(pictureSources(a, "places/graveyard", undefined, [other])).toEqual(["/o/gy.svg"]);
  });

  it("asks the Classic art only for pictures it can have", () => {
    const known = new Set(["places/bank"]);
    expect(classicMayHave("places/bank", known)).toBe(true);
    expect(classicMayHave("places/graveyard", known)).toBe(false);
    expect(classicMayHave("ui/new-user-clerk", known)).toBe(true);
    // A build that knows no Classic ids does not guess.
    expect(classicMayHave("places/graveyard", new Set())).toBe(true);
    expect(CLASSIC_IDS.has("places/bank")).toBe(true);
    expect(CLASSIC_IDS.has("places/graveyard")).toBe(false);
    expect(remastered.pictures?.["places/graveyard"]).toBeTruthy();
  });
});

describe("pack inheritance (buildPacks)", () => {
  const manifests: Record<string, PackJson> = {
    "./packs/classic/pack.json": {
      id: "classic",
      name: "Classic",
      fits: { classic: { scale: 1.43 } },
    },
    "./packs/fancy/pack.json": { id: "fancy", name: "Fancy", extends: "classic" },
    "./packs/loop/pack.json": { id: "loop", name: "Loop", extends: "loop" },
    "./packs/orphan/pack.json": { id: "orphan", name: "Orphan", extends: "nope" },
  };
  const packs = buildPacks(
    manifests,
    {
      "./packs/classic/ui/logo.svg": "/c/logo.svg",
      "./packs/classic/ui/notepad.svg": "/c/notepad.svg",
      "./packs/fancy/ui/logo.svg": "/f/logo.svg",
    },
    {
      "./packs/classic/placeholders/building-city-hall.svg": "/c/ph-ch.svg",
      "./packs/classic/placeholders/capsule-parlor.svg": "/c/ph-cp.svg",
    },
    {
      "./packs/fancy/icons/money.svg": "/f/money.svg",
      "./packs/fancy/icons/not-an-icon.svg": "/f/x.svg",
    },
    {
      "../../../../assets/fancy/places/store.svg": "/f/store.svg",
      "../../../../assets/fancy/ui/logo.svg": "/f/ui-logo.svg",
      "../../../../assets/classic/places/store.svg": "/c/store.svg",
    },
  );
  const fancy = packs.find((p) => p.id === "fancy");

  it("takes what the pack draws and inherits the rest", () => {
    expect(fancy?.pieces).toEqual({
      logo: "/f/logo.svg",
      notepad: "/c/notepad.svg",
      "building-city-hall": "/c/ph-ch.svg",
      "capsule-parlor": "/c/ph-cp.svg",
    });
    expect(fancy?.fits).toEqual({ classic: { scale: 1.43 } });
    // The pack that has no real piece anywhere keeps its stand-ins.
    expect(fancy?.placeholders).toEqual(["building-city-hall", "capsule-parlor"]);
    expect(fancy?.icons).toEqual({ money: "/f/money.svg" });
    expect(fancy?.pictures).toEqual({ "places/store": "/f/store.svg" });
  });

  it("ignores a base that does not exist and a pack that extends itself", () => {
    expect(packs.find((p) => p.id === "loop")?.pieces).toEqual({});
    expect(packs.find((p) => p.id === "orphan")?.pieces).toEqual({});
  });

  it("maps picture files to asset ids and skips Classic, ui/ and icons/", () => {
    expect(
      pictureMap({
        "../../../../assets/remastered/background/background_1.svg": "/a.svg",
        "../../../../assets/remastered/icons/money.svg": "/b.svg",
        "../../../../assets/classic/places/bank.svg": "/c.svg",
      }),
    ).toEqual({ remastered: { "background/background_1": "/a.svg" } });
  });

  it("lists a pack's own picture first, then the base art", () => {
    expect(pictureSources(fancy, "places/store", "/classic/places/store.svg")).toEqual([
      "/f/store.svg",
      "/classic/places/store.svg",
    ]);
    expect(pictureSources(fancy, "places/bank", "/classic/places/bank.svg")).toEqual([
      "/classic/places/bank.svg",
    ]);
    expect(pictureSources(undefined, "places/bank", "/classic/places/bank.svg")).toEqual([
      "/classic/places/bank.svg",
    ]);
  });
});

describe("pictures under the Remastered pack", () => {
  it("loads its redraw for an overridden id and the Classic art for any other", () => {
    inPack(
      <PictureLayers picture={{ bg: "places/store", fg: "people/store_guy" }} />,
      "remastered",
    );
    const [bg, fg] = Array.from(document.querySelectorAll("img"));
    expect(bg?.getAttribute("src")).toBe(remastered.pictures?.["places/store"]);
    expect(bg).toHaveAttribute("data-source", "pack");
    expect(fg).toHaveAttribute("src", "/classic/people/store_guy.svg");
    expect(fg).toHaveAttribute("data-source", "base");
  });

  it("falls back to the Classic art when its own drawing fails, then to the placeholder", () => {
    inPack(<PictureLayers picture={{ bg: "places/store" }} />, "remastered");
    fireEvent.error(document.querySelector("img") as HTMLImageElement);
    expect(document.querySelector("img")).toHaveAttribute("src", "/classic/places/store.svg");
    fireEvent.error(document.querySelector("img") as HTMLImageElement);
    expect(document.querySelector("img")).toBeNull();
    expect(
      screen.getByRole("img", { name: "Art not available: places/store" }),
    ).toBeInTheDocument();
  });

  it("leaves Classic exactly as it was", () => {
    inPack(<PictureLayers picture={{ bg: "places/store" }} />, "classic");
    expect(document.querySelector("img")).toHaveAttribute("src", "/classic/places/store.svg");
  });

  it("draws the icon in place of the inline glyph, in every pack, and the glyph where no pack has one", () => {
    const { unmount } = inPack(<XIcon name="money" />, "remastered");
    expect(document.querySelector("img.fq-xicon-art")?.getAttribute("src")).toBe(
      remastered.icons?.money,
    );
    unmount();
    const classicRender = inPack(<XIcon name="money" />, "classic");
    expect(document.querySelector("img.fq-xicon-art")?.getAttribute("src")).toBe(
      remastered.icons?.money,
    );
    classicRender.unmount();
    // A world with no icons at all: the inline glyph.
    const bare = { id: "bare", name: "Bare", description: "", pieces: {}, cabinets: {}, fits: {} };
    render(
      <I18nProvider>
        <SettingsProvider initial={{ artPack: "bare" }}>
          <ArtProvider packs={[bare]}>
            <XIcon name="money" />
          </ArtProvider>
        </SettingsProvider>
      </I18nProvider>,
    );
    expect(document.querySelector("img.fq-xicon-art")).toBeNull();
    expect(document.querySelector("svg.fq-xicon")).not.toBeNull();
  });

  it("a player on Classic art still sees the Expanded places, and one on Remastered every original", () => {
    // Remastered-only picture, Classic selected: no request to the Classic art at all.
    const { unmount } = inPack(<PictureLayers picture={{ bg: "places/graveyard" }} />, "classic");
    const gy = document.querySelector("img");
    expect(gy).toHaveAttribute("src", remastered.pictures?.["places/graveyard"]);
    expect(gy).toHaveAttribute("data-source", "pack:remastered");
    unmount();
    // The same under the hand-drawn pack.
    const drawn = inPack(<PictureLayers picture={{ bg: "people/mayor-grubb" }} />, "handdrawn");
    expect(document.querySelector("img")).toHaveAttribute(
      "src",
      remastered.pictures?.["people/mayor-grubb"],
    );
    drawn.unmount();
    // A Classic original that Remastered did not redraw, Remastered selected: the Classic art.
    const original = inPack(<PictureLayers picture={{ bg: "places/desk" }} />, "remastered");
    expect(document.querySelector("img")).toHaveAttribute("src", "/classic/places/desk.svg");
    original.unmount();
    // A redrawn original: Classic keeps the Classic art, Remastered its own redraw.
    const c = inPack(<PictureLayers picture={{ bg: "places/store" }} />, "classic");
    expect(document.querySelector("img")).toHaveAttribute("src", "/classic/places/store.svg");
    c.unmount();
    inPack(<PictureLayers picture={{ bg: "places/store" }} />, "remastered");
    expect(document.querySelector("img")).toHaveAttribute(
      "src",
      remastered.pictures?.["places/store"],
    );
  });

  it("an id nobody draws is a labelled placeholder, in either pack", () => {
    for (const pack of ["classic", "remastered"]) {
      const { unmount } = inPack(<PictureLayers picture={{ bg: "places/nowhere-at-all" }} />, pack);
      const img = document.querySelector("img") as HTMLImageElement;
      expect(img).toHaveAttribute("src", "/classic/places/nowhere-at-all.svg");
      fireEvent.error(img);
      expect(screen.getByRole("img", { name: /Art not available/ })).toBeInTheDocument();
      unmount();
    }
  });

  it("plays a Classic town with the original chrome and its own redrawn pictures", async () => {
    renderGame(new ScriptedTransport(FIXTURES.desk), { settings: { artPack: "remastered" } });
    await screen.findByRole("heading", { level: 1, name: "Your Desk" });
    const app = document.querySelector(".fq-app");
    expect(app).toHaveAttribute("data-art", "pieces");
    expect(app).toHaveAttribute("data-art-pack", "remastered");
    expect(document.querySelector("img.fq-cabinet-piece")?.getAttribute("src")).toBe(
      classic.pieces["cabinet-main"],
    );
  });
});
