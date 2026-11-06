import type { Button, RichText, TextSpan, View } from "@fq/protocol";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button, goButton, hud, legacy } from "../../engine/view.js";
import { fill } from "../../text/format.js";
import { enterLocation } from "../location.js";
import { addToNews, type NewsSection, newsFor } from "../news.js";
import { tournamentEndsToday } from "../players.js";
import { topPlayer, topPlayerOfTheDay } from "../rankings.js";
import { filterUserText, stripControl } from "../userText.js";

/**
 * The Funeral Times (legacy/source/commands_news.cpp): the front page and the
 * Crime section of today's or yesterday's paper, the tournament countdown,
 * the top-seller panels, and Make Announcement. The day shown is the scene
 * data, as the original kept it in `i_location_callback`.
 */
export const NEWS = "news";

/** Marks a link in stored news markup: U+0001 url U+0002 (typed text never contains them). */
const LINK_START = "\u0001";
const LINK_END = "\u0002";

/**
 * Where an announcement link points, or null when it is not a safe web
 * address. The original always prefixed "http://" (commands_news.cpp:208); a
 * typed "http://" or "https://" is kept, and anything else that does not
 * parse as an http or https URL is shown as plain text.
 */
export function linkHref(text: string): string | null {
  if (/\s/.test(text) || text === "") return null;
  const candidate = /^https?:\/\//i.test(text) ? text : `http://${text}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username !== "" || url.password !== "") return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Legacy markup with announcement links into RichText. The link text is pink
 * (`#), and the text after it continues in brown (`6), as the original's
 * `<a ...>`#url`6</a>` did.
 */
export function newsRichText(markup: string): RichText {
  const out: TextSpan[] = [];
  let rest = markup;
  let prefix = "";
  for (;;) {
    const start = rest.indexOf(LINK_START);
    const end = start === -1 ? -1 : rest.indexOf(LINK_END, start);
    if (start === -1 || end === -1) break;
    out.push(...legacy(prefix + rest.slice(0, start)));
    const text = rest.slice(start + 1, end);
    const href = linkHref(text);
    out.push(href ? { text, color: "pink", href } : { text, color: "pink" });
    rest = rest.slice(end + 1);
    prefix = "`6";
  }
  out.push(...legacy(prefix + rest));
  return out.filter((s) => s.text !== "");
}

function shownDay(turn: Turn): number {
  const d = turn.session.sceneData;
  return typeof d === "number" ? d : turn.town.day;
}

/** The tournament lines at the top of the front page (commands_news.cpp:24-53), from the current day. */
function countdown(turn: Turn): string {
  const town = turn.town;
  const settings = town.settings;
  const t = turn.text.news;
  if (!settings.tournamentActive || !(town.day + 5 > settings.tournamentDays)) return "";
  if (town.day === settings.tournamentDays) return t.finalDay;
  if (tournamentEndsToday(town)) return "";
  return town.day === settings.tournamentDays - 1
    ? t.lastDayTomorrow
    : fill(t.daysLeft, { days: settings.tournamentDays - town.day });
}

/** The two top-seller panels (commands_news.cpp:73-106). */
function topPanels(turn: Turn): { topToday: string; topYesterday: string } {
  const town = turn.town;
  const t = turn.text.news;
  const top = town.players[topPlayerOfTheDay(town)];
  let topToday = top
    ? fill(t.topToday, { name: top.name, parlor: top.parlor, bp: top.bpToday })
    : t.noTopToday;
  const y = town.topYesterday;
  const topYesterday = y
    ? fill(t.topYesterday, { name: y.name, parlor: y.parlor, bp: y.bp })
    : t.noTopYesterday;
  if (tournamentEndsToday(town)) {
    const winner = town.players[topPlayer(town)];
    if (winner) topToday = fill(t.universeTop, { name: winner.name });
  }
  return { topToday, topYesterday };
}

function newsButtons(turn: Turn, day: number, section: NewsSection): Button[] {
  const b = turn.text.social.news.buttons;
  const buttons: Button[] = [];
  buttons.push(
    section === "front" ? button(`${NEWS}:crime`, b.crime) : button(`${NEWS}:front`, b.front),
  );
  // The paper offers yesterday's edition on today's, and today's on yesterday's (welcome.swf, i_yesterday).
  buttons.push(
    day === turn.town.day
      ? button(`${NEWS}:yesterday`, b.yesterday)
      : button(`${NEWS}:today`, b.today),
  );
  buttons.push(button(`${NEWS}:announce`, b.announce));
  buttons.push(goButton("desk", b.continue));
  return buttons;
}

function paper(turn: Turn, day: number, section: NewsSection, body: string): View {
  const panels = topPanels(turn);
  return {
    scene: "news",
    title: "News",
    text: [],
    hud: hud(turn.player),
    news: {
      day,
      section,
      isYesterday: day !== turn.town.day,
      body: newsRichText(body),
      topToday: legacy(panels.topToday),
      topYesterday: legacy(panels.topYesterday),
    },
    buttons: newsButtons(turn, day, section),
  };
}

/** `command_news_front` (commands_news.cpp:11-122) for `day`. */
export function frontPage(turn: Turn, day: number): View {
  const stored = newsFor(turn.town, day);
  const body =
    countdown(turn) + (stored && stored.front !== "" ? stored.front : turn.text.news.nothingToday);
  return paper(turn, day, "front", body);
}

/** `command_news_crime` (commands_news.cpp:124-161). */
export function crimePage(turn: Turn, day: number): View {
  const stored = newsFor(turn.town, day);
  const body = stored && stored.crime !== "" ? stored.crime : turn.text.social.news.noCrime;
  return paper(turn, day, "crime", body);
}

/** `command_news` (commands_news.cpp:4-10): today's paper. */
export function enterNews(turn: Turn): View {
  enterLocation(turn, "News", turn.town.day);
  turn.session.scene = NEWS;
  return frontPage(turn, turn.town.day);
}

/** `command_yesterday_news` (commands_news.cpp:163-170). */
function yesterday(turn: Turn): View {
  enterLocation(turn, "News", turn.town.day - 1);
  return frontPage(turn, turn.town.day - 1);
}

/**
 * `command_announcement` (commands_news.cpp:172-238). SWEAR-FILTER CALL SITE:
 * the text goes through `swear_check` first, then every backtick is removed
 * (no colour codes in public text), then each `[address]` becomes a link,
 * and it is added to today's front page under a header line.
 */
export function announcementMarkup(turn: Turn, typed: string): string {
  let text = filterUserText(turn, stripControl(typed), "announcement");
  text = text.split("`").join("");
  let out = "";
  for (;;) {
    const start = text.indexOf("[");
    const end = start === -1 ? -1 : text.indexOf("]", start);
    if (start === -1 || end === -1) break;
    // Brackets inside the link are dropped (:211-212), so links never nest.
    const url = text
      .slice(start + 1, end)
      .split("[")
      .join("");
    out += text.slice(0, start) + LINK_START + url + LINK_END;
    text = text.slice(end + 1);
  }
  return out + text;
}

function announce(turn: Turn, typed: string): View {
  const p = turn.player;
  const header = fill(turn.text.social.news.announcementHeader, { name: p.name, parlor: p.parlor });
  addToNews(turn.town, header);
  addToNews(turn.town, `${announcementMarkup(turn, typed)}\r\n\r\n`);
  // The original also read it aloud with text-to-speech (:218-227); not ported.
  return enterNews(turn);
}

export const newsModule: LocationModule = {
  id: NEWS,
  enter: (turn) => enterNews(turn),
  press(turn, command) {
    const day = shownDay(turn);
    switch (command) {
      case "front":
        return frontPage(turn, day);
      case "crime":
        return crimePage(turn, day);
      case "yesterday":
        return yesterday(turn);
      case "today":
        return enterNews(turn);
      case "announce": {
        const view = turn.session.view;
        if (!view) throw new Error("No paper on screen");
        return {
          ...view,
          overlay: {
            kind: "textInput",
            id: `${NEWS}:announcement`,
            prompt: turn.text.social.news.announcePrompt,
            maxLength: turn.rules.textLimits.announcement,
            multiline: true,
          },
        };
      }
    }
    throw new Error(`Unknown news command ${command}`);
  },
  submitText(turn, overlayId, text) {
    if (overlayId !== `${NEWS}:announcement`) throw new Error(`Unknown overlay ${overlayId}`);
    // The notepad's close button hides it without posting (welcome.swf button 246).
    if (text === null) {
      const { overlay: _closed, ...view } = turn.session.view ?? frontPage(turn, shownDay(turn));
      return view;
    }
    return announce(turn, text);
  },
};
