import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Request } from "../../../packages/legacy-compat/src/commands.js";
import { FlashClient, plain } from "../../../packages/legacy-compat/test/support/flashClient.js";
import {
  connectSocket,
  type Harness,
  type Socket,
  startServer,
  TestPlayer,
} from "./support/harness.js";
import { admin, chatLines, toCafe } from "./support/safety.js";

/**
 * Museum mode (the original client) cannot show a report or block button, but the server applies
 * blocks and mutes to its players like any other.
 */

let h: Harness | null = null;
const sockets: Socket[] = [];
let dir: string | null = null;
afterEach(async () => {
  for (const s of sockets.splice(0)) s.close();
  await h?.stop();
  h = null;
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = null;
});

const PASSWORD = "horse battery 42";

async function legacyInCafe(name: string, parlor: string, logon: string) {
  const flash = new FlashClient((h as Harness).server.app, "/museum");
  await flash.checkLogon();
  await flash.newUser({ logon, password: PASSWORD, name, parlor, email: "none@example.com" });
  if (flash.num("i_sent") !== 5)
    throw new Error(`sign-up refused: ${plain(flash.get("g_st_error"))}`);
  await flash.command(Request.main);
  if (flash.buttons().length === 1) await flash.click("3");
  await flash.command(Request.map);
  await flash.command(Request.chatStart);
  expect(flash.get("st_object")).toBe("i_chat");
  return flash;
}

async function setup() {
  h = await startServer({ config: { legacyClient: true }, listen: true });
  const lou = await legacyInCafe("Lou Legacy", "Lou Rest", "lou");
  const bobby = await new TestPlayer(h, "bobby", PASSWORD, "10.0.0.2").signUp();
  const carol = await new TestPlayer(h, "carol", PASSWORD, "10.0.0.3").signUp();
  await toCafe(bobby);
  await toCafe(carol);
  const carolSocket = await connectSocket(h, carol.token);
  const bobbySocket = await connectSocket(h, bobby.token);
  sockets.push(carolSocket, bobbySocket);
  return { lou, bobby, carol, carolSocket, bobbySocket };
}

describe("museum players and blocks", () => {
  it("does not hear a player their account has blocked, and others still do", async () => {
    const { lou, bobby, bobbySocket } = await setup();
    // The account blocks from the modern client (the original client has no button for it).
    const modernLou = new TestPlayer(h as Harness, "lou", PASSWORD, "10.0.0.9");
    await modernLou.logIn();
    const made = await modernLou.request("POST", "/api/blocks", {
      townId: "main",
      target: { kind: "name", name: "bobby" },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(201);

    await bobby.act({ type: "chat", text: "a line lou must not get" });
    await lou.command(Request.chatUpdate, { input: "" });
    expect(plain(lou.get("st_message"))).not.toContain("a line lou must not get");

    // The other way round it is one-way: bobby still hears lou.
    await lou.command(Request.chatUpdate, { input: "hello bobby" });
    await bobbySocket.until((m) => chatLines(m).some((l) => l.includes("hello bobby")));
    // Unblocked, the line gets through.
    const list = await modernLou.request<{ blocks: { id: number }[] }>("GET", "/api/blocks");
    await modernLou.request("DELETE", `/api/blocks/${list.body.blocks[0]?.id}`);
    await bobby.act({ type: "chat", text: "a line lou may get" });
    await lou.command(Request.chatUpdate, { input: "" });
    expect(plain(lou.get("st_message"))).toContain("a line lou may get");
  });
});

describe("museum players and mutes", () => {
  it("drops a muted player's cafe line, tells them, and refuses their letters and announcements", async () => {
    const { lou, carolSocket } = await setup();
    const account = (h as Harness).server.accounts.findByLogin("lou");
    const mute = (scopes: string[]) =>
      admin(h as Harness, "POST", "/admin/moderation/mute", {
        accountId: account?.id,
        scopes,
        hours: 1,
        reason: "test",
      });

    // Unmuted, the line reaches the modern player.
    await lou.command(Request.chatUpdate, { input: "hello cafe" });
    await carolSocket.until((m) => chatLines(m).some((l) => l.includes("hello cafe")));
    carolSocket.messages.length = 0;

    const chatMute = await mute(["chat"]);
    expect(chatMute.status).toBe(200);
    await lou.command(Request.chatUpdate, { input: "muted words" });
    expect(plain(lou.get("st_message"))).toContain("muted from cafe talk");
    await new Promise((r) => setTimeout(r, 150));
    expect(chatLines(carolSocket.messages).join("|")).not.toContain("muted words");

    await admin(h as Harness, "POST", "/admin/moderation/unmute", {
      muteId: (chatMute.body as { mute: { id: number } }).mute.id,
      reason: "done",
    });
    await lou.command(Request.chatUpdate, { input: "free again" });
    await carolSocket.until((m) => chatLines(m).some((l) => l.includes("free again")));

    // Letters and announcements: the original client can only be told with its error line.
    await mute(["mail", "announcements"]);
    await lou.command(Request.sendMail, { input: "a muted letter" });
    expect(lou.num("i_sent")).toBe(-1);
    expect(plain(lou.get("g_st_error"))).toContain(
      "muted from letters and battle quotes and announcements",
    );
    await lou.checkLogon();
    await lou.logon("lou", PASSWORD);
    await lou.command(Request.announcement, { note: "a muted announcement" });
    expect(lou.num("i_sent")).toBe(-1);
    expect(plain(lou.get("g_st_error"))).toContain("muted");
    expect(
      JSON.stringify((h as Harness).server.host.get("main")?.snapshotState.news),
    ).not.toContain("muted announcement");
  });
});

describe("museum players and the strict word list", () => {
  it("refuses a listed name at sign-up and a listed word in an announcement", async () => {
    dir = mkdtempSync(join(tmpdir(), "fq-museum-list-"));
    const file = join(dir, "list.txt");
    writeFileSync(file, "flurbo\n");
    h = await startServer({ config: { legacyClient: true, blocklistFile: file } });
    const flash = new FlashClient(h.server.app, "/museum");
    await flash.checkLogon();
    await flash.newUser({
      logon: "lou",
      password: PASSWORD,
      name: "Flurbo",
      parlor: "Lou Rest",
      email: "x@example.com",
    });
    expect(flash.num("i_sent")).toBe(4);
    expect(plain(flash.get("g_st_error"))).toContain("name uses language");
    expect(plain(flash.get("g_st_error")).toLowerCase()).not.toContain("flurbo");
    expect(h.server.accounts.findByLogin("lou")).toBeUndefined();
    await flash.newUser({
      logon: "lou",
      password: PASSWORD,
      name: "Lou",
      parlor: "Flurbo Rest",
      email: "x@example.com",
    });
    expect(flash.num("i_sent")).toBe(4);
    expect(plain(flash.get("g_st_error"))).toContain("parlor name");

    await flash.newUser({
      logon: "lou",
      password: PASSWORD,
      name: "Lou Legacy",
      parlor: "Lou Rest",
      email: "x@example.com",
    });
    expect(flash.num("i_sent")).toBe(5);
    await flash.command(Request.announcement, { note: "flurbo for sale" });
    expect(flash.num("i_sent")).toBe(-1);
    expect(plain(flash.get("g_st_error"))).toContain("announcement uses language");
  });
});
