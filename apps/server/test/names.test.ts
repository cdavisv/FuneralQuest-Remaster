import { classicPack } from "@fq/content";
import { classicContext, createPlayer, createTown, type EngineContext } from "@fq/core";
import { afterEach, describe, expect, it } from "vitest";
import { ApiClient, ApiError } from "../src/client/index.js";
import { checkNames, forbiddenNameChars, NAME_FORBIDDEN } from "../src/game/names.js";
import { type Harness, startServer, TestPlayer } from "./support/harness.js";

let h: Harness | null = null;
afterEach(async () => {
  await h?.stop();
  h = null;
});

describe("characters the engine strips from names", () => {
  it("mirrors the engine: every ASCII character it removes is forbidden here, and no other", () => {
    const ctx: EngineContext = classicContext(classicPack, { now: 1_000_000 });
    const town = createTown({ seed: 1 }, ctx).town;
    const stripped: string[] = [];
    for (let code = 33; code <= 127; code++) {
      const ch = String.fromCharCode(code);
      // "Zq<ch>x" keeps its length when the character stays, loses one when the engine strips it.
      const made = createPlayer(
        town,
        {
          logon: "probe",
          name: `Zq${ch}x`,
          parlor: "Probe Rest",
          password: "secret",
          passwordVerify: "secret",
          male: true,
          email: "none",
        },
        ctx,
      );
      if (made.ok && made.town.players[made.playerId]?.name === "Zqx") stripped.push(ch);
    }
    expect(stripped.sort().join("")).toBe([...NAME_FORBIDDEN].sort().join(""));
  });

  it("names the offending characters, once each, in order", () => {
    expect(forbiddenNameChars("Bo@b")).toEqual(["@"]);
    expect(forbiddenNameChars("a%b@c%")).toEqual(["%", "@"]);
    expect(checkNames({ name: "Bo@b", parlor: "Fine" })).toMatchObject({
      field: "name",
      message: "Names cannot contain @.",
    });
    expect(checkNames({ name: "Bob", parlor: "R&B ~ $ Rest" })).toMatchObject({
      field: "parlor",
      message: "Parlor names cannot contain ~ and $.",
    });
    expect(checkNames({ name: "a@b%c$", parlor: "x" })?.message).toBe(
      "Names cannot contain @, % and $.",
    );
    expect(checkNames({ name: "Bob O'Neil-Smith & Sons (1901)!", parlor: "Rest Inc." })).toBeNull();
  });
});

describe("entering a town with a name the engine would change", () => {
  it("is refused up front with the characters named, not as a name already taken", async () => {
    h = await startServer();
    const bob = await new TestPlayer(h, "bobby").signUp();
    await bob.enter("main", { name: "Bob", parlor: "Bob Rest", male: true });

    const sneaky = await new TestPlayer(h, "sneaky", "sneaky long password", "10.0.0.2").signUp();
    const r = await sneaky.request<{
      error: string;
      message: string;
      field: string;
      richMessage: { text: string }[];
    }>("POST", "/api/towns/main/enter", {
      parlor: { name: "Bo@b", parlor: "Sneaky Rest", male: true },
    });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({
      error: "invalid_parlor",
      message: "Names cannot contain @.",
      field: "name",
      richMessage: [{ text: "Names cannot contain @." }],
    });

    const parlor = await sneaky.request<{ message: string; field: string }>(
      "POST",
      "/api/towns/main/enter",
      { parlor: { name: "Sneaky", parlor: "Rest <b>& Sons</b>", male: true } },
    );
    expect(parlor.status).toBe(422);
    expect(parlor.body).toMatchObject({
      field: "parlor",
      message: "Parlor names cannot contain <, > and /.",
    });

    // Nothing was created, and an honest name still works.
    expect(h.server.host.get("main")?.snapshotState.players.map((p) => p.name)).toEqual(["Bob"]);
    const ok = await sneaky.request("POST", "/api/towns/main/enter", {
      parlor: { name: "Sneaky", parlor: "Sneaky Rest", male: true },
    });
    expect(ok.status).toBe(200);
  });

  it("reaches the typed client with the field", async () => {
    h = await startServer({ listen: true });
    const api = new ApiClient({ baseUrl: h.baseUrl() });
    await api.signUp("typed", "typed long password");
    const err = await api
      .enter("main", { parlor: { name: "Ty|ped", parlor: "Typed Rest", male: false } })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("invalid_parlor");
    expect((err as ApiError).field).toBe("name");
    expect((err as ApiError).message).toBe("Names cannot contain |.");
  });
});
