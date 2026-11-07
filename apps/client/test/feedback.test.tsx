import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.js";
import { ArtProvider } from "../src/art/ArtContext.js";
import { AudioProvider } from "../src/audio/AudioContext.js";
import { SettingsPanel } from "../src/components/SettingsPanel.js";
import { buildReport, detectRuleset, FEEDBACK_BLANK } from "../src/feedback/report.js";
import { buildVersion, versionLabel, versionText } from "../src/feedback/version.js";
import { I18nProvider } from "../src/i18n/I18nContext.js";
import { SettingsProvider } from "../src/settings/settings.js";
import { StubBackend } from "./stubBackend.js";

beforeEach(() => {
  window.location.hash = "";
});
afterEach(() => vi.unstubAllEnvs());

describe("the version", () => {
  it("is the root package.json's, shown as 'Alpha 0.1.0 (build abc1234)'", () => {
    expect(versionLabel("0.1.0-alpha.1")).toBe("Alpha 0.1.0");
    expect(versionLabel("1.2.3")).toBe("1.2.3");
    const v = buildVersion();
    expect(v.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(versionText({ version: "0.1.0-alpha.1", label: "Alpha 0.1.0", build: "abc1234" })).toBe(
      "Alpha 0.1.0 (build abc1234)",
    );
    expect(v.build).not.toBe("");
  });
});

describe("the feedback report", () => {
  const version = { version: "0.1.0-alpha.1", label: "Alpha 0.1.0", build: "abc1234" };
  it("carries the version, build, ruleset, screen, browser and the note", () => {
    const text = buildReport({
      version,
      ruleset: "classic",
      screen: "The desk - Funeral Quest",
      soloOnly: false,
      note: "The bank would not open.",
      browser: { userAgent: "UA/1", viewport: "1024x745", language: "en-GB", app: "web page" },
    });
    for (const line of [
      "Version: 0.1.0-alpha.1 (Alpha 0.1.0)",
      "Build: abc1234",
      "Ruleset: classic",
      "Screen: The desk - Funeral Quest",
      "Browser: UA/1",
      "Viewport: 1024x745",
      "The bank would not open.",
    ]) {
      expect(text).toContain(line);
    }
  });

  it("leaves the browser details out of a solo-only build", () => {
    const text = buildReport({ version, ruleset: "x", screen: "s", soloOnly: true, note: "" });
    expect(text).toContain("Edition: solo-only");
    expect(text).not.toMatch(/Browser:|Viewport:|Language:/);
  });

  it("reads the ruleset off the screen", () => {
    document.body.innerHTML = '<span data-ruleset="expanded"></span>';
    expect(detectRuleset()).toContain("expanded");
    document.body.innerHTML = "";
    expect(detectRuleset()).toContain("classic");
  });
});

describe("Send feedback", () => {
  it("opens from Settings with a prefilled report and a marked blank for the destination", async () => {
    const user = userEvent.setup();
    render(
      <SettingsProvider>
        <I18nProvider>
          <AudioProvider>
            <ArtProvider>
              <SettingsPanel onClose={() => undefined} />
            </ArtProvider>
          </AudioProvider>
        </I18nProvider>
      </SettingsProvider>,
    );
    expect(screen.getByTestId("version-text")).toHaveTextContent(/\(build \S+\)$/);
    await user.click(screen.getByTestId("settings-send-feedback"));
    await user.type(screen.getByTestId("feedback-note"), "It froze.");
    const report = screen.getByTestId("feedback-report") as HTMLTextAreaElement;
    expect(report.value).toContain("Version: ");
    expect(report.value).toContain("Browser: ");
    expect(report.value).toContain("It froze.");
    expect(screen.getByTestId("feedback-destination")).toHaveTextContent(FEEDBACK_BLANK);
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("feedback-report")).toBeNull();
  });

  it("has no browser details in a solo-only build", async () => {
    vi.stubEnv("VITE_SOLO_ONLY", "1");
    const user = userEvent.setup();
    render(
      <SettingsProvider>
        <I18nProvider>
          <AudioProvider>
            <ArtProvider>
              <SettingsPanel onClose={() => undefined} />
            </ArtProvider>
          </AudioProvider>
        </I18nProvider>
      </SettingsProvider>,
    );
    await user.click(screen.getByTestId("settings-send-feedback"));
    expect((screen.getByTestId("feedback-report") as HTMLTextAreaElement).value).not.toContain(
      "Browser: ",
    );
  });

  it("is on the front door, beside the version", async () => {
    const user = userEvent.setup();
    render(<App backend={new StubBackend()} settings={{ typewriter: "off", layout: "classic" }} />);
    expect(await screen.findByTestId("version-text")).toHaveTextContent(
      /^Alpha \d+\.\d+\.\d+ \(build /,
    );
    await user.click(screen.getByTestId("send-feedback"));
    expect(screen.getByRole("dialog", { name: "Send feedback" })).toBeVisible();
  });
});
