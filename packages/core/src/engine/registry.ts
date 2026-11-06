import type { View } from "@fq/protocol";
import type { ScriptDef } from "../classic/scripts/runtime.js";
import type { Turn } from "./turn.js";

/**
 * A location or flow. Each lives in its own file and is added to a registry
 * with one `register` call (see `classic/modules/index.ts`).
 *
 * Routing: a button id `"<module>:<command>"` calls that module's `press`
 * with `<command>`; `"go:<module>"` or `"go:<module>:<arg>"` calls `enter`.
 * Overlay ids use the same `"<module>:<name>"` form. A town-map visit calls
 * `enter` on the module of the place. Every handler returns the next View;
 * the engine checks later actions against it.
 */
export interface LocationModule {
  readonly id: string;
  /** Arrive here (from the map, a Continue button or another module). */
  enter?(turn: Turn, arg: string | undefined): View;
  /** A button of this module was pressed. */
  press?(turn: Turn, command: string): View;
  /** `text` is null when the player cancelled the prompt. */
  submitText?(turn: Turn, overlayId: string, text: string | null): View;
  pickPlayer?(turn: Turn, overlayId: string, playerId: number | null): View;
  confirm?(turn: Turn, overlayId: string, accepted: boolean): View;
  /** A message overlay this module showed was closed. */
  dismiss?(turn: Turn, overlayId: string): View;
  /** A chat line typed in this module's scene (the cafe). */
  chat?(turn: Turn, text: string): View;
  /**
   * The session ended (log off, time-out) while this module's flow was open.
   * Only the negotiation module's is called today: Classic leaves it out and
   * the engine completes the sale the original way (`finishSale(turn, true)`).
   */
  sessionEnd?(turn: Turn): void;
}

/**
 * Runs at the end of every midnight maintenance (`runDailyMaintenance`), on
 * the town stream, after the Classic steps. The Classic registry has none.
 * Expanded systems that change the town each day (news modifiers, weather,
 * story arcs) register one; see docs/expanded-rules.md section 12.
 */
export type MaintenanceHook = (turn: Turn) => void;

/**
 * Runs on a player's first desk visit of a game day, after the Classic new
 * day and the Expanded one (expanded/newDay.ts), on the player's stream.
 * Returns extra morning text (legacy markup) or "". Only the Expanded desk
 * calls these.
 */
export type PlayerNewDayHook = (turn: Turn) => string;

/**
 * Runs when a player is created (`createPlayer`), before the paper is shown,
 * on the new player's stream. The Expanded ruleset sets up the player's
 * `expanded` record here. The Classic registry has none.
 */
export type PlayerCreatedHook = (turn: Turn) => void;

/**
 * Decorates every view a player is sent (after the module built it, before it
 * is stored as the session's last view). It may add fields; it must not change
 * the town. The Classic registry registers none.
 */
export type ViewHook = (turn: Turn, view: View) => View;

/** A place on the town map. Places without a registered module show a "not built yet" view. */
export interface PlaceDef {
  id: string;
  label: string;
  /** Module entered when the place is visited. */
  module: string;
}

export class Registry {
  private readonly modules = new Map<string, LocationModule>();
  private readonly placeList: PlaceDef[] = [];
  private readonly scriptDefs = new Map<string, ScriptDef>();
  private readonly maintenance: MaintenanceHook[] = [];
  private readonly newDay: PlayerNewDayHook[] = [];
  private readonly created: PlayerCreatedHook[] = [];
  private readonly views: ViewHook[] = [];

  /** Adds a module. Registering an id again replaces the earlier module. */
  register(module: LocationModule): this {
    if (module.id === "go" || module.id.includes(":")) {
      throw new Error(`Invalid module id "${module.id}"`);
    }
    this.modules.set(module.id, module);
    return this;
  }

  /** Adds a place to the town map, or replaces the place with the same id. */
  addPlace(place: PlaceDef): this {
    const index = this.placeList.findIndex((p) => p.id === place.id);
    if (index >= 0) this.placeList[index] = place;
    else this.placeList.push(place);
    return this;
  }

  registerScript(def: ScriptDef): this {
    this.scriptDefs.set(def.id, def);
    return this;
  }

  /** Adds a midnight hook (see `MaintenanceHook`). Hooks run in the order added. */
  onMaintenance(hook: MaintenanceHook): this {
    this.maintenance.push(hook);
    return this;
  }

  /** Adds a per-player new-day hook (see `PlayerNewDayHook`). Hooks run in the order added. */
  onPlayerNewDay(hook: PlayerNewDayHook): this {
    this.newDay.push(hook);
    return this;
  }

  /** Adds a player-created hook (see `PlayerCreatedHook`). */
  onPlayerCreated(hook: PlayerCreatedHook): this {
    this.created.push(hook);
    return this;
  }

  /** Adds a view hook (see `ViewHook`). Hooks run in the order added. */
  onView(hook: ViewHook): this {
    this.views.push(hook);
    return this;
  }

  get viewHooks(): readonly ViewHook[] {
    return this.views;
  }

  get playerCreatedHooks(): readonly PlayerCreatedHook[] {
    return this.created;
  }

  get maintenanceHooks(): readonly MaintenanceHook[] {
    return this.maintenance;
  }

  get playerNewDayHooks(): readonly PlayerNewDayHook[] {
    return this.newDay;
  }

  module(id: string): LocationModule | undefined {
    return this.modules.get(id);
  }

  place(id: string): PlaceDef | undefined {
    return this.placeList.find((p) => p.id === id);
  }

  get places(): readonly PlaceDef[] {
    return this.placeList;
  }

  script(id: string): ScriptDef | undefined {
    return this.scriptDefs.get(id);
  }
}
