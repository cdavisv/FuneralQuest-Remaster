import { createHash, randomBytes } from "node:crypto";
import type { Clock } from "../clock.js";
import { type Db, transaction } from "../db/database.js";
import type { InviteRow, IpBanRow } from "../db/stores.js";
import { InviteStore, IpBanStore } from "../db/stores.js";
import {
  generateInviteCode,
  type InviteInfo,
  inviteInfo,
  inviteState,
  normaliseInviteCode,
} from "./invites.js";
import { type IpRule, parseAddress, parseIpRule, ruleMatches } from "./ip.js";
import type { PasswordHasher } from "./passwords.js";

export interface Account {
  id: number;
  login: string;
  guest: boolean;
  banned: boolean;
  banReason: string | null;
  createdAt: number;
  lastLoginAt: number | null;
}

export interface AuthInfo {
  account: Account;
  sessionId: number;
}

export type AuthFailure =
  | "login_taken"
  | "bad_credentials"
  | "banned"
  | "ip_banned"
  | "signup_disabled"
  | "guest_disabled"
  | "not_guest"
  | "invite_required"
  | "invite_invalid"
  | "invite_used_up"
  | "invite_expired";

/** The invite failures that mean a wrong code was typed (counted like a wrong password). */
export const INVITE_FAILURES: ReadonlySet<AuthFailure> = new Set<AuthFailure>([
  "invite_invalid",
  "invite_used_up",
  "invite_expired",
]);

export class AuthError extends Error {
  constructor(readonly code: AuthFailure) {
    super(code);
  }
}

/** Engine log-on names are 3 to 20 characters; account logins must fit. */
export const LOGIN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,19}$/;

interface AccountRow {
  id: number;
  login: string;
  password_hash: string | null;
  is_guest: number;
  created_at: number;
  last_login_at: number | null;
  banned: number;
  ban_reason: string | null;
}

function toAccount(r: AccountRow): Account {
  return {
    id: r.id,
    login: r.login,
    guest: r.is_guest === 1,
    banned: r.banned === 1,
    banReason: r.ban_reason,
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at,
  };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

interface ParsedBan {
  row: IpBanRow;
  rule: IpRule;
}

/**
 * Accounts, sessions and bans. Passwords are Argon2id hashes; session tokens
 * are 256 random bits, handed out once and stored only as SHA-256 digests, so a
 * leaked database does not leak working tokens.
 */
export class AccountService {
  private readonly ipBans: IpBanStore;
  readonly invites: InviteStore;
  private banCache: ParsedBan[] | null = null;
  /** A hash to verify against when the login does not exist, so timing does not reveal it. */
  private dummyHash: Promise<string>;

  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
    private readonly hasher: PasswordHasher,
    private readonly options: {
      sessionTtlMs: number;
      signupEnabled: boolean;
      guestEnabled: boolean;
      /** A new account or guest needs an invite code (`FQ_INVITE_REQUIRED`). */
      inviteRequired: boolean;
    },
  ) {
    this.ipBans = new IpBanStore(db);
    this.invites = new InviteStore(db);
    this.dummyHash = hasher.hash(randomBytes(16).toString("hex"));
  }

  // -------------------------------------------------------------- sign-up

  /**
   * `invite` is the code the player typed; needed only while invites are required, and ignored
   * otherwise. The code's use is taken in the same transaction as the account is made, so a code
   * with one use left makes one account however many requests race for it.
   */
  async signUp(
    login: string,
    password: string,
    ip: string,
    invite?: string,
  ): Promise<{ account: Account; token: string; expiresAt: number }> {
    if (!this.options.signupEnabled) throw new AuthError("signup_disabled");
    this.assertIpAllowed(ip);
    const code = this.checkInvite(invite);
    const passwordHash = await this.hasher.hash(password);
    const now = this.clock.now();
    try {
      return transaction(this.db, () => {
        if (code !== null) this.redeemInvite(code);
        const r = this.db
          .prepare(
            "INSERT INTO accounts (login, password_hash, is_guest, created_at, last_login_at) VALUES (?, ?, 0, ?, ?)",
          )
          .run(login, passwordHash, now, now);
        return this.startSession(Number(r.lastInsertRowid), ip);
      });
    } catch (error) {
      if (error instanceof Error && /UNIQUE/i.test(error.message)) {
        throw new AuthError("login_taken");
      }
      throw error;
    }
  }

  /** A throwaway account with no password, for trying the game. Needs an invite like `signUp`. */
  async createGuest(
    ip: string,
    invite?: string,
  ): Promise<{ account: Account; token: string; expiresAt: number }> {
    if (!this.options.guestEnabled) throw new AuthError("guest_disabled");
    this.assertIpAllowed(ip);
    const code = this.checkInvite(invite);
    const now = this.clock.now();
    return transaction(this.db, () => {
      if (code !== null) this.redeemInvite(code);
      for (let attempt = 0; attempt < 5; attempt++) {
        const login = `guest-${randomBytes(4).toString("hex")}`;
        try {
          const r = this.db
            .prepare(
              "INSERT INTO accounts (login, password_hash, is_guest, created_at, last_login_at) VALUES (?, NULL, 1, ?, ?)",
            )
            .run(login, now, now);
          return this.startSession(Number(r.lastInsertRowid), ip);
        } catch (error) {
          if (!(error instanceof Error && /UNIQUE/i.test(error.message))) throw error;
        }
      }
      throw new Error("could not allocate a guest name");
    });
  }

  /** A password hash for `upgradeGuest`, made before the town locks are taken (hashing is slow). */
  hashPassword(password: string): Promise<string> {
    return this.hasher.hash(password);
  }

  /**
   * Turns a guest account into a full one: a new log-in name and a password, the same account row,
   * so every link to it (parlors, sessions, blocks, reports) stays. Synchronous, so the caller can
   * rename the engine's players in the same turn. `login_taken` if the name is in use,
   * `not_guest` if the account is already a full one.
   */
  upgradeGuest(accountId: number, login: string, passwordHash: string): Account {
    try {
      const r = this.db
        .prepare(
          "UPDATE accounts SET login = ?, password_hash = ?, is_guest = 0 WHERE id = ? AND is_guest = 1",
        )
        .run(login, passwordHash, accountId);
      if (Number(r.changes) === 0) throw new AuthError("not_guest");
    } catch (error) {
      if (error instanceof Error && /UNIQUE/i.test(error.message)) {
        throw new AuthError("login_taken");
      }
      throw error;
    }
    const account = this.getAccount(accountId);
    if (!account) throw new Error("account vanished");
    return account;
  }

  /** Puts a guest back as it was (an upgrade that could not finish). */
  revertUpgrade(accountId: number, login: string): void {
    this.db
      .prepare("UPDATE accounts SET login = ?, password_hash = NULL, is_guest = 1 WHERE id = ?")
      .run(login, accountId);
  }

  /**
   * Creates an account without opening a session (museum mode: the original client has no
   * tokens). Same rules as `signUp`; `AuthError("login_taken")` if the name is in use.
   */
  async createWithPassword(login: string, password: string): Promise<Account> {
    if (!this.options.signupEnabled) throw new AuthError("signup_disabled");
    // The original client has nowhere to type an invite code.
    if (this.options.inviteRequired) throw new AuthError("invite_required");
    const passwordHash = await this.hasher.hash(password);
    const now = this.clock.now();
    try {
      const r = this.db
        .prepare(
          "INSERT INTO accounts (login, password_hash, is_guest, created_at, last_login_at) VALUES (?, ?, 0, ?, NULL)",
        )
        .run(login, passwordHash, now);
      const account = this.getAccount(Number(r.lastInsertRowid));
      if (!account) throw new Error("account vanished");
      return account;
    } catch (error) {
      if (error instanceof Error && /UNIQUE/i.test(error.message)) {
        throw new AuthError("login_taken");
      }
      throw error;
    }
  }

  /** The account with this login (any letter case), or undefined. */
  findByLogin(login: string): Account | undefined {
    const row = this.db.prepare("SELECT * FROM accounts WHERE login = ?").get(login) as
      | AccountRow
      | undefined;
    return row ? toAccount(row) : undefined;
  }

  /**
   * Checks a password without opening a session. Returns the account, or null for an unknown
   * login, a wrong password or a guest (no password). Takes as long either way. A banned
   * account throws `AuthError("banned")` only after the password was right.
   */
  async verifyPassword(login: string, password: string): Promise<Account | null> {
    const row = this.db.prepare("SELECT * FROM accounts WHERE login = ?").get(login) as
      | AccountRow
      | undefined;
    const stored = row?.password_hash ?? (await this.dummyHash);
    const ok = await this.hasher.verify(stored, password);
    if (!row?.password_hash || !ok) return null;
    if (row.banned === 1) throw new AuthError("banned");
    this.db
      .prepare("UPDATE accounts SET last_login_at = ? WHERE id = ?")
      .run(this.clock.now(), row.id);
    return toAccount(row);
  }

  // -------------------------------------------------------------- invites

  get inviteRequired(): boolean {
    return this.options.inviteRequired;
  }

  /**
   * While invites are required: the normalised code, after a first look that it is open (a fast
   * refusal before the slow password hash; `redeemInvite` decides). Null when invites are off.
   */
  private checkInvite(typed: string | undefined): string | null {
    if (!this.options.inviteRequired) return null;
    const code = normaliseInviteCode(typed ?? "");
    if (code === "") throw new AuthError("invite_required");
    const row = this.invites.byCode(code);
    if (!row) throw new AuthError("invite_invalid");
    this.assertInviteOpen(row);
    return code;
  }

  /** Takes one use of the code, or throws why it cannot. Call inside the account's transaction. */
  private redeemInvite(code: string): void {
    if (this.invites.redeem(code, this.clock.now())) return;
    const row = this.invites.byCode(code);
    if (!row) throw new AuthError("invite_invalid");
    this.assertInviteOpen(row);
    throw new AuthError("invite_used_up");
  }

  private assertInviteOpen(row: InviteRow): void {
    switch (inviteState(row, this.clock.now())) {
      case "revoked":
      case "expired":
        throw new AuthError("invite_expired");
      case "used_up":
        throw new AuthError("invite_used_up");
      case "active":
        return;
    }
  }

  /** A new code for `uses` accounts; `expiresAt` null for none. */
  createInvite(label: string, uses: number, expiresAt: number | null): InviteInfo {
    const now = this.clock.now();
    for (let attempt = 0; attempt < 10; attempt++) {
      const row = this.invites.add(generateInviteCode(), label, uses, expiresAt, now);
      if (row) return inviteInfo(row, now);
    }
    throw new Error("could not allocate an invite code");
  }

  listInvites(): InviteInfo[] {
    const now = this.clock.now();
    return this.invites.list().map((row) => inviteInfo(row, now));
  }

  getInvite(id: number): InviteInfo | undefined {
    const row = this.invites.get(id);
    return row ? inviteInfo(row, this.clock.now()) : undefined;
  }

  /** Revokes the code; false when it was revoked already. */
  revokeInvite(id: number): boolean {
    return this.invites.revoke(id, this.clock.now());
  }

  // --------------------------------------------------------------- log-in

  async logIn(
    login: string,
    password: string,
    ip: string,
  ): Promise<{ account: Account; token: string; expiresAt: number }> {
    this.assertIpAllowed(ip);
    const row = this.db.prepare("SELECT * FROM accounts WHERE login = ?").get(login) as
      | AccountRow
      | undefined;
    const stored = row?.password_hash ?? (await this.dummyHash);
    const ok = await this.hasher.verify(stored, password);
    if (!row?.password_hash || !ok) throw new AuthError("bad_credentials");
    if (row.banned === 1) throw new AuthError("banned");
    this.db
      .prepare("UPDATE accounts SET last_login_at = ? WHERE id = ?")
      .run(this.clock.now(), row.id);
    return this.startSession(row.id, ip);
  }

  private startSession(
    accountId: number,
    ip: string,
  ): { account: Account; token: string; expiresAt: number } {
    const token = `fq_${randomBytes(32).toString("base64url")}`;
    const now = this.clock.now();
    const expiresAt = now + this.options.sessionTtlMs;
    this.db
      .prepare(
        "INSERT INTO sessions (token_hash, account_id, created_at, expires_at, last_seen_at, ip) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(hashToken(token), accountId, now, expiresAt, now, ip);
    const account = this.getAccount(accountId);
    if (!account) throw new Error("account vanished");
    return { account, token, expiresAt };
  }

  // ------------------------------------------------------ authenticating

  /** Resolves a bearer token to its account, or null. Extends the session at most hourly. */
  authenticate(token: string | undefined, ip: string): AuthInfo | null {
    if (!token || token.length > 128 || !token.startsWith("fq_")) return null;
    const now = this.clock.now();
    const row = this.db
      .prepare(
        `SELECT s.id AS session_id, s.expires_at, s.last_seen_at, a.*
         FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ?`,
      )
      .get(hashToken(token)) as
      | (AccountRow & {
          session_id: number;
          expires_at: number;
          last_seen_at: number;
        })
      | undefined;
    if (!row || row.expires_at <= now || row.banned === 1) return null;
    if (this.isIpBanned(ip)) return null;
    if (now - row.last_seen_at > 3_600_000) {
      this.db
        .prepare("UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?")
        .run(now, now + this.options.sessionTtlMs, row.session_id);
    }
    return { account: toAccount(row), sessionId: row.session_id };
  }

  logOut(sessionId: number): void {
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  }

  revokeAll(accountId: number): void {
    this.db.prepare("DELETE FROM sessions WHERE account_id = ?").run(accountId);
  }

  purgeExpired(): number {
    return Number(
      this.db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(this.clock.now()).changes,
    );
  }

  /**
   * Deletes guest accounts older than `maxAgeMs` that no longer hold a parlor (a guest who
   * played keeps the account while the parlor exists). Returns how many.
   */
  purgeGuests(maxAgeMs: number): number {
    return Number(
      this.db
        .prepare(
          `DELETE FROM accounts WHERE is_guest = 1 AND created_at < ?
             AND id NOT IN (SELECT account_id FROM parlors)`,
        )
        .run(this.clock.now() - maxAgeMs).changes,
    );
  }

  // ------------------------------------------------------------- accounts

  getAccount(id: number): Account | undefined {
    const row = this.db.prepare("SELECT * FROM accounts WHERE id = ?").get(id) as
      | AccountRow
      | undefined;
    return row ? toAccount(row) : undefined;
  }

  listAccounts(limit: number, offset: number, search?: string): Account[] {
    const rows = (search
      ? this.db
          .prepare(
            "SELECT * FROM accounts WHERE instr(lower(login), lower(?)) > 0 ORDER BY id LIMIT ? OFFSET ?",
          )
          .all(search, limit, offset)
      : this.db
          .prepare("SELECT * FROM accounts ORDER BY id LIMIT ? OFFSET ?")
          .all(limit, offset)) as unknown as AccountRow[];
    return rows.map(toAccount);
  }

  countAccounts(): number {
    const r = this.db.prepare("SELECT count(*) AS n FROM accounts").get() as { n: number };
    return r.n;
  }

  setBanned(accountId: number, banned: boolean, reason: string | null): boolean {
    const r = this.db
      .prepare("UPDATE accounts SET banned = ?, ban_reason = ? WHERE id = ?")
      .run(banned ? 1 : 0, banned ? reason : null, accountId);
    if (banned) this.revokeAll(accountId);
    return Number(r.changes) > 0;
  }

  deleteAccount(accountId: number): boolean {
    return Number(this.db.prepare("DELETE FROM accounts WHERE id = ?").run(accountId).changes) > 0;
  }

  // ------------------------------------------------------------- IP bans

  private bans(): ParsedBan[] {
    if (!this.banCache) {
      this.banCache = [];
      for (const row of this.ipBans.list()) {
        const rule = parseIpRule(row.prefix);
        if (rule) this.banCache.push({ row, rule });
      }
    }
    return this.banCache;
  }

  listIpBans(): IpBanRow[] {
    const now = this.clock.now();
    return this.bans()
      .map((b) => b.row)
      .filter((r) => r.expires_at === null || r.expires_at > now);
  }

  /** Adds a ban. Returns null when `prefix` is not a valid address, prefix or CIDR. */
  addIpBan(prefix: string, reason: string, expiresAt: number | null): IpBanRow | null {
    const rule = parseIpRule(prefix);
    if (!rule) return null;
    const id = this.ipBans.add(prefix.trim(), reason, this.clock.now(), expiresAt);
    this.banCache = null;
    return this.ipBans.list().find((r) => r.id === id) ?? null;
  }

  removeIpBan(id: number): boolean {
    const removed = this.ipBans.remove(id);
    this.banCache = null;
    return removed;
  }

  isIpBanned(ip: string): boolean {
    const address = parseAddress(ip);
    if (!address) return false;
    const now = this.clock.now();
    return this.bans().some(
      (b) => (b.row.expires_at === null || b.row.expires_at > now) && ruleMatches(b.rule, address),
    );
  }

  private assertIpAllowed(ip: string): void {
    if (this.isIpBanned(ip)) throw new AuthError("ip_banned");
  }
}
