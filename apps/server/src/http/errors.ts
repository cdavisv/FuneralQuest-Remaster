import type { FastifyError, FastifyInstance, FastifyReply } from "fastify";
import { ZodError } from "zod";
import { HasherBusy } from "../auth/passwords.js";
import type { ErrorBody } from "../wire.js";

/** An error that becomes a JSON response with this status. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Partial<ErrorBody> = {},
  ) {
    super(message);
  }
}

export function installErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | HttpError | ZodError | Error, request, reply) => {
    if (error instanceof HttpError) {
      return reply
        .status(error.status)
        .send({ error: error.code, message: error.message, ...error.extra });
    }
    if (error instanceof HasherBusy) {
      return reply
        .status(503)
        .header("retry-after", "5")
        .send({ error: "busy", message: "The server is busy. Try again in a few seconds." });
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "invalid_request",
        message: "The request body or parameters are not valid.",
        issues: error.issues
          .slice(0, 10)
          .map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    const status =
      "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
    if (status === 413) {
      return reply
        .status(413)
        .send({ error: "too_large", message: "The request body is too large." });
    }
    if (status === 429) {
      return reply.status(429).send({
        error: "rate_limited",
        message: "Too many requests. Slow down and try again shortly.",
      });
    }
    if (status >= 400 && status < 500) {
      const code = "code" in error && typeof error.code === "string" ? error.code : "bad_request";
      return reply.status(status).send({
        error: code.startsWith("FST_ERR_CTP") ? "bad_request" : code.toLowerCase(),
        message:
          code === "FST_ERR_CTP_INVALID_MEDIA_TYPE"
            ? "Send JSON with Content-Type: application/json."
            : "The request could not be understood.",
      });
    }
    // Never leak internals. The details go to the log (which never holds bodies or tokens).
    request.log.error({ err: error }, "unhandled error");
    return reply.status(500).send({ error: "internal", message: "Something went wrong." });
  });
}

/** The JSON 404 every unknown endpoint gets. The app installs exactly one not-found handler. */
export function sendNotFound(reply: FastifyReply): FastifyReply {
  return reply.status(404).send({ error: "not_found", message: "No such endpoint." });
}
