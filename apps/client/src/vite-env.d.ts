/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where picture layers are fetched from: `${VITE_ASSET_BASE}/${assetId}.svg`. */
  readonly VITE_ASSET_BASE?: string;
  /** The game server's origin. Empty or unset means the page's own origin. */
  readonly VITE_SERVER_URL?: string;
  /** "1" starts the mock transport instead of connecting to a server. */
  readonly VITE_MOCK?: string;
  /**
   * "1" builds the solo-only game: no server address, no log-on, no chat, no Daily Challenge
   * board, nothing online (decisions 11 and 14: the first mobile release and the GitHub Pages
   * build). Unset for the web client the game server serves and for the desktop app.
   */
  readonly VITE_SOLO_ONLY?: string;
}

/** The asset ids of the Classic pictures this build carries (made by vite.config.ts). */
declare module "virtual:fq-classic-ids" {
  const ids: string[];
  export default ids;
}
