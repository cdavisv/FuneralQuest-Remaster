import type { TextSpan } from "@fq/protocol";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichText, safeHref, sizeScale } from "../src/components/RichText.js";

const renderSpans = (spans: TextSpan[], limit?: number) =>
  render(
    <p data-testid="out">
      <RichText spans={spans} {...(limit === undefined ? {} : { limit })} />
    </p>,
  );

describe("RichText", () => {
  it("maps each colour to its token class", () => {
    renderSpans([
      { text: "Skelly", color: "white" },
      { text: " said ", color: "yellow" },
      { text: "42", color: "purple" },
    ]);
    expect(screen.getByText("Skelly")).toHaveClass("fq-tc-white");
    expect(screen.getByText("said")).toHaveClass("fq-tc-yellow");
    expect(screen.getByText("42")).toHaveClass("fq-tc-purple");
  });

  it("leaves uncoloured text to inherit the surface colour", () => {
    renderSpans([{ text: "plain" }]);
    expect(screen.getByTestId("out").querySelector("span")).toBeNull();
    expect(screen.getByTestId("out")).toHaveTextContent("plain");
  });

  it("turns newlines into line breaks", () => {
    renderSpans([{ text: "one\ntwo\n\nthree" }]);
    expect(screen.getByTestId("out").querySelectorAll("br")).toHaveLength(3);
  });

  it("applies size steps as relative font sizes", () => {
    renderSpans([{ text: "big", size: 2, color: "red" }]);
    expect(screen.getByText("big").style.fontSize).toBe("1.3em");
    expect(sizeScale(0)).toBeUndefined();
    expect(sizeScale(99)).toBeCloseTo(1.75);
    expect(sizeScale(-99)).toBeCloseTo(0.55);
  });

  it("never interprets text as HTML", () => {
    const { container } = renderSpans([{ text: '<img src=x onerror="alert(1)"><b>bold</b>' }]);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByTestId("out")).toHaveTextContent(
      '<img src=x onerror="alert(1)"><b>bold</b>',
    );
  });

  it("renders http and https links with safe attributes", () => {
    renderSpans([
      { text: "site", href: "https://example.com/a?b=1" },
      { text: "plain", href: "http://example.org" },
    ]);
    const link = screen.getByRole("link", { name: "site" });
    expect(link).toHaveAttribute("href", "https://example.com/a?b=1");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "plain" })).toHaveAttribute(
      "href",
      "http://example.org/",
    );
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:x",
    "file:///etc/passwd",
    "//evil.example",
    "/relative",
    "not a url",
  ])("does not make a link out of %s", (href) => {
    renderSpans([{ text: "click me", href }]);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByTestId("out")).toHaveTextContent("click me");
    expect(safeHref(href)).toBeUndefined();
  });

  it("shows only the first N characters when limited, across spans", () => {
    renderSpans([{ text: "abc", color: "red" }, { text: "defg" }], 5);
    expect(screen.getByTestId("out")).toHaveTextContent("abcde");
    expect(screen.getByTestId("out")).not.toHaveTextContent("abcdef");
  });

  it("renders nothing for an empty list", () => {
    renderSpans([]);
    expect(screen.getByTestId("out")).toBeEmptyDOMElement();
  });
});
