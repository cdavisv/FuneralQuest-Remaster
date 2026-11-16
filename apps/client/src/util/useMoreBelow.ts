import { type RefObject, useEffect, useState } from "react";

/** True while the element has text below what it shows (it scrolls and is not at the end). */
export function useMoreBelow(ref: RefObject<HTMLElement | null>, key: string): boolean {
  const [more, setMore] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: key is the trigger (a new text).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 2);
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(el);
    const first = el.firstElementChild;
    if (first) observer?.observe(first);
    return () => {
      el.removeEventListener("scroll", measure);
      observer?.disconnect();
    };
  }, [ref, key]);
  return more;
}
