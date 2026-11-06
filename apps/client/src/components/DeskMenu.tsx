import type { Button } from "@fq/protocol";
import { useArt } from "../art/ArtContext.js";
import type { PieceName } from "../art/types.js";
import { useT } from "../i18n/I18nContext.js";
import { Plaques } from "./Plaques.js";

/** The desk's fixed controls and the round brass icon (the original's capsule menu) of each. */
const ORBS: Record<string, PieceName> = {
  "go:map": "capsule-map",
  "go:news": "capsule-news",
  "go:stats": "capsule-stats",
  "go:rankings": "capsule-rankings",
  "go:mailbox": "capsule-mail",
  // Expanded: the parlor office, drawn as a stand-in (art/packs/classic/placeholders).
  "go:parlor": "capsule-parlor",
};

/**
 * Splits a View's buttons into the fixed desk controls (the original's capsule menu: map, paper,
 * stats, rankings, letter) and the rest (waiting for customers, leaving, anything a host adds
 * such as End the Day). Returns null when this View has no such controls, or the art pack has no
 * icons for them, in which case every choice is a plaque as before.
 */
export function splitDesk(
  buttons: Button[],
  hasPiece: (name: PieceName) => boolean,
): { before: Button[]; orbs: Button[]; after: Button[] } | null {
  const isOrb = (b: Button) => b.id in ORBS && hasPiece(ORBS[b.id] as PieceName);
  const first = buttons.findIndex(isOrb);
  if (first < 0) return null;
  const orbs = buttons.filter(isOrb);
  if (orbs.length < 3) return null;
  const rest = buttons.filter((b) => !isOrb(b));
  const before = rest.filter((b) => buttons.indexOf(b) < first);
  return { before, orbs, after: rest.filter((b) => !before.includes(b)) };
}

/**
 * The desk's choices in two kinds: contextual plaques (wait for a customer, leave, end the day)
 * and the capsule menu of round icon buttons for the fixed places. One tidy row at every size.
 */
export function DeskMenu({
  all,
  parts,
  onPress,
}: {
  all: Button[];
  parts: NonNullable<ReturnType<typeof splitDesk>>;
  onPress: (buttonId: string) => void;
}) {
  const t = useT();
  const art = useArt();
  return (
    <div className="fq-deskmenu">
      <div className="fq-deskmenu-before">
        <Plaques buttons={parts.before} onPress={onPress} position={(b) => all.indexOf(b)} />
      </div>
      <nav className="fq-orbs" aria-label={t("buttons.places")}>
        <ul>
          {parts.orbs.map((b) => {
            const disabled = b.enabled === false;
            const index = all.indexOf(b);
            return (
              <li key={b.id}>
                <button
                  type="button"
                  className="fq-orb"
                  data-button-id={b.id}
                  aria-disabled={disabled || undefined}
                  aria-keyshortcuts={index < 9 ? String(index + 1) : undefined}
                  onClick={() => {
                    if (!disabled) onPress(b.id);
                  }}
                >
                  <img
                    src={art.piece(ORBS[b.id] as PieceName)}
                    alt=""
                    draggable={false}
                    className="fq-orb-icon"
                  />
                  <span className="fq-orb-label">{b.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="fq-deskmenu-after">
        <Plaques buttons={parts.after} onPress={onPress} position={(b) => all.indexOf(b)} />
      </div>
    </div>
  );
}
