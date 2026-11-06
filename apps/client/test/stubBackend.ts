import type { View } from "@fq/protocol";
import {
  type AccountInfo,
  ApiError,
  type AuthResponse,
  type FeaturesResponse,
  type MeResponse,
  type ParlorForm,
  type ParlorInfo,
  type TownInfo,
} from "@fq/server/client";
import { FIXTURES } from "../src/mock/fixtures.js";
import type { Backend, DailyApi } from "../src/net/backend.js";
import type { LiveTransport } from "../src/transport/types.js";
import { LiveScriptedTransport } from "./helpers.js";

export const TOWN: TownInfo = {
  id: "main",
  name: "Dead Calm",
  ruleset: "classic",
  contentPack: "classic",
  day: 4,
  timeZone: "UTC",
  dayLengthMinutes: null,
  nextDayAt: new Date(Date.now() + 5 * 3_600_000 + 12 * 60_000).toISOString(),
  players: { registered: 12, online: 3, max: 800 },
  tournament: { active: true, daysLeft: 9 },
  lobby: {
    gameInfo: [{ text: "Game Info: Tournament Mode (day 4) - 3 of 12 players on now." }],
    closed: null,
    online: 3,
    players: 12,
  },
  serverNews: [{ text: "Welcome to town. Mind the hearses." }],
  rankings: [
    { rank: 1, name: "Mylener", parlor: "Playin' God", bp: 1850 },
    { rank: 2, name: "Skelly", parlor: "Bone Voyage", bp: 1620 },
  ],
};

export const apiError = (status: number, code: string, message: string, field?: string) =>
  new ApiError(status, code, message, undefined, field);

interface Account {
  login: string;
  password: string | null;
  guest: boolean;
  parlors: ParlorInfo[];
}

/** An in-memory server for the front door: accounts, a token, towns and entering. */
export class StubBackend implements Backend {
  towns$: TownInfo[] = [TOWN];
  townsFail = false;
  accounts: Account[] = [];
  /** The signed-in account, when a stored token is valid. */
  current: Account | null = null;
  tokenKnown = false;
  calls: string[] = [];
  playing: string | null = null;
  last: string | null = null;
  /** Names taken in the town, for invalid_parlor. */
  takenNames = new Set<string>();
  transports: LiveScriptedTransport[] = [];
  firstView: View = FIXTURES.desk;
  /** What the server says it offers; null stands for a server without the endpoint. */
  features$: FeaturesResponse | null = null;
  private nextId = 1;
  /** The Daily Challenge, as a server with today's board and two earlier days. */
  boards: Record<string, { name: string; parlor: string; score: number }[]> = {
    "2026-11-06": [{ name: "Mourn Ing", parlor: "Dawn Rest", score: 175 }],
    "2026-11-05": [
      { name: "Late Bloom", parlor: "Petals", score: 210 },
      { name: "Second Place", parlor: "Also Ran", score: 190 },
    ],
    "2026-11-04": [{ name: "Old Timer", parlor: "Yesterdays", score: 160 }],
  };
  dailyStatus: "available" | "playing" | "finished" = "available";
  dailyGuest = false;
  /** What each `open()` was given as the board name. */
  dailyOpened: (ParlorForm | undefined)[] = [];
  boardRequests: (string | undefined)[] = [];
  daily: DailyApi = {
    info: async () => ({
      day: "2026-11-06",
      nextAt: "2026-11-07T00:00:00.000Z",
      loadout: { turns: 20, money: 5000, stock: [2, 0, 0], psych: 1 },
      played: 3,
      ranked: 1,
      you: this.current
        ? {
            status: this.dailyStatus,
            result: null,
            place: null,
            guest: this.dailyGuest || this.current.guest,
          }
        : null,
    }),
    leaderboard: async (day) => {
      this.boardRequests.push(day);
      const d = day ?? "2026-11-06";
      const rows = this.boards[d] ?? [];
      return {
        day: d,
        entries: rows.map((r, i) => ({
          place: i + 1,
          name: r.name,
          parlor: r.parlor,
          score: r.score,
          money: 9000,
          sales: 12,
          exact: 1,
          walkouts: 0,
        })),
        total: rows.length,
        you: null,
      };
    },
    days: async () =>
      Object.keys(this.boards)
        .sort()
        .reverse()
        .map((day) => ({ day, entries: this.boards[day]?.length ?? 0 })),
    open: (parlor) => {
      this.dailyOpened.push(parlor);
      const t = new LiveScriptedTransport(this.firstView);
      this.transports.push(t);
      return t as never;
    },
  };

  signedUp(login: string, password: string, parlor?: string): Account {
    const account: Account = {
      login,
      password,
      guest: false,
      parlors: parlor
        ? [{ townId: "main", playerId: 1, name: parlor, parlor: `${parlor} Rest`, online: false }]
        : [],
    };
    this.accounts.push(account);
    return account;
  }

  async towns(): Promise<TownInfo[]> {
    this.calls.push("towns");
    if (this.townsFail) throw new TypeError("Failed to fetch");
    return this.towns$;
  }

  async features(): Promise<FeaturesResponse> {
    if (!this.features$) throw apiError(404, "not_found", "No such route.");
    return this.features$;
  }

  hasSession(): boolean {
    return this.tokenKnown;
  }

  async me(): Promise<MeResponse> {
    this.calls.push("me");
    if (!this.current) throw apiError(401, "unauthorized", "Log in first.");
    return { account: this.accountInfo(this.current), parlors: this.current.parlors };
  }

  private accountInfo(a: Account): AccountInfo {
    return { id: 1, login: a.login, guest: a.guest };
  }

  private auth(a: Account): AuthResponse {
    this.current = a;
    this.tokenKnown = true;
    return {
      token: "fq_stubstubstubstubstub",
      expiresAt: "2099-01-01",
      account: this.accountInfo(a),
    };
  }

  async logIn(login: string, password: string): Promise<AuthResponse> {
    this.calls.push(`logIn:${login}`);
    const a = this.accounts.find((x) => x.login === login && x.password === password);
    if (!a) throw apiError(401, "bad_credentials", "Wrong login or password.");
    return this.auth(a);
  }

  async signUp(login: string, password: string): Promise<AuthResponse> {
    this.calls.push(`signUp:${login}`);
    if (this.accounts.some((x) => x.login === login)) {
      throw apiError(409, "login_taken", "That login name is taken.");
    }
    return this.auth(this.signedUp(login, password));
  }

  async guest(): Promise<AuthResponse> {
    this.calls.push("guest");
    const a: Account = {
      login: `guest-${this.nextId++}abcdef`,
      password: null,
      guest: true,
      parlors: [],
    };
    this.accounts.push(a);
    return this.auth(a);
  }

  async logOut(): Promise<void> {
    this.calls.push("logOut");
    this.current = null;
    this.tokenKnown = false;
  }

  forget(): void {
    this.calls.push("forget");
    this.current = null;
    this.tokenKnown = false;
  }

  open(townId: string, parlor?: ParlorForm): LiveTransport {
    const t = new LiveScriptedTransport(this.firstView);
    this.transports.push(t);
    t.connect = async () => {
      this.calls.push(
        `enter:${townId}${parlor ? `:${parlor.name}/${parlor.parlor}/${parlor.male ? "M" : "F"}` : ""}`,
      );
      const account = this.current;
      if (!account) throw apiError(401, "unauthorized", "Log in first.");
      const mine = account.parlors.find((p) => p.townId === townId);
      if (!mine) {
        if (!parlor) throw apiError(409, "parlor_required", "Choose a name and a parlor first.");
        if (this.takenNames.has(parlor.name)) {
          throw apiError(
            422,
            "invalid_parlor",
            `Someone is already using the name ${parlor.name}. Please try another.`,
            "name",
          );
        }
        account.parlors.push({
          townId,
          playerId: 9,
          name: parlor.name,
          parlor: parlor.parlor,
          online: true,
        });
      }
      return this.firstView;
    };
    return t;
  }

  lastTown = () => this.last;
  setLastTown = (id: string) => {
    this.last = id;
  };
  resumeTown = () => this.playing;
  setPlaying = (id: string | null) => {
    this.playing = id;
  };
}
