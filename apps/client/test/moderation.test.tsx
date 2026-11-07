import type { RichText, View } from "@fq/protocol";
import {
  ApiError,
  type BlockInfo,
  type BlockResponse,
  type MeResponse,
  type MuteInfo,
  type ReportRequest,
  type ReportResponse,
  type SafetyTarget,
  type SocketLike,
} from "@fq/server/client";
import { MemorySaveStorage } from "@fq/solo";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.js";
import { findAnnouncements } from "../src/moderation/announcements.js";
import type { ModerationApi } from "../src/moderation/api.js";
import { CONDUCT_KEY, CONDUCT_VERSION } from "../src/moderation/conduct.js";
import { SessionTransport } from "../src/net/SessionTransport.js";
import type { SoloPlatform } from "../src/solo/platform.js";
import { renderGame, viewWith } from "./helpers.js";
import { apiError, StubBackend } from "./stubBackend.js";

// ----------------------------------------------------------------- fixtures

const sp = (text: string) => ({ text });

/** A server's safety endpoints, recording what was asked and answering from the test. */
class FakeMod implements ModerationApi {
  calls: string[] = [];
  reports: ReportRequest[] = [];
  blocked: { townId: string; target: SafetyTarget }[] = [];
  guest = false;
  mutes: MuteInfo[] = [];
  list: BlockInfo[] = [];
  reportResult: ReportResponse | Error = {
    ok: true,
    duplicate: false,
    blockOffer: { name: "Skelly" },
    blocked: false,
  };
  blockResult: BlockResponse | Error = {
    block: { id: 5, name: "Skelly", parlor: null, townId: "main", since: "2030-01-01T00:00:00Z" },
    already: false,
  };
  deleteResult: Error | null = null;
  deleted: (string | undefined)[] = [];
  exported = 0;

  async report(request: ReportRequest) {
    this.reports.push(request);
    if (this.reportResult instanceof Error) throw this.reportResult;
    return this.reportResult;
  }
  async block(townId: string, target: SafetyTarget) {
    this.blocked.push({ townId, target });
    if (this.blockResult instanceof Error) throw this.blockResult;
    return this.blockResult;
  }
  async blocks() {
    return this.list;
  }
  async unblock(id: number) {
    this.calls.push(`unblock:${id}`);
  }
  async exportData() {
    this.exported++;
    return { account: { login: "bob" } };
  }
  async deleteAccount(password?: string) {
    this.deleted.push(password);
    if (this.deleteResult) throw this.deleteResult;
  }
  upgrades: [string, string][] = [];
  upgradeResult: Error | null = null;
  async upgrade(login: string, password: string) {
    this.upgrades.push([login, password]);
    if (this.upgradeResult) throw this.upgradeResult;
    this.guest = false;
    return { account: { id: 1, login, guest: false } };
  }
  async me(): Promise<MeResponse> {
    return {
      account: { id: 1, login: "bob", guest: this.guest },
      parlors: [{ townId: "main", playerId: 1, name: "Bob", parlor: "Bob Rest", online: true }],
      mutes: this.mutes,
    };
  }
}

class ModBackend extends StubBackend {
  mod = new FakeMod();
  moderation: ModerationApi = this.mod;
}

const CAFE: View = viewWith({
  scene: "cafe",
  title: "Pale Horse Cafe",
  text: [sp("The cafe hums.")],
  chat: [
    { text: [sp("Skelly"), sp(": you are all rotten")] },
    { text: [sp("Bob"), sp(": that is my own line")] },
    { text: [sp("* Gravy saunters in *")] },
  ],
  buttons: [{ id: "go:map", label: "Leave" }],
});

async function play(backend: ModBackend, view: View, user = userEvent.setup()) {
  backend.signedUp("bob", "hunter2hunter2", "Bob");
  backend.firstView = view;
  render(<App backend={backend} settings={{ typewriter: "off", layout: "classic" }} />);
  await screen.findByText("Please enter your name and password");
  await user.type(screen.getByLabelText("Name", { exact: true }), "bob");
  await user.type(screen.getByLabelText("Password", { exact: true }), "hunter2hunter2");
  await user.click(screen.getByRole("button", { name: "Log on" }));
  await waitFor(() => expect(backend.calls).toContain("enter:main"));
  await waitFor(() => expect(document.querySelector(".fq-stage")).not.toBeNull());
  return user;
}

beforeEach(() => {
  window.location.hash = "";
});

// ------------------------------------------------------- guests (decision 7)

describe("guests and free text", () => {
  const MAIL_PROMPT: View = viewWith({
    scene: "desk",
    title: "Your desk",
    overlay: {
      kind: "textInput",
      id: "mailbox:compose",
      prompt: "Write your letter",
      maxLength: 200,
    },
  });
  const QUOTE_PROMPT: View = viewWith({
    scene: "desk",
    title: "A fight",
    overlay: { kind: "textInput", id: "battle:quote", prompt: "Say something", maxLength: 60 },
    buttons: [{ id: "battle:punch", label: "Punch" }],
  });

  it("shows the cafe's input as unavailable, with the reason and a way to sign up", async () => {
    const backend = new ModBackend();
    backend.mod.guest = true;
    await play(backend, CAFE);
    const input = await screen.findByRole("textbox", { name: "Say something" });
    await waitFor(() => expect(input).toBeDisabled());
    expect(input).toHaveAttribute("placeholder", "Sign up to chat");
    expect(screen.getByText(/Guests can read the cafe but not talk in it/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign up free" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
  });

  it("leaves the cafe's input alone for a full account", async () => {
    const backend = new ModBackend();
    await play(backend, CAFE);
    const input = await screen.findByRole("textbox", { name: "Say something" });
    expect(input).toBeEnabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeVisible();
  });

  it("replaces the letter's notepad with the explanation; Never mind cancels the prompt", async () => {
    const backend = new ModBackend();
    backend.mod.guest = true;
    const user = await play(backend, MAIL_PROMPT);
    const dialog = await screen.findByRole("dialog", { name: "A free account is needed" });
    expect(within(dialog).getByText(/Guests cannot write letters/)).toBeVisible();
    expect(within(dialog).getByText(/log out and choose New user/)).toBeVisible();
    expect(screen.queryByRole("textbox")).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Never mind" }));
    expect(backend.transports[0]?.sent).toEqual([
      { type: "submitText", overlayId: "mailbox:compose", text: null },
    ]);
  });

  it("skips a battle quote as if cancelled, without a dialog, so the fight goes on", async () => {
    const backend = new ModBackend();
    backend.mod.guest = true;
    await play(backend, QUOTE_PROMPT);
    // (The scripted server answers with the same prompt every time, so it may be asked again.)
    await waitFor(() => expect(backend.transports[0]?.sent.length).toBeGreaterThan(0));
    expect(backend.transports[0]?.sent[0]).toEqual({
      type: "submitText",
      overlayId: "battle:quote",
      text: null,
    });
    expect(screen.queryByRole("dialog", { name: "A free account is needed" })).toBeNull();
  });

  it("makes the guest a full account in place: same parlor, the notepad opens", async () => {
    const backend = new ModBackend();
    backend.mod.guest = true;
    const user = await play(backend, MAIL_PROMPT);
    const dialog = await screen.findByRole("dialog", { name: "A free account is needed" });
    await user.click(within(dialog).getByRole("button", { name: "Make a free account" }));
    const form = await screen.findByRole("dialog", { name: "Make this a full account" });
    await user.type(within(form).getByLabelText("Log-on name"), "bobby");
    await user.type(within(form).getByLabelText("Password"), "a long password");
    await user.click(within(form).getByRole("button", { name: "Make my account" }));
    expect(backend.mod.upgrades).toEqual([["bobby", "a long password"]]);
    expect(await screen.findByText(/You can now chat, write letters/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close" }));
    // The explanation gives way to the notepad itself.
    expect(await screen.findByRole("textbox")).toBeEnabled();
    expect(screen.queryByRole("dialog", { name: "A free account is needed" })).toBeNull();
  });

  it("says plainly when the name is taken, and changes nothing", async () => {
    const backend = new ModBackend();
    backend.mod.guest = true;
    backend.mod.upgradeResult = new ApiError(409, "login_taken", "That login name is taken.");
    const user = await play(backend, CAFE);
    await user.click(await screen.findByRole("button", { name: "Sign up free" }));
    const form = await screen.findByRole("dialog", { name: "Make this a full account" });
    await user.type(within(form).getByLabelText("Log-on name"), "bobby");
    await user.type(within(form).getByLabelText("Password"), "a long password");
    await user.click(within(form).getByRole("button", { name: "Make my account" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent("That log-on name is taken");
    expect(screen.getByRole("textbox", { name: "Say something" })).toBeDisabled();
  });

  it("offers the same from Settings, to guests only", async () => {
    const backend = new ModBackend();
    backend.mod.guest = true;
    const user = await play(backend, CAFE);
    await user.click(await screen.findByRole("button", { name: "Settings" }));
    const dialog = await screen.findByRole("dialog", { name: "Settings" });
    expect(
      await within(dialog).findByRole("button", { name: "Make this a full account" }),
    ).toBeVisible();
  });

  it("does not show the Settings entry to a full account", async () => {
    const backend = new ModBackend();
    const user = await play(backend, CAFE);
    await user.click(await screen.findByRole("button", { name: "Settings" }));
    const dialog = await screen.findByRole("dialog", { name: "Settings" });
    await within(dialog).findByText("Nobody is blocked.");
    expect(within(dialog).queryByRole("button", { name: "Make this a full account" })).toBeNull();
  });

  it("the transport turns a 403 guest_text into the banner, not an error dialog", async () => {
    const backend = new ModBackend();
    await play(backend, CAFE);
    window.dispatchEvent(
      new CustomEvent("fq:muted", { detail: { message: "Guests cannot talk in the cafe." } }),
    );
    expect(await screen.findByTestId("muted-banner")).toHaveTextContent("Guests cannot talk");
  });
});

// ------------------------------------------------------- the menu and its hooks

describe("report and block next to cafe lines", () => {
  it("offers the menu on other players' lines only, never on the player's own", async () => {
    const backend = new ModBackend();
    await play(backend, CAFE);
    await screen.findByRole("button", { name: "Report or block Skelly" });
    // Only Skelly's line has a speaker to act on: not the arrival, and not the player's own line.
    expect(screen.getAllByRole("button", { name: /^Report or block/ })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Report or block Bob" })).toBeNull();
  });

  it("offers nothing without an online session: a mock or Solo game has no other players", async () => {
    renderGame(new (await import("./helpers.js")).ScriptedTransport(CAFE));
    await screen.findByText(/you are all rotten/);
    expect(screen.queryByRole("button", { name: /^Report or block/ })).toBeNull();
  });

  it("blocks from a line: explains what a block does and does not do, sends the line, confirms", async () => {
    const backend = new ModBackend();
    const user = await play(backend, CAFE);
    await user.click(await screen.findByRole("button", { name: "Report or block Skelly" }));
    await user.click(screen.getByRole("button", { name: "Block" }));
    const dialog = await screen.findByRole("dialog", { name: "Block Skelly?" });
    expect(dialog).toHaveTextContent("letters, cafe lines and gifts");
    expect(dialog).toHaveTextContent("one-way, and they are not told");
    expect(dialog).toHaveTextContent("stop them visiting or fighting you");
    expect(dialog).toHaveTextContent("hide announcements in the newspaper");
    await user.click(within(dialog).getByRole("button", { name: "Block" }));
    expect(backend.mod.blocked).toEqual([
      { townId: "main", target: { kind: "chat", text: "Skelly: you are all rotten" } },
    ]);
    expect(
      await within(await screen.findByRole("dialog", { name: "Blocked" })).findByRole("status"),
    ).toHaveTextContent("Skelly is blocked");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: /Block/ })).toBeNull();
  });

  it("says what the server said when it cannot tell who wrote the line", async () => {
    const backend = new ModBackend();
    backend.mod.blockResult = apiError(
      404,
      "unknown_author",
      "The server cannot tell who wrote that.",
    );
    const user = await play(backend, CAFE);
    await user.click(await screen.findByRole("button", { name: "Report or block Skelly" }));
    await user.click(screen.getByRole("button", { name: "Block" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Block" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The server cannot tell who wrote that.",
    );
  });
});

describe("cafe lines that say who spoke, as data (Expanded)", () => {
  // The words give no name to parse: the speaker is `from`.
  const EXPANDED_CAFE: View = viewWith({
    scene: "cafe",
    title: "Pale Horse Cafe",
    text: [sp("The cafe hums.")],
    chat: [
      { text: [sp("* Skelly rattles his bones *")], from: { playerId: 7, name: "Skelly" } },
      { text: [sp("* Bob waves *")], from: { playerId: 1, name: "Bob" } },
      { text: [sp("* Gravy saunters in *")] },
    ],
    buttons: [{ id: "go:map", label: "Leave" }],
  });

  it("offers the menu on another player's /me line and not on the player's own or the room's", async () => {
    await play(new ModBackend(), EXPANDED_CAFE);
    await screen.findByRole("button", { name: "Report or block Skelly" });
    expect(screen.getAllByRole("button", { name: /^Report or block/ })).toHaveLength(1);
  });

  it("reports and blocks the line by the speaker's id, not by its words alone", async () => {
    const backend = new ModBackend();
    const user = await play(backend, EXPANDED_CAFE);
    await user.click(await screen.findByRole("button", { name: "Report or block Skelly" }));
    await user.click(screen.getByRole("button", { name: "Report" }));
    const dialog = await screen.findByRole("dialog", { name: "Report to the moderators" });
    await user.click(within(dialog).getByRole("radio", { name: "Spam" }));
    await user.click(within(dialog).getByRole("button", { name: "Send report" }));
    expect(backend.mod.reports).toEqual([
      {
        townId: "main",
        target: { kind: "chat", text: "* Skelly rattles his bones *", fromPlayerId: 7 },
        category: "spam",
      },
    ]);
  });
});

// ------------------------------------------------------------------ report form

describe("the report form", () => {
  async function openReport(backend: ModBackend) {
    const user = await play(backend, CAFE);
    await user.click(await screen.findByRole("button", { name: "Report or block Skelly" }));
    await user.click(screen.getByRole("button", { name: "Report" }));
    return {
      user,
      dialog: await screen.findByRole("dialog", { name: "Report to the moderators" }),
    };
  }

  it("offers the seven categories, shows what is reported, and keeps the note to 500 characters", async () => {
    const { dialog } = await openReport(new ModBackend());
    const radios = within(dialog).getAllByRole("radio");
    expect(radios.map((r) => r.closest("label")?.textContent)).toEqual([
      "Harassment or bullying",
      "Hate",
      "Sexual content",
      "Threats",
      "Spam",
      "Cheating",
      "Something else",
    ]);
    expect(dialog).toHaveTextContent("Skelly: you are all rotten");
    const note = within(dialog).getByLabelText(/Anything else/);
    expect(note).toHaveAttribute("maxlength", "500");
    expect(dialog).toHaveTextContent("500 characters left");
    expect(dialog).toHaveTextContent("never told who reported them");
  });

  it("does not send until a category is chosen, then sends exactly category, note and what was reported", async () => {
    const backend = new ModBackend();
    const { user, dialog } = await openReport(backend);
    await user.click(within(dialog).getByRole("button", { name: "Send report" }));
    expect(backend.mod.reports).toEqual([]);
    await user.click(within(dialog).getByRole("radio", { name: "Threats" }));
    await user.type(
      within(dialog).getByLabelText(/Anything else/),
      "  He said he would burn my parlor ",
    );
    await user.click(within(dialog).getByRole("button", { name: "Send report" }));
    expect(backend.mod.reports).toEqual([
      {
        townId: "main",
        target: { kind: "chat", text: "Skelly: you are all rotten" },
        category: "threats",
        note: "He said he would burn my parlor",
      },
    ]);
    expect(
      await within(
        await screen.findByRole("dialog", { name: "Report to the moderators" }),
      ).findByRole("status"),
    ).toHaveTextContent("Thank you");
  });

  it("omits an empty note, and after a report offers to block, which then blocks the same author", async () => {
    const backend = new ModBackend();
    const { user, dialog } = await openReport(backend);
    await user.click(within(dialog).getByRole("radio", { name: "Spam" }));
    await user.click(within(dialog).getByRole("button", { name: "Send report" }));
    expect(backend.mod.reports[0]).not.toHaveProperty("note");
    const done = await screen.findByRole("dialog", { name: "Report to the moderators" });
    expect(done).toHaveTextContent("Do you also want to block Skelly?");
    await user.click(within(done).getByRole("button", { name: "Block" }));
    expect(backend.mod.blocked).toHaveLength(1);
    expect(await within(done).findByText("Skelly is blocked.")).toBeVisible();
    expect(within(done).queryByRole("button", { name: "Block" })).toBeNull();
  });

  it("makes no offer when the author is not known, and says so honestly for a repeat", async () => {
    const backend = new ModBackend();
    backend.mod.reportResult = { ok: true, duplicate: true, blockOffer: null, blocked: false };
    const { user, dialog } = await openReport(backend);
    await user.click(within(dialog).getByRole("radio", { name: "Hate" }));
    await user.click(within(dialog).getByRole("button", { name: "Send report" }));
    const done = await screen.findByRole("dialog", { name: "Report to the moderators" });
    expect(done).toHaveTextContent("You have already reported this");
    expect(within(done).queryByRole("button", { name: "Block" })).toBeNull();
  });

  it("shows the server's words when reports are rate limited, and lets the player try again", async () => {
    const backend = new ModBackend();
    backend.mod.reportResult = apiError(
      429,
      "report_limit",
      "You have sent a lot of reports this hour.",
    );
    const { user, dialog } = await openReport(backend);
    await user.click(within(dialog).getByRole("radio", { name: "Spam" }));
    await user.click(within(dialog).getByRole("button", { name: "Send report" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "a lot of reports this hour",
    );
    expect(within(dialog).getByRole("radio", { name: "Spam" })).toBeChecked();
  });

  it("Escape closes it without pressing the game's keys behind it", async () => {
    const backend = new ModBackend();
    const { user } = await openReport(backend);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Report to the moderators" })).toBeNull();
  });
});

// ------------------------------------------------------------------ rankings

describe("rankings", () => {
  const rows = (ids: number[]) =>
    ids.map((id, i) => ({
      place: i + 1,
      playerId: id,
      name: id === 1 ? "Bob" : `Rival${id}`,
      parlor: `Parlor ${id}`,
      male: true,
      bp: 100 - i,
      title: "",
      status: "",
      online: false,
    }));

  it("reports or blocks other parlors, and has no menu on the player's own row", async () => {
    const backend = new ModBackend();
    const user = await play(
      backend,
      viewWith({ scene: "rankings", text: [sp("")], rankings: rows([1, 4, 7]) }),
    );
    await screen.findByRole("button", { name: "Report or block Rival4" });
    expect(screen.queryByRole("button", { name: "Report or block Bob" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Report or block Rival4" }));
    await user.click(screen.getByRole("button", { name: "Report parlor name" }));
    const dialog = await screen.findByRole("dialog", { name: "Report to the moderators" });
    expect(dialog).toHaveTextContent("Parlor 4");
    await user.click(within(dialog).getByRole("radio", { name: "Hate" }));
    await user.click(within(dialog).getByRole("button", { name: "Send report" }));
    expect(backend.mod.reports[0]?.target).toEqual({ kind: "parlorName", playerId: 4 });
  });

  it("blocks a player by their id", async () => {
    const backend = new ModBackend();
    const user = await play(
      backend,
      viewWith({ scene: "rankings", text: [sp("")], rankings: rows([4]) }),
    );
    await user.click(await screen.findByRole("button", { name: "Report or block Rival4" }));
    await user.click(screen.getByRole("button", { name: "Block" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Block" }),
    );
    expect(backend.mod.blocked[0]?.target).toEqual({ kind: "player", playerId: 4 });
  });
});

// ------------------------------------------------------------- letters and fortunes

describe("letters, fortunes and quotes", () => {
  const letter = (text: string, id = "mailbox:reply"): View =>
    viewWith({
      scene: "desk",
      overlay:
        id === "mailbox:reply"
          ? { kind: "confirm", id, text: [sp(text)] }
          : { kind: "message", id, text: [sp(text)] },
    });

  it("lets the reader report or block the writer of a letter", async () => {
    const backend = new ModBackend();
    const text =
      "You have received a letter from Skelly:\n\nGive me your plots.\n\nReply to this letter?";
    const user = await play(backend, letter(text));
    await user.click(await screen.findByRole("button", { name: "Report letter" }));
    const dialog = await screen.findByRole("dialog", { name: "Report to the moderators" });
    await user.click(within(dialog).getByRole("radio", { name: "Harassment or bullying" }));
    await user.click(within(dialog).getByRole("button", { name: "Send report" }));
    expect(backend.mod.reports[0]?.target).toEqual({ kind: "letter", text });
    await user.click(await within(dialog).findByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Block sender" }));
    expect(await screen.findByRole("dialog", { name: "Block Skelly?" })).toBeVisible();
  });

  it("offers Report on a fortune and a battle quote, and not on the management's own mail", async () => {
    const fortune =
      'Skelly has sent you some chinese food.\nYour fortune cookie reads:\n"You will rot"';
    const backend = new ModBackend();
    const user = await play(backend, letter(fortune, "mailbox:letter"));
    await user.click(await screen.findByRole("button", { name: "Report this message" }));
    await user.click(
      within(await screen.findByRole("dialog", { name: /Report/ })).getByRole("radio", {
        name: "Threats",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Send report" }));
    expect(backend.mod.reports[0]?.target).toEqual({ kind: "fortune", text: fortune });
  });

  it("has no Report button on a message that is not from a player", async () => {
    const backend = new ModBackend();
    await play(backend, letter("A message from the management: be kind.", "mailbox:letter"));
    await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: "Report this message" })).toBeNull();
  });

  it("offers nothing on a letter outside an online session", async () => {
    const { ScriptedTransport } = await import("./helpers.js");
    renderGame(new ScriptedTransport(letter("You have received a letter from Skelly:\n\nhi")));
    await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: "Report letter" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Block sender" })).toBeNull();
  });
});

// ------------------------------------------------------------------ the paper

describe("the newspaper", () => {
  const body: RichText = [
    sp("A new parlor (Eden Rest) run by Eden has been opened!\r\n\r\n"),
    sp("Skelly of Bone Voyage makes an announcement:\r\nBuy my caskets, you cheap fools.\r\n\r\n"),
    sp("Mylener of Playin' God makes an announcement:\r\nAll hail Mylener!\r\n\r\n"),
  ];
  const paper = viewWith({
    scene: "news",
    news: {
      day: 3,
      section: "front",
      isYesterday: false,
      body,
      topToday: [sp("-")],
      topYesterday: [sp("-")],
    },
    buttons: [{ id: "go:desk", label: "Continue" }],
  });

  it("finds the announcements on a page by their header", () => {
    expect(findAnnouncements(body).map((a) => [a.who, a.parlor])).toEqual([
      ["Skelly", "Bone Voyage"],
      ["Mylener", "Playin' God"],
    ]);
    expect(findAnnouncements(body)[0]?.text).toBe(
      "Skelly of Bone Voyage makes an announcement:\nBuy my caskets, you cheap fools.",
    );
    expect(findAnnouncements([sp("Nothing but weather today.")])).toEqual([]);
  });

  it("lists them so one can be reported or its author blocked", async () => {
    const backend = new ModBackend();
    const user = await play(backend, paper);
    await user.click(await screen.findByRole("button", { name: "Report an announcement" }));
    const list = await screen.findByRole("dialog", { name: "Announcements on this page" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    await user.click(within(list).getByRole("button", { name: "Report Mylener" }));
    const form = await screen.findByRole("dialog", { name: "Report to the moderators" });
    await user.click(within(form).getByRole("radio", { name: "Spam" }));
    await user.click(within(form).getByRole("button", { name: "Send report" }));
    expect(backend.mod.reports[0]?.target).toEqual({
      kind: "announcement",
      text: "Mylener of Playin' God makes an announcement:\nAll hail Mylener!",
    });
  });

  it("blocks an announcement's author", async () => {
    const backend = new ModBackend();
    const user = await play(backend, paper);
    await user.click(await screen.findByRole("button", { name: "Report an announcement" }));
    await user.click(await screen.findByRole("button", { name: "Block Skelly" }));
    await user.click(
      within(await screen.findByRole("dialog", { name: "Block Skelly?" })).getByRole("button", {
        name: "Block",
      }),
    );
    expect(backend.mod.blocked[0]?.target).toMatchObject({ kind: "announcement" });
  });

  it("has no such button when the page has no announcement", async () => {
    const backend = new ModBackend();
    const quiet = {
      ...paper,
      news: { ...(paper.news as NonNullable<View["news"]>), body: [sp("Quiet day.")] },
    };
    await play(backend, quiet);
    await screen.findByRole("button", { name: "Continue" });
    expect(screen.queryByRole("button", { name: "Report an announcement" })).toBeNull();
  });
});

// ------------------------------------------------------------------ settings

describe("Settings", () => {
  const openSettings = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole("button", { name: "Settings" }));
    return screen.findByRole("dialog", { name: "Settings" });
  };

  it("lists blocked players with a way to unblock, and the honest explanation", async () => {
    const backend = new ModBackend();
    backend.mod.list = [
      {
        id: 3,
        name: "Skelly",
        parlor: "Bone Voyage",
        townId: "main",
        since: "2030-01-01T00:00:00Z",
      },
      { id: 4, name: "Gravy", parlor: null, townId: null, since: "2030-01-01T00:00:00Z" },
    ];
    const user = await play(backend, CAFE);
    const dialog = await openSettings(user);
    expect(await within(dialog).findByText("Skelly")).toBeVisible();
    expect(within(dialog).getByText("Gravy")).toBeVisible();
    expect(dialog).toHaveTextContent("It does not stop visits or fights");
    await user.click(within(dialog).getByRole("button", { name: "Unblock Skelly" }));
    expect(backend.mod.calls).toContain("unblock:3");
    await waitFor(() => expect(within(dialog).queryByText("Skelly")).toBeNull());
    expect(within(dialog).getByText("Gravy")).toBeVisible();
  });

  it("says when nobody is blocked", async () => {
    const user = await play(new ModBackend(), CAFE);
    expect(await within(await openSettings(user)).findByText("Nobody is blocked.")).toBeVisible();
  });

  it("downloads the player's data as a JSON file", async () => {
    const backend = new ModBackend();
    const created: Blob[] = [];
    URL.createObjectURL = (b: Blob | MediaSource) => {
      created.push(b as Blob);
      return "blob:data";
    };
    URL.revokeObjectURL = () => undefined;
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const user = await play(backend, CAFE);
    await user.click(
      within(await openSettings(user)).getByRole("button", { name: "Download my data" }),
    );
    await waitFor(() => expect(backend.mod.exported).toBe(1));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(JSON.parse((await created[0]?.text()) ?? "")).toEqual({ account: { login: "bob" } });
    click.mockRestore();
  });

  it("is absent when there is no online session", async () => {
    const { ScriptedTransport } = await import("./helpers.js");
    const user = userEvent.setup();
    renderGame(new ScriptedTransport(CAFE));
    await user.click(await screen.findByRole("button", { name: "Settings" }));
    const dialog = await screen.findByRole("dialog", { name: "Settings" });
    expect(within(dialog).queryByText("Blocked players")).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Delete my account" })).toBeNull();
  });
});

// ------------------------------------------------------------- account deletion

describe("deleting the account", () => {
  async function toDeleteDialog(backend: ModBackend) {
    const user = await play(backend, CAFE);
    await user.click(await screen.findByRole("button", { name: "Settings" }));
    await user.click(await screen.findByRole("button", { name: "Delete my account" }));
    return { user, dialog: await screen.findByRole("dialog", { name: "Delete your account?" }) };
  }

  it("needs the password again, and refuses to ask the server without it", async () => {
    const backend = new ModBackend();
    const { user, dialog } = await toDeleteDialog(backend);
    expect(dialog).toHaveTextContent("It cannot be undone");
    await user.click(within(dialog).getByRole("button", { name: "Delete for good" }));
    expect(backend.mod.deleted).toEqual([]);
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Type it again");
  });

  it("says a wrong password is wrong and keeps the account", async () => {
    const backend = new ModBackend();
    backend.mod.deleteResult = apiError(401, "bad_credentials", "Wrong password.");
    const { user, dialog } = await toDeleteDialog(backend);
    await user.type(within(dialog).getByLabelText("Your password"), "nope nope nope");
    await user.click(within(dialog).getByRole("button", { name: "Delete for good" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "That password is not right.",
    );
    expect(backend.mod.deleted).toEqual(["nope nope nope"]);
    expect(screen.queryByText("Please enter your name and password")).toBeNull();
  });

  it("deletes, forgets the session and lands on the front door, telling the player", async () => {
    const backend = new ModBackend();
    const { user, dialog } = await toDeleteDialog(backend);
    await user.type(within(dialog).getByLabelText("Your password"), "hunter2hunter2");
    await user.click(within(dialog).getByRole("button", { name: "Delete for good" }));
    expect(await screen.findByText("Please enter your name and password")).toBeVisible();
    expect(backend.mod.deleted).toEqual(["hunter2hunter2"]);
    expect(backend.calls).toContain("forget");
    expect(backend.hasSession()).toBe(false);
    expect(screen.getByText("Your account has been deleted.")).toBeVisible();
  });

  it("asks a guest only to confirm: no password", async () => {
    const backend = new ModBackend();
    backend.mod.guest = true;
    const { user, dialog } = await toDeleteDialog(backend);
    expect(within(dialog).queryByLabelText("Your password")).toBeNull();
    expect(dialog).toHaveTextContent("guest account");
    await user.click(within(dialog).getByRole("button", { name: "Delete for good" }));
    expect(await screen.findByText("Please enter your name and password")).toBeVisible();
    expect(backend.mod.deleted).toEqual([undefined]);
  });

  it("can be cancelled", async () => {
    const backend = new ModBackend();
    const { user } = await toDeleteDialog(backend);
    await user.click(screen.getByRole("button", { name: "Keep my account" }));
    expect(screen.queryByRole("dialog", { name: "Delete your account?" })).toBeNull();
    expect(backend.mod.deleted).toEqual([]);
  });
});

// ----------------------------------------------------------------------- mutes

describe("mutes", () => {
  it("shows a banner for a mute the server reports", async () => {
    const backend = new ModBackend();
    backend.mod.mutes = [{ scopes: ["chat", "mail"], until: "2031-01-01T12:00:00.000Z" }];
    await play(backend, CAFE);
    const banner = await screen.findByTestId("muted-banner");
    expect(banner).toHaveTextContent("You are muted from cafe talk and letters and battle quotes");
  });

  it("shows the server's message when an action is refused, and keeps the screen", async () => {
    const backend = new ModBackend();
    await play(backend, CAFE);
    window.dispatchEvent(
      new CustomEvent("fq:muted", {
        detail: { message: "You are muted from cafe talk until later." },
      }),
    );
    expect(await screen.findByTestId("muted-banner")).toHaveTextContent(
      "You are muted from cafe talk until later.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByTestId("muted-banner")).toBeNull();
  });

  it("the transport turns a 403 muted into that message, not an error dialog", async () => {
    class Sock implements SocketLike {
      onopen: SocketLike["onopen"] = null;
      onmessage: SocketLike["onmessage"] = null;
      onclose: SocketLike["onclose"] = null;
      onerror: SocketLike["onerror"] = null;
      send() {}
      close() {}
    }
    const view = viewWith({ scene: "cafe" });
    const api = {
      token: "fq_x",
      baseUrl: "http://server.test",
      enter: vi.fn(async () => ({ view, created: false })),
      act: vi.fn(async () => {
        throw new ApiError(403, "muted", "You are muted from cafe talk until tomorrow.");
      }),
      currentView: vi.fn(async () => view),
    };
    const transport = new SessionTransport({
      api: api as never,
      townId: "main",
      webSocket: Sock,
      heartbeat: { setInterval: () => 1, clearInterval: () => {} },
    });
    await transport.connect();
    const heard: string[] = [];
    window.addEventListener("fq:muted", (e) => heard.push((e as CustomEvent).detail.message), {
      once: true,
    });
    await expect(transport.send({ type: "chat", text: "hi" })).resolves.toEqual(view);
    expect(heard).toEqual(["You are muted from cafe talk until tomorrow."]);
  });
});

// ------------------------------------------------------------------- the gate

describe("the notice before online play", () => {
  beforeEach(() => {
    window.localStorage.removeItem(CONDUCT_KEY);
  });

  const door = () =>
    render(<App backend={new StubBackend()} settings={{ typewriter: "off", layout: "classic" }} />);

  it("is shown first in place of the log-on plaque: the rating, the rules and a tick box", async () => {
    door();
    const gate = await screen.findByTestId("conduct-gate");
    expect(gate).toHaveTextContent("Rated 18+, for adults.");
    expect(gate).toHaveTextContent("mature humour");
    expect(gate).toHaveTextContent("pretend gambling");
    expect(gate).toHaveTextContent(
      "no harassment or bullying, no hate, no sexual content, no threats, no spam, no cheating",
    );
    expect(gate).toHaveTextContent("Report the player and block them");
    expect(gate).toHaveTextContent("mute, rename or ban");
    expect(gate).toHaveTextContent("I am 18 or older and accept these rules");
    // Nothing about the game's own content being moderated, and no age to fill in or verify.
    expect(gate).not.toHaveTextContent(/2001 originals|toned|censor|OWNER TO FILL IN/);
    expect(within(gate).queryByLabelText(/birth|date|age\b/i)).toBeNull();
    expect(within(gate).getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.queryByText("Please enter your name and password")).toBeNull();
  });

  it("cannot be passed without ticking the box", async () => {
    const user = userEvent.setup();
    door();
    const gate = await screen.findByTestId("conduct-gate");
    const tick = within(gate).getByRole("checkbox", {
      name: "I am 18 or older and accept these rules",
    });
    const go = within(gate).getByRole("button", { name: "Continue" });
    expect(tick).not.toBeChecked();
    expect(go).toHaveAttribute("aria-disabled", "true");
    await user.click(go);
    expect(screen.getByTestId("conduct-gate")).toBeVisible();
    expect(window.localStorage.getItem(CONDUCT_KEY)).toBeNull();
    await user.click(tick);
    expect(go).not.toHaveAttribute("aria-disabled");
    await user.click(go);
    expect(await screen.findByText("Please enter your name and password")).toBeVisible();
  });

  it("is remembered once agreed to, on this device only, and asks again when the version changes", async () => {
    const user = userEvent.setup();
    const { unmount } = door();
    await user.click(
      await screen.findByRole("checkbox", { name: "I am 18 or older and accept these rules" }),
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Please enter your name and password")).toBeVisible();
    expect(window.localStorage.getItem(CONDUCT_KEY)).toBe(String(CONDUCT_VERSION));
    // Nothing else is stored about it: no age, no date.
    expect(
      Object.keys(window.localStorage).filter((k) => /age|birth|adult|conduct/i.test(k)),
    ).toEqual([CONDUCT_KEY]);
    unmount();

    door();
    expect(await screen.findByText("Please enter your name and password")).toBeVisible();
    expect(screen.queryByTestId("conduct-gate")).toBeNull();
    // Rules that changed since the player agreed.
    document.body.innerHTML = "";
    window.localStorage.setItem(CONDUCT_KEY, String(CONDUCT_VERSION - 1));
    render(<App backend={new StubBackend()} settings={{ typewriter: "off", layout: "classic" }} />);
    expect(await screen.findAllByTestId("conduct-gate")).not.toHaveLength(0);
  });

  it("sends nothing about age to the server", async () => {
    const user = userEvent.setup();
    const backend = new StubBackend();
    render(<App backend={backend} settings={{ typewriter: "off", layout: "classic" }} />);
    await user.click(
      await screen.findByRole("checkbox", { name: "I am 18 or older and accept these rules" }),
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("Please enter your name and password");
    expect(backend.calls.filter((c) => /age|adult|accept|conduct/i.test(c))).toEqual([]);
  });

  it("links to the full rules, which are also on the front door's Rules page", async () => {
    const user = userEvent.setup();
    door();
    await user.click(await screen.findByRole("button", { name: "Read the house rules" }));
    expect(window.location.hash).toBe("#/rules");
    expect(
      await screen.findByRole("heading", { name: "House rules for online play" }),
    ).toBeVisible();
    expect(screen.getByText(/rated 18\+ and is for people aged 18 or older/)).toBeTruthy();
    expect(
      screen.getByText(/To reach the moderators.*\[CONTACT - OWNER TO FILL IN\]/),
    ).toBeVisible();
  });

  it("is not shown for Solo, only when the player chooses to play online", async () => {
    const user = userEvent.setup();
    const solo = {
      storage: new MemorySaveStorage(),
      createWorker: () => ({ postMessage: () => undefined, addEventListener: () => undefined }),
      newSeed: () => 1,
      now: () => 1_700_000_000_000,
    } as unknown as SoloPlatform;
    render(
      <App
        backend={new StubBackend()}
        solo={solo}
        settings={{ typewriter: "off", layout: "classic" }}
      />,
    );
    await screen.findByRole("heading", { name: "How would you like to play?" });
    expect(screen.queryByTestId("conduct-gate")).toBeNull();
    await user.click(screen.getByRole("button", { name: /^Play solo/ }));
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "How would you like to play?" })).toBeNull(),
    );
    expect(screen.queryByTestId("conduct-gate")).toBeNull();
    expect(screen.queryByText("Please enter your name and password")).toBeNull();
  });

  it("is shown when Play online is chosen from the Solo choice", async () => {
    const user = userEvent.setup();
    const solo = {
      storage: new MemorySaveStorage(),
      createWorker: () => ({ postMessage: () => undefined, addEventListener: () => undefined }),
      newSeed: () => 1,
      now: () => 1_700_000_000_000,
    } as unknown as SoloPlatform;
    render(
      <App
        backend={new StubBackend()}
        solo={solo}
        settings={{ typewriter: "off", layout: "classic" }}
      />,
    );
    await user.click(await screen.findByRole("button", { name: /^Play online/ }));
    expect(await screen.findByTestId("conduct-gate")).toBeVisible();
    // Not now goes back to the choice.
    await user.click(screen.getByRole("button", { name: "Not now" }));
    expect(
      await screen.findByRole("heading", { name: "How would you like to play?" }),
    ).toBeVisible();
  });

  it("takes the contact address from the server when it has one", async () => {
    const backend = new StubBackend();
    backend.features$ = {
      museum: { enabled: false, path: "/museum/" },
      safety: {
        reports: true,
        blocks: true,
        accountDeletion: true,
        contactEmail: "graves@example.org",
        deletionPath: "/account/delete",
      },
    };
    const user = userEvent.setup();
    render(<App backend={backend} settings={{ typewriter: "off", layout: "classic" }} />);
    await screen.findByText("Connected to Dead Calm.");
    await waitFor(() => expect(backend.features$).not.toBeNull());
    await user.click(await screen.findByRole("button", { name: "Read the house rules" }));
    expect(await screen.findByText(/graves@example.org/)).toBeVisible();
  });
});
