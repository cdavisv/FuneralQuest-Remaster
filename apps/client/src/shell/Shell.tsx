import { type AccountInfo, ApiError, type MeResponse, type ParlorInfo } from "@fq/server/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Game } from "../Game.js";
import { useT } from "../i18n/I18nContext.js";
import { ConductGate } from "../moderation/ConductGate.js"; // moderation hook
import { conductAccepted, setConductContact } from "../moderation/conduct.js"; // moderation hook
import { ModerationProvider } from "../moderation/ModerationContext.js"; // moderation hook
import { say } from "../moderation/text.js"; // moderation hook
import type { ParlorForm as ParlorData } from "../net/backend.js";
import { type Backend, isAuthExpired } from "../net/backend.js";
import { describeError, type FormProblem } from "../net/errors.js";
import { useSettings } from "../settings/settings.js";
import type { SoloPlatform } from "../solo/platform.js";
import { wasPlayingSolo } from "../solo/resume.js";
import { SoloShell } from "../solo/SoloShell.js";
import type { LiveTransport } from "../transport/types.js";
import { useBackHandler } from "../util/back.js";
import { useAppStyle } from "../util/useAppStyle.js";
import { useLayoutMode } from "../util/useLayout.js";
import { ChooseMode } from "./ChooseMode.js";
import { DailyDoor, DailyResults } from "./DailyScreens.js";
import { DoorFrame } from "./DoorFrame.js";
import { DoorScene, type LobbyState } from "./DoorScene.js";
import { CredentialsForm, FormAlert, LogonForm, ParlorForm, WelcomeBack } from "./forms.js";
import { type Route, routeFromHash, StaticPage } from "./StaticPages.js";

type Step =
  | "boot"
  | "choose"
  | "solo"
  | "door"
  | "account"
  | "parlor"
  | "playing"
  | "daily"
  | "dailyResults";

export interface ShellProps {
  backend: Backend;
  /**
   * Offline play against computer rivals. With it the front door first asks how to play (online
   * or solo); without it the door goes straight to the log-on plaque.
   */
  solo?: SoloPlatform;
}

/**
 * The client's top level against a real server: the front door (title screen, log-on plaque,
 * new-user screens, static pages) until the player has entered a town, then the game. It owns
 * the account and the choice of town; the game owns everything inside a session.
 */
export function Shell({ backend, solo }: ShellProps) {
  const t = useT();
  const { settings } = useSettings();
  const layout = useLayoutMode(settings.layout);
  const appStyle = useAppStyle();

  const [lobby, setLobby] = useState<LobbyState>({ state: "loading" });
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [parlors, setParlors] = useState<ParlorInfo[]>([]);
  const [townId, setTownId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("boot");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<FormProblem | null>(null);
  const [transport, setTransport] = useState<LiveTransport | null>(null);
  const [route, setRoute] = useState<Route | null>(() =>
    typeof location === "undefined" ? null : routeFromHash(location.hash),
  );
  const [museum, setMuseum] = useState<string | null>(null);
  const [dailyOn, setDailyOn] = useState(false);
  const [playingDaily, setPlayingDaily] = useState(false);
  const [dailyProblem, setDailyProblem] = useState<string | null>(null);
  // moderation hook: the conduct notice must be agreed to once before online play
  const [conduct, setConduct] = useState(() => conductAccepted());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // The Android back button steps back out of a form, the way its Back arrow does.
  useBackHandler(() => {
    if (step === "account" || step === "parlor" || step === "daily" || step === "dailyResults") {
      setStep("door");
      return true;
    }
    return false;
  });

  // Static pages live at #/rules and so on, so links and the back button work.
  useEffect(() => {
    const onHash = () => setRoute(routeFromHash(location.hash));
    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onHash);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("popstate", onHash);
    };
  }, []);
  const goRoute = useCallback((next: Route | null) => {
    if (next) location.hash = `#/${next}`;
    else history.pushState(null, "", location.pathname + location.search);
    setRoute(next);
  }, []);

  /** Asks the server who this is. A refused token is forgotten; a missing server is not an answer. */
  const loadAccount = useCallback(async (): Promise<MeResponse | null> => {
    const clear = () => {
      if (!alive.current) return;
      setAccount(null);
      setParlors([]);
    };
    if (!backend.hasSession()) {
      clear();
      return null;
    }
    try {
      const me = await backend.me();
      if (!alive.current) return null;
      setAccount(me.account);
      setParlors(me.parlors);
      return me;
    } catch (error) {
      if (isAuthExpired(error)) backend.forget();
      clear();
      return null;
    }
  }, [backend]);

  const loadLobby = useCallback(async (): Promise<string | null> => {
    setLobby({ state: "loading" });
    try {
      const towns = await backend.towns();
      if (!alive.current) return null;
      setLobby({ state: "ready", towns });
      const wanted = backend.lastTown();
      const pick = towns.find((x) => x.id === wanted) ?? towns[0];
      setTownId((current) =>
        current && towns.some((x) => x.id === current) ? current : (pick?.id ?? null),
      );
      return pick?.id ?? null;
    } catch {
      if (alive.current) setLobby({ state: "error" });
      return null;
    }
  }, [backend]);

  /** Enters a town; throws what the server said, so the calling form can show it. */
  const enter = useCallback(
    async (id: string, parlor?: { name: string; parlor: string; male: boolean }) => {
      const next = backend.open(id, parlor);
      await next.connect();
      if (!alive.current) return;
      backend.setLastTown(id);
      backend.setPlaying(id);
      setTransport(next);
      setNotice(null);
      setStep("playing");
    },
    [backend],
  );

  /** Door-level entering: problems become a message on the plaque rather than a form error. */
  const enterFromDoor = useCallback(
    async (id: string) => {
      setBusy(true);
      setNotice(null);
      try {
        await enter(id);
      } catch (error) {
        if (!alive.current) return;
        if (error instanceof ApiError && error.code === "parlor_required") {
          setStep("parlor");
        } else {
          if (isAuthExpired(error)) {
            backend.forget();
            setAccount(null);
          }
          setNotice(describeError(error, "enter"));
          setStep("door");
        }
      } finally {
        if (alive.current) setBusy(false);
      }
    },
    [enter, backend],
  );

  // First load: the lobby listing, who this device is, and (after a reload mid-game) back in.
  // biome-ignore lint/correctness/useExhaustiveDependencies: boot once per backend.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [id, me] = await Promise.all([loadLobby(), loadAccount()]);
      if (cancelled || !alive.current) return;
      const resume = backend.resumeTown();
      if (me && resume && resume === id && conductAccepted()) {
        setStep("door");
        await enterFromDoor(resume);
        return;
      }
      backend.setPlaying(null);
      // Offline (or asked for with ?solo), only solo play can work: go there, not to a dead end.
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      const asked =
        typeof location !== "undefined" && new URLSearchParams(location.search).has("solo");
      setStep(solo ? (offline || asked || wasPlayingSolo() ? "solo" : "choose") : "door");
    })();
    // What the server offers besides the game; a server without the endpoint offers nothing.
    void backend
      .features?.()
      .then((f) => {
        if (cancelled) return;
        setConductContact(f.safety?.contactEmail); // moderation hook
        if (f.museum.enabled) setMuseum(f.museum.path);
        if (f.dailyChallenge?.enabled && backend.daily) setDailyOn(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [backend]);

  /** After any successful log-in, sign-up or guest start. */
  const afterAuth = useCallback(async () => {
    const me = await loadAccount();
    if (!me || !alive.current) return;
    const id = townId ?? backend.lastTown();
    if (!id) return;
    if (me.parlors.some((p) => p.townId === id)) await enterFromDoor(id);
    else setStep("parlor");
  }, [backend, loadAccount, enterFromDoor, townId]);

  const guard = useCallback(async (work: () => Promise<void>) => {
    setBusy(true);
    setNotice(null);
    try {
      await work();
    } finally {
      if (alive.current) setBusy(false);
    }
  }, []);

  const onLogIn = (login: string, password: string) =>
    guard(async () => {
      await backend.logIn(login, password);
      await afterAuth();
    });

  const onGuest = () =>
    guard(async () => {
      try {
        await backend.guest();
      } catch (error) {
        setNotice(describeError(error, "login"));
        return;
      }
      await afterAuth();
    });

  const onSignUp = (login: string, password: string) =>
    guard(async () => {
      await backend.signUp(login, password);
      await loadAccount();
      setStep("parlor");
    });

  const onParlor = (form: { name: string; parlor: string; male: boolean }) => {
    const id = townId;
    if (!id) return Promise.reject(new Error("no town"));
    return guard(async () => {
      try {
        await enter(id, form);
      } catch (error) {
        if (isAuthExpired(error)) {
          backend.forget();
          setAccount(null);
          setStep("door");
          setNotice(describeError(error, "enter"));
          return;
        }
        throw error;
      }
    });
  };

  const onLogOut = () =>
    guard(async () => {
      await backend.logOut();
      setAccount(null);
      setParlors([]);
      setStep("door");
    });

  const onLeave = useCallback(() => {
    backend.setPlaying(null);
    setTransport(null);
    setNotice(null);
    // A Daily Challenge run ends at its results; a town at the front door.
    setStep(playingDaily ? "dailyResults" : "door");
    setPlayingDaily(false);
    void loadLobby();
    void loadAccount();
  }, [backend, loadLobby, loadAccount, playingDaily]);

  // moderation hook: the account was deleted from Settings; forget the session, back to the door
  const onAccountDeleted = useCallback(() => {
    backend.forget();
    setAccount(null);
    setParlors([]);
    onLeave();
    setNotice({ field: null, text: say("delete.done") });
  }, [backend, onLeave]);

  /** Starts (or resumes) today's challenge; a run already over goes to the results. */
  const playDaily = useCallback(
    async (parlor?: ParlorData) => {
      const daily = backend.daily;
      if (!daily) return;
      setBusy(true);
      setDailyProblem(null);
      try {
        const next = daily.open(parlor);
        await next.connect();
        if (!alive.current) return;
        setPlayingDaily(true);
        setTransport(next);
        setStep("playing");
      } catch (error) {
        if (!alive.current) return;
        if (error instanceof ApiError && error.code === "already_played") {
          setStep("dailyResults");
        } else {
          if (isAuthExpired(error)) {
            backend.forget();
            setAccount(null);
          }
          setDailyProblem(t("x.challenge.error"));
        }
      } finally {
        if (alive.current) setBusy(false);
      }
    },
    [backend, t],
  );

  const dailyGuest = useCallback(async () => {
    setBusy(true);
    try {
      await backend.guest();
      await loadAccount();
    } catch {
      if (alive.current) setDailyProblem(t("x.challenge.error"));
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [backend, loadAccount, t]);

  if (step === "playing" && transport) {
    const game = <Game transport={transport} onLeave={onLeave} />;
    // moderation hook: report, block and delete-account exist in a town session, never in the Daily Challenge
    return backend.moderation && townId && !playingDaily ? (
      <ModerationProvider
        api={backend.moderation}
        townId={townId}
        onAccountDeleted={onAccountDeleted}
      >
        {game}
      </ModerationProvider>
    ) : (
      game
    );
  }

  const town = lobby.state === "ready" ? lobby.towns.find((x) => x.id === townId) : undefined;
  const myParlor = parlors.find((p) => p.townId === townId) ?? null;

  const body = (() => {
    if (step === "boot") {
      return (
        <div className="fq-door-form" aria-busy="true">
          <p role="status" className="fq-door-line">
            {t("app.loading")}
          </p>
        </div>
      );
    }
    // moderation hook: online play starts with the house rules
    if (!conduct && step !== "choose") {
      return (
        <ConductGate
          onAccept={() => setConduct(true)}
          onRules={() => goRoute("rules")}
          onDecline={solo ? () => setStep("choose") : undefined}
        />
      );
    }
    if (step === "choose" && solo) {
      return (
        <ChooseMode
          onOnline={() => setStep("door")}
          onSolo={() => setStep("solo")}
          server={lobby.state}
          offline={typeof navigator !== "undefined" && navigator.onLine === false}
          museumPath={museum}
        />
      );
    }
    if (step === "daily" && backend.daily) {
      return (
        <DailyDoor
          daily={backend.daily}
          signedIn={account !== null}
          login={account?.login ?? null}
          busy={busy}
          problem={dailyProblem}
          onPlay={(parlor) => void playDaily(parlor)}
          onGuest={() => void dailyGuest()}
          onResults={() => setStep("dailyResults")}
          onBack={() => setStep("door")}
        />
      );
    }
    if (step === "dailyResults" && backend.daily) {
      return <DailyResults daily={backend.daily} onBack={() => setStep("door")} />;
    }
    if (step === "account") {
      return <CredentialsForm onSubmit={onSignUp} onBack={() => setStep("door")} busy={busy} />;
    }
    if (step === "parlor") {
      return <ParlorForm onSubmit={onParlor} onBack={() => setStep("door")} busy={busy} />;
    }
    if (account) {
      return (
        <>
          <WelcomeBack
            login={account.login}
            guest={account.guest}
            parlorName={myParlor?.name ?? null}
            onContinue={() => (townId ? void enterFromDoor(townId) : undefined)}
            onLogOut={() => void onLogOut()}
            busy={busy || !town}
          />
          <FormAlert problem={notice} />
        </>
      );
    }
    return (
      <>
        <LogonForm
          onLogIn={onLogIn}
          onNewUser={() => {
            setNotice(null);
            setStep("account");
          }}
          onGuest={() => void onGuest()}
          busy={busy || lobby.state !== "ready"}
        />
        <FormAlert problem={notice} />
      </>
    );
  })();

  if (step === "solo" && solo && !route) {
    return (
      <SoloShell
        platform={solo}
        onPage={(r) => goRoute(r as Route)}
        onBack={() => setStep("choose")}
        offline={typeof navigator !== "undefined" && navigator.onLine === false}
      />
    );
  }

  if (route) {
    return (
      <div className="fq-app" data-layout={layout} data-scene="page" style={appStyle}>
        <StaticPage route={route} lobby={lobby} onRoute={goRoute} onClose={() => goRoute(null)} />
      </div>
    );
  }

  return (
    <DoorFrame>
      {(frameLayout) => (
        <DoorScene
          layout={frameLayout}
          lobby={lobby}
          townId={townId}
          onTown={setTownId}
          onRetry={() => void loadLobby()}
          onPage={(r) => goRoute(r as Route)}
          clerkAtDesk={step === "account" || step === "parlor"}
          focusKey={`${step}:${account ? "in" : "out"}`}
          {...(solo && step !== "choose" ? { onSwitchMode: () => setStep("choose") } : {})}
          daily={
            dailyOn && (step === "door" || step === "daily" || step === "dailyResults")
              ? { onOpen: () => setStep("daily"), onResults: () => setStep("dailyResults") }
              : null
          }
          museumPath={step === "choose" ? null : museum}
        >
          {body}
        </DoorScene>
      )}
    </DoorFrame>
  );
}
