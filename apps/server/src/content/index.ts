import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { classicPack, expandedPack, vintagePack } from "@fq/content";
import { loadPackFromDirectory } from "@fq/content/node";
import type { ContentPack } from "@fq/core";

/**
 * Where content packs come from. `names()` is what the admin API offers; `load()` returns a pack
 * by name. Packs are plain data the engine treats as read-only.
 */
export interface ContentSource {
  names(): string[];
  load(name: string): ContentPack;
}

export class UnknownContentPack extends Error {
  constructor(readonly pack: string) {
    super(`Unknown content pack "${pack}"`);
  }
}

/** A packs directory (`FQ_PACKS_DIR`) that cannot be used. The message says which file and why. */
export class ContentPacksError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentPacksError";
  }
}

/**
 * The packs built into `@fq/content`: the untouched 2001 text, the reviewed Classic edits, and the
 * Classic text plus the Expanded ruleset's own tables (traits, specials, the town's text).
 */
export const BUILT_IN_PACKS: Readonly<Record<string, ContentPack>> = {
  classic: classicPack,
  vintage: vintagePack,
  expanded: expandedPack,
};

/** A town names its pack in at most 32 characters (see `TownConfigSchema`). */
const PACK_NAME = /^[a-z0-9][a-z0-9_-]{0,31}$/;

/**
 * Loads every pack directory directly under `dir`. Each subdirectory is one pack in the format of
 * `loadPackFromDirectory` (`pack.yaml` with the pack id and optional `extends`, one file per
 * table, optional `overrides.yaml`). The pack is known by its `id`, which must not be one of the
 * built-in names or used twice. Every problem is collected and thrown together so the sysop can fix
 * them in one go. Files and directories starting with "." and plain files are ignored.
 */
export function loadPacksDirectory(dir: string): Record<string, ContentPack> {
  const root = resolve(dir);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new ContentPacksError(`FQ_PACKS_DIR: ${root} is not a directory`);
  }
  const packs: Record<string, ContentPack> = {};
  const origin: Record<string, string> = {};
  const problems: string[] = [];
  const entries = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
  for (const name of entries) {
    const path = join(root, name);
    let pack: ContentPack;
    try {
      pack = loadPackFromDirectory(path);
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    if (!PACK_NAME.test(pack.id)) {
      problems.push(
        `${path}/pack.yaml: id "${pack.id}" must be 1 to 32 lowercase letters, digits, '-' or '_'`,
      );
    } else if (Object.hasOwn(BUILT_IN_PACKS, pack.id)) {
      problems.push(`${path}/pack.yaml: id "${pack.id}" is a built-in pack; choose another id`);
    } else if (Object.hasOwn(packs, pack.id)) {
      problems.push(`${path}/pack.yaml: id "${pack.id}" is already used by ${origin[pack.id]}`);
    } else {
      packs[pack.id] = pack;
      origin[pack.id] = path;
    }
  }
  if (problems.length > 0) {
    throw new ContentPacksError(
      `FQ_PACKS_DIR ${root} has ${problems.length} invalid content pack${problems.length === 1 ? "" : "s"}:\n${problems
        .map((p) => `  - ${p.replaceAll("\n", "\n    ")}`)
        .join("\n")}`,
    );
  }
  return packs;
}

/**
 * The packs built into `@fq/content`, plus every pack found under `packsDir` when given (read once,
 * now; restart the server to pick up edits).
 */
export function createContentSource(options: { packsDir?: string } = {}): ContentSource {
  const packs: Record<string, ContentPack> = { ...BUILT_IN_PACKS };
  if (options.packsDir !== undefined && options.packsDir !== "") {
    Object.assign(packs, loadPacksDirectory(options.packsDir));
  }
  return {
    names: () => Object.keys(packs),
    load(name) {
      const pack = Object.hasOwn(packs, name) ? packs[name] : undefined;
      if (!pack) throw new UnknownContentPack(name);
      return pack;
    },
  };
}
