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
      source += ANY;
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
 * Chat is never stored. Expanded chain names are not touched (rename the
 * chain's founder or report it to the host).
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
  return { town: out, removed };
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
  const swap = (text: string): string => {
    let t = text;
    for (const [from, to] of swaps) {
      if (from === "") continue;
      // Whole words; a colour code (a backtick and one character) counts as a boundary.
      const re = new RegExp(`(?<=^|[^A-Za-z0-9]|\`.)${escapeRegExp(from)}(?![A-Za-z0-9])`, "g");
      t = t.replace(re, to);
    }
    return t;
  };
  if (swaps.length > 0) {
    for (const day of Object.values(out.news) as NewsDay[]) {
      day.front = swap(day.front);
      day.crime = swap(day.crime);
    }
    for (const q of out.players)
      for (const packet of q.mail)
        if ("text" in packet && typeof packet.text === "string") packet.text = swap(packet.text);
    const election = out.expanded?.life?.election;
    if (election?.mayorName) election.mayorName = swap(election.mayorName);
  }
  return { town: out };
}
