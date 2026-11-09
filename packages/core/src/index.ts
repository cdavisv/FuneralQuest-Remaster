export { blockedList, blockersOf, isBlocking, setBlocked } from "./classic/blocking.js";
export { showTime, stampNotice } from "./classic/clock.js";
export * from "./classic/customer.js";
export {
  casketName,
  cMan,
  customerMood,
  cYoungMan,
  dRelation,
  incomeLabel,
  priceOf,
} from "./classic/customerText.js";
export { computeEvent, type ResolvedEvent } from "./classic/events.js";
export {
  listAnnouncements,
  listQueuedLetters,
  type RemovedText,
  type RenameError,
  removeAnnouncement,
  removeLetter,
  removePlayerText,
  renamePlayer,
  type StoredText,
  textHash,
} from "./classic/moderation.js";
export { enterHospitalRoom } from "./classic/modules/hospital.js";
export { CLASSIC_PLACES, createClassicRegistry } from "./classic/modules/index.js";
export { saleBp } from "./classic/modules/negotiation.js";
export { linkHref, newsRichText } from "./classic/modules/news.js";
export type { NewPlayerError, NewPlayerField, NewPlayerInput } from "./classic/newPlayer.js";
export { expMod, luckMod, turnsMod } from "./classic/players.js";
export { clearPresence, isPresent, setPresence } from "./classic/presence.js";
export { playerRank, rankPercent, rankSlots, ratingTitle } from "./classic/rankings.js";
export {
  ScriptApi,
  type ScriptButton,
  type ScriptDef,
  type ScriptGen,
  type ScriptOp,
  type ScriptScreen,
  type ScriptTarget,
} from "./classic/scripts/runtime.js";
export { replaceNoCase, swearCheck } from "./classic/swearFilter.js";
export {
  type LobbyStatus,
  lobbyStatus,
  newPlayersClosed,
  resetGame,
  resetTown,
} from "./classic/tournament.js";
export { filterUserText, type UserTextKind } from "./classic/userText.js";
export {
  CLASSIC_TEXT,
  type ClassicText,
  type LovedLine,
  type NegotiationText,
  type PlaceText,
} from "./content/classicText.js";
export { type NewsCondition, newsConditionMet } from "./content/newsCondition.js";
export { CLASSIC_SOCIAL_TEXT, type SocialText } from "./content/socialText.js";
export type {
  ContentPack,
  EventEntry,
  RangedBlock,
  RangedTable,
  RiskEntry,
  SaleItem,
  SwearWord,
} from "./content/types.js";
export {
  type CreatePlayerResult,
  classicContext,
  createPlayer,
  createTown,
  enterGame,
  leaveGame,
  type MaintenanceResult,
  runDailyMaintenance,
  type StepResult,
  step,
} from "./engine/engine.js";
export { checkAction } from "./engine/guard.js";
export type {
  MaintenanceHook,
  PlayerCreatedHook,
  PlayerNewDayHook,
  ViewHook,
} from "./engine/registry.js";
export { type LocationModule, type PlaceDef, Registry } from "./engine/registry.js";
export { type Effect, type EngineContext, Turn } from "./engine/turn.js";
export { assetId, button, goButton, hud } from "./engine/view.js";
export { checkExpandedContent, checkNewsCondition } from "./expanded/content/check.js";
export { EXPANDED_STARTER } from "./expanded/content/starter.js";
export { PLACES_A_STARTER, type PlacesAContent } from "./expanded/content/townPlacesA.js";
export { PLACES_B_STARTER, type PlacesBContent } from "./expanded/content/townPlacesB.js";
export { TOWN_STARTER } from "./expanded/content/townStarter.js";
// Expanded ruleset (docs/expanded-rules.md).
export type * from "./expanded/content/types.js";
export { generateCustomer, xvars } from "./expanded/customer.js";
export {
  addModifier,
  liveModifiers,
  MODIFIER_KEYS,
  type ModifierKey,
  modValue,
  pruneModifiers,
} from "./expanded/modifiers.js";
export { arriveX, expandedNegotiationModule, handSize, XNEG } from "./expanded/negotiation.js";
export { expandedNewDay } from "./expanded/newDay.js";
export {
  decorateExpandedView,
  injuryRows,
  karmaBandOf,
  karmaScale,
  rewardFacts,
} from "./expanded/panels.js";
export {
  buildingLevel,
  computeRating,
  defenceLevel,
  hasPerk,
  hasUpgrade,
  incomeShift,
  type PerkId,
  PREP_PICTURES,
  parlorPicture,
  perksOf,
  prepPicture,
  refreshRating,
  stockCapacity,
} from "./expanded/parlor.js";
export {
  applyReward,
  ensureExpanded,
  karmaMod,
  moneyMod,
  newExpandedPlayer,
} from "./expanded/players.js";
export { bonusVisits, defenceStrength, expandedBattleBp, pvpMultiplier } from "./expanded/pvp.js";
export {
  createExpandedRegistry,
  EXPANDED_PLACES,
  expandedContext,
  withExpandedContent,
} from "./expanded/registry.js";
export { billLines, billTotal, settleSale } from "./expanded/sale.js";
export {
  baseSaleBp,
  closenessBonus,
  estimateHalfShare,
  gridLimit,
  makeEstimate,
  markedUp,
  narrowEstimate,
  pvpGain,
  underdogShare,
  wholesalePrice,
} from "./expanded/scoring.js";
export type * from "./expanded/state.js";
// The Expanded town and living world (docs/expanded-rules.md sections 16 to 26).
export { advanceArcs, arcTest, nextBeat, startArc, tally } from "./expanded/town/arcs.js";
export { collectLoan, loanLimit, sendTags, transferFee } from "./expanded/town/bank.js";
export { type ChainStanding, chainStandings } from "./expanded/town/chains.js";
export {
  createDailyChallenge,
  type DailyChallenge,
  type DailyChallengeEntry,
  type DailyChallengeResult,
  dailyChallengeResult,
  dailyChallengeSeed,
  rankDailyChallenge,
  startDailyChallenge,
} from "./expanded/town/challenge.js";
export { bingoPot, bingoRound } from "./expanded/town/church.js";
export {
  electionPhase,
  electionTally,
  passChance,
  seasonDay,
  tallyBallot,
} from "./expanded/town/cityHall.js";
export {
  drawReturn,
  hitPrice,
  resolveHits,
  shotsReturn,
  slotsPays,
  slotsReturn,
} from "./expanded/town/club.js";
export { duelRefusal, duelStake, shoveChance } from "./expanded/town/graveyard.js";
export { TOWN_PLACES } from "./expanded/town/index.js";
export {
  addInjury,
  chainOf,
  injuryHp,
  lifeOf,
  mayorOf,
  newLife,
  sameChain,
  TOWN_MODIFIER_KEYS,
  townLife,
} from "./expanded/town/life.js";
export type * from "./expanded/town/state.js";
export { townMidnight, townMorning, townPanel } from "./expanded/town/world.js";
export { waitX } from "./expanded/wait.js";
export { ClassicRandom } from "./rng/classicRandom.js";
export { MSVC_RAND_MAX, MsvcRand } from "./rng/msvcRand.js";
export { MT_DEFAULT_SEED, Mt19937 } from "./rng/mt19937.js";
export { deriveSeed, openStream, type StreamPosition, TOWN_STREAM } from "./rng/streams.js";
export {
  CLASSIC_RULES,
  CLASSIC_SETTINGS,
  type ClassicFixes,
  type ClassicRules,
  type GameSettings,
  type HearseRule,
  type Nudge,
  originalClassicRules,
  type PlaceRules,
  type PsychCheck,
  type RulesetId,
} from "./rules/classicRules.js";
export {
  EXPANDED,
  EXPANDED_RULES,
  type ExpandedRules,
  type UpgradeRule,
} from "./rules/expandedRules.js";
export { EXPANDED_TOWN, type ExpandedTownRules } from "./rules/expandedTownRules.js";
export * from "./state/types.js";
export { fill, intToCash } from "./text/format.js";
export { parseLegacyText, richTextToPlain, stripLegacyCodes } from "./text/legacyText.js";
