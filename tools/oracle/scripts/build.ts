/**
 * Builds the oracle: the original server's game logic (legacy/source,
 * unmodified) compiled for Linux against the shim in cpp/shim, plus the
 * harness in cpp/harness. Output: build/fq-oracle.
 *
 *   pnpm --filter @fq/oracle run build
 *
 * Needs g++ with 32-bit support (-m32; on Arch the lib32-gcc-libs package,
 * on Debian g++-multilib). Set ORACLE_ALLOW_64=1 to build 64-bit instead
 * (see docs/classic-fidelity.md for what that puts in doubt).
 */
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { cpus } from "node:os";
import { basename, join, relative } from "node:path";
import {
  BINARY,
  BUILD_DIR,
  CXX_FLAGS,
  DEFINES,
  HARNESS_SOURCES,
  LEGACY_FLAGS,
  LEGACY_SOURCE_DIR,
  LEGACY_SOURCES,
  ORACLE_DIR,
  SHIM_FLAGS,
  SHIM_INCLUDE,
  SHIM_SOURCES,
} from "./config.js";

function fail(message: string): never {
  console.error(`\noracle build: ${message}\n`);
  process.exit(1);
}

function toolchain(): { cxx: string; arch: "32" | "64" } {
  const cxx = process.env.CXX ?? "g++";
  const version = spawnSync(cxx, ["--version"], { encoding: "utf8" });
  if (version.error || version.status !== 0) {
    fail(
      `no C++ compiler found (${cxx}). Install g++ to build the oracle; ` +
        "its tests are skipped without it.",
    );
  }
  mkdirSync(BUILD_DIR, { recursive: true });
  const probe = join(BUILD_DIR, "probe.cpp");
  writeFileSync(
    probe,
    '#include <string>\n#include <cstdio>\nint main(){std::string s("ok");std::printf("%s",s.c_str());return sizeof(long)==4?0:1;}\n',
  );
  const out = join(BUILD_DIR, "probe");
  const m32 = spawnSync(cxx, ["-m32", probe, "-o", out], { encoding: "utf8" });
  if (m32.status === 0) return { cxx, arch: "32" };
  if (process.env.ORACLE_ALLOW_64 === "1") {
    console.warn(
      "oracle build: -m32 is unavailable; building 64-bit because ORACLE_ALLOW_64=1. " +
        "long and pointers are 64-bit: see docs/classic-fidelity.md, residual risks.",
    );
    return { cxx, arch: "64" };
  }
  fail(
    `${cxx} cannot build 32-bit programs (-m32 failed):\n${m32.stderr.trim()}\n\n` +
      "Install the 32-bit C++ runtime (Arch: lib32-gcc-libs; Debian/Ubuntu: g++-multilib), " +
      "or set ORACLE_ALLOW_64=1 to build a 64-bit oracle.",
  );
}

/** Every `#include "x"` spelling used by the original sources. */
function includeSpellings(dirs: string[]): Set<string> {
  const names = new Set<string>();
  for (const dir of dirs) {
    for (const file of readdirSync(dir)) {
      const full = join(dir, file);
      if (!statSync(full).isFile()) continue;
      if (!/\.(c|cpp|h|hpp)$/i.test(file)) continue;
      const text = readFileSync(full, "latin1");
      for (const m of text.matchAll(/#\s*include\s*[<"]([^>"]+)[>"]/g)) {
        names.add(m[1] as string);
      }
    }
  }
  return names;
}

function link(target: string, at: string): void {
  try {
    lstatSync(at);
    return;
  } catch {
    symlinkSync(target, at);
  }
}

/**
 * The original was written on a case-insensitive file system ("stdafx.h" is
 * StdAfx.h). The mirror is a directory of symlinks to the untouched originals
 * under every spelling the sources use.
 */
function buildMirror(): { mirror: string; mirrorShared: string; shimCase: string } {
  const mirror = join(BUILD_DIR, "mirror");
  const mirrorShared = join(mirror, "shared");
  const shimCase = join(BUILD_DIR, "shim-case");
  rmSync(mirror, { recursive: true, force: true });
  rmSync(shimCase, { recursive: true, force: true });
  mkdirSync(mirrorShared, { recursive: true });
  mkdirSync(shimCase, { recursive: true });
  const sharedDir = join(LEGACY_SOURCE_DIR, "shared");
  const pairs: [string, string][] = [
    [LEGACY_SOURCE_DIR, mirror],
    [sharedDir, mirrorShared],
  ];
  for (const [src, dst] of pairs) {
    for (const file of readdirSync(src)) {
      const full = join(src, file);
      if (statSync(full).isFile()) link(full, join(dst, file));
    }
  }
  const spellings = includeSpellings([LEGACY_SOURCE_DIR, sharedDir]);
  const shimHeaders = readdirSync(SHIM_INCLUDE);
  const special = join(ORACLE_DIR, "cpp", "shim", "special");
  for (const name of spellings) {
    if (name.includes("\\")) {
      // A Windows path such as "CFileLib\\CFileLib.h": a file whose name
      // contains the backslash stands in for it (only when the shim has one).
      const base = name.split("\\").pop() as string;
      if (existsSync(join(special, base))) link(join(special, base), join(shimCase, name));
      continue;
    }
    if (name.includes("/")) continue;
    const lower = name.toLowerCase();
    for (const [src, dst] of pairs) {
      const match = readdirSync(src).find((f) => f.toLowerCase() === lower);
      if (match && match !== name) link(join(src, match), join(dst, name));
    }
    if (!name.includes(".")) {
      // Extensionless names are C++ library headers; only <CAssert> needs help.
      if (existsSync(join(special, name))) link(join(special, name), join(shimCase, name));
      continue;
    }
    const shim = shimHeaders.find((f) => f.toLowerCase() === lower);
    if (shim && shim !== name) link(join(SHIM_INCLUDE, shim), join(shimCase, name));
  }
  // CSpeech.h includes "../SharedLib/SAPI/include/sapi.h" (the real one is
  // Microsoft's); speech is stubbed, so a stand-in goes where it is looked for.
  const sapi = join(mirror, "SharedLib", "SAPI", "include");
  mkdirSync(sapi, { recursive: true });
  link(join(special, "sapi.h"), join(sapi, "sapi.h"));
  return { mirror, mirrorShared, shimCase };
}

interface Unit {
  source: string;
  object: string;
}

function needsBuild(unit: Unit): boolean {
  if (!existsSync(unit.object)) return true;
  const depFile = unit.object.replace(/\.o$/, ".d");
  if (!existsSync(depFile)) return true;
  const objTime = statSync(unit.object).mtimeMs;
  const deps = readFileSync(depFile, "utf8")
    .replace(/\\\n/g, " ")
    .split(/\s+/)
    .slice(1)
    .filter((d) => d && !d.endsWith(":"));
  for (const dep of deps) {
    try {
      if (statSync(dep).mtimeMs > objTime) return true;
    } catch {
      return true;
    }
  }
  return false;
}

function run(cmd: string, args: string[]): Promise<{ code: number; output: string }> {
  return new Promise((done) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (d) => {
      output += d;
    });
    child.stderr.on("data", (d) => {
      output += d;
    });
    child.on("close", (code) => done({ code: code ?? 1, output }));
  });
}

async function main(): Promise<void> {
  const { cxx, arch } = toolchain();
  const { mirror, mirrorShared, shimCase } = buildMirror();
  const objDir = join(BUILD_DIR, `obj${arch}`);
  mkdirSync(objDir, { recursive: true });
  // The original's headers are "system" headers for the shim and harness, so
  // their warnings (MSVC-isms accepted by -fpermissive) stay out of the way.
  const include = (legacy: boolean) => [
    `-I${SHIM_INCLUDE}`,
    `-I${shimCase}`,
    legacy ? `-I${mirror}` : `-isystem${mirror}`,
    legacy ? `-I${mirrorShared}` : `-isystem${mirrorShared}`,
  ];
  const archFlags = arch === "32" ? ["-m32", "-msse2", "-mfpmath=sse"] : ["-m64"];
  const units: Unit[] = [
    ...LEGACY_SOURCES.map((s) => ({
      source: s.startsWith("shared/") ? join(mirrorShared, s.slice(7)) : join(mirror, s),
      object: join(objDir, `legacy_${s.replace(/[/\\]/g, "_").replace(/\.\w+$/, ".o")}`),
    })),
    ...SHIM_SOURCES.map((s) => ({
      source: join(ORACLE_DIR, "cpp", "shim", "src", s),
      object: join(objDir, `shim_${s.replace(/\.\w+$/, ".o")}`),
    })),
    ...HARNESS_SOURCES.map((s) => ({
      source: join(ORACLE_DIR, "cpp", "harness", s),
      object: join(objDir, `harness_${s.replace(/\.\w+$/, ".o")}`),
    })),
  ];
  const todo = units.filter(needsBuild);
  const failures: string[] = [];
  let next = 0;
  const workers = Array.from({ length: Math.max(1, cpus().length) }, async () => {
    while (next < todo.length) {
      const unit = todo[next++] as Unit;
      const isLegacy = unit.object.includes("legacy_");
      const args = [
        ...archFlags,
        ...CXX_FLAGS,
        ...(isLegacy ? LEGACY_FLAGS : SHIM_FLAGS),
        ...DEFINES.map((d) => `-D${d}`),
        ...include(isLegacy),
        "-include",
        join(SHIM_INCLUDE, "fq_win32.h"),
        "-MMD",
        "-x",
        "c++",
        "-c",
        unit.source,
        "-o",
        unit.object,
      ];
      const r = await run(cxx, args);
      if (r.code !== 0) {
        failures.push(`${relative(ORACLE_DIR, unit.source)}\n${r.output}`);
      } else if (r.output.trim() && !isLegacy) {
        console.log(r.output.trim());
      }
    }
  });
  await Promise.all(workers);
  if (failures.length > 0) {
    for (const f of failures) console.error(f);
    fail(`${failures.length} of ${todo.length} translation units failed to compile`);
  }
  const linkArgs = [...archFlags, ...units.map((u) => u.object), "-o", BINARY, "-lm"];
  const linked = await run(cxx, linkArgs);
  if (linked.code !== 0) {
    console.error(linked.output);
    fail("link failed");
  }
  writeFileSync(join(BUILD_DIR, "arch.txt"), `${arch}\n`);
  console.log(
    `oracle build: ${basename(BINARY)} (${arch}-bit, ${todo.length} of ${units.length} units compiled)`,
  );
}

await main();
