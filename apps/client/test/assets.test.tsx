import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssetBaseContext } from "../src/components/AssetContext.js";
import { PictureLayers } from "../src/components/Picture.js";
import { I18nProvider } from "../src/i18n/I18nContext.js";
import { FIXTURES } from "../src/mock/fixtures.js";
import { assetUrl } from "../src/util/assets.js";
import { renderGame, ScriptedTransport } from "./helpers.js";

const inContext = (ui: React.ReactElement, base = "/classic") =>
  render(
    <I18nProvider>
      <AssetBaseContext.Provider value={base}>{ui}</AssetBaseContext.Provider>
    </I18nProvider>,
  );

describe("asset urls", () => {
  it("builds the asset base, a slash, the id and .svg", () => {
    expect(assetUrl("/classic", "places/bank")).toBe("/classic/places/bank.svg");
    expect(assetUrl("https://cdn.example/art/", "wait")).toBe("https://cdn.example/art/wait.svg");
    expect(assetUrl("/classic", "places/funeral_home(black)")).toBe(
      "/classic/places/funeral_home(black).svg",
    );
  });

  it.each(["../secret", "a/../b", "/abs", "a//b", "a\\b", "", "."])("refuses %j", (id) => {
    expect(assetUrl("/classic", id)).toBeUndefined();
  });
});

describe("picture layers", () => {
  it("loads the background then the foreground from the asset base", () => {
    inContext(
      <PictureLayers picture={{ bg: "background/background_1", fg: "people/m_adult" }} />,
      "/art",
    );
    const imgs = document.querySelectorAll("img");
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toHaveAttribute("src", "/art/background/background_1.svg");
    expect(imgs[1]).toHaveAttribute("src", "/art/people/m_adult.svg");
  });

  it("shows a labelled placeholder when an asset fails to load", () => {
    inContext(<PictureLayers picture={{ fg: "people/nobody" }} />);
    const img = document.querySelector("img") as HTMLImageElement;
    fireEvent.error(img);
    expect(document.querySelector("img")).toBeNull();
    const ph = screen.getByRole("img", { name: "Art not available: people/nobody" });
    expect(ph).toHaveTextContent("people/nobody");
  });

  it("keeps a layer that loads and replaces only the one that fails", () => {
    inContext(<PictureLayers picture={{ bg: "good", fg: "bad" }} />);
    const [bg, fg] = Array.from(document.querySelectorAll("img"));
    fireEvent.load(bg as HTMLImageElement);
    fireEvent.error(fg as HTMLImageElement);
    expect(document.querySelectorAll("img")).toHaveLength(1);
    expect(screen.getAllByRole("img", { name: /Art not available/ })).toHaveLength(1);
  });

  it("treats an unsafe id as missing without requesting anything", () => {
    inContext(<PictureLayers picture={{ bg: "../../etc/passwd" }} />);
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: /Art not available/ })).toBeInTheDocument();
  });

  it("renders nothing for a missing or empty picture", () => {
    const { container, rerender } = inContext(<PictureLayers picture={undefined} />);
    expect(container).toBeEmptyDOMElement();
    rerender(
      <I18nProvider>
        <PictureLayers picture={{}} />
      </I18nProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("a whole scene with every picture missing renders and keeps working", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    renderGame(new ScriptedTransport(FIXTURES.negotiation));
    await screen.findByRole("region", { name: "The customer" });
    // A picture falls back through the pack's drawing, the Classic art and other packs' drawings;
    // fail every source in turn until each layer has given up.
    for (let pass = 0; pass < 4; pass++) {
      for (const img of Array.from(document.querySelectorAll("img"))) fireEvent.error(img);
    }
    expect(screen.getAllByRole("img", { name: /Art not available/ }).length).toBeGreaterThanOrEqual(
      2,
    );
    expect(screen.getByRole("button", { name: /Guilt/ })).toBeInTheDocument();
    expect(error).not.toHaveBeenCalled();
  });
});
