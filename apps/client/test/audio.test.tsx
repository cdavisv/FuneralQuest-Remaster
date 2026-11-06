import type { View } from "@fq/protocol";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArtProvider } from "../src/art/ArtContext.js";
import { AudioProvider, defaultAudioManager } from "../src/audio/AudioContext.js";
import { type AudioBackend, createAudioManager, FADE } from "../src/audio/AudioManager.js";
import { AudioLibrary } from "../src/audio/library.js";
import { SoundToggle } from "../src/audio/SoundToggle.js";
import { SettingsPanel } from "../src/components/SettingsPanel.js";
import { I18nProvider } from "../src/i18n/I18nContext.js";
import { loadSettings, SettingsProvider } from "../src/settings/settings.js";
import { viewWith } from "./helpers.js";

/** A backend that records what it was told. */
function fakeBackend() {
  const calls: [string, ...unknown[]][] = [];
  const rec =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([name, ...args]);
    };
  const b: AudioBackend = {
    setMusic: rec("setMusic"),
    setLayers: rec("setLayers"),
    setAmbience: rec("setAmbience"),
    playSound: rec("playSound"),
    setGains: rec("setGains"),
    setRadio: rec("setRadio"),
    setActive: rec("setActive"),
    dispose: rec("dispose"),
  };
  const of = (name: string) => calls.filter((c) => c[0] === name).map((c) => c.slice(1));
  return { b, calls, of, clear: () => calls.splice(0) };
}

const desk = viewWith({ scene: "desk", picture: { bg: "places/desk" } });
const map = viewWith({ scene: "map", map: [{ id: "bank", label: "Bank" }] });
const battle = viewWith({
  scene: "location",
  battle: { me: { name: "You", hp: 10, hpMax: 10 }, them: { name: "Rival", hp: 10, hpMax: 10 } },
});
const customer = (mood: number): View =>
  viewWith({
    scene: "location",
    customer: { incomeLabel: "Average", moodLabel: "Calm", moodLevel: mood, total: 0 },
  });

describe("audio manager", () => {
  it("makes no sound before the first interaction, then catches up", () => {
    const f = fakeBackend();
    const factory = vi.fn(() => f.b);
    const audio = createAudioManager({ backend: factory });
    audio.cue(desk.music, desk.sounds, desk);
    audio.cue(undefined, undefined, viewWith({ scene: "desk", picture: { fg: "stuff/toilet" } }));
    expect(factory).not.toHaveBeenCalled();
    expect(audio.currentMusic).toBe("desk");
    audio.unlock();
    expect(factory).toHaveBeenCalledTimes(1);
    // the wanted state is applied at once; the flush that happened before is not replayed
    expect(f.of("setMusic")).toEqual([["desk", 0.5, undefined]]);
    expect(f.of("setAmbience")).toEqual([["amb-clock", FADE.ambience]]);
    expect(f.of("playSound")).toEqual([]);
    expect(f.of("setActive")).toEqual([[true]]);
    audio.unlock();
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("crossfades between scenes, quickly into a fight", () => {
    const f = fakeBackend();
    const audio = createAudioManager({ backend: f.b, unlocked: true });
    audio.cue(undefined, undefined, desk);
    audio.cue(undefined, undefined, desk);
    audio.cue(undefined, undefined, map);
    audio.cue("music/music_fight", undefined, battle);
    audio.cue(undefined, undefined, map);
    expect(f.of("setMusic").map((c) => [c[0], c[1]])).toEqual([
      ["desk", FADE.scene],
      ["town", FADE.scene],
      ["battle", FADE.battle],
      ["town", FADE.battle],
    ]);
  });

  it("follows the customer's mood with the negotiation's layers", () => {
    const f = fakeBackend();
    const audio = createAudioManager({ backend: f.b, unlocked: true });
    audio.cue(undefined, undefined, customer(1));
    expect(f.of("setMusic")).toEqual([["negotiation", FADE.scene, [1, 0, 0]]]);
    audio.cue(undefined, undefined, customer(4));
    audio.cue(undefined, undefined, customer(9));
    expect(f.of("setMusic")).toHaveLength(1);
    expect(f.of("setLayers")).toEqual([
      [[1, 1, 0], FADE.layers],
      [[1, 1, 1], FADE.layers],
    ]);
  });

  it("applies sliders and mute, and stays quiet while muted or hidden", () => {
    const f = fakeBackend();
    const audio = createAudioManager({ backend: f.b, unlocked: true });
    f.clear();
    audio.setVolumes({ master: 0.5, music: 0.4, ambience: 0.3, effects: 0.2 });
    expect(f.of("setGains").at(-1)).toEqual([
      { master: 0.5, music: 0.4, ambience: 0.3, effects: 0.2 },
    ]);
    audio.setMuted(true);
    expect(f.of("setGains").at(-1)).toEqual([
      { master: 0, music: 0.4, ambience: 0.3, effects: 0.2 },
    ]);
    expect(f.of("setActive").at(-1)).toEqual([false]);
    audio.ui("ui-click");
    audio.setMuted(false);
    expect(f.of("setGains").at(-1)?.[0]).toMatchObject({ master: 0.5 });
    audio.setHidden(true);
    expect(f.of("setActive").at(-1)).toEqual([false]);
    audio.ui("ui-click");
    expect(f.of("playSound")).toEqual([]);
    audio.setHidden(false);
    audio.ui("ui-click");
    expect(f.of("playSound")).toEqual([["ui-click", "ui"]]);
    audio.setRadio(true);
    expect(f.of("setRadio")).toEqual([[true]]);
  });

  it("plays what a View implies: pictures, sales, a new day, stingers", () => {
    const f = fakeBackend();
    const audio = createAudioManager({ backend: f.b, unlocked: true });
    audio.cue(undefined, undefined, viewWith({ scene: "desk", town: { day: 3 } }));
    audio.cue(
      undefined,
      ["cash"],
      viewWith({ scene: "desk", town: { day: 4 }, picture: { fg: "stuff/toilet" } }),
    );
    audio.cue(undefined, undefined, customer(9));
    audio.cue(undefined, undefined, desk);
    expect(f.of("playSound").map((c) => c[0])).toEqual([
      "cash-register",
      "toilet-flush",
      "newday",
      "walkout",
    ]);
    expect(f.of("playSound").find((c) => c[0] === "newday")?.[1]).toBe("stinger");
  });

  it("plays the player's own actions and sets the place's music on a visit", () => {
    const f = fakeBackend();
    const audio = createAudioManager({ backend: f.b, unlocked: true });
    audio.action({ type: "visit", placeId: "bank" });
    audio.action({ type: "press", buttonId: "reaper-club:slots:100" });
    audio.action({ type: "press", buttonId: "solo:end-day" });
    expect(f.of("setMusic").map((c) => c[0])).toEqual(["bank"]);
    expect(f.of("playSound")).toEqual([
      ["slot-machine", "sfx"],
      ["endday", "stinger"],
    ]);
  });

  it("keeps working when a backend cannot load anything", () => {
    const audio = createAudioManager({ backend: () => null });
    audio.unlock();
    audio.cue(undefined, ["cash"], desk);
    audio.ui("ui-click");
    expect(audio.state.unlocked).toBe(true);
    expect(audio.currentMusic).toBe("desk");
  });

  it("is silent under test: no AudioContext, no debug probe", () => {
    const audio = defaultAudioManager();
    audio.unlock();
    audio.cue(undefined, undefined, desk);
    expect(window.__fqAudio).toBeUndefined();
  });
});

describe("audio library", () => {
  const manifest = {
    generator: "test",
    license: "test",
    sampleRate: 48000,
    totalBytes: 0,
    live: [],
    tracks: {
      desk: {
        kind: "music",
        title: "Office Hours",
        loop: true,
        channels: 2,
        duration: 2,
        files: [{ ogg: "music/desk.ogg", m4a: "music/desk.m4a", bytes: 1 }],
        loopStart: 0.25,
        loopEnd: 1.25,
        lufs: -16,
        peakDb: -3,
      },
      gone: {
        kind: "sfx",
        title: "Gone",
        loop: false,
        channels: 1,
        duration: 1,
        files: [{ ogg: "sfx/gone.ogg", m4a: "sfx/gone.m4a", bytes: 1 }],
        lufs: -16,
        peakDb: -3,
      },
    },
  };
  const fakeBuffer = (seconds: number) => {
    const ch = new Float32Array(Math.round(seconds * 100));
    return {
      sampleRate: 100,
      numberOfChannels: 1,
      duration: seconds,
      getChannelData: () => ch,
    } as unknown as AudioBuffer;
  };

  function library(files: Record<string, string | ArrayBuffer>, format: "ogg" | "m4a" = "ogg") {
    const fetched: string[] = [];
    const warn = vi.fn();
    const lib = new AudioLibrary({
      base: "/audio",
      format,
      fetchBytes: async (url) => {
        fetched.push(url);
        const f = files[url];
        if (f === undefined) throw new Error("404");
        return typeof f === "string" ? new TextEncoder().encode(f).buffer : f;
      },
      decode: async (bytes) => {
        if (bytes.byteLength === 0) throw new Error("cannot decode");
        return fakeBuffer(2);
      },
      warn,
    });
    return { lib, fetched, warn };
  }

  it("loads, repairs and caches a track", async () => {
    const { lib, fetched } = library({
      "/audio/manifest.json": JSON.stringify(manifest),
      "/audio/music/desk.ogg": new ArrayBuffer(8),
    });
    const a = await lib.buffers("desk");
    const b = await lib.buffers("desk");
    expect(a).toHaveLength(1);
    expect(b).toBe(a);
    expect(fetched.filter((u) => u.endsWith("desk.ogg"))).toHaveLength(1);
  });

  it("falls back to AAC when the browser cannot decode Opus", async () => {
    const { lib, fetched } = library({
      "/audio/manifest.json": JSON.stringify(manifest),
      "/audio/music/desk.ogg": new ArrayBuffer(0),
      "/audio/music/desk.m4a": new ArrayBuffer(8),
    });
    expect(await lib.buffers("desk")).toHaveLength(1);
    expect(fetched).toContain("/audio/music/desk.m4a");
  });

  it("treats a missing file, an unknown id and a missing manifest as silence, once", async () => {
    const { lib, warn, fetched } = library({ "/audio/manifest.json": JSON.stringify(manifest) });
    expect(await lib.buffers("gone")).toBeNull();
    expect(await lib.buffers("gone")).toBeNull();
    expect(fetched.filter((u) => u.includes("gone"))).toHaveLength(2); // ogg, then the m4a fallback
    expect(await lib.buffers("nothing")).toBeNull();
    expect([...lib.missing]).toEqual(["gone", "nothing"]);
    expect(warn).toHaveBeenCalledTimes(2);
    const none = library({});
    expect(await none.lib.buffers("desk")).toBeNull();
    expect(none.warn).toHaveBeenCalledTimes(1);
  });
});

describe("sound settings", () => {
  function setup() {
    const audio = createAudioManager();
    const spy = vi.spyOn(audio, "setVolumes");
    render(
      <SettingsProvider>
        <I18nProvider>
          <AudioProvider manager={audio}>
            <ArtProvider>
              <SoundToggle />
              <SettingsPanel onClose={() => {}} />
            </ArtProvider>
          </AudioProvider>
        </I18nProvider>
      </SettingsProvider>,
    );
    return { audio, spy };
  }

  it("sliders reach the manager and persist", () => {
    const { audio, spy } = setup();
    fireEvent.change(screen.getByLabelText("Ambience volume"), { target: { value: "25" } });
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ ambience: 0.25 }));
    expect(audio.state.volumes.ambience).toBe(0.25);
    expect(loadSettings(window.localStorage).volume.ambience).toBe(0.25);
    fireEvent.click(screen.getByLabelText("2001 radio (the old 11 kHz mono sound)"));
    expect(audio.state.radio).toBe(true);
    expect(loadSettings(window.localStorage).radio).toBe(true);
  });

  it("the note under the sound packs describes the pack selected", () => {
    setup();
    const note = screen.getByTestId("sound-pack-note");
    expect(note).toHaveTextContent("Synth pack");
    expect(note).toHaveTextContent("synthesised from the game's own source code");
    fireEvent.click(screen.getByLabelText("Studio"));
    expect(loadSettings(window.localStorage).soundPack).toBe("studio");
    expect(note).toHaveTextContent("Studio pack");
    expect(note).toHaveTextContent("ElevenLabs");
    expect(note).not.toHaveTextContent("synthesised from the game's own source code");
  });

  it("the sound button unlocks first, then mutes and unmutes", () => {
    const { audio } = setup();
    const button = screen.getByRole("button", { name: /Sound on/ });
    // a first gesture elsewhere would unlock; on this button it must not mute instead
    fireEvent.pointerDown(button);
    expect(audio.state.unlocked).toBe(false);
    act(() => button.click());
    expect(audio.state.unlocked).toBe(true);
    expect(audio.state.muted).toBe(false);
    act(() => screen.getByRole("button", { name: /Sound off/ }).click());
    expect(audio.state.muted).toBe(true);
    expect(loadSettings(window.localStorage).muted).toBe(true);
    expect(screen.getByLabelText("Mute all sound")).toBeChecked();
  });

  it("unlocks on the first interaction anywhere", () => {
    const { audio } = setup();
    fireEvent.pointerDown(document.body);
    expect(audio.state.unlocked).toBe(true);
  });
});

describe("cues from the View's data (no text read)", () => {
  const played = (f: ReturnType<typeof fakeBackend>) => f.of("playSound").map((a) => a[0]);

  it("a Reaper Club round is heard by its outcome, once, however its words read", async () => {
    const { xview } = await import("./xviews.js");
    const f = fakeBackend();
    const audio = createAudioManager({ backend: f.b, unlocked: true });
    const before = xview("clubGames");
    audio.cue(undefined, undefined, before);
    f.clear();
    const win = { ...xview("roundSlotsWin"), text: [{ text: "You lose everything." }] };
    audio.cue(undefined, undefined, win);
    expect(played(f)).toContain("coins");
    f.clear();
    audio.cue(undefined, undefined, win);
    expect(played(f)).not.toContain("coins");
    f.clear();
    audio.cue(undefined, undefined, xview("roundSlotsLose"));
    expect(played(f)).toContain("fail-trombone");
  });

  it("an upgrade bought, a loan taken and a card bought each make their sound", async () => {
    const { xview } = await import("./xviews.js");
    const f = fakeBackend();
    const audio = createAudioManager({ backend: f.b, unlocked: true });
    audio.cue(undefined, undefined, xview("upgrades"));
    f.clear();
    // Fresh Paint is a building upgrade: the level goes up with it.
    audio.cue(undefined, undefined, xview("upgradesAfterPaint"));
    expect(played(f)).toContain("level-up");
    f.clear();
    // Any other upgrade is a purchase: owned goes up, the level does not.
    const after = xview("upgradesAfterPaint");
    const office = after.office as NonNullable<typeof after.office>;
    audio.cue(undefined, undefined, {
      ...after,
      office: {
        ...office,
        upgrades: office.upgrades.map((u) =>
          u.id === "coffee-machine" ? { ...u, state: "owned" as const } : u,
        ),
      },
    });
    expect(played(f)).toContain("ui-coin");
    f.clear();
    audio.cue(undefined, undefined, xview("loans"));
    f.clear();
    audio.cue(undefined, undefined, xview("borrowed"));
    expect(played(f)).toContain("coins");
    f.clear();
    audio.cue(undefined, undefined, xview("bingo"));
    f.clear();
    audio.cue(undefined, undefined, xview("bingoBought"));
    expect(played(f)).toContain("bingo-ball");
  });

  it("injuries and karma bands are heard when they change", async () => {
    const { xview } = await import("./xviews.js");
    const f = fakeBackend();
    const audio = createAudioManager({ backend: f.b, unlocked: true });
    audio.cue(undefined, undefined, xview("duel"));
    f.clear();
    audio.cue(undefined, undefined, xview("duelOver"));
    expect(played(f)).toContain("slap");
    f.clear();
    audio.cue(undefined, undefined, xview("hospitalTreated"));
    expect(played(f)).toContain("harp-good-news");
    f.clear();
    const up = xview("deskQuiet");
    audio.cue(undefined, undefined, up);
    f.clear();
    const hud = up.hud as NonNullable<View["hud"]>;
    audio.cue(undefined, undefined, {
      ...up,
      hud: {
        ...hud,
        karmaPath: { id: "church-associate", name: "Church Associate", min: 85, max: 100 },
      },
    });
    expect(played(f)).toContain("angelic");
    f.clear();
    audio.cue(undefined, undefined, {
      ...up,
      hud: { ...hud, karmaPath: { id: "necromancer", name: "Necromancer", min: 1, max: 15 } },
    });
    expect(played(f)).toContain("growl");
  });
});
