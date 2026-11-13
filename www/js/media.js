// Calendar, library (books + movies) and the add/edit entry sheet.
(() => {
  "use strict";
  const { $, el, state, LABELS, MOODS } = RM;
  const MONTHS = ["january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"];

  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();

  function starsEl(rating) {
    const span = el("span", { class: "stars", role: "img", "aria-label": rating ? `${rating} out of 5 stars` : "not rated" });
    for (let i = 1; i <= 5; i++) span.append(RM.icon("star", i <= rating ? "on" : "off"));
    return span;
  }

  // ---------- Calendar ----------
  function renderCalendar() {
    $("#month-label").textContent = `${MONTHS[viewMonth]} ${viewYear}`;

    const itemsByDate = new Map();
    for (const it of state.items) {
      if (!it.date) continue;
      if (!itemsByDate.has(it.date)) itemsByDate.set(it.date, []);
      itemsByDate.get(it.date).push(it);
    }

    const grid = $("#cal-grid");
    grid.replaceChildren();
    const first = new Date(viewYear, viewMonth, 1);
    const todayIso = RM.todayIso();

    for (let i = 0; i < 42; i++) {
      const d = new Date(viewYear, viewMonth, 1 - first.getDay() + i);
      const iso = RM.isoDate(d);
      const outside = d.getMonth() !== viewMonth;
      if (i === 35 && outside) break;
      if (outside) { grid.append(el("span", { class: "cal-day empty", "aria-hidden": "true" })); continue; }

      const dayItems = itemsByDate.get(iso) || [];
      const mood = state.checkins[iso]?.mood || 0;
      const showFace = mood && state.settings.showMoodFaces;
      const books = dayItems.filter((x) => x.type === "book").length;
      const movies = dayItems.length - books;

      const desc = [RM.formatDate(iso, { weekday: "long", month: "long", day: "numeric" })];
      if (mood) desc.push(`mood ${MOODS[mood].label}`);
      if (dayItems.length) desc.push(dayItems.map((x) => x.title).join(", "));

      const cell = el("button", {
        type: "button",
        class: `cal-day${iso === todayIso ? " today" : ""}${iso > todayIso ? " future" : ""}`,
        "aria-label": desc.join(". "),
        onclick: () => RM.openDaySheet(iso),
      }, el("span", { class: "num", text: String(d.getDate()) }));

      cell.append(showFace ? RM.icon(`mood${mood}`, "face") : el("span", { class: "face-space" }));
      const marks = el("span", { class: "marks", "aria-hidden": "true" });
      if (books) marks.append(RM.icon("book"));
      if (movies) marks.append(RM.icon("movie"));
      cell.append(marks);
      grid.append(cell);
    }
    renderSummary();
  }

  function renderSummary() {
    const prefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
    const monthItems = state.items.filter((it) => it.date.startsWith(prefix));
    const books = monthItems.filter((it) => it.type === "book").length;
    const movies = monthItems.length - books;
    const checkins = Object.values(state.checkins).filter((c) => c.date.startsWith(prefix));
    const goods = checkins.reduce((n, c) => n + c.goods.length, 0);
    const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

    const parts = [];
    if (checkins.length) parts.push(plural(checkins.length, "check-in"));
    if (goods) parts.push(plural(goods, "small good thing"));
    if (books) parts.push(plural(books, "book"));
    if (movies) parts.push(plural(movies, "movie"));
    $("#month-summary").textContent = parts.length ? parts.join(" · ") : "nothing here yet. that's okay.";
  }

  function shiftMonth(delta) {
    viewMonth += delta;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    renderCalendar();
  }
  $("#prev-month").addEventListener("click", () => shiftMonth(-1));
  $("#next-month").addEventListener("click", () => shiftMonth(1));
  $("#month-label").addEventListener("click", () => { viewYear = now.getFullYear(); viewMonth = now.getMonth(); renderCalendar(); });

  // Swipe left/right on the calendar to change month.
  let touchX = null;
  const grid = $("#cal-grid");
  grid.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  grid.addEventListener("touchend", (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 60) shiftMonth(dx < 0 ? 1 : -1);
  });

  // ---------- Library ----------
  let libType = "all";
  document.querySelectorAll("[data-filter-type]").forEach((b) => b.addEventListener("click", () => {
    libType = b.dataset.filterType;
    document.querySelectorAll("[data-filter-type]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    renderLibrary();
  }));
  $("#library-status").addEventListener("change", renderLibrary);

  function renderLibrary() {
    const status = $("#library-status").value;
    const all = state.items;
    const books = all.filter((x) => x.type === "book").length;
    $("#library-count").textContent = all.length
      ? `${books} book${books === 1 ? "" : "s"}, ${all.length - books} movie${all.length - books === 1 ? "" : "s"}.`
      : "books and movies, together.";

    const shown = all
      .filter((it) => (libType === "all" || it.type === libType) &&
        (status === "all" || (status === "comfort" ? it.comfort : it.status === status)))
      .sort((a, b) => (a.status !== b.status ? (a.status === "planned" ? -1 : 1)
        : (b.date || "").localeCompare(a.date || "") || b.createdAt - a.createdAt));

    const list = $("#library-list");
    if (!shown.length) {
      list.replaceChildren(el("li", { class: "empty" },
        all.length ? "nothing matches. try another filter." : "nothing here yet. tap + to add your first book or movie."));
      return;
    }
    list.replaceChildren(...shown.map(itemRow));
  }

  function itemRow(it) {
    const meta = [LABELS[it.type][it.status], it.creator, it.date && RM.formatDate(it.date)].filter(Boolean).join(" · ");
    return el("li", {},
      el("button", { type: "button", class: "entry", "aria-label": `${LABELS[it.type].noun}: ${it.title}. ${meta}. edit`, onclick: () => openItemDialog(it.id) },
        el("span", { class: "entry-icon" }, RM.icon(it.type)),
        el("span", { class: "entry-main" },
          el("span", { class: "entry-title" }, it.title, it.comfort ? RM.icon("comfort", "tiny") : null),
          el("span", { class: "entry-meta", text: meta }),
          it.notes ? el("span", { class: "entry-notes", text: it.notes }) : null,
        ),
        it.rating ? starsEl(it.rating) : null,
      ),
    );
  }
  RM.itemRow = itemRow;

  // ---------- Item sheet ----------
  const dialog = $("#item-dialog");
  const form = $("#item-form");
  let editingId = null;

  // Star picker: five buttons acting as a radio group, tap the current star again to clear.
  const starsRow = form.querySelector(".stars-row");
  let rating = 0;
  for (let i = 1; i <= 5; i++) {
    starsRow.append(el("button", {
      type: "button", class: "star-btn", role: "radio", "aria-label": `${i} star${i > 1 ? "s" : ""}`, "data-value": String(i),
      onclick: () => setRating(rating === i ? 0 : i),
    }, RM.icon("star")));
  }
  starsRow.setAttribute("role", "radiogroup");
  starsRow.setAttribute("aria-label", "Rating, tap again to clear");
  function setRating(v) {
    rating = v;
    starsRow.querySelectorAll(".star-btn").forEach((b) => {
      const n = Number(b.dataset.value);
      b.classList.toggle("on", n <= v);
      b.setAttribute("aria-checked", String(n === v));
    });
  }

  function updateTypeLabels() {
    const type = form.elements.type.value;
    $("#creator-label").textContent = LABELS[type].creator;
    $("#status-planned").textContent = LABELS[type].planned;
    $("#status-done").textContent = LABELS[type].done;
  }

  function openItemDialog(id, defaults = {}) {
    editingId = id;
    const it = id ? state.items.find((x) => x.id === id) : null;
    const data = it || {
      type: "book", title: "", creator: "", status: "planned", date: "", rating: 0, notes: "", comfort: false, ...defaults,
    };
    form.reset(); // note: hidden inputs (the themed date) aren't reset, so it's set explicitly below
    const f = form.elements;
    f.type.value = data.type;
    f.title.value = data.title;
    f.creator.value = data.creator;
    f.status.value = data.status;
    f.date.value = data.date;
    f.comfort.checked = data.comfort;
    f.notes.value = data.notes;
    setRating(data.rating || 0);
    $("#form-error").textContent = "";
    $("#dialog-title").textContent = it ? "edit" : "add to library";
    $("#delete-btn").hidden = !it;
    updateTypeLabels();
    RM.syncFields();
    dialog.showModal();
    if (!it) f.title.focus();
  }
  RM.openItemDialog = openItemDialog;

  form.addEventListener("change", (e) => {
    if (e.target.name === "type") updateTypeLabels();
    if (e.target.name === "status" && e.target.value === "done" && !form.elements.date.value) {
      form.elements.date.value = RM.todayIso();
      RM.syncFields();
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = form.elements;
    const prev = state.items.find((x) => x.id === editingId);
    const entry = RM.clean.item({
      id: editingId || RM.newId(), type: f.type.value, title: f.title.value, creator: f.creator.value,
      status: f.status.value, date: f.date.value, rating, notes: f.notes.value,
      comfort: f.comfort.checked, createdAt: prev?.createdAt ?? Date.now(),
    });
    if (!entry) {
      $("#form-error").textContent = "please add a title.";
      f.title.focus();
      return;
    }
    const idx = state.items.findIndex((x) => x.id === entry.id);
    if (idx >= 0) state.items[idx] = entry; else state.items.push(entry);
    if (entry.date) { const d = RM.parseIso(entry.date); viewYear = d.getFullYear(); viewMonth = d.getMonth(); }
    dialog.close();
    RM.commit("items");
    RM.announce(prev ? "saved." : "added to your library.");
  });

  $("#cancel-btn").addEventListener("click", () => dialog.close());
  $("#delete-btn").addEventListener("click", () => {
    const it = state.items.find((x) => x.id === editingId);
    if (!it) return;
    const id = editingId;
    dialog.close();
    RM.confirm(`"${it.title}" will be removed from your library.`, { ok: "delete", title: "delete this?" }).then((yes) => {
      if (!yes) { openItemDialog(id); return; }
      state.items = state.items.filter((x) => x.id !== id);
      RM.commit("items");
      RM.announce("deleted.");
    });
  });
  $("#add-btn").addEventListener("click", () => openItemDialog(null));

  RM.onRender(renderCalendar);
  RM.onRender(renderLibrary);
})();
