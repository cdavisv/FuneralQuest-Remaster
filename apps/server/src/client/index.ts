/**
 * Typed client for the Funeral Quest server. `ServerTransport` implements the
 * web client's `Transport` interface; `ApiClient` covers sign-up, log-in and
 * the town directory. Import it as `@fq/server/client`.
 */

export type {
  AccountInfo,
  AuthResponse,
  BlockInfo,
  BlockRequest,
  BlockResponse,
  BlocksResponse,
  DailyChallengeActionResponse,
  DailyChallengeEnterRequest,
  DailyChallengeEnterResponse,
  DailyChallengeInfo,
  DailyChallengeScore,
  DailyChallengeYou,
  EndReason,
  EnterResponse,
  FeaturesResponse,
  HallChain,
  HallOfFameEntry,
  HallOfFameResponse,
  HallStanding,
  LeaderboardDays,
  LeaderboardResponse,
  LeaderboardRow,
  MeResponse,
  MuteInfo,
  MuteScope,
  Notice,
  ParlorForm,
  ParlorInfo,
  ReportCategory,
  ReportRequest,
  ReportResponse,
  RequestIssue,
  SafetyTarget,
  ServerMessage,
  TownInfo,
  UpgradeResponse,
} from "../wire.js";
export { MUTE_SCOPES, REPORT_CATEGORIES } from "../wire.js";
export { ApiClient, type ApiClientOptions, ApiError } from "./api.js";
export {
  DailyChallengeTransport,
  type GameTransport,
  ServerTransport,
  type ServerTransportOptions,
  type SocketLike,
  type Unsubscribe,
} from "./transport.js";
