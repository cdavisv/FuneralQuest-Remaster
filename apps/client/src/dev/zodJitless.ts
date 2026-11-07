/**
 * zod probes for `eval` with `new Function("")` and swallows the refusal, but a page under a strict
 * Content-Security-Policy (`script-src 'self'`, which this client is served with) reports the
 * attempt anyway: Firefox logs it as a JavaScript error. zod reads its settings from this global
 * when it loads, and `jitless` skips the probe. Import this module before anything that imports
 * zod; the client parses almost nothing with it, so the slower path costs nothing.
 */
const holder = globalThis as unknown as { __zod_globalConfig?: { jitless?: boolean } };
holder.__zod_globalConfig = { ...holder.__zod_globalConfig, jitless: true };
