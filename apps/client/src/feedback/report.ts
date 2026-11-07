import type { BuildVersion } from "./version.js";

/**
 * Where a player sends the report: GitHub Issues (docs/DECISIONS.md, decision 22). The address is
 * `VITE_FEEDBACK_DESTINATION` at build time (the release workflow reads the repository variable
 * FQ_FEEDBACK_DESTINATION); a build made without it shows this marked blank instead.
 */
export const FEEDBACK_BLANK = "[FEEDBACK DESTINATION - OWNER TO FILL IN]";

export function feedbackDestination(): string {
  const set = (import.meta.env.VITE_FEEDBACK_DESTINATION ?? "").trim();
  return set === "" ? FEEDBACK_BLANK : set;
}

export interface ReportInput {
  version: BuildVersion;
  /** "classic", "expanded", "not in a game" ... what the screen shows, see `detectRuleset`. */
  ruleset: string;
  /** The title of the screen on show (the page title). */
  screen: string;
  soloOnly: boolean;
  /** The free text the player typed. */
  note: string;
  /** Browser session details; left out of a solo-only build. */
  browser?: { userAgent: string; viewport: string; language: string; app: string } | undefined;
}

/** The report as plain text, the thing the player copies. */
export function buildReport(input: ReportInput): string {
  const lines = [
    "Funeral Quest alpha feedback",
    `Version: ${input.version.version} (${input.version.label})`,
    `Build: ${input.version.build}`,
    `Edition: ${input.soloOnly ? "solo-only" : "online-capable"}`,
    `Ruleset: ${input.ruleset}`,
    `Screen: ${input.screen}`,
  ];
  if (input.browser) {
    lines.push(
      `App: ${input.browser.app}`,
      `Browser: ${input.browser.userAgent}`,
      `Viewport: ${input.browser.viewport}`,
      `Language: ${input.browser.language}`,
    );
  }
  lines.push("", "What happened (and what you expected):", input.note.trim() || "");
  return lines.join("\n");
}

/**
 * The ruleset of the game on show, read off the screen because no one place holds it: the front
 * door's town badge says it, the Expanded desk has its ledger strip, any other game screen is
 * Classic. Best effort, and the report says "(from the screen)" so nobody trusts it blindly.
 */
export function detectRuleset(doc: Document = document): string {
  const badge = doc.querySelector<HTMLElement>("[data-ruleset]")?.dataset.ruleset;
  if (badge) return `${badge} (from the screen)`;
  if (doc.querySelector(".fq-ledger")) return "expanded (from the screen)";
  if (doc.querySelector('[data-scene="door"]')) return "not in a game yet";
  return "classic (from the screen)";
}

export function browserDetails(win: Window = window): NonNullable<ReportInput["browser"]> {
  const host = win.__fqHost?.platform;
  return {
    userAgent: win.navigator.userAgent,
    viewport: `${win.innerWidth}x${win.innerHeight}`,
    language: win.navigator.language,
    app: host ? `wrapper (${host})` : "web page",
  };
}
