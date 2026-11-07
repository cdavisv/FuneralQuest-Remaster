import { rmSync } from "node:fs";

/** Removes the bundle this run built for itself (see playwright.config.ts). */
export default function globalTeardown(): void {
  for (const dir of [process.env.FQ_E2E_DIST_TMP, process.env.FQ_E2E_PAGES_TMP]) {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
}
