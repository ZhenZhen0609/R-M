// Daily check-in, day sheet, therapist prep and comfort shelf.
(() => {
  "use strict";
  const { $, el, state, MOODS, GOOD_THINGS } = RM;
  const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  const MOOD_REPLIES = {
    1: "thank you for telling me. hard days count too. go gentle.",
    2: "thanks for checking in. one small kind thing is enough today.",
    3: "okay is okay. thanks for checking in.",
    4: "glad to hear. if something helped, note it below.",
    5: "lovely. keep this one in your pocket.",
  };

  // Small lines at the bottom of Today. Same one all day, changes daily.
  const SIGNS = [
    "sun rise every day. small step still step forward.",
    "rest is also doing something.",
    "you don't have to feel better to be doing better.",
    "one page counts. one breath counts.",
    "be as kind to you as you are to others.",
    "slow days are still days.",
    "you showed up. that's the hard part.",
  ];

  // ---------- Reusable check-in form (Today and the day sheet) ----------
  // Built once per date and updated in place, so saving never steals focus mid-typing.
  function checkinForm(date) {
    const prefix = `ci-${date}`;
    const extras = new Set(Object.values(state.checkins).flatMap((c) => c.goods).filter((g) => !GOOD_THINGS.includes(g)).slice(-8));

    const moodButtons = Object.entries(MOODS).map(([k, m]) => el("button", {
      type: "button", class: "mood", "aria-pressed": "false", "data-mood": k,
      onclick: () => RM.setCheckin(date, { mood: RM.getCheckin(date).mood === Number(k) ? 0 : Number(k) }),
    }, RM.icon(`mood${k}`), el("span", { text: m.label })));

    const reply = el("p", { class: "reply", "aria-live": "polite" });
    const goodsWrap = el("div", { class: "goods", role: "group", "aria-labelledby": `${prefix}-goods` });

    const customInput = el("input", { type: "text", maxlength: "60", placeholder: "something else…", "aria-label": "Add your own small good thing", class: "inline-input" });
    const addCustom = () => {
      const text = customInput.value.trim().toLowerCase();
      if (!text) { customInput.focus(); return; }
      extras.add(text);
      customInput.value = "";
      const goods = RM.getCheckin(date).goods;
      RM.setCheckin(date, { goods: goods.includes(text) ? goods : [...goods, text] });
    };
    customInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } });

    const note = el("textarea", { id: `${prefix}-note`, rows: "2", maxlength: "2000", placeholder: "anything on your mind? optional." });
    let timer;
    const saveNote = () => { clearTimeout(timer); if (note.value.trim() !== RM.getCheckin(date).note) RM.setCheckin(date, { note: note.value }); };
    note.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(saveNote, 700); });
    note.addEventListener("blur", saveNote);

    const root = el("div", { class: "checkin" },
      el("div", { class: "moods", role: "group", "aria-label": "Mood" }, ...moodButtons),
      reply,
      el("h2", { id: `${prefix}-goods`, class: "label", text: "small good things" }),
      goodsWrap,
      el("div", { class: "line-form" }, customInput, el("button", { type: "button", class: "pill", text: "add", onclick: addCustom })),
      el("label", { class: "label", for: `${prefix}-note`, text: "a note" }),
      note,
    );

    let goodsKey = "";
    function update() {
      const c = RM.getCheckin(date);
      for (const b of moodButtons) b.setAttribute("aria-pressed", String(Number(b.dataset.mood) === c.mood));
      reply.textContent = c.mood ? MOOD_REPLIES[c.mood] : "";

      for (const g of c.goods) if (!GOOD_THINGS.includes(g)) extras.add(g);
      const labels = [...GOOD_THINGS, ...extras];
      if (labels.join("|") !== goodsKey) {
        goodsKey = labels.join("|");
        goodsWrap.replaceChildren(...labels.map((g) => el("button", {
          type: "button", class: "good", "aria-pressed": "false", "data-good": g, text: g,
          onclick: () => {
            const goods = RM.getCheckin(date).goods;
            RM.setCheckin(date, { goods: goods.includes(g) ? goods.filter((x) => x !== g) : [...goods, g] });
          },
        })));
      }
      for (const b of goodsWrap.children) b.setAttribute("aria-pressed", String(c.goods.includes(b.dataset.good)));
      if (document.activeElement !== note) note.value = c.note;
    }
    update();
    return { root, update, flush: saveNote };
  }

  // ---------- Day sheet (calendar) ----------
  const sheet = $("#checkin-dialog");
  let sheetForm = null;
  let sheetDate = "";
  RM.openDaySheet = (date) => {
    sheetDate = date;
    $("#checkin-title").textContent = date === RM.todayIso()
      ? "today" : RM.formatDate(date, { weekday: "long", month: "long", day: "numeric" });
    sheetForm = checkinForm(date);
    $("#checkin-body").replaceChildren(sheetForm.root);
    renderSheetItems();
    sheet.showModal();
  };
  function renderSheetItems() {
    if (!sheetDate) return;
    const items = state.items.filter((it) => it.date === sheetDate);
    $("#checkin-items").replaceChildren(...(items.length
      ? [el("h2", { class: "label", text: "on this day" }), el("ul", { class: "entries" }, ...items.map(RM.itemRow))]
      : []));
  }
  sheet.addEventListener("close", () => { sheetForm?.flush(); sheetForm = null; sheetDate = ""; });
  $("#checkin-done").addEventListener("click", () => sheet.close());
  $("#checkin-add-item").addEventListener("click", () => {
    const d = sheetDate;
    sheet.close();
    RM.openItemDialog(null, { date: d, status: "done" });
  });

  // ---------- Thoughts ----------
  for (const form of document.querySelectorAll(".thought-form")) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const t = RM.clean.thought({ text: form.elements.thought.value });
      if (!t) { form.elements.thought.focus(); return; }
      state.thoughts.push(t);
      form.elements.thought.value = "";
      RM.commit("thoughts");
      RM.announce("saved for your next session.");
    });
  }

  // ---------- Session dates ----------
  const sessionDay = () => state.settings.sessionDay;
  const nextSession = (iso) => RM.addDays(iso, (sessionDay() - RM.parseIso(iso).getDay() + 7) % 7);
  const lastSession = (iso) => RM.addDays(iso, -((RM.parseIso(iso).getDay() - sessionDay() + 7) % 7));
  const latestNotes = () => [...state.sessions].sort((a, b) => b.date.localeCompare(a.date))[0];

  function greeting() {
    const h = new Date().getHours();
    const part = h < 5 ? "hi" : h < 12 ? "good morning" : h < 18 ? "good afternoon" : "good evening";
    const name = state.settings.name;
    return name ? `${part}, ${name.toLowerCase()}.` : `${part}.`;
  }

  // ---------- Today ----------
  let todayForm = null;
  let todayDate = "";

  function renderToday() {
    const today = RM.todayIso();
    if (today !== todayDate) {
      todayDate = today;
      todayForm = checkinForm(today);
      $("#today-checkin").replaceChildren(todayForm.root);
      $("#today-sign").textContent = SIGNS[Math.floor(RM.parseIso(today).getTime() / 864e5) % SIGNS.length];
    } else {
      todayForm.update();
    }
    const h = new Date().getHours();
    const art = h >= 19 || h < 5 ? "moon" : "sunrise";
    const hero = $("#today-art");
    if (hero.dataset.current !== art) { hero.dataset.current = art; hero.replaceChildren(RM.art(art)); }

    $("#today-hello").replaceChildren(greeting(), el("br"), "how are you today?");
    $("#today-date").textContent = RM.formatDate(today, { weekday: "long", month: "long", day: "numeric" });

    const mood = RM.getCheckin(today).mood;
    const sugg = $("#today-suggestion");
    sugg.hidden = !(mood && mood <= 2);
    if (!sugg.hidden && !sugg.dataset.shown) { sugg.dataset.shown = "1"; showSuggestion($("#today-suggestion-text")); }

    const s = latestNotes();
    $("#today-session").hidden = !s;
    if (s) {
      $("#today-session-notes").textContent = s.notes;
      $("#today-session-date").textContent = `from ${RM.formatDate(s.date, { month: "long", day: "numeric" })}`;
    }

    const next = nextSession(today);
    const open = state.thoughts.filter((t) => !t.done).length;
    $("#today-session-hint").textContent = (next === today ? "your session is today." : `next session: ${RM.formatDate(next, { weekday: "long", month: "short", day: "numeric" })}.`) +
      (open ? ` ${open} thing${open === 1 ? "" : "s"} saved.` : "");
    document.querySelectorAll(".session-day-name").forEach((n) => { n.textContent = next === today ? "today" : DAY_NAMES[sessionDay()]; });
  }

  // ---------- Therapist ----------
  function renderTherapist() {
    const today = RM.todayIso();
    const session = nextSession(today);
    const weekStart = RM.addDays(session, -6);
    const days = Array.from({ length: 7 }, (_, i) => RM.addDays(weekStart, i));

    $("#ther-heading").textContent = session === today ? "your session is today." : `next session,\n${DAY_NAMES[sessionDay()]}.`;
    $("#ther-sub").textContent = RM.formatDate(session, { weekday: "long", month: "long", day: "numeric" });

    $("#week-strip").replaceChildren(...days.map((d) => {
      const c = state.checkins[d];
      const future = d > today;
      return el("li", { class: `wd${future ? " future" : ""}${d === today ? " today" : ""}` },
        el("span", { class: "wd-name", text: RM.formatDate(d, { weekday: "short" }) }),
        c?.mood ? RM.icon(`mood${c.mood}`) : el("span", { class: "wd-none", "aria-hidden": "true", text: future ? "" : "·" }),
        el("span", { class: "visually-hidden", text: c?.mood ? MOODS[c.mood].label : future ? "upcoming" : "no check-in" }),
      );
    }));

    const weekCheckins = days.map((d) => state.checkins[d]).filter(Boolean);
    const counts = {};
    for (const c of weekCheckins) for (const g of c.goods) counts[g] = (counts[g] || 0) + 1;
    const goods = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const finished = state.items.filter((it) => it.date >= weekStart && it.date <= session && it.status === "done");
    const notes = weekCheckins.filter((c) => c.note);

    const moodDays = weekCheckins.filter((c) => c.mood);
    const avg = (a) => a.reduce((s, c) => s + c.mood, 0) / a.length;
    const helped = goods.map(([g]) => {
      const withG = moodDays.filter((c) => c.goods.includes(g));
      const without = moodDays.filter((c) => !c.goods.includes(g));
      return withG.length >= 2 && without.length && avg(withG) - avg(without) >= 0.5 ? g : null;
    }).filter(Boolean);

    const sec = [];
    const past = days.filter((d) => d <= today).length;
    sec.push(el("p", { class: "small", text: weekCheckins.length
      ? `you checked in on ${weekCheckins.length} of ${past} day${past === 1 ? "" : "s"} so far.`
      : "no check-ins yet this week. that's okay. you can still jot things down below." }));
    if (helped.length) sec.push(el("p", { class: "big-line", text: `your mood tended to be a bit better on days you ${helped.join(", ")}.` }));
    if (goods.length) sec.push(el("h3", { class: "sublabel", text: "small good things" }),
      el("ul", { class: "lines" }, ...goods.map(([g, n]) => el("li", {}, el("span", { text: g }), n > 1 ? el("span", { class: "muted", text: `${n} days` }) : null))));
    if (finished.length) sec.push(el("h3", { class: "sublabel", text: "finished this week" }),
      el("ul", { class: "lines" }, ...finished.map((it) => el("li", {}, RM.icon(it.type, "tiny"), el("span", { text: it.title })))));
    if (notes.length) sec.push(el("h3", { class: "sublabel", text: "your notes" }),
      el("ul", { class: "lines notes" }, ...notes.map((c) => el("li", {},
        el("span", { class: "muted", text: RM.formatDate(c.date, { weekday: "short" }) }), el("span", { text: c.note })))));
    $("#week-details").replaceChildren(...sec);

    const open = state.thoughts.filter((t) => !t.done);
    const done = state.thoughts.filter((t) => t.done);
    $("#thought-list").replaceChildren(...(open.length ? open.map(thoughtRow)
      : [el("li", { class: "muted", text: "nothing yet. when something comes up, add it here so it's not lost." })]));
    $("#discussed").hidden = !done.length;
    $("#discussed-count").textContent = String(done.length);
    $("#discussed-list").replaceChildren(...done.map(thoughtRow));

    const sf = $("#session-form");
    if (!sf.elements.date.value) {
      sf.elements.date.value = lastSession(today);
      sf.elements.notes.value = state.sessions.find((s) => s.date === sf.elements.date.value)?.notes || "";
    }
    const pastSessions = [...state.sessions].sort((a, b) => b.date.localeCompare(a.date));
    $("#past-sessions").hidden = !pastSessions.length;
    $("#past-sessions-list").replaceChildren(...pastSessions.map((s) => el("li", {},
      el("span", { class: "muted", text: RM.formatDate(s.date) }), el("span", { class: "pre", text: s.notes }))));
  }

  function thoughtRow(t) {
    const cbId = `thought-${t.id}`;
    return el("li", { class: `thought${t.done ? " done" : ""}` },
      el("input", { type: "checkbox", id: cbId, class: "tick", checked: t.done, onchange: (e) => { t.done = e.target.checked; RM.commit("thoughts"); } }),
      el("label", { for: cbId, text: t.text }),
      el("button", {
        type: "button", class: "icon-btn small-btn", "aria-label": `Remove: ${t.text}`,
        onclick: () => { state.thoughts = state.thoughts.filter((x) => x.id !== t.id); RM.commit("thoughts"); },
      }, RM.icon("close")),
    );
  }

  $("#clear-discussed").addEventListener("click", () => {
    RM.confirm("everything you've ticked as talked about will be removed.", { ok: "clear", title: "clear these?" }).then((yes) => {
      if (!yes) return;
      state.thoughts = state.thoughts.filter((t) => !t.done);
      RM.commit("thoughts");
    });
  });

  const sessionForm = $("#session-form");
  sessionForm.elements.date.addEventListener("change", () => {
    sessionForm.elements.notes.value = state.sessions.find((s) => s.date === sessionForm.elements.date.value)?.notes || "";
  });
  sessionForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const date = sessionForm.elements.date.value;
    if (!RM.isIso(date)) return;
    const s = RM.clean.session({ date, notes: sessionForm.elements.notes.value });
    state.sessions = state.sessions.filter((x) => x.date !== date);
    if (s) state.sessions.push(s);
    RM.commit("sessions");
    RM.announce(s ? "session notes saved." : "session notes cleared.");
  });

  $("#copy-summary").addEventListener("click", async () => {
    const strip = [...$("#week-strip").children].map((li) => `${li.querySelector(".wd-name").textContent}: ${li.querySelector(".visually-hidden").textContent}`).join("\n");
    const open = state.thoughts.filter((t) => !t.done).map((t) => `- ${t.text}`).join("\n");
    const text = `${$("#ther-heading").textContent.replace("\n", " ")} (${$("#ther-sub").textContent})\n\n${strip}\n\n${$("#week-details").innerText}` +
      (open ? `\n\nto bring up:\n${open}` : "");
    try {
      await navigator.clipboard.writeText(text);
      RM.announce("summary copied.");
    } catch {
      RM.announce("couldn't copy on this device.");
    }
  });

  // ---------- Comfort ----------
  function comfortPool() {
    return [
      ...state.items.filter((it) => it.comfort).map((it) => `${it.type === "book" ? "read" : "watch"} ${it.title}`),
      ...state.activities.map((a) => a.text),
    ];
  }
  let lastPick = "";
  function showSuggestion(target) {
    const pool = comfortPool();
    if (!pool.length) { target.textContent = "your comfort shelf is empty. add a few things there when you feel up to it."; return; }
    const options = pool.length > 1 ? pool.filter((p) => p !== lastPick) : pool;
    lastPick = options[Math.floor(Math.random() * options.length)];
    target.textContent = lastPick.toLowerCase() + ".";
  }
  $("#pick-btn").addEventListener("click", () => showSuggestion($("#pick-result")));
  $("#today-suggestion-another").addEventListener("click", () => showSuggestion($("#today-suggestion-text")));

  function renderComfort() {
    const items = state.items.filter((it) => it.comfort);
    $("#comfort-items").replaceChildren(...(items.length ? items.map(RM.itemRow)
      : [el("li", { class: "empty", text: "none yet. open any book or movie and turn on \"on my comfort shelf\"." })]));
    $("#activity-list").replaceChildren(...state.activities.map((a) => el("li", { class: "thought" },
      RM.icon("leaf", "tiny"),
      el("span", { text: a.text }),
      el("button", {
        type: "button", class: "icon-btn small-btn", "aria-label": `Remove: ${a.text}`,
        onclick: () => { state.activities = state.activities.filter((x) => x.id !== a.id); RM.commit("activities"); },
      }, RM.icon("close")),
    )));
  }
  $("#activity-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const a = RM.clean.activity({ text: e.target.elements.activity.value.toLowerCase() });
    if (!a) return;
    state.activities.push(a);
    e.target.reset();
    RM.commit("activities");
  });

  RM.onRender(() => { sheetForm?.update(); renderSheetItems(); });
  RM.onRender(renderToday);
  RM.onRender(renderTherapist);
  RM.onRender(renderComfort);
})();
