import type { CSSProperties } from "react";
import type { CabinetSpec, Fit, Rect } from "./types.js";

/** The design stage of each cabinet layout, in design pixels (`--u` is one of these). */
export const STAGE = { classic: [1024, 745], wide: [1280, 720] } as const;
export type CabinetLayout = keyof typeof STAGE;

export interface Placement {
  x: number;
  y: number;
  w: number;
  h: number;
  scale: number;
}

/** Where a cabinet piece's drawing lands on the layout's stage. */
export function placeArt(spec: CabinetSpec, fit: Fit, layout: CabinetLayout): Placement {
  const [sw, sh] = STAGE[layout];
  const [, , vw, vh] = spec.viewBox;
  const scale = fit.scale * (spec.scaleMul ?? 1);
  const w = vw * scale;
  const h = vh * scale;
  const x = (fit.align === "left" ? 0 : (sw - w) / 2) + (fit.dx ?? 0);
  const y = (sh - h) / 2 + (fit.dy ?? 0);
  return { x, y, w, h, scale };
}

/** A rectangle in art units, moved to the stage in design pixels. */
export function toStage(r: Rect, spec: CabinetSpec, place: Placement): Rect {
  const [vx, vy] = spec.viewBox;
  return {
    x: place.x + (r.x - vx) * place.scale,
    y: place.y + (r.y - vy) * place.scale,
    w: r.w * place.scale,
    h: r.h * place.scale,
  };
}

const px = (n: number) => String(Math.round(n * 100) / 100);

/**
 * CSS variables that put every region where the art says. They override the hand-drawn
 * layout's numbers (all in design pixels, multiplied by `--u` in the stylesheet).
 */
export function cabinetVars(spec: CabinetSpec, fit: Fit, layout: CabinetLayout): CSSProperties {
  const place = placeArt(spec, fit, layout);
  const r = spec.regions;
  const at = (rect: Rect) => toStage(rect, spec, place);
  const text = at(r.text);
  const buttons = at(r.buttons);
  const sheet = r.sheet ? at(r.sheet) : text;
  const vars: Record<string, string> = {
    "--au": `calc(var(--u) * ${px(place.scale)})`,
    "--art-x": px(place.x),
    "--art-y": px(place.y),
    "--art-w": px(place.w),
    "--art-h": px(place.h),
    "--text-x": px(text.x),
    "--text-y": px(text.y),
    "--text-w": px(text.w),
    "--text-h": px(text.h),
    "--sheet-x": px(sheet.x),
    "--sheet-y": px(sheet.y),
    "--sheet-w": px(sheet.w),
    "--sheet-h": px(sheet.h),
    "--btn-x": px(buttons.x),
    "--btn-w": px(buttons.w),
    "--btn-bottom": px(STAGE[layout][1] - (buttons.y + buttons.h)),
    "--plaque-w": px(r.plaque.w * place.scale),
    "--plaque-h": px(r.plaque.h * place.scale),
    "--plaque-gap": px((r.plaque.pitch - r.plaque.w) * place.scale),
  };
  const set = (name: string, rect: Rect | undefined, w = false) => {
    if (!rect) return;
    const b = at(rect);
    vars[`--${name}-x`] = px(b.x);
    vars[`--${name}-y`] = px(b.y);
    vars[`--${name}-w`] = px(b.w);
    if (!w) vars[`--${name}-h`] = px(b.h);
  };
  set("note", r.note);
  set("frame", r.frame);
  set("exit", r.exit, true);
  set("gear", r.gear, true);
  if (r.capsule) {
    // The capsule is drawn inside the text panel, so its offset is relative to that.
    const up = at(r.capsule.up);
    const down = at(r.capsule.down);
    vars["--cap-x"] = px(up.x - sheet.x);
    vars["--cap-y"] = px(up.y - sheet.y);
    vars["--cap-w"] = px(up.w);
    vars["--cap-h"] = px(up.h);
    vars["--cap-gap"] = px(down.y - up.y - up.h);
  }
  if (r.chatBar) {
    const bar = at(r.chatBar);
    vars["--bar-x"] = px(bar.x - text.x);
    vars["--bar-y"] = px(bar.y - text.y);
    vars["--bar-w"] = px(bar.w);
    vars["--bar-h"] = px(bar.h);
  }
  const [il, it, ir, ib] = r.textInset;
  vars["--text-pad-l"] = px(il * place.scale);
  vars["--text-pad-t"] = px(it * place.scale);
  vars["--text-pad-r"] = px(ir * place.scale);
  vars["--text-pad-b"] = px(ib * place.scale);
  if (layout === "wide") {
    // The wood side panel for earlier text, flush right of the cabinet.
    const [sw, sh] = STAGE.wide;
    const x = place.x + place.w + 2;
    vars["--log-x"] = px(x);
    vars["--log-y"] = px(place.y);
    vars["--log-w"] = px(sw - 14 - x);
    vars["--log-h"] = px(Math.min(place.h, sh - 2 * place.y));
  }
  return vars as CSSProperties;
}

/** `calc(var(--au) * n)`: n art units as a length. */
export const au = (n: number): string => `calc(var(--au) * ${Math.round(n * 100) / 100})`;

/** left/top/width/height for `rect`, in art units, relative to the top-left of `origin`. */
export function relBox(rect: Rect, origin: Rect): CSSProperties {
  return {
    left: au(rect.x - origin.x),
    top: au(rect.y - origin.y),
    width: au(rect.w),
    height: au(rect.h),
  };
}
