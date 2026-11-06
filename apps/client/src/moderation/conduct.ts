import type { Block } from "../shell/pages.js";

/**
 * The house rules for online play and the notice that asks for them to be accepted.
 *
 * DRAFT FOR THE OWNER. The wording is a proposal in the game's voice; the owner decides the final
 * text, the minimum age and the contact address. Change `CONDUCT_VERSION` whenever the text
 * changes in a way players must agree to again: everyone is asked once more.
 */
export const CONDUCT_VERSION = 1;
export const CONDUCT_KEY = "fq.conduct";

/** The age the owner will set. Shown as a marked blank until then. */
export const MINIMUM_AGE_BLANK = "[MINIMUM AGE - OWNER TO FILL IN]";
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

/** The short notice the player agrees to: what the game is like, and how to behave in it. */
export const GATE_POINTS: { lead: string; text: string }[] = [
  {
    lead: "It is a comedy about death.",
    text: "Expect corpses, crude jokes, rude customers, cartoon violence and pretend gambling with pretend money. It is meant for grown-ups.",
  },
  {
    lead: "Other people are in the room.",
    text: "In the cafe, in letters and in the newspaper, be decent. No harassment or bullying, no hate, no sexual content, no threats, no spam, no cheating, and keep real names, addresses and contact details to yourself.",
  },
  {
    lead: "We are watching the door.",
    text: "Report anything nasty and block whoever sent it. Moderators read the reports and can mute, rename or ban players.",
  },
  {
    lead: "Age.",
    text: `You must be at least ${MINIMUM_AGE_BLANK} years old to play online.`,
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
    text: "Funeral Quest is a dark comedy for adults. Online, you share it with real people. These rules are draft wording for the owner to confirm.",
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
      `You must be at least ${MINIMUM_AGE_BLANK} years old to play online.`,
    ],
  },
  { kind: "h", text: "Reports, blocks and moderators" },
  {
    kind: "p",
    text: "Use Report next to a cafe line, a letter, a rankings entry or a newspaper announcement. The moderators see the text and the lines around it; the player is not told who reported them. Use Block to stop someone's letters, cafe lines and gifts reaching you. Moderators can warn, remove text, rename, mute, kick or ban, and every action is recorded.",
  },
  { kind: "p", text: contactLine() },
];
