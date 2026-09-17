/* ============================================================
   Atomia — Element Explorer
   Vanilla JS, no build step, works fully offline as a PWA.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Category metadata ---------- */
  var CATS = [
    { key: "alkali-metal", label: "Alkali metals", desc: "Super-reactive metals in the first column. They react violently with water and are never found alone in nature." },
    { key: "alkaline-earth", label: "Alkaline earth", desc: "Reactive shiny metals in the second column — found in bones, fireworks, and chalk." },
    { key: "transition-metal", label: "Transition metals", desc: "The big middle block of sturdy, shiny metals — iron, gold, copper, and most metals you use every day." },
    { key: "post-transition-metal", label: "Post-transition", desc: "Softer, weaker metals like aluminum, tin, and lead — not as tough as the transition metals." },
    { key: "metalloid", label: "Metalloids", desc: "In-between elements that act part metal, part nonmetal — like silicon, used in computer chips." },
    { key: "nonmetal", label: "Nonmetals", desc: "Elements essential for life, like carbon, nitrogen, and phosphorus — usually gases or dull solids." },
    { key: "halogen", label: "Halogens", desc: "Very reactive nonmetals used in things like toothpaste (fluorine) and pool cleaner (chlorine)." },
    { key: "noble-gas", label: "Noble gases", desc: "Elements that barely react with anything else — used to fill balloons and glowing signs." },
    { key: "lanthanide", label: "Lanthanides", desc: "Rare-earth metals used in magnets, lasers, and the screen you might be reading this on." },
    { key: "actinide", label: "Actinides", desc: "Heavy elements, many of them radioactive, like uranium and plutonium — used in energy and research." }
  ];
  var CAT_LABEL = {}, CAT_DESC = {};
  CATS.forEach(function (c) { CAT_LABEL[c.key] = c.label; CAT_DESC[c.key] = c.desc; });

  function catColor(key) {
    return getComputedStyle(document.documentElement).getPropertyValue("--" + key).trim();
  }

  /* ---------- Storage ---------- */
  var STORE_KEY = "atomia_v1";
  function defaultStore() { return { learned: {}, quizBest: {}, quizCount: 0, fillCompleted: {} }; }
  function loadStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        return {
          learned: parsed.learned || {},
          quizBest: parsed.quizBest || {},
          quizCount: parsed.quizCount || 0,
          fillCompleted: parsed.fillCompleted || {}
        };
      }
    } catch (e) {}
    return defaultStore();
  }
  function saveStore() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) {}
  }
  var store = loadStore();

  function markLearned(num) {
    store.learned[num] = true;
    saveStore();
    updateStreakPill();
  }
  function learnedCount() { return Object.keys(store.learned).length; }

  function updateStreakPill() {
    document.getElementById("streakCount").textContent = learnedCount();
  }

  /* ---------- Generic confirm modal (replaces window.confirm, which can be blocked in embedded/sandboxed views) ---------- */
  var confirmOverlay = document.getElementById("confirmOverlay");
  var confirmResolver = null;
  function askConfirm(title, message, okLabel) {
    document.getElementById("confirmTitle").textContent = title;
    document.getElementById("confirmMessage").textContent = message;
    document.getElementById("confirmOkBtn").textContent = okLabel || "Yes, continue";
    confirmOverlay.classList.remove("hidden");
    return new Promise(function (resolve) { confirmResolver = resolve; });
  }
  function resolveConfirm(val) {
    confirmOverlay.classList.add("hidden");
    if (confirmResolver) { confirmResolver(val); confirmResolver = null; }
  }
  document.getElementById("confirmOkBtn").addEventListener("click", function () { resolveConfirm(true); });
  document.getElementById("confirmCancelBtn").addEventListener("click", function () { resolveConfirm(false); });
  confirmOverlay.addEventListener("click", function (e) { if (e.target === confirmOverlay) resolveConfirm(false); });

  /* ---------- Family Guide modal ---------- */
  var guideOverlay = document.getElementById("guideOverlay");
  function buildGuideList() {
    var list = document.getElementById("guideList");
    list.innerHTML = "";
    CATS.forEach(function (c) {
      var row = document.createElement("div");
      row.className = "guide-item";
      row.innerHTML =
        '<span class="guide-dot" style="background:' + catColor(c.key) + '"></span>' +
        '<div><div class="guide-name">' + c.label + '</div><div class="guide-desc">' + c.desc + '</div></div>';
      list.appendChild(row);
    });
  }
  function openGuide() { buildGuideList(); guideOverlay.classList.remove("hidden"); }
  function closeGuide() { guideOverlay.classList.add("hidden"); }
  document.getElementById("guideClose").addEventListener("click", closeGuide);
  guideOverlay.addEventListener("click", function (e) { if (e.target === guideOverlay) closeGuide(); });
  document.getElementById("guideLinkCards").addEventListener("click", openGuide);
  document.getElementById("guideLinkTable").addEventListener("click", openGuide);

  /* ==========================================================
     VIEW SWITCHING
     ========================================================== */
  var views = ["cards", "table", "quiz", "progress"];
  function showView(name) {
    views.forEach(function (v) {
      document.getElementById("view-" + v).classList.toggle("hidden", v !== name);
    });
    document.querySelectorAll(".nav-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.view === name);
    });
    document.body.setAttribute("data-view", name);
    if (name === "table") buildPeriodicTable();
    if (name === "progress") renderProgress();
    if (name === "quiz") { resetQuizToIntro(); renderBestScores(); }
  }
  document.querySelectorAll(".nav-btn").forEach(function (btn) {
    btn.addEventListener("click", function () { showView(btn.dataset.view); });
  });
  document.getElementById("streakBtn").addEventListener("click", function () { showView("progress"); });

  /* ==========================================================
     FLASHCARDS
     ========================================================== */
  var deck = ELEMENTS.slice();
  var activeFilter = "all";
  var deckIndex = 0;

  function buildChips() {
    var row = document.getElementById("categoryChips");
    row.innerHTML = "";
    var allChip = makeChip("all", "All elements", null);
    row.appendChild(allChip);
    CATS.forEach(function (c) {
      row.appendChild(makeChip(c.key, c.label, catColor(c.key)));
    });
  }
  function makeChip(key, label, color) {
    var chip = document.createElement("button");
    chip.className = "chip" + (key === "all" ? " active" : "");
    chip.dataset.key = key;
    if (color) {
      var dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = color;
      chip.appendChild(dot);
    }
    var txt = document.createElement("span");
    txt.textContent = label;
    chip.appendChild(txt);
    chip.addEventListener("click", function () {
      activeFilter = key;
      document.querySelectorAll(".chip").forEach(function (c) {
        var active = c.dataset.key === key;
        c.classList.toggle("active", active);
        c.style.background = active ? (key === "all" ? "" : catColor(key)) : "";
      });
      rebuildDeck();
    });
    return chip;
  }

  function rebuildDeck(keepElement) {
    var prevNum = keepElement ? keepElement.number : (deck[deckIndex] ? deck[deckIndex].number : null);
    deck = activeFilter === "all" ? ELEMENTS.slice() : ELEMENTS.filter(function (e) { return e.category === activeFilter; });
    var idx = deck.findIndex(function (e) { return e.number === prevNum; });
    deckIndex = idx >= 0 ? idx : 0;
    renderCard();
  }

  var flipCard = document.getElementById("flipCard");
  var flipped = false;

  function renderCard() {
    if (!deck.length) return;
    var el = deck[deckIndex];
    flipped = false;
    flipCard.classList.remove("flipped");

    var color = catColor(el.category);
    document.getElementById("cardFront").style.setProperty("--cat-color", color);
    document.getElementById("cardBack").style.setProperty("--cat-color", color);

    document.getElementById("frontCat").textContent = CAT_LABEL[el.category];
    document.getElementById("frontNumber").textContent = "#" + el.number;
    document.getElementById("frontSymbol").textContent = el.symbol;
    document.getElementById("frontName").textContent = el.name;

    document.getElementById("backSymbol").textContent = el.symbol;
    document.getElementById("backName").textContent = el.name;
    document.getElementById("backMass").textContent = el.mass;
    document.getElementById("backCat").textContent = CAT_LABEL[el.category];
    document.getElementById("backPhase").textContent = el.phase;
    document.getElementById("backDiscovered").textContent = el.discovered;
    document.getElementById("backFact").textContent = "✦ " + el.fact;
    document.getElementById("backUse").textContent = "Used for: " + el.use;

    document.getElementById("deckPosition").textContent = "Element " + (deckIndex + 1) + " of " + deck.length;
    document.getElementById("deckProgress").style.width = ((deckIndex + 1) / deck.length * 100) + "%";
  }

  flipCard.addEventListener("click", function () {
    flipped = !flipped;
    flipCard.classList.toggle("flipped", flipped);
  });
  flipCard.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flipCard.click(); }
  });

  document.getElementById("prevBtn").addEventListener("click", function () {
    deckIndex = (deckIndex - 1 + deck.length) % deck.length;
    renderCard();
  });
  document.getElementById("nextBtn").addEventListener("click", function () {
    deckIndex = (deckIndex + 1) % deck.length;
    renderCard();
  });
  document.getElementById("shuffleBtn").addEventListener("click", function () {
    for (var i = deck.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    deckIndex = 0;
    renderCard();
  });
  document.getElementById("knowBtn").addEventListener("click", function () {
    markLearned(deck[deckIndex].number);
    deckIndex = (deckIndex + 1) % deck.length;
    renderCard();
  });

  // simple swipe support
  (function () {
    var startX = null;
    flipCard.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; }, { passive: true });
    flipCard.addEventListener("touchend", function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) {
        if (dx < 0) document.getElementById("nextBtn").click();
        else document.getElementById("prevBtn").click();
      }
      startX = null;
    });
  })();

  /* ==========================================================
     PERIODIC TABLE GRID (shared helpers used by Table view + Fill game)
     ========================================================== */
  function forEachGridPosition(cb) {
    for (var period = 1; period <= 7; period++) {
      for (var group = 1; group <= 18; group++) {
        cb(period, group);
      }
    }
  }
  function elementsByPosition() {
    var byPos = {}, lanth = [], actin = [];
    ELEMENTS.forEach(function (el) {
      if (el.category === "lanthanide") { lanth.push(el); return; }
      if (el.category === "actinide") { actin.push(el); return; }
      byPos[el.period + "_" + el.group] = el;
    });
    lanth.sort(function (a, b) { return a.number - b.number; });
    actin.sort(function (a, b) { return a.number - b.number; });
    return { byPos: byPos, lanth: lanth, actin: actin };
  }

  var tableBuilt = false;
  function buildPeriodicTable() {
    var grid = document.getElementById("periodicGrid");
    grid.innerHTML = "";
    var pos = elementsByPosition();

    forEachGridPosition(function (period, group) {
      if ((period === 6 || period === 7) && group === 3) {
        var cell = document.createElement("div");
        cell.className = "pt-cell range";
        cell.style.background = period === 6 ? catColor("lanthanide") : catColor("actinide");
        cell.style.gridColumn = group;
        cell.style.gridRow = period;
        cell.innerHTML = '<span class="sym">' + (period === 6 ? "57-71" : "89-103") + "</span>";
        grid.appendChild(cell);
        return;
      }
      var el = pos.byPos[period + "_" + group];
      if (el) {
        grid.appendChild(makeCell(el, group, period));
      } else {
        var spacer = document.createElement("div");
        spacer.className = "pt-cell spacer";
        spacer.style.gridColumn = group;
        spacer.style.gridRow = period;
        grid.appendChild(spacer);
      }
    });
    // spacer row 8
    for (var g = 1; g <= 18; g++) {
      var sp = document.createElement("div");
      sp.className = "pt-cell spacer";
      sp.style.gridColumn = g; sp.style.gridRow = 8;
      grid.appendChild(sp);
    }
    pos.lanth.forEach(function (el, i) { grid.appendChild(makeCell(el, 3 + i, 9)); });
    pos.actin.forEach(function (el, i) { grid.appendChild(makeCell(el, 3 + i, 10)); });

    tableBuilt = true;
    renderLegend();
  }

  function renderLegend() {
    var legend = document.getElementById("legend");
    legend.innerHTML = "";
    CATS.forEach(function (c) {
      var item = document.createElement("button");
      item.className = "legend-item";
      item.type = "button";
      item.innerHTML = '<span class="legend-dot" style="background:' + catColor(c.key) + '"></span>' + c.label;
      item.addEventListener("click", openGuide);
      legend.appendChild(item);
    });
  }

  function makeCell(el, col, row) {
    var cell = document.createElement("div");
    cell.className = "pt-cell";
    cell.style.gridColumn = col;
    cell.style.gridRow = row;
    cell.style.background = catColor(el.category);
    if (store.learned[el.number]) cell.style.boxShadow = "0 0 0 2px #fff inset";
    cell.innerHTML = '<span class="num">' + el.number + '</span><span class="sym">' + el.symbol + "</span>";
    cell.title = el.number + " · " + el.name;
    cell.addEventListener("click", function () { openModal(el); });
    return cell;
  }

  /* ---------- Modal ---------- */
  var overlay = document.getElementById("modalOverlay");
  document.getElementById("modalClose").addEventListener("click", closeModal);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) closeModal(); });
  function closeModal() { overlay.classList.add("hidden"); }

  function openModal(el) {
    var color = catColor(el.category);
    var isLearned = !!store.learned[el.number];
    document.getElementById("modalInner").innerHTML =
      '<div style="display:flex;align-items:center;gap:16px;margin-bottom:14px;">' +
      '<div style="width:64px;height:64px;border-radius:16px;background:' + color + ';display:flex;align-items:center;justify-content:center;font-family:var(--font-head);font-weight:700;font-size:1.6rem;color:#06121F;">' + el.symbol + "</div>" +
      '<div><div style="font-family:var(--font-head);font-size:1.3rem;font-weight:600;">' + el.name + "</div>" +
      '<div style="color:var(--text-dim);font-size:.8rem;font-weight:700;">Atomic number ' + el.number + " · " + CAT_LABEL[el.category] + "</div></div></div>" +
      '<dl class="fact-list">' +
      '<div class="fact-row"><dt>Atomic mass</dt><dd>' + el.mass + "</dd></div>" +
      '<div class="fact-row"><dt>State at room temp</dt><dd>' + el.phase + "</dd></div>" +
      '<div class="fact-row"><dt>Discovered</dt><dd>' + el.discovered + "</dd></div></dl>" +
      '<p class="fun-fact">✦ ' + el.fact + "</p>" +
      '<p class="fun-use" style="margin-bottom:18px;">Used for: ' + el.use + "</p>" +
      '<button class="pill-btn learn" id="modalLearnBtn" style="width:100%;">' + (isLearned ? "✓ Learned" : "Mark as learned") + "</button>";
    document.getElementById("modalLearnBtn").addEventListener("click", function () {
      markLearned(el.number);
      this.textContent = "✓ Learned";
      buildPeriodicTable();
    });
    overlay.classList.remove("hidden");
  }

  /* ==========================================================
     QUIZ (multiple choice)
     ========================================================== */
  var quizModes = {
    symbolToName: { question: "Which element is", get: function (el) { return el.symbol; }, answer: function (el) { return el.name; }, pool: function (el) { return el.name; } },
    nameToSymbol: { question: "What is the symbol for", get: function (el) { return el.name; }, answer: function (el) { return el.symbol; }, pool: function (el) { return el.symbol; } },
    numberToName: { question: "Which element has atomic number", get: function (el) { return "#" + el.number; }, answer: function (el) { return el.name; }, pool: function (el) { return el.name; } },
    category: { question: "What family does this element belong to?", get: function (el) { return el.symbol + " (" + el.name + ")"; }, answer: function (el) { return CAT_LABEL[el.category]; }, pool: function (el) { return CAT_LABEL[el.category]; } }
  };

  var quizState = null;

  document.querySelectorAll(".quiz-mode-card").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var mode = btn.dataset.mode;
      if (mode === "fillTable") { openFillSetup(); return; }
      startQuiz(mode);
    });
  });

  function shuffled(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function showQuizPane(pane) {
    ["quizIntro", "quizPlay", "quizResult", "fillSetup", "fillPlay", "fillResult"].forEach(function (id) {
      document.getElementById(id).classList.toggle("hidden", id !== pane);
    });
  }
  function resetQuizToIntro() {
    quizState = null;
    showQuizPane("quizIntro");
  }

  function startQuiz(mode) {
    var pool = shuffled(ELEMENTS).slice(0, 10);
    quizState = { mode: mode, questions: pool, idx: 0, score: 0 };
    showQuizPane("quizPlay");
    renderQuestion();
  }

  function renderQuestion() {
    var m = quizModes[quizState.mode];
    var el = quizState.questions[quizState.idx];
    document.getElementById("quizProgressText").textContent = "Question " + (quizState.idx + 1) + " of " + quizState.questions.length;
    document.getElementById("quizScoreText").textContent = "Score: " + quizState.score;
    document.getElementById("quizFill").style.width = (quizState.idx / quizState.questions.length * 100) + "%";
    document.getElementById("quizQuestion").innerHTML = m.question + "<br><span style='color:var(--accent)'>" + m.get(el) + "</span>";

    var correct = m.answer(el);
    var distractorsPool = shuffled(ELEMENTS.filter(function (e) { return e.number !== el.number; }));
    var options = [correct];
    for (var i = 0; i < distractorsPool.length && options.length < 4; i++) {
      var val = m.pool(distractorsPool[i]);
      if (options.indexOf(val) === -1) options.push(val);
    }
    options = shuffled(options);

    var box = document.getElementById("quizOptions");
    box.innerHTML = "";
    options.forEach(function (opt) {
      var b = document.createElement("button");
      b.className = "quiz-opt";
      b.textContent = opt;
      b.addEventListener("click", function () { answerQuiz(opt, correct, b); });
      box.appendChild(b);
    });
  }

  function answerQuiz(chosen, correct, btnEl) {
    document.querySelectorAll(".quiz-opt").forEach(function (b) {
      b.style.pointerEvents = "none";
      if (b.textContent === correct) b.classList.add("correct");
      else if (b === btnEl) b.classList.add("wrong");
    });
    if (chosen === correct) quizState.score++;
    setTimeout(function () {
      if (!quizState) return; // exited mid-question
      quizState.idx++;
      if (quizState.idx >= quizState.questions.length) finishQuiz();
      else renderQuestion();
    }, 700);
  }

  function finishQuiz() {
    var pct = Math.round((quizState.score / quizState.questions.length) * 100);
    store.quizCount = (store.quizCount || 0) + 1;
    var prevBest = store.quizBest[quizState.mode] || 0;
    if (pct > prevBest) store.quizBest[quizState.mode] = pct;
    saveStore();

    document.getElementById("resultEmoji").textContent = pct >= 80 ? "🌟" : pct >= 50 ? "🎉" : "💪";
    document.getElementById("resultHeadline").textContent = pct >= 80 ? "Amazing work!" : pct >= 50 ? "Nice job!" : "Keep practicing!";
    document.getElementById("resultDetail").textContent = "You got " + quizState.score + " out of " + quizState.questions.length + " correct (" + pct + "%).";
    showQuizPane("quizResult");
  }

  document.getElementById("quizAgainBtn").addEventListener("click", function () { startQuiz(quizState.mode); });
  document.getElementById("quizDoneBtn").addEventListener("click", function () {
    resetQuizToIntro();
    renderBestScores();
  });

  document.getElementById("quizExitBtn").addEventListener("click", function () {
    askConfirm("Exit this quiz?", "Your progress on this round will be lost.", "Exit quiz").then(function (ok) {
      if (ok) { resetQuizToIntro(); renderBestScores(); }
    });
  });

  function renderBestScores() {
    var box = document.getElementById("bestScores");
    if (!box) return;
    box.innerHTML = "";
    var any = false;
    Object.keys(quizModes).forEach(function (key) {
      if (store.quizBest[key] === undefined) return;
      any = true;
      var row = document.createElement("div");
      row.className = "best-row";
      row.innerHTML = "<span>" + modeLabel(key) + "</span><b>" + store.quizBest[key] + "% best</b>";
      box.appendChild(row);
    });
    if (!any) box.innerHTML = '<p style="text-align:center;color:var(--text-dim);font-size:.78rem;">Play a round to see your best scores here!</p>';
  }
  function modeLabel(key) {
    return { symbolToName: "Symbol to Name", nameToSymbol: "Name to Symbol", numberToName: "Atomic Number", category: "Element Families" }[key] || key;
  }

  /* ==========================================================
     FILL THE TABLE — real drag & drop, free placement, submit to check
     ========================================================== */
  var FILL_SECTIONS = [
    { key: "1", group: "By period", label: "Period 1", kind: "period" },
    { key: "2", group: "By period", label: "Period 2", kind: "period" },
    { key: "3", group: "By period", label: "Period 3", kind: "period" },
    { key: "4", group: "By period", label: "Period 4", kind: "period" },
    { key: "5", group: "By period", label: "Period 5", kind: "period" },
    { key: "6", group: "By period", label: "Period 6", kind: "period" },
    { key: "7", group: "By period", label: "Period 7", kind: "period" },
    { key: "lanthanide", group: "By family", label: "Lanthanides", kind: "category" },
    { key: "actinide", group: "By family", label: "Actinides", kind: "category" },
    { key: "mix12", group: "Mixed challenges", label: "Random Mix · 12", kind: "random", count: 12,
      sub: "12 random elements from different families" },
    { key: "mix24", group: "Mixed challenges", label: "Random Mix · 24", kind: "random", count: 24,
      sub: "24 random elements from different families" },
    { key: "whole", group: "Mixed challenges", label: "The Whole Table", kind: "whole", big: true,
      sub: "All 118 elements — the ultimate challenge" }
  ];

  function getSectionElements(section) {
    if (section.kind === "whole") return ELEMENTS.slice();
    if (section.kind === "category") {
      return ELEMENTS.filter(function (e) { return e.category === section.key; })
                     .sort(function (a, b) { return a.number - b.number; });
    }
    if (section.kind === "period") {
      var period = Number(section.key);
      return ELEMENTS.filter(function (e) {
        return e.period === period && e.category !== "lanthanide" && e.category !== "actinide";
      });
    }
    // random: spread the picks across families so it's a real mix
    var byCat = {};
    ELEMENTS.forEach(function (e) { (byCat[e.category] = byCat[e.category] || []).push(e); });
    var cats = shuffled(Object.keys(byCat));
    var picked = [], ci = 0, guard = 0;
    while (picked.length < section.count && guard++ < 2000) {
      var cat = cats[ci % cats.length]; ci++;
      var pool = byCat[cat].filter(function (e) { return picked.indexOf(e) === -1; });
      if (pool.length) picked.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    return picked.sort(function (a, b) { return a.number - b.number; });
  }

  function openFillSetup() {
    var list = document.getElementById("fillPeriodList");
    list.innerHTML = "";
    var lastGroup = null;
    FILL_SECTIONS.forEach(function (s) {
      if (s.group !== lastGroup) {
        var h = document.createElement("div");
        h.className = "fill-section-heading";
        h.textContent = s.group;
        list.appendChild(h);
        lastGroup = s.group;
      }
      var els = getSectionElements(s);
      var done = !!store.fillCompleted[s.key];
      var btn = document.createElement("button");
      btn.className = "fill-period-btn" + (done ? " done" : "") + (s.big ? " big" : "");
      btn.innerHTML =
        "<span>" + s.label + (done ? '<span class="fp-check">✓</span>' : "") +
        (s.sub ? '<span class="fp-sub">' + s.sub + "</span>" : "") + "</span>" +
        '<span class="fp-count">' + els.length + " tiles</span>";
      btn.addEventListener("click", function () { startFillSection(s.key); });
      list.appendChild(btn);
    });
    showQuizPane("fillSetup");
  }
  document.getElementById("fillBackBtn").addEventListener("click", resetQuizToIntro);

  // fillState.placements maps slotId (the correct element's number) -> placed element number
  var fillState = null;

  function startFillSection(key) {
    var section = FILL_SECTIONS.find(function (s) { return s.key === key; });
    var els = getSectionElements(section);
    fillState = {
      key: key,
      section: section,
      targets: els,
      targetNums: els.map(function (e) { return e.number; }),
      placements: {},
      // fixed shuffled order so the waiting tiles never jump around
      trayOrder: shuffled(els).map(function (e) { return e.number; }),
      graded: false
    };
    showQuizPane("fillPlay");
    buildFillGrid();
    buildFillTray();
    updateFillStatus();
  }

  function elById(num) {
    return ELEMENTS.find(function (e) { return e.number === num; });
  }

  function buildFillGrid() {
    var grid = document.getElementById("fillGrid");
    grid.innerHTML = "";
    var pos = elementsByPosition();
    var isTarget = {};
    fillState.targetNums.forEach(function (n) { isTarget[n] = true; });

    function contextCell(el, col, row) {
      var cell = document.createElement("div");
      cell.className = "pt-cell context";
      cell.style.gridColumn = col; cell.style.gridRow = row;
      cell.style.background = catColor(el.category);
      cell.innerHTML = '<span class="num">' + el.number + '</span><span class="sym">' + el.symbol + "</span>";
      cell.title = el.number + " · " + el.name;
      grid.appendChild(cell);
    }
    function targetCell(el, col, row) {
      var cell = document.createElement("div");
      cell.className = "pt-cell target";
      cell.dataset.slot = el.number;
      cell.style.gridColumn = col; cell.style.gridRow = row;
      cell.innerHTML = "";
      grid.appendChild(cell);
    }

    forEachGridPosition(function (period, group) {
      if ((period === 6 || period === 7) && group === 3) {
        var ph = document.createElement("div");
        ph.className = "pt-cell context range";
        ph.style.gridColumn = group; ph.style.gridRow = period;
        ph.style.background = catColor(period === 6 ? "lanthanide" : "actinide");
        ph.innerHTML = '<span class="sym">' + (period === 6 ? "57-71" : "89-103") + "</span>";
        grid.appendChild(ph);
        return;
      }
      var el = pos.byPos[period + "_" + group];
      if (el) {
        if (isTarget[el.number]) targetCell(el, group, period);
        else contextCell(el, group, period);
      } else {
        var spacer = document.createElement("div");
        spacer.className = "pt-cell spacer";
        spacer.style.gridColumn = group; spacer.style.gridRow = period;
        grid.appendChild(spacer);
      }
    });
    for (var g = 1; g <= 18; g++) {
      var sp = document.createElement("div");
      sp.className = "pt-cell spacer";
      sp.style.gridColumn = g; sp.style.gridRow = 8;
      grid.appendChild(sp);
    }
    pos.lanth.forEach(function (el, i) {
      if (isTarget[el.number]) targetCell(el, 3 + i, 9); else contextCell(el, 3 + i, 9);
    });
    pos.actin.forEach(function (el, i) {
      if (isTarget[el.number]) targetCell(el, 3 + i, 10); else contextCell(el, 3 + i, 10);
    });
  }

  function buildFillTray() {
    var tray = document.getElementById("fillTray");
    tray.innerHTML = "";
    var placed = {};
    Object.keys(fillState.placements).forEach(function (slot) { placed[fillState.placements[slot]] = true; });
    // keep the original shuffled order so tiles never rearrange themselves
    var remaining = fillState.trayOrder.filter(function (n) { return !placed[n]; });
    if (!remaining.length) {
      tray.innerHTML = '<span class="fill-tray-empty">All tiles placed — hit Submit to check!</span>';
      return;
    }
    remaining.forEach(function (n) { tray.appendChild(makeTile(elById(n))); });
  }

  // During play the puzzle tiles are deliberately blank: no family colour and no
  // atomic number, so the player can't just read the answer off the tile.
  function makeTile(el) {
    var tile = document.createElement("div");
    tile.className = "fill-tile blank";
    tile.dataset.number = el.number;
    tile.innerHTML = "<span>" + el.symbol + "</span>";
    return tile;
  }

  function paintPlacedCell(cell, el) {
    cell.classList.add("placed");
    cell.dataset.placed = el.number;
    cell.innerHTML = '<span class="sym">' + el.symbol + "</span>";
  }
  function clearCell(cell) {
    var slot = cell.dataset.slot;
    cell.classList.remove("placed", "marked-correct", "marked-wrong", "marked-missed");
    cell.style.background = "";
    delete cell.dataset.placed;
    cell.innerHTML = "";
    cell.title = "";
  }

  function updateFillStatus() {
    var n = Object.keys(fillState.placements).length;
    var label = fillState.section ? fillState.section.label : "";
    document.getElementById("fillStatusText").textContent =
      (label ? label + " · " : "") + n + " / " + fillState.targets.length + " placed";
  }

  /* ---------- Pointer-based drag & drop (works with mouse, touch and pen) ---------- */
  var drag = null;

  function onPointerDown(e) {
    if (!fillState || fillState.graded) return;
    var tile = e.target.closest ? e.target.closest(".fill-tile") : null;
    var placedCell = e.target.closest ? e.target.closest(".pt-cell.target.placed") : null;
    var sourceEl = null, originCell = null, elNum = null;

    if (tile && document.getElementById("fillPlay").contains(tile)) {
      elNum = Number(tile.dataset.number);
      sourceEl = tile;
    } else if (placedCell && document.getElementById("fillPlay").contains(placedCell)) {
      elNum = Number(placedCell.dataset.placed);
      originCell = placedCell;
    } else {
      return;
    }

    var el = elById(elNum);
    if (!el) return;
    e.preventDefault();

    var ghost = makeTile(el);
    ghost.classList.add("drag-ghost");
    ghost.style.position = "fixed";
    ghost.style.left = (e.clientX - 21) + "px";
    ghost.style.top = (e.clientY - 21) + "px";
    document.body.appendChild(ghost);

    if (sourceEl) sourceEl.classList.add("dragging");

    drag = { el: el, ghost: ghost, sourceTile: sourceEl, originCell: originCell, hover: null, moved: false };
    document.body.classList.add("dragging-tile");

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
  }

  // While dragging near an edge, scroll the board sideways and the page
  // vertically so every slot stays reachable. Only kicks in once the pointer
  // has actually moved, and only right at an edge, so simply picking a tile up
  // never yanks the view.
  function autoScrollBoard(clientX, clientY) {
    if (!drag || !drag.moved) return;

    var H_EDGE = 50, V_EDGE = 36, SPEED = 13;

    var scroller = document.querySelector("#fillPlay .table-scroll");
    if (scroller && scroller.scrollWidth > scroller.clientWidth + 2) {
      var r = scroller.getBoundingClientRect();
      var maxLeft = scroller.scrollWidth - scroller.clientWidth;
      if (clientY > r.top - 60 && clientY < r.bottom + 60) {
        // only scroll if there is actually more board that way, so slots at the
        // far ends stay droppable instead of sliding away from the cursor
        if (clientX < r.left + H_EDGE && scroller.scrollLeft > 0) {
          scroller.scrollLeft = Math.max(0, scroller.scrollLeft - SPEED);
        } else if (clientX > r.right - H_EDGE && scroller.scrollLeft < maxLeft) {
          scroller.scrollLeft = Math.min(maxLeft, scroller.scrollLeft + SPEED);
        }
      }
    }

    var vh = window.innerHeight || document.documentElement.clientHeight;
    var dy = 0;
    if (clientY < V_EDGE) dy = -SPEED;
    else if (clientY > vh - V_EDGE) dy = SPEED;
    if (!dy) return;

    var before = window.scrollY;
    window.scrollBy(0, dy);
    if (window.scrollY === before) {
      // the window isn't the scroller — find the ancestor that is
      var node = document.getElementById("fillPlay");
      while (node && node !== document.body) {
        if (node.scrollHeight > node.clientHeight + 2) { node.scrollTop += dy; break; }
        node = node.parentElement;
      }
    }
  }

  function onPointerMove(e) {
    if (!drag) return;
    drag.moved = true;
    drag.ghost.style.left = (e.clientX - 21) + "px";
    drag.ghost.style.top = (e.clientY - 21) + "px";
    autoScrollBoard(e.clientX, e.clientY);

    drag.ghost.style.display = "none";
    var under = document.elementFromPoint(e.clientX, e.clientY);
    drag.ghost.style.display = "";

    var slot = under && under.closest ? under.closest(".pt-cell.target") : null;
    var tray = under && under.closest ? under.closest("#fillTray") : null;

    if (drag.hover && drag.hover !== slot) drag.hover.classList.remove("drop-hover");
    document.getElementById("fillTray").classList.toggle("drop-hover", !!tray && !!drag.originCell);

    if (slot) { slot.classList.add("drop-hover"); drag.hover = slot; }
    else drag.hover = null;
  }

  function onPointerUp(e) {
    if (!drag) return;
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);

    drag.ghost.style.display = "none";
    var under = document.elementFromPoint(e.clientX, e.clientY);
    drag.ghost.remove();
    document.body.classList.remove("dragging-tile");

    var slot = under && under.closest ? under.closest(".pt-cell.target") : null;
    var overTray = under && under.closest ? !!under.closest("#fillTray") : false;

    if (drag.hover) drag.hover.classList.remove("drop-hover");
    document.getElementById("fillTray").classList.remove("drop-hover");
    if (drag.sourceTile) drag.sourceTile.classList.remove("dragging");

    var el = drag.el;
    var origin = drag.originCell;
    var moved = drag.moved;
    drag = null;

    // A plain tap (no movement) should change nothing at all.
    if (!moved) return;

    if (slot) {
      var slotId = slot.dataset.slot;
      // if something is already in that slot, send it back to the tray
      if (fillState.placements[slotId] !== undefined) {
        delete fillState.placements[slotId];
        clearCell(slot);
      }
      // detach from its previous slot, if it came from the grid
      if (origin) {
        delete fillState.placements[origin.dataset.slot];
        clearCell(origin);
      }
      fillState.placements[slotId] = el.number;
      paintPlacedCell(slot, el);
    } else if (origin && overTray) {
      // dragged out of the grid and back into the tray → unplace it
      delete fillState.placements[origin.dataset.slot];
      clearCell(origin);
    }

    buildFillTray();
    updateFillStatus();
  }

  document.getElementById("fillPlay").addEventListener("pointerdown", onPointerDown);

  document.getElementById("fillClearBtn").addEventListener("click", function () {
    if (!fillState) return;
    document.querySelectorAll("#fillGrid .pt-cell.target.placed").forEach(clearCell);
    fillState.placements = {};
    buildFillTray();
    updateFillStatus();
  });

  /* ---------- Submit & review ---------- */
  document.getElementById("fillSubmitBtn").addEventListener("click", function () {
    if (!fillState) return;
    var placedCount = Object.keys(fillState.placements).length;
    if (placedCount < fillState.targets.length) {
      askConfirm(
        "Submit now?",
        "You still have " + (fillState.targets.length - placedCount) + " tile(s) left in the tray. Unplaced tiles count as missed.",
        "Submit anyway"
      ).then(function (ok) { if (ok) gradeFill(); });
    } else {
      gradeFill();
    }
  });

  function gradeFill() {
    var correct = 0, wrong = 0, missed = 0;
    fillState.targetNums.forEach(function (slotId) {
      var placed = fillState.placements[slotId];
      if (placed === undefined) missed++;
      else if (placed === slotId) correct++;
      else wrong++;
    });

    var total = fillState.targets.length;
    var pct = Math.round((correct / total) * 100);

    store.quizCount = (store.quizCount || 0) + 1;
    var bestKey = "fill_" + fillState.key;
    if (pct > (store.quizBest[bestKey] || 0)) store.quizBest[bestKey] = pct;
    if (correct === total) store.fillCompleted[fillState.key] = true;
    fillState.graded = true;
    saveStore();

    document.getElementById("fillResultEmoji").textContent = pct === 100 ? "🏆" : pct >= 70 ? "🌟" : pct >= 40 ? "🎉" : "💪";
    document.getElementById("fillResultHeadline").textContent =
      pct === 100 ? "Perfect!" : pct >= 70 ? "Great work!" : pct >= 40 ? "Good try!" : "Keep practicing!";
    document.getElementById("fillResultDetail").textContent =
      "You placed " + correct + " of " + total + " elements correctly (" + pct + "%).";

    var summary = document.getElementById("fillReviewSummary");
    summary.innerHTML =
      '<span class="review-chip ok">✓ ' + correct + " correct</span>" +
      (wrong ? '<span class="review-chip bad">✕ ' + wrong + " misplaced</span>" : "") +
      (missed ? '<span class="review-chip bad">— ' + missed + " missed</span>" : "");

    buildReviewGrid();
    showQuizPane("fillResult");
    if (correct === total) celebrate();
  }

  function buildReviewGrid() {
    var grid = document.getElementById("fillReviewGrid");
    grid.innerHTML = "";
    var pos = elementsByPosition();
    var isTarget = {};
    fillState.targetNums.forEach(function (n) { isTarget[n] = true; });

    function contextCell(el, col, row) {
      var cell = document.createElement("div");
      cell.className = "pt-cell context";
      cell.style.gridColumn = col; cell.style.gridRow = row;
      cell.style.background = catColor(el.category);
      cell.innerHTML = '<span class="num">' + el.number + '</span><span class="sym">' + el.symbol + "</span>";
      cell.title = el.number + " · " + el.name;
      grid.appendChild(cell);
    }

    // After submitting, every puzzle tile reveals its real family colour and
    // atomic number, with a green or red ring showing how it was answered.
    function reviewCell(el, col, row) {
      var cell = document.createElement("div");
      cell.className = "pt-cell target revealed";
      cell.style.gridColumn = col; cell.style.gridRow = row;
      var placedNum = fillState.placements[el.number];

      if (placedNum === undefined) {
        cell.classList.add("marked-missed");
        cell.style.background = catColor(el.category);
        cell.innerHTML = '<span class="num">' + el.number + '</span><span class="sym">' + el.symbol + "</span>" +
                         '<span class="mark-badge bad">✕</span>';
        cell.title = "Left blank — this spot was " + el.name + " (" + el.number + ")";
      } else {
        var placedEl = elById(placedNum);
        var right = placedNum === el.number;
        cell.classList.add("placed", right ? "marked-correct" : "marked-wrong");
        cell.style.background = catColor(placedEl.category);
        cell.innerHTML = '<span class="num">' + placedEl.number + '</span><span class="sym">' + placedEl.symbol + "</span>" +
                         '<span class="mark-badge ' + (right ? "ok" : "bad") + '">' + (right ? "✓" : "✕") + "</span>";
        cell.title = right
          ? "Correct — " + el.name + " (" + el.number + ")"
          : "You placed " + placedEl.name + " here; the answer was " + el.name + " (" + el.number + ")";
      }
      grid.appendChild(cell);
    }

    forEachGridPosition(function (period, group) {
      if ((period === 6 || period === 7) && group === 3) {
        var ph = document.createElement("div");
        ph.className = "pt-cell context range";
        ph.style.gridColumn = group; ph.style.gridRow = period;
        ph.style.background = catColor(period === 6 ? "lanthanide" : "actinide");
        ph.innerHTML = '<span class="sym">' + (period === 6 ? "57-71" : "89-103") + "</span>";
        grid.appendChild(ph);
        return;
      }
      var el = pos.byPos[period + "_" + group];
      if (el) {
        if (isTarget[el.number]) reviewCell(el, group, period);
        else contextCell(el, group, period);
      } else {
        var spacer = document.createElement("div");
        spacer.className = "pt-cell spacer";
        spacer.style.gridColumn = group; spacer.style.gridRow = period;
        grid.appendChild(spacer);
      }
    });
    for (var g = 1; g <= 18; g++) {
      var sp = document.createElement("div");
      sp.className = "pt-cell spacer";
      sp.style.gridColumn = g; sp.style.gridRow = 8;
      grid.appendChild(sp);
    }
    pos.lanth.forEach(function (el, i) {
      if (isTarget[el.number]) reviewCell(el, 3 + i, 9); else contextCell(el, 3 + i, 9);
    });
    pos.actin.forEach(function (el, i) {
      if (isTarget[el.number]) reviewCell(el, 3 + i, 10); else contextCell(el, 3 + i, 10);
    });
  }

  document.getElementById("fillAgainBtn").addEventListener("click", function () { startFillSection(fillState.key); });
  document.getElementById("fillDoneBtn").addEventListener("click", function () { openFillSetup(); });
  document.getElementById("fillExitBtn").addEventListener("click", function () {
    askConfirm("Exit this game?", "Anything you've placed on the table will be lost.", "Exit game").then(function (ok) {
      if (ok) openFillSetup();
    });
  });

  /* ---------- Celebration: falling ribbons for a perfect round ---------- */
  function celebrate() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var existing = document.getElementById("confettiCanvas");
    if (existing) existing.remove();

    var canvas = document.createElement("canvas");
    canvas.id = "confettiCanvas";
    canvas.className = "confetti-canvas";
    document.body.appendChild(canvas);
    var ctx = canvas.getContext("2d");

    function size() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    size();
    window.addEventListener("resize", size);

    var colors = CATS.map(function (c) { return catColor(c.key); })
                     .concat(["#FFFFFF", "#FFE9A8"]);
    var ribbons = [];
    for (var i = 0; i < 130; i++) {
      ribbons.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.8,
        w: 7 + Math.random() * 7,
        h: 12 + Math.random() * 16,
        color: colors[Math.floor(Math.random() * colors.length)],
        vy: 1.6 + Math.random() * 2.8,
        vx: -0.9 + Math.random() * 1.8,
        rot: Math.random() * Math.PI * 2,
        vr: -0.12 + Math.random() * 0.24,
        sway: Math.random() * Math.PI * 2
      });
    }

    var start = Date.now();
    var DURATION = 4200;
    var raf;

    function frame() {
      var elapsed = Date.now() - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var fade = elapsed > DURATION - 900 ? Math.max(0, (DURATION - elapsed) / 900) : 1;

      ribbons.forEach(function (r) {
        r.sway += 0.05;
        r.y += r.vy;
        r.x += r.vx + Math.sin(r.sway) * 0.9;
        r.rot += r.vr;
        if (r.y > canvas.height + 30) {
          r.y = -25;
          r.x = Math.random() * canvas.width;
        }
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(r.x, r.y);
        ctx.rotate(r.rot);
        ctx.fillStyle = r.color;
        // a curled ribbon rather than a flat rectangle
        ctx.beginPath();
        ctx.moveTo(-r.w / 2, -r.h / 2);
        ctx.quadraticCurveTo(0, -r.h / 2 + Math.sin(r.sway) * 5, r.w / 2, -r.h / 2);
        ctx.lineTo(r.w / 2, r.h / 2);
        ctx.quadraticCurveTo(0, r.h / 2 + Math.sin(r.sway) * 5, -r.w / 2, r.h / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });

      if (elapsed < DURATION) raf = requestAnimationFrame(frame);
      else {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", size);
        canvas.remove();
      }
    }
    frame();
  }

  /* ==========================================================
     PROGRESS
     ========================================================== */
  function renderProgress() {
    document.getElementById("statLearned").textContent = learnedCount();
    document.getElementById("statQuizzes").textContent = store.quizCount || 0;
    var bestOverall = 0;
    Object.keys(store.quizBest).forEach(function (k) { if (store.quizBest[k] > bestOverall) bestOverall = store.quizBest[k]; });
    document.getElementById("statBest").textContent = bestOverall + "%";

    var box = document.getElementById("categoryBars");
    box.innerHTML = "";
    CATS.forEach(function (c) {
      var total = ELEMENTS.filter(function (e) { return e.category === c.key; }).length;
      var learned = ELEMENTS.filter(function (e) { return e.category === c.key && store.learned[e.number]; }).length;
      var row = document.createElement("div");
      row.className = "cat-bar-row";
      row.innerHTML =
        '<span class="cat-bar-label">' + c.label + "</span>" +
        '<span class="cat-bar-track"><span class="cat-bar-fill" style="width:' + (total ? (learned / total * 100) : 0) + "%;background:" + catColor(c.key) + ';"></span></span>' +
        '<span class="cat-bar-count">' + learned + "/" + total + "</span>";
      box.appendChild(row);
    });
  }

  document.getElementById("resetBtn").addEventListener("click", function () {
    askConfirm("Reset all progress?", "This clears every learned element, quiz score, and completed table row. It can't be undone.", "Reset everything").then(function (ok) {
      if (!ok) return;
      store = defaultStore();
      saveStore();
      updateStreakPill();
      renderProgress();
      renderBestScores();
      tableBuilt = false;
      quizState = null;
      fillState = null;
    });
  });

  /* ==========================================================
     INIT
     ========================================================== */
  buildChips();
  renderCard();
  updateStreakPill();
  showView("table");

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
