import type { RichText } from "@fq/protocol";

export interface Announcement {
  who: string;
  parlor: string;
  /** The announcement as the paper prints it, header included. */
  text: string;
}

/**
 * The announcements on a page of the Funeral Times. The paper is one block of text; the server
 * prints each announcement under a header "<name> of <parlor> makes an announcement:" and ends it
 * with a blank line. A page whose wording differs (another content pack) simply yields none.
 */
export function findAnnouncements(body: RichText): Announcement[] {
  const plain = body.map((s) => s.text).join("");
  const out: Announcement[] = [];
  const header = /(?:^|\n)([^\r\n]+?) of ([^\r\n]+?) makes an announcement:[ \t]*\r?\n/g;
  for (let m = header.exec(plain); m; m = header.exec(plain)) {
    const start = m.index + (m[0].startsWith("\n") ? 1 : 0);
    const rest = plain.slice(header.lastIndex);
    const end = rest.search(/\r?\n\r?\n/);
    const message = (end === -1 ? rest : rest.slice(0, end)).trim();
    out.push({
      who: m[1] ?? "",
      parlor: m[2] ?? "",
      text: plain.slice(start, header.lastIndex).trim() + (message ? `\n${message}` : ""),
    });
  }
  return out;
}
