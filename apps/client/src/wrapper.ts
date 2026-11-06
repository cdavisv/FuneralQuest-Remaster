/**
 * The native wrappers (apps/desktop's Tauri shell and apps/mobile's Capacitor shell) share one
 * script, `apps/desktop/shim/fq-wrapper.js`, that runs before the page and defines
 * `window.fqWrapper` (and `window.__fqHost`, the host's own half). This file is the client's
 * whole knowledge of them. Everything here is optional: in a browser neither exists and every
 * function answers "no wrapper".
 *
 * What the client uses:
 * - `server`: the player's server address (empty: the page's own origin);
 * - `openSettings()`: the wrapper's "Server address" dialog;
 * - `saveFile(name, text, type)`: a native save dialog or share sheet (a webview ignores
 *   `<a download>` with a blob). The shim keeps it on `__fqHost`; a wrapper may also put it on
 *   `fqWrapper`, and either is used;
 * - `openFile(accept)`: optional, a native "open" dialog resolving with the file's name and text
 *   (or null when cancelled). Without it the page's own file input is used, which works in both
 *   webviews;
 * - `window.fqHandleBack()`: defined here for the Android back button.
 */
export interface FqWrapper {
  server?: string;
  openSettings?(): void;
  saveFile?(name: string, text: string, type?: string): Promise<unknown> | undefined;
  openFile?(accept?: string): Promise<{ name: string; text: string } | null>;
  toast?(message: string): void;
}

export interface FqHost {
  platform?: string;
  saveFile?(name: string, text: string, type?: string): Promise<unknown> | undefined;
}

declare global {
  interface Window {
    fqWrapper?: FqWrapper;
    __fqHost?: FqHost;
    /**
     * The Android back button (apps/mobile/glue/fq-mobile.ts calls it after it has closed its own
     * dialogs and the client's top dialog). True when the client handled "back".
     */
    fqHandleBack?: () => boolean;
  }
}

export function getWrapper(win: Pick<Window, "fqWrapper"> = window): FqWrapper | undefined {
  return typeof window === "undefined" ? undefined : win.fqWrapper;
}

/** True inside the desktop or mobile app (not in a browser tab). */
export function inWrapper(win: Pick<Window, "fqWrapper" | "__fqHost"> = window): boolean {
  return (
    typeof window !== "undefined" && (win.fqWrapper !== undefined || win.__fqHost !== undefined)
  );
}

/** The wrapper's server address, or undefined when there is no wrapper or it names none. */
export function wrapperServer(win: Pick<Window, "fqWrapper"> = window): string | undefined {
  const server = getWrapper(win)?.server;
  return typeof server === "string" && server.trim() !== "" ? server.trim() : undefined;
}

/** Opens the wrapper's server-address dialog. False when there is no wrapper to ask. */
export function openWrapperSettings(win: Pick<Window, "fqWrapper"> = window): boolean {
  const w = getWrapper(win);
  if (!w?.openSettings) return false;
  w.openSettings();
  return true;
}

/**
 * Hands a file to the wrapper's save dialog. Resolves true when the wrapper took it (even if the
 * person cancelled the dialog), false when there is none and the caller should use a download
 * link; rejects when the wrapper failed.
 */
export async function saveWithWrapper(
  name: string,
  text: string,
  type = "application/json",
  win: Pick<Window, "fqWrapper" | "__fqHost"> = window,
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const save = win.fqWrapper?.saveFile
    ? win.fqWrapper.saveFile.bind(win.fqWrapper)
    : win.__fqHost?.saveFile
      ? win.__fqHost.saveFile.bind(win.__fqHost)
      : null;
  if (!save) return false;
  await save(name, text, type);
  return true;
}

/** Whether the wrapper offers a native "open file" dialog. */
export function canOpenWithWrapper(win: Pick<Window, "fqWrapper"> = window): boolean {
  return typeof win.fqWrapper?.openFile === "function";
}

export async function openWithWrapper(
  accept: string,
  win: Pick<Window, "fqWrapper"> = window,
): Promise<{ name: string; text: string } | null> {
  const open = win.fqWrapper?.openFile;
  if (!open) return null;
  return open.call(win.fqWrapper, accept);
}
