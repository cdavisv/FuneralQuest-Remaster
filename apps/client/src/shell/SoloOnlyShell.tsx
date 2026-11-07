import { useCallback, useEffect, useState } from "react";
import { useSettings } from "../settings/settings.js";
import type { SoloPlatform } from "../solo/platform.js";
import { SoloShell } from "../solo/SoloShell.js";
import { useAppStyle } from "../util/useAppStyle.js";
import { useLayoutMode } from "../util/useLayout.js";
import { type Route, routeFromHash, StaticPage } from "./StaticPages.js";

/** The static pages a solo-only build has: there is no rankings board without a server. */
const pageFromHash = (): Route | null => {
  const route = typeof location === "undefined" ? null : routeFromHash(location.hash);
  return route === "rankings" ? null : route;
};

/**
 * The front door of the solo-only build (`VITE_SOLO_ONLY=1`, src/util/soloOnly.ts): straight to
 * the player's saved careers and a new one. No server, no log-on, no online-or-solo choice, no
 * Daily Challenge board; nothing here asks the network for anything.
 */
export function SoloOnlyShell({ solo }: { solo: SoloPlatform }) {
  const { settings } = useSettings();
  const layout = useLayoutMode(settings.layout);
  const appStyle = useAppStyle();
  const [route, setRoute] = useState<Route | null>(pageFromHash);

  useEffect(() => {
    const onHash = () => setRoute(pageFromHash());
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

  if (route) {
    return (
      <div className="fq-app" data-layout={layout} data-scene="page" style={appStyle}>
        <StaticPage
          route={route}
          lobby={{ state: "error" }}
          online={false}
          onRoute={goRoute}
          onClose={() => goRoute(null)}
        />
      </div>
    );
  }
  return (
    <SoloShell platform={solo} onPage={(r) => goRoute(r as Route)} onBack={null} offline={false} />
  );
}
