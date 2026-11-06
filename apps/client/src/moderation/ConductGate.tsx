import { useEffect, useRef } from "react";
import { acceptConduct, GATE_POINTS } from "./conduct.js";
import { say } from "./text.js";

/**
 * The notice every player agrees to once before online play (not before Solo). Shown in place of
 * the log-on plaque until accepted. DRAFT wording: see `conduct.ts`.
 */
export function ConductGate({
  onAccept,
  onRules,
  onDecline,
}: {
  onAccept: () => void;
  onRules: () => void;
  /** Back to the choice of how to play, when there is one. */
  onDecline?: (() => void) | undefined;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section
      className="fq-door-form fq-gate"
      aria-labelledby="fq-gate-title"
      data-testid="conduct-gate"
    >
      <h2 id="fq-gate-title" className="fq-door-heading" tabIndex={-1} ref={heading}>
        {say("gate.title")}
      </h2>
      <ul className="fq-gate-points">
        {GATE_POINTS.map((p) => (
          <li key={p.lead}>
            <strong>{p.lead}</strong> {p.text}
          </li>
        ))}
      </ul>
      <div className="fq-door-actions">
        <button
          type="button"
          className="fq-dbtn fq-door-btn"
          data-autofocus
          onClick={() => {
            acceptConduct();
            onAccept();
          }}
        >
          {say("gate.agree")}
        </button>
        <button type="button" className="fq-linkbtn" onClick={onRules}>
          {say("gate.rules")}
        </button>
        {onDecline && (
          <button type="button" className="fq-linkbtn" onClick={onDecline}>
            {say("gate.back")}
          </button>
        )}
      </div>
    </section>
  );
}
