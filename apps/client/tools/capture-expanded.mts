/**
 * Captures real Views from the engine's Expanded ruleset into test/fixtures/expanded-views.json,
 * so the unit tests draw exactly what the server sends. It plays the local dev town
 * (src/dev/ExpandedHost.ts) through scripted steps with fixed seeds. Run it after the engine's
 * Views change:
 *
 *   pnpm --filter @fq/client capture
 *
 * A step is `press:<button id>`, `visit:<place id>`, `pick:<player id>`, `text:<string>`,
 * `again:<button id>` (until it goes), `dismiss`, `wait` (Wait for Customer), `pass` (to the desk),
 * `round:<button id>:<outcome>` (press a Reaper Club stake until a round ends that way),
 * `capture:<name>`.
 */
import { writeFileSync } from "node:fs";
import type { View } from "@fq/protocol";
import { ExpandedHost, expandedOptions } from "../src/dev/ExpandedHost.ts";

interface Scenario {
  query: string;
  steps: string[];
}

const RICH = "?money=90000&turns=80&tags=10,6,4&karma=80&bp=3000&psych=2";
const DAY = "&day=12&seed=9";

const scenarios: Record<string, Scenario> = {
  desk: { query: `?turns=50&money=60000&day=12&seed=9`, steps: ["pass", "capture:desk"] },
  deskQuiet: { query: `?turns=50&money=60000&seed=9`, steps: ["pass", "capture:deskQuiet"] },
  map: {
    query: `?turns=50&money=60000&day=12&seed=9`,
    steps: ["pass", "press:go:map", "capture:map"],
  },
  tour: {
    query: "?tour&turns=50&money=60000&seed=3",
    steps: [
      "press:go:desk",
      "capture:morning",
      "press:go:tutorial",
      "capture:tourPage",
      "press:tutorial:next",
      "press:tutorial:next",
      "press:tutorial:next",
      "press:tutorial:next",
      "press:tutorial:next",
      "press:tutorial:next",
      "press:tutorial:next",
      "capture:tourLast",
      "press:tutorial:start",
      "capture:practiceSale",
      "press:neg:done",
      "capture:practiceDone",
      "press:prep:start",
      "capture:prep",
    ],
  },
  sale: {
    query: "?money=60000&turns=80&seed=11&tags=5,5,5&psych=3",
    steps: [
      "pass",
      "wait",
      "capture:negotiation",
      "press:neg:soft",
      "capture:hand",
      "press:neg:back",
      "press:neg:packages",
      "capture:packages",
      "press:neg:back",
      "press:neg:listen",
      "press:neg:coffee",
      "capture:afterCoffee",
      "press:neg:discount",
      "capture:afterDiscount",
      "press:neg:done",
      "capture:saleDone",
    ],
  },
  office: {
    query: "?money=200000&turns=50&seed=3&karma=20",
    steps: [
      "pass",
      "press:go:parlor",
      "capture:office",
      "press:parlor:upgrades",
      "capture:upgrades",
      "press:parlor:buy:paint",
      "capture:upgradesAfterPaint",
      "press:go:parlor",
      "press:parlor:markup",
      "capture:markup",
      "press:go:parlor",
      "press:parlor:rivalry",
      "capture:rivalry",
    ],
  },
  officePoor: {
    query: "?money=9000&turns=50&seed=3&karma=20",
    steps: [
      "pass",
      "press:go:parlor",
      "press:parlor:upgrades",
      "press:parlor:buy:paint",
      "capture:upgradesMixed",
      "press:go:parlor",
      "press:parlor:markup",
      "press:parlor:markup:20",
      "capture:markupSet",
      "press:go:parlor",
      "press:parlor:rivalry",
      "press:parlor:rivalry:cutthroat",
      "capture:rivalrySet",
    ],
  },
  store: {
    query: RICH,
    steps: ["pass", "visit:store", "press:store:caskets", "capture:storeCaskets"],
  },
  graveyard: {
    query: RICH + DAY,
    steps: [
      "pass",
      "visit:graveyard",
      "capture:graveyard",
      "press:graveyard:monuments",
      "capture:monuments",
      "press:graveyard:main",
      "press:graveyard:duel",
      "capture:duelPick",
      "pick:1",
      "capture:duel",
      "again:graveyard:swing",
      "capture:duelOver",
    ],
  },
  church: {
    query: RICH + DAY,
    steps: [
      "pass",
      "visit:church",
      "capture:church",
      "press:church:bingo",
      "capture:bingo",
      "press:church:card:3",
      "capture:bingoBought",
    ],
  },
  hall: {
    query: RICH + DAY,
    steps: [
      "pass",
      "visit:city-hall",
      "capture:hall",
      "press:city-hall:permits",
      "capture:permits",
      "press:city-hall:main",
      "press:city-hall:ordinance",
      "capture:ordinance",
      "press:city-hall:vote:open-carry",
      "capture:voted",
      "press:city-hall:lobby",
      "capture:lobbied",
      "press:city-hall:main",
      "press:city-hall:election",
      "capture:election",
      "press:city-hall:main",
      "press:city-hall:chains",
      "capture:chainsEmpty",
      "press:city-hall:found",
      "text:Last Rites Ltd",
      "capture:chains",
    ],
  },
  electionOpen: {
    query: "?money=90000&turns=80&tags=10,6,4&karma=80&bp=3000&day=6&seed=9",
    steps: [
      "pass",
      "visit:city-hall",
      "press:city-hall:election",
      "capture:electionFiling",
      "press:city-hall:file",
      "capture:filed",
    ],
  },
  club: {
    query: RICH + DAY,
    steps: [
      "pass",
      "visit:reaper-club",
      "capture:clubDoor",
      "press:reaper-club:pay",
      "capture:club",
      "press:reaper-club:games",
      "press:reaper-club:draw:100",
      "capture:clubGames",
      "round:reaper-club:slots:100:win",
      "capture:roundSlotsWin",
      "round:reaper-club:slots:100:lose",
      "capture:roundSlotsLose",
      "round:reaper-club:draw:100:win",
      "capture:roundDrawWin",
      "round:reaper-club:draw:100:push",
      "capture:roundDrawPush",
      "round:reaper-club:shots:100:win",
      "capture:roundShotsWin",
      "round:reaper-club:shots:100:lose",
      "capture:roundShotsLose",
      "press:reaper-club:main",
      "press:reaper-club:market",
      "capture:market",
    ],
  },
  bank: {
    query: RICH + DAY,
    steps: [
      "pass",
      "visit:bank",
      "capture:bank",
      "press:bank:loan",
      "capture:loans",
      "press:bank:borrow",
      "text:2000",
      "capture:borrowed",
      "press:go:bank",
      "press:bank:savings",
      "capture:savings",
      "press:go:bank",
      "press:bank:transferhome",
      "capture:transfers",
      "press:go:bank",
      "press:go:map",
      "visit:funeral-home",
      "capture:deskInDebt",
    ],
  },
  hospital: {
    query: RICH + DAY,
    steps: [
      "pass",
      "visit:graveyard",
      "press:graveyard:duel",
      "pick:1",
      "again:graveyard:swing",
      "press:go:graveyard",
      "press:go:map",
      "visit:hospital",
      "capture:hospital",
      "press:hospital:treat:shovel-face",
      "capture:hospitalTreated",
    ],
  },
};

const out: Record<string, View> = {};

for (const [name, scenario] of Object.entries(scenarios)) {
  const host = new ExpandedHost(expandedOptions(scenario.query));
  let view = await host.connect();
  const act = async (a: Parameters<ExpandedHost["send"]>[0]) => {
    view = await host.send(a);
  };
  const need = (id: string) => {
    const b = view.buttons.find((x) => x.id === id);
    if (!b) {
      const ids = view.buttons.map((x) => x.id).join(", ");
      throw new Error(`${name}: no button ${id} on "${view.title}" (${ids})`);
    }
    return b;
  };
  for (const step of scenario.steps) {
    const [kind = "", ...rest] = step.split(":");
    const arg = rest.join(":");
    const overlay = view.overlay;
    switch (kind) {
      case "pass":
        for (let i = 0; i < 8; i++) {
          if (view.overlay?.kind === "message") {
            await act({ type: "dismiss", overlayId: view.overlay.id });
            continue;
          }
          const next = ["tutorial:skip", "go:desk"].find((id) =>
            view.buttons.some((b) => b.id === id),
          );
          if (!next) break;
          await act({ type: "press", buttonId: next });
        }
        break;
      case "press":
        need(arg);
        await act({ type: "press", buttonId: arg });
        break;
      case "again":
        // Presses the button for as long as the screen offers it (a duel's swings).
        for (let i = 0; i < 20 && view.buttons.some((b) => b.id === arg); i++) {
          await act({ type: "press", buttonId: arg });
        }
        break;
      case "visit":
        if (!view.map) {
          need("go:map");
          await act({ type: "press", buttonId: "go:map" });
        }
        await act({ type: "visit", placeId: arg });
        break;
      case "pick":
        if (overlay?.kind !== "playerPicker") throw new Error(`${name}: no picker for ${step}`);
        await act({ type: "pickPlayer", overlayId: overlay.id, playerId: Number(arg) });
        break;
      case "text":
        if (overlay?.kind !== "textInput") throw new Error(`${name}: no text box for ${step}`);
        await act({ type: "submitText", overlayId: overlay.id, text: arg });
        break;
      case "dismiss":
        if (overlay?.kind === "message") await act({ type: "dismiss", overlayId: overlay.id });
        break;
      case "wait":
        need("desk:wait");
        await act({ type: "press", buttonId: "desk:wait" });
        if (!view.customer) throw new Error(`${name}: wait gave no customer (${view.title})`);
        break;
      case "round": {
        // round:<button id>:<outcome>: a stake, pressed until a round ends that way.
        const at = arg.lastIndexOf(":");
        const id = arg.slice(0, at);
        const outcome = arg.slice(at + 1);
        for (let i = 0; i < 60 && view.club?.lastRound?.outcome !== outcome; i++) {
          need(id);
          await act({ type: "press", buttonId: id });
        }
        if (view.club?.lastRound?.outcome !== outcome) throw new Error(`${name}: no ${step}`);
        break;
      }
      case "capture":
        out[arg] = JSON.parse(JSON.stringify(view)) as View;
        break;
      default:
        throw new Error(`unknown step ${step}`);
    }
  }
}

const file = new URL("../test/fixtures/expanded-views.json", import.meta.url);
writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`);
console.log(`captured ${Object.keys(out).length} views: ${Object.keys(out).join(", ")}`);
