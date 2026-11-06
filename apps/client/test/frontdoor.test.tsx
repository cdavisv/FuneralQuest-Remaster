import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App.js";
import { apiError, StubBackend, TOWN } from "./stubBackend.js";

function renderDoor(backend: StubBackend) {
  return render(<App backend={backend} settings={{ typewriter: "off", layout: "classic" }} />);
}

const field = (name: string) => screen.getByLabelText(name, { exact: true });

async function reachLogon(backend: StubBackend) {
  renderDoor(backend);
  return screen.findByText("Please enter your name and password");
}

beforeEach(() => {
  window.location.hash = "";
});

describe("the title screen", () => {
  it("says it is connecting, then shows the server's status and news from the lobby endpoint", async () => {
    const backend = new StubBackend();
    renderDoor(backend);
    expect(screen.getByText("Connecting to server...")).toBeInTheDocument();
    expect(await screen.findByText("Connected to Dead Calm.")).toBeInTheDocument();
    expect(screen.getByText("Welcome to town. Mind the hearses.")).toBeInTheDocument();
    expect(
      screen.getByText("Game Info: Tournament Mode (day 4) - 3 of 12 players on now."),
    ).toBeInTheDocument();
    const status = document.querySelector(".fq-door-status-list") as HTMLElement;
    expect(status).toHaveTextContent(/Next day in5 h 1[12] min/);
    expect(status).toHaveTextContent("9 days left");
  });

  it("falls back to a plain list for a server that sends no game line", async () => {
    const backend = new StubBackend();
    backend.towns$ = [{ ...TOWN, lobby: undefined as never }];
    renderDoor(backend);
    await screen.findByText("Connected to Dead Calm.");
    const status = document.querySelector(".fq-door-status-list") as HTMLElement;
    expect(status).toHaveTextContent("Day4");
    expect(status).toHaveTextContent("3 online of 12");
  });

  it("says why when the server is not taking new accounts", async () => {
    const backend = new StubBackend();
    backend.towns$ = [
      { ...TOWN, lobby: { ...TOWN.lobby, closed: [{ text: "The town is full." }] } },
    ];
    renderDoor(backend);
    expect(await screen.findByText("The town is full.")).toBeInTheDocument();
  });

  it("links to the rules and the rankings", async () => {
    await reachLogon(new StubBackend());
    const nav = screen.getByRole("navigation", { name: "Information" });
    expect(within(nav).getByRole("button", { name: "Rules" })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "Rankings" })).toBeInTheDocument();
  });

  it("offers a choice when the server has several towns", async () => {
    const backend = new StubBackend();
    backend.towns$ = [TOWN, { ...TOWN, id: "blitz", name: "Quick Burial", dayLengthMinutes: 15 }];
    renderDoor(backend);
    const radio = await screen.findByRole("radio", { name: /Quick Burial/ });
    expect(screen.getByRole("radio", { name: /Dead Calm/ })).toBeChecked();
    await userEvent.click(radio);
    expect(screen.getByText("Connected to Quick Burial.")).toBeInTheDocument();
  });

  it("says so when the server cannot be reached, and tries again on request", async () => {
    const backend = new StubBackend();
    backend.townsFail = true;
    renderDoor(backend);
    expect(await screen.findByText(/could not be reached/)).toBeInTheDocument();
    backend.townsFail = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Connected to Dead Calm.")).toBeInTheDocument();
  });

  it("shows the rankings page from the lobby listing", async () => {
    await reachLogon(new StubBackend());
    await userEvent.click(screen.getByRole("button", { name: "Rankings" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Rankings" })).toBeInTheDocument();
    expect(screen.getByText("Bone Voyage")).toBeInTheDocument();
    expect(screen.getByText("1,850")).toBeInTheDocument();
  });
});

describe("log on", () => {
  it("logs in and enters the town: the game appears", async () => {
    const backend = new StubBackend();
    backend.signedUp("bob", "hunter2hunter2", "Bob");
    await reachLogon(backend);
    const user = userEvent.setup();
    await user.type(field("Name"), "bob");
    await user.type(field("Password"), "hunter2hunter2");
    await user.click(screen.getByRole("button", { name: "Log on" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Your Desk" })).toBeInTheDocument();
    expect(backend.calls).toContain("logIn:bob");
    expect(backend.calls).toContain("enter:main");
    expect(backend.playing).toBe("main");
    expect(backend.last).toBe("main");
  });

  it("shows a wrong password under the password field, empties it, and stays on the plaque", async () => {
    const backend = new StubBackend();
    backend.signedUp("bob", "hunter2hunter2", "Bob");
    await reachLogon(backend);
    const user = userEvent.setup();
    await user.type(field("Name"), "bob");
    await user.type(field("Password"), "wrongwrong");
    await user.click(screen.getByRole("button", { name: "Log on" }));
    const password = screen.getByLabelText("Password", { exact: true });
    await waitFor(() => expect(password).toHaveAccessibleDescription("Wrong name or password."));
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveValue("");
    expect(password).toHaveFocus();
    expect(screen.getByText("Please enter your name and password")).toBeInTheDocument();
  });

  it("asks for both fields before calling the server", async () => {
    const backend = new StubBackend();
    await reachLogon(backend);
    await userEvent.click(screen.getByRole("button", { name: "Log on" }));
    expect(screen.getByLabelText("Name", { exact: true })).toHaveAccessibleDescription(
      "Please fill this in.",
    );
    expect(backend.calls.some((c) => c.startsWith("logIn"))).toBe(false);
  });

  it("sends a returning player with no parlor in this town to open one", async () => {
    const backend = new StubBackend();
    backend.signedUp("newbie", "hunter2hunter2");
    await reachLogon(backend);
    const user = userEvent.setup();
    await user.type(field("Name"), "newbie");
    await user.type(field("Password"), "hunter2hunter2");
    await user.click(screen.getByRole("button", { name: "Log on" }));
    expect(await screen.findByLabelText("What's your name?")).toBeInTheDocument();
  });

  it("never keeps the password: it is not in the page after logging on", async () => {
    const backend = new StubBackend();
    backend.signedUp("bob", "hunter2hunter2", "Bob");
    await reachLogon(backend);
    const user = userEvent.setup();
    await user.type(field("Name"), "bob");
    await user.type(field("Password"), "hunter2hunter2");
    await user.click(screen.getByRole("button", { name: "Log on" }));
    await screen.findByRole("heading", { level: 1, name: "Your Desk" });
    expect(document.body.innerHTML).not.toContain("hunter2hunter2");
    expect(JSON.stringify({ ...window.localStorage })).not.toContain("hunter2hunter2");
  });
});

describe("new user", () => {
  async function toCredentials(backend: StubBackend) {
    await reachLogon(backend);
    await userEvent.click(screen.getByRole("button", { name: "New user" }));
    return userEvent.setup();
  }

  it("checks the log-on name and password inline before asking the server", async () => {
    const backend = new StubBackend();
    const user = await toCredentials(backend);
    await user.type(field("Name"), "ab");
    await user.type(field("Password"), "short");
    await user.click(screen.getByRole("button", { name: "click to continue" }));
    expect(screen.getByLabelText("Name", { exact: true })).toHaveAccessibleDescription(
      "Use 3 to 20 letters, digits, dots, dashes or underscores.",
    );
    expect(backend.calls.some((c) => c.startsWith("signUp"))).toBe(false);
    await user.clear(field("Name"));
    await user.type(field("Name"), "valid.name");
    await user.click(screen.getByRole("button", { name: "click to continue" }));
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAccessibleDescription(
      "The password needs at least 8 characters.",
    );
  });

  it("shows a taken name under the name field", async () => {
    const backend = new StubBackend();
    backend.signedUp("taken", "hunter2hunter2");
    const user = await toCredentials(backend);
    await user.type(field("Name"), "taken");
    await user.type(field("Password"), "hunter2hunter2");
    await user.click(screen.getByRole("button", { name: "click to continue" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Name", { exact: true })).toHaveAccessibleDescription(
        "That name is already taken. Please try another.",
      ),
    );
  });

  it("walks through both screens and enters the town with the parlor form", async () => {
    const backend = new StubBackend();
    const user = await toCredentials(backend);
    await user.type(field("Name"), "grim.reaper");
    await user.type(field("Password"), "hunter2hunter2");
    await user.click(screen.getByRole("button", { name: "click to continue" }));

    expect(await screen.findByLabelText("What's your name?")).toBeInTheDocument();
    // A sex must be chosen: two skulls.
    await user.type(screen.getByLabelText("What's your name?"), "Grim");
    await user.type(screen.getByLabelText("What is your parlor called?"), "Reaper Rest");
    await user.click(screen.getByRole("button", { name: "open the parlor" }));
    expect(screen.getByText("Please click one of the skulls.")).toBeInTheDocument();
    expect(backend.calls.some((c) => c.startsWith("enter"))).toBe(false);

    await user.click(screen.getByRole("radio", { name: "Female" }));
    await user.click(screen.getByRole("button", { name: "open the parlor" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Your Desk" })).toBeInTheDocument();
    expect(backend.calls).toContain("enter:main:Grim/Reaper Rest/F");
  });

  it("shows the server's complaint about a name next to the name field and lets the player fix it", async () => {
    const backend = new StubBackend();
    backend.takenNames.add("Grim");
    const user = await toCredentials(backend);
    await user.type(field("Name"), "grim.two");
    await user.type(field("Password"), "hunter2hunter2");
    await user.click(screen.getByRole("button", { name: "click to continue" }));
    await user.type(await screen.findByLabelText("What's your name?"), "Grim");
    await user.type(screen.getByLabelText("What is your parlor called?"), "Grim Rest");
    await user.click(screen.getByRole("radio", { name: "Male" }));
    await user.click(screen.getByRole("button", { name: "open the parlor" }));
    await waitFor(() =>
      expect(screen.getByLabelText("What's your name?")).toHaveAccessibleDescription(
        "Someone is already using the name Grim. Please try another.",
      ),
    );
    await user.clear(screen.getByLabelText("What's your name?"));
    await user.type(screen.getByLabelText("What's your name?"), "Grimmer");
    await user.click(screen.getByRole("button", { name: "open the parlor" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Your Desk" })).toBeInTheDocument();
  });

  it("refuses characters the game filters out of names before asking", async () => {
    const backend = new StubBackend();
    const user = await toCredentials(backend);
    await user.type(field("Name"), "grim.three");
    await user.type(field("Password"), "hunter2hunter2");
    await user.click(screen.getByRole("button", { name: "click to continue" }));
    await user.type(await screen.findByLabelText("What's your name?"), "Gr@m");
    await user.type(screen.getByLabelText("What is your parlor called?"), "Rest");
    await user.click(screen.getByRole("radio", { name: "Male" }));
    await user.click(screen.getByRole("button", { name: "open the parlor" }));
    expect(screen.getByLabelText("What's your name?")).toHaveAccessibleDescription(
      /not allowed in names/,
    );
    expect(backend.calls.some((c) => c.startsWith("enter"))).toBe(false);
  });

  it("goes back to the main screen from either form", async () => {
    const backend = new StubBackend();
    const user = await toCredentials(backend);
    await user.click(screen.getByRole("button", { name: "return to main" }));
    expect(await screen.findByText("Please enter your name and password")).toBeInTheDocument();
  });
});

describe("guests", () => {
  it("plays as a guest: no password, then the parlor form, then the game", async () => {
    const backend = new StubBackend();
    await reachLogon(backend);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Play as guest" }));
    expect(await screen.findByLabelText("What's your name?")).toBeInTheDocument();
    expect(backend.calls).toContain("guest");
    await user.type(screen.getByLabelText("What's your name?"), "Visitor");
    await user.type(screen.getByLabelText("What is your parlor called?"), "Drop-In Funerals");
    await user.click(screen.getByRole("radio", { name: "Male" }));
    await user.click(screen.getByRole("button", { name: "open the parlor" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Your Desk" })).toBeInTheDocument();
  });

  it("tells the guest that this browser is the only key", async () => {
    const backend = new StubBackend();
    backend.current = { login: "guest-abc", password: null, guest: true, parlors: [] };
    backend.tokenKnown = true;
    renderDoor(backend);
    expect(await screen.findByText(/this browser is the only key/)).toBeInTheDocument();
  });

  it("says when guests are not allowed", async () => {
    const backend = new StubBackend();
    backend.guest = async () => {
      throw apiError(403, "guest_disabled", "Guest accounts are not allowed on this server.");
    };
    await reachLogon(backend);
    await userEvent.click(screen.getByRole("button", { name: "Play as guest" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("not allowed on this server");
  });
});

describe("a returning player", () => {
  it("is welcomed back by name and continues into the game", async () => {
    const backend = new StubBackend();
    backend.current = backend.signedUp("bob", "hunter2hunter2", "Bob");
    backend.tokenKnown = true;
    renderDoor(backend);
    expect(await screen.findByText("Welcome back, Bob.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Password", { exact: true })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Open the parlor" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Your Desk" })).toBeInTheDocument();
  });

  it("logs out: the token is dropped and the plaque asks for a name again", async () => {
    const backend = new StubBackend();
    backend.current = backend.signedUp("bob", "hunter2hunter2", "Bob");
    backend.tokenKnown = true;
    renderDoor(backend);
    await userEvent.click(await screen.findByRole("button", { name: "Log out" }));
    expect(await screen.findByText("Please enter your name and password")).toBeInTheDocument();
    expect(backend.calls).toContain("logOut");
    expect(backend.tokenKnown).toBe(false);
  });

  it("forgets a refused token and shows the plain log-on plaque", async () => {
    const backend = new StubBackend();
    backend.tokenKnown = true; // stored, but the server no longer knows it
    renderDoor(backend);
    expect(await screen.findByText("Please enter your name and password")).toBeInTheDocument();
    expect(backend.calls).toContain("forget");
  });

  it("goes straight back into the game after a reload mid-session", async () => {
    const backend = new StubBackend();
    backend.current = backend.signedUp("bob", "hunter2hunter2", "Bob");
    backend.tokenKnown = true;
    backend.playing = "main";
    backend.last = "main";
    renderDoor(backend);
    expect(await screen.findByRole("heading", { level: 1, name: "Your Desk" })).toBeInTheDocument();
  });

  it("does not take over a session by itself in a freshly opened tab", async () => {
    const backend = new StubBackend();
    backend.current = backend.signedUp("bob", "hunter2hunter2", "Bob");
    backend.tokenKnown = true;
    renderDoor(backend);
    await screen.findByText("Welcome back, Bob.");
    expect(backend.calls.some((c) => c.startsWith("enter"))).toBe(false);
  });
});

describe("leaving the game", () => {
  it("Exit goes back to the front door with the player still known", async () => {
    const backend = new StubBackend();
    backend.current = backend.signedUp("bob", "hunter2hunter2", "Bob");
    backend.tokenKnown = true;
    renderDoor(backend);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Open the parlor" }));
    await user.click(await screen.findByRole("button", { name: "Exit" }));
    await user.click(screen.getByRole("button", { name: "Leave" }));
    expect(await screen.findByText("Welcome back, Bob.")).toBeInTheDocument();
    expect(backend.transports[0]?.sent).toEqual([{ type: "exit" }]);
    expect(backend.playing).toBeNull();
  });

  it("a session ended by the server offers the way back, too", async () => {
    const backend = new StubBackend();
    backend.current = backend.signedUp("bob", "hunter2hunter2", "Bob");
    backend.tokenKnown = true;
    renderDoor(backend);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Open the parlor" }));
    await screen.findByRole("heading", { level: 1, name: "Your Desk" });
    backend.transports[0]?.notice({ kind: "sessionEnded", reason: "timeout" });
    expect(await screen.findByText(/away for too long/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to the front door" }));
    expect(await screen.findByText("Welcome back, Bob.")).toBeInTheDocument();
  });
});

describe("the static pages", () => {
  it("opens the original's pages at #/rules and friends, and goes back to play", async () => {
    window.location.hash = "#/rules";
    renderDoor(new StubBackend());
    expect(await screen.findByRole("heading", { level: 1, name: "Rules" })).toBeInTheDocument();
    expect(screen.getByText(/One account per person/)).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Gameplay tips" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Gameplay Tips" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Hard Sell/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(await screen.findByText("Please enter your name and password")).toBeInTheDocument();
  });

  it("credits the original authors before the remaster, from CREDITS.md", async () => {
    window.location.hash = "#/credits";
    renderDoor(new StubBackend());
    const page = await screen.findByRole("main");
    const text = page.textContent ?? "";
    const original = text.indexOf("Seth A. Robinson");
    const art = text.indexOf("Akiko Robinson");
    const remaster = text.indexOf("The remaster is an independent");
    expect(original).toBeGreaterThan(-1);
    expect(art).toBeGreaterThan(original);
    expect(remaster).toBeGreaterThan(art);
    expect(text).toContain("Special thanks");
  });
});

describe("the real-server entry errors", () => {
  it("a refused token during enter shows a message and the log-on plaque", async () => {
    const backend = new StubBackend();
    backend.current = backend.signedUp("bob", "hunter2hunter2", "Bob");
    backend.tokenKnown = true;
    renderDoor(backend);
    await screen.findByText("Welcome back, Bob.");
    // The server no longer knows the token by the time the player clicks.
    backend.current = null;
    await userEvent.click(screen.getByRole("button", { name: "Open the parlor" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("sign-in has expired");
  });
});
