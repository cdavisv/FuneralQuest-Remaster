import { VOICE_DIR } from "@fq/audio";
import type { View } from "@fq/protocol";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useSettings } from "../settings/settings.js";
import { useAudio } from "./AudioContext.js";
import { clipsForText, looksExpanded, textSignature, voicesEnabled } from "./voiceLines.js";
import { VoicePlayer } from "./voicePlayer.js";
import { audioBase, pickFormat } from "./webAudioBackend.js";

/**
 * Character voices for the game screen. When a new View's text holds a quoted line by a known
 * character and the voice pack has a clip for exactly that line, the clip plays once as the text
 * appears; moving on to another screen cuts it off; the same screen updated (a chat line, a
 * re-render) does not replay it. Silent in tests (no audio backend), before the first click
 * (browsers' autoplay rule) and when "Character voices" is off.
 */

/** Base URL of the voice pack: VITE_VOICE_BASE, else beside the Synth pack (`/voice`). */
export function voiceBase(): string {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const own = env?.VITE_VOICE_BASE;
  return (own ?? audioBase().replace(/[^/]*$/, VOICE_DIR)).replace(/\/$/, "");
}

// What the default depends on, for the settings panel: is this an Expanded town, a Solo career?
let context = { expanded: false, solo: false };
const listeners = new Set<() => void>();
function setContext(next: { expanded: boolean; solo: boolean }) {
  if (next.expanded === context.expanded && next.solo === context.solo) return;
  context = next;
  for (const l of listeners) l();
}

/** The game the player is in, as the "Character voices" default sees it. */
export function useVoiceContext(): { expanded: boolean; solo: boolean } {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => context,
  );
}

/** Whether character voices are on for the game being played (the setting, or its default). */
export function useVoicesOn(): boolean {
  const { settings } = useSettings();
  return voicesEnabled(settings.voices, useVoiceContext());
}

let player: VoicePlayer | null = null;

function playerFor(output: NonNullable<ReturnType<ReturnType<typeof useAudio>["voiceOutput"]>>) {
  if (player?.output.ctx !== output.ctx) {
    player?.dispose();
    player = new VoicePlayer(output, {
      base: voiceBase(),
      format: pickFormat(),
      fetchBytes: async (url) => {
        const res = await fetch(url, { priority: "low" } as RequestInit);
        if (!res.ok) throw new Error(`${res.status}`);
        return res.arrayBuffer();
      },
    });
    const p = player;
    if (typeof window !== "undefined") window.__fqVoice = { debug: () => p.debug() };
  }
  return player;
}

export function useCharacterVoices(view: View | null | undefined, solo: boolean): void {
  const audio = useAudio();
  const { settings } = useSettings();
  const expanded = useRef(false);
  const last = useRef<string | null>(null);
  if (looksExpanded(view)) expanded.current = true;
  const on = voicesEnabled(settings.voices, { expanded: expanded.current, solo });

  useEffect(() => {
    setContext({ expanded: expanded.current, solo });
  });
  useEffect(
    () => () => {
      player?.stop();
      setContext({ expanded: false, solo: false });
    },
    [],
  );

  useEffect(() => {
    player?.setVolume(settings.volume.voice);
  }, [settings.volume.voice]);

  // The volume has its own effect: a volume change must not replay the line.
  // biome-ignore lint/correctness/useExhaustiveDependencies: settings.volume.voice is applied above.
  useEffect(() => {
    const sig = textSignature(view);
    if (!on || !view) {
      player?.stop();
      last.current = sig;
      return;
    }
    // the same screen again (a chat line, a pushed update): keep speaking, do not start over
    if (sig === last.current) return;
    last.current = sig;
    const output = audio.voiceOutput();
    if (!output) return;
    const p = playerFor(output);
    p.setVolume(settings.volume.voice);
    p.stop();
    let live = true;
    void p.index().then((index) => {
      if (live) p.speak(clipsForText(view.text, index));
    });
    return () => {
      live = false;
    };
  }, [view, on, audio]);
}
