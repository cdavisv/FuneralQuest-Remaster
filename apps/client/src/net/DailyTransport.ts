import type { Action, View } from "@fq/protocol";
import {
  type ApiClient,
  ApiError,
  type DailyChallengeScore,
  type Notice,
  type ParlorForm,
} from "@fq/server/client";
import { type LiveTransport, SendError, type Unsubscribe } from "../transport/types.js";

/**
 * One Daily Challenge run as a transport (`/api/daily/*` of the server, apps/server/README.md):
 * the same screens as a town, with no push socket, because nothing can happen to the run
 * behind the player's back.
 *
 * - `connect` starts today's run or resumes the one in progress, and is idempotent so the front
 *   door can enter before the game mounts.
 * - Every action answers with the screen and, once the run is over, the score. The run is over
 *   when the turns are used up (the desk then shows the score and one Leave button); pressing
 *   Leave answers with the lobby view, and the player is sent back to the front door's results.
 */
export class DailyTransport implements LiveTransport {
  /** The score, once the server has said the run ended. */
  result: DailyChallengeScore | null = null;
  private lastView: View | null = null;
  private connected = false;
  private readonly pushListeners = new Set<(view: View) => void>();
  private readonly noticeListeners = new Set<(notice: Notice) => void>();

  /**
   * `parlor` is what the public board will show (the player's own choice): without it the server
   * would use the account's log-on name, which would publish it.
   */
  constructor(
    private readonly api: ApiClient,
    private readonly parlor?: ParlorForm,
  ) {}

  async connect(): Promise<View> {
    if (this.connected && this.lastView) return this.lastView;
    const entered = await this.api.enterDailyChallenge(this.parlor ? { parlor: this.parlor } : {});
    this.lastView = entered.view;
    this.connected = true;
    return entered.view;
  }

  async send(action: Action): Promise<View> {
    if (!this.connected) throw new SendError("network");
    try {
      const out = await this.api.actDailyChallenge(action);
      this.lastView = out.view;
      if (out.result) {
        this.result = out.result;
        // Leaving the finished desk lands on the lobby view: the run is behind the player now.
        if (out.view.scene === "lobby") {
          this.connected = false;
          this.emit({ kind: "sessionEnded", reason: "quit" });
        }
      }
      return out.view;
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.view && error.code === "rejected") {
          this.lastView = error.view;
          return error.view;
        }
        if (error.code === "already_played" && error.result) this.result = error.result;
        if (
          error.code === "not_in_game" ||
          error.code === "already_played" ||
          error.status === 401
        ) {
          this.connected = false;
          this.emit({ kind: "sessionEnded", reason: "timeout" });
          throw new SendError("server");
        }
        if (error.status === 429) throw new SendError("rate");
        throw new SendError("server");
      }
      throw new SendError("network");
    }
  }

  onPush(listener: (view: View) => void): Unsubscribe {
    this.pushListeners.add(listener);
    return () => {
      this.pushListeners.delete(listener);
    };
  }

  onNotice(listener: (notice: Notice) => void): Unsubscribe {
    this.noticeListeners.add(listener);
    return () => {
      this.noticeListeners.delete(listener);
    };
  }

  close(): void {
    this.noticeListeners.clear();
    this.pushListeners.clear();
  }

  private emit(notice: Notice): void {
    for (const l of [...this.noticeListeners]) l(notice);
  }
}
