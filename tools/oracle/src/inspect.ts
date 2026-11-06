/**
 * Prints the steps of one walk of the differential suite, both sides' responses
 * and any state difference: `pnpm --filter @fq/oracle run inspect <family> <seed> [from] [to] [player]`.
 * W=width of each printed response (default 900), LOG=1 adds the original's log,
 * MAIL=1 the port's queued mail for the player at a divergence.
 */
import { runWalk } from "./run.js";
import { FAMILIES } from "./suite.js";

const [fam, seedS, fromS, toS, whoS] = process.argv.slice(2);
const family = FAMILIES.find((f) => f.name === fam);
if (!family)
  throw new Error(`unknown family ${fam}; one of ${FAMILIES.map((f) => f.name).join(", ")}`);
const r = await runWalk(family.spec(Number(seedS)));
console.log(`steps ${r.steps} matched ${r.matched}`);
const from = fromS === undefined ? r.matched - 5 : Number(fromS);
const to = toS === undefined ? r.matched : Number(toS);
for (const c of r.records.slice(from, to + 1)) {
  if (whoS !== undefined && "p" in c.step && c.step.p !== Number(whoS)) continue;
  console.log(
    `\n#${c.index} ${JSON.stringify(c.step)} rng O${JSON.stringify(c.original.rng)} P${JSON.stringify(c.port.rng)} ${c.original.refused ?? ""}|${c.port.refused ?? ""}`,
  );
  for (const v of c.original.responses)
    console.log(" O:", JSON.stringify(v).slice(0, Number(process.env.W ?? 900)));
  for (const v of c.port.responses)
    console.log(" P:", JSON.stringify(v).slice(0, Number(process.env.W ?? 900)));
  if (c.state.length) console.log(" STATE", JSON.stringify(c.state).slice(0, 600));
  if (process.env.LOG && c.original.log)
    console.log(" LOG", JSON.stringify(c.original.log).slice(0, 1500));
}
if (process.env.MAIL && r.divergence) {
  const t = r.portTown as { players: { mail: unknown }[] };
  const pid = "p" in r.divergence.step ? r.divergence.step.p : 0;
  console.log("PORT MAIL", JSON.stringify(t.players[pid]?.mail).slice(0, 3000));
}
