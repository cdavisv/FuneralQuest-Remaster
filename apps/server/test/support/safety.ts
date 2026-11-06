import type { View } from "@fq/protocol";
import type { Notice, ServerMessage } from "../../src/wire.js";
import { ADMIN_TOKEN, type Harness, type TestPlayer, toDesk } from "./harness.js";

export const notices = (messages: ServerMessage[]): Notice[] =>
  messages.flatMap((m) => (m.type === "notice" ? [m.notice] : []));

export const chatLines = (messages: ServerMessage[]): string[] =>
  notices(messages).flatMap((n) => (n.kind === "chat" ? [n.text.map((s) => s.text).join("")] : []));

/** Answers whatever prompt is open (declining it) until the screen is free. */
export async function clearOverlays(p: TestPlayer, townId = "main"): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const view = await viewOf(p, townId);
    const o = view.overlay;
    if (!o) return;
    await p.act(
      o.kind === "confirm"
        ? { type: "confirm", overlayId: o.id, accepted: false }
        : o.kind === "message"
          ? { type: "dismiss", overlayId: o.id }
          : o.kind === "textInput"
            ? { type: "submitText", overlayId: o.id, text: null }
            : { type: "pickPlayer", overlayId: o.id, playerId: null },
      townId,
    );
  }
}

/** Enters (creating the parlor), walks to the map and into the cafe. */
export async function toCafe(p: TestPlayer, townId = "main"): Promise<View> {
  await p.enter(townId);
  await clearOverlays(p, townId);
  await toDesk(p, townId);
  await clearOverlays(p, townId);
  await p.press("go:map", townId);
  const r = await p.act({ type: "visit", placeId: "cafe" }, townId);
  if (r.status !== 200) throw new Error(`cafe: ${JSON.stringify(r.body)}`);
  return r.body.view;
}

/** Writes a letter through the mailbox prompts. Returns the last reply status. */
export async function sendLetter(
  from: TestPlayer,
  toName: string,
  text: string,
  townId = "main",
): Promise<number> {
  // From the cafe (or anywhere) back to the desk.
  await clearOverlays(from, townId);
  await from.act({ type: "press", buttonId: "go:map" }, townId);
  const home = await from.act({ type: "visit", placeId: "funeral-home" }, townId);
  if (!home.body.view?.buttons.some((b) => b.id === "go:mailbox")) await toDesk(from, townId);
  await clearOverlays(from, townId);
  let view = await from.press("go:mailbox", townId);
  let r = await from.act(
    { type: "submitText", overlayId: view.overlay?.id ?? "", text: toName },
    townId,
  );
  view = r.body.view;
  if (view.overlay?.kind === "playerPicker") {
    r = await from.act(
      {
        type: "pickPlayer",
        overlayId: view.overlay.id,
        playerId: view.overlay.players[0]?.id ?? null,
      },
      townId,
    );
    view = r.body.view;
  }
  if (view.overlay?.kind === "confirm") {
    r = await from.act({ type: "confirm", overlayId: view.overlay.id, accepted: true }, townId);
    view = r.body.view;
  }
  if (view.overlay?.kind !== "textInput")
    throw new Error(`no letter pad: ${JSON.stringify(view.overlay)}`);
  r = await from.act({ type: "submitText", overlayId: view.overlay.id, text }, townId);
  return r.status;
}

/** The player's current screen. */
export async function viewOf(p: TestPlayer, townId = "main"): Promise<View> {
  const r = await p.request<{ view: View }>("GET", `/api/towns/${townId}/view`);
  return r.body.view;
}

/** Posts an announcement in the Funeral Times. Returns the status and body of the submit. */
export async function announce(p: TestPlayer, text: string, townId = "main") {
  let view = await viewOf(p, townId);
  if (view.overlay && view.overlay.id !== "news:announcement") {
    await clearOverlays(p, townId);
    view = await viewOf(p, townId);
  }
  if (view.overlay?.id !== "news:announcement") {
    if (view.overlay) throw new Error(`another prompt is open: ${view.overlay.id}`);
    if (view.scene !== "news") {
      if (!view.buttons.some((b) => b.id === "go:news")) {
        await p.act({ type: "press", buttonId: "go:map" }, townId);
        await p.act({ type: "visit", placeId: "funeral-home" }, townId);
        await toDesk(p, townId);
      }
      await p.press("go:news", townId);
    }
    view = await p.press("news:announce", townId);
  }
  return p.act({ type: "submitText", overlayId: view.overlay?.id ?? "", text }, townId);
}

export async function admin<T = Record<string, unknown>>(
  h: Harness,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: T }> {
  const res = await h.inject({
    method,
    url,
    headers: {
      authorization: `Bearer ${ADMIN_TOKEN}`,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
  });
  return { status: res.statusCode, body: (res.body ? JSON.parse(res.body) : undefined) as T };
}
