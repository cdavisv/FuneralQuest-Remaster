/*
 * Funeral Quest mobile glue. Bundled by scripts/prepare-web.mjs into www/fq-mobile.js and loaded
 * before the client's own script. It supplies the host half of the shared wrapper shim
 * (apps/desktop/shim/fq-wrapper.js: server address, gamepad, links, save files) and the
 * mobile-only behaviour: status bar, splash, Android back button, keyboard, local notifications
 * and the funeralquest:// deep link.
 */
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Keyboard } from "@capacitor/keyboard";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Share } from "@capacitor/share";
import { SplashScreen } from "@capacitor/splash-screen";

interface Wrapper {
  server: string;
  parseServer(text: string): { url?: string; error?: string };
  openSettings(): void;
  toast(message: string): void;
  choose(title: string, text: string, labels: string[]): Promise<number>;
  isDialogOpen(): boolean;
}
declare global {
  interface Window {
    fqWrapper?: Wrapper;
    __fqHost?: unknown;
    /** Optional hook the client may set: return true if it handled "back" (see apps/mobile/README.md). */
    fqHandleBack?: () => boolean;
  }
}

const SERVER_KEY = "fqw.server.v1";
const NOTIFY_SOLO = "fqw.notify.solo.v1";
const NOTIFY_ONLINE = "fqw.notify.online.v1";
const TOWN_KEY = "fq.town.v1"; // the client's own "last town" (apps/client/src/net/tokenStore.ts)
const TOKEN_PREFIX = "fq.token";
const MESSAGE = { title: "Funeral Quest", body: "A new day has dawned in Deathville." };
const SOLO_BASE_ID = 4100;
const ONLINE_BASE_ID = 4200;

const flag = (key: string): boolean => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};
const setFlag = (key: string, on: boolean): void => {
  try {
    localStorage.setItem(key, on ? "1" : "0");
  } catch {
    /* storage blocked */
  }
};

// ---- host half of the shared shim ----------------------------------------------------------
const defaultServer: string =
  (window as unknown as { __FQ_DEFAULT_SERVER__?: string }).__FQ_DEFAULT_SERVER__ ?? "";
/** The first release is solo-only (decision 11): no server address, no online reminders, no invitations. */
const soloOnly: boolean =
  (window as unknown as { __FQ_SOLO_ONLY__?: boolean }).__FQ_SOLO_ONLY__ === true;

async function ensureNotificationPermission(): Promise<boolean> {
  let status = await LocalNotifications.checkPermissions();
  if (status.display === "prompt" || status.display === "prompt-with-rationale") {
    status = await LocalNotifications.requestPermissions();
  }
  return status.display === "granted";
}

window.__fqHost = {
  platform: "mobile",
  defaultServer,
  soloOnly,
  openExternal: (url: string) => Browser.open({ url }),
  saveFile: async (name: string, text: string) => {
    // Write to the app's cache, then hand the file to the system share sheet ("Save to Files",
    // a mail app, a drive). The page never gets a filesystem path.
    const safe = name.replace(/[^A-Za-z0-9._-]/g, "-");
    const written = await Filesystem.writeFile({
      path: safe,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: safe, url: written.uri, dialogTitle: "Save your career" });
  },
  extraSettings: [
    {
      id: "notify-solo",
      label: "Remind me each morning in Solo mode",
      get: () => flag(NOTIFY_SOLO),
      set: async (on: boolean) => {
        if (on && !(await ensureNotificationPermission())) {
          window.fqWrapper?.toast("Notifications are off for this app in system settings.");
          setFlag(NOTIFY_SOLO, false);
          return;
        }
        setFlag(NOTIFY_SOLO, on);
        if (!on) await cancelRange(SOLO_BASE_ID, 3);
      },
    },
    ...(soloOnly
      ? []
      : [
          {
            id: "notify-online",
            label: "Tell me when a new day dawns in my online town",
            get: () => flag(NOTIFY_ONLINE),
            set: async (on: boolean) => {
              if (on && !(await ensureNotificationPermission())) {
                window.fqWrapper?.toast("Notifications are off for this app in system settings.");
                setFlag(NOTIFY_ONLINE, false);
                return;
              }
              setFlag(NOTIFY_ONLINE, on);
              if (!on) await cancelRange(ONLINE_BASE_ID, 3);
            },
          },
        ]),
  ],
};

// ---- local notifications --------------------------------------------------------------------
async function cancelRange(base: number, count: number): Promise<void> {
  await LocalNotifications.cancel({
    notifications: Array.from({ length: count }, (_, i) => ({ id: base + i })),
  }).catch(() => {});
}

/** Next local 08:00 (dawn) and the two mornings after it. Solo days are the player's own, so
 *  this is a gentle daily nudge rather than a game event. */
function nextMornings(count: number): Date[] {
  const first = new Date();
  first.setHours(8, 0, 0, 0);
  if (first.getTime() <= Date.now() + 60_000) first.setDate(first.getDate() + 1);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(first);
    d.setDate(d.getDate() + i);
    return d;
  });
}

async function hasSoloCareer(): Promise<boolean> {
  try {
    if (sessionStorage.getItem("fq.solo.playing.v1")) return true;
    const dbs = await indexedDB.databases();
    return dbs.some((d) => d.name === "funeral-quest-solo");
  } catch {
    return false;
  }
}

function hasOnlineSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      if (localStorage.key(i)?.startsWith(TOKEN_PREFIX)) return true;
    }
  } catch {
    /* storage blocked */
  }
  return false;
}

interface TownRow {
  id: string;
  nextDayAt: string;
  dayLengthMinutes: number | null;
}

/** Called when the app goes to the background: schedule what is wanted, locally. No push. */
async function scheduleNotifications(): Promise<void> {
  if (!flag(NOTIFY_SOLO) && !flag(NOTIFY_ONLINE)) return;
  if (!(await ensureNotificationPermission())) return;
  const notifications: Array<{
    id: number;
    title: string;
    body: string;
    schedule: { at: Date; allowWhileIdle: boolean };
    smallIcon: string;
  }> = [];
  const add = (id: number, at: Date) =>
    notifications.push({
      id,
      ...MESSAGE,
      schedule: { at, allowWhileIdle: true },
      smallIcon: "ic_stat_icon",
    });

  if (flag(NOTIFY_SOLO) && (await hasSoloCareer())) {
    for (const [i, at] of nextMornings(3).entries()) add(SOLO_BASE_ID + i, at);
  }
  if (!soloOnly && flag(NOTIFY_ONLINE) && hasOnlineSession()) {
    try {
      // /api/towns is public. window.fetch is the shim's, so this goes to the configured server.
      const res = await fetch("/api/towns");
      const body = (await res.json()) as { towns?: TownRow[] };
      const wanted = localStorage.getItem(TOWN_KEY);
      const town = body.towns?.find((t) => t.id === wanted) ?? body.towns?.[0];
      if (town) {
        const first = new Date(town.nextDayAt);
        // Midnight towns repeat daily (a DST change can shift a later one by an hour, and the
        // list is rebuilt every time the app is opened); a Blitz town gets just its next day.
        const count = town.dayLengthMinutes === null ? 3 : 1;
        for (let i = 0; i < count; i++) {
          const at = new Date(first.getTime() + i * 24 * 3600_000);
          if (at.getTime() > Date.now() + 30_000) add(ONLINE_BASE_ID + i, at);
        }
      }
    } catch {
      /* offline: nothing to schedule for the online town */
    }
  }
  await cancelRange(SOLO_BASE_ID, 3);
  await cancelRange(ONLINE_BASE_ID, 3);
  if (notifications.length > 0) await LocalNotifications.schedule({ notifications });
}

async function clearDeliveredAndPending(): Promise<void> {
  await LocalNotifications.removeAllDeliveredNotifications().catch(() => {});
  await cancelRange(SOLO_BASE_ID, 3);
  await cancelRange(ONLINE_BASE_ID, 3);
}

// ---- back button (Android) -------------------------------------------------------------------
function pressEscape(): void {
  const init = { key: "Escape", code: "Escape", bubbles: true, cancelable: true };
  const target = document.activeElement ?? document.body;
  target.dispatchEvent(new KeyboardEvent("keydown", init));
}

function modalOpen(): boolean {
  return (
    document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"]') !== null
  );
}

async function onBack(canGoBack: boolean): Promise<void> {
  const wrapper = window.fqWrapper;
  // 1. A wrapper dialog handles its own Escape.
  if (wrapper?.isDialogOpen()) return pressEscape();
  // 2. Close the client's top dialog or overlay: the client maps Escape to exactly that.
  if (modalOpen()) return pressEscape();
  // 3. A client that wants to take over the leave-this-screen step may say it did.
  if (window.fqHandleBack?.() === true) return;
  // 4. Static pages and other routed screens (#/rules, #/credits ...): go back in history.
  if (canGoBack || location.hash.length > 1) {
    history.back();
    return;
  }
  // 5. Otherwise confirm leaving the app. Solo careers save after every move, so nothing is lost.
  if (!wrapper) return void App.exitApp();
  if (soloOnly) {
    const leave = await wrapper.choose("Leave Funeral Quest?", "Your solo career is saved.", [
      "Stay",
      "Leave",
    ]);
    if (leave === 1) await App.exitApp();
    return;
  }
  const pick = await wrapper.choose(
    "Leave Funeral Quest?",
    "Your solo career is saved. Online games stay as they are.",
    ["Stay", "Settings...", "Leave"],
  );
  if (pick === 1) wrapper.openSettings();
  else if (pick === 2) await App.exitApp();
}

// ---- deep link: funeralquest://join?server=https://host&town=id ------------------------------
async function onUrl(raw: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return;
  }
  const wrapper = window.fqWrapper;
  // Invitations and the server dialog are online play's: none in the solo-only release.
  if (soloOnly || u.protocol !== "funeralquest:" || !wrapper) return;
  const action = u.hostname || u.pathname.replace(/^\/+/, "");
  if (action === "settings") return wrapper.openSettings();
  if (action !== "join") return;
  const parsed = wrapper.parseServer(u.searchParams.get("server") ?? "");
  if (!parsed.url) {
    wrapper.toast(parsed.error ?? "That invitation has no server address.");
    return;
  }
  const town = (u.searchParams.get("town") ?? "").slice(0, 64);
  if (parsed.url !== wrapper.server) {
    // Never switch servers silently: a link could point anywhere.
    const host = new URL(parsed.url).host;
    const pick = await wrapper.choose(
      "Join a town?",
      `Use the server at ${host} for online play?`,
      ["Cancel", "Join"],
    );
    if (pick !== 1) return;
  }
  try {
    localStorage.setItem(SERVER_KEY, parsed.url);
    if (town) localStorage.setItem(TOWN_KEY, town);
    sessionStorage.removeItem("fq.solo.playing.v1");
  } catch {
    /* storage blocked */
  }
  location.href = "/";
}

// ---- keyboard --------------------------------------------------------------------------------
function keepFocusedFieldVisible(): void {
  const scroll = () => {
    const a = document.activeElement;
    if (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement) {
      a.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  };
  document.addEventListener("focusin", () => setTimeout(scroll, 320));
  void Keyboard.addListener("keyboardDidShow", (info) => {
    document.documentElement.style.setProperty("--fq-keyboard-height", `${info.keyboardHeight}px`);
    scroll();
  });
  void Keyboard.addListener("keyboardDidHide", () =>
    document.documentElement.style.setProperty("--fq-keyboard-height", "0px"),
  );
}

// ---- start -----------------------------------------------------------------------------------
async function start(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  document.documentElement.dataset.fqPlatform = Capacitor.getPlatform();

  // Light status and gesture bar content on the game's dark background (SystemBars is Capacitor core;
  // it also keeps the page out from under the bars and sets the --safe-area-inset-* fallbacks).
  void SystemBars.setStyle({ style: SystemBarsStyle.Dark }).catch(() => {});
  keepFocusedFieldVisible();

  void App.addListener("backButton", ({ canGoBack }) => void onBack(canGoBack));
  void App.addListener("appUrlOpen", ({ url }) => void onUrl(url));
  void App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) void clearDeliveredAndPending();
    else void scheduleNotifications();
  });
  void App.getLaunchUrl().then((r) => {
    if (r?.url) void onUrl(r.url);
  });

  // Hide the splash once the client has drawn its first frame.
  const hide = () => void SplashScreen.hide({ fadeOutDuration: 250 });
  if (document.readyState === "complete") setTimeout(hide, 150);
  else window.addEventListener("load", () => setTimeout(hide, 150));
}

void start();
