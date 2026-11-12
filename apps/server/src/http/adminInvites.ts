import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppContext } from "./context.js";
import { HttpError } from "./errors.js";
import { safeText } from "./schemas.js";

const CreateInvite = z.strictObject({
  /** What the batch is for, for the sysop's own records ("Discord batch 1"). */
  label: safeText(1, 80),
  /** How many accounts (or guests) the code may make. */
  uses: z.number().int().min(1).max(1000),
  /** Days until the code stops working; leave out for no expiry. */
  expiresInDays: z.number().positive().max(3650).optional(),
});

const InviteParams = z.object({ inviteId: z.coerce.number().int().min(1) });

/** What the invite record holds, said once for the API and the admin page alike. */
export const INVITES_RECORDED =
  "For each code: its label, how many accounts it may make, how many it has made, its expiry and when it was made or revoked. Which accounts used a code is not recorded.";

/**
 * `/admin/invites`: invite codes for a closed beta. While `FQ_INVITE_REQUIRED` is on, a new
 * account or guest needs one; a guest upgrading does not need a second. Creating and revoking go
 * to the audit log.
 */
export function registerInviteAdmin(
  admin: FastifyInstance,
  ctx: AppContext,
  audit: (request: FastifyRequest, kind: string, townId: string | null, data: unknown) => void,
): void {
  const { accounts } = ctx;

  admin.get("/invites", async () => ({
    inviteRequired: ctx.config.inviteRequired,
    recorded: INVITES_RECORDED,
    invites: accounts.listInvites(),
  }));

  admin.post("/invites", async (request, reply) => {
    const body = CreateInvite.parse(request.body);
    const expiresAt =
      body.expiresInDays === undefined
        ? null
        : ctx.clock.now() + Math.round(body.expiresInDays * 86_400_000);
    const invite = accounts.createInvite(body.label, body.uses, expiresAt);
    audit(request, "invite:create", null, {
      inviteId: invite.id,
      code: invite.code,
      label: invite.label,
      uses: invite.uses,
      expiresAt: invite.expiresAt,
    });
    return reply.status(201).send(invite);
  });

  admin.post("/invites/:inviteId/revoke", async (request) => {
    const { inviteId } = InviteParams.parse(request.params);
    if (!accounts.getInvite(inviteId)) {
      throw new HttpError(404, "no_such_invite", "No such invite code.");
    }
    if (accounts.revokeInvite(inviteId)) {
      const invite = accounts.getInvite(inviteId);
      audit(request, "invite:revoke", null, {
        inviteId,
        code: invite?.code,
        label: invite?.label,
        used: invite?.used,
      });
    }
    return accounts.getInvite(inviteId);
  });
}
