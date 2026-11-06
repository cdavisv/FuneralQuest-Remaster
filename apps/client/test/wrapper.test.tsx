import { classicPack, vintagePack } from "@fq/content";
import {
  MemorySaveStorage,
  type PortLike,
  type SaveSummary,
  serveSolo,
  type WorkerLike,
} from "@fq/solo";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.js";
import { audioFillMessage } from "../src/audio/offlineFill.js";
import { ALL_FIXTURES } from "../src/mock/fixtures.js";
import { readConfig } from "../src/net/config.js";
import { registerServiceWorker } from "../src/pwa.js";
import type { SoloPlatform } from "../src/solo/platform.js";
import { backButton } from "../src/util/back.js";
import {
  canOpenWithWrapper,
  getWrapper,
  inWrapper,
  openWithWrapper,
  saveWithWrapper,
  wrapperServer,
} from "../src/wrapper.js";
import { renderGame, ScriptedTransport } from "./helpers.js";
import { StubBackend } from "./stubBackend.js";
import { xview } from "./xviews.js";

afterEach(() => {
  delete window.fqWrapper;
  delete window.__fqHost;
  delete window.fqHandleBack;
  vi.restoreAllMocks();
});

describe("the server address at run time", () => {
  it("takes the wrapper's address over the build's, and falls back to it when the wrapper has none", () => {
    const env = { VITE_SERVER_URL: "https://build.example.com" };
    expect(readConfig("", env, { server: "https://player.example.com/" }).serverUrl).toBe(
      "https://player.example.com",
    );
    expect(readConfig("", env, { server: "" }).serverUrl).toBe("https://build.example.com");
    expect(readConfig("", env, {}).serverUrl).toBe("https://build.example.com");
    expect(readConfig("", env).serverUrl).toBe("https://build.example.com");
    expect(readConfig("", {}, { server: "  " }).serverUrl).toBe("");
  });

  it("reads window.fqWrapper.server", () => {
    expect(wrapperServer()).toBeUndefined();
    window.fqWrapper = { server: "https://fq.example.com" };
    expect(getWrapper()?.server).toBe("https://fq.example.com");
    expect(wrapperServer()).toBe("https://fq.example.com");
    window.fqWrapper = { server: "" };
    expect(wrapperServer()).toBeUndefined();
  });
});

describe("Settings has a Server address entry only inside a wrapper", () => {
  it("is absent in a browser", async () => {
    const user = userEvent.setup();
    renderGame(new ScriptedTransport(xview("deskQuiet")));
    await user.click(await screen.findByRole("button", { name: "Settings" }));
    await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: /Server address/ })).toBeNull();
  });

  it("is visible with a wrapper, and calls its openSettings", async () => {
    const user = userEvent.setup();
    const openSettings = vi.fn();
    window.fqWrapper = { server: "", openSettings };
    renderGame(new ScriptedTransport(xview("deskQuiet")));
    await user.click(await screen.findByRole("button", { name: "Settings" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /Server address/ }));
    expect(openSettings).toHaveBeenCalledTimes(1);
  });
});

describe("saving and opening through the wrapper", () => {
  it("hands a file to fqWrapper.saveFile, else to the host's, else says no", async () => {
    expect(await saveWithWrapper("a.json", "{}")).toBe(false);
    const viaHost = vi.fn(async () => undefined);
    window.__fqHost = { saveFile: viaHost };
    expect(await saveWithWrapper("a.json", "{}", "application/json")).toBe(true);
    expect(viaHost).toHaveBeenCalledWith("a.json", "{}", "application/json");
    const viaWrapper = vi.fn(async () => undefined);
    window.fqWrapper = { saveFile: viaWrapper };
    expect(await saveWithWrapper("b.json", "[]")).toBe(true);
    expect(viaWrapper).toHaveBeenCalledWith("b.json", "[]", "application/json");
    expect(viaHost).toHaveBeenCalledTimes(1);
    window.fqWrapper = {
      saveFile: async () => {
        throw new Error("disk full");
      },
    };
    await expect(saveWithWrapper("c.json", "")).rejects.toThrow("disk full");
  });

  it("offers a native open dialog only when the wrapper has one", async () => {
    expect(canOpenWithWrapper()).toBe(false);
    expect(await openWithWrapper(".json")).toBeNull();
    window.fqWrapper = { openFile: async () => ({ name: "s.json", text: "{}" }) };
    expect(canOpenWithWrapper()).toBe(true);
    expect(await openWithWrapper(".json")).toEqual({ name: "s.json", text: "{}" });
  });

  it("a wrapper sees no service worker registered by the page", () => {
    const register = vi.fn(() => Promise.resolve({}));
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });
    const listeners: (() => void)[] = [];
    vi.spyOn(window, "addEventListener").mockImplementation(((type: string, l: () => void) => {
      if (type === "load") listeners.push(l);
    }) as never);
    window.fqWrapper = {};
    expect(inWrapper()).toBe(true);
    registerServiceWorker();
    expect(listeners).toHaveLength(0);
    expect(register).not.toHaveBeenCalled();
    delete window.fqWrapper;
    registerServiceWorker();
    for (const l of listeners) l();
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });
});

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

describe("Solo save export and import inside a wrapper", () => {
  beforeEach(() => {
    window.location.hash = "";
    window.sessionStorage.clear();
  });

  function platform(storage = new MemorySaveStorage()): SoloPlatform {
    let tick = 0;
    return {
      storage,
      createWorker: loopbackWorker,
      newSeed: () => 12345,
      now: () => 1_700_000_000_000 + ++tick * 1000,
    };
  }

  it("exports through saveFile and makes no download link; imports through openFile", async () => {
    const user = userEvent.setup();
    const storage = new MemorySaveStorage();
    const saved: { name: string; text: string }[] = [];
    window.fqWrapper = {
      saveFile: async (name, text) => {
        saved.push({ name, text });
        return undefined;
      },
    };
    const link = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const makeUrl = vi.fn(() => "blob:never");
    Object.assign(URL, { createObjectURL: makeUrl, revokeObjectURL: vi.fn() });
    render(
      <App
        backend={new StubBackend()}
        solo={platform(storage)}
        settings={{ typewriter: "off", layout: "classic" }}
      />,
    );
    await user.click(await screen.findByRole("button", { name: /^Play solo/ }));
    await user.click(await screen.findByRole("button", { name: "New career" }));
    await user.type(screen.getByLabelText("What's your name?", { exact: true }), "Wrap Solo");
    await user.type(
      screen.getByLabelText("What is your parlor called?", { exact: true }),
      "Wrap Rest",
    );
    await user.click(screen.getByRole("radio", { name: "Female" }));
    await user.click(screen.getByRole("button", { name: "open the parlor" }));
    await screen.findByText(/has been opened/, {}, { timeout: 5000 });
    await user.click(document.querySelector(".fq-exit") as HTMLElement);
    await user.click(await screen.findByRole("button", { name: "Leave" }));
    const row = await screen.findByText("Wrap Solo", { selector: ".fq-save-name" });
    const item = row.closest(".fq-save") as HTMLElement;
    await user.click(within(item).getByRole("button", { name: "Export" }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]?.name).toMatch(/\.fqsave\.json$/);
    expect(JSON.parse(saved[0]?.text ?? "{}")).toMatchObject({ format: "fq-solo" });
    expect(makeUrl).not.toHaveBeenCalled();
    expect(link).not.toHaveBeenCalled();
    expect(await screen.findByText(/Saved\./)).toBeVisible();

    // Import through the wrapper's own open dialog.
    const [summary] = (await storage.list()) as [SaveSummary];
    const text = JSON.stringify(await storage.read(summary.slot));
    const openFile = vi.fn(async () => ({ name: "career.fqsave.json", text }));
    window.fqWrapper = { openFile };
    await user.click(screen.getByRole("button", { name: "Import a save file" }));
    expect(openFile).toHaveBeenCalled();
    expect(await screen.findByText("Imported. It is in your list.")).toBeVisible();
    expect(await storage.list()).toHaveLength(2);
  });

  it("says so when the wrapper cannot save", async () => {
    const user = userEvent.setup();
    window.fqWrapper = {
      saveFile: async () => {
        throw new Error("no space left");
      },
    };
    const storage = new MemorySaveStorage();
    render(
      <App
        backend={new StubBackend()}
        solo={platform(storage)}
        settings={{ typewriter: "off", layout: "classic" }}
      />,
    );
    await user.click(await screen.findByRole("button", { name: /^Play solo/ }));
    await user.click(await screen.findByRole("button", { name: "New career" }));
    await user.type(screen.getByLabelText("What's your name?", { exact: true }), "Wrap Two");
    await user.type(
      screen.getByLabelText("What is your parlor called?", { exact: true }),
      "Wrap Two Rest",
    );
    await user.click(screen.getByRole("radio", { name: "Female" }));
    await user.click(screen.getByRole("button", { name: "open the parlor" }));
    await screen.findByText(/has been opened/, {}, { timeout: 5000 });
    await user.click(document.querySelector(".fq-exit") as HTMLElement);
    await user.click(await screen.findByRole("button", { name: "Leave" }));
    const row = await screen.findByText("Wrap Two", { selector: ".fq-save-name" });
    await user.click(
      within(row.closest(".fq-save") as HTMLElement).getByRole("button", { name: "Export" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("no space left");
  });
});

describe("window.fqHandleBack for the Android back button", () => {
  it("is defined while a game is on screen and gone after", () => {
    const { unmount } = renderGame(new ScriptedTransport(xview("deskQuiet")));
    expect(typeof window.fqHandleBack).toBe("function");
    unmount();
    expect(window.fqHandleBack).toBeUndefined();
  });

  it("closes the top dialog first, and says it handled that", async () => {
    const user = userEvent.setup();
    renderGame(new ScriptedTransport(xview("bank")));
    await user.click(await screen.findByRole("button", { name: "Settings" }));
    await screen.findByRole("dialog");
    let handled = false;
    act(() => {
      handled = window.fqHandleBack?.() ?? false;
    });
    expect(handled).toBe(true);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("then leaves the screen through the View's own Back or Leave button", async () => {
    const transport = new ScriptedTransport(xview("loans"));
    renderGame(transport);
    await screen.findByRole("heading", { level: 1, name: "Bank" });
    let handled = false;
    act(() => {
      handled = window.fqHandleBack?.() ?? false;
    });
    expect(handled).toBe(true);
    expect(transport.sent).toEqual([{ type: "press", buttonId: "go:bank" }]);
  });

  it("answers false on the desk, so the app can ask about leaving", async () => {
    const transport = new ScriptedTransport(xview("deskQuiet"));
    renderGame(transport);
    await screen.findByRole("heading", { level: 1, name: xview("deskQuiet").title });
    let handled = true;
    act(() => {
      handled = window.fqHandleBack?.() ?? true;
    });
    expect(handled).toBe(false);
    expect(transport.sent).toEqual([]);
  });

  it("finds a way back on the screens that have one and never presses a sale's Done", () => {
    expect(backButton(xview("bank"))?.id).toBe("go:map");
    expect(backButton(xview("loans"))?.id).toBe("go:bank");
    expect(backButton(xview("ordinance"))?.id).toBe("city-hall:main");
    expect(backButton(xview("hand"))?.id).toBe("neg:back");
    expect(backButton(xview("upgrades"))?.id).toBe("go:parlor");
    expect(backButton(xview("negotiation"))).toBeUndefined();
    expect(backButton(xview("desk"))).toBeUndefined();
    // A disabled way back is not one, and an overlay is the dialog's to close.
    const bank = xview("bank");
    const dead = {
      ...bank,
      buttons: bank.buttons.map((b) => (b.id === "go:map" ? { ...b, enabled: false } : b)),
    };
    expect(backButton(dead)).toBeUndefined();
    for (const view of Object.values(ALL_FIXTURES)) {
      const b = backButton(view as never);
      if (b)
        expect((view as { buttons: { id: string }[] }).buttons.map((x) => x.id)).toContain(b.id);
    }
  });
});

describe("filling the audio cache in the background", () => {
  const env = {
    saveData: false,
    wrapper: false,
    base: "/audio",
    origin: "https://fq.example.com",
    online: true,
  };

  it("asks the worker for the format this browser plays", () => {
    expect(audioFillMessage(env, "ogg")).toEqual({ type: "fq-fill-audio", format: "ogg" });
    expect(audioFillMessage(env, "m4a")).toEqual({ type: "fq-fill-audio", format: "m4a" });
  });

  it("does nothing on a data saver, in a wrapper, offline, or for audio hosted elsewhere", () => {
    expect(audioFillMessage({ ...env, saveData: true }, "ogg")).toBeNull();
    expect(audioFillMessage({ ...env, wrapper: true }, "ogg")).toBeNull();
    expect(audioFillMessage({ ...env, online: false }, "ogg")).toBeNull();
    expect(audioFillMessage({ ...env, base: "https://cdn.example/audio" }, "ogg")).toBeNull();
    expect(audioFillMessage({ ...env, base: "//cdn.example/audio" }, "ogg")).toBeNull();
    expect(
      audioFillMessage({ ...env, base: "https://fq.example.com/audio" }, "ogg"),
    ).not.toBeNull();
  });
});
