import {
  lineCandidates,
  normaliseLine,
  spokenLines,
  type VoiceClip,
  type VoiceManifest,
  voiceKey,
} from "@fq/audio";
import type { RichText, View } from "@fq/protocol";

/**
 * Which recorded lines a View speaks. A View's text is searched for quoted lines by a known
 * character (`spokenLines`, the same detector the voice build used); each line is looked up by
 * `voiceKey(character, text)`, then without its first or last sentence (a clip made for the fixed
 * part of a line whose other sentence holds a name or a number). Lines with no clip stay text.
 */
export type VoiceIndex = Map<string, VoiceClip>;

export function indexManifest(m: VoiceManifest | null): VoiceIndex {
  return new Map((m?.clips ?? []).map((c) => [c.key, c]));
}

export function clipsForText(text: RichText, index: VoiceIndex): VoiceClip[] {
  if (index.size === 0) return [];
  const out: VoiceClip[] = [];
  for (const line of spokenLines(text)) {
    for (const cand of lineCandidates(line.text)) {
      const clip = index.get(voiceKey(line.character, cand.text));
      if (clip && clip.part === cand.part) {
        if (!out.includes(clip)) out.push(clip);
        break;
      }
    }
  }
  return out;
}

/** A View's spoken text as one string, to tell a new screen from the same one updated. */
export function textSignature(view: View | null | undefined): string {
  return view ? normaliseLine(view.text.map((s) => s.text).join("")) : "";
}

/** Places and panels only the Expanded ruleset sends: a town that shows one is an Expanded town. */
export function looksExpanded(view: View | null | undefined): boolean {
  return !!(
    view &&
    (view.town ||
      view.office ||
      view.tutorial ||
      view.bank ||
      view.club ||
      view.bingo ||
      view.prep ||
      view.monuments)
  );
}

/**
 * The "Character voices" default (owner's decision 15b): on for Expanded towns and Solo careers,
 * off for Classic towns, since the original game had no recorded voices. A player's own choice
 * ("on" or "off") wins.
 */
export type VoiceSetting = "auto" | "on" | "off";

export function voicesEnabled(
  setting: VoiceSetting,
  context: { expanded: boolean; solo: boolean },
): boolean {
  if (setting === "on") return true;
  if (setting === "off") return false;
  return context.expanded || context.solo;
}
