export function shouldBundle(relPath: string): boolean;
export function copyArt(
  assetsDir: string,
  outDir: string,
): Promise<{ files: number; bytes: number }>;
export function listArtIds(assetsDir: string): Promise<string[]>;
