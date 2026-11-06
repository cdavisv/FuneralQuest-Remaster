import { classicPack, vintagePack } from "@fq/content";
import {
  MemorySaveStorage,
  type PortLike,
  type SaveSummary,
  serveSolo,
  type WorkerLike,
} from "@fq/solo";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.js";
import { splitDesk } from "../src/components/DeskMenu.js";
import type { SoloPlatform } from "../src/solo/platform.js";
import { Autosaver } from "../src/solo/SoloSession.js";
import { renderGame, viewWith } from "./helpers.js";
import { StubBackend } from "./stubBackend.js";

type Listener = (event: { data: unknown }) => void;

/** A Solo worker that runs in this thread: the real `serveSolo`, over a pair of in-memory ports. */
function loopbackWorker(): WorkerLike {
  const toWorker = new Set<Listener>();
  const toPage = new Set<Listener>();
  const deliver = (to: Set<Listener>, data: unknown) =>
    queueMicrotask(() => {
      for (const l of [...to]) l({ data: structuredClone(data) });
    });
  const port: PortLike = {
    postMessage: (message) => deliver(toPage, message),
    addEventListener: (_type, listener) => void toWorker.add(listener),
  };
  serveSolo(port, [classicPack, vintagePack]);
  return {
    postMessage: (message) => deliver(toWorker, message),
    addEventListener: (_type, listener) => void toPage.add(listener),
  };
}

function platform(
  storage = new MemorySaveStorage(),
): SoloPlatform & { storage: MemorySaveStorage } {
  let tick = 0;
  return {
    storage,
    createWorker: loopbackWorker,
    newSeed: () => 12345,
    now: () => 1_700_000_000_000 + ++tick * 1000,
  };
}

function renderSolo(backend: StubBackend, solo: SoloPlatform) {
  return render(
    <App backend={backend} solo={solo} settings={{ typewriter: "off", layout: "classic" }} />,
  );
}

const field = (name: string) => screen.getByLabelText(name, { exact: true });

beforeEach(() => {
  window.location.hash = "";
  window.history.replaceState(null, "", "/");
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("online or solo", () => {
  it("asks first, and Play online goes to the log-on plaque", async () => {
    const user = userEvent.setup();
    renderSolo(new StubBackend(), platform());
    expect(
      await screen.findByRole("heading", { name: "How would you like to play?" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: /^Play online/ }));
    expect(await screen.findByText("Please enter your name and password")).toBeVisible();
    // The way back to the choice is a link, not a dead end.
    await user.click(screen.getByRole("button", { name: "Online or solo" }));
    expect(
      await screen.findByRole("heading", { name: "How would you like to play?" }),
    ).toBeVisible();
  });

  it("without solo support the door goes straight to the log-on plaque, as before", async () => {
    render(<App backend={new StubBackend()} settings={{ layout: "classic" }} />);
    expect(await screen.findByText("Please enter your name and password")).toBeVisible();
    expect(screen.queryByText("How would you like to play?")).toBeNull();
  });

  it("says online is not possible when the server cannot be reached, and focuses solo", async () => {
    const backend = new StubBackend();
    backend.townsFail = true;
    renderSolo(backend, platform());
    const online = await screen.findByRole("button", { name: /^Play online/ });
    await waitFor(() => expect(online).toHaveTextContent("The server could not be reached."));
    expect(screen.getByRole("button", { name: /^Play solo/ })).toHaveFocus();
  });

  it("links to the museum only when the server says it is on", async () => {
    const off = new StubBackend();
    const { unmount } = renderSolo(off, platform());
    await screen.findByText("Connected to Dead Calm.");
    expect(document.querySelector("[data-museum-link]")).toBeNull();
    unmount();

    const on = new StubBackend();
    on.features$ = { museum: { enabled: true, path: "/museum/" } };
    const { unmount: unmount2 } = renderSolo(on, platform());
    await waitFor(() => expect(document.querySelector("[data-museum-link]")).not.toBeNull());
    expect(document.querySelector("[data-museum-link]")).toHaveAttribute("href", "/museum/");

    unmount2();
    const disabled = new StubBackend();
    disabled.features$ = { museum: { enabled: false, path: "/museum/" } };
    renderSolo(disabled, platform());
    await screen.findByText("Connected to Dead Calm.");
    await waitFor(() => expect(disabled.calls).toContain("towns"));
    expect(document.querySelector("[data-museum-link]")).toBeNull();
  });

  it("opens in solo mode when the device is offline", async () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    renderSolo(new StubBackend(), platform());
    expect(await screen.findByRole("heading", { name: "Your solo careers" })).toBeVisible();
    expect(screen.getAllByText("You are offline.").length).toBeGreaterThan(0);
  });
});

describe("a solo career", () => {
  async function newCareer(user: ReturnType<typeof userEvent.setup>, name = "Pat Solo") {
    await user.click(await screen.findByRole("button", { name: /^Play solo/ }));
    await user.click(await screen.findByRole("button", { name: "New career" }));
    await user.type(field("What's your name?"), name);
    await user.type(field("What is your parlor called?"), `${name} Rest`);
    await user.click(screen.getByRole("radio", { name: "Female" }));
    await user.click(screen.getByRole("button", { name: "open the parlor" }));
  }

  it("refuses what the form can see is wrong, naming the characters", async () => {
    const user = userEvent.setup();
    renderSolo(new StubBackend(), platform());
    await user.click(await screen.findByRole("button", { name: /^Play solo/ }));
    await user.click(await screen.findByRole("button", { name: "New career" }));
    await user.click(screen.getByRole("button", { name: "open the parlor" }));
    expect(await screen.findAllByText("Please fill this in.")).not.toHaveLength(0);
    await user.type(field("What's your name?"), "Bo@b");
    await user.type(field("What is your parlor called?"), "Bob Rest");
    await user.click(screen.getByRole("button", { name: "open the parlor" }));
    expect(await screen.findByText(/not allowed in names/)).toBeVisible();
    await user.clear(field("What's your name?"));
    await user.type(field("What's your name?"), "Bob");
    await user.click(screen.getByRole("button", { name: "open the parlor" }));
    expect(await screen.findByText("Please click one of the skulls.")).toBeVisible();
  });

  it("starts in the worker, saves at once, and lists, exports and deletes the save", async () => {
    const user = userEvent.setup();
    const solo = platform();
    renderSolo(new StubBackend(), solo);
    await newCareer(user);
    expect(await screen.findByText(/has been opened/, {}, { timeout: 5000 })).toBeVisible();
    // The slot exists before anything has been done.
    const saved = await solo.storage.list();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      playerName: "Pat Solo",
      parlor: "Pat Solo Rest",
      mode: "career",
    });

    // Leaving returns to the list, with the career in it.
    await user.click(document.querySelector(".fq-exit") as HTMLElement);
    await user.click(await screen.findByRole("button", { name: "Leave" }));
    const row = await screen.findByText("Pat Solo", { selector: ".fq-save-name" });
    const item = row.closest(".fq-save") as HTMLElement;
    expect(item).toHaveTextContent("Day 1 of 30");

    // Export hands the browser a file with the save in it.
    const createUrl = vi.fn(() => "blob:test");
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    await user.click(within(item).getByRole("button", { name: "Export" }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    const blob = (createUrl.mock.calls[0] as unknown as [Blob])[0];
    expect(JSON.parse(await blob.text())).toMatchObject({
      format: "fq-solo",
      version: expect.any(Number),
    });

    // Delete asks first.
    await user.click(within(item).getByRole("button", { name: "Delete" }));
    await user.click(within(item).getByRole("button", { name: "Keep it" }));
    expect(await solo.storage.list()).toHaveLength(1);
    await user.click(within(item).getByRole("button", { name: "Delete" }));
    await user.click(within(item).getByRole("button", { name: "Delete it" }));
    await waitFor(async () => expect(await solo.storage.list()).toHaveLength(0));
    expect(await screen.findByText(/No careers yet/)).toBeVisible();
  });

  it("imports a save file, and refuses one that is not a save", async () => {
    const user = userEvent.setup();
    const source = platform();
    const { unmount } = renderSolo(new StubBackend(), source);
    await newCareer(user, "Ivy Solo");
    await screen.findByText(/has been opened/, {}, { timeout: 5000 });
    const [summary] = (await source.storage.list()) as [SaveSummary];
    const file = JSON.stringify(await source.storage.read(summary.slot));
    unmount();
    window.sessionStorage.clear();

    const target = platform();
    renderSolo(new StubBackend(), target);
    await user.click(await screen.findByRole("button", { name: /^Play solo/ }));
    const input = await screen.findByTestId("solo-import");
    fireEvent.change(input, {
      target: { files: [new File(['{"hello":1}'], "x.json", { type: "application/json" })] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("not a Funeral Quest Solo save");
    fireEvent.change(input, {
      target: { files: [new File([file], "career.fqsave.json", { type: "application/json" })] },
    });
    expect(await screen.findByText("Imported. It is in your list.")).toBeVisible();
    expect(await target.storage.list()).toHaveLength(1);
    // Continue opens it where it was.
    await user.click(await screen.findByRole("button", { name: "Continue" }));
    expect(await screen.findByText(/has been opened/, {}, { timeout: 5000 })).toBeVisible();
  });

  it("a reload in the middle of a career goes straight back into it", async () => {
    const user = userEvent.setup();
    const solo = platform();
    const first = renderSolo(new StubBackend(), solo);
    await newCareer(user, "Rey Solo");
    await screen.findByText(/has been opened/, {}, { timeout: 5000 });
    first.unmount();
    expect(window.sessionStorage.getItem("fq.solo.playing.v1")).not.toBeNull();
    renderSolo(new StubBackend(), solo);
    expect(await screen.findByText(/has been opened/, {}, { timeout: 5000 })).toBeVisible();
  });
});

describe("the autosaver", () => {
  afterEach(() => vi.useRealTimers());

  const client = () => ({ save: vi.fn(async () => ({ saved: true })) });
  const storage = () => ({ write: vi.fn(async () => undefined) });

  it("writes once for a burst of changes, no later than the delay after the first", async () => {
    vi.useFakeTimers();
    const c = client();
    const s = storage();
    // biome-ignore lint/suspicious/noExplicitAny: a stand-in for the worker proxy
    const saver = new Autosaver(c as any, s as any, "slot", 800);
    saver.touch();
    await vi.advanceTimersByTimeAsync(300);
    saver.touch();
    saver.touch();
    await vi.advanceTimersByTimeAsync(400);
    expect(s.write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(s.write).toHaveBeenCalledTimes(1);
    expect(s.write).toHaveBeenCalledWith("slot", { saved: true });
    // The next change starts the next write.
    saver.touch();
    await vi.advanceTimersByTimeAsync(900);
    expect(s.write).toHaveBeenCalledTimes(2);
  });

  it("flushes at once, writes nothing when nothing changed, and reports a failure", async () => {
    const c = client();
    const s = storage();
    const failures: (Error | null)[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: a stand-in for the worker proxy
    const saver = new Autosaver(c as any, s as any, "slot", 800, (f) => failures.push(f));
    await saver.flush();
    expect(s.write).not.toHaveBeenCalled();
    saver.touch();
    await saver.flush();
    expect(s.write).toHaveBeenCalledTimes(1);
    s.write.mockRejectedValueOnce(new Error("disk full"));
    await saver.flush(true);
    expect(failures.at(-1)?.message).toBe("disk full");
    await saver.flush(true);
    expect(failures.at(-1)).toBeNull();
  });
});

describe("the desk's capsule menu", () => {
  const desk = viewWith({
    scene: "desk",
    title: "Your desk",
    buttons: [
      { id: "desk:wait", label: "Wait for Customer" },
      { id: "go:map", label: "Town Map" },
      { id: "go:news", label: "Read Paper" },
      { id: "go:stats", label: "Stats" },
      { id: "go:rankings", label: "Rankings" },
      { id: "go:mailbox", label: "Write Letter" },
      { id: "desk:quit", label: "Exit" },
      { id: "solo:end-day", label: "End the Day" },
    ],
  });

  it("splits the fixed places from the plaques, in order", () => {
    const parts = splitDesk(desk.buttons, () => true);
    expect(parts?.orbs.map((b) => b.id)).toEqual([
      "go:map",
      "go:news",
      "go:stats",
      "go:rankings",
      "go:mailbox",
    ]);
    expect(parts?.before.map((b) => b.id)).toEqual(["desk:wait"]);
    expect(parts?.after.map((b) => b.id)).toEqual(["desk:quit", "solo:end-day"]);
    // No icons in the art pack, or not a desk: every choice stays a plaque.
    expect(splitDesk(desk.buttons, () => false)).toBeNull();
    expect(splitDesk([{ id: "go:map", label: "Map" }], () => true)).toBeNull();
  });

  it("draws the places as icon buttons, keeps their names and keys, and presses them", async () => {
    const user = userEvent.setup();
    const transport = new (await import("./helpers.js")).ScriptedTransport(desk);
    renderGame(transport);
    const map = await screen.findByRole("button", { name: "Town Map" });
    expect(map).toHaveClass("fq-orb");
    expect(map).toHaveAttribute("aria-keyshortcuts", "2");
    const exits = screen.getAllByRole("button", { name: "Exit" });
    expect(exits.some((b) => b.className.includes("fq-plaque"))).toBe(true);
    expect(screen.getByRole("button", { name: "End the Day" })).toHaveAttribute(
      "aria-keyshortcuts",
      "8",
    );
    await user.click(map);
    expect(transport.sent).toEqual([{ type: "press", buttonId: "go:map" }]);
    // The number keys still follow the order of the View's buttons.
    await user.keyboard("4");
    expect(transport.sent.at(-1)).toEqual({ type: "press", buttonId: "go:stats" });
  });
});
