import type { ChatLine, View } from "@fq/protocol";

/** The server keeps 200 lines of the cafe's talk; so does the client. */
export const MAX_TRANSCRIPT = 200;

/**
 * The cafe's conversation as the player has seen it. A View's `chat` is only what the last
 * action (or push) added, not the whole talk: a response carries the lines that action produced
 * for the speaker, and a pushed View is the last View with one line appended. Drawing `chat` as
 * it comes would wipe the conversation each time the player speaks, so the client keeps the
 * transcript and writes it back into the Views it draws.
 */
export interface Transcript {
  /** Every line seen since the player walked in. */
  lines: ChatLine[];
  /** How many lines the last View from the transport carried (a push extends that View). */
  seen: number;
  /** Whether the last View was the cafe. */
  inCafe: boolean;
}

export const emptyTranscript = (): Transcript => ({ lines: [], seen: 0, inCafe: false });

const sameLine = (a: ChatLine, b: ChatLine): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Folds a View into the transcript. `kind` says where it came from: the answer to the player's
 * action, or a push. Returns the new transcript and the View to draw (the same View outside the
 * cafe). A transport that already sends the whole talk (it starts with the lines kept so far)
 * replaces the transcript, so both kinds of transport draw the same.
 */
export function foldChat(
  before: Transcript,
  view: View,
  kind: "response" | "push",
): { transcript: Transcript; view: View } {
  if (view.scene !== "cafe") {
    return { transcript: { lines: [], seen: 0, inCafe: false }, view };
  }
  const incoming = view.chat ?? [];
  let lines: ChatLine[];
  if (!before.inCafe) {
    lines = incoming;
  } else if (
    incoming.length >= before.lines.length &&
    before.lines.every((line, i) => sameLine(line, incoming[i] as ChatLine))
  ) {
    lines = incoming;
  } else if (kind === "push" && incoming.length >= before.seen) {
    lines = [...before.lines, ...incoming.slice(before.seen)];
  } else {
    lines = [...before.lines, ...incoming];
  }
  lines = lines.slice(-MAX_TRANSCRIPT);
  return {
    transcript: { lines, seen: incoming.length, inCafe: true },
    view: { ...view, chat: lines },
  };
}
