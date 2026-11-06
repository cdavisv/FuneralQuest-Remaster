import { randomInt } from "node:crypto";
import { z } from "zod";
import { getRuleset } from "./rulesets.js";
import { isValidTimeZone } from "./schedule.js";
import { GameSettingsPatch } from "./settings.js";
import type { TownSpec } from "./town.js";

export const TOWN_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;

/** A town as written in the towns file or sent to `POST /admin/towns`. */
export const TownConfigSchema = z.strictObject({
  id: z.string().regex(TOWN_ID, "lowercase letters, digits and dashes, up to 32 characters"),
  name: z.string().trim().min(1).max(40),
  /** `classic` (the default) or `expanded`. */
  ruleset: z.string().min(1).max(32).default("classic"),
  /** Defaults to the ruleset's own pack: `classic` for Classic, `expanded` for Expanded. */
  contentPack: z.string().min(1).max(32).optional(),
  /** Expanded rule numbers to change for this town, by dotted path (`GET /admin/towns/:id/settings` lists them). */
  rules: z.record(z.string().max(80), z.number()).optional(),
  timeZone: z.string().max(64).refine(isValidTimeZone, "not an IANA time zone").default("UTC"),
  /** Set for a Blitz town: a new day every this many minutes. */
  dayLengthMinutes: z.number().min(1).max(525_600).nullable().default(null),
  seed: z.number().int().min(0).max(0xffffffff).optional(),
  settings: GameSettingsPatch.optional(),
  serverNews: z.string().max(1000).optional(),
});

export type TownConfig = z.infer<typeof TownConfigSchema>;

export const TownsFileSchema = z.strictObject({ towns: z.array(TownConfigSchema).max(100) });

export function toSpec(config: TownConfig): TownSpec {
  return {
    id: config.id,
    name: config.name,
    ruleset: config.ruleset,
    contentPack: config.contentPack ?? getRuleset(config.ruleset)?.defaultPack ?? "classic",
    timeZone: config.timeZone,
    dayLengthMs:
      config.dayLengthMinutes === null ? null : Math.round(config.dayLengthMinutes * 60_000),
    seed: config.seed ?? randomInt(0, 2 ** 32),
    ...(config.rules ? { ruleOverrides: config.rules } : {}),
    ...(config.settings ? { settings: config.settings } : {}),
    ...(config.serverNews !== undefined ? { serverNews: config.serverNews } : {}),
  };
}
