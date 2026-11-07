import type { SaveSummary } from "@fq/solo/client";
import { useRef, useState } from "react";
import { useT } from "../i18n/I18nContext.js";
import { DoorButton } from "../shell/forms.js";
import { canOpenWithWrapper, openWithWrapper } from "../wrapper.js";

export interface SoloMenuProps {
  saves: SaveSummary[] | null;
  onContinue: (slot: string) => void;
  onNew: () => void;
  onDelete: (slot: string) => Promise<void>;
  onExport: (slot: string) => void;
  onImport: (file: File) => void;
  onBack: (() => void) | null;
  /** A line to show above the list: an import that worked, a save that would not open. */
  message: { kind: "error" | "info"; text: string } | null;
  busy: boolean;
}

function when(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** The list of solo careers: continue, export, delete (with a question), a new one, an import. */
export function SoloMenu({
  saves,
  onContinue,
  onNew,
  onDelete,
  onExport,
  onImport,
  onBack,
  message,
  busy,
}: SoloMenuProps) {
  const t = useT();
  const file = useRef<HTMLInputElement>(null);
  /** The app's own "open" dialog when it has one, else the page's file input (both webviews run it). */
  const pickFile = async () => {
    if (canOpenWithWrapper()) {
      try {
        const picked = await openWithWrapper(".json,application/json");
        if (picked) onImport(new File([picked.text], picked.name, { type: "application/json" }));
        return;
      } catch {
        // Fall through to the page's own picker.
      }
    }
    file.current?.click();
  };
  const [asking, setAsking] = useState<string | null>(null);

  return (
    <div className="fq-door-form fq-solo-menu" aria-busy={busy || undefined}>
      <h2 className="fq-door-heading">{t("solo.menu.title")}</h2>
      {message && (
        <p
          className={message.kind === "error" ? "fq-form-alert" : "fq-door-line fq-solo-info"}
          role={message.kind === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}
      {saves === null ? (
        <p className="fq-door-line" role="status">
          {t("app.loading")}
        </p>
      ) : saves.length === 0 ? (
        <p className="fq-door-line">{t("solo.menu.empty")}</p>
      ) : (
        <ul className="fq-saves" aria-label={t("solo.menu.title")}>
          {saves.map((save, i) => {
            const expanded = save.contentPack === "expanded";
            const progress =
              save.mode === "daily"
                ? t("solo.menu.progressDaily")
                : save.careerDays === null
                  ? t("solo.menu.progressEndless", { day: save.day })
                  : t("solo.menu.progress", { day: save.day, total: save.careerDays });
            return (
              <li key={save.slot} className="fq-save" data-slot={save.slot}>
                <div className="fq-save-text">
                  <p className="fq-save-name">
                    {save.playerName}
                    {save.parlor ? <span> of {save.parlor}</span> : null}
                  </p>
                  <p className="fq-save-progress">{progress}</p>
                  <p className="fq-save-detail">
                    {t(expanded ? "solo.menu.detailExpanded" : "solo.menu.detail", {
                      bp: save.bp,
                      rivals: save.rivals,
                    })}
                    {". "}
                    {t("solo.menu.saved", { when: when(save.savedAt) })}
                  </p>
                </div>
                {asking === save.slot ? (
                  <div className="fq-save-actions">
                    <span className="fq-save-ask">{t("solo.menu.confirmDelete")}</span>
                    <DoorButton
                      variant="quiet"
                      disabled={busy}
                      onClick={() => {
                        setAsking(null);
                        void onDelete(save.slot);
                      }}
                    >
                      {t("solo.menu.confirmYes")}
                    </DoorButton>
                    <DoorButton autoFocus onClick={() => setAsking(null)}>
                      {t("solo.menu.confirmNo")}
                    </DoorButton>
                  </div>
                ) : (
                  <div className="fq-save-actions">
                    <DoorButton
                      variant="primary"
                      autoFocus={i === 0}
                      disabled={busy}
                      onClick={() => onContinue(save.slot)}
                    >
                      {t("solo.menu.continue")}
                    </DoorButton>
                    <button
                      type="button"
                      className="fq-linkbtn"
                      onClick={() => onExport(save.slot)}
                    >
                      {t("solo.menu.export")}
                    </button>
                    <button
                      type="button"
                      className="fq-linkbtn"
                      onClick={() => setAsking(save.slot)}
                    >
                      {t("solo.menu.delete")}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="fq-door-actions">
        <DoorButton
          {...(saves && saves.length > 0 ? {} : { variant: "primary" as const })}
          autoFocus={!saves || saves.length === 0}
          disabled={busy}
          onClick={onNew}
        >
          {t("solo.menu.new")}
        </DoorButton>
        <DoorButton disabled={busy} onClick={() => void pickFile()}>
          {t("solo.menu.import")}
        </DoorButton>
        {onBack && (
          <DoorButton variant="quiet" onClick={onBack}>
            {t("solo.menu.back")}
          </DoorButton>
        )}
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          className="fq-sr"
          tabIndex={-1}
          aria-label={t("solo.menu.import")}
          data-testid="solo-import"
          onChange={(e) => {
            const picked = e.target.files?.[0];
            e.target.value = "";
            if (picked) onImport(picked);
          }}
        />
      </div>
    </div>
  );
}
