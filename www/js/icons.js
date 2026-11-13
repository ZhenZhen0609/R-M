// Hand-drawn line icons and illustrations. All strokes use currentColor, so they follow the theme ink.
(() => {
  "use strict";

  const head = '<path d="M20 4 C30 4 36 11 36 20 C36 30 29 36 20 36 C10 36 4 29 4 20 C4 10 11 4 20 4"/>';
  const eyes = '<circle class="fill" cx="14" cy="16" r="1.6"/><circle class="fill" cx="26" cy="16" r="1.6"/>';

  const ICONS = {
    // Mood faces (1..5)
    mood1: head + '<path d="M10 15 L16 13"/><path d="M30 15 L24 13"/>' + eyes + '<path d="M13 28 C16 24 24 24 27 28"/>',
    mood2: head + eyes + '<path d="M14 27 C17 25 23 25 26 27"/>',
    mood3: head + eyes + '<path d="M14 26 L26 26"/>',
    mood4: head + eyes + '<path d="M13 24 C16 28 24 28 27 24"/>',
    mood5: head + '<path d="M11 17 C13 14 16 14 17 17"/><path d="M23 17 C24 14 27 14 29 17"/><path d="M12 23 C15 30 25 30 28 23 Z"/>',

    // Navigation
    today: '<path d="M8 30 C14 27 26 27 32 30"/><path d="M12 27 C12 19 16 15 20 15 C25 15 28 19 28 27"/><path d="M20 10 L20 5"/><path d="M29 13 L32 10"/><path d="M11 13 L8 10"/>',
    calendar: '<path d="M7 10 L33 9 L32 33 L8 32 Z"/><path d="M7 16 L33 16"/><path d="M14 6 L14 12"/><path d="M26 6 L26 12"/>',
    therapist: '<path d="M6 12 C6 8 9 6 13 6 L28 6 C32 6 34 9 34 12 L34 21 C34 25 31 27 28 27 L16 27 L9 33 L10 27 C7 26 6 24 6 21 Z"/>',
    comfort: '<path d="M20 33 C11 26 5 20 6 13 C7 8 12 6 16 8 C18 9 19 10 20 12 C21 10 22 9 24 8 C28 6 33 8 34 13 C35 20 29 26 20 33"/>',
    library: '<path d="M20 11 C15 8 10 8 5 9 L5 31 C10 30 15 30 20 33 Z"/><path d="M20 11 C25 8 30 8 35 9 L35 31 C30 30 25 30 20 33"/>',

    // Small icons
    book: '<path d="M20 11 C15 8 10 8 5 9 L5 31 C10 30 15 30 20 33 Z"/><path d="M20 11 C25 8 30 8 35 9 L35 31 C30 30 25 30 20 33"/>',
    movie: '<path d="M6 15 L34 15 L33 33 L7 33 Z"/><path d="M6 15 L32 7 L34 13"/><path d="M13 13 L17 8"/><path d="M21 11 L25 6"/>',
    plus: '<path d="M20 8 C20 16 20 24 20.5 32"/><path d="M8 20 C16 19.5 24 20 32 20.5"/>',
    back: '<path d="M25 8 C19 13 15 17 13 20 C16 24 20 28 25 32"/>',
    next: '<path d="M15 8 C21 13 25 17 27 20 C24 24 20 28 15 32"/>',
    close: '<path d="M10 10 C17 17 23 23 30 30"/><path d="M30 10 C23 17 17 23 10 30"/>',
    star: '<path d="M20 5 L24 15 L35 16 L27 23 L29 34 L20 28 L11 34 L13 23 L5 16 L16 15 Z"/>',
    leaf: '<path d="M8 32 C8 18 18 8 33 7 C33 22 23 32 8 32 Z"/><path d="M8 32 C14 25 20 19 26 14"/>',
    sprout: '<path d="M20 34 L20 18"/><path d="M20 20 C13 20 8 15 8 9 C15 9 20 13 20 20"/><path d="M20 18 C27 18 32 13 32 8 C25 8 20 12 20 18"/>',
    phone: '<path d="M10 6 L16 6 L18 13 L14 16 C16 21 19 24 24 26 L27 22 L34 24 L34 30 C34 33 31 35 28 34 C17 31 9 23 6 12 C5 9 7 6 10 6 Z"/>',
    shuffle: '<path d="M5 28 C14 28 18 12 28 12 L34 12"/><path d="M30 7 L35 12 L30 17"/><path d="M5 12 C10 12 13 15 15 18"/><path d="M21 23 C23 26 25 28 34 28"/><path d="M30 23 L35 28 L30 33"/>',
    check: '<path d="M8 21 C11 24 14 27 16 30 C21 21 26 14 33 8"/>',
    trash: '<path d="M8 11 L32 11"/><path d="M16 11 L16 6 L24 6 L24 11"/><path d="M10 11 L12 34 L28 34 L30 11"/>',
    copy: '<path d="M13 13 L33 13 L33 34 L13 34 Z"/><path d="M8 27 L7 6 L27 6 L27 9"/>',
  };

  // Bigger illustrations for page headers.
  const ART = {
    sunrise: { vb: "0 0 200 120", d: '<path d="M18 104 C60 92 140 90 184 102"/><path d="M58 96 C60 66 82 50 104 50 C128 50 144 70 148 95"/><path d="M102 38 L101 14"/><path d="M134 46 L150 26"/><path d="M68 46 L54 28"/><path d="M156 68 L178 60"/><path d="M48 70 L26 62"/>' },
    moon: { vb: "0 0 200 120", d: '<path d="M112 18 C88 24 76 46 82 68 C88 90 112 102 134 96 C116 92 100 78 98 58 C96 40 102 26 112 18 Z"/><path d="M150 30 L150 40"/><path d="M145 35 L155 35"/><path d="M60 40 L60 48"/><path d="M56 44 L64 44"/><path d="M164 70 L164 76"/><path d="M161 73 L167 73"/>' },
    talk: { vb: "0 0 200 120", d: '<path d="M30 30 C30 22 36 18 44 18 L104 18 C112 18 118 22 118 30 L118 60 C118 68 112 72 104 72 L60 72 L42 88 L44 72 C36 71 30 67 30 60 Z"/><path d="M130 46 L158 46 C166 46 172 51 172 58 L172 82 C172 89 166 94 158 94 L156 94 L158 106 L144 94 L120 94 C112 94 108 89 108 84"/><path d="M50 40 L96 40"/><path d="M50 52 L84 52"/>' },
    cup: { vb: "0 0 200 120", d: '<path d="M62 52 L136 52 L130 96 C129 104 122 108 114 108 L84 108 C76 108 69 104 68 96 Z"/><path d="M136 62 C150 60 156 70 150 80 C146 86 138 88 132 86"/><path d="M84 40 C78 32 90 26 84 16"/><path d="M100 40 C94 32 106 26 100 16"/><path d="M116 40 C110 32 122 26 116 16"/><path d="M44 112 C80 108 120 108 156 112"/>' },
    books: { vb: "0 0 200 120", d: '<path d="M40 104 L160 104"/><path d="M52 104 L52 40 L72 40 L72 104"/><path d="M76 104 L76 28 L94 28 L94 104"/><path d="M58 52 L66 52"/><path d="M80 40 L90 40"/><path d="M100 104 L114 38 L132 42 L120 106"/><path d="M138 104 L138 56 C138 50 154 50 154 56 L154 104"/><path d="M138 66 L154 66"/>' },
    plant: { vb: "0 0 200 120", d: '<path d="M100 24 C92 16 82 22 88 32 C80 30 76 42 86 44 C80 50 90 58 96 50 C98 60 110 58 108 48 C116 54 124 44 116 40 C126 36 120 24 112 28 C114 18 102 16 100 24 Z"/><circle cx="100" cy="38" r="4"/><path d="M100 50 C98 66 106 78 100 92"/><path d="M40 92 C80 90 120 90 162 93"/><path d="M100 92 C96 100 86 104 80 112"/><path d="M100 92 C108 98 116 102 124 110"/><path d="M98 96 L90 100"/>' },
  };

  const svg = (inner, vb, cls) =>
    `<svg class="draw${cls ? " " + cls : ""}" viewBox="${vb}" aria-hidden="true" focusable="false">${inner}</svg>`;

  RM.icon = (name, cls) => {
    const tpl = document.createElement("template");
    tpl.innerHTML = svg(ICONS[name] || "", "0 0 40 40", cls);
    return tpl.content.firstChild;
  };
  RM.art = (name, cls) => {
    const a = ART[name];
    const tpl = document.createElement("template");
    tpl.innerHTML = svg(a ? a.d : "", a ? a.vb : "0 0 200 120", "art" + (cls ? " " + cls : ""));
    return tpl.content.firstChild;
  };

  // Static markup can ask for icons with data attributes.
  RM.hydrateIcons = (root = document) => {
    root.querySelectorAll("[data-icon]").forEach((n) => { if (!n.firstChild || n.dataset.iconFill === "1") { n.replaceChildren(RM.icon(n.dataset.icon)); } });
    root.querySelectorAll("[data-art]").forEach((n) => n.replaceChildren(RM.art(n.dataset.art)));
  };
})();
