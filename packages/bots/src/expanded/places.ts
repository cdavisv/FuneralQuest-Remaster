import { EXPANDED } from "@fq/core";
import type { Action, Button, View } from "@fq/protocol";
import type { ErrandKind, PlacesMemory, XMemory } from "../memory.js";
import type { PlacesStyle, XStyle } from "../personalities.js";
import { type Ctx, enemy } from "../policy.js";
import { hasButton, press } from "../read.js";

/**
 * How a bot uses the eight newer places (docs/expanded-rules.md sections 30 and 31,
 * balance round 19). Each errand is one visit: the bot reads the buttons the screen
 * offers (id, `detail` price, `enabled`), presses the ones its personality wants
 * (`PlacesStyle`), and leaves. Daily limits are counted in the day's plan like every
 * other place, so a screen that comes back after a press never repeats an action.
 * Every choice is read from the View; the dice are never used, so a bot's day is the
 * same on every run.
 */

/** The map id of each errand's place. */
export const PLACE_IDS: Partial<Record<ErrandKind, string>> = {
  police: "police-station",
  crematorium: "crematorium",
  florist: "florist",
  gazette: "gazette",
  coroner: "coroner",
  health: "health-department",
  pawn: "pawn-shop",
  mournes: "mournes",
};

/** Button-id prefixes that say which place a screen belongs to (merged into day.ts's table). */
export const PLACE_PREFIXES: Record<string, string> = {
  "police:": "police-station",
  "crematorium:": "crematorium",
  "florist:": "florist",
  "gazette:": "gazette",
  "coroner:": "coroner",
  "health-department:": "health-department",
  "pawn-shop:": "pawn-shop",
  "mournes:": "mournes",
};

/** The pickers these places open. */
export const PLACE_PICKERS = [
  "police:reportpick",
  "police:settlepick",
  "gazette:smearpick",
  "health-department:complaintpick",
];

/**
 * Errands (`crematorium`) or single buttons (`crematorium:bulk`) a balance experiment switches
 * off for every bot (the simulator's `--places-off`), to measure what a place or one of its
 * actions does to the town by leaving it out. A switched-off button reads as disabled. Empty in
 * play.
 */
let off: ReadonlySet<string> = new Set();

export function setPlacesOff(errands: readonly string[]): void {
  off = new Set(errands);
}

/** The last day an investment that pays over days (a certificate, a wreath) is still worth it. */
const INVEST_UNTIL = 24;

function xm(c: Ctx): XMemory {
  return c.memory.x as XMemory;
}

function mem(c: Ctx): PlacesMemory {
  const x = xm(c);
  x.places ??= { ovenDay: -99, reported: null, grievances: 0, certDay: -99, healthDay: -99 };
  return x.places;
}

function style(c: Ctx): XStyle {
  return c.me.expanded as XStyle;
}

function places(c: Ctx): PlacesStyle {
  return style(c).places;
}

function cash(c: Ctx): number {
  return c.view.hud?.money ?? 0;
}

function karma(c: Ctx): number {
  return c.view.hud?.karma ?? 50;
}

function rating(c: Ctx): number {
  return c.view.hud?.rating ?? 50;
}

function day(c: Ctx): number {
  return xm(c).day;
}

function dollars(detail: string | undefined): number {
  return Number((detail ?? "").replace(/[^\d]/g, "")) || 0;
}

function count(c: Ctx, key: string): number {
  return xm(c).plan.done[key] ?? 0;
}

function did(c: Ctx, key: string): void {
  const d = xm(c).plan.done;
  d[key] = (d[key] ?? 0) + 1;
}

function enabled(view: View, id: string): Button | undefined {
  if (view.overlay || off.has(id)) return undefined;
  return view.buttons.find((b) => b.id === id && b.enabled !== false);
}

/** Spends `price` only if the style's reserve (and more, for the bigger buys) is left. */
function afford(c: Ctx, price: number, extra = 0): boolean {
  return cash(c) - price >= style(c).reserve + extra;
}

/** An investment that pays over the rest of the season: not in the last days, never while poor. */
function investing(c: Ctx): boolean {
  return day(c) >= 3 && day(c) <= INVEST_UNTIL;
}

/** Peaceful parlors cannot be visited, robbed or hit, so the police have nothing for them. */
function exposed(c: Ctx): boolean {
  return style(c).rivalry !== "peaceful";
}

// ---------------------------------------------------------------------------
// Which errands are worth the walk

/** Morning errands that help today's sales, after the contractor and before the store. */
export function morningPlaces(c: Ctx): ErrandKind[] {
  const p = places(c);
  const out: ErrandKind[] = [];
  if (p.ovens || p.flowers) out.push(p.ovens ? "crematorium" : "florist");
  if (p.ovens && p.flowers) out.push("florist");
  if (p.coroner.tip || p.coroner.certificate || p.coroner.favour !== "none") out.push("coroner");
  if (p.health !== "none") out.push("health");
  if (p.mournes.spy) out.push("mournes");
  if (p.pawn.lots) out.push("pawn");
  return out;
}

/** Evening errands that spend what the day made, or answer what it cost. */
export function eveningPlaces(c: Ctx): ErrandKind[] {
  const p = places(c);
  const out: ErrandKind[] = [];
  if (exposed(c) && (p.police !== "none" || p.patrol !== "never")) out.push("police");
  if (p.ashes !== "none") out.push("crematorium");
  if (p.wreath !== "none") out.push("florist");
  if (p.advert !== "none" || p.puff || p.smear) out.push("gazette");
  if (p.pawn.loot) out.push("pawn");
  if (p.complaint) out.push("health");
  if (p.mournes.stand !== "none" || p.mournes.truce) out.push("mournes");
  if (p.coroner.favour !== "none") out.push("coroner");
  return out;
}

/** Is the errand worth the walk now? A walk is free, so only the obvious misses are skipped. */
export function placeWorth(c: Ctx, e: ErrandKind, morning: boolean): boolean {
  const p = places(c);
  const money = cash(c);
  const d = day(c);
  const m = mem(c);
  if (d < 2 || off.has(e)) return false;
  switch (e) {
    case "police":
      return exposed(c) && money > 800;
    case "crematorium":
      if (morning)
        return p.ovens && d - m.ovenDay >= 2 && d <= 28 && money > style(c).reserve + 1500;
      return p.ashes !== "none" && d % 2 === 0;
    case "florist":
      if (morning) return p.flowers && d <= 28 && money > style(c).reserve + 500;
      return p.wreath !== "none" && investing(c) && money > style(c).reserve + 1000;
    case "gazette":
      return money > style(c).reserve + 500 && d <= 28;
    case "coroner":
      if (morning)
        return (
          (p.coroner.tip && money > style(c).reserve) ||
          (p.coroner.certificate &&
            investing(c) &&
            d - m.certDay >= 3 &&
            money > style(c).reserve + 800)
        );
      return p.coroner.favour !== "none";
    case "health":
      if (morning)
        return (
          p.health !== "none" &&
          investing(c) &&
          d - m.healthDay >= 5 &&
          money > style(c).reserve + 800
        );
      return (
        p.complaint &&
        karma(c) <= EXPANDED.town.placesB.health.complaint.karmaAtMost &&
        money > 1000
      );
    case "pawn":
      return morning ? p.pawn.lots && money > style(c).reserve : p.pawn.loot;
    case "mournes":
      if (morning) return p.mournes.spy && money > style(c).reserve && d <= 28;
      return p.mournes.stand !== "none" || (p.mournes.truce && money > style(c).reserve + 3000);
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// The counters

/** One step at the errand's place. Returns null when the visit is done (the caller leaves). */
export function runPlace(c: Ctx, e: ErrandKind, morning: boolean): Action | null {
  switch (e) {
    case "police":
      return police(c);
    case "crematorium":
      return crematorium(c, morning);
    case "florist":
      return florist(c, morning);
    case "gazette":
      return gazette(c);
    case "coroner":
      return coroner(c, morning);
    case "health":
      return health(c, morning);
    case "pawn":
      return pawn(c, morning);
    case "mournes":
      return mournes(c, morning);
    default:
      return null;
  }
}

function pressIf(c: Ctx, id: string, key: string, limit = 1): Action | null {
  if (count(c, key) >= limit || !enabled(c.view, id)) return null;
  did(c, key);
  return press(id);
}

function police(c: Ctx): Action | null {
  const v = c.view;
  const p = places(c);
  const m = mem(c);
  if (!hasButton(v, "police:patrol") && !v.buttons.some((b) => b.id === "police:patrol"))
    return null;
  // The answer to an attack comes first: the picker it opens says how many rivals attacked.
  if (p.police !== "none" && count(c, "report") === 0) {
    const id = p.police === "report" ? "police:report" : "police:settle";
    const b = enabled(v, id);
    if (b) {
      did(c, "report");
      return press(id);
    }
  }
  // Repeat attacks (two attackers in three days, or the one reported last time again) cost
  // more than a night's guard: the sure patrol for a good parlor, the Back Door for the rest.
  const repeat = m.reported !== null && day(c) - m.reported.day <= 3 && m.grievances > 0;
  const pressed = m.grievances >= 2 || repeat;
  if (pressed && p.patrol !== "never" && count(c, "patrol") === 0) {
    const id = p.patrol === "patrol" ? "police:patrol" : "police:backdoor";
    const b = enabled(v, id);
    if (b && afford(c, dollars(b.detail), 1500)) {
      did(c, "patrol");
      m.grievances = 0;
      return press(id);
    }
    // A Back Door that failed is tried once more at a good price; a refusal ends it.
    if (!b) return null;
  }
  return null;
}

/** The picker of the police, the Gazette's smear and the Health Department's complaint. */
export function placePicker(
  c: Ctx,
  id: string,
  players: { id: number; name: string }[],
): number | null {
  const me = c.memory.self.playerId;
  const choices = players.filter((q) => q.id !== me);
  if (choices.length === 0) return null;
  const m = mem(c);
  if (id.startsWith("police:")) {
    m.grievances = choices.length;
    // The richest attacker is the one who can pay the fine.
    let best = choices[0] as { id: number; name: string };
    let bestBp = -1;
    for (const q of choices) {
      const bp = c.memory.rivals.find((r) => r.id === q.id)?.bp ?? 0;
      if (bp > bestBp) {
        best = q;
        bestBp = bp;
      }
    }
    m.reported = { id: best.id, day: day(c) };
    return best.id;
  }
  // The leader, or whoever the bot holds a grudge against.
  return enemy(c, choices);
}

function crematorium(c: Ctx, morning: boolean): Action | null {
  const v = c.view;
  const p = places(c);
  const m = mem(c);
  if (!v.buttons.some((b) => b.id === "crematorium:rent")) return null;
  if (morning) {
    // Cremation sales are common for a parlor with a markup (the cheap family's track): a bulk
    // lot of three slots a day and a half saves the wholesale cost of each cremation it hosts.
    const bulk = enabled(v, "crematorium:bulk");
    if (p.ovens && bulk && count(c, "oven") === 0 && afford(c, dollars(bulk.detail), 1000)) {
      did(c, "oven");
      m.ovenDay = day(c);
      return press("crematorium:bulk");
    }
    return null;
  }
  if (p.ashes === "scatter") return pressIf(c, "crematorium:scatter", "ashes");
  if (p.ashes === "press") return pressIf(c, "crematorium:diamonds", "ashes");
  return null;
}

function florist(c: Ctx, morning: boolean): Action | null {
  const v = c.view;
  const p = places(c);
  if (!v.buttons.some((b) => b.id === "florist:buy")) return null;
  if (morning) {
    // The cooler pays 60% of a flowers line: keep a bundle on the shelf, one a day at most.
    const b = enabled(v, "florist:bundle");
    if (p.flowers && b && count(c, "bundle") === 0 && afford(c, dollars(b.detail), 1000)) {
      did(c, "bundle");
      return press("florist:bundle");
    }
    const one = enabled(v, "florist:buy");
    if (p.flowers && !b && one && count(c, "bouquet") < 1 && afford(c, dollars(one.detail), 1000)) {
      did(c, "bouquet");
      return press("florist:buy");
    }
    return null;
  }
  if (p.wreath === "none" || !investing(c)) return null;
  // A church wreath buys karma and a point of word of mouth: a parlor short of the good path
  // sends one whenever it can, one already there every fourth day for the word of mouth.
  if (p.wreath === "church" && karma(c) >= EXPANDED.karma.good[1] + 5 && day(c) % 4 !== 2)
    return null;
  const id = p.wreath === "church" ? "florist:church" : "florist:ward";
  const b = enabled(v, id);
  if (b && afford(c, dollars(b.detail), 1500) && count(c, "wreath") === 0) {
    did(c, "wreath");
    return press(id);
  }
  return null;
}

function gazette(c: Ctx): Action | null {
  const v = c.view;
  const p = places(c);
  const lead = (c.view.hud?.leads ?? 0) < EXPANDED.town.hospital.lead.max - 1;
  if (!v.buttons.some((b) => b.id === "gazette:classified")) return null;
  if (p.advert !== "none" && lead && investing(c) && day(c) % 2 === 0) {
    const id = p.advert === "classified" ? "gazette:classified" : "gazette:display";
    const b = enabled(v, id);
    if (b && afford(c, dollars(b.detail), 1500) && count(c, "advert") === 0) {
      did(c, "advert");
      return press(id);
    }
  }
  if (p.puff && investing(c)) {
    const b = enabled(v, "gazette:puff");
    if (b && afford(c, dollars(b.detail), 2000) && count(c, "puff") === 0) {
      did(c, "puff");
      return press("gazette:puff");
    }
  }
  if (p.smear && day(c) >= 5 && day(c) % 4 === 1) {
    const b = enabled(v, "gazette:smear");
    if (b && afford(c, dollars(b.detail), 3000) && count(c, "smear") === 0) {
      did(c, "smear");
      return press("gazette:smear");
    }
  }
  return null;
}

function coroner(c: Ctx, morning: boolean): Action | null {
  const v = c.view;
  const p = places(c);
  const m = mem(c);
  if (hasButton(v, "coroner:burial") || v.buttons.some((b) => b.id === "coroner:burial")) {
    // The favour's choice screen.
    const id = p.coroner.favour === "burial" ? "coroner:burial" : "coroner:quiet";
    did(c, "favour");
    if (enabled(v, id)) return press(id);
    return press("coroner:main");
  }
  if (!v.buttons.some((b) => b.id === "coroner:tip")) return null;
  if (morning) {
    const tip = enabled(v, "coroner:tip");
    if (
      p.coroner.tip &&
      tip &&
      day(c) % 2 === 0 &&
      afford(c, dollars(tip.detail)) &&
      count(c, "tip") === 0
    ) {
      did(c, "tip");
      return press("coroner:tip");
    }
    const cert = enabled(v, "coroner:certificate");
    if (p.coroner.certificate && cert && investing(c) && afford(c, dollars(cert.detail), 800)) {
      m.certDay = day(c);
      return pressIf(c, "coroner:certificate", "cert");
    }
    return null;
  }
  const favour = enabled(v, "coroner:favour");
  if (p.coroner.favour !== "none" && favour && count(c, "favour") === 0) {
    // Signing a body over costs word of mouth half the time (and the rating with it): a parlor
    // does it while its name is still good, and not two days running.
    if (p.coroner.favour === "quiet" && (rating(c) < 45 || day(c) % 2 === 1)) return null;
    // A proper burial costs a little; the quiet favour pays and darkens karma.
    if (
      p.coroner.favour === "burial" &&
      !afford(c, EXPANDED.town.placesB.coroner.favour.burialCost)
    )
      return null;
    if (p.coroner.favour === "burial" && karma(c) >= 95) return null;
    return press("coroner:favour");
  }
  return null;
}

function health(c: Ctx, morning: boolean): Action | null {
  const v = c.view;
  const p = places(c);
  const m = mem(c);
  if (!v.buttons.some((b) => b.id === "health-department:inspect")) return null;
  if (morning) {
    // An unpaid citation costs reputation until it is paid.
    const fine = enabled(v, "health-department:fine");
    if (fine && afford(c, dollars(fine.detail)) && count(c, "fine") === 0) {
      did(c, "fine");
      return press("health-department:fine");
    }
    const id = p.health === "buy" ? "health-department:buy" : "health-department:inspect";
    const b = enabled(v, id);
    if (p.health !== "none" && b && investing(c) && afford(c, dollars(b.detail), 800)) {
      m.healthDay = day(c);
      return pressIf(c, id, "inspect");
    }
    return null;
  }
  const b = enabled(v, "health-department:complaint");
  if (p.complaint && b && afford(c, dollars(b.detail), 1500) && day(c) % 4 === 0) {
    return pressIf(c, "health-department:complaint", "complaint");
  }
  return null;
}

function pawn(c: Ctx, morning: boolean): Action | null {
  const v = c.view;
  const p = places(c);
  if (!v.buttons.some((b) => b.id === "pawn-shop:loot")) return null;
  if (!morning) return p.pawn.loot ? pressIf(c, "pawn-shop:loot", "loot") : null;
  if (!p.pawn.lots) return null;
  // A lot only if the storeroom has room for it (the button is disabled when it has none),
  // wood first: it is the cheaper tier the stores run out of.
  const stock = xm(c).stock;
  const wood = enabled(v, "pawn-shop:lot:wood");
  if (
    wood &&
    (stock[0] ?? 0) <= 3 &&
    afford(c, dollars(wood.detail), 500) &&
    count(c, "lot") === 0
  ) {
    did(c, "lot");
    xm(c).stock[0] = (stock[0] ?? 0) + 3;
    return press("pawn-shop:lot:wood");
  }
  const silver = enabled(v, "pawn-shop:lot:silver");
  if (
    silver &&
    (stock[1] ?? 0) <= 2 &&
    afford(c, dollars(silver.detail), 500) &&
    count(c, "lot") === 0
  ) {
    did(c, "lot");
    xm(c).stock[1] = (stock[1] ?? 0) + 2;
    return press("pawn-shop:lot:silver");
  }
  return null;
}

function mournes(c: Ctx, morning: boolean): Action | null {
  const v = c.view;
  const p = places(c);
  if (!v.buttons.some((b) => b.id === "mournes:spy")) return null;
  if (morning) {
    const b = enabled(v, "mournes:spy");
    if (
      p.mournes.spy &&
      b &&
      rating(c) >= 40 &&
      day(c) % 2 === 1 &&
      afford(c, dollars(b.detail)) &&
      count(c, "spy") === 0
    ) {
      did(c, "spy");
      return press("mournes:spy");
    }
    return null;
  }
  if (
    p.mournes.truce &&
    karma(c) < 70 &&
    afford(c, EXPANDED.town.placesB.mournes.truce.price, 3000)
  ) {
    const t = pressIf(c, "mournes:truce", "truce");
    if (t) return t;
  }
  if (p.mournes.stand === "hold") return pressIf(c, "mournes:hold", "stand");
  if (p.mournes.stand === "undercut") {
    const b = enabled(v, "mournes:undercut");
    if (
      b &&
      investing(c) &&
      rating(c) >= 40 &&
      afford(c, dollars(b.detail), 1000) &&
      count(c, "stand") === 0
    ) {
      did(c, "stand");
      return press("mournes:undercut");
    }
    return pressIf(c, "mournes:hold", "stand");
  }
  return null;
}
