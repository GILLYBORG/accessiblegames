/*
 * Peek and Find - game logic.
 * You should not need to edit this file. Change pictures and sounds in js/config.js.
 */
(function () {
  "use strict";

  /* ---------- Config ---------- */
  var userCfg = window.GAME_CONFIG || {};
  var cfg = {
    title: userCfg.title || "Peek and Find",
    rows: clampInt(userCfg.rows, 1, 10, 5),
    columns: clampInt(userCfg.columns, 1, 10, 5),
    coverImage: userCfg.coverImage || { src: "images/cover.svg", alt: "Covered" },
    revealImage: userCfg.revealImage || { src: "images/reveal.svg", alt: "Apple" },
    specialImage: userCfg.specialImage || { src: "images/special.svg", alt: "Star" },
    specialMessage: userCfg.specialMessage || "You found it!",
    revealSound: userCfg.revealSound || "",
    specialSound: userCfg.specialSound || "",
    coverSound: userCfg.coverSound || "",
    tapSound: userCfg.tapSound === undefined ? "sounds/sniff.wav" : userCfg.tapSound,
    tapSoundLength: typeof userCfg.tapSoundLength === "number" ? userCfg.tapSoundLength : 0.6,
    flipBack: userCfg.flipBack !== false,
    defaults: Object.assign({
      sound: true, volume: 80, animation: true, highContrast: false,
      scanning: false, scanSeconds: 2
    }, userCfg.defaults || {})
  };
  var total = cfg.rows * cfg.columns;

  function clampInt(v, lo, hi, dflt) {
    v = parseInt(v, 10);
    if (isNaN(v)) return dflt;
    return Math.max(lo, Math.min(hi, v));
  }

  /* ---------- Settings (remembered on this device) ---------- */
  var STORE_KEY = "peek-and-find.settings";
  var prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var settings = Object.assign({}, cfg.defaults);
  if (prefersReduced) settings.animation = false;
  try {
    var saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (saved && typeof saved === "object") Object.assign(settings, saved);
  } catch (e) { /* storage unavailable: use defaults */ }

  function saveSettings() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
  }

  /* ---------- Elements ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var board = $("board");
  var stage = $("stage");
  var statusEl = $("status");
  var live = $("live");
  var tiles = [];

  /* ---------- Game state ---------- */
  var state = { open: [], special: -1, foundSpecial: false };

  /* ---------- Sound ---------- */
  var audioCtx = null;
  var fileSounds = {};

  function ensureAudio() {
    try {
      // Safari 16.4+: play even when the iPad's silent switch is on.
      if (navigator.audioSession) navigator.audioSession.type = "playback";
    } catch (e) { /* ignore */ }
    if (!audioCtx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        try { audioCtx = new Ctx(); } catch (e) { audioCtx = null; }
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(function () {});
    }
    Object.keys(fileSounds).forEach(function (k) { decodeEntry(fileSounds[k]); });
  }

  // Sound files: decoded through Web Audio where possible (so the volume
  // setting works on iPad), otherwise played with a plain audio element.
  function loadFileSound(name, src) {
    if (!src || src === "none") return;
    var entry = { src: src, el: null, data: null, buffer: null };
    fileSounds[name] = entry;
    if (window.fetch && location.protocol !== "file:") {
      fetch(src).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.arrayBuffer();
      }).then(function (data) { entry.data = data; decodeEntry(entry); })
        .catch(function () { entry.el = makeEl(src); });
    } else {
      entry.el = makeEl(src);
    }
  }
  function makeEl(src) { var a = new Audio(); a.preload = "auto"; a.src = src; return a; }
  function decodeEntry(entry) {
    if (!audioCtx || !entry.data || entry.buffer || entry.decoding) return;
    entry.decoding = true;
    var data = entry.data; entry.data = null;
    var done = function (buf) { entry.buffer = buf; };
    var fail = function () { entry.el = makeEl(entry.src); };
    try {
      var p = audioCtx.decodeAudioData(data, done, fail);
      if (p && p.catch) p.catch(fail);
    } catch (e) { fail(); }
  }
  function playFile(entry, vol, delay) {
    if (entry.buffer && audioCtx) {
      var srcNode = audioCtx.createBufferSource();
      var gain = audioCtx.createGain();
      srcNode.buffer = entry.buffer;
      gain.gain.value = vol;
      srcNode.connect(gain).connect(audioCtx.destination);
      srcNode.start(audioCtx.currentTime + (delay || 0));
      return true;
    }
    var el = entry.el || (entry.el = makeEl(entry.src));
    var play = function () {
      try {
        var clip = el.cloneNode(true);
        clip.volume = vol;
        var p = clip.play();
        if (p && p.catch) p.catch(function () {});
      } catch (e) { /* ignore */ }
    };
    if (delay) setTimeout(play, delay * 1000); else play();
    return true;
  }
  loadFileSound("tap", cfg.tapSound);
  loadFileSound("reveal", cfg.revealSound);
  loadFileSound("special", cfg.specialSound);
  loadFileSound("cover", cfg.coverSound);

  function tone(freq, start, dur, type, peak) {
    var t0 = audioCtx.currentTime + start;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // kind: "tap", "reveal", "cover" or "special". delay is in seconds.
  function playSound(kind, delay) {
    if (!settings.sound) return;
    var vol = Math.max(0, Math.min(100, settings.volume)) / 100;
    if (vol === 0) return;
    var setting = { tap: cfg.tapSound, reveal: cfg.revealSound, cover: cfg.coverSound, special: cfg.specialSound }[kind];
    if (setting === "none") return;
    ensureAudio();
    var file = fileSounds[kind];
    if (file && playFile(file, vol, delay)) return;
    if (kind === "tap") return; // no built-in tap sound
    if (!audioCtx) return;
    var peak = 0.35 * vol + 0.0002;
    var d = delay || 0;
    if (kind === "special") {
      // Bright rising arpeggio, clearly different from the normal reveal.
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (f, i) {
        tone(f, d + i * 0.11, 0.5, "triangle", peak);
      });
      tone(1567.98, d + 0.6, 0.9, "sine", peak * 0.7);
    } else if (kind === "cover") {
      // Falling two notes for flipping a square back.
      tone(880, d + 0, 0.18, "sine", peak * 0.8);
      tone(587.33, d + 0.08, 0.28, "sine", peak * 0.7);
    } else {
      // Soft two-note "pop".
      tone(587.33, d + 0, 0.18, "sine", peak);
      tone(880, d + 0.08, 0.28, "sine", peak * 0.8);
    }
  }

  // Every press plays the tap sound first, then the picture's own sound.
  function playPress(kind) {
    var hasTap = settings.sound && cfg.tapSound && cfg.tapSound !== "none";
    if (hasTap) playSound("tap");
    playSound(kind, hasTap ? cfg.tapSoundLength : 0);
  }

  /* ---------- Announcements for screen readers ---------- */
  var announceTimer = null;
  function announce(text) {
    live.textContent = "";
    clearTimeout(announceTimer);
    announceTimer = setTimeout(function () { live.textContent = text; }, 60);
  }

  /* ---------- Board ---------- */
  function preload(src) { var i = new Image(); i.src = src; }

  function buildBoard() {
    document.title = cfg.title;
    $("game-title").textContent = cfg.title;
    $("board-label").textContent = cfg.title + " board, " + cfg.rows + " rows by " + cfg.columns + " columns";
    board.style.setProperty("--cols", cfg.columns);
    board.style.setProperty("--rows", cfg.rows);
    [cfg.coverImage.src, cfg.revealImage.src, cfg.specialImage.src].forEach(preload);

    var frag = document.createDocumentFragment();
    for (var i = 0; i < total; i++) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tile";
      btn.dataset.index = String(i);
      btn.tabIndex = i === 0 ? 0 : -1;
      btn.innerHTML =
        '<span class="flip">' +
          '<span class="face face-cover"><img alt="" draggable="false"></span>' +
          '<span class="face face-reveal"><img alt="" draggable="false"></span>' +
        "</span>";
      btn.querySelector(".face-cover img").src = cfg.coverImage.src;
      frag.appendChild(btn);
      tiles.push(btn);
    }
    board.appendChild(frag);
    board.addEventListener("click", onBoardClick);
    board.addEventListener("keydown", onBoardKey);
  }

  function rowCol(i) { return { r: Math.floor(i / cfg.columns), c: i % cfg.columns }; }

  function tileLabel(i) {
    var rc = rowCol(i);
    var where = "Row " + (rc.r + 1) + ", column " + (rc.c + 1);
    if (!state.open[i]) return where + ", " + cfg.coverImage.alt;
    return where + ", " + (i === state.special ? cfg.specialImage.alt : cfg.revealImage.alt);
  }

  function pickSpecial() {
    var prev = state.special;
    var next;
    do { next = Math.floor(Math.random() * total); } while (total > 1 && next === prev);
    return next;
  }

  function newGame(isFirst) {
    state.open = new Array(total).fill(false);
    state.special = pickSpecial();
    state.foundSpecial = false;
    tiles.forEach(function (t, i) {
      t.classList.remove("is-open", "is-special");
      t.setAttribute("aria-label", tileLabel(i));
      var back = t.querySelector(".face-reveal img");
      // Set the hidden picture only when a tile opens.
      back.removeAttribute("src");
    });
    updateStatus();
    if (!isFirst) {
      announce("New game. All squares are covered.");
      playSound("reveal");
    }
    if (settings.scanning) startScan();
  }

  function openCount() { return state.open.filter(Boolean).length; }

  function updateStatus() {
    var n = openCount();
    var text = n + " of " + total + " open";
    if (state.foundSpecial) text = cfg.specialMessage + " " + text;
    statusEl.textContent = text;
  }

  function reveal(i) {
    var t = tiles[i];
    var isSpecial = i === state.special;
    var picture = isSpecial ? cfg.specialImage : cfg.revealImage;
    if (state.open[i]) {
      if (!cfg.flipBack) {
        // Flip back turned off: replay the sound and name the picture again.
        playPress(isSpecial ? "special" : "reveal");
        announce(picture.alt);
        return;
      }
      // Already open: flip it back to the cover.
      state.open[i] = false;
      t.classList.remove("is-open", "is-special");
      t.setAttribute("aria-label", tileLabel(i));
      playPress("cover");
      updateStatus();
      announce(cfg.coverImage.alt + ".");
      return;
    }
    state.open[i] = true;
    t.querySelector(".face-reveal img").src = picture.src;
    t.classList.add("is-open");
    if (isSpecial) {
      t.classList.add("is-special");
      state.foundSpecial = true;
    }
    t.setAttribute("aria-label", tileLabel(i));
    playPress(isSpecial ? "special" : "reveal");
    updateStatus();

    var msg = picture.alt + ".";
    if (isSpecial) msg = picture.alt + "! " + cfg.specialMessage;
    if (openCount() === total) msg += " All squares are open. Choose New game to play again.";
    announce(msg);
  }

  function onBoardClick(e) {
    var t = e.target.closest(".tile");
    if (!t) return;
    if (settings.scanning) return; // in scanning mode the switch chooses
    ensureAudio();
    var i = Number(t.dataset.index);
    setRoving(i);
    reveal(i);
  }

  /* Arrow keys move between squares; Tab leaves the board. */
  function setRoving(i) {
    tiles.forEach(function (t, j) { t.tabIndex = j === i ? 0 : -1; });
  }
  function onBoardKey(e) {
    if (settings.scanning) return;
    var t = e.target.closest(".tile");
    if (!t) return;
    var i = Number(t.dataset.index);
    var rc = rowCol(i);
    var next = i;
    switch (e.key) {
      case "ArrowRight": next = rc.c < cfg.columns - 1 ? i + 1 : i; break;
      case "ArrowLeft": next = rc.c > 0 ? i - 1 : i; break;
      case "ArrowDown": next = rc.r < cfg.rows - 1 ? i + cfg.columns : i; break;
      case "ArrowUp": next = rc.r > 0 ? i - cfg.columns : i; break;
      case "Home": next = e.ctrlKey ? 0 : rc.r * cfg.columns; break;
      case "End": next = e.ctrlKey ? total - 1 : rc.r * cfg.columns + cfg.columns - 1; break;
      default: return;
    }
    e.preventDefault();
    setRoving(next);
    tiles[next].focus();
  }

  /* ---------- Fit the board to the screen ---------- */
  function fitBoard() {
    var hint = $("scan-hint");
    var hintH = hint.hidden ? 0 : hint.offsetHeight + 8;
    // In full screen, make sure the exit button never covers a square.
    var exitBtn = $("btn-exit-fs");
    stage.style.setProperty("--fs-room", "0px");
    var w = stage.clientWidth;
    var h = stage.clientHeight - hintH;
    if (!exitBtn.hidden) {
      var bw = exitBtn.offsetWidth + 16, bh = exitBtn.offsetHeight + 16;
      var sizeNoRoom = Math.min(w, h * cfg.columns / cfg.rows);
      if ((w - sizeNoRoom) / 2 < bw) {
        stage.style.setProperty("--fs-room", bh + "px");
        h -= bh;
      }
    }
    var size = Math.max(120, Math.min(w, h * cfg.columns / cfg.rows));
    board.style.setProperty("--board-w", size + "px");
    board.style.setProperty("--board-h", (size * cfg.rows / cfg.columns) + "px");
  }

  /* ---------- Switch scanning ---------- */
  var scan = { timer: null, phase: "row", row: 0, col: 0, laps: 0 };

  function paintScan() {
    tiles.forEach(function (t, i) {
      var rc = rowCol(i);
      t.classList.toggle("scan-row", scan.phase === "row" && rc.r === scan.row);
      t.classList.toggle("scan-cell", scan.phase === "cell" && rc.r === scan.row && rc.c === scan.col);
    });
  }
  function scanTick() {
    if (scan.phase === "row") {
      scan.row = (scan.row + 1) % cfg.rows;
    } else {
      scan.col += 1;
      if (scan.col >= cfg.columns) {
        scan.col = 0;
        scan.laps += 1;
        if (scan.laps >= 2) { // nothing chosen after two passes: go back to rows
          scan.phase = "row";
        }
      }
    }
    paintScan();
  }
  function restartScanTimer() {
    clearInterval(scan.timer);
    scan.timer = setInterval(scanTick, Math.max(0.5, Number(settings.scanSeconds) || 2) * 1000);
  }
  function startScan() {
    stopScan();
    scan.phase = cfg.rows > 1 ? "row" : "cell";
    scan.row = 0; scan.col = 0; scan.laps = 0;
    document.documentElement.classList.add("scanning");
    $("scan-hint").hidden = false;
    paintScan();
    restartScanTimer();
    fitBoard();
  }
  function stopScan() {
    clearInterval(scan.timer);
    scan.timer = null;
    document.documentElement.classList.remove("scanning");
    $("scan-hint").hidden = true;
    tiles.forEach(function (t) { t.classList.remove("scan-row", "scan-cell"); });
    fitBoard();
  }
  function pauseScan() { clearInterval(scan.timer); scan.timer = null; }
  function scanSelect() {
    ensureAudio();
    if (scan.phase === "row") {
      scan.phase = "cell"; scan.col = 0; scan.laps = 0;
    } else {
      reveal(scan.row * cfg.columns + scan.col);
      if (cfg.rows > 1) scan.phase = "row";
      scan.col = 0; scan.laps = 0;
    }
    paintScan();
    restartScanTimer();
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

  function showPanel(id, opener) {
    openPanel = $(id);
    returnFocus = opener || document.activeElement;
    openPanel.hidden = false;
    $("app").setAttribute("aria-hidden", "true");
    if (settings.scanning) pauseScan();
    var heading = openPanel.querySelector("h2");
    setTimeout(function () { heading.focus(); }, 30);
  }
  function hidePanel() {
    if (!openPanel) return;
    openPanel.hidden = true;
    openPanel = null;
    $("app").removeAttribute("aria-hidden");
    if (settings.scanning) {
      // Put focus on the board so the next switch press picks a square
      // instead of pressing a toolbar button again.
      restartScanTimer();
      board.focus();
    } else if (returnFocus && returnFocus.focus) {
      returnFocus.focus();
    }
  }
  document.querySelectorAll(".overlay").forEach(function (ov) {
    ov.addEventListener("click", function (e) {
      if (e.target === ov || e.target.closest("[data-close]")) hidePanel();
    });
  });
  document.addEventListener("keydown", function (e) {
    if (!openPanel) return;
    if (e.key === "Escape") { e.preventDefault(); hidePanel(); return; }
    if (e.key === "Tab") { // keep focus inside the open panel
      var items = openPanel.querySelectorAll("button, input, select, [tabindex='0']");
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
    document.documentElement.classList.toggle("hc", !!settings.highContrast);
    document.documentElement.classList.toggle("no-motion", !settings.animation);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && settings.highContrast) meta.content = "#000000";
  }
  function bindSettings() {
    var sound = $("set-sound"), vol = $("set-volume"), anim = $("set-animation"),
        hc = $("set-contrast"), scanBox = $("set-scanning"), speed = $("set-scan-speed");
    sound.checked = !!settings.sound;
    vol.value = settings.volume;
    vol.setAttribute("aria-valuetext", settings.volume + " percent");
    anim.checked = !!settings.animation;
    hc.checked = !!settings.highContrast;
    scanBox.checked = !!settings.scanning;
    speed.value = String(settings.scanSeconds);
    if (!speed.value) speed.value = "2";

    sound.addEventListener("change", function () { settings.sound = sound.checked; saveSettings(); if (sound.checked) playSound("reveal"); });
    vol.addEventListener("input", function () {
      settings.volume = Number(vol.value);
      vol.setAttribute("aria-valuetext", vol.value + " percent");
      saveSettings();
    });
    vol.addEventListener("change", function () { playSound("reveal"); });
    anim.addEventListener("change", function () { settings.animation = anim.checked; saveSettings(); applySettings(); });
    hc.addEventListener("change", function () { settings.highContrast = hc.checked; saveSettings(); applySettings(); });
    scanBox.addEventListener("change", function () {
      settings.scanning = scanBox.checked; saveSettings();
      if (settings.scanning) { startScan(); pauseScan(); } else { stopScan(); }
    });
    speed.addEventListener("change", function () { settings.scanSeconds = Number(speed.value); saveSettings(); });
  }

  /* ---------- Full screen ---------- */
  var root = document.documentElement;
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
  function updateFsButton() {
    var on = !!fsElement();
    var wasOn = root.classList.contains("is-fullscreen");
    root.classList.toggle("is-fullscreen", on);
    $("btn-exit-fs").hidden = !on;
    $("fullscreen-label").textContent = on ? "Exit full screen" : "Full screen";
    if (on && !wasOn) {
      // The button that was pressed is now hidden: move focus to the board.
      var current = tiles.filter(function (t) { return t.tabIndex === 0; })[0] || tiles[0];
      if (!settings.scanning && current) current.focus(); else board.focus();
      announce("Full screen. To leave, use the Exit full screen button in the top corner.");
    } else if (!on && wasOn) {
      $("btn-fullscreen").focus();
    }
  }
  function toggleFullscreen(e) {
    var btn = e.currentTarget;
    if (fsElement()) {
      var exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) { var p = exit.call(document); if (p && p.catch) p.catch(function () {}); }
      return;
    }
    if (!fsSupported()) { showPanel("panel-fullscreen", btn); return; }
    try {
      var req = root.requestFullscreen ? root.requestFullscreen() : root.webkitRequestFullscreen();
      if (req && req.catch) req.catch(function () { showPanel("panel-fullscreen", btn); });
    } catch (err) {
      showPanel("panel-fullscreen", btn);
    }
  }
  document.addEventListener("fullscreenchange", function () { updateFsButton(); fitBoard(); });
  document.addEventListener("webkitfullscreenchange", function () { updateFsButton(); fitBoard(); });

  /* ---------- Start ---------- */
  buildBoard();
  applySettings();
  bindSettings();

  $("btn-new").addEventListener("click", function () { ensureAudio(); newGame(false); });
  $("btn-settings").addEventListener("click", function (e) { showPanel("panel-settings", e.currentTarget); });
  var fsBtn = $("btn-fullscreen");
  if (isStandalone()) fsBtn.hidden = true;
  fsBtn.addEventListener("click", toggleFullscreen);
  $("btn-exit-fs").addEventListener("click", toggleFullscreen);

  // Unlock audio on the first touch anywhere (needed on iPad).
  ["pointerdown", "keydown", "touchend"].forEach(function (ev) {
    document.addEventListener(ev, ensureAudio, { once: true, passive: true });
  });

  newGame(true);
  fitBoard();
  if (window.ResizeObserver) new ResizeObserver(fitBoard).observe(stage);
  window.addEventListener("resize", fitBoard);
  window.addEventListener("orientationchange", function () { setTimeout(fitBoard, 200); });
})();
