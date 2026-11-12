import type { AuthResponse, FeaturesResponse } from "@fq/server/client";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App.js";
import { describeError } from "../src/net/errors.js";
import { apiError, StubBackend } from "./stubBackend.js";

/** A closed beta: the server asks for an invite code for a new account or a guest. */

const features = (inviteRequired: boolean): FeaturesResponse => ({
  museum: { enabled: false, path: "/museum/" },
  access: { signup: true, guests: true, inviteRequired },
});

/** A stub server that checks invite codes the way the real one does (one good code). */
class InviteBackend extends StubBackend {
  invites: (string | undefined)[] = [];
  constructor(required: boolean) {
    super();
    this.features$ = features(required);
  }
  private check(invite: string | undefined) {
    this.invites.push(invite);
    if (this.features$?.access?.inviteRequired !== true) return;
    const code = (invite ?? "").replace(/[\s-]+/g, "").toUpperCase();
    if (code === "") throw apiError(403, "invite_required", "Invite-only.");
    if (code === "USEDUP2345") throw apiError(403, "invite_used_up", "Used up.");
    if (code === "OLDCODE234") throw apiError(403, "invite_expired", "Expired.");
    if (code !== "ABCDEFGHJK") throw apiError(403, "invite_invalid", "Not recognised.");
  }
  override async signUp(login: string, password: string, invite?: string): Promise<AuthResponse> {
    this.check(invite);
    return super.signUp(login, password);
  }
  override async guest(invite?: string): Promise<AuthResponse> {
    this.check(invite);
    return super.guest();
  }
}

const field = (name: string) => screen.getByLabelText(name, { exact: true });

async function toCredentials(backend: StubBackend) {
  render(<App backend={backend} settings={{ typewriter: "off", layout: "classic" }} />);
  await screen.findByText("Please enter your name and password");
  await userEvent.click(screen.getByRole("button", { name: "New user" }));
  return userEvent.setup();
}

beforeEach(() => {
  window.location.hash = "";
});

describe("the invite code on the sign-up form", () => {
  it("is not there when the server does not require invites", async () => {
    const backend = new InviteBackend(false);
    const user = await toCredentials(backend);
    expect(screen.queryByLabelText("Invite code")).toBeNull();
    await user.type(field("Name"), "openbeta");
    await user.type(field("Password"), "hunter2hunter2");
    await user.click(screen.getByRole("button", { name: "click to continue" }));
    expect(await screen.findByLabelText("What's your name?")).toBeInTheDocument();
    expect(backend.invites).toEqual([undefined]);
  });

  it("is there, with its help line, when the server requires invites, and is sent", async () => {
    const backend = new InviteBackend(true);
    const user = await toCredentials(backend);
    const box = await screen.findByLabelText("Invite code");
    expect(box).toHaveAccessibleDescription(/invite-only for now/);
    await user.type(field("Name"), "closedbeta");
    await user.type(field("Password"), "hunter2hunter2");
    // Nothing typed: said inline, the server is not asked.
    await user.click(screen.getByRole("button", { name: "click to continue" }));
    expect(box).toHaveAccessibleDescription(
      "This server is invite-only for now. Please enter your invite code.",
    );
    expect(backend.invites).toEqual([]);
    await user.type(box, "abcde-fghjk");
    await user.click(screen.getByRole("button", { name: "click to continue" }));
    expect(await screen.findByLabelText("What's your name?")).toBeInTheDocument();
    expect(backend.invites).toEqual(["abcde-fghjk"]);
  });

  it("shows each refusal as a written message under the field", async () => {
    const backend = new InviteBackend(true);
    const user = await toCredentials(backend);
    await user.type(field("Name"), "closedbeta");
    await user.type(field("Password"), "hunter2hunter2");
    const box = await screen.findByLabelText("Invite code");
    for (const [typed, said] of [
      ["ZZZZZ-ZZZZZ", "That invite code is not recognised. Please check it and try again."],
      ["USEDU-P2345", "That invite code has already been used up."],
      ["OLDCO-DE234", "That invite code has expired or been withdrawn."],
    ] as const) {
      await user.clear(box);
      await user.type(box, typed);
      await user.click(screen.getByRole("button", { name: "click to continue" }));
      await waitFor(() => expect(box).toHaveAccessibleDescription(said));
    }
  });
});

describe("the invite code for a guest", () => {
  it("is asked for before a guest starts, only when the server requires invites", async () => {
    const backend = new InviteBackend(true);
    render(<App backend={backend} settings={{ typewriter: "off", layout: "classic" }} />);
    await screen.findByText("Please enter your name and password");
    const user = userEvent.setup();
    expect(screen.queryByLabelText("Invite code")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Play as guest" }));
    const box = await screen.findByLabelText("Invite code");
    expect(backend.invites).toEqual([]);
    await user.type(box, "nope");
    await user.click(screen.getByRole("button", { name: "Start as guest" }));
    await waitFor(() =>
      expect(box).toHaveAccessibleDescription(
        "That invite code is not recognised. Please check it and try again.",
      ),
    );
    await user.clear(box);
    await user.type(box, "ABCDE FGHJK{Enter}");
    expect(await screen.findByLabelText("What's your name?")).toBeInTheDocument();
    expect(backend.invites).toEqual(["nope", "ABCDE FGHJK"]);
  });

  it("is not asked for when the server does not require invites", async () => {
    const backend = new InviteBackend(false);
    render(<App backend={backend} settings={{ typewriter: "off", layout: "classic" }} />);
    await screen.findByText("Please enter your name and password");
    await userEvent.click(screen.getByRole("button", { name: "Play as guest" }));
    expect(await screen.findByLabelText("What's your name?")).toBeInTheDocument();
    expect(screen.queryByLabelText("Invite code")).toBeNull();
  });
});

describe("invite errors", () => {
  it("each have their own message, on the invite field", () => {
    for (const [code, key] of [
      ["invite_required", "form.err.inviteRequired"],
      ["invite_invalid", "form.err.inviteInvalid"],
      ["invite_used_up", "form.err.inviteUsedUp"],
      ["invite_expired", "form.err.inviteExpired"],
    ] as const) {
      expect(describeError(apiError(403, code, "x"), "signup")).toEqual({ field: "invite", key });
    }
  });
});
