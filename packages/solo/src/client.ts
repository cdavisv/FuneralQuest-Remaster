/**
 * The part of Solo mode a page needs on its main thread: the worker proxy, save files and slots,
 * and the types. It does not import the game host, the bots or the rules engine (those live in
 * the worker), so a bundler keeps them out of the page's own chunk.
 */

export type { Difficulty, PersonalityId } from "@fq/bots/personalities";
export { pageTimeZone, practiceDay, zoneOffsetMinutes } from "./dates.js";
export { SoloWorkerClient, type WorkerLike } from "./proxy.js";
export { chooseRivals } from "./rivals.js";
export {
  exportSave,
  importSave,
  migrateSave,
  SaveError,
  summarize,
} from "./saves.js";
export type { WireHostOptions } from "./serve.js";
export { IndexedDbSaveStorage, MemorySaveStorage, type SaveStorage } from "./storage.js";
export {
  type ChallengeStatus,
  END_DAY,
  type EndReason,
  type Notice,
  RESUME,
  type RulesetName,
  SAVE_FORMAT,
  SAVE_VERSION,
  type SavedBot,
  type SaveSummary,
  type SoloConfig,
  type SoloRival,
  type SoloSave,
  type SoloStatus,
  type Standing,
  type Transport,
  type Unsubscribe,
} from "./types.js";
