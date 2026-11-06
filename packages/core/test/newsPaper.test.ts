import { describe, expect, it } from "vitest";
import { linkHref, richTextToPlain, runDailyMaintenance, type TownState } from "../src/index.js";
import { act, edit, ids, press, socialTown, submit } from "./support/social.js";

const plain = richTextToPlain;

/** At the desk across midnight: the paper, then the morning screen, then the desk. */
function wake(town: TownState, ctx: ReturnType<typeof socialTown>["ctx"]): TownState {
  const read = press(town, 0, "go:news", ctx);
  let t = press(press(read.town, 0, "go:desk", ctx).town, 0, "go:desk", ctx).town;
  for (
    let o = t.sessions["0"]?.view?.overlay;
    o?.kind === "message";
    o = t.sessions["0"]?.view?.overlay
  ) {
    t = act(t, 0, { type: "dismiss", overlayId: o.id }, ctx).town;
  }
  return t;
}

function paper(town: TownState, ctx: ReturnType<typeof socialTown>["ctx"]) {
  return press(town, 0, "go:news", ctx);
}

describe("the Funeral Times (commands_news.cpp)", () => {
  it("front page, Crime, yesterday and today, each with Continue (:4-170)", () => {
    const { town, ctx } = socialTown(1, 2);
    const front = paper(town, ctx);
    expect(ids(front.view)).toEqual(["news:crime", "news:yesterday", "news:announce", "go:desk"]);
    expect(front.view.news?.section).toBe("front");
    expect(plain(front.view.news?.body ?? [])).toContain(
      "A new parlor (Skelly Rest) run by Skelly",
    );
    const crime = press(front.town, 0, "news:crime", ctx);
    expect(plain(crime.view.news?.body ?? [])).toBe("There has been no crime reported today.");
    expect(ids(crime.view)[0]).toBe("news:front");
    const next = runDailyMaintenance(press(front.town, 0, "go:desk", ctx).town, ctx).town;
    const awake = wake(next, ctx);
    const today = press(awake, 0, "go:news", ctx);
    expect(today.view.news?.day).toBe(2);
    const yesterday = press(today.town, 0, "news:yesterday", ctx);
    expect(yesterday.view.news?.isYesterday).toBe(true);
    expect(yesterday.view.news?.day).toBe(1);
    expect(plain(yesterday.view.news?.body ?? [])).toContain("A new parlor (Skelly Rest)");
    expect(ids(yesterday.view)).toContain("news:today");
    const crimeYesterday = press(yesterday.town, 0, "news:crime", ctx);
    expect(crimeYesterday.view.news?.day).toBe(1);
    expect(press(crimeYesterday.town, 0, "news:today", ctx).view.news?.day).toBe(2);
  });

  it("the countdown lines of a tournament (:24-53)", () => {
    const { town, ctx } = socialTown(1, 1, {
      settings: { tournamentActive: true, tournamentDays: 7 },
    });
    const lines: string[] = [];
    let t = edit(town, 0, { bp: 10 });
    for (let day = 1; day <= 8; day++) {
      const read = paper(t, ctx);
      lines.push(plain(read.view.news?.body ?? []).split("\n")[0] ?? "");
      if (day === 8) break;
      t = runDailyMaintenance(press(read.town, 0, "go:desk", ctx).town, ctx).town;
      t = wake(t, ctx);
    }
    expect(lines[0]).not.toContain("days left");
    expect(lines[2]).toBe("Only 4 days left before a tournament winner shall be declared!");
    expect(lines[5]).toBe("Tomorrow is the last day of the tournament.");
    expect(lines[6]).toBe(
      "Today is the final day of the tournament - a winner will be declared at midnight!",
    );
    expect(lines[7]).toBe("TOURNAMENT WINNER HAS BEEN DECLARED!");
  });

  it("the top-seller panels (:73-106)", () => {
    const { town, ctx } = socialTown(2, 2);
    const t = edit(town, 1, { bpToday: 33, bp: 33, dayLastLoggedOn: town.day });
    const v = paper(t, ctx).view;
    expect(plain(v.news?.topToday ?? [])).toBe("Morticia from Morticia Rest with 33 Bury Points.");
    expect(plain(v.news?.topYesterday ?? [])).toBe("No one died yesterday.");
  });

  it("Make Announcement: swear-checked, colour codes removed, [links] made safe, posted under a header (:172-238)", () => {
    const { town, ctx } = socialTown(3, 2);
    const front = paper(town, ctx);
    const pad = press(front.town, 0, "news:announce", ctx);
    expect(pad.view.overlay?.kind === "textInput" && pad.view.overlay.multiline).toBe(true);
    const posted = act(
      pad.town,
      0,
      submit(
        "news:announcement",
        "`4Big shit sale! See [www.example.com] or [https://x.org/a] not [javascript:alert(1)] [a[b]",
      ),
      ctx,
    );
    const front2 = posted.town.news[String(posted.town.day)]?.front ?? "";
    expect(front2).toContain("`8Skelly of Skelly Rest makes an announcement:`6\r\n");
    const body = posted.view.news?.body ?? [];
    const text = plain(body);
    expect(text).toContain(
      "4Big shoot sale! See www.example.com or https://x.org/a not javascript:alert(1) ab",
    );
    const links = body.filter((s) => s.href !== undefined).map((s) => [s.text, s.href]);
    expect(links).toEqual([
      ["www.example.com", "http://www.example.com/"],
      ["https://x.org/a", "https://x.org/a"],
      ["ab", "http://ab/"],
    ]);
    const unsafe = body.find((s) => s.text === "javascript:alert(1)");
    expect(unsafe?.href).toBeUndefined();
    expect(unsafe?.color).toBe("pink");
    expect(body.some((s) => s.text.includes("`"))).toBe(false);
    // Cancelling the notepad posts nothing.
    const closed = act(pad.town, 0, submit("news:announcement", null), ctx);
    expect(closed.town.news).toEqual(pad.town.news);
    expect(closed.view.overlay).toBeUndefined();
  });

  it("only http and https links get an href", () => {
    expect(linkHref("example.com")).toBe("http://example.com/");
    expect(linkHref("http://a.b/c?d")).toBe("http://a.b/c?d");
    expect(linkHref("HTTPS://A.B")).toBe("https://a.b/");
    expect(linkHref("javascript:alert(1)")).toBeNull();
    // Another scheme only ever becomes an http address, as the original's "http://" prefix made it.
    expect(linkHref("ftp://x")?.startsWith("http://")).toBe(true);
    expect(linkHref("http://user:pw@host")).toBeNull();
    expect(linkHref("two words")).toBeNull();
    expect(linkHref("")).toBeNull();
  });
});
