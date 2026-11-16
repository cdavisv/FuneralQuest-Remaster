import { type RefObject, useEffect, useLayoutEffect } from "react";

/** The sizes tried, largest first: the text is never made smaller than 85% of the chosen size. */
export const FIT_STEPS = [1, 0.94, 0.89, 0.85] as const;
/** Nor smaller than this many pixels, whatever the step. */
export const FIT_MIN_PX = 13;

/**
 * The step to use: the first that fits, or the smallest allowed when none does (the text then
 * scrolls, as it always could). `fits(step)` lays the text out at that step and says whether it
 * fits; `basePx` is the text's size at step 1.
 */
export function chooseFit(fits: (step: number) => boolean, basePx: number): number {
  let chosen: number = FIT_STEPS[0];
  for (const step of FIT_STEPS) {
    if (step < 1 && basePx * step < FIT_MIN_PX) break;
    chosen = step;
    if (fits(step)) return step;
  }
  return chosen;
}

/**
 * Shrinks a text well's type a little when its text would not otherwise fit, so a screen whose
 * text is a line or two too long for the art's well is read without scrolling and without a line
 * cut in half at the bottom. Sets `--fq-fit` on `box` (the scrolling element). `measure` is the
 * element whose height is the whole text (a hidden copy while the typewriter is still writing it),
 * or `box` itself. Off when `enabled` is false (a larger text size chosen in Settings, a chat or a
 * table under the text): then the step is 1.
 */
export function useFitText(
  box: RefObject<HTMLElement | null>,
  measure: RefObject<HTMLElement | null>,
  key: string,
  enabled: boolean,
): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: key is the trigger (a new text).
  useLayoutEffect(() => {
    applyFit(box.current, measure.current ?? box.current, enabled);
  }, [key, enabled]);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let width = el.clientWidth;
    let height = el.clientHeight;
    const observer = new ResizeObserver(() => {
      // Only a change of the box's size refits (the fit changes the text, not the box).
      if (el.clientWidth === width && el.clientHeight === height) return;
      width = el.clientWidth;
      height = el.clientHeight;
      applyFit(el, measure.current ?? el, enabled);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [box, measure, enabled]);
}

function applyFit(box: HTMLElement | null, content: HTMLElement | null, enabled: boolean): void {
  if (!box || !content) return;
  box.style.setProperty("--fq-fit", "1");
  box.style.removeProperty("max-height");
  if (!enabled || box.clientHeight === 0) return;
  const basePx = Number.parseFloat(getComputedStyle(box).fontSize) || 16;
  const room = box.clientHeight;
  const height = () =>
    content === box ? box.scrollHeight : content.getBoundingClientRect().height + paddingY(box);
  const step = chooseFit((s) => {
    box.style.setProperty("--fq-fit", String(s));
    return height() <= room + 1;
  }, basePx);
  box.style.setProperty("--fq-fit", String(step));
  // Still too long: the text scrolls, so the well is made a whole number of lines tall, and the
  // last line in view is never cut in half (the capsule then scrolls by whole lines).
  if (height() > room + 1) {
    const line = lineHeight(box);
    const pad = paddingY(box);
    const lines = Math.floor((room - pad) / line);
    // (A pixel short, so a rounding error never shows a speck of the next line.)
    if (line > 0 && lines >= 2) box.style.maxHeight = `${Math.floor(lines * line + pad) - 1}px`;
  }
}

/** The text's line height in pixels, or 0 when it cannot be told. */
export function lineHeight(box: HTMLElement): number {
  const text = box.querySelector<HTMLElement>(".fq-text") ?? box;
  const cs = getComputedStyle(text);
  const lh = Number.parseFloat(cs.lineHeight);
  if (Number.isFinite(lh) && lh > 0) return lh;
  const px = Number.parseFloat(cs.fontSize);
  return Number.isFinite(px) ? px * 1.45 : 0;
}

function paddingY(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  return (Number.parseFloat(cs.paddingTop) || 0) + (Number.parseFloat(cs.paddingBottom) || 0);
}
