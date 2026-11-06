import type { View } from "@fq/protocol";
import type { EngineContext, TownState } from "../../src/index.js";
import { type Strategy, XDriver } from "./xpolicy.js";

/**
 * The balance seats of docs/expanded-rules.md section 15 with an optional
 * late-game town budget (section 28): the same seller and spending, plus
 * money put into the town's sinks once the parlor has what it needs.
 */
export interface TownStrategy extends Strategy {
  town?: boolean;
}

const RESERVE = 15_000;
const LATE_UPGRADES = ["billboard", "memorial-garden", "crematorium"];

function on(view: View, id: string): boolean {
  return view.buttons.some((b) => b.id === id && b.enabled !== false);
}

function price(view: View, id: string): number {
  const b = view.buttons.find((x) => x.id === id);
  return Number((b?.detail ?? "").replace(/[^\d]/g, "")) || 0;
}

export class TownDriver extends XDriver {
  constructor(
    town: TownState,
    ctx: EngineContext,
    readonly townSeats: TownStrategy[],
    seed: number,
  ) {
    super(town, ctx, townSeats, seed);
  }

  private cash(id: number): number {
    return this.town.players[id]?.money ?? 0;
  }

  /** Presses `id` while it is on and leaves `RESERVE` (plus `extra`) in the till. */
  private spend(id: number, button: string, extra = 0, max = 20): void {
    for (let i = 0; i < max; i++) {
      const v = this.view as View;
      if (!on(v, button) || this.cash(id) - price(v, button) < RESERVE + extra) return;
      this.press(id, button);
    }
  }

  protected override shop(id: number, strategy: Strategy): void {
    super.shop(id, strategy);
    const s = this.townSeats[id];
    if (!s?.town) return;
    // Late game only: once the parlor has its chapel, or from day 18.
    const owned = this.town.players[id]?.expanded?.upgrades ?? [];
    if (!owned.includes("chapel") && this.town.day < 18) return;
    // 16.1: monuments, cheapest first.
    this.visit(id, "graveyard");
    this.press(id, "graveyard:monuments");
    this.spend(id, "graveyard:monument");
    this.press(id, "graveyard:main");
    // 18.1 and 18.2: permits for the late upgrades, then an inspection certificate.
    if (this.cash(id) > 40_000) {
      this.visit(id, "city-hall");
      this.press(id, "city-hall:permits");
      for (const permit of ["signage", "zoning", "crematory"])
        this.spend(id, `city-hall:permit:${permit}`, 0, 1);
      this.press(id, "city-hall:main");
      this.press(id, "city-hall:inspection");
      this.spend(id, "city-hall:certify", 0, 1);
      this.press(id, "city-hall:main");
    }
    this.toDesk(id);
    this.press(id, "go:parlor");
    this.press(id, "parlor:upgrades");
    for (const u of LATE_UPGRADES) this.spend(id, `parlor:buy:${u}`, 0, 1);
    // 17.5: what is left over goes in the plate.
    if (this.cash(id) > RESERVE + 25_000) {
      this.visit(id, "church");
      if (strategy.morals !== "evil") this.spend(id, "church:water", 0, 3);
      this.spend(id, "church:tithe", 25_000, 10);
    }
  }
}
