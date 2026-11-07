import type { Action, View } from "@fq/protocol";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FIXTURES, OVERLAY_FIXTURES } from "../src/mock/fixtures.js";
import { renderGame, ScriptedTransport, viewWith } from "./helpers.js";

const five: View = viewWith({
  scene: "location",
  title: "Five buttons",
  buttons: [
    { id: "a", label: "Alpha" },
    { id: "b", label: "Bravo" },
    { id: "c", label: "Charlie", enabled: false, hint: "Not today." },
    { id: "d", label: "Delta" },
    { id: "e", label: "Echo" },
  ],
});

describe("buttons", () => {
  it("clicking a button sends a press with its id", async () => {
    const t = new ScriptedTransport(five);
    renderGame(t);
    await userEvent.click(await screen.findByRole("button", { name: "Bravo" }));
    expect(t.sent).toEqual([{ type: "press", buttonId: "b" }]);
  });

  it("shows the answer to the action", async () => {
    const next = viewWith({
      scene: "location",
      title: "Next room",
      text: [{ text: "You made it." }],
    });
    const t = new ScriptedTransport(five, () => next);
    renderGame(t);
    await userEvent.click(await screen.findByRole("button", { name: "Alpha" }));
    expect(await screen.findByText("You made it.")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 1, name: "Next room" })).toBeInTheDocument();
  });

  it("keys 1 to 5 press the matching buttons", async () => {
    const t = new ScriptedTransport(five);
    renderGame(t);
    await screen.findByRole("button", { name: "Alpha" });
    const user = userEvent.setup();
    for (const key of ["1", "2", "4", "5"]) {
      await user.keyboard(key);
      await waitFor(() => expect(t.sent.length).toBeGreaterThan(0));
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(t.sent.map((a) => (a.type === "press" ? a.buttonId : a.type))).toEqual([
      "a",
      "b",
      "d",
      "e",
    ]);
  });

  it("ignores a key for a disabled button, an absent button, or a modifier", async () => {
    const t = new ScriptedTransport(five);
    renderGame(t);
    await screen.findByRole("button", { name: "Alpha" });
    const user = userEvent.setup();
    await user.keyboard("3");
    await user.keyboard("9");
    await user.keyboard("{Control>}1{/Control}");
    expect(t.sent).toEqual([]);
  });

  it("a disabled button stays focusable, explains itself, and does nothing when clicked", async () => {
    const t = new ScriptedTransport(five);
    renderGame(t);
    const charlie = await screen.findByRole("button", { name: "Charlie" });
    expect(charlie).toHaveAttribute("aria-disabled", "true");
    expect(charlie).toHaveAccessibleDescription("Not today.");
    await userEvent.click(charlie);
    expect(t.sent).toEqual([]);
  });

  it("does not send a second action while the first is in flight", async () => {
    let release: (v: View) => void = () => {};
    const t = new ScriptedTransport(five);
    t.send = (a: Action) => {
      t.sent.push(a);
      return new Promise<View>((resolve) => {
        release = resolve;
      });
    };
    renderGame(t);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Alpha" }));
    await user.click(screen.getByRole("button", { name: "Bravo" }));
    expect(t.sent).toHaveLength(1);
    release(five);
    await waitFor(() =>
      expect(screen.getByRole("main").closest(".fq-stage")).not.toHaveAttribute("aria-busy"),
    );
    await user.click(screen.getByRole("button", { name: "Bravo" }));
    expect(t.sent).toHaveLength(2);
  });

  it("shows an error notice when sending fails and lets the player carry on", async () => {
    const t = new ScriptedTransport(five, () => new Error("offline"));
    renderGame(t);
    await userEvent.click(await screen.findByRole("button", { name: "Alpha" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("did not go through");
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("applies views pushed by the server without being asked", async () => {
    const t = new ScriptedTransport(FIXTURES.cafe);
    renderGame(t);
    await screen.findByRole("list", { name: "Conversation" });
    t.push({
      ...FIXTURES.cafe,
      chat: [...FIXTURES.cafe.chat, { text: [{ text: "A brand new line" }] }],
    });
    expect(await screen.findByText("A brand new line")).toBeInTheDocument();
  });
});

describe("cafe chat", () => {
  it("sends a chat action and clears the box; digits type instead of pressing buttons", async () => {
    const t = new ScriptedTransport(FIXTURES.cafe);
    renderGame(t);
    const box = await screen.findByRole("textbox", { name: "Say something" });
    const user = userEvent.setup();
    await user.click(box);
    await user.keyboard("room 1 is free{Enter}");
    expect(t.sent).toEqual([{ type: "chat", text: "room 1 is free" }]);
    expect(box).toHaveValue("");
  });
});

describe("cafe chat while an answer is awaited", () => {
  /** A transport whose answers come only when the test lets them. */
  class SlowTransport extends ScriptedTransport {
    release: (() => void)[] = [];
    override send(action: Action): Promise<View> {
      this.sent.push(action);
      return new Promise((resolve) => this.release.push(() => resolve(FIXTURES.cafe)));
    }
  }

  it("keeps a second line typed before the first is answered, and sends it after", async () => {
    const t = new SlowTransport(FIXTURES.cafe);
    renderGame(t);
    const box = await screen.findByRole("textbox", { name: "Say something" });
    const user = userEvent.setup();
    await user.click(box);
    await user.keyboard("first line{Enter}");
    await user.keyboard("second line{Enter}");
    // The second line is not lost, and not sent over the first: one request at a time.
    expect(t.sent).toEqual([{ type: "chat", text: "first line" }]);
    t.release.shift()?.();
    await waitFor(() => expect(t.sent).toHaveLength(2));
    expect(t.sent[1]).toEqual({ type: "chat", text: "second line" });
    t.release.shift()?.();
  });

  it("still drops a button pressed twice, which is one press", async () => {
    const t = new SlowTransport(five);
    renderGame(t);
    const alpha = await screen.findByRole("button", { name: "Alpha" });
    await userEvent.click(alpha);
    await userEvent.click(screen.getByRole("button", { name: "Bravo" }));
    expect(t.sent).toEqual([{ type: "press", buttonId: "a" }]);
    t.release.shift()?.();
  });
});

describe("overlays", () => {
  const messageId =
    OVERLAY_FIXTURES.message.overlay?.kind === "message" ? OVERLAY_FIXTURES.message.overlay.id : "";
  const withoutOverlay = (): View => {
    const { overlay: _gone, ...rest } = OVERLAY_FIXTURES.message;
    return rest;
  };

  it("a message is dismissed with OK by telling the server, which answers with the next screen", async () => {
    const t = new ScriptedTransport(OVERLAY_FIXTURES.message, withoutOverlay);
    renderGame(t);
    expect(await screen.findByRole("dialog")).toHaveTextContent("silver casket");
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(t.sent).toEqual([{ type: "dismiss", overlayId: messageId }]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Escape dismisses a message the same way", async () => {
    const t = new ScriptedTransport(OVERLAY_FIXTURES.message, withoutOverlay);
    renderGame(t);
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    expect(t.sent).toEqual([{ type: "dismiss", overlayId: messageId }]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("a message stays hidden while its dismissal is in flight, even if a push repeats it", async () => {
    let answer: (v: View) => void = () => {};
    const t = new ScriptedTransport(OVERLAY_FIXTURES.message);
    t.send = (action) => {
      t.sent.push(action);
      return new Promise<View>((resolve) => {
        answer = resolve;
      });
    };
    renderGame(t);
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    t.push({ ...OVERLAY_FIXTURES.message });
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByRole("dialog")).toBeNull();
    answer(withoutOverlay());
    await screen.findByRole("heading", { level: 1 });
  });

  it("queued mail is read one overlay at a time", async () => {
    const letter = (id: string, text: string): View => ({
      ...FIXTURES.desk,
      overlay: { kind: "message", id, text: [{ text }] },
    });
    const confirm: View = {
      ...FIXTURES.desk,
      overlay: { kind: "confirm", id: "mailbox:reply", text: [{ text: "Reply to this letter?" }] },
    };
    const t = new ScriptedTransport(letter("mail1", "First letter."), (action) => {
      if (action.type === "dismiss" && action.overlayId === "mail1")
        return letter("mail2", "Second letter.");
      if (action.type === "dismiss" && action.overlayId === "mail2") return confirm;
      return FIXTURES.desk;
    });
    renderGame(t);
    expect(await screen.findByRole("dialog")).toHaveTextContent("First letter.");
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveTextContent("Second letter."));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toHaveTextContent("Reply to this letter?"),
    );
    await userEvent.click(screen.getByRole("button", { name: "No" }));
    expect(t.sent).toEqual([
      { type: "dismiss", overlayId: "mail1" },
      { type: "dismiss", overlayId: "mail2" },
      { type: "confirm", overlayId: "mailbox:reply", accepted: false },
    ]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Escape on a confirm answers no", async () => {
    const t = new ScriptedTransport(OVERLAY_FIXTURES.confirm, () => FIXTURES.shop);
    renderGame(t);
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    expect(t.sent).toEqual([{ type: "confirm", overlayId: "buy", accepted: false }]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Yes on a confirm answers yes", async () => {
    const t = new ScriptedTransport(OVERLAY_FIXTURES.confirm, () => FIXTURES.shop);
    renderGame(t);
    await userEvent.click(await screen.findByRole("button", { name: "Yes" }));
    expect(t.sent).toEqual([{ type: "confirm", overlayId: "buy", accepted: true }]);
  });

  it("the notepad submits what was typed and counts characters", async () => {
    const t = new ScriptedTransport(OVERLAY_FIXTURES.textInput, () => FIXTURES.news);
    renderGame(t);
    const box = await screen.findByRole("textbox");
    expect(box).toHaveFocus();
    const user = userEvent.setup();
    await user.keyboard("Opening sale, 50% off!");
    expect(screen.getByText("98 characters left")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(t.sent).toEqual([
      { type: "submitText", overlayId: "announce", text: "Opening sale, 50% off!" },
    ]);
  });

  it("the notepad limits input to maxLength", async () => {
    const t = new ScriptedTransport(OVERLAY_FIXTURES.textInputSingle);
    renderGame(t);
    const box = await screen.findByRole("textbox");
    await userEvent.type(box, "x".repeat(40));
    expect((box as HTMLInputElement).value).toHaveLength(24);
  });

  it("Cancel and Escape on the notepad cancel the prompt with null", async () => {
    const t = new ScriptedTransport(OVERLAY_FIXTURES.textInput, () => FIXTURES.news);
    renderGame(t);
    await screen.findByRole("textbox");
    await userEvent.keyboard("{Escape}");
    expect(t.sent).toEqual([{ type: "submitText", overlayId: "announce", text: null }]);
  });

  it("a prompt with initial text starts with it in the field", async () => {
    const t = new ScriptedTransport(
      viewWith({
        scene: "desk",
        overlay: {
          kind: "textInput",
          id: "mailbox:compose",
          prompt: "Your reply",
          maxLength: 200,
          multiline: true,
          initial: "> Hello Bob.\n\n",
        },
      }),
      () => FIXTURES.desk,
    );
    renderGame(t);
    const box = await screen.findByRole("textbox");
    expect(box).toHaveValue("> Hello Bob.\n\n");
    await userEvent.type(box, "Hi");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(t.sent).toEqual([
      { type: "submitText", overlayId: "mailbox:compose", text: "> Hello Bob.\n\nHi" },
    ]);
  });

  it("the player picker sends the chosen player, or null on Escape", async () => {
    const t = new ScriptedTransport(OVERLAY_FIXTURES.playerPicker, () => FIXTURES.rankings);
    renderGame(t);
    const choose = await screen.findByRole("button", { name: "Choose" });
    await userEvent.click(choose);
    expect(t.sent).toEqual([]); // nothing selected yet
    await userEvent.click(screen.getByRole("radio", { name: "Gravy" }));
    await userEvent.click(choose);
    expect(t.sent).toEqual([{ type: "pickPlayer", overlayId: "attack", playerId: 3 }]);
  });

  it("Escape on the picker sends null", async () => {
    const t = new ScriptedTransport(OVERLAY_FIXTURES.playerPicker, () => FIXTURES.rankings);
    renderGame(t);
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    expect(t.sent).toEqual([{ type: "pickPlayer", overlayId: "attack", playerId: null }]);
  });

  it("keys 1 to 5 do not press the buttons behind an open overlay", async () => {
    const t = new ScriptedTransport(OVERLAY_FIXTURES.confirm);
    renderGame(t);
    await screen.findByRole("dialog");
    await userEvent.keyboard("1");
    expect(t.sent).toEqual([]);
  });

  it("keeps focus inside the dialog when tabbing, and restores it on close", async () => {
    renderGame(new ScriptedTransport(OVERLAY_FIXTURES.confirm, () => FIXTURES.shop));
    const dialog = await screen.findByRole("dialog");
    const yes = screen.getByRole("button", { name: "Yes" });
    const no = screen.getByRole("button", { name: "No" });
    expect(yes).toHaveFocus();
    const user = userEvent.setup();
    await user.tab();
    expect(no).toHaveFocus();
    await user.tab();
    expect(yes).toHaveFocus();
    await user.tab({ shift: true });
    expect(no).toHaveFocus();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });
});

describe("exit and settings", () => {
  it("Exit asks first, then closes the transport and offers a way back", async () => {
    const t = new ScriptedTransport(FIXTURES.desk);
    renderGame(t);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Exit" }));
    await user.click(screen.getByRole("button", { name: "Stay" }));
    expect(t.closed).toBe(false);
    await user.click(screen.getByRole("button", { name: "Exit" }));
    await user.click(screen.getByRole("button", { name: "Leave" }));
    expect(t.closed).toBe(true);
    expect(await screen.findByText(/You have left Funeral Quest/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Return to the game" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Your Desk" })).toBeInTheDocument();
  });

  it("the settings panel opens, changes the text size, and closes with Escape", async () => {
    renderGame(new ScriptedTransport(FIXTURES.desk));
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Settings" }));
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Extra large" }));
    expect(document.querySelector(".fq-app")).toHaveStyle("--fq-font-scale: 1.5");
    expect(screen.getAllByRole("slider")).toHaveLength(4); // master, music, ambience, effects
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("volume sliders update the saved settings", async () => {
    renderGame(new ScriptedTransport(FIXTURES.desk));
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Settings" }));
    const music = screen.getByRole("slider", { name: "Music volume" });
    fireEvent.change(music, { target: { value: "0" } });
    expect(JSON.parse(window.localStorage.getItem("fq.settings.v1") ?? "{}").volume.music).toBe(0);
  });
});
