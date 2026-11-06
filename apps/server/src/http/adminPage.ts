/**
 * The moderation page served at `/admin/`: one HTML file with its script and style inline, no
 * dependencies, no build step. The page itself holds no data and no secrets; everything it shows
 * comes from the JSON admin API, which refuses without the admin token. The token is typed into
 * the page, kept in the tab's sessionStorage only, and sent as a Bearer header.
 *
 * Text from players (reports, names, notes) is only ever placed with `textContent`, never parsed
 * as HTML, and a per-response nonce lets only this script run.
 */

const STYLE = `
:root{color-scheme:light dark;--bg:#faf8f4;--fg:#1d1a16;--mut:#6b655c;--line:#d8d2c6;--acc:#5a2a2a;--warn:#a33;--ok:#2d6a3a;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#171512;--fg:#ece6da;--mut:#a39b8c;--line:#3a352d;--acc:#d9a7a7;--warn:#ff8a8a;--ok:#8fd19a;--card:#201d19}}
*{box-sizing:border-box}
body{margin:0;font:15px/1.45 system-ui,sans-serif;background:var(--bg);color:var(--fg)}
header{display:flex;flex-wrap:wrap;gap:.5rem 1rem;align-items:center;padding:.6rem 1rem;border-bottom:1px solid var(--line)}
h1{font-size:1.1rem;margin:0}
main{padding:1rem;max-width:1100px;margin:0 auto}
nav{display:flex;flex-wrap:wrap;gap:.25rem;margin:0 0 1rem}
button,select,input,textarea{font:inherit;color:inherit;background:var(--card);border:1px solid var(--line);border-radius:4px;padding:.35rem .6rem}
button{cursor:pointer}
button.on{background:var(--acc);color:var(--bg);border-color:var(--acc)}
button.danger{border-color:var(--warn);color:var(--warn)}
button:disabled{opacity:.5;cursor:default}
textarea{width:100%;min-height:4rem}
table{border-collapse:collapse;width:100%}
th,td{text-align:left;padding:.35rem .5rem;border-bottom:1px solid var(--line);vertical-align:top}
tr.row{cursor:pointer}
tr.row:hover{background:color-mix(in srgb,var(--acc) 8%,transparent)}
.card{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:.8rem 1rem;margin:0 0 1rem}
.filters{display:flex;flex-wrap:wrap;gap:.5rem;margin:0 0 .8rem}
.mut{color:var(--mut)}
.full{width:100%}.w6{width:6rem}.w11{width:11rem}.grow{flex:1;min-width:12rem}
.tag{display:inline-block;border:1px solid var(--line);border-radius:3px;padding:0 .35rem;font-size:.8rem;margin-right:.25rem}
.tag.bad{border-color:var(--warn);color:var(--warn)}
.tag.good{border-color:var(--ok);color:var(--ok)}
.quote{white-space:pre-wrap;border-left:3px solid var(--acc);padding:.3rem .7rem;margin:.4rem 0;background:color-mix(in srgb,var(--acc) 6%,transparent)}
.chat{font-family:ui-monospace,monospace;font-size:.85rem}
.chat div{padding:.1rem .3rem}
.chat .hit{background:color-mix(in srgb,var(--warn) 22%,transparent);font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:.8rem}
.actions label{display:block;margin:.3rem 0 .1rem;font-weight:600}
.row2{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center}
#toast{position:fixed;right:1rem;bottom:1rem;max-width:80vw;padding:.6rem 1rem;border-radius:6px;background:var(--fg);color:var(--bg);display:none}
@media (max-width:600px){main{padding:.6rem}table{display:block;overflow-x:auto}table.queue th:nth-child(2),table.queue td:nth-child(2),table.queue th:nth-child(4),table.queue td:nth-child(4),table.queue th:nth-child(7),table.queue td:nth-child(7){display:none}}
`;

const SCRIPT = String.raw`
"use strict";
var $ = function (id) { return document.getElementById(id); };
var state = { token: sessionStorage.getItem("fq_admin") || "", mod: localStorage.getItem("fq_mod") || "", tab: "reports", report: null, account: null };
var CATS = ["harassment", "hate", "sexual", "threats", "spam", "cheating", "other"];
var SCOPES = ["chat", "mail", "announcements", "fortunes"];

function h(tag, attrs) {
  var el = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function (k) {
    var v = attrs[k];
    if (v === null || v === undefined || v === false) return;
    if (k === "class") el.className = v;
    else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
    else if (k === "value") el.value = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  });
  for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
  return el;
}
function add(el, c) {
  if (c === null || c === undefined || c === false) return;
  if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
  el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
}
function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
function when(iso) { return iso ? new Date(iso).toLocaleString() : ""; }
function toast(text, bad) {
  var t = $("toast"); t.textContent = text; t.style.display = "block"; t.style.background = bad ? "#a33" : "";
  clearTimeout(toast.timer); toast.timer = setTimeout(function () { t.style.display = "none"; }, 6000);
}
function api(method, path, body) {
  var headers = { "authorization": "Bearer " + state.token, "x-moderator": state.mod || "admin" };
  if (body !== undefined) headers["content-type"] = "application/json";
  return fetch(path, { method: method, headers: headers, body: body === undefined ? undefined : JSON.stringify(body) }).then(function (r) {
    if (r.status === 204) return null;
    return r.text().then(function (t) {
      var data = null; try { data = t ? JSON.parse(t) : null; } catch (e) { data = null; }
      if (!r.ok) { var err = new Error((data && data.message) || ("HTTP " + r.status)); err.status = r.status; throw err; }
      return data;
    });
  });
}
function fail(e) {
  if (e && e.status === 401) { toast("The admin token was refused.", true); signOut(); return; }
  toast(e && e.message ? e.message : String(e), true);
}
function signOut() { sessionStorage.removeItem("fq_admin"); state.token = ""; render(); }

function login() {
  var main = $("main"); clear(main);
  var tok = h("input", { type: "password", id: "tok", placeholder: "Admin token", autocomplete: "off" });
  var who = h("input", { type: "text", id: "modname", placeholder: "Your name (goes in the audit log)", value: state.mod });
  main.appendChild(h("div", { class: "card" },
    h("p", null, "Sign in with the server's admin token (FQ_ADMIN_TOKEN). It stays in this tab only."),
    h("div", { class: "row2" }, tok, who, h("button", { class: "on", onclick: function () {
      state.token = tok.value.trim(); state.mod = who.value.trim(); localStorage.setItem("fq_mod", state.mod);
      api("GET", "/admin/server").then(function () { sessionStorage.setItem("fq_admin", state.token); render(); }).catch(function (e) { state.token = ""; fail(e); });
    } }, "Sign in"))));
}

var TABS = [["reports", "Reports"], ["mutes", "Mutes"], ["accounts", "Accounts"], ["towns", "Towns"], ["bans", "Address bans"], ["audit", "Audit log"]];
function render() {
  var nav = $("nav"); clear(nav);
  $("whoBox").hidden = !state.token;
  if (!state.token) { login(); return; }
  $("who").textContent = state.mod || "admin";
  TABS.forEach(function (t) {
    nav.appendChild(h("button", { class: state.tab === t[0] ? "on" : "", onclick: function () { state.tab = t[0]; state.report = null; state.account = null; render(); } }, t[1]));
  });
  nav.appendChild(h("button", { onclick: signOut }, "Sign out"));
  var main = $("main"); clear(main);
  ({ reports: reportsTab, mutes: mutesTab, accounts: accountsTab, towns: townsTab, bans: bansTab, audit: auditTab })[state.tab](main);
}

function select(options, value, onchange, any) {
  var s = h("select", { onchange: onchange });
  if (any) s.appendChild(h("option", { value: "" }, any));
  options.forEach(function (o) { s.appendChild(h("option", { value: o, selected: o === value }, o)); });
  return s;
}
function tag(text, kind) { return h("span", { class: "tag " + (kind || "") }, text); }

// ------------------------------------------------------------------ reports
var filters = { status: "open", category: "", kind: "" };
function reportsTab(main) {
  if (state.report !== null) return reportDetail(main, state.report);
  var list = h("div", null, "Loading...");
  main.appendChild(h("div", { class: "filters" },
    select(["open", "dismissed", "actioned"], filters.status, function (e) { filters.status = e.target.value; render(); }, "any status"),
    select(CATS, filters.category, function (e) { filters.category = e.target.value; render(); }, "any category"),
    select(["chat", "letter", "announcement", "fortune", "quote", "player", "name", "parlorName"], filters.kind, function (e) { filters.kind = e.target.value; render(); }, "any kind"),
    h("button", { onclick: render }, "Refresh")));
  main.appendChild(list);
  var q = "?limit=100" + (filters.status ? "&status=" + filters.status : "") + (filters.category ? "&category=" + filters.category : "") + (filters.kind ? "&kind=" + filters.kind : "");
  api("GET", "/admin/reports" + q).then(function (d) {
    clear(list);
    if (!d.reports.length) { list.appendChild(h("p", { class: "mut" }, "No reports match.")); return; }
    var table = h("table", { class: "queue" }, h("tr", null, ["#", "When", "Kind", "Category", "About", "Text", "Flags"].map(function (t) { return h("th", null, t); })));
    d.reports.forEach(function (r) {
      table.appendChild(h("tr", { class: "row", onclick: function () { state.report = r.id; render(); } },
        h("td", null, r.id), h("td", null, when(r.createdAt)), h("td", null, r.kind), h("td", null, r.category),
        h("td", null, r.reportedName || r.reportedLogin || "unknown"),
        h("td", null, (r.text || "").slice(0, 80)),
        h("td", null, r.status !== "open" ? tag(r.status) : null, r.reportedMuted ? tag("muted", "bad") : null, r.reportedBanned ? tag("banned", "bad") : null, r.verified ? null : tag("unverified"))));
    });
    list.appendChild(table);
  }).catch(fail);
}

function reportDetail(main, id) {
  main.appendChild(h("button", { onclick: function () { state.report = null; render(); } }, "Back to the queue"));
  var box = h("div", null, "Loading...");
  main.appendChild(box);
  api("GET", "/admin/reports/" + id).then(function (d) {
    clear(box);
    var r = d.report;
    box.appendChild(h("div", { class: "card" },
      h("h2", null, "Report " + r.id + " ", tag(r.status, r.status === "open" ? "bad" : "good"), r.verified ? tag("verified", "good") : tag("unverified: the server could not match this text to its records")),
      h("p", { class: "mut" }, when(r.createdAt) + " in " + (r.townId || "?") + ", seen in " + (r.where || "the game") + ", category " + r.category),
      r.authoredAt ? h("p", { class: "mut" }, "Written " + when(r.authoredAt)) : null,
      h("div", { class: "quote" }, r.text || "(no text)"),
      r.note ? h("p", null, h("b", null, "Reporter's note: "), r.note) : null,
      r.reporter ? h("p", { class: "mut" }, "Reported by " + r.reporter.login + (r.reporter.guest ? " (guest)" : "") + " (moderators only; never shown to the reported player).") : h("p", { class: "mut" }, "Reporter's account has been deleted."),
      r.status !== "open" ? h("p", null, h("b", null, "Closed by "), (r.resolvedBy || "") + ": " + (r.resolution || "") + (r.resolutionNote ? " (" + r.resolutionNote + ")" : "")) : null));
    if (r.evidence.chatWindow.length) {
      var chat = h("div", { class: "chat" });
      r.evidence.chatWindow.forEach(function (l) {
        chat.appendChild(h("div", { class: l.reported ? "hit" : "" }, new Date(l.at).toLocaleTimeString() + "  " + l.text));
      });
      box.appendChild(h("div", { class: "card" }, h("h3", null, "The cafe around that line"), chat,
        h("p", { class: "mut" }, "Captured when the report was filed from a short in-memory window of cafe lines. Chat is not stored otherwise.")));
    }
    var grid = h("div", { class: "grid" });
    if (d.reported) grid.appendChild(accountCard(d.reported));
    box.appendChild(grid);
    if (d.others.length) {
      var t = h("table", null, h("tr", null, ["#", "When", "Kind", "Category", "Status"].map(function (x) { return h("th", null, x); })));
      d.others.forEach(function (o) { t.appendChild(h("tr", { class: "row", onclick: function () { state.report = o.id; render(); } }, h("td", null, o.id), h("td", null, when(o.createdAt)), h("td", null, o.kind), h("td", null, o.category), h("td", null, o.status))); });
      box.appendChild(h("div", { class: "card" }, h("h3", null, "Other reports about this account"), t));
    }
    box.appendChild(actionsCard(d));
  }).catch(fail);
}

function accountCard(a) {
  return h("div", { class: "card" }, h("h3", null, "Account " + a.login, a.guest ? tag("guest") : null, a.banned ? tag("banned", "bad") : null),
    h("p", { class: "mut" }, "Created " + when(a.createdAt) + ", last log-in " + when(a.lastLoginAt)),
    h("p", null, a.reportsAbout + " reports about it (" + a.openReportsAbout + " open). Addresses: " + (a.recentAddresses.join(", ") || "none")),
    a.parlors.length ? h("p", null, "Parlors: " + a.parlors.map(function (p) { return p.name + " of " + p.parlor + " in " + p.townId + (p.online ? " (online)" : ""); }).join("; ")) : h("p", { class: "mut" }, "No parlors."),
    a.activeMutes.length ? h("p", null, a.activeMutes.map(function (m) { return tag("muted from " + m.scopes.join(", ") + " until " + when(new Date(m.expiresAt).toISOString()) + (m.auto ? " (automatic)" : ""), "bad"); })) : null);
}

function ask(text) { return window.confirm(text); }
function actionsCard(d) {
  var r = d.report, acct = d.reported, parlor = acct && acct.parlors[0];
  var why = h("input", { type: "text", id: "why", placeholder: "Reason (required, goes in the audit log)", class: "full" });
  var msg = h("textarea", { id: "msg", placeholder: "Message for the warning letter" });
  var scope = select(["all", "announcements", "mail"], "all", function () {});
  var newName = h("input", { type: "text", placeholder: "New name (3-20)" });
  var newParlor = h("input", { type: "text", placeholder: "New parlor name (3-20)" });
  var hours = h("input", { type: "number", value: 24, min: 1, max: 8760, class: "w6" });
  var scopeBoxes = SCOPES.map(function (s) { return h("input", { type: "checkbox", value: s, checked: true }); });
  var address = h("select", null, (acct ? acct.recentAddresses : []).map(function (ip) { return h("option", { value: ip }, ip); }));
  var close = h("input", { type: "checkbox", checked: true });
  function need() { var v = why.value.trim(); if (!v) { toast("Give a reason first.", true); why.focus(); return null; } return v; }
  function run(label, confirmText, fn) {
    return h("button", { class: label.indexOf("Ban") === 0 || label.indexOf("Delete") === 0 ? "danger" : "", onclick: function () {
      var reason = need(); if (!reason) return;
      if (!ask(confirmText + "\n\nReason: " + reason)) return;
      fn(reason).then(function (res) { toast(label + ": done."); render(); return res; }).catch(fail);
    } }, label);
  }
  var common = function (reason) { return { reason: reason, reportId: r.id, resolve: close.checked }; };
  var accountId = r.reportedAccountId;
  var row = function (label, controls) { return [h("label", null, label), h("div", { class: "row2" }, controls)]; };
  var card = h("div", { class: "card actions" }, h("h3", null, "Actions"),
    why, h("div", { class: "row2" }, close, h("span", null, "Close this report with the first action")),
    row("Dismiss", [run("Dismiss report", "Dismiss report " + r.id + " without action?", function (reason) { return api("POST", "/admin/reports/" + r.id + "/dismiss", { reason: reason }); })]));
  if (accountId !== null) {
    card.appendChild(h("div", null, row("Warn with a system letter", [msg, run("Send warning", "Send this letter to " + acct.login + "?", function (reason) { return api("POST", "/admin/moderation/warn", Object.assign(common(reason), { accountId: accountId, message: msg.value })); })])));
    card.appendChild(h("div", null, row("Take down their text (the engine removes per player, not per message)", [scope, run("Take down", "Remove " + acct.login + "'s " + scope.value + " text from the town?", function (reason) { return api("POST", "/admin/moderation/takedown", Object.assign(common(reason), { accountId: accountId, scope: scope.value })); })])));
    card.appendChild(h("div", null, row("Mute", [hours, "hours", scopeBoxes.map(function (b, i) { return h("label", null, b, SCOPES[i]); }), run("Mute", "Mute " + acct.login + " for " + hours.value + " hours?", function (reason) { return api("POST", "/admin/moderation/mute", Object.assign(common(reason), { accountId: accountId, hours: Number(hours.value), scopes: scopeBoxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; }) })); })])));
    if (parlor) {
      card.appendChild(h("div", null, row("Force a rename", [newName, newParlor, h("button", { onclick: function () { newName.value = "Renamed " + parlor.playerId; } }, "Generic name"), run("Rename", "Rename " + parlor.name + "?", function (reason) { return api("POST", "/admin/moderation/rename", Object.assign(common(reason), { townId: parlor.townId, playerId: parlor.playerId }, newName.value ? { name: newName.value } : {}, newParlor.value ? { parlor: newParlor.value } : {})); })])));
      card.appendChild(h("div", null, row("Kick from the town", [run("Kick", "Log " + parlor.name + " off?", function (reason) { return api("POST", "/admin/towns/" + parlor.townId + "/players/" + parlor.playerId + "/kick", { reason: reason, reportId: r.id }); })])));
    }
    card.appendChild(h("div", null, row("Ban", [run("Ban account", "Ban " + acct.login + " and log them off everywhere?", function (reason) { return api("POST", "/admin/accounts/" + accountId + "/ban", { reason: reason, reportId: r.id }); }), address, run("Ban address", "Ban the address " + address.value + "?", function (reason) { return api("POST", "/admin/bans", { prefix: address.value, reason: reason, reportId: r.id, expiresInHours: 24 * 30 }); })])));
    card.appendChild(h("div", null, row("Delete the account", [run("Delete account", "DELETE the account " + acct.login + " and its text? This cannot be undone.", function (reason) { return api("POST", "/admin/moderation/delete-account", { accountId: accountId, reason: reason, confirm: true }); })])));
  } else {
    card.appendChild(h("p", { class: "mut" }, "The server could not tell who wrote this, so there is nobody to act on. Dismiss it, or look in the audit log."));
  }
  return card;
}

// -------------------------------------------------------------------- mutes
function mutesTab(main) {
  var box = h("div", null, "Loading...");
  main.appendChild(box);
  api("GET", "/admin/moderation/mutes").then(function (d) {
    clear(box);
    if (!d.mutes.length) { box.appendChild(h("p", { class: "mut" }, "Nobody is muted.")); return; }
    var t = h("table", null, h("tr", null, ["Account", "From", "Until", "By", "Reason", ""].map(function (x) { return h("th", null, x); })));
    d.mutes.forEach(function (m) {
      t.appendChild(h("tr", null, h("td", null, m.login || m.accountId), h("td", null, m.scopes.join(", ")), h("td", null, when(new Date(m.expiresAt).toISOString())), h("td", null, m.moderator + (m.auto ? " (automatic)" : "")), h("td", null, m.reason),
        h("td", null, h("button", { onclick: function () {
          var reason = window.prompt("Reason for lifting this mute:"); if (!reason) return;
          api("POST", "/admin/moderation/unmute", { muteId: m.id, reason: reason }).then(function () { toast("Lifted."); render(); }).catch(fail);
        } }, "Lift"))));
    });
    box.appendChild(t);
  }).catch(fail);
}

// ----------------------------------------------------------------- accounts
function accountsTab(main) {
  if (state.account !== null) return accountDetail(main, state.account);
  var q = h("input", { type: "search", placeholder: "Search login" });
  var box = h("div", null);
  function go() {
    clear(box);
    api("GET", "/admin/accounts?limit=100&search=" + encodeURIComponent(q.value)).then(function (d) {
      var t = h("table", null, h("tr", null, ["Id", "Login", "Created", "Flags"].map(function (x) { return h("th", null, x); })));
      d.accounts.forEach(function (a) {
        t.appendChild(h("tr", { class: "row", onclick: function () { state.account = a.id; render(); } }, h("td", null, a.id), h("td", null, a.login), h("td", null, when(new Date(a.createdAt).toISOString())), h("td", null, a.guest ? tag("guest") : null, a.banned ? tag("banned", "bad") : null)));
      });
      box.appendChild(t);
    }).catch(fail);
  }
  main.appendChild(h("div", { class: "filters" }, q, h("button", { onclick: go }, "Search")));
  main.appendChild(box);
  go();
}
function accountDetail(main, id) {
  main.appendChild(h("button", { onclick: function () { state.account = null; render(); } }, "Back"));
  var box = h("div", null, "Loading..."); main.appendChild(box);
  api("GET", "/admin/accounts/" + id + "/moderation").then(function (d) {
    clear(box);
    var a = d.account;
    box.appendChild(accountCard(a));
    var why = h("input", { type: "text", placeholder: "Reason", class: "full" });
    box.appendChild(h("div", { class: "card" }, why, h("div", { class: "row2" },
      a.banned ? h("button", { onclick: function () { api("POST", "/admin/accounts/" + id + "/unban").then(function () { toast("Unbanned."); render(); }).catch(fail); } }, "Unban")
        : h("button", { class: "danger", onclick: function () { if (!why.value.trim()) return toast("Give a reason.", true); if (ask("Ban " + a.login + "?")) api("POST", "/admin/accounts/" + id + "/ban", { reason: why.value.trim() }).then(function () { toast("Banned."); render(); }).catch(fail); } }, "Ban account"))));
    var t = h("table", null, h("tr", null, ["When", "Action", "Detail"].map(function (x) { return h("th", null, x); })));
    d.actions.forEach(function (e) { t.appendChild(h("tr", null, h("td", null, when(new Date(e.at).toISOString())), h("td", null, e.kind), h("td", null, JSON.stringify(e.data).slice(0, 200)))); });
    box.appendChild(h("div", { class: "card" }, h("h3", null, "Moderation history"), t));
    var r = h("table", null, h("tr", null, ["#", "When", "Kind", "Category", "Status"].map(function (x) { return h("th", null, x); })));
    d.reportsAbout.forEach(function (o) { r.appendChild(h("tr", { class: "row", onclick: function () { state.tab = "reports"; state.report = o.id; render(); } }, h("td", null, o.id), h("td", null, when(o.createdAt)), h("td", null, o.kind), h("td", null, o.category), h("td", null, o.status))); });
    box.appendChild(h("div", { class: "card" }, h("h3", null, "Reports about this account"), r));
  }).catch(fail);
}

// -------------------------------------------------------------------- towns
function townsTab(main) {
  var box = h("div", null, "Loading..."); main.appendChild(box);
  api("GET", "/admin/towns").then(function (d) {
    clear(box);
    d.towns.forEach(function (t) {
      var msg = h("input", { type: "text", placeholder: "Broadcast to everyone online", class: "grow" });
      box.appendChild(h("div", { class: "card" }, h("h3", null, t.name + " (" + t.id + ")"),
        h("p", null, t.rulesetLabel + ", day " + t.day + ", " + t.players.registered + " players, " + t.players.online + " online. Next day " + when(t.nextDayAt)),
        h("div", { class: "row2" }, msg, h("button", { onclick: function () {
          if (!msg.value.trim() || !ask("Broadcast to everyone online in " + t.name + "?")) return;
          api("POST", "/admin/towns/" + t.id + "/broadcast", { message: msg.value }).then(function (r) { toast("Sent to " + r.delivered + " players."); msg.value = ""; }).catch(fail);
        } }, "Broadcast"), h("button", { class: "danger", onclick: function () {
          if (!ask("Run a new day in " + t.name + " now? The schedule is not changed.")) return;
          api("POST", "/admin/towns/" + t.id + "/new-day").then(function (r) { toast("Day " + r.day + "."); render(); }).catch(fail);
        } }, "Run a new day"))));
    });
    box.appendChild(h("p", { class: "mut" }, "Settings, snapshots, rollback and town creation are in the admin API (apps/server/README.md)."));
  }).catch(fail);
}

// --------------------------------------------------------------------- bans
function bansTab(main) {
  var box = h("div", null, "Loading..."); main.appendChild(box);
  var prefix = h("input", { type: "text", placeholder: "Address, 203.0.113 or 10.0.0.0/8" });
  var why = h("input", { type: "text", placeholder: "Reason" });
  var hrs = h("input", { type: "number", placeholder: "Hours (blank: no expiry)", class: "w11" });
  main.insertBefore(h("div", { class: "card row2" }, prefix, why, hrs, h("button", { class: "danger", onclick: function () {
    if (!prefix.value.trim() || !why.value.trim()) return toast("An address and a reason are needed.", true);
    if (!ask("Ban " + prefix.value + "?")) return;
    var body = { prefix: prefix.value.trim(), reason: why.value.trim() }; if (hrs.value) body.expiresInHours = Number(hrs.value);
    api("POST", "/admin/bans", body).then(function () { toast("Banned."); render(); }).catch(fail);
  } }, "Ban")), box);
  api("GET", "/admin/bans").then(function (d) {
    clear(box);
    if (!d.bans.length) { box.appendChild(h("p", { class: "mut" }, "No address bans.")); return; }
    var t = h("table", null, h("tr", null, ["Rule", "Reason", "Expires", ""].map(function (x) { return h("th", null, x); })));
    d.bans.forEach(function (b) { t.appendChild(h("tr", null, h("td", null, b.prefix), h("td", null, b.reason), h("td", null, b.expires_at ? when(new Date(b.expires_at).toISOString()) : "never"), h("td", null, h("button", { onclick: function () { if (ask("Lift the ban on " + b.prefix + "?")) api("DELETE", "/admin/bans/" + b.id).then(function () { render(); }).catch(fail); } }, "Lift")))); });
    box.appendChild(t);
  }).catch(fail);
}

// -------------------------------------------------------------------- audit
function auditTab(main) {
  var kind = h("input", { type: "text", placeholder: "Kind prefix, e.g. admin: or mod:" });
  var acct = h("input", { type: "number", placeholder: "Account id" });
  var box = h("div", null);
  function go() {
    clear(box);
    var q = "?limit=200" + (kind.value ? "&kind=" + encodeURIComponent(kind.value) : "") + (acct.value ? "&accountId=" + acct.value : "");
    api("GET", "/admin/audit" + q).then(function (d) {
      var t = h("table", null, h("tr", null, ["When", "Kind", "Account", "Detail"].map(function (x) { return h("th", null, x); })));
      d.entries.forEach(function (e) { t.appendChild(h("tr", null, h("td", null, when(new Date(e.at).toISOString())), h("td", null, e.kind), h("td", null, e.accountId === null ? "" : e.accountId), h("td", null, JSON.stringify(e.data).slice(0, 240)))); });
      box.appendChild(t);
    }).catch(fail);
  }
  kind.value = "admin:";
  main.appendChild(h("div", { class: "filters" }, kind, acct, h("button", { onclick: go }, "Show")));
  main.appendChild(box);
  go();
}

render();
`;

/** The page, for one response: `nonce` is the CSP nonce for the script and style. */
export function adminPageHtml(nonce: string, contact: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Funeral Quest moderation</title>
<style nonce="${nonce}">${STYLE}</style>
</head>
<body>
<header><h1>Funeral Quest moderation</h1><span class="mut" id="whoBox" hidden>signed in as <b id="who"></b></span><span class="mut">${escapeHtml(contact)}</span></header>
<main><nav id="nav"></nav><div id="main"></div></main>
<div id="toast" role="status"></div>
<noscript>This page needs JavaScript.</noscript>
<script nonce="${nonce}">${SCRIPT}</script>
</body>
</html>
`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
