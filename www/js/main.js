// Navigation, dialogs, Android back button. Loaded last.
(() => {
  "use strict";
  const { $ } = RM;

  let toastTimer;
  RM.announce = (msg) => {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  };

  // ---------- Views ----------
  const tabs = [...document.querySelectorAll(".nav .tab")];
  const VIEWS = ["today", "calendar", "therapist", "comfort", "library", "profile"];
  let current = "today";
  let beforeProfile = "today";

  function showView(view, { focus = false } = {}) {
    if (!VIEWS.includes(view)) view = "today";
    if (view === "profile" && current !== "profile") beforeProfile = current;
    current = view;
    for (const v of VIEWS) $(`#view-${v}`).hidden = v !== view;
    for (const t of tabs) {
      if (t.dataset.view === view) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current");
    }
    $("#profile-btn").setAttribute("aria-expanded", String(view === "profile"));
    document.body.dataset.view = view;
    window.scrollTo(0, 0);
    RM.renderAll();
    if (focus) $(`#view-${view} h1`)?.focus({ preventScroll: true });
  }
  RM.showView = showView;
  document.querySelectorAll(".view h1").forEach((h) => h.setAttribute("tabindex", "-1"));

  tabs.forEach((t) => t.addEventListener("click", () => showView(t.dataset.view, { focus: true })));
  $("#profile-btn").addEventListener("click", () => showView(current === "profile" ? beforeProfile : "profile", { focus: true }));
  $("#profile-close").addEventListener("click", () => showView(beforeProfile, { focus: true }));

  // ---------- Dialogs ----------
  for (const d of document.querySelectorAll("dialog")) {
    let opener = null;
    const show = d.showModal.bind(d);
    d.showModal = () => { opener = document.activeElement; show(); d.scrollTop = 0; };
    d.addEventListener("close", () => { if (opener && document.contains(opener)) opener.focus(); });
    // Tap the dimmed area outside the sheet to close it.
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  }

  // ---------- Android back button ----------
  const App = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.App;
  if (App) {
    App.addListener("backButton", () => {
      const open = document.querySelector("dialog[open]");
      if (open) open.close();
      else if (current === "profile") showView(beforeProfile);
      else if (current !== "today") showView("today");
      else App.minimizeApp();
    });
    // Refresh greeting/today when coming back to the app.
    App.addListener("resume", () => RM.renderAll());
  }

  RM.hydrateIcons();
  RM.applyTheme();
  showView("today");

  // ---------- Starry intro ----------
  // Shown for a moment on launch, then fades into the app. Tapping skips it.
  const splash = $("#splash");
  if (splash) {
    let gone = false;
    const leave = () => {
      if (gone) return;
      gone = true;
      splash.classList.add("leaving");
      splash.addEventListener("transitionend", () => { splash.remove(); RM.applyTheme(); }, { once: true });
      setTimeout(() => { if (splash.isConnected) { splash.remove(); RM.applyTheme(); } }, 900); // fallback if no transition
    };
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setTimeout(leave, reduced ? 500 : 1300);
    splash.addEventListener("click", leave);
  }
})();
