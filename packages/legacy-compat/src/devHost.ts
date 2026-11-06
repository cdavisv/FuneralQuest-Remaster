import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  classicContext,
  createClassicRegistry,
  createPlayer,
  createTown,
  type Effect,
  type EngineContext,
  leaveGame,
  runDailyMaintenance,
  type TownState,
} from "@fq/core";
import { loadLegacyContent } from "./content.js";
import type { LegacyHost } from "./host.js";

/**
 * A host for the standalone dev server: one town in memory, passwords kept as
 * typed (a development convenience, never a model for a real server), content
 * read from legacy/dist/*.txt. `loadLegacyContent` is the one place the content
 * comes from; swap it to try another pack.
 */
export interface DevHost extends LegacyHost {
  readonly town: () => TownState;
  /** Runs midnight maintenance once (the real server's scheduler does this). */
  newDay(): { daysRun: number; day: number };
  /** Effects the bridge handed back, newest last (logs and so on). */
  readonly effects: Effect[];
}

export interface DevHostOptions {
  seed?: number;
  /** A JSON file the town and passwords are saved to after every change and read from at start. */
  saveFile?: string;
  /** Rival parlors to create so the rankings and the Look list have someone in them. */
  rivals?: number;
}

const RIVALS: readonly [string, string][] = [
  ["Morticia Vance", "Vance & Daughters"],
  ["Digby Cross", "Cross Roads Chapel"],
  ["Graves Holloway", "Holloway Rest"],
  ["Ashley Quill", "Quill Final Arrangements"],
];

type Passwords = Map<string, { id: number; password: string }>;

interface Saved {
  town: TownState;
  passwords: [string, { id: number; password: string }][];
}

export async function createDevHost(options: DevHostOptions = {}): Promise<DevHost> {
  const registry = createClassicRegistry();
  const content = loadLegacyContent();
  const context = (): EngineContext => classicContext(content, { registry, now: Date.now() });
  const effects: Effect[] = [];
  let town: TownState;
  const passwords: Passwords = new Map();

  if (options.saveFile && existsSync(options.saveFile)) {
    const saved = JSON.parse(readFileSync(options.saveFile, "utf8")) as Saved;
    town = saved.town;
    for (const [key, value] of saved.passwords) passwords.set(key, value);
  } else {
    town = createTown({ seed: options.seed ?? Date.now() & 0x7fffffff }, context()).town;
    const rivals = Math.min(options.rivals ?? 3, RIVALS.length);
    for (let i = 0; i < rivals; i++) {
      const [name, parlor] = RIVALS[i] as [string, string];
      const logon = `rival${i + 1}`;
      const made = createPlayer(
        town,
        {
          logon,
          name,
          parlor,
          password: "rival",
          passwordVerify: "rival",
          male: i % 2 === 0,
          email: `${logon}@example.com`,
        },
        context(),
      );
      if (!made.ok) continue;
      passwords.set(logon, { id: made.playerId, password: "rival" });
      // Rivals are parlors the player can visit; they are not connected.
      town = leaveGame(made.town, made.playerId, context()).town;
    }
  }

  const save = () => {
    if (options.saveFile) {
      const data: Saved = { town, passwords: [...passwords] };
      writeFileSync(options.saveFile, JSON.stringify(data));
    }
  };
  save();

  return {
    effects,
    town: () => town,
    context,
    getTown: () => town,
    persist(next, fx) {
      town = next;
      for (const e of fx) {
        effects.push(e);
        if (effects.length > 200) effects.shift();
      }
      save();
    },
    accounts: {
      verify(logon, password) {
        const entry = passwords.get(logon.toLowerCase());
        return entry && entry.password === password ? entry.id : null;
      },
      register(playerId, logon, password) {
        passwords.set(logon.toLowerCase(), { id: playerId, password });
        save();
      },
    },
    newDay() {
      const result = runDailyMaintenance(town, context(), { missedDays: 1 });
      town = result.town;
      save();
      return { daysRun: result.daysRun, day: town.day };
    },
  };
}
