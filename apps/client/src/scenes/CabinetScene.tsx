import type { View } from "@fq/protocol";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useArt } from "../art/ArtContext.js";
import { useCabinetArt } from "../art/CabinetContext.js";
import { BallotsPanel, ballotFocus } from "../components/BallotsPanel.js";
import { BankPanel } from "../components/BankPanel.js";
import { BingoSheet } from "../components/BingoSheet.js";
import { BoardTable } from "../components/BoardTable.js";
import { ClerkTip, TourNote } from "../components/ClerkTip.js";
import { CustomerFile } from "../components/CustomerFile.js";
import { Deck, deckExtra, deckRows, MAX_CARD_ROW, Shelf } from "../components/Deck.js";
import { DeskMenu, splitDesk } from "../components/DeskMenu.js";
import { GameBoard } from "../components/GameBoard.js";
import { LuckMeter, Note, StatsStrip } from "../components/Hud.js";
import { InjuryPanel } from "../components/InjuryPanel.js";
import { KarmaScale, MoralChoices } from "../components/KarmaMoment.js";
import { Ledger } from "../components/Ledger.js";
import { MonumentLadder } from "../components/MonumentLadder.js";
import { OfficePanel } from "../components/OfficePanel.js";
import { PictureFrame } from "../components/PictureFrame.js";
import { Plaques } from "../components/Plaques.js";
import { BattleReadout, CustomerReadout } from "../components/Readouts.js";
import { RichText, spanText } from "../components/RichText.js";
import { RoundResult } from "../components/RoundResult.js";
import { RankingsTable, StatsSheet } from "../components/Sheets.js";
import { SideLog } from "../components/SideLog.js";
import { TextPanel } from "../components/TextPanel.js";
import { TownStrip } from "../components/TownStrip.js";
import { UpgradeShelf } from "../components/UpgradeShelf.js";
import { bankFocus } from "../expanded/bank.js";
import { groupButtons, hasDetails, usesGroups } from "../expanded/buttons.js";
import { clerkTip } from "../expanded/clerk.js";
import { gameRows } from "../expanded/club.js";
import { isExpandedHud } from "../expanded/hud.js";
import { isChooserScreen, isOfficeHome, isUpgradeScreen } from "../expanded/office.js";
import { isPrepChoice, prepOptions } from "../expanded/prep.js";
import { useT } from "../i18n/I18nContext.js";
import { ChatLineActions } from "../moderation/ActionMenu.js"; // moderation hook
import { useModeration } from "../moderation/context.js";
import { useIsGuest } from "../moderation/guest.js";
import { say } from "../moderation/text.js";
import type { SceneProps } from "./types.js";

function ChatForm({ onSend }: { onSend: (text: string) => void }) {
  const t = useT();
  const guest = useIsGuest();
  const mod = useModeration();
  const [text, setText] = useState("");
  if (guest) {
    // Guests read the cafe but do not talk in it (decision 7): the input is shown, unavailable.
    return (
      <form className="fq-chatform" onSubmit={(e) => e.preventDefault()} data-guest="true">
        <input
          type="text"
          disabled
          aria-label={t("cafe.input")}
          aria-describedby="fq-chat-guest"
          title={`${say("guest.chat")} ${say("guest.how")}`}
          placeholder={say("guest.chatPlaceholder")}
        />
        <span id="fq-chat-guest" className="fq-sr">
          {say("guest.chat")} {say("guest.how")}
        </span>
        <button type="button" className="fq-chatsend" onClick={() => mod?.openUpgrade()}>
          {say("guest.chatSignUp")}
        </button>
      </form>
    );
  }
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  };
  return (
    <form className="fq-chatform" onSubmit={submit}>
      <input
        type="text"
        value={text}
        maxLength={200}
        autoComplete="off"
        aria-label={t("cafe.input")}
        placeholder={t("cafe.placeholder")}
        onChange={(e) => setText(e.target.value)}
      />
      <button type="submit" className="fq-chatsend">
        {t("cafe.send")}
      </button>
    </form>
  );
}

/** Drops blank lines before the first words: a card screen's text starts with the engine's spacing. */
function trimLead(text: View["text"]): View["text"] {
  const out = [...text];
  while (out.length > 0) {
    const first = out[0];
    if (!first) break;
    const trimmed = first.text.replace(/^\s+/, "");
    if (trimmed === "") out.shift();
    else {
      out[0] = { ...first, text: trimmed };
      break;
    }
  }
  return out;
}

/** The last value a View sent, kept for the screens that do not repeat it (the karma axis's bands). */
function useRemembered<T>(value: T | undefined): T | undefined {
  const kept = useRef<T | undefined>(undefined);
  if (value !== undefined) kept.current = value;
  return kept.current;
}

/**
 * Lobby, desk, any place in town, the cafe, and the stats and rankings sheets: everything
 * that lives inside the walnut cabinet. The View decides which parts exist. Expanded Views add
 * a ledger strip, a town strip, the customer's file, cards and a few place-specific panels;
 * each is keyed on data only Expanded Views carry, so a Classic View draws exactly as before.
 */
export function CabinetScene({ view, layout, onPress, onAction, revealKey, log }: SceneProps) {
  const t = useT();
  const cab = useCabinetArt();
  const art = useArt();
  const karmaScale = useRemembered(view.karmaScale);
  const [previewKarma, setPreviewKarma] = useState<number | undefined>(undefined);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new screen forgets the preview.
  useEffect(() => setPreviewKarma(undefined), [revealKey]);

  // What kind of Expanded screen this is.
  const xhud = isExpandedHud(view.hud) ? view.hud : undefined;
  const groups = groupButtons(view.buttons);
  const grouped = usesGroups(view.buttons) || hasDetails(view.buttons);
  const prep = isPrepChoice(view);
  const prepChoices = prep ? prepOptions(view) : [];
  const games = gameRows(view.buttons);
  const tip = clerkTip(view);
  const file =
    view.customer && (view.customer.estimate || view.customer.name) ? view.customer : null;
  const office = view.office;
  const upgrades = isUpgradeScreen(view);
  const upgradeShelf = upgrades && office !== undefined;
  const shelf = !prep && !upgradeShelf && games.length === 0 && groups.hand.length > MAX_CARD_ROW;
  const hasOfficePanel = office !== undefined && (isOfficeHome(view) || isChooserScreen(view));
  const bingo = view.bingo;
  const ballots = view.ballots;
  const bank = view.bank;
  const injuries =
    view.hud?.injuryList &&
    view.hud.injuryList.length > 0 &&
    view.buttons.some((b) => b.id.startsWith("hospital:"))
      ? view.hud.injuryList
      : undefined;
  const monument = view.buttons.find((b) => b.id === "graveyard:monument");
  const monuments =
    view.monuments !== undefined ||
    view.buttons.some((b) => b.id === "graveyard:monuments" || b.id === "graveyard:monument");
  const parchment =
    bingo ||
    ballots ||
    bank ||
    injuries ||
    monuments ||
    file ||
    prep ||
    shelf ||
    upgradeShelf ||
    games.length > 0 ||
    hasOfficePanel ||
    tip?.kind === "tour" ||
    view.board;

  // The desk's fixed controls are a row of round icon buttons beside a few plaques; every other
  // screen is a row (or two) of plaques.
  const desk =
    view.scene === "desk" ? splitDesk(view.buttons, (name) => art.piece(name) !== undefined) : null;
  // A body-preparation choice is two heavy cards; a gamble's odds and failure need a third line.
  const prepRows = prepChoices.some((o) => o.choice.risk) ? 2.5 : 1.6;
  const rows = desk
    ? 2
    : prep
      ? prepRows
      : grouped
        ? deckRows(view.buttons)
        : Math.max(1, Math.ceil(view.buttons.length / 5));
  const sheet = view.scene === "stats" || view.scene === "rankings";
  const cafe = view.scene === "cafe";
  // Art cabinets without a picture window (the cafe's chat room) leave out the note and picture.
  const pictureless = cab !== null && !cab.spec.regions.frame;
  // The rankings sheet is text on bare wood; every other sheet is parchment.
  const surface = cab?.variant === "rankings" ? "dark" : undefined;
  const phone = layout === "phone";
  const customerReadout = view.customer ? <CustomerReadout customer={view.customer} /> : undefined;
  const readout = (
    <>
      {customerReadout ?? (view.battle ? <BattleReadout battle={view.battle} /> : undefined)}
      {view.town && view.scene === "desk" && <TownStrip town={view.town} />}
      {tip?.kind === "hint" && <ClerkTip text={tip.text} speaker={tip.speaker} />}
      {view.club?.lastRound && games.length > 0 && <RoundResult round={view.club.lastRound} />}
    </>
  );
  const hasReadout = Boolean(
    customerReadout ||
      view.battle ||
      (view.town && view.scene === "desk") ||
      tip?.kind === "hint" ||
      (view.club?.lastRound && games.length > 0),
  );
  const chat = view.chat ?? [];
  // Structured stats and rankings replace the plain-text version of the same sheet.
  const statsSheet = view.scene === "stats" && view.stats && view.stats.length > 0;
  const rankTable = view.scene === "rankings" && view.rankings && view.rankings.length > 0;
  // A place's panel (the bank's books, the ballots, the monuments...) takes the parchment where the
  // place's note was written. The note is still the place's own words (at the bank, the 2001
  // original's), so it follows the screen's text in the well instead of disappearing.
  const panelSlot = Boolean(
    bingo ||
      ballots ||
      bank ||
      injuries ||
      monuments ||
      prep ||
      upgradeShelf ||
      shelf ||
      games.length > 0 ||
      hasOfficePanel ||
      (tip?.kind === "tour" && tip.page) ||
      view.board,
  );
  // (A tour page's note is its page count, which the tour's own parchment shows.)
  const movedNote =
    panelSlot && !file && tip?.kind !== "tour" && view.note && view.note.length > 0
      ? view.note
      : null;
  const baseText = grouped ? trimLead(view.text) : view.text;
  const wellText = movedNote ? [...baseText, { text: "\n\n" }, ...movedNote] : baseText;
  // The luck tube is part of a place's parchment art; a panel written on that paper (one that is
  // not its own sheet, `useCover`) leaves the tube showing, so its level is drawn there too.
  const luckUnderPanel =
    panelSlot &&
    !file &&
    !phone &&
    view.hud !== undefined &&
    cab !== null &&
    cab.variant !== "main" &&
    cab.spec.regions.luck !== undefined;

  const noteSlot = bingo ? (
    <BingoSheet bingo={bingo} />
  ) : ballots ? (
    <BallotsPanel ballots={ballots} focus={ballotFocus(view.buttons.map((b) => b.id))} />
  ) : bank ? (
    <BankPanel bank={bank} focus={bankFocus(view.buttons.map((b) => b.id))} />
  ) : injuries ? (
    <InjuryPanel injuries={injuries} />
  ) : monuments ? (
    <MonumentLadder next={monument?.label} price={monument?.detail} monuments={view.monuments} />
  ) : file ? (
    <CustomerFile
      customer={file}
      negotiating={file.haggle !== false}
      status={view.status ? spanText(view.status) : undefined}
      stacked={phone}
    />
  ) : prep ? (
    <KarmaScale karma={xhud?.karma} preview={previewKarma} scale={karmaScale} />
  ) : upgradeShelf && office ? (
    <UpgradeShelf office={office} buttons={view.buttons} money={xhud?.money} onPress={onPress} />
  ) : shelf ? (
    <Shelf cards={groups.hand} onPress={onPress} />
  ) : games.length > 0 ? (
    <GameBoard rows={games} onPress={onPress} />
  ) : hasOfficePanel && office ? (
    <OfficePanel office={office} />
  ) : tip?.kind === "tour" && tip.page ? (
    <TourNote at={tip.page.at} of={tip.page.of} speaker={tip.speaker} />
  ) : view.board ? (
    <BoardTable rows={view.board} />
  ) : (
    <Note view={view} compact={phone} />
  );

  return (
    <>
      <h1 className="fq-sr">{view.title}</h1>
      {xhud && !pictureless && !sheet && <Ledger hud={xhud} scale={karmaScale} compact={phone} />}
      {!sheet && !pictureless && (
        <>
          {phone && view.hud && <StatsStrip hud={view.hud} />}
          {(parchment || (phone ? view.note : view.note || view.hud)) && (
            <div className="fq-r-note" data-x={parchment ? "" : undefined}>
              {luckUnderPanel && view.hud && <LuckMeter luck={view.hud.luck} />}
              {noteSlot}
            </div>
          )}
          <div className="fq-r-frame">
            <PictureFrame view={view} customer={view.customer} />
          </div>
        </>
      )}
      <div className={sheet ? "fq-r-sheet" : "fq-r-text"}>
        <TextPanel
          text={rankTable ? [] : wellText}
          revealKey={revealKey}
          status={file || (view.town && view.scene === "desk") ? undefined : view.status}
          readout={hasReadout ? readout : undefined}
          variant={sheet ? "sheet" : "well"}
          {...(surface ? { surface } : {})}
          instant={sheet || cafe}
          rows={rows}
          extra={grouped && !desk && !prep ? deckExtra(view.buttons) : 0}
          {...(cafe ? { stickBottomKey: chat.length } : {})}
          {...(statsSheet && view.stats ? { after: <StatsSheet stats={view.stats} /> } : {})}
          {...(rankTable && view.rankings ? { after: <RankingsTable rows={view.rankings} /> } : {})}
          {...(cafe
            ? {
                after: (
                  <ul className="fq-chat" aria-label={t("cafe.log")}>
                    {chat.map((line, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: chat is append-only
                      <li key={i}>
                        <RichText spans={line.text} />
                        {/* moderation hook */}
                        <ChatLineActions text={spanText(line.text)} from={line.from} />
                      </li>
                    ))}
                  </ul>
                ),
                footer: <ChatForm onSend={(text) => onAction({ type: "chat", text })} />,
              }
            : {})}
        />
      </div>
      <div
        className="fq-r-buttons"
        data-rows={rows}
        data-desk={desk ? "" : undefined}
        data-x={grouped ? "" : undefined}
        data-more={groups.more.length > 0 ? "" : undefined}
      >
        {desk ? (
          <DeskMenu all={view.buttons} parts={desk} onPress={onPress} />
        ) : prep ? (
          <MoralChoices
            options={prepChoices}
            onPress={onPress}
            onPreview={setPreviewKarma}
            karma={xhud?.karma}
          />
        ) : grouped ? (
          <Deck
            buttons={view.buttons}
            onPress={onPress}
            cardsHere={!shelf && !upgradeShelf && games.length === 0}
          />
        ) : (
          <Plaques buttons={view.buttons} onPress={onPress} />
        )}
      </div>
      {layout === "wide" && !cafe && (
        <div className="fq-r-sidelog">
          <SideLog entries={log} />
        </div>
      )}
    </>
  );
}
