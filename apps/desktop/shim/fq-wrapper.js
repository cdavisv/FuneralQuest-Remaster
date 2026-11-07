/*
 * Funeral Quest wrapper shim. One classic script, shared by the Tauri desktop app (injected
 * before the page's own scripts) and the Capacitor mobile app (copied into the bundle and loaded
 * first from index.html). The web client does the game's own work inside a webview (it reads the
 * server address from window.fqWrapper.server, plays gamepads itself, saves through
 * window.fqWrapper.saveFile, skips its service worker, registers window.fqHandleBack); this script
 * only supplies what a plain page cannot have:
 *
 *  - a server address that persists (localStorage), read by the client as fqWrapper.server, and a
 *    small settings dialog for it (window.fqWrapper.openSettings());
 *  - fqWrapper.saveFile(name, text, type) and, where the host has one, fqWrapper.openFile(accept):
 *    the host's native save and open dialogs (or the share sheet) for the client's save export
 *    and import;
 *  - links to other sites open in the system browser (the host's openExternal);
 *  - F11 and Alt+Enter toggle fullscreen and F2 opens the server dialog (desktop).
 *
 * The host (desktop or mobile) defines window.__fqHost before or after this script runs:
 *   { platform, defaultServer, openExternal(url), saveFile(name, text, type),
 *     openFile?(accept), toggleFullscreen?,
 *     extraSettings?: [{ id, label, type: "checkbox", get(), set(v) }] }
 * Everything here is plain DOM and CSSOM (no inline <style>, no eval), so a strict CSP holds.
 */
(() => {
  if (window.fqWrapper) return;

  const KEY = "fqw.server.v1";
  const host = () => window.__fqHost || {};
  const ownOrigin = location.origin;

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

  // ---- external links -----------------------------------------------------------------------
  document.addEventListener(
    "click",
    (e) => {
      if (e.defaultPrevented || e.button !== 0) return;
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!a) return;
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

  /** The host's file functions, as the client calls them. Absent until the host defines them. */
  const saveFile = (name, text, type) =>
    Promise.resolve(host().saveFile(name, text, type || "application/json")).catch((error) => {
      toast("The file could not be saved.");
      throw error;
    });
  const openFile = (accept) =>
    Promise.resolve(host().openFile(accept || "")).catch((error) => {
      toast("The file could not be opened.");
      throw error;
    });

  window.fqWrapper = {
    get server() {
      return server;
    },
    get saveFile() {
      return host().saveFile ? saveFile : undefined;
    },
    get openFile() {
      return host().openFile ? openFile : undefined;
    },
    parseServer,
    openSettings,
    toast,
    choose,
    isDialogOpen: () => dialogOpen,
  };
})();
