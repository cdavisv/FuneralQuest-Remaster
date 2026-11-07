/**
 * What this build is. The version is the root package.json's (`__FQ_VERSION__`, "0.1.0-alpha.1")
 * and the build is the short commit it was made from (`__FQ_BUILD__`, or "dev"); both are filled
 * in by vite.config.ts, from the same source the server, desktop and mobile builds read
 * (scripts/version.mjs).
 */
export interface BuildVersion {
  /** The full semver: "0.1.0-alpha.1". */
  version: string;
  /** What a player is shown: "Alpha 0.1.0". */
  label: string;
  /** The short commit hash, or "dev". */
  build: string;
}

/** "0.1.0-alpha.1" becomes "Alpha 0.1.0"; "1.2.3" stays "1.2.3". */
export function versionLabel(version: string): string {
  const m = /^(\d+\.\d+\.\d+)-([0-9A-Za-z]+)/.exec(version);
  if (!m?.[1] || !m[2]) return version;
  return `${m[2][0]?.toUpperCase()}${m[2].slice(1)} ${m[1]}`;
}

export function buildVersion(): BuildVersion {
  const version = typeof __FQ_VERSION__ === "string" ? __FQ_VERSION__ : "0.0.0";
  const build = typeof __FQ_BUILD__ === "string" ? __FQ_BUILD__ : "dev";
  return { version, label: versionLabel(version), build };
}

/** "Alpha 0.1.0 (build abc1234)" */
export function versionText(v: BuildVersion = buildVersion()): string {
  return `${v.label} (build ${v.build})`;
}
