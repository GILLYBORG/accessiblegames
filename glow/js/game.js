/* Spot the Glow: a vision activity for students with low vision.
   A bright glowing shape on a black screen.
   - Find the glow: it shows up somewhere. Tap it, rest your eyes (eye gaze dwell) on it, or press a switch.
   - Follow the glow: it moves slowly along a path. Keeping a finger, mouse or eye gaze on it makes it
     shine brighter and chime. A tap or switch press makes it sparkle.
   Nothing flashes: every change fades over half a second or more. Nothing is timed against the student.
   Everything is drawn in the browser (no picture or sound files). Results stay in memory only. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var params = new URLSearchParams(location.search);
  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ---------- Settings (saved on this device) ---------- */
  var SKEY = "spot-the-glow-settings";
  function load(key) { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; } }
  function store(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  var defaults = {
    colour: "yellow", shape: "circle", size: 3, pulse: !reduceMotion, bg: "black", extra: 0,
    where: "any", pause: 1, fade: 0.6, help: 8, sayWhere: true, moveOn: 0, anyTap: false,
    path: "side", speed: 2, stops: false,
    switchFinds: true, dwell: 0, gap: 0.25, hold: 3, scan: true, scanSeconds: 2,
    voice: true, rate: 0.9, sounds: true, volume: 70, count: true, fsTipSeen: false
  };
  var saved = load(SKEY);
  var settings = Object.assign({}, defaults, saved);
  function setSetting(key, value) { settings[key] = value; saved[key] = value; store(SKEY, saved); }

  var COLOURS = {
    yellow: "#ffe14d", red: "#ff3b30", pink: "#ff5fb4", orange: "#ff9a1f",
    green: "#3dff7a", blue: "#4fd2ff", white: "#ffffff"
  };
  var COLOUR_WORDS = { yellow: "yellow", red: "red", pink: "pink", orange: "orange", green: "green", blue: "blue", white: "white", rainbow: "glowing" };
  var SHAPE_WORDS = { circle: "light", star: "star", heart: "heart", square: "square", face: "smiley face" };
  var SIZES = [0, 0.045, 0.075, 0.11, 0.16, 0.23]; // glow radius as a share of the shorter screen side
  var PERIODS = [0, 18, 12, 8, 5.5, 4];            // seconds for one trip there and back
  var SPEED_WORDS = ["", "Very slow", "Slow", "Medium", "Quick", "Fast"];
  var PATHS = ["side", "updown", "circle", "eight", "diagonal", "bounce", "wander"];
  var WHERES = ["any", "middle", "left", "right", "top", "bottom", "out"];

  // Teacher links (not saved): ?mode=find|follow&colour=red&shape=star&size=1-5&where=left
  //   &path=circle&speed=1-5&dwell=1.5&extra=0|3|8&bg=navy&scan=0&voice=0
  if (COLOURS[params.get("colour")] || params.get("colour") === "rainbow") settings.colour = params.get("colour");
  if (SHAPE_WORDS[params.get("shape")]) settings.shape = params.get("shape");
  if (/^[1-5]$/.test(params.get("size") || "")) settings.size = Number(params.get("size"));
  if (/^[1-5]$/.test(params.get("speed") || "")) settings.speed = Number(params.get("speed"));
  if (WHERES.indexOf(params.get("where")) >= 0) settings.where = params.get("where");
  if (PATHS.indexOf(params.get("path")) >= 0) settings.path = params.get("path");
  if (params.has("dwell")) settings.dwell = clamp(parseFloat(params.get("dwell")) || 0, 0, 5);
  if (/^(0|3|8)$/.test(params.get("extra") || "")) settings.extra = Number(params.get("extra"));
  if (params.get("bg") === "navy" || params.get("bg") === "black") settings.bg = params.get("bg");
  if (params.get("scan") === "0") settings.scan = false;
  if (params.get("scan") === "1") settings.scan = true;
  if (params.get("voice") === "0") settings.voice = false;

  /* ---------- Colours ---------- */
  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function hslRgb(h, s, l) {
    h /= 360;
    function f(n) { var k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + clamp(a, 0, 1).toFixed(3) + ")"; }
  function mixWhite(c, t) { return [Math.round(lerp(c[0], 255, t)), Math.round(lerp(c[1], 255, t)), Math.round(lerp(c[2], 255, t))]; }
  function glowRgb(time) {
    if (settings.colour === "rainbow") return hslRgb((time * 18) % 360, 1, 0.6); // one full change every 20 s
    return hexRgb(COLOURS[settings.colour] || COLOURS.yellow);
  }

  /* ---------- Elements ---------- */
  var menu = $("menu"), play = $("play"), canvas = $("canvas"), g = canvas.getContext("2d");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".card"));
  var live = $("live");
  function announce(text) { live.textContent = ""; setTimeout(function () { live.textContent = text; }, 40); }

  /* ---------- Speech ---------- */
  var synth = window.speechSynthesis || null;
  var started = false;
  var NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|pipe organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley)\b/i;
  var GOOD_NAMES = /\b(ava|samantha|allison|susan|zoe|evan|nathan|noelle|joelle|nicky|tom|serena|karen|daniel|kate|moira|tessa|aria|jenny|guy|michelle)\b/i;
  var chosenVoice = null;
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
    var best = null, bestScore = -1;
    (synth.getVoices() || []).forEach(function (v) { var sc = scoreVoice(v); if (sc > bestScore) { bestScore = sc; best = v; } });
    chosenVoice = best;
  }
  if (synth) { pickVoice(); if (synth.addEventListener) synth.addEventListener("voiceschanged", pickVoice); }
  var keepAlive = [];
  function speak(text) {
    if (!settings.voice || !synth || !window.SpeechSynthesisUtterance || settings.volume <= 0 || !started) return;
    if (!chosenVoice) pickVoice();
    var u = new SpeechSynthesisUtterance(text);
    if (chosenVoice) { u.voice = chosenVoice; u.lang = chosenVoice.lang; } else { u.lang = "en-US"; }
    u.rate = settings.rate;
    u.volume = clamp(settings.volume, 0, 100) / 100;
    keepAlive.push(u); if (keepAlive.length > 8) keepAlive.shift();
    if (synth.speaking || synth.pending) {
      synth.cancel();
      setTimeout(function () { synth.speak(u); }, 90); // Safari drops a phrase spoken right after cancel()
    } else {
      synth.speak(u);
    }
  }
  function stopSpeech() { if (synth && (synth.speaking || synth.pending)) synth.cancel(); }

  /* ---------- Soft sounds (Web Audio, panned to the glow's side of the screen) ---------- */
  var actx = null, master = null;
  function unlockAudio() {
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* ignore */ }
    if (synth && !started) {
      try { var u = new SpeechSynthesisUtterance(" "); u.volume = 0; synth.speak(u); } catch (e) { /* ignore */ }
    }
    started = true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!actx && AC) { actx = new AC(); master = actx.createGain(); master.connect(actx.destination); }
      if (actx && actx.state === "suspended" && actx.resume) actx.resume();
    } catch (e) { /* ignore */ }
  }
  function note(freq, when, len, vol, pan) {
    if (!actx || !settings.sounds || settings.volume <= 0) return;
    master.gain.value = clamp(settings.volume, 0, 100) / 100 * 0.5;
    var t0 = actx.currentTime + (when || 0);
    var out = master;
    if (actx.createStereoPanner) { var p = actx.createStereoPanner(); p.pan.value = clamp(pan || 0, -1, 1); p.connect(master); out = p; }
    var env = actx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    env.connect(out);
    var o1 = actx.createOscillator(); o1.type = "sine"; o1.frequency.value = freq; o1.connect(env);
    var o2 = actx.createOscillator(), g2 = actx.createGain(); o2.type = "triangle"; o2.frequency.value = freq * 2; g2.gain.value = 0.18;
    o2.connect(g2); g2.connect(env);
    o1.start(t0); o2.start(t0); o1.stop(t0 + len + 0.05); o2.stop(t0 + len + 0.05);
  }
  var SCALE = [392, 440, 523.25, 587.33, 659.25, 784, 880, 1046.5]; // G major pentatonic
  function panFor(x) { return W ? clamp((x / W) * 2 - 1, -1, 1) * 0.85 : 0; }
  function foundSound(x) { var p = panFor(x); note(SCALE[2], 0, 0.7, 0.5, p); note(SCALE[4], 0.1, 0.7, 0.45, p); note(SCALE[7], 0.2, 1.1, 0.4, p); }
  function helpSound(x) { var p = panFor(x); note(SCALE[6], 0, 0.5, 0.35, p); note(SCALE[6], 0.32, 0.6, 0.3, p); }
  function sparkleSound(x) { var p = panFor(x); note(SCALE[5], 0, 0.6, 0.4, p); note(SCALE[7], 0.08, 0.8, 0.32, p); }
  function followSound(i, x) { note(SCALE[i % SCALE.length], 0, 0.55, 0.22, panFor(x)); }

  /* ---------- Canvas size ---------- */
  var W = 0, H = 0, dpr = 1;
  function resize() {
    var r = play.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var oldW = W, oldH = H;
    W = r.width; H = r.height;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    if (oldW && oldH && (oldW !== W || oldH !== H)) placeExtras(true);
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(play);
  window.addEventListener("resize", resize);
  function isFs() { return root.classList.contains("is-fullscreen"); }
  function safeTop() { return isFs() ? 70 : 0; } // keep the glow out from under the Exit button
  function baseR() { return Math.max(16, Math.min(W, H) * SIZES[clamp(settings.size, 1, 5)]); }
  function box() {
    var R = baseR(), m = R * 1.5 + 10;
    var b = { x0: m, x1: W - m, y0: m + safeTop(), y1: H - m };
    if (b.x1 < b.x0) b.x0 = b.x1 = W / 2;
    if (b.y1 < b.y0) b.y0 = b.y1 = H / 2;
    return b;
  }

  /* ---------- State ---------- */
  var mode = null;           // null = games menu, "find", "follow"
  var paused = false, clock = 0;
  var target = { fx: 0.5, fy: 0.5, alpha: 0, scale: 1, boost: 0 };
  var find = { state: "dark", t: 0, helped: false, helpNext: 0, dwellT: 0, prevFx: 0.5, prevFy: 0.5, found: 0, shownThisRun: 0 };
  var follow = { phase: 0, rest: 0, moveClock: 0, lastDir: 0, onT: 0, onStreak: 0, wasOn: false, toneNext: 0, toneI: 0, lastPraise: -99, bx: 0, by: 0, vx: 1, vy: 0.7 };
  var count = 0;
  var particles = [], ripples = [], extras = [];
  var pointers = {};         // pointerId -> {x, y, type, down}
  var stats;
  function clearStats() {
    stats = {
      find: { shown: 0, found: 0, movedOn: 0, times: [], areas: [[], [], [], [], [], [], [], [], []], missedAreas: [0, 0, 0, 0, 0, 0, 0, 0, 0] },
      follow: { play: 0, on: 0, catches: 0 }
    };
  }
  clearStats();

  function targetXY() { return { x: target.fx * W, y: target.fy * H }; }
  function targetR() {
    var pulse = settings.pulse ? 1 + 0.05 * Math.sin(clock * TAU / 2.8) : 1;
    return baseR() * target.scale * pulse;
  }
  function onTarget(p) {
    var t = targetXY(), dx = p.x - t.x, dy = p.y - t.y, hit = targetR() * 1.3 + 24;
    return dx * dx + dy * dy <= hit * hit;
  }
  function areaOf(fx, fy) { return clamp(Math.floor(fy * 3), 0, 2) * 3 + clamp(Math.floor(fx * 3), 0, 2); }
  function whereWords(fx, fy) {
    var col = fx < 0.36 ? "left" : fx > 0.64 ? "right" : "", row = fy < 0.36 ? "top" : fy > 0.64 ? "bottom" : "";
    if (!col && !row) return "in the middle";
    if (!col) return "at the " + row;
    if (!row) return "on the " + col;
    return "at the " + row + ", on the " + col;
  }
  function glowName() { return COLOUR_WORDS[settings.colour] + " " + SHAPE_WORDS[settings.shape]; }

  /* ---------- Dim extra shapes (only when the teacher asks for a busier screen) ---------- */
  var EXTRA_SHAPES = ["circle", "star", "heart", "square"];
  function placeExtras(keepTypes) {
    var n = mode ? Number(settings.extra) || 0 : 0, b = box(), R = baseR(), t = targetXY();
    var old = extras; extras = [];
    for (var i = 0; i < n; i++) {
      var best = null, bestD = -1;
      for (var k = 0; k < 30; k++) {
        var x = rand(b.x0, b.x1), y = rand(b.y0, b.y1);
        var d = Math.hypot(x - t.x, y - t.y);
        extras.forEach(function (e) { d = Math.min(d, Math.hypot(x - e.fx * W, y - e.fy * H) * 1.4); });
        if (d > bestD) { bestD = d; best = { fx: x / W, fy: y / H }; }
        if (d > R * 3.2) break;
      }
      best.shape = keepTypes && old[i] ? old[i].shape : EXTRA_SHAPES[Math.floor(Math.random() * EXTRA_SHAPES.length)];
      best.k = keepTypes && old[i] ? old[i].k : rand(0.7, 1);
      extras.push(best);
    }
  }

  /* ---------- Find the glow ---------- */
  function pickSpot() {
    var b = box(), x0 = b.x0, x1 = b.x1, y0 = b.y0, y1 = b.y1, w = settings.where, spread = 0.3;
    if (w === "middle") { x0 = lerp(b.x0, b.x1, 0.28); x1 = lerp(b.x0, b.x1, 0.72); y0 = lerp(b.y0, b.y1, 0.28); y1 = lerp(b.y0, b.y1, 0.72); spread = 0.12; }
    else if (w === "left") { x1 = lerp(b.x0, b.x1, 0.32); spread = 0.18; }
    else if (w === "right") { x0 = lerp(b.x0, b.x1, 0.68); spread = 0.18; }
    else if (w === "top") { y1 = lerp(b.y0, b.y1, 0.32); spread = 0.18; }
    else if (w === "bottom") { y0 = lerp(b.y0, b.y1, 0.68); spread = 0.18; }
    var px = find.prevFx * W, py = find.prevFy * H, best = null, bestD = -1, need = Math.min(W, H) * spread;
    for (var k = 0; k < 30; k++) {
      var x, y;
      if (w === "out") { // starts near the middle, moves further out as more glows are found
        var reach = 0.12 + 0.88 * Math.min(1, find.found / 10), a = rand(0, TAU), d = reach * rand(0.55, 1);
        x = (b.x0 + b.x1) / 2 + (b.x1 - b.x0) / 2 * d * Math.cos(a);
        y = (b.y0 + b.y1) / 2 + (b.y1 - b.y0) / 2 * d * Math.sin(a);
      } else { x = rand(x0, x1); y = rand(y0, y1); }
      var dist = Math.hypot(x - px, y - py);
      if (dist > bestD) { bestD = dist; best = { x: x, y: y }; }
      if (dist >= need) break;
    }
    target.fx = best.x / W; target.fy = best.y / H;
  }
  function newGlow() {
    pickSpot();
    target.alpha = 0; target.scale = 1; target.boost = 0;
    find.state = "show"; find.t = 0; find.helped = false; find.dwellT = 0;
    find.shownThisRun++;
    stats.find.shown++;
    placeExtras(false);
    if (find.shownThisRun === 1) speak("Find the " + glowName() + "!");
  }
  function foundIt() {
    if (find.state !== "show") return;
    var t = targetXY();
    find.state = "found"; find.t = 0;
    find.prevFx = target.fx; find.prevFy = target.fy;
    find.found++; count++;
    stats.find.found++;
    stats.find.times.push(find.tShown);
    stats.find.areas[areaOf(target.fx, target.fy)].push(find.tShown);
    burst(t.x, t.y, 1);
    foundSound(t.x);
    speak(praise());
    announce("Found it! " + count + (count === 1 ? " glow" : " glows") + " found.");
    renderHud();
  }
  var PRAISE = ["You found it!", "There it is!", "Great looking!", "You spotted it!", "Well done!", "Yes, that's it!"], lastPraise = -1;
  function praise() {
    var i; do { i = Math.floor(Math.random() * PRAISE.length); } while (i === lastPraise && PRAISE.length > 1);
    lastPraise = i; return PRAISE[i];
  }
  function giveHelp() {
    var t = targetXY();
    find.helped = true; find.helpNext = find.t + 5;
    helpSound(t.x);
    if (settings.sayWhere) speak("Look " + whereWords(target.fx, target.fy) + ".");
    announce("The glow is " + whereWords(target.fx, target.fy) + ".");
  }
  function updateFind(dt) {
    find.t += dt;
    if (find.state === "dark") {
      target.alpha = 0;
      if (find.t >= settings.pause) newGlow();
      return;
    }
    if (find.state === "show") {
      find.tShown = find.t;
      target.alpha = Math.min(1, find.t / Math.max(0.1, settings.fade));
      target.scale = lerp(target.scale, find.helped ? 1.35 : 1, Math.min(1, dt * 1.5));
      if (settings.help > 0) {
        if (!find.helped && find.t >= settings.help) giveHelp();
        else if (find.helped && find.t >= find.helpNext) { find.helpNext = find.t + 5; helpSound(targetXY().x); }
      }
      // Eye gaze / head mouse: rest the pointer on the glow.
      var looking = false;
      for (var id in pointers) {
        var p = pointers[id];
        if (p.type === "touch") { if (p.down && onTarget(p)) { foundIt(); return; } continue; }
        if (onTarget(p)) looking = true;
      }
      if (settings.dwell > 0 && looking) {
        find.dwellT += dt;
        if (find.dwellT >= settings.dwell) { foundIt(); return; }
      } else find.dwellT = 0;
      if (settings.moveOn > 0 && find.t >= settings.moveOn) {
        stats.find.movedOn++;
        stats.find.missedAreas[areaOf(target.fx, target.fy)]++;
        find.prevFx = target.fx; find.prevFy = target.fy;
        find.state = "leave"; find.t = 0;
      }
      return;
    }
    if (find.state === "found") {
      target.scale = lerp(1, 1.6, Math.min(1, find.t / 1.1));
      target.alpha = Math.max(0, 1 - find.t / 1.2);
      if (find.t >= 1.3) { find.state = "dark"; find.t = 0; }
      return;
    }
    if (find.state === "leave") {
      target.alpha = Math.max(0, 1 - find.t / 0.7);
      if (find.t >= 0.8) { find.state = "dark"; find.t = 0; }
    }
  }

  /* ---------- Follow the glow ---------- */
  function backAndForth() { return settings.path === "side" || settings.path === "updown" || settings.path === "diagonal"; }
  function pathPoint(ph) {
    var b = box(), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, ax = (b.x1 - b.x0) / 2, ay = (b.y1 - b.y0) / 2;
    var s = Math.sin(ph);
    switch (settings.path) {
      case "updown": return { x: cx, y: cy + ay * s };
      case "diagonal": return { x: cx + ax * s, y: cy + ay * s };
      case "circle": var r = Math.min(ax, ay); return { x: cx + r * s, y: cy - r * Math.cos(ph) };
      case "eight": return { x: cx + ax * s, y: cy + ay * 0.9 * Math.sin(ph * 2) };
      case "wander": return {
        x: cx + ax * (0.6 * Math.sin(ph * 0.73 + 1) + 0.4 * Math.sin(ph * 1.31)),
        y: cy + ay * (0.6 * Math.sin(ph * 0.89) + 0.4 * Math.sin(ph * 1.57 + 2))
      };
      default: return { x: cx + ax * s, y: cy };
    }
  }
  function startFollow() {
    follow.phase = 0; follow.rest = settings.stops ? 1.5 : 0; follow.moveClock = 0; follow.lastDir = 0;
    follow.onStreak = 0; follow.wasOn = false; follow.toneNext = 0; follow.toneI = 0; follow.lastPraise = -99;
    var b = box();
    follow.bx = (b.x0 + b.x1) / 2; follow.by = (b.y0 + b.y1) / 2;
    var a = rand(0.5, 1.1); follow.vx = Math.cos(a); follow.vy = Math.sin(a);
    var p = pathPoint(0); target.fx = p.x / W; target.fy = p.y / H;
    target.alpha = 0; target.scale = 1; target.boost = 0;
    placeExtras(false);
  }
  function updateFollow(dt) {
    stats.follow.play += dt;
    target.alpha = Math.min(1, target.alpha + dt / 0.8);
    target.scale = lerp(target.scale, 1, Math.min(1, dt * 2));
    var period = PERIODS[clamp(settings.speed, 1, 5)];
    if (follow.rest > 0) follow.rest -= dt;
    else if (settings.path === "bounce") {
      var b = box(), sp = (b.x1 - b.x0 + b.y1 - b.y0) * 1.1 / period;
      follow.bx += follow.vx * sp * dt; follow.by += follow.vy * sp * dt;
      if (follow.bx < b.x0) { follow.bx = b.x0; follow.vx = Math.abs(follow.vx); }
      if (follow.bx > b.x1) { follow.bx = b.x1; follow.vx = -Math.abs(follow.vx); }
      if (follow.by < b.y0) { follow.by = b.y0; follow.vy = Math.abs(follow.vy); }
      if (follow.by > b.y1) { follow.by = b.y1; follow.vy = -Math.abs(follow.vy); }
      follow.moveClock += dt;
      if (settings.stops && follow.moveClock > 6) { follow.moveClock = 0; follow.rest = 2; }
      target.fx = follow.bx / W; target.fy = follow.by / H;
    } else {
      var before = Math.cos(follow.phase);
      follow.phase += dt * TAU / period;
      follow.moveClock += dt;
      if (settings.stops) {
        if (backAndForth()) {
          var after = Math.cos(follow.phase);
          if ((before > 0) !== (after > 0)) follow.rest = 2; // reached an end of the path
        } else if (follow.moveClock > 6) { follow.moveClock = 0; follow.rest = 2; }
      }
      var p = pathPoint(follow.phase);
      target.fx = p.x / W; target.fy = p.y / H;
    }
    // Is a finger, mouse, head mouse or eye gaze on the glow?
    var on = false;
    for (var id in pointers) {
      var q = pointers[id];
      if ((q.type !== "touch" || q.down) && onTarget(q)) { on = true; break; }
    }
    target.boost = lerp(target.boost, on ? 1 : 0, Math.min(1, dt * 4));
    var t = targetXY();
    if (on) {
      stats.follow.on += dt;
      follow.onStreak += dt;
      if (!follow.wasOn) { follow.toneNext = 0; follow.toneI = 0; }
      follow.toneNext -= dt;
      if (follow.toneNext <= 0) { followSound(follow.toneI++, t.x); follow.toneNext = 0.75; }
      if (follow.onStreak >= 4) {
        follow.onStreak = 0; count++; renderHud();
        burst(t.x, t.y, 0.7);
        if (clock - follow.lastPraise > 12) { follow.lastPraise = clock; speak("Great following!"); }
      }
    } else {
      follow.onStreak = Math.max(0, follow.onStreak - dt * 2);
    }
    follow.wasOn = on;
  }
  function catchIt() {
    var t = targetXY();
    count++; stats.follow.catches++; renderHud();
    target.scale = 1.3;
    burst(t.x, t.y, 1);
    sparkleSound(t.x);
    if (clock - follow.lastPraise > 8) { follow.lastPraise = clock; speak(praise()); }
  }

  /* ---------- Sparkles and tap rings ---------- */
  function burst(x, y, k) {
    var R = baseR(), n = reduceMotion ? 8 : 16;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * TAU + rand(-0.2, 0.2), sp = R * rand(1.2, 2.6) * (reduceMotion ? 0.5 : 1) * k;
      particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: rand(1.2, 1.7), r: R * rand(0.08, 0.15) });
    }
    ripples.push({ x: x, y: y, t: 0, max: 1.3, r0: R, r1: R * 3.2, a: 0.5 });
  }
  function tapRing(x, y) { ripples.push({ x: x, y: y, t: 0, max: 0.7, r0: 10, r1: 46, a: 0.28, white: true }); }

  /* ---------- Drawing ---------- */
  function shapePath(shape, x, y, R) {
    g.beginPath();
    if (shape === "star") {
      for (var i = 0; i < 10; i++) {
        var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * 0.5 : R * 1.12;
        if (i) g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); else g.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
      }
      g.closePath();
    } else if (shape === "heart") {
      g.moveTo(x, y + R * 0.95);
      g.bezierCurveTo(x - R * 1.55, y - R * 0.1, x - R * 0.8, y - R * 1.3, x, y - R * 0.45);
      g.bezierCurveTo(x + R * 0.8, y - R * 1.3, x + R * 1.55, y - R * 0.1, x, y + R * 0.95);
      g.closePath();
    } else if (shape === "square") {
      var s = R * 0.88, c = R * 0.22;
      g.moveTo(x - s + c, y - s); g.lineTo(x + s - c, y - s); g.quadraticCurveTo(x + s, y - s, x + s, y - s + c);
      g.lineTo(x + s, y + s - c); g.quadraticCurveTo(x + s, y + s, x + s - c, y + s);
      g.lineTo(x - s + c, y + s); g.quadraticCurveTo(x - s, y + s, x - s, y + s - c);
      g.lineTo(x - s, y - s + c); g.quadraticCurveTo(x - s, y - s, x - s + c, y - s);
      g.closePath();
    } else {
      g.arc(x, y, R, 0, TAU);
    }
  }
  function drawGlow(x, y, R, alpha, c, boost) {
    if (alpha <= 0.001) return;
    var hr = R * (2.4 + boost * 0.8);
    var halo = g.createRadialGradient(x, y, R * 0.3, x, y, hr);
    halo.addColorStop(0, rgba(c, (0.55 + boost * 0.3) * alpha));
    halo.addColorStop(0.45, rgba(c, (0.2 + boost * 0.15) * alpha));
    halo.addColorStop(1, rgba(c, 0));
    g.fillStyle = halo;
    g.beginPath(); g.arc(x, y, hr, 0, TAU); g.fill();
    shapePath(settings.shape, x, y, R);
    var body = g.createRadialGradient(x - R * 0.25, y - R * 0.3, R * 0.05, x, y, R * 1.1);
    body.addColorStop(0, rgba(mixWhite(c, 0.7), alpha));
    body.addColorStop(0.55, rgba(c, alpha));
    body.addColorStop(1, rgba(c, alpha));
    g.fillStyle = body; g.fill();
    if (settings.shape === "face") {
      g.fillStyle = "rgba(0,0,0," + (0.85 * alpha).toFixed(3) + ")";
      g.beginPath(); g.arc(x - R * 0.35, y - R * 0.22, R * 0.13, 0, TAU); g.arc(x + R * 0.35, y - R * 0.22, R * 0.13, 0, TAU); g.fill();
      g.strokeStyle = g.fillStyle; g.lineWidth = Math.max(3, R * 0.12); g.lineCap = "round";
      g.beginPath(); g.arc(x, y + R * 0.05, R * 0.5, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
    }
    if (boost > 0.02) { // shining brighter while someone is on it
      g.strokeStyle = "rgba(255,255,255," + (0.75 * boost * alpha).toFixed(3) + ")";
      g.lineWidth = Math.max(4, R * 0.09);
      g.beginPath(); g.arc(x, y, R * 1.5, 0, TAU); g.stroke();
    }
  }
  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = settings.bg === "navy" ? "#07102a" : "#000000";
    g.fillRect(0, 0, W, H);
    var R = baseR(), c = glowRgb(clock);
    // Dim extra shapes: grey, low contrast, never glowing.
    extras.forEach(function (e) {
      shapePath(e.shape, e.fx * W, e.fy * H, R * e.k);
      g.fillStyle = settings.bg === "navy" ? "#26304a" : "#33363d"; g.fill();
    });
    ripples.forEach(function (r) {
      var f = r.t / r.max, rr = lerp(r.r0, r.r1, 1 - Math.pow(1 - f, 2));
      g.strokeStyle = r.white ? "rgba(255,255,255," + (r.a * (1 - f)).toFixed(3) + ")" : rgba(c, r.a * (1 - f));
      g.lineWidth = r.white ? 4 : Math.max(4, R * 0.1);
      g.beginPath(); g.arc(r.x, r.y, rr, 0, TAU); g.stroke();
    });
    if (mode) {
      var t = targetXY(), tr = targetR();
      drawGlow(t.x, t.y, tr, target.alpha, c, target.boost);
      // Eye gaze dwell ring
      if (mode === "find" && find.state === "show" && settings.dwell > 0 && find.dwellT > 0.08) {
        var f = clamp(find.dwellT / settings.dwell, 0, 1);
        g.lineWidth = Math.max(5, R * 0.1); g.lineCap = "round";
        g.strokeStyle = "rgba(255,255,255,0.25)";
        g.beginPath(); g.arc(t.x, t.y, tr * 1.55, 0, TAU); g.stroke();
        g.strokeStyle = "#ffffff";
        g.beginPath(); g.arc(t.x, t.y, tr * 1.55, -Math.PI / 2, -Math.PI / 2 + f * TAU); g.stroke();
      }
    }
    particles.forEach(function (p) {
      var f = p.life / p.max;
      g.fillStyle = rgba(mixWhite(c, 0.35), (1 - f) * 0.9);
      g.beginPath(); g.arc(p.x, p.y, p.r * (1 - f * 0.5), 0, TAU); g.fill();
    });
  }

  /* ---------- Main loop ---------- */
  var lastT = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0;
    lastT = now;
    if (!mode || !W) return;
    if (!paused && !document.hidden) {
      clock += dt;
      if (mode === "find") updateFind(dt); else updateFollow(dt);
      particles = particles.filter(function (p) {
        p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 1.2; p.vy *= 1 - dt * 1.2;
        return p.life < p.max;
      });
      ripples = ripples.filter(function (r) { r.t += dt; return r.t < r.max; });
    }
    draw();
  }

  /* ---------- Screens ---------- */
  var MODE_INFO = {
    find: { label: "Find the glow. When you see the light, tap it or press your switch.", say: function () { return "Find the " + glowName() + "!"; } },
    follow: { label: "Follow the glow. The light is moving. Follow it with your eyes or finger. Tap it or press your switch to make it sparkle.", say: function () { return "Follow the " + glowName() + " with your eyes."; } }
  };
  function startMode(m) {
    stopScan();
    mode = m; paused = false; count = 0; particles = []; ripples = [];
    menu.hidden = true; play.hidden = false;
    root.classList.add("in-activity");
    resize();
    play.setAttribute("aria-label", MODE_INFO[m].label);
    if (m === "find") {
      find.state = "dark"; find.t = 0; find.found = 0; find.shownThisRun = 0; find.prevFx = 0.5; find.prevFy = 0.5;
      target.alpha = 0; extras = [];
    } else {
      startFollow();
      speak(MODE_INFO.follow.say());
    }
    renderHud();
    try { play.focus({ preventScroll: true }); } catch (e) { play.focus(); }
  }
  function showMenu(byHold) {
    mode = null; stopSpeech(); clearHold();
    play.hidden = true; menu.hidden = false;
    root.classList.remove("in-activity");
    pointers = {}; extras = [];
    renderHud();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (byHold) speak("Pick a game.");
    startScan();
  }
  function renderHud() {
    $("hud").textContent = mode && settings.count ? "★ " + count : "";
    $("menu-help").textContent = settings.scan
      ? "The games light up one at a time. Press any key or switch to pick the one that is lit."
      : "";
  }

  /* ---------- Touch, mouse, head mouse and eye gaze ---------- */
  var lastPointerDown = 0;
  function localPoint(e) { var r = play.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  play.addEventListener("pointerdown", function (e) {
    if (!mode) return;
    unlockAudio();
    lastPointerDown = Date.now();
    var p = localPoint(e);
    pointers[e.pointerId] = { x: p.x, y: p.y, type: e.pointerType, down: true };
    try { play.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (paused) return;
    if (mode === "find") {
      if (find.state === "show" && (settings.anyTap || onTarget(p))) foundIt();
      else tapRing(p.x, p.y);
    } else {
      if (onTarget(p)) catchIt(); else tapRing(p.x, p.y);
    }
  });
  play.addEventListener("pointermove", function (e) {
    if (!mode) return;
    var p = localPoint(e), q = pointers[e.pointerId];
    if (q) { q.x = p.x; q.y = p.y; }
    else if (e.pointerType !== "touch") pointers[e.pointerId] = { x: p.x, y: p.y, type: e.pointerType, down: false };
  });
  function endPointer(e) {
    var q = pointers[e.pointerId];
    if (!q) return;
    if (q.type === "touch" || e.type === "pointercancel") delete pointers[e.pointerId];
    else q.down = false;
  }
  play.addEventListener("pointerup", endPointer);
  play.addEventListener("pointercancel", endPointer);
  play.addEventListener("pointerleave", function (e) { if (e.pointerType !== "touch") delete pointers[e.pointerId]; });
  play.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  // VoiceOver and Switch Control "tap" the play area as a button: treat that as a switch press.
  play.addEventListener("click", function () {
    if (Date.now() - lastPointerDown < 700) return; // a real tap, already handled
    switchPress();
  });

  /* ---------- Keys and switches ---------- */
  var lastSwitch = 0;
  function switchPress() {
    if (!mode || paused) return;
    unlockAudio();
    var now = Date.now();
    if (now - lastSwitch < (settings.gap || 0) * 1000) return;
    lastSwitch = now;
    if (!settings.switchFinds) return;
    if (mode === "find") { if (find.state === "show") foundIt(); }
    else catchIt();
  }
  var IGNORE = { Tab: 1, Shift: 1, Control: 1, Alt: 1, Meta: 1, CapsLock: 1, Fn: 1 };
  var holdTimer = null, hintTimer = null;
  function clearHold() {
    clearTimeout(holdTimer); clearTimeout(hintTimer); holdTimer = hintTimer = null;
    $("hold-hint").hidden = true;
  }
  document.addEventListener("keydown", function (e) {
    if (openPanel) { if (e.key === "Escape") { e.preventDefault(); hidePanel(); } return; }
    if (IGNORE[e.key] || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") { if (pseudoFs) toggleFullscreen(); return; }
    var t = e.target, onControl = t && t !== play && t.closest && t.closest("button, a, input, select, textarea");
    if (!mode) { // games menu: with scanning on, any key or switch picks the lit game
      if (onControl && (e.key === "Enter" || e.key === " ")) return;
      if (!settings.scan || scanIndex < 0) return;
      e.preventDefault();
      if (!e.repeat) cards[scanIndex].click();
      return;
    }
    if (onControl && (e.key === "Enter" || e.key === " ")) return; // let focused buttons work normally
    e.preventDefault();
    if (e.repeat) return; // holding a switch counts once
    switchPress();
    clearHold();
    if (settings.hold > 0) { // holding the switch down goes back to the games
      hintTimer = setTimeout(function () { $("hold-hint").hidden = false; }, 1000);
      holdTimer = setTimeout(function () { showMenu(true); announce("Back to the games."); }, settings.hold * 1000);
    }
  });
  document.addEventListener("keyup", clearHold);
  window.addEventListener("blur", clearHold);
  ["touchend", "click", "keydown"].forEach(function (type) { document.addEventListener(type, unlockAudio, true); });

  /* ---------- Switch scanning on the games menu ---------- */
  var scanIndex = -1, scanTimer = null;
  function stopScan() {
    clearInterval(scanTimer); scanTimer = null; scanIndex = -1;
    cards.forEach(function (c) { c.classList.remove("is-scan"); });
  }
  function scanStep() {
    if (scanIndex >= 0) cards[scanIndex].classList.remove("is-scan");
    scanIndex = (scanIndex + 1) % cards.length;
    cards[scanIndex].classList.add("is-scan");
    speak(cards[scanIndex].querySelector("strong").textContent);
  }
  function startScan() {
    stopScan();
    if (!settings.scan || mode || openPanel) return;
    scanStep();
    scanTimer = setInterval(scanStep, (settings.scanSeconds || 2) * 1000);
  }
  cards.forEach(function (c) {
    c.addEventListener("click", function () { unlockAudio(); startMode(c.getAttribute("data-mode")); });
  });

  /* ---------- Toolbar ---------- */
  $("btn-menu").addEventListener("click", function () { showMenu(false); });
  $("btn-settings").addEventListener("click", function (e) { showPanel("panel-settings", e.currentTarget, e.detail === 0); });
  $("btn-results").addEventListener("click", function (e) { renderResults(); showPanel("panel-results", e.currentTarget, e.detail === 0); });
  // After a tap or click on a toolbar button, move focus back to the game so a switch press plays
  // instead of pressing that button again.
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".bar button, .fs-exit");
    if (b && e.detail > 0) setTimeout(function () { b.blur(); if (mode && !openPanel) { try { play.focus({ preventScroll: true }); } catch (err) { /* ignore */ } } }, 0);
  });

  /* ---------- Panels ---------- */
  var openPanel = null, returnFocus = null, openedByKey = false;
  function showPanel(id, opener, byKey) {
    openedByKey = !!byKey;
    stopScan(); stopSpeech(); clearHold();
    paused = true;
    openPanel = $(id); returnFocus = opener || document.activeElement;
    openPanel.hidden = false;
    $("app").setAttribute("aria-hidden", "true");
    setTimeout(function () { openPanel.querySelector("h2").focus(); }, 30);
  }
  function hidePanel() {
    if (!openPanel) return;
    openPanel.hidden = true; openPanel = null;
    $("app").removeAttribute("aria-hidden");
    paused = false;
    if (openedByKey && returnFocus && returnFocus.focus && !returnFocus.closest("[hidden]")) returnFocus.focus();
    else if (mode) { try { play.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    if (!mode) startScan();
  }
  document.querySelectorAll(".overlay").forEach(function (ov) {
    ov.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]") || e.target === ov) hidePanel();
    });
  });

  /* ---------- Results (memory only: gone when the page is closed or reloaded) ---------- */
  function secs(v) { return (Math.round(v * 10) / 10).toFixed(1) + " s"; }
  function avg(a) { return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : 0; }
  function renderResults() {
    var f = stats.find, fo = stats.follow, body = $("results-body"), h = "";
    var all = avg(f.times);
    h += '<section aria-labelledby="r-find"><h3 id="r-find">Find the glow</h3>';
    if (!f.shown) h += '<p class="help">Nothing yet. Play Find the glow and come back here.</p>';
    else {
      h += '<dl class="stats">' +
        stat("Glows shown", f.shown) + stat("Found", f.found) + stat("Moved on", f.movedOn) +
        stat("Average time", f.times.length ? secs(all) : "-") +
        stat("Quickest", f.times.length ? secs(Math.min.apply(null, f.times)) : "-") + "</dl>";
      h += '<table class="areas"><caption>Where on the screen (found, average time)</caption>' +
        '<tr><td class="none" style="border:0;background:none"></td><th scope="col">Left</th><th scope="col">Middle</th><th scope="col">Right</th></tr>';
      var rows = ["Top", "Middle", "Bottom"];
      for (var r = 0; r < 3; r++) {
        h += '<tr><th scope="row">' + rows[r] + "</th>";
        for (var c = 0; c < 3; c++) {
          var a = f.areas[r * 3 + c], miss = f.missedAreas[r * 3 + c];
          if (!a.length && !miss) { h += '<td class="none">-</td>'; continue; }
          var m = avg(a), slow = a.length >= 2 && f.times.length >= 4 && m > all * 1.5;
          h += '<td class="' + (slow ? "slow" : "") + '"><strong>' + a.length + "</strong>" + (a.length ? secs(m) : "") +
            (miss ? "<br>" + miss + " moved on" : "") + (slow ? "<br>slower" : "") + "</td>";
        }
        h += "</tr>";
      }
      h += "</table>";
      h += '<p class="help">Time starts when the glow first shows up. An orange box means that part of the screen took longer than usual. Use this as a guide, not a test.</p>';
    }
    h += "</section>";
    h += '<section aria-labelledby="r-follow"><h3 id="r-follow">Follow the glow</h3>';
    if (fo.play < 1) h += '<p class="help">Nothing yet. Play Follow the glow and come back here.</p>';
    else {
      h += '<dl class="stats">' + stat("Time playing", secs(fo.play)) + stat("Time on the glow", secs(fo.on)) +
        stat("Share of time on it", Math.round(100 * fo.on / fo.play) + "%") + stat("Taps and presses", fo.catches) + "</dl>";
      h += '<p class="help">"On the glow" counts a finger, mouse, head mouse or eye gaze resting on the light.</p>';
    }
    h += "</section>";
    h += '<section><p class="help">These results are not saved. They clear when the page is closed or reloaded.</p>' +
      '<button type="button" class="btn" id="btn-clear-results">Clear results</button></section>';
    body.innerHTML = h;
    $("btn-clear-results").addEventListener("click", function () { clearStats(); renderResults(); announce("Results cleared."); $("results-title").focus(); });
  }
  function stat(label, value) { return '<div class="stat"><dt>' + label + "</dt><dd>" + value + "</dd></div>"; }

  /* ---------- Settings panel ---------- */
  function applySettings() {
    root.classList.toggle("bg-navy", settings.bg === "navy");
    $("speed-out").textContent = SPEED_WORDS[settings.speed];
    $("gap-out").textContent = settings.gap ? settings.gap + " s" : "off";
    $("rate-out").textContent = settings.rate.toFixed(2).replace(/0$/, "");
    renderHud();
  }
  function bindSettings() {
    function sel(id, key, num, after) {
      var x = $(id); x.value = String(settings[key]);
      if (x.value !== String(settings[key]) && x.options.length) x.value = x.options[0].value;
      x.addEventListener("change", function () { setSetting(key, num ? Number(x.value) : x.value); applySettings(); if (after) after(); });
    }
    function chk(id, key, after) {
      var x = $(id); x.checked = !!settings[key];
      x.addEventListener("change", function () { setSetting(key, x.checked); applySettings(); if (after) after(); });
    }
    function rng(id, key) {
      var x = $(id); x.value = String(settings[key]);
      x.addEventListener("input", function () { setSetting(key, Number(x.value)); applySettings(); });
    }
    var refresh = function () { if (mode) placeExtras(false); };
    var restartFollow = function () { if (mode === "follow") startFollow(); };
    sel("set-colour", "colour"); sel("set-shape", "shape"); sel("set-size", "size", true, refresh);
    chk("set-pulse", "pulse"); sel("set-bg", "bg"); sel("set-extra", "extra", true, refresh);
    sel("set-where", "where"); sel("set-pause", "pause", true); sel("set-fade", "fade", true);
    sel("set-help", "help", true); chk("set-saywhere", "sayWhere"); sel("set-moveon", "moveOn", true); chk("set-anytap", "anyTap");
    sel("set-path", "path", false, restartFollow); rng("set-speed", "speed"); chk("set-stops", "stops");
    chk("set-switchfinds", "switchFinds"); sel("set-dwell", "dwell", true); rng("set-gap", "gap");
    sel("set-hold", "hold", true); chk("set-scan", "scan"); sel("set-scan-speed", "scanSeconds", true);
    chk("set-voice", "voice"); rng("set-rate", "rate"); chk("set-sounds", "sounds"); rng("set-volume", "volume");
    chk("set-count", "count");
  }

  /* ---------- Full screen ---------- */
  function isStandalone() {
    return window.navigator.standalone === true ||
      (window.matchMedia && (matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches));
  }
  function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function fsSupported() {
    return !!((root.requestFullscreen || root.webkitRequestFullscreen) && (document.fullscreenEnabled || document.webkitFullscreenEnabled));
  }
  var pseudoFs = false;
  function fallbackFullscreen() {
    pseudoFs = true; updateFs();
    if (!settings.fsTipSeen && !isStandalone()) { setSetting("fsTipSeen", true); showPanel("panel-fullscreen", $("btn-exit-fs")); }
  }
  function updateFs() {
    var on = !!fsElement() || pseudoFs, was = root.classList.contains("is-fullscreen");
    root.classList.toggle("is-fullscreen", on);
    $("btn-exit-fs").hidden = !on;
    $("fullscreen-label").textContent = on ? "Exit full screen" : "Full screen";
    if (on && !was) announce("Full screen. To leave, use the Exit full screen button in the top corner.");
    else if (!on && was && !mode) $("btn-fullscreen").focus();
    setTimeout(resize, 50);
  }
  function toggleFullscreen() {
    if (pseudoFs) { pseudoFs = false; updateFs(); return; }
    if (fsElement()) { var ex = document.exitFullscreen || document.webkitExitFullscreen; if (ex) { var p = ex.call(document); if (p && p.catch) p.catch(function () {}); } return; }
    if (!fsSupported() || isStandalone()) { fallbackFullscreen(); return; }
    try { var r = root.requestFullscreen ? root.requestFullscreen() : root.webkitRequestFullscreen(); if (r && r.catch) r.catch(fallbackFullscreen); }
    catch (err) { fallbackFullscreen(); }
  }
  document.addEventListener("fullscreenchange", updateFs);
  document.addEventListener("webkitfullscreenchange", updateFs);
  $("btn-fullscreen").addEventListener("click", toggleFullscreen);
  $("btn-exit-fs").addEventListener("click", toggleFullscreen);

  /* ---------- Start ---------- */
  applySettings();
  bindSettings();
  var startWith = params.get("mode");
  if (startWith === "find" || startWith === "follow") startMode(startWith);
  else showMenu(false);
  if (isStandalone()) { pseudoFs = true; updateFs(); }
  requestAnimationFrame(frame);
  window.SpotTheGlow = {
    state: function () { return { mode: mode, find: find, follow: follow, target: target, count: count, stats: stats, W: W, H: H }; },
    targetXY: targetXY, targetR: targetR
  };
})();
