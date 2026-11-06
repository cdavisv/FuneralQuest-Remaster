/**
 * The words of the player-safety screens. They live here, in one table, so they can be reviewed
 * (and translated) in one place; the rest of the client keeps its strings in `i18n/messages.ts`.
 * `{name}` style placeholders are filled by `say`.
 */
export const words = {
  // Action menu
  "menu.open": "Report or block",
  "menu.openFor": "Report or block {who}",
  "menu.block": "Block",
  "menu.report": "Report",

  // Report dialog
  "report.title": "Report to the moderators",
  "report.what": "You are reporting:",
  "report.category": "What is wrong with it?",
  "report.category.harassment": "Harassment or bullying",
  "report.category.hate": "Hate",
  "report.category.sexual": "Sexual content",
  "report.category.threats": "Threats",
  "report.category.spam": "Spam",
  "report.category.cheating": "Cheating",
  "report.category.other": "Something else",
  "report.note": "Anything else the moderators should know? (optional)",
  "report.noteCount": "{left} characters left",
  "report.privacy":
    "Moderators read this with the text and the lines around it. The player is never told who reported them.",
  "report.send": "Send report",
  "report.sending": "Sending...",
  "report.cancel": "Cancel",
  "report.thanks": "Thank you. The moderators will look at it.",
  "report.duplicate": "You have already reported this. The moderators have it.",
  "report.blockOffer": "Do you also want to block {name}?",
  "report.blockedToo": "{name} is blocked.",
  "report.close": "Close",
  "report.failed": "The report could not be sent. Please try again in a moment.",

  // Block dialog
  "block.title": "Block {name}?",
  "block.stops": "Blocking {name}:",
  "block.does1": "keeps their letters, cafe lines and gifts from reaching you",
  "block.does2": "takes you off their lists when they pick a rival to write to or send a fortune",
  "block.does3": "is one-way, and they are not told",
  "block.doesNot": "It does not:",
  "block.not1": "stop them visiting or fighting you; that is part of the game",
  "block.not2": "hide announcements in the newspaper, which everyone sees (report those instead)",
  "block.undo": "You can undo it any time under Settings, Blocked players.",
  "block.confirm": "Block",
  "block.cancel": "Cancel",
  "block.doneTitle": "Blocked",
  "block.done": "{name} is blocked. You can undo this in Settings.",
  "block.already": "{name} was already blocked.",
  "block.failed": "That could not be done. Please try again in a moment.",
  "block.close": "Close",

  // Letters, fortunes, announcements
  "letter.report": "Report letter",
  "letter.block": "Block sender",
  "message.report": "Report this message",
  "news.menu": "Report an announcement",
  "news.title": "Announcements on this page",
  "news.lead": "Choose one to block its author or report it to the moderators.",
  "news.from": "{who} of {parlor}",
  "news.close": "Close",

  // Rankings
  "rank.menuFor": "Report or block {name}",
  "rank.reportParlor": "Report parlor name",
  "rank.reportName": "Report name",

  // Settings
  "settings.blocked": "Blocked players",
  "settings.blocked.none": "Nobody is blocked.",
  "settings.blocked.loading": "Loading...",
  "settings.blocked.failed": "The list could not be loaded.",
  "settings.unblock": "Unblock",
  "settings.unblockNamed": "Unblock {name}",
  "settings.blocked.explain":
    "A block stops their letters, cafe lines and gifts reaching you and takes you off their lists. It does not stop visits or fights, and announcements in the newspaper stay visible to everyone. They are not told.",
  "settings.data": "Your data",
  "settings.export": "Download my data",
  "settings.exporting": "Preparing...",
  "settings.exportFailed": "The download could not be made. Please try again.",
  "settings.delete": "Delete my account",

  // Delete account
  "delete.title": "Delete your account?",
  "delete.body":
    "This closes your parlor in every town, takes your name and your letters, announcements and fortunes out of the game, and deletes your account for good. It cannot be undone.",
  "delete.guestBody":
    "This is a guest account. Deleting it closes your parlor and cannot be undone.",
  "delete.password": "Your password",
  "delete.passwordHint": "Type it again to be sure it is you.",
  "delete.wrong": "That password is not right.",
  "delete.locked": "Too many wrong tries. Please wait a little and try again.",
  "delete.failed": "The account could not be deleted. Please try again.",
  "delete.confirm": "Delete for good",
  "delete.working": "Deleting...",
  "delete.cancel": "Keep my account",
  "delete.done": "Your account has been deleted.",

  // Mute
  "muted.banner": "You are muted from {what} until {until}. This is temporary.",
  "muted.close": "Dismiss",

  // Conduct gate
  "gate.title": "Before you open your doors",
  "gate.agree": "I agree. Open the doors",
  "gate.rules": "Read the house rules",
  "gate.back": "Not now",
} as const;

export type WordKey = keyof typeof words;

/** The text for `key`, with `{name}` placeholders filled from `vars`. */
export function say(key: WordKey, vars: Record<string, string | number> = {}): string {
  return words[key].replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}
