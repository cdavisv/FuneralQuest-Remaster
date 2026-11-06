import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { SceneKind, View } from "@fq/protocol";
import { describe, expect, it } from "vitest";
import {
  ACTION_SOUNDS,
  ambienceFor,
  BUTTON_MUSIC,
  ENGINE_MUSIC,
  ENGINE_SOUNDS,
  emptyMemory,
  musicFor,
  PICTURE_AMBIENCE,
  PICTURE_MUSIC,
  PICTURE_SOUNDS,
  PLACE_MUSIC,
  pickCue,
  SCENE_MUSIC,
  WEATHER_AMBIENCE,
  WEATHER_SOUND,
} from "../src/cues.js";
import { AMBIENCE, EFFECTS_IDS, MUSIC, STINGERS, UI_IDS } from "../src/tracks.js";

const repo = join(import.meta.dirname, "..", "..", "..");

function files(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

/** Every literal the given source tree puts in a View's `music` or `sounds`. */
function emitted(dir: string): { music: Set<string>; sounds: Set<string> } {
  const music = new Set<string>();
  const sounds = new Set<string>();
  for (const f of files(dir)) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/\bmusic\s*[:=]\s*"([^"]+)"/g)) music.add(m[1] as string);
    for (const m of src.matchAll(/\bsounds\s*[:=]\s*\[([^\]]*)\]/g)) {
      for (const s of (m[1] as string).matchAll(/"([^"]+)"/g)) sounds.add(s[1] as string);
    }
    // `view.music = x` with a non-literal must be a pass-through of the above (visit.ts `look.music`)
  }
  return { music, sounds };
}

const MUSIC_SET = new Set<string>(MUSIC);
const SOUND_SET = new Set<string>([...STINGERS, ...EFFECTS_IDS, ...UI_IDS]);
const AMB_SET = new Set<string>(AMBIENCE);

/** Picture ids the engine and its content packs can show. */
function enginePictures(): Set<string> {
  const out = new Set<string>();
  const re =
    /"((?:places|people|stuff|music|animals|background|mother|ring|hearse)\/[^"]+|bar|wait|closed|blank|morning_coffee|chinese_takeout)"/g;
  for (const f of files(join(repo, "packages/core/src"))) {
    for (const m of readFileSync(f, "utf8").matchAll(re)) out.add(m[1] as string);
  }
  for (const pack of ["classic", "expanded", "vintage"]) {
    const p = join(repo, "packages/content/built", `${pack}.json`);
    for (const m of readFileSync(p, "utf8").matchAll(re)) out.add(m[1] as string);
  }
  return out;
}

describe("the engine's audio ids", () => {
  const core = emitted(join(repo, "packages/core/src"));

  it("finds the ids the engine sets (the scan works)", () => {
    expect(core.music).toContain("music/music_fight");
    expect(core.music).toContain("music/music_sneak");
  });

  it("maps every music id the engine can emit", () => {
    for (const id of core.music) expect(ENGINE_MUSIC[id], id).toBeDefined();
  });

  it("maps every sound id the engine can emit", () => {
    for (const id of core.sounds) expect(ENGINE_SOUNDS[id], id).toBeDefined();
  });

  it("maps every id the client's scripted mock emits", () => {
    const mock = emitted(join(repo, "apps/client/src/mock"));
    for (const id of mock.music) expect(ENGINE_MUSIC[id], id).toBeDefined();
    for (const id of mock.sounds) expect(ENGINE_SOUNDS[id], id).toBeDefined();
  });

  it("covers every picture of the original that had a sound", () => {
    const art = JSON.parse(readFileSync(join(repo, "assets/manifest.json"), "utf8")) as {
      assets: { id: string; hasSound?: boolean }[];
    };
    const withSound = art.assets.filter((a) => a.hasSound).map((a) => a.id);
    expect(withSound.length).toBeGreaterThan(30);
    for (const id of withSound) {
      const covered =
        id in ENGINE_MUSIC ||
        id in PICTURE_SOUNDS ||
        id in PICTURE_AMBIENCE ||
        id in PICTURE_MUSIC ||
        /^background\/background_\d$/.test(id);
      expect(covered, id).toBe(true);
    }
  });

  it("gives music to every place, scene and picture the engine can show", () => {
    for (const p of enginePictures()) {
      const v: View = { scene: "location", title: "", text: [], buttons: [], picture: { bg: p } };
      expect(musicFor(v, emptyMemory()), p).not.toBeNull();
    }
    const scenes: SceneKind[] = [
      "lobby",
      "news",
      "desk",
      "location",
      "map",
      "cafe",
      "stats",
      "rankings",
    ];
    for (const s of scenes) {
      expect(
        musicFor({ scene: s, title: "", text: [], buttons: [] }, emptyMemory()),
        s,
      ).not.toBeNull();
      expect(s in SCENE_MUSIC).toBe(true);
    }
    for (const place of [
      "funeral-home",
      "bank",
      "store",
      "cafe",
      "yangs",
      "competitors",
      "church",
      "hospital",
      "spirit-university",
      "graveyard",
      "city-hall",
      "reaper-club",
    ]) {
      expect(PLACE_MUSIC[place], place).toBeDefined();
    }
  });

  it("only names tracks that exist", () => {
    const all = [
      ...Object.values(ENGINE_MUSIC),
      ...Object.values(PLACE_MUSIC),
      ...Object.values(PICTURE_MUSIC),
      ...BUTTON_MUSIC.map(([, m]) => m),
      ...Object.values(SCENE_MUSIC).filter((m) => m !== null),
    ];
    for (const m of all) expect(MUSIC_SET.has(m as string), m as string).toBe(true);
    for (const a of [...Object.values(PICTURE_AMBIENCE), ...Object.values(WEATHER_AMBIENCE)]) {
      if (a !== null) expect(AMB_SET.has(a), a).toBe(true);
    }
    for (const s of [
      ...Object.values(ENGINE_SOUNDS),
      ...Object.values(PICTURE_SOUNDS),
      ...Object.values(WEATHER_SOUND),
      ...ACTION_SOUNDS.map(([, s]) => s),
    ]) {
      expect(SOUND_SET.has(s), s).toBe(true);
    }
  });
});

describe("the cue picker", () => {
  const v = (x: Partial<View> & Pick<View, "scene">): View => ({
    title: "",
    text: [],
    buttons: [],
    ...x,
  });

  it("prefers a fight, then a customer, then the engine's id, then the place", () => {
    const m = emptyMemory();
    expect(
      musicFor(
        v({ scene: "location", music: "music/music_sneak", picture: { bg: "places/bank" } }),
        m,
      ),
    ).toBe("sneak");
    expect(musicFor(v({ scene: "location", picture: { bg: "places/bank" } }), m)).toBe("bank");
    expect(
      musicFor(
        v({
          scene: "location",
          picture: { fg: "places/funeral-ceremony" },
          buttons: [{ id: "graveyard:pray", label: "" }],
        }),
        m,
      ),
    ).toBe("graveyard");
    expect(
      musicFor(
        v({
          scene: "location",
          customer: { incomeLabel: "", moodLabel: "", moodLevel: 2, total: 0 },
          picture: { bg: "places/bank" },
        }),
        m,
      ),
    ).toBe("negotiation");
  });

  it("derives ambience from pictures and the weather", () => {
    expect(ambienceFor(v({ scene: "location", picture: { bg: "places/hospital_room" } }))).toBe(
      "amb-monitor",
    );
    expect(
      ambienceFor(
        v({ scene: "map", town: { day: 2, weather: { id: "rain", label: "", effect: "" } } }),
      ),
    ).toBe("amb-rain");
    expect(ambienceFor(v({ scene: "cafe" }))).toBeNull();
  });

  it("plays the meteor on the season's last paper", () => {
    const paper = v({ scene: "news", text: [{ text: "A METEOR hits Deathville!" }] });
    expect(musicFor(paper, emptyMemory())).toBe("meteor");
  });

  it("notices a win in a fight and a sale's exact match", () => {
    const fight = (me: number, them: number) =>
      v({
        scene: "location",
        battle: { me: { name: "a", hp: me, hpMax: 10 }, them: { name: "b", hp: them, hpMax: 10 } },
      });
    let mem = pickCue(fight(10, 10), emptyMemory()).memory;
    const hit = pickCue(fight(10, 4), mem);
    expect(hit.cue.sounds).toEqual(["punch"]);
    mem = hit.memory;
    expect(pickCue(fight(10, 0), mem).cue.sounds).toEqual(["punch", "victory"]);
    const sale = pickCue(
      v({
        scene: "location",
        customer: { incomeLabel: "", moodLabel: "", moodLevel: 3, total: 1 },
      }),
      emptyMemory(),
    );
    expect(
      pickCue(v({ scene: "desk", text: [{ text: "PERFECT! The bill is exact." }] }), sale.memory)
        .cue.sounds,
    ).toContain("fanfare-exact");
  });
});
