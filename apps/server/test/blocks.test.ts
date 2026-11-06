import { afterEach, describe, expect, it } from "vitest";
import {
  connectSocket,
  type Harness,
  type Socket,
  startServer,
  TestPlayer,
} from "./support/harness.js";
import { admin, announce, chatLines, sendLetter, toCafe } from "./support/safety.js";

let h: Harness | null = null;
const sockets: Socket[] = [];
afterEach(async () => {
  for (const s of sockets.splice(0)) s.close();
  await h?.stop();
  h = null;
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function trio() {
  const alice = await new TestPlayer(
    h as Harness,
    "alice",
    "alice long password",
    "10.0.0.1",
  ).signUp();
  const bobby = await new TestPlayer(
    h as Harness,
    "bobby",
    "bobby long password",
    "10.0.0.2",
  ).signUp();
  const carol = await new TestPlayer(
    h as Harness,
    "carol",
    "carol long password",
    "10.0.0.3",
  ).signUp();
  return { alice, bobby, carol };
}

interface BlockBody {
  block: { id: number; name: string; townId: string | null };
  already: boolean;
}

describe("blocking", () => {
  it("keeps a blocked player's cafe lines, letters and gifts from the blocker, and only from the blocker", async () => {
    h = await startServer({ listen: true });
    const { alice, bobby, carol } = await trio();
    await toCafe(alice);
    await toCafe(bobby);
    await toCafe(carol);
    // A wooden tag for bobby to give.
    expect(
      (await admin(h, "PATCH", "/admin/towns/main/players/1", { tags: [1, 0, 0] })).status,
    ).toBe(200);
    const aliceSocket = await connectSocket(h, alice.token);
    const carolSocket = await connectSocket(h, carol.token);
    sockets.push(aliceSocket, carolSocket);

    // Alice blocks bobby by pointing at a line he said.
    await bobby.act({ type: "chat", text: "Evening all" });
    await aliceSocket.until((m) => chatLines(m).some((l) => l.includes("Evening all")));
    const line = chatLines(aliceSocket.messages).find((l) => l.includes("Evening all")) as string;
    const made = await alice.request<BlockBody>("POST", "/api/blocks", {
      townId: "main",
      target: { kind: "chat", text: line },
    });
    expect(made.status).toBe(201);
    expect(made.body.block.name).toBe("bobby");
    aliceSocket.messages.length = 0;
    carolSocket.messages.length = 0;

    // Cafe talk: carol still hears bobby, alice does not.
    await bobby.act({ type: "chat", text: "Can anyone hear me" });
    await carolSocket.until((m) => chatLines(m).some((l) => l.includes("Can anyone hear me")));
    await wait(100);
    expect(chatLines(aliceSocket.messages).join("|")).not.toContain("Can anyone hear me");
    // It is one way: bobby still hears alice.
    const bobSocket = await connectSocket(h, bobby.token);
    sockets.push(bobSocket);
    await alice.act({ type: "chat", text: "Hello from alice" });
    await bobSocket.until((m) => chatLines(m).some((l) => l.includes("Hello from alice")));

    // A gift: alice cannot be found by bobby's /give, and he keeps the tag.
    const gift = await bobby.act({ type: "chat", text: "/give alice wood" });
    expect(gift.status).toBe(200);
    const state = h.server.host.get("main")?.snapshotState;
    expect(state?.players[0]?.tagsReceivedToday).toBe(0);
    expect(state?.players[1]?.tags[0]).toBe(1);
    expect(chatLines(aliceSocket.messages).join("|")).not.toContain("alice");

    // A letter: it never reaches alice's mail or her socket.
    aliceSocket.messages.length = 0;
    expect(await sendLetter(bobby, "alice", "Dear Alice, you are a dreadful undertaker")).toBe(200);
    await wait(100);
    expect(JSON.stringify(h.server.host.get("main")?.snapshotState.players[0]?.mail)).not.toContain(
      "dreadful",
    );
    expect(
      aliceSocket.messages.filter((m) => m.type === "notice" && m.notice.kind === "mail"),
    ).toEqual([]);
    // Carol gets the same letter from bobby without trouble.
    expect(await sendLetter(bobby, "carol", "Dear Carol, lovely weather")).toBe(200);
    expect(JSON.stringify(h.server.host.get("main")?.snapshotState.players[2]?.mail)).toContain(
      "lovely weather",
    );
  });

  it("keeps the engine's lists in step across a reset, a new season, a restart, and a re-created parlor", async () => {
    h = await startServer();
    const { alice, bobby } = await trio();
    await toCafe(alice);
    await toCafe(bobby);
    const made = await alice.request<BlockBody>("POST", "/api/blocks", {
      townId: "main",
      target: { kind: "name", name: "bobby" },
    });
    expect(made.status).toBe(201);
    const blocks = () => h?.server.host.get("main")?.snapshotState.blocks;
    expect(blocks()).toEqual({ "0": [1] });

    // The list is the account's: it survives a restart...
    h = await h.restart();
    alice.h = h;
    bobby.h = h;
    expect(blocks()).toEqual({ "0": [1] });
    const list = await alice.request<{ blocks: { id: number; name: string }[] }>(
      "GET",
      "/api/blocks",
    );
    expect(list.body.blocks.map((b) => b.name)).toEqual(["bobby"]);

    // ...a sysop's town reset (parlors are gone, accounts stay)...
    expect((await admin(h, "POST", "/admin/towns/main/reset", { confirm: "main" })).status).toBe(
      200,
    );
    expect(blocks()).toBeUndefined();
    // ...and applies again as soon as both have parlors in the new season, in either order.
    await bobby.logIn();
    await bobby.enter();
    expect(blocks()).toBeUndefined();
    await alice.logIn();
    await alice.enter();
    expect(blocks()).toEqual({ "1": [0] });
    // The blocked player's parlor is deleted. A newcomer takes the freed slot and is not blocked...
    expect((await admin(h, "DELETE", "/admin/towns/main/players/0")).status).toBe(204);
    const dave = await new TestPlayer(h, "dave", "dave long password", "10.0.0.4").signUp();
    await dave.enter();
    const slotOf = (login: string) => {
      const account = h?.server.accounts.findByLogin(login);
      return account ? h?.server.host.get("main")?.parlorPlayerId(account) : undefined;
    };
    expect(slotOf("dave")).toBe(0);
    expect(blocks()).toBeUndefined();
    // ...and when the blocked player starts again, in a new slot, the block finds them.
    await bobby.enter();
    expect(slotOf("bobby")).toBe(2);
    expect(blocks()).toEqual({ "1": [2] });
  });

  it("follows the account into another town", async () => {
    h = await startServer({
      towns: [
        { id: "main", name: "Main", seed: 1 },
        { id: "second", name: "Second", seed: 2 },
      ],
    });
    const { alice, bobby } = await trio();
    await alice.enter("main");
    await bobby.enter("main");
    await alice.request("POST", "/api/blocks", {
      townId: "main",
      target: { kind: "name", name: "bobby" },
    });
    // Both later start a parlor in the other town: the block is there from the first minute.
    await alice.enter("second");
    await bobby.enter("second");
    expect(h.server.host.get("second")?.snapshotState.blocks).toEqual({ "0": [1] });
  });

  it("unblocks, lists, refuses to block yourself, and shows nothing to the blocked", async () => {
    h = await startServer();
    const { alice, bobby } = await trio();
    await alice.enter();
    await bobby.enter();
    expect(
      (
        await alice.request("POST", "/api/blocks", {
          townId: "main",
          target: { kind: "name", name: "alice" },
        })
      ).status,
    ).toBe(400);
    const made = await alice.request<BlockBody>("POST", "/api/blocks", {
      townId: "main",
      target: { kind: "player", playerId: 1 },
    });
    expect(made.status).toBe(201);
    const again = await alice.request<BlockBody>("POST", "/api/blocks", {
      townId: "main",
      target: { kind: "player", playerId: 1 },
    });
    expect(again.status).toBe(200);
    expect(again.body.already).toBe(true);
    // Bobby sees no sign of it anywhere he can look.
    const bobMe = JSON.stringify((await bobby.request("GET", "/api/me")).body);
    const bobList = JSON.stringify((await bobby.request("GET", "/api/blocks")).body);
    expect(bobList).toBe('{"blocks":[]}');
    expect(bobMe).not.toContain('alice"');
    // Someone else's block cannot be removed.
    expect((await bobby.request("DELETE", `/api/blocks/${made.body.block.id}`)).status).toBe(404);
    expect((await alice.request("DELETE", `/api/blocks/${made.body.block.id}`)).status).toBe(204);
    expect(h.server.host.get("main")?.snapshotState.blocks).toBeUndefined();
    expect((await alice.request<{ blocks: unknown[] }>("GET", "/api/blocks")).body.blocks).toEqual(
      [],
    );
  });

  it("holds when the block is set while the blocked player's chat is already in flight", async () => {
    h = await startServer({ listen: true });
    const { alice, bobby } = await trio();
    await toCafe(alice);
    await toCafe(bobby);
    const aliceSocket = await connectSocket(h, alice.token);
    sockets.push(aliceSocket);
    const town = h.server.host.get("main");
    if (!town) throw new Error("no town");
    // Hold the town's queue so bobby's chat waits in it, then record the block (as the endpoint
    // does, synchronously) before the chat is run.
    let release: () => void = () => undefined;
    const gate = town.enqueue(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const chat = bobby.act({ type: "chat", text: "Nobody blocked me yet" });
    await wait(50);
    const aliceAccount = h.server.accounts.findByLogin("alice");
    const bobbyAccount = h.server.accounts.findByLogin("bobby");
    if (!aliceAccount || !bobbyAccount) throw new Error("accounts");
    h.server.host.moderation.addBlock(aliceAccount, bobbyAccount.id, "bobby");
    release();
    await gate;
    expect((await chat).status).toBe(200);
    await wait(100);
    expect(chatLines(aliceSocket.messages).join("|")).not.toContain("Nobody blocked me yet");

    // The server's own screen catches what the engine's list has not seen yet: even with the
    // engine's list wiped, a line from the blocked player is not pushed to the blocker.
    await town.mutate("test:wipe-blocks", (draft) => {
      delete draft.blocks;
    });
    h.server.host.moderation.blockVersion; // the version has not changed: no re-sync is due
    await bobby.act({ type: "chat", text: "Second line" });
    await wait(100);
    expect(chatLines(aliceSocket.messages).join("|")).not.toContain("Second line");
  });

  it("blocks the author of an announcement and of a letter, from what the reader saw", async () => {
    h = await startServer();
    const { alice, bobby } = await trio();
    await alice.enter();
    await bobby.enter();
    expect((await announce(bobby, "Bobby's Burials: cheap and cheerful")).status).toBe(200);
    // Alice reads the paper, finds the announcement and blocks its author by its text.
    await alice.press("go:desk").catch(() => undefined);
    const text = "Bobby's Burials: cheap and cheerful";
    const made = await alice.request<BlockBody>("POST", "/api/blocks", {
      townId: "main",
      target: {
        kind: "announcement",
        text: `bobby of bobby Rest makes an announcement:\r\n${text}`,
      },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(201);
    expect(made.body.block.name).toBe("bobby");
    // The announcement itself stays in the shared paper: a block never edits public text.
    const paper = JSON.stringify(h.server.host.get("main")?.snapshotState.news);
    expect(paper).toContain("cheap and cheerful");
  });
});
