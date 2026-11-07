import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BINARY, LEGACY_DIST_DIR } from "../scripts/config.js";

export { BINARY };

/** True when `pnpm --filter @fq/oracle run build` has produced the oracle. */
export function oracleAvailable(): boolean {
  return existsSync(BINARY);
}

/** Draws made by the two generators since the last `seed` command. */
export interface RngCount {
  mt: number;
  crt: number;
}

/** `communication_status` (online_struct.h:66-93) as the harness prints it. */
export interface OracleCustomer {
  active: boolean;
  customerMale: boolean;
  customerAge: number;
  deceasedMale: boolean;
  deceasedAge: number;
  relation: number;
  income: number;
  desiredCasket: number;
  bigUpgrade: number;
  deathType: number;
  deathObject: number;
  price: number;
  moneyToSpend: number;
  specialButton: number;
  mood: number;
  cheapness: number;
  loved: boolean;
  riskType: number;
  urlSave: string;
  showResistance: boolean;
  locationCallback: number;
  hisId: number;
  playTarget: number;
  locked: boolean;
}

export interface OracleQueued {
  type: number;
  importance: number;
  from: number;
  value: number;
  subType: number;
  expire: number;
  text: string;
}

export interface OracleSession {
  status: number;
  location: string;
  script: number;
  customer: OracleCustomer;
  queue: OracleQueued[];
  options: number[];
}

/** `player_struct` (player_struct.h:40-88) as the harness prints it. */
export interface OraclePlayer {
  index: number;
  name: string;
  logon: string;
  parlor: string;
  email: string;
  active: boolean;
  male: boolean;
  online: boolean;
  turns: number;
  money: number;
  exp: number;
  karma: number;
  rating: number;
  tags: [number, number, number];
  transportation: number;
  plots: number;
  dayLastLoggedOn: number;
  sp: number;
  luck: number;
  yangsSent: number;
  psych: number;
  kickedOutOfYangs: boolean;
  strength: number;
  hpMax: number;
  hp: number;
  playerFights: number;
  canBeAttacked: boolean;
  policeProtected: boolean;
  tagsReceivedToday: number;
  custom: number[];
  session?: OracleSession;
}

export interface OracleTown {
  day: number;
  topOldExists: boolean;
  topOldName: string;
  topOldBp: number;
  topOldIndex: number;
  topOldParlor: string;
  tournament: boolean;
  tournamentDays: number;
  turnsPerDay: number;
  lastMaint: number;
  players: OraclePlayer[];
}

export interface OracleReply {
  op: string;
  responses: string[];
  log?: string[];
  rng: RngCount;
  town?: OracleTown;
  ip?: string;
  error?: string;
}

export interface OracleCustomerLine {
  seed: number;
  customer: OracleCustomer;
  mood: string;
  relation: string;
  man: string;
  income: string;
  casket: string;
  rng: RngCount;
}

/**
 * Runs the oracle once over a list of commands (see cpp/harness/oracle_main.cpp)
 * in a fresh scratch directory, and returns one parsed line per output line.
 */
export function runOracle(commands: readonly string[], options: { keepScratch?: boolean } = {}) {
  if (!oracleAvailable()) {
    throw new Error("The oracle is not built: run pnpm --filter @fq/oracle run build");
  }
  const base = join(tmpdir(), "fq-oracle");
  mkdirSync(base, { recursive: true });
  const scratch = mkdtempSync(join(base, "run-"));
  try {
    const result = spawnSync(BINARY, [], {
      input: `${commands.join("\n")}\nquit\n`,
      encoding: "utf8",
      maxBuffer: 1 << 30,
      env: {
        ...process.env,
        TZ: "UTC",
        FQ_ORACLE_CONTENT: LEGACY_DIST_DIR,
        FQ_ORACLE_SCRATCH: scratch,
      },
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(
        `fq-oracle exited with ${result.status ?? result.signal}: ${result.stderr.slice(-2000)}`,
      );
    }
    const lines = result.stdout.split("\n").filter((l) => l.trim().length > 0);
    return { lines: lines.map((l) => JSON.parse(l) as unknown), scratch };
  } finally {
    if (!options.keepScratch) rmSync(scratch, { recursive: true, force: true });
  }
}

/** `customers <seed> <n>`: n customers straight from `create_random_customer`. */
export function oracleCustomers(seed: number, count: number): OracleCustomerLine[] {
  return runOracle([`customers ${seed} ${count}`]).lines as OracleCustomerLine[];
}

/** The rand() seed the harness pairs with twister seed `s` (oracle_main.cpp crt_seed_for). */
export function crtSeedFor(s: number): number {
  return ((Math.imul(s >>> 0, 2654435761) ^ 0x5bd1e995) >>> 0) as number;
}
