// Profile: gentle stats, name, color themes, settings, updates, backup.
(() => {
  "use strict";
  const { $, el, state } = RM;
  const V = RM.VERSION;

  // ---------- Theme ----------
  RM.applyTheme = () => {
    const t = RM.THEMES.find((x) => x.id === state.settings.theme) || RM.THEMES[0];
    document.documentElement.dataset.theme = t.id;
    document.querySelector('meta[name="theme-color"]').setAttribute("content", t.bg);
    // Match Android's status bar to the theme (kept night blue while the starry intro is showing).
    const sb = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.StatusBar;
    if (sb && !document.getElementById("splash")) {
      sb.setBackgroundColor?.({ color: t.bg }).catch(() => {});
      sb.setStyle?.({ style: t.dark ? "DARK" : "LIGHT" }).catch(() => {});
    }
  };

  const picker = $("#theme-picker");
  picker.append(...RM.THEMES.map((t) => el("button", {
    type: "button", class: "swatch", role: "radio", "data-theme-id": t.id, "aria-label": `${t.id} theme`,
    onclick: () => { state.settings.theme = t.id; RM.applyTheme(); RM.commit("settings"); },
  }, el("span", { class: "chip", style: `background:${t.bg};--c2:${t.ink}` }), el("span", { text: t.id, "aria-hidden": "true" }))));

  // ---------- Settings ----------
  $("#set-mood-faces").addEventListener("change", (e) => { state.settings.showMoodFaces = e.target.checked; RM.commit("settings"); });
  $("#set-session-day").addEventListener("change", (e) => { state.settings.sessionDay = Number(e.target.value); RM.commit("settings"); });

  $("#name-form").addEventListener("submit", (e) => {
    e.preventDefault();
    state.settings = RM.cleanSettings({ ...state.settings, name: e.target.elements.name.value });
    RM.commit("settings");
    RM.announce(state.settings.name ? `nice to meet you, ${state.settings.name.toLowerCase()}.` : "name cleared.");
  });

  $("#support-form").addEventListener("submit", (e) => {
    e.preventDefault();
    state.settings = RM.cleanSettings({ ...state.settings, supportLine: e.target.elements.line.value });
    RM.commit("settings");
    RM.announce("support line saved.");
  });

  function renderSupport() {
    const line = state.settings.supportLine;
    $("#support-footer").hidden = !line;
    $("#support-number").textContent = line;
    $("#support-link").setAttribute("href", `tel:${line.replace(/[^\d+]/g, "")}`);
  }

  // ---------- Render ----------
  function renderProfile() {
    const s = state.settings;
    $("#profile-heading").textContent = s.name ? `hi, ${s.name.toLowerCase()}.` : "hi there.";

    const checkins = Object.keys(state.checkins).length;
    const books = state.items.filter((x) => x.type === "book" && x.status === "done").length;
    const movies = state.items.filter((x) => x.type === "movie" && x.status === "done").length;
    const goods = Object.values(state.checkins).reduce((n, c) => n + c.goods.length, 0);
    $("#stats").replaceChildren(...[
      [checkins, checkins === 1 ? "day checked in" : "days checked in"],
      [goods, goods === 1 ? "small good thing" : "small good things"],
      [books, books === 1 ? "book read" : "books read"],
      [movies, movies === 1 ? "movie watched" : "movies watched"],
    ].map(([n, label]) => el("li", {}, el("span", { class: "stat-num", text: String(n) }), el("span", { class: "stat-label", text: label }))));

    picker.querySelectorAll(".swatch").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.themeId === s.theme)));
    $("#set-mood-faces").checked = s.showMoodFaces;
    $("#set-session-day").value = String(s.sessionDay);
    const nameInput = $("#name-form").elements.name;
    if (document.activeElement !== nameInput) nameInput.value = s.name;
    const lineInput = $("#support-form").elements.line;
    if (document.activeElement !== lineInput) lineInput.value = s.supportLine;
    const serverInput = $("#server-form").elements.server;
    if (document.activeElement !== serverInput) serverInput.value = s.updateServer || V.defaultUpdateServer;
    renderSupport();
  }

  $("#app-version").textContent = V.version;
  $("#release-notes").replaceChildren(...V.releases.map((r) => el("div", { class: "release" },
    el("h3", { class: "sublabel", text: `${r.version} · ${RM.formatDate(r.date)}` }),
    el("ul", { class: "lines" }, ...r.notes.map((n) => el("li", { text: n }))))));

  // ---------- Updates ----------
  const native = () => window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.Updater;
  const status = (t) => { $("#update-status").textContent = t; };
  let pending = null;

  $("#server-form").addEventListener("submit", (e) => {
    e.preventDefault();
    let v = e.target.elements.server.value.trim();
    if (v && !/^https?:\/\//i.test(v)) v = "http://" + v;
    v = v.replace(/\/+$/, "");
    state.settings = RM.cleanSettings({ ...state.settings, updateServer: v });
    if (v && !state.settings.updateServer) { status("that doesn't look like an address. it should look like http://192.168.1.5:8642"); return; }
    RM.commit("settings");
    status(v ? "saved. tap check for updates." : "cleared.");
  });

  async function fetchJson(url, ms) {
    // In the phone app, go through native code: the web view blocks http:// from its https:// page.
    const U = native();
    if (U?.getText) {
      const { text } = await U.getText({ url });
      return JSON.parse(text);
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(url, { cache: "no-store", signal: ctrl.signal });
      if (!r.ok) throw new Error(String(r.status));
      return await r.json();
    } finally { clearTimeout(t); }
  }

  $("#check-update").addEventListener("click", async () => {
    const server = state.settings.updateServer || V.defaultUpdateServer;
    $("#install-update").hidden = true;
    pending = null;
    if (!server) {
      status("add your update server address first (under \"update server\" below).");
      return;
    }
    status("checking…");
    try {
      const m = await fetchJson(`${server}/version.json`, 8000);
      const code = Number(m.code);
      if (!Number.isInteger(code) || typeof m.apk !== "string" || !/^[\w.-]+\.apk$/.test(m.apk)) throw new Error("bad manifest");
      if (code <= V.code) { status(`you're up to date. ${V.version} is the latest.`); return; }
      pending = { url: `${server}/${m.apk}`, version: String(m.version || "").slice(0, 20) };
      const notes = Array.isArray(m.notes) ? m.notes.slice(0, 8).map((n) => String(n).slice(0, 200)) : [];
      status(`version ${pending.version} is ready.${notes.length ? " new: " + notes.join("; ") + "." : ""}`);
      $("#install-update").hidden = false;
    } catch (err) {
      const why = String(err?.message || err || "").slice(0, 120);
      status("couldn't reach the update server. check the phone and computer are on the same wi-fi, and the server window is open." +
        (why ? ` (details: ${why})` : ""));
    }
  });

  $("#install-update").addEventListener("click", async () => {
    if (!pending) return;
    const U = native();
    if (!U) { status("installing only works in the phone app."); return; }

    const { allowed } = await U.canInstall();
    if (!allowed) {
      status("one-time step: allow r&m to install updates, then come back and tap download & install again.");
      await U.openInstallSettings();
      return;
    }

    const bar = $("#update-progress");
    const fill = bar.firstElementChild;
    bar.hidden = false;
    fill.style.width = "0%";
    $("#install-update").disabled = true;
    status("downloading…");
    const sub = await U.addListener("progress", (p) => { fill.style.width = `${p.percent}%`; });
    try {
      await U.downloadAndInstall({ url: pending.url });
      status("tap install on the next screen. your data stays.");
    } catch (err) {
      status(`download didn't finish: ${err?.message || "unknown error"}. try again.`);
    } finally {
      sub?.remove?.();
      bar.hidden = true;
      $("#install-update").disabled = false;
    }
  });

  // ---------- Backup ----------
  $("#export-btn").addEventListener("click", async () => {
    const json = JSON.stringify(RM.exportData(), null, 2);
    const filename = `rm-backup-${RM.todayIso()}.json`;
    const plugins = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins;
    if (plugins?.Filesystem && plugins?.Share) {
      try {
        const { uri } = await plugins.Filesystem.writeFile({ path: filename, data: json, directory: "CACHE", encoding: "utf8" });
        await plugins.Share.share({ title: "R&M backup", files: [uri] });
      } catch (err) {
        if (!/cancel/i.test(String(err?.message))) RM.alert("couldn't create the backup file. please try again.");
      }
      return;
    }
    const blob = new Blob([json], { type: "application/json" });
    const a = el("a", { href: URL.createObjectURL(blob), download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  });

  $("#import-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    let data;
    try { data = JSON.parse(await file.text()); } catch { data = null; }
    try {
      const imported = await RM.importData(data, (n) => RM.confirm(
        `${n} records will be added. entries that already exist are replaced; everything else is kept.`,
        { ok: "import", title: "import backup?" }));
      if (imported) { RM.applyTheme(); RM.announce("backup imported."); }
    } catch {
      RM.alert("that file doesn't look like an r&m backup.", { title: "can't import" });
    }
  });

  RM.onRender(renderProfile);
})();
