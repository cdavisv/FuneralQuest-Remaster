import { classicPack, vintagePack } from "@fq/content";
import { MemorySaveStorage, type PortLike, serveSolo, type WorkerLike } from "@fq/solo";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.js";
import { ArtProvider } from "../src/art/ArtContext.js";
import { AudioProvider } from "../src/audio/AudioContext.js";
import { SettingsPanel } from "../src/components/SettingsPanel.js";
import { I18nProvider } from "../src/i18n/I18nContext.js";
import { SettingsProvider } from "../src/settings/settings.js";
import type { SoloPlatform } from "../src/solo/platform.js";
import { soloOnly } from "../src/util/soloOnly.js";

/**
 * The solo-only build (decisions 11 and 14): `VITE_SOLO_ONLY=1`. The front door goes straight to
 * Solo, there is nothing online anywhere, and the page asks the network for nothing.
 */

type Listener = (event: { data: unknown }) => void;
function loopbackWorker(): WorkerLike {
  const toWorker = new Set<Listener>();
  const toPage = new Set<Listener>();
  const deliver = (to: Set<Listener>, data: unknown) =>
    queueMicrotask(() => {
      for (const l of [...to]) l({ data: structuredClone(data) });
    });
  const port: PortLike = {
    postMessage: (message) => deliver(toPage, message),
    addEventListener: (_type, listener) => void toWorker.add(listener),
  };
  serveSolo(port, [classicPack, vintagePack]);
  return {
    postMessage: (message) => deliver(toWorker, message),
    addEventListener: (_type, listener) => void toPage.add(listener),
  };
}
const platform = (): SoloPlatform => ({
  storage: new MemorySaveStorage(),
  createWorker: loopbackWorker,
  newSeed: () => 12345,
  now: () => 1_700_000_000_000,
});

beforeEach(() => {
  vi.stubEnv("VITE_SOLO_ONLY", "1");
  window.location.hash = "";
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  delete window.fqWrapper;
});

describe("the solo-only build", () => {
  it("reads the build flag", () => {
    expect(soloOnly()).toBe(true);
    vi.stubEnv("VITE_SOLO_ONLY", "");
    expect(soloOnly()).toBe(false);
  });

  it("opens straight on the solo careers: no choice, no log-on, no online anything", async () => {
    const fetched = vi.fn();
    vi.stubGlobal("fetch", fetched);
    render(<App solo={platform()} soloOnly settings={{ typewriter: "off", layout: "classic" }} />);
    expect(await screen.findByRole("heading", { name: "Your solo careers" })).toBeVisible();
    expect(screen.getByRole("button", { name: "New career" })).toBeVisible();
    for (const name of [
      /Play online/,
      /Log on/,
      /New user/,
      /Play as guest/,
      /Daily Challenge/,
      /Online or solo/,
      /Rankings/,
      /Server address/,
      /original/i,
    ]) {
      expect(screen.queryByRole("button", { name }), String(name)).toBeNull();
      expect(screen.queryByRole("link", { name }), String(name)).toBeNull();
    }
    expect(screen.queryByTestId("conduct-gate")).toBeNull();
    // Nothing asked the network for anything.
    expect(fetched).not.toHaveBeenCalled();
  });

  it("has the rules page without the house rules for other players, and no rankings tab", async () => {
    const user = userEvent.setup();
    render(<App solo={platform()} soloOnly settings={{ typewriter: "off", layout: "classic" }} />);
    await user.click(await screen.findByRole("button", { name: "Rules" }));
    expect(await screen.findByRole("heading", { name: /Rules/ })).toBeVisible();
    expect(screen.queryByText("House rules for online play")).toBeNull();
    const nav = screen.getByRole("navigation", { name: /pages/i });
    expect(within(nav).queryByRole("button", { name: "Rankings" })).toBeNull();
    // The mute control is on this screen too.
    expect(within(nav).getByRole("button", { name: "Mute sound" })).toBeVisible();
  });

  it("offers the Daily Challenge practice, which is offline, in the new-career form", async () => {
    const user = userEvent.setup();
    render(<App solo={platform()} soloOnly settings={{ typewriter: "off", layout: "classic" }} />);
    await user.click(await screen.findByRole("button", { name: "New career" }));
    await user.click(await screen.findByRole("radio", { name: "Expanded" }));
    expect(await screen.findByRole("radio", { name: /Daily practice/ })).toBeInTheDocument();
  });

  it("has no server address in Settings even inside a wrapper that offers one", async () => {
    window.fqWrapper = { server: "", openSettings: vi.fn() };
    render(
      <SettingsProvider>
        <I18nProvider>
          <AudioProvider>
            <ArtProvider>
              <SettingsPanel onClose={() => undefined} />
            </ArtProvider>
          </AudioProvider>
        </I18nProvider>
      </SettingsProvider>,
    );
    expect(screen.queryByRole("button", { name: /Server address/ })).toBeNull();
    vi.stubEnv("VITE_SOLO_ONLY", "");
    // (the entry exists when the flag is off: test/wrapper.test.tsx)
  });
});
