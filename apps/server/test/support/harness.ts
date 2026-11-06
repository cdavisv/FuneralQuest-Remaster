import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Action, View } from "@fq/protocol";
import type { FastifyBaseLogger } from "fastify";
import WebSocket from "ws";
import { FakeClock } from "../../src/clock.js";
import { type ServerConfig, testConfig } from "../../src/config.js";
import { createServer, type GameServer } from "../../src/server.js";
import type { ServerMessage } from "../../src/wire.js";

export const ADMIN_TOKEN = "test-admin-token-0123456789abcdef";

export interface TownSeed {
  id: string;
  name?: string;
  ruleset?: string;
  contentPack?: string;
  seed?: number;
  timeZone?: string;
  dayLengthMinutes?: number | null;
  settings?: Record<string, unknown>;
}

export interface Harness {
  server: GameServer;
  clock: FakeClock;
  dir: string;
  dbPath: string;
  townsFile: string;
  /** Closes the server and removes the temp directory. */
  stop(): Promise<void>;
  /** Closes the server but keeps the files, so another can start on them. */
  restart(overrides?: Partial<ServerConfig>): Promise<Harness>;
  inject: GameServer["app"]["inject"];
  /** Base URL once `server.listen()` has run. */
  baseUrl(): string;
  wsUrl(): string;
}

export interface StartOptions {
  config?: Partial<ServerConfig>;
  clock?: FakeClock;
  towns?: TownSeed[];
  listen?: boolean;
  dir?: string;
  logger?: FastifyBaseLogger;
}

export async function startServer(options: StartOptions = {}): Promise<Harness> {
  const dir = options.dir ?? mkdtempSync(join(tmpdir(), "fq-server-"));
  const dbPath = join(dir, "fq.sqlite");
  const townsFile = join(dir, "towns.json");
  if (options.towns || !options.dir) {
    writeFileSync(
      townsFile,
      JSON.stringify({
        towns: (options.towns ?? [{ id: "main", name: "Dead Calm", seed: 1234 }]).map((t) => ({
          name: t.id,
          ...t,
        })),
      }),
    );
  }
  const clock = options.clock ?? new FakeClock();
  const config = testConfig({
    dbPath,
    townsFile,
    createDefaultTown: false,
    adminToken: ADMIN_TOKEN,
    // Generous by default; the rate-limit tests lower them.
    rateGlobalMax: 100_000,
    rateAuthMax: 100_000,
    rateActionMax: 100_000,
    rateAdminMax: 100_000,
    ...options.config,
  });
  const server = await createServer(config, {
    clock,
    ...(options.logger ? { logger: options.logger } : {}),
  });
  let address: { address: string; port: number } | null = null;
  if (options.listen) address = await server.listen();
  const harness: Harness = {
    server,
    clock,
    dir,
    dbPath,
    townsFile,
    inject: ((opts: never) => server.app.inject(opts)) as GameServer["app"]["inject"],
    baseUrl: () => {
      if (!address) throw new Error("not listening");
      return `http://127.0.0.1:${address.port}`;
    },
    wsUrl: () => {
      if (!address) throw new Error("not listening");
      return `ws://127.0.0.1:${address.port}/api/ws`;
    },
    async stop() {
      await server.close();
      rmSync(dir, { recursive: true, force: true });
    },
    async restart(overrides) {
      await server.close();
      return startServer({
        dir,
        clock,
        config: { ...options.config, ...overrides },
        ...(options.listen !== undefined ? { listen: options.listen } : {}),
      });
    },
  };
  return harness;
}

export interface Reply<T = unknown> {
  status: number;
  body: T;
}

/** A player driving the server through `inject`, with the session derived from its own token. */
export class TestPlayer {
  token = "";
  accountId = 0;

  constructor(
    public h: Harness,
    readonly login: string,
    readonly password = "correct horse battery",
    readonly ip = "10.0.0.1",
  ) {}

  async request<T = unknown>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    url: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<Reply<T>> {
    const res = await this.h.inject({
      method,
      url,
      remoteAddress: this.ip,
      headers: {
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
    });
    const text = res.body;
    return { status: res.statusCode, body: (text ? JSON.parse(text) : undefined) as T };
  }

  async signUp(): Promise<this> {
    const r = await this.request<{ token: string; account: { id: number } }>(
      "POST",
      "/api/auth/signup",
      { login: this.login, password: this.password },
    );
    if (r.status !== 201) throw new Error(`signup failed: ${JSON.stringify(r)}`);
    this.token = r.body.token;
    this.accountId = r.body.account.id;
    return this;
  }

  async logIn(): Promise<this> {
    const r = await this.request<{ token: string }>("POST", "/api/auth/login", {
      login: this.login,
      password: this.password,
    });
    if (r.status !== 200) throw new Error(`login failed: ${JSON.stringify(r)}`);
    this.token = r.body.token;
    return this;
  }

  parlorForm(name = this.login) {
    return { name, parlor: `${name} Rest`, male: true };
  }

  async enter(townId = "main", form = this.parlorForm()): Promise<View> {
    const r = await this.request<{ view: View }>("POST", `/api/towns/${townId}/enter`, {
      parlor: form,
    });
    if (r.status !== 200) throw new Error(`enter failed: ${JSON.stringify(r)}`);
    return r.body.view;
  }

  act(action: Action, townId = "main") {
    return this.request<{ view: View; error?: string; message?: string }>(
      "POST",
      `/api/towns/${townId}/action`,
      { action },
    );
  }

  async press(buttonId: string, townId = "main"): Promise<View> {
    const r = await this.act({ type: "press", buttonId }, townId);
    if (r.status !== 200) throw new Error(`press ${buttonId} failed: ${JSON.stringify(r.body)}`);
    return r.body.view;
  }
}

/** Presses Continue until the desk's Wait for Customer button shows. */
export async function toDesk(player: TestPlayer, townId = "main"): Promise<View> {
  let view = await player.press("go:desk", townId);
  for (let i = 0; i < 6 && !buttonIds(view).includes("desk:wait"); i++) {
    view = await player.press("go:desk", townId);
  }
  return view;
}

export function buttonIds(view: View): string[] {
  return view.buttons.map((b) => b.id);
}

const NEGOTIATION = ["neg:guilt", "neg:sympathy", "neg:hard", "neg:soft"];

/**
 * Plays one player's day through the HTTP API with a simple policy until the
 * desk reports no turns left, then logs off. Returns how many actions it sent.
 */
export async function playDay(player: TestPlayer, start: View, townId = "main"): Promise<number> {
  let view = start;
  let negotiationSteps = 0;
  let n = 0;
  let seed = 12345;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (; n < 3000; n++) {
    const ids = buttonIds(view);
    let action: Action;
    if (view.overlay?.kind === "playerPicker") {
      const pick = view.overlay.players[Math.floor(rand() * view.overlay.players.length)];
      action = { type: "pickPlayer", overlayId: view.overlay.id, playerId: pick?.id ?? null };
    } else if (view.overlay?.kind === "message") {
      action = { type: "dismiss", overlayId: view.overlay.id };
    } else if (ids.includes("neg:done")) {
      negotiationSteps++;
      const id =
        negotiationSteps > 6 || rand() < 0.2
          ? "neg:done"
          : (NEGOTIATION[Math.floor(rand() * 4)] as string);
      action = { type: "press", buttonId: id };
    } else if (ids.includes("desk:wait")) {
      negotiationSteps = 0;
      action = { type: "press", buttonId: "desk:wait" };
    } else if (ids.includes("script:1")) {
      action = { type: "press", buttonId: rand() < 0.7 ? "script:1" : (ids.at(-1) as string) };
    } else if (ids.length > 0) {
      action = {
        type: "press",
        buttonId: ids.includes("go:desk")
          ? "go:desk"
          : (ids[Math.floor(rand() * ids.length)] as string),
      };
    } else {
      throw new Error(`stuck on ${view.scene}`);
    }
    const r = await player.act(action, townId);
    if (r.status !== 200) throw new Error(`${JSON.stringify(action)} -> ${JSON.stringify(r.body)}`);
    view = r.body.view;
    if (view.picture?.fg === "closed") {
      await player.press("desk:quit", townId);
      return n + 2;
    }
  }
  throw new Error("the day never ended");
}

// ---------------------------------------------------------------- WebSocket

export class Socket {
  readonly messages: ServerMessage[] = [];
  closeCode: number | null = null;
  private waiters: Array<() => void> = [];
  readonly ws: WebSocket;

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.on("message", (data) => {
      this.messages.push(JSON.parse(data.toString()) as ServerMessage);
      this.wake();
    });
    this.ws.on("close", (code) => {
      this.closeCode = code;
      this.wake();
    });
    this.ws.on("error", () => undefined);
  }

  private wake() {
    for (const w of this.waiters.splice(0)) w();
  }

  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.once("open", () => resolve());
      this.ws.once("error", reject);
    });
  }

  send(message: unknown): void {
    this.ws.send(typeof message === "string" ? message : JSON.stringify(message));
  }

  /** Waits until `predicate` holds for the messages received so far. */
  async until(predicate: (m: ServerMessage[]) => boolean, ms = 5000): Promise<void> {
    const deadline = Date.now() + ms;
    while (!predicate(this.messages) && this.closeCode === null) {
      const left = deadline - Date.now();
      if (left <= 0) throw new Error(`timed out; got ${JSON.stringify(this.messages)}`);
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, Math.min(left, 50));
        this.waiters.push(() => {
          clearTimeout(t);
          resolve();
        });
      });
    }
  }

  async waitClosed(ms = 5000): Promise<number> {
    const deadline = Date.now() + ms;
    while (this.closeCode === null) {
      if (Date.now() > deadline) throw new Error("socket did not close");
      await new Promise((r) => setTimeout(r, 10));
    }
    return this.closeCode;
  }

  close() {
    this.ws.close();
  }
}

export async function connectSocket(h: Harness, token: string, townId = "main"): Promise<Socket> {
  const s = new Socket(h.wsUrl());
  await s.open();
  s.send({ type: "hello", token, townId });
  await s.until((m) => m.some((x) => x.type === "ready"));
  return s;
}
