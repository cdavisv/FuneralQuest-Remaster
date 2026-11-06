import type { TownPanel } from "@fq/protocol";
import { addToNews } from "../../classic/news.js";
import { tournamentEndsToday } from "../../classic/players.js";
import { newsConditionMet } from "../../content/newsCondition.js";
import type { Turn } from "../../engine/turn.js";
import type { TownState } from "../../state/types.js";
import { fill } from "../../text/format.js";
import type { NewsEventDef, WeatherDef } from "../content/townTypes.js";
import { modValue } from "../modifiers.js";
import { refreshRating } from "../parlor.js";
import { roll, xp } from "../players.js";
import { advanceArcs, arcDef, beatDef } from "./arcs.js";
import { bankMidnight } from "./bank.js";
import { chainsMidnight } from "./chains.js";
import { bingoMidnight } from "./church.js";
import { cityHallMidnight, seasonDay } from "./cityHall.js";
import { clubMidnight } from "./club.js";
import {
  activePlayers,
  applyModifiers,
  injuryDef,
  injuryTurns,
  isMayor,
  life,
  lifeOf,
  line,
  mayorName,
  mayorOf,
  newTownLife,
  TOWN_MODIFIER_KEYS,
  townLife,
  tr,
  xt,
} from "./life.js";

/**
 * The living town (docs/expanded-rules.md section 22): daily news that
 * changes the rules, the weather, story arcs, and the midnight and morning
 * steps of every town system, run from the registry hooks of section 12.3.
 */

function weighted<T extends { weight?: number }>(turn: Turn, list: readonly T[]): T | undefined {
  const total = list.reduce((s, x) => s + (x.weight ?? 1), 0);
  if (total <= 0) return undefined;
  let r = roll(turn.rng) * total;
  for (const x of list) {
    r -= x.weight ?? 1;
    if (r < 0) return x;
  }
  return list[list.length - 1];
}

/** Section 22.1: today's news story, if any, with its rule changes. */
export function rollNews(turn: Turn): NewsEventDef | undefined {
  const town = turn.town;
  const w = tr(turn).world;
  if (town.day < w.newsFromDay || tournamentEndsToday(town)) return undefined;
  if (roll(turn.rng) >= w.newsChance) return undefined;
  const open = xt(turn).news.filter(
    (n) => (n.minDay ?? 0) <= town.day && newsConditionMet(town, n.when),
  );
  return weighted(turn, open);
}

export function applyNews(turn: Turn, news: NewsEventDef): void {
  const town = turn.town;
  // Section 22.5: `{mayor}` in a story is the mayor's name (elected, or the town's NPC).
  const vars = { mayor: mayorName(turn) };
  addToNews(town, `\`7${fill(news.title, vars)}\r\n`);
  addToNews(town, `\`^${fill(news.message, vars)}\r\n\r\n`);
  applyModifiers(town, news.modifiers, news.days ?? 1, `news:${news.id}`);
  townLife(town).today.news = news.id;
}

/** Section 22.2: today's weather. */
export function rollWeather(turn: Turn): WeatherDef | undefined {
  return weighted(turn, xt(turn).weather);
}

export function applyWeather(turn: Turn, weather: WeatherDef): void {
  applyModifiers(turn.town, weather.modifiers, 1, `weather:${weather.id}`);
  townLife(turn.town).today.weather = weather.id;
}

/** Section 19.1: injuries heal one day each midnight. */
function healInjuries(town: TownState): void {
  for (const p of activePlayers(town)) {
    const l = lifeOf(town, p);
    for (const i of l.injuries) i.days--;
    l.injuries = l.injuries.filter((i) => i.days > 0);
  }
}

/**
 * The midnight hook (section 22.4), on the town stream after Classic's
 * maintenance. A town back on day 1 (a new season) starts its town state
 * again and drops every modifier left from the last season.
 */
export function townMidnight(turn: Turn): void {
  const town = turn.town;
  const l = townLife(town);
  if (town.day === 1 && (l.today.day > 1 || l.bingo.day > 1)) {
    if (town.expanded) {
      town.expanded.life = newTownLife(l.season + 1);
      town.expanded.modifiers = [];
    }
  }
  const t = townLife(town);
  // Yesterday's business first, then today's world.
  clubMidnight(turn);
  bingoMidnight(turn);
  bankMidnight(turn);
  chainsMidnight(turn);
  cityHallMidnight(turn);
  healInjuries(town);
  advanceArcs(turn);
  t.today = { day: town.day, news: null, weather: null };
  const news = rollNews(turn);
  if (news) applyNews(turn, news);
  const weather = rollWeather(turn);
  if (weather) applyWeather(turn, weather);
  for (const p of activePlayers(town)) refreshRating(turn.rules, p);
}

/** Today's weather and news definitions, for the desk and the morning screen. */
export function todayInTown(turn: Turn): { weather?: WeatherDef; news?: NewsEventDef } {
  const today = turn.town.expanded?.life?.today;
  if (!today || today.day !== turn.town.day) return {};
  const content = xt(turn);
  const out: { weather?: WeatherDef; news?: NewsEventDef } = {};
  const weather = content.weather.find((w) => w.id === today.weather);
  if (weather) out.weather = weather;
  const news = content.news.find((n) => n.id === today.news);
  if (news) {
    const vars = { mayor: mayorName(turn) };
    out.news = { ...news, title: fill(news.title, vars), message: fill(news.message, vars) };
  }
  return out;
}

/** The running arc's latest headline, or "". */
export function arcHeadline(turn: Turn): string {
  const state = turn.town.expanded?.life?.arc;
  if (!state) return "";
  const arc = arcDef(xt(turn), state.id);
  const beat = arc ? beatDef(arc, state.beat) : undefined;
  return beat ? fill(beat.headline, { mayor: "", top: "", side: "" }) : "";
}

/**
 * The morning hook (section 22.4, `onPlayerNewDay`): weather, news, the
 * story, the mayor's car, injuries that slow you down, and turns the day's
 * rules add. Returns morning text.
 */
export function townMorning(turn: Turn): string {
  const p = turn.player;
  xp(turn);
  const l = life(turn);
  const t = xt(turn).text;
  const final = tournamentEndsToday(turn.town);
  let text = "";
  const { weather, news } = todayInTown(turn);
  if (weather) {
    text += fill(t.world.morningWeather, {
      label: weather.label,
      line: line(turn, weather.morning),
      effect: weather.effect,
    });
  }
  if (news) text += fill(t.world.morningNews, { title: news.title, effect: news.effect });
  const arc = arcHeadline(turn);
  if (arc !== "") text += fill(t.world.morningArc, { title: arc });
  if (final) return text;
  const extra = Math.round(modValue(turn.town, TOWN_MODIFIER_KEYS.dailyTurns, 0));
  if (extra !== 0) p.turns = Math.max(0, p.turns + extra);
  const mayorTurns = tr(turn).cityHall.election.perks.turns;
  if (isMayor(turn.town, p) && mayorTurns > 0) {
    p.turns += mayorTurns;
    text += fill(t.cityHall.mayorMorning, { turns: mayorTurns });
  }
  if (l.injuries.length > 0) {
    const names = l.injuries.map((i) => injuryDef(turn, i.id)?.name ?? i.id).join(", ");
    text += fill(t.hospital.stillHurt, { list: names });
    const lost = Math.min(p.turns, injuryTurns(turn, p));
    if (lost > 0) {
      p.turns -= lost;
      text += fill(t.hospital.hurtTurns, { turns: lost });
    }
  }
  return text;
}

/** Section 26: the town strip for the desk and the map (`View.town`). */
export function townPanel(turn: Turn): TownPanel {
  const town = turn.town;
  const l = townLife(town);
  const panel: TownPanel = { day: town.day };
  const { weather, news } = todayInTown(turn);
  if (weather) panel.weather = { id: weather.id, label: weather.label, effect: weather.effect };
  if (news) panel.news = { id: news.id, title: news.title, effect: news.effect };
  const o = l.ordinance;
  const od = o && o.until >= town.day ? xt(turn).ordinances.find((d) => d.id === o.id) : undefined;
  if (o && od)
    panel.ordinance = {
      id: od.id,
      title: od.title,
      effect: od.effect,
      until: o.until,
      daysLeft: o.until - town.day,
    };
  const mayor = mayorOf(town);
  if (mayor) panel.mayor = mayor.name;
  const story = arcHeadline(turn);
  if (story !== "") panel.story = story;
  const me = String(turn.playerId);
  const ballots: NonNullable<TownPanel["ballots"]> = [];
  if (l.ballot)
    ballots.push({
      kind: "ordinance",
      closes: l.ballot.closes,
      voted: me in l.ballot.votes,
      daysLeft: Math.max(0, l.ballot.closes - town.day),
    });
  const e = l.election.ballot;
  if (e && e.options.length > 0 && !l.election.held)
    ballots.push({
      kind: "election",
      closes: e.closes,
      voted: me in e.votes,
      daysLeft: Math.max(0, e.closes - seasonDay(town)),
    });
  if (ballots.length > 0) panel.ballots = ballots;
  return panel;
}

/** One status line for the desk: "Fog: robbers' luck. News: ...". */
export function townStatus(turn: Turn): string {
  const { weather, news } = todayInTown(turn);
  const t = xt(turn).text.world;
  if (!weather && !news) return "";
  return fill(t.deskStatus, {
    weather: weather ? `${weather.label} (${weather.effect})` : "",
    news: news ? `${news.title} (${news.effect})` : t.quietNews,
  });
}
