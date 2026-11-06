/**
 * Command numbers of the original protocol.
 *
 * What the client sends (`i_command`): legacy/source/commands.h:7-47 and the
 * constants set in welcome.swf frame 8 ("Start"). What the server answers
 * (`i_sent`): commands.h:62-72 and the handlers in welcome.swf.
 */
export const Request = {
  quit: 1,
  waitForCustomer: 2,
  stats: 3,
  main: 4,
  news: 5,
  accept: 6,
  yesterday: 7,
  announcement: 8,
  ranking: 9,
  map: 12,
  yangs: 13,
  getName: 17,
  getNext: 18,
  sendMail: 20,
  reply: 21,
  bar: 22,
  chatStart: 23,
  chatUpdate: 24,
  softSell: 25,
  hardSell: 26,
  sympathy: 27,
  guilt: 29,
  finishSale: 30,
  cityHall: 32,
  church: 34,
  spirit: 36,
  hospital: 37,
  comp: 38,
  bank: 39,
  store: 40,
  front: 41,
  crime: 42,
  options: 43,
  script: 44,
} as const;

/** `i_sent`: what the client should do with the response. */
export const Sent = {
  /** Still waiting (the client sets this to 0 before every request). */
  pending: 0,
  /** Log off: back to the start screen. */
  quit: 1,
  /** Refresh the current m_main screen (picture and text). */
  loadMovie: 2,
  /** Go to the status (stats) screen. */
  stats: 3,
  /** Go to the main desk. */
  main: 4,
  /** Show the newspaper. */
  news: 5,
  /** Show the rankings. */
  ranking: 9,
  /** Create the screen named by `st_object`, replacing the current one. */
  object: 10,
  /** Create the object named by `st_object` on top of the current screen. */
  objectAdd: 14,
  /** The server finished a request the client was waiting on (mail sent). */
  callback: 16,
  /** New lines for the cafe transcript (`st_message`). */
  chatUpdate: 24,
  /** Refresh the current i_generic screen. */
  generic: 33,
  /** Link died: show `g_st_error`. */
  fatal: -1,
} as const;

/** Log-on screen answers (sprites 114 and 113 of welcome.swf). */
export const Logon = {
  /** `checklogon` answered; show the log-on screen. */
  welcome: 1,
  /** `logon`: unknown name or password. */
  unknownUser: 2,
  /** `new`: an error on the second page; `g_st_error` says which. */
  newPageTwo: 3,
  /** `new`: an error on the first page. */
  newPageOne: 4,
} as const;

/**
 * Commands this bridge hands out for buttons that have no number of their
 * own in the original. 100 + the plaque slot (1 to 5); the table kept per
 * session maps them back, so they only ever mean what the last response said.
 */
export const SLOT_COMMAND_BASE = 100;

/** Sent back by `i_getname` and `i_get_text` when they finish (`i_return_command`). */
export const RETURN_COMMAND = 110;

/** The Abort text `i_get_text` sends (welcome.swf button 487; command_options.cpp:114). */
export const ABORT_TEXT = "12ABORT12";

/**
 * The numbers the client's own controls and the original server's buttons
 * used for engine buttons that mean the same thing. A button with one of
 * these ids is offered under that number, and the client's fixed controls
 * (Wait, Map, News, Stats, Rankings, Exit, the news tabs) already send them.
 */
export const BUTTON_COMMANDS: Readonly<Record<string, number>> = {
  "desk:quit": Request.quit,
  "desk:wait": Request.waitForCustomer,
  "go:stats": Request.stats,
  "go:desk": Request.main,
  "go:news": Request.news,
  "news:today": Request.news,
  "news:yesterday": Request.yesterday,
  "go:rankings": Request.ranking,
  "go:map": Request.map,
  "news:front": Request.front,
  "news:crime": Request.crime,
  "neg:soft": Request.softSell,
  "neg:hard": Request.hardSell,
  "neg:sympathy": Request.sympathy,
  "neg:guilt": Request.guilt,
  "neg:done": Request.finishSale,
};

/**
 * The map's buildings and the request each sends (welcome.swf buttons
 * 287-335). The church sends `c_request_script` with `st_extra_text` set to
 * "church.c"; the parlor sends `c_request_main`.
 */
export const PLACE_COMMANDS: Readonly<Record<string, number>> = {
  "funeral-home": Request.main,
  bank: Request.bank,
  store: Request.store,
  cafe: Request.chatStart,
  yangs: Request.yangs,
  competitors: Request.comp,
  church: Request.script,
  hospital: Request.hospital,
  "spirit-university": Request.spirit,
};
