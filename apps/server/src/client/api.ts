import type { Action, View } from "@fq/protocol";
import type {
  ActionResponse,
  AuthResponse,
  BlockInfo,
  BlockResponse,
  BlocksResponse,
  DailyChallengeActionResponse,
  DailyChallengeEnterRequest,
  DailyChallengeEnterResponse,
  DailyChallengeInfo,
  DailyChallengeScore,
  EnterRequest,
  EnterResponse,
  ErrorBody,
  FeaturesResponse,
  HallOfFameResponse,
  LeaderboardDays,
  LeaderboardResponse,
  MeResponse,
  MuteInfo,
  ReportRequest,
  ReportResponse,
  RequestIssue,
  SafetyTarget,
  TownInfo,
  UpgradeResponse,
} from "../wire.js";

function cleanIssues(raw: unknown): RequestIssue[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const issues: RequestIssue[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const { path, message } = item as { path?: unknown; message?: unknown };
    if (typeof message !== "string") continue;
    issues.push({ path: typeof path === "string" ? path : "", message });
  }
  return issues.length > 0 ? issues : undefined;
}

/** An error answer from the server, with its machine-readable code. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** The player's current View, sent with a rejected action. */
    readonly view?: View,
    /** The form field a refused parlor form complained about. */
    readonly field?: string,
    /** What was wrong with a body the server refused as `invalid_request`: path and message each. */
    readonly issues?: RequestIssue[],
    /** How a Daily Challenge run ended, sent with `already_played`. */
    readonly result?: DailyChallengeScore,
    /** What a mute refuses and until when, sent with `muted`. */
    readonly mute?: MuteInfo,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClientOptions {
  /** Server origin such as "https://fq.example.com"; empty means the page's own origin. */
  baseUrl?: string;
  /** A bearer token from an earlier log-in. */
  token?: string | null;
  fetch?: typeof fetch;
  /** Milliseconds before a request is abandoned. Default 15000. */
  timeoutMs?: number;
}

/** A typed wrapper over the HTTP API. It holds the session token after sign-up or log-in. */
export class ApiClient {
  token: string | null;
  readonly baseUrl: string;
  private readonly doFetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "").replace(/\/+$/, "");
    this.token = options.token ?? null;
    this.doFetch = options.fetch ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    const response = await this.doFetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text === "" ? undefined : JSON.parse(text);
    } catch {
      parsed = undefined;
    }
    if (!response.ok) {
      const err = (parsed ?? {}) as Partial<ErrorBody>;
      throw new ApiError(
        response.status,
        err.error ?? "http_error",
        err.message ?? `HTTP ${response.status}`,
        err.view,
        err.field,
        cleanIssues(err.issues),
        err.result,
        err.mute,
      );
    }
    return parsed as T;
  }

  private remember(auth: AuthResponse): AuthResponse {
    this.token = auth.token;
    return auth;
  }

  /** `invite`: the invite code, on a server that requires one (`features().access`). */
  async signUp(login: string, password: string, invite?: string): Promise<AuthResponse> {
    return this.remember(
      await this.call("POST", "/api/auth/signup", {
        login,
        password,
        ...(invite !== undefined && invite.trim() !== "" ? { invite } : {}),
      }),
    );
  }

  async logIn(login: string, password: string): Promise<AuthResponse> {
    return this.remember(await this.call("POST", "/api/auth/login", { login, password }));
  }

  async guest(invite?: string): Promise<AuthResponse> {
    return this.remember(
      await this.call(
        "POST",
        "/api/auth/guest",
        invite !== undefined && invite.trim() !== "" ? { invite } : {},
      ),
    );
  }

  /** Makes a guest a full account with this log-in name and password; the parlor and session carry on. */
  upgrade(login: string, password: string): Promise<UpgradeResponse> {
    return this.call("POST", "/api/auth/upgrade", { login, password });
  }

  async logOut(): Promise<void> {
    await this.call<void>("POST", "/api/auth/logout");
    this.token = null;
  }

  /** Which optional parts this server has (museum mode). */
  features(): Promise<FeaturesResponse> {
    return this.call("GET", "/api/features");
  }

  me(): Promise<MeResponse> {
    return this.call("GET", "/api/me");
  }

  async towns(): Promise<TownInfo[]> {
    return (await this.call<{ towns: TownInfo[] }>("GET", "/api/towns")).towns;
  }

  town(townId: string): Promise<TownInfo> {
    return this.call("GET", `/api/towns/${encodeURIComponent(townId)}`);
  }

  enter(townId: string, request: EnterRequest = {}): Promise<EnterResponse> {
    return this.call("POST", `/api/towns/${encodeURIComponent(townId)}/enter`, request);
  }

  async act(townId: string, action: Action): Promise<View> {
    const r = await this.call<ActionResponse>(
      "POST",
      `/api/towns/${encodeURIComponent(townId)}/action`,
      { action },
    );
    return r.view;
  }

  async currentView(townId: string): Promise<View> {
    const r = await this.call<ActionResponse>(
      "GET",
      `/api/towns/${encodeURIComponent(townId)}/view`,
    );
    return r.view;
  }

  // ------------------------------------------------------ player safety

  /** The players this account has blocked. */
  async blocks(): Promise<BlockInfo[]> {
    return (await this.call<BlocksResponse>("GET", "/api/blocks")).blocks;
  }

  /** Blocks whoever wrote `target` (a rankings row, a cafe line as shown, a letter...). */
  block(townId: string, target: SafetyTarget): Promise<BlockResponse> {
    return this.call("POST", "/api/blocks", { townId, target });
  }

  async unblock(blockId: number): Promise<void> {
    await this.call<void>("DELETE", `/api/blocks/${blockId}`);
  }

  /** Reports content or a name. The reported player is never told who reported them. */
  report(request: ReportRequest): Promise<ReportResponse> {
    return this.call("POST", "/api/reports", request);
  }

  /** Everything stored about this account, as JSON. */
  exportData(): Promise<Record<string, unknown>> {
    return this.call("GET", "/api/me/export");
  }

  /** Deletes this account and its parlors for good. Guests need no password. */
  async deleteAccount(password?: string): Promise<void> {
    await this.call<void>("POST", "/api/me/delete", {
      ...(password !== undefined ? { password } : {}),
      confirm: true,
    });
    this.token = null;
  }

  // ------------------------------------------------------- hall of fame

  /** Finished seasons, newest first; `townId` limits it to one town. Page with `before`. */
  hallOfFame(
    options: { townId?: string; before?: number; limit?: number } = {},
  ): Promise<HallOfFameResponse> {
    const q = new URLSearchParams();
    if (options.townId !== undefined) q.set("townId", options.townId);
    if (options.before !== undefined) q.set("before", String(options.before));
    if (options.limit !== undefined) q.set("limit", String(options.limit));
    const text = q.toString();
    return this.call("GET", `/api/hall-of-fame${text ? `?${text}` : ""}`);
  }

  // ----------------------------------------------------- daily challenge

  /** Today's challenge and, when logged in, this account's state in it. */
  dailyChallenge(): Promise<DailyChallengeInfo> {
    return this.call("GET", "/api/daily");
  }

  /** Starts today's run, or resumes the one in progress. 409 `already_played` once it is over. */
  enterDailyChallenge(
    request: DailyChallengeEnterRequest = {},
  ): Promise<DailyChallengeEnterResponse> {
    return this.call("POST", "/api/daily/enter", request);
  }

  /** The screen the run is on. */
  async dailyChallengeView(): Promise<View> {
    return (await this.call<ActionResponse>("GET", "/api/daily/view")).view;
  }

  /** One action in the run. `result` is set once the run is over. */
  actDailyChallenge(action: Action): Promise<DailyChallengeActionResponse> {
    return this.call("POST", "/api/daily/action", { action });
  }

  /** A day's board (default today; `day` is a date such as "2026-11-06"). */
  dailyLeaderboard(options: { day?: string; limit?: number } = {}): Promise<LeaderboardResponse> {
    const q = new URLSearchParams();
    if (options.day !== undefined) q.set("day", options.day);
    if (options.limit !== undefined) q.set("limit", String(options.limit));
    const text = q.toString();
    return this.call("GET", `/api/daily/leaderboard${text ? `?${text}` : ""}`);
  }

  /** Days that have a board, newest first, with how many entries each has. */
  async dailyDays(limit?: number): Promise<LeaderboardDays["days"]> {
    return (
      await this.call<LeaderboardDays>("GET", `/api/daily/days${limit ? `?limit=${limit}` : ""}`)
    ).days;
  }
}
