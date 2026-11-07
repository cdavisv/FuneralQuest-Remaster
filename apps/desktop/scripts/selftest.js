// Driven by the `selftest` build of the desktop app (see README.md, "Test build"):
//
//   FQ_SELFTEST_SCRIPT=scripts/selftest.js ./src-tauri/target/release/funeral-quest
//   FQ_SELFTEST_STEPS=save    which steps to run (comma list; default "boot,solo,pad"). "save" asks
//                             the page to export a career and then opens the native save dialog:
//                             a person (or scripts/selftest-save.sh) has to answer it.
//
// Every result is one line on stdout: `SELFTEST <name> <ok|FAIL> <detail>`. The app is left open.
(async () => {
  const log = (name, ok, detail = "") =>
    window.__TAURI_INTERNALS__.invoke("selftest_log", {
      line: `${name} ${ok ? "ok" : "FAIL"} ${detail}`,
    });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (test, what, ms = 20000) => {
    const end = Date.now() + ms;
    for (;;) {
      const v = test();
      if (v) return v;
      if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
      await sleep(50);
    }
  };
  const button = (re) =>
    [...document.querySelectorAll("button")].find(
      (b) => re.test(b.textContent || "") && !b.disabled,
    );
  const setValue = (input, value) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const steps = (window.__FQ_SELFTEST_STEPS__ || "boot,solo,pad").split(",");

  try {
    if (steps.includes("boot")) {
      await until(() => window.fqWrapper, "window.fqWrapper");
      const w = window.fqWrapper;
      await log("wrapper.saveFile", typeof w.saveFile === "function", typeof w.saveFile);
      await log("wrapper.openFile", typeof w.openFile === "function", typeof w.openFile);
      await log("wrapper.server", typeof w.server === "string", JSON.stringify(w.server));
      await log("fetch.untouched", window.fetch.toString().includes("[native code]"));
      await log(
        "websocket.untouched",
        window.WebSocket.toString().includes("[native code]") &&
          window.WebSocket.name === "WebSocket",
      );
      const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
      await log("serviceWorker.none", regs.length === 0, `${regs.length} registrations`);
      await log(
        "client.gamepad",
        await until(() => window.fqClientGamepad, "client gamepad")
          .then(() => true)
          .catch(() => false),
      );
      await log("origin", true, location.origin);
    }

    if (steps.includes("solo")) {
      await until(() => button(/^Play solo/), "the Play solo button");
      button(/^Play solo/).click();
      await until(() => button(/New career/), "New career");
      button(/New career/).click();
      await until(() => document.querySelector("input[autocomplete], input"), "the form");
      const name = [...document.querySelectorAll("label")].find((l) =>
        /your name/.test(l.textContent),
      );
      const parlor = [...document.querySelectorAll("label")].find((l) =>
        /parlor called/.test(l.textContent),
      );
      const field = (label) =>
        document.getElementById(label.htmlFor) || label.querySelector("input");
      setValue(field(name), "Selftest Sam");
      setValue(field(parlor), "Sam's Rest");
      const female = [...document.querySelectorAll('input[type="radio"]')].find((r) =>
        /Female/.test(r.closest("label")?.textContent || ""),
      );
      female.click();
      await sleep(100);
      button(/open the parlor/).click();
      await until(() => /has been opened/.test(document.body.innerText), "the career to open");
      await log("solo.starts", true, "the paper says the parlor has been opened");
      // To the desk.
      for (let i = 0; i < 6 && !button(/Wait for Customer/); i++) {
        (button(/^(Continue|OK)$/) || button(/Continue/))?.click();
        await sleep(300);
      }
      await until(() => button(/Wait for Customer/), "the desk");
      await log("solo.desk", true, "Wait for Customer is on screen");
    }

    if (steps.includes("pad")) {
      // A synthetic pad through the browser's own Gamepad API; the client polls it.
      const pad = {
        index: 0,
        id: "Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)",
        connected: true,
        mapping: "standard",
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      };
      navigator.getGamepads = () => [pad];
      const frames = (n) =>
        new Promise((resolve) => {
          let left = n;
          const next = () => (--left <= 0 ? resolve() : requestAnimationFrame(next));
          requestAnimationFrame(next);
        });
      const tap = async (i) => {
        pad.buttons[i].pressed = true;
        await frames(2);
        pad.buttons[i].pressed = false;
        await frames(2);
      };
      await until(() => document.documentElement.dataset.input !== undefined || true, "ready");
      // Count how many times the focus changes in one press of the d-pad.
      let changes = 0;
      const seen = [];
      const onFocus = (e) => {
        changes++;
        seen.push((e.target.textContent || e.target.id || e.target.tagName).trim().slice(0, 24));
      };
      document.addEventListener("focusin", onFocus, true);
      await tap(13); // d-pad down: first press, focus lands somewhere
      await sleep(200);
      changes = 0;
      seen.length = 0;
      const before = document.activeElement;
      const tries = [];
      let moved = 0;
      let worst = 0;
      for (const [name, i] of [
        ["right", 15],
        ["down", 13],
        ["down", 13],
        ["left", 14],
        ["up", 12],
        ["right", 15],
        ["down", 13],
        ["up", 12],
      ]) {
        changes = 0;
        seen.length = 0;
        await tap(i);
        await sleep(150);
        tries.push(`${name}:${changes}${changes ? ` ${JSON.stringify(seen)}` : ""}`);
        worst = Math.max(worst, changes);
        if (changes > 0) moved++;
      }
      document.removeEventListener("focusin", onFocus, true);
      // Each press moves the focus once or, at an edge, not at all; never twice.
      await log(
        "pad.moveOnce",
        worst === 1 && moved >= 3,
        `${moved} of 8 presses moved the focus, at most ${worst} change per press: ${tries.join(" | ")}`,
      );
      void before;
    }

    if (steps.includes("save")) {
      // Leave the career, find its row on the list and press Export: that is the client's own
      // path to fqWrapper.saveFile and the native dialog, which stays open for a person.
      for (let i = 0; i < 5 && !button(/^Export$/); i++) {
        document.querySelector(".fq-exit")?.click();
        await sleep(300);
        button(/^Leave$/)?.click();
        await sleep(500);
      }
      await until(() => button(/^Export$/), "the Export button");
      await log("save.exportPressed", true, "opening the native save dialog");
      button(/^Export$/).click();
    }
  } catch (error) {
    await log("selftest", false, String(error && error.message ? error.message : error));
  }
  await log("done", true, "");
})();
