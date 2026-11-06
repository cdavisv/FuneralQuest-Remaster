/**
 * The only thing the client keeps about an account is the session token the server issued.
 * Passwords are typed into the sign-up and log-in forms, sent once to `/api/auth/*`, and never
 * stored, logged or kept in state after the request.
 *
 * Where the token lives (see the README for the full argument):
 * - `localStorage`, so a 30-day session survives closing the tab and an installed PWA's restarts.
 *   The server also issues no cookie, so there is nothing to send automatically; every request
 *   carries the token explicitly, which keeps CSRF out of the picture.
 * - The risk is script injection reading it. The client never builds HTML from game text
 *   (`RichText` renders spans, links only for http and https) and ships no third-party scripts.
 *   The token is revocable (Log out revokes it server-side) and expires.
 * - A second small flag in `sessionStorage` remembers "I was playing in this tab", so a reload
 *   resumes the game, while a freshly opened tab never takes over a running session by itself.
 */
const TOKEN_KEY = "fq.token.v1";
const TOWN_KEY = "fq.town.v1";
const PLAYING_KEY = "fq.playing.v1";

const TOKEN_SHAPE = /^fq_[A-Za-z0-9_-]{20,200}$/;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface TokenStore {
  get(): string | null;
  set(token: string): void;
  clear(): void;
  /** The town the player last entered (not secret). */
  lastTown(): string | null;
  setLastTown(id: string): void;
  /** True when this tab was in a game when it was reloaded. */
  wasPlaying(): string | null;
  setPlaying(townId: string | null): void;
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    // Storage can be blocked (private mode, disabled cookies); the game then works without memory.
    return fallback;
  }
}

export function createTokenStore(local: Store | undefined, session: Store | undefined): TokenStore {
  return {
    get() {
      const value = safe(() => local?.getItem(TOKEN_KEY) ?? null, null);
      return value && TOKEN_SHAPE.test(value) ? value : null;
    },
    set(token) {
      safe(() => local?.setItem(TOKEN_KEY, token), undefined);
    },
    clear() {
      safe(() => local?.removeItem(TOKEN_KEY), undefined);
      safe(() => session?.removeItem(PLAYING_KEY), undefined);
    },
    lastTown: () => safe(() => local?.getItem(TOWN_KEY) ?? null, null),
    setLastTown(id) {
      safe(() => local?.setItem(TOWN_KEY, id), undefined);
    },
    wasPlaying: () => safe(() => session?.getItem(PLAYING_KEY) ?? null, null),
    setPlaying(townId) {
      safe(() => {
        if (townId) session?.setItem(PLAYING_KEY, townId);
        else session?.removeItem(PLAYING_KEY);
      }, undefined);
    },
  };
}

export function browserTokenStore(): TokenStore {
  return createTokenStore(
    typeof localStorage === "undefined" ? undefined : localStorage,
    typeof sessionStorage === "undefined" ? undefined : sessionStorage,
  );
}
