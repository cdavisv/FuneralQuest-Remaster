import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import {
  ALL_PERSONALITY_IDS,
  DIFFICULTIES,
  type Difficulty,
  PERSONALITY_IDS,
  type PersonalityId,
} from "@fq/bots";
import { toMarkdown } from "./report.js";
import { runSimulation } from "./run.js";
import type { RulesName, SimOptions } from "./town.js";

const HELP = `Usage: pnpm --filter @fq/sim run sim -- [options]

  --days N          days per town (30)
  --towns N         towns to play (200)
  --players N       bots per town (8)
  --rules NAME      classic | original | expanded (classic)
  --difficulty D    easy | normal | hard | mixed (hard)
  --personalities   comma list (Classic: ${PERSONALITY_IDS.join(",")};
                    Expanded adds the rest of ${ALL_PERSONALITY_IDS.join(",")})
  --latejoin D      Expanded: one more bot joins on game day D
  --challenges N    Expanded: Daily Challenge runs per personality and difficulty (6)
  --places-off L    Expanded: comma list of newer places the bots skip (police, crematorium,
                    florist, gazette, coroner, health, pawn, mournes) or single buttons they
                    never press (crematorium:bulk, florist:bundle, police:patrol, mournes:hold),
                    to measure them by ablation
  --oracle          seat the hidden-state oracle instead of fair bots
  --seed N          base seed (1)
  --workers N       worker threads (cores - 1; 0 = this thread)
  --out PATH        report path without extension (sim-report): writes PATH.json and PATH.md

Exits 1 when any check fails: an invariant break, an offered button the
engine rejected, an exploit signature, or a stuck bot.`;

function parse(argv: string[]): { options: SimOptions; workers?: number; out: string } {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "--") continue;
    if (a === "--help" || a === "-h") {
      console.log(HELP);
      process.exit(0);
    }
    if (!a.startsWith("--")) throw new Error(`Unexpected argument ${a}`);
    const key = a.slice(2);
    if (key === "oracle") args.set(key, "true");
    else args.set(key, argv[++i] ?? "");
  }
  const int = (key: string, fallback: number) => {
    const v = args.get(key);
    if (v === undefined) return fallback;
    const n = Number.parseInt(v, 10);
    if (!Number.isFinite(n) || n < 0) throw new Error(`--${key} needs a number`);
    return n;
  };
  const rules = (args.get("rules") ?? "classic") as RulesName;
  if (rules !== "classic" && rules !== "original" && rules !== "expanded") {
    throw new Error("--rules must be classic, original or expanded");
  }
  const difficulty = (args.get("difficulty") ?? "hard") as Difficulty | "mixed";
  if (difficulty !== "mixed" && !DIFFICULTIES.includes(difficulty))
    throw new Error("bad --difficulty");
  const personalities = args.get("personalities")?.split(",") as PersonalityId[] | undefined;
  const known: readonly PersonalityId[] =
    rules === "expanded" ? ALL_PERSONALITY_IDS : PERSONALITY_IDS;
  if (personalities?.some((p) => !known.includes(p))) throw new Error("bad --personalities");
  const options: SimOptions = {
    days: int("days", 30),
    towns: int("towns", 200),
    players: Math.max(2, int("players", 8)),
    rules,
    seed: int("seed", 1),
    difficulty,
    ...(personalities ? { personalities } : {}),
    ...(args.has("oracle") ? { oracle: true } : {}),
    ...(args.has("latejoin") ? { lateJoin: int("latejoin", 10) } : {}),
    ...(args.has("places-off") ? { placesOff: (args.get("places-off") ?? "").split(",") } : {}),
    ...(args.has("challenges") ? { challenges: int("challenges", 6) } : {}),
  };
  const workers = args.has("workers") ? int("workers", 0) : undefined;
  return {
    options,
    ...(workers !== undefined ? { workers } : {}),
    out: args.get("out") ?? "sim-report",
  };
}

async function main(): Promise<void> {
  const { options, workers, out } = parse(process.argv.slice(2));
  const base = isAbsolute(out) ? out : resolve(process.env.INIT_CWD ?? process.cwd(), out);
  let last = 0;
  const report = await runSimulation(options, {
    ...(workers !== undefined ? { workers } : {}),
    onTown: (done, total) => {
      const now = Date.now();
      if (now - last > 2000 || done === total) {
        last = now;
        process.stderr.write(`\r${done}/${total} towns`);
      }
    },
  });
  process.stderr.write("\n");
  mkdirSync(dirname(base), { recursive: true });
  writeFileSync(`${base}.json`, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(`${base}.md`, toMarkdown(report));
  console.log(`Wrote ${base}.md and ${base}.json`);
  const w = report.wins.map((x) => `${x.personality} ${(x.winRate * 100).toFixed(0)}%`).join(", ");
  console.log(`Win rates: ${w}`);
  if (!report.ok) {
    console.error(`Checks FAILED: ${JSON.stringify(report.issueCounts)}`);
    for (const i of report.issues.slice(0, 10))
      console.error(`  ${i.kind} seed ${i.seed} day ${i.day} ${i.player}: ${i.detail}`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
});
