import { join } from "node:path";
import { vintagePack } from "@fq/content";
import {
  ClassicRandom,
  classicContext,
  createClassicRegistry,
  createTown,
  type EngineContext,
  leaveGame,
  originalClassicRules,
  runDailyMaintenance,
  type TownState,
} from "@fq/core";
import { LegacyBridge, type LegacyHost, type LegacyVars, loadAssets } from "@fq/legacy-compat";
import { REPO_ROOT } from "../scripts/config.js";

/** The oracle's starting clock (oracle_main.cpp): 2001-01-01 00:00:00 UTC. */
export const START_CLOCK_S = 978307200;

/**
 * The port, driven the way the oracle is: a town in memory behind the
 * original-protocol bridge (@fq/legacy-compat, used as is), Classic rules
 * with every deliberate fix off (`originalClassicRules()`), the Vintage
 * content pack, and every random draw from one shared generator
 * (`EngineContext.sharedRandom`), as the original server drew from one
 * global Mersenne Twister and one `rand()`.
 */
export class PortDriver {
  private readonly registry = createClassicRegistry();
  private readonly rules = originalClassicRules();
  private rng = new ClassicRandom(4357, 1);
  private town: TownState | null = null;
  private clockMs = START_CLOCK_S * 1000;
  private readonly tokens = new Map<number, string>();
  private readonly passwords = new Map<string, { id: number; password: string }>();
  private readonly bridge: LegacyBridge;

  constructor() {
    const host: LegacyHost = {
      context: () => this.context(),
      getTown: () => this.current(),
      persist: (next) => {
        this.town = next;
      },
      accounts: {
        verify: (logon, password) => {
          const entry = this.passwords.get(logon.toLowerCase());
          return entry && entry.password === password ? entry.id : null;
        },
        register: (playerId, logon, password) => {
          this.passwords.set(logon.toLowerCase(), { id: playerId, password });
        },
      },
    };
    const assets = loadAssets(
      join(REPO_ROOT, "assets", "manifest.json"),
      join(REPO_ROOT, "legacy", "dist", "public"),
    );
    this.bridge = new LegacyBridge({
      host,
      assets,
      now: () => this.clockMs,
      idleMs: Number.MAX_SAFE_INTEGER,
    });
  }

  context(): EngineContext {
    return {
      ...classicContext(vintagePack, {
        rules: this.rules,
        registry: this.registry,
        now: this.clockMs,
      }),
      // The oracle runs with TZ=UTC: the server's local time is UTC.
      localTimeOffsetMinutes: 0,
      sharedRandom: this.rng,
    };
  }

  current(): TownState {
    if (!this.town) throw new Error("port: init first");
    return this.town;
  }

  get draws(): { mt: number; crt: number } {
    return { mt: this.rng.mt.draws, crt: this.rng.crt.draws };
  }

  seed(mt: number, crt: number): void {
    this.rng = new ClassicRandom(mt, crt);
  }

  setClock(seconds: number): void {
    this.clockMs = seconds * 1000;
  }

  /** `server_init` on a brand-new game: day 0, then maintenance once (funeral.cpp:98-103). */
  init(): void {
    this.town = createTown({ seed: 0 }, this.context()).town;
  }

  /** A Game Settings change, as the sysop's dialog made it. */
  set(key: string, value: number | boolean): void {
    const town = this.current();
    this.town = { ...town, settings: { ...town.settings, [key]: value } };
  }

  /** Test set-up: one field of a player record (the oracle's `grant`). */
  grant(id: number, field: string, value: number): void {
    const town = this.current();
    const players = town.players.map((pl) => {
      if (pl.id !== id) return pl;
      const tags = [...pl.tags];
      switch (field) {
        case "wood":
          tags[0] = value;
          return { ...pl, tags };
        case "silver":
          tags[1] = value;
          return { ...pl, tags };
        case "gold":
          tags[2] = value;
          return { ...pl, tags };
        case "luck":
          return { ...pl, luck: value };
        case "strength":
          return { ...pl, strength: value };
        case "turns":
          return { ...pl, turns: value };
        case "bp":
          return { ...pl, bp: value };
        case "fireAlarm":
        case "safe":
        case "padlock":
        case "lockpicks":
        case "padlockStrength": {
          const slot = { fireAlarm: 0, safe: 1, padlock: 2, lockpicks: 3, padlockStrength: 4 }[
            field
          ];
          const custom = [...pl.custom];
          custom[slot] = value;
          return { ...pl, custom };
        }
        case "police":
          return { ...pl, policeProtected: value !== 0 };
        case "hpMax":
          return { ...pl, hpMax: value, hp: value };
        case "visitsUsed":
          return { ...pl, playerFights: value };
        default:
          throw new Error(`cannot grant ${field}`);
      }
    });
    this.town = { ...town, players };
  }

  /** One request.xp hit from player `p`'s browser. */
  async request(p: number, query: string): Promise<LegacyVars> {
    const reply = await this.bridge.handle(this.tokens.get(p), query);
    this.tokens.set(p, reply.token);
    return reply.vars;
  }

  /** The connection timed out: the session ends (`online_delete_guy`). */
  drop(p: number, playerId: number | null): void {
    this.tokens.delete(p);
    if (playerId === null) return;
    const town = this.current();
    if (!town.sessions[String(playerId)]) return;
    this.town = leaveGame(town, playerId, this.context()).town;
  }

  /** Midnight: `maint_time_check` runs `maint_new_day` once. */
  midnight(nextClockS: number): void {
    this.clockMs = nextClockS * 1000;
    this.town = runDailyMaintenance(this.current(), this.context(), { missedDays: 1 }).town;
  }
}
