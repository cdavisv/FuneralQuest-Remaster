import type { SoakReport } from "./run.js";

/** A short text summary of a run, for the terminal and CI logs. */
export function formatReport(r: SoakReport): string {
  const t = r.totals;
  const lines: string[] = [];
  lines.push("");
  lines.push(`Soak run ${r.name}: ${r.passed ? "PASSED" : "FAILED"} in ${r.realSeconds} s`);
  lines.push(
    `  ${r.options.rules}, ${r.options.days}-day tournament, ${r.options.players} players, ${r.gameDaysPlayed} game days played`,
  );
  lines.push(
    `  actions ${t.actions ?? 0} (accepted ${t.accepted ?? 0}, refused though offered ${t.refusedOffered ?? 0}, stale ${t.refusedStale ?? 0}, not offered ${t.refusedNotOffered ?? 0}, unanswered ${t.unknownOutcome ?? 0})`,
  );
  lines.push(
    `  chat ${t.chats ?? 0}, letters ${t.letters ?? 0}, announcements ${t.announcements ?? 0}, visits ${t.visits ?? 0}, battles ${t.battles ?? 0}, pushes ${t.pushes ?? 0}`,
  );
  lines.push(
    `  server starts ${t.serverStarts}, hard kills ${t.hardKills}: ${r.restarts.map((x) => `day ${x.day} ${x.kind}`).join("; ")}`,
  );
  lines.push(
    `  backups: ${r.backups.map((b) => `${b.file} (day ${b.day}${b.restored ? ", restored" : ""})`).join("; ") || "none"}`,
  );
  lines.push(
    `  sysop: ${r.adminActions.map((a) => `${a.what}${a.ok ? "" : " (FAILED)"}`).join("; ")}`,
  );
  lines.push(`  season ended: ${r.seasonEnded}, winner: ${r.winner ?? "none"}`);
  if (r.expandedFeatures) {
    lines.push(
      `  expanded presses: ${Object.entries(r.expandedFeatures)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ")}`,
    );
  }
  if (r.expandedLife && r.expandedLife.length > 0) {
    const l = r.expandedLife;
    lines.push(
      `  expanded town: bingo cards sold ${l.reduce((n, d) => n + d.bingoCardsSold, 0)}, days with an ordinance ballot ${l.filter((d) => d.ordinance || d.ballot).length}, election candidates ${Math.max(...l.map((d) => d.candidates))}, election held ${l.some((d) => d.electionHeld)}, mayor ${
        l
          .map((d) => d.mayor)
          .filter((m) => m !== null)
          .at(-1) ?? "none"
      }, chains ${Math.max(...l.map((d) => d.chains))}, players with loans ${Math.max(...l.map((d) => d.loans))}, with savings ${Math.max(...l.map((d) => d.savings))}`,
    );
  }
  const last = r.dbGrowth.at(-1);
  if (last) {
    lines.push(
      `  database: ${(last.dbBytes / 1024).toFixed(0)} KiB, WAL ${(last.walBytes / 1024).toFixed(0)} KiB, ${last.auditRows} audit rows, ${last.snapshots} snapshots`,
    );
  }
  const inv = Object.entries(r.invariants);
  lines.push(
    `  invariants: ${inv.reduce((n, [, v]) => n + v.passed, 0)} checks passed, ${inv.reduce((n, [, v]) => n + v.failed, 0)} failed`,
  );
  for (const [name, v] of inv.filter(([, v]) => v.failed > 0))
    lines.push(`    ${name}: ${v.failed} failed`);
  for (const v of r.violations.slice(0, 30))
    lines.push(`    - [day ${v.day}] ${v.invariant}: ${v.message}`);
  if (r.violations.length > 30)
    lines.push(`    ... ${r.violations.length - 30} more in violations.json`);
  if (Object.keys(r.notes).length > 0) {
    lines.push(
      `  notes: ${Object.entries(r.notes)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ")}`,
    );
  }
  lines.push(`  results: ${r.dir}`);
  return lines.join("\n");
}
