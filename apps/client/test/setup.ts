import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import { CONDUCT_KEY, CONDUCT_VERSION } from "../src/moderation/conduct.js"; // moderation hook

// moderation hook: tests start as a player who has agreed to the house rules (the gate tests clear it)
beforeEach(() => {
  window.localStorage.setItem(CONDUCT_KEY, String(CONDUCT_VERSION));
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

// jsdom has no matchMedia or scrollTo on elements; give the client the minimum it probes for.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
if (!HTMLElement.prototype.scrollBy) {
  HTMLElement.prototype.scrollBy = () => {};
}
if (!HTMLElement.prototype.scrollTo) {
  HTMLElement.prototype.scrollTo = () => {};
}
