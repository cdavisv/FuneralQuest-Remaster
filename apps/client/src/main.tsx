import "@fontsource/cormorant-garamond/600-italic.css";
import "@fontsource/cormorant-garamond/700-italic.css";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/400-italic.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/pirata-one/400.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/art.css";
import "./styles/door.css";
import "./styles/solo.css";
import "./styles/desk.css";
import "./styles/expanded.css";
import "./styles/panels.css";
import "./styles/pad.css";
import "./styles/contrast.css";
import "./styles/moderation.css"; // moderation hook
import { type ReactNode, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { MockTransport } from "./mock/MockTransport.js";
import { createBackend } from "./net/backend.js";
import { readConfig } from "./net/config.js";
import { registerServiceWorker } from "./pwa.js";
import { browserSoloPlatform } from "./solo/platform.js";
import { soloOnly } from "./util/soloOnly.js";
import { getWrapper } from "./wrapper.js";

// With `?mock` (or VITE_MOCK=1) the game runs against scripted fixtures, no server needed;
// in development `?fixture=negotiation1` starts it on a named screen (src/mock/fixtures.ts).
// Otherwise it talks to the server named by VITE_SERVER_URL, or to the page's own origin.
const config = readConfig(location.search, import.meta.env, getWrapper());

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

const mount = (app: ReactNode) => createRoot(root).render(<StrictMode>{app}</StrictMode>);

if (config.expanded) {
  // A local Expanded town for development and tests. The engine is a separate chunk that only
  // this switch loads (src/dev/ExpandedHost.ts).
  void import("./dev/ExpandedHost.js").then(({ ExpandedHost, expandedOptions }) => {
    const params = new URLSearchParams(location.search);
    const host = new ExpandedHost(expandedOptions(location.search), params.get("start"));
    // The Playwright specs reach behind the screen through this (src/dev/ExpandedHost.ts).
    (window as unknown as { __fqExpanded?: unknown }).__fqExpanded = host;
    mount(<App transport={host} />);
  });
} else if (soloOnly()) {
  // The solo-only build never creates a backend, so it cannot ask a server for anything.
  mount(<App solo={browserSoloPlatform()} soloOnly />);
} else {
  mount(
    config.mock ? (
      <App transport={new MockTransport(config.fixture ? { start: config.fixture } : {})} />
    ) : (
      <App backend={createBackend({ baseUrl: config.serverUrl })} solo={browserSoloPlatform()} />
    ),
  );
}

if (import.meta.env.PROD && !config.mock && !config.expanded) registerServiceWorker();
