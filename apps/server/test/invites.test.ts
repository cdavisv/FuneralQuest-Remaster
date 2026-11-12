import { afterEach, describe, expect, it } from "vitest";
import { AccountService, AuthError } from "../src/auth/accounts.js";
import {
  formatInviteCode,
  generateInviteCode,
  INVITE_ALPHABET,
  normaliseInviteCode,
} from "../src/auth/invites.js";
import type { PasswordHasher } from "../src/auth/passwords.js";
import { FakeClock } from "../src/clock.js";
import type { ServerConfig } from "../src/config.js";
import { openDatabase } from "../src/db/database.js";
import { ADMIN_TOKEN, type Harness, type Reply, startServer } from "./support/harness.js";

/** Invite codes for a closed beta (`FQ_INVITE_REQUIRED`). */

let h: Harness | null = null;
afterEach(async () => {
  await h?.stop();
  h = null;
});

const DAY = 86_400_000;

interface Invite {
  id: number;
  code: string;
  label: string;
  uses: number;
  used: number;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  state: string;
}

interface ErrorReply {
  error: string;
  message: string;
}

async function call<T = unknown>(
  method: "GET" | "POST",
  url: string,
  body?: unknown,
  options: { ip?: string; token?: string | null } = {},
): Promise<Reply<T>> {
  const token = options.token === undefined ? null : options.token;
  const res = await (h as Harness).inject({
    method,
    url,
    remoteAddress: options.ip ?? "10.1.0.1",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
  });
  return { status: res.statusCode, body: (res.body ? JSON.parse(res.body) : undefined) as T };
}

const admin = <T = unknown>(method: "GET" | "POST", url: string, body?: unknown) =>
  call<T>(method, url, body, { token: ADMIN_TOKEN });

async function makeInvite(uses = 1, expiresInDays?: number, label = "Discord batch 1") {
  const r = await admin<Invite>("POST", "/admin/invites", {
    label,
    uses,
    ...(expiresInDays !== undefined ? { expiresInDays } : {}),
  });
  expect(r.status).toBe(201);
  return r.body;
}

const signUp = (login: string, invite?: string, ip = "10.1.0.1") =>
  call<{ token: string; account: { id: number; guest: boolean } } & Partial<ErrorReply>>(
    "POST",
    "/api/auth/signup",
    { login, password: "a long enough password", ...(invite !== undefined ? { invite } : {}) },
    { ip },
  );

const guest = (invite?: string, ip = "10.1.0.1") =>
  call<{ token: string; account: { id: number; guest: boolean } } & Partial<ErrorReply>>(
    "POST",
    "/api/auth/guest",
    invite !== undefined ? { invite } : {},
    { ip },
  );

const inviteOf = async (id: number) =>
  (await admin<{ invites: Invite[] }>("GET", "/admin/invites")).body.invites.find(
    (i) => i.id === id,
  ) as Invite;

const start = (config: Partial<ServerConfig> = {}) =>
  startServer({ config: { inviteRequired: true, ...config } });

describe("invite codes", () => {
  it("are short, typeable and compared without case, spaces or dashes", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateInviteCode();
      expect(code).toMatch(/^[2-9A-HJKMNP-Z]{10}$/);
    }
    expect(INVITE_ALPHABET).not.toMatch(/[01OIL]/);
    expect(formatInviteCode("ABCDEFGHJK")).toBe("ABCDE-FGHJK");
    expect(normaliseInviteCode(" abcde - fghjk ")).toBe("ABCDEFGHJK");
    expect(normaliseInviteCode("ab cd–ef-gh jk")).toBe("ABCDEFGHJK");
  });

  it("keep no link to the accounts they made", () => {
    const db = openDatabase(":memory:");
    const columns = (db.prepare("PRAGMA table_info(invites)").all() as { name: string }[]).map(
      (c) => c.name,
    );
    expect(columns.sort()).toEqual(
      ["code", "created_at", "expires_at", "id", "label", "max_uses", "revoked_at", "used"].sort(),
    );
    expect(db.prepare("PRAGMA foreign_key_list(invites)").all()).toEqual([]);
    db.close();
  });
});

describe("redeeming the last use", () => {
  it("is atomic with making the account, however the requests interleave", async () => {
    // Every sign-up is held at the password hash (after the first look at the code) until all of
    // them got there, so each one saw the code open; only one may take its last use.
    const db = openDatabase(":memory:");
    const waiting: (() => void)[] = [];
    const hasher: PasswordHasher = {
      hash: (password) =>
        new Promise((resolve) => waiting.push(() => resolve(`hashed:${password}`))),
      verify: async () => false,
    };
    const accounts = new AccountService(db, new FakeClock(), hasher, {
      sessionTtlMs: DAY,
      signupEnabled: true,
      guestEnabled: true,
      inviteRequired: true,
    });
    waiting.length = 0; // the service's own dummy hash, made at construction
    const invite = accounts.createInvite("race", 1, null);
    const tries = [
      accounts.signUp("one", "password one", "10.0.0.1", invite.code),
      accounts.signUp("two", "password two", "10.0.0.2", invite.code.toLowerCase()),
      accounts.createGuest("10.0.0.3", invite.code),
    ];
    await new Promise((resolve) => setImmediate(resolve));
    // Both sign-ups passed the first look and wait at the hash; the guest (no hash) went through.
    expect(waiting).toHaveLength(2);
    for (const go of waiting) go();
    const settled = await Promise.allSettled(tries);
    const ok = settled.filter((r) => r.status === "fulfilled");
    const failed = settled.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(2);
    for (const r of failed) {
      const reason = (r as PromiseRejectedResult).reason;
      expect(reason).toBeInstanceOf(AuthError);
      expect((reason as AuthError).code).toBe("invite_used_up");
    }
    expect(accounts.countAccounts()).toBe(1);
    expect(accounts.getInvite(invite.id)).toMatchObject({ used: 1, state: "used_up" });
    // Museum mode's original client has nowhere to type a code.
    await expect(accounts.createWithPassword("museum", "a password")).rejects.toMatchObject({
      code: "invite_required",
    });
    db.close();
  });
});

describe("FQ_INVITE_REQUIRED off (the default)", () => {
  it("changes nothing and ignores a code sent anyway", async () => {
    h = await startServer();
    const features = await call<{ access: Record<string, boolean> }>("GET", "/api/features");
    expect(features.body.access).toEqual({ signup: true, guests: true, inviteRequired: false });
    expect((await signUp("plainuser")).status).toBe(201);
    expect((await signUp("withjunk", "not a real code")).status).toBe(201);
    expect((await guest()).status).toBe(201);
    expect((await guest("nonsense")).status).toBe(201);
  });
});

describe("FQ_INVITE_REQUIRED on", () => {
  it("says so in the features and refuses a sign-up or guest without a code", async () => {
    h = await start();
    const features = await call<{ access: Record<string, boolean> }>("GET", "/api/features");
    expect(features.body.access.inviteRequired).toBe(true);
    for (const r of [await signUp("nocode"), await signUp("blank", "  - "), await guest()]) {
      expect(r.status).toBe(403);
      expect(r.body.error).toBe("invite_required");
      expect(r.body.message).toMatch(/invite-only/);
    }
  });

  it("lets a code make an account, typed in any case with spaces and dashes", async () => {
    h = await start();
    const invite = await makeInvite(3);
    expect(invite.code).toMatch(/^[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/);
    expect(invite).toMatchObject({ uses: 3, used: 0, state: "active", expiresAt: null });
    const typed = ` ${invite.code.toLowerCase().replace("-", " - ")} `;
    const r = await signUp("invited1", typed);
    expect(r.status).toBe(201);
    expect((await signUp("invited2", invite.code.replace("-", ""))).status).toBe(201);
    expect((await inviteOf(invite.id)).used).toBe(2);
  });

  it("refuses an unknown code, a used-up code, a revoked code and an expired code", async () => {
    h = await start();
    const unknown = await signUp("someone", "ZZZZZ-ZZZZZ");
    expect(unknown.status).toBe(403);
    expect(unknown.body).toMatchObject({ error: "invite_invalid" });
    expect(unknown.body.message).toMatch(/not recognised/);

    const once = await makeInvite(1);
    expect((await signUp("first", once.code)).status).toBe(201);
    const used = await signUp("second", once.code);
    expect(used.status).toBe(403);
    expect(used.body.error).toBe("invite_used_up");
    expect(used.body.message).toMatch(/already been used/);
    expect((await inviteOf(once.id)).state).toBe("used_up");

    const revoked = await makeInvite(5);
    const rv = await admin<Invite>("POST", `/admin/invites/${revoked.id}/revoke`);
    expect(rv.status).toBe(200);
    expect(rv.body).toMatchObject({ state: "revoked", used: 0 });
    expect(rv.body.revokedAt).not.toBeNull();
    const r1 = await signUp("third", revoked.code);
    expect(r1.status).toBe(403);
    expect(r1.body.error).toBe("invite_expired");
    expect(r1.body.message).toMatch(/expired or been withdrawn/);
  });

  it("stops a code at its expiry (the fake clock)", async () => {
    h = await start();
    const invite = await makeInvite(10, 2);
    expect(Date.parse(invite.expiresAt as string)).toBe(h.clock.now() + 2 * DAY);
    h.clock.jump(2 * DAY - 1000);
    expect((await signUp("intime", invite.code)).status).toBe(201);
    h.clock.jump(1000);
    const late = await signUp("toolate", invite.code);
    expect(late.status).toBe(403);
    expect(late.body.error).toBe("invite_expired");
    const shown = await inviteOf(invite.id);
    expect(shown).toMatchObject({ state: "expired", used: 1 });
  });

  it("lets a code with one use left make exactly one account under concurrent requests", async () => {
    h = await start();
    const invite = await makeInvite(1);
    const results = await Promise.all(
      ["racer1", "racer2", "racer3", "racer4"].map((login, i) =>
        signUp(login, invite.code, `10.1.1.${i + 1}`),
      ),
    );
    const made = results.filter((r) => r.status === 201);
    const refused = results.filter((r) => r.status === 403);
    expect(made).toHaveLength(1);
    expect(refused).toHaveLength(3);
    for (const r of refused) expect(r.body.error).toBe("invite_used_up");
    expect((await inviteOf(invite.id)).used).toBe(1);
    const accounts = await admin<{ accounts: { login: string }[] }>(
      "GET",
      "/admin/accounts?search=racer",
    );
    expect(accounts.body.accounts).toHaveLength(1);
  });

  it("does not spend a use when the account cannot be made (the name is taken)", async () => {
    h = await start();
    const invite = await makeInvite(2);
    expect((await signUp("taken", invite.code)).status).toBe(201);
    const again = await signUp("taken", invite.code);
    expect(again.status).toBe(409);
    expect(again.body.error).toBe("login_taken");
    expect((await inviteOf(invite.id)).used).toBe(1);
  });

  it("lets a code start a guest, and the guest upgrades without a second code", async () => {
    h = await start();
    const invite = await makeInvite(1);
    const g = await guest(invite.code.toLowerCase());
    expect(g.status).toBe(201);
    expect(g.body.account.guest).toBe(true);
    expect((await inviteOf(invite.id)).state).toBe("used_up");
    expect((await guest(invite.code, "10.1.0.2")).body.error).toBe("invite_used_up");

    const up = await call<{ account: { login: string; guest: boolean } }>(
      "POST",
      "/api/auth/upgrade",
      { login: "guestnowfull", password: "a good long password" },
      { token: g.body.token },
    );
    expect(up.status).toBe(200);
    expect(up.body.account).toEqual(expect.objectContaining({ guest: false }));
    expect((await inviteOf(invite.id)).used).toBe(1);
  });

  it("counts wrong codes per address like wrong passwords, and then refuses even a good one", async () => {
    h = await start();
    const invite = await makeInvite(5);
    for (let i = 0; i < 10; i++) {
      const r = await signUp(`guess${i}`, `WRONG${i}CODE`, "10.2.0.1");
      expect(r.body.error).toBe("invite_invalid");
    }
    const locked = await signUp("guesser", invite.code, "10.2.0.1");
    expect(locked.status).toBe(429);
    expect(locked.body.error).toBe("rate_limited");
    expect((await guest(invite.code, "10.2.0.1")).status).toBe(429);
    // Another address is not affected, and the window passes.
    expect((await signUp("elsewhere", invite.code, "10.2.0.2")).status).toBe(201);
    h.clock.jump(15 * 60_000);
    expect((await signUp("patient", invite.code, "10.2.0.1")).status).toBe(201);
  });

  it("counts against the sign-up budget per address", async () => {
    h = await start({ signupsPerHour: 3 });
    for (let i = 0; i < 3; i++) await signUp(`budget${i}`, "NOPE", "10.3.0.1");
    const r = await signUp("budget3", "NOPE", "10.3.0.1");
    expect(r.status).toBe(429);
  });
});

describe("the invite admin API", () => {
  it("needs the admin token", async () => {
    h = await start();
    expect((await call("GET", "/admin/invites")).status).toBe(401);
    expect((await call("POST", "/admin/invites", { label: "x", uses: 1 })).status).toBe(401);
    expect(
      (await call("POST", "/admin/invites", { label: "x", uses: 1 }, { token: "wrong" })).status,
    ).toBe(401);
    expect(
      (await call("POST", "/admin/invites/1/revoke", undefined, { token: "nope" })).status,
    ).toBe(401);
  });

  it("validates, lists newest first, revokes once and writes the audit log", async () => {
    h = await start();
    for (const bad of [
      { label: "", uses: 1 },
      { label: "x", uses: 0 },
      { label: "x", uses: 1001 },
      { label: "x", uses: 1.5 },
      { label: "x", uses: 1, expiresInDays: 0 },
      { label: "x", uses: 1, extra: true },
    ]) {
      expect((await admin("POST", "/admin/invites", bad)).status, JSON.stringify(bad)).toBe(400);
    }
    const a = await makeInvite(1, undefined, "first batch");
    const b = await makeInvite(1000, 7, "second batch");
    expect(a.code).not.toBe(b.code);
    const list = await admin<{ inviteRequired: boolean; recorded: string; invites: Invite[] }>(
      "GET",
      "/admin/invites",
    );
    expect(list.body.inviteRequired).toBe(true);
    expect(list.body.recorded).toMatch(/not recorded/);
    expect(list.body.invites.map((i) => i.label)).toEqual(["second batch", "first batch"]);

    expect((await admin("POST", "/admin/invites/999/revoke")).status).toBe(404);
    expect((await admin("POST", `/admin/invites/${a.id}/revoke`)).status).toBe(200);
    expect((await admin("POST", `/admin/invites/${a.id}/revoke`)).status).toBe(200);

    const audit = await admin<{ entries: { kind: string; data: Record<string, unknown> }[] }>(
      "GET",
      "/admin/audit?kind=admin:invite",
    );
    const kinds = audit.body.entries.map((e) => e.kind).sort();
    expect(kinds).toEqual(["admin:invite:create", "admin:invite:create", "admin:invite:revoke"]);
    const created = audit.body.entries.find((e) => e.data.label === "second batch");
    expect(created?.data).toMatchObject({ code: b.code, uses: 1000, moderator: "admin" });
    expect(created?.data.expiresAt).toBe(b.expiresAt);
  });

  it("shows whether invites are required on the server summary", async () => {
    h = await start();
    const server = await admin<{ limits: { inviteRequired: boolean } }>("GET", "/admin/server");
    expect(server.body.limits.inviteRequired).toBe(true);
  });
});
