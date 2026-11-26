/*
 * Symbol Stamps
 * Pick a stamp, then tap the page to stamp it. Keyboard: arrows move, Enter stamps.
 * Switch scanning: the stamps light up in turn, press to stamp.
 * Nothing the student makes is saved: a refresh gives a fresh page.
 */
(function () {
  "use strict";
  var cfg = window.STAMPS_CONFIG;
  var root = document.documentElement;
  function $(id) { return document.getElementById(id); }
  var params = new URLSearchParams(location.search);

  var SIZES = { s: 0.1, m: 0.14, l: 0.2, xl: 0.27 };
  var BGS = { white: 1, cream: 1, sky: 1, grass: 1, black: 1 };
  var ASPECT = 0.75; // paper height / width

  /* ---------- Stamps: "m:dog~name" ---------- */
  function niceName(id) {
    var s = id.replace(/^to_/, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
    return s.replace(/ (\d+[a-z]?|[a-z]?\d+)$/, "");
  }
  function parseStamp(text) {
    var m = /^([ma]):([a-z0-9_-]+)(?:~(.*))?$/.exec(String(text || "").trim());
    if (!m) return null;
    if (m[1] === "a" && !/^\d+$/.test(m[2])) return null;
    var label = (m[3] || "").replace(/[|~]/g, " ").trim().slice(0, 40);
    return { lib: m[1], id: m[2], label: label || (m[1] === "m" ? niceName(m[2]) : "picture") };
  }
  function stampCode(st, withLabel) {
    var code = st.lib + ":" + st.id;
    var def = st.lib === "m" ? niceName(st.id) : "";
    if (withLabel !== false && st.label && st.label !== def) code += "~" + st.label;
    return code;
  }
  function stampSrc(st) {
    return st.lib === "a" ? cfg.arasaac.image(st.id) : "symbols/mulberry/" + st.id + ".svg";
  }
  function parseList(text) {
    var out = [], seen = {};
    String(text || "").split("|").forEach(function (t) {
      var st = parseStamp(t);
      if (st && !seen[st.lib + st.id] && out.length < cfg.maxStamps) { seen[st.lib + st.id] = 1; out.push(st); }
    });
    return out;
  }

  /* ---------- Saved settings (this device) ---------- */
  var SETTINGS_KEY = "symbol-stamps-settings", SETUP_KEY = "symbol-stamps-setup";
  var settings = { voice: true, sounds: true, volume: 80, animation: true, highContrast: false,
                   scan: false, spot: "next", scanMode: "auto", speed: 2, wait: 0.25, fsTipSeen: false };
  try { var saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); for (var k in saved) if (k in settings) settings[k] = saved[k]; } catch (e) { /* ignore */ }
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ } }
  // Links can set switch options: &scan=1 &spot=next|random|choose &scanmode=auto|step &speed=2
  if (params.has("scan")) settings.scan = params.get("scan") !== "0";
  if (/^(next|random|choose)$/.test(params.get("spot") || "")) settings.spot = params.get("spot");
  if (/^(auto|step)$/.test(params.get("scanmode") || "")) settings.scanMode = params.get("scanmode");
  var spd = parseFloat(params.get("speed"));
  if (spd >= 0.5 && spd <= 6) settings.speed = spd;

  /* ---------- Teacher setup (from the link, else this device) ---------- */
  function defaultSetup() {
    return { stamps: parseList(cfg.defaultStamps.join("|")), size: "m", bg: "white", words: false };
  }
  var setup = defaultSetup();
  var fromLink = params.has("s");
  if (fromLink) {
    var list = parseList(params.get("s"));
    if (list.length) setup.stamps = list;
    if (SIZES[params.get("size")]) setup.size = params.get("size");
    if (BGS[params.get("bg")]) setup.bg = params.get("bg");
    setup.words = params.get("words") === "1";
  } else {
    try {
      var ss = JSON.parse(localStorage.getItem(SETUP_KEY) || "null");
      if (ss && ss.s) {
        var l2 = parseList(ss.s);
        if (l2.length) setup.stamps = l2;
        if (SIZES[ss.size]) setup.size = ss.size;
        if (BGS[ss.bg]) setup.bg = ss.bg;
        setup.words = !!ss.words;
      }
    } catch (e) { /* ignore */ }
  }
  var locked = params.get("lock") === "1";
  function saveSetup() {
    try {
      localStorage.setItem(SETUP_KEY, JSON.stringify({
        s: setup.stamps.map(function (s) { return stampCode(s); }).join("|"),
        size: setup.size, bg: setup.bg, words: setup.words }));
    } catch (e) { /* ignore */ }
  }
  function setupQuery(su, lock) {
    var q = new URLSearchParams();
    q.set("s", su.stamps.map(function (s) { return stampCode(s); }).join("|"));
    if (su.size !== "m") q.set("size", su.size);
    if (su.bg !== "white") q.set("bg", su.bg);
    if (su.words) q.set("words", "1");
    if (lock) q.set("lock", "1");
    return q.toString().replace(/%7C/gi, "|").replace(/%3A/gi, ":").replace(/%7E/gi, "~");
  }

  /* ---------- Speech and sound ---------- */
  var live = $("live");
  function announce(text) { live.textContent = ""; setTimeout(function () { live.textContent = text; }, 40); }

  var synth = window.speechSynthesis || null;
  var actx = null, speechUnlocked = false;
  function unlockAudio() {
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* ignore */ }
    if (synth && !speechUnlocked) {
      speechUnlocked = true;
      try { var u = new SpeechSynthesisUtterance(" "); u.volume = 0; synth.speak(u); } catch (e) { /* ignore */ }
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!actx && AC) actx = new AC();
      if (actx && actx.state === "suspended" && actx.resume) actx.resume();
    } catch (e) { /* ignore */ }
  }
  ["touchend", "click", "keydown"].forEach(function (type) {
    document.addEventListener(type, unlockAudio, true);
  });

  var NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|pipe organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley)\b/i;
  var GOOD_NAMES = /\b(ava|samantha|allison|susan|zoe|evan|nathan|noelle|joelle|nicky|tom|serena|karen|daniel|kate|moira|tessa|aria|jenny|guy|michelle)\b/i;
  var chosenVoice = null, voiceSearched = false;
  function scoreVoice(v) {
    var name = v.name || "", lang = (v.lang || "").replace("_", "-").toLowerCase();
    if (lang.indexOf("en") !== 0 || NOVELTY.test(name)) return -1;
    var s = 0;
    if (/premium/i.test(name)) s += 80;
    if (/enhanced|neural|natural/i.test(name)) s += 70;
    if (/google/i.test(name)) s += 60;
    if (GOOD_NAMES.test(name)) s += 40;
    if (/eloquence|espeak|compact/i.test(name)) s -= 50;
    if (lang === "en-us" || lang === "en-ca") s += 10; else if (lang === "en-gb") s += 5;
    if (v.default) s += 3;
    return s;
  }
  function pickVoice() {
    if (!synth || !synth.getVoices) return;
    var voices = synth.getVoices() || [];
    if (!voices.length) return;
    voiceSearched = true;
    var best = null, bestScore = -1;
    voices.forEach(function (v) { var sc = scoreVoice(v); if (sc > bestScore) { bestScore = sc; best = v; } });
    chosenVoice = best;
  }
  if (synth) {
    pickVoice();
    if (synth.addEventListener) synth.addEventListener("voiceschanged", pickVoice);
  }
  var keepAlive = [];
  function speak(text) {
    if (!settings.voice || !text || !synth || !window.SpeechSynthesisUtterance) return;
    var vol = Math.max(0, Math.min(100, settings.volume)) / 100;
    if (vol === 0) return;
    if (!voiceSearched) pickVoice();
    var u = new SpeechSynthesisUtterance(text);
    if (chosenVoice) { u.voice = chosenVoice; u.lang = chosenVoice.lang; } else { u.lang = "en"; }
    u.rate = cfg.voiceRate;
    u.volume = vol;
    keepAlive.push(u);
    if (keepAlive.length > 6) keepAlive.shift();
    if (synth.speaking || synth.pending) {
      synth.cancel();
      setTimeout(function () { synth.speak(u); }, 80); // Safari drops a phrase spoken right after cancel()
    } else {
      synth.speak(u);
    }
  }

  // A soft "thunk", made in the browser.
  function stampSound() {
    if (!settings.sounds || !actx || settings.volume <= 0) return;
    try {
      var vol = settings.volume / 100;
      var t0 = actx.currentTime + 0.01;
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(190, t0);
      o.frequency.exponentialRampToValueAtTime(70, t0 + 0.14);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.5 * vol, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      o.connect(g); g.connect(actx.destination);
      o.start(t0); o.stop(t0 + 0.22);
      // a little paper "pat" on top
      var len = Math.floor(actx.sampleRate * 0.05);
      var buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      var n = actx.createBufferSource(), f = actx.createBiquadFilter(), ng = actx.createGain();
      n.buffer = buf; f.type = "lowpass"; f.frequency.value = 1800; ng.gain.value = 0.35 * vol;
      n.connect(f); f.connect(ng); ng.connect(actx.destination);
      n.start(t0);
    } catch (e) { /* ignore */ }
  }

  /* ---------- Page (paper) ---------- */
  var paper = $("paper"), layer = $("stamps-layer"), spotsLayer = $("spots-layer"), cursorEl = $("cursor");
  var placed = [];          // { st, x, y, el }  x, y are 0..1 of the paper
  var current = 0;          // index of the chosen stamp
  var cursor = { x: 0.5, y: 0.5 };

  function sizeFrac() { return SIZES[setup.size] || SIZES.m; }
  function plural(word, n) {
    if (n === 1) return word;
    if (/(s|x|z|ch|sh)$/.test(word)) return word + "es";
    if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + "ies";
    return word + "s";
  }
  function summary() {
    if (!placed.length) return "The page is empty.";
    var counts = {}, order = [];
    placed.forEach(function (p) {
      if (!(p.st.label in counts)) { counts[p.st.label] = 0; order.push(p.st.label); }
      counts[p.st.label]++;
    });
    var parts = order.map(function (l) { return counts[l] + " " + plural(l, counts[l]); });
    var text = parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0];
    return "On the page: " + text + ".";
  }
  function updatePaperLabel() {
    var st = setup.stamps[current];
    var label = st ? (settings.scan ? "Page. " : "Page. Stamp " + st.label + ". ") : "Page. ";
    paper.setAttribute("aria-label", label + summary());
    paper.classList.toggle("is-empty", !placed.length);
    paper.setAttribute("data-hint", settings.scan ? "Press your switch to stamp" : "Pick a stamp, then tap the page");
    $("btn-undo").setAttribute("aria-disabled", placed.length ? "false" : "true");
  }

  function makeStampEl(p, animate) {
    var el = document.createElement("div");
    el.className = "stamp" + (animate && settings.animation ? " pop" : "");
    var f = sizeFrac();
    el.style.left = (p.x * 100) + "%";
    el.style.top = (p.y * 100) + "%";
    el.style.width = (f * 100) + "%";
    var img = document.createElement("img");
    img.src = stampSrc(p.st);
    img.alt = "";
    img.draggable = false;
    el.appendChild(img);
    if (setup.words) {
      var w = document.createElement("span");
      w.className = "word";
      w.textContent = p.st.label;
      el.appendChild(w);
    }
    return el;
  }
  function redrawPaper() {
    layer.textContent = "";
    paper.className = "paper bg-" + setup.bg;
    placed.forEach(function (p) { p.el = makeStampEl(p, false); layer.appendChild(p.el); });
    updatePaperLabel();
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function stampAt(x, y, quiet) {
    var st = setup.stamps[current];
    if (!st) return;
    var f = sizeFrac(), half = f / 2, halfY = half / ASPECT;
    x = clamp(x, half * 0.6, 1 - half * 0.6);
    y = clamp(y, halfY * 0.6, 1 - halfY * 0.6);
    var p = { st: st, x: x, y: y };
    p.el = makeStampEl(p, true);
    layer.appendChild(p.el);
    placed.push(p);
    if (placed.length > cfg.maxOnPaper) { var old = placed.shift(); if (old.el) old.el.remove(); }
    stampSound();
    speak(st.label);
    if (!quiet) announce(st.label + ". " + summary());
    updatePaperLabel();
    resetClear();
  }
  function undo() {
    if (!placed.length) { announce("Nothing to undo."); speak("Nothing to undo"); return; }
    var p = placed.pop();
    if (p.el) p.el.remove();
    announce("Took away " + p.st.label + ". " + summary());
    speak("Undo");
    updatePaperLabel();
  }
  var clearArmed = null;
  function resetClear() {
    if (clearArmed) { clearTimeout(clearArmed); clearArmed = null; }
    $("clear-label").textContent = "New page";
  }
  function newPage(confirmed) {
    if (!placed.length) { announce("The page is already empty."); return; }
    if (!confirmed && !clearArmed) {
      $("clear-label").textContent = "Tap again to clear";
      announce("Press New page again to clear the page.");
      clearArmed = setTimeout(resetClear, 4000);
      return;
    }
    resetClear();
    placed.forEach(function (p) { if (p.el) p.el.remove(); });
    placed = [];
    announce("New page.");
    updatePaperLabel();
  }

  // Grid of spots for switch users (and for screen reader taps).
  function spotGrid() {
    var f = sizeFrac();
    var cw = f * 1.25, ch = (f * (setup.words ? 1.45 : 1.25)) / ASPECT;
    var cols = Math.max(1, Math.floor(1 / cw)), rows = Math.max(1, Math.floor(1 / ch));
    return { cols: cols, rows: rows, w: 1 / cols, h: 1 / rows };
  }
  function spotCenter(g, r, c) {
    return { x: (c + 0.5) * g.w, y: (r + 0.5) * g.h - (setup.words ? g.h * 0.06 : 0) };
  }
  function nextSpot() {
    var g = spotGrid(), n = placed.length % (g.cols * g.rows);
    return spotCenter(g, Math.floor(n / g.cols), n % g.cols);
  }
  function randomSpot() {
    var f = sizeFrac(), best = null, bestD = -1;
    for (var i = 0; i < 16; i++) {
      var x = f / 2 + Math.random() * (1 - f), y = (f / 2) / ASPECT + Math.random() * (1 - f / ASPECT);
      var d = 9;
      placed.forEach(function (p) { var dx = p.x - x, dy = (p.y - y) * ASPECT; d = Math.min(d, dx * dx + dy * dy); });
      if (d > bestD) { bestD = d; best = { x: x, y: y }; }
    }
    return best;
  }

  // Tap or click on the page.
  paper.addEventListener("click", function (e) {
    if (settings.scan && scan.phase !== "tray") return;
    var r = paper.getBoundingClientRect();
    var spot;
    if (e.detail === 0 || !e.clientX && !e.clientY) {
      spot = cursorShown ? { x: cursor.x, y: cursor.y } : nextSpot(); // keyboard or screen reader
    } else {
      spot = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
      // Screen readers "tap" the exact middle every time: use the next space instead of a pile.
      var last = placed[placed.length - 1];
      if (last && Math.abs(spot.x - 0.5) < 0.004 && Math.abs(spot.y - 0.5) < 0.004 &&
          Math.abs(last.x - spot.x) < 0.004 && Math.abs(last.y - spot.y) < 0.004) spot = nextSpot();
    }
    stampAt(spot.x, spot.y);
  });

  // Keyboard on the page: arrows move a ring, Enter or Space stamps.
  var cursorShown = false;
  function showCursor() {
    cursorShown = true;
    cursorEl.hidden = false;
    var r = paper.getBoundingClientRect();
    var size = Math.max(40, r.width * sizeFrac());
    cursorEl.style.width = cursorEl.style.height = size + "px";
    cursorEl.style.left = (cursor.x * 100) + "%";
    cursorEl.style.top = (cursor.y * 100) + "%";
  }
  function hideCursor() { cursorShown = false; cursorEl.hidden = true; }
  paper.addEventListener("keydown", function (e) {
    if (settings.scan) return;
    var step = e.shiftKey ? 0.02 : 0.06, moved = true;
    if (e.key === "ArrowLeft") cursor.x -= step;
    else if (e.key === "ArrowRight") cursor.x += step;
    else if (e.key === "ArrowUp") cursor.y -= step / ASPECT;
    else if (e.key === "ArrowDown") cursor.y += step / ASPECT;
    else moved = false;
    if (moved) {
      e.preventDefault();
      cursor.x = clamp(cursor.x, 0.04, 0.96); cursor.y = clamp(cursor.y, 0.05, 0.95);
      showCursor();
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (e.repeat) return;
      if (!cursorShown) { cursor = nextSpot(); showCursor(); }
      stampAt(cursor.x, cursor.y);
    }
  });
  paper.addEventListener("focus", function () { if (paper.matches(":focus-visible") && !settings.scan) showCursor(); });
  paper.addEventListener("blur", hideCursor);
  paper.addEventListener("pointerdown", hideCursor);

  /* ---------- Tray of stamps ---------- */
  var tray = $("tray");
  var undoTile = null;
  function choose(i, quiet) {
    if (!setup.stamps[i]) return;
    current = i;
    Array.prototype.forEach.call(tray.querySelectorAll(".tile[data-i]"), function (t) {
      t.setAttribute("aria-pressed", Number(t.getAttribute("data-i")) === i ? "true" : "false");
    });
    updatePaperLabel();
    if (!quiet) speak(setup.stamps[i].label);
  }
  function buildTray() {
    tray.textContent = "";
    setup.stamps.forEach(function (st, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "tile";
      b.setAttribute("data-i", i);
      b.setAttribute("aria-pressed", "false");
      var img = document.createElement("img");
      img.src = stampSrc(st); img.alt = ""; img.draggable = false;
      var name = document.createElement("span");
      name.className = "t-name"; name.textContent = st.label;
      b.appendChild(img); b.appendChild(name);
      b.addEventListener("click", function () {
        if (settings.scan && scan.phase !== "tray") return;
        choose(i);
        announce(st.label + " stamp chosen.");
      });
      tray.appendChild(b);
    });
    undoTile = document.createElement("button");
    undoTile.type = "button";
    undoTile.className = "tile tile-undo";
    undoTile.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 14 4 9l5-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg><span class="t-name">Undo</span>';
    undoTile.addEventListener("click", undo);
    tray.appendChild(undoTile);
    showUndoTile();
    if (current >= setup.stamps.length) current = 0;
    choose(current, true);
    updateCredit();
    fitStage();
  }
  function showUndoTile() {
    if (undoTile) undoTile.hidden = !(settings.scan || root.classList.contains("is-fullscreen"));
  }
  function trayItems() {
    return Array.prototype.filter.call(tray.querySelectorAll(".tile"), function (t) { return !t.hidden; });
  }

  function updateCredit() {
    var hasM = setup.stamps.some(function (s) { return s.lib === "m"; });
    var hasA = setup.stamps.some(function (s) { return s.lib === "a"; });
    var parts = [];
    if (hasM) parts.push('Symbols: <a href="https://mulberrysymbols.org" target="_blank" rel="noopener">Mulberry Symbols</a> by Steve Lee, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA</a>.');
    if (hasA) parts.push('Pictograms: Sergio Palao for <a href="https://arasaac.org" target="_blank" rel="noopener">ARASAAC</a>, Government of Aragón, <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA</a>.');
    $("credit").innerHTML = parts.join(" ");
  }

  /* ---------- Layout ---------- */
  var stage = $("stage"), wrap = $("paper-wrap");
  function fitStage() {
    var W = stage.clientWidth, H = stage.clientHeight;
    if (!W || !H) return;
    var n = Math.max(1, trayItems().length), gap = 10, pad = 12;
    var wide = W / H > 1.05;
    root.classList.toggle("is-wide", wide);
    root.classList.toggle("is-tall", !wide);
    var tile, cols = 1;
    if (wide) {
      tile = Math.min(130, Math.floor((H - pad - gap * (n - 1)) / n));
      if (tile < 84) { cols = 2; tile = Math.min(130, Math.floor((H - pad - gap * (Math.ceil(n / 2) - 1)) / Math.ceil(n / 2))); }
      tile = Math.max(70, Math.min(tile, Math.floor(W * 0.16)));
    } else {
      tile = Math.min(130, Math.floor((W - pad - gap * (n - 1)) / n), Math.floor(H * 0.2));
      tile = Math.max(70, tile);
    }
    tray.style.setProperty("--tile", tile + "px");
    tray.style.setProperty("--cols", cols);
    var aw, ah;
    if (wide) { aw = W - cols * tile - (cols - 1) * gap - pad - 14; ah = H; }
    else { aw = W; ah = H - Math.min(tile, 130) - pad - 14; }
    var pw = Math.min(aw - 8, (ah - 8) / ASPECT);
    pw = Math.max(200, Math.floor(pw));
    paper.style.width = pw + "px";
    paper.style.height = Math.floor(pw * ASPECT) + "px";
    paper.style.fontSize = Math.max(11, pw * 0.024) + "px";
    if (cursorShown) showCursor();
    if (scan.phase === "row" || scan.phase === "cell") drawSpots();
  }

  /* ---------- Switch scanning ---------- */
  var scan = { phase: "off", index: -1, row: 0, cell: 0, loops: 0, timer: null, lastPress: 0 };
  function clearScanMarks() {
    Array.prototype.forEach.call(document.querySelectorAll(".is-scan"), function (el) { el.classList.remove("is-scan"); });
    spotsLayer.textContent = "";
  }
  function stopScan() {
    clearInterval(scan.timer); scan.timer = null;
    clearScanMarks();
    scan.phase = "off";
  }
  function scanAllowed() { return settings.scan && !openPanel && !document.hidden; }
  function startScan(fromIndex, holdFirst) {
    stopScan();
    if (!scanAllowed()) return;
    scan.phase = "tray";
    scan.index = typeof fromIndex === "number" ? fromIndex - 1 : -1;
    scan.loops = 0;
    if (holdFirst) { scan.index++; markTray(false); } else scanStep();
    restartTimer();
  }
  function restartTimer() {
    clearInterval(scan.timer); scan.timer = null;
    if (settings.scanMode === "auto") scan.timer = setInterval(scanStep, settings.speed * 1000);
  }
  function markTray(sayIt) {
    clearScanMarks();
    var items = trayItems();
    var t = items[scan.index];
    if (!t) return;
    t.classList.add("is-scan");
    if (t.scrollIntoView) t.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (sayIt) {
      var i = t.getAttribute("data-i");
      speak(i === null ? "Undo" : setup.stamps[Number(i)].label);
    }
  }
  function scanStep() {
    var g;
    if (scan.phase === "tray") {
      var items = trayItems();
      scan.index = (scan.index + 1) % items.length;
      markTray(true);
    } else if (scan.phase === "row") {
      g = spotGrid();
      scan.row++;
      if (scan.row >= g.rows) { scan.row = 0; scan.loops++; }
      if (scan.loops >= 2) { startScan(current, true); return; }
      drawSpots();
    } else if (scan.phase === "cell") {
      g = spotGrid();
      scan.cell++;
      if (scan.cell >= g.cols) { scan.cell = 0; scan.loops++; }
      if (scan.loops >= 2) { scan.phase = "row"; scan.loops = 0; drawSpots(); return; }
      drawSpots();
    }
  }
  function drawSpots() {
    spotsLayer.textContent = "";
    var g = spotGrid(), st = setup.stamps[current];
    if (scan.phase === "row") {
      var band = document.createElement("div");
      band.className = "spot-row";
      band.style.top = (scan.row * g.h * 100) + "%";
      band.style.height = (g.h * 100) + "%";
      spotsLayer.appendChild(band);
    } else if (scan.phase === "cell") {
      var cell = document.createElement("div");
      cell.className = "spot-cell";
      cell.style.left = (scan.cell * g.w * 100) + "%";
      cell.style.top = (scan.row * g.h * 100) + "%";
      cell.style.width = (g.w * 100) + "%";
      cell.style.height = (g.h * 100) + "%";
      spotsLayer.appendChild(cell);
      if (st) {
        var c = spotCenter(g, scan.row, scan.cell);
        var ghost = document.createElement("div");
        ghost.className = "spot-ghost";
        ghost.style.left = (c.x * 100) + "%"; ghost.style.top = (c.y * 100) + "%";
        ghost.style.width = (sizeFrac() * 100) + "%";
        var im = document.createElement("img"); im.src = stampSrc(st); im.alt = "";
        ghost.appendChild(im);
        spotsLayer.appendChild(ghost);
      }
    }
  }
  function scanPick() {
    var g, s;
    if (scan.phase === "tray") {
      var t = trayItems()[scan.index];
      if (!t) return;
      if (t === undoTile) { undo(); startScan(scan.index, true); return; }
      choose(Number(t.getAttribute("data-i")), true);
      if (settings.spot === "choose") {
        speak(setup.stamps[current].label + ". Where?");
        announce(setup.stamps[current].label + " chosen. Rows light up. Press when the right row lights up.");
        clearScanMarks();
        t.classList.add("is-scan");
        scan.phase = "row"; scan.row = 0; scan.loops = 0;
        drawSpots(); restartTimer();
        return;
      }
      s = settings.spot === "random" ? randomSpot() : nextSpot();
      stampAt(s.x, s.y);
      startScan(scan.index, true); // stay on this stamp for a moment, so another press stamps it again
    } else if (scan.phase === "row") {
      scan.phase = "cell"; scan.cell = 0; scan.loops = 0;
      drawSpots(); restartTimer();
    } else if (scan.phase === "cell") {
      g = spotGrid();
      s = spotCenter(g, scan.row, scan.cell);
      stampAt(s.x, s.y);
      var idx = trayItems().indexOf(tray.querySelector('.tile[data-i="' + current + '"]'));
      startScan(idx, true);
    }
  }
  var IGNORE = { Tab: 1, Shift: 1, Control: 1, Alt: 1, Meta: 1, Escape: 1, CapsLock: 1, Fn: 1 };
  document.addEventListener("keydown", function (e) {
    if (openPanel || e.ctrlKey || e.metaKey || e.altKey || IGNORE[e.key]) return;
    if (e.target && e.target.closest && e.target.closest(".bar, .fs-exit, .credit")) return;
    if (!settings.scan) {
      // Number keys choose a stamp.
      if (/^[1-9]$/.test(e.key) && setup.stamps[Number(e.key) - 1]) {
        e.preventDefault();
        choose(Number(e.key) - 1);
        announce(setup.stamps[current].label + " stamp chosen.");
      }
      return;
    }
    e.preventDefault();
    if (e.repeat) return; // holding a switch counts once
    var now = Date.now();
    if (now - scan.lastPress < settings.wait * 1000) return;
    scan.lastPress = now;
    if (scan.phase === "off") { startScan(); return; }
    if (settings.scanMode === "step" && (e.key === " " || e.key === "ArrowRight" || e.key === "ArrowDown")) { scanStep(); return; }
    scanPick();
    restartTimer();
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stopScan(); else if (settings.scan) startScan(current, true);
  });

  /* ---------- Save picture ---------- */
  function loadImg(src, cross) {
    return new Promise(function (resolve) {
      var im = new Image();
      if (cross) im.crossOrigin = "anonymous";
      im.onload = function () { resolve(im); };
      im.onerror = function () { resolve(null); };
      im.src = src;
    });
  }
  function savePicture() {
    if (!placed.length) { announce("Stamp something first."); return; }
    var W = 1600, Hh = Math.round(W * ASPECT);
    var cv = document.createElement("canvas");
    cv.width = W; cv.height = Hh;
    var ctx = cv.getContext("2d");
    var bgCol = getComputedStyle(paper).backgroundColor || "#fff";
    ctx.fillStyle = bgCol; ctx.fillRect(0, 0, W, Hh);
    var cache = {};
    var jobs = placed.map(function (p) {
      var src = stampSrc(p.st);
      if (!cache[src]) cache[src] = loadImg(src, p.st.lib === "a");
      return cache[src];
    });
    $("btn-save").setAttribute("aria-busy", "true");
    Promise.all(jobs).then(function (imgs) {
      var f = sizeFrac() * W, missing = 0;
      var fg = setup.bg === "black" ? "#fff" : "#0f1d3a";
      ctx.font = "700 " + Math.round(W * 0.024) + "px 'Atkinson Hyperlegible', Verdana, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      placed.forEach(function (p, i) {
        var im = imgs[i];
        var cx = p.x * W, cy = p.y * Hh;
        var top = cy - f / 2 - (setup.words ? W * 0.015 : 0);
        if (!im) { missing++; return; }
        if (setup.bg === "black") { ctx.fillStyle = "#fff"; ctx.fillRect(cx - f / 2, top, f, f); }
        ctx.drawImage(im, cx - f / 2, top, f, f);
        if (setup.words) { ctx.fillStyle = fg; ctx.fillText(p.st.label, cx, top + f + 2); }
      });
      cv.toBlob(function (blob) {
        $("btn-save").removeAttribute("aria-busy");
        if (!blob) { announce("Sorry, this picture can't be saved. Take a screenshot instead."); return; }
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "my-stamps.png";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 20000);
        announce(missing ? "Picture saved, but some online pictures could not be added." : "Picture saved.");
      }, "image/png");
    }).catch(function () {
      $("btn-save").removeAttribute("aria-busy");
      announce("Sorry, this picture can't be saved. Take a screenshot instead.");
    });
  }

  /* ---------- Panels ---------- */
  var openPanel = null, returnFocus = null;
  function showPanel(id, opener, focusEl) {
    if (openPanel) hidePanel(true);
    stopScan();
    openPanel = $(id);
    returnFocus = opener || document.activeElement;
    openPanel.hidden = false;
    $("app").setAttribute("aria-hidden", "true");
    var f = focusEl || openPanel.querySelector("h2");
    setTimeout(function () { f.focus(); }, 30);
  }
  function hidePanel(silent) {
    if (!openPanel) return;
    var was = openPanel.id;
    openPanel.hidden = true;
    openPanel = null;
    $("app").removeAttribute("aria-hidden");
    if (was === "panel-setup" && !silent) applyDraft();
    if (silent) return;
    if (returnFocus && returnFocus.focus && !returnFocus.closest("[hidden]")) returnFocus.focus();
    if (settings.scan) startScan(current, true);
  }
  document.querySelectorAll(".overlay").forEach(function (ov) {
    ov.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) { hidePanel(); return; }
      if (e.target === ov) hidePanel();
    });
  });
  document.addEventListener("keydown", function (e) {
    if (!openPanel) return;
    if (e.key === "Escape") { e.preventDefault(); hidePanel(); return; }
    if (e.key === "Tab") { // keep focus inside the open panel
      var items = Array.prototype.filter.call(openPanel.querySelectorAll("button, input, select, a[href], [tabindex='0']"), function (el) {
        return !el.disabled && !el.closest("[hidden]") && !(el.type === "radio" && !el.checked);
      });
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === openPanel.querySelector("h2"))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
  });

  /* ---------- Teacher setup ---------- */
  var draft = null, lib = "m";
  function cloneSetup(su) {
    return { stamps: su.stamps.map(function (s) { return { lib: s.lib, id: s.id, label: s.label }; }),
             size: su.size, bg: su.bg, words: su.words };
  }
  function inDraft(libId, id) {
    for (var i = 0; i < draft.stamps.length; i++) if (draft.stamps[i].lib === libId && draft.stamps[i].id === String(id)) return i;
    return -1;
  }
  var setupLive = $("setup-live");
  function setupSay(t) { setupLive.textContent = ""; setTimeout(function () { setupLive.textContent = t; }, 40); }

  function renderChosen() {
    var ul = $("chosen");
    ul.textContent = "";
    $("chosen-count").textContent = "(" + draft.stamps.length + " of " + cfg.maxStamps + ")";
    if (!draft.stamps.length) {
      var li0 = document.createElement("li");
      li0.className = "empty";
      li0.textContent = "No stamps yet. Search below, or pick a quick set.";
      ul.appendChild(li0);
    }
    draft.stamps.forEach(function (st, i) {
      var li = document.createElement("li");
      var img = document.createElement("img"); img.src = stampSrc(st); img.alt = "";
      var input = document.createElement("input");
      input.type = "text"; input.value = st.label; input.maxLength = 40;
      input.setAttribute("aria-label", "Word for stamp " + (i + 1));
      input.addEventListener("input", function () { st.label = input.value.replace(/[|~]/g, " ").trim() || (st.lib === "m" ? niceName(st.id) : "picture"); updateShare(); });
      var tag = document.createElement("span"); tag.className = "lib-tag"; tag.textContent = st.lib === "a" ? "ARASAAC" : "Mulberry";
      var up = document.createElement("button");
      up.type = "button"; up.className = "btn";
      up.setAttribute("aria-label", "Move " + st.label + " earlier");
      up.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      up.disabled = i === 0;
      up.addEventListener("click", function () {
        draft.stamps.splice(i - 1, 0, draft.stamps.splice(i, 1)[0]);
        renderChosen(); updateShare();
        var btns = $("chosen").querySelectorAll("li")[i - 1].querySelectorAll("button");
        (btns[0].disabled ? btns[1] : btns[0]).focus();
        setupSay(st.label + " moved to number " + i + ".");
      });
      var rm = document.createElement("button");
      rm.type = "button"; rm.className = "btn";
      rm.setAttribute("aria-label", "Remove " + st.label);
      rm.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>';
      rm.addEventListener("click", function () {
        draft.stamps.splice(i, 1);
        renderChosen(); renderResultsPressed(); updateShare();
        setupSay(st.label + " removed. " + draft.stamps.length + " stamps.");
        var lis = $("chosen").querySelectorAll("li button:last-child");
        if (lis.length) lis[Math.min(i, lis.length - 1)].focus(); else $("search-input").focus();
      });
      li.appendChild(img); li.appendChild(input); li.appendChild(tag); li.appendChild(up); li.appendChild(rm);
      ul.appendChild(li);
    });
    $("btn-setup-done").disabled = !draft.stamps.length;
  }

  // Mulberry index (only loaded when the teacher searches).
  var mulberry = null, mulberryLoading = null;
  function loadMulberry() {
    if (mulberry) return Promise.resolve(mulberry);
    if (!mulberryLoading) {
      mulberryLoading = fetch("symbols/mulberry/index.json?v=361").then(function (r) { return r.json(); }).then(function (d) {
        mulberry = d;
        var sel = $("browse");
        d.categories.map(function (c, i) { return { c: c, i: i }; })
          .sort(function (a, b) { return a.c.localeCompare(b.c); })
          .forEach(function (o) {
            var op = document.createElement("option");
            op.value = String(o.i); op.textContent = o.c;
            sel.appendChild(op);
          });
        return d;
      });
    }
    return mulberryLoading;
  }
  function words(s) { return s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean); }
  function searchMulberry(q) {
    return loadMulberry().then(function (d) {
      var qw = words(q), qs = qw.join(" ");
      if (!qw.length) return [];
      var scored = [];
      d.symbols.forEach(function (s) {
        var name = s[1].toLowerCase(), nw = words(name), tw = words(s[3]), cw = words(d.categories[s[2]]);
        var score = 0;
        if (name === qs) score = 100;
        else if (name.indexOf(qs) === 0) score = 60;
        else {
          qw.forEach(function (w) {
            if (nw.indexOf(w) >= 0) score += 40;
            else if (nw.some(function (x) { return x.indexOf(w) === 0; })) score += 25;
            else if (tw.indexOf(w) >= 0 || cw.indexOf(w) >= 0 || cw.indexOf(w.replace(/s$/, "")) >= 0) score += 12;
          });
          if (!score && name.indexOf(qs) >= 0) score = 5;
        }
        if (score) scored.push({ s: s, score: score - name.length * 0.01 });
      });
      scored.sort(function (a, b) { return b.score - a.score; });
      return scored.slice(0, 60).map(function (o) { return { lib: "m", id: o.s[0], label: o.s[1] }; });
    });
  }
  function browseMulberry(ci) {
    return loadMulberry().then(function (d) {
      return d.symbols.filter(function (s) { return s[2] === ci; }).map(function (s) { return { lib: "m", id: s[0], label: s[1] }; });
    });
  }
  var arasaacAbort = null;
  function searchArasaac(q) {
    if (arasaacAbort && arasaacAbort.abort) arasaacAbort.abort();
    arasaacAbort = window.AbortController ? new AbortController() : null;
    return fetch(cfg.arasaac.search + encodeURIComponent(q.trim().toLowerCase()), arasaacAbort ? { signal: arasaacAbort.signal } : {})
      .then(function (r) {
        if (r.status === 404) return [];
        if (!r.ok) throw new Error("http " + r.status);
        return r.json();
      })
      .then(function (list) {
        var qs = q.trim().toLowerCase();
        var out = [];
        (Array.isArray(list) ? list : []).forEach(function (p) {
          if (!p || typeof p._id !== "number" || p.sex || p.violence) return;
          var kw = (p.keywords && p.keywords[0] && p.keywords[0].keyword) || qs;
          var exact = (p.keywords || []).some(function (k) { return k && String(k.keyword).toLowerCase() === qs; });
          out.push({ lib: "a", id: String(p._id), label: String(kw).toLowerCase().slice(0, 40), exact: exact });
        });
        out.sort(function (a, b) { return (b.exact ? 1 : 0) - (a.exact ? 1 : 0); });
        return out.slice(0, 60);
      });
  }

  var shown = [];
  function renderResults(list, msg) {
    shown = list;
    var box = $("results");
    box.textContent = "";
    $("results-msg").textContent = msg;
    list.forEach(function (st) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "result";
      var img = document.createElement("img");
      img.src = stampSrc(st); img.alt = ""; img.loading = "lazy";
      var sp = document.createElement("span"); sp.textContent = st.label;
      b.appendChild(img); b.appendChild(sp);
      b.addEventListener("click", function () {
        var at = inDraft(st.lib, st.id);
        if (at >= 0) {
          draft.stamps.splice(at, 1);
          setupSay(st.label + " removed. " + draft.stamps.length + " stamps.");
        } else if (draft.stamps.length >= cfg.maxStamps) {
          setupSay("You have " + cfg.maxStamps + " stamps already. Remove one first.");
          $("results-msg").textContent = "That's the most stamps (" + cfg.maxStamps + "). Remove one first.";
          return;
        } else {
          draft.stamps.push({ lib: st.lib, id: st.id, label: st.label });
          setupSay(st.label + " added. " + draft.stamps.length + " stamps.");
        }
        renderChosen(); renderResultsPressed(); updateShare();
      });
      box.appendChild(b);
    });
    renderResultsPressed();
  }
  function renderResultsPressed() {
    var btns = $("results").querySelectorAll(".result");
    shown.forEach(function (st, i) {
      var on = inDraft(st.lib, st.id) >= 0;
      btns[i].setAttribute("aria-pressed", on ? "true" : "false");
      btns[i].setAttribute("aria-label", st.label + (on ? ", added" : ""));
    });
  }
  function doSearch() {
    var q = $("search-input").value.trim();
    if (!q) { $("results-msg").textContent = "Type a word to search for."; return; }
    $("results-msg").textContent = "Searching…";
    var job = lib === "a" ? searchArasaac(q) : searchMulberry(q);
    job.then(function (list) {
      renderResults(list, list.length ? list.length + (list.length === 60 ? "+" : "") + " found for “" + q + "”. Tap a symbol to add it." :
        "No symbols found for “" + q + "”. Try another word" + (lib === "m" ? " or try ARASAAC." : "."));
    }, function (err) {
      if (err && err.name === "AbortError") return;
      renderResults([], lib === "a" ? "Couldn't reach ARASAAC. The internet or a school filter may be blocking arasaac.org. Mulberry symbols always work." :
        "Couldn't load the symbol list. Check the internet and try again.");
    });
  }
  $("search-form").addEventListener("submit", function (e) { e.preventDefault(); doSearch(); });
  Array.prototype.forEach.call(document.querySelectorAll('input[name="lib"]'), function (r) {
    r.addEventListener("change", function () {
      lib = r.value;
      $("browse-field").hidden = lib !== "m";
      $("presets-row").hidden = lib !== "m";
      if ($("search-input").value.trim()) doSearch(); else renderResults([], "");
    });
  });
  $("browse").addEventListener("change", function () {
    var v = $("browse").value;
    if (v === "") return;
    var name = $("browse").options[$("browse").selectedIndex].text;
    browseMulberry(Number(v)).then(function (list) {
      renderResults(list, list.length + " symbols in " + name + ". Tap a symbol to add it.");
    });
  });
  cfg.presets.forEach(function (p) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "btn"; b.textContent = p.name;
    b.addEventListener("click", function () {
      draft.stamps = parseList(p.stamps.map(function (id) { return "m:" + id; }).join("|"));
      renderChosen(); renderResultsPressed(); updateShare();
      setupSay(p.name + " set: " + draft.stamps.map(function (s) { return s.label; }).join(", ") + ".");
    });
    $("presets").appendChild(b);
  });

  function shareUrl() {
    return location.origin + location.pathname + "?" + setupQuery(draft, $("set-lock").checked);
  }
  function updateShare() {
    $("share-link").value = shareUrl();
    $("copied").textContent = "";
  }
  function openSetup(e) {
    draft = cloneSetup(setup);
    $("set-size").value = draft.size;
    $("set-bg").value = draft.bg;
    $("set-words").checked = draft.words;
    renderChosen();
    renderResults([], "");
    updateShare();
    loadMulberry().catch(function () { /* shown when searching */ });
    showPanel("panel-setup", e && e.currentTarget);
  }
  $("set-size").addEventListener("change", function () { draft.size = $("set-size").value; updateShare(); });
  $("set-bg").addEventListener("change", function () { draft.bg = $("set-bg").value; updateShare(); });
  $("set-words").addEventListener("change", function () { draft.words = $("set-words").checked; updateShare(); });
  $("set-lock").addEventListener("change", updateShare);
  function applyDraft() {
    if (!draft || !draft.stamps.length) return;
    var curSt = setup.stamps[current];
    setup = cloneSetup(draft);
    current = 0;
    if (curSt) setup.stamps.forEach(function (s, i) { if (s.lib === curSt.lib && s.id === curSt.id) current = i; });
    saveSetup();
    // Keep the address bar in step, so a refresh or a Home Screen icon keeps this setup.
    try { history.replaceState(null, "", location.pathname + "?" + setupQuery(setup, false)); } catch (e) { /* ignore */ }
    buildTray();
    redrawPaper();
    announce("Ready. Stamps: " + setup.stamps.map(function (s) { return s.label; }).join(", ") + ".");
  }
  $("btn-setup-done").addEventListener("click", function () { hidePanel(); });
  $("btn-copy-link").addEventListener("click", function () {
    var input = $("share-link"), text = input.value;
    var done = function () { $("copied").textContent = "Link copied! Paste it in Google Classroom, an email or a message."; };
    var fallback = function () {
      try {
        input.focus(); input.select(); input.setSelectionRange(0, text.length);
        if (document.execCommand && document.execCommand("copy")) done();
        else $("copied").textContent = "The link is selected. Copy it from the box above.";
      } catch (e) { $("copied").textContent = "Copy the link from the box above."; }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  });
  if (navigator.share) {
    $("btn-share-link").hidden = false;
    $("btn-share-link").addEventListener("click", function () {
      try { navigator.share({ title: cfg.title, url: $("share-link").value }).catch(function () {}); } catch (e) { /* ignore */ }
    });
  }

  /* ---------- Settings ---------- */
  function applySettings() {
    root.classList.toggle("hc", !!settings.highContrast);
    root.classList.toggle("no-motion", !settings.animation || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches));
  }
  function bindSettings() {
    var el = {
      voice: $("set-voice"), sounds: $("set-sounds"), volume: $("set-volume"), animation: $("set-animation"),
      highContrast: $("set-contrast"), scan: $("set-scan"), spot: $("set-spot"), scanMode: $("set-scanmode"),
      speed: $("set-speed"), wait: $("set-wait")
    };
    ["voice", "sounds", "animation", "highContrast", "scan"].forEach(function (k) { el[k].checked = !!settings[k]; });
    el.volume.value = settings.volume;
    el.spot.value = settings.spot; el.scanMode.value = settings.scanMode;
    el.speed.value = settings.speed; el.wait.value = settings.wait;
    function outs() {
      $("speed-out").textContent = settings.speed + " seconds";
      el.speed.setAttribute("aria-valuetext", settings.speed + " seconds per stamp");
      $("wait-out").textContent = settings.wait ? settings.wait + " seconds" : "off";
      el.wait.setAttribute("aria-valuetext", settings.wait ? settings.wait + " seconds" : "off");
      el.volume.setAttribute("aria-valuetext", settings.volume + " percent");
      el.speed.disabled = settings.scanMode !== "auto";
    }
    outs();
    el.voice.addEventListener("change", function () { settings.voice = el.voice.checked; saveSettings(); if (settings.voice) speak("Voice on."); });
    el.sounds.addEventListener("change", function () { settings.sounds = el.sounds.checked; saveSettings(); stampSound(); });
    el.volume.addEventListener("input", function () { settings.volume = Number(el.volume.value); saveSettings(); outs(); });
    el.volume.addEventListener("change", function () { stampSound(); });
    el.animation.addEventListener("change", function () { settings.animation = el.animation.checked; saveSettings(); applySettings(); });
    el.highContrast.addEventListener("change", function () { settings.highContrast = el.highContrast.checked; saveSettings(); applySettings(); });
    el.scan.addEventListener("change", function () {
      settings.scan = el.scan.checked; saveSettings();
      showUndoTile(); updatePaperLabel(); fitStage();
    });
    el.spot.addEventListener("change", function () { settings.spot = el.spot.value; saveSettings(); });
    el.scanMode.addEventListener("change", function () { settings.scanMode = el.scanMode.value; saveSettings(); outs(); });
    el.speed.addEventListener("input", function () { settings.speed = Number(el.speed.value); saveSettings(); outs(); });
    el.wait.addEventListener("input", function () { settings.wait = Number(el.wait.value); saveSettings(); outs(); });
  }

  /* ---------- Full screen ---------- */
  function isStandalone() {
    return window.navigator.standalone === true ||
      (window.matchMedia && (matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches));
  }
  function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function fsSupported() {
    return !!((root.requestFullscreen || root.webkitRequestFullscreen) &&
              (document.fullscreenEnabled || document.webkitFullscreenEnabled));
  }
  var pseudoFs = false;
  function fallbackFullscreen() {
    pseudoFs = true;
    updateFsButton();
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
    showUndoTile();
    fitStage();
    if (on && !wasOn) announce("Full screen. To leave, use the Exit full screen button in the top corner.");
    else if (!on && wasOn) $("btn-fullscreen").focus();
  }
  function toggleFullscreen() {
    if (pseudoFs) { pseudoFs = false; updateFsButton(); return; }
    if (fsElement()) {
      var exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) { var p = exit.call(document); if (p && p.catch) p.catch(function () {}); }
      return;
    }
    if (!fsSupported() || isStandalone()) { fallbackFullscreen(); return; }
    try {
      var req = root.requestFullscreen ? root.requestFullscreen() : root.webkitRequestFullscreen();
      if (req && req.catch) req.catch(fallbackFullscreen);
    } catch (err) { fallbackFullscreen(); }
  }
  document.addEventListener("fullscreenchange", updateFsButton);
  document.addEventListener("webkitfullscreenchange", updateFsButton);

  /* ---------- Start ---------- */
  if (locked) $("btn-setup").hidden = true;
  applySettings();
  bindSettings();
  buildTray();
  redrawPaper();
  if (isStandalone()) { pseudoFs = true; updateFsButton(); }

  $("btn-setup").addEventListener("click", openSetup);
  $("btn-settings").addEventListener("click", function (e) { showPanel("panel-settings", e.currentTarget); });
  $("btn-undo").addEventListener("click", undo);
  $("btn-clear").addEventListener("click", function () { newPage(false); });
  $("btn-save").addEventListener("click", savePicture);
  $("btn-fullscreen").addEventListener("click", toggleFullscreen);
  $("btn-exit-fs").addEventListener("click", toggleFullscreen);
  if (window.ResizeObserver) new ResizeObserver(fitStage).observe(stage);
  window.addEventListener("resize", fitStage);
  window.addEventListener("orientationchange", function () { setTimeout(fitStage, 200); });
  if (settings.scan) setTimeout(function () { startScan(current, true); }, 600);
  if (params.get("setup") === "1" && !locked) openSetup();
})();
