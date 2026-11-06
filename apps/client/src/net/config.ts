/**
 * Where the client finds its server and whether it plays against one at all.
 *
 * - `?mock` in the address, or a build with `VITE_MOCK=1`, uses the scripted mock transport
 *   (development and demos; the tests build their own transports).
 * - Inside the desktop or mobile app the player's own address wins: `window.fqWrapper.server`,
 *   read when the page starts (the wrapper reloads the page after the player changes it).
 * - `VITE_SERVER_URL` names the server's origin. Without it the page's own origin is used,
 *   which is what a production build served by `@fq/server` wants (and, in development, the
 *   Vite proxy in `vite.config.ts` forwards `/api` to the server).
 */
export interface ClientConfig {
  mock: boolean;
  /** Empty string means "the page's own origin". */
  serverUrl: string;
  /** In mock mode, the fixture to start on (development only). */
  fixture: string | null;
  /** `?expanded`: play a small local Expanded town (src/dev/ExpandedHost.ts), no server needed. */
  expanded: boolean;
}

export function readConfig(
  search: string,
  env: { VITE_SERVER_URL?: string | undefined; VITE_MOCK?: string | undefined; DEV?: boolean },
  /** `window.fqWrapper`, when the page runs inside a native wrapper. */
  wrapper?: { server?: string | undefined } | undefined,
): ClientConfig {
  const params = new URLSearchParams(search);
  const mock = params.has("mock") || env.VITE_MOCK === "1" || params.has("fixture");
  const fromWrapper = (wrapper?.server ?? "").trim();
  const serverUrl = (fromWrapper !== "" ? fromWrapper : (env.VITE_SERVER_URL ?? ""))
    .trim()
    .replace(/\/+$/, "");
  const fixture = env.DEV ? params.get("fixture") : null;
  return { mock, serverUrl, fixture, expanded: params.has("expanded") };
}
