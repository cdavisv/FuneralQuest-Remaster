/**
 * Engine bugs found while building the Expanded bots and the balance
 * simulator (docs/balance/expanded-tuning-log.md), each with the smallest fix.
 */
import type { View } from "@fq/protocol";
import { describe, expect, it } from "vitest";
import { Turn } from "../src/engine/turn.js";
import { chooseInjury } from "../src/expanded/town/life.js";
import {
  addModifier,
  EXPANDED_STARTER,
  type ExpandedContent,
  expandedContext,
  type MailPacket,
  MODIFIER_KEYS,
  richTextToPlain,
  type TownState,
} from "../src/index.js";
import { makeXTown, pressX } from "./support/expanded.js";
import { act, makeTown, press } from "./support/harness.js";
import { legacyContent } from "./support/legacyContent.js";
import { townWalk } from "./support/townWalk.js";
import { atXDesk, meet, px } from "./support/xplaces.js";

describe("a special customer is not a family (expanded-rules.md 3.8)", () => {
  it("a fixed-person special who walks out is not remembered, so cannot return as a family", () => {
    const only = EXPANDED_STARTER.specials.filter((s) => s.id === "celebrity");
    const content: ExpandedContent = { ...EXPANDED_STARTER, specials: only };
    const ctx = expandedContext({ ...legacyContent(), expanded: content });
    const placed = atXDesk({
      seed: 64,
      setup: (t) => {
        addModifier(t, {
          key: MODIFIER_KEYS.specialChance,
          op: "mul",
          value: 1000,
          untilDay: 99,
          source: "test",
        });
      },
    });
    let p = meet({ ...placed, ctx }, (c) => {
      c.mood = 10;
    });
    expect(p.view.customer?.name).toBe("Crystal Vance");
    p = px(p, "neg:sympathy");
    expect(p.town.sessions["0"]?.customer.flow).toBe("none");
    expect(p.town.players[0]?.expanded?.record.walkouts).toBe(1);
    expect(p.town.players[0]?.expanded?.families.map((f) => f.surname)).not.toContain("Vance");
  });
});

/** The news blurb's gift mail (maint.cpp:33-95): Continue, text, reward, picture, Continue. */
function giftMail(): MailPacket[] {
  const base = { importance: "high" as const, from: -1, expireDay: null };
  const stop = {
    ...base,
    type: "buttons" as const,
    buttons: [{ id: "go:desk", label: "Continue" }],
  };
  return [
    stop,
    { ...base, type: "text", text: "A grateful widow sends you a fruit basket." },
    { ...base, type: "picture", layer: "fg", picture: "stuff/money_bag" },
    stop,
  ];
}

function mailOverlays(town: TownState, ctx: Parameters<typeof press>[3], first: string): string[] {
  const player = town.players[0];
  if (!player) throw new Error("no player");
  player.mail = giftMail();
  let r = press(town, 0, first, ctx);
  const texts: string[] = [];
  for (let i = 0; i < 4 && r.view.overlay?.kind === "message"; i++) {
    texts.push(richTextToPlain(r.view.overlay.text).trim());
    r = act(r.town, 0, { type: "dismiss", overlayId: r.view.overlay.id }, ctx);
  }
  return texts;
}

describe("a gift mail that starts with a Continue stop", () => {
  it("Expanded: the desk reads past the empty stop and shows the gift at once", () => {
    const made = makeXTown(71, 1);
    let town = pressX(made.town, 0, "go:desk", made.ctx).town;
    town = pressX(town, 0, "go:tutorial", made.ctx).town;
    town = pressX(town, 0, "tutorial:skip", made.ctx).town;
    town = pressX(town, 0, "go:stats", made.ctx).town;
    const texts = mailOverlays(town, made.ctx, "go:desk");
    expect(texts).toEqual(["A grateful widow sends you a fruit basket."]);
  });

  // Fixed in both rulesets: the empty overlay was the remaster's mail-to-overlay conversion,
  // not original behaviour. The Classic transcripts were re-recorded with only those
  // overlays (and the dismiss that closed each) removed (expanded-rules.md 1.3, 10.2).
  it("Classic: the desk reads past the empty stop too", () => {
    const made = makeTown(72, 1);
    let town = press(made.town, 0, "go:desk", made.ctx).town;
    town = press(town, 0, "go:desk", made.ctx).town;
    town = press(town, 0, "go:stats", made.ctx).town;
    const texts = mailOverlays(town, made.ctx, "go:desk");
    expect(texts[0]).not.toBe("");
    expect(texts[0]).toBe("A grateful widow sends you a fruit basket.");
  });
});

describe("text placeholders (starter town content)", () => {
  it("no View the town shows carries an unfilled {token}", () => {
    const bad = new Set<string>();
    const scan = (view: View) => {
      const parts = [
        view.text,
        view.note ?? [],
        view.status ?? [],
        ...(view.overlay && "text" in view.overlay ? [view.overlay.text] : []),
        ...(view.customer?.notes ?? []),
      ];
      const text = [
        ...parts.map(richTextToPlain),
        ...view.buttons.flatMap((b) => [b.label, b.detail ?? "", b.hint ?? ""]),
        view.overlay && "prompt" in view.overlay ? view.overlay.prompt : "",
      ].join("\n");
      for (const m of text.matchAll(/\{[A-Za-z]+\}/g)) bad.add(`${m[0]} on ${view.title}`);
    };
    for (const seed of [31, 32]) {
      const { town, ctx } = makeXTown(seed * 7, 4);
      townWalk(town, ctx, {
        seed,
        days: 6,
        players: 4,
        exercise: true,
        cap: 220,
        onView: scan,
        setup: (t) => {
          for (const p of t.players) {
            p.money = 200_000;
            p.tags = [40, 10, 10];
          }
        },
      });
    }
    expect([...bad]).toEqual([]);
  }, 60_000);
});

describe("injuries come from the pack (expanded-rules.md 19.1)", () => {
  it("each cause draws from the injuries that name it, or from all of them", () => {
    const made = makeXTown(81, 2);
    const ctx = made.ctx;
    const injuries = ctx.content.expanded?.town?.injuries ?? [];
    // The starter tags one injury per cause except duels and fights, which share two.
    expect(injuries.filter((i) => i.causes?.includes("hit")).map((i) => i.id)).toEqual([
      "kneecapped",
    ]);
    const untagged = {
      ...ctx,
      content: {
        ...ctx.content,
        expanded: {
          ...(ctx.content.expanded as ExpandedContent),
          town: {
            ...(ctx.content.expanded?.town as NonNullable<ExpandedContent["town"]>),
            injuries: [
              ...injuries.map(({ causes: _c, ...rest }) => rest),
              { id: "lily-rash", name: "Lily Rash", text: "", days: 1, hp: 1, treatPrice: 300 },
            ],
          },
        },
      },
    };
    const seen = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      const town = structuredClone(made.town);
      town.seed = seed * 7919 + 1;
      town.streams = {};
      const turn = new Turn(town, untagged, 0);
      seen.add(chooseInjury(turn, "hit") ?? "");
    }
    // An untagged pack draws every cause from all six.
    expect(seen.size).toBe(6);
  });
});
