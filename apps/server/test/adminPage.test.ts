import { describe, expect, it } from "vitest";
import { adminPageHtml } from "../src/http/adminPage.js";

/** The page's own `h` (element builder), run against a minimal stand-in for the DOM. */
function pageH() {
  const html = adminPageHtml("n", "");
  const start = html.indexOf("function h(tag, attrs)");
  const end = html.indexOf("function clear(el)");
  const source = html.slice(start, end);
  interface Fake {
    tag: string;
    attributes: Record<string, string>;
    className: string;
    value: string;
    children: unknown[];
    setAttribute(k: string, v: string): void;
    addEventListener(): void;
    appendChild(c: unknown): void;
  }
  const document = {
    createElement(tag: string): Fake {
      return {
        tag,
        attributes: {},
        className: "",
        value: "",
        children: [],
        setAttribute(k, v) {
          this.attributes[k] = v;
        },
        addEventListener() {},
        appendChild(c) {
          this.children.push(c);
        },
      };
    },
    createTextNode: (text: string) => ({ text }),
  };
  return new Function("document", `${source}; return h;`)(document) as (
    tag: string,
    attrs: Record<string, unknown> | null,
  ) => Fake;
}

describe("the admin page", () => {
  it("does not mark an option selected (or a box checked) when the value is false", () => {
    // `selected="false"` is still selected in HTML: every option of a filter was selected, so the
    // dropdowns showed the last option instead of the filter in force.
    const h = pageH();
    expect(h("option", { value: "open", selected: false }).attributes).toEqual({});
    expect(h("option", { value: "open", selected: true }).attributes).toEqual({ selected: "" });
    expect(h("input", { type: "checkbox", checked: false }).attributes).toEqual({
      type: "checkbox",
    });
  });

  it("has the sysop's town and backup tools", () => {
    const html = adminPageHtml("n", "");
    for (const needle of [
      '"/admin/towns", body',
      'base + "/settings"',
      'base + "/snapshots"',
      'base + "/rollback"',
      'base + "/reset"',
      '"/admin/backups"',
      '["backups", "Backups"]',
    ]) {
      expect(html, needle).toContain(needle);
    }
  });
});
