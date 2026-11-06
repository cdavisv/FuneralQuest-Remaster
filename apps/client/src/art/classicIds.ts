import ids from "virtual:fq-classic-ids";

/**
 * The asset ids of the Classic pictures this build carries (`places/bank`, ...), made by
 * vite.config.ts from `assets/classic`. A picture that only another art pack draws (the
 * Expanded places live in the Remastered pack alone) is then not asked of the Classic art first,
 * which would only be a 404 on every screen that shows it.
 */
export const CLASSIC_IDS: ReadonlySet<string> = new Set(ids);

/** False only when this build is sure the Classic art has no such picture. */
export function classicMayHave(id: string, known: ReadonlySet<string> = CLASSIC_IDS): boolean {
  return known.size === 0 || known.has(id) || id.startsWith("ui/");
}
