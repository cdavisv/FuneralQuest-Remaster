import type { BallotPanel, Button, View } from "@fq/protocol";
import { mailContinue, sendPacket } from "../../classic/mail.js";
import { addToNews } from "../../classic/news.js";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button, goButton } from "../../engine/view.js";
import type { PlayerState, TownState } from "../../state/types.js";
import { fill, intToCash } from "../../text/format.js";
import type { OrdinanceDef } from "../content/townTypes.js";
import { modValue } from "../modifiers.js";
import { refreshRating } from "../parlor.js";
import { karmaMod, moneyMod, reviewsMod, xr } from "../players.js";
import { appealButtons } from "./arcs.js";
import {
  chainsView,
  foundChain,
  foundPrompt,
  invite,
  invitePicker,
  joinChain,
  leaveChain,
} from "./chains.js";
import {
  activePlayers,
  applyModifiers,
  arrive,
  card,
  cash,
  isMayor,
  life,
  lifeOf,
  mayorName,
  off,
  spent,
  TOWN_MODIFIER_KEYS,
  townLife,
  townScreen,
  tr,
  xt,
} from "./life.js";
import type { Ballot } from "./state.js";

/**
 * City Hall, the Mayor (docs/expanded-rules.md section 18): permits that
 * gate the late parlor upgrades, inspections, the weekly ordinance vote,
 * the season's mayoral election, and the chain registry (section 23).
 * Button ids: `city-hall:permits`, `city-hall:permit:<id>`,
 * `city-hall:inspection`, `city-hall:certify`, `city-hall:bribe`,
 * `city-hall:ordinance`, `city-hall:vote:<id>`, `city-hall:lobby`,
 * `city-hall:election`, `city-hall:file`, `city-hall:elect:<playerId>`,
 * `city-hall:ads`, `city-hall:chains` and the chain commands.
 */
export const CITY_HALL = "city-hall";

function screen(
  turn: Turn,
  text: string,
  buttons: Button[],
  where: "inside" | "outside" | "inspection" = "inside",
): View {
  const t = xt(turn).text.cityHall;
  const pics = xt(turn).pictures;
  const pic =
    (where === "outside"
      ? pics.cityHallOutside
      : where === "inspection"
        ? pics.inspection
        : undefined) ?? pics.cityHall;
  const view = townScreen(turn, {
    title: t.title,
    note: t.note,
    text,
    buttons,
    ...pic,
  });
  view.ballots = ballotPanel(turn);
  return view;
}

/** The hint on the card the player voted for (section 11.5). */
function yourVote(turn: Turn): string {
  const hints = xt(turn).text.hints;
  return hints.yourVote ?? hints.alreadyHave;
}

/** Section 11.5: the ordinance in force, the open ballot and the election, as data. */
export function ballotPanel(turn: Turn): BallotPanel {
  const town = turn.town;
  const l = townLife(town);
  const p = turn.player;
  const me = String(p.id);
  const out: BallotPanel = { election: electionPanel(turn) };
  const cur = l.ordinance && l.ordinance.until >= town.day ? l.ordinance : null;
  const curDef = cur ? ordinanceDef(turn, cur.id) : undefined;
  if (cur && curDef)
    out.inForce = {
      id: curDef.id,
      title: curDef.title,
      effect: curDef.effect,
      until: cur.until,
      daysLeft: cur.until - town.day,
    };
  const ballot = l.ballot;
  if (ballot) {
    const tally = tallyBallot(town, ballot, (v) => voteWeight(turn, v));
    const mine = ballot.votes[me] ?? null;
    const lob = tr(turn).cityHall.ordinance.lobby;
    out.ordinance = {
      closes: ballot.closes,
      daysLeft: Math.max(0, ballot.closes - town.day),
      options: ballot.options.flatMap((id) => {
        const def = ordinanceDef(turn, id);
        if (!def) return [];
        return [
          {
            id,
            title: def.title,
            text: def.text,
            effect: def.effect,
            votes: tally[id] ?? 0,
            mine: mine === id,
            buttonId: `${CITY_HALL}:vote:${id}`,
          },
        ];
      }),
      myVote: mine,
      myWeight: voteWeight(turn, p),
      lobby: {
        price: lob.price,
        max: lob.max,
        bought: mine ? (ballot.bought[me]?.[mine] ?? 0) : 0,
      },
    };
  }
  return out;
}

function electionPanel(turn: Turn): BallotPanel["election"] {
  const e = tr(turn).cityHall.election;
  const el = townLife(turn.town).election;
  const p = turn.player;
  const phase = electionPhase(turn);
  const day = seasonDay(turn.town);
  const voting = phase === "voting" && el.ballot ? el.ballot : null;
  const tally = voting ? electionTally(turn.town, voting, el.ads) : null;
  const myVote = voting?.votes[String(p.id)] ?? null;
  const ids = voting ? voting.options.map(Number) : el.candidates;
  return {
    phase,
    filingUntil: e.fileUntil,
    votingUntil: e.voteUntil,
    seasonDay: day,
    daysLeft:
      phase === "filing"
        ? Math.max(0, e.fileUntil - day)
        : phase === "voting"
          ? Math.max(0, e.voteUntil - day)
          : 0,
    fee: e.fee,
    ads: { price: e.ads.price, max: e.ads.max, mine: el.ads[String(p.id)] ?? 0 },
    filed: el.candidates.includes(p.id),
    candidates: ids.flatMap((id) => {
      const who = turn.town.players[id];
      if (!who) return [];
      const row: BallotPanel["election"]["candidates"][number] = {
        playerId: id,
        name: who.name,
        ads: el.ads[String(id)] ?? 0,
        mine: myVote === String(id),
        me: id === p.id,
      };
      if (tally) {
        row.votes = tally[String(id)] ?? 0;
        row.buttonId = `${CITY_HALL}:elect:${id}`;
      }
      return [row];
    }),
    mayor: mayorName(turn),
  };
}

function back(turn: Turn): Button {
  return button(`${CITY_HALL}:main`, xt(turn).text.cityHall.buttons.back);
}

function main(turn: Turn, message = ""): View {
  const t = xt(turn).text.cityHall;
  const text = fill(t.greeting, { mayor: mayorName(turn), player: turn.player.name });
  const buttons: Button[] = [
    button(`${CITY_HALL}:permits`, t.buttons.permits),
    button(`${CITY_HALL}:ordinance`, t.buttons.ordinance),
    button(`${CITY_HALL}:election`, t.buttons.election),
    button(`${CITY_HALL}:chains`, t.buttons.chains),
    { ...button(`${CITY_HALL}:inspection`, t.buttons.inspection), group: "more" },
    ...appealButtons(turn, "city-hall"),
    goButton("map", t.buttons.leave),
  ];
  return screen(turn, message === "" ? text : `${message}\n\n${text}`, buttons, "outside");
}

// ---------------------------------------------------------------- 18.1 permits

export function permitPrice(turn: Turn, id: string): number {
  const base = tr(turn).cityHall.permits[id] ?? 0;
  const step = xr(turn).customer.limitStep;
  return Math.round(modValue(turn.town, TOWN_MODIFIER_KEYS.permitPrice, base) / step) * step;
}

export function hasPermit(player: PlayerState, id: string): boolean {
  return player.expanded?.life?.permits.includes(id) ?? false;
}

function permitsView(turn: Turn, message = ""): View {
  const t = xt(turn).text.cityHall;
  const names = xt(turn).permits;
  let text = message === "" ? t.permitsIntro : `${message}\n\n`;
  const buttons: Button[] = [];
  for (const id of Object.keys(tr(turn).cityHall.permits)) {
    const price = permitPrice(turn, id);
    const name = names[id]?.name ?? id;
    text += fill(t.permitLine, {
      name,
      price: intToCash(price),
      description: names[id]?.description ?? "",
    });
    let b = card(`${CITY_HALL}:permit:${id}`, name, cash(price));
    if (hasPermit(turn.player, id)) b = off(b, xt(turn).text.hints.alreadyHave);
    else if (turn.player.money < price) b = off(b, xt(turn).text.hints.notEnoughCash);
    buttons.push(b);
  }
  buttons.push(back(turn));
  return screen(turn, text, buttons);
}

function buyPermit(turn: Turn, id: string): View {
  if (tr(turn).cityHall.permits[id] === undefined) throw new Error("No such permit");
  const price = permitPrice(turn, id);
  const p = turn.player;
  if (hasPermit(p, id) || p.money < price) throw new Error("Cannot buy that permit");
  moneyMod(p, -price);
  spent(turn, "permits", price);
  life(turn).permits.push(id);
  const name = xt(turn).permits[id]?.name ?? id;
  return permitsView(turn, fill(xt(turn).text.cityHall.permitBought, { name }));
}

// ---------------------------------------------------------------- 18.2 inspections

function inspectionView(turn: Turn, message = ""): View {
  const t = xt(turn).text.cityHall;
  const i = tr(turn).cityHall.inspection;
  const hints = xt(turn).text.hints;
  const p = turn.player;
  const l = life(turn);
  let text =
    l.certifiedUntil >= turn.town.day
      ? fill(t.certifiedUntil, { until: l.certifiedUntil })
      : fill(t.inspectionIntro, { until: l.certifiedUntil });
  if (message !== "") text = `${message}\n\n${text}`;
  let certify: Button = {
    ...button(`${CITY_HALL}:certify`, t.buttons.certify),
    detail: cash(i.certificate.price),
  };
  let bribe: Button = {
    ...button(`${CITY_HALL}:bribe`, t.buttons.bribe),
    detail: cash(i.bribe.price),
  };
  if (l.certifiedUntil >= turn.town.day) {
    certify = off(certify, hints.alreadyHave);
    bribe = off(bribe, hints.alreadyHave);
  } else {
    if (p.money < i.certificate.price) certify = off(certify, hints.notEnoughCash);
    if (p.karma > i.bribe.karmaAtMost) bribe = off(bribe, hints.karmaTooHigh);
    else if (p.money < i.bribe.price) bribe = off(bribe, hints.notEnoughCash);
  }
  return screen(turn, text, [certify, bribe, back(turn)], "inspection");
}

function certify(turn: Turn, how: "certify" | "bribe"): View {
  const i = tr(turn).cityHall.inspection;
  const t = xt(turn).text.cityHall;
  const p = turn.player;
  const l = life(turn);
  if (l.certifiedUntil >= turn.town.day) throw new Error("Already certified");
  if (how === "certify") {
    if (p.money < i.certificate.price) throw new Error("Not enough cash");
    moneyMod(p, -i.certificate.price);
    spent(turn, "inspection", i.certificate.price);
    l.certifiedUntil = turn.town.day + i.certificate.days - 1;
    reviewsMod(p, xr(turn), i.certificate.reviews);
    refreshRating(turn.rules, p);
    return inspectionView(turn, fill(t.certified, { days: i.certificate.days }));
  }
  if (p.karma > i.bribe.karmaAtMost || p.money < i.bribe.price) throw new Error("Cannot bribe");
  moneyMod(p, -i.bribe.price);
  spent(turn, "inspection", i.bribe.price);
  karmaMod(p, i.bribe.karma);
  l.certifiedUntil = turn.town.day + i.bribe.days - 1;
  refreshRating(turn.rules, p);
  return inspectionView(turn, t.bribed);
}

/** Section 18.2: the chance (percent) a parlor passes an inspection. */
export function passChance(turn: Turn, p: PlayerState): number {
  const i = tr(turn).cityHall.inspection;
  const raw = i.base + p.rating * i.ratingWeight + (p.karma - 50) * i.karmaWeight;
  return Math.round(Math.min(i.max, Math.max(i.min, raw)));
}

/** Section 18.2, at midnight: the inspector calls on one parlor that has built something. */
function inspect(turn: Turn): void {
  const town = turn.town;
  const i = tr(turn).cityHall.inspection;
  const t = xt(turn).text.cityHall;
  const parlors = activePlayers(town).filter((p) => (p.expanded?.upgrades.length ?? 0) > 0);
  if (parlors.length === 0) return;
  const rng = turn.rng;
  const p = parlors[rng.random(parlors.length)] as PlayerState;
  const l = lifeOf(town, p);
  const rules = xr(turn);
  if (l.certifiedUntil >= town.day || rng.random(100) < passChance(turn, p)) {
    reviewsMod(p, rules, i.passReviews);
    sendPacket(town, p.id, { type: "text", text: t.inspectPassMail });
  } else {
    const fine = Math.min(i.fine.max, Math.floor(p.money * i.fine.share));
    moneyMod(p, -fine);
    reviewsMod(p, rules, i.fine.reviews);
    sendPacket(town, p.id, {
      type: "text",
      text: fill(t.inspectFailMail, { fine: intToCash(fine) }),
    });
    addToNews(town, fill(t.inspectFailNews, { parlor: p.parlor, name: p.name }), "crime");
  }
  mailContinue(turn, p.id);
  refreshRating(turn.rules, p);
}

// ---------------------------------------------------------------- 18.3 ordinances

function ordinanceDef(turn: Turn, id: string): OrdinanceDef | undefined {
  return xt(turn).ordinances.find((o) => o.id === id);
}

/** A voter's weight on an ordinance ballot: 1, or the mayor's perk (section 18.4). */
function voteWeight(turn: Turn, voter: PlayerState): number {
  return isMayor(turn.town, voter) ? tr(turn).cityHall.election.perks.ordinanceVotes : 1;
}

/** Section 18.3: votes per option (cast votes with their weight, plus votes bought). */
export function tallyBallot(
  town: TownState,
  ballot: Ballot,
  weight: (voter: PlayerState) => number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of ballot.options) out[o] = 0;
  for (const [voter, option] of Object.entries(ballot.votes)) {
    const p = town.players[Number(voter)];
    if (!p?.active || out[option] === undefined) continue;
    out[option] += weight(p);
  }
  for (const [buyer, byOption] of Object.entries(ballot.bought)) {
    if (!town.players[Number(buyer)]?.active) continue;
    for (const [option, n] of Object.entries(byOption)) {
      if (out[option] !== undefined) out[option] += n;
    }
  }
  return out;
}

function winner(turn: Turn, tally: Record<string, number>): { id: string; votes: number } | null {
  let best = 0;
  let tied: string[] = [];
  for (const [id, n] of Object.entries(tally)) {
    if (n > best) {
      best = n;
      tied = [id];
    } else if (n === best && n > 0) tied.push(id);
  }
  if (best === 0) return null;
  const id =
    tied.length === 1 ? (tied[0] as string) : (tied[turn.rng.random(tied.length)] as string);
  return { id, votes: best };
}

function ordinanceView(turn: Turn, message = ""): View {
  const t = xt(turn).text.cityHall;
  const hints = xt(turn).text.hints;
  const l = townLife(turn.town);
  const p = turn.player;
  const cur = l.ordinance && l.ordinance.until >= turn.town.day ? l.ordinance : null;
  const curDef = cur ? ordinanceDef(turn, cur.id) : undefined;
  const current = curDef
    ? fill(t.currentOrdinance, {
        title: curDef.title,
        effect: curDef.effect,
        until: cur?.until ?? 0,
      })
    : t.noOrdinance;
  const ballot = l.ballot;
  let text = ballot
    ? fill(t.ordinanceIntro, { current, closes: ballot.closes })
    : `${current}\n${t.noBallot}`;
  if (message !== "") text = `${message}\n\n${text}`;
  const buttons: Button[] = [];
  if (ballot) {
    const tally = tallyBallot(turn.town, ballot, (v) => voteWeight(turn, v));
    const mine = ballot.votes[String(p.id)];
    for (const id of ballot.options) {
      const def = ordinanceDef(turn, id);
      if (!def) continue;
      text += `\n\`w${def.title}\`$: ${def.text} \`5(${def.effect})\`$`;
      let b = card(
        `${CITY_HALL}:vote:${id}`,
        def.title,
        fill(t.votesDetail, { votes: tally[id] ?? 0 }),
      );
      if (mine === id) b = { ...off(b, yourVote(turn)), selected: true };
      buttons.push(b);
    }
    const lob = tr(turn).cityHall.ordinance.lobby;
    const boughtNow = mine ? (ballot.bought[String(p.id)]?.[mine] ?? 0) : 0;
    let lobby: Button = {
      ...button(`${CITY_HALL}:lobby`, t.buttons.lobby),
      detail: cash(lob.price),
    };
    if (!mine) lobby = off(lobby, hints.notNow);
    else if (boughtNow >= lob.max) lobby = off(lobby, fill(hints.limitReached, { limit: lob.max }));
    else if (p.money < lob.price) lobby = off(lobby, hints.notEnoughCash);
    buttons.push(lobby);
  }
  buttons.push(back(turn));
  return screen(turn, text, buttons);
}

function vote(turn: Turn, id: string): View {
  const ballot = townLife(turn.town).ballot;
  if (!ballot?.options.includes(id)) throw new Error("No such ordinance on the ballot");
  ballot.votes[String(turn.player.id)] = id;
  const title = ordinanceDef(turn, id)?.title ?? id;
  return ordinanceView(turn, fill(xt(turn).text.cityHall.voted, { title }));
}

function lobby(turn: Turn): View {
  const ballot = townLife(turn.town).ballot;
  const lob = tr(turn).cityHall.ordinance.lobby;
  const p = turn.player;
  const mine = ballot?.votes[String(p.id)];
  if (!ballot || !mine) throw new Error("Vote first");
  const bought = ballot.bought[String(p.id)] ?? {};
  if ((bought[mine] ?? 0) >= lob.max || p.money < lob.price) throw new Error("Cannot lobby");
  moneyMod(p, -lob.price);
  spent(turn, "lobby", lob.price);
  bought[mine] = (bought[mine] ?? 0) + 1;
  ballot.bought[String(p.id)] = bought;
  const title = ordinanceDef(turn, mine)?.title ?? mine;
  return ordinanceView(turn, fill(xt(turn).text.cityHall.lobbied, { title }));
}

/**
 * Section 18.3, at midnight: a ballot past its last day is counted and the
 * winner rules for the next `every` days; a new ballot of `candidates`
 * ordinances opens every `every` days (day 1, 8, 15, ...) if it closes
 * within the season.
 */
function ordinanceMidnight(turn: Turn): void {
  const town = turn.town;
  const l = townLife(town);
  const o = tr(turn).cityHall.ordinance;
  const t = xt(turn).text.cityHall;
  if (l.ballot && town.day > l.ballot.closes) {
    const tally = tallyBallot(town, l.ballot, (v) => voteWeight(turn, v));
    const win = winner(turn, tally);
    const def = win ? ordinanceDef(turn, win.id) : undefined;
    if (win && def) {
      l.ordinance = { id: def.id, from: town.day, until: town.day + o.every - 1 };
      applyModifiers(town, def.modifiers, o.every, `ordinance:${def.id}`);
      addToNews(
        town,
        fill(t.ordinanceNews, {
          title: def.title,
          text: def.text,
          effect: def.effect,
          votes: win.votes,
        }),
      );
    } else addToNews(town, t.noVotesNews);
    l.ballot = null;
  }
  const s = town.settings;
  const closes = town.day + o.every - 1;
  const fits = !s.tournamentActive || closes <= s.tournamentDays;
  if (!l.ballot && (town.day - 1) % o.every === 0 && fits) {
    const pool = [...xt(turn).ordinances];
    const options: string[] = [];
    while (options.length < o.candidates && pool.length > 0) {
      const [d] = pool.splice(turn.rng.random(pool.length), 1);
      if (d) options.push(d.id);
    }
    if (options.length > 0) l.ballot = { options, votes: {}, bought: {}, opened: town.day, closes };
  }
}

// ---------------------------------------------------------------- 18.4 the election

/** The day of the season: the game day in a tournament town, else it repeats every 30 days. */
export function seasonDay(town: TownState): number {
  const s = town.settings;
  if (s.tournamentActive) return town.day;
  return ((town.day - 1) % 30) + 1;
}

export type ElectionPhase = "filing" | "voting" | "done";

export function electionPhase(turn: Turn): ElectionPhase {
  const e = tr(turn).cityHall.election;
  const day = seasonDay(turn.town);
  if (townLife(turn.town).election.held) return "done";
  if (day <= e.fileUntil) return "filing";
  if (day <= e.voteUntil) return "voting";
  return "done";
}

/**
 * Section 18.4: one vote per voter, plus one per campaign ad; a candidate
 * always has at least one (their own), so a lone candidate wins unopposed.
 */
export function electionTally(
  town: TownState,
  ballot: Ballot,
  ads: Record<string, number>,
): Record<string, number> {
  const tally = tallyBallot(town, ballot, () => 1);
  for (const id of ballot.options) tally[id] = Math.max(1, (tally[id] ?? 0) + (ads[id] ?? 0));
  return tally;
}

function electionView(turn: Turn, message = ""): View {
  const t = xt(turn).text.cityHall;
  const hints = xt(turn).text.hints;
  const e = tr(turn).cityHall.election;
  const el = townLife(turn.town).election;
  const p = turn.player;
  const phase = electionPhase(turn);
  const names = el.candidates
    .map((id) => turn.town.players[id]?.name ?? "")
    .filter((n) => n !== "");
  const candidates = names.length === 0 ? t.noCandidates : names.join(", ");
  let text: string;
  if (phase === "filing")
    text = fill(t.electionFiling, {
      fee: intToCash(e.fee),
      until: e.fileUntil,
      candidates,
      rating: e.perks.rating,
      turns: e.perks.turns,
    });
  else if (phase === "voting") text = fill(t.electionVoting, { until: e.voteUntil, candidates });
  else text = fill(t.electionDone, { name: mayorName(turn) });
  if (message !== "") text = `${message}\n\n${text}`;
  const buttons: Button[] = [];
  const candidate = el.candidates.includes(p.id);
  if (phase === "filing") {
    let file: Button = { ...button(`${CITY_HALL}:file`, t.buttons.file), detail: cash(e.fee) };
    if (candidate) file = off(file, hints.alreadyHave);
    else if (p.money < e.fee) file = off(file, hints.notEnoughCash);
    buttons.push(file);
  }
  if (phase === "voting" && el.ballot) {
    const tally = electionTally(turn.town, el.ballot, el.ads);
    const mine = el.ballot.votes[String(p.id)];
    for (const id of el.ballot.options) {
      const who = turn.town.players[Number(id)];
      if (!who) continue;
      let b = card(
        `${CITY_HALL}:elect:${id}`,
        who.name,
        fill(t.votesDetail, { votes: tally[id] ?? 0 }),
      );
      if (mine === id) b = { ...off(b, yourVote(turn)), selected: true };
      buttons.push(b);
    }
  }
  if (phase !== "done" && candidate) {
    const ads = el.ads[String(p.id)] ?? 0;
    let ad: Button = { ...button(`${CITY_HALL}:ads`, t.buttons.ads), detail: cash(e.ads.price) };
    if (ads >= e.ads.max) ad = off(ad, fill(hints.limitReached, { limit: e.ads.max }));
    else if (p.money < e.ads.price) ad = off(ad, hints.notEnoughCash);
    buttons.push(ad);
  }
  buttons.push(back(turn));
  return screen(turn, text, buttons);
}

function file(turn: Turn): View {
  const e = tr(turn).cityHall.election;
  const el = townLife(turn.town).election;
  const p = turn.player;
  if (electionPhase(turn) !== "filing" || el.candidates.includes(p.id) || p.money < e.fee)
    throw new Error("Cannot file");
  moneyMod(p, -e.fee);
  spent(turn, "election", e.fee);
  el.candidates.push(p.id);
  return electionView(turn, xt(turn).text.cityHall.filed);
}

function buyAds(turn: Turn): View {
  const e = tr(turn).cityHall.election;
  const el = townLife(turn.town).election;
  const p = turn.player;
  if (electionPhase(turn) === "done" || !el.candidates.includes(p.id))
    throw new Error("Not a candidate");
  const key = String(p.id);
  if ((el.ads[key] ?? 0) >= e.ads.max || p.money < e.ads.price) throw new Error("Cannot buy ads");
  moneyMod(p, -e.ads.price);
  spent(turn, "election", e.ads.price);
  el.ads[key] = (el.ads[key] ?? 0) + 1;
  return electionView(turn, xt(turn).text.cityHall.adsBought);
}

function elect(turn: Turn, id: string): View {
  const el = townLife(turn.town).election;
  if (electionPhase(turn) !== "voting" || !el.ballot?.options.includes(id))
    throw new Error("Not on the ballot");
  el.ballot.votes[String(turn.player.id)] = id;
  const name = turn.town.players[Number(id)]?.name ?? "";
  return electionView(turn, fill(xt(turn).text.cityHall.electionVoted, { name }));
}

/** Section 18.4, at midnight: open the vote after filing; count it after the last voting day. */
function electionMidnight(turn: Turn): void {
  const town = turn.town;
  const e = tr(turn).cityHall.election;
  const t = xt(turn).text.cityHall;
  const l = townLife(town);
  const el = l.election;
  const day = seasonDay(town);
  if (day === 1 && town.day > 1) {
    // A new term in a town without seasons.
    for (const p of activePlayers(town)) lifeOf(town, p).mayor = false;
    l.election = { candidates: [], ads: {}, ballot: null, mayor: null, mayorName: "", held: false };
    return;
  }
  if (el.held) return;
  el.candidates = el.candidates.filter((id) => town.players[id]?.active);
  if (day === e.fileUntil + 1) {
    el.ballot = {
      options: el.candidates.map(String),
      votes: {},
      bought: {},
      opened: town.day,
      closes: e.voteUntil,
    };
  }
  if (day === e.voteUntil + 1) {
    el.held = true;
    const ballot = el.ballot;
    const tally = ballot ? electionTally(town, ballot, el.ads) : {};
    const win = winner(turn, tally);
    const mayor = win ? town.players[Number(win.id)] : undefined;
    if (mayor?.active && win) {
      el.mayor = mayor.id;
      el.mayorName = mayor.name;
      lifeOf(town, mayor).mayor = true;
      refreshRating(turn.rules, mayor);
      addToNews(town, fill(t.electedNews, { name: mayor.name, votes: win.votes }));
      sendPacket(town, mayor.id, { type: "text", text: t.electedMail });
      mailContinue(turn, mayor.id);
    } else addToNews(town, t.noElectionNews);
    el.ballot = null;
  }
}

export function cityHallMidnight(turn: Turn): void {
  inspect(turn);
  ordinanceMidnight(turn);
  electionMidnight(turn);
}

export const cityHallModule: LocationModule = {
  id: CITY_HALL,
  enter(turn) {
    arrive(turn, xt(turn).text.cityHall.title, CITY_HALL);
    return main(turn);
  },
  press(turn, command) {
    const [verb, arg = ""] = [command.split(":")[0], command.split(":").slice(1).join(":")];
    switch (verb) {
      case "main":
        return main(turn);
      case "permits":
        return permitsView(turn);
      case "permit":
        return buyPermit(turn, arg);
      case "inspection":
        return inspectionView(turn);
      case "certify":
        return certify(turn, "certify");
      case "bribe":
        return certify(turn, "bribe");
      case "ordinance":
        return ordinanceView(turn);
      case "vote":
        return vote(turn, arg);
      case "lobby":
        return lobby(turn);
      case "election":
        return electionView(turn);
      case "file":
        return file(turn);
      case "ads":
        return buyAds(turn);
      case "elect":
        return elect(turn, arg);
      case "chains":
        return chainsView(turn);
      case "found":
        return foundPrompt(turn);
      case "invite":
        return invitePicker(turn);
      case "join":
        return joinChain(turn, arg);
      case "leavechain":
        return leaveChain(turn);
    }
    throw new Error(`Unknown City Hall command ${command}`);
  },
  submitText(turn, overlayId, text) {
    if (overlayId !== `${CITY_HALL}:chainname`) throw new Error(`Unknown overlay ${overlayId}`);
    return foundChain(turn, text);
  },
  pickPlayer(turn, overlayId, playerId) {
    if (overlayId !== `${CITY_HALL}:invitepick`) throw new Error(`Unknown overlay ${overlayId}`);
    return invite(turn, playerId);
  },
};
