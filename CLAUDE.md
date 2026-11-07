# FuneralQuest Remastered

A free, open-source remaster of Funeral Quest (Robinson Technologies, 2001). Read `docs/REMASTER_PLAN.md` for the full plan and `docs/classic-rules.md` for the Classic rules spec before changing game logic.

## Layout

- `legacy/` is the original C++ server, Flash client and content. Never edit it. It is the reference for every rule.
- `packages/protocol` holds the `View` and `Action` types shared by engine, server and client.
- `packages/core` is the rules engine: pure, deterministic, no I/O, no clock, no `Math.random`.
- `packages/content` holds content packs converted from `legacy/dist/*.txt`.
- `packages/bots` holds the AI rival policies, `packages/solo` the offline Solo Career (a whole town in a Web Worker, saves), `packages/legacy-compat` the bridge that lets the original Flash client play the engine (museum mode).
- `apps/server`, `apps/client`, `tools/*` are as named in the plan. The Solo and bots packages and the simulator load content from `@fq/content` (`classicPack`, `expandedPack`), never from `legacy/` directly.

## Commands

- `pnpm check` runs lint, typecheck and tests for everything.
- `pnpm --filter <package> test` and `pnpm --filter <package> typecheck` run one package.
- `pnpm exec biome check --write <path>` formats one directory.
- `pnpm play` runs the whole game locally (`pnpm play:museum` adds the original client); `pnpm e2e` runs the Playwright suites (online, solo, museum).

## Rules

- TypeScript strict, ES modules, `.js` extensions in relative imports, no `any`.
- Classic rules are ported line by line from `legacy/source/`. Cite the source file and lines in a comment on each ported function, keep the original order of random draws, and add tests that cite the same lines.
- When a rule is ported, change its section in `docs/classic-rules.md` from "Reviewed" to "Ported" and correct anything the review got wrong.
- **Original content is kept exactly as it was: dialog, game content and behaviour, and visuals** (owner's rule, 2026-11-06). Do not censor it or apply modern ethical judgments to it. Never edit, soften, replace or remove an original line, picture or behaviour for reasons of taste, sensitivity or ethics, in any pack or mode. The Classic pack is the untouched original text and the Classic art pack the untouched original art; Expanded may add but must not replace or drop original material; content-policy and banned-term checks apply only to newly written text. Bug and exploit fixes listed in `docs/classic-rules.md` section 9 are a separate matter and stay behind rules flags.
- Game text shown to players is data in a content pack, not string literals in engine code, unless the original hard-coded it and no pack exists yet.
- Text is never HTML. Use the `RichText` spans from `packages/protocol`.
- Legacy text files are CRLF and some are ISO-8859-1; `legacy/dist/script/*.c` are UTF-16 (read them with `iconv -f UTF-16`).
- Art asset ids come from the legacy URL: drop the leading `flash/` and the `.swf`, lowercase, forward slashes. `flash\places\bank.swf` is `places/bank`; `flash/wait.swf` is `wait`. Exported art lives in `assets/classic/<id>.svg`.
- Original sounds and music must not be copied into the new tree; they are not licensed for reuse.

## When several agents share this checkout

- Stay inside the directories you were given. Do not edit another package's files; if you need a change there, say so in your final report.
- Do not run git commands that change state (no commit, checkout, stash, reset, clean).
- Format and lint only your own paths. Run only your own package's tests while working.
- Add a dependency only when you must, with `pnpm add --filter <package>`; retry once if the lockfile is busy.
