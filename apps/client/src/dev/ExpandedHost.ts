import "./zodJitless.js";
import { expandedPack } from "@fq/content";
import {
  createPlayer,
  createTown,
  type EngineContext,
  enterGame,
  expandedContext,
  runDailyMaintenance,
  step,
  type TownState,
} from "@fq/core";
import type { Action, Button, View } from "@fq/protocol";
import type { LiveTransport, Unsubscribe } from "../transport/types.js";

/**
 * A small Expanded town on the player's own page, for development and tests: the engine's
 * Expanded ruleset (`expandedContext(expandedPack)`) with the player and three quiet rival
 * parlors who never act. It is not the product's solo mode (that is `@fq/solo`); it exists so
 * that every Expanded screen can be opened and played in a browser before, and without, a server.
 *
 * Opened with `?expanded` in the address. The knobs are query parameters, parsed by
 * `expandedOptions`: `seed`, `money`, `karma`, `turns`, `luck`, `psych`, `tags=w,s,g`, `bp`,
 * `plots`, `day` (play that many nights first), `tour` (keep the guided first day), `events`
 * (leave the random street events on), `mail` (keep the letters the nights bring), `rivals`, `start` (a place id to begin in).
 * The desk gains an "End the Day" plaque that runs the night.
 */
export interface ExpandedOptions {
  seed: number;
  money?: number;
  karma?: number;
  turns?: number;
  luck?: number;
  psych?: number;
  tags?: [number, number, number];
  bp?: number;
  plots?: number;
  nights: number;
  tour: boolean;
  events: boolean;
  mail: boolean;
  rivals: number;
}

export const END_DAY_ID = "dev:endday";

const num = (v: string | null): number | undefined => {
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function expandedOptions(search: string): ExpandedOptions {
  const p = new URLSearchParams(search);
  const tags = (p.get("tags") ?? "").split(",").map((s) => Number(s));
  const out: ExpandedOptions = {
    seed: num(p.get("seed")) ?? 7,
    nights: Math.max(0, Math.min(40, num(p.get("day")) ?? 0)),
    tour: p.has("tour"),
    events: p.has("events"),
    mail: p.has("mail"),
    rivals: Math.max(0, Math.min(5, num(p.get("rivals")) ?? 3)),
  };
  for (const key of ["money", "karma", "turns", "luck", "psych", "bp", "plots"] as const) {
    const v = num(p.get(key));
    if (v !== undefined) out[key] = v;
  }
  if (tags.length === 3 && tags.every((n) => Number.isFinite(n))) {
    out.tags = tags as [number, number, number];
  }
  return out;
}

const RIVALS = [
  ["Gravy Boatwright", "Boatwright & Sons"],
  ["Tilda Marsh", "Marsh Mortuary"],
  ["Pike Dunmore", "Dunmore Departures"],
  ["Olive Crane", "Crane Cremations"],
  ["Hector Vale", "Vale of Tears"],
] as const;

export class ExpandedHost implements LiveTransport {
  private town: TownState | null = null;
  private readonly ctx: EngineContext;
  private id = 0;
  private view: View | null = null;
  private readonly listeners = new Set<(view: View) => void>();

  constructor(
    private readonly options: ExpandedOptions,
    private readonly start: string | null = null,
  ) {
    this.ctx = expandedContext(expandedPack, { now: Date.now() });
  }

  private build(): TownState {
    const o = this.options;
    const ctx = this.ctx;
    const settings = {
      tournamentActive: false,
      maintDelete: false,
      ...(o.events ? {} : { normalOdds: 0, luckOdds: 0, scriptOdds: 0 }),
    };
    let town = createTown({ seed: o.seed, settings }, ctx).town;
    const add = (name: string, parlor: string, male: boolean, login: string): number => {
      const made = createPlayer(
        town,
        {
          logon: login,
          name,
          parlor,
          password: "dev",
          passwordVerify: "dev",
          male,
          email: `${login}@dev.invalid`,
        },
        ctx,
      );
      if (!made.ok) throw new Error(`dev town: ${made.error.map((s) => s.text).join("")}`);
      town = made.town;
      return made.playerId;
    };
    for (let i = 0; i < o.rivals; i++) {
      const [name, parlor] = RIVALS[i] ?? RIVALS[0];
      const id = add(name, parlor, i % 2 === 0, `rival${i}`);
      town = step(town, id, { type: "exit" }, ctx).town;
      const p = town.players[id];
      if (p) {
        p.bp = 900 * (i + 1);
        p.plots = 6 + 9 * i;
      }
    }
    this.id = add("Ned Digger", "Digger & Daughters", true, "player");
    town = step(town, this.id, { type: "exit" }, ctx).town;
    const me = town.players[this.id];
    if (me) {
      me.turns = o.turns ?? me.turns;
      me.money = o.money ?? me.money;
      me.karma = o.karma ?? me.karma;
      me.luck = o.luck ?? me.luck;
      me.psych = o.psych ?? me.psych;
      me.bp = o.bp ?? me.bp;
      me.plots = o.plots ?? me.plots;
      if (o.tags) me.tags = [...o.tags];
      if (me.expanded && !o.tour) me.expanded.tutorial = { step: 99, done: true };
    }
    for (let n = 0; n < o.nights; n++) {
      town = runDailyMaintenance(town, ctx).town;
    }
    // The nights' mail would greet the player with a stack of the same letters; `mail` keeps it.
    const after = town.players[this.id];
    if (after && !o.mail) after.mail = [];
    return town;
  }

  private show(view: View): View {
    const desk = view.scene === "desk" && view.buttons.some((b) => b.id === "desk:wait");
    if (!desk) return view;
    const end: Button = { id: END_DAY_ID, label: "End the Day" };
    return { ...view, buttons: [...view.buttons, end] };
  }

  private enter(): View {
    if (!this.town) this.town = this.build();
    let r = enterGame(this.town, this.id, this.ctx);
    this.town = r.town;
    if (this.start && !r.rejected) {
      // Straight to a place, skipping the paper and the morning screen.
      for (let i = 0; i < 8; i++) {
        const v = r.view;
        if (v.overlay?.kind === "message") {
          r = step(this.town, this.id, { type: "dismiss", overlayId: v.overlay.id }, this.ctx);
        } else {
          const next = ["tutorial:skip", "go:desk"].find((id) =>
            v.buttons.some((b) => b.id === id && b.enabled !== false),
          );
          if (!next) break;
          r = step(this.town, this.id, { type: "press", buttonId: next }, this.ctx);
        }
        this.town = r.town;
      }
      if (r.view.buttons.some((b) => b.id === "go:map")) {
        r = step(this.town, this.id, { type: "press", buttonId: "go:map" }, this.ctx);
        this.town = r.town;
        r = step(this.town, this.id, { type: "visit", placeId: this.start }, this.ctx);
        this.town = r.town;
      }
    }
    this.view = this.show(r.view);
    return this.view;
  }

  connect(): Promise<View> {
    return Promise.resolve(this.enter());
  }

  send(action: Action): Promise<View> {
    if (!this.town || !this.view) return Promise.reject(new Error("not connected"));
    if (action.type === "press" && action.buttonId === END_DAY_ID) {
      if (!this.view.buttons.some((b) => b.id === END_DAY_ID)) return Promise.resolve(this.view);
      let town = step(this.town, this.id, { type: "exit" }, this.ctx).town;
      town = runDailyMaintenance(town, this.ctx).town;
      this.town = town;
      return Promise.resolve(this.enter());
    }
    const r = step(this.town, this.id, action, this.ctx);
    this.town = r.town;
    this.view = this.show(r.view);
    return Promise.resolve(this.view);
  }

  onPush(listener: (view: View) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  close(): void {
    this.listeners.clear();
  }

  /**
   * Test hook: moves the open customer's hidden limit to about 5% above the bill, so that Done
   * lands in the "nice" band (within 8%) and not in the "great" one. A real player cannot do
   * this; it lets a test finish a sale near the limit without guessing it.
   */
  nearMatch(): number | null {
    const total = this.view?.customer?.total;
    if (total === undefined || total <= 0) return null;
    const limit = total + 50 * Math.max(1, Math.round((0.05 * total) / 50));
    this.edit((town, me) => {
      const customer = town.sessions[String(me)]?.customer;
      if (customer?.active) customer.moneyToSpend = limit;
    });
    return limit;
  }

  /** The whole town, for tests that want to look behind the screen. */
  state(): TownState | null {
    return this.town;
  }

  /** Edits the player's record directly (tests and screenshots). */
  edit(change: (town: TownState, me: number) => void): void {
    if (this.town) change(this.town, this.id);
  }
}
