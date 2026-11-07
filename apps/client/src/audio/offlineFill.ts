import { inWrapper } from "../wrapper.js";
import { audioBase, pickFormat } from "./webAudioBackend.js";

/**
 * Keeping the rendered sound for offline Solo play without slowing the first load.
 *
 * The service worker (pwa/sw.js) keeps every audio file as it is played. That alone leaves a
 * first offline game silent, so once the game is usable (the page loaded, the browser idle, a few
 * seconds later) the page asks the worker to fetch the rest in the background, two files at a
 * time, in the one container this browser plays (the Synth and "Original, remastered" packs: about
 * 8 MB of Ogg Opus, 11 MB of AAC; the Studio pack is kept only as it is played). Nothing
 * here runs in the native apps (the audio is part of the app there), on a data-saver connection,
 * or when the audio is hosted on another origin (`VITE_AUDIO_BASE`; the worker only handles its
 * own).
 */
export interface FillEnv {
  saveData: boolean;
  wrapper: boolean;
  /** `audioBase()`. */
  base: string;
  origin: string;
  online: boolean;
}

/** The message to send the worker, or null when the audio should not be fetched ahead of time. */
export function audioFillMessage(
  env: FillEnv,
  format: "ogg" | "m4a",
): { type: "fq-fill-audio"; format: "ogg" | "m4a" } | null {
  if (env.saveData || env.wrapper || !env.online) return null;
  // Only the page's own /audio, which is where the worker looks.
  const own = env.base.startsWith("/") && !env.base.startsWith("//");
  const same = env.base.startsWith(env.origin);
  if (!own && !same) return null;
  return { type: "fq-fill-audio", format };
}

/** Waits for the game to be usable, then asks the active worker to fill the audio cache. */
export function scheduleAudioFill(delayMs = 8000): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
  const go = async () => {
    const message = audioFillMessage(
      {
        saveData: connection?.saveData === true,
        wrapper: inWrapper(),
        base: audioBase(),
        origin: location.origin,
        online: navigator.onLine,
      },
      pickFormat(),
    );
    if (!message) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      registration.active?.postMessage(message);
    } catch {
      // No worker here: nothing to fill.
    }
  };
  const later = () => window.setTimeout(() => void go(), delayMs);
  const idle = (window as { requestIdleCallback?: (cb: () => void, o?: object) => number })
    .requestIdleCallback;
  const start = () => (idle ? idle(later, { timeout: 15000 }) : later());
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}
