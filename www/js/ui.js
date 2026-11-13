// Themed replacements for system UI: confirm/alert, dropdown choices and the date picker.
// All of them are bottom sheets in the current theme instead of Android's own pop-ups.
(() => {
  "use strict";
  const { $, el } = RM;
  const MONTHS = ["january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"];

  // One reusable sheet for all small questions.
  const sheet = el("dialog", { class: "sheet ask", "aria-labelledby": "ask-title" });
  const inner = el("div", { class: "sheet-inner" });
  sheet.append(inner);
  document.body.append(sheet);

  // The answer is delivered as soon as a button is tapped. The "close" event is only a fallback for
  // dismissing (back button, tapping outside): browsers may fire it late, even after the next sheet opened.
  let pending = null; // { resolve, fallback }
  const settle = (value) => {
    const p = pending;
    pending = null;
    p?.resolve(value);
  };
  sheet.addEventListener("close", () => {
    if (sheet.open) return; // stale event from an earlier sheet; a new one is showing
    if (pending) settle(pending.fallback);
  });

  function open(children, fallback, focusSel) {
    if (pending) settle(pending.fallback); // never leave an earlier question hanging
    if (sheet.open) sheet.close();
    return new Promise((resolve) => {
      pending = { resolve, fallback };
      inner.replaceChildren(...children);
      sheet.showModal();
      (inner.querySelector(focusSel || "[autofocus]") || inner.querySelector("button"))?.focus();
    });
  }
  const done = (value) => { settle(value); sheet.close(); };
  const head = (title) => el("div", { class: "sheet-head" },
    el("h2", { id: "ask-title", text: title }),
    el("button", { type: "button", class: "icon-btn", "aria-label": "Close", onclick: () => sheet.close() }, RM.icon("close")));

  // ---------- confirm / alert ----------
  RM.confirm = (message, { ok = "yes", cancel = "cancel", title = "are you sure?" } = {}) => open([
    head(title),
    el("p", { class: "big-line", text: message }),
    el("div", { class: "btn-row" },
      el("button", { type: "button", class: "pill solid", text: ok, onclick: () => done(true) }),
      el("button", { type: "button", class: "pill", text: cancel, autofocus: true, onclick: () => done(false) })),
  ], false);

  RM.alert = (message, { title = "oops" } = {}) => open([
    head(title),
    el("p", { class: "big-line", text: message }),
    el("div", { class: "btn-row" }, el("button", { type: "button", class: "pill solid", text: "okay", onclick: () => done() })),
  ]);

  // ---------- choose one option ----------
  RM.choose = (title, options, current) => open([
    head(title),
    el("ul", { class: "choices", role: "listbox", "aria-label": title }, ...options.map((o) => el("li", {},
      el("button", {
        type: "button", class: "choice", role: "option", "aria-selected": String(o.value === current),
        autofocus: o.value === current, onclick: () => done(o.value),
      }, el("span", { text: o.label }), o.value === current ? RM.icon("check") : null)))),
  ], undefined);

  // ---------- date picker ----------
  // Resolves to an ISO date, "" (cleared) or undefined (closed without choosing).
  RM.pickDate = (current, { title = "pick a date", clearable = true } = {}) => {
    const today = RM.todayIso();
    const start = RM.parseIso(RM.isIso(current) ? current : today);
    let y = start.getFullYear();
    let m = start.getMonth();

    const label = el("h3", { class: "dp-month", "aria-live": "polite" });
    const grid = el("div", { class: "dp-grid", role: "grid" });
    const draw = () => {
      label.textContent = `${MONTHS[m]} ${y}`;
      const first = new Date(y, m, 1).getDay();
      const days = new Date(y, m + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < first; i++) cells.push(el("span", { "aria-hidden": "true" }));
      for (let d = 1; d <= days; d++) {
        const iso = RM.isoDate(new Date(y, m, d));
        cells.push(el("button", {
          type: "button",
          class: `dp-day${iso === today ? " today" : ""}`,
          "aria-pressed": String(iso === current),
          "aria-label": RM.formatDate(iso, { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
          "data-iso": iso,
          onclick: () => done(iso),
        }, String(d)));
      }
      grid.replaceChildren(...cells);
    };
    const shift = (delta) => {
      m += delta;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      draw();
    };
    draw();

    let touchX = null;
    grid.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    grid.addEventListener("touchend", (e) => {
      if (touchX == null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 60) shift(dx < 0 ? 1 : -1);
    });

    return open([
      head(title),
      el("div", { class: "month-bar" },
        el("button", { type: "button", class: "icon-btn", "aria-label": "Previous month", onclick: () => shift(-1) }, RM.icon("back")),
        label,
        el("button", { type: "button", class: "icon-btn", "aria-label": "Next month", onclick: () => shift(1) }, RM.icon("next"))),
      el("div", { class: "cal-weekdays", "aria-hidden": "true" }, ...["s", "m", "t", "w", "t", "f", "s"].map((d) => el("span", { text: d }))),
      grid,
      el("div", { class: "btn-row" },
        el("button", { type: "button", class: "pill solid", text: "today", onclick: () => done(today) }),
        clearable ? el("button", { type: "button", class: "pill", text: "no date", onclick: () => done("") }) : null),
    ], undefined, ".dp-day[aria-pressed=true], .dp-day.today");
  };

  // ---------- Upgrade native controls ----------
  // <select data-themed>: hidden select stays the source of truth; a button shows the value and opens RM.choose.
  const syncers = [];

  function themedSelect(select) {
    const labelEl = select.getAttribute("aria-labelledby") && document.getElementById(select.getAttribute("aria-labelledby"));
    const title = select.dataset.title || labelEl?.textContent || select.getAttribute("aria-label") || "choose";
    const text = el("span");
    const btn = el("button", { type: "button", class: `field-btn ${select.dataset.themed || ""}`, "aria-haspopup": "dialog" }, text, RM.icon("next", "chev"));
    select.classList.add("visually-hidden");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    select.after(btn);

    const sync = () => {
      const opt = select.options[select.selectedIndex];
      text.textContent = opt ? opt.textContent : "";
      btn.setAttribute("aria-label", `${title}: ${text.textContent}`);
    };
    btn.addEventListener("click", async () => {
      const v = await RM.choose(title, [...select.options].map((o) => ({ value: o.value, label: o.textContent })), select.value);
      if (v === undefined || v === select.value) return;
      select.value = v;
      sync();
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    sync();
    syncers.push(sync);
  }

  // <input type="date" data-themed>: becomes a hidden input plus a button that opens RM.pickDate.
  function themedDate(input) {
    const clearable = input.dataset.clearable !== "false";
    input.type = "hidden";
    const text = el("span");
    const btn = el("button", { type: "button", class: "field-btn wide", "aria-haspopup": "dialog" }, text, RM.icon("calendar", "chev"));
    input.after(btn);
    const sync = () => {
      text.textContent = RM.isIso(input.value) ? RM.formatDate(input.value, { weekday: "short", month: "long", day: "numeric", year: "numeric" }) : "no date";
      text.classList.toggle("placeholder", !RM.isIso(input.value));
      btn.setAttribute("aria-label", `date: ${text.textContent}. change`);
    };
    btn.addEventListener("click", async () => {
      const v = await RM.pickDate(input.value, { clearable });
      if (v === undefined || v === input.value) return;
      input.value = v;
      sync();
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    sync();
    syncers.push(sync);
  }

  document.querySelectorAll("select[data-themed]").forEach(themedSelect);
  document.querySelectorAll('input[type="date"][data-themed]').forEach(themedDate);

  // Call after setting .value from code, so the buttons show the new value.
  RM.syncFields = () => syncers.forEach((s) => s());
  RM.onRender(RM.syncFields);
})();
