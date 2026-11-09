import type { Difficulty, PersonalityId, StepEvent } from "@fq/bots";
import {
  type ClassicRules,
  type ContentPack,
  type CustomerState,
  type ExpandedRules,
  type PlayerState,
  pvpGain,
  stockCapacity,
  type TownState,
  wholesalePrice,
} from "@fq/core";
import type { View } from "@fq/protocol";
import type { Issue, Tally } from "./metrics.js";

/**
 * The Expanded part of a town's report (docs/balance/expanded-baseline.md).
 * Everything is a sum or a count in flat string-keyed counters, so towns
 * merge by adding. The simulator reads the town's state to score what
 * happened (who lost what, which trait walked out); the bots never do.
 */
export type Counters = Record<string, number>;

export interface XSeat {
  playerId: number;
  personality: PersonalityId;
  difficulty: Difficulty;
  bp: number;
  money: number;
  savings: number;
  karma: number;
  /** "good" (karma 70+), "evil" (30 or less) or "neutral" at the end of the season. */
  path: string;
  rivalry: string;
  /** Joined on this game day (late joiners), or 1. */
  joined: number;
  place: number;
  /** BP lost to other players (parlor fights, duels, hits) over the season. */
  pvpLost: number;
  /** Did this personality fight (start a parlor fight, duel or hit) at least once. */
  fought: boolean;
  chain: boolean;
  mayor: boolean;
  /** Upgrades owned, monuments built. */
  upgrades: number;
  monuments: number;
  /** BP gained over each of the player's own days (index = game day - 1), for the upgrade returns. */
  daily: number[];
  /** The game day each upgrade was bought, and the first day each new place was used (`place.<name>`). */
  bought: Record<string, number>;
  /** Net dollars (in minus out) and dollars out at each new place over the season. */
  placeNet: Record<string, number>;
  placeOut: Record<string, number>;
}

export interface XTownReport {
  /** Per personality. */
  byPersonality: Record<string, Counters>;
  /** Per difficulty. */
  byDifficulty: Record<string, Counters>;
  /** Town-wide counters (traits, actions, the house, elections, chains). */
  town: Counters;
  seats: XSeat[];
  /** Chains alive at the end: member personalities and score. */
  chains: { members: string[]; score: number; memberBp: number }[];
}

export function emptyX(): XTownReport {
  return { byPersonality: {}, byDifficulty: {}, town: {}, seats: [], chains: [] };
}

function add(c: Counters, key: string, v = 1): void {
  if (v === 0 || !Number.isFinite(v)) return;
  c[key] = (c[key] ?? 0) + v;
}

/** Normalised action key for the usage tables (one key per choice, not per card). */
export function actionKey(e: { action: StepEvent["action"] }): string | null {
  const a = e.action;
  if (a.type === "visit") return `place:${a.placeId}`;
  if (a.type === "pickPlayer") return a.playerId === null ? null : `pick:${a.overlayId}`;
  if (a.type === "submitText") return a.text === null ? null : `text:${a.overlayId}`;
  if (a.type !== "press") return null;
  return buttonKey(a.buttonId);
}

export function buttonKey(id: string): string | null {
  if (id.startsWith("go:") || /:(main|back)$/.test(id) || id === "neg:back") return null;
  if (id.startsWith("neg:hand:")) return "neg:card";
  if (/^reaper-club:(draw|slots|shots):/.test(id)) return id.replace(/:\d+$/, "");
  if (id.startsWith("church:card:")) return "church:bingo-card";
  if (id.startsWith("city-hall:vote:")) return "city-hall:vote";
  if (id.startsWith("city-hall:elect:")) return "city-hall:elect";
  if (id.startsWith("city-hall:join:")) return "city-hall:join";
  if (id.startsWith("hospital:treat:")) return "hospital:treat";
  if (id.startsWith("prep:opt:")) return "prep:choice";
  if (id.startsWith("store:look:")) return "store:hearse-look";
  if (id.startsWith("arc:give:")) return id.replace(/:\d+$/, "");
  if (id.startsWith("bank:ttier:")) return "bank:transfer-tier";
  if (id.startsWith("script:")) return null;
  return id;
}

/** The eight places of docs/expanded-rules.md sections 30 and 31 (balance round 19), by button or picker id. */
export const PLACE_SYSTEMS: [RegExp, string][] = [
  [/(^|:)police:/, "police"],
  [/(^|:)crematorium:/, "crematorium"],
  [/(^|:)florist:/, "florist"],
  [/(^|:)gazette:/, "gazette"],
  [/(^|:)coroner:/, "coroner"],
  [/(^|:)health-department:/, "health dept"],
  [/(^|:)pawn-shop:/, "pawn"],
  [/(^|:)mournes:/, "mournes"],
];

/** The system names of those places. */
export const PLACE_NAMES = PLACE_SYSTEMS.map(([, n]) => n);

/** Which system an action belongs to, for money, BP and turns. */
export function systemOf(e: StepEvent): string {
  const a = e.action;
  const id =
    a.type === "press" ? a.buttonId : "overlayId" in a ? `${a.type}:${a.overlayId}` : a.type;
  if (a.type === "exit") return "log-off";
  if (a.type === "visit") return a.placeId === "funeral-home" ? "new day and mail" : "travel";
  if (/^neg:offer:/.test(id)) return "special offers";
  if (/^neg:/.test(id)) return "sales";
  if (/^prep:/.test(id)) return "body prep";
  if (id === "desk:wait") return "wait (events, scripts)";
  if (/^risk:/.test(id)) return "risks";
  if (/^script:|pickPlayer:script/.test(id)) return "scripts";
  if (/^store:(casket|restock)/.test(id)) return "stock";
  if (/^store:(look|buy|hearse)/.test(id)) return "hearse";
  if (/^store:/.test(id) || id.startsWith("pickPlayer:script")) return "store";
  if (/^parlor:buy/.test(id)) return "upgrades";
  if (/^parlor:dig/.test(id)) return "dig";
  if (/^graveyard:monument/.test(id)) return "monuments";
  if (/^graveyard:(tend)/.test(id)) return "tend graves";
  if (/^graveyard:(rob)/.test(id)) return "rob graves";
  if (/graveyard:(swing|shove|yield|pick)/.test(id)) return "duels";
  if (/^church:card|church:bingo/.test(id)) return "bingo";
  if (/^church:confess/.test(id)) return "confession";
  if (/^church:water/.test(id)) return "holy water";
  if (/^church:serve/.test(id)) return "service";
  if (/^church:tithe/.test(id)) return "tithe";
  if (/city-hall:permit/.test(id)) return "permits";
  if (/city-hall:(certify|bribe)/.test(id)) return "inspection";
  if (/city-hall:(vote|lobby)/.test(id)) return "ordinances";
  if (/city-hall:(file|ads|elect)/.test(id)) return "election";
  if (/city-hall:(found|join|invite|leavechain|chainname|invitepick)/.test(id)) return "chains";
  if (/hospital:treat/.test(id)) return "treatment";
  if (/hospital:lead/.test(id)) return "leads";
  if (/reaper-club:(draw|slots|shots)/.test(id)) return "gambling";
  if (/reaper-club:buy/.test(id)) return "black market";
  if (/reaper-club:hitpick|reaper-club:hit/.test(id)) return "hits";
  if (/reaper-club:bodyguard/.test(id)) return "bodyguard";
  if (/reaper-club:seance/.test(id)) return "seance";
  if (/reaper-club:pay/.test(id)) return "club cover";
  for (const [pattern, name] of PLACE_SYSTEMS) if (pattern.test(id)) return name;
  if (/bank:(deposit|withdraw)/.test(id)) return "savings";
  if (/bank:(borrow|repay)/.test(id)) return "loans";
  if (/bank:(tcount|tpick|ttier|transfer)/.test(id)) return "transfers";
  if (/^bank:|go:bank/.test(id)) return "tag exchange";
  if (/^arc:give/.test(id)) return "story appeals";
  if (/^competitors:|^battle:|competitors:/.test(id)) return "parlor PvP";
  if (/^yangs:|yangs:/.test(id)) return "yangs";
  if (/^spirit-university:/.test(id)) return "university";
  if (id === "go:desk" || /^dismiss:|^confirm:mailbox/.test(id)) return "new day and mail";
  if (/^tutorial:/.test(id)) return "tour";
  return "other";
}

/** Systems where nothing may be created: town money net of debt and tags must not rise. */
const NO_MINT = new Set([
  "stock",
  "upgrades",
  "monuments",
  "bingo",
  "confession",
  "holy water",
  "tithe",
  "permits",
  "inspection",
  "ordinances",
  "election",
  "chains",
  "treatment",
  "leads",
  "black market",
  "hits",
  "bodyguard",
  "club cover",
  "savings",
  "loans",
  "transfers",
  "story appeals",
]);

/** Systems that may raise the actor's BP. */
const BP_SOURCES = new Set([
  "sales",
  "special offers",
  "body prep",
  "wait (events, scripts)",
  "risks",
  "scripts",
  "monuments",
  "service",
  "tithe",
  "duels",
  "parlor PvP",
  "new day and mail",
  "log-off",
  "tour",
]);

function netWorth(town: TownState): number {
  let total = 0;
  for (const p of town.players) {
    if (!p.active) continue;
    const l = p.expanded?.life;
    total += p.money + (l?.savings ?? 0) - (l?.loan?.owed ?? 0);
  }
  return total;
}

function townTags(town: TownState): number {
  let total = 0;
  for (const p of town.players) {
    if (!p.active) continue;
    total += (p.tags[0] ?? 0) + (p.tags[1] ?? 0) * 2 + (p.tags[2] ?? 0) * 4;
  }
  const b = town.expanded?.life?.bingo;
  return total + (b?.carry ?? 0);
}

/**
 * Watches every step of an Expanded town and keeps the Expanded report. It
 * also fills the shared sale tallies of the Classic report (sales,
 * walkouts, the closeness bonuses), which the Classic collector cannot
 * score for Expanded customers.
 */
export class XCollector {
  readonly report: XTownReport = emptyX();
  private seatOffered = new Map<number, Set<string>>();
  private seatUsed = new Map<number, Set<string>>();
  private dayOffered = new Map<number, Set<string>>();
  private pvpLost = new Map<number, number>();
  private fought = new Set<number>();
  private lastBeat = "";
  /** Players who pressed Shove in the duel they are in. */
  private shoved = new Set<number>();
  /** BP a player gained each game day of their own (index day - 1), and the day each upgrade was bought. */
  private dailyBp = new Map<number, number[]>();
  private boughtDay = new Map<number, Record<string, number>>();
  private placeNet = new Map<number, Record<string, number>>();
  private placeOut = new Map<number, Record<string, number>>();
  private before: TownState | null = null;
  private dayStart = new Map<
    number,
    { money: number; bp: number; stepMoney: number; stepBp: number }
  >();

  constructor(
    private readonly rules: ClassicRules,
    private readonly content: ContentPack,
    private readonly seatOf: (playerId: number) => {
      personality: PersonalityId;
      difficulty: Difficulty;
      name: string;
    },
    private readonly issue: (kind: Issue["kind"], detail: string, day: number, id: number) => void,
  ) {}

  private get x(): ExpandedRules {
    return this.rules.expanded as ExpandedRules;
  }

  private mine(id: number): Counters {
    const p = this.seatOf(id).personality;
    this.report.byPersonality[p] ??= {};
    return this.report.byPersonality[p] as Counters;
  }

  private both(id: number, key: string, v = 1): void {
    add(this.mine(id), key, v);
    const d = this.seatOf(id).difficulty;
    this.report.byDifficulty[d] ??= {};
    add(this.report.byDifficulty[d] as Counters, key, v);
  }

  beginDay(town: TownState, id: number): void {
    this.dayOffered.set(id, new Set());
    const p0 = town.players[id];
    this.dayStart.set(id, { money: p0?.money ?? 0, bp: p0?.bp ?? 0, stepMoney: 0, stepBp: 0 });
    this.both(id, "playerDays");
    const p = town.players[id];
    if (p) {
      const level = Math.min(p.psych, this.x.psych.maxLevel) + 1;
      add(this.mine(id), `psychDays.${level}`);
    }
  }

  /** What changed outside any step (the morning at log on): plot income, upkeep, pre-need. */
  endDay(town: TownState, id: number): void {
    const start = this.dayStart.get(id);
    const p = town.players[id];
    if (!start || !p) return;
    const dm = p.money - start.money - start.stepMoney;
    const dbp = p.bp - start.bp - start.stepBp;
    const series = this.dailyBp.get(id) ?? [];
    series[town.day - 1] = p.bp - start.bp;
    this.dailyBp.set(id, series);
    if (dm > 0) this.both(id, "money.in.new day (plots, pre-need)", dm);
    if (dm < 0) this.both(id, "money.out.new day (hearse upkeep)", -dm);
    if (dbp !== 0) this.both(id, "bp.new day and mail", dbp);
  }

  /** Classifies and checks one action; fills the shared sale tally. */
  step(e: StepEvent, tally: Tally): void {
    const { before, result, action, playerId: id } = e;
    const after = result.town;
    const was = before.players[id];
    const now = after.players[id];
    if (!was || !now) return;
    const sys = systemOf(e);
    const day = before.day;
    this.both(id, "steps");
    const scene = before.sessions[String(id)]?.scene ?? "lobby";
    this.both(id, `place.${scene}`);
    // Usage.
    const offered = this.dayOffered.get(id) ?? new Set<string>();
    for (const b of e.view.buttons) {
      if (b.enabled === false || e.view.overlay) continue;
      const k = buttonKey(b.id);
      if (k) offered.add(k);
    }
    for (const p of e.view.map ?? []) offered.add(`place:${p.id}`);
    this.dayOffered.set(id, offered);
    const seatOffered = this.seatOffered.get(id) ?? new Set<string>();
    for (const k of offered) seatOffered.add(k);
    this.seatOffered.set(id, seatOffered);
    const key = actionKey(e);
    if (key) {
      const used = this.seatUsed.get(id) ?? new Set<string>();
      used.add(key);
      this.seatUsed.set(id, used);
      add(this.report.town, `use.${key}`);
      this.both(id, `use.${key}`);
    }

    // Money, BP and turns by system.
    let dm = now.money - was.money;
    const ds = this.dayStart.get(id);
    // The morning's hearse upkeep (section 9.5), apart from plot income.
    if (
      was.expanded &&
      now.expanded &&
      now.dayLastLoggedOn !== was.dayLastLoggedOn &&
      now.expanded.daily.hearsePaid
    ) {
      const upkeep = this.x.hearses[now.transportation]?.upkeep ?? 0;
      if (upkeep > 0) {
        this.both(id, "money.out.hearse upkeep", upkeep);
        dm += upkeep;
        if (ds) ds.stepMoney -= upkeep;
      }
    }
    if (ds) {
      ds.stepMoney += dm;
      ds.stepBp += now.bp - was.bp;
    }
    if (dm > 0) this.both(id, `money.in.${sys}`, dm);
    if (dm < 0) this.both(id, `money.out.${sys}`, -dm);
    const dbp = now.bp - was.bp;
    if (dbp !== 0) this.both(id, `bp.${sys}`, dbp);
    const dt = now.turns - was.turns;
    if (dt < 0) this.both(id, `turns.${sys}`, -dt);
    // The new places: what each press moved besides money (karma, luck, word of mouth).
    if (PLACE_NAMES.includes(sys)) {
      const first = this.boughtDay.get(id) ?? {};
      if (first[`place.${sys}`] === undefined && action.type === "press") {
        first[`place.${sys}`] = day;
        this.boughtDay.set(id, first);
      }
      const net = this.placeNet.get(id) ?? {};
      net[sys] = (net[sys] ?? 0) + dm;
      this.placeNet.set(id, net);
      if (dm < 0) {
        const out = this.placeOut.get(id) ?? {};
        out[sys] = (out[sys] ?? 0) - dm;
        this.placeOut.set(id, out);
      }
      if (action.type === "press") this.both(id, `press.${sys}`);
      const dk = now.karma - was.karma;
      const dl = now.luck - was.luck;
      const dr = (now.expanded?.reviews ?? 0) - (was.expanded?.reviews ?? 0);
      if (dk !== 0) this.both(id, `karma.${sys}`, dk);
      if (dl !== 0) this.both(id, `luck.${sys}`, dl);
      if (dr !== 0) this.both(id, `reviews.${sys}`, dr);
    }
    const xw = was.expanded;
    const xn = now.expanded;
    const lw = xw?.life;
    const ln = xn?.life;
    const dSave = (ln?.savings ?? 0) - (lw?.savings ?? 0);
    if (dSave !== 0)
      this.both(id, dSave > 0 ? "savings.deposited" : "savings.withdrawn", Math.abs(dSave));

    // Customers.
    if (action.type === "press" && action.buttonId === "desk:wait") {
      const c = after.sessions[String(id)]?.customer;
      if (c?.active && c.flow === "negotiation" && c.expanded && now.turns === was.turns - 1) {
        // The Classic collector counts the turn and the customer into `tally`.
        const cx = c.expanded;
        this.both(id, "customers");
        for (const t of cx.traits) add(this.report.town, `trait.${t}.customers`);
        if (cx.special) add(this.report.town, `special.${cx.special}.customers`);
        if ((lw?.leads ?? 0) > (ln?.leads ?? 0)) this.both(id, "leadCustomers");
        add(this.report.town, `income.${c.income}`);
      }
    }
    if (xw && xn) {
      const rw = xw.record;
      const rn = xn.record;
      const c = before.sessions[String(id)]?.customer;
      if (rn.sales > rw.sales) {
        tally.sales++;
        const gain = rn.saleBp - rw.saleBp;
        tally.salesBp += gain;
        tally.bonusBp += rn.bonusBp - rw.bonusBp;
        if (rn.exact > rw.exact) tally.perfect++;
        else if (rn.great > rw.great) tally.close50++;
        else if (rn.nice > rw.nice) tally.close100++;
        const bill = e.view.customer?.total ?? 0;
        if (c && c.moneyToSpend > 0) tally.capture += Math.min(1, bill / c.moneyToSpend);
        this.both(id, "sales");
        this.both(id, "saleBp", gain);
        this.both(id, "bonusBp", rn.bonusBp - rw.bonusBp);
        this.both(id, "saleMoney", rn.saleMoney - rw.saleMoney);
        if (rn.exact > rw.exact) this.both(id, "exact");
        if (rn.great > rw.great) this.both(id, "great");
        if (rn.nice > rw.nice) this.both(id, "nice");
        if (rn.cremations > rw.cremations) this.both(id, "cremations");
        // The family's mood at Done (Done does not change it): happy and sour families (3.7).
        if (c && c.mood < this.x.scoring.happyBelow) this.both(id, "salesHappy");
        if (c && c.mood >= this.x.scoring.sourAt) this.both(id, "salesSour");
        const cx = c?.expanded;
        if (cx) {
          for (const [cat, tier] of Object.entries(cx.packages)) {
            if (tier > 0) add(this.report.town, `pkg.${cat}.${tier}`);
          }
          add(this.report.town, "pkg.sales");
          add(this.report.town, "cards.sold", cx.bought.length);
          if (cx.special) add(this.report.town, `special.${cx.special}.sales`);
          this.both(id, "actionsPerSale", cx.actions);
          if (cx.listens > 0) this.both(id, "salesListened");
          if (cx.coffee) this.both(id, "salesCoffee");
          this.both(id, "discountsGiven", cx.discounts);
          if (cx.blessed) this.both(id, "salesBlessed");
          if (cx.raised) this.both(id, "salesRaised");
        }
        if (c?.expanded?.practice) this.both(id, "practiceSales");
        this.saleExtras(id, was, now, c);
      }
      if (rn.walkouts > rw.walkouts) {
        tally.walkouts++;
        this.both(id, "walkouts");
        const cx = c?.expanded;
        for (const t of cx?.traits ?? []) add(this.report.town, `trait.${t}.walkouts`);
        if (cx?.special) add(this.report.town, `special.${cx.special}.walkouts`);
      }
      // Purchases and town systems.
      for (const u of xn.upgrades) {
        if (!xw.upgrades.includes(u)) {
          add(this.report.town, `upgrade.${u}`);
          add(this.report.town, `upgradeDay.${u}`, day);
          this.both(id, `upgrade.${u}`);
          const bought = this.boughtDay.get(id) ?? {};
          bought[u] = day;
          this.boughtDay.set(id, bought);
        }
      }
      if (lw && ln) {
        if (ln.monuments > lw.monuments) add(this.report.town, `monument.${ln.monuments}`);
        for (const pmt of ln.permits)
          if (!lw.permits.includes(pmt)) add(this.report.town, `permit.${pmt}`);
        const bought = ln.today.bought.filter(
          (b) => !lw.today.bought.includes(b) || ln.today.day !== lw.today.day,
        );
        if (sys === "black market") for (const b of bought) add(this.report.town, `market.${b}`);
        if (
          (after.expanded?.life?.hits.length ?? 0) > (before.expanded?.life?.hits.length ?? 0) &&
          sys === "hits"
        )
          this.both(id, "hit.hired");
        if (!lw.loan && ln.loan) {
          this.both(id, "loan.taken");
          this.both(id, "loan.amount", ln.loan.owed);
        }
        if (lw.loan && sys === "loans" && dm < 0) this.both(id, "loan.repaid", -dm);
        if (ln.chain && !lw.chain) {
          add(
            this.report.town,
            sys === "chains" && action.type === "submitText" ? "chain.founded" : "chain.joined",
          );
        }
      }
      if (sys === "gambling" && action.type === "press") {
        const [, game, stake] = action.buttonId.split(":");
        const s = Number(stake);
        add(this.report.town, `gamble.${game}.${s}.plays`);
        add(this.report.town, `gamble.${game}.${s}.staked`, s);
        add(this.report.town, `gamble.${game}.${s}.returned`, s + dm);
        this.both(id, "gamble.staked", s);
        this.both(id, "gamble.net", dm);
      }
    }
    if (sys === "duels" || sys === "parlor PvP" || sys === "hits") {
      if (action.type === "pickPlayer" && action.playerId !== null) this.fought.add(id);
      if (action.type === "press" && action.buttonId === "competitors:attack") this.fought.add(id);
    }
    // Duels: the end of one moves BP both ways.
    if (sys === "duels") {
      const d = after.sessions[String(id)]?.sceneData as { over?: boolean; rival?: number } | null;
      const wasOver = (before.sessions[String(id)]?.sceneData as { over?: boolean } | null)?.over;
      if (action.type === "pickPlayer" && action.playerId !== null && d?.rival !== undefined) {
        add(this.report.town, "duel.started");
        this.shoved.delete(id);
      }
      if (action.type === "press" && action.buttonId === "graveyard:shove") {
        this.shoved.add(id);
        add(this.report.town, "duel.shove.pressed");
        this.both(id, "duel.shove.pressed");
      }
      if (d?.over && !wasOver && typeof d.rival === "number") {
        const rival = d.rival;
        const rWas = before.players[rival]?.bp ?? 0;
        const rNow = after.players[rival]?.bp ?? 0;
        const yielded = action.type === "press" && action.buttonId === "graveyard:yield";
        // The challenger's result, split by whether they ever shoved in this duel.
        const kind = this.shoved.has(id) ? "shove" : "noShove";
        add(this.report.town, `duel.${kind}.duels`);
        add(this.report.town, `duel.${kind}.net`, dbp);
        add(this.report.town, `duel.${kind}.${yielded ? "yielded" : dbp > 0 ? "won" : "lost"}`);
        this.shoved.delete(id);
        if (yielded) add(this.report.town, "duel.yielded");
        else if (dbp > 0) add(this.report.town, "duel.challengerWon");
        else add(this.report.town, "duel.challengerLost");
        if (dbp > 0) add(this.report.town, "duel.bpWon", dbp);
        if (dbp < 0) {
          add(this.report.town, "duel.bpLost", -dbp);
          this.lose(id, -dbp, "duel");
        }
        if (rNow < rWas) {
          add(this.report.town, "duel.bpLost", rWas - rNow);
          this.lose(rival, rWas - rNow, "duel");
        }
        if (rNow > rWas) add(this.report.town, "duel.bpWon", rNow - rWas);
      }
    }
    // Other players changed by my action: victims of PvP, walkout gifts.
    for (const other of after.players) {
      if (other.id === id) continue;
      const prev = before.players[other.id];
      if (!prev) continue;
      const d = other.bp - prev.bp;
      if (
        (other.expanded?.placesA?.attacks.length ?? 0) >
        (prev.expanded?.placesA?.attacks.length ?? 0)
      )
        this.both(other.id, "attacked");
      if (d < 0 && sys === "parlor PvP") this.lose(other.id, -d, "fight");
      if (d > 0 && sys === "sales") this.both(other.id, "bp.walkout gifts", d);
      const m = other.money - prev.money;
      if (m < 0 && sys === "parlor PvP") {
        this.both(other.id, "money.out.stolen", -m);
        add(this.report.town, "pvp.cashStolen", -m);
      }
    }
    if (sys === "parlor PvP" && dbp < 0) this.lose(id, -dbp, "fight");

    this.checkStep(e, sys, day);
  }

  /** What a rented oven slot and the florist's bouquets added to this sale (section 30). */
  private saleExtras(
    id: number,
    was: PlayerState,
    now: PlayerState,
    c: CustomerState | undefined,
  ): void {
    const a0 = was.expanded?.placesA;
    const a1 = now.expanded?.placesA;
    if (!a0 || !a1) return;
    const ovens = a0.oven.slots - a1.oven.slots;
    const fee = this.content.expanded?.cremation.fee ?? 0;
    if (ovens > 0 && fee > 0) {
      this.both(id, "oven.used", ovens);
      this.both(id, "oven.saved", ovens * wholesalePrice(this.x, fee));
    }
    const used = a0.flowers.stock - a1.flowers.stock;
    const ex = this.content.expanded;
    if (used > 0 && c?.expanded && ex) {
      const pay = this.x.town.placesA.florist.payout;
      const lines: number[] = [];
      for (const cat of ex.packages) {
        const i = c.expanded.packages[cat.id];
        const tier = i === undefined || i < 1 ? undefined : cat.tiers[i];
        if (tier?.tags.includes("flowers")) lines.push(tier.price);
      }
      for (const i of c.expanded.bought) {
        const item = ex.softSell[i];
        if (item?.tags.includes("flowers")) lines.push(item.price);
      }
      let earned = 0;
      for (const price of lines.slice(0, used))
        earned += Math.min(pay.max, Math.round(price * pay.share));
      this.both(id, "flowers.used", used);
      this.both(id, "flowers.earned", earned);
    }
  }

  private lose(id: number, bp: number, how: string): void {
    this.both(id, `pvpLost.${how}`, bp);
    this.pvpLost.set(id, (this.pvpLost.get(id) ?? 0) + bp);
  }

  private checkStep(e: StepEvent, sys: string, day: number): void {
    const { before, result, playerId: id } = e;
    const after = result.town;
    const was = before.players[id] as PlayerState;
    const now = after.players[id] as PlayerState;
    if (NO_MINT.has(sys)) {
      const w0 = netWorth(before);
      const w1 = netWorth(after);
      if (w1 > w0)
        this.issue("exploit", `money minted by ${sys}: ${w0} to ${w1} (${describe(e)})`, day, id);
      const t0 = townTags(before);
      const t1 = townTags(after);
      if (t1 > t0 && sys !== "black market")
        this.issue("exploit", `tags minted by ${sys}: ${t0} to ${t1} (${describe(e)})`, day, id);
      let bp0 = 0;
      let bp1 = 0;
      for (const p of before.players) if (p.active) bp0 += p.bp;
      for (const p of after.players) if (p.active) bp1 += p.bp;
      if (bp1 > bp0 && !BP_SOURCES.has(sys))
        this.issue("exploit", `BP minted by ${sys}: ${bp0} to ${bp1} (${describe(e)})`, day, id);
    }
    if (now.bp > was.bp && !BP_SOURCES.has(sys))
      this.issue(
        "exploit",
        `BP gained from ${sys}: ${was.bp} to ${now.bp} (${describe(e)})`,
        day,
        id,
      );
    for (const p of after.players) this.checkPlayer(p, day, describe(e));
  }

  checkPlayer(p: PlayerState, day: number, where: string): void {
    if (!p.active) return;
    const x = p.expanded;
    if (!x) return;
    const bad: string[] = [];
    if (p.money < 0) bad.push(`money ${p.money}`);
    if (p.karma < 1 || p.karma > 100) bad.push(`karma ${p.karma}`);
    if (p.rating < 0 || p.rating > 100) bad.push(`rating ${p.rating}`);
    if (x.stock.some((s) => s < 0)) bad.push(`stock ${x.stock.join("/")}`);
    const cap = stockCapacity(this.x, p);
    if (x.stock[0] + x.stock[1] + x.stock[2] > cap) bad.push(`stock over capacity ${cap}`);
    const l = x.life;
    if (l) {
      if (l.savings < 0) bad.push(`savings ${l.savings}`);
      if (l.loan && l.loan.owed < 0) bad.push(`loan ${l.loan.owed}`);
      if (l.injuries.length > this.x.town.hospital.maxInjuries) bad.push("too many injuries");
      if (l.leads < 0 || l.leads > this.x.town.hospital.lead.max) bad.push(`leads ${l.leads}`);
      if (l.holyWater < 0 || l.holyWater > this.x.town.church.holyWater.max)
        bad.push(`holy water ${l.holyWater}`);
      if (l.monuments < 0 || l.monuments > this.x.town.graveyard.monuments.length)
        bad.push(`monuments ${l.monuments}`);
    }
    if (bad.length > 0) this.issue("invariant", `${bad.join(", ")} (${where})`, day, p.id);
  }

  beforeMaintenance(town: TownState): void {
    this.before = structuredClone(town);
    const life = town.expanded?.life;
    if (life?.ballot) {
      add(this.report.town, "ordinance.ballotDays");
      add(this.report.town, "ordinance.votesSeen", Object.keys(life.ballot.votes).length);
      if (life.ballot.closes === town.day) {
        add(this.report.town, "ordinance.ballots");
        add(this.report.town, "ordinance.votes", Object.keys(life.ballot.votes).length);
        add(this.report.town, "ordinance.voters", town.players.filter((p) => p.active).length);
        let lobbied = 0;
        for (const rec of Object.values(life.ballot.bought))
          for (const n of Object.values(rec)) lobbied += n;
        add(this.report.town, "ordinance.lobbied", lobbied);
      }
    }
    const el = life?.election;
    if (el?.ballot && el.ballot.closes === town.day) {
      add(this.report.town, "election.held");
      add(this.report.town, "election.candidates", el.candidates.length);
      add(this.report.town, "election.votes", Object.keys(el.ballot.votes).length);
      add(this.report.town, "election.voters", town.players.filter((p) => p.active).length);
      for (const n of Object.values(el.ads)) add(this.report.town, "election.ads", n);
    }
  }

  afterMaintenance(town: TownState): void {
    const before = this.before;
    this.before = null;
    if (!before) return;
    // How often the living town speaks: news, weather, and the story arc's beats.
    const living = town.expanded?.life;
    if (living) {
      const T = this.report.town;
      add(T, "living.days");
      if (living.today.news) add(T, "living.newsDays");
      if (living.today.weather) add(T, "living.weatherDays");
      if (living.arc) add(T, "living.arcDays");
      const beat = living.arc ? `${living.arc.id}:${living.arc.beat}` : "";
      if (beat !== "" && beat !== this.lastBeat) add(T, "living.arcBeats");
      this.lastBeat = beat;
    }
    for (const p of town.players) {
      const was = before.players[p.id];
      if (!was?.active || !p.active || !p.expanded || !was.expanded) continue;
      const dm = p.money - was.money;
      const lw = was.expanded.life;
      const ln = p.expanded.life;
      const dues = (ln?.spent.chain ?? 0) - (lw?.spent.chain ?? 0);
      if (dues > 0) this.both(p.id, "money.out.chain dues", dues);
      const interest = (ln?.savings ?? 0) - (lw?.savings ?? 0);
      if (interest > 0 && !lw?.loan) this.both(p.id, "savings.interest", interest);
      // A loan collected or written off at this midnight.
      if (lw?.loan && !ln?.loan) {
        const deadbeat = !lw.deadbeat && !!ln?.deadbeat;
        this.both(p.id, deadbeat ? "loan.defaulted" : "loan.collected");
        if (deadbeat) {
          const owed = lw.loan.owed;
          let left = owed - Math.min(was.money, owed);
          left -= Math.min(lw.savings, left);
          for (const tier of [2, 1, 0] as const) {
            const value =
              Math.ceil(((this.rules.casketPrices[tier] ?? 0) * this.x.money.wholesale) / 50) * 50;
            let n = was.expanded.stock[tier];
            while (left > 0 && n > 0) {
              n--;
              left -= value;
            }
          }
          const bp = Math.ceil(Math.max(0, left) / this.x.town.bank.loan.defaultDollarsPerBp);
          this.both(p.id, "loan.writtenOff", Math.max(0, left));
          this.both(p.id, "loan.defaultBp", bp);
          // Section 21.3: a default must cost more BP than the money could have bought.
          if (left > 0 && bp < left * 0.02)
            this.issue(
              "exploit",
              `loan default cheaper than monuments: ${left} for ${bp} BP`,
              town.day,
              p.id,
            );
        }
      }
      const other = dm + dues;
      if (other > 0) this.both(p.id, "money.in.midnight", other);
      if (other < 0) this.both(p.id, "money.out.midnight (fines, collection)", -other);
      // Hits that landed: kneecaps and the BP of the curve.
      // A landed hit injures (section 20.4): any injury the target did not have before.
      const kneecapped = (ln?.injuries ?? []).some(
        (i) => !lw?.injuries.some((j) => j.id === i.id && j.days <= i.days),
      );
      const booked =
        before.expanded?.life?.hits.filter((h) => h.target === p.id && h.day < town.day) ?? [];
      if (booked.length > 0) {
        add(this.report.town, "hit.resolved");
        if (kneecapped) {
          const lost = Math.floor(pvpGain(this.x, was.bp) * this.x.town.club.hit.lossShare);
          add(this.report.town, "hit.landed");
          add(this.report.town, "hit.bpLost", lost);
          this.lose(p.id, lost, "hit");
        }
        // The same, by who hired it, and whether the hirer was ahead of or behind the target.
        for (const h of booked) {
          const hirer = before.players[h.by];
          this.both(h.by, "hit.resolvedBy");
          if (kneecapped) {
            this.both(h.by, "hit.landedBy");
            this.both(
              h.by,
              "hit.bpTaken",
              Math.floor(pvpGain(this.x, was.bp) * this.x.town.club.hit.lossShare),
            );
          }
          if (hirer && hirer.bp < was.bp) this.both(h.by, "hit.behindTarget");
        }
      }
      const dbp = p.bp - was.bp;
      if (dbp !== 0) this.both(p.id, "bp.midnight", dbp);
      this.checkPlayer(p, town.day, "after maintenance");
    }
    // Chains are consistent.
    const life = town.expanded?.life;
    for (const chain of life?.chains ?? []) {
      if (chain.members.length > this.x.town.chains.maxMembers)
        this.issue(
          "invariant",
          `chain ${chain.name} has ${chain.members.length} members`,
          town.day,
          chain.members[0] ?? 0,
        );
      for (const m of chain.members) {
        if (town.players[m]?.expanded?.life?.chain !== chain.id)
          this.issue("invariant", `chain ${chain.name} lists ${m}, who is not in it`, town.day, m);
      }
    }
    if ((life?.bingo.cards.filter((c) => c >= 0).length ?? 0) > this.x.town.church.bingo.cards)
      this.issue("invariant", "too many bingo cards", town.day, 0);
  }

  /** At the end of the season: seats, chains, usage by seat. */
  finish(town: TownState, seats: { playerId: number; joined: number }[]): void {
    const r = this.report;
    const ranked = seats
      .map((s) => s.playerId)
      .sort((a, b) => (town.players[b]?.bp ?? 0) - (town.players[a]?.bp ?? 0) || a - b);
    for (const s of seats) {
      const p = town.players[s.playerId];
      if (!p) continue;
      const k = this.x.karma;
      const path = p.karma >= k.good[0] ? "good" : p.karma <= k.evil[0] ? "evil" : "neutral";
      const seat = this.seatOf(s.playerId);
      r.seats.push({
        playerId: s.playerId,
        personality: seat.personality,
        difficulty: seat.difficulty,
        bp: p.bp,
        money: p.money,
        savings: p.expanded?.life?.savings ?? 0,
        karma: p.karma,
        path,
        rivalry: p.expanded?.rivalry ?? "standard",
        joined: s.joined,
        place: ranked.indexOf(s.playerId) + 1,
        pvpLost: this.pvpLost.get(s.playerId) ?? 0,
        fought: this.fought.has(s.playerId),
        chain: !!p.expanded?.life?.chain,
        mayor: !!p.expanded?.life?.mayor,
        upgrades: p.expanded?.upgrades.length ?? 0,
        monuments: p.expanded?.life?.monuments ?? 0,
        daily: this.dailyBp.get(s.playerId) ?? [],
        bought: this.boughtDay.get(s.playerId) ?? {},
        placeNet: this.placeNet.get(s.playerId) ?? {},
        placeOut: this.placeOut.get(s.playerId) ?? {},
      });
      for (const key of this.seatOffered.get(s.playerId) ?? []) add(r.town, `capable.${key}`);
      for (const key of this.seatUsed.get(s.playerId) ?? []) add(r.town, `users.${key}`);
    }
    for (const chain of town.expanded?.life?.chains ?? []) {
      r.chains.push({
        members: chain.members.map((m) => this.seatOf(m).personality),
        score: chain.score,
        memberBp: chain.members.reduce((a, m) => a + (town.players[m]?.bp ?? 0), 0),
      });
    }
    const done = town.expanded?.life;
    if (done) {
      add(r.town, "living.towns");
      add(r.town, "living.arcsPlayed", done.arcsDone.length + (done.arc ? 1 : 0));
    }
    const el = town.expanded?.life?.election;
    if (el?.mayor !== null && el?.mayor !== undefined)
      add(r.town, `mayor.${this.seatOf(el.mayor).personality}`);
  }
}

function describe(e: StepEvent): string {
  const a = e.action;
  const what =
    a.type === "press"
      ? `press ${a.buttonId}`
      : a.type === "visit"
        ? `visit ${a.placeId}`
        : "overlayId" in a
          ? `${a.type} ${a.overlayId}`
          : a.type;
  return `${what} on "${(e.view as View).title}"`;
}
