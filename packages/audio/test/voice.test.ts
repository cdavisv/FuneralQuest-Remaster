import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLegacyText } from "../../core/src/text/legacyText.js";
import { canonicalWords, checkWords } from "../scripts/voiceCheck.js";
import type { InventoryLine } from "../scripts/voiceInventory.js";
import { lineCandidates, spokenLines, type VoiceManifest, voiceKey } from "../src/voice.js";

const repo = join(import.meta.dirname, "..", "..", "..");
const voiceDir = join(repo, "assets", "voice");
const read = <T>(p: string): T => JSON.parse(readFileSync(join(voiceDir, p), "utf8")) as T;

describe("voice keys", () => {
  it("are stable: the same character and words give the same key on every build", () => {
    expect(voiceKey("june", "Please leave now.")).toBe("june-1e3d9b04f539a13e");
    expect(voiceKey("elijah", "We carry nothing but the best in funeral transportation.")).toBe(
      "elijah-4ccd59ce1d49b684",
    );
  });

  it("ignore spacing and line breaks but not words, case or punctuation", () => {
    const k = voiceKey("smyth", "Hi there.  I already said hi though.");
    expect(voiceKey("smyth", "Hi there.\nI already said hi though.")).toBe(k);
    expect(voiceKey("smyth", "Hi there. I already said hi.")).not.toBe(k);
    expect(voiceKey("smyth", "hi there. I already said hi though.")).not.toBe(k);
    expect(voiceKey("june", "Hi there. I already said hi though.")).not.toBe(k);
  });
});

describe("finding spoken lines in game text", () => {
  it("reads a white speaker tag before a quote, including the original's 'Elija'", () => {
    const rich = parseLegacyText(
      '`wElija: `y"Wait until the one you have breaks. Sorry, company policy."',
    );
    expect(spokenLines(rich)).toEqual([
      {
        character: "elijah",
        speaker: "Elija",
        text: "Wait until the one you have breaks. Sorry, company policy.",
        how: "tag",
      },
    ]);
  });

  it("skips the player's and customers' lines and keeps the character's", () => {
    const rich = parseLegacyText(
      '`wBob: `$"Hello? I\'d like some service here!"\n\n`wJune: `$"Just leave, asshole."',
    );
    expect(spokenLines(rich).map((l) => [l.character, l.text])).toEqual([
      ["june", "Just leave, asshole."],
    ]);
  });

  it("attributes an untagged quote by the one character the narration names", () => {
    const rich = parseLegacyText(
      '`$Vane looks at you for a long time. "Get help, pal. Real help. Not the kind I sell."',
    );
    expect(spokenLines(rich)[0]).toMatchObject({ character: "vane", how: "narrated" });
  });

  it("does not take a white word in the text for a speaker", () => {
    const rich = parseLegacyText('`$She said `wloudly`$: "This is nobody we know at all."');
    expect(spokenLines(rich)).toEqual([]);
  });

  it("offers a line without its first or last sentence", () => {
    expect(lineCandidates("Hi Bob. I don't recall you having a pick-up today.")).toContainEqual({
      text: "I don't recall you having a pick-up today.",
      part: "tail",
    });
  });
});

describe("the word check", () => {
  it("passes the same words whatever the punctuation, spacing or digits", () => {
    expect(checkWords("Cash up front, friend.", "Cash up front friend").ok).toBe(true);
    expect(checkWords("within 8% of their limit", "within eight percent of their limit").ok).toBe(
      true,
    );
    expect(canonicalWords("a multiple of fifty dollars")).toBe(canonicalWords("a multiple of $50"));
  });
  it("rejects any changed, added or missing word", () => {
    expect(checkWords("Please leave now.", "Please leave.").ok).toBe(false);
    expect(checkWords("Please leave now.", "Please, please leave now.").ok).toBe(false);
    expect(checkWords("Just leave, asshole.", "Just leave.").ok).toBe(false);
  });
});

const manifestPath = join(voiceDir, "manifest.json");
describe.skipIf(!existsSync(manifestPath))("the voice pack on disk", () => {
  const manifest = read<VoiceManifest>("manifest.json");
  const lines = read<{ lines: InventoryLine[] }>("lines.json").lines;
  const sources = read<{
    takes: { key: string; verdict: string; transcript: string; prompt: string }[];
  }>("sources.json");
  const voiced = new Map(lines.filter((l) => l.voice).map((l) => [l.voice?.key, l]));

  it("has both files of every clip", () => {
    expect(manifest.clips.length).toBeGreaterThan(0);
    for (const c of manifest.clips) {
      expect(existsSync(join(voiceDir, c.file.ogg)), c.file.ogg).toBe(true);
      expect(existsSync(join(voiceDir, c.file.m4a)), c.file.m4a).toBe(true);
    }
  });

  it("files every clip under the key the client computes from its speaker and words", () => {
    for (const c of manifest.clips) expect(voiceKey(c.character, c.text)).toBe(c.key);
  });

  it("has a recorded transcript equal to every clip's words", () => {
    for (const c of manifest.clips) {
      const take = sources.takes.find((t) => t.key === c.key && t.verdict === "chosen");
      expect(take, c.key).toBeDefined();
      expect(checkWords(c.text, take?.transcript ?? "").ok, `${c.key}: ${take?.transcript}`).toBe(
        true,
      );
      // the prompt is the line itself, with at most delivery tags in front
      expect(take?.prompt.replace(/\[[^\]]*\]\s*/g, "").trim()).toBe(c.text);
    }
  });

  it("has no clip for a line whose spoken words would include a placeholder", () => {
    for (const c of manifest.clips) {
      expect(c.text).not.toMatch(/[{}]/);
      const line = voiced.get(c.key);
      expect(line, c.key).toBeDefined();
      expect(line?.voice?.text).toBe(c.text);
      if (line?.hasPlaceholders) expect(c.part).not.toBe("whole");
    }
  });

  it("finds each clip again in the game text it was made from", () => {
    for (const c of manifest.clips) {
      const line = voiced.get(c.key) as InventoryLine;
      const shown = line.text.replace(/\{\w+\}/g, "Bob");
      const text =
        line.how === "tag" ? `${line.speaker}: "${shown}"` : `"${shown}" says ${line.speaker}.`;
      const found = spokenLines(text).find((l) => l.character === c.character);
      expect(found, c.key).toBeDefined();
      const keys = lineCandidates(found?.text ?? "").map((x) => voiceKey(c.character, x.text));
      expect(keys, c.key).toContain(c.key);
    }
  });
});
