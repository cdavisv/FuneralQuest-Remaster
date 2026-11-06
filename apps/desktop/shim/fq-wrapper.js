/*
 * Funeral Quest wrapper shim. One classic script, shared by the Tauri desktop app (injected
 * before the page's own scripts) and the Capacitor mobile app (copied into the bundle and loaded
 * first from index.html). It adds what the web client does not do by itself inside a native
 * webview, without touching the client:
 *
 *  - a server address that persists: requests the client makes to its own origin under /api,
 *    /health and /admin (and its WebSocket) are re-pointed at the configured server;
 *  - a small settings dialog for that address (window.fqWrapper.openSettings());
 *  - gamepad mapping (d-pad / left stick move focus, A presses, B is Escape, X Y LB RB are keys
 *    1 to 4, Start opens the settings dialog when the page offers no Settings of its own);
 *  - links to other sites open in the system browser;
 *  - save files (<a download> with a blob) go to a native save dialog or share sheet;
 *  - F11 and Alt+Enter toggle fullscreen (desktop).
 *
 * The host (desktop or mobile) defines window.__fqHost before or after this script runs:
 *   { platform, defaultServer, openExternal(url), saveFile(name, text, type), toggleFullscreen?,
 *     extraSettings?: [{ id, label, type: "checkbox", get(), set(v) }] }
 * Everything here is plain DOM and CSSOM (no inline <style>, no eval), so a strict CSP holds.
 */
(() => {
  if (window.fqWrapper) return;

  const KEY = "fqw.server.v1";
  const host = () => window.__fqHost || {};
  const ownOrigin = location.origin;
  const API_PATHS = /^\/(api|health|admin)(\/|$|\?)/;

  /** Normalises what a person typed. Returns { url } or { error }. */
  function parseServer(text) {
    const raw = String(text || "").trim();
    if (raw === "") return { url: "" };
    let value = raw;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
      const local = /^(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(value);
      value = `${local ? "http" : "https"}://${value}`;
    }
    let u;
    try {
      u = new URL(value);
    } catch {
      return { error: "That does not look like an address." };
    }
    const loopback =
      u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]";
    if (u.protocol !== "https:" && !(u.protocol === "http:" && loopback)) {
      return { error: "Use https:// (plain http is only allowed for localhost)." };
    }
    if (u.username || u.password) return { error: "Leave the user name and password out." };
    return { url: u.origin + u.pathname.replace(/\/+$/, "") };
  }

  function configuredServer() {
    let stored = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {
      /* storage blocked: fall through to the default */
    }
    if (stored !== null) return parseServer(stored).url || "";
    return parseServer(host().defaultServer || window.__FQ_DEFAULT_SERVER__ || "").url || "";
  }

  let server = configuredServer();

  function rewrite(input) {
    if (!server) return null;
    try {
      const u = new URL(input, location.href);
      if (u.origin === ownOrigin && API_PATHS.test(u.pathname + u.search)) {
        return server + u.pathname + u.search;
      }
    } catch {
      /* not a URL */
    }
    return null;
  }

  // ---- fetch and WebSocket re-pointing ------------------------------------------------------
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const to = rewrite(href);
    if (to === null) return nativeFetch(input, init);
    if (typeof input === "string" || input instanceof URL) return nativeFetch(to, init);
    return nativeFetch(new Request(to, input), init);
  };

  const NativeWebSocket = window.WebSocket;
  function FqWebSocket(url, protocols) {
    let target = String(url);
    try {
      const u = new URL(url, location.href);
      const asHttp = new URL(u.href.replace(/^ws/, "http"));
      const to = rewrite(asHttp.href);
      if (to) target = to.replace(/^http/, "ws");
    } catch {
      /* leave the address alone */
    }
    return protocols === undefined
      ? new NativeWebSocket(target)
      : new NativeWebSocket(target, protocols);
  }
  FqWebSocket.prototype = NativeWebSocket.prototype;
  for (const k of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]) FqWebSocket[k] = NativeWebSocket[k];
  window.WebSocket = FqWebSocket;

  // ---- external links -----------------------------------------------------------------------
  document.addEventListener(
    "click",
    (e) => {
      if (e.defaultPrevented || e.button !== 0) return;
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!a) return;
      // A save file: <a download href="blob:...">.
      if (a.hasAttribute("download") && a.href.startsWith("blob:") && host().saveFile) {
        e.preventDefault();
        e.stopPropagation();
        const name = a.getAttribute("download") || "funeral-quest-save.json";
        fetch(a.href)
          .then((r) => r.text())
          .then((text) => host().saveFile(name, text, a.type || "application/json"))
          .catch(() => toast("The file could not be saved."));
        return;
      }
      let u;
      try {
        u = new URL(a.href, location.href);
      } catch {
        return;
      }
      if (
        u.protocol === "mailto:" ||
        ((u.protocol === "https:" || u.protocol === "http:") && u.origin !== ownOrigin)
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (host().openExternal) host().openExternal(u.href);
      } else if (u.origin === ownOrigin && a.target === "_blank") {
        // The game's own pages ("Help" in Settings) open in the same window rather than a new one.
        e.preventDefault();
        e.stopPropagation();
        location.href = u.href;
      }
    },
    true,
  );
  // window.open(url) for another site goes the same way.
  const nativeOpen = window.open.bind(window);
  window.open = (url, ...rest) => {
    try {
      const u = new URL(url, location.href);
      if (u.origin !== ownOrigin && host().openExternal) {
        host().openExternal(u.href);
        return null;
      }
    } catch {
      /* fall through */
    }
    return nativeOpen(url, ...rest);
  };

  // ---- tiny UI helpers (CSSOM only, so a strict CSP is fine) --------------------------------
  function el(tag, css, text) {
    const n = document.createElement(tag);
    if (css) Object.assign(n.style, css);
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function toast(message) {
    const t = el(
      "div",
      {
        position: "fixed",
        left: "50%",
        bottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
        transform: "translateX(-50%)",
        background: "#241606",
        color: "#f6dc8c",
        border: "1px solid #b78f5e",
        padding: "8px 14px",
        borderRadius: "6px",
        font: "15px system-ui, sans-serif",
        zIndex: "2147483647",
        maxWidth: "90vw",
      },
      message,
    );
    t.setAttribute("role", "status");
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  /** A small modal with buttons; resolves with the index pressed, or -1 for Escape. */
  function choose(title, text, labels) {
    return new Promise((resolve) => {
      const back = el("div", {
        position: "fixed",
        inset: "0",
        background: "rgba(0,0,0,.72)",
        zIndex: "2147483647",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px",
      });
      const box = el("div", {
        background: "#2b1a08",
        color: "#f3e6c4",
        border: "2px solid #b78f5e",
        borderRadius: "8px",
        padding: "18px",
        width: "min(420px, 100%)",
        font: "16px/1.4 system-ui, sans-serif",
        boxSizing: "border-box",
      });
      box.setAttribute("role", "alertdialog");
      box.setAttribute("aria-modal", "true");
      box.append(
        el(
          "h2",
          { margin: "0 0 8px", font: "italic 700 24px Georgia, serif", color: "#f6dc8c" },
          title,
        ),
        el("p", { margin: "0 0 12px" }, text),
      );
      const row = el("div", {
        display: "flex",
        gap: "10px",
        justifyContent: "flex-end",
        flexWrap: "wrap",
      });
      const buttons = labels.map((label, i) => {
        const b = el(
          "button",
          {
            padding: "10px 16px",
            minHeight: "44px",
            fontSize: "16px",
            borderRadius: "4px",
            cursor: "pointer",
            border: "1px solid #b78f5e",
            background: i === labels.length - 1 ? "#b78f5e" : "#3d2710",
            color: i === labels.length - 1 ? "#1b1004" : "#f3e6c4",
          },
          label,
        );
        b.type = "button";
        b.addEventListener("click", () => done(i));
        return b;
      });
      row.append(...buttons);
      box.append(row);
      back.append(box);
      document.body.append(back);
      buttons[0].focus();
      const onKey = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          done(-1);
        }
        e.stopPropagation();
      };
      const done = (i) => {
        document.removeEventListener("keydown", onKey, true);
        back.remove();
        resolve(i);
      };
      document.addEventListener("keydown", onKey, true);
    });
  }

  let dialogOpen = false;
  function openSettings() {
    if (dialogOpen) return;
    dialogOpen = true;
    const previous = document.activeElement;
    const back = el("div", {
      position: "fixed",
      inset: "0",
      background: "rgba(0,0,0,.72)",
      zIndex: "2147483646",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "max(12px, env(safe-area-inset-top)) 12px 12px",
    });
    const box = el("div", {
      background: "#2b1a08",
      color: "#f3e6c4",
      border: "2px solid #b78f5e",
      borderRadius: "8px",
      padding: "18px",
      width: "min(460px, 100%)",
      maxHeight: "100%",
      overflow: "auto",
      font: "16px/1.4 system-ui, sans-serif",
      boxSizing: "border-box",
    });
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-labelledby", "fqw-title");
    const title = el(
      "h2",
      { margin: "0 0 10px", font: "italic 700 24px Georgia, serif", color: "#f6dc8c" },
      "Server address",
    );
    title.id = "fqw-title";
    const help = el(
      "p",
      { margin: "0 0 10px" },
      "Online play connects to this server. Leave it empty to use Solo mode only. Solo needs no server.",
    );
    const input = el("input", {
      width: "100%",
      boxSizing: "border-box",
      padding: "10px",
      fontSize: "16px",
      background: "#f3e6c4",
      color: "#1b1004",
      border: "1px solid #7d5409",
      borderRadius: "4px",
    });
    input.type = "url";
    input.placeholder = "https://fq.example.com";
    input.setAttribute("aria-label", "Server address");
    input.autocomplete = "off";
    input.spellcheck = false;
    input.value = server;
    const error = el("p", { color: "#ff9a8a", minHeight: "1.4em", margin: "6px 0" });
    error.setAttribute("role", "alert");
    box.append(title, help, input, error);

    const extras = (host().extraSettings || []).map((s) => {
      const row = el("label", {
        display: "flex",
        gap: "10px",
        alignItems: "center",
        margin: "8px 0",
      });
      const cb = el("input", { width: "22px", height: "22px" });
      cb.type = "checkbox";
      Promise.resolve(s.get()).then((v) => {
        cb.checked = !!v;
      });
      row.append(cb, el("span", null, s.label));
      box.append(row);
      return { s, cb };
    });

    const row = el("div", {
      display: "flex",
      gap: "10px",
      justifyContent: "flex-end",
      marginTop: "12px",
      flexWrap: "wrap",
    });
    const btn = (label, primary) => {
      const b = el(
        "button",
        {
          padding: "10px 16px",
          minHeight: "44px",
          fontSize: "16px",
          cursor: "pointer",
          borderRadius: "4px",
          border: "1px solid #b78f5e",
          background: primary ? "#b78f5e" : "#3d2710",
          color: primary ? "#1b1004" : "#f3e6c4",
        },
        label,
      );
      b.type = "button";
      return b;
    };
    const cancel = btn("Cancel", false);
    const save = btn("Save", true);
    row.append(cancel, save);
    box.append(row);
    back.append(box);
    document.body.append(back);
    input.focus();

    const close = () => {
      dialogOpen = false;
      back.remove();
      document.removeEventListener("keydown", onKey, true);
      if (previous instanceof HTMLElement) previous.focus();
    };
    const commit = async () => {
      const parsed = parseServer(input.value);
      if (parsed.error) {
        error.textContent = parsed.error;
        return;
      }
      for (const { s, cb } of extras) await s.set(cb.checked);
      const changed = parsed.url !== server;
      try {
        localStorage.setItem(KEY, parsed.url);
      } catch {
        /* storage blocked: the change lasts until the app closes */
      }
      server = parsed.url;
      close();
      if (changed) location.reload();
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.key === "Enter" && e.target === input) {
        e.preventDefault();
        e.stopPropagation();
        void commit();
      } else if (e.key === "Tab") {
        const f = [...box.querySelectorAll("input,button")];
        const i = f.indexOf(document.activeElement);
        const n = f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length];
        e.preventDefault();
        n.focus();
      }
      e.stopPropagation();
    };
    document.addEventListener("keydown", onKey, true);
    cancel.addEventListener("click", close);
    save.addEventListener("click", () => void commit());
  }

  // ---- keyboard: fullscreen and the settings dialog ----------------------------------------
  document.addEventListener(
    "keydown",
    (e) => {
      const h = host();
      if (h.toggleFullscreen && (e.key === "F11" || (e.key === "Enter" && e.altKey))) {
        e.preventDefault();
        e.stopPropagation();
        h.toggleFullscreen();
      } else if (e.key === "F2" && h.platform === "desktop") {
        e.preventDefault();
        openSettings();
      }
    },
    true,
  );

  // ---- gamepad ------------------------------------------------------------------------------
  // Buttons follow the "standard" mapping. The client reads keys 1 to 9 and Escape from window
  // keydown events, so a gamepad press is turned into the same synthetic key events; focus is
  // moved among the page's own buttons so it also works in menus, forms and dialogs.
  const FOCUSABLE =
    'button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
  function visible(n) {
    const r = n.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(n).visibility !== "hidden";
  }
  function focusables() {
    const dialog = document.querySelector(
      '[role="dialog"][aria-modal="true"], [role="alertdialog"]',
    );
    const root = dialog || document;
    return [...root.querySelectorAll(FOCUSABLE)].filter(visible);
  }
  /** Moves focus to the nearest focusable in a direction (0 right, 1 down, 2 left, 3 up). */
  function moveFocus(dir) {
    const list = focusables();
    if (!list.length) return;
    const cur =
      document.activeElement && list.includes(document.activeElement)
        ? document.activeElement
        : null;
    if (!cur) {
      list[0].focus();
      return;
    }
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2,
      ay = a.top + a.height / 2;
    let best = null,
      bestScore = Infinity;
    for (const n of list) {
      if (n === cur) continue;
      const b = n.getBoundingClientRect();
      const dx = b.left + b.width / 2 - ax,
        dy = b.top + b.height / 2 - ay;
      const along = dir === 0 ? dx : dir === 2 ? -dx : dir === 1 ? dy : -dy;
      const across = dir === 0 || dir === 2 ? Math.abs(dy) : Math.abs(dx);
      if (along <= 1) continue;
      const score = along + across * 2;
      if (score < bestScore) {
        bestScore = score;
        best = n;
      }
    }
    if (best) {
      best.focus();
      best.scrollIntoView({ block: "nearest" });
    }
  }
  function key(k) {
    const init = {
      key: k,
      code: k === "Escape" ? "Escape" : `Digit${k}`,
      bubbles: true,
      cancelable: true,
    };
    (document.activeElement || document.body).dispatchEvent(new KeyboardEvent("keydown", init));
    (document.activeElement || document.body).dispatchEvent(new KeyboardEvent("keyup", init));
  }
  const held = new Map();
  function press(i) {
    switch (i) {
      case 0: {
        const a = document.activeElement;
        if (a instanceof HTMLElement && a !== document.body) a.click();
        else moveFocus(1);
        break;
      }
      case 1:
        key("Escape");
        break;
      case 2:
        key("1");
        break;
      case 3:
        key("2");
        break;
      case 4:
        key("3");
        break;
      case 5:
        key("4");
        break;
      case 12:
        moveFocus(3);
        break;
      case 13:
        moveFocus(1);
        break;
      case 14:
        moveFocus(2);
        break;
      case 15:
        moveFocus(0);
        break;
      case 9:
        if (!document.querySelector('[role="dialog"]')) openSettings();
        break;
      default:
        break;
    }
  }
  let pollTimer = 0;
  function poll() {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const now = performance.now();
    for (const pad of pads) {
      pad.buttons.forEach((b, i) => {
        const id = `${pad.index}:b${i}`;
        const was = held.get(id);
        if (b.pressed && !was) {
          held.set(id, now + 380);
          press(i);
        } else if (b.pressed && was && now > was && i >= 12 && i <= 15) {
          held.set(id, now + 130);
          press(i);
        } else if (!b.pressed && was) held.delete(id);
      });
      const [x, y] = pad.axes;
      for (const [id, active, dir] of [
        ["ax+", x > 0.6, 0],
        ["ax-", x < -0.6, 2],
        ["ay+", y > 0.6, 1],
        ["ay-", y < -0.6, 3],
      ]) {
        const hid = `${pad.index}:${id}`;
        const was = held.get(hid);
        if (active && (!was || now > was)) {
          held.set(hid, now + (was ? 160 : 380));
          moveFocus(dir);
        } else if (!active && was) held.delete(hid);
      }
    }
    pollTimer = requestAnimationFrame(poll);
  }
  window.addEventListener("gamepadconnected", () => {
    if (!pollTimer) pollTimer = requestAnimationFrame(poll);
  });
  window.addEventListener("gamepaddisconnected", () => {
    if (!(navigator.getGamepads && [...navigator.getGamepads()].some(Boolean))) {
      cancelAnimationFrame(pollTimer);
      pollTimer = 0;
      held.clear();
    }
  });

  window.fqWrapper = {
    get server() {
      return server;
    },
    parseServer,
    openSettings,
    toast,
    choose,
    isDialogOpen: () => dialogOpen,
  };
})();
