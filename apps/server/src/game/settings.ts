import { CLASSIC_SETTINGS, type GameSettings } from "@fq/core";
import { z } from "zod";

/**
 * Validation for the sysop's Game Settings, derived from the engine's own
 * defaults so a new setting is accepted as soon as the engine has it: a
 * boolean default gives a boolean, a tuple gives a tuple of integers, a
 * number gives an integer, and names ending in "Odds" are probabilities.
 */
function fieldFor(key: string, sample: unknown): z.ZodType {
  if (typeof sample === "boolean") return z.boolean();
  if (Array.isArray(sample)) {
    return z.tuple(sample.map(() => z.number().int().min(0).max(1_000_000_000)) as [z.ZodNumber]);
  }
  if (typeof sample === "number") {
    return key.endsWith("Odds")
      ? z.number().min(0).max(1)
      : z.number().int().min(-1_000_000_000).max(1_000_000_000);
  }
  return z.never();
}

const shape = Object.fromEntries(
  Object.entries(CLASSIC_SETTINGS).map(([key, sample]) => [key, fieldFor(key, sample)]),
);

/** Any subset of the Game Settings; unknown keys are an error. */
export const GameSettingsPatch = z.strictObject(shape).partial() as unknown as z.ZodType<
  Partial<GameSettings>
>;

export function settingKeys(): string[] {
  return Object.keys(CLASSIC_SETTINGS);
}
