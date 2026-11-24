/*
 * Monster Sort - game logic.
 * You should not need to edit this file. Change pictures, words and levels in js/config.js.
 *
 * Three ways to play, all of which do the same thing:
 *   - Drag a shape into a monster (touch or mouse).
 *   - Tap a shape, then tap a monster (also how VoiceOver, ChromeVox and
 *     keyboard users play: Enter or Space on a shape, then on a monster).
 *   - Switch scanning (Settings): shapes light up one at a time, then monsters.
 */
(function () {
  "use strict";

  /* ---------- Config ---------- */
  var userCfg = window.GAME_CONFIG || {};
  var cfg = {
    title: userCfg.title || "Monster Sort",
    phrases: Object.assign({ correct: "That's right!", wrong: "Try again", finish: "Woo hoo, you did it!" }, userCfg.phrases || {}),
    voiceFiles: Object.assign({ correct: "", wrong: "", finish: "" }, userCfg.voiceFiles || {}),
    voiceRate: typeof userCfg.voiceRate === "number" ? userCfg.voiceRate : 0.9,
    sillyVoice: Object.assign({ pitch: 1.9, rate: 1.05 }, userCfg.sillyVoice || {}),
    sillyVoiceFiles: Object.assign({ correct: "", wrong: "", finish: "" }, userCfg.sillyVoiceFiles || {}),
    growlyVoice: Object.assign({ pitch: 0.4, rate: 0.8 }, userCfg.growlyVoice || {}),
    growlyVoiceFiles: Object.assign({ correct: "", wrong: "", finish: "" }, userCfg.growlyVoiceFiles || {}),
    voiceName: userCfg.voiceName || "",
    pointsPerCorrect: typeof userCfg.pointsPerCorrect === "number" ? userCfg.pointsPerCorrect : 100,
    pieceColor: userCfg.pieceColor || "#f9c4d8",
    pieceOutline: userCfg.pieceOutline || "#d9789f",
    colors: Object.assign({
      pink: { fill: "#f9c4d8", outline: "#d9789f" },
      red: { fill: "#e0282e", outline: "#8f1116" },
      blue: { fill: "#1f6fe0", outline: "#0b3a85" }
    }, userCfg.colors || {}),
    backdropColor: userCfg.backdropColor || "#dcdcdc",
    backdropOutline: userCfg.backdropOutline || "#8c8c8c",
    barColor: userCfg.barColor || "#000000",
    levels: (userCfg.levels && userCfg.levels.length) ? userCfg.levels : [],
    defaults: Object.assign({
      voice: true, voiceStyle: "regular", volume: 90, animation: true, highContrast: false,
      scanning: false, scanSeconds: 2
    }, userCfg.defaults || {})
  };

  /* ---------- Settings (remembered on this device) ---------- */
  var STORE_KEY = "monster-sort.settings";
  var prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var settings = Object.assign({ level: 0 }, cfg.defaults);
  if (prefersReduced) settings.animation = false;
  try {
    var saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (saved && typeof saved === "object") Object.assign(settings, saved);
  } catch (e) { /* storage unavailable: use defaults */ }
  // A link can open a level directly, for example index.html?level=2
  try {
    var urlLevel = parseInt(new URLSearchParams(location.search).get("level"), 10);
    if (urlLevel >= 1 && urlLevel <= cfg.levels.length) settings.level = urlLevel - 1;
  } catch (e) { /* ignore */ }
  if (!(settings.level >= 0 && settings.level < cfg.levels.length)) settings.level = 0;

  function saveSettings() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
  }

  /* ---------- Elements ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var stage = $("stage");
  var scene = $("scene");
  var targetsEl = $("targets");
  var piecesEl = $("pieces");
  var floorEl = $("floor");
  var statusEl = $("status");
  var live = $("live");

  /* ---------- Shapes ---------- */
  var SHAPES = {
    circle: '<circle cx="50" cy="50" r="46"/>',
    square: '<rect x="4" y="4" width="92" height="92"/>',
    rectangle: '<rect x="4" y="20" width="92" height="60"/>',
    triangle: '<polygon points="50,6 96,90 4,90"/>',
    "right-triangle": '<polygon points="8,8 8,92 92,92"/>',
    "tall-triangle": '<polygon points="50,4 74,96 26,96"/>',
    "wide-triangle": '<polygon points="50,26 97,80 3,80"/>',
    "slanted-triangle": '<polygon points="30,8 96,88 4,68"/>',
    trapezoid: '<polygon points="26,20 74,20 96,80 4,80"/>',
    parallelogram: '<polygon points="30,22 96,22 70,78 4,78"/>',
    kite: '<polygon points="50,4 84,36 50,96 16,36"/>',
    oval: '<ellipse cx="50" cy="50" rx="46" ry="31"/>',
    semicircle: '<path d="M4 74 A46 46 0 0 1 96 74 Z"/>',
    hexagon: '<polygon points="27,8 73,8 96,50 73,92 27,92 4,50"/>',
    diamond: '<polygon points="50,4 92,50 50,96 8,50"/>',
    star: '<polygon points="50,5 61,37 95,37 68,57 78,90 50,70 22,90 32,57 5,37 39,37"/>',
    heart: '<path d="M50 90 C 18 66, 4 48, 4 30 C 4 14, 16 6, 28 6 C 38 6, 46 12, 50 22 C 54 12, 62 6, 72 6 C 84 6, 96 14, 96 30 C 96 48, 82 66, 50 90 Z"/>'
  };
  // color: a name from cfg.colors ("red"), a colour code ("#ff0000"), or empty for pink.
  function colorOf(color) {
    if (!color) return { fill: cfg.pieceColor, outline: cfg.pieceOutline };
    var c = cfg.colors[String(color).toLowerCase()];
    if (c) return { fill: c.fill, outline: c.outline || c.fill };
    return { fill: color, outline: color };
  }
  function shapeSvg(shape, color) {
    var c = colorOf(color);
    return '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><g fill="' + c.fill +
      '" stroke="' + c.outline + '" stroke-width="3" stroke-linejoin="round">' +
      (SHAPES[shape] || SHAPES.circle) + "</g></svg>";
  }

  /* ---------- Scene layout (in scene units, scaled to fit) ---------- */
  // "wide" for landscape screens, "tall" for portrait: shapes go in two rows.
  var LAYOUTS = {
    wide: { w: 1600, h: 1000, barH: 200, rows: 1, targetFrac: 0.76 },
    tall: { w: 1000, h: 940, barH: 300, rows: 2, targetFrac: 0.88 }
  };
  var layout = LAYOUTS.wide;
  var unit = 1; // pixels per scene unit

  /* ---------- Game state ---------- */
  var level = null;
  var targets = [];   // { el, def, cx, cy, size }
  var pieces = [];    // { el, shape, label, slot, done, cx, cy, size }
  var selected = null;
  var sortedCount = 0;
  var score = 0;
  var finished = false;

  /* ---------- Voice ---------- */
  var synth = window.speechSynthesis || null;
  var speechUnlocked = false;
  // Recordings, if any: one set for each voice style.
  // All recordings play through ONE audio player. iPhones and iPads (Safari and
  // Chrome) only let a player make sound once it has played during a real tap;
  // after that the same player may play any recording, at any time.
  var voiceClips = { regular: {}, silly: {}, growly: {} };
  var preloads = [];
  function loadClips(files, into) {
    Object.keys(files).forEach(function (k) {
      var src = files[k];
      if (src && src !== "none") {
        into[k] = src;
        var a = new Audio(); // only to fetch the file early
        a.preload = "auto";
        a.src = src;
        preloads.push(a);
      }
    });
  }
  loadClips(cfg.voiceFiles, voiceClips.regular);
  loadClips(cfg.sillyVoiceFiles, voiceClips.silly);
  loadClips(cfg.growlyVoiceFiles, voiceClips.growly);
  function voiceStyle() {
    var s = settings.voiceStyle;
    return s === "silly" || s === "growly" ? s : "regular";
  }
  var SILENT = "data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";
  var player = new Audio();
  player.preload = "auto";
  var playerUnlocked = false, playerBusy = false, playerNext = null;
  player.addEventListener("ended", function () {
    playerBusy = false;
    if (playerNext) { var f = playerNext; playerNext = null; f(); }
  });
  player.addEventListener("error", function () { playerBusy = false; playerNext = null; });

  // A tap counts on touchend or click, not on touchstart or pointerdown, so the
  // game unlocks sound on those (see the listeners below). "strong" means the
  // call comes from one of them.
  function unlockAudio(strong) {
    try {
      // Safari 16.4+: play even when the silent switch is on.
      if (navigator.audioSession) navigator.audioSession.type = "playback";
    } catch (e) { /* ignore */ }
    if (synth && !speechUnlocked) {
      // Speak a silent word now, so later words are allowed.
      if (strong) speechUnlocked = true;
      try {
        var u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        synth.speak(u);
      } catch (e) { /* ignore */ }
    }
    // Play a moment of silence (not muted: muted play does not count) during the tap.
    if (strong && !playerUnlocked && !playerBusy) {
      try {
        player.src = SILENT;
        var pr = player.play();
        if (pr && pr.then) pr.then(function () { playerUnlocked = true; }, function () {});
        else playerUnlocked = true;
      } catch (e) { /* ignore */ }
    }
  }
  ["touchend", "click", "keydown"].forEach(function (type) {
    document.addEventListener(type, function () { unlockAudio(true); }, true);
  });

  // key: "correct", "wrong" or "finish". queue: wait for what is already playing.
  function say(key, queue) {
    if (!settings.voice) return;
    var vol = Math.max(0, Math.min(100, settings.volume)) / 100;
    if (vol === 0) return;
    var src = voiceClips[voiceStyle()][key];
    if (src) {
      var play = function () {
        try {
          playerBusy = true;
          player.src = src;
          player.volume = vol;
          var p = player.play();
          if (p && p.then) p.then(function () { playerUnlocked = true; }, function () { playerBusy = false; });
        } catch (e) { playerBusy = false; }
      };
      if (queue && playerBusy) {
        playerNext = play;
      } else {
        playerNext = null;
        play();
      }
      return;
    }
    speak(cfg.phrases[key], queue);
  }

  /* Pick the most natural-sounding English voice this device has.
     Chromebook: Google voices. iPad: Premium or Enhanced voices if downloaded
     (Settings > Accessibility > Spoken Content > Voices), else Samantha.
     Novelty and old robotic voices are never chosen. */
  var NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|pipe organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley)\b/i;
  var GOOD_NAMES = /\b(ava|samantha|allison|susan|zoe|evan|nathan|noelle|joelle|nicky|tom|serena|karen|daniel|kate|moira|tessa|aria|jenny|guy|michelle)\b/i;
  var chosenVoice = null;
  var voiceSearched = false;
  var badVoices = {};
  function scoreVoice(v) {
    var name = v.name || "", lang = (v.lang || "").replace("_", "-").toLowerCase();
    if (lang.indexOf("en") !== 0) return -1;
    if (NOVELTY.test(name) || badVoices[v.voiceURI || name]) return -1;
    var s = 0;
    if (cfg.voiceName && name.toLowerCase().indexOf(String(cfg.voiceName).toLowerCase()) >= 0) s += 1000;
    if (/premium/i.test(name)) s += 80;
    if (/enhanced|neural|natural/i.test(name)) s += 70;
    if (/google/i.test(name)) s += 60;
    if (GOOD_NAMES.test(name)) s += 40;
    if (/eloquence|espeak|compact/i.test(name)) s -= 50;
    if (lang === "en-us" || lang === "en-ca") s += 10;
    else if (lang === "en-gb") s += 5;
    if (v.default) s += 3;
    return s;
  }
  function pickVoice() {
    if (!synth || !synth.getVoices) return null;
    var voices = synth.getVoices() || [];
    if (!voices.length) return null;
    voiceSearched = true;
    var best = null, bestScore = -1;
    voices.forEach(function (v) {
      var sc = scoreVoice(v);
      if (sc > bestScore) { bestScore = sc; best = v; }
    });
    chosenVoice = best;
    return best;
  }
  if (synth) {
    pickVoice();
    // Chrome loads its voice list a moment after the page.
    if (synth.addEventListener) synth.addEventListener("voiceschanged", pickVoice);
    else synth.onvoiceschanged = pickVoice;
  }

  // Speak any text with the browser's built-in voice.
  var keepAlive = [];      // keeps Chrome from dropping utterances early
  var readyAt = 0;         // when a delayed phrase will start
  function speak(text, queue) {
    if (!settings.voice || !text || !synth || !window.SpeechSynthesisUtterance) return;
    var vol = Math.max(0, Math.min(100, settings.volume)) / 100;
    if (vol === 0) return;
    if (!voiceSearched) pickVoice();
    var u = new SpeechSynthesisUtterance(text);
    var v = chosenVoice;
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = root.lang || "en"; }
    var styled = voiceStyle() === "silly" ? cfg.sillyVoice : voiceStyle() === "growly" ? cfg.growlyVoice : null;
    if (styled) {
      // Silly monster: the same clear voice pitched way up. Growly monster: pitched down and slower.
      u.pitch = Math.max(0, Math.min(2, styled.pitch));
      u.rate = styled.rate;
    } else {
      u.rate = cfg.voiceRate;
    }
    u.volume = vol;
    if (v && !v.localService) {
      // Online voices (like Google's) fail without internet: fall back to the device voice.
      u.onerror = function (ev) {
        if (ev && (ev.error === "interrupted" || ev.error === "canceled")) return;
        badVoices[v.voiceURI || v.name] = true;
        pickVoice();
        speak(text, true);
      };
    }
    keepAlive.push(u);
    if (keepAlive.length > 6) keepAlive.shift();
    var now = Date.now();
    if (queue) {
      // Wait for a phrase that is about to start, then line up behind it.
      var wait = Math.max(0, readyAt - now);
      if (wait) setTimeout(function () { synth.speak(u); }, wait + 10); else synth.speak(u);
    } else if (synth.speaking || synth.pending) {
      synth.cancel();
      // Safari can drop a phrase spoken right after cancel(): wait a moment.
      readyAt = now + 80;
      setTimeout(function () { synth.speak(u); }, 80);
    } else {
      synth.speak(u);
    }
  }

  /* ---------- Announcements for screen readers ---------- */
  var announceTimer = null;
  function announce(text) {
    live.textContent = "";
    clearTimeout(announceTimer);
    announceTimer = setTimeout(function () { live.textContent = text; }, 60);
  }

  /* ---------- Build a level ---------- */
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function preload(src) { var i = new Image(); i.src = src; }

  function buildLevel() {
    level = cfg.levels[settings.level];
    document.title = cfg.title;
    $("game-title").textContent = cfg.title;
    $("sr-directions").textContent = level.directions || "";
    scene.style.setProperty("--bar-color", cfg.barColor);
    scene.style.setProperty("--backdrop-color", cfg.backdropColor);
    scene.style.setProperty("--backdrop-outline", cfg.backdropOutline === "none" ? "transparent" : cfg.backdropOutline);

    targetsEl.innerHTML = "";
    targets = level.targets.map(function (def, i) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "target is-" + (def.backdrop === "square" || def.backdrop === "rounded" || def.backdrop === "none" ? def.backdrop : "circle");
      btn.dataset.index = String(i);
      btn.setAttribute("aria-label", def.label);
      btn.innerHTML = '<span class="backdrop" aria-hidden="true"></span>' +
        '<img class="monster" alt="" draggable="false">' +
        (def.showLabel ? '<span class="target-label" aria-hidden="true"></span>' : "");
      var img = btn.querySelector(".monster");
      img.src = def.monster;
      img.style.setProperty("--monster-size", ((def.monsterSize || 0.8) * 100) + "%");
      if (def.showLabel) btn.querySelector(".target-label").textContent = def.showLabel === true ? def.label : def.showLabel;
      if (def.monster) preload(def.monster);
      if (def.monsterClosed) preload(def.monsterClosed);
      btn.addEventListener("click", function (e) { onTargetClick(i, e); });
      btn.addEventListener("keydown", onTargetKey);
      targetsEl.appendChild(btn);
      return { el: btn, def: def, index: i };
    });
    buildRuleBox();
    newGame(true);
  }

  /* ---------- Rule switch levels ----------
     A level with "rules" is sorted once for each rule, in order. The two sides
     of the T-chart take their names and what they accept from the rule in the
     Rule Spotlight. When every shape is sorted, the rule changes and the shapes
     come back. */
  var ruleIdx = 0;
  var ruleBox = null;
  function activeRule() { return level && level.rules ? level.rules[ruleIdx] : null; }
  function sideOf(t) { var r = activeRule(); return r ? r.sides[t.index] : null; }
  function targetAccepts(t) { var s = sideOf(t); return (s ? s.accepts : t.def.accepts) || []; }
  function targetLabel(t) { var s = sideOf(t); return s ? s.label + " side" : t.def.label; }
  function chipSvg(chip) { return chip ? shapeSvg(chip.shape || "circle", chip.color || "#555555") : ""; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function buildRuleBox() {
    if (ruleBox) { ruleBox.remove(); ruleBox = null; }
    scene.classList.toggle("has-rules", !!level.rules);
    if (!level.rules) return;
    ruleBox = document.createElement("div");
    ruleBox.className = "rulebox";
    ruleBox.setAttribute("aria-hidden", "true"); // the rule is read out in the status and announcements
    var html = '<div class="rule-spotlight"><span class="rule-kicker">Rule Spotlight</span>' +
      '<span class="rule-main"><span class="rule-icons"></span><span class="rule-name"></span></span></div>';
    level.rules.forEach(function (r, i) {
      html += '<div class="rule-badge" data-rule="' + i + '"><span class="rule-badge-letter">' +
        esc(r.badge || String.fromCharCode(65 + i)) + '</span><span class="rule-icons">' +
        r.sides.map(function (s) { return chipSvg(s.chip); }).join("") + '</span><span class="rule-badge-name">' +
        esc(r.name) + '</span><span class="rule-badge-detail">' + esc(r.detail || "") + '</span></div>';
    });
    targets.forEach(function (t) { html += '<div class="rule-head" data-side="' + t.index + '"></div>'; });
    html += '<div class="tchart-h"></div><div class="tchart-v"></div>';
    ruleBox.innerHTML = html;
    scene.insertBefore(ruleBox, targetsEl);
  }

  function renderRule(switching) {
    var r = activeRule();
    if (!r) { $("sr-directions").textContent = level.directions || ""; return; }
    $("sr-directions").textContent = (level.directions || "") + " " + ruleDirections(r);
    var spot = ruleBox.querySelector(".rule-spotlight");
    spot.querySelector(".rule-name").textContent = "Sort by " + r.name.toLowerCase();
    spot.querySelector(".rule-icons").innerHTML = r.sides.map(function (s) { return chipSvg(s.chip); }).join("");
    Array.prototype.forEach.call(ruleBox.querySelectorAll(".rule-badge"), function (b) {
      b.classList.toggle("is-active", Number(b.dataset.rule) === ruleIdx);
    });
    targets.forEach(function (t) {
      var s = r.sides[t.index];
      ruleBox.querySelector('.rule-head[data-side="' + t.index + '"]').innerHTML =
        chipSvg(s.chip) + "<span>" + esc(s.label) + "</span>";
      t.el.setAttribute("aria-label", targetLabel(t));
    });
    if (switching && settings.animation) {
      ruleBox.classList.remove("is-switching");
      void ruleBox.offsetWidth;
      ruleBox.classList.add("is-switching");
      setTimeout(function () { if (ruleBox) ruleBox.classList.remove("is-switching"); }, 1400);
    }
  }
  function ruleDirections(r) {
    return "Rule: sort by " + r.name.toLowerCase() + ". " + r.sides.map(function (s, i) {
      return s.label + " on the " + (i === 0 ? "left" : "right") + " side";
    }).join(", ") + ".";
  }

  // Every shape is sorted under this rule: switch to the next one.
  function nextRule() {
    finished = true; // no sorting while the rule changes
    stopScan();
    setTimeout(function () {
      ruleIdx += 1;
      var r = activeRule();
      newGame(true, true, true);
      renderRule(true);
      var text = (r.say || ("New rule! Sort by " + r.name.toLowerCase() + ".")) ;
      speak(text, false);
      announce(text + " " + ruleDirections(r));
      var first = nextRemaining(-1);
      if (first && !settings.scanning && document.activeElement && document.activeElement !== document.body) first.el.focus();
    }, settings.animation ? 1300 : 900);
  }

  function newGame(isFirst, keepScore, keepRule) {
    finished = false;
    if (!keepRule) ruleIdx = 0;
    sortedCount = 0;
    // Play again starts the score over; Scramble shapes and Next level keep it.
    if (!isFirst && !keepScore) score = 0;
    showScore(false);
    selected = null;
    root.classList.remove("won", "has-selection");
    hideWin();

    var list = [];
    level.pieces.forEach(function (p) {
      for (var k = 0; k < (p.count || 1); k++) list.push(p);
    });
    shuffle(list);

    piecesEl.innerHTML = "";
    pieces = list.map(function (p, i) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "piece";
      btn.dataset.index = String(i);
      btn.setAttribute("aria-pressed", "false");
      if (p.image) {
        btn.innerHTML = '<img alt="" draggable="false">';
        btn.querySelector("img").src = p.image;
      } else {
        btn.innerHTML = shapeSvg(p.shape, p.color);
      }
      var colorName = p.color || "pink";
      var piece = { el: btn, shape: p.shape, color: String(colorName).toLowerCase(),
        label: p.label || (colorName.charAt(0) === "#" ? "" : colorName + " ") + String(p.shape).replace(/-/g, " "), slot: i, done: false, lastDrag: 0, lastTap: 0 };
      btn.addEventListener("pointerdown", function (e) { onPiecePointerDown(piece, e); });
      btn.addEventListener("click", function (e) { onPieceClick(piece, e); });
      btn.addEventListener("keydown", function (e) { onPieceKey(piece, e); });
      piecesEl.appendChild(btn);
      return piece;
    });
    pieces.forEach(function (p) { labelPiece(p); });
    if (level.rules) renderRule(false);
    layoutScene();
    updateStatus();
    if (!isFirst) announce("Shapes scrambled. " + pieces.length + " shapes to sort. " + (level.directions || ""));
    if (settings.scanning) startScan();
  }

  function remaining() { return pieces.filter(function (p) { return !p.done; }); }

  function labelPiece(p) {
    var name = p.label.charAt(0).toUpperCase() + p.label.slice(1).toLowerCase();
    p.el.setAttribute("aria-label", name);
  }

  function showScore(bump) {
    var el = $("score");
    $("score-value").textContent = String(score);
    el.setAttribute("aria-label", "Score: " + score);
    if (bump && settings.animation) {
      el.classList.remove("bump");
      void el.offsetWidth;
      el.classList.add("bump");
    }
  }

  function updateStatus() {
    var name = cfg.levels.length > 1 ? "Level " + (settings.level + 1) + ": " + level.name + ". " : (level.name ? level.name + ". " : "");
    var r = activeRule();
    statusEl.textContent = name + (r ? "Rule: " + r.name + ". " : "") + sortedCount + " of " + pieces.length + " sorted";
  }

  /* ---------- Placing things in the scene ---------- */
  function placeEl(el, cx, cy, w, h) {
    el.style.left = ((cx - w / 2) / layout.w * 100) + "%";
    el.style.top = ((cy - h / 2) / layout.h * 100) + "%";
    el.style.width = (w / layout.w * 100) + "%";
    el.style.height = (h / layout.h * 100) + "%";
  }

  function layoutScene() {
    var W = layout.w, H = layout.h, barH = layout.barH;
    var areaH = H - barH;
    floorEl.style.height = (barH / H * 100) + "%";

    // Monsters: spread evenly across the top area.
    var n = targets.length;
    var spacing = W / n;
    var top = 0;
    if (ruleBox) top = layoutRuleBox(W, areaH, spacing);
    var size = Math.min(spacing * layout.targetFrac, (areaH - top) * (top ? 0.9 : 0.8));
    targets.forEach(function (t, i) {
      var s = t.def.backdrop === "circle" || !t.def.backdrop ? size : size * 0.95;
      t.cx = spacing * (i + 0.5);
      t.cy = top ? top + (areaH - top) / 2 : areaH / 2 + 6;
      t.size = s;
      // On a T-chart, a drop anywhere in the column counts.
      t.zone = top ? { x0: spacing * i, x1: spacing * (i + 1), y0: top - 20, y1: areaH } : null;
      placeEl(t.el, t.cx, t.cy, s, s);
    });

    // Shapes: one row (wide screens) or two rows (tall screens) on the bar.
    var count = pieces.length;
    var rows = layout.rows;
    if (count > 10) rows = Math.max(rows, 2);
    var perRow = Math.ceil(count / rows);
    var slotW = W / perRow;
    var rowH = barH / rows;
    var ps = Math.min(slotW * 0.7, rowH * 0.72);
    pieces.forEach(function (p) {
      var r = Math.floor(p.slot / perRow);
      var c = p.slot % perRow;
      var inRow = Math.min(perRow, count - r * perRow);
      var offset = (W - inRow * slotW) / 2;
      p.cx = offset + slotW * (c + 0.5);
      p.cy = areaH + rowH * (r + 0.5);
      p.size = ps;
      placeEl(p.el, p.cx, p.cy, ps, ps);
    });
  }

  // Rule Spotlight, badges, column headings and T-chart lines. Returns where
  // the columns start (scene units from the top).
  function layoutRuleBox(W, areaH, spacing) {
    var wide = layout === LAYOUTS.wide;
    var q = function (sel) { return ruleBox.querySelector(sel); };
    // The score sits in the top-left corner, so keep clear of it.
    var spotY = wide ? 90 : 75, spotW = wide ? 540 : 580;
    var spotX = wide ? W / 2 : W - 30 - spotW / 2;
    placeEl(q(".rule-spotlight"), spotX, spotY, spotW, wide ? 140 : 120);
    var badges = ruleBox.querySelectorAll(".rule-badge");
    var badgeY = wide ? spotY : 200;
    var bw = wide ? 250 : 330, bh = wide ? 120 : 90;
    Array.prototype.forEach.call(badges, function (b, i) {
      var x = wide ? (i === 0 ? spotX - spotW / 2 - 20 - bw / 2 : spotX + spotW / 2 + 20 + bw / 2)
                   : (i === 0 ? W / 2 - 20 - bw / 2 : W / 2 + 20 + bw / 2);
      placeEl(b, x, badgeY, bw, bh);
    });
    var headY = wide ? 225 : 300;
    targets.forEach(function (t, i) {
      placeEl(q('.rule-head[data-side="' + i + '"]'), spacing * (i + 0.5), headY, spacing * 0.8, 80);
    });
    var lineY = headY + 50;
    placeEl(q(".tchart-h"), W / 2, lineY, W - 60, 8);
    placeEl(q(".tchart-v"), W / 2, (headY - 40 + areaH - 10) / 2, 8, areaH - 10 - (headY - 40));
    return lineY + 6;
  }

  function mouthOf(t) {
    var m = t.def.mouth || { x: 0.5, y: 0.65 };
    var ms = t.size * (t.def.monsterSize || 0.8);
    return { x: t.cx - ms / 2 + ms * m.x, y: t.cy - ms / 2 + ms * m.y };
  }

  function fitScene() {
    var hint = $("scan-hint");
    var hintH = hint.hidden ? 0 : hint.offsetHeight + 8;
    var exitBtn = $("btn-exit-fs");
    stage.style.setProperty("--fs-room", "0px");
    var w = stage.clientWidth;
    var h = stage.clientHeight - hintH;
    if (w <= 0 || h <= 0) return;
    var next = (w / h) >= 1.2 ? LAYOUTS.wide : LAYOUTS.tall;
    var s = Math.min(w / next.w, h / next.h);
    // In full screen, make sure the exit button never covers the scene.
    if (!exitBtn.hidden) {
      var bw = exitBtn.offsetWidth + 16, bh = exitBtn.offsetHeight + 16;
      if ((w - next.w * s) / 2 < bw) {
        stage.style.setProperty("--fs-room", bh + "px");
        h -= bh;
        next = (w / h) >= 1.2 ? LAYOUTS.wide : LAYOUTS.tall;
        s = Math.min(w / next.w, h / next.h);
      }
    }
    if (drag) cancelDrag();
    var changed = next !== layout;
    layout = next;
    unit = Math.max(0.05, s);
    scene.style.setProperty("--scene-w", (layout.w * unit) + "px");
    scene.style.setProperty("--scene-h", (layout.h * unit) + "px");
    root.style.setProperty("--u", unit + "px");
    if (changed || !pieces.length || !pieces[0].el.style.left) layoutScene();
  }

  /* ---------- Choosing and sorting ---------- */
  function select(p, moveFocus) {
    if (finished || p.done) return;
    if (selected === p) { deselect(true); return; }
    if (selected) selected.el.classList.remove("is-selected");
    pieces.forEach(function (q) { q.el.setAttribute("aria-pressed", "false"); });
    selected = p;
    p.el.classList.add("is-selected");
    p.el.setAttribute("aria-pressed", "true");
    root.classList.add("has-selection");
    announce(p.el.getAttribute("aria-label") + " chosen. Now choose a monster.");
    if (moveFocus) targets[0].el.focus();
  }

  function deselect(speak) {
    if (!selected) return;
    selected.el.classList.remove("is-selected");
    selected.el.setAttribute("aria-pressed", "false");
    if (speak) announce(selected.el.getAttribute("aria-label") + " put back.");
    selected = null;
    root.classList.remove("has-selection");
  }

  // Try to feed piece p to monster t. how: "drag", "tap", "key" or "scan".
  function attempt(p, t, how) {
    if (finished || p.done) return;
    // accepts lists shapes ("circle") and/or colours ("red") this monster eats.
    var acc = targetAccepts(t).map(function (a) { return String(a).toLowerCase(); });
    var ok = acc.indexOf(p.shape) >= 0 || acc.indexOf(p.color) >= 0;
    var name = p.el.getAttribute("aria-label");
    var hadFocus = document.activeElement === p.el || document.activeElement === t.el;
    deselect(false);
    if (ok) {
      p.done = true;
      sortedCount++;
      score += cfg.pointsPerCorrect;
      showScore(true);
      p.el.setAttribute("aria-hidden", "true");
      p.el.tabIndex = -1;
      p.el.classList.add("is-eaten");
      var m = mouthOf(t);
      var dx = (m.x - p.cx) * unit, dy = (m.y - p.cy) * unit;
      if (settings.animation) {
        // From wherever it is now, fly into the mouth and shrink away.
        void p.el.offsetWidth;
        p.el.style.transform = "translate(" + dx + "px," + dy + "px) scale(0.12)";
        p.el.style.opacity = "0";
        setTimeout(function () { p.el.classList.add("is-done"); }, 420);
        setTimeout(function () { react(t, "chomp"); }, 260);
        setTimeout(function () { chompMouth(t); }, 330);
      } else {
        p.el.classList.add("is-done");
        chompMouth(t);
      }
      updateStatus();
      say("correct");
      var all = sortedCount === pieces.length;
      var moreRules = all && level.rules && ruleIdx < level.rules.length - 1;
      announce(cfg.phrases.correct + " " + name + " went to the " + targetLabel(t) + ". " +
        (moreRules ? "All sorted. " : all ? cfg.phrases.finish + " " : sortedCount + " of " + pieces.length + " sorted. ") +
        "Score " + score + ".");
      if (moreRules) {
        nextRule();
      } else if (all) {
        finished = true;
        stopScan();
        say("finish", true);
        setTimeout(showWin, settings.animation ? 1100 : 500);
      } else if (hadFocus || how === "key") {
        // Keep keyboard and screen reader users moving: go to the next shape.
        var next = nextRemaining(p.slot);
        if (next) next.el.focus();
      }
    } else {
      say("wrong");
      react(t, "nope");
      returnHome(p);
      announce(cfg.phrases.wrong + ". The " + p.label.toLowerCase() + " went back to the bar.");
      if (hadFocus || how === "key") p.el.focus();
    }
    if (settings.scanning && !finished) {
      // Back to the shapes: the same shape after a miss, the next one after a match.
      scan.phase = "piece"; scan.laps = 0;
      scan.idx = Math.max(0, scanItems().indexOf(nextRemaining(p.slot - 1)));
      paintScan();
      restartScanTimer();
    }
  }

  function nextRemaining(fromSlot) {
    var left = remaining();
    if (!left.length) return null;
    var sorted = left.slice().sort(function (a, b) { return a.slot - b.slot; });
    for (var i = 0; i < sorted.length; i++) if (sorted[i].slot > fromSlot) return sorted[i];
    return sorted[0];
  }

  function returnHome(p) {
    p.el.style.transform = "";
    if (settings.animation) {
      p.el.classList.remove("shake");
      void p.el.offsetWidth;
      p.el.classList.add("shake");
      setTimeout(function () { p.el.classList.remove("shake"); }, 900);
    }
  }

  // If the level has a closed-mouth picture, the monster closes and opens
  // its mouth twice: chomp, chomp.
  function chompMouth(t) {
    var closed = t.def.monsterClosed;
    if (!closed) return;
    var img = t.el.querySelector(".monster");
    clearTimeout(t.chompTimer);
    var steps = [closed, t.def.monster, closed, t.def.monster];
    var i = 0;
    (function next() {
      img.src = steps[i];
      i += 1;
      if (i < steps.length) t.chompTimer = setTimeout(next, i % 2 ? 200 : 140);
    })();
  }

  function react(t, cls) {
    if (!settings.animation) return;
    t.el.classList.remove("chomp", "nope");
    void t.el.offsetWidth;
    t.el.classList.add(cls);
    setTimeout(function () { t.el.classList.remove(cls); }, 700);
  }

  /* ---------- Tap and keyboard ---------- */
  function onPieceClick(p, e) {
    if (settings.scanning) return;
    if (Date.now() - p.lastDrag < 600) return; // the click that ends a drag
    if (Date.now() - p.lastTap < 800) return;  // already chosen on pointerup
    unlockAudio();
    // Keyboard, VoiceOver and ChromeVox send clicks with detail 0: move them on to the monsters.
    select(p, e.detail === 0);
  }

  function onTargetClick(i, e) {
    if (settings.scanning) return;
    unlockAudio();
    var t = targets[i];
    if (!selected) {
      react(t, "nope");
      announce(targetLabel(t) + ". Choose a shape first.");
      return;
    }
    attempt(selected, t, e.detail === 0 ? "key" : "tap");
  }

  function onPieceKey(p, e) {
    if (settings.scanning) return;
    var left = remaining().sort(function (a, b) { return a.slot - b.slot; });
    var i = left.indexOf(p);
    var next = null;
    switch (e.key) {
      case "ArrowRight": case "ArrowDown": next = left[(i + 1) % left.length]; break;
      case "ArrowLeft": case "ArrowUp": next = left[(i - 1 + left.length) % left.length]; break;
      case "Home": next = left[0]; break;
      case "End": next = left[left.length - 1]; break;
      case "Escape": if (selected) { e.preventDefault(); deselect(true); } return;
      default: return;
    }
    e.preventDefault();
    if (next) next.el.focus();
  }

  function onTargetKey(e) {
    if (settings.scanning) return;
    var i = Number(e.currentTarget.dataset.index);
    var n = targets.length;
    var next = -1;
    switch (e.key) {
      case "ArrowRight": case "ArrowDown": next = (i + 1) % n; break;
      case "ArrowLeft": case "ArrowUp": next = (i - 1 + n) % n; break;
      case "Escape":
        if (selected) { e.preventDefault(); var p = selected; deselect(true); p.el.focus(); }
        return;
      default: return;
    }
    e.preventDefault();
    targets[next].el.focus();
  }

  /* ---------- Drag and drop ---------- */
  var drag = null;
  var DRAG_START_PX = 8;

  function onPiecePointerDown(p, e) {
    if (settings.scanning || finished || p.done) return;
    if (e.button !== undefined && e.button !== 0) return;
    if (drag) return;
    unlockAudio();
    drag = { p: p, id: e.pointerId, x0: e.clientX, y0: e.clientY, moving: false, over: null };
    try { p.el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    p.el.addEventListener("pointermove", onDragMove);
    p.el.addEventListener("pointerup", onDragEnd);
    p.el.addEventListener("pointercancel", onDragCancel);
    p.el.addEventListener("lostpointercapture", onDragCancel);
  }

  function sceneUnits(clientX, clientY) {
    var r = scene.getBoundingClientRect();
    return { x: (clientX - r.left) / unit, y: (clientY - r.top) / unit };
  }

  // Which monster is under this point? Generous: the whole gray shape plus a margin.
  function targetAt(pt) {
    var best = null, bestD = Infinity;
    targets.forEach(function (t) {
      if (t.zone) {
        if (pt.x >= t.zone.x0 && pt.x < t.zone.x1 && pt.y >= t.zone.y0 && pt.y <= t.zone.y1) { best = t; bestD = -1; }
        return;
      }
      var half = t.size / 2 + 40;
      var dx = pt.x - t.cx, dy = pt.y - t.cy;
      if (Math.abs(dx) <= half && Math.abs(dy) <= half) {
        var d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = t; }
      }
    });
    return best;
  }

  function onDragMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moving) {
      if (Math.abs(dx) < DRAG_START_PX && Math.abs(dy) < DRAG_START_PX) return;
      drag.moving = true;
      if (selected && selected !== drag.p) deselect(false);
      if (selected === drag.p) { drag.p.el.classList.remove("is-selected"); }
      drag.p.el.classList.add("is-dragging");
    }
    e.preventDefault();
    drag.p.el.style.transform = "translate(" + dx + "px," + dy + "px) scale(1.12)";
    var t = targetAt(sceneUnits(e.clientX, e.clientY));
    if (t !== drag.over) {
      if (drag.over) drag.over.el.classList.remove("is-over");
      if (t) t.el.classList.add("is-over");
      drag.over = t;
    }
  }

  function endDragListeners(p) {
    p.el.removeEventListener("pointermove", onDragMove);
    p.el.removeEventListener("pointerup", onDragEnd);
    p.el.removeEventListener("pointercancel", onDragCancel);
    p.el.removeEventListener("lostpointercapture", onDragCancel);
    p.el.classList.remove("is-dragging");
    targets.forEach(function (t) { t.el.classList.remove("is-over"); });
  }

  function onDragEnd(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag;
    drag = null;
    endDragListeners(d.p);
    if (!d.moving) {
      // A plain tap chooses the shape. Handled here, not on click, because
      // Chrome sometimes skips the click on a touch screen right after a drag.
      d.p.lastTap = Date.now();
      select(d.p, false);
      return;
    }
    d.p.lastDrag = Date.now();
    var t = targetAt(sceneUnits(e.clientX, e.clientY));
    if (selected === d.p) deselect(false);
    if (t) {
      attempt(d.p, t, "drag");
    } else {
      // Dropped somewhere else: float back to the bar quietly.
      d.p.el.style.transform = "";
      announce("The " + d.p.label.toLowerCase() + " went back to the bar.");
    }
  }

  function onDragCancel(e) {
    if (!drag || (e.pointerId !== undefined && e.pointerId !== drag.id)) return;
    if (e.type === "lostpointercapture" && !drag.moving) {
      // Some browsers drop capture on a plain tap; nothing to undo.
      var q = drag; drag = null; endDragListeners(q.p); return;
    }
    cancelDrag();
  }

  function cancelDrag() {
    if (!drag) return;
    var d = drag;
    drag = null;
    endDragListeners(d.p);
    if (d.moving) d.p.lastDrag = Date.now();
    if (!d.p.done) d.p.el.style.transform = "";
  }

  /* ---------- Win ---------- */
  function showWin() {
    root.classList.add("won");
    $("win-title").textContent = cfg.phrases.finish;
    $("btn-next").hidden = settings.level >= cfg.levels.length - 1;
    $("btn-win-start-over").hidden = settings.level === 0;
    showPanel("panel-win", null, $("btn-again"));
  }
  function hideWin() {
    if (openPanel && openPanel.id === "panel-win") hidePanel(true);
  }

  /* ---------- Switch scanning ---------- */
  var scan = { timer: null, phase: "piece", idx: 0, laps: 0 };

  function scanItems() {
    if (scan.phase === "piece") return remaining().sort(function (a, b) { return a.slot - b.slot; });
    return targets;
  }
  function paintScan() {
    var items = scanItems();
    pieces.concat(targets).forEach(function (x) { x.el.classList.remove("scan-on"); });
    if (!settings.scanning || finished || !items.length) return;
    if (scan.idx >= items.length) scan.idx = 0;
    items[scan.idx].el.classList.add("scan-on");
  }
  function scanTick() {
    var items = scanItems();
    if (!items.length) return;
    scan.idx += 1;
    if (scan.idx >= items.length) {
      scan.idx = 0;
      if (scan.phase === "target") {
        scan.laps += 1;
        if (scan.laps >= 3) { // nothing chosen after three passes: back to the shapes
          deselect(true);
          scan.phase = "piece";
        }
      }
    }
    paintScan();
  }
  function restartScanTimer() {
    clearInterval(scan.timer);
    if (!settings.scanning || finished) return;
    scan.timer = setInterval(scanTick, Math.max(0.5, Number(settings.scanSeconds) || 2) * 1000);
  }
  function startScan() {
    clearInterval(scan.timer);
    scan.phase = "piece"; scan.idx = 0; scan.laps = 0;
    deselect(false);
    root.classList.add("scanning");
    $("scan-hint").hidden = false;
    paintScan();
    restartScanTimer();
    fitScene();
  }
  function stopScan() {
    clearInterval(scan.timer);
    scan.timer = null;
    root.classList.remove("scanning");
    $("scan-hint").hidden = true;
    pieces.concat(targets).forEach(function (x) { x.el.classList.remove("scan-on"); });
    fitScene();
  }
  function pauseScan() { clearInterval(scan.timer); scan.timer = null; }
  function scanSelect() {
    if (finished) return;
    unlockAudio();
    var items = scanItems();
    if (!items.length) return;
    var item = items[Math.min(scan.idx, items.length - 1)];
    if (scan.phase === "piece") {
      select(item, false);
      scan.phase = "target"; scan.idx = 0; scan.laps = 0;
      paintScan();
      restartScanTimer();
    } else {
      attempt(selected, item, "scan");
    }
  }

  document.addEventListener("keydown", function (e) {
    if (!settings.scanning || openPanel) return;
    if (e.key !== " " && e.key !== "Enter" && e.key !== "Spacebar") return;
    if (e.target.closest && e.target.closest(".actions, .fs-exit")) return; // let toolbar buttons work
    e.preventDefault();
    if (!e.repeat) scanSelect();
  });
  stage.addEventListener("pointerdown", function (e) {
    if (!settings.scanning || openPanel) return;
    e.preventDefault();
    scanSelect();
  });

  /* ---------- Panels ---------- */
  var openPanel = null;
  var returnFocus = null;

  function showPanel(id, opener, focusEl) {
    if (openPanel) hidePanel(true);
    openPanel = $(id);
    returnFocus = opener || document.activeElement;
    openPanel.hidden = false;
    $("app").setAttribute("aria-hidden", "true");
    if (settings.scanning) pauseScan();
    var f = focusEl || openPanel.querySelector("h2");
    setTimeout(function () { f.focus(); }, 30);
  }
  function hidePanel(silent) {
    if (!openPanel) return;
    var wasWin = openPanel.id === "panel-win";
    openPanel.hidden = true;
    openPanel = null;
    $("app").removeAttribute("aria-hidden");
    if (silent) return;
    if (wasWin) {
      // Closing the win message starts a new game.
      newGame(false);
      var first = nextRemaining(-1);
      if (first && !settings.scanning) first.el.focus();
      return;
    }
    if (settings.scanning) {
      restartScanTimer();
      scene.focus();
    } else if (returnFocus && returnFocus.focus) {
      returnFocus.focus();
    }
  }
  document.querySelectorAll(".overlay").forEach(function (ov) {
    ov.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) { hidePanel(); return; }
      if (e.target === ov && ov.id !== "panel-win") hidePanel();
    });
  });
  document.addEventListener("keydown", function (e) {
    if (!openPanel) return;
    if (e.key === "Escape") { e.preventDefault(); hidePanel(); return; }
    if (e.key === "Tab") { // keep focus inside the open panel
      var items = openPanel.querySelectorAll("button:not([hidden]), input, select, [tabindex='0']");
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === openPanel.querySelector("h2"))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
  });

  /* ---------- Settings controls ---------- */
  function applySettings() {
    root.classList.toggle("hc", !!settings.highContrast);
    root.classList.toggle("no-motion", !settings.animation);
  }
  function bindSettings() {
    var voice = $("set-voice"), vol = $("set-volume"), anim = $("set-animation"),
        hc = $("set-contrast"), scanBox = $("set-scanning"), speed = $("set-scan-speed"),
        levelSel = $("set-level");
    voice.checked = !!settings.voice;
    var style = $("set-voice-style");
    style.value = voiceStyle();
    style.addEventListener("change", function () {
      settings.voiceStyle = style.value; saveSettings();
      unlockAudio(); say("correct");
    });
    vol.value = settings.volume;
    vol.setAttribute("aria-valuetext", settings.volume + " percent");
    anim.checked = !!settings.animation;
    hc.checked = !!settings.highContrast;
    scanBox.checked = !!settings.scanning;
    speed.value = String(settings.scanSeconds);
    if (!speed.value) speed.value = "2";

    if (cfg.levels.length > 1) {
      $("field-level").hidden = false;
      cfg.levels.forEach(function (l, i) {
        var o = document.createElement("option");
        o.value = String(i);
        o.textContent = "Level " + (i + 1) + (l.name ? ": " + l.name : "");
        levelSel.appendChild(o);
      });
      levelSel.value = String(settings.level);
      levelSel.addEventListener("change", function () {
        settings.level = Number(levelSel.value); saveSettings(); buildLevel();
      });
    }

    voice.addEventListener("change", function () { settings.voice = voice.checked; saveSettings(); if (voice.checked) { unlockAudio(); say("correct"); } });
    vol.addEventListener("input", function () {
      settings.volume = Number(vol.value);
      vol.setAttribute("aria-valuetext", vol.value + " percent");
      saveSettings();
    });
    vol.addEventListener("change", function () { unlockAudio(); say("correct"); });
    anim.addEventListener("change", function () { settings.animation = anim.checked; saveSettings(); applySettings(); });
    hc.addEventListener("change", function () { settings.highContrast = hc.checked; saveSettings(); applySettings(); });
    scanBox.addEventListener("change", function () {
      settings.scanning = scanBox.checked; saveSettings();
      if (settings.scanning) { startScan(); pauseScan(); } else { stopScan(); }
    });
    speed.addEventListener("change", function () { settings.scanSeconds = Number(speed.value); saveSettings(); });
  }

  /* ---------- Full screen ---------- */
  function isStandalone() {
    return window.navigator.standalone === true ||
      (window.matchMedia && (window.matchMedia("(display-mode: standalone)").matches ||
                             window.matchMedia("(display-mode: fullscreen)").matches));
  }
  function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function fsSupported() {
    return !!((root.requestFullscreen || root.webkitRequestFullscreen) &&
              (document.fullscreenEnabled || document.webkitFullscreenEnabled));
  }
  // In full screen, hide the top bar and show only an exit button.
  // iPhone Safari (and some other browsers) can't make a page full screen.
  // There the button still hides the top bar and shows only the exit button,
  // and the first time it explains Add to Home Screen for true full screen.
  var pseudoFs = false;
  function fallbackFullscreen() {
    pseudoFs = true;
    updateFsButton();
    fitScene();
    if (!settings.fsTipSeen && !isStandalone()) {
      settings.fsTipSeen = true;
      saveSettings();
      showPanel("panel-fullscreen", $("btn-exit-fs"));
    }
  }
  function updateFsButton() {
    var on = !!fsElement() || pseudoFs;
    var wasOn = root.classList.contains("is-fullscreen");
    root.classList.toggle("is-fullscreen", on);
    $("btn-exit-fs").hidden = !on;
    $("fullscreen-label").textContent = on ? "Exit full screen" : "Full screen";
    if (on && !wasOn) {
      // The button that was pressed is now hidden: move focus into the game.
      var first = nextRemaining(-1);
      if (!settings.scanning && first) first.el.focus(); else scene.focus();
      announce("Full screen. To leave, use the Exit full screen button in the top corner.");
    } else if (!on && wasOn) {
      $("btn-fullscreen").focus();
    }
  }
  function toggleFullscreen(e) {
    if (pseudoFs) { pseudoFs = false; updateFsButton(); fitScene(); return; }
    if (fsElement()) {
      var exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) { var p = exit.call(document); if (p && p.catch) p.catch(function () {}); }
      return;
    }
    if (!fsSupported() || isStandalone()) { fallbackFullscreen(); return; }
    try {
      var req = root.requestFullscreen ? root.requestFullscreen() : root.webkitRequestFullscreen();
      if (req && req.catch) req.catch(fallbackFullscreen);
    } catch (err) {
      fallbackFullscreen();
    }
  }
  document.addEventListener("fullscreenchange", function () { updateFsButton(); fitScene(); });
  document.addEventListener("webkitfullscreenchange", function () { updateFsButton(); fitScene(); });

  /* ---------- Start ---------- */
  if (!cfg.levels.length) {
    statusEl.textContent = "No levels found in js/config.js.";
    return;
  }
  applySettings();
  bindSettings();
  fitScene();
  buildLevel();

  $("btn-new").addEventListener("click", function () { unlockAudio(); newGame(false, true, true); });
  $("btn-directions").addEventListener("click", function () {
    unlockAudio();
    var text = (level.directions || "") + (activeRule() ? " " + ruleDirections(activeRule()) : "");
    announce(text);
    speak(text, false);
  });
  $("btn-settings").addEventListener("click", function (e) { showPanel("panel-settings", e.currentTarget); });
  $("btn-again").addEventListener("click", function () { hidePanel(); });
  // Start over: back to Level 1 with the score at 0.
  function startOver() {
    unlockAudio();
    hidePanel(true);
    settings.level = 0;
    saveSettings();
    // Drop a ?level=2 from the address so reloading the page stays on Level 1.
    try {
      if (/[?&]level=/.test(location.search) && history.replaceState) {
        history.replaceState(null, "", location.pathname + location.hash);
      }
    } catch (e) { /* ignore */ }
    var sel = $("set-level"); if (sel) sel.value = "0";
    score = 0;
    buildLevel();
    announce("Starting over at level 1. " + (level.directions || ""));
    var first = nextRemaining(-1);
    if (first && !settings.scanning) first.el.focus();
  }
  $("btn-start-over").addEventListener("click", startOver);
  $("btn-win-start-over").addEventListener("click", startOver);
  $("btn-next").addEventListener("click", function () {
    hidePanel(true);
    settings.level = Math.min(cfg.levels.length - 1, settings.level + 1);
    saveSettings();
    var sel = $("set-level"); if (sel) sel.value = String(settings.level);
    buildLevel();
    var first = nextRemaining(-1);
    if (first && !settings.scanning) first.el.focus();
  });
  var fsBtn = $("btn-fullscreen");
  // Opened from the Home Screen: start full screen (top bar hidden, only the
  // Exit full screen button showing), which brings back the buttons if needed.
  if (isStandalone()) { pseudoFs = true; updateFsButton(); fitScene(); }
  fsBtn.addEventListener("click", toggleFullscreen);
  $("btn-exit-fs").addEventListener("click", toggleFullscreen);


  if (window.ResizeObserver) new ResizeObserver(fitScene).observe(stage);
  window.addEventListener("resize", fitScene);
  window.addEventListener("orientationchange", function () { setTimeout(fitScene, 200); });
})();
