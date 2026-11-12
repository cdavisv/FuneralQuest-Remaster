import { z } from "zod";
import { LOGIN_PATTERN } from "../auth/accounts.js";
import { TOWN_ID } from "../game/townConfig.js";

/**
 * Request validation. Every body is a strict object (unknown keys are errors)
 * and every string has a maximum length, so nothing unbounded reaches the
 * engine. Control characters are refused in anything a player types.
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: this is exactly what the check is for.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export const safeText = (min: number, max: number) =>
  z
    .string()
    .min(min)
    .max(max)
    .refine((s) => !CONTROL.test(s), "contains control characters");

const id = safeText(1, 128);

const LoginField = z
  .string()
  .regex(LOGIN_PATTERN, "3 to 20 letters, digits, dot, dash or underscore");
const PasswordField = z.string().min(8).max(128);
/** An invite code as typed (spaces and dashes allowed); used only while invites are required. */
const InviteField = z.string().max(40).optional();

export const SignUpBody = z.strictObject({
  login: LoginField,
  password: PasswordField,
  invite: InviteField,
});

/** A guest making their account a full one: a log-in name and a password, no second invite. */
export const UpgradeBody = z.strictObject({ login: LoginField, password: PasswordField });

export const LogInBody = z.strictObject({
  login: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
});

export const GuestBody = z.strictObject({ invite: InviteField });

export const TownParams = z.strictObject({ townId: z.string().regex(TOWN_ID) });

export const ParlorFormSchema = z.strictObject({
  name: safeText(1, 64),
  parlor: safeText(1, 64),
  male: z.boolean(),
  email: safeText(1, 64).optional(),
});

export const EnterBody = z.strictObject({ parlor: ParlorFormSchema.optional() });

export const ActionSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("press"), buttonId: id }),
  z.strictObject({
    type: z.literal("submitText"),
    overlayId: id,
    text: safeText(0, 2000).nullable(),
  }),
  z.strictObject({
    type: z.literal("pickPlayer"),
    overlayId: id,
    playerId: z.number().int().min(0).max(1_000_000).nullable(),
  }),
  z.strictObject({ type: z.literal("confirm"), overlayId: id, accepted: z.boolean() }),
  z.strictObject({ type: z.literal("visit"), placeId: id }),
  z.strictObject({ type: z.literal("chat"), text: safeText(1, 500) }),
  z.strictObject({ type: z.literal("dismiss"), overlayId: id }),
  z.strictObject({ type: z.literal("exit") }),
]);

export const ActionBody = z.strictObject({ action: ActionSchema });

export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("hello"),
    token: z.string().min(1).max(128),
    townId: z.string().regex(TOWN_ID),
  }),
  z.strictObject({ type: z.literal("ping") }),
]);

export const LeaderboardQuery = z.strictObject({
  day: z.string().max(10).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const DaysQuery = z.strictObject({
  limit: z.coerce.number().int().min(1).max(366).default(60),
});

export const HallQuery = z.strictObject({
  townId: z.string().regex(TOWN_ID).optional(),
  before: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * A boolean in a query string. `z.coerce.boolean()` would read "false" as true (any non-empty
 * string is truthy); only "true", "false", "1" and "0" are accepted here.
 */
export const queryBool = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");
