import { type RefObject, useEffect, useLayoutEffect, useState } from "react";

/**
 * True while the element's content is taller than it is, so it scrolls. A scrolling region must be
 * reachable from the keyboard (WCAG 2.1.1, axe `scrollable-region-focusable`), but one that does
 * not scroll should not be an extra stop; the caller gives the element `tabIndex={0}` (and a role
 * and name) only while this is true. Measured after every render and on resize.
 */
export function useScrollable(ref: RefObject<HTMLElement | null>): boolean {
  const [scrollable, setScrollable] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: measures after every render on purpose.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = el.scrollHeight > el.clientHeight + 1;
    setScrollable((was) => (was === next ? was : next));
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScrollable(el.scrollHeight > el.clientHeight + 1);
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(el);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [ref]);
  return scrollable;
}
