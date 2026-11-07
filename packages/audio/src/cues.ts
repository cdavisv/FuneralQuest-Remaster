import type { Action, MessageKind, SaleOutcome, SceneKind, View } from "@fq/protocol";
import type { AmbienceId, MusicId, SoundId, StingerId } from "./tracks.js";

/**
 * The cue map: what plays for a View. The engine sends `music` and `sounds` ids on a few Views
 * (the Classic fight and sneak loops); everything else is derived from what the View shows,
 * the way the original coupled its sounds to its pictures: the scene, the place (the Expanded
 * engine names every button `<module>:<command>`), the picture layers, the customer's mood, the
 * battle, and what changed since the last View (a sale, a walkout, a new day, a tag earned).
 */

/** Ids the engine (and the client's scripted mock) put in `View.music`. */
export const ENGINE_MUSIC: Record<string, MusicId> = {
  // packages/core: classic/modules/battle.ts, classic/modules/visit.ts
  "music/music_fight": "battle",
  "music/music_sneak": "sneak",
  // the original client's own cues (welcome.swf), should a host send them
  intro: "main",
  map: "town",
  // apps/client/src/mock/fixtures.ts
  town: "town",
  parlor: "desk",
  shop: "dimart",
  cafe: "cafe",
  fight: "battle",
  negotiation: "negotiation",
};

/** Ids the engine (and the mock) put in `View.sounds`. */
export const ENGINE_SOUNDS: Record<string, SoundId> = {
  cash: "cash-register",
  paper: "ui-page",
  coin: "ui-coin",
  gong: "gong",
  thump: "casket-thump",
};

/** The music for each place id of the town map (`View.map[].id`, the `visit` action). */
export const PLACE_MUSIC: Record<string, MusicId> = {
  "funeral-home": "desk",
  bank: "bank",
  store: "dimart",
  cafe: "cafe",
  yangs: "yangs",
  competitors: "sneak",
  church: "ceremony",
  hospital: "hospital",
  "spirit-university": "university",
  graveyard: "graveyard",
  "city-hall": "cityhall",
  "reaper-club": "club",
};

/** Default music per scene, when nothing more specific applies. `null` keeps what is playing. */
export const SCENE_MUSIC: Record<SceneKind, MusicId | null> = {
  lobby: "main",
  news: "desk",
  desk: "desk",
  location: null,
  map: "town",
  cafe: "cafe",
  stats: null,
  rankings: null,
};

/** Expanded places by button prefix, most specific first. */
export const BUTTON_MUSIC: [prefix: string, music: MusicId][] = [
  ["reaper-club:", "club"],
  ["graveyard:", "graveyard"],
  ["city-hall:", "cityhall"],
  ["church:", "ceremony"],
  ["hospital:", "hospital"],
  ["bank:", "bank"],
  ["store:", "dimart"],
  ["parlor:", "desk"],
  ["prep:", "desk"],
];

/** Music by picture (foreground or background), for places the buttons do not name. */
export const PICTURE_MUSIC: Record<string, MusicId> = {
  "places/bank": "bank",
  "places/store": "dimart",
  "people/store_guy": "dimart",
  "places/yangs": "yangs",
  "people/yangsgirl": "yangs",
  chinese_takeout: "yangs",
  "places/psych": "university",
  "places/hospital_desk": "hospital",
  "places/hospital_room": "hospital",
  "places/hospital_ambulance": "hospital",
  "people/m_doctor": "hospital",
  "background/background_church": "ceremony",
  "background/background_celemony": "ceremony",
  "places/funeral-ceremony": "ceremony",
  "places/funeral-ceremony2": "ceremony",
  "people/churchguy_h": "ceremony",
  "places/palors": "sneak",
  "places/funeral_enemy": "sneak",
  "places/funeral_enemy_police": "sneak",
  "places/desk_enemy": "sneak",
  bar: "club",
  "places/desk": "desk",
  "places/embalming-room": "desk",
  "places/embalming-woman": "desk",
  "places/creamation_oven": "desk",
  "places/fire": "desk",
  "places/funeral_home(black)": "desk",
  "places/funeral_home(sucky)": "desk",
  morning_coffee: "desk",
  closed: "desk",
  wait: "desk",
};

/** Ambience beds by picture: the original's looping picture sounds, and the remaster's extras. */
export const PICTURE_AMBIENCE: Record<string, AmbienceId> = {
  "places/desk": "amb-clock",
  "places/desk_enemy": "amb-clock",
  "places/embalming-room": "amb-bubbles",
  "places/embalming-woman": "amb-bubbles",
  "places/fire": "amb-fire",
  "places/creamation_oven": "amb-fire",
  "places/hospital_room": "amb-monitor",
  "places/hospital_desk": "amb-hospital",
  morning_coffee: "amb-birds",
  closed: "amb-night",
  "places/yangs": "amb-kitchen",
  "places/palors": "amb-street",
  "places/funeral_enemy": "amb-street",
  "places/funeral_enemy_police": "amb-street",
  "places/funeral-ceremony": "amb-wind",
  "background/background_celemony": "amb-wind",
};

/** The parlor backgrounds (one per parlor level) tick with the clock on the desk and in a sale. */
const PARLOR_BACKGROUNDS = new Set([
  "background/background_1",
  "background/background_2",
  "background/background_3",
  "background/background_4",
  "background/background_5",
  "background/background_7",
]);

/** One-shots when a picture appears: the original's picture sounds, by function. */
export const PICTURE_SOUNDS: Record<string, SoundId> = {
  "stuff/money_bag": "cash-register",
  "stuff/money_bag_2": "coins",
  "stuff/toilet": "toilet-flush",
  "stuff/battle_lose": "gong",
  "stuff/lottery_win": "bingo-win",
  "stuff/lottery_lose": "bingo-lose",
  "stuff/lotteryticket": "bingo-ball",
  "ring/ring": "glint",
  "ring/ring&hand": "glint",
  "animals/dog-dragging-hand": "growl",
  "animals/rattler": "rattle",
  "mother/happy": "harp-good-news",
  "people/jesus_happy": "angelic",
  "places/hospital_ambulance": "siren",
  "places/funeral_enemy_police": "siren",
  "places/psych": "psychic",
  wait: "doorbell",
  "stuff/lockpick": "lockpick",
  "stuff/padlock": "padlock-break",
  "stuff/safe": "safe-click",
  "stuff/fire_alarm": "alarm-bell",
  "stuff/red_rose": "harp-good-news",
};

/** Weather on the desk and the map (Expanded `town.weather.id`). */
export const WEATHER_AMBIENCE: Record<string, AmbienceId | null> = {
  clear: null,
  rain: "amb-rain",
  storm: "amb-storm",
  fog: "amb-fogbell",
  snow: "amb-wind",
  heat: "amb-night",
};
export const WEATHER_SOUND: Record<string, SoundId> = { rain: "rain-hit", storm: "thunder" };

/** One-shots for the player's own actions, by button id (prefix match, most specific first). */
export const ACTION_SOUNDS: [prefix: string, sound: SoundId][] = [
  ["solo:end-day", "endday"],
  ["dev:endday", "endday"],
  ["reaper-club:slots:", "slot-machine"],
  ["reaper-club:draw:", "cards"],
  ["reaper-club:shots:", "dice"],
  ["church:card", "bingo-ball"],
  ["city-hall:vote", "ui-stamp"],
  ["city-hall:elect", "ui-stamp"],
  ["city-hall:file", "ui-stamp"],
  ["graveyard:monument", "monument"],
  ["store:restock", "casket-thump"],
  ["spirit-university:psych", "level-up"],
  ["spirit-university:hp", "level-up"],
  ["spirit-university:strength", "level-up"],
];

/** Expanded: the sound for how a sale ended (`View.saleOutcome`); a plain sale has the till's. */
export const SALE_OUTCOME_SOUND: Record<SaleOutcome, SoundId | null> = {
  exact: "fanfare-exact",
  great: "harp-good-news",
  nice: null,
  plain: null,
  walkout: "walkout",
};

/** Expanded: the sound for a message overlay by its kind (`Overlay.messageKind`). */
export const MESSAGE_SOUND: Record<MessageKind, SoundId> = {
  letter: "ui-mail",
  notice: "ui-page",
  reward: "ui-coin",
};

/** What the picker remembers from one View to the next. */
export interface CueMemory {
  music: MusicId | null;
  pictures: string[];
  scene: SceneKind | null;
  day?: number;
  weather?: string;
  tags?: number;
  bpToday?: number;
  money?: number;
  hp?: { me: number; them: number };
  mood?: number;
  chat: number;
  overlay?: string;
  /** The place the player last asked to visit (from the `visit` action). */
  place?: string;
}

export interface Cue {
  /** The loop to play; null keeps silence (the lobby before the door, say) only if `stop`. */
  music: MusicId | null;
  ambience: AmbienceId | null;
  /** The customer's mood (0 to 10) for the negotiation's layers. */
  mood: number;
  sounds: (SoundId | StingerId)[];
}

export const emptyMemory = (): CueMemory => ({ music: null, pictures: [], scene: null, chat: 0 });

const pics = (v: View): string[] => [v.picture?.fg, v.picture?.bg].filter((x): x is string => !!x);

function plain(v: View): string {
  return v.text.map((s) => s.text).join("");
}

function sumTags(v: View): number | undefined {
  const t = v.hud?.tags;
  return t ? t.wood + t.silver + t.gold : undefined;
}

/** The music a View asks for, or null to keep the current one. */
export function musicFor(view: View, mem: CueMemory): MusicId | null {
  if (view.battle) return "battle";
  if (view.customer) return "negotiation";
  if (view.music && ENGINE_MUSIC[view.music]) return ENGINE_MUSIC[view.music] as MusicId;
  // The season's last paper: the engine says so (`news.meteor`), nothing is read from the text.
  if (view.scene === "news" && view.news?.meteor === true) return "meteor";
  if (view.scene !== "location") {
    const s = SCENE_MUSIC[view.scene];
    if (s) return s;
  }
  for (const [prefix, m] of BUTTON_MUSIC)
    if (view.buttons.some((b) => b.id.startsWith(prefix))) return m;
  for (const p of pics(view)) if (PICTURE_MUSIC[p]) return PICTURE_MUSIC[p] as MusicId;
  if (view.scene === "location" && mem.place && PLACE_MUSIC[mem.place])
    return PLACE_MUSIC[mem.place] as MusicId;
  return SCENE_MUSIC[view.scene] ?? mem.music ?? "desk";
}

export function ambienceFor(view: View): AmbienceId | null {
  for (const p of pics(view)) if (PICTURE_AMBIENCE[p]) return PICTURE_AMBIENCE[p] as AmbienceId;
  if (view.buttons.some((b) => b.id.startsWith("graveyard:"))) return "amb-wind";
  const w = view.town?.weather?.id;
  if ((view.scene === "desk" || view.scene === "map") && w && w in WEATHER_AMBIENCE) {
    return WEATHER_AMBIENCE[w] ?? null;
  }
  if ((view.scene === "desk" || view.customer) && pics(view).some((p) => PARLOR_BACKGROUNDS.has(p)))
    return "amb-clock";
  if (view.scene === "desk") return "amb-clock";
  return null;
}

/** Picks the cue for a View, given what the last one left behind. Pure. */
export function pickCue(view: View, prev: CueMemory): { cue: Cue; memory: CueMemory } {
  const sounds: (SoundId | StingerId)[] = [];
  const music = musicFor(view, prev);
  const now = pics(view);

  // The engine's own one-shots.
  for (const id of view.sounds ?? []) {
    const s = ENGINE_SOUNDS[id];
    if (s) sounds.push(s);
  }
  // Pictures that just appeared.
  for (const p of now)
    if (!prev.pictures.includes(p) && PICTURE_SOUNDS[p]) sounds.push(PICTURE_SOUNDS[p] as SoundId);

  // A sale ends. An Expanded View says how (`saleOutcome`: the closeness band, a plain sale or a
  // walkout). The Classic game's Views carry no such field (its transcripts are locked), so for
  // them the original's own words and the customer's last mood stand in: the exact-bill line,
  // or an angry customer who is gone.
  if (prev.mood !== undefined && !view.customer) {
    const outcome = view.saleOutcome;
    if (outcome !== undefined) {
      const sound = SALE_OUTCOME_SOUND[outcome];
      if (sound) sounds.push(sound);
    } else if (/\bPERFECT!/.test(plain(view))) sounds.push("fanfare-exact");
    else if (prev.mood >= 8) sounds.push("walkout");
  }
  // Battle: hits, and how it ended.
  if (view.battle && prev.hp) {
    if (view.battle.them.hp < prev.hp.them) sounds.push("punch");
    if (view.battle.me.hp < prev.hp.me) sounds.push("slap");
    if (view.battle.them.hp <= 0 && prev.hp.them > 0) sounds.push("victory");
    else if (view.battle.me.hp <= 0 && prev.hp.me > 0) sounds.push("defeat");
  } else if (!view.battle && prev.hp && prev.hp.me > 0 && prev.hp.them > 0) {
    sounds.push(now.includes("stuff/battle_lose") ? "defeat" : "victory");
  }
  // Ledger changes.
  const tags = sumTags(view);
  if (tags !== undefined && prev.tags !== undefined && tags > prev.tags) sounds.push("ui-tag");
  const bp = view.hud?.bpToday;
  const money = view.hud?.money;
  const sale = sounds.includes("cash-register") || sounds.includes("coins");
  if (!sale && money !== undefined && prev.money !== undefined && money - prev.money >= 1000)
    sounds.push("cash-register");
  else if (!sale && money !== undefined && prev.money !== undefined && money > prev.money)
    sounds.push("ui-coin");
  else if (!sale && bp !== undefined && prev.bpToday !== undefined && bp > prev.bpToday)
    sounds.push("ui-coin");
  // A new day (the paper, or the desk's day counter).
  const day = view.town?.day ?? view.news?.day;
  if (day !== undefined && prev.day !== undefined && day > prev.day) sounds.push("newday");
  // Weather arriving.
  const weather = view.town?.weather?.id;
  if (weather && prev.weather !== undefined && weather !== prev.weather && WEATHER_SOUND[weather]) {
    sounds.push(WEATHER_SOUND[weather] as SoundId);
  }
  // The cafe: a blip for new lines.
  const chat = view.chat?.length ?? 0;
  if (view.scene === "cafe" && chat > 0) sounds.push("ui-chat");
  // Overlays: a letter or notice is a page; a prompt is the notepad.
  const ov = view.overlay;
  if (ov && ov.id !== prev.overlay) {
    if (ov.kind === "message") {
      // Expanded says what the message is (`messageKind`); a Classic one has only its words.
      const kind = ov.messageKind;
      if (kind !== undefined) sounds.push(MESSAGE_SOUND[kind]);
      else
        sounds.push(
          /letter|mail/i.test(ov.text.map((s) => s.text).join("")) ? "ui-mail" : "ui-page",
        );
    } else if (ov.kind === "textInput") sounds.push("ui-notepad");
  }
  // The front door's sting when the game opens from the lobby.
  if (prev.scene === "lobby" && view.scene !== "lobby") sounds.push("main-stinger");

  const memory: CueMemory = {
    music: music ?? prev.music,
    pictures: now,
    scene: view.scene,
    chat,
  };
  const place = prev.place;
  if (place !== undefined) memory.place = place;
  if (day !== undefined) memory.day = day;
  else if (prev.day !== undefined) memory.day = prev.day;
  if (weather !== undefined) memory.weather = weather;
  else if (prev.weather !== undefined) memory.weather = prev.weather;
  if (tags !== undefined) memory.tags = tags;
  if (bp !== undefined) memory.bpToday = bp;
  if (money !== undefined) memory.money = money;
  if (view.battle) memory.hp = { me: view.battle.me.hp, them: view.battle.them.hp };
  if (view.customer) memory.mood = view.customer.moodLevel;
  if (ov) memory.overlay = ov.id;

  return {
    cue: {
      music: music ?? prev.music,
      ambience: ambienceFor(view),
      mood: view.customer?.moodLevel ?? 0,
      sounds: [...new Set(sounds)],
    },
    memory,
  };
}

/** One-shots for an action the player just took (before the answer arrives). */
export function soundsForAction(action: Action): (SoundId | StingerId)[] {
  if (action.type !== "press") return [];
  for (const [prefix, s] of ACTION_SOUNDS) if (action.buttonId.startsWith(prefix)) return [s];
  return [];
}
