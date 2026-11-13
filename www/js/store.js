// Shared state, storage and helpers. Loaded first; the other scripts attach to window.RM.
(() => {
  "use strict";
  const RM = (window.RM = {});

  const KEYS = {
    items: "rmlist.items.v1",
    checkins: "rmlist.checkins.v1",
    thoughts: "rmlist.thoughts.v1",
    sessions: "rmlist.sessions.v1",
    activities: "rmlist.activities.v1",
    settings: "rmlist.settings.v1",
  };

  RM.VERSION = window.RM_VERSION || { version: "dev", code: 0, defaultUpdateServer: "", releases: [] };

  RM.MOODS = {
    1: { label: "very low" },
    2: { label: "low" },
    3: { label: "okay" },
    4: { label: "good" },
    5: { label: "great" },
  };

  RM.GOOD_THINGS = ["read a little", "watched something", "went outside", "moved my body",
    "talked to someone", "ate a proper meal", "rested", "made something"];

  const DEFAULT_ACTIVITIES = ["make a warm drink", "step outside for five minutes", "text someone you trust",
    "listen to a favorite song", "take a warm shower", "read just one page"];

  RM.LABELS = {
    book: { creator: "author", planned: "want to read", done: "read", noun: "book" },
    movie: { creator: "director", planned: "want to watch", done: "watched", noun: "movie" },
  };

  // Two colors per theme: background + ink. `soft`/`line` are precomputed blends (no color-mix in older WebViews).
  RM.THEMES = [
    { id: "paper", bg: "#efebe4", ink: "#1d1d1b", soft: "#e2ddd4", line: "#b9b5ad", dark: false },
    { id: "sky", bg: "#172447", ink: "#f1e9c6", soft: "#22325c", line: "#73777c", dark: true }, // the app icon's night sky
    { id: "forest", bg: "#0f4a3d", ink: "#f1e9c6", soft: "#175748", line: "#5d7f6c", dark: true },
    { id: "night", bg: "#0d0d1c", ink: "#f2914a", soft: "#1a1a2c", line: "#6b4a39", dark: true },
    { id: "mint", bg: "#c9f2e3", ink: "#8e1f1f", soft: "#b9e6d5", line: "#b48c87", dark: false },
    { id: "peach", bg: "#f7dcc8", ink: "#5a3326", soft: "#eecfb8", line: "#b9988a", dark: false },
  ];

  // ---------- DOM + date helpers ----------
  RM.$ = (sel, root = document) => root.querySelector(sel);

  RM.el = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children) if (c != null) node.append(c);
    return node;
  };

  const pad = (n) => String(n).padStart(2, "0");
  RM.isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  RM.parseIso = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
  RM.todayIso = () => RM.isoDate(new Date());
  RM.addDays = (iso, n) => { const d = RM.parseIso(iso); d.setDate(d.getDate() + n); return RM.isoDate(d); };
  RM.formatDate = (iso, opts = { year: "numeric", month: "short", day: "numeric" }) =>
    iso ? RM.parseIso(iso).toLocaleDateString("en-US", opts).toLowerCase() : "";
  RM.isIso = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  RM.newId = () => (crypto.randomUUID && crypto.randomUUID()) ||
    Date.now().toString(36) + Math.random().toString(36).slice(2);

  // ---------- Sanitizers: everything loaded or imported passes through these ----------
  const str = (v, max) => String(v ?? "").trim().slice(0, max);
  const id = (v) => (typeof v === "string" && v ? v : RM.newId());

  const clean = {
    item(raw) {
      if (!raw || typeof raw !== "object") return null;
      const title = str(raw.title, 200);
      if (!title) return null;
      const rating = Number(raw.rating);
      return {
        id: id(raw.id),
        type: raw.type === "movie" ? "movie" : "book",
        title,
        creator: str(raw.creator, 200),
        status: raw.status === "done" ? "done" : "planned",
        date: RM.isIso(raw.date) ? raw.date : "",
        rating: Number.isInteger(rating) && rating >= 0 && rating <= 5 ? rating : 0,
        notes: str(raw.notes, 2000),
        comfort: raw.comfort === true,
        createdAt: Number(raw.createdAt) || Date.now(),
      };
    },
    checkin(raw) {
      if (!raw || !RM.isIso(raw.date)) return null;
      const mood = Number(raw.mood);
      const goods = Array.isArray(raw.goods)
        // Older versions stored the built-in good things capitalized; fold those into the current labels.
        ? [...new Set(raw.goods.map((g) => str(g, 60)).filter(Boolean)
          .map((g) => (RM.GOOD_THINGS.includes(g.toLowerCase()) ? g.toLowerCase() : g)))].slice(0, 30) : [];
      const c = { date: raw.date, mood: Number.isInteger(mood) && mood >= 1 && mood <= 5 ? mood : 0, goods, note: str(raw.note, 2000) };
      return c.mood || c.goods.length || c.note ? c : null; // an empty check-in is no check-in
    },
    thought(raw) {
      const text = str(raw?.text, 500);
      return text ? { id: id(raw.id), text, done: raw.done === true, createdAt: Number(raw.createdAt) || Date.now() } : null;
    },
    session(raw) {
      const notes = str(raw?.notes, 4000);
      return notes && RM.isIso(raw.date) ? { date: raw.date, notes } : null;
    },
    activity(raw) {
      const text = str(raw?.text, 200);
      return text ? { id: id(raw.id), text } : null;
    },
  };
  RM.clean = clean;

  // ---------- Load ----------
  const read = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  const list = (v, fn) => (Array.isArray(v) ? v.map(fn).filter(Boolean) : []);
  const byDate = (arr) => Object.fromEntries(arr.map((c) => [c.date, c]));

  const storedCheckins = read(KEYS.checkins);
  const storedActivities = read(KEYS.activities);
  const storedSettings = read(KEYS.settings);

  RM.state = {
    items: list(read(KEYS.items), clean.item),
    checkins: byDate(list(storedCheckins && typeof storedCheckins === "object" ? Object.values(storedCheckins) : [], clean.checkin)),
    thoughts: list(read(KEYS.thoughts), clean.thought),
    sessions: list(read(KEYS.sessions), clean.session),
    // Seed a few gentle ideas the first time; respect an empty list after that.
    activities: Array.isArray(storedActivities)
      ? list(storedActivities, clean.activity)
      : DEFAULT_ACTIVITIES.map((text) => ({ id: RM.newId(), text })),
    settings: cleanSettings(storedSettings || {}),
  };

  function cleanSettings(s) {
    const day = Number(s.sessionDay);
    return {
      theme: RM.THEMES.some((t) => t.id === s.theme) ? s.theme : "paper",
      name: str(s.name, 40),
      showMoodFaces: (s.showMoodFaces ?? s.showMoodColors) !== false,
      sessionDay: Number.isInteger(day) && day >= 0 && day <= 6 ? day : 2, // Tuesday
      supportLine: s.supportLine === undefined ? "13520073751" : str(s.supportLine, 30),
      updateServer: /^https?:\/\/[^\s]+$/i.test(s.updateServer || "") ? str(s.updateServer, 200) : "",
    };
  }
  RM.cleanSettings = cleanSettings;

  // ---------- Save + re-render ----------
  const renderers = [];
  RM.onRender = (fn) => renderers.push(fn);
  RM.renderAll = () => renderers.forEach((fn) => fn());

  RM.commit = (...names) => {
    try {
      for (const n of names) localStorage.setItem(KEYS[n], JSON.stringify(RM.state[n]));
    } catch {
      (RM.alert || alert)("couldn't save. the phone's storage may be full.");
    }
    RM.renderAll();
  };

  RM.getCheckin = (date) => RM.state.checkins[date] || { date, mood: 0, goods: [], note: "" };
  RM.setCheckin = (date, patch) => {
    const next = clean.checkin({ ...RM.getCheckin(date), ...patch, date });
    if (next) RM.state.checkins[date] = next; else delete RM.state.checkins[date];
    RM.commit("checkins");
  };

  // ---------- Backup ----------
  RM.exportData = () => ({
    app: "rmlist", version: 2, exportedAt: new Date().toISOString(),
    ...RM.state, checkins: Object.values(RM.state.checkins),
  });

  // Merges a backup into current data. `confirmFn(count)` may return a promise; falsy cancels.
  // Accepts v1 (bare item array) backups. Resolves true if imported.
  RM.importData = async (data, confirmFn) => {
    const d = Array.isArray(data) ? { items: data } : data;
    if (!d || typeof d !== "object") throw new Error("invalid backup");
    const inc = {
      items: list(d.items, clean.item), checkins: list(d.checkins, clean.checkin),
      thoughts: list(d.thoughts, clean.thought), sessions: list(d.sessions, clean.session),
      activities: list(d.activities, clean.activity),
    };
    const count = Object.values(inc).reduce((n, a) => n + a.length, 0);
    if (!count) throw new Error("empty backup");
    if (!(await confirmFn(count))) return false;

    const s = RM.state;
    const merge = (cur, add, key) => [...new Map([...cur, ...add].map((x) => [x[key], x])).values()];
    s.items = merge(s.items, inc.items, "id");
    s.thoughts = merge(s.thoughts, inc.thoughts, "id");
    s.sessions = merge(s.sessions, inc.sessions, "date");
    s.activities = merge(s.activities, inc.activities, "id");
    for (const c of inc.checkins) s.checkins[c.date] = c;
    RM.commit("items", "checkins", "thoughts", "sessions", "activities");
    return true;
  };
})();
