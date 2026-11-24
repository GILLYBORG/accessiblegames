/*
 * Claw Machine - game logic.
 * You should not need to edit this file. Change toys, pictures and words in js/config.js.
 *
 * How a turn works:
 *   1. (If guessing is on) the student picks the toy they think the claw will grab.
 *   2. They press Grab (or move the claw and press Drop).
 *   3. The game picks one toy from the machine at random. Every toy in the machine
 *      has the same chance, so a toy there are 6 of is 6 times as likely as a toy
 *      there is 1 of. The claw then goes and gets that toy.
 *   4. The toy drops down the chute, the tally fills in, and (if the teacher chose)
 *      the toy goes back into the machine before the next grab.
 */
(function () {
  "use strict";

  /* ---------- Config ---------- */
  var userCfg = window.GAME_CONFIG || {};
  var cfg = {
    toys: (userCfg.toys || []).filter(function (t) { return t && t.id; }),
    clawOpen: userCfg.clawOpen || "images/claw-open.svg",
    clawClosed: userCfg.clawClosed || "images/claw-closed.svg",
    startSetup: userCfg.startSetup || { toys: {}, putBack: true, guess: true, grabs: 10 },
    presets: userCfg.presets || [],
    maxEach: userCfg.maxEach || 20,
    maxTotal: userCfg.maxTotal || 30,
    pointsPerCorrect: typeof userCfg.pointsPerCorrect === "number" ? userCfg.pointsPerCorrect : 100,
    phrases: Object.assign({
      got: "You got a {toy}!", guessRight: "You guessed it!", guessWrong: "Not this time.",
      finish: "All done! Look at your tally.", empty: "The machine is empty!"
    }, userCfg.phrases || {}),
    voiceRate: typeof userCfg.voiceRate === "number" ? userCfg.voiceRate : 0.9,
    defaults: Object.assign({ voice: true, sounds: true, volume: 90, animation: true, highContrast: false, control: "button" }, userCfg.defaults || {})
  };
  var TOY = {};
  cfg.toys.forEach(function (t) { TOY[t.id] = t; });

  var root = document.documentElement;
  if (userCfg.machineColor) root.style.setProperty("--machine", userCfg.machineColor);
  if (userCfg.machineTrim) root.style.setProperty("--trim", userCfg.machineTrim);
  if (userCfg.glassColor) root.style.setProperty("--glass", userCfg.glassColor);

  /* ---------- Settings (remembered on this device) ---------- */
  var STORE_KEY = "claw-machine.settings";
  var SETUP_KEY = "claw-machine.setup";
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

  /* ---------- Setup: which toys, how many, and the rules ---------- */
  // setup.toys is a list of { id, count } in the order of the toy list in config.js.
  function cleanSetup(s) {
    var out = { toys: [], putBack: s.putBack !== false, guess: s.guess !== false, grabs: 10 };
    var g = parseInt(s.grabs, 10);
    out.grabs = g >= 0 && g <= 200 ? g : 10;
    var counts = {};
    if (Array.isArray(s.toys)) s.toys.forEach(function (t) { if (t && TOY[t.id]) counts[t.id] = t.count; });
    else if (s.toys && typeof s.toys === "object") counts = s.toys;
    var total = 0;
    cfg.toys.forEach(function (t) {
      if (!(t.id in counts)) return;
      var n = Math.max(0, Math.min(cfg.maxEach, parseInt(counts[t.id], 10) || 0));
      if (total + n > cfg.maxTotal) n = Math.max(0, cfg.maxTotal - total);
      total += n;
      out.toys.push({ id: t.id, count: n });
    });
    return out;
  }
  function setupTotal(s) { return s.toys.reduce(function (a, t) { return a + t.count; }, 0); }
  function setupOk(s) { var n = setupTotal(s); return n >= 1 && n <= cfg.maxTotal; }

  // A link holds a setup, for example ?toys=red-ball.6,blue-block.3,yellow-star.0&back=1&guess=1&grabs=10
  function setupFromUrl() {
    try {
      var q = new URLSearchParams(location.search);
      if (!q.get("toys")) return null;
      var toys = [];
      q.get("toys").split(",").forEach(function (part) {
        var bits = part.split(".");
        if (TOY[bits[0]]) toys.push({ id: bits[0], count: parseInt(bits[1], 10) || 0 });
      });
      var s = cleanSetup({ toys: toys, putBack: q.get("back") !== "0", guess: q.get("guess") !== "0", grabs: q.has("grabs") ? q.get("grabs") : 10 });
      return setupOk(s) ? s : null;
    } catch (e) { return null; }
  }
  function linkFor(s, lock) {
    var base = location.href.split("#")[0].split("?")[0];
    return base + "?toys=" + s.toys.map(function (t) { return t.id + "." + t.count; }).join(",") +
      "&back=" + (s.putBack ? 1 : 0) + "&guess=" + (s.guess ? 1 : 0) + "&grabs=" + s.grabs + (lock ? "&lock=1" : "");
  }
  var locked = false;
  try { locked = new URLSearchParams(location.search).get("lock") === "1"; } catch (e) { /* ignore */ }

  var setup = setupFromUrl();
  if (setup) {
    try { localStorage.setItem(SETUP_KEY, JSON.stringify(setup)); } catch (e) { /* ignore */ }
  } else {
    try {
      var savedSetup = JSON.parse(localStorage.getItem(SETUP_KEY) || "null");
      if (savedSetup) setup = cleanSetup(savedSetup);
    } catch (e) { /* ignore */ }
    if (!setup || !setupOk(setup)) setup = cleanSetup(cfg.startSetup);
  }
  function saveSetup() {
    try { localStorage.setItem(SETUP_KEY, JSON.stringify(setup)); } catch (e) { /* ignore */ }
  }

  /* ---------- Elements ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var stage = $("stage");
  var machine = $("machine");
  var pileEl = $("pile");
  var prizeLayer = $("prize-layer");
  var carryLayer = $("carry-layer");
  var clawEl = $("claw");
  var cableEl = $("cable");
  var carriageEl = $("carriage");
  var live = $("live");
  var grabBtn = $("btn-grab");
  var dropBtn = $("btn-drop");
  var leftBtn = $("btn-left");
  var rightBtn = $("btn-right");

  /* ---------- Words ---------- */
  function nameOf(id, n) { var t = TOY[id]; if (!t) return id; return n === 1 ? t.name : (t.plural || t.name + "s"); }
  function countWords(id, n) { return n + " " + nameOf(id, n); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function aOrAn(name) { return /^[aeiou]/i.test(name) ? "an " + name : "a " + name; }
  function gotPhrase(id) {
    return cfg.phrases.got.replace("a {toy}", aOrAn(nameOf(id, 1))).replace("{toy}", nameOf(id, 1));
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function listWords(parts) {
    if (parts.length <= 1) return parts.join("");
    return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
  }

  /* ---------- Sound: voice ---------- */
  var synth = window.speechSynthesis || null;
  var speechUnlocked = false;
  var actx = null;
  var SILENT = "data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";
  var player = new Audio();
  var playerUnlocked = false;

  // iPhones and iPads only allow sound that starts during a real tap. On the first
  // tap (or key), start the sound engine, speak a silent word and play silence.
  function unlockAudio(strong) {
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* ignore */ }
    if (synth && !speechUnlocked) {
      if (strong) speechUnlocked = true;
      try { var u = new SpeechSynthesisUtterance(" "); u.volume = 0; synth.speak(u); } catch (e) { /* ignore */ }
    }
    if (strong) {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!actx && AC) actx = new AC();
        if (actx && actx.state === "suspended" && actx.resume) actx.resume();
      } catch (e) { /* ignore */ }
      if (!playerUnlocked) {
        try {
          player.src = SILENT;
          var pr = player.play();
          if (pr && pr.then) pr.then(function () { playerUnlocked = true; }, function () {});
          else playerUnlocked = true;
        } catch (e) { /* ignore */ }
      }
    }
  }
  ["touchend", "click", "keydown"].forEach(function (type) {
    document.addEventListener(type, function () { unlockAudio(true); }, true);
  });

  var NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|pipe organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley)\b/i;
  var GOOD_NAMES = /\b(ava|samantha|allison|susan|zoe|evan|nathan|noelle|joelle|nicky|tom|serena|karen|daniel|kate|moira|tessa|aria|jenny|guy|michelle)\b/i;
  var chosenVoice = null, voiceSearched = false, badVoices = {};
  function scoreVoice(v) {
    var name = v.name || "", lang = (v.lang || "").replace("_", "-").toLowerCase();
    if (lang.indexOf("en") !== 0) return -1;
    if (NOVELTY.test(name) || badVoices[v.voiceURI || name]) return -1;
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
    if (!synth || !synth.getVoices) return null;
    var voices = synth.getVoices() || [];
    if (!voices.length) return null;
    voiceSearched = true;
    var best = null, bestScore = -1;
    voices.forEach(function (v) { var sc = scoreVoice(v); if (sc > bestScore) { bestScore = sc; best = v; } });
    chosenVoice = best;
    return best;
  }
  if (synth) {
    pickVoice();
    if (synth.addEventListener) synth.addEventListener("voiceschanged", pickVoice);
    else synth.onvoiceschanged = pickVoice;
  }
  var keepAlive = [];
  function speak(text) {
    if (!settings.voice || !text || !synth || !window.SpeechSynthesisUtterance) return;
    var vol = Math.max(0, Math.min(100, settings.volume)) / 100;
    if (vol === 0) return;
    if (!voiceSearched) pickVoice();
    var u = new SpeechSynthesisUtterance(text);
    var v = chosenVoice;
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = root.lang || "en"; }
    u.rate = cfg.voiceRate;
    u.volume = vol;
    if (v && !v.localService) {
      u.onerror = function (ev) {
        if (ev && (ev.error === "interrupted" || ev.error === "canceled")) return;
        badVoices[v.voiceURI || v.name] = true;
        pickVoice();
        speak(text);
      };
    }
    keepAlive.push(u);
    if (keepAlive.length > 6) keepAlive.shift();
    if (synth.speaking || synth.pending) {
      synth.cancel();
      setTimeout(function () { synth.speak(u); }, 80); // Safari drops a phrase spoken right after cancel()
    } else {
      synth.speak(u);
    }
  }

  /* ---------- Sound: claw noises, made in the browser ---------- */
  function sfxOk() { return settings.sounds && settings.volume > 0 && actx; }
  function level(g) { return g * Math.max(0, Math.min(100, settings.volume)) / 100; }
  function tone(freq, at, dur, type, gain, toFreq) {
    if (!sfxOk()) return;
    try {
      if (actx.state === "suspended" && actx.resume) actx.resume();
      var t0 = actx.currentTime + at;
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || "triangle";
      o.frequency.setValueAtTime(freq, t0);
      if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(level(gain || 0.25), t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) { /* ignore */ }
  }
  // A low motor hum while the claw moves. Returns a function that stops it.
  function hum() {
    if (!sfxOk()) return function () {};
    try {
      var o = actx.createOscillator(), o2 = actx.createOscillator(), f = actx.createBiquadFilter(), g = actx.createGain();
      o.type = "sawtooth"; o.frequency.value = 72;
      o2.type = "square"; o2.frequency.value = 108;
      f.type = "lowpass"; f.frequency.value = 420;
      var t0 = actx.currentTime;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(level(0.09), t0 + 0.06);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(actx.destination);
      o.start(); o2.start();
      return function () {
        try {
          var t1 = actx.currentTime;
          g.gain.cancelScheduledValues(t1);
          g.gain.setValueAtTime(g.gain.value || level(0.09), t1);
          g.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.08);
          o.stop(t1 + 0.1); o2.stop(t1 + 0.1);
        } catch (e) { /* ignore */ }
      };
    } catch (e) { return function () {}; }
  }
  function sfxClunk() { tone(140, 0, 0.12, "square", 0.22, 60); tone(900, 0, 0.05, "square", 0.08); }
  function sfxDrop() { tone(900, 0, 0.45, "sine", 0.18, 180); }
  function sfxPrize() { [660, 880, 1175].forEach(function (f, i) { tone(f, i * 0.09, 0.35, "triangle", 0.22); }); }
  function sfxRight() { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.1, 0.4, "triangle", 0.25); }); }
  function sfxStep() { tone(300, 0, 0.06, "square", 0.08); }

  /* ---------- Announcements for screen readers ---------- */
  var announceTimer = null;
  function announce(text) {
    live.textContent = "";
    clearTimeout(announceTimer);
    announceTimer = setTimeout(function () { live.textContent = text; }, 60);
  }

  /* ---------- Machine geometry (machine units; the machine is 800 x 1000) ---------- */
  var M = {
    pileLeft: 252, pileRight: 744, pileBottom: 742, pileMaxH: 330,
    clawW: 170, jaw: 106,           // jaw: from the top of the claw down to the middle of a held toy
    restY: 160,                     // top of the claw when it is up
    homeX: 137,                     // over the prize chute
    doorX: 177, doorY: 884, prizeSize: 140,
    steerMin: 290, steerMax: 706, steerStep: 69
  };
  function U(n) { return "calc(var(--u) * " + (Math.round(n * 10) / 10) + ")"; }

  var claw = { x: M.homeX, y: M.restY, closed: false };
  var steerX = (M.pileLeft + M.pileRight) / 2;
  function renderClaw() {
    clawEl.style.left = U(claw.x - M.clawW / 2);
    clawEl.style.top = U(claw.y);
    carriageEl.style.left = U(claw.x - 35);
    cableEl.style.left = U(claw.x - 4);
    cableEl.style.height = U(Math.max(0, claw.y - 150 + 14));
  }
  function setClawClosed(c) {
    claw.closed = c;
    clawEl.src = c ? cfg.clawClosed : cfg.clawOpen;
  }
  function placeToy(t) {
    t.el.style.left = U(t.x - t.s / 2);
    t.el.style.top = U(t.y - t.s / 2);
    t.el.style.width = U(t.s);
    t.el.style.height = U(t.s);
    t.el.style.setProperty("--rot", "rotate(" + t.rot + "deg)");
    t.el.style.transform = "rotate(" + t.rot + "deg)";
  }

  /* ---------- Animation helpers ---------- */
  var runId = 0;
  var raf = window.requestAnimationFrame || function (f) { return setTimeout(function () { f(Date.now()); }, 16); };
  function now() { return window.performance && performance.now ? performance.now() : Date.now(); }
  function easeInOut(p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }
  function easeIn(p) { return p * p; }
  // Calls step(0..1) over ms. In calm mode (movement effects off) it jumps to the end.
  function tween(ms, step, ease) {
    return new Promise(function (resolve) {
      if (!settings.animation || ms <= 0) { step(1); resolve(); return; }
      var t0 = now();
      (function frame() {
        var p = Math.min(1, (now() - t0) / ms);
        step((ease || easeInOut)(p));
        if (p < 1) raf(frame); else resolve();
      })();
    });
  }
  // A pause. In calm mode pauses stay, but shorter, so each step can still be seen.
  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, settings.animation ? ms : Math.round(ms * 0.6)); });
  }
  function moveClawTo(x, y, ms, carried) {
    var x0 = claw.x, y0 = claw.y;
    return tween(ms, function (p) {
      claw.x = x0 + (x - x0) * p;
      claw.y = y0 + (y - y0) * p;
      renderClaw();
      if (carried) { carried.x = claw.x; carried.y = claw.y + M.jaw; placeToy(carried); }
    });
  }
  function travelMs(dx) { return Math.max(250, Math.min(1300, Math.abs(dx) * 2.1)); }

  /* ---------- Game state ---------- */
  var pile = [];          // toys in the machine: { id, el, x, y, s, rot, z, home }
  var prize = null;       // the toy sitting in the prize door
  var tally = {};
  var grabsDone = 0, guessesRight = 0, score = 0;
  var currentGuess = null;
  var busy = false, finished = false;
  var lastResult = null;  // { id, guess }

  function counts() {
    var c = {};
    setup.toys.forEach(function (t) { c[t.id] = 0; });
    pile.forEach(function (p) { c[p.id] = (c[p.id] || 0) + 1; });
    return c;
  }
  function machineWords() {
    var c = counts();
    var parts = setup.toys.map(function (t) { return countWords(t.id, c[t.id] || 0); });
    return pile.length + (pile.length === 1 ? " toy: " : " toys: ") + listWords(parts);
  }

  // Lay the toys out as a mixed-up heap at the bottom of the machine.
  function makeSlots(n) {
    var W = M.pileRight - M.pileLeft, s = 150, step, cols, rows;
    for (; s >= 60; s -= 4) {
      step = s * 0.86;
      cols = Math.max(1, Math.floor((W - s) / step) + 1);
      rows = Math.ceil(n / cols);
      if (s + (rows - 1) * s * 0.66 <= M.pileMaxH) break;
    }
    var slots = [];
    for (var r = 0; r < rows; r++) {
      var cnt = Math.min(cols, n - r * cols);
      var rowW = (cnt - 1) * step + s;
      var x0 = M.pileLeft + (W - rowW) / 2 + s / 2 + ((r % 2) && cnt < cols ? step / 2 : 0);
      for (var c = 0; c < cnt; c++) {
        slots.push({
          x: Math.min(M.pileRight - s / 2, x0 + c * step + (Math.random() * 16 - 8)),
          y: M.pileBottom - 8 - s / 2 - r * s * 0.66 + (Math.random() * 10 - 5),
          rot: Math.round(Math.random() * 32 - 16),
          s: s,
          z: 10 + r * 20 + Math.floor(Math.random() * 10)
        });
      }
    }
    return slots;
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function makeToyEl(id) {
    var img = document.createElement("img");
    img.className = "toy";
    img.src = TOY[id].image;
    img.alt = "";
    img.draggable = false;
    return img;
  }

  function newGame() {
    runId++;
    busy = false;
    finished = false;
    pileEl.innerHTML = ""; prizeLayer.innerHTML = ""; carryLayer.innerHTML = "";
    pile = []; prize = null;
    var ids = [];
    setup.toys.forEach(function (t) { for (var i = 0; i < t.count; i++) ids.push(t.id); });
    shuffle(ids);
    var slots = makeSlots(ids.length);
    // Put the bottom rows in first; toys higher up sit on top of them.
    ids.forEach(function (id, i) {
      var sl = slots[i];
      var t = { id: id, el: makeToyEl(id), x: sl.x, y: sl.y, s: sl.s, rot: sl.rot, z: sl.z };
      t.home = { x: sl.x, y: sl.y, s: sl.s, rot: sl.rot };
      t.el.style.zIndex = sl.z;
      placeToy(t);
      pileEl.appendChild(t.el);
      pile.push(t);
    });
    tally = {};
    setup.toys.forEach(function (t) { tally[t.id] = 0; });
    grabsDone = 0; guessesRight = 0; score = 0;
    currentGuess = null; lastResult = null;
    setClawClosed(false);
    claw.x = settings.control === "steer" ? steerX : M.homeX;
    claw.y = M.restY;
    renderClaw();
    $("result").hidden = true;
    renderAll();
    fitStage();
  }

  /* ---------- Side panel ---------- */
  function renderAll() {
    renderGuesses();
    renderTally(null);
    renderControls();
    renderScore(false);
    machine.setAttribute("aria-label", "Claw machine with " + machineWords());
    fitStage();
  }
  function renderScore(bump) {
    $("score-value").textContent = String(score);
    $("score").setAttribute("aria-label", "Score: " + score);
    var gc = $("grab-count");
    gc.textContent = setup.grabs ? "Grab " + Math.min(grabsDone + 1, setup.grabs) + " of " + setup.grabs : "Grabs: " + grabsDone;
    if (setup.grabs && finished) gc.textContent = grabsDone + " grabs done";
    $("score").hidden = !setup.guess;
    if (bump && settings.animation) {
      var el = $("score");
      el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
    }
  }
  function renderGuesses() {
    var box = $("guesses");
    var c = counts();
    var total = pile.length;
    box.innerHTML = "";
    var asButtons = setup.guess;
    box.setAttribute("role", asButtons ? "group" : "list");
    box.setAttribute("aria-label", asButtons ? "Guess a toy" : "In the machine");
    setup.toys.forEach(function (t, i) {
      var n = c[t.id] || 0;
      var el = document.createElement(asButtons ? "button" : "div");
      el.className = "guess" + (n === 0 ? " is-zero" : "");
      if (asButtons) {
        el.type = "button";
        el.setAttribute("aria-pressed", currentGuess === t.id ? "true" : "false");
        el.addEventListener("click", function () { chooseGuess(t.id); });
        el.dataset.id = t.id;
      } else {
        el.setAttribute("role", "listitem");
      }
      var countText = n === 0 ? "none in the machine" : n + " in the machine";
      el.innerHTML = '<img src="' + esc(TOY[t.id].image) + '" alt="">' +
        '<span><span class="g-name">' + esc(cap(TOY[t.id].name)) + '</span><span class="g-count">' + countText + "</span></span>";
      el.setAttribute("aria-label", cap(TOY[t.id].name) + ", " + (n === 0 ? "none" : n + " of " + total) + " in the machine" + (asButtons && i < 9 ? "" : ""));
      box.appendChild(el);
    });
    renderPrompt();
  }
  function renderPrompt() {
    var p = $("prompt");
    var steer = settings.control === "steer";
    if (finished) p.textContent = "Game over! Press New game to play again.";
    else if (busy) p.textContent = "Here comes the claw…";
    else if (setup.guess && !currentGuess) p.textContent = grabsDone ? "Guess again! Which toy will it grab?" : "Make a guess! Which toy will the claw grab?";
    else if (setup.guess) p.textContent = "You guessed " + nameOf(currentGuess, 1) + ". " + (steer ? "Move the claw, then press Drop!" : "Now press Grab!");
    else p.textContent = steer ? "Move the claw, then press Drop!" : "Press Grab!";
  }
  function renderControls() {
    var steer = settings.control === "steer";
    grabBtn.hidden = steer;
    $("steer").hidden = !steer;
    var ready = !busy && !finished && (!setup.guess || !!currentGuess);
    [grabBtn, dropBtn].forEach(function (b) { b.setAttribute("aria-disabled", ready ? "false" : "true"); });
    var canMove = !busy && !finished;
    leftBtn.setAttribute("aria-disabled", canMove && steerX > M.steerMin + 1 ? "false" : "true");
    rightBtn.setAttribute("aria-disabled", canMove && steerX < M.steerMax - 1 ? "false" : "true");
    $("guesses").querySelectorAll("button").forEach(function (b) { b.disabled = busy || finished; });
    renderPrompt();
  }
  function tallyMarks(n, color) {
    var out = "";
    for (var g = 0; g < Math.ceil(n / 5); g++) {
      var k = Math.min(5, n - g * 5);
      var lines = "";
      for (var i = 0; i < Math.min(4, k); i++) lines += '<path d="M' + (8 + i * 10) + ' 4V36"/>';
      if (k === 5) lines += '<path d="M2 31L46 9"/>';
      out += '<svg viewBox="0 0 48 40" aria-hidden="true"><g stroke="' + color + '" stroke-width="4.5" stroke-linecap="round" fill="none">' + lines + "</g></svg>";
    }
    return out;
  }
  function renderTally(newId) {
    var body = $("tally-body");
    body.innerHTML = "";
    var hc = root.classList.contains("hc");
    $("tally-table").classList.toggle("is-many", setup.toys.length > 4);
    setup.toys.forEach(function (t) {
      var n = tally[t.id] || 0;
      var tr = document.createElement("tr");
      if (newId === t.id) tr.className = "t-new";
      tr.innerHTML = '<td class="t-toy"><img src="' + esc(TOY[t.id].image) + '" alt="' + esc(cap(TOY[t.id].plural || TOY[t.id].name)) + '"></td>' +
        '<td class="t-marks"><span aria-hidden="true">' + tallyMarks(n, hc ? "#000" : (TOY[t.id].color || "#333")) + "</span>" +
        '<span class="sr-only">' + n + "</span></td>" +
        '<td class="t-num">' + n + "</td>";
      body.appendChild(tr);
    });
    var gs = $("guess-score");
    gs.hidden = !setup.guess || grabsDone === 0;
    gs.textContent = "Guesses right: " + guessesRight + " of " + grabsDone;
  }

  /* ---------- Guessing ---------- */
  function chooseGuess(id) {
    if (busy || finished) return;
    currentGuess = id;
    $("guesses").querySelectorAll("button").forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.id === id ? "true" : "false");
    });
    renderControls();
    var steer = settings.control === "steer";
    announce("You guessed " + nameOf(id, 1) + ". " + (steer ? "Move the claw, then press Drop." : "Now press Grab."));
    // Go straight to the Grab button (one less step for switch and keyboard users).
    var next = steer ? dropBtn : grabBtn;
    setTimeout(function () { next.focus(); }, 30);
  }

  /* ---------- Grabbing ---------- */
  // Every toy in the machine has the same chance. That makes each kind of toy as
  // likely as its share of the machine (6 red balls out of 10 toys: 6 in 10).
  function pickToy() { return pile[Math.floor(Math.random() * pile.length)]; }

  function needGuess() {
    var msg = "Make a guess first. Which toy will the claw grab?";
    announce(msg);
    speak("Make a guess first.");
    var p = $("prompt");
    p.textContent = msg;
    var first = $("guesses").querySelector("button");
    if (first) first.focus();
  }

  function putPrizeAway(run) {
    if (!prize) return Promise.resolve();
    var t = prize;
    prize = null;
    if (!setup.putBack) {
      return tween(300, function (p) { t.el.style.opacity = String(1 - p); }).then(function () { t.el.remove(); });
    }
    // Put it back in the machine, in its old spot.
    return tween(260, function (p) { t.el.style.opacity = String(1 - p); }).then(function () {
      if (run !== runId) return;
      t.x = t.home.x; t.y = t.home.y; t.s = t.home.s; t.rot = t.home.rot;
      placeToy(t);
      t.el.classList.remove("prize-pop");
      t.el.style.zIndex = t.z;
      pileEl.appendChild(t.el);
      pile.push(t);
      return tween(260, function (p) { t.el.style.opacity = String(p); });
    });
  }

  function grab() {
    if (busy || finished) return;
    if (setup.guess && !currentGuess) { needGuess(); return; }
    if (!pile.length && !prize) return;
    var run = runId;
    busy = true;
    renderControls();
    renderScore(false);
    $("result").hidden = true;
    var steer = settings.control === "steer";
    var stop = function () {};

    return putPrizeAway(run).then(function () {
      if (run !== runId) throw run;
      if (!pile.length) throw run;
      var t = pickToy();
      if (steer) {
        // The claw drops where the student put it, and swings to the nearest toy of the picked kind.
        var best = null;
        pile.forEach(function (q) {
          if (q.id === t.id && (!best || Math.abs(q.x - claw.x) < Math.abs(best.x - claw.x))) best = q;
        });
        t = best || t;
      }
      var target = t;
      return Promise.resolve().then(function () {
        if (steer) return null;
        stop = hum();
        return moveClawTo(target.x, M.restY, travelMs(target.x - claw.x));
      }).then(function () {
        stop(); stop = function () {};
        if (run !== runId) throw run;
        sfxDrop();
        return moveClawTo(target.x, target.y - M.jaw, 750);
      }).then(function () {
        if (run !== runId) throw run;
        setClawClosed(true);
        sfxClunk();
        // Take it out of the machine and into the claw.
        pile.splice(pile.indexOf(target), 1);
        carryLayer.appendChild(target.el);
        target.rot = Math.round(target.rot / 2);
        target.x = claw.x; target.y = claw.y + M.jaw; placeToy(target);
        return wait(280);
      }).then(function () {
        if (run !== runId) throw run;
        return moveClawTo(claw.x, M.restY, 750, target);
      }).then(function () {
        if (run !== runId) throw run;
        stop = hum();
        return moveClawTo(M.homeX, M.restY, travelMs(M.homeX - claw.x), target);
      }).then(function () {
        stop(); stop = function () {};
        if (run !== runId) throw run;
        setClawClosed(false);
        sfxDrop();
        // Drop it down the chute into the prize door.
        prizeLayer.appendChild(target.el);
        var x0 = target.x, y0 = target.y, s0 = target.s, r0 = target.rot;
        return tween(520, function (p) {
          target.x = x0 + (M.doorX - x0) * p;
          target.y = y0 + (M.doorY - y0) * p;
          target.s = s0 + (M.prizeSize - s0) * p;
          target.rot = r0 * (1 - p);
          placeToy(target);
        }, easeIn).then(function () { return target; });
      });
    }).then(function (target) {
      if (run !== runId) return;
      prize = target;
      target.el.classList.add("prize-pop");
      machine.classList.remove("shake"); void machine.offsetWidth; machine.classList.add("shake");
      sfxPrize();
      showResult(target.id);
      // Steer mode: the claw goes back to where the student left it.
      if (steer) {
        stop = hum();
        return moveClawTo(steerX, M.restY, travelMs(steerX - claw.x)).then(function () { stop(); });
      }
    }).catch(function (r) {
      stop();
      if (r !== run) throw r;
    }).then(function () {
      if (run !== runId) return;
      busy = false;
      renderControls();
      renderScore(false);
      checkEnd();
    });
  }

  function showResult(id) {
    grabsDone += 1;
    tally[id] = (tally[id] || 0) + 1;
    var guess = currentGuess;
    var right = setup.guess && guess === id;
    if (right) { guessesRight += 1; score += cfg.pointsPerCorrect; }
    lastResult = { id: id, guess: guess };
    currentGuess = null;

    var got = gotPhrase(id);
    var verdict = !setup.guess ? "" : right ? cfg.phrases.guessRight : cfg.phrases.guessWrong;
    var box = $("result");
    $("result-img").src = TOY[id].image;
    $("result-img").alt = "";
    $("result-text").innerHTML = esc(got) + (verdict ? '<span class="verdict">' + esc(verdict) +
      (right ? " +" + cfg.pointsPerCorrect : " You guessed " + esc(nameOf(guess, 1)) + ".") + "</span>" : "");
    box.classList.toggle("is-right", !!right);
    box.hidden = false;

    renderGuesses();
    renderTally(id);
    renderScore(right);
    machine.setAttribute("aria-label", "Claw machine with " + machineWords());

    // Words for screen readers: what came out, the guess, and the tally so far.
    var tallyWords = setup.toys.map(function (t) { return countWords(t.id, tally[t.id] || 0); });
    var words = got + (setup.guess ? " You guessed " + nameOf(guess, 1) + ". " + verdict + (right ? " Score " + score + "." : "") : "") +
      " Tally: " + listWords(tallyWords) + ".";
    if (!setup.putBack) words += " Left in the machine: " + machineWords() + ".";
    announce(words);
    speak(got + (verdict ? " " + verdict : ""));
    if (right) sfxRight();
    fitStage();
  }

  function checkEnd() {
    var limitHit = setup.grabs > 0 && grabsDone >= setup.grabs;
    var empty = !setup.putBack && pile.length === 0;
    if (!limitHit && !empty) return;
    finished = true;
    renderControls();
    renderScore(false);
    var run = runId;
    setTimeout(function () { if (run === runId) showDone(empty && !limitHit); }, settings.animation ? 1700 : 900);
  }

  /* ---------- End of game ---------- */
  function showDone(empty) {
    $("done-title").textContent = empty ? "The machine is empty!" : "All done!";
    $("done-desc").textContent = "You made " + grabsDone + (grabsDone === 1 ? " grab" : " grabs") + ". Here is what the claw got:";
    var ul = $("done-tally");
    ul.innerHTML = "";
    setup.toys.forEach(function (t) {
      var n = tally[t.id] || 0;
      var li = document.createElement("li");
      li.innerHTML = '<img src="' + esc(TOY[t.id].image) + '" alt=""><span>' + esc(cap(nameOf(t.id, n))) + ": <strong>" + n + "</strong></span>";
      ul.appendChild(li);
    });
    $("done-score").hidden = !setup.guess;
    $("done-score").innerHTML = "Guesses right: <strong>" + guessesRight + "</strong> of " + grabsDone;
    showPanel("panel-done", grabBtn);
    speak(empty ? cfg.phrases.empty : cfg.phrases.finish);
    if (settings.sounds) [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.14, 0.5, "triangle", 0.25); });
  }

  /* ---------- Steering ---------- */
  function steer(dir) {
    if (busy || finished || settings.control !== "steer") return;
    var nx = Math.max(M.steerMin, Math.min(M.steerMax, steerX + dir * M.steerStep));
    if (nx === steerX) { announce(dir < 0 ? "The claw is all the way left." : "The claw is all the way right."); return; }
    steerX = nx;
    sfxStep();
    var run = runId;
    moveClawTo(steerX, M.restY, 220).then(function () { if (run === runId) renderControls(); });
    renderControls();
    // Say roughly where it is, and which toys are under it.
    var under = pile.filter(function (t) { return Math.abs(t.x - steerX) < t.s * 0.6; });
    var kinds = {};
    under.forEach(function (t) { kinds[t.id] = true; });
    var names = Object.keys(kinds).map(function (id) { return nameOf(id, 2); });
    var pos = Math.round((steerX - M.steerMin) / (M.steerMax - M.steerMin) * 6) + 1;
    announce("Claw at spot " + pos + " of 7." + (names.length ? " Under it: " + listWords(names) + "." : ""));
  }

  /* ---------- Layout: fit the machine ---------- */
  function fitStage() {
    var w = stage.clientWidth, h = stage.clientHeight;
    if (w <= 0 || h <= 0) return;
    var wide = w / h >= 1.15 && w >= 640;
    stage.classList.toggle("is-wide", wide);
    stage.classList.toggle("is-tall", !wide);
    if (wide) stage.classList.remove("is-roomy");
    var u;
    if (wide) {
      // The machine takes the full height; the side panel gets at least 330px.
      u = Math.min(h / 1000, (w - 330 - 18) / 800);
      stage.style.setProperty("--machine-w", Math.floor(800 * u) + "px");
    } else {
      // Tall: the machine, then everything down to the Grab button must fit.
      // Wide enough (iPad held upright): score and tally go beside the machine,
      // everything else below it. Phones: score and tally go below (scroll to see them).
      var roomy = w >= 680;
      stage.classList.toggle("is-roomy", roomy);
      var side = $("side");
      var extraTop = root.classList.contains("is-fullscreen") ? 66 : 0;
      var need;
      if (roomy) {
        need = 0;
        ["result", "prompt", "guesses", "controls"].forEach(function (id) {
          var el = $(id);
          if (!el.hidden) need += el.getBoundingClientRect().height + 12;
        });
      } else {
        need = side.getBoundingClientRect().height;
      }
      var mh = Math.max(200, h * 0.42, Math.min(h - need - 10 - extraTop, (w - 4) * 1.25));
      if (roomy) mh = Math.min(mh, (w - 300) * 1.25);
      mh = Math.min(mh, (w - 4) * 1.25, h - extraTop);
      stage.style.setProperty("--machine-h", Math.floor(mh + extraTop) + "px");
      u = Math.min((roomy ? w - 300 : w - 4) / 800, mh / 1000);
    }
    root.style.setProperty("--u", Math.max(0.1, u) + "px");
  }

  /* ---------- Panels ---------- */
  var openPanel = null, returnFocus = null;
  function showPanel(id, opener, focusEl) {
    if (openPanel) hidePanel(true);
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
    if (was === "panel-setup" && !silent) { applyDraft(); }
    openPanel.hidden = true;
    openPanel = null;
    $("app").removeAttribute("aria-hidden");
    if (silent) return;
    if (was === "panel-done") {
      newGame();
      announce("New game. " + directionsText());
      focusStart();
      return;
    }
    if (returnFocus && returnFocus.focus && !returnFocus.closest("[hidden]")) returnFocus.focus();
    else focusStart();
  }
  function focusStart() {
    var first = setup.guess ? $("guesses").querySelector("button") : (settings.control === "steer" ? dropBtn : grabBtn);
    if (first) first.focus();
  }
  document.querySelectorAll(".overlay").forEach(function (ov) {
    ov.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) { hidePanel(); return; }
      if (e.target === ov && ov.id !== "panel-done") hidePanel();
    });
  });
  document.addEventListener("keydown", function (e) {
    if (!openPanel) return;
    if (e.key === "Escape") { e.preventDefault(); hidePanel(); return; }
    if (e.key === "Tab") { // keep focus inside the open panel
      var items = Array.prototype.filter.call(openPanel.querySelectorAll("button, input, select, [tabindex='0']"), function (el) {
        return !el.disabled && !el.closest("[hidden]");
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
  var draft = null;
  function draftCount(id) {
    for (var i = 0; i < draft.toys.length; i++) if (draft.toys[i].id === id) return draft.toys[i];
    return null;
  }
  function setDraftToy(id, on, count) {
    var list = [];
    cfg.toys.forEach(function (t) {
      if (t.id === id) { if (on) list.push({ id: id, count: count }); }
      else { var d = draftCount(t.id); if (d) list.push(d); }
    });
    draft.toys = list;
  }
  function openSetup(e) {
    draft = JSON.parse(JSON.stringify(setup));
    var presets = $("presets");
    presets.innerHTML = "";
    cfg.presets.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn";
      b.textContent = p.name;
      b.addEventListener("click", function () {
        var keep = { putBack: draft.putBack, guess: draft.guess, grabs: draft.grabs };
        draft = cleanSetup(Object.assign({ toys: p.toys }, keep));
        renderSetup();
        $("setup-live").textContent = p.name + ": " + setupSummary(draft);
      });
      presets.appendChild(b);
    });
    $("set-putback").checked = draft.putBack;
    $("set-guess").checked = draft.guess;
    $("set-grabs").value = String(draft.grabs);
    if (!$("set-grabs").value) { $("set-grabs").value = "10"; }
    $("set-lock").checked = false;
    $("copied").textContent = "";
    renderSetup();
    showPanel("panel-setup", e && e.currentTarget);
  }
  function setupSummary(s) {
    var n = setupTotal(s);
    if (!s.toys.length) return "No toys yet.";
    return listWords(s.toys.map(function (t) { return countWords(t.id, t.count); })) + ". " + n + (n === 1 ? " toy" : " toys") + " in the machine.";
  }
  function renderSetup() {
    var rows = $("toy-rows");
    rows.innerHTML = "";
    var total = setupTotal(draft);
    cfg.toys.forEach(function (t) {
      var d = draftCount(t.id);
      var on = !!d, n = d ? d.count : 0;
      var row = document.createElement("div");
      row.className = "toy-row" + (on ? "" : " is-off");
      var idOn = "toy-on-" + t.id;
      row.innerHTML =
        '<img class="toy-pic" src="' + esc(t.image) + '" alt="">' +
        '<label class="toggle" for="' + idOn + '"><input type="checkbox" id="' + idOn + '"' + (on ? " checked" : "") + '>' +
        '<span class="toggle-track" aria-hidden="true"></span><span class="toggle-text">' + esc(cap(t.plural || t.name)) + "</span></label>" +
        '<div class="stepper" role="group" aria-label="How many ' + esc(t.plural || t.name) + '">' +
        '<button type="button" class="btn" data-step="-1" aria-label="Fewer ' + esc(t.plural || t.name) + '"' + (!on || n <= 0 ? " disabled" : "") + '>−</button>' +
        '<output aria-live="off">' + n + "</output>" +
        '<button type="button" class="btn" data-step="1" aria-label="More ' + esc(t.plural || t.name) + '"' + (!on || n >= cfg.maxEach || total >= cfg.maxTotal ? " disabled" : "") + ">+</button></div>";
      row.querySelector("input").addEventListener("change", function (ev) {
        setDraftToy(t.id, ev.target.checked, ev.target.checked ? Math.min(n || 1, Math.max(0, cfg.maxTotal - total)) : 0);
        renderSetup();
        $("toy-on-" + t.id).focus();
      });
      row.querySelectorAll("[data-step]").forEach(function (b) {
        b.addEventListener("click", function () {
          var step = Number(b.dataset.step);
          var nn = Math.max(0, Math.min(cfg.maxEach, n + step));
          if (step > 0 && total >= cfg.maxTotal) return;
          setDraftToy(t.id, true, nn);
          renderSetup();
          var again = $("toy-rows").querySelector('#toy-on-' + t.id).closest(".toy-row").querySelector('[data-step="' + step + '"]');
          if (again && !again.disabled) again.focus();
          else $("toy-rows").querySelector('#toy-on-' + t.id).closest(".toy-row").querySelector('[data-step="' + (-step) + '"]').focus();
          $("setup-live").textContent = countWords(t.id, nn) + ". " + setupTotal(draft) + " toys in the machine.";
        });
      });
      rows.appendChild(row);
    });
    var tot = $("setup-total");
    var ok = setupOk(draft);
    tot.textContent = ok ? setupSummary(draft) : (total < 1 ? "Put at least 1 toy in the machine." : "That is too many toys. The machine holds " + cfg.maxTotal + ".");
    tot.classList.toggle("is-bad", !ok);
    $("btn-setup-done").disabled = !ok;
    updateLink();
  }
  function updateLink() {
    if (!draft) return;
    $("share-link").value = setupOk(draft) ? linkFor(draft, $("set-lock").checked) : "";
    $("copied").textContent = "";
  }
  function applyDraft() {
    if (!draft || !setupOk(draft)) { draft = null; return; }
    var changed = JSON.stringify(draft) !== JSON.stringify(setup);
    setup = cleanSetup(draft);
    draft = null;
    saveSetup();
    if (changed) {
      // A setup link in the address bar no longer matches, so drop it.
      try {
        if (/[?&]toys=/.test(location.search) && history.replaceState) {
          history.replaceState(null, "", location.pathname + (locked ? "?lock=1" : "") + location.hash);
        }
      } catch (e) { /* ignore */ }
      newGame();
      announce("New game. " + directionsText());
    }
  }
  $("set-putback").addEventListener("change", function (e) { draft.putBack = e.target.checked; updateLink(); });
  $("set-guess").addEventListener("change", function (e) { draft.guess = e.target.checked; updateLink(); });
  $("set-grabs").addEventListener("change", function (e) { draft.grabs = Number(e.target.value); updateLink(); });
  $("set-lock").addEventListener("change", updateLink);
  $("btn-setup-done").addEventListener("click", function () {
    var before = JSON.stringify(setup);
    hidePanel();
    if (JSON.stringify(setup) === before) { newGame(); announce("New game. " + directionsText()); }
    focusStart();
  });
  $("btn-copy-link").addEventListener("click", function () {
    var input = $("share-link");
    var text = input.value;
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
      try { navigator.share({ title: "Claw Machine", url: $("share-link").value }).catch(function () {}); } catch (e) { /* ignore */ }
    });
  }

  /* ---------- Settings controls ---------- */
  function applySettings() {
    root.classList.toggle("hc", !!settings.highContrast);
    root.classList.toggle("no-motion", !settings.animation);
  }
  function bindSettings() {
    var voice = $("set-voice"), sounds = $("set-sounds"), vol = $("set-volume"),
        anim = $("set-animation"), hc = $("set-contrast"), control = $("set-control");
    voice.checked = !!settings.voice;
    sounds.checked = !!settings.sounds;
    vol.value = settings.volume;
    vol.setAttribute("aria-valuetext", settings.volume + " percent");
    anim.checked = !!settings.animation;
    hc.checked = !!settings.highContrast;
    control.value = settings.control === "steer" ? "steer" : "button";
    voice.addEventListener("change", function () { settings.voice = voice.checked; saveSettings(); if (voice.checked) speak("Voice on."); });
    sounds.addEventListener("change", function () { settings.sounds = sounds.checked; saveSettings(); sfxPrize(); });
    vol.addEventListener("input", function () {
      settings.volume = Number(vol.value);
      vol.setAttribute("aria-valuetext", vol.value + " percent");
      saveSettings();
    });
    vol.addEventListener("change", function () { sfxPrize(); speak("Volume " + vol.value + " percent."); });
    anim.addEventListener("change", function () { settings.animation = anim.checked; saveSettings(); applySettings(); });
    hc.addEventListener("change", function () { settings.highContrast = hc.checked; saveSettings(); applySettings(); renderTally(null); });
    control.addEventListener("change", function () {
      settings.control = control.value; saveSettings();
      if (!busy) {
        claw.x = settings.control === "steer" ? steerX : M.homeX;
        renderClaw();
      }
      renderControls();
      fitStage();
    });
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
  // iPhone Safari can't make a page full screen: the button still hides the top bar,
  // and the first time it explains Add to Home Screen for true full screen.
  var pseudoFs = false;
  function fallbackFullscreen() {
    pseudoFs = true;
    updateFsButton();
    fitStage();
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
      focusStart();
      announce("Full screen. To leave, use the Exit full screen button in the top corner.");
    } else if (!on && wasOn) {
      $("btn-fullscreen").focus();
    }
  }
  function toggleFullscreen() {
    if (pseudoFs) { pseudoFs = false; updateFsButton(); fitStage(); return; }
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
  document.addEventListener("fullscreenchange", function () { updateFsButton(); fitStage(); });
  document.addEventListener("webkitfullscreenchange", function () { updateFsButton(); fitStage(); });

  /* ---------- Directions ---------- */
  function directionsText() {
    var steer = settings.control === "steer";
    var t = "In the machine: " + machineWords() + ". ";
    if (setup.guess) t += "First, guess which toy the claw will grab. Then ";
    else t += "";
    t += (setup.guess ? "" : "") + (steer ? (setup.guess ? "move" : "Move") + " the claw with the arrow buttons and press Drop. " : (setup.guess ? "press" : "Press") + " Grab. ");
    t += "The claw grabs a toy at random, so the more there are of a toy, the more likely it is. ";
    t += setup.putBack ? "Each toy goes back in the machine after you see it. " : "Each toy you grab stays out of the machine. ";
    t += "Your tally shows what the claw got.";
    return t;
  }

  /* ---------- Keyboard ---------- */
  document.addEventListener("keydown", function (e) {
    if (openPanel || e.altKey || e.ctrlKey || e.metaKey) return;
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (settings.control === "steer" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      steer(e.key === "ArrowLeft" ? -1 : 1);
      return;
    }
    // Number keys 1 to 9 pick a guess.
    if (setup.guess && /^[1-9]$/.test(e.key)) {
      var t = setup.toys[Number(e.key) - 1];
      if (t) { e.preventDefault(); chooseGuess(t.id); }
    }
  });

  /* ---------- Start ---------- */
  if (!cfg.toys.length) {
    $("prompt").textContent = "No toys found in js/config.js.";
    return;
  }
  if (locked) $("btn-setup").hidden = true;
  setClawClosed(false);
  applySettings();
  bindSettings();
  newGame();
  fitStage();
  // Load the closed claw now so it doesn't flash later.
  (new Image()).src = cfg.clawClosed;

  // Activating an aria-disabled button: explain instead of acting.
  grabBtn.addEventListener("click", function () { unlockAudio(true); grab(); });
  dropBtn.addEventListener("click", function () { unlockAudio(true); grab(); });
  leftBtn.addEventListener("click", function () { steer(-1); });
  rightBtn.addEventListener("click", function () { steer(1); });
  $("btn-new").addEventListener("click", function () {
    newGame();
    announce("New game. " + directionsText());
  });
  $("btn-directions").addEventListener("click", function () {
    var text = directionsText();
    announce(text);
    speak(text);
  });
  $("btn-settings").addEventListener("click", function (e) { showPanel("panel-settings", e.currentTarget); });
  $("btn-setup").addEventListener("click", openSetup);
  $("btn-again").addEventListener("click", function () { hidePanel(); });

  if (isStandalone()) { pseudoFs = true; updateFsButton(); fitStage(); }
  $("btn-fullscreen").addEventListener("click", toggleFullscreen);
  $("btn-exit-fs").addEventListener("click", toggleFullscreen);

  if (window.ResizeObserver) new ResizeObserver(fitStage).observe(stage);
  window.addEventListener("resize", fitStage);
  window.addEventListener("orientationchange", function () { setTimeout(fitStage, 200); });
})();
