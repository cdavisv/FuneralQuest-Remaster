import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../src/i18n/I18nContext.js";
import {
  type Box,
  createPadController,
  focusTargets,
  glyphsFor,
  moveFocus,
  nearestBox,
  PAD,
  type PadActions,
  type PadLike,
  pageActions,
  pressFocused,
  REPEAT_EVERY_MS,
  REPEAT_FIRST_MS,
  submitFocused,
} from "../src/input/gamepad.js";
import { PadProvider } from "../src/input/PadProvider.js";
import { renderGame, ScriptedTransport } from "./helpers.js";
import { xview } from "./xviews.js";

const box = (left: number, top: number, w = 100, h = 40): Box => ({
  left,
  top,
  right: left + w,
  bottom: top + h,
});

describe("moving to the nearest control", () => {
  const row = [box(0, 400), box(120, 400), box(240, 400), box(360, 400), box(480, 400)];
  const more = [box(300, 460, 80, 30), box(390, 460, 80, 30)];

  it("steps along a row and down to the row under it", () => {
    const all = [...row, ...more];
    expect(nearestBox(row[1] as Box, all, "right")).toBe(2);
    expect(nearestBox(row[1] as Box, all, "left")).toBe(0);
    // Down from the fourth plaque lands on the small button under it, not the one far to the side.
    expect(nearestBox(row[3] as Box, all, "down")).toBe(6);
    expect(nearestBox(row[2] as Box, all, "down")).toBe(5);
    expect(nearestBox(more[1] as Box, all, "up")).toBe(3);
  });

  it("goes nowhere when the edge is reached", () => {
    expect(nearestBox(row[0] as Box, row, "left")).toBe(-1);
    expect(nearestBox(row[4] as Box, row, "right")).toBe(-1);
    expect(nearestBox(row[0] as Box, row, "up")).toBe(-1);
  });

  it("prefers the control in the same column over a nearer one off to the side", () => {
    const from = box(100, 100, 100, 40);
    const sideways = box(220, 150, 100, 40);
    const below = box(100, 260, 100, 40);
    expect(nearestBox(from, [sideways, below], "down")).toBe(1);
  });

  it("orders a card grid the way the eye does", () => {
    const grid = [box(0, 0), box(120, 0), box(0, 60), box(120, 60)];
    expect(nearestBox(grid[0] as Box, grid, "right")).toBe(1);
    expect(nearestBox(grid[1] as Box, grid, "down")).toBe(3);
    expect(nearestBox(grid[3] as Box, grid, "left")).toBe(2);
    expect(nearestBox(grid[2] as Box, grid, "up")).toBe(0);
  });
});

describe("glyphs", () => {
  it("names the face buttons by the family of pad", () => {
    expect(glyphsFor("Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e)").a).toBe("A");
    expect(glyphsFor("054c-0ce6-DualSense Wireless Controller").a).toBe("✕");
    expect(glyphsFor("054c-0ce6-DualSense Wireless Controller").b).toBe("○");
    // The standard mapping's bottom button is B on a Nintendo pad.
    expect(glyphsFor("057e-2009-Pro Controller")).toMatchObject({
      family: "nintendo",
      a: "B",
      b: "A",
    });
    expect(glyphsFor("Some pad").family).toBe("generic");
  });
});

/** A synthetic pad: set what is pressed and where the sticks are, poll at a time. */
function fakePad(id = "Xbox Controller") {
  const state = { buttons: new Set<number>(), axes: [0, 0, 0, 0] };
  const pad = (): PadLike => ({
    index: 0,
    id,
    connected: true,
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: state.buttons.has(i) })),
    axes: [...state.axes],
  });
  return { state, pad };
}

describe("the controller", () => {
  function setup() {
    const calls: string[] = [];
    const actions: PadActions = {
      move: (d) => calls.push(`move:${d}`),
      press: () => calls.push("press"),
      back: () => calls.push("back"),
      submit: () => calls.push("submit"),
      scroll: (n) => calls.push(`scroll:${n}`),
      settings: () => calls.push("settings"),
    };
    const p = fakePad();
    const onInput = vi.fn();
    const controller = createPadController({ getPads: () => [p.pad()], actions, onInput });
    return { calls, p, controller, onInput };
  }

  it("maps A, B, X, the shoulders and Start, once per press", () => {
    const { calls, p, controller } = setup();
    for (const [button, call] of [
      [PAD.a, "press"],
      [PAD.b, "back"],
      [PAD.x, "submit"],
      [PAD.lb, "scroll:-1"],
      [PAD.rb, "scroll:1"],
      [PAD.start, "settings"],
    ] as const) {
      calls.length = 0;
      p.state.buttons = new Set([button]);
      controller.poll(0);
      controller.poll(16);
      controller.poll(32);
      expect(calls, String(button)).toEqual([call]);
      p.state.buttons = new Set();
      controller.poll(48);
    }
  });

  it("moves with the d-pad and the left stick, repeating while held", () => {
    const { calls, p, controller } = setup();
    p.state.buttons = new Set([PAD.right]);
    controller.poll(0);
    controller.poll(REPEAT_FIRST_MS - 1);
    expect(calls).toEqual(["move:right"]);
    controller.poll(REPEAT_FIRST_MS);
    controller.poll(REPEAT_FIRST_MS + REPEAT_EVERY_MS);
    expect(calls).toEqual(["move:right", "move:right", "move:right"]);
    p.state.buttons = new Set();
    controller.poll(1000);
    calls.length = 0;
    p.state.axes = [0, 0.9, 0, 0];
    controller.poll(2000);
    expect(calls).toEqual(["move:down"]);
    p.state.axes = [0, -0.2, 0, 0];
    controller.poll(2010);
    p.state.axes = [-0.8, 0, 0, 0];
    controller.poll(2020);
    expect(calls).toEqual(["move:down", "move:left"]);
  });

  it("scrolls with the right stick and ignores a drifting one", () => {
    const { calls, p, controller } = setup();
    p.state.axes = [0.1, -0.1, 0.2, 0.3];
    controller.poll(0);
    expect(calls).toEqual([]);
    p.state.axes = [0, 0, 0, 0.9];
    controller.poll(100);
    expect(calls).toEqual(["scroll:0.5"]);
  });

  it("reports the pad in use only when something is pressed", () => {
    const { p, controller, onInput } = setup();
    controller.poll(0);
    expect(onInput).not.toHaveBeenCalled();
    p.state.buttons = new Set([PAD.y]);
    controller.poll(16);
    expect(onInput).toHaveBeenCalledTimes(1);
  });
});

/** Gives every control a place on a page that jsdom does not lay out. */
function layout(rects: Record<string, Box>) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const key = this.getAttribute("data-button-id") ?? this.getAttribute("data-rect") ?? "";
    const b = rects[key];
    if (!b)
      return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 } as DOMRect;
    return {
      ...b,
      width: b.right - b.left,
      height: b.bottom - b.top,
      x: b.left,
      y: b.top,
    } as DOMRect;
  });
}

describe("driving the page", () => {
  afterEach(() => vi.restoreAllMocks());

  it("walks a sale's buttons and presses one, like the plaques on the cabinet", async () => {
    const view = xview("negotiation");
    const rects: Record<string, Box> = {};
    const main = view.buttons.filter((b) => b.group === undefined);
    const more = view.buttons.filter((b) => b.group === "more");
    main.forEach((b, i) => {
      rects[b.id] = box(20 + i * 150, 500, 140, 50);
    });
    more.forEach((b, i) => {
      rects[b.id] = box(300 + i * 100, 570, 90, 30);
    });
    layout(rects);
    const transport = new ScriptedTransport(view);
    renderGame(transport);
    await screen.findByRole("heading", { level: 1, name: view.title });
    const actions = pageActions();
    // Nothing focused: the first move lands on the main row.
    actions.move("right");
    expect((document.activeElement as HTMLElement).dataset.buttonId).toBe(main[0]?.id);
    actions.move("right");
    actions.move("right");
    expect((document.activeElement as HTMLElement).dataset.buttonId).toBe(main[2]?.id);
    actions.move("down");
    expect((document.activeElement as HTMLElement).dataset.buttonId).toBe(more[0]?.id);
    actions.move("up");
    expect((document.activeElement as HTMLElement).dataset.buttonId).toBe(main[2]?.id);
    actions.press();
    expect(transport.sent).toEqual([{ type: "press", buttonId: main[2]?.id }]);
  });

  it("stays inside the top dialog, and B closes it", async () => {
    const view = xview("bank");
    const rects: Record<string, Box> = {};
    view.buttons.forEach((b, i) => {
      rects[b.id] = box(20 + i * 120, 500, 110, 50);
    });
    layout(rects);
    renderGame(new ScriptedTransport(view));
    await screen.findByRole("heading", { level: 1, name: view.title });
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const dialog = await screen.findByRole("dialog");
    // The dialog's controls have no layout here either: give them some, stacked.
    const inside = [...dialog.querySelectorAll<HTMLElement>("button, input")];
    inside.forEach((el, i) => {
      el.setAttribute("data-rect", `d${i}`);
      rects[`d${i}`] = box(300, 20 + i * 30, 200, 24);
    });
    expect(focusTargets().every((t) => dialog.contains(t.el))).toBe(true);
    const actions = pageActions();
    actions.move("down");
    expect(dialog.contains(document.activeElement)).toBe(true);
    for (let i = 0; i < 4; i++) actions.move("down");
    expect(dialog.contains(document.activeElement)).toBe(true);
    act(() => actions.back());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("focuses a text field with A and submits its form with X", () => {
    const sent: string[] = [];
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sent.push((e.currentTarget.elements.namedItem("t") as HTMLInputElement).value);
        }}
      >
        <input name="t" data-rect="field" aria-label="Say" defaultValue="hello" />
        <button type="submit" data-rect="go">
          Send
        </button>
      </form>,
    );
    layout({ field: box(0, 0, 200, 30), go: box(0, 50, 100, 30) });
    pressFocused();
    expect(document.activeElement?.getAttribute("name")).toBe("t");
    expect(moveFocus("down")).toBe(true);
    expect(document.activeElement?.textContent).toBe("Send");
    expect(moveFocus("up")).toBe(true);
    expect(submitFocused()).toBe(true);
    expect(sent).toEqual(["hello"]);
    // Outside a form there is nothing to submit.
    (document.activeElement as HTMLElement).blur();
    expect(submitFocused()).toBe(false);
  });

  it("reaches a skull radio hidden under its label", () => {
    render(
      <div>
        <label data-rect="skull">
          <input type="radio" name="s" className="fq-sr" />
          Male
        </label>
        <button type="button" data-rect="next">
          Next
        </button>
      </div>,
    );
    layout({ skull: box(0, 0, 80, 80), next: box(0, 100, 80, 40) });
    expect(focusTargets().map((t) => t.el.tagName)).toEqual(["INPUT", "BUTTON"]);
  });
});

describe("the provider", () => {
  const frames: ((t: number) => void)[] = [];
  let pads: PadLike[];

  beforeEach(() => {
    frames.length = 0;
    pads = [];
    vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => frames.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => pads });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, "getGamepads");
    delete document.documentElement.dataset.input;
  });

  const tick = (t: number) => {
    const next = frames.splice(0);
    act(() => {
      for (const f of next) f(t);
    });
  };

  it("shows the glyphs once a pad is used, hides them for the mouse, and sends Start to Settings", async () => {
    const heard = vi.fn();
    window.addEventListener("fq:settings", heard);
    render(
      <I18nProvider>
        <PadProvider>
          <button type="button">Hello</button>
        </PadProvider>
      </I18nProvider>,
    );
    expect(document.querySelector(".fq-padhints")).toBeNull();
    expect(window.fqClientGamepad).toBe(true);
    pads = [
      {
        index: 0,
        id: "054c-0ce6-DualSense",
        connected: true,
        buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === PAD.start })),
        axes: [0, 0, 0, 0],
      },
    ];
    tick(0);
    expect(document.documentElement.dataset.input).toBe("pad");
    const hints = await screen.findByRole("list", { name: "Gamepad buttons" });
    expect(hints).toHaveTextContent("✕");
    expect(hints).toHaveTextContent("Settings");
    expect(heard).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(window);
    expect(document.documentElement.dataset.input).toBe("pointer");
    window.removeEventListener("fq:settings", heard);
  });

  it("does not touch a page with no Gamepad API", () => {
    Reflect.deleteProperty(navigator, "getGamepads");
    render(
      <I18nProvider>
        <PadProvider>
          <p>plain</p>
        </PadProvider>
      </I18nProvider>,
    );
    expect(window.fqClientGamepad).toBeUndefined();
  });
});
