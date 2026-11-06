import type { RichText, View } from "@fq/protocol";

/**
 * The guided first day (docs/expanded-rules.md 10.4, 11.5). `View.tutorial` carries the tour page
 * and page count (`page`, `pages`), the clerk's hint for the screen (`hint`) and who speaks
 * (`speaker`). The tour is ordinary location Views with the clerk's picture; the practice sale's
 * screens carry a hint.
 */
export const CLERK_ART = "ui/new-user-clerk";

export interface ClerkTip {
  /** "tour": a page of the tour, with its page count. "hint": a hint during the practice sale. */
  kind: "tour" | "hint";
  /** The hint. */
  text: RichText;
  /** Who is speaking, plain. */
  speaker: string;
  /** The tour page, 1-based, and the page count. */
  page: { at: number; of: number } | undefined;
}

export function clerkTip(view: View): ClerkTip | null {
  const tutorial = view.tutorial;
  if (!tutorial) return null;
  if (tutorial.page !== undefined && tutorial.pages !== undefined) {
    return {
      kind: "tour",
      text: tutorial.hint ?? [],
      speaker: tutorial.speaker,
      page: { at: tutorial.page, of: tutorial.pages },
    };
  }
  if (tutorial.hint && tutorial.hint.length > 0) {
    return { kind: "hint", text: tutorial.hint, speaker: tutorial.speaker, page: undefined };
  }
  return null;
}
