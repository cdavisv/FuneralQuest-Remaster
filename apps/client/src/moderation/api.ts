import type {
  ApiClient,
  BlockInfo,
  BlockResponse,
  MeResponse,
  ReportRequest,
  ReportResponse,
  SafetyTarget,
} from "@fq/server/client";

/**
 * What the safety screens need from the server. Only an online session has it: Solo, the mock
 * and the Daily Challenge have no other players, so nothing here is offered there.
 */
export interface ModerationApi {
  report(request: ReportRequest): Promise<ReportResponse>;
  block(townId: string, target: SafetyTarget): Promise<BlockResponse>;
  blocks(): Promise<BlockInfo[]>;
  unblock(blockId: number): Promise<void>;
  /** Everything stored about the account. */
  exportData(): Promise<Record<string, unknown>>;
  /** Deletes the account. Guests have no password. */
  deleteAccount(password?: string): Promise<void>;
  /** Who this is (guest or not, which parlor in which town) and any mutes in force. */
  me(): Promise<MeResponse>;
}

export function createModerationApi(api: ApiClient): ModerationApi {
  return {
    report: (request) => api.report(request),
    block: (townId, target) => api.block(townId, target),
    blocks: () => api.blocks(),
    unblock: (blockId) => api.unblock(blockId),
    exportData: () => api.exportData(),
    deleteAccount: (password) => api.deleteAccount(password),
    me: () => api.me(),
  };
}
