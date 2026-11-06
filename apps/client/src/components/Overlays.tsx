import type { Action, Overlay } from "@fq/protocol";
import { type RefObject, useEffect, useId, useRef, useState } from "react";
import { useArt } from "../art/ArtContext.js";
import { useT } from "../i18n/I18nContext.js";
import { LetterActions, MessageActions } from "../moderation/ActionMenu.js"; // moderation hook
import { Dialog } from "./Dialog.js";
import { QuillIcon } from "./Icons.js";
import { PictureLayers } from "./Picture.js";
import { RichText, spanText } from "./RichText.js";

/**
 * What closing an overlay with Escape or Cancel means for each kind: a message is dismissed
 * (the server hears `dismiss` and answers with the next screen, or the next letter), a prompt
 * is cancelled with `null`, never with an empty string.
 */
export function cancelAction(overlay: Overlay): Action {
  switch (overlay.kind) {
    case "message":
      return { type: "dismiss", overlayId: overlay.id };
    case "textInput":
      return { type: "submitText", overlayId: overlay.id, text: null };
    case "playerPicker":
      return { type: "pickPlayer", overlayId: overlay.id, playerId: null };
    case "confirm":
      return { type: "confirm", overlayId: overlay.id, accepted: false };
  }
}

interface OverlayProps {
  overlay: Overlay;
  onAction: (action: Action) => void;
}

export function OverlayView({ overlay, onAction }: OverlayProps) {
  switch (overlay.kind) {
    case "message":
      return <MessageDialog overlay={overlay} onAction={onAction} />;
    case "confirm":
      return <ConfirmDialog overlay={overlay} onAction={onAction} />;
    case "textInput":
      return <NotepadDialog overlay={overlay} onAction={onAction} />;
    case "playerPicker":
      return <PlayerPickerDialog overlay={overlay} onAction={onAction} />;
  }
}

type Of<K extends Overlay["kind"]> = Extract<Overlay, { kind: K }>;

function MessageDialog({
  overlay,
  onAction,
}: {
  overlay: Of<"message">;
  onAction: (a: Action) => void;
}) {
  const t = useT();
  const id = useId();
  return (
    <Dialog className="fq-dialog fq-surface-dark" labelledBy={id} describedBy={id}>
      {overlay.picture && (
        <div className="fq-dialog-picture">
          <PictureLayers picture={overlay.picture} />
        </div>
      )}
      <p id={id} className="fq-dialog-text">
        <RichText spans={overlay.text} />
      </p>
      <div className="fq-dialog-actions">
        <button
          type="button"
          className="fq-dbtn"
          data-autofocus
          onClick={() => onAction({ type: "dismiss", overlayId: overlay.id })}
        >
          {t("overlay.ok")}
        </button>
        {/* moderation hook: fortunes and battle quotes */}
        {overlay.id === "mailbox:letter" && <MessageActions text={spanText(overlay.text)} />}
      </div>
    </Dialog>
  );
}

function ConfirmDialog({
  overlay,
  onAction,
}: {
  overlay: Of<"confirm">;
  onAction: (a: Action) => void;
}) {
  const t = useT();
  const id = useId();
  return (
    <Dialog className="fq-dialog fq-surface-dark" labelledBy={id} describedBy={id}>
      <p id={id} className="fq-dialog-text">
        <RichText spans={overlay.text} />
      </p>
      <div className="fq-dialog-actions">
        <button
          type="button"
          className="fq-dbtn"
          data-autofocus
          onClick={() => onAction({ type: "confirm", overlayId: overlay.id, accepted: true })}
        >
          {t("overlay.yes")}
        </button>
        <button
          type="button"
          className="fq-dbtn"
          onClick={() => onAction({ type: "confirm", overlayId: overlay.id, accepted: false })}
        >
          {t("overlay.no")}
        </button>
        {/* moderation hook: a letter from another player */}
        {overlay.id === "mailbox:reply" && <LetterActions text={spanText(overlay.text)} />}
      </div>
    </Dialog>
  );
}

function PlayerPickerDialog({
  overlay,
  onAction,
}: {
  overlay: Of<"playerPicker">;
  onAction: (a: Action) => void;
}) {
  const t = useT();
  const id = useId();
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <Dialog className="fq-dialog fq-surface-dark" labelledBy={id}>
      <p id={id} className="fq-dialog-text">
        {overlay.prompt}
      </p>
      {overlay.players.length === 0 ? (
        <p className="fq-dialog-empty">{t("overlay.noPlayers")}</p>
      ) : (
        <fieldset className="fq-players">
          <legend className="fq-sr">{t("overlay.playerList")}</legend>
          {overlay.players.map((p) => (
            <label key={p.id} className="fq-player">
              <input
                type="radio"
                name={`${id}-player`}
                checked={selected === p.id}
                onChange={() => setSelected(p.id)}
                onDoubleClick={() =>
                  onAction({ type: "pickPlayer", overlayId: overlay.id, playerId: p.id })
                }
              />
              <span>{p.name}</span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="fq-dialog-actions">
        <button
          type="button"
          className="fq-dbtn"
          aria-disabled={selected === null || undefined}
          onClick={() => {
            if (selected !== null)
              onAction({ type: "pickPlayer", overlayId: overlay.id, playerId: selected });
          }}
        >
          {t("overlay.choose")}
        </button>
        <button
          type="button"
          className="fq-dbtn"
          onClick={() => onAction({ type: "pickPlayer", overlayId: overlay.id, playerId: null })}
        >
          {t("overlay.cancel")}
        </button>
      </div>
    </Dialog>
  );
}

/** The spiral notepad used for text entry. */
function NotepadDialog({
  overlay,
  onAction,
}: {
  overlay: Of<"textInput">;
  onAction: (a: Action) => void;
}) {
  const t = useT();
  const id = useId();
  const notepad = useArt().piece("notepad");
  const [text, setText] = useState(overlay.initial ?? "");
  const field = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  // A prefilled prompt (a quoted letter being answered) starts with the caret after the text.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only on open.
  useEffect(() => {
    const el = field.current;
    if (el && overlay.initial) el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  const left = Math.max(0, overlay.maxLength - text.length);
  const submit = () => onAction({ type: "submitText", overlayId: overlay.id, text });
  const cancel = () => onAction({ type: "submitText", overlayId: overlay.id, text: null });
  return (
    <Dialog className={notepad ? "fq-notepad fq-notepad-art" : "fq-notepad"} labelledBy={id}>
      {notepad ? (
        <img className="fq-notepad-img" src={notepad} alt="" draggable={false} />
      ) : (
        <div className="fq-spiral" aria-hidden="true">
          {Array.from({ length: 22 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static decoration
            <i key={i} />
          ))}
        </div>
      )}
      <form
        className="fq-notepad-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <p
          id={id}
          className="fq-notepad-prompt"
          data-len={(overlay.prompt || t("overlay.textPrompt")).length > 26 ? "long" : undefined}
        >
          {overlay.prompt || t("overlay.textPrompt")} {!notepad && <QuillIcon />}
        </p>
        <div className="fq-notepad-lines">
          {overlay.multiline ? (
            <textarea
              ref={field as RefObject<HTMLTextAreaElement>}
              className="fq-notepad-input"
              data-autofocus
              value={text}
              maxLength={overlay.maxLength}
              aria-labelledby={id}
              aria-describedby={`${id}-count`}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={8}
            />
          ) : (
            <input
              ref={field as RefObject<HTMLInputElement>}
              className="fq-notepad-input fq-notepad-single"
              data-autofocus
              type="text"
              value={text}
              maxLength={overlay.maxLength}
              aria-labelledby={id}
              aria-describedby={`${id}-count`}
              autoComplete="off"
              onChange={(e) => setText(e.target.value)}
            />
          )}
        </div>
        <p className="fq-notepad-count" id={`${id}-count`}>
          {t("overlay.charsLeft", { count: left })}
        </p>
        <div className="fq-notepad-actions">
          <button type="button" className="fq-nbtn" onClick={cancel}>
            {t("overlay.cancel")}
          </button>
          <button type="submit" className="fq-nbtn">
            {t("overlay.submit")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Plain-text version of a message overlay, for notices and tests. */
export const overlaySummary = (overlay: Overlay): string =>
  overlay.kind === "message" || overlay.kind === "confirm"
    ? spanText(overlay.text)
    : overlay.prompt;
