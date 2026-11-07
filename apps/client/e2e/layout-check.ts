import type { Page } from "@playwright/test";

/**
 * The layout check shared by the specs: every button on a screen lies inside the cabinet (or the
 * phone's screen), overlaps no other button, and holds its whole label. `layout.spec.ts` runs it
 * on the Expanded screens and `classic-audit.spec.ts` on the Classic ones.
 */
export interface Problem {
  screen: string;
  what: string;
}

/** Looks at the page and returns everything wrong with the buttons on it. */
export async function inspect(page: Page, screen: string, phone: boolean): Promise<Problem[]> {
  return page.evaluate(
    ({ screen, phone }) => {
      const problems: { screen: string; what: string }[] = [];
      const fail = (what: string) => problems.push({ screen, what });
      const rectOf = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
      };
      const named = (el: Element) =>
        `${(el as HTMLElement).dataset.buttonId ?? el.className} "${(el.textContent ?? "").trim().slice(0, 24)}"`;
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
      };
      const buttons = [...document.querySelectorAll("[data-button-id], .fq-stake")].filter(visible);
      if (buttons.length === 0) fail("no buttons on the screen");

      // The cabinet: the drawing itself (the art piece, or the hand-drawn cabinet), else the page.
      const cabinetEl =
        document.querySelector(".fq-cabinet-piece") ??
        document.querySelector(".fq-cabinet-art") ??
        document.querySelector(".fq-cabinet");
      const cab = cabinetEl ? rectOf(cabinetEl) : null;
      const margin = 4;
      for (const el of buttons) {
        const r = rectOf(el);
        if (phone) {
          if (r.x < 0 || r.r > window.innerWidth + 0.5)
            fail(`${named(el)} leaves the screen sideways`);
        } else if (cab) {
          if (
            r.x < cab.x + margin ||
            r.r > cab.r - margin ||
            r.y < cab.y + margin ||
            r.b > cab.b - margin
          ) {
            fail(
              `${named(el)} is outside the cabinet (${Math.round(r.x)},${Math.round(r.y)}-${Math.round(r.r)},${Math.round(r.b)} in ${Math.round(cab.x)},${Math.round(cab.y)}-${Math.round(cab.r)},${Math.round(cab.b)})`,
            );
          }
        }
        // The whole label (and price) inside its button, nothing cut off.
        for (const part of el.querySelectorAll(
          ".fq-plaque-label, .fq-card-label, .fq-card-detail, .fq-card-hint",
        )) {
          const p = rectOf(part);
          if (p.x < r.x - 1.5 || p.r > r.r + 1.5 || p.y < r.y - 1.5 || p.b > r.b + 1.5) {
            fail(`${named(el)} clips its ${part.className}`);
          }
        }
      }
      // No button over another, and no price tag over a button that is not its own.
      for (let i = 0; i < buttons.length; i++) {
        for (let j = i + 1; j < buttons.length; j++) {
          const a = rectOf(buttons[i] as Element);
          const b = rectOf(buttons[j] as Element);
          const w = Math.min(a.r, b.r) - Math.max(a.x, b.x);
          const h = Math.min(a.b, b.b) - Math.max(a.y, b.y);
          if (w > 1 && h > 1)
            fail(`${named(buttons[i] as Element)} overlaps ${named(buttons[j] as Element)}`);
        }
      }
      for (const tag of document.querySelectorAll(".fq-plaque-detail")) {
        const own = tag.closest("[data-button-id]");
        const t = rectOf(tag);
        for (const el of buttons) {
          if (el === own) continue;
          const r = rectOf(el);
          const w = Math.min(t.r, r.r) - Math.max(t.x, r.x);
          const h = Math.min(t.b, r.b) - Math.max(t.y, r.y);
          if (w > 1 && h > 1) fail(`the tag ${named(tag)} touches ${named(el)}`);
        }
      }
      return problems;
    },
    { screen, phone },
  );
}
