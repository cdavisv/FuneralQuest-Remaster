import { randomInt } from "node:crypto";
import type { InviteRow } from "../db/stores.js";

/**
 * Invite codes: 10 characters from an alphabet without look-alikes (no 0, O, 1, I or L), so a code
 * can be read aloud and typed from a screenshot. About 49 bits; with the per-address limit on wrong
 * codes nobody guesses one. Shown in two groups of five (`ABCDE-FGHJK`); compared upper-cased with
 * spaces and dashes taken out.
 */
export const INVITE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const INVITE_LENGTH = 10;

/** A fresh code, normalised (no dash). */
export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < INVITE_LENGTH; i++)
    code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  return code;
}

/** What a player typed, as stored: upper case, without spaces or dashes. */
export function normaliseInviteCode(typed: string): string {
  return typed.replace(/[\s\-‐-―]+/g, "").toUpperCase();
}

/** The code as shown and handed out: `ABCDE-FGHJK`. */
export function formatInviteCode(code: string): string {
  return code.length === INVITE_LENGTH ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}

export type InviteState = "active" | "used_up" | "expired" | "revoked";

export function inviteState(row: InviteRow, now: number): InviteState {
  if (row.revoked_at !== null) return "revoked";
  if (row.expires_at !== null && row.expires_at <= now) return "expired";
  if (row.used >= row.max_uses) return "used_up";
  return "active";
}

/** An invite as the admin API returns it. */
export interface InviteInfo {
  id: number;
  code: string;
  label: string;
  uses: number;
  used: number;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  state: InviteState;
}

export function inviteInfo(row: InviteRow, now: number): InviteInfo {
  const iso = (t: number | null) => (t === null ? null : new Date(t).toISOString());
  return {
    id: row.id,
    code: formatInviteCode(row.code),
    label: row.label,
    uses: row.max_uses,
    used: row.used,
    expiresAt: iso(row.expires_at),
    createdAt: new Date(row.created_at).toISOString(),
    revokedAt: iso(row.revoked_at),
    state: inviteState(row, now),
  };
}
