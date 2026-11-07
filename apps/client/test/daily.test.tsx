import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App.js";
import { StubBackend } from "./stubBackend.js";

function setup(options: { guest?: boolean; status?: StubBackend["dailyStatus"] } = {}) {
  const backend = new StubBackend();
  backend.features$ = {
    museum: { enabled: false, path: "/museum/" },
    dailyChallenge: { enabled: true },
  } as never;
  if (options.status) backend.dailyStatus = options.status;
  if (options.guest) {
    backend.current = { login: "guest-1abcdef", password: null, guest: true, parlors: [] };
  } else {
    backend.current = {
      login: "private.login",
      password: "x",
      guest: false,
      parlors: [],
    };
  }
  backend.tokenKnown = true;
  render(<App backend={backend} settings={{ typewriter: "off", layout: "classic" }} />);
  return backend;
}

const field = (name: string) => screen.getByLabelText(name, { exact: true });

async function openDaily(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Daily Challenge" }));
}

beforeEach(() => {
  window.location.hash = "";
  window.localStorage.clear();
  window.localStorage.setItem("fq.conduct", "2"); // moderation hook: the house rules are agreed
});

describe("the Daily Challenge's board name", () => {
  it("asks what the public board should call the player, and fills in nothing from the account", async () => {
    const user = userEvent.setup();
    setup();
    await openDaily(user);
    expect(await screen.findByText("What should the board call you?")).toBeVisible();
    expect(screen.getByText(/The Daily Challenge board is public/)).toBeVisible();
    expect(field("What's your name?")).toHaveValue("");
    expect(field("What is your parlor called?")).toHaveValue("");
    expect(document.body).not.toHaveTextContent("private.login");
    // No way to start before choosing.
    await user.click(screen.getByRole("button", { name: "start the challenge" }));
    expect(await screen.findAllByText("Please fill this in.")).not.toHaveLength(0);
  });

  it("starts with the chosen name and parlor, and sends nothing else", async () => {
    const user = userEvent.setup();
    const backend = setup();
    await openDaily(user);
    await user.type(
      await screen.findByLabelText("What's your name?", { exact: true }),
      "Moon Face",
    );
    await user.type(field("What is your parlor called?"), "Crescent Rest");
    await user.click(screen.getByRole("radio", { name: "Male" }));
    await user.click(screen.getByRole("button", { name: "start the challenge" }));
    await waitFor(() => expect(backend.dailyOpened).toHaveLength(1));
    expect(backend.dailyOpened[0]).toEqual({
      name: "Moon Face",
      parlor: "Crescent Rest",
      male: true,
    });
    expect(JSON.stringify(backend.dailyOpened)).not.toContain("private.login");
  });

  it("refuses names the engine would strip, like the other forms", async () => {
    const user = userEvent.setup();
    const backend = setup();
    await openDaily(user);
    await user.type(await screen.findByLabelText("What's your name?", { exact: true }), "Bo@b");
    await user.type(field("What is your parlor called?"), "Rest");
    await user.click(screen.getByRole("radio", { name: "Female" }));
    await user.click(screen.getByRole("button", { name: "start the challenge" }));
    expect(await screen.findByText(/not allowed in names/)).toBeVisible();
    expect(backend.dailyOpened).toHaveLength(0);
  });

  it("offers the log-on name only after the player confirms it will be published", async () => {
    const user = userEvent.setup();
    setup();
    await openDaily(user);
    await user.click(await screen.findByRole("button", { name: "Use my log-on name" }));
    const ask = screen.getByRole("group", { name: "Use my log-on name" });
    expect(ask).toHaveTextContent("private.login");
    expect(ask).toHaveTextContent("shown to everyone on the public board");
    // Declining leaves the field empty.
    await user.click(within(ask).getByRole("button", { name: "No, keep it private" }));
    expect(field("What's your name?")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Use my log-on name" }));
    await user.click(screen.getByRole("button", { name: "Yes, show it" }));
    expect(field("What's your name?")).toHaveValue("private.login");
  });

  it("remembers the player's own choice for the next day, not the log-on name", async () => {
    const user = userEvent.setup();
    const backend = setup();
    await openDaily(user);
    await user.type(
      await screen.findByLabelText("What's your name?", { exact: true }),
      "Moon Face",
    );
    await user.type(field("What is your parlor called?"), "Crescent Rest");
    await user.click(screen.getByRole("radio", { name: "Female" }));
    await user.click(screen.getByRole("button", { name: "start the challenge" }));
    await waitFor(() => expect(backend.dailyOpened).toHaveLength(1));
    expect(window.localStorage.getItem("fq.daily.name.v1")).toContain("Moon Face");
    expect(window.localStorage.getItem("fq.daily.name.v1")).not.toContain("private.login");
  });

  it("a guest is told they are not on the board, is not offered a log-on name, and is not remembered", async () => {
    const user = userEvent.setup();
    const backend = setup({ guest: true });
    await openDaily(user);
    expect(await screen.findByText(/Guests are not on the board/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Use my log-on name" })).toBeNull();
    await user.type(field("What's your name?"), "Visitor");
    await user.type(field("What is your parlor called?"), "Passing Through");
    await user.click(screen.getByRole("radio", { name: "Male" }));
    await user.click(screen.getByRole("button", { name: "start the challenge" }));
    await waitFor(() => expect(backend.dailyOpened).toHaveLength(1));
    expect(window.localStorage.getItem("fq.daily.name.v1")).toBeNull();
  });

  it("resuming a run in progress asks for no name", async () => {
    const user = userEvent.setup();
    const backend = setup({ status: "playing" });
    await openDaily(user);
    await user.click(await screen.findByRole("button", { name: "Resume today's challenge" }));
    await waitFor(() => expect(backend.dailyOpened).toEqual([undefined]));
  });
});

describe("past days' boards", () => {
  it("lists the days that have a board and shows the one picked", async () => {
    const user = userEvent.setup();
    const backend = setup();
    await openDaily(user);
    await user.click(await screen.findByRole("button", { name: "Results" }));
    const board = await screen.findByRole("table");
    expect(board).toHaveTextContent("Mourn Ing");
    const pick = (await screen.findByTestId("daily-day")) as HTMLSelectElement;
    expect([...pick.options].map((o) => o.value)).toEqual([
      "2026-11-06",
      "2026-11-05",
      "2026-11-04",
    ]);
    expect(pick.options[0]).toHaveTextContent("2026-11-06 (today)");
    expect(pick.options[1]).toHaveTextContent("2026-11-05, 2 parlors");
    await user.selectOptions(pick, "2026-11-05");
    await waitFor(() => expect(screen.getByRole("table")).toHaveTextContent("Late Bloom"));
    expect(screen.getByRole("table")).toHaveTextContent("Second Place");
    expect(screen.getByRole("table")).not.toHaveTextContent("Mourn Ing");
    expect(backend.boardRequests).toContain("2026-11-05");
    // Back to today asks for the default board.
    await user.selectOptions(screen.getByTestId("daily-day"), "2026-11-06");
    await waitFor(() => expect(screen.getByRole("table")).toHaveTextContent("Mourn Ing"));
  });

  it("with no earlier day there is no day picker", async () => {
    const user = userEvent.setup();
    const backend = setup();
    backend.boards = { "2026-11-06": backend.boards["2026-11-06"] ?? [] };
    await openDaily(user);
    await user.click(await screen.findByRole("button", { name: "Results" }));
    await screen.findByRole("table");
    expect(screen.queryByTestId("daily-day")).toBeNull();
  });
});
