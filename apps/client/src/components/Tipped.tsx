import { type ReactNode, useId, useState } from "react";

/**
 * A control with a tooltip that works without a mouse: shown on hover and focus, and toggled by
 * a tap or Enter, so touch players can read it too. The tooltip is the control's description for
 * screen readers.
 */
export function Tipped({
  tip,
  children,
  className = "",
  tone,
  disabled,
  onActivate,
  placement = "above",
}: {
  tip: string | undefined;
  children: ReactNode;
  className?: string;
  tone?: string;
  disabled?: boolean;
  onActivate?: () => void;
  placement?: "above" | "below";
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  if (!tip) {
    return (
      <span className={className} data-tone={tone}>
        {children}
      </span>
    );
  }
  return (
    <span className={`fq-tipped ${className}`} data-tone={tone} data-open={open || undefined}>
      <button
        type="button"
        className="fq-tipped-btn"
        aria-describedby={id}
        aria-expanded={open}
        aria-disabled={disabled || undefined}
        onClick={() => {
          setOpen((o) => !o);
          onActivate?.();
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        {children}
      </button>
      <span id={id} role="tooltip" className="fq-tip fq-tip-x" data-placement={placement}>
        {tip}
      </span>
    </span>
  );
}
