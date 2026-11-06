import type { ContentPack, CustomerEffects, Reward } from "@fq/core";

/**
 * The strategy guide an Expanded regular has in their head: the public
 * content of the pack the town plays with (what each trait does, which tags
 * each extra carries, what the tell lines sound like, what a special's deal
 * pays). It is the printed rule book, never the state of a game: the hidden
 * facts of a customer (limit, loved flag, resistance) are only ever learned
 * from the screen. Built once per pack.
 */
export interface Guide {
  traits: Map<string, CustomerEffects>;
  /** Soft-sell card name to tags. */
  items: Map<string, string[]>;
  /** Package category id to tiers (name, price, tags), tier 0 first. */
  packages: Map<string, { name: string; price: number; tags: string[] }[]>;
  cremation: { fee: number; tags: string[] };
  tells: Record<"loved" | "notLoved" | "cheapLow" | "cheapMid" | "cheapHigh", RegExp[]>;
  /** "That would put me over my limit": the pitch fitted the customer's taste, not the wallet. */
  overLimit: RegExp[];
  blessLoved: RegExp[];
  blessNotLoved: RegExp[];
  /** A special's flat offer, by the panel label. */
  offers: Map<string, { accept: Reward; decline: Reward }>;
}

/** A template line to a pattern: colour codes dropped, placeholders match anything. */
export function templatePattern(template: string): RegExp | null {
  const plainText = template.replace(/`./g, "").trim();
  const parts = plainText.split(/\{[A-Za-z]+\}/);
  const literal = parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const longest = Math.max(...parts.map((p) => p.trim().length));
  if (longest < 6) return null;
  return new RegExp(literal.join(".{0,40}?").replace(/\s+/g, "\\s+"));
}

function patterns(lines: readonly string[] | undefined): RegExp[] {
  return (lines ?? []).map(templatePattern).filter((r): r is RegExp => r !== null);
}

const cache = new WeakMap<ContentPack, Guide | null>();

/** The guide for a pack, or null when the pack has no Expanded section (Classic). */
export function guideFrom(content: ContentPack | undefined): Guide | null {
  if (!content) return null;
  const hit = cache.get(content);
  if (hit !== undefined) return hit;
  const x = content.expanded;
  if (!x) {
    cache.set(content, null);
    return null;
  }
  const n = content.text.negotiation;
  const guide: Guide = {
    traits: new Map(x.traits.map((t) => [t.id, t.effects])),
    items: new Map(x.softSell.map((s) => [s.name, s.tags])),
    packages: new Map(
      x.packages.map((c) => [
        c.id,
        c.tiers.map((t) => ({ name: t.name, price: t.price, tags: t.tags })),
      ]),
    ),
    cremation: { fee: x.cremation.fee, tags: x.cremation.tags },
    tells: {
      loved: patterns(x.tells.loved),
      notLoved: patterns(x.tells.notLoved),
      cheapLow: patterns(x.tells.cheapLow),
      cheapMid: patterns(x.tells.cheapMid),
      cheapHigh: patterns(x.tells.cheapHigh),
    },
    overLimit: patterns([
      n.softOverLimit,
      n.hardOverLimit,
      n.upgradeOverLimit,
      x.text.negotiation.packageOverLimit,
    ]),
    blessLoved: patterns([x.text.negotiation.blessResult.loved]),
    blessNotLoved: patterns([x.text.negotiation.blessResult.notLoved]),
    offers: new Map(
      x.specials
        .filter((s) => s.offer)
        .map((s) => [
          s.label,
          { accept: s.offer?.accept.effects ?? {}, decline: s.offer?.decline.effects ?? {} },
        ]),
    ),
  };
  cache.set(content, guide);
  return guide;
}

export function matchesAny(text: string, list: readonly RegExp[]): boolean {
  return list.some((r) => r.test(text));
}
