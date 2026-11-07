import {
  LIVE_IDS,
  type ManifestTrack,
  nextBarTime,
  PACKS,
  type PackId,
  renderLive,
  type SoundId,
  stemGains,
} from "@fq/audio";
import type { AudioBackend, Volumes } from "./AudioManager.js";
import { AudioLibrary } from "./library.js";

/**
 * The Web Audio backend. The graph:
 *
 *   music players -> music bus -> duck ----\
 *   ambience players -> ambience bus -------+-> master -> dry ---------------+-> analyser -> out
 *   one-shots -> effects bus --------------/          \-> radio (mono, band-limited) -/
 *
 * Each music or ambience "player" is a gain over looping buffer sources (one per stem), so a
 * scene change is two gain ramps; the negotiation's stems each have their own gain. Stingers
 * duck the music. One-shots are capped (`MAX_VOICES`, and per sound) so a burst of events cannot
 * pile up. The UI sounds are synthesised here at start-up (`renderLive`), not downloaded.
 *
 * Sound packs: the library resolves each id to the selected pack or, if that pack lacks it, the
 * Synth pack. A track whose stems are alternatives ("crossfade" layer mode, the Studio pack's
 * negotiation) has one stem heard at a time, and a change of stem waits for the next bar line.
 */
const MAX_VOICES = 10;
const MAX_SAME = 2;
/** Gain trims per kind (the files are mastered; this is the mix between buses' contents). */
const TRIM = { ui: 0.8, sfx: 0.9, stinger: 1 } as const;

interface Player {
  id: string;
  track: ManifestTrack;
  /** Context time at which the loop's start was playing. */
  startedAt: number;
  gain: GainNode;
  stems: { src: AudioBufferSourceNode; gain: GainNode }[];
}

interface Voice {
  id: string;
  src: AudioBufferSourceNode;
  started: number;
}

export interface WebAudioDebug {
  context: AudioContextState;
  music: string | null;
  ambience: string | null;
  layers: number[];
  radio: boolean;
  /** RMS of the output over the analyser's window, dBFS. */
  level: number;
  voices: number;
  missing: string[];
  /** The selected sound pack, and the pack each loaded id actually plays from. */
  pack: PackId;
  sources: Record<string, PackId>;
}

declare global {
  interface Window {
    /** Read-only probe for tests and the curious (`__fqAudio.debug()`). */
    __fqAudio?: { debug(): WebAudioDebug };
  }
}

export function pickFormat(): "ogg" | "m4a" {
  try {
    const a = document.createElement("audio");
    return a.canPlayType('audio/ogg; codecs="opus"') ? "ogg" : "m4a";
  } catch {
    return "m4a";
  }
}

export function audioBase(): string {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  return (env?.VITE_AUDIO_BASE ?? "/audio").replace(/\/$/, "");
}

/** Base URL of the Studio pack: VITE_AUDIO_STUDIO_BASE, else beside the Synth pack. */
export function studioBase(): string {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const own = env?.VITE_AUDIO_STUDIO_BASE;
  return (own ?? audioBase().replace(/[^/]*$/, PACKS.studio.dir)).replace(/\/$/, "");
}

/** Creates the backend, or null where there is no Web Audio (old browsers, tests). */
export function createWebAudioBackend(): AudioBackend | null {
  const Ctor =
    typeof window === "undefined"
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctor) return null;
  let ctx: AudioContext;
  try {
    ctx = new Ctor({ latencyHint: "interactive" });
  } catch {
    return null;
  }
  const lib = new AudioLibrary({
    base: audioBase(),
    format: pickFormat(),
    fetchBytes: async (url) => {
      const res = await fetch(url, { priority: "low" } as RequestInit);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.arrayBuffer();
    },
    decode: (bytes) => ctx.decodeAudioData(bytes),
    bases: { studio: studioBase() },
  });
  let pack: PackId = "synth";

  // --- the graph -------------------------------------------------------------------------
  const out = ctx.destination;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.connect(out);
  const master = ctx.createGain();
  const dry = ctx.createGain();
  master.connect(dry).connect(analyser);
  // The 2001 radio: mono, 150 Hz to about 5 kHz (an 11 kHz sample rate's band), a little grit.
  const radioIn = ctx.createGain();
  radioIn.channelCount = 1;
  radioIn.channelCountMode = "explicit";
  radioIn.channelInterpretation = "speakers";
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 150;
  const lp1 = ctx.createBiquadFilter();
  lp1.type = "lowpass";
  lp1.frequency.value = 5000;
  const lp2 = ctx.createBiquadFilter();
  lp2.type = "lowpass";
  lp2.frequency.value = 5000;
  const grit = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(1.6 * x) / Math.tanh(1.6);
  }
  grit.curve = curve;
  const radio = ctx.createGain();
  radio.gain.value = 0;
  master
    .connect(radioIn)
    .connect(hp)
    .connect(lp1)
    .connect(lp2)
    .connect(grit)
    .connect(radio)
    .connect(analyser);

  const musicBus = ctx.createGain();
  const duck = ctx.createGain();
  const ambienceBus = ctx.createGain();
  const effectsBus = ctx.createGain();
  musicBus.connect(duck).connect(master);
  ambienceBus.connect(master);
  effectsBus.connect(master);

  // --- players ---------------------------------------------------------------------------
  let music: Player | null = null;
  let ambience: Player | null = null;
  let musicToken = 0;
  let ambienceToken = 0;
  let layers: number[] = [];
  let radioOn = false;
  const voices: Voice[] = [];
  const live = new Map<string, AudioBuffer>();

  const ramp = (p: AudioParam, to: number, seconds: number) => {
    const now = ctx.currentTime;
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    if (seconds <= 0) p.setValueAtTime(to, now);
    else p.linearRampToValueAtTime(to, now + seconds);
  };

  function stopPlayer(p: Player | null, fade: number) {
    if (!p) return;
    ramp(p.gain.gain, 0, fade);
    const at = ctx.currentTime + fade + 0.05;
    for (const s of p.stems) {
      try {
        s.src.stop(at);
      } catch {
        // already stopped
      }
    }
    setTimeout(() => p.gain.disconnect(), (fade + 0.2) * 1000);
  }

  async function startPlayer(
    id: string,
    bus: AudioNode,
    fade: number,
    stemGains?: number[],
  ): Promise<Player | null> {
    const bufs = await lib.buffers(id);
    const t = await lib.track(id);
    if (!bufs || !t) return null;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(bus);
    const when = ctx.currentTime + 0.03;
    const initial = stemGains ? stemGainsFor(t, stemGains) : undefined;
    const stems = bufs.map((buf, i) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = t.loop;
      if (t.loop && t.loopStart !== undefined && t.loopEnd !== undefined) {
        src.loopStart = t.loopStart;
        src.loopEnd = t.loopEnd;
      }
      const g = ctx.createGain();
      g.gain.value = initial?.[i] ?? 1;
      src.connect(g).connect(gain);
      src.start(when, t.loopStart ?? 0);
      return { src, gain: g };
    });
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(1, when + Math.max(0.02, fade));
    return { id, track: t, startedAt: when, gain, stems };
  }

  /** The stem gains a track's layer mode makes of the manager's mood layers. */
  function stemGainsFor(t: ManifestTrack, gains: number[]): number[] {
    return stemGains(t.layerMode, gains);
  }

  /** Starts the current music and ambience again from the selected pack (after a pack change). */
  function reload() {
    const m = music;
    if (m) {
      const token = ++musicToken;
      void startPlayer(m.id, musicBus, 1, layers.length ? layers : undefined).then((p) => {
        if (token !== musicToken) {
          stopPlayer(p, 0.05);
          return;
        }
        stopPlayer(music, 1);
        music = p;
      });
    }
    const a = ambience;
    if (a) {
      const token = ++ambienceToken;
      void startPlayer(a.id, ambienceBus, 1).then((p) => {
        if (token !== ambienceToken) {
          stopPlayer(p, 0.05);
          return;
        }
        stopPlayer(ambience, 1);
        ambience = p;
      });
    }
  }

  async function playOne(id: SoundId, kind: "ui" | "sfx" | "stinger") {
    const now = ctx.currentTime;
    // the same sound twice within 60 ms is one sound
    if (voices.some((v) => v.id === id && now - v.started < 0.06)) return;
    let buf = live.get(id) ?? null;
    if (!buf) {
      const bufs = await lib.buffers(id);
      buf = bufs?.[0] ?? null;
    }
    if (!buf) return;
    const same = voices.filter((v) => v.id === id);
    if (same.length >= MAX_SAME) stopVoice(same[0] as Voice);
    if (voices.length >= MAX_VOICES) stopVoice(voices[0] as Voice);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = TRIM[kind];
    src.connect(g).connect(kind === "stinger" ? master : effectsBus);
    const voice: Voice = { id, src, started: ctx.currentTime };
    voices.push(voice);
    src.onended = () => {
      const i = voices.indexOf(voice);
      if (i >= 0) voices.splice(i, 1);
      g.disconnect();
    };
    src.start();
    if (kind === "stinger") {
      // the stinger rides over the loop: duck it, then bring it back
      const t = ctx.currentTime;
      duck.gain.cancelScheduledValues(t);
      duck.gain.setValueAtTime(duck.gain.value, t);
      duck.gain.linearRampToValueAtTime(0.25, t + 0.15);
      duck.gain.setValueAtTime(0.25, t + Math.max(0.3, buf.duration - 0.8));
      duck.gain.linearRampToValueAtTime(1, t + buf.duration + 0.6);
    }
  }

  function stopVoice(v: Voice) {
    try {
      v.src.stop();
    } catch {
      // already stopped
    }
    const i = voices.indexOf(v);
    if (i >= 0) voices.splice(i, 1);
  }

  // UI sounds: synthesised now, a few milliseconds each.
  for (const id of LIVE_IDS) {
    const s = renderLive(id, ctx.sampleRate);
    if (!s) continue;
    const b = ctx.createBuffer(2, s.l.length, ctx.sampleRate);
    b.copyToChannel(s.l as Float32Array<ArrayBuffer>, 0);
    b.copyToChannel(s.r as Float32Array<ArrayBuffer>, 1);
    live.set(id, b);
  }

  // Warm the cache with what a session usually needs first, without blocking anything.
  const idle = (fn: () => void) =>
    "requestIdleCallback" in window
      ? window.requestIdleCallback(fn, { timeout: 4000 })
      : setTimeout(fn, 1500);
  idle(() => {
    void (async () => {
      const m = await lib.manifest();
      if (!m) return;
      for (const id of [
        "town",
        "desk",
        "newday",
        "ui-page",
        "cash-register",
        "coins",
        "doorbell",
      ]) {
        if (m.tracks[id]) await lib.prefetch(id);
      }
    })();
  });

  const backend: AudioBackend = {
    setMusic(id, fade, stemGains) {
      layers = stemGains ?? [];
      const token = ++musicToken;
      if (!id) {
        stopPlayer(music, fade);
        music = null;
        return;
      }
      if (music?.id === id) return;
      void startPlayer(id, musicBus, fade, stemGains).then((p) => {
        if (token !== musicToken) {
          stopPlayer(p, 0.05);
          return;
        }
        stopPlayer(music, fade);
        music = p;
        if (p && layers.length) backend.setLayers(layers, 0);
      });
    },
    setLayers(gains, rampSec) {
      layers = gains;
      if (!music) return;
      const m = music;
      const target = stemGainsFor(m.track, gains);
      if (m.track.layerMode === "crossfade") {
        // whole pieces in step: change piece on the next bar line, not mid-phrase
        const at = nextBarTime(ctx.currentTime, m.startedAt, m.track);
        for (const [i, s] of m.stems.entries()) {
          const p = s.gain.gain;
          p.cancelScheduledValues(ctx.currentTime);
          p.setValueAtTime(p.value, ctx.currentTime);
          p.setValueAtTime(p.value, at);
          p.linearRampToValueAtTime(target[i] ?? 0, at + Math.max(0.05, rampSec));
        }
        return;
      }
      m.stems.forEach((s, i) => {
        ramp(s.gain.gain, target[i] ?? 1, rampSec);
      });
    },
    setPack(next) {
      if (next === pack) return;
      pack = next;
      lib.setPack(next);
      reload();
    },
    setAmbience(id, fade) {
      const token = ++ambienceToken;
      if (!id) {
        stopPlayer(ambience, fade);
        ambience = null;
        return;
      }
      if (ambience?.id === id) return;
      void startPlayer(id, ambienceBus, fade).then((p) => {
        if (token !== ambienceToken) {
          stopPlayer(p, 0.05);
          return;
        }
        stopPlayer(ambience, fade);
        ambience = p;
      });
    },
    playSound(id, kind) {
      void playOne(id, kind);
    },
    setGains(g: Volumes) {
      ramp(master.gain, g.master, 0.05);
      ramp(musicBus.gain, g.music, 0.05);
      ramp(ambienceBus.gain, g.ambience, 0.05);
      ramp(effectsBus.gain, g.effects, 0.05);
    },
    setRadio(on) {
      radioOn = on;
      ramp(dry.gain, on ? 0 : 1, 0.15);
      ramp(radio.gain, on ? 1.4 : 0, 0.15);
    },
    setActive(active) {
      // A browser may refuse (Safari when its audio session is interrupted, any engine with no
      // audio device: "Failed to start the audio device"): the game goes on without sound, and
      // the next gesture or tab change asks again.
      if (active && ctx.state === "suspended") ctx.resume().catch(() => undefined);
      if (!active && ctx.state === "running") ctx.suspend().catch(() => undefined);
    },
    dispose() {
      stopPlayer(music, 0.1);
      stopPlayer(ambience, 0.1);
      ctx.close().catch(() => undefined);
      if (window.__fqAudio?.debug === debug) delete window.__fqAudio;
    },
  };

  const samples = new Float32Array(analyser.fftSize);
  const debug = (): WebAudioDebug => {
    analyser.getFloatTimeDomainData(samples);
    let e = 0;
    for (const s of samples) e += s * s;
    const rms = Math.sqrt(e / samples.length);
    return {
      context: ctx.state,
      music: music?.id ?? null,
      ambience: ambience?.id ?? null,
      layers: music ? music.stems.map((s) => Math.round(s.gain.gain.value * 100) / 100) : [],
      radio: radioOn,
      level: rms > 0 ? Math.round(20 * Math.log10(rms) * 10) / 10 : -120,
      voices: voices.length,
      missing: [...lib.missing],
      pack,
      sources: Object.fromEntries(lib.sources),
    };
  };
  window.__fqAudio = { debug };
  return backend;
}
