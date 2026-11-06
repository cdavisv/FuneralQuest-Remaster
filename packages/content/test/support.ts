import { join } from "node:path";
import {
  expandedAssetIds,
  loadAssetIds,
  PACKAGE_ROOT,
  REPO_ROOT,
  readLegacySources,
} from "../src/node.js";

export { PACKAGE_ROOT, REPO_ROOT };
export const assetIds = loadAssetIds();
/** Classic ids plus the Remastered pack's: what the Expanded pack may use. */
export const expandedIds = expandedAssetIds(assetIds);
export const legacySources = readLegacySources();
export const fixtureDir = (name: string): string => join(PACKAGE_ROOT, "test/fixtures", name);
