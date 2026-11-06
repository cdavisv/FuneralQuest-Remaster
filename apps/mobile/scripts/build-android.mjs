#!/usr/bin/env node
/**
 * Builds the Android app: web bundle, `cap sync android`, then Gradle.
 *   node scripts/build-android.mjs debug      -> android/app/build/outputs/apk/debug/app-debug.apk
 *   node scripts/build-android.mjs release    -> an unsigned release APK and an AAB (sign them with your own key)
 * Needs JDK 21 (Capacitor 8) and the Android SDK (platform 36, build-tools 36). It looks at
 * JAVA_HOME and ANDROID_HOME, then at ~/jdks/jdk-21* and ~/Android/Sdk.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, "..");
const kind = process.argv[2] === "release" ? "release" : "debug";
const env = { ...process.env };

if (!env.JAVA_HOME) {
  const dir = join(homedir(), "jdks");
  const jdk = existsSync(dir) ? readdirSync(dir).find((d) => d.startsWith("jdk-21")) : undefined;
  if (jdk) env.JAVA_HOME = join(dir, jdk);
}
if (!env.ANDROID_HOME && !env.ANDROID_SDK_ROOT) {
  const sdk = join(homedir(), "Android", "Sdk");
  if (existsSync(sdk)) env.ANDROID_HOME = sdk;
}
const sdk = env.ANDROID_HOME ?? env.ANDROID_SDK_ROOT;
if (!env.JAVA_HOME || !sdk) {
  console.error(
    "android: need JAVA_HOME (JDK 21) and ANDROID_HOME (Android SDK). See docs/release/BUILDING.md.",
  );
  process.exit(1);
}
env.PATH = `${join(env.JAVA_HOME, "bin")}:${env.PATH}`;
// Gradle reads the SDK from here; the file is not committed (it is machine specific).
writeFileSync(join(app, "android/local.properties"), `sdk.dir=${sdk}\n`);

const run = (cmd, args, cwd = app) => {
  const r = spawnSync(cmd, args, {
    cwd,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run("node", ["scripts/prepare-web.mjs"]);
run("pnpm", ["exec", "cap", "sync", "android"]);
const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const tasks = kind === "release" ? ["assembleRelease", "bundleRelease"] : ["assembleDebug"];
run(gradlew, [...tasks, "--no-daemon"], join(app, "android"));
