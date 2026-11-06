import type { Action, View } from "@fq/protocol";

/**
 * Plays the Expanded game through its Views only, over any endpoint that takes an `Action`
 * (a town's `/action` or the Daily Challenge's). The policy is deliberately simple: haggle once
 * with a Soft Sell card and press Done.
 */
export interface Reply {
  status: number;
  body: { view?: View; result?: unknown; error?: string; message?: string };
}
export type Send = (action: Action) => Promise<Reply>;

export const enabled = (view: View): string[] =>
  view.buttons.filter((b) => b.enabled !== false).map((b) => b.id);

export async function press(send: Send, buttonId: string): Promise<View> {
  const r = await send({ type: "press", buttonId });
  if (r.status !== 200 || !r.body.view) {
    throw new Error(`press ${buttonId}: ${r.status} ${JSON.stringify(r.body)}`);
  }
  return r.body.view;
}

/** Dismisses an open message overlay, if there is one. */
async function clearOverlay(send: Send, view: View): Promise<View> {
  let v = view;
  for (let i = 0; i < 5 && v.overlay; i++) {
    const o = v.overlay;
    const action: Action =
      o.kind === "message"
        ? { type: "dismiss", overlayId: o.id }
        : o.kind === "confirm"
          ? { type: "confirm", overlayId: o.id, accepted: false }
          : o.kind === "textInput"
            ? { type: "submitText", overlayId: o.id, text: null }
            : { type: "pickPlayer", overlayId: o.id, playerId: null };
    const r = await send(action);
    if (r.status !== 200 || !r.body.view) throw new Error(`overlay: ${JSON.stringify(r.body)}`);
    v = r.body.view;
  }
  return v;
}

/**
 * One step of the sale policy. Returns the next View and the response's `result` (set by the Daily
 * Challenge when the run ends).
 */
export async function saleStep(
  send: Send,
  view: View,
  state: { carded: boolean },
): Promise<{ view: View; result: unknown; desk: boolean }> {
  const v = await clearOverlay(send, view);
  const ids = enabled(v);
  let next: string;
  if (ids.includes("neg:done")) {
    if (!state.carded && ids.includes("neg:soft")) {
      state.carded = true;
      next = "neg:soft";
    } else next = "neg:done";
  } else if (ids.some((id) => id.startsWith("neg:hand:"))) {
    next = ids.find((id) => id.startsWith("neg:hand:")) ?? "neg:back";
  } else if (ids.includes("neg:back")) next = "neg:back";
  else if (ids.includes("prep:start")) next = "prep:start";
  else if (ids.some((id) => id.startsWith("prep:opt:")))
    next = ids.find((id) => id.startsWith("prep:opt:")) ?? "";
  else if (ids.includes("desk:wait")) return { view: v, result: null, desk: true };
  else if (ids.includes("go:desk")) next = "go:desk";
  else if (ids.includes("desk:quit")) next = "desk:quit";
  else next = ids[0] ?? "";
  const r = await send({ type: "press", buttonId: next });
  if (r.status !== 200 || !r.body.view) {
    throw new Error(`press ${next}: ${r.status} ${JSON.stringify(r.body)}`);
  }
  return { view: r.body.view, result: r.body.result ?? null, desk: false };
}

/** From any screen back to the desk, finishing whatever sale is open. */
export async function toDesk(send: Send, view: View): Promise<View> {
  let v = view;
  const state = { carded: true };
  for (let i = 0; i < 60; i++) {
    const out = await saleStep(send, v, state);
    v = out.view;
    if (out.desk) return v;
  }
  throw new Error(`never reached the desk (stuck on ${v.scene}: ${enabled(v).join(", ")})`);
}

/** The guided first day: the tour, then the practice sale. Ends at the desk. */
export async function finishTutorial(send: Send, view: View): Promise<View> {
  let v = await toDeskOrTour(send, view);
  if (enabled(v).includes("go:tutorial")) {
    v = await press(send, "go:tutorial");
    for (let i = 0; i < 12 && !enabled(v).includes("tutorial:start"); i++) {
      v = await press(send, "tutorial:next");
    }
    v = await press(send, "tutorial:start");
  }
  return toDesk(send, v);
}

async function toDeskOrTour(send: Send, view: View): Promise<View> {
  let v = view;
  for (let i = 0; i < 8; i++) {
    const ids = enabled(v);
    if (ids.includes("desk:wait") || ids.includes("go:tutorial")) return v;
    v = await press(send, ids.includes("go:desk") ? "go:desk" : (ids[0] ?? "go:desk"));
  }
  return v;
}

/** One customer, haggled once with a card and closed; ends at the desk. */
export async function sellOne(send: Send): Promise<View> {
  let v = await press(send, "desk:wait");
  const state = { carded: false };
  for (let i = 0; i < 60; i++) {
    const out = await saleStep(send, v, state);
    v = out.view;
    if (out.desk) return v;
  }
  throw new Error("the sale never ended");
}

/** Map, then the place; returns its screen. */
export async function visit(send: Send, view: View, placeId: string): Promise<View> {
  let v = view;
  if (v.scene !== "map") v = await backToMap(send, v);
  const r = await send({ type: "visit", placeId });
  if (r.status !== 200 || !r.body.view)
    throw new Error(`visit ${placeId}: ${JSON.stringify(r.body)}`);
  return r.body.view;
}

export async function backToMap(send: Send, view: View): Promise<View> {
  let v = await clearOverlay(send, view);
  for (let i = 0; i < 6 && v.scene !== "map"; i++) {
    const ids = enabled(v);
    const id =
      ids.find((x) => x === "go:map") ??
      ids.find((x) => x.endsWith(":main") || x.endsWith(":back")) ??
      ids.find((x) => x.startsWith("go:") && x !== "go:desk") ??
      "go:desk";
    v = await clearOverlay(send, await press(send, id));
    if (v.scene === "desk" && ids.includes("go:map") === false) v = await press(send, "go:map");
  }
  return v;
}
