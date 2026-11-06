import type { RichText } from "@fq/protocol";
import type { SafetyTarget } from "@fq/server/client";
import { createContext, useContext } from "react";
import type { ModerationApi } from "./api.js";

/** What the safety screens know about the session. */
export interface ModerationValue {
  api: ModerationApi;
  townId: string;
  /** Who the player is, once the server has said; the menus wait for it so they skip the player's own lines. */
  self: { name: string | null; playerId: number | null; guest: boolean } | null;
  openReport(target: SafetyTarget, subject: string): void;
  openBlock(target: SafetyTarget, subject: string): void;
  openDelete(): void;
  openAnnouncements(body: RichText): void;
}

export const ModerationContext = createContext<ModerationValue | null>(null);

/** Null outside an online session (Solo, the mock, the Daily Challenge): nothing is offered there. */
export function useModeration(): ModerationValue | null {
  return useContext(ModerationContext);
}
