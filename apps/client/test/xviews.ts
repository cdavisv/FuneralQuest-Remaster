import type { View } from "@fq/protocol";
import raw from "./fixtures/expanded-views.json";

/**
 * Real Views from the engine's Expanded ruleset, captured by `pnpm --filter @fq/client capture`
 * (tools/capture-expanded.mts) from the local dev town. Nothing here is written by hand.
 */
export const X = raw as unknown as Record<string, View>;

export function xview(name: string): View {
  const view = X[name];
  if (!view) throw new Error(`no captured view named ${name}`);
  return view;
}

/** A captured View without some fields, as a Classic town or an older server sends it. */
export function without(view: View, ...fields: (keyof View)[]): View {
  const copy: View = { ...view };
  for (const f of fields) delete copy[f];
  return copy;
}
