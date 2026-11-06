import type { Button } from "@fq/protocol";
import { useId } from "react";
import { type CardState, cardState, groupButtons, type Placed } from "../expanded/buttons.js";
import { useT } from "../i18n/I18nContext.js";
import { Plaques } from "./Plaques.js";
import { useCover } from "./useCover.js";

/** Cards above this many leave the text well for a shelf of their own (docs 11.3: upgrades, games). */
export const MAX_CARD_ROW = 6;

/** How many plaque rows of space the deck takes at the bottom of the well. */
export function deckRows(buttons: Button[]): number {
  const g = groupButtons(buttons);
  let rows = g.main.length > 0 ? Math.max(1, Math.ceil(g.main.length / 5)) : 0;
  if (g.hand.length > 0 && g.hand.length <= MAX_CARD_ROW) rows += 2.1;
  return Math.max(1, rows);
}

/**
 * Design pixels of room under the text for what `deckRows` does not count: the smaller second
 * row with the gap that keeps its price tags clear of the row above, the lift that brings the
 * whole deck inside the cabinet's rim, and the same gap above a row of cards.
 */
export const MORE_ROW_PX = 66;
export function deckExtra(buttons: Button[]): number {
  const g = groupButtons(buttons);
  let extra = 0;
  if (g.more.length > 0) extra += MORE_ROW_PX;
  if (g.hand.length > 0 && g.hand.length <= MAX_CARD_ROW) extra += 7;
  return extra;
}

export function Card({
  placed,
  onPress,
  big,
}: {
  placed: Placed;
  onPress: (id: string) => void;
  big?: boolean;
}) {
  const t = useT();
  const uid = useId();
  const b = placed.button;
  const state: CardState = cardState(b);
  const disabled = b.enabled === false;
  const hintId = `${uid}-hint`;
  return (
    <li className="fq-card-item">
      <button
        type="button"
        className="fq-card"
        data-button-id={b.id}
        data-state={state}
        data-big={big || undefined}
        aria-disabled={disabled || undefined}
        aria-pressed={b.selected ? true : undefined}
        aria-describedby={b.hint ? hintId : undefined}
        aria-keyshortcuts={placed.index < 9 ? String(placed.index + 1) : undefined}
        onClick={() => {
          if (!disabled) onPress(b.id);
        }}
      >
        <span className="fq-card-key" aria-hidden="true">
          {placed.index < 9 ? placed.index + 1 : ""}
        </span>
        <span className="fq-card-label">{b.label}</span>
        {b.detail !== undefined && <span className="fq-card-detail">{b.detail}</span>}
        {(state === "owned" || state === "chosen") && (
          <span className="fq-card-badge">
            <span aria-hidden="true">&#10003;</span>
            <span className="fq-sr">
              {t(state === "chosen" ? "x.deck.chosen" : "x.deck.owned")}
            </span>
          </span>
        )}
        {state === "locked" && <span className="fq-card-badge">{t("x.deck.locked")}</span>}
        {b.hint && (
          <span id={hintId} className="fq-card-hint">
            {b.hint}
          </span>
        )}
      </button>
    </li>
  );
}

/** A row of cards. */
export function Cards({
  cards,
  onPress,
  label,
}: {
  cards: Placed[];
  onPress: (id: string) => void;
  label?: string;
}) {
  const t = useT();
  if (cards.length === 0) return null;
  return (
    <nav className="fq-cards" aria-label={label ?? t("x.deck.hand")} data-count={cards.length}>
      <ul>
        {cards.map((c) => (
          <Card key={c.button.id} placed={c} onPress={onPress} />
        ))}
      </ul>
    </nav>
  );
}

/**
 * The Expanded button deck: cards (when there are few enough) above the main row of plaques,
 * and a smaller second row (`more`) under it. Every button keeps its place in the View for the
 * number keys. A Classic View never gets here: its buttons have no groups and no details.
 */
export function Deck({
  buttons,
  onPress,
  cardsHere = true,
}: {
  buttons: Button[];
  onPress: (id: string) => void;
  /** False when the cards are drawn elsewhere (a shelf). */
  cardsHere?: boolean;
}) {
  const g = groupButtons(buttons);
  const pos = (b: Button) => buttons.indexOf(b);
  return (
    <div className="fq-deck" data-more={g.more.length > 0 || undefined}>
      {cardsHere && <Cards cards={g.hand} onPress={onPress} />}
      <Plaques buttons={g.main.map((p) => p.button)} onPress={onPress} position={pos} />
      {g.more.length > 0 && (
        <Plaques
          buttons={g.more.map((p) => p.button)}
          onPress={onPress}
          position={pos}
          size="small"
        />
      )}
    </div>
  );
}

/** A scrolling shelf of many cards (the contractor's upgrades): a catalogue in place of the note. */
export function Shelf({ cards, onPress }: { cards: Placed[]; onPress: (id: string) => void }) {
  const t = useT();
  return (
    <section
      className="fq-npanel fq-shelf fq-surface-light"
      data-cover={useCover()}
      aria-label={t("x.deck.shelf")}
    >
      <header>
        <h2>{t("x.deck.shelf")}</h2>
        <span>{t("x.deck.count", { count: cards.length })}</span>
      </header>
      <nav aria-label={t("x.deck.hand")}>
        <ul>
          {cards.map((c) => (
            <Card key={c.button.id} placed={c} onPress={onPress} big />
          ))}
        </ul>
      </nav>
    </section>
  );
}
