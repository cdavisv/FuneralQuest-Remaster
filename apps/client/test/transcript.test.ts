import type { ChatLine, View } from "@fq/protocol";
import { describe, expect, it } from "vitest";
import { emptyTranscript, foldChat, MAX_TRANSCRIPT } from "../src/state/transcript.js";

const line = (text: string): ChatLine => ({ text: [{ text }] });
const cafe = (...texts: string[]): View => ({
  scene: "cafe",
  title: "Pale Horse Cafe",
  text: [],
  buttons: [],
  chat: texts.map(line),
});
const desk = (): View => ({ scene: "desk", title: "At Home", text: [], buttons: [] });
const talk = (view: View) => (view.chat ?? []).map((l) => l.text.map((s) => s.text).join(""));

describe("the cafe transcript", () => {
  it("keeps what was said when the player speaks (a response carries only the new lines)", () => {
    let t = emptyTranscript();
    t = foldChat(t, cafe(), "response").transcript;
    // Bob's line arrives as a push: the last View with one line appended.
    const pushed = foldChat(t, cafe("Bob: hello"), "push");
    expect(talk(pushed.view)).toEqual(["Bob: hello"]);
    // The player answers: the server's reply holds only the player's own line.
    const answered = foldChat(pushed.transcript, cafe("You: hi Bob"), "response");
    expect(talk(answered.view)).toEqual(["Bob: hello", "You: hi Bob"]);
    // The next push is the transport's last View (the reply) plus one line.
    const next = foldChat(answered.transcript, cafe("You: hi Bob", "Bob: how are you"), "push");
    expect(talk(next.view)).toEqual(["Bob: hello", "You: hi Bob", "Bob: how are you"]);
  });

  it("does not double a line when the transport already sends the whole talk", () => {
    let t = emptyTranscript();
    t = foldChat(t, cafe("a"), "response").transcript;
    const second = foldChat(t, cafe("a", "b"), "response");
    expect(talk(second.view)).toEqual(["a", "b"]);
    const third = foldChat(second.transcript, cafe("a", "b", "c"), "push");
    expect(talk(third.view)).toEqual(["a", "b", "c"]);
  });

  it("starts afresh when the player walks in again, and leaves other screens alone", () => {
    let t = emptyTranscript();
    t = foldChat(t, cafe("old"), "response").transcript;
    const out = foldChat(t, desk(), "response");
    expect(out.view).toEqual(desk());
    const back = foldChat(out.transcript, cafe(), "response");
    expect(talk(back.view)).toEqual([]);
  });

  it("keeps the last 200 lines", () => {
    let t = emptyTranscript();
    t = foldChat(t, cafe(), "response").transcript;
    const many = Array.from({ length: MAX_TRANSCRIPT + 30 }, (_, i) => `line ${i}`);
    const out = foldChat(t, cafe(...many), "response");
    expect(talk(out.view)).toHaveLength(MAX_TRANSCRIPT);
    expect(talk(out.view).at(-1)).toBe(`line ${MAX_TRANSCRIPT + 29}`);
  });
});
