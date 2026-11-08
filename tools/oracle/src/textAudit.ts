/**
 * Static text audit: every string literal the original C++ game logic and the
 * scripts in legacy/dist/script can send to a player, checked verbatim against
 * the port's text (the Classic text tables, the social text, the rules' place
 * text, the script ports and the Classic pack).
 *
 *   pnpm --filter @fq/oracle run text-audit
 *
 * A C literal is split at its printf conversions (%s, %d, %.0f, ...) and each
 * piece must appear, with the same spelling, punctuation, colour codes and
 * spacing, inside one piece of a port string split at its {placeholders}.
 * Adjacent literals are joined first (C string concatenation).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LEGACY_DIST_DIR,
  LEGACY_SOURCE_DIR,
  LEGACY_SOURCES,
  REPO_ROOT,
} from "../scripts/config.js";

export interface AuditHit {
  file: string;
  line: number;
  literal: string;
  /** The pieces of the literal not found in the port. */
  missing: string[];
}

export interface AuditReport {
  checked: number;
  found: number;
  missing: AuditHit[];
}

/** Calls whose string arguments go to the server log or speech, never to a player. */
const LOG_CALLS =
  /\b(LogMsg|log_msg|log_error|LogError|Msg|log_msg_thread_safe|log_msg_not_threadsafe|say|OutputDebugString|add_text|LogMessage|DebugLog)\s*\(\s*$/;

function unescapeC(s: string): string {
  return s.replace(/\\(n|r|t|"|\\|'|x[0-9a-fA-F]{2}|0)/g, (_, e: string) => {
    switch (e[0]) {
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      case "x":
        return String.fromCharCode(Number.parseInt(e.slice(1), 16));
      case "0":
        return "\0";
      default:
        return e;
    }
  });
}

/** String literals of a C-like source, adjacent ones joined, with the text before them. */
function literals(raw: string): { text: string; line: number; before: string }[] {
  // A backslash at the end of a line continues the string (commands_newday.cpp:92-95).
  // `breaks` holds where each removed line break was, in the joined text, so line
  // numbers still count the original lines.
  const breaks: number[] = [];
  let removed = 0;
  const source = raw.replace(/\\\r?\n/g, (match: string, at: number) => {
    breaks.push(at - removed);
    removed += match.length;
    return "";
  });
  const out: { text: string; line: number; before: string }[] = [];
  const re = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|L?"((?:[^"\\\n]|\\.)*)"|'(?:[^'\\\n]|\\.)*'/g;
  let m: RegExpExecArray | null = re.exec(source);
  let pending: { text: string; line: number; before: string; end: number } | null = null;
  while (m) {
    const token = m[0];
    if (token.startsWith("/") || token.startsWith("'")) {
      m = re.exec(source);
      continue;
    }
    const text = unescapeC(m[1] ?? "");
    const between = pending ? source.slice(pending.end, m.index) : "";
    if (pending && /^\s*$/.test(between)) {
      pending.text += text;
      pending.end = m.index + token.length;
    } else {
      if (pending) out.push(pending);
      const at = m.index;
      const line = source.slice(0, at).split("\n").length + breaks.filter((b) => b <= at).length;
      const before = source.slice(Math.max(0, m.index - 120), m.index);
      pending = { text, line, before, end: m.index + token.length };
    }
    m = re.exec(source);
  }
  if (pending) out.push(pending);
  return out;
}

/** Is this literal text a player could read (not a log line, variable name, path or format)? */
function playerFacing(lit: { text: string; before: string }): boolean {
  const t = lit.text;
  if (LOG_CALLS.test(lit.before.replace(/[^\n]*$/, (x) => x))) return false;
  if (/\b(LogMsg|log_error|LogError|Msg|log_msg|say)\s*\([^;)]*$/.test(lit.before)) return false;
  if (/add_var\s*\(\s*[^,]+,\s*$/.test(lit.before)) return false; // variable name
  if (/#\s*include\s*$/.test(lit.before)) return false;
  if (/\b(force_range|fforce_range|lforce_range)\s*\([^;]*$/.test(lit.before)) return false;
  if (
    /\b(compare|CompareNoCase|Find|Replace|GetField|strcmp|stricmp|get_token_\w+|d_get_token_\w+|AddFunction|AddVar|GetVar|FindVarByName|RunScriptFunction|load_and_compile_script|InitScript|CommandScriptRunScript|RunSinglePassScript|fopen|unlink|exist\w*|open_file\w*|load_strings|load_file\w*)\s*\([^;]*$/.test(
      lit.before,
    )
  ) {
    return false;
  }
  if (/\.(txt|swf|dat|c|htm|wav|exe)\b/i.test(t) || /\\\\|flash[\\/]/i.test(t)) return false;
  if (/^[a-z]+_[a-z_0-9]+$/i.test(t)) return false; // identifiers
  const letters = t.replace(/%[-+ #0]*\d*(\.\d+)?[a-zA-Z]|`./g, "").replace(/[^A-Za-z]/g, "");
  return letters.length >= 4;
}

function pieces(text: string): string[] {
  return text
    .split(/%[-+ #0]*\d*(?:\.\d+)?(?:l|h|I64)?[sdifuxXc%]|\$[A-Za-z_0-9]+\$/)
    .map((p) => p.trim())
    .filter((p) => p.replace(/[^A-Za-z]/g, "").length >= 3);
}

/** Every string in the port's text: TS string literals of core's Classic code and the Classic pack. */
function portCorpus(): string[] {
  const strings: string[] = [];
  const collectTs = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "expanded") continue;
        collectTs(full);
      } else if (entry.name.endsWith(".ts")) {
        const src = readFileSync(full, "utf8");
        const re = /"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`|'((?:[^'\\\n]|\\.)*)'/g;
        for (let m = re.exec(src); m; m = re.exec(src)) {
          const raw = m[1] ?? m[2] ?? m[3] ?? "";
          strings.push(unescapeC(raw.replace(/\\`/g, "`").replace(/\$\{[^}]*\}/g, "{x}")));
        }
      }
    }
  };
  collectTs(join(REPO_ROOT, "packages", "core", "src"));
  collectTs(join(REPO_ROOT, "packages", "legacy-compat", "src"));
  const pack = JSON.parse(
    readFileSync(join(REPO_ROOT, "packages", "content", "built", "classic.json"), "utf8"),
  ) as unknown;
  const walk = (v: unknown): void => {
    if (typeof v === "string") strings.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(pack);
  return strings;
}

/** Numbers the original wrote into a literal may be a rules value in the port ({luck}). */
function numbersAsHoles(text: string): string {
  return text.replace(/\{[A-Za-z0-9_]+\}/g, "#").replace(/\d+/g, "#");
}

interface Corpus {
  /** Port strings split at their {placeholders}. */
  fragments: string[];
  /** Port strings with placeholders and numbers both as "#". */
  holed: string[];
  /**
   * Port strings with placeholders, as patterns where a placeholder is any
   * text, with how many letters their fixed text has (a pattern must spell at
   * least most of a piece itself, so "{text}" matches nothing).
   */
  templates: { re: RegExp; letters: number }[];
}

const letterCount = (t: string) => t.replace(/[^A-Za-z]/g, "").length;

function templatePattern(text: string): RegExp {
  const parts = text
    .split(/\{[A-Za-z0-9_]+\}/)
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^\\s*${parts.join("[\\s\\S]*?")}\\s*$`);
}

function check(file: string, source: string, corpus: Corpus, report: AuditReport): void {
  for (const lit of literals(source)) {
    if (!playerFacing(lit)) continue;
    report.checked++;
    const missing = pieces(lit.text).filter(
      (p) =>
        !corpus.fragments.some((c) => c.includes(p)) &&
        !corpus.holed.some((c) => c.includes(numbersAsHoles(p))) &&
        !corpus.templates.some((t) => t.letters >= 0.6 * letterCount(p) && t.re.test(p)),
    );
    if (missing.length === 0) report.found++;
    else report.missing.push({ file, line: lit.line, literal: lit.text, missing });
  }
}

export function auditText(): AuditReport {
  const all = portCorpus();
  const corpus: Corpus = {
    fragments: all.flatMap((x) => x.split(/\{[A-Za-z0-9_]+\}/)),
    holed: all.map(numbersAsHoles),
    templates: all
      .filter((x) => /\{[A-Za-z0-9_]+\}/.test(x))
      .map((x) => ({
        re: templatePattern(x),
        letters: letterCount(x.replace(/\{[A-Za-z0-9_]+\}/g, "")),
      })),
  };
  const report: AuditReport = { checked: 0, found: 0, missing: [] };
  const sources = new Set<string>(LEGACY_SOURCES);
  // funeral.cpp #includes these; they are not in the compile list on their own.
  for (const f of [
    "commands.cpp",
    "new_user.cpp",
    "commands_main.cpp",
    "commands_newday.cpp",
    "commands_news.cpp",
    "commands_rankings.cpp",
  ]) {
    sources.add(f);
  }
  for (const f of sources) {
    if (f.startsWith("shared/") || f === "FakeCStringEx.cpp") continue;
    check(f, readFileSync(join(LEGACY_SOURCE_DIR, f), "latin1"), corpus, report);
  }
  const scriptDir = join(LEGACY_DIST_DIR, "script");
  const scripts = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) scripts(full, `${prefix}${entry.name}/`);
      else if (entry.name.endsWith(".c")) {
        const buf = readFileSync(full);
        const text =
          buf[0] === 0xff && buf[1] === 0xfe
            ? buf.subarray(2).toString("utf16le")
            : buf.toString("latin1");
        check(`script/${prefix}${entry.name}`, text, corpus, report);
      }
    }
  };
  scripts(scriptDir, "");
  return report;
}

/**
 * Original literals the port does not carry, each with the reason. Keyed by
 * file and the line the literal starts on. Anything not listed here and not
 * found in the port fails the audit (test/textAudit.test.ts).
 */
export const NOT_IN_PORT: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    [
      "commands_battle.cpp:128",
      "commands_battle.cpp:182",
      "commands_complicated.cpp:20",
      "commands_complicated.cpp:26",
      "commands_customer.cpp:81",
      "commands_customer_risk.cpp:25",
      "commands_customer_risk.cpp:31",
      "commands_customer_risk.cpp:85",
      "commands_customer_risk.cpp:132",
      "commands_customer_risk.cpp:138",
      "commands.cpp:262",
      "commands_main.cpp:13",
      "new_user.cpp:198",
    ].map((k) => [
      k,
      "send_error_message answers to a request the client never sends in that state (a forged or out-of-turn command); the port refuses the action instead (engine guard)",
    ]),
  ),
  "commands_customer.cpp:101":
    "command_accept (c_request_accept = 6) is dispatched (commands.cpp:121) but no client control sends 6",
  "commands_misc.cpp:19": "color_check(): a colour test string, never called",
  "commands_misc.cpp:78":
    "command_no_business: its only call is commented out (commands_customer.cpp:26-34)",
  "commands_misc.cpp:128":
    "get_karma_string: its only use is commented out (command_script.cpp:342)",
  "command_random.cpp:75": "command_random_event (Opal's visit) is never called",
  "command_random.cpp:76": "command_random_event (Opal's visit) is never called",
  "command_random.cpp:79": "command_random_event (Opal's visit) is never called",
  "command_random.cpp:81": "command_random_event (Opal's visit) is never called",
  "command_script.cpp:82": "a folder name",
  "file_system.cpp:7": "a folder name",
  "file_system.cpp:8": "a folder name",
  "file_system.cpp:32": "system.dat default (the sysop's licence description)",
  "file_system.cpp:35": "system.dat default (the sysop's game name)",
  "funeral.cpp:191":
    "the log-on screen's server banner is one literal with two HTML anchors, which the port draws as RichText links, so the audit cannot find it verbatim; museum mode builds it exactly as funeral.cpp does (packages/legacy-compat/src/banner.ts), and packages/legacy-compat/test/banner.test.ts reads this format string out of the source and compares the banner with it",
  "funeral.cpp:258": "licence not initialised: the remaster has no licence server",
  "funeral.cpp:327": "licence not initialised: the remaster has no licence server",
  "funeral.cpp:337": "licence's players-online limit: the remaster has no licence server",
  "funeral.cpp:347": "licence's account limit: the remaster has no licence server",
  "funeral_file.cpp:46":
    "config.dat default for yesterday's top seller, never shown (b_top_old_exists is false)",
  "funeral_util.cpp:273": "error log line",
  "funeral_util.cpp:302": "error log line",
  "funeral_util.cpp:713": "my_ip() placeholder for a request without an address",
  "maint.cpp:404": "stats.txt log line",
  "rankings.cpp:74": "rankings.htm, the server's web page",
  "rankings.cpp:92": "rankings.htm, the server's web page",
  "rankings.cpp:140":
    "the Look list's female marker as HTML; the port draws it as a pink RichText span",
  "reset_game.cpp:10": "a folder name",
  "commands_news.cpp:208":
    "an announcement link as an HTML anchor; the port keeps the address and draws a RichText link (section 8)",
  ...Object.fromEntries(
    ["130", "134", "180", "186", "187"].map((l) => [
      `security.cpp:${l}`,
      "the one-player-per-IP rule, dropped (docs/classic-rules.md section 9)",
    ]),
  ),
  ...Object.fromEntries(
    ["13", "16", "18", "20", "22", "24", "26", "29", "34", "36", "45", "47", "49", "53"].map(
      (l) => [`server_settings.cpp:${l}`, "server.htm, the server's settings web page"],
    ),
  ),
  ...Object.fromEntries(
    [
      "171",
      "175",
      "176",
      "177",
      "178",
      "179",
      "182",
      "183",
      "185",
      "186",
      "187",
      "188",
      "189",
      "190",
      "191",
      "192",
      "193",
      "194",
    ].map((l) => [
      `shared_util.cpp:${l}`,
      "swear_fix(): a built-in word list that is never called (shared_util.h:13 only)",
    ]),
  ),
};

/** Lines of the port's table that the original does not have, each with the reason. */
export const ADDED_IN_PORT: Readonly<Record<string, string>> = {
  "desk.menu.wait":
    "the desk's menu was drawn by the Flash client; the remaster's own client needs labels",
  "desk.menu.news": "the desk's menu was drawn by the Flash client",
  ...Object.fromEntries(
    [
      "bpTotal",
      "money",
      "wood",
      "silver",
      "gold",
      "bpToday",
      "yangs",
      "visits",
      "hpMax",
      "ride",
    ].map((k) => [`stats.labels.${k}`, "the stats sheet's labels were part of the Flash client"]),
  ),
  "stub.notBuilt": "a place with no module (none in Classic)",
  "places.store.lookNoUpgrade": "fixes.hearseRebuy only (off in originalClassicRules)",
  "places.store.noUpgrade": "fixes.hearseRebuy only (off in originalClassicRules)",
  "social.mail.writeLabel": "the desk's pen was the Flash client's",
  "social.mail.replyPrompt":
    "the remaster client's question on a letter; the bridge leaves it out for the original client",
  "news.winnerBody":
    'composed of "`^" + the literal of maint.cpp:129 + "\\r\\n\\r\\n" (maint.cpp:131)',
  "news.meteorBody": 'composed of "`^" + the literal of maint.cpp:135 (maint.cpp:136)',
};

/** One line of the port's Classic text table that is not in the original's sources. */
export interface AddedHit {
  path: string;
  text: string;
  missing: string[];
}

/**
 * The other direction: every line of the port's Classic text table
 * (`CLASSIC_TEXT`, which holds `social` and `places`) must come from the
 * original: the C++ literals, the scripts, the content files in legacy/dist or
 * the client's own texts (docs/reference/welcome-*.md, decompiled welcome.swf).
 */
export function auditAdded(table: unknown): AddedHit[] {
  const originals: string[] = [];
  const add = (src: string) => {
    for (const lit of literals(src)) originals.push(lit.text);
  };
  for (const f of readdirSync(LEGACY_SOURCE_DIR)) {
    if (/\.(cpp|c|h)$/i.test(f)) add(readFileSync(join(LEGACY_SOURCE_DIR, f), "latin1"));
  }
  const walkScripts = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walkScripts(full);
      else if (entry.name.endsWith(".c")) {
        const buf = readFileSync(full);
        add(
          buf[0] === 0xff && buf[1] === 0xfe
            ? buf.subarray(2).toString("utf16le")
            : buf.toString("latin1"),
        );
      }
    }
  };
  walkScripts(join(LEGACY_DIST_DIR, "script"));
  for (const f of readdirSync(LEGACY_DIST_DIR)) {
    if (f.endsWith(".txt")) originals.push(readFileSync(join(LEGACY_DIST_DIR, f), "latin1"));
  }
  for (const f of ["welcome-texts-and-fonts.md", "welcome-actionscript.md"]) {
    originals.push(readFileSync(join(REPO_ROOT, "docs", "reference", f), "utf8"));
  }
  const holedOriginals = originals.map((o) =>
    o
      .replace(/\{[A-Za-z0-9_]+\}/g, "#")
      .replace(/%[-+ #0]*\d*(?:\.\d+)?(?:l|h|I64)?[sdifuxXc]|\$[A-Za-z_0-9]+\$/g, "#")
      .replace(/\d+/g, "#"),
  );
  const out: AddedHit[] = [];
  const visit = (v: unknown, path: string): void => {
    if (typeof v === "string") {
      // The original often built one screen from several literals (`+=`), so a
      // table line is checked line by line.
      const missing = v
        .split(/\{[A-Za-z0-9_]+\}|(?:\r?\n)+/)
        .map((p) => p.trim())
        .filter((p) => letterCount(p) >= 3)
        .filter(
          (p) =>
            !originals.some((o) => o.includes(p)) &&
            !holedOriginals.some((o) => o.includes(p.replace(/\d+/g, "#"))),
        );
      if (missing.length > 0) out.push({ path, text: v, missing });
    } else if (Array.isArray(v)) {
      for (const [i, x] of v.entries()) visit(x, `${path}[${i}]`);
    } else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) visit(x, path ? `${path}.${k}` : k);
    }
  };
  visit(table, "");
  return out;
}

if (process.argv[1]?.endsWith("textAudit.ts")) {
  const r = auditText();
  for (const hit of r.missing) {
    console.log(`${hit.file}:${hit.line}  ${JSON.stringify(hit.literal)}`);
    for (const p of hit.missing) console.log(`    missing: ${JSON.stringify(p)}`);
  }
  console.log(
    `\n${r.found} of ${r.checked} player-facing literals found verbatim; ${r.missing.length} not.`,
  );
  const { CLASSIC_TEXT } = await import("@fq/core");
  const added = auditAdded(CLASSIC_TEXT);
  for (const a of added) {
    console.log(`ADDED ${a.path}: ${JSON.stringify(a.text)}`);
    for (const p of a.missing) console.log(`    not in the original: ${JSON.stringify(p)}`);
  }
  console.log(
    `\n${added.length} lines of CLASSIC_TEXT have text not found in the original sources.`,
  );
}
