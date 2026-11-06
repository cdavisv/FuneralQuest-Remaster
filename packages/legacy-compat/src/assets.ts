import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Asset ids back to the picture URLs the original client loads with
 * `loadMovie` (`st_url`, `st_url_bg`).
 *
 * `assets/manifest.json` has a `legacyUrl` object that maps every URL the
 * original used (with both slash styles and both letter cases, for example
 * `flash\places\bank.swf` and `flash/Ring/ring.swf`) to an asset id. This
 * reverses it: the result always uses forward slashes, and when more than one
 * spelling exists it picks one that is a real file under `legacyRoot`, since
 * the server is case sensitive.
 */
export interface AssetManifestLike {
  legacyUrl?: Record<string, string>;
}

export class LegacyAssets {
  private readonly urls = new Map<string, string>();

  constructor(manifest: AssetManifestLike, legacyRoot?: string) {
    const candidates = new Map<string, string[]>();
    for (const [url, id] of Object.entries(manifest.legacyUrl ?? {})) {
      const forward = url.replace(/\\/g, "/");
      const list = candidates.get(id) ?? [];
      if (!list.includes(forward)) list.push(forward);
      candidates.set(id, list);
    }
    for (const [id, list] of candidates) {
      const real = legacyRoot ? list.find((u) => existsSync(resolve(legacyRoot, u))) : undefined;
      const chosen = real ?? list[0];
      if (chosen !== undefined) this.urls.set(id, chosen);
    }
  }

  /** The URL for an asset id, or the conventional `flash/<id>.swf` when the manifest does not list it. */
  urlFor(id: string): string {
    return this.urls.get(id) ?? `flash/${id}.swf`;
  }

  has(id: string): boolean {
    return this.urls.has(id);
  }
}

/** Reads the manifest from disk. */
export function loadAssets(manifestPath: string, legacyRoot?: string): LegacyAssets {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as AssetManifestLike;
  return new LegacyAssets(manifest, legacyRoot);
}
