import type { View } from "@fq/protocol";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ArtProvider } from "../src/art/ArtContext.js";
import { AudioProvider, defaultAudioManager, SoundContext } from "../src/audio/AudioContext.js";
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
    setPack: rec("setPack"),
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

describe("sound pack by ruleset", () => {
  const classic = { ruleset: "classic", mode: "town" } as const;
  const expanded = { ruleset: "expanded", mode: "town" } as const;

  it("starts on Automatic at the front door, which plays the remaster", () => {
    const audio = createAudioManager();
    expect(audio.state.packSetting).toBe("auto");
    expect(audio.state.pack).toBe("remaster");
    expect(audio.state.context).toEqual({ ruleset: "classic", mode: "door" });
  });

  it("tells the backend its pack at unlock, and again when the ruleset changes", () => {
    const f = fakeBackend();
    const audio = createAudioManager({ backend: () => f.b });
    audio.setContext(expanded);
    audio.unlock();
    expect(f.of("setPack")).toEqual([["studio"]]);
    audio.setContext(classic);
    audio.setContext(classic);
    audio.setContext({ ruleset: "classic", mode: "solo" });
    audio.setContext({ ruleset: "expanded", mode: "solo" });
    audio.setContext({ ruleset: "expanded", mode: "daily" });
    audio.setContext({ ruleset: "classic", mode: "door" });
    // only changes of pack reach the backend: studio, remaster, studio (daily too), remaster
    expect(f.of("setPack")).toEqual([["studio"], ["remaster"], ["studio"], ["remaster"]]);
    expect(audio.state.pack).toBe("remaster");
  });

  it("keeps the music playing and moves it to the new pack's track for the same cue", () => {
    const f = fakeBackend();
    const audio = createAudioManager({ backend: () => f.b, unlocked: true });
    audio.setContext(classic);
    audio.cue(desk.music, desk.sounds, desk);
    f.clear();
    audio.setContext(expanded);
    // the backend is told the new pack and reloads the current cue from it; the cue is unchanged
    expect(f.of("setPack")).toEqual([["studio"]]);
    expect(f.of("setMusic")).toEqual([]);
    expect(audio.currentMusic).toBe("desk");
  });

  it("an explicit choice overrides the ruleset everywhere, and Automatic can be picked again", () => {
    const f = fakeBackend();
    const audio = createAudioManager({ backend: () => f.b, unlocked: true });
    audio.setContext(classic);
    audio.setPack("synth");
    expect(audio.state.pack).toBe("synth");
    audio.setContext(expanded);
    audio.setContext({ ruleset: "expanded", mode: "daily" });
    expect(audio.state.pack).toBe("synth");
    audio.setPack("studio");
    audio.setContext(classic);
    expect(audio.state.pack).toBe("studio");
    audio.setPack("remaster");
    audio.setContext(expanded);
    expect(audio.state.pack).toBe("remaster");
    audio.setPack("auto");
    expect(audio.state.pack).toBe("studio");
    audio.setContext(classic);
    expect(audio.state.pack).toBe("remaster");
  });

  it("follows the game on screen and goes back to the front door's pack when it leaves", () => {
    const audio = createAudioManager();
    const wrap = (children: ReactNode) => (
      <SettingsProvider>
        <AudioProvider manager={audio}>{children}</AudioProvider>
      </SettingsProvider>
    );
    const view = render(wrap(<SoundContext mode="town" ruleset="expanded" />));
    expect(audio.state.pack).toBe("studio");
    expect(audio.state.context).toEqual(expanded);
    // a ruleset the lobby briefly forgot keeps the last one known
    view.rerender(wrap(<SoundContext mode="town" />));
    expect(audio.state.pack).toBe("studio");
    // a Classic town (and Solo's "original" ruleset, which is Classic with its fixes off)
    view.rerender(wrap(<SoundContext mode="solo" ruleset="original" />));
    expect(audio.state.context).toEqual({ ruleset: "classic", mode: "solo" });
    expect(audio.state.pack).toBe("remaster");
    view.rerender(wrap(<SoundContext mode="solo" ruleset="expanded" />));
    expect(audio.state.pack).toBe("studio");
    view.rerender(wrap(<div />));
    expect(audio.state.context).toEqual({ ruleset: "classic", mode: "door" });
    expect(audio.state.pack).toBe("remaster");
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

  it("plays each track from the first pack that has it: remaster, then Studio, then Synth", async () => {
    const only = (...ids: string[]) =>
      JSON.stringify({
        ...manifest,
        tracks: Object.fromEntries(
          ids.map((id) => [
            id,
            {
              ...manifest.tracks.desk,
              loop: false,
              files: [{ ogg: `music/${id}.ogg`, m4a: `music/${id}.m4a`, bytes: 1 }],
            },
          ]),
        ),
      });
    const files = {
      "/audio/manifest.json": only("desk", "bank", "synth-only"),
      "/audio-studio/manifest.json": only("desk", "bank"),
      "/audio-remaster/manifest.json": only("desk"),
      "/audio/music/desk.ogg": new ArrayBuffer(8),
      "/audio/music/bank.ogg": new ArrayBuffer(8),
      "/audio/music/synth-only.ogg": new ArrayBuffer(8),
      "/audio-studio/music/desk.ogg": new ArrayBuffer(8),
      "/audio-studio/music/bank.ogg": new ArrayBuffer(8),
      "/audio-remaster/music/desk.ogg": new ArrayBuffer(8),
    };
    const fetched: string[] = [];
    const lib = new AudioLibrary({
      base: "/audio",
      bases: { studio: "/audio-studio", remaster: "/audio-remaster" },
      format: "ogg",
      fetchBytes: async (url) => {
        fetched.push(url);
        const f = (files as Record<string, string | ArrayBuffer>)[url];
        if (f === undefined) throw new Error("404");
        return typeof f === "string" ? new TextEncoder().encode(f).buffer : f;
      },
      decode: async () => fakeBuffer(2),
      warn: vi.fn(),
    });
    lib.setPack("remaster");
    for (const id of ["desk", "bank", "synth-only"]) await lib.buffers(id);
    expect(Object.fromEntries(lib.sources)).toEqual({
      desk: "remaster",
      bank: "studio",
      "synth-only": "synth",
    });
    expect(fetched).toContain("/audio-remaster/music/desk.ogg");
    expect(fetched).toContain("/audio-studio/music/bank.ogg");
    expect(fetched).toContain("/audio/music/synth-only.ogg");
    // Synth picked: nothing above it is touched
    fetched.length = 0;
    lib.setPack("synth");
    await lib.buffers("desk");
    expect(lib.sources.get("desk")).toBe("synth");
    expect(fetched.filter((u) => u.includes("remaster") || u.includes("studio"))).toEqual([]);
    // a build without the Studio pack: the remaster's gaps play from Synth
    const bare = new AudioLibrary({
      base: "/audio",
      bases: { studio: "/audio-studio", remaster: "/audio-remaster" },
      format: "ogg",
      fetchBytes: async (url) => {
        if (url.includes("audio-studio")) throw new Error("404");
        const f = (files as Record<string, string | ArrayBuffer>)[url];
        if (f === undefined) throw new Error("404");
        return typeof f === "string" ? new TextEncoder().encode(f).buffer : f;
      },
      decode: async () => fakeBuffer(2),
      warn: vi.fn(),
    });
    bare.setPack("remaster");
    await bare.buffers("bank");
    expect(bare.sources.get("bank")).toBe("synth");

    // a file that cannot be had (offline, Studio not cached) falls back too, with the metadata of
    // the pack that plays
    const offline = new AudioLibrary({
      base: "/audio",
      bases: { studio: "/audio-studio", remaster: "/audio-remaster" },
      format: "ogg",
      fetchBytes: async (url) => {
        if (url.includes("audio-studio/music")) throw new Error("offline");
        const f = (files as Record<string, string | ArrayBuffer>)[url];
        if (f === undefined) throw new Error("404");
        return typeof f === "string" ? new TextEncoder().encode(f).buffer : f;
      },
      decode: async () => fakeBuffer(2),
      warn: vi.fn(),
    });
    offline.setPack("studio");
    expect(await offline.buffers("bank")).toHaveLength(1);
    expect(offline.sources.get("bank")).toBe("synth");
    expect((await offline.track("bank"))?.files[0]?.ogg).toBe("music/bank.ogg");
    expect([...offline.missing]).toEqual([]);
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
    // the default is Automatic, which says what is playing now and why
    expect(screen.getByLabelText("Automatic (recommended)")).toBeChecked();
    expect(note).toHaveTextContent("Automatic");
    expect(note).toHaveTextContent("Right now you are hearing Original, remastered");
    expect(note).toHaveTextContent("front door");
    fireEvent.click(screen.getByLabelText("Synth"));
    expect(loadSettings(window.localStorage).soundPack).toBe("synth");
    expect(note).toHaveTextContent("Synth pack");
    expect(note).toHaveTextContent("synthesised from the game's own source code");
    fireEvent.click(screen.getByLabelText("Studio"));
    expect(loadSettings(window.localStorage).soundPack).toBe("studio");
    expect(note).toHaveTextContent("Studio pack");
    expect(note).toHaveTextContent("ElevenLabs");
    expect(note).not.toHaveTextContent("synthesised from the game's own source code");
    fireEvent.click(screen.getByLabelText("Original, remastered"));
    expect(note).toHaveTextContent("Original, remastered pack");
    expect(note).toHaveTextContent("not the 2001 recordings");
  });

  it("the Automatic note names the pack and the reason for the game being played", () => {
    const { audio } = setup();
    const note = screen.getByTestId("sound-pack-note");
    act(() => audio.setContext({ ruleset: "classic", mode: "solo" }));
    expect(note).toHaveTextContent(
      "hearing Original, remastered, because you are in a Classic Solo career",
    );
    act(() => audio.setContext({ ruleset: "expanded", mode: "town" }));
    expect(note).toHaveTextContent("hearing Studio, because you are in an Expanded-ruleset town");
    act(() => audio.setContext({ ruleset: "expanded", mode: "daily" }));
    expect(note).toHaveTextContent("hearing Studio, because you are playing the Daily Challenge");
    // an explicit pick wins, and the note stops talking about Automatic
    fireEvent.click(screen.getByLabelText("Synth"));
    expect(audio.state.pack).toBe("synth");
    expect(note).not.toHaveTextContent("Right now");
  });

  it("sound is on by default, and says plainly that no pack is the original audio", () => {
    setup();
    expect(loadSettings(undefined).muted).toBe(false);
    expect(screen.getByRole("button", { name: "Mute sound" })).toBeVisible();
    expect(screen.getByLabelText("Mute all sound")).not.toBeChecked();
    expect(screen.getByText(/None of the three is the 2001 game's own audio/)).toBeVisible();
    expect(screen.getByText(/play only in museum mode, inside the original client/)).toBeVisible();
    expect(screen.getByTestId("sound-pack-note")).toHaveTextContent(
      "These are not the original game's sounds",
    );
  });

  it("a player with no saved choice gets Automatic; a saved choice is kept", () => {
    expect(loadSettings(undefined).soundPack).toBe("auto");
    window.localStorage.setItem("fq.settings.v1", JSON.stringify({ muted: true }));
    expect(loadSettings(window.localStorage).soundPack).toBe("auto");
    for (const choice of ["synth", "studio", "remaster", "auto"] as const) {
      window.localStorage.setItem(
        "fq.settings.v1",
        JSON.stringify({ soundPack: choice, soundPackChosen: true }),
      );
      expect(loadSettings(window.localStorage).soundPack).toBe(choice);
    }
    // A "synth" saved before the Automatic choice existed was never a choice: it becomes Automatic.
    window.localStorage.setItem("fq.settings.v1", JSON.stringify({ soundPack: "synth" }));
    expect(loadSettings(window.localStorage).soundPack).toBe("auto");
    window.localStorage.setItem("fq.settings.v1", JSON.stringify({ soundPack: "studio" }));
    expect(loadSettings(window.localStorage).soundPack).toBe("studio");
    window.localStorage.setItem("fq.settings.v1", JSON.stringify({ soundPack: "vinyl" }));
    expect(loadSettings(window.localStorage).soundPack).toBe("auto");
    window.localStorage.setItem("fq.settings.v1", JSON.stringify({ soundPack: "studio" }));
    const { audio } = setup();
    expect(audio.state.packSetting).toBe("studio");
    expect(screen.getByLabelText("Studio")).toBeChecked();
  });

  it("the mute button mutes and unmutes, and a saved mute is kept", () => {
    const { audio } = setup();
    act(() => screen.getByRole("button", { name: "Mute sound" }).click());
    expect(audio.state.muted).toBe(true);
    expect(loadSettings(window.localStorage).muted).toBe(true);
    expect(screen.getByLabelText("Mute all sound")).toBeChecked();
    // Pressing mute did not start the audio: nothing was ever going to be heard.
    expect(audio.state.unlocked).toBe(false);
    act(() => screen.getByRole("button", { name: "Unmute sound" }).click());
    expect(audio.state.muted).toBe(false);
    expect(audio.state.unlocked).toBe(true);
  });

  it("a player who turned sound off stays muted on the next visit", () => {
    window.localStorage.setItem("fq.settings.v1", JSON.stringify({ muted: true }));
    const { audio } = setup();
    expect(audio.state.muted).toBe(true);
    expect(screen.getByRole("button", { name: "Unmute sound" })).toBeVisible();
    // The first interaction anywhere unlocks the audio but does not undo the mute.
    fireEvent.pointerDown(document.body);
    expect(audio.state.unlocked).toBe(true);
    expect(audio.state.muted).toBe(true);
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
