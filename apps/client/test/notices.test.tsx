import type { View } from "@fq/protocol";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FIXTURES } from "../src/mock/fixtures.js";
import {
  initialNotices,
  MAX_TOASTS,
  type NoticeEvent,
  type NoticeState,
  noticeReducer,
} from "../src/state/notices.js";
import { LiveScriptedTransport, renderGame, viewWith } from "./helpers.js";

const run = (events: NoticeEvent[], from: NoticeState = initialNotices) =>
  events.reduce(noticeReducer, from);
const text = (s: string) => [{ text: s }];

describe("notice state", () => {
  it("turns broadcasts and sysop messages into toasts, newest last, capped", () => {
    let state = run([
      { type: "notice", scene: "desk", notice: { kind: "broadcast", text: text("a") } },
    ]);
    expect(state.toasts.map((t) => t.kind)).toEqual(["broadcast"]);
    for (let i = 0; i < MAX_TOASTS + 3; i++) {
      state = run(
        [{ type: "notice", scene: "desk", notice: { kind: "server", text: text(`m${i}`) } }],
        state,
      );
    }
    expect(state.toasts).toHaveLength(MAX_TOASTS);
    expect(state.toasts.at(-1)?.text).toEqual(text(`m${MAX_TOASTS + 2}`));
  });

  it("shows TV lines as toasts only away from the cafe, where they are already in the transcript", () => {
    const notice = { kind: "tv", text: text("Breaking news") } as const;
    expect(run([{ type: "notice", scene: "desk", notice }]).toasts).toHaveLength(1);
    expect(run([{ type: "notice", scene: "cafe", notice }]).toasts).toHaveLength(0);
  });

  it("ignores chat (the cafe transcript gets it as a View) and empty texts", () => {
    expect(
      run([{ type: "notice", scene: "cafe", notice: { kind: "chat", text: text("hi") } }]),
    ).toEqual(initialNotices);
    expect(
      run([{ type: "notice", scene: "desk", notice: { kind: "broadcast", text: [] } }]).toasts,
    ).toEqual([]);
  });

  it("tracks mail, the new day, the connection, and the end of the session", () => {
    const state = run([
      { type: "notice", scene: "desk", notice: { kind: "mail", count: 2 } },
      { type: "notice", scene: "desk", notice: { kind: "newDay", day: 7 } },
      { type: "connection", state: "reconnecting" },
      { type: "notice", scene: "desk", notice: { kind: "tournamentReset", winner: "Mylener" } },
      { type: "notice", scene: "desk", notice: { kind: "sessionEnded", reason: "townReset" } },
    ]);
    expect(state).toMatchObject({
      mail: 2,
      newDay: 7,
      connection: "reconnecting",
      reset: { winner: "Mylener" },
      ended: "townReset",
    });
    expect(run([{ type: "mailRead" }], state).mail).toBe(0);
    expect(run([{ type: "dismissBanner" }], state).newDay).toBeNull();
  });

  it("a lobby View ends the session as 'lost' until the server says why", () => {
    const lost = run([{ type: "lobbyView" }]);
    expect(lost.ended).toBe("lost");
    const why = run(
      [{ type: "notice", scene: "lobby", notice: { kind: "sessionEnded", reason: "replaced" } }],
      lost,
    );
    expect(why.ended).toBe("replaced");
    // The reason that came first is not overwritten by the generic one.
    expect(run([{ type: "lobbyView" }], why).ended).toBe("replaced");
  });
});

describe("notices on screen", () => {
  it("shows a sysop message and a broadcast without taking over the screen", async () => {
    const t = new LiveScriptedTransport(FIXTURES.desk);
    renderGame(t);
    await screen.findByRole("heading", { level: 1, name: "Your Desk" });
    act(() => t.notice({ kind: "broadcast", text: text("Skelly logs on.") }));
    act(() => t.notice({ kind: "server", text: text("Back in five minutes.") }));
    expect(await screen.findByText("Skelly logs on.")).toBeInTheDocument();
    expect(screen.getByText("Back in five minutes.")).toBeInTheDocument();
    // No dialog opened, and the game is still operable.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: /wait for customer/i })).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[0] as HTMLElement);
    expect(screen.queryByText("Skelly logs on.")).toBeNull();
  });

  it("toasts fade by themselves, except the sysop's", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const t = new LiveScriptedTransport(FIXTURES.desk);
      renderGame(t);
      await screen.findByRole("heading", { level: 1, name: "Your Desk" });
      act(() => t.notice({ kind: "broadcast", text: text("Passing remark.") }));
      act(() => t.notice({ kind: "server", text: text("Read this.") }));
      expect(screen.getByText("Passing remark.")).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      expect(screen.queryByText("Passing remark.")).toBeNull();
      expect(screen.getByText("Read this.")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("announces a new day with a banner that goes away", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const t = new LiveScriptedTransport(FIXTURES.desk);
      renderGame(t);
      await screen.findByRole("heading", { level: 1, name: "Your Desk" });
      act(() => t.notice({ kind: "newDay", day: 12 }));
      expect(screen.getByText("A new day has dawned. It is day 12.")).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(8000);
      });
      expect(screen.queryByText(/new day has dawned/)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a mail indicator with the count, and clears it when the player reaches the desk", async () => {
    const t = new LiveScriptedTransport(FIXTURES.desk, () => FIXTURES.desk);
    renderGame(t);
    await screen.findByRole("heading", { level: 1, name: "Your Desk" });
    act(() => t.notice({ kind: "mail", count: 3 }));
    expect(await screen.findByText("3 letters are waiting at your desk")).toBeInTheDocument();
    // A pushed View does not clear it...
    act(() => t.push(FIXTURES.desk));
    expect(screen.getByText("3 letters are waiting at your desk")).toBeInTheDocument();
    // ...but arriving at the desk (the letters are delivered there) does.
    await userEvent.click(screen.getByRole("button", { name: /wait for customer/i }));
    await waitFor(() => expect(screen.queryByText(/letters are waiting/)).toBeNull());
  });

  it("says when the connection is lost, and when it is back", async () => {
    const t = new LiveScriptedTransport(FIXTURES.desk);
    renderGame(t);
    await screen.findByRole("heading", { level: 1, name: "Your Desk" });
    act(() => t.connection("reconnecting"));
    expect(screen.getByText("Connection lost. Trying to get back in touch...")).toBeInTheDocument();
    // Still playable.
    expect(screen.getByRole("button", { name: /wait for customer/i })).toBeInTheDocument();
    act(() => t.connection("online"));
    expect(screen.queryByText(/Connection lost/)).toBeNull();
    expect(screen.getByText("Back in touch with the server.")).toBeInTheDocument();
  });

  it("replaces the game with a clear screen when the session ends, and goes back to the front door", async () => {
    const onLeave = vi.fn();
    const t = new LiveScriptedTransport(FIXTURES.desk);
    renderGame(t, { onLeave });
    await screen.findByRole("heading", { level: 1, name: "Your Desk" });
    // The server pushes the lobby View first, then says why.
    act(() => t.push(FIXTURES.lobby));
    act(() => t.notice({ kind: "sessionEnded", reason: "replaced" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your session has ended");
    expect(alert).toHaveTextContent("logged on somewhere else");
    expect(screen.queryByRole("button", { name: /wait for customer/i })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Back to the front door" }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("goes straight back to the front door when the player chose to leave (quit)", async () => {
    const onLeave = vi.fn();
    const t = new LiveScriptedTransport(FIXTURES.desk);
    renderGame(t, { onLeave });
    await screen.findByRole("heading", { level: 1, name: "Your Desk" });
    act(() => t.push(FIXTURES.lobby));
    act(() => t.notice({ kind: "sessionEnded", reason: "quit" }));
    await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Your session has ended")).toBeNull();
  });

  it("names the winner when a tournament reset ends the session", async () => {
    const t = new LiveScriptedTransport(FIXTURES.desk);
    renderGame(t, { onLeave: () => {} });
    await screen.findByRole("heading", { level: 1, name: "Your Desk" });
    act(() => t.notice({ kind: "tournamentReset", winner: "Mylener" }));
    act(() => t.notice({ kind: "sessionEnded", reason: "townReset" }));
    expect(await screen.findByText("The tournament is over. Mylener won.")).toBeInTheDocument();
  });

  it("every end reason has words", async () => {
    for (const reason of [
      "quit",
      "timeout",
      "replaced",
      "kicked",
      "deleted",
      "banned",
      "townReset",
      "reset",
      "rollback",
      "shutdown",
    ] as const) {
      const t = new LiveScriptedTransport(FIXTURES.desk);
      const { unmount } = renderGame(t);
      await screen.findByRole("heading", { level: 1, name: "Your Desk" });
      act(() => t.notice({ kind: "sessionEnded", reason }));
      const alert = await screen.findByRole("alert");
      expect(alert.textContent?.length ?? 0, reason).toBeGreaterThan(40);
      expect(alert.textContent).not.toMatch(/ended\./);
      unmount();
    }
  });
});

describe("exit", () => {
  it("tells the server, then goes to the front door", async () => {
    const onLeave = vi.fn();
    const t = new LiveScriptedTransport(FIXTURES.desk);
    renderGame(t, { onLeave });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Exit" }));
    await user.click(screen.getByRole("button", { name: "Leave" }));
    await waitFor(() => expect(onLeave).toHaveBeenCalled());
    expect(t.sent).toEqual([{ type: "exit" }]);
    expect(t.closed).toBe(true);
  });

  it("leaves even when the server cannot be reached", async () => {
    const onLeave = vi.fn();
    const t = new LiveScriptedTransport(FIXTURES.desk, () => new Error("offline"));
    renderGame(t, { onLeave });
    const user = userEvent.setup();
    await user.click((await screen.findAllByRole("button", { name: "Exit" }))[0] as HTMLElement);
    await user.click(screen.getByRole("button", { name: "Leave" }));
    await waitFor(() => expect(onLeave).toHaveBeenCalled());
  });
});

describe("the cafe in real time", () => {
  const cafe = (lines: string[]): View => ({
    ...FIXTURES.cafe,
    chat: lines.map((l) => ({ text: [{ text: l }] })),
  });

  it("lines from others arrive without disturbing what the player is typing", async () => {
    const t = new LiveScriptedTransport(cafe(["Skelly: hello"]));
    renderGame(t);
    const box = await screen.findByRole("textbox", { name: "Say something" });
    const user = userEvent.setup();
    await user.click(box);
    await user.keyboard("half a sent");
    act(() => t.push(cafe(["Skelly: hello", "Gravy: anyone here?"])));
    expect(await screen.findByText("Gravy: anyone here?")).toBeInTheDocument();
    const same = screen.getByRole("textbox", { name: "Say something" });
    expect(same).toBe(box);
    expect(same).toHaveValue("half a sent");
    expect(same).toHaveFocus();
    await user.keyboard("ence{Enter}");
    expect(t.sent).toEqual([{ type: "chat", text: "half a sentence" }]);
  });

  it("sends slash commands as plain text", async () => {
    const t = new LiveScriptedTransport(cafe([]));
    renderGame(t);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("textbox", { name: "Say something" }));
    await user.keyboard("/who{Enter}");
    expect(t.sent).toEqual([{ type: "chat", text: "/who" }]);
  });

  it("keeps the player's place when they have scrolled up to read", async () => {
    const t = new LiveScriptedTransport(cafe(["one"]));
    renderGame(t);
    const list = await screen.findByRole("list", { name: "Conversation" });
    const scroller = list.closest(".fq-textscroll") as HTMLElement;
    Object.defineProperty(scroller, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(scroller, "clientHeight", { value: 200, configurable: true });
    scroller.scrollTop = 100; // far from the bottom
    act(() => {
      scroller.dispatchEvent(new Event("scroll"));
    });
    act(() => t.push(cafe(["one", "two"])));
    await screen.findByText("two");
    expect(scroller.scrollTop).toBe(100);
  });
});

describe("a rejected action", () => {
  it("shows the dialog for a lost connection", async () => {
    const t = new LiveScriptedTransport(
      viewWith({ scene: "desk", buttons: [{ id: "a", label: "Alpha" }] }),
      () => new Error("x"),
    );
    renderGame(t);
    await userEvent.click(await screen.findByRole("button", { name: "Alpha" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That did not go through");
  });
});
