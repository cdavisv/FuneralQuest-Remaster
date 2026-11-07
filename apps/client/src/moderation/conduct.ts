import type { Block } from "../shell/pages.js";

/**
 * The first-run notice for online play: the game's rating, the short conduct rules, and one
 * required tick box, "I am 18 or older and accept these rules" (owner's decision 8, 2026-11-06).
 * It is a rating and a self-declaration, not age verification: no birth date, no identity check,
 * and nothing about age is sent to or stored on the server. The acceptance stays on this device
 * (`localStorage`, `fq.conduct`). Solo play has no gate. Change `CONDUCT_VERSION` whenever the
 * text changes in a way players must agree to again: everyone is asked once more.
 */
export const CONDUCT_VERSION = 2;
export const CONDUCT_KEY = "fq.conduct";

/** The minimum age for online play, as the notice says it. */
export const MINIMUM_AGE = 18;

export const CONTACT_BLANK = "[CONTACT - OWNER TO FILL IN]";

export function conductAccepted(): boolean {
  try {
    return window.localStorage.getItem(CONDUCT_KEY) === String(CONDUCT_VERSION);
  } catch {
    return false;
  }
}

export function acceptConduct(): void {
  try {
    window.localStorage.setItem(CONDUCT_KEY, String(CONDUCT_VERSION));
  } catch {
    // Private mode: the notice simply comes back next time.
  }
}

/** The short notice the player agrees to: what the game is rated, and how to behave online. */
export const GATE_POINTS: { lead: string; text: string }[] = [
  {
    lead: `Rated ${MINIMUM_AGE}+, for adults.`,
    text: "Funeral Quest is a dark comedy about death, with mature humour: corpses, crude jokes, rude customers, cartoon violence and pretend gambling with pretend money.",
  },
  {
    lead: "Be decent to the people you play with.",
    text: "In the cafe, in letters, in the newspaper and in names: no harassment or bullying, no hate, no sexual content, no threats, no spam, no cheating. Keep real names, addresses and contact details to yourself.",
  },
  {
    lead: "Something wrong?",
    text: "Report the player and block them. Moderators read the reports and can mute, rename or ban players.",
  },
];

let contact = CONTACT_BLANK;

/** The operator's address, from the server's feature list; shown on the rules page. */
export function setConductContact(email: string | null | undefined): void {
  contact = email && email !== "" ? email : CONTACT_BLANK;
  const last = CONDUCT_BLOCKS[CONDUCT_BLOCKS.length - 1];
  if (last && last.kind === "p") last.text = contactLine();
}

const contactLine = () =>
  `To reach the moderators, or to ask for your data to be deleted: ${contact}.`;

/** The conduct section of the Rules page. */
export const CONDUCT_BLOCKS: Block[] = [
  { kind: "h", text: "House rules for online play" },
  {
    kind: "p",
    text: "Funeral Quest is a dark comedy for adults, with mature humour. Online, you share it with real people.",
  },
  {
    kind: "ul",
    items: [
      "Be decent in chat, letters, announcements, fortunes, battle quotes and names.",
      "No harassment, bullying or threats.",
      "No hate speech about who people are.",
      "No sexual content.",
      "No spam, and no cheating.",
      "Do not share personal information, yours or anyone else's.",
      `Online play is rated ${MINIMUM_AGE}+ and is for people aged ${MINIMUM_AGE} or older. You say so with a tick box the first time; nothing is checked and nothing about your age is stored on the server.`,
    ],
  },
  { kind: "h", text: "Reports, blocks and moderators" },
  {
    kind: "p",
    text: "Use Report next to a cafe line, a letter, a rankings entry or a newspaper announcement. The moderators see the text and the lines around it; the player is not told who reported them. Use Block to stop someone's letters, cafe lines and gifts reaching you. Moderators can warn, remove text, rename, mute, kick or ban, and every action is recorded.",
  },
  { kind: "p", text: contactLine() },
];
