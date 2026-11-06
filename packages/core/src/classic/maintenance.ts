import { newsConditionMet } from "../content/newsCondition.js";
import type { EventEntry } from "../content/types.js";
import type { Turn } from "../engine/turn.js";
import { fill, intToCash, replaceAll } from "../text/format.js";
import { computeEvent, type ResolvedEvent, RewardText } from "./events.js";
import { broadcast, mailContinue, mailNewsLog, mailPicture, mailReward, mailText } from "./mail.js";
import { addToNews } from "./news.js";
import {
  isOnline,
  randomPlayerExcluding,
  tournamentEndsToday,
  tournamentEndsTomorrow,
  validPlayerCount,
} from "./players.js";
import { secondPlayer, thirdPlayer, topPlayer, topPlayerOfTheDay } from "./rankings.js";
import { resetGame } from "./tournament.js";

/**
 * `process_highest_seller_of_the_day` (legacy/source/maint.cpp:173-207):
 * remembers the day's top seller for tomorrow's paper and mails them the
 * bonus (not on the last tournament day).
 */
function highestSeller(turn: Turn): void {
  const town = turn.town;
  const s = town.settings;
  const id = topPlayerOfTheDay(town);
  const p = town.players[id];
  if (!p) {
    town.topYesterday = null;
    return;
  }
  town.topYesterday = { name: p.name, parlor: p.parlor, bp: p.bpToday, id };
  if (tournamentEndsTomorrow(town)) return;
  mailText(
    town,
    id,
    fill(turn.text.maintenance.topSeller, {
      luck: intToCash(s.bonusLuck),
      bp: intToCash(s.bonusExp),
    }),
  );
  mailReward(turn, id, "luck", s.bonusLuck);
  mailReward(turn, id, "bp", s.bonusExp);
}

/**
 * `process_highest_parlor_of_the_day` (maint.cpp:210-260): the top three by
 * total BP get 100%, 50% and 25% of the bonus by mail. When nobody has any
 * BP the original also forgets yesterday's top seller (:229-230); kept.
 */
function highestParlors(turn: Turn): void {
  const town = turn.town;
  const s = town.settings;
  const t = turn.text.maintenance;
  const [first, second, third] = turn.rules.topParlorShares;
  const award = (id: number, template: string, share: number) => {
    const luck = Math.trunc(s.bonusLuck * share);
    const bp = Math.trunc(s.bonusExp * share);
    mailText(town, id, fill(template, { luck: intToCash(luck), bp: intToCash(bp) }));
    mailReward(turn, id, "luck", luck);
    mailReward(turn, id, "bp", bp);
  };
  const top = topPlayer(town);
  if (top !== -1) award(top, t.topParlor, first);
  else town.topYesterday = null;
  const two = secondPlayer(town);
  if (two !== -1) award(two, t.secondParlor, second);
  const three = thirdPlayer(town);
  if (three !== -1) award(three, t.thirdParlor, third);
}

/**
 * `do_maint_on_user` (maint.cpp:263-310) for every active player. With the
 * grace-period fix, a player is safe from both deletions for
 * `zeroBpGraceDays` midnights after the account was made (the original
 * deleted a 0-BP player at the first midnight, and an account that never
 * reached the desk once the game was older than the inactivity limit).
 */
function maintainPlayers(turn: Turn): void {
  const town = turn.town;
  const s = town.settings;
  const rules = turn.rules;
  const t = turn.text.maintenance;
  for (const p of town.players) {
    if (!p.active) continue;
    p.bpToday = 0;
    p.yangsSent = 0;
    p.tagsReceivedToday = 0;
    if (tournamentEndsToday(town)) p.yangsSent = s.yangsPerDay;

    const grace = rules.fixes.zeroBpGracePeriod;
    const inGrace = grace && town.day - p.dayCreated <= rules.zeroBpGraceDays;
    const lastSeen = grace ? Math.max(p.dayLastLoggedOn, p.dayCreated) : p.dayLastLoggedOn;
    if (lastSeen + s.inactiveDays < town.day) {
      broadcast(turn, fill(t.closesShop, { name: p.name }));
      p.active = false;
      turn.effects.push({ kind: "playerDeleted", playerId: p.id, reason: "inactive" });
    }
    if (p.dayLastLoggedOn + 1 < town.day) p.policeProtected = false;
    // :294-301: no `else`, so an inactive player with 0 BP is announced twice.
    if (s.maintDelete && !isOnline(town, p.id) && p.bp === 0 && !inGrace) {
      broadcast(turn, fill(t.closesShopNoSale, { name: p.name }));
      if (p.active) turn.effects.push({ kind: "playerDeleted", playerId: p.id, reason: "noSales" });
      p.active = false;
    }
    // :303-308 runs script/maint_player.c for active players; its Main is empty.
  }
}

/**
 * `process_news_mail` (maint.cpp:33-95): a blurb with `give_random` mails a
 * random player a reward that expires tomorrow, and a news line added when
 * the mail is read. Mail order is the original's: Continue, text, rewards,
 * picture, Continue, news line. A turns reward is queued but the mail reader
 * ignores it (broadcast.cpp:75-91).
 */
function newsMail(turn: Turn, event: ResolvedEvent): void {
  if (event.giveRandom === "") return;
  const town = turn.town;
  if (validPlayerCount(town) < 1) return;
  const id = randomPlayerExcluding(turn, -1);
  const p = town.players[id];
  if (!p) return;
  const rng = turn.rng;
  const luck = rng.randomRange(event.modLuck[0], event.modLuck[1]);
  const bp = rng.randomRange(event.modBp[0], event.modBp[1]);
  const turns = rng.randomRange(event.modTurns[0], event.modTurns[1]);
  const w = turn.text.wait.words;
  const reward = new RewardText(turn.text);
  reward.add(bp === 1 ? w.bp : w.bps, bp);
  reward.add(w.luck, luck);
  reward.add(turns === 1 ? w.turn : w.turns, turns);
  const message = replaceAll(event.giveRandom + reward.finish(), "\\n", "\n");
  const expire = town.day + 1;
  mailContinue(turn, id, expire);
  mailText(town, id, message, expire);
  if (luck !== 0) mailReward(turn, id, "luck", luck, expire);
  if (bp !== 0) mailReward(turn, id, "bp", bp, expire);
  if (turns !== 0) mailReward(turn, id, "turns", turns, expire);
  mailPicture(town, id, event.picture, expire);
  mailContinue(turn, id, expire);
  let log = replaceAll(event.addLog, "*NAME*", p.name);
  log = replaceAll(log, "*HOME*", p.parlor);
  log = `${replaceAll(log, "\\n", "\n")}\n\n`;
  mailNewsLog(town, id, log, expire);
}

/**
 * `add_random_news_sayings` (maint.cpp:115-170): the day's blurb from
 * news_blurbs.txt (bracketed by game day), or the tournament winner and the
 * meteor on the day the tournament ends.
 */
function dailyNews(turn: Turn): void {
  const town = turn.town;
  const t = turn.text.news;
  if (tournamentEndsToday(town)) {
    const winner = town.players[topPlayer(town)];
    if (winner) {
      addToNews(town, t.winnerHeadline);
      addToNews(
        town,
        fill(t.winnerBody, {
          bp: intToCash(winner.bp),
          plots: intToCash(winner.plots),
          name: winner.name,
        }),
      );
    }
    addToNews(town, t.meteorHeadline);
    addToNews(town, t.meteorBody);
    if (winner) town.deeds.push(fill(t.deed, { name: winner.name }));
    return;
  }
  // Expanded: a blurb may wait for a story arc's ending or a mayor (expanded-rules.md 22.5).
  // Classic passes no filter, so its draw is exactly the original's.
  const accept = turn.rules.expanded
    ? (e: EventEntry) => newsConditionMet(town, e.when)
    : undefined;
  const event = computeEvent(
    turn.rng,
    turn.content.newsBlurbs,
    town.day,
    { message: turn.text.wait.noMessage, picture: "stuff/money_bag_2" },
    accept,
  );
  addToNews(town, `\`7${event.title}\r\n`);
  addToNews(town, `\`^${event.message}\r\n\r\n`);
  newsMail(turn, event);
}

/**
 * `maint_new_day` (legacy/source/maint.cpp:362-415), run at midnight with the
 * town stream. The midnight after a tournament's final day resets the game
 * (:366-380, classic/tournament.ts); the restart then runs this maintenance
 * at once because the day is 0 (funeral.cpp:98-103), so the town ends on day 1.
 * Always returns true (a day was run).
 */
export function maintNewDay(turn: Turn): boolean {
  const town = turn.town;
  const s = town.settings;
  if (s.tournamentActive && town.day === s.tournamentDays + 1) resetGame(turn);
  highestSeller(turn);
  if (!tournamentEndsTomorrow(town)) highestParlors(turn);
  town.day++;
  maintainPlayers(turn);
  dailyNews(turn);
  // Ruleset hooks (none in Classic; engine/registry.ts `MaintenanceHook`).
  for (const hook of turn.registry.maintenanceHooks) hook(turn);
  town.lastMaintenance = turn.engine.now;
  // :411 runs script/maint.c, whose Main only logs.
  turn.log("Script maint.c processed.");
  return true;
}
