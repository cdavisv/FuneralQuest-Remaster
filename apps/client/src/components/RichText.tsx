import type { RichText as RichTextSpans, TextColor, TextSpan } from "@fq/protocol";
import { Fragment, type ReactNode } from "react";

/** Returns the href if it is a well-formed http or https URL, otherwise undefined. */
export function safeHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export const spanText = (spans: RichTextSpans): string => spans.map((s) => s.text).join("");

export const richTextLength = (spans: RichTextSpans): number =>
  spans.reduce((n, s) => n + s.text.length, 0);

/** Size step from the original `fN` code: 0 is normal, each step is about 15 percent. */
export function sizeScale(size: number | undefined): number | undefined {
  if (!size) return undefined;
  const step = Math.max(-3, Math.min(5, Math.round(size)));
  return step === 0 ? undefined : 1 + step * 0.15;
}

const COLOR_CLASS: Record<TextColor, string> = {
  blue: "fq-tc-blue",
  green: "fq-tc-green",
  teal: "fq-tc-teal",
  red: "fq-tc-red",
  purple: "fq-tc-purple",
  brown: "fq-tc-brown",
  grey: "fq-tc-grey",
  darkGrey: "fq-tc-darkGrey",
  lightBlue: "fq-tc-lightBlue",
  lightGreen: "fq-tc-lightGreen",
  cyan: "fq-tc-cyan",
  lightRed: "fq-tc-lightRed",
  pink: "fq-tc-pink",
  yellow: "fq-tc-yellow",
  white: "fq-tc-white",
  black: "fq-tc-black",
};

function lines(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let offset = 0;
  for (const [i, part] of text.split("\n").entries()) {
    // The character offset is a stable key; the text is append-only within a span.
    if (i > 0) out.push(<br key={`${keyBase}-br${offset}`} />);
    if (part) out.push(part);
    offset += part.length + 1;
  }
  return out;
}

function renderSpan(span: TextSpan, text: string, key: string): ReactNode {
  const color = span.color ? COLOR_CLASS[span.color] : undefined;
  const scale = sizeScale(span.size);
  const style = scale ? { fontSize: `${scale}em` } : undefined;
  const href = safeHref(span.href);
  const children = lines(text, key);
  if (href) {
    return (
      <a
        key={key}
        className={`fq-link${color ? ` ${color}` : ""}`}
        style={style}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  }
  if (!color && !style) return <Fragment key={key}>{children}</Fragment>;
  return (
    <span key={key} className={color} style={style}>
      {children}
    </span>
  );
}

/**
 * Renders protocol spans as elements. Text is always a React text node, never HTML.
 * `limit` shows only the first N characters (used by the typewriter).
 */
export function RichText({ spans, limit }: { spans: RichTextSpans; limit?: number }) {
  let remaining = limit ?? Number.POSITIVE_INFINITY;
  const out: ReactNode[] = [];
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    if (!span) continue;
    if (remaining <= 0) break;
    const text = span.text.length > remaining ? span.text.slice(0, remaining) : span.text;
    remaining -= text.length;
    if (text) out.push(renderSpan(span, text, `s${i}`));
  }
  return <>{out}</>;
}
