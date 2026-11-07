import type { Transcript } from "./transcript.js";

export class AdminError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    message: string,
  ) {
    super(message);
  }
}

/** The admin player record (`GET /admin/towns/:id/players/:pid`). */
export interface AdminPlayer {
  id: number;
  active: boolean;
  name: string;
  logon: string;
  parlor: string;
  bp: number;
  bpToday: number;
  money: number;
  turns: number;
  hp: number;
  hpMax: number;
  luck: number;
  tags: [number, number, number];
  online: boolean;
  accountId: number | null;
  mailWaiting: number;
  [key: string]: unknown;
}

export interface AdminTown {
  id: string;
  day: number;
  revision: number;
  nextDayAt: string;
  season: number | null;
  tournament: { active: boolean; daysLeft: number | null };
  players: { registered: number; online: number; max: number };
  rankings: { rank: number; name: string; parlor: string; bp: number }[];
  [key: string]: unknown;
}

export interface AuditRow {
  id: number;
  at: number;
  town_id: string | null;
  account_id: number | null;
  player_id: number | null;
  kind: string;
  data: unknown;
}

/** A sysop with the admin token, over HTTP. Every call goes to the transcript. */
export class AdminApi {
  constructor(
    private baseUrl: string,
    private readonly token: string,
    private readonly transcript: Transcript,
  ) {}

  retarget(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  async call<T>(method: string, path: string, body?: unknown, record = true): Promise<T> {
    const started = Date.now();
    const headers: Record<string, string> = { authorization: `Bearer ${this.token}` };
    if (body !== undefined) headers["content-type"] = "application/json";
    const r = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(60_000),
    });
    const text = await r.text();
    let parsed: unknown = text;
    try {
      parsed = text === "" ? null : JSON.parse(text);
    } catch {
      // not JSON
    }
    if (record) {
      this.transcript.write({
        kind: "admin",
        method,
        path,
        status: r.status,
        ms: Date.now() - started,
        body: parsed,
      });
    }
    if (!r.ok)
      throw new AdminError(
        r.status,
        parsed,
        `${method} ${path}: ${r.status} ${text.slice(0, 200)}`,
      );
    return parsed as T;
  }

  server(): Promise<{ now: string; towns: number; accounts: number }> {
    return this.call("GET", "/admin/server");
  }

  town(id: string): Promise<AdminTown> {
    return this.call("GET", `/admin/towns/${id}`);
  }

  createTown(body: unknown): Promise<unknown> {
    return this.call("POST", "/admin/towns", body);
  }

  async players(townId: string): Promise<AdminPlayer[]> {
    const r = await this.call<{ players: { id: number }[] }>(
      "GET",
      `/admin/towns/${townId}/players?limit=500&includeInactive=true`,
    );
    return Promise.all(r.players.map((p) => this.player(townId, p.id)));
  }

  player(townId: string, id: number): Promise<AdminPlayer> {
    return this.call("GET", `/admin/towns/${townId}/players/${id}`);
  }

  settings(townId: string): Promise<{ settings: Record<string, unknown> }> {
    return this.call("GET", `/admin/towns/${townId}/settings`);
  }

  patchSettings(
    townId: string,
    patch: Record<string, unknown>,
  ): Promise<{ settings: Record<string, unknown> }> {
    return this.call("PATCH", `/admin/towns/${townId}/settings`, patch);
  }

  newDay(townId: string): Promise<{ daysRun: number }> {
    return this.call("POST", `/admin/towns/${townId}/new-day`);
  }

  broadcast(townId: string, message: string): Promise<{ delivered: number }> {
    return this.call("POST", `/admin/towns/${townId}/broadcast`, { message });
  }

  kick(townId: string, playerId: number): Promise<unknown> {
    return this.call("POST", `/admin/towns/${townId}/players/${playerId}/kick`);
  }

  ban(accountId: number, reason: string): Promise<unknown> {
    return this.call("POST", `/admin/accounts/${accountId}/ban`, { reason });
  }

  unban(accountId: number): Promise<unknown> {
    return this.call("POST", `/admin/accounts/${accountId}/unban`);
  }

  snapshot(townId: string, reason: string): Promise<{ id: number }> {
    return this.call("POST", `/admin/towns/${townId}/snapshots`, { reason });
  }

  snapshots(
    townId: string,
  ): Promise<{ snapshots: { id: number; day: number; reason: string; revision: number }[] }> {
    return this.call("GET", `/admin/towns/${townId}/snapshots`);
  }

  rollback(townId: string, snapshotId: number): Promise<AdminTown> {
    return this.call("POST", `/admin/towns/${townId}/rollback`, { snapshotId });
  }

  backup(label?: string): Promise<BackupManifestLike> {
    return this.call("POST", "/admin/backups", label ? { label } : {});
  }

  /** Every audit row matching the query, oldest first. */
  async audit(query: Record<string, string | number>): Promise<AuditRow[]> {
    const rows: AuditRow[] = [];
    let before: number | null = null;
    for (;;) {
      const q = new URLSearchParams({ limit: "1000" });
      for (const [k, v] of Object.entries(query)) q.set(k, String(v));
      if (before !== null) q.set("before", String(before));
      const r: { entries: AuditRow[]; next: number | null } = await this.call(
        "GET",
        `/admin/audit?${q.toString()}`,
        undefined,
        false,
      );
      rows.push(...r.entries);
      if (r.next === null) break;
      before = r.next;
    }
    return rows.reverse();
  }
}

export interface BackupManifestLike {
  file: string;
  createdAt: string;
  bytes: number;
  sha256: string;
  schemaVersion: number;
  towns: { id: string; day: number; revision: number; players: number }[];
}
