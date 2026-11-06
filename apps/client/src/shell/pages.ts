/**
 * The static pages the original game shipped (legacy/dist/public/pages/*.htm), as data. The
 * wording follows the originals; what is no longer true of the remaster (the Flash plug-in,
 * browser versions, the Windows server) is dropped or adjusted. Credits come from the
 * repository's CREDITS.md, so the file stays the one place to edit them.
 */
import creditsMarkdown from "../../../../CREDITS.md?raw";
import { CONDUCT_BLOCKS } from "../moderation/conduct.js"; // moderation hook

export type PageId = "intro" | "gameplay" | "rules" | "credits";

export type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "term"; term: string; text: string };

export interface PageData {
  id: PageId;
  title: string;
  /** The golden line under the title. */
  lead?: string;
  blocks: Block[];
}

export const PAGE_IDS: PageId[] = ["intro", "gameplay", "rules", "credits"];

export const isPageId = (value: string): value is PageId => PAGE_IDS.includes(value as PageId);

const INTRO: PageData = {
  id: "intro",
  title: "Introduction",
  lead: "About Funeral Quest",
  blocks: [
    {
      kind: "p",
      text: "Funeral Quest is a simulator to let you experience the world's second oldest profession: the Undertaker. You will face some mighty stiff competition, because your adversaries are some very alive human beings in this cutthroat game of capitalism.",
    },
    { kind: "h", text: "How it works" },
    { kind: "p", text: 'You get a limited number of "turns" per day.' },
    {
      kind: "p",
      text: "Use these turns to sell caskets and earn Bury Points and Casket Receipts. Use these to damage other parlors and upgrade your own parlor to better deal with customers.",
    },
    {
      kind: "p",
      text: "Every day at midnight (server time) everyone's turns are replenished and a new day begins.",
    },
    {
      kind: "p",
      text: "This turn system is great for those that don't have a lot of time to play.",
    },
    { kind: "h", text: "Technical issues" },
    {
      kind: "p",
      text: "Funeral Quest runs in your browser and needs a connection to its server; it cannot be played offline. You can install it from your browser's menu to run it in its own window.",
    },
    {
      kind: "p",
      text: "If the game feels sluggish, check your connection; the game tells you at the top of the screen when it loses touch with the server and reconnects by itself.",
    },
    { kind: "p", text: "Copyright 2001 Robinson Technologies, Inc. All rights reserved." },
  ],
};

const GAMEPLAY: PageData = {
  id: "gameplay",
  title: "Gameplay Tips",
  lead: "The art of the deal",
  blocks: [
    {
      kind: "p",
      text: "The goal of a modern mortician is sizing up your customers to find out how much they can spend.",
    },
    {
      kind: "term",
      term: "Done",
      text: 'Clicking this will finish the sale; you automatically make whatever your "total" is up to.',
    },
    {
      kind: "term",
      term: "Hard Sell",
      text: "This will attempt to sell them about $2,500 more of stuff.",
    },
    {
      kind: "term",
      term: "Soft Sell",
      text: "This will try to sell them something smaller, between $150 and $550. Great for padding the bill to perfectly reach the max amount a customer can pay.",
    },
    {
      kind: "p",
      text: "Simply attempting to sell without knowing your customer is foolish indeed.",
    },
    {
      kind: "p",
      text: 'Luckily you have some special tools of the trade. Used correctly you can both learn your customer\'s monetary "limit" and at the same time lower the customer\'s "resistance" level, also known as "cheapness".',
    },
    {
      kind: "term",
      term: "Guilt",
      text: "Works only on people who are doing the funeral for show, or did not really love or mistreated the departed. If you're lucky you can also learn how much they can spend.",
    },
    {
      kind: "term",
      term: "Sympathy",
      text: "Gives identical results to Guilt but is effective on those who are emotionally having a hard time dealing with the loss.",
    },
    {
      kind: "p",
      text: "Be careful not to upset the customer too much, or to try to sell them more than they can afford, or they will walk and possibly patronize the competition.",
    },
    {
      kind: "p",
      text: "Guilting when you should sympathize, and vice versa, can make customers irate very quickly.",
    },
    { kind: "h", text: "The Undertaker's Tips" },
    {
      kind: "ul",
      items: [
        'If a customer reaches the emotional level of "Pissed" it is probably a good idea to just click Done and finish the sale before they walk out mad.',
        "If another parlor is being particularly bothersome, send them a Cursed Tiger from Yang's. This lowers their luck by 10. You can only send one per day by default, so don't waste it.",
        "Players are deleted automatically if they have 0 total BP or don't play for 15 days.",
        'In battle, "First Attack" goes to the parlor with the most plots (total burials).',
        "Upgrade your psychology skill: it helps you understand your customers better. Higher levels give you new skills such as automatically reducing cheapness, improving mood and even doubling their maximum spending limit.",
        "Additional parlor improvements such as a safe and a heavy padlock may be useful. Go to the Di-Mart store and read about them to learn their effects in the game.",
      ],
    },
    { kind: "p", text: "Copyright 2001 Robinson Technologies, Inc. All rights reserved." },
  ],
};

const RULES: PageData = {
  id: "rules",
  title: "Rules",
  lead: "Even free games have rules.",
  blocks: [
    {
      kind: "ul",
      items: [
        "One account per person.",
        "No abusive or racist language.",
        "No attempting to hack or screw with the server.",
      ],
    },
    { kind: "p", text: "Breaking a rule can get you banned." },
    {
      kind: "p",
      text: "If someone else in your household wants to play too, clear it with the Admin first.",
    },
    {
      kind: "p",
      text: "Rules are subject to change. Games may be canceled or restarted without warning.",
    },
    { kind: "p", text: "Copyright 2001 Robinson Technologies, Inc. All rights reserved." },
  ],
};

/** The original credits page's thanks, kept as written. */
const SPECIAL_THANKS = [
  "Greg Smith",
  "Chen-kuang Su",
  "Dan Walma",
  "Entherion",
  "Tony M Brown",
  "Peep",
  "Tal",
  "Michael Braecklein",
  "Brett",
  "Shaustin",
  "Shawn Teal",
  "MissBehave",
  "Sodi",
  "Grendel",
  "Frobar",
  "Matt Rouse",
  "Garrett Baumgartner",
  "Joe Johnston",
];

/**
 * Turns the small subset of Markdown CREDITS.md uses (`#`, `##`, `- ` and paragraphs) into
 * blocks. Inline backticks are dropped; nothing here is ever interpreted as HTML.
 */
export function parseCredits(markdown: string): Block[] {
  const blocks: Block[] = [];
  let list: string[] | null = null;
  let para: string[] = [];
  const clean = (s: string) => s.replace(/`([^`]*)`/g, "$1").trim();
  const flushPara = () => {
    if (para.length > 0) blocks.push({ kind: "p", text: clean(para.join(" ")) });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push({ kind: "ul", items: list });
    list = null;
  };
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") {
      flushPara();
      flushList();
    } else if (line.startsWith("# ")) {
      // The page has its own title.
      flushPara();
      flushList();
    } else if (line.startsWith("##")) {
      flushPara();
      flushList();
      blocks.push({ kind: "h", text: clean(line.replace(/^#+\s*/, "")) });
    } else if (line.startsWith("- ")) {
      flushPara();
      list = [...(list ?? []), clean(line.slice(2))];
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}

const CREDITS: PageData = {
  id: "credits",
  title: "Credits",
  lead: "Who would make a game called Funeral Quest, anyway?",
  blocks: [
    ...parseCredits(creditsMarkdown),
    { kind: "h", text: "Special thanks" },
    { kind: "p", text: "From the original game, to everyone who helped make it:" },
    { kind: "ul", items: SPECIAL_THANKS },
    {
      kind: "p",
      text: "Some text within may have been written by players and may not be suitable for all ages. Some text, graphics and sounds may have been added or modified by the admin of the game you are playing and are not the property of Robinson Technologies.",
    },
    { kind: "p", text: "Robinson Technologies: www.rtsoft.com" },
  ],
};

// moderation hook: the conduct section of the rules (see moderation/conduct.ts)
RULES.blocks.splice(-1, 0, ...CONDUCT_BLOCKS);

export const PAGES: Record<PageId, PageData> = {
  intro: INTRO,
  gameplay: GAMEPLAY,
  rules: RULES,
  credits: CREDITS,
};
