import type { StepRecord } from "./session.js";

/**
 * What a run exercised in the original, read from the requests it sent and
 * the original's own log lines and responses. Counts only steps that the
 * port matched (the comparison is what is being counted).
 */
export interface Coverage {
  /** Requests by `i_command` (and `i_command_sub` for callbacks), as sent to the original. */
  commands: Record<string, number>;
  /** Game events recognised in the original's log and responses. */
  features: Record<string, number>;
  /** Distinct values the original sent for text slots chosen by state (the rating title). */
  values: Record<string, string[]>;
}

/** Variables whose distinct values are counted: `st_rating` is the ratings.txt line for the rank. */
const VALUE_VARS = ["st_rating"];

/** Original log lines (LogMsg formats in legacy/source) and response text that mark an event. */
const FEATURES: readonly (readonly [string, RegExp])[] = [
  ["sale completed", /earned \d+ BP's off a/],
  ["customer walked out", /loses a customer \(anger\)|lost a .* customer by going over/],
  ["risk declined", /didn't take a risk/],
  ["risk won", /took risk \(\d+ luck\) won/],
  ["risk lost", /took a risk \(\d+ luck\) lost/],
  ["random event", /SPECIAL EVENT/],
  ["Yang's fortune sent", /sent (nice )?Yang's to/],
  ["letter written", /wrote email to/],
  ["top sellers at midnight", /#\d+ is .* with \d+ points\./],
  ["news blurb reward", /Today's random event happening to/],
  ["maintenance", /Running maint\./],
  ["tournament reset", /Resetting game\.\.\./],
  ["new player", /Creating player account/],
  ["log on", /Connection from/],
  ["swear filter", /Swear check worked!/],
  ["police protection", /Police are outside|police protection|protected by the police/i],
  ["crime reported", /assaulted|stole|attacked|broke into|robbed/i],
  ["arson script event", /Running arson event for/],
  ["name change", /NAME CHANGE/],
  ["announcement", /Make Announcement|ANNOUNCEMENT|announcement/],
  ["bank exchange", /I have converted/],
  ["cafe", /saunters in/],
];

/** Names of the requests (commands.h, and each callback's C_* sub-commands). */
export const COMMAND_NAMES: Readonly<Record<string, string>> = {
  new: "new player",
  logon: "log on",
  "1": "quit",
  "2": "wait for customer",
  "3": "stats (script)",
  "4": "desk",
  "5": "paper",
  "7": "yesterday's paper",
  "8": "announcement",
  "9": "rankings",
  "12": "town map",
  "13": "Yang's",
  "17": "name search",
  "20": "send letter",
  "23": "cafe",
  "24": "cafe chat",
  "25": "soft sell",
  "26": "hard sell",
  "27": "sympathy",
  "29": "guilt",
  "30": "done (sale)",
  "31": "risk: take it",
  "11": "risk: decline",
  "36": "Spirit University",
  "37": "hospital",
  "38": "parlors row",
  "39": "bank",
  "40": "Di-Mart",
  "41": "front page",
  "42": "crime page",
  "43": "name change",
  "44": "script (church)",
  "100/1": "university: psych class",
  "100/3": "university: strength class",
  "100/4": "university: PE class",
  "100/5": "university: library",
  "100/7": "university: old papers",
  "100/8": "university: book of deeds",
  "101/1": "hospital: leave room",
  "102/1": "parlors: look",
  "102/2": "parlors: visit",
  "102/5": "parlors: at the door",
  "102/6": "parlors: try door",
  "102/7": "parlors: steal",
  "102/8": "parlors: attack",
  "102/9": "parlors: pick lock",
  "102/10": "parlors: inside",
  "103/1": "battle: run",
  "103/2": "battle: attack",
  "103/3": "battle: quote (won)",
  "103/4": "battle: quote (lost)",
  "105/100": "Di-Mart: hearses",
  "105/101": "Di-Mart: buy hearse",
  "105/102": "Di-Mart: supplies (script)",
  "105/103": "Di-Mart: security (script)",
  "14/1": "Yang's: sparrow",
  "14/2": "Yang's: tiger",
  "14/3": "Yang's: dragon",
  "14/102": "Yang's: send tiger",
  "14/104": "Yang's: send sparrow",
  "14/105": "Yang's: get bitchy",
  "108/1": "name change: new name",
};

export function emptyCoverage(): Coverage {
  return { commands: {}, features: {}, values: {} };
}

export function addCoverage(into: Coverage, records: readonly StepRecord[], upTo: number): void {
  for (const rec of records.slice(0, upTo)) {
    for (const q of rec.original.queries ?? []) {
      const params = new URLSearchParams(q.replace(/^[a-z]+&?/, ""));
      const verb = q.split("&")[0] ?? q;
      let key = verb;
      if (verb === "command") {
        const c = Number(params.get("i_command") ?? "0");
        const sub = params.get("i_command_sub");
        key = sub !== null && (c === 14 || c >= 100) ? `${c}/${sub}` : String(c);
      }
      into.commands[key] = (into.commands[key] ?? 0) + 1;
    }
    for (const vars of rec.original.responses) {
      for (const [k, v] of vars) {
        if (!VALUE_VARS.includes(k)) continue;
        const list = into.values[k] ?? [];
        into.values[k] = list;
        if (!list.includes(v)) list.push(v);
      }
    }
    const text = [
      ...(rec.original.log ?? []),
      ...rec.original.responses.flatMap((v) => v.map(([, x]) => x)),
    ].join("\n");
    for (const [name, re] of FEATURES) {
      if (re.test(text)) into.features[name] = (into.features[name] ?? 0) + 1;
    }
  }
}

export function mergeCoverage(into: Coverage, from: Coverage): void {
  for (const [k, v] of Object.entries(from.commands))
    into.commands[k] = (into.commands[k] ?? 0) + v;
  for (const [k, v] of Object.entries(from.features))
    into.features[k] = (into.features[k] ?? 0) + v;
}
