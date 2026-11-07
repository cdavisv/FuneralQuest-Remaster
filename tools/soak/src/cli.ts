import { join } from "node:path";
import { formatReport } from "./report.js";
import { runSoak, type SoakOptions } from "./run.js";
import { REPO } from "./serverProcess.js";

const HELP = `pnpm --filter @fq/soak run soak -- [options]

  --rules classic|expanded   ruleset (default classic)
  --days N                   tournament length in game days (default 14)
  --players N                players (default 8)
  --day-seconds S            real seconds per game day (default: from players and rules)
  --seed N                   town and bot seed (default 1)
  --kills N                  3 or 4 (4 also kills inside the final midnight; default 4, 3 with --short)
  --no-restore               skip the backup and restore
  --no-admin                 skip the sysop actions
  --short                    the CI run: --days 2 --players 4, about a minute
  --stress                   40 players, 5 days, Classic, everyone at once
  --out DIR                  results root (default tools/soak/results)
  --name NAME                run name (default from the options)

Exit code 0 when every invariant held, 1 otherwise.`;

function parse(argv: string[]): SoakOptions {
  const args = argv.filter((a) => a !== "--");
  const flag = (name: string) => args.includes(name);
  const value = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  if (flag("--help") || flag("-h")) {
    console.log(HELP);
    process.exit(0);
  }
  const short = flag("--short");
  const stress = flag("--stress");
  const rules = (value("--rules") ?? "classic") as SoakOptions["rules"];
  if (rules !== "classic" && rules !== "expanded") throw new Error(`--rules: ${rules}`);
  const days = Number(value("--days") ?? (short ? 2 : stress ? 5 : 14));
  const players = Number(value("--players") ?? (short ? 4 : stress ? 40 : 8));
  // A game day must hold everyone's play; Expanded days are longer, and 40 players queue.
  const perPlayer = rules === "expanded" ? 4.5 : 2.5;
  const daySeconds = Number(
    value("--day-seconds") ?? Math.max(short ? 16 : 24, Math.ceil(12 + perPlayer * players)),
  );
  const kills = Number(value("--kills") ?? (short ? 3 : 4));
  const name =
    value("--name") ?? (short ? "short" : stress ? "stress" : `${rules}-${days}d-${players}p`);
  return {
    name,
    rules,
    days,
    players,
    daySeconds,
    seed: Number(value("--seed") ?? 1),
    out: value("--out") ?? join(REPO, "tools/soak/results"),
    kills,
    restore: !flag("--no-restore"),
    admin: !flag("--no-admin"),
    stepCap: 400,
    playFraction: 0.75,
    maintenancePauseMs: 400,
    guestShare: 0.5,
    afterSeason: true,
  };
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  // Exit through process.exit so the server child is killed too (serverProcess.ts).
  process.on(signal, () => process.exit(130));
}

const options = parse(process.argv.slice(2));
runSoak(options).then(
  (report) => {
    console.log(formatReport(report));
    process.exit(report.passed ? 0 : 1);
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exit(2);
  },
);
