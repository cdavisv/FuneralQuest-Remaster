import { useEffect, useId, useRef, useState } from "react";
import { acceptConduct, GATE_POINTS } from "./conduct.js";
import { say } from "./text.js";

/**
 * The notice every player agrees to once before online play (not before Solo): the rating, the
 * short rules and one tick box. Shown in place of the log-on plaque until accepted. A rating and a
 * self-declaration, not age verification: see `conduct.ts`.
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
  const [ticked, setTicked] = useState(false);
  const box = useId();
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
      <p className="fq-gate-tick">
        <input
          id={box}
          type="checkbox"
          checked={ticked}
          required
          onChange={(e) => setTicked(e.target.checked)}
        />{" "}
        <label htmlFor={box}>{say("gate.tick")}</label>
      </p>
      <div className="fq-door-actions">
        <button
          type="button"
          className="fq-dbtn fq-door-btn"
          aria-disabled={!ticked || undefined}
          onClick={() => {
            if (!ticked) return;
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
