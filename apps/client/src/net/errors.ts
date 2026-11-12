import { ApiError } from "@fq/server/client";
import type { MessageKey } from "../i18n/messages.js";

/** Which form field an error belongs to (null: the form as a whole). */
export type FieldName = "login" | "password" | "name" | "parlor" | "sex" | "invite" | null;

export interface FormProblem {
  field: FieldName;
  /** A message key of the client's own, or the server's words when it gave clear ones. */
  key?: MessageKey;
  text?: string;
}

/**
 * Characters the engine strips from names (a backtick would be read as a colour code); the
 * server refuses them up front, and so does the form. Same set as the server's `NAME_FORBIDDEN`.
 */
export const NAME_FORBIDDEN = /[?|=/\\;:,{}@+`<>%$~]/;
// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are exactly what is refused
const CONTROL = /[\u0000-\u001f\u007f]/;
export const LOGIN_PATTERN = /^[A-Za-z0-9._-]{3,20}$/;

/** The same checks the server makes, so most mistakes are caught before a round trip. */
export function checkLogin(login: string): FormProblem | null {
  if (!LOGIN_PATTERN.test(login)) return { field: "login", key: "form.err.login" };
  return null;
}

export function checkPassword(password: string): FormProblem | null {
  if (password.length < 8) return { field: "password", key: "form.err.passwordShort" };
  if (password.length > 128) return { field: "password", key: "form.err.passwordLong" };
  return null;
}

export function checkNames(name: string, parlor: string): FormProblem | null {
  for (const [field, value] of [
    ["name", name],
    ["parlor", parlor],
  ] as const) {
    if (value.trim() === "") return { field, key: "form.err.required" };
    if (value.length > 64) return { field, key: "form.err.tooLong" };
    if (NAME_FORBIDDEN.test(value) || CONTROL.test(value)) return { field, key: "form.err.chars" };
  }
  return null;
}

/** Turns what the server said into something to show under the right field. */
export function describeError(error: unknown, context: "login" | "signup" | "enter"): FormProblem {
  if (!(error instanceof ApiError)) return { field: null, key: "form.err.network" };
  switch (error.code) {
    case "bad_credentials":
      return { field: "password", key: "form.err.badCredentials" };
    case "login_taken":
      return { field: "login", key: "form.err.loginTaken" };
    case "banned":
      return { field: null, key: "form.err.banned" };
    case "locked":
      return { field: null, key: "form.err.locked" };
    case "rate_limited":
      return { field: null, key: "form.err.rateLimited" };
    case "invalid_parlor": {
      const field = error.field === "parlor" ? "parlor" : error.field === "name" ? "name" : null;
      return { field, text: error.message };
    }
    case "invalid_request":
      return describeIssues(error, context);
    case "no_such_town":
      return { field: null, key: "form.err.noTown" };
    case "invite_required":
      return { field: "invite", key: "form.err.inviteRequired" };
    case "invite_invalid":
      return { field: "invite", key: "form.err.inviteInvalid" };
    case "invite_used_up":
      return { field: "invite", key: "form.err.inviteUsedUp" };
    case "invite_expired":
      return { field: "invite", key: "form.err.inviteExpired" };
    case "forbidden":
    case "signup_disabled":
    case "guest_disabled":
      return { field: null, text: error.message };
    default:
      if (error.status === 401) return { field: null, key: "form.err.sessionExpired" };
      if (error.status === 429) return { field: null, key: "form.err.rateLimited" };
      if (error.status >= 500) return { field: null, key: "form.err.server" };
      return error.message
        ? { field: null, text: error.message }
        : { field: null, key: "form.err.server" };
  }
}

/** The form field a server issue path (`login`, `password`, `parlor.name`, `parlor.parlor`) names. */
function fieldOfPath(path: string): FieldName {
  switch (path) {
    case "login":
    case "password":
      return path;
    case "parlor.name":
    case "name":
      return "name";
    case "parlor.parlor":
    case "parlor":
      return "parlor";
    case "parlor.male":
      return "sex";
    case "invite":
      return "invite";
    default:
      return null;
  }
}

/** Field-level messages from an `invalid_request` answer; the generic line when it gave none. */
function describeIssues(error: ApiError, context: "login" | "signup" | "enter"): FormProblem {
  const first = error.issues?.find((issue) => issue.message.trim() !== "");
  if (first) {
    const field = fieldOfPath(first.path);
    // An issue that names no form field is still the server's reason; show it on the form.
    return { field, text: first.message };
  }
  return { field: context === "enter" ? null : "login", key: "form.err.invalid" };
}
