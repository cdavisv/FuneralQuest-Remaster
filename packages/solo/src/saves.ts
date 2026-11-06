import { SAVE_FORMAT, SAVE_VERSION, type SaveSummary, type SoloSave } from "./types.js";

/** Upgrades a save of version `n` to version `n + 1`. */
export type SaveMigration = (save: Record<string, unknown>) => Record<string, unknown>;

/**
 * Save migrations by the version they upgrade from.
 *
 * - 1 to 2 (the Expanded ruleset): `config.tutorial` and `config.challengeDay` become explicit.
 *   A version 1 game is Classic, which has no guided first day, so `tutorial` is false; it is
 *   not a Daily Challenge, so `challengeDay` is null. Nothing else changes: the town, the bots'
 *   memories and the clock are read exactly as before.
 *
 * When the format changes again, bump `SAVE_VERSION` and add `[2]: (old) => new` here.
 */
export const SAVE_MIGRATIONS: Record<number, SaveMigration> = {
  1: (save) => {
    const config = isRecord(save.config) ? save.config : {};
    return { ...save, config: { tutorial: false, challengeDay: null, ...config } };
  },
};

export class SaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaveError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Checks a save and brings it up to the current version. */
export function migrateSave(
  raw: unknown,
  migrations: Record<number, SaveMigration> = SAVE_MIGRATIONS,
): SoloSave {
  if (!isRecord(raw) || raw.format !== SAVE_FORMAT)
    throw new SaveError("This is not a Funeral Quest Solo save.");
  let save: Record<string, unknown> = structuredClone(raw);
  let version = typeof save.version === "number" ? save.version : 0;
  if (version > SAVE_VERSION) {
    throw new SaveError(`This save is from a newer version of the game (format ${version}).`);
  }
  while (version < SAVE_VERSION) {
    const step = migrations[version];
    if (!step) throw new SaveError(`No way to upgrade a save from format ${version}.`);
    save = step(save);
    version++;
    save.version = version;
  }
  for (const key of ["config", "town", "bots", "humanId"]) {
    if (!(key in save)) throw new SaveError(`The save is missing "${key}".`);
  }
  if (!isRecord(save.town) || !Array.isArray((save.town as Record<string, unknown>).players)) {
    throw new SaveError("The save's town is damaged.");
  }
  return save as unknown as SoloSave;
}

/** A save as a file: name, text and type, ready for a download link. */
export function exportSave(save: SoloSave): { filename: string; text: string; type: string } {
  const player = save.town.players[save.humanId]?.name ?? "parlor";
  const safe =
    player
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "parlor";
  return {
    filename: `funeral-quest-${safe}-day-${save.town.day}.fqsave.json`,
    text: JSON.stringify(save),
    type: "application/json",
  };
}

/** A save file the player picked (its text, or a Blob/File). */
export async function importSave(file: string | Blob): Promise<SoloSave> {
  const text = typeof file === "string" ? file : await file.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SaveError("The file is not a save (it is not JSON).");
  }
  return migrateSave(raw);
}

export function summarize(slot: string, save: SoloSave): SaveSummary {
  const me = save.town.players[save.humanId];
  return {
    slot,
    savedAt: save.savedAt,
    day: save.town.day,
    playerName: me?.name ?? "",
    parlor: me?.parlor ?? "",
    mode: save.config.mode,
    careerDays: save.config.mode === "career" ? (save.config.careerDays ?? 30) : null,
    rivals: save.config.rivals.length,
    contentPack: save.config.contentPack,
    bp: me?.bp ?? 0,
  };
}
