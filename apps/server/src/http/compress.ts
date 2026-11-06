import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";
import type { FastifyInstance } from "fastify";

const brotli = promisify(brotliCompress);
const gz = promisify(gzip);

/** Text the web client is made of; pictures, fonts and sound are already compressed or binary. */
const COMPRESSIBLE =
  /^(text\/(html|css|plain|javascript)|application\/(javascript|json|manifest\+json|wasm)|image\/svg\+xml)/;
/** Below this a response costs more to compress than it saves. */
const MIN_BYTES = 1024;
/** Larger than this is not buffered: it is sent as it is. */
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ENTRIES = 512;

/**
 * Compresses the client's own files (scripts, styles, pages, vector art) for browsers that ask
 * for it, so a first visit over a slow connection downloads a quarter of the bytes. Only static
 * files are touched: API responses, the admin page and everything dynamic are never compressed
 * (so a secret in a response can never be guessed from its compressed size). Each file is
 * compressed once, keyed by its ETag, and kept in memory.
 */
export function registerStaticCompression(
  app: FastifyInstance,
  isStatic: (url: string) => boolean,
) {
  const cache = new Map<string, Buffer>();

  app.addHook("onSend", async (request, reply, payload) => {
    if (request.method !== "GET" || reply.statusCode !== 200) return payload;
    if (!isStatic(request.url)) return payload;
    const type = reply.getHeader("content-type");
    if (typeof type !== "string" || !COMPRESSIBLE.test(type)) return payload;
    if (reply.hasHeader("content-encoding")) return payload;
    const accepts = String(request.headers["accept-encoding"] ?? "");
    const encoding = /\bbr\b/.test(accepts) ? "br" : /\bgzip\b/.test(accepts) ? "gzip" : null;
    if (encoding === null) return payload;
    const length = Number(reply.getHeader("content-length") ?? 0);
    if (!(length >= MIN_BYTES && length <= MAX_BYTES)) return payload;
    // A static file reaches here as a read stream.
    if (payload === null || typeof payload !== "object" || !("pipe" in payload)) return payload;
    const stream = payload as unknown as AsyncIterable<Buffer> & { destroy(): void };

    const etag = String(reply.getHeader("etag") ?? "");
    const key = etag === "" ? "" : `${encoding}:${request.url.split("?")[0]}:${etag}`;
    let body = key === "" ? undefined : cache.get(key);
    if (body === undefined) {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk);
      const raw = Buffer.concat(chunks);
      body =
        encoding === "br"
          ? await brotli(raw, {
              params: {
                [constants.BROTLI_PARAM_QUALITY]: 6,
                [constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
              },
            })
          : await gz(raw, { level: 9 });
      if (key !== "") {
        if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
        cache.set(key, body);
      }
    } else {
      // Drain the unread stream so the file handle closes.
      stream.destroy();
    }
    reply.header("content-encoding", encoding);
    reply.header("content-length", body.length);
    reply.header("vary", "Accept-Encoding");
    // A weak validator: the bytes differ from the file's, the content does not.
    if (etag !== "" && !etag.startsWith("W/")) reply.header("etag", `W/${etag}`);
    return body;
  });
}
