import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAudioManager } from "../src/audio/AudioManager.js";
import { formatMessage } from "../src/i18n/format.js";
import { en } from "../src/i18n/messages.js";
import { FIXTURES, OVERLAY_FIXTURES } from "../src/mock/fixtures.js";
import { MockTransport } from "../src/mock/MockTransport.js";
import { defaultSettings, loadSettings } from "../src/settings/settings.js";
import { moodTier } from "../src/util/mood.js";
import { layoutForViewport } from "../src/util/useLayout.js";
import { renderGame, ScriptedTransport, viewWith } from "./helpers.js";

describe("message formatting", () => {
  it("substitutes parameters and keeps unknown ones visible", () => {
    expect(formatMessage("Hi {name}, {n} left", { name: "Bo", n: 3 })).toBe("Hi Bo, 3 left");
    expect(formatMessage("Hi {missing}")).toBe("Hi {missing}");
  });

  it("handles plurals", () => {
    const m = en["overlay.charsLeft"];
    expect(formatMessage(m, { count: 1 })).toBe("1 character left");
    expect(formatMessage(m, { count: 0 })).toBe("0 characters left");
    expect(formatMessage(m, { count: 24 })).toBe("24 characters left");
  });

  it("has no empty client strings", () => {
    for (const [key, value] of Object.entries(en)) expect(value.length, key).toBeGreaterThan(0);
  });
});

describe("layout choice", () => {
  it.each([
    [1024, 768, "classic"],
    [1280, 960, "classic"],
    [1280, 800, "wide"],
    [1920, 1080, "wide"],
    [1366, 768, "wide"],
    [390, 844, "phone"],
    [600, 900, "phone"],
    [844, 390, "phone"],
    [900, 900, "classic"],
    [800, 900, "phone"],
  ] as const)("%ix%i is %s", (w, h, expected) => {
    expect(layoutForViewport(w, h)).toBe(expected);
  });
});

describe("settings storage", () => {
  it("survives garbage in storage", () => {
    const bad = { getItem: () => "{not json" };
    expect(loadSettings(bad)).toEqual(defaultSettings());
    const weird = {
      getItem: () => JSON.stringify({ fontSize: "huge", volume: { master: 7, music: "x" } }),
    };
    const s = loadSettings(weird);
    expect(s.fontSize).toBe("normal");
    expect(s.volume.master).toBe(1);
    expect(s.volume.music).toBe(defaultSettings().volume.music);
  });
});

describe("mood faces", () => {
  it("groups the Classic words and falls back to neutral", () => {
    expect(moodTier("Chipper")).toBe(0);
    expect(moodTier("Annoyed")).toBe(2);
    expect(moodTier("PISSED")).toBe(3);
    expect(moodTier("Something Future")).toBe(1);
  });
});

describe("audio", () => {
  // The manager itself is tested in audio.test.tsx with a fake backend.
  it("hands the cues of each View to the manager", async () => {
    const audio = createAudioManager();
    const spy = vi.spyOn(audio, "cue");
    renderGame(new ScriptedTransport(OVERLAY_FIXTURES.message), { audio });
    await screen.findByRole("dialog");
    expect(spy).toHaveBeenCalledWith(
      FIXTURES.desk.music,
      ["cash"],
      expect.objectContaining({ scene: "desk" }),
    );
  });

  it("works with no backend at all", () => {
    const audio = createAudioManager();
    audio.cue("town", ["cash"]);
    expect(audio.currentMusic).toBe("town");
  });
});

describe("typewriter", () => {
  beforeEach(() =>
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] }),
  );
  afterEach(() => vi.useRealTimers());

  const story = viewWith({ scene: "location", text: [{ text: "x".repeat(200) }] });

  it("reveals text over time and a click shows everything", async () => {
    renderGame(new ScriptedTransport(story), { settings: { typewriter: "normal" } });
    await act(async () => {
      await Promise.resolve();
    });
    const visible = () =>
      document.querySelector(".fq-text [aria-hidden]")?.textContent?.length ?? -1;
    expect(visible()).toBeLessThan(200);
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    const part = visible();
    expect(part).toBeGreaterThan(0);
    expect(part).toBeLessThan(200);
    // A screen reader gets the whole text straight away.
    expect(document.querySelector(".fq-text .fq-sr")?.textContent).toHaveLength(200);
    await act(async () => {
      document.querySelector<HTMLElement>(".fq-textscroll")?.click();
    });
    expect(visible()).toBe(200);
  });

  it("Enter skips the reveal", async () => {
    renderGame(new ScriptedTransport(story), { settings: { typewriter: "normal" } });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(document.querySelector(".fq-text [aria-hidden]")?.textContent).toHaveLength(200);
  });

  it("shows everything at once when set to instant", async () => {
    renderGame(new ScriptedTransport(story), { settings: { typewriter: "off" } });
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.querySelector(".fq-text")?.textContent).toHaveLength(200);
    expect(document.querySelector(".fq-text [aria-hidden]")).toBeNull();
  });
});

describe("mock transport", () => {
  const mock = () => new MockTransport({ latencyMs: 0, pushIntervalMs: 0 });

  it("walks a plausible session from lobby to a finished sale", async () => {
    const t = mock();
    let v = await t.connect();
    expect(v.scene).toBe("lobby");
    v = await t.send({ type: "press", buttonId: "guest" });
    expect(v.scene).toBe("news");
    v = await t.send({ type: "press", buttonId: "continue" });
    expect(v.scene).toBe("desk");
    v = await t.send({ type: "press", buttonId: "wait" });
    v = await t.send({ type: "press", buttonId: "meet" });
    expect(v.customer).toBeDefined();
    expect(v.buttons.map((b) => b.id)).toEqual([
      "guilt",
      "sympathy",
      "hardsell",
      "softsell",
      "done",
    ]);
    v = await t.send({ type: "press", buttonId: "done" });
    expect(v.overlay?.kind).toBe("message");
  });

  it("rejects actions the last view did not offer", async () => {
    const t = mock();
    await t.connect();
    await expect(t.send({ type: "press", buttonId: "nope" })).rejects.toThrow();
    await expect(t.send({ type: "visit", placeId: "store" })).rejects.toThrow();
    await expect(t.send({ type: "confirm", overlayId: "x", accepted: true })).rejects.toThrow();
  });

  it("echoes chat and pushes rival lines", async () => {
    vi.useFakeTimers();
    const t = new MockTransport({ latencyMs: 0, pushIntervalMs: 1000 });
    const pushed: number[] = [];
    t.onPush((v) => pushed.push(v.chat?.length ?? 0));
    await t.connect();
    await t.send({ type: "press", buttonId: "guest" });
    await t.send({ type: "press", buttonId: "continue" });
    await t.send({ type: "press", buttonId: "cafe" });
    const v = await t.send({ type: "chat", text: "hello" });
    expect(
      v.chat
        ?.at(-1)
        ?.text.map((s) => s.text)
        .join(""),
    ).toBe("You: hello");
    vi.advanceTimersByTime(2100);
    expect(pushed.length).toBe(2);
    t.close();
    vi.advanceTimersByTime(5000);
    expect(pushed.length).toBe(2);
    vi.useRealTimers();
  });

  it("can be driven end to end through the UI", async () => {
    renderGame(mock());
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Play As Guest/ }));
    await user.click(await screen.findByRole("button", { name: /Continue/ }));
    await user.click(await screen.findByRole("button", { name: /Visit Town/ }));
    await user.click(await screen.findByRole("button", { name: "Go to Di-Mart" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Di-Mart" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Buy Casket Tag/ }));
    await user.click(await screen.findByRole("button", { name: "Yes" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Thank you for shopping");
    render(<div />);
  });
});
