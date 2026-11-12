import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { adminPageHtml } from "./adminPage.js";
import type { AppContext } from "./context.js";

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * The public page that says how to delete an account without logging in (the app stores ask for
 * a web address for this). It is plain HTML with no script. The operator's contact address comes
 * from `FQ_CONTACT_EMAIL`; until it is set the page shows a marked blank, so it cannot be
 * published by accident with nothing to write to.
 */
export function deletionPageHtml(contact: string): string {
  const address =
    contact === ""
      ? `<mark>[CONTACT ADDRESS - OPERATOR TO FILL IN (set FQ_CONTACT_EMAIL)]</mark>`
      : `<a href="mailto:${escapeHtml(contact)}">${escapeHtml(contact)}</a>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Delete your Funeral Quest account</title>
<style>
body{font:17px/1.55 Georgia,serif;max-width:40rem;margin:2rem auto;padding:0 1rem;color:#1d1a16;background:#faf8f4}
h1{font-size:1.5rem}mark{background:#ffe08a;padding:0 .3rem}
@media (prefers-color-scheme:dark){body{color:#ece6da;background:#171512}a{color:#d9a7a7}mark{color:#1d1a16}}
</style>
</head>
<body>
<h1>Delete your Funeral Quest account</h1>
<p><b>Draft page for the operator to review.</b> This explains how to have your online account and its data deleted. Solo careers live only on your own device and never reach us: clearing the app's or browser's data removes them.</p>

<h2>If you can still log in</h2>
<p>Open the game, choose Settings, then Delete account. You will be asked for your password (guests are asked to confirm) and the deletion happens at once. You can also download everything we hold about you from the same place first.</p>

<h2>If you cannot log in</h2>
<p>Write to ${address} from any address, with the log-in name of the account (and, if you remember it, the name of your parlor and the town you played in). We may ask you to prove the account is yours, for instance by logging in once, or by telling us something only its owner would know. We aim to answer within 30 days.</p>

<h2>What deletion does</h2>
<ul>
<li>Removes your account, log-in sessions, block list, mutes, Daily Challenge entries and the record of which days you played.</li>
<li>Closes your parlor in every town: your name and parlor name are taken out of the rankings, the newspaper, other players' letters, the hall of fame and rollback copies, and the letters, announcements, battle quotes and fortunes you wrote that are still waiting or printed are removed.</li>
<li>Deletes the reports you filed that were settled, and the records of what you typed.</li>
</ul>

<h2>What we keep, and why</h2>
<ul>
<li>A note that the deletion happened.</li>
<li>Records of moderation actions about the account (such as a ban) and any report about you that has not yet been looked at, so that abuse is not erased by leaving. These are removed once the report is settled and its retention period ends.</li>
<li>Text you wrote that other players had already read stays in their memory, and copies in server backups last until the backups rotate.</li>
</ul>
<p>See the privacy policy for the retention periods.</p>
</body>
</html>
`;
}

export function registerPages(app: FastifyInstance, ctx: AppContext): void {
  app.get("/account/delete", async (_request, reply) =>
    reply
      .header("content-type", "text/html; charset=utf-8")
      .header("cache-control", "public, max-age=300")
      .header("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'")
      .send(deletionPageHtml(ctx.config.contactEmail)),
  );

  // The moderation page is a shell: no data, no secrets. Every call it makes needs the admin token.
  const admin = async (_request: unknown, reply: import("fastify").FastifyReply) => {
    if (ctx.config.adminToken === "") {
      return reply
        .status(503)
        .header("content-type", "text/plain; charset=utf-8")
        .send("Set FQ_ADMIN_TOKEN to enable the admin API and this page.");
    }
    const nonce = randomBytes(16).toString("base64");
    return reply
      .header("content-type", "text/html; charset=utf-8")
      .header(
        "content-security-policy",
        `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      )
      .send(adminPageHtml(nonce, ctx.config.contactEmail));
  };
  app.get("/admin/", admin);
  app.get("/admin", admin);
}
