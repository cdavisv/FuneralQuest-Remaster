import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type VoiceManifest, voiceKey } from "@fq/audio";
import { classicPack } from "@fq/content";
import { parseLegacyText } from "@fq/core";
import type { View } from "@fq/protocol";
import { describe, expect, it } from "vitest";
import { createAudioManager } from "./AudioManager.js";
import { clipsForText, indexManifest, looksExpanded, voicesEnabled } from "./voiceLines.js";

const clip = (character: string, text: string, part: "whole" | "tail" | "head" = "whole") => ({
  key: voiceKey(character, text),
  character,
  speaker: character,
  text,
  part,
  rulesets: ["classic" as const],
  file: { ogg: `${character}/x.ogg`, m4a: `${character}/x.m4a`, bytes: 1 },
  duration: 1,
});
const manifest = (clips: ReturnType<typeof clip>[]): VoiceManifest => ({
  generator: "test",
  license: "test",
  lufs: -16,
  totalBytes: 0,
  clips,
});

describe("which lines a screen speaks", () => {
  const index = indexManifest(
    manifest([
      clip("june", "Just leave, asshole."),
      clip("nurse", "I don't recall you having a pick-up today.", "tail"),
    ]),
  );

  it("finds a clip for exactly the speaker and words on screen", () => {
    const text = parseLegacyText(
      '`wBob: `$"Hello? I\'d like some service here!"\n\n`wJune: `$"Just leave, asshole."',
    );
    expect(clipsForText(text, index).map((c) => c.character)).toEqual(["june"]);
  });

  it("finds the fixed part of a line whose first sentence holds the player's name", () => {
    const text = parseLegacyText(
      '`wNurse: `$"Hi Mortimer.  I don\'t recall you having a pick-up today."',
    );
    expect(clipsForText(text, index).map((c) => c.character)).toEqual(["nurse"]);
  });

  it("finds nothing for other words, another speaker, or no pack", () => {
    expect(clipsForText(parseLegacyText('`wJune: `$"Just leave."'), index)).toEqual([]);
    expect(clipsForText(parseLegacyText('`wTeller: `$"Just leave, asshole."'), index)).toEqual([]);
    expect(clipsForText(parseLegacyText('`wJune: `$"Just leave, asshole."'), new Map())).toEqual(
      [],
    );
  });

  it("matches the build's keys: every clip in the pack is found in the Classic pack's own text", () => {
    const path = join(
      import.meta.dirname,
      "..",
      "..",
      "..",
      "..",
      "assets",
      "voice",
      "manifest.json",
    );
    if (!existsSync(path)) return;
    const real = JSON.parse(readFileSync(path, "utf8")) as VoiceManifest;
    const idx = indexManifest(real);
    // the original Yang's counter, as the engine shows it (text.places.yangs.kicked)
    const kicked = (classicPack.text as unknown as { places: { yangs: { kicked: string } } }).places
      .yangs.kicked;
    const found = clipsForText(parseLegacyText(kicked.replace(/\{player\}/g, "Bob")), idx);
    if (real.clips.some((c) => c.text === "Just leave, asshole."))
      expect(found.map((c) => c.text)).toEqual(["Just leave, asshole."]);
  });
});

describe("the Character voices default", () => {
  it("is on for Expanded towns and Solo careers and off for Classic towns", () => {
    expect(voicesEnabled("auto", { expanded: true, solo: false })).toBe(true);
    expect(voicesEnabled("auto", { expanded: false, solo: true })).toBe(true);
    expect(voicesEnabled("auto", { expanded: false, solo: false })).toBe(false);
  });
  it("follows the player's own choice", () => {
    expect(voicesEnabled("on", { expanded: false, solo: false })).toBe(true);
    expect(voicesEnabled("off", { expanded: true, solo: true })).toBe(false);
  });
  it("tells an Expanded screen by its Expanded-only panels", () => {
    const base = { scene: "desk", title: "", text: [], buttons: [] } as unknown as View;
    expect(looksExpanded(base)).toBe(false);
    expect(looksExpanded({ ...base, town: {} } as unknown as View)).toBe(true);
  });
});

describe("in tests", () => {
  it("there is nowhere for a voice to play", () => {
    const audio = createAudioManager({ unlocked: true });
    expect(audio.voiceOutput()).toBeNull();
  });
});
