import type { Action, View } from "@fq/protocol";

/** Plays the Expanded game from its Views only: one Soft Sell card per customer, then Done. */
export type Send = (action: Action) => View;

export const enabled = (view: View): string[] =>
  view.buttons.filter((b) => b.enabled !== false).map((b) => b.id);

export function press(send: Send, buttonId: string): View {
  return send({ type: "press", buttonId });
}

function clearOverlay(send: Send, view: View): View {
  let v = view;
  for (let i = 0; i < 5 && v.overlay; i++) {
    const o = v.overlay;
    v = send(
      o.kind === "message"
        ? { type: "dismiss", overlayId: o.id }
        : o.kind === "confirm"
          ? { type: "confirm", overlayId: o.id, accepted: false }
          : o.kind === "textInput"
            ? { type: "submitText", overlayId: o.id, text: null }
            : { type: "pickPlayer", overlayId: o.id, playerId: null },
    );
  }
  return v;
}

/** One step of the sale policy; `desk` is true when it found the desk with nothing open. */
export function saleStep(
  send: Send,
  view: View,
  state: { carded: boolean },
): { view: View; desk: boolean } {
  const v = clearOverlay(send, view);
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
  else if (ids.includes("desk:wait")) return { view: v, desk: true };
  else if (ids.includes("go:desk")) next = "go:desk";
  else if (ids.includes("desk:quit")) next = "desk:quit";
  else next = ids[0] ?? "";
  return { view: press(send, next), desk: false };
}

export function toDesk(send: Send, view: View): View {
  let v = view;
  const state = { carded: true };
  for (let i = 0; i < 60; i++) {
    const out = saleStep(send, v, state);
    v = out.view;
    if (out.desk) return v;
  }
  throw new Error(`never reached the desk (stuck on ${v.scene}: ${enabled(v).join(", ")})`);
}

/** The paper, the tour (8 pages) and the practice sale. Ends at the desk. */
export function finishTutorial(send: Send, view: View): View {
  let v = view;
  for (
    let i = 0;
    i < 8 && !enabled(v).includes("go:tutorial") && !enabled(v).includes("desk:wait");
    i++
  ) {
    v = press(send, enabled(v).includes("go:desk") ? "go:desk" : (enabled(v)[0] ?? "go:desk"));
  }
  if (enabled(v).includes("go:tutorial")) {
    v = press(send, "go:tutorial");
    for (let i = 0; i < 12 && !enabled(v).includes("tutorial:start"); i++) {
      v = press(send, "tutorial:next");
    }
    v = press(send, "tutorial:start");
  }
  return toDesk(send, v);
}

/** One customer from the desk: wait, haggle with a card, close, back to the desk. */
export function sellOne(send: Send): View {
  let v = press(send, "desk:wait");
  const state = { carded: false };
  for (let i = 0; i < 60; i++) {
    const out = saleStep(send, v, state);
    v = out.view;
    if (out.desk) return v;
  }
  throw new Error("the sale never ended");
}
