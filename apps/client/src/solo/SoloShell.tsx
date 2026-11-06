import {
  exportSave,
  importSave,
  pageTimeZone,
  type SaveSummary,
  type SoloConfig,
  type SoloSave,
} from "@fq/solo/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Game } from "../Game.js";
import { useT } from "../i18n/I18nContext.js";
import { DoorFrame } from "../shell/DoorFrame.js";
import { DoorScene } from "../shell/DoorScene.js";
import { useBackHandler } from "../util/back.js";
import { saveWithWrapper } from "../wrapper.js";
import { createSoloClient, type SoloPlatform } from "./platform.js";
import { playingSoloSlot, setPlayingSolo } from "./resume.js";
import { SoloMenu } from "./SoloMenu.js";
import { Autosaver, SoloSession } from "./SoloSession.js";
import { SoloSetup } from "./SoloSetup.js";

/**
 * The text packs this build can play (the worker carries them). "vintage" is a deprecated alias
 * of the same original text: saves made when it was offered still load, but it is never offered.
 */
const KNOWN_PACKS = ["classic", "vintage"];

type Screen =
  | { kind: "menu" }
  | { kind: "setup" }
  | { kind: "opening" }
  | { kind: "playing"; session: SoloSession; slot: string };

export interface SoloShellProps {
  platform: SoloPlatform;
  /** A static page (rules, credits...) was asked for. */
  onPage: (route: string) => void;
  /** Back to the online-or-solo choice. */
  onBack: () => void;
  offline: boolean;
}

function newSlot(platform: SoloPlatform): string {
  return `career-${platform.now().toString(36)}-${platform.newSeed().toString(36).slice(0, 4)}`;
}

/**
 * Hands the save to the desktop or mobile app's own save dialog or share sheet when there is one
 * (a webview ignores a download link to a blob); in a browser it is a download link. Resolves
 * true when the file was handed over, in either way.
 */
async function saveFile(filename: string, text: string, type: string): Promise<void> {
  if (await saveWithWrapper(filename, text, type)) return;
  download(filename, text, type);
}

function download(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const reason = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * What the worker cannot find out for itself: the page's time zone, for the time the original
 * printed in front of notices ("12:05 AM:Bob logged on."), following daylight saving.
 */
function hostOptions(): { timeZone?: string } {
  const timeZone = pageTimeZone();
  return timeZone ? { timeZone } : {};
}

/**
 * Solo mode as the player meets it: the list of saved careers, the new-career form, and the
 * game itself on a Web Worker, saved after every change. Nothing here talks to a server, so
 * it works from a static file host and from the installed app with no connection.
 */
export function SoloShell({ platform, onPage, onBack, offline }: SoloShellProps) {
  const t = useT();
  const [screen, setScreen] = useState<Screen>({ kind: "menu" });
  const [saves, setSaves] = useState<SaveSummary[] | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [saveProblem, setSaveProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const current = useRef<SoloSession | null>(null);
  const saver = useRef<Autosaver | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const list = await platform.storage.list();
      if (alive.current) setSaves(list);
    } catch (error) {
      if (alive.current) {
        setSaves([]);
        setMessage({ kind: "error", text: t("solo.menu.storage", { reason: reason(error) }) });
      }
    }
  }, [platform, t]);

  /** Starts a worker with the given game and shows it. */
  const play = useCallback(
    async (slot: string, start: (client: ReturnType<typeof createSoloClient>) => Promise<void>) => {
      const client = createSoloClient(platform);
      try {
        await start(client);
      } catch (error) {
        client.terminate();
        throw error;
      }
      const autosaver = new Autosaver(client, platform.storage, slot, undefined, (failure) => {
        if (alive.current) setSaveProblem(failure ? reason(failure) : null);
      });
      // The slot exists from the first moment, before anything has changed.
      await autosaver.flush(true);
      const session = new SoloSession(client, autosaver);
      current.current = session;
      saver.current = autosaver;
      setPlayingSolo(slot);
      if (alive.current) setScreen({ kind: "playing", session, slot });
    },
    [platform],
  );

  const open = useCallback(
    async (slot: string) => {
      setBusy(true);
      setMessage(null);
      setScreen({ kind: "opening" });
      try {
        const save = await platform.storage.read(slot);
        if (!save) throw new Error("The save is gone.");
        await play(slot, (client) => client.load(save, undefined, hostOptions()));
      } catch (error) {
        setPlayingSolo(null);
        if (alive.current) {
          setScreen({ kind: "menu" });
          setMessage({ kind: "error", text: t("solo.menu.openFailed", { reason: reason(error) }) });
        }
      } finally {
        if (alive.current) setBusy(false);
      }
    },
    [platform, play, t],
  );

  const start = useCallback(
    async (config: SoloConfig) => {
      setBusy(true);
      try {
        await play(newSlot(platform), (client) => client.create(config, undefined, hostOptions()));
      } finally {
        if (alive.current) setBusy(false);
      }
    },
    [platform, play],
  );

  // First load: the list, and (after a reload mid-game) straight back into the career.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per mount.
  useEffect(() => {
    void refresh();
    const resume = playingSoloSlot();
    if (resume) void open(resume);
  }, []);

  // A hidden tab or a closing page writes the save now rather than after the pause.
  useEffect(() => {
    if (screen.kind !== "playing") return;
    const flush = () => void saver.current?.flush(true);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [screen.kind]);

  const leave = useCallback(async () => {
    const session = current.current;
    current.current = null;
    saver.current = null;
    setPlayingSolo(null);
    if (session) await session.dispose();
    if (!alive.current) return;
    setSaveProblem(null);
    setScreen({ kind: "menu" });
    void refresh();
  }, [refresh]);

  const remove = async (slot: string) => {
    setBusy(true);
    try {
      await platform.storage.remove(slot);
    } catch (error) {
      setMessage({ kind: "error", text: t("solo.menu.storage", { reason: reason(error) }) });
    } finally {
      await refresh();
      if (alive.current) setBusy(false);
    }
  };

  const exportSlot = async (slot: string) => {
    try {
      const save = await platform.storage.read(slot);
      if (!save) return;
      const file = exportSave(save);
      await saveFile(file.filename, file.text, file.type);
      setMessage({ kind: "info", text: t("solo.menu.exported") });
    } catch (error) {
      setMessage({ kind: "error", text: t("solo.menu.exportFailed", { reason: reason(error) }) });
    }
  };

  const importFile = async (file: File) => {
    setBusy(true);
    setMessage(null);
    try {
      const save: SoloSave = await importSave(file);
      if (!KNOWN_PACKS.includes(save.config.contentPack)) {
        throw new Error(t("solo.menu.packMissing", { pack: save.config.contentPack }));
      }
      await platform.storage.write(newSlot(platform), save);
      await refresh();
      setMessage({ kind: "info", text: t("solo.menu.imported") });
    } catch (error) {
      setMessage({ kind: "error", text: t("solo.menu.importFailed", { reason: reason(error) }) });
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  useBackHandler(() => {
    if (screen.kind === "setup") {
      setScreen({ kind: "menu" });
      return true;
    }
    return false;
  });

  if (screen.kind === "playing") {
    return (
      <>
        <Game transport={screen.session} onLeave={() => void leave()} busyNote={t("solo.busy")} />
        {saveProblem && (
          <p className="fq-save-alert" role="alert">
            {t("solo.saveFailed", { reason: saveProblem })}
          </p>
        )}
      </>
    );
  }

  const setup = screen.kind === "setup";
  return (
    <DoorFrame>
      {(layout) => (
        <DoorScene
          layout={layout}
          lobby={{ state: "loading" }}
          townId={null}
          onTown={() => undefined}
          onRetry={() => undefined}
          onPage={onPage}
          variant={setup ? "setup" : "solo"}
          soloNote={offline ? t("choose.online.offline") : null}
          onSwitchMode={onBack}
          focusKey={screen.kind}
        >
          {screen.kind === "opening" ? (
            <div className="fq-door-form" aria-busy="true">
              <p role="status" className="fq-door-line">
                {t("solo.menu.loading")}
              </p>
            </div>
          ) : setup ? (
            <SoloSetup
              onStart={start}
              onBack={() => {
                setMessage(null);
                setScreen({ kind: "menu" });
              }}
              newSeed={platform.newSeed}
              busy={busy}
            />
          ) : (
            <SoloMenu
              saves={saves}
              onContinue={(slot) => void open(slot)}
              onNew={() => {
                setMessage(null);
                setScreen({ kind: "setup" });
              }}
              onDelete={remove}
              onExport={(slot) => void exportSlot(slot)}
              onImport={(file) => void importFile(file)}
              onBack={onBack}
              message={message}
              busy={busy}
            />
          )}
        </DoorScene>
      )}
    </DoorFrame>
  );
}
