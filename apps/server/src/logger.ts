import { type DestinationStream, type Logger, pino } from "pino";

/**
 * The process logger: structured JSON lines on stdout. Request bodies and
 * headers are never logged by this server, and as a second line of defence
 * these fields are redacted if a future change ever logs them by mistake.
 */
export function createLogger(level: string, stream?: DestinationStream): Logger {
  return pino(
    {
      level,
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "headers.authorization",
          "*.password",
          "*.token",
          "*.adminToken",
          "password",
          "token",
        ],
        censor: "[redacted]",
      },
    },
    stream,
  );
}
