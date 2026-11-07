import { useModeration } from "./context.js";
import type { WordKey } from "./text.js";

/**
 * Guests (decision 7, 2026-11-06) play and read, but typing for other people needs a free account.
 * The server refuses these entries (`guest_text`); the client shows them as unavailable first.
 * The overlay ids are the prompts whose text reaches another player: the same list the server uses
 * (`apps/server/src/moderation/service.ts`, OVERLAY_SCOPE).
 */
const KIND_BY_OVERLAY: Record<string, WordKey> = {
  "mailbox:compose": "guest.letter",
  "battle:quote": "guest.quote",
  "news:announcement": "guest.announcement",
  "yangs:tiger-fortune": "guest.fortune",
  "yangs:sparrow-fortune": "guest.fortune",
};

/**
 * "Write Letter" first asks whom to write to; a guest is told at once rather than after choosing a
 * name. (The server does not need to refuse the search: nothing typed there reaches anyone.)
 */
const SEARCH_FOR_LETTER = "mailbox:getname";

/** What a guest is told when this prompt opens, or null when the prompt is not free text for others. */
export function guestRefusalKey(overlayId: string): WordKey | null {
  if (overlayId.endsWith(":chainname")) return "guest.chain";
  if (overlayId === SEARCH_FOR_LETTER) return "guest.letter";
  return KIND_BY_OVERLAY[overlayId] ?? null;
}

/** True in an online session whose account is a guest's. Solo, the mock and the Daily Challenge have none. */
export function useIsGuest(): boolean {
  return useModeration()?.self?.guest === true;
}
