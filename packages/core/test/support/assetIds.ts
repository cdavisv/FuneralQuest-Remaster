/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./legacyContent.js";

/**
 * Art ids the asset tests accept: the Classic manifest (`assets/manifest.json`)
 * and the Remastered pack's (`assets/remastered/manifest.json`), which falls
 * back to Classic for everything it does not draw.
 */
interface Manifest {
  assets: { id: string }[];
  legacyUrl?: Record<string, string>;
}

function read(path: string): Manifest {
  return JSON.parse(readFileSync(resolve(REPO_ROOT, path), "utf8")) as Manifest;
}

export const CLASSIC_MANIFEST = read("assets/manifest.json");
export const REMASTERED_MANIFEST = read("assets/remastered/manifest.json");
export const CLASSIC_IDS = new Set(CLASSIC_MANIFEST.assets.map((a) => a.id));
export const REMASTERED_IDS = new Set(REMASTERED_MANIFEST.assets.map((a) => a.id));
export const ALL_IDS = new Set([...CLASSIC_IDS, ...REMASTERED_IDS]);
