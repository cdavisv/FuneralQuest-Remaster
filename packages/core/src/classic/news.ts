import type { NewsDay, TownState } from "../state/types.js";

export type NewsSection = "front" | "crime";

/**
 * `add_to_news` / `add_to_news_section` (legacy/source/maint.cpp:11-31):
 * appends to today's front page (or crime section) file.
 */
export function addToNews(town: TownState, text: string, section: NewsSection = "front"): void {
  const key = String(town.day);
  const day: NewsDay = town.news[key] ?? { front: "", crime: "" };
  day[section] += text;
  town.news[key] = day;
}

export function newsFor(town: TownState, day: number): NewsDay | undefined {
  return town.news[String(day)];
}
