import type { EngineContext } from "../engine/turn.js";
import type { MailPacket, NewsDay, PlayerState, TownState } from "../state/types.js";
import { fill } from "../text/format.js";
import { findPlayerByName } from "./players.js";

/**
 * Moderation host functions (a remaster addition, both rulesets): taking a
 * player's stored free text down (account deletion, a moderator's takedown)
 * and renaming a player or parlor by moderator action. Pure: each returns a
 * new town and never touches the clock or a random stream.
 */

export interface RemovedText {
  /** Letters still queued in other players' mail (each is three packets). */
  letters: number;
  /** Announcements taken off the paper (every stored day). */
  announcements: number;
  /** Battle quotes: queued quote mails, and crime-page entries reduced to their no-quote form. */
  quotes: number;
  /** Lucky Sparrow fortunes still queued (the Cursed Tiger's are anonymous and cannot be traced). */
  fortunes: number;
  /**
   * Expanded towns only: parlor chains the player founded (and so named), renamed to the pack's
   * neutral `chains.removedName`. Absent in a Classic town.
   */
  chains?: number;
}

const ANY = "([\\s\\S]*?)";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A regular expression for a `fill` template: `fixed` placeholders match their
 * value literally, the others match anything (lazily) and are captured in order.
 */
function templateRegex(
  template: string,
  fixed: Record<string, string>,
  any = ANY,
): { re: RegExp; keys: string[] } {
  const keys: string[] = [];
  let source = "";
  let last = 0;
  for (const m of template.matchAll(/\{(\w+)\}/g)) {
    source += escapeRegExp(template.slice(last, m.index));
    const key = m[1] as string;
    const value = fixed[key];
    if (value !== undefined) source += escapeRegExp(value);
    else {
      keys.push(key);
      source += any;
    }
    last = (m.index ?? 0) + m[0].length;
  }
  source += escapeRegExp(template.slice(last));
  return { re: new RegExp(source, "g"), keys };
}

function groups(m: RegExpMatchArray, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  keys.forEach((k, i) => {
    out[k] = m[i + 1] ?? "";
  });
  return out;
}

/** Whether a mail text packet is `template` filled with `name` for `{name}`. */
function matchesMail(packet: MailPacket, template: string, name: string): boolean {
  if (packet.type !== "text") return false;
  const { re } = templateRegex(template, { name });
  return new RegExp(`^${re.source}$`).test(packet.text);
}

/**
 * Removes `playerId`'s stored free text: their letters still queued for
 * others, their announcements on every stored front page, their battle
 * quotes (queued quote mails; crime-page entries keep the fight and lose the
 * quote) and their Lucky Sparrow fortunes still queued. `names` adds names
 * the player used before (the engine keeps no history of a self-rename).
 * Chat is never stored. In an Expanded town the chains the player founded
 * (whose names they typed) are renamed to the pack's neutral name, also where
 * the old name stands in stored text.
 */
export function removePlayerText(
  town: TownState,
  playerId: number,
  ctx: EngineContext,
  options: { names?: readonly string[] } = {},
): { town: TownState; removed: RemovedText } {
  const removed: RemovedText = { letters: 0, announcements: 0, quotes: 0, fortunes: 0 };
  const player = town.players[playerId];
  if (!player) return { town, removed };
  const out = JSON.parse(JSON.stringify(town)) as TownState;
  const social = ctx.content.text.social;
  const yangs = ctx.content.text.places.yangs;
  const names = [...new Set([player.name, ...(options.names ?? [])])].filter((n) => n !== "");
  const reply = `mailbox:reply:${playerId}`;

  // Queued mail of everyone else.
  for (const q of out.players) {
    if (q.id === playerId) continue;
    const mail: MailPacket[] = [];
    for (const packet of q.mail) {
      if (packet.type === "buttons" && packet.buttons.some((b) => b.id === reply)) {
        // A letter: text, quote, then these buttons (classic/mail.ts sendLetter).
        if (mail[mail.length - 1]?.type === "quote") mail.pop();
        const text = mail[mail.length - 1];
        if (text && names.some((n) => matchesMail(text, social.mail.received, n))) mail.pop();
        removed.letters++;
        continue;
      }
      if (
        names.some(
          (n) =>
            matchesMail(packet, social.battle.winQuoteMail, n) ||
            matchesMail(packet, social.battle.lostQuoteMail, n),
        )
      ) {
        removed.quotes++;
        continue;
      }
      if (names.some((n) => matchesMail(packet, yangs.sparrowMail, n))) {
        removed.fortunes++;
        continue;
      }
      mail.push(packet);
    }
    q.mail = mail;
  }

  // The paper: announcements go; quotes on the crime page lose the quote.
  for (const day of Object.values(out.news) as NewsDay[]) {
    for (const name of names) {
      const header = templateRegex(social.news.announcementHeader, { name });
      // The header, then the announcement up to its blank line (classic/modules/news.ts).
      const re = new RegExp(`${header.re.source}[\\s\\S]*?\\r\\n\\r\\n`, "g");
      day.front = day.front.replace(re, () => {
        removed.announcements++;
        return "";
      });
      for (const [quoted, plain, who] of [
        [social.battle.crimeWinQuote, social.battle.crimeWin, "winner"],
        [social.battle.crimeLostQuote, social.battle.crimeLost, "loser"],
      ] as const) {
        const { re: q, keys } = templateRegex(quoted, { [who]: name });
        day.crime = day.crime.replace(q, (...args) => {
          removed.quotes++;
          const vars = groups(args as unknown as RegExpMatchArray, keys);
          return fill(plain, { ...vars, [who]: name });
        });
      }
    }
  }
  // Expanded: chain names the player typed.
  const life = out.expanded?.life;
  if (life) {
    removed.chains = 0;
    const template = ctx.content.expanded?.town?.text.chains.removedName;
    const swaps: [string, string][] = [];
    for (const chain of life.chains) {
      const founder = chain.founder ?? chain.members[0];
      if (founder !== playerId) continue;
      const n = chain.id.replace(/^\D+/, "");
      const name = template ? fill(template, { n }) : chain.id;
      if (name === chain.name) continue;
      swaps.push([chain.name, name]);
      chain.name = name;
      removed.chains++;
    }
    swapStoredText(out, swaps);
  }
  return { town: out, removed };
}

/** Replaces each `[from, to]` where `from` stands as whole words in a string. */
function wholeWordSwap(text: string, swaps: readonly [string, string][]): string {
  let t = text;
  for (const [from, to] of swaps) {
    if (from === "") continue;
    // Whole words; a colour code (a backtick and one character) counts as a boundary.
    const re = new RegExp(`(?<=^|[^A-Za-z0-9]|\`.)${escapeRegExp(from)}(?![A-Za-z0-9])`, "g");
    t = t.replace(re, to);
  }
  return t;
}

/** `wholeWordSwap` over the stored paper, queued mail, the mayor's name and the Book of Deeds. */
function swapStoredText(out: TownState, swaps: readonly [string, string][]): void {
  if (swaps.length === 0) return;
  const swap = (text: string) => wholeWordSwap(text, swaps);
  for (const day of Object.values(out.news) as NewsDay[]) {
    day.front = swap(day.front);
    day.crime = swap(day.crime);
  }
  for (const q of out.players)
    for (const packet of q.mail)
      if ("text" in packet && typeof packet.text === "string") packet.text = swap(packet.text);
  const election = out.expanded?.life?.election;
  if (election?.mayorName) election.mayorName = swap(election.mayorName);
  out.deeds = out.deeds.map(swap);
}

export type RenameError = "noSuchPlayer" | "nameLength" | "nameTaken" | "parlorLength";

/**
 * A moderator's rename of `playerId`'s name and/or parlor. Checks the
 * lengths of new-player creation and that the name is not another active
 * player's; no fee and no announcement. The old name and parlor are replaced
 * in stored text too (the paper, queued mail, the mayor's name), where they
 * stand as whole words, so a takedown later still finds the player's text.
 */
export function renamePlayer(
  town: TownState,
  playerId: number,
  ctx: EngineContext,
  change: { name?: string; parlor?: string },
): { town: TownState; error?: RenameError } {
  const player = town.players[playerId];
  if (!player) return { town, error: "noSuchPlayer" };
  const np = ctx.rules.newPlayer;
  const name = change.name?.trim();
  const parlor = change.parlor?.trim();
  if (name !== undefined) {
    if (name.length < np.nameMin || name.length > np.nameMax) return { town, error: "nameLength" };
    const used = findPlayerByName(town, name);
    if (used !== -1 && used !== playerId) return { town, error: "nameTaken" };
  }
  if (parlor !== undefined && (parlor.length < np.parlorMin || parlor.length > np.parlorMax))
    return { town, error: "parlorLength" };
  const out = JSON.parse(JSON.stringify(town)) as TownState;
  const p = out.players[playerId] as PlayerState;
  const swaps: [string, string][] = [];
  if (name !== undefined && name !== p.name) swaps.push([p.name, name]);
  if (parlor !== undefined && parlor !== p.parlor) swaps.push([p.parlor, parlor]);
  if (name !== undefined) p.name = name;
  if (parlor !== undefined) p.parlor = parlor;
  swapStoredText(out, swaps);
  return { town: out };
}

// ---------------------------------------------------------------- single items

/** One stored piece of player text a moderator can take down on its own. */
export interface StoredText {
  /** 0-based position among the listed items (on that page, or in that player's mail). */
  index: number;
  /** FNV-1a (32 bit, hex) of the stored text exactly as it stands: stable while it stays put. */
  hash: string;
  /** Who wrote it: the name in the announcement header or crime entry, or the letter's sender id. */
  author: string | number | null;
  /** The stored text (legacy markup). */
  text: string;
}

/** FNV-1a, 32 bit, as 8 hex digits: a content hash without a crypto dependency (core is pure). */
export function textHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

interface PageItem extends StoredText {
  start: number;
  end: number;
  /** What the item becomes when removed ("" for an announcement). */
  replacement: string;
}

function pageItems(page: string, ctx: EngineContext, section: "front" | "crime"): PageItem[] {
  const social = ctx.content.text.social;
  const found: Omit<PageItem, "index">[] = [];
  if (section === "front") {
    // A name or parlor never spans a line, so a capture cannot reach back to an earlier story.
    const header = templateRegex(social.news.announcementHeader, {}, "([^\\r\\n]*?)");
    const re = new RegExp(`${header.re.source}[\\s\\S]*?\\r\\n\\r\\n`, "g");
    for (const m of page.matchAll(re)) {
      const vars = groups(m, header.keys);
      found.push({
        start: m.index ?? 0,
        end: (m.index ?? 0) + m[0].length,
        hash: textHash(m[0]),
        author: vars.name ?? null,
        text: m[0],
        replacement: "",
      });
    }
  } else {
    for (const [quoted, plain, who] of [
      [social.battle.crimeWinQuote, social.battle.crimeWin, "winner"],
      [social.battle.crimeLostQuote, social.battle.crimeLost, "loser"],
    ] as const) {
      const { re, keys } = templateRegex(quoted, {}, "([^\\r\\n]*?)");
      for (const m of page.matchAll(re)) {
        const vars = groups(m, keys);
        found.push({
          start: m.index ?? 0,
          end: (m.index ?? 0) + m[0].length,
          hash: textHash(m[0]),
          author: vars[who] ?? null,
          text: m[0],
          replacement: fill(plain, vars),
        });
      }
    }
  }
  return found.sort((a, b) => a.start - b.start).map((f, index) => ({ ...f, index }));
}

/**
 * The player-written items on one stored page: announcements on the front
 * page, battle quotes on the crime page (a crime entry's quote is the
 * loser's or winner's own words). For a moderator's list; read only.
 */
export function listAnnouncements(
  town: TownState,
  ctx: EngineContext,
  day: number,
  section: "front" | "crime" = "front",
): StoredText[] {
  const page = town.news[String(day)]?.[section] ?? "";
  return pageItems(page, ctx, section).map(({ index, hash, author, text }) => ({
    index,
    hash,
    author,
    text,
  }));
}

/**
 * Takes one announcement off a stored front page (header and body), or one
 * battle quote off a crime page (the entry keeps the fight and loses the
 * quote), by its `index` on that page or its `hash` (`listAnnouncements`).
 * With both, both must match. `removed` is false when nothing matched.
 */
export function removeAnnouncement(
  town: TownState,
  ctx: EngineContext,
  ref: { day: number; section?: "front" | "crime"; index?: number; hash?: string },
): { town: TownState; removed: boolean } {
  const section = ref.section ?? "front";
  const stored = town.news[String(ref.day)];
  if (!stored || (ref.index === undefined && ref.hash === undefined))
    return { town, removed: false };
  const item = pageItems(stored[section], ctx, section).find(
    (i) =>
      (ref.index === undefined || i.index === ref.index) &&
      (ref.hash === undefined || i.hash === ref.hash),
  );
  if (!item) return { town, removed: false };
  const out = JSON.parse(JSON.stringify(town)) as TownState;
  const day = out.news[String(ref.day)] as NewsDay;
  day[section] =
    day[section].slice(0, item.start) + item.replacement + day[section].slice(item.end);
  return { town: out, removed: true };
}

interface LetterAt extends StoredText {
  /** Index of the letter's first packet in the mail queue, and how many packets it has. */
  at: number;
  packets: number;
}

function lettersIn(mail: readonly MailPacket[]): LetterAt[] {
  const out: LetterAt[] = [];
  mail.forEach((packet, i) => {
    if (packet.type !== "buttons") return;
    const reply = packet.buttons.find((b) => b.id.startsWith("mailbox:reply:"));
    if (!reply) return;
    // A letter is its text, its quote, then these buttons (classic/mail.ts sendLetter).
    let at = i;
    if (mail[at - 1]?.type === "quote") at--;
    const text = mail[at - 1];
    if (text?.type === "text") at--;
    const body = text?.type === "text" ? text.text : "";
    out.push({
      index: out.length,
      hash: textHash(body),
      author: Number(reply.id.slice("mailbox:reply:".length)),
      text: body,
      at,
      packets: i - at + 1,
    });
  });
  return out;
}

/** The letters waiting in player `to`'s mail, oldest first. Read only. */
export function listQueuedLetters(town: TownState, to: number): StoredText[] {
  return lettersIn(town.players[to]?.mail ?? []).map(({ index, hash, author, text }) => ({
    index,
    hash,
    author,
    text,
  }));
}

/**
 * Removes one letter still queued in player `to`'s mail (its text, quote and
 * Reply packets), by `index` among the waiting letters or by the `hash` of its
 * text (`listQueuedLetters`). With both, both must match.
 */
export function removeLetter(
  town: TownState,
  ref: { to: number; index?: number; hash?: string },
): { town: TownState; removed: boolean } {
  const player = town.players[ref.to];
  if (!player || (ref.index === undefined && ref.hash === undefined))
    return { town, removed: false };
  const letter = lettersIn(player.mail).find(
    (l) =>
      (ref.index === undefined || l.index === ref.index) &&
      (ref.hash === undefined || l.hash === ref.hash),
  );
  if (!letter) return { town, removed: false };
  const out = JSON.parse(JSON.stringify(town)) as TownState;
  (out.players[ref.to] as PlayerState).mail.splice(letter.at, letter.packets);
  return { town: out, removed: true };
}
