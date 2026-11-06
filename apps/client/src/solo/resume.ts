/**
 * "This tab was playing a Solo game", so a reload goes straight back into it (the same idea as
 * the online door's `fq.playing.v1`). It lives in `sessionStorage`: a new tab starts at the
 * front door instead of taking over a game that is open in another tab.
 */
const KEY = "fq.solo.playing.v1";

function store(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function playingSoloSlot(): string | null {
  try {
    return store()?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
}

export function wasPlayingSolo(): boolean {
  return playingSoloSlot() !== null;
}

export function setPlayingSolo(slot: string | null): void {
  try {
    if (slot) store()?.setItem(KEY, slot);
    else store()?.removeItem(KEY);
  } catch {
    // Storage can be blocked; the game then simply does not resume by itself.
  }
}
