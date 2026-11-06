/** Node-only entry: loading packs from directories, the importer and the build step. */
export * from "./index.js";
export type { ImportNote, LegacySources, LegacyTables } from "./legacy.js";
export { importLegacyTables } from "./legacy.js";
export { renderReport } from "./report.js";
export {
  BUILT_DIR,
  CLASSIC_DIR,
  EXPANDED_DIR,
  expandedAssetIds,
  importVintage,
  LEGACY_DIST,
  type LoadOptions,
  loadAssetIds,
  loadBuiltInSources,
  loadPackFromDirectory,
  loadRemasteredAssetIds,
  MANIFEST_PATH,
  PACKAGE_ROOT,
  REMASTERED_MANIFEST_PATH,
  REPO_ROOT,
  readLegacySources,
  renderBuiltPacks,
  renderSourcePack,
  VINTAGE_DIR,
  writeFiles,
} from "./sources.js";
