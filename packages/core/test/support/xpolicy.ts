import type { Action, View } from "@fq/protocol";
import {
  type EngineContext,
  EXPANDED_STARTER,
  enterGame,
  richTextToPlain,
  runDailyMaintenance,
  step,
  type TownState,
} from "../../src/index.js";
import { policyRng } from "./harness.js";

/**
 * Scripted View-only players for the balance sanity checks of
 * docs/expanded-rules.md section 15. They read only what a client shows; the
 * "reader" knows the starter content's tell lines, as a player who has read
 * them a few times would.
 */

export type Seller = "random" | "reader";
export type Spending = "none" | "psych" | "hearse" | "balanced";
export type Morals = "neutral" | "good" | "evil";

export interface Strategy {
  name: string;
  seller: Seller;
  spending: Spending;
  morals: Morals;
}

export interface SeatStats {
  sales: number;
  walkouts: number;
  exact: number;
  steps: number;
}

const LOVED_LABELS = new Set(["In Shock", "Dazed", "Confused", "Crying", "Numb", "Disturbed"]);
const NOT_LOVED_LABELS = new Set([
  "Chipper",
  "In a hurry",
  "Natural",
  "Tight Lipped",
  "Nervous",
  "Annoyed",
]);

function stripName(line: string): string {
  // Tell lines start with the customer's name or speaker tag; compare the rest.
  return line
    .replace(/\{customer\}|\{customerName\}/g, "")
    .replace(/\{[a-zA-Z]+\}/g, "")
    .replace(/[`].?/g, "")
    .trim()
    .slice(0, 18);
}

const TELLS = EXPANDED_STARTER.tells;
const LOVED_KEYS = TELLS.loved.map(stripName);
const NOT_LOVED_KEYS = TELLS.notLoved.map(stripName);
const BLESS_LOVED = stripName(EXPANDED_STARTER.text.negotiation.blessResult.loved).slice(-12);

/** What the reader learned about the customer on screen. */
interface Read {
  loved: boolean | null;
  upper: number;
  nudges: number;
  listens: number;
  handBill: number;
  packBill: number;
  hardTried: boolean;
}

function newRead(): Read {
  return {
    loved: null,
    upper: Number.POSITIVE_INFINITY,
    nudges: 0,
    listens: 0,
    handBill: -1,
    packBill: -1,
    hardTried: false,
  };
}

function readLoved(view: View, read: Read): void {
  const c = view.customer;
  if (!c) return;
  const notes = (c.notes ?? []).map(richTextToPlain).join(" ");
  if (LOVED_KEYS.some((k) => k.length > 6 && notes.includes(k))) read.loved = true;
  else if (NOT_LOVED_KEYS.some((k) => k.length > 6 && notes.includes(k))) read.loved = false;
  if (BLESS_LOVED && notes.includes(BLESS_LOVED)) read.loved = true;
  if (read.loved === null) {
    if (LOVED_LABELS.has(c.moodLabel)) read.loved = true;
    else if (NOT_LOVED_LABELS.has(c.moodLabel)) read.loved = false;
  }
}

function price(detail: string | undefined): number {
  return Number((detail ?? "").replace(/[^\d]/g, "")) || 0;
}

function enabled(view: View, id: string): boolean {
  return view.buttons.some((b) => b.id === id && b.enabled !== false);
}

/** The reader's move on a negotiation screen. */
function readerMove(view: View, read: Read, strategy: Strategy): string {
  const c = view.customer;
  if (!c) return "neg:done";
  const text = richTextToPlain(view.text);
  const bill = c.total;
  const est = c.estimate ?? { low: bill, high: bill };
  if (/over (my limit|what I can spend)/.test(text)) read.upper = Math.min(read.upper, bill + 1);
  const cap = Math.min(est.high, read.upper - 1);
  readLoved(view, read);
  const cards = view.buttons.filter((b) => b.group === "hand" && b.enabled !== false);
  if (cards.length > 0 || enabled(view, "neg:back")) {
    // A hand or the packages: the dearest card that still fits under the cap.
    let best: string | null = null;
    let bestPrice = -1;
    for (const b of cards) {
      const p = price(b.detail);
      if (bill + p <= cap && p > bestPrice) {
        best = b.id;
        bestPrice = p;
      }
    }
    if (best) return best;
    if (view.buttons.some((b) => b.id.startsWith("neg:hand:"))) read.handBill = bill;
    else read.packBill = bill;
    return "neg:back";
  }
  const patience = c.patience?.left ?? 5;
  const mood = c.moodLevel;
  if (mood >= 6.5 && enabled(view, "neg:coffee")) return "neg:coffee";
  if (mood >= 7.5 && enabled(view, "neg:discount")) return "neg:discount";
  if (enabled(view, "neg:bless") && read.loved === null) return "neg:bless";
  if (strategy.morals === "evil" && enabled(view, "neg:raise") && mood < 6) return "neg:raise";
  if (
    read.listens < 1 &&
    patience >= 5 &&
    enabled(view, "neg:listen") &&
    est.high - est.low > bill * 0.25
  ) {
    read.listens++;
    return "neg:listen";
  }
  if (read.nudges < 2 && mood < 5.5 && read.loved !== null && patience >= 3) {
    read.nudges++;
    return read.loved ? "neg:sympathy" : "neg:guilt";
  }
  if (cap - bill < 50) return "neg:done";
  if (patience <= 0 && mood >= 6) return "neg:done";
  // Cheap customers who keep refusing caskets may take cremation.
  if (enabled(view, "neg:cremation") && read.hardTried && c.track === "burial")
    return "neg:cremation";
  if (!read.hardTried && enabled(view, "neg:hard")) {
    read.hardTried = true;
    return "neg:hard";
  }
  if (read.handBill !== bill && enabled(view, "neg:soft")) return "neg:soft";
  if (read.packBill !== bill && enabled(view, "neg:packages")) return "neg:packages";
  return "neg:done";
}

function randomMove(view: View, rand: () => number): string {
  const ids = view.buttons.filter((b) => b.enabled !== false).map((b) => b.id);
  const cards = ids.filter((id) => id.startsWith("neg:hand:") || id.startsWith("neg:pkg:"));
  if (cards.length > 0 || ids.includes("neg:back")) {
    if (cards.length === 0 || rand() < 0.1) return "neg:back";
    return cards[Math.floor(rand() * cards.length)] as string;
  }
  if (rand() < 0.15) return "neg:done";
  const others = ids.filter((id) => id !== "neg:done");
  return others[Math.floor(rand() * others.length)] ?? "neg:done";
}

/** Plays whole days for a set of seats. */
export class XDriver {
  town: TownState;
  view: View | null = null;
  stats: SeatStats[];
  constructor(
    town: TownState,
    readonly ctx: EngineContext,
    readonly seats: Strategy[],
    readonly seed: number,
  ) {
    this.town = town;
    this.stats = seats.map(() => ({ sales: 0, walkouts: 0, exact: 0, steps: 0 }));
  }

  protected act(id: number, action: Action): View {
    const r = step(this.town, id, action, this.ctx);
    if (r.rejected)
      throw new Error(`${JSON.stringify(action)} rejected: ${r.rejected} on ${this.view?.title}`);
    this.town = r.town;
    this.view = r.view;
    const s = this.stats[id];
    if (s) s.steps++;
    return r.view;
  }

  protected press(id: number, buttonId: string): View {
    return this.act(id, { type: "press", buttonId });
  }

  protected toDesk(id: number): View {
    for (let i = 0; i < 12; i++) {
      const v = this.view as View;
      if (v.overlay?.kind === "message") {
        this.act(id, { type: "dismiss", overlayId: v.overlay.id });
        continue;
      }
      if (v.overlay?.kind === "confirm") {
        this.act(id, { type: "confirm", overlayId: v.overlay.id, accepted: false });
        continue;
      }
      if (v.overlay) throw new Error(`Overlay ${v.overlay.kind}`);
      if (v.buttons.some((b) => b.id === "desk:wait")) return v;
      if (enabled(v, "neg:done")) {
        this.press(id, "neg:done");
        continue;
      }
      if (v.map) {
        this.act(id, { type: "visit", placeId: "funeral-home" });
        continue;
      }
      const go = v.buttons.find((b) => b.id === "go:desk" || b.id === "tutorial:skip");
      const any = go ?? v.buttons.find((b) => b.enabled !== false && b.id.startsWith("go:"));
      if (!any)
        throw new Error(`No way home from ${v.title}: ${v.buttons.map((b) => b.id).join(" ")}`);
      this.press(id, any.id);
    }
    throw new Error("Lost on the way home");
  }

  protected visit(id: number, place: string): View {
    this.toDesk(id);
    this.press(id, "go:map");
    return this.act(id, { type: "visit", placeId: place });
  }

  private negotiate(id: number, strategy: Strategy, rand: () => number): void {
    const read = newRead();
    const trail: string[] = [];
    for (let n = 0; n < 60; n++) {
      if (n === 59) throw new Error(`Negotiation never ended: ${trail.join(" ")}`);
      const v = this.view as View;
      if (!v.buttons.some((b) => b.id.startsWith("neg:"))) return;
      if (enabled(v, "neg:offer:accept")) {
        const sinful = /Cousin Sal/.test(richTextToPlain(v.text));
        const accept =
          strategy.morals === "evil" ? true : strategy.morals === "good" ? !sinful : rand() < 0.5;
        this.press(id, accept ? "neg:offer:accept" : "neg:offer:decline");
        return;
      }
      const move =
        strategy.seller === "reader" ? readerMove(v, read, strategy) : randomMove(v, rand);
      trail.push(move);
      this.press(id, enabled(v, move) ? move : "neg:done");
      const after = this.view as View;
      if (move === "neg:done" || !after.customer) {
        const text = richTextToPlain(after.text);
        const s = this.stats[id];
        if (s) {
          if (/service is a success/.test(text)) s.sales++;
          else s.walkouts++;
          if (/PERFECT/.test(text)) s.exact++;
        }
        return;
      }
    }
  }

  private prep(id: number, strategy: Strategy, rand: () => number): void {
    const v = this.view as View;
    if (!enabled(v, "prep:start")) return;
    const opts = this.press(id, "prep:start").buttons.filter((b) => b.enabled !== false);
    const evil = opts.find(
      (b) => /karma/.test(b.detail ?? "") && /-\d+ karma/.test(b.detail ?? ""),
    );
    const good = opts.find((b) => /\+\d+ karma/.test(b.detail ?? ""));
    let choice = opts[Math.floor(rand() * opts.length)];
    if (strategy.morals === "evil" && evil) choice = evil;
    if (strategy.morals === "good" && good) choice = good;
    if (choice) this.press(id, choice.id);
  }

  protected shop(id: number, strategy: Strategy): void {
    const p = () => this.town.players[id];
    if (strategy.spending === "none") return;
    if ((p()?.tags[0] ?? 0) + (p()?.tags[1] ?? 0) > 0) {
      this.visit(id, "bank");
      this.press(id, "bank:all-gold");
    }
    const psychTarget =
      strategy.spending === "psych" ? 99 : strategy.spending === "balanced" ? 3 : 0;
    if (psychTarget > 0) {
      this.visit(id, "spirit-university");
      for (let i = 0; i < 12 && (p()?.psych ?? 0) < psychTarget; i++) {
        const before = p()?.psych ?? 0;
        this.press(id, "spirit-university:psych");
        this.press(id, "spirit-university:main");
        if ((p()?.psych ?? 0) === before) break;
      }
    }
    const hearseTarget =
      strategy.spending === "hearse"
        ? 4
        : strategy.spending === "balanced" && (p()?.psych ?? 0) >= 3
          ? 3
          : 0;
    if (hearseTarget > (p()?.transportation ?? 0)) {
      this.visit(id, "store");
      this.press(id, "store:hearse");
      for (let n = hearseTarget; n > (p()?.transportation ?? 0); n--) {
        const v = this.view as View;
        if (!enabled(v, `store:look:${n}`)) continue;
        this.press(id, `store:look:${n}`);
        this.press(id, "store:buy");
        this.press(id, "store:hearse");
        if ((p()?.transportation ?? 0) >= n) break;
      }
    }
    if (strategy.spending === "balanced") {
      this.visit(id, "store");
      this.press(id, "store:caskets");
      if (enabled(this.view as View, "store:restock")) this.press(id, "store:restock");
      this.toDesk(id);
      this.press(id, "go:parlor");
      this.press(id, "parlor:upgrades");
      const order = [
        "paint",
        "coffee-machine",
        "viewing-room",
        "florist-cooler",
        "embalming-lab",
        "storeroom",
        "incinerator",
        "chapel",
        "guard-dog",
        "mausoleum",
      ];
      for (const u of order) {
        if (enabled(this.view as View, `parlor:buy:${u}`)) this.press(id, `parlor:buy:${u}`);
      }
    }
  }

  /** One game day for every seat, then midnight. */
  day(): void {
    for (let id = 0; id < this.seats.length; id++) {
      const strategy = this.seats[id] as Strategy;
      const rand = policyRng(this.seed * 977 + id * 31 + this.town.day * 7);
      if (!this.town.players[id]?.active) continue;
      const r = enterGame(this.town, id, this.ctx);
      this.town = r.town;
      this.view = r.view;
      this.press(id, "go:desk");
      const morning = this.view as View;
      if (morning.buttons.some((b) => b.id === "go:tutorial")) {
        this.press(id, "go:tutorial");
        this.press(id, "tutorial:skip");
      }
      this.toDesk(id);
      for (let guard = 0; guard < 120; guard++) {
        const player = this.town.players[id];
        if (!player || player.turns <= 0) break;
        if (strategy.morals === "evil" && guard === 0 && player.money < 20000) {
          this.press(id, "go:parlor");
          for (let k = 0; k < 2 && enabled(this.view as View, "parlor:dig"); k++)
            this.press(id, "parlor:dig");
          this.toDesk(id);
          continue;
        }
        this.toDesk(id);
        const v = this.press(id, "desk:wait");
        if (v.buttons.some((b) => b.id.startsWith("neg:"))) {
          this.negotiate(id, strategy, rand);
          this.prep(id, strategy, rand);
        } else if (enabled(v, "risk:decline")) {
          this.press(id, rand() < 0.5 ? "risk:take" : "risk:decline");
        } else if (v.buttons.some((b) => b.id.startsWith("script:"))) {
          const home =
            v.buttons.find((b) => b.id.startsWith("go:")) ?? v.buttons[v.buttons.length - 1];
          if (home) this.press(id, home.id);
        }
      }
      this.toDesk(id);
      this.shop(id, strategy);
      this.toDesk(id);
      this.press(id, "desk:quit");
    }
    this.town = runDailyMaintenance(this.town, this.ctx).town;
  }
}
