# Expanded content volume

How much content the built-in Expanded pack carries, measured against the targets in
`docs/REMASTER_PLAN.md` section 3.3 (the end of the section, and item A's "25 or more" lines per
action). Measured on 2026-11-07 from `packages/content/built/expanded.json`, before and after the
content pass of that day.

## How it is counted

- Counts are what the Expanded ruleset can draw in play: the Classic originals the Expanded pack
  inherits (`merge: append`) plus the Expanded additions. Classic's original lines are all kept,
  unchanged (CLAUDE.md, `packages/content/EDITS.md`).
- Ranged tables (events, news blurbs, fortunes) count distinct entries over all brackets; each
  bracket also holds every Classic entry.
- A pitch, refusal or reaction pool counts every line the engine picks from for that moment
  (`packages/core/src/expanded/negotiation.ts`): Classic's pool and the Expanded pool together where
  the engine merges them (`[...n.softPitch, ...t.softPitch]`, the package refusals with Classic's
  `upgradeRefuse`, and so on). Soft Sell acceptance is not counted: Classic's five lines are read by
  mood band (`INDEXED_TEXT`) and cannot grow.
- "30 upgrades" is read as the paid tiers of the package ladders, which is what replaces Classic's
  hard-sell upgrade list in Expanded play (`docs/expanded-rules.md` 5.1). The Classic-format
  `hard_sell.yaml` (32 entries) and `soft_sell.yaml` (162) are only read under Classic rules; under
  Expanded rules the soft-sell hand draws from `expanded.softSell` and the upsells from `packages`.
- The counting script is a few lines of Node over the built JSON; rerun it after
  `pnpm --filter @fq/content build` (the queries are the ones in the table's first column).

## Before and after

| Table | Before | After | Target |
|---|---|---|---|
| Events (distinct, all brackets) | 126 | 141 | 120 |
| News blurbs (distinct titles) | 107 | 116 | 80 |
| Town news stories (rule-changing) | 75 | 78 | - |
| Story arcs | 11 | 11 | 6 |
| Story arc beats | 48 | 48 | - |
| Risks | 44 | 47 | 40 |
| Soft-sell items (Expanded hand, `expanded.softSell`) | 185 | 185 | 150 |
| Soft-sell items (Classic-format list) | 162 | 162 | - |
| Package upgrade tiers (paid) | 29 | 30 | 30 |
| Parlor upgrades | 15 | 15 | - |
| Hard-sell upgrades (Classic-format list) | 32 | 32 | - |
| Fortunes (tiger, distinct) | 163 | 163 | 150 |
| Fortunes (nice, distinct) | 55 | 55 | - |
| No-customer lines | 44 | 44 | - |
| Special customers | 21 | 26 | - |
| Backstories | 63 | 63 | - |
| Traits | 44 | 44 | - |
| Body-preparation events | 62 | 62 | - |
| Weathers | 14 | 14 | - |
| Ordinances | 26 | 26 | - |
| Black-market items | 20 | 20 | - |
| Injuries | 16 | 16 | - |
| Tells: loved | 17 | 25 | 25 |
| Tells: not loved | 16 | 25 | 25 |
| Tells: cheapness low | 15 | 25 | 25 |
| Tells: cheapness middling | 15 | 25 | 25 |
| Tells: cheapness high | 15 | 25 | 25 |
| Tells: limit high | 15 | 25 | 25 |
| Tells: limit low | 15 | 25 | 25 |
| Map locations | 12 | 12 | 20 |

Lines per negotiation moment (target 25 each):

| Pool | Before | After |
|---|---|---|
| Soft Sell pitch | 26 | 26 |
| Soft Sell refusal | 26 | 26 |
| Hard Sell pitch (wood to silver) | 26 | 26 |
| Hard Sell pitch (silver to gold) | 26 | 26 |
| Hard Sell refusal | 26 | 26 |
| Hard Sell acceptance | 26 | 26 |
| Guilt pitch | 29 | 29 |
| Guilt reaction (loved) | 26 | 26 |
| Guilt reaction (not loved) | 26 | 26 |
| Sympathy pitch (plus 2 age-limited) | 28 | 28 |
| Sympathy reaction (loved) | 26 | 26 |
| Sympathy reaction (not loved) | 26 | 26 |
| Coffee pitch | 26 | 26 |
| Coffee accepted (loved) | 26 | 26 |
| Coffee accepted (not loved) | 26 | 26 |
| Coffee refused | 25 | 25 |
| Listen pitch | 26 | 26 |
| Listen reaction (loved) | 25 | 25 |
| Listen reaction (not loved) | 25 | 25 |
| Discount pitch | 26 | 26 |
| Discount accepted | 26 | 26 |
| Discount haggle | 16 | 25 |
| Package pitch (generic; each ladder adds 12 or 13 of its own) | 26 | 26 |
| Package accepted | 25 | 25 |
| Package refused | 28 | 28 |
| Cremation pitch | 26 | 26 |
| Cremation accepted | 25 | 25 |
| Cremation refused | 25 | 25 |
| Arrival request | 17 | 30 |
| Arrival request (pet) | 9 | 25 |
| Returning family (happy) | 8 | 25 |
| Returning family (ok) | 8 | 25 |
| Returning family (sour) | 8 | 25 |
| Returning family (walked out) | 8 | 25 |
| Impatience | 26 | 26 |
| Walkout (fed up) | 13 | 25 |
| Walkout (over the limit) | 13 | 25 |

## The cast (plan 3.3 G)

Named characters with lines in the Expanded pack: Elijah, Father Smyth, June, Mr. Yang, the Twins,
Nurse Gertie, Prudence Ledbetter (the Teller), Morty, Cousin Sal, Old Man Withers and the Mayor
(Hollis Grubb as the NPC) from the original cast; Lucius Vane (the Reaper Club owner) and Inspector
Mudge (the health inspector) from the town pass; and, new in this pass:

- **Dr. Ignatius Grimble, the county coroner** (the coroner was unnamed before): a special customer
  (an offer of four unclaimed bodies), a risk (the death certificate), events in all three brackets,
  three news blurbs, a town news story (`coroner-fishing`) and an arrival line.
- **The Mournes of Mourne & Sons, the rival parlor family** (Augustus, and his sons Ned and Rollo;
  "Deathville's other undertakers since 1931"): a special customer (Augustus buys a funeral from you
  and takes notes), a risk (their hearse across your driveway), events, three news blurbs, a town
  news story (`mourne-price-war`), and lines in the arrival, returning-family, tell and walkout
  pools.

This pass also gave June, Lucius Vane and Inspector Mudge special-customer visits (June buries the
restaurant's pet; Vane a "business associate"; Mudge a surprise inspection) and put Mudge, Vane and
Nurse Gertie into events and news.

## Not reached, and why

- **Map locations: 12 of 20.** A location is an engine module and a map entry
  (`packages/core/src/classic/modules/index.ts:32-42`, `packages/core/src/expanded/town/index.ts:17-21`),
  not content. Reaching 20 needs eight new `LocationModule`s in `packages/core`.
- **The coroner and the rival family are named literally.** `town.cast` has slots only for the
  mayor, club owner, nurse, inspector and teller (`packages/core/src/expanded/content/townTypes.ts:25`,
  mirrored in `packages/content/src/expandedSchema.ts:884`), so there is no `{coroner}` placeholder.
  Adding cast slots is an engine change.
- **Parlor upgrades stay at 15.** The upgrade list is a ruleset (`packages/core/src/rules/expandedRules.ts:278`);
  the pack only names them.
- **Two Expanded text pools are never read**: `negotiation.selfRequest` (9 lines) and
  `negotiation.listenNothing` (13) are in the types (`packages/core/src/expanded/content/types.ts:339`
  and `:389`) but `expanded/negotiation.ts` does not draw from them (arrival uses `request` for
  every customer, line 388-391; Listen throws when there is nothing to learn, line 679). No lines
  were added to them; the engine has to start reading them first.
- **Soft Sell acceptance** is five Classic lines indexed by mood band and cannot take more.
