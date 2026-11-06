import { type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A modal surface: role=dialog, focus moves in on open, Tab stays inside, and focus returns
 * to where it was on close. Escape is handled one level up so every overlay kind closes
 * the same way. The caller marks the page behind it `inert`.
 */
export function Dialog({
  className,
  labelledBy,
  describedBy,
  children,
}: {
  className: string;
  labelledBy: string;
  describedBy?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    if (root) {
      const preferred = root.querySelector<HTMLElement>("[data-autofocus]");
      const first = root.querySelector<HTMLElement>(FOCUSABLE);
      (preferred ?? first ?? root).focus();
    }
    return () => {
      if (previous && document.contains(previous)) previous.focus();
    };
  }, []);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !ref.current) return;
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) {
      e.preventDefault();
      return;
    }
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === ref.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fq-backdrop">
      <div
        ref={ref}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
