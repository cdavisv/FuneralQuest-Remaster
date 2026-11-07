import type { RichText } from "@fq/protocol";
import type { MuteInfo, MuteScope, SafetyTarget } from "@fq/server/client";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ModerationApi } from "./api.js";
import { ModerationContext, type ModerationValue } from "./context.js";
import {
  AnnouncementsDialog,
  BlockDialog,
  DeleteAccountDialog,
  ReportDialog,
  UpgradeDialog,
} from "./Dialogs.js";
import { say } from "./text.js";

type Dialog =
  | { kind: "report"; target: SafetyTarget; subject: string }
  | { kind: "block"; target: SafetyTarget; subject: string }
  | { kind: "delete" }
  | { kind: "upgrade" }
  | { kind: "announcements"; body: RichText };

const WHAT: Record<MuteScope, string> = {
  chat: "cafe talk",
  mail: "letters and battle quotes",
  announcements: "announcements",
  fortunes: "fortunes",
};

function describeMute(mute: MuteInfo): string {
  const scopes = mute.scopes.map((s) => WHAT[s]);
  const what =
    scopes.length <= 1
      ? (scopes[0] ?? "")
      : `${scopes.slice(0, -1).join(", ")} and ${scopes.at(-1)}`;
  const until = new Date(mute.until);
  const when = Number.isNaN(until.getTime()) ? mute.until : until.toLocaleString();
  return say("muted.banner", { what, until: when });
}

/** Says that the moderators have muted the player, from `/api/me` or from a refused action. */
function MutedBanner({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div className="fq-mod-banner" role="status" data-testid="muted-banner">
      <span>{text}</span>
      <button type="button" className="fq-linkbtn" onClick={onClose}>
        {say("muted.close")}
      </button>
    </div>
  );
}

/**
 * Makes reporting, blocking and account deletion available to everything inside an online town
 * session. It also asks the server who the player is (to leave their own lines alone) and shows a
 * notice when the moderators have muted them.
 */
export function ModerationProvider({
  api,
  townId,
  onAccountDeleted,
  children,
}: {
  api: ModerationApi;
  townId: string;
  /** The account is gone: the host forgets the session and returns to the front door. */
  onAccountDeleted: () => void;
  children: ReactNode;
}) {
  const [self, setSelf] = useState<ModerationValue["self"]>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [muted, setMuted] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .me()
      .then((me) => {
        if (!alive) return;
        const mine = me.parlors.find((p) => p.townId === townId);
        setSelf({
          name: mine?.name ?? null,
          playerId: mine?.playerId ?? null,
          guest: me.account.guest,
        });
        const first = me.mutes?.[0];
        if (first) setMuted(describeMute(first));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [api, townId]);

  // The transport reports an action the moderators' mute refused.
  useEffect(() => {
    const onMuted = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      setMuted(detail?.message ?? say("muted.banner", { what: "this", until: "later" }));
    };
    window.addEventListener("fq:muted", onMuted);
    return () => window.removeEventListener("fq:muted", onMuted);
  }, []);

  // While one of these dialogs is open the game behind it, and any dialog of the game's own, are inert.
  useEffect(() => {
    if (!dialog) return;
    const behind = Array.from(
      document.querySelectorAll<HTMLElement>(".fq-stage, .fq-backdrop"),
    ).filter((el) => !el.hasAttribute("inert") && !el.closest(".fq-mod-root"));
    for (const el of behind) el.setAttribute("inert", "");
    return () => {
      for (const el of behind) el.removeAttribute("inert");
    };
  }, [dialog]);

  const close = useCallback(() => setDialog(null), []);
  const value = useMemo<ModerationValue>(
    () => ({
      api,
      townId,
      self,
      openReport: (target, subject) => setDialog({ kind: "report", target, subject }),
      openBlock: (target, subject) => setDialog({ kind: "block", target, subject }),
      openDelete: () => setDialog({ kind: "delete" }),
      openAnnouncements: (body) => setDialog({ kind: "announcements", body }),
      openUpgrade: () => setDialog({ kind: "upgrade" }),
    }),
    [api, townId, self],
  );

  return (
    <ModerationContext.Provider value={value}>
      {children}
      {/* Inside the game's own frame, which defines the sizes the dialogs are drawn in. */}
      {createPortal(
        <>
          {muted && <MutedBanner text={muted} onClose={() => setMuted(null)} />}
          {dialog?.kind === "report" && (
            <ReportDialog target={dialog.target} subject={dialog.subject} onClose={close} />
          )}
          {dialog?.kind === "block" && (
            <BlockDialog target={dialog.target} subject={dialog.subject} onClose={close} />
          )}
          {dialog?.kind === "delete" && (
            <DeleteAccountDialog
              guest={self?.guest ?? false}
              onClose={close}
              onDeleted={onAccountDeleted}
            />
          )}
          {dialog?.kind === "upgrade" && (
            <UpgradeDialog
              onClose={close}
              onUpgraded={() => setSelf((x) => (x ? { ...x, guest: false } : x))}
            />
          )}
          {dialog?.kind === "announcements" && (
            <AnnouncementsDialog
              body={dialog.body}
              onClose={close}
              onReport={(target, subject) => setDialog({ kind: "report", target, subject })}
              onBlock={(target, subject) => setDialog({ kind: "block", target, subject })}
            />
          )}
        </>,
        document.querySelector(".fq-app") ?? document.body,
      )}
    </ModerationContext.Provider>
  );
}
