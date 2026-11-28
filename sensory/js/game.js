/*
 * Sensory Room: calm cause-and-effect activities.
 * Every activity answers the same inputs:
 *   - touch, mouse or pen: tap and move
 *   - any key or switch (Space, Enter...): a "switch press"
 *   - eye gaze / head mouse: rest the pointer for the dwell time (Settings)
 * Nothing flashes: colour changes fade over seconds, and there is no right or wrong.
 */
(function () {
  "use strict";
  var cfg = window.SENSORY_CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var STORE_KEY = "sensory-room-settings-v1";
  var TAU = Math.PI * 2;

  /* ---------- Settings ---------- */
  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var settings = Object.assign({}, cfg.defaults);
  if (reduceMotion) settings.calm = true;
  try {
    var saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (saved) Object.assign(settings, saved);
  } catch (e) { /* ignore */ }
  function saveSettings() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
  }
  // Link options win for this visit only (they are not saved).
  var params = new URLSearchParams(location.search);
  if (params.has("calm")) settings.calm = params.get("calm") === "1";
  if (params.has("dwell")) settings.dwell = Math.max(0, parseFloat(params.get("dwell")) || 0);
  if (params.has("sound")) settings.sound = params.get("sound") !== "0";
  if (params.has("scan")) settings.scan = params.get("scan") !== "0";
  if (params.has("size")) settings.size = Math.max(1, Math.min(2, parseFloat(params.get("size")) || 1));

  var live = $("live");
  var announceTimer = null;
  function announce(text) {
    live.textContent = "";
    clearTimeout(announceTimer);
    announceTimer = setTimeout(function () { live.textContent = text; }, 60);
  }
  var lastSpoken = 0;
  function announceSometimes(text) { // for frequent events, at most every 4 seconds
    var now = Date.now();
    if (now - lastSpoken < 4000) return;
    lastSpoken = now;
    announce(text);
  }

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function calm() { return !!settings.calm; }
  function sizeK() { return settings.size || 1; }

  /* ---------- Sound: soft synthesized chimes (Web Audio) ---------- */
  var actx = null, master = null, echo = null;
  function setupAudio() {
    if (actx) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      actx = new AC();
      master = actx.createGain();
      var comp = actx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(actx.destination);
      // A gentle echo makes the chimes sound like a big soft room.
      echo = actx.createGain();
      echo.gain.value = 0.28;
      var delay = actx.createDelay(1.5);
      delay.delayTime.value = 0.33;
      var fb = actx.createGain();
      fb.gain.value = 0.38;
      var tone = actx.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = 2200;
      echo.connect(delay);
      delay.connect(tone);
      tone.connect(fb);
      fb.connect(delay);
      tone.connect(master);
      applyVolume();
    } catch (e) { actx = null; }
  }
  function applyVolume() {
    if (!master) return;
    var v = settings.sound ? (clamp(settings.volume, 0, 100) / 100) * (calm() ? 0.55 : 0.85) : 0;
    master.gain.setTargetAtTime(v, actx.currentTime, 0.05);
  }
  // iPads only allow sound that starts during a real tap or key press.
  var unlocked = false;
  function unlockAudio() {
    setupAudio();
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* ignore */ }
    try { if (actx && actx.state !== "running" && actx.resume) actx.resume(); } catch (e) { /* ignore */ }
    if (unlocked || !actx) return;
    unlocked = true;
    try {
      var b = actx.createBuffer(1, 1, 22050), s = actx.createBufferSource();
      s.buffer = b; s.connect(actx.destination); s.start(0);
    } catch (e) { /* ignore */ }
  }
  ["touchend", "pointerup", "click", "keydown"].forEach(function (type) {
    document.addEventListener(type, unlockAudio, true);
  });
  function audioReady() { return actx && settings.sound && actx.state === "running"; }

  // Notes from a pentatonic scale, so any mix of notes sounds pleasant.
  var STEPS = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3];
  function noteFreq(i) {
    i = Math.round(i);
    var oct = Math.floor(i / 5), step = ((i % 5) + 5) % 5;
    return 196 * STEPS[step] * Math.pow(2, oct); // starts at G3
  }
  var lastNoteAt = 0;
  // A bell-like note. opts: gain, attack, decay, type, delay, bend (start pitch factor)
  function chime(freq, opts) {
    if (!audioReady()) return;
    opts = opts || {};
    var now = actx.currentTime;
    if (!opts.delay) {
      if (now - lastNoteAt < 0.06) return; // never a burst of clicks
      lastNoteAt = now;
    }
    var t = now + (opts.delay || 0);
    var attack = opts.attack || 0.012;
    var decay = (opts.decay || 1.6) * (calm() ? 1.25 : 1);
    var peak = (opts.gain || 0.22);
    var partials = opts.type === "pad" ? [[1, 1], [2, 0.12]] : [[1, 1], [2.01, 0.22], [3.02, 0.06]];
    partials.forEach(function (p) {
      var osc = actx.createOscillator(), g = actx.createGain();
      osc.type = opts.type === "pad" ? "triangle" : "sine";
      var f = freq * p[0];
      if (opts.bend) {
        osc.frequency.setValueAtTime(f * opts.bend, t);
        osc.frequency.exponentialRampToValueAtTime(f, t + 0.09);
      } else {
        osc.frequency.value = f;
      }
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak * p[1], t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay / p[0]);
      osc.connect(g);
      g.connect(master);
      g.connect(echo);
      osc.start(t);
      osc.stop(t + attack + decay + 0.05);
    });
  }
  function arpeggio(start, count, gap, opts) {
    for (var i = 0; i < count; i++) {
      chime(noteFreq(start + i * 2), Object.assign({}, opts, { delay: 0.001 + i * gap }));
    }
  }

  /* ---------- Canvas ---------- */
  var play = $("play"), canvas = $("canvas"), ctx = canvas.getContext("2d");
  var W = 0, H = 0, dpr = 1, maxDpr = Math.min(window.devicePixelRatio || 1, 2);
  function fitCanvas() {
    var r = play.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var newW = Math.round(r.width), newH = Math.round(r.height);
    dpr = maxDpr;
    canvas.width = Math.round(newW * dpr);
    canvas.height = Math.round(newH * dpr);
    var changed = newW !== W || newH !== H;
    W = newW; H = newH;
    if (changed && current && current.resize) current.resize();
  }
  function unit() { return Math.min(W, H) / 700 * sizeK(); } // scale for "how big"

  // Soft glowing dots, drawn once per colour and reused (fast on iPads).
  var glowCache = {};
  function glow(hue, sat, light) {
    var key = Math.round(hue / 6) * 6 + "|" + sat + "|" + light;
    if (glowCache[key]) return glowCache[key];
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var g = c.getContext("2d");
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    var h = Math.round(hue / 6) * 6;
    grad.addColorStop(0, "hsla(" + h + "," + sat + "%," + Math.min(95, light + 30) + "%,1)");
    grad.addColorStop(0.25, "hsla(" + h + "," + sat + "%," + light + "%,0.75)");
    grad.addColorStop(1, "hsla(" + h + "," + sat + "%," + light + "%,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    glowCache[key] = c;
    return c;
  }
  function sat() { return calm() ? 55 : 90; }
  function light() { return calm() ? 50 : 58; }

  // Pictures from config (optional).
  function loadPictures(list) {
    return (list || []).map(function (src) {
      var img = new Image();
      img.src = src;
      return img;
    });
  }
  function ready(img) { return img && img.complete && img.naturalWidth > 0; }
  // The teacher's own pictures (My pictures) win over the ones in config.js.
  function picturesFor(activity) {
    var fromConfig = loadPictures(activity.pictures);
    return function () {
      var mine = settings.useMine !== false && window.SensoryPictures ? window.SensoryPictures.images() : [];
      return mine.length ? mine : fromConfig;
    };
  }

  /* ---------- Realistic bubbles (shared by Bubble Float and Fish Tank) ----------
     Two layers, each drawn once and reused:
       film: a clear centre, a bright rim and a rainbow soap-film shimmer (this layer slowly turns)
       light: highlights that always stay on the top-left, where the light comes from */
  var bubbleFilm = {}, bubbleLight = null, BS = 192;
  function filmLayer(tint) {
    var key = Math.round(tint / 30) * 30;
    if (bubbleFilm[key]) return bubbleFilm[key];
    var c = document.createElement("canvas");
    c.width = c.height = BS;
    var g = c.getContext("2d"), m = BS / 2, R = m - 2;
    // rainbow shimmer around the edge: many thin wedges of colour
    for (var i = 0; i < 72; i++) {
      var a0 = i / 72 * TAU, a1 = (i + 1.3) / 72 * TAU;
      var h = (key + Math.sin(a0 * 2) * 70 + Math.sin(a0 * 3 + 1) * 50 + 360) % 360;
      g.fillStyle = "hsl(" + Math.round(h) + ",95%,65%)";
      g.beginPath(); g.moveTo(m, m); g.arc(m, m, R, a0, a1); g.closePath(); g.fill();
    }
    // keep the colour only near the rim: clear in the middle, strongest just inside the edge
    g.globalCompositeOperation = "destination-in";
    var mask = g.createRadialGradient(m, m, 0, m, m, R);
    mask.addColorStop(0, "rgba(0,0,0,0.03)");
    mask.addColorStop(0.55, "rgba(0,0,0,0.07)");
    mask.addColorStop(0.82, "rgba(0,0,0,0.32)");
    mask.addColorStop(0.95, "rgba(0,0,0,0.6)");
    mask.addColorStop(1, "rgba(0,0,0,0.15)");
    g.fillStyle = mask;
    g.fillRect(0, 0, BS, BS);
    g.globalCompositeOperation = "source-over";
    // bright, thin outer edge
    g.lineWidth = 2;
    g.strokeStyle = "rgba(255,255,255,0.55)";
    g.beginPath(); g.arc(m, m, R - 1, 0, TAU); g.stroke();
    g.lineWidth = 3;
    g.strokeStyle = "rgba(255,255,255,0.12)";
    g.beginPath(); g.arc(m, m, R - 5, 0, TAU); g.stroke();
    bubbleFilm[key] = c;
    return c;
  }
  function lightLayer() {
    if (bubbleLight) return bubbleLight;
    var c = document.createElement("canvas");
    c.width = c.height = BS;
    var g = c.getContext("2d"), m = BS / 2, R = m - 2;
    // a soft curved window reflection on the top-left
    g.save();
    g.translate(m - R * 0.38, m - R * 0.42);
    g.rotate(-0.75);
    var w = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.42);
    w.addColorStop(0, "rgba(255,255,255,0.9)");
    w.addColorStop(0.45, "rgba(255,255,255,0.45)");
    w.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = w;
    g.beginPath(); g.ellipse(0, 0, R * 0.42, R * 0.22, 0, 0, TAU); g.fill();
    g.restore();
    // a tiny bright sparkle
    var d = g.createRadialGradient(m - R * 0.55, m - R * 0.2, 0, m - R * 0.55, m - R * 0.2, R * 0.08);
    d.addColorStop(0, "rgba(255,255,255,0.95)");
    d.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = d;
    g.beginPath(); g.arc(m - R * 0.55, m - R * 0.2, R * 0.08, 0, TAU); g.fill();
    // a faint second reflection on the opposite side (light passing through)
    g.save();
    g.translate(m + R * 0.45, m + R * 0.5);
    g.rotate(-0.75);
    var o = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.3);
    o.addColorStop(0, "rgba(255,255,255,0.35)");
    o.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = o;
    g.beginPath(); g.ellipse(0, 0, R * 0.3, R * 0.1, 0, 0, TAU); g.fill();
    g.restore();
    bubbleLight = c;
    return c;
  }
  // phase makes the shimmer swirl and the bubble wobble a little as it floats.
  function drawBubble(g, x, y, r, tint, phase) {
    var sx = 1 + Math.sin(phase * 1.7) * 0.035, sy = 1 - Math.sin(phase * 1.7) * 0.035;
    g.save();
    g.translate(x, y);
    g.scale(sx, sy);
    g.save();
    g.rotate(phase * 0.35);
    g.drawImage(filmLayer(tint), -r, -r, r * 2, r * 2);
    g.restore();
    g.drawImage(lightLayer(), -r, -r, r * 2, r * 2);
    g.restore();
  }

  /* =====================================================================
     Activity 1: Light Painting
     ===================================================================== */
  function LightPainting() {
    var dots = [], rings = [], ribbons = [], motes = [];
    var hue = rand(0, 360), travelled = 0, lastPos = {};
    function life() { return calm() ? 2.8 : 1.8; }
    function addDot(x, y, size) {
      dots.push({ x: x, y: y, s: size, h: hue, age: 0 });
      if (dots.length > (calm() ? 500 : 900)) dots.splice(0, dots.length - (calm() ? 500 : 900));
    }
    function paintTo(id, x, y) {
      var s = 26 * unit();
      var last = lastPos[id];
      if (!last) { addDot(x, y, s); lastPos[id] = { x: x, y: y }; return; }
      var dx = x - last.x, dy = y - last.y, d = Math.sqrt(dx * dx + dy * dy);
      var step = Math.max(2, s * 0.18), n = Math.min(40, Math.floor(d / step));
      for (var i = 1; i <= n; i++) addDot(last.x + dx * i / n, last.y + dy * i / n, s);
      if (n > 0) lastPos[id] = { x: x, y: y };
      hue = (hue + d * 0.12) % 360;
      travelled += d;
      if (travelled > 160 * unit() + 60) { // a soft note now and then, higher near the top
        travelled = 0;
        chime(noteFreq(12 - (y / H) * 10), { gain: 0.1, decay: 1.4 });
      }
    }
    function ripple(x, y, big) {
      var r = (big ? 260 : 170) * unit();
      rings.push({ x: x, y: y, r: r, h: hue, age: 0, life: calm() ? 3 : 2.2 });
      rings.push({ x: x, y: y, r: r * 0.6, h: (hue + 40) % 360, age: -0.25, life: calm() ? 3 : 2.2 });
      for (var i = 0; i < 10; i++) {
        var a = i / 10 * TAU;
        addDot(x + Math.cos(a) * 12 * unit(), y + Math.sin(a) * 12 * unit(), 34 * unit());
      }
    }
    return {
      start: function () {
        motes = [];
        for (var i = 0; i < 26; i++) motes.push({ x: Math.random(), y: Math.random(), p: rand(0, TAU), s: rand(0.5, 1.4) });
      },
      down: function (id, x, y) {
        lastPos[id] = null;
        paintTo(id, x, y);
        ripple(x, y, false);
        chime(noteFreq(12 - (y / H) * 10), { gain: 0.2 });
      },
      move: function (id, x, y) { paintTo(id, x, y); },
      up: function (id) { lastPos[id] = null; },
      dwell: function (x, y) { ripple(x, y, true); chime(noteFreq(12 - (y / H) * 10), { gain: 0.2 }); },
      press: function () {
        // A ribbon of light swirls across the screen by itself.
        ribbons.push({
          t: 0, life: calm() ? 4 : 3,
          cx: rand(0.3, 0.7) * W, cy: rand(0.3, 0.7) * H,
          ax: rand(0.25, 0.4) * W, ay: rand(0.2, 0.35) * H,
          fx: rand(0.7, 1.2), fy: rand(1.2, 1.8), ph: rand(0, TAU), id: "r" + Math.random()
        });
        arpeggio(Math.floor(rand(4, 8)), 3, 0.16, { gain: 0.16 });
        announceSometimes("A ribbon of light.");
      },
      update: function (dt) {
        var L = life();
        for (var i = dots.length - 1; i >= 0; i--) { dots[i].age += dt; if (dots[i].age > L) dots.splice(i, 1); }
        for (i = rings.length - 1; i >= 0; i--) { rings[i].age += dt; if (rings[i].age > rings[i].life) rings.splice(i, 1); }
        for (i = ribbons.length - 1; i >= 0; i--) {
          var r = ribbons[i];
          r.t += dt;
          var k = r.t * 1.6;
          paintTo(r.id, r.cx + Math.sin(k * r.fx + r.ph) * r.ax, r.cy + Math.sin(k * r.fy) * r.ay);
          if (r.t > r.life) { delete lastPos[r.id]; ribbons.splice(i, 1); }
        }
        motes.forEach(function (m) { m.p += dt * 0.3; m.y -= dt * 0.006 * m.s; if (m.y < -0.05) m.y = 1.05; });
      },
      draw: function (g, time) {
        var bg = g.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, "#070b1f");
        bg.addColorStop(1, "#0d0820");
        g.fillStyle = bg;
        g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = "lighter";
        // Faint floating specks so the screen is never completely still.
        motes.forEach(function (m) {
          var s = 6 * unit() * m.s;
          g.globalAlpha = 0.25 + 0.15 * Math.sin(m.p);
          g.drawImage(glow(220, 40, 60), m.x * W + Math.sin(m.p) * 10 - s, m.y * H - s, s * 2, s * 2);
        });
        var L = life(), S = sat(), Li = light();
        for (var i = 0; i < dots.length; i++) {
          var d = dots[i], f = 1 - d.age / L;
          var s = d.s * (0.6 + 0.6 * (1 - f));
          g.globalAlpha = f * f;
          g.drawImage(glow(d.h, S, Li), d.x - s, d.y - s, s * 2, s * 2);
        }
        g.globalAlpha = 1;
        rings.forEach(function (r) {
          if (r.age < 0) return;
          var f = r.age / r.life;
          g.strokeStyle = "hsla(" + Math.round(r.h) + "," + S + "%," + (Li + 10) + "%," + (0.55 * (1 - f)) + ")";
          g.lineWidth = Math.max(2, 5 * unit() * (1 - f));
          g.beginPath();
          g.arc(r.x, r.y, r.r * easeOut(f), 0, TAU);
          g.stroke();
        });
        g.globalCompositeOperation = "source-over";
      }
    };
  }

  /* =====================================================================
     Activity 2: Bubble Float
     ===================================================================== */
  function BubbleFloat(activity) {
    var bubbles = [], pops = [], idle = 0, pictures = picturesFor(activity);
    var sprites = {};
    function sprite(hue) {
      var key = Math.round(hue / 20) * 20;
      if (sprites[key]) return sprites[key];
      var c = document.createElement("canvas");
      c.width = c.height = 160;
      var g = c.getContext("2d");
      var inner = g.createRadialGradient(80, 80, 40, 80, 80, 76);
      inner.addColorStop(0, "hsla(" + key + ",80%,70%,0.04)");
      inner.addColorStop(0.8, "hsla(" + key + ",85%,70%,0.18)");
      inner.addColorStop(1, "hsla(" + key + ",90%,80%,0.55)");
      g.fillStyle = inner;
      g.beginPath(); g.arc(80, 80, 76, 0, TAU); g.fill();
      g.lineWidth = 3;
      g.strokeStyle = "hsla(" + ((key + 60) % 360) + ",90%,85%,0.7)";
      g.beginPath(); g.arc(80, 80, 75, 0, TAU); g.stroke();
      // shine
      var shine = g.createRadialGradient(52, 50, 0, 52, 50, 26);
      shine.addColorStop(0, "rgba(255,255,255,0.85)");
      shine.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = shine;
      g.beginPath(); g.ellipse(52, 50, 24, 15, -0.6, 0, TAU); g.fill();
      sprites[key] = c;
      return c;
    }
    function blow(x, y, n) {
      var max = calm() ? 14 : 26;
      for (var i = 0; i < n; i++) {
        if (bubbles.length >= max) bubbles.shift();
        var r = rand(28, 62) * unit();
        bubbles.push({
          x: x + rand(-20, 20) * unit(), y: y + rand(-10, 10) * unit(), r: r, grow: 0,
          vy: rand(32, 60) * (calm() ? 0.6 : 1) * (80 / (r / unit() + 20)) + 10,
          wob: rand(0.6, 1.3), ph: rand(0, TAU), hue: rand(0, 360), look: 0,
          pic: pictures().length ? pick(pictures()) : null
        });
      }
    }
    function hit(x, y) {
      for (var i = bubbles.length - 1; i >= 0; i--) {
        var b = bubbles[i], dx = x - b.x, dy = y - b.y;
        if (dx * dx + dy * dy < b.r * b.r * 1.15) return i;
      }
      return -1;
    }
    function pop(i) {
      var b = bubbles[i];
      bubbles.splice(i, 1);
      var drops = [];
      for (var k = 0; k < 8; k++) drops.push({ a: k / 8 * TAU + rand(-0.2, 0.2), v: rand(60, 120) * unit() });
      pops.push({ x: b.x, y: b.y, r: b.r, hue: b.hue, age: 0, drops: drops });
      // Big bubbles sound low, small bubbles sound high.
      var note = 13 - (b.r / unit() - 28) / 34 * 9;
      chime(noteFreq(note), { gain: 0.24, bend: 0.6, decay: 1.2 });
      announceSometimes("Pop!");
    }
    return {
      start: function () { blow(W / 2, H * 0.8, 3); },
      down: function (id, x, y) {
        var i = hit(x, y);
        if (i >= 0) pop(i);
        else { blow(x, y, 2); chime(noteFreq(rand(3, 8)), { gain: 0.08, attack: 0.05, decay: 0.8 }); }
      },
      move: function () {},
      up: function () {},
      look: function (x, y, dt) { // resting the pointer on a bubble pops it
        var i = hit(x, y);
        if (i < 0) return false;
        bubbles[i].look += dt;
        if (bubbles[i].look > 0.3) pop(i);
        return true;
      },
      dwell: function (x, y) { if (hit(x, y) < 0) blow(x, y, 2); },
      press: function () {
        var x = rand(0.2, 0.8) * W;
        blow(x, H + 40 * unit(), 3);
        chime(noteFreq(rand(3, 8)), { gain: 0.1, attack: 0.05, decay: 0.8 });
      },
      update: function (dt) {
        idle += dt;
        if (!bubbles.length && idle > 3) { idle = 0; blow(rand(0.2, 0.8) * W, H + 50 * unit(), 1); }
        if (bubbles.length) idle = 0;
        for (var i = bubbles.length - 1; i >= 0; i--) {
          var b = bubbles[i];
          b.grow = Math.min(1, b.grow + dt * 2.5);
          b.ph += dt * b.wob;
          b.y -= b.vy * dt;
          b.x += Math.sin(b.ph) * 18 * unit() * dt;
          if (b.y < -b.r * 1.5) bubbles.splice(i, 1);
        }
        for (i = pops.length - 1; i >= 0; i--) { pops[i].age += dt; if (pops[i].age > 0.9) pops.splice(i, 1); }
      },
      draw: function (g, time) {
        var bg = g.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, calm() ? "#0a2a3c" : "#0b3550");
        bg.addColorStop(1, "#04101f");
        g.fillStyle = bg;
        g.fillRect(0, 0, W, H);
        // Slow light rays from the top.
        g.globalCompositeOperation = "lighter";
        for (var k = 0; k < 4; k++) {
          var x0 = (0.15 + k * 0.24 + Math.sin(time * 0.07 + k) * 0.05) * W;
          g.fillStyle = "rgba(120,200,255," + (calm() ? 0.025 : 0.04) + ")";
          g.beginPath();
          g.moveTo(x0 - 30, 0); g.lineTo(x0 + 50, 0);
          g.lineTo(x0 + 160 + k * 20, H); g.lineTo(x0 - 20 + k * 20, H);
          g.closePath(); g.fill();
        }
        g.globalCompositeOperation = "source-over";
        bubbles.forEach(function (b) {
          var r = b.r * easeOut(b.grow) * (1 + Math.sin(b.ph * 2) * 0.03);
          if (b.pic && ready(b.pic)) {
            g.globalAlpha = 0.95;
            g.drawImage(b.pic, b.x - r * 0.68, b.y - r * 0.68, r * 1.36, r * 1.36);
            g.globalAlpha = 1;
          }
          drawBubble(g, b.x, b.y, r, b.hue, b.ph);
        });
        pops.forEach(function (p) {
          var f = p.age / 0.9;
          g.strokeStyle = "hsla(" + Math.round(p.hue) + ",90%,85%," + (0.6 * (1 - f)) + ")";
          g.lineWidth = 3;
          g.beginPath(); g.arc(p.x, p.y, p.r * (1 + f * 0.6), 0, TAU); g.stroke();
          g.fillStyle = "rgba(220,245,255," + (0.8 * (1 - f)) + ")";
          p.drops.forEach(function (d) {
            var dist = p.r + d.v * f;
            g.beginPath();
            g.arc(p.x + Math.cos(d.a) * dist, p.y + Math.sin(d.a) * dist + f * f * 30, 4 * unit() + 1, 0, TAU);
            g.fill();
          });
        });
      }
    };
  }

  /* =====================================================================
     Activity 3: Colour Lamp (a lava lamp: glowing blobs rise, sink and merge)
     ===================================================================== */
  function ColourLamp() {
    var colours = cfg.lampColours;
    var index = 0, from = null, to = null, mix = 1;
    var blobs = [], sparks = [], rings = [];
    var small = document.createElement("canvas"), sg = small.getContext("2d"), img = null;
    var SCALE = 5; // the blobs are worked out on a small grid, then smoothly scaled up
    function hexToRgb(h) {
      var n = parseInt(h.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function paletteRgb(p) { return { bg: hexToRgb(p.bg), c: p.colours.map(hexToRgb) }; }
    function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
    function now() {
      var t = easeOut(mix);
      return { bg: lerp(from.bg, to.bg, t), c: to.c.map(function (c, i) { return lerp(from.c[i % from.c.length], c, t); }) };
    }
    function maxBlobs() { return calm() ? 7 : 11; }
    function addBlob(x, y, r, rising) {
      while (blobs.length >= maxBlobs()) {
        var old = blobs.filter(function (b) { return !b.leaving; })[0];
        if (!old) break;
        old.leaving = true;
        if (blobs.filter(function (b) { return !b.leaving; }).length < maxBlobs()) break;
      }
      blobs.push({ x: x, y: y, r: r, size: 0, vx: rand(-12, 12), vy: rising ? -rand(20, 40) : rand(-10, 10),
                   heat: rising ? 1 : (Math.random() < 0.5 ? 1 : -1), c: Math.floor(rand(0, 4)), leaving: false, wob: rand(0, TAU) });
    }
    function changeColour() {
      var cur = now();
      index = (index + 1) % colours.length;
      from = cur;
      to = paletteRgb(colours[index]);
      mix = 0;
      var base = [0, 2, 4, 1, 3, 5][index % 6];
      [0, 2, 4].forEach(function (s, i) {
        chime(noteFreq(base + s + 3), { type: "pad", gain: 0.1, attack: 0.5, decay: 3, delay: 0.001 + i * 0.05 });
      });
      announce(colours[index].name);
    }
    function touchAt(x, y) {
      // A new blob of light grows where you touch, the others are gently pushed away,
      // and a soft ring of colour spreads out.
      blobs.forEach(function (b) {
        var dx = b.x - x, dy = b.y - y, d = Math.sqrt(dx * dx + dy * dy) + 1;
        var push = 160 * unit() * Math.max(0, 1 - d / (Math.min(W, H) * 0.6));
        b.vx += dx / d * push; b.vy += dy / d * push;
      });
      addBlob(x, y, rand(55, 85) * unit(), true);
      rings.push({ x: x, y: y, age: 0 });
      for (var i = 0; i < (calm() ? 8 : 16); i++) {
        var a = rand(0, TAU), v = rand(30, 110) * unit();
        sparks.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, age: 0, life: rand(1.8, 3.2), c: Math.floor(rand(0, 4)) });
      }
      chime(noteFreq(12 - (y / H) * 9), { gain: 0.14, decay: 1.8 });
    }
    return {
      start: function () {
        index = Math.floor(rand(0, colours.length));
        from = to = paletteRgb(colours[index]);
        mix = 1;
        blobs = []; sparks = []; rings = [];
        for (var i = 0; i < (calm() ? 5 : 7); i++) addBlob(rand(0.2, 0.8) * W, rand(0.2, 0.9) * H, rand(45, 80) * unit(), false);
        blobs.forEach(function (b) { b.size = 1; });
        setTimeout(function () { announce(colours[index].name); }, 1200);
      },
      down: function (id, x, y) { touchAt(x, y); },
      move: function (id, x, y) { // dragging stirs the blobs nearby
        blobs.forEach(function (b) {
          var dx = b.x - x, dy = b.y - y;
          if (dx * dx + dy * dy < b.r * b.r * 4) { b.vx += dx * 0.05; b.vy += dy * 0.05; }
        });
      },
      up: function () {},
      dwell: function (x, y) { touchAt(x, y); },
      press: function () {
        changeColour();
        addBlob(rand(0.25, 0.75) * W, H + 40 * unit(), rand(60, 90) * unit(), true);
        for (var i = 0; i < (calm() ? 10 : 22); i++) {
          sparks.push({ x: rand(0, W), y: H + 10, vx: rand(-10, 10), vy: -rand(40, 120) * unit(), age: 0, life: rand(2.5, 4), c: Math.floor(rand(0, 4)) });
        }
      },
      update: function (dt) {
        mix = Math.min(1, mix + dt / 2.5); // colour changes fade over 2.5 s, never a flash
        var top = H * 0.18, bottom = H * 0.86;
        for (var i = blobs.length - 1; i >= 0; i--) {
          var b = blobs[i];
          b.size = b.leaving ? b.size - dt * 0.5 : Math.min(1, b.size + dt * 0.8);
          if (b.size <= 0) { blobs.splice(i, 1); continue; }
          // Warm blobs rise, cool blobs sink, like wax in a lamp.
          if (b.y < top && b.heat > 0 && Math.random() < dt * 0.8) b.heat = -1;
          if (b.y > bottom && b.heat < 0 && Math.random() < dt * 0.8) b.heat = 1;
          b.vy += -b.heat * 22 * unit() * dt;
          b.wob += dt;
          b.vx += Math.sin(b.wob * 0.7) * 6 * unit() * dt;
          b.vx *= 1 - dt * 0.6; b.vy *= 1 - dt * 0.5;
          b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.x < b.r * 0.5) { b.x = b.r * 0.5; b.vx = Math.abs(b.vx); }
          if (b.x > W - b.r * 0.5) { b.x = W - b.r * 0.5; b.vx = -Math.abs(b.vx); }
          if (b.y < -b.r) { b.y = -b.r; b.heat = -1; }
          if (b.y > H + b.r * 1.5) { b.y = H + b.r * 1.5; b.heat = 1; }
        }
        for (i = sparks.length - 1; i >= 0; i--) {
          var s = sparks[i];
          s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt;
          s.vx *= 1 - dt * 0.8; s.vy = s.vy * (1 - dt * 0.8) - 14 * dt;
          if (s.age > s.life) sparks.splice(i, 1);
        }
        for (i = rings.length - 1; i >= 0; i--) { rings[i].age += dt; if (rings[i].age > 2.4) rings.splice(i, 1); }
      },
      draw: function (g) {
        var sw = Math.max(32, Math.round(W / SCALE)), sh = Math.max(24, Math.round(H / SCALE));
        if (small.width !== sw || small.height !== sh || !img) {
          small.width = sw; small.height = sh;
          img = sg.createImageData(sw, sh);
        }
        var p = now(), data = img.data, n = blobs.length;
        var bx = new Float32Array(n), by = new Float32Array(n), rr = new Float32Array(n);
        for (var i = 0; i < n; i++) {
          var b = blobs[i], r = b.r * easeOut(b.size) / SCALE;
          bx[i] = b.x / SCALE; by[i] = b.y / SCALE;
          rr[i] = r * r * (1 + 0.08 * Math.sin(b.wob * 2));
        }
        var cols = blobs.map(function (b) { return p.c[b.c % p.c.length]; });
        var halo = calm() ? 0.3 : 0.45;
        var o = 0;
        for (var y = 0; y < sh; y++) {
          var shadeY = 0.75 + 0.35 * (y / sh); // the lamp is a little brighter at the bottom
          var bgR = p.bg[0] * shadeY, bgG = p.bg[1] * shadeY, bgB = p.bg[2] * shadeY;
          for (var x = 0; x < sw; x++) {
            var f = 0, cr = 0, cg = 0, cb = 0;
            for (i = 0; i < n; i++) {
              var dx = x - bx[i], dy = y - by[i];
              var w = rr[i] / (dx * dx + dy * dy + 1);
              f += w; cr += w * cols[i][0]; cg += w * cols[i][1]; cb += w * cols[i][2];
            }
            if (f > 0) { cr /= f; cg /= f; cb /= f; }
            var inside = f < 0.9 ? 0 : f > 1.1 ? 1 : (f - 0.9) / 0.2;
            var h = Math.min(1, f) * halo;
            var lit = 0.8 + 0.4 * Math.min(1, (f - 1) * 0.6);
            var outR = bgR + cr * h, outG = bgG + cg * h, outB = bgB + cb * h;
            data[o] = outR + (Math.min(255, cr * lit) - outR) * inside;
            data[o + 1] = outG + (Math.min(255, cg * lit) - outG) * inside;
            data[o + 2] = outB + (Math.min(255, cb * lit) - outB) * inside;
            data[o + 3] = 255;
            o += 4;
          }
        }
        sg.putImageData(img, 0, 0);
        g.imageSmoothingEnabled = true;
        if ("imageSmoothingQuality" in g) g.imageSmoothingQuality = "high";
        g.drawImage(small, 0, 0, W, H);
        g.globalCompositeOperation = "lighter";
        rings.forEach(function (rg) {
          var f = rg.age / 2.4, c = p.c[0];
          g.strokeStyle = "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + "," + (0.45 * (1 - f)) + ")";
          g.lineWidth = 10 * unit() * (1 - f) + 2;
          g.beginPath(); g.arc(rg.x, rg.y, easeOut(f) * 220 * unit(), 0, TAU); g.stroke();
        });
        sparks.forEach(function (s) {
          var c = p.c[s.c % p.c.length], f = 1 - s.age / s.life, sz = 10 * unit() * (0.5 + f);
          var hue = rgbHue(c);
          g.globalAlpha = f;
          g.drawImage(glow(hue, sat(), light()), s.x - sz, s.y - sz, sz * 2, sz * 2);
        });
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
      }
    };
  }
  function rgbHue(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return 0;
    var h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  }

  /* =====================================================================
     Activity 5: Fish Tank
     ===================================================================== */
  function FishTank(activity) {
    var fish = [], weeds = [], bubbles = [], food = [], pebbles = [], pictures = picturesFor(activity);
    // The background picture (config.js fishBackground), used in every mode (SG).
    // Calm mode dims it a little more. The drawn tank only shows if there is no picture.
    var photo = null, photoFailed = false;
    if (cfg.fishBackground) {
      photo = new Image();
      photo.onerror = function () { photoFailed = true; };
      photo.src = cfg.fishBackground;
    }
    function usePhoto() { return ready(photo); }
    // While the picture is still loading, show plain water (not the drawn tank).
    function photoLoading() { return !!photo && !photoFailed && !ready(photo); }
    var sea = (cfg.fishPictures || []).map(function (c) {
      var img = new Image();
      img.src = c.src;
      return { img: img, kind: c.kind || "fish", size: c.size || 1, weight: c.weight == null ? 1 : c.weight, rare: !!c.rare };
    });
    // Which creatures can appear: My pictures first, then the config.js pictures.
    function creatures() {
      var pics = pictures();
      if (pics.length) return pics.map(function (img) { return { img: img, kind: "fish", size: 1, weight: 1 }; });
      return sea;
    }
    // Pick one by weight, so a rare one (like the shark) only turns up now and then.
    function pickCreature(avoidRare) {
      var list = creatures().filter(function (c) {
        if (avoidRare && c.rare) return false;
        if (c.rare && fish.some(function (f) { return f.from === c && !f.leaving; })) return false; // one at a time
        if (c.kind === "jelly" && fish.filter(function (f) { return f.jelly; }).length >= 2) return false;
        return true;
      });
      if (!list.length) return null;
      var total = list.reduce(function (a, c) { return a + c.weight; }, 0), r = Math.random() * total;
      for (var i = 0; i < list.length; i++) { r -= list[i].weight; if (r <= 0) return list[i]; }
      return list[list.length - 1];
    }
    function creatureFish(c, n) {
      var f = makeFish(n, c ? c.img : null);
      if (c) {
        f.from = c;
        f.len = rand(80, 100) * unit() * (c.size || 1) * (creatures() === sea ? 1 : 0.8);
        f.jelly = c.kind === "jelly";
        if (f.jelly) { f.vx = rand(-6, 6); f.ty = rand(0.2, 0.6) * H; }
      }
      return f;
    }
    function maxVisitors() { return calm() ? 5 : 9; }
    // A touch brings a new fish: it pops in, swims around for a while, then swims away.
    function spawn(x, y) {
      var visitors = fish.filter(function (f) { return f.visitor && !f.leaving; });
      if (visitors.length >= maxVisitors()) leave(visitors[0]); // the one that came first swims off
      var f = creatureFish(pickCreature(false), fish.length);
      f.x = x; f.y = clamp(y, H * 0.08, H * 0.8);
      f.vx = rand(-20, 20); f.vy = 0;
      f.visitor = true; f.age = 0; f.stay = rand(12, 20); f.grow = 0; f.excite = 1;
      newTarget(f);
      fish.push(f);
      if (f.from && f.from.rare) announce("A shark is visiting!");
    }
    function leave(f) {
      f.leaving = true;
      f.tx = f.x < W / 2 ? -f.len * 2 : W + f.len * 2;
      f.ty = f.y + rand(-40, 40) * unit();
    }
    var COLOURS = [ [28, 95], [48, 95], [200, 85], [330, 80], [270, 70], [160, 70], [12, 90] ];
    function makeFish(i, pic) {
      var c = COLOURS[i % COLOURS.length];
      return {
        x: rand(0.15, 0.85) * W, y: rand(0.15, 0.75) * H, vx: rand(-30, 30), vy: 0,
        tx: rand(0.1, 0.9) * W, ty: rand(0.12, 0.78) * H,
        len: rand(70, 120) * unit() * (pic ? 1.25 : 1), hue: c[0] + rand(-8, 8), sat: c[1],
        tail: rand(0, TAU), excite: 0, face: 1, pause: 0, stripes: Math.random() < 0.6, pic: pic || null
      };
    }
    function setup() {
      var count = calm() ? 5 : 7, pics = pictures(), i;
      fish = [];
      if (pics.length) { // My pictures swim with a few drawn fish
        for (i = 0; i < count; i++) fish.push(makeFish(i, pics[i % pics.length]));
        for (i = 0; i < Math.min(3, count); i++) fish[i].pic = null;
        for (i = 0; i < fish.length; i++) if (fish[i].pic) fish[i].len = rand(90, 130) * unit();
      } else if (sea.length) { // three fish live in the tank; touches bring visitors
        for (i = 0; i < 3; i++) fish.push(creatureFish(pickCreature(true), i));
      } else {
        for (i = 0; i < count; i++) fish.push(makeFish(i, null));
      }
      weeds = [];
      for (i = 0; i < 9; i++) weeds.push({ x: rand(0.03, 0.97), h: rand(0.18, 0.42), ph: rand(0, TAU), hue: rand(95, 150), w: rand(10, 18) });
      pebbles = [];
      for (i = 0; i < 40; i++) pebbles.push({ x: rand(0, 1), y: rand(0.905, 1), r: rand(3, 9), l: rand(55, 80) });
    }
    function newTarget(f) { f.tx = rand(0.08, 0.92) * W; f.ty = rand(0.1, 0.8) * H; }
    function stir(x, y, all) {
      // Every fish wiggles. Fish near the touch swim over to look; the rest dart to a new spot.
      fish.forEach(function (f) {
        if (f.leaving) return;
        var dx = f.x - x, dy = f.y - y, d = Math.sqrt(dx * dx + dy * dy);
        f.excite = 1;
        f.pause = 0;
        if (!all && d < Math.min(W, H) * 0.55) { f.tx = x + rand(-60, 60) * unit(); f.ty = y + rand(-40, 40) * unit(); }
        else newTarget(f);
      });
    }
    function blowBubbles(x, y, n) {
      for (var i = 0; i < n; i++) bubbles.push({ x: x + rand(-10, 10), y: y, r: rand(3, 8) * unit() + 1, vy: rand(40, 80), ph: rand(0, TAU) });
      if (bubbles.length > 120) bubbles.splice(0, bubbles.length - 120);
    }
    function drawFish(g, f, time) {
      var L = f.len * (f.grow == null ? 1 : easeOut(f.grow)), wig = Math.sin(f.tail) * (0.14 + f.excite * 0.16);
      var angle = clamp(Math.atan2(f.vy, Math.abs(f.vx) + 1), -0.45, 0.45);
      if (usePhoto()) { // a soft light halo keeps fish easy to see against a busy reef
        g.globalAlpha = 0.45;
        g.drawImage(glow(195, 60, 80), f.x - L * 0.85, f.y - L * 0.6, L * 1.7, L * 1.2);
        g.globalAlpha = 1;
      }
      if (f.jelly && ready(f.pic)) { // a jellyfish pulses gently up and down, never flips
        var pulse = Math.sin(f.tail * 0.5);
        var jw = L * 0.75 * (1 - pulse * 0.05), jh = L * 0.75 * f.pic.naturalHeight / f.pic.naturalWidth * (1 + pulse * 0.06);
        g.save();
        g.translate(f.x, f.y);
        g.rotate(clamp(f.vx * 0.004, -0.15, 0.15));
        g.drawImage(f.pic, -jw / 2, -jh * 0.3, jw, jh);
        g.restore();
        return;
      }
      g.save();
      g.translate(f.x, f.y);
      g.scale(f.face, 1);
      g.rotate(angle);
      if (f.pic && ready(f.pic)) {
        // A picture fish wiggles by gently bending side to side.
        g.rotate(wig * 0.35);
        var s = L, ar = f.pic.naturalWidth / f.pic.naturalHeight;
        var w = ar >= 1 ? s : s * ar, h = ar >= 1 ? s / ar : s;
        g.scale(1, 1 + Math.sin(f.tail * 0.5) * 0.03);
        g.drawImage(f.pic, -w / 2, -h / 2, w, h);
        g.restore();
        return;
      }
      var S = calm() ? Math.round(f.sat * 0.65) : f.sat, Lt = calm() ? 52 : 58;
      var main = "hsl(" + Math.round(f.hue) + "," + S + "%," + Lt + "%)";
      var dark = "hsl(" + Math.round(f.hue) + "," + S + "%," + (Lt - 18) + "%)";
      var lightC = "hsl(" + Math.round(f.hue + 10) + "," + S + "%," + (Lt + 18) + "%)";
      var tailY = wig * L;            // the tail swings
      var midY = wig * L * 0.25;      // the body bends a little too
      // tail fin
      g.fillStyle = dark;
      g.beginPath();
      g.moveTo(-L * 0.32, midY * 1.6);
      g.quadraticCurveTo(-L * 0.5, tailY * 0.8 - L * 0.05, -L * 0.62, tailY - L * 0.2);
      g.quadraticCurveTo(-L * 0.54, tailY, -L * 0.62, tailY + L * 0.2);
      g.quadraticCurveTo(-L * 0.5, tailY * 0.8 + L * 0.05, -L * 0.32, midY * 1.6);
      g.fill();
      // top fin
      g.beginPath();
      g.moveTo(L * 0.12, -L * 0.2);
      g.quadraticCurveTo(-L * 0.05, -L * 0.42, -L * 0.2, -L * 0.16 + midY);
      g.closePath();
      g.fill();
      // body
      var grad = g.createLinearGradient(0, -L * 0.25, 0, L * 0.25);
      grad.addColorStop(0, lightC);
      grad.addColorStop(0.55, main);
      grad.addColorStop(1, dark);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(L * 0.42, 0);
      g.bezierCurveTo(L * 0.36, -L * 0.26, -L * 0.12, -L * 0.28 + midY, -L * 0.34, midY * 1.6);
      g.bezierCurveTo(-L * 0.12, L * 0.26 + midY, L * 0.36, L * 0.24, L * 0.42, 0);
      g.fill();
      if (usePhoto()) { g.strokeStyle = "rgba(8,20,40,0.75)"; g.lineWidth = Math.max(2, L * 0.025); g.stroke(); }
      if (f.stripes) {
        g.save();
        g.clip();
        g.fillStyle = "rgba(255,255,255,0.55)";
        [0.08, -0.12].forEach(function (sx) {
          g.beginPath();
          g.ellipse(L * sx, midY * 0.5, L * 0.035, L * 0.3, 0, 0, TAU);
          g.fill();
        });
        g.restore();
      }
      // side fin, flapping
      g.fillStyle = dark;
      g.beginPath();
      g.ellipse(L * 0.08, L * 0.07, L * 0.1, L * 0.045, 0.6 + Math.sin(f.tail * 1.3) * 0.4, 0, TAU);
      g.fill();
      // eye
      g.fillStyle = "#fff";
      g.beginPath(); g.arc(L * 0.25, -L * 0.05, L * 0.065, 0, TAU); g.fill();
      g.fillStyle = "#101820";
      g.beginPath(); g.arc(L * 0.27, -L * 0.05, L * 0.035, 0, TAU); g.fill();
      g.fillStyle = "rgba(255,255,255,0.9)";
      g.beginPath(); g.arc(L * 0.28, -L * 0.065, L * 0.012, 0, TAU); g.fill();
      g.restore();
    }
    return {
      start: function () { setup(); },
      resize: function () { setup(); },
      down: function (id, x, y) {
        stir(x, y, false);
        spawn(x, y);
        food.push({ x: x, y: y, age: 0 });
        blowBubbles(x, y, calm() ? 4 : 8);
        chime(noteFreq(rand(4, 10)), { gain: 0.2, bend: 0.6, decay: 1.1 });
        announceSometimes("A new fish swims in.");
      },
      move: function () {},
      up: function () {},
      dwell: function (x, y) { this.down(null, x, y); },
      press: function () {
        stir(0, 0, true);
        var sx = rand(0.2, 0.8) * W, sy = rand(0.2, 0.7) * H;
        spawn(sx, sy);
        food.push({ x: sx, y: sy, age: 0 });
        blowBubbles(sx, sy, calm() ? 6 : 12);
        arpeggio(Math.floor(rand(3, 7)), 3, 0.11, { gain: 0.14, bend: 0.7, decay: 1 });
        announceSometimes("A new fish swims in.");
      },
      update: function (dt) {
        for (var v = fish.length - 1; v >= 0; v--) {
          var vf = fish[v];
          if (vf.grow != null) vf.grow = Math.min(1, vf.grow + dt * 1.6);
          if (!vf.visitor) continue;
          vf.age += dt;
          if (!vf.leaving && vf.age > vf.stay) leave(vf);
          if (vf.leaving && (vf.x < -vf.len * 1.2 || vf.x > W + vf.len * 1.2 || vf.y < -vf.len * 1.5)) fish.splice(v, 1);
        }
        fish.forEach(function (f) {
          f.excite = Math.max(0, f.excite - dt / 3);
          if (f.jelly) { // drifts slowly; a touch makes it pulse and push upwards
            f.tail += dt * (2.2 + f.excite * 6);
            var push = Math.max(0, Math.sin(f.tail * 0.5)) * (14 + f.excite * 60) * unit();
            f.vy += (-push + 9 * unit()) * dt;
            f.vy *= 1 - dt * 0.8;
            f.vx += ((f.tx - f.x) * 0.02 - f.vx) * dt * 0.5;
            f.x += f.vx * dt; f.y += f.vy * dt;
            if (f.leaving) { f.vy -= 30 * unit() * dt; return; } // floats away upwards
            if (f.y < H * 0.08) f.vy = Math.abs(f.vy) * 0.5;
            f.y = clamp(f.y, H * 0.06, H * 0.7);
            return;
          }
          var dx = f.tx - f.x, dy = f.ty - f.y, d = Math.sqrt(dx * dx + dy * dy) + 0.001;
          if (d < 30 * unit() && !f.leaving) {
            f.pause += dt;
            if (f.pause > rand(1, 4)) { f.pause = 0; newTarget(f); }
          }
          var speed = (40 + f.excite * 170) * unit();
          var want = d < 30 * unit() && !f.leaving ? 0 : speed;
          var ax = (dx / d * want - f.vx) * (1.2 + f.excite * 2.5);
          var ay = (dy / d * want * 0.6 - f.vy) * (1.2 + f.excite * 2.5);
          f.vx += ax * dt; f.vy += ay * dt;
          f.x += f.vx * dt; f.y += f.vy * dt;
          f.y = clamp(f.y, H * 0.06, H * 0.85);
          // turn round smoothly (the fish squashes, then faces the other way)
          var faceTo = f.vx >= 0 ? 1 : -1;
          if (Math.abs(f.vx) > 4) f.face += (faceTo - f.face) * Math.min(1, dt * 5);
          var sp = Math.sqrt(f.vx * f.vx + f.vy * f.vy) / unit();
          f.tail += dt * (3 + sp * 0.05 + f.excite * 12);
        });
        if (Math.random() < dt * 0.6) blowBubbles(W * 0.88, H * 0.92, 1); // the bubbler in the corner
        for (var i = bubbles.length - 1; i >= 0; i--) {
          var b = bubbles[i];
          b.ph += dt * 3; b.y -= b.vy * dt * unit(); b.x += Math.sin(b.ph) * 12 * dt;
          if (b.y < -10) bubbles.splice(i, 1);
        }
        for (i = food.length - 1; i >= 0; i--) { food[i].age += dt; if (food[i].age > 1.6) food.splice(i, 1); }
      },
      draw: function (g, time) {
        if (usePhoto()) {
          // Fill the screen with the picture (cropped, never stretched).
          var k = Math.max(W / photo.naturalWidth, H / photo.naturalHeight);
          var pw = photo.naturalWidth * k, ph = photo.naturalHeight * k;
          g.drawImage(photo, (W - pw) / 2, (H - ph) / 2, pw, ph);
          // Soften the busy reef with a little water colour so the fish stand out.
          var veil = g.createLinearGradient(0, 0, 0, H);
          var c = calm() ? 0.14 : 0;
          veil.addColorStop(0, "rgba(10,70,110," + (0.08 + c) + ")");
          veil.addColorStop(0.5, "rgba(10,70,110," + (0.22 + c) + ")");
          veil.addColorStop(1, "rgba(6,40,70," + (0.42 + c) + ")");
          g.fillStyle = veil;
          g.fillRect(0, 0, W, H);
        } else {
          var bg = g.createLinearGradient(0, 0, 0, H);
          bg.addColorStop(0, calm() ? "#1a5470" : "#1b6f95");
          bg.addColorStop(0.6, calm() ? "#0f3a55" : "#0f4a6e");
          bg.addColorStop(1, "#082338");
          g.fillStyle = bg;
          g.fillRect(0, 0, W, H);
        }
        if (!usePhoto() && !photoLoading()) {
          // soft moving light on the water
          g.globalCompositeOperation = "lighter";
          g.fillStyle = "rgba(160,220,255," + (calm() ? 0.03 : 0.05) + ")";
          for (var k = 0; k < 6; k++) {
            g.beginPath();
            g.ellipse((k / 6 + Math.sin(time * 0.15 + k) * 0.05) * W, H * (0.08 + 0.05 * Math.sin(time * 0.2 + k * 2)),
                      W * 0.09, H * 0.025, 0, 0, TAU);
            g.fill();
          }
          g.globalCompositeOperation = "source-over";
          // sand and pebbles
          g.fillStyle = "#c8a66b";
          g.beginPath();
          g.moveTo(0, H);
          for (var x = 0; x <= W; x += W / 20) g.lineTo(x, H * 0.91 - Math.sin(x / W * 4) * H * 0.015);
          g.lineTo(W, H);
          g.fill();
          pebbles.forEach(function (p) {
            g.fillStyle = "hsl(30,25%," + p.l + "%)";
            g.beginPath(); g.ellipse(p.x * W, p.y * H, p.r * unit() + 2, (p.r * unit() + 2) * 0.7, 0, 0, TAU); g.fill();
          });
          // swaying water plants
          weeds.forEach(function (w) {
            var x0 = w.x * W, y0 = H * 0.93, h = w.h * H, sw2 = Math.sin(time * 0.8 + w.ph) * h * 0.12;
            g.strokeStyle = "hsl(" + Math.round(w.hue) + "," + (calm() ? 35 : 55) + "%,34%)";
            g.lineWidth = w.w * unit() + 3;
            g.lineCap = "round";
            g.beginPath();
            g.moveTo(x0, y0);
            g.bezierCurveTo(x0 + sw2, y0 - h * 0.35, x0 - sw2, y0 - h * 0.7, x0 + sw2 * 1.4, y0 - h);
            g.stroke();
          });
        }
        // where the touch was: a gentle ripple
        food.forEach(function (fd) {
          var f = fd.age / 1.6;
          g.strokeStyle = "rgba(220,245,255," + (0.5 * (1 - f)) + ")";
          g.lineWidth = 3;
          g.beginPath(); g.arc(fd.x, fd.y, easeOut(f) * 70 * unit() + 6, 0, TAU); g.stroke();
        });
        fish.forEach(function (f) { drawFish(g, f, time); });

        g.lineWidth = 1.5;
        bubbles.forEach(function (b) { drawBubble(g, b.x, b.y, b.r * 1.3, 190, b.ph); });
      }
    };
  }

  /* ---------- Soft whoosh and thump for Fireworks (filtered noise, never loud) ---------- */
  var noiseBuf = null;
  function noise() {
    if (noiseBuf || !actx) return noiseBuf;
    noiseBuf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  // kind "whoosh": a soft rising hiss; kind "thump": a gentle low pop
  function softNoise(kind, gain) {
    if (!audioReady() || !noise()) return;
    var t = actx.currentTime, src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
    src.buffer = noiseBuf;
    var len = kind === "whoosh" ? 0.9 : 0.7;
    if (kind === "whoosh") {
      f.type = "bandpass"; f.Q.value = 1.2;
      f.frequency.setValueAtTime(500, t);
      f.frequency.exponentialRampToValueAtTime(2600, t + len);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain, t + len * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    } else {
      f.type = "lowpass"; f.frequency.value = 380;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    }
    src.connect(f); f.connect(g); g.connect(master); g.connect(echo);
    src.start(t, Math.random()); src.stop(t + len + 0.05);
    if (kind === "thump") { // a low round tone under the pop
      var o = actx.createOscillator(), og = actx.createGain();
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(55, t + 0.4);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.linearRampToValueAtTime(gain * 0.9, t + 0.015);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(og); og.connect(master);
      o.start(t); o.stop(t + 0.55);
    }
  }

  /* ---------- Big fireworks sounds (regular mode): whistle, bang with echo, crackle ----------
     Built from noise like real fireworks, so there are no sound files to licence.
     Your own recordings can be used instead: see fireworksSounds in config.js. */
  var fwBus = null, fwVerb = null, fwFiles = {};
  function fireworksBus() {
    if (fwBus || !actx) return fwBus;
    // A firm limiter so the bangs are exciting but never painfully loud.
    var lim = actx.createDynamicsCompressor();
    lim.threshold.value = -20; lim.knee.value = 6; lim.ratio.value = 12;
    lim.attack.value = 0.002; lim.release.value = 0.25;
    var out = actx.createGain();
    out.gain.value = 1.0;
    lim.connect(out); out.connect(master);
    fwBus = lim;
    // Outdoor echo: a long, dark, decaying tail like a bang rolling round buildings.
    fwVerb = actx.createConvolver();
    var len = Math.round(actx.sampleRate * 2.8), ir = actx.createBuffer(2, len, actx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = ir.getChannelData(ch), lp = 0;
      for (var i = 0; i < len; i++) {
        var t = i / actx.sampleRate;
        lp += ((Math.random() * 2 - 1) - lp) * 0.08; // darker tail
        var slap = t > 0.32 && t < 0.38 ? 2.2 : 1;   // one clear echo off a wall
        d[i] = lp * Math.pow(1 - i / len, 3.2) * slap;
      }
    }
    fwVerb.buffer = ir;
    var vg = actx.createGain();
    vg.gain.value = 0.55;
    fwVerb.connect(vg); vg.connect(lim);
    // Optional recordings from config.js
    var files = cfg.fireworksSounds || {};
    Object.keys(files).forEach(function (k) {
      if (!files[k] || !window.fetch) return;
      fetch(files[k]).then(function (r) { return r.arrayBuffer(); }).then(function (data) {
        return new Promise(function (ok, bad) { var p = actx.decodeAudioData(data, ok, bad); if (p && p.then) p.then(ok, bad); });
      }).then(function (buf) { fwFiles[k] = buf; }).catch(function () { /* use the built-in sound */ });
    });
    return fwBus;
  }
  function fwNoise(t, dur, filterType, f0, f1, gain, attack, toVerb) {
    var src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
    src.buffer = noise();
    f.type = filterType;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(fwBus);
    if (toVerb) g.connect(fwVerb);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  function playFile(buf, gain) {
    var s = actx.createBufferSource(), g = actx.createGain();
    s.buffer = buf; g.gain.value = gain;
    s.connect(g); g.connect(fwBus);
    s.start();
  }
  function bigFirework(kind, opts) {
    if (!audioReady() || !noise() || !fireworksBus()) return;
    opts = opts || {};
    var t = actx.currentTime + 0.01;
    if (fwFiles[kind]) { playFile(fwFiles[kind], 0.9); return; }
    if (kind === "launch") {
      // a rising whistle with a rushing hiss
      var dur = opts.dur || 1.1, o = actx.createOscillator(), og = actx.createGain(), vib = actx.createOscillator(), vg = actx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(rand(700, 900), t);
      o.frequency.exponentialRampToValueAtTime(rand(1900, 2500), t + dur);
      vib.frequency.value = 22; vg.gain.value = 18;
      vib.connect(vg); vg.connect(o.frequency);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.linearRampToValueAtTime(0.05, t + 0.15);
      og.gain.setValueAtTime(0.05, t + dur * 0.8);
      og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(og); og.connect(fwBus);
      o.start(t); vib.start(t); o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
      fwNoise(t, dur, "bandpass", 1200, 4000, 0.12, dur * 0.6, false);
      return;
    }
    if (kind === "bang") {
      var big = opts.style === "willow" ? 0.8 : 1;
      // the crack: very fast, bright, then dark
      fwNoise(t, 0.6, "lowpass", 7000, 180, 0.9 * big, 0.003, true);
      // the boom you feel
      var b = actx.createOscillator(), bg = actx.createGain();
      b.frequency.setValueAtTime(rand(75, 95), t);
      b.frequency.exponentialRampToValueAtTime(38, t + 0.6);
      bg.gain.setValueAtTime(0.0001, t);
      bg.gain.linearRampToValueAtTime(0.75 * big, t + 0.008);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      b.connect(bg); bg.connect(fwBus); bg.connect(fwVerb);
      b.start(t); b.stop(t + 0.85);
      // rumbling tail
      fwNoise(t + 0.05, 1.8, "lowpass", 400, 120, 0.25 * big, 0.08, true);
      // crackle: lots of tiny pops as the stars burn
      var pops = opts.style === "willow" ? 70 : opts.style === "globe" ? 45 : 25;
      var start = opts.style === "willow" ? 0.5 : 0.35, spread = opts.style === "willow" ? 2.2 : 1.3;
      if (fwFiles.crackle) { setTimeout(function () { playFile(fwFiles.crackle, 0.7); }, start * 1000); return; }
      for (var i = 0; i < pops; i++) {
        var pt = t + start + Math.pow(Math.random(), 0.8) * spread;
        fwNoise(pt, rand(0.006, 0.02), "highpass", rand(1800, 4500), rand(1800, 4500), rand(0.05, 0.2), 0.001, i % 4 === 0);
      }
      if (opts.style === "willow") fwNoise(t + 0.4, 2.4, "highpass", 5000, 3000, 0.05, 0.6, false); // sizzle
    }
  }

  /* =====================================================================
     Activity 6: Fireworks (soft glowing bursts: no strobing, no screen flashes)
     ===================================================================== */
  function Fireworks() {
    var rockets = [], sparks = [], stars = [], hills = [];
    var STYLES = ["globe", "ring", "willow", "twotone"];
    function maxShows() { return calm() ? 2 : 5; }
    function launch(tx, ty) {
      if (rockets.length + countBursts() >= maxShows() + 2) return; // keep the sky calm, however fast the presses
      ty = clamp(ty, H * 0.12, H * 0.7);
      var x0 = clamp(tx + rand(-80, 80) * unit(), W * 0.05, W * 0.95);
      var dur = calm() ? 1.6 : 1.1;
      rockets.push({ x0: x0, y0: H + 10, x: x0, y: H + 10, tx: tx, ty: ty, t: 0, dur: dur, hue: rand(0, 360), trail: [] });
      if (calm()) softNoise("whoosh", 0.05); else bigFirework("launch", { dur: dur });
    }
    var burstIds = 0, liveBursts = {};
    function countBursts() { return Object.keys(liveBursts).length; }
    function burst(r) {
      var style = pick(STYLES), id = ++burstIds, n = calm() ? 40 : 70;
      var hue2 = (r.hue + rand(60, 180)) % 360;
      var speed = rand(170, 240) * unit() * (calm() ? 0.75 : 1);
      liveBursts[id] = n;
      for (var i = 0; i < n; i++) {
        var a = i / n * TAU + rand(-0.05, 0.05), v = speed;
        if (style === "globe") v = speed * Math.sqrt(Math.random());
        if (style === "willow") v = speed * rand(0.5, 0.9);
        sparks.push({
          x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          hue: style === "twotone" && i % 2 ? hue2 : r.hue, age: 0,
          life: style === "willow" ? rand(2.6, 3.4) : rand(1.6, 2.3), fall: style === "willow" ? 1.7 : 1,
          drag: style === "ring" ? 1.6 : 1.1, id: id, tw: rand(0, TAU)
        });
      }
      if (calm()) { // calm mode keeps the soft sounds
        softNoise("thump", 0.06);
        chime(noteFreq(12 - (r.y / H) * 9), { gain: 0.1, decay: 2.2, delay: 0.08 });
      } else {
        bigFirework("bang", { style: style });
      }
      announceSometimes("Fireworks!");
    }
    return {
      start: function () {
        stars = [];
        for (var i = 0; i < 80; i++) stars.push({ x: Math.random(), y: Math.random() * 0.8, s: rand(0.6, 1.8), p: rand(0, TAU) });
        hills = [];
        for (i = 0; i <= 12; i++) hills.push(rand(0.86, 0.93));
        rockets = []; sparks = []; liveBursts = {};
      },
      down: function (id, x, y) { launch(x, y); },
      move: function () {},
      up: function () {},
      dwell: function (x, y) { launch(x, y); },
      press: function () { launch(rand(0.15, 0.85) * W, rand(0.15, 0.45) * H); },
      update: function (dt) {
        for (var i = rockets.length - 1; i >= 0; i--) {
          var r = rockets[i];
          r.t += dt;
          var f = easeOut(r.t / r.dur);
          r.x = r.x0 + (r.tx - r.x0) * f;
          r.y = r.y0 + (r.ty - r.y0) * f;
          r.trail.push({ x: r.x, y: r.y });
          if (r.trail.length > 14) r.trail.shift();
          if (r.t >= r.dur) { burst(r); rockets.splice(i, 1); }
        }
        var g = 60 * unit();
        for (i = sparks.length - 1; i >= 0; i--) {
          var s = sparks[i];
          s.age += dt;
          s.vx *= 1 - dt * s.drag; s.vy = s.vy * (1 - dt * s.drag) + g * s.fall * dt;
          s.x += s.vx * dt; s.y += s.vy * dt;
          if (s.age > s.life) {
            sparks.splice(i, 1);
            if (--liveBursts[s.id] <= 0) delete liveBursts[s.id];
          }
        }
        stars.forEach(function (st) { st.p += dt * 0.5; });
      },
      draw: function (g, time) {
        var bg = g.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, "#03040f");
        bg.addColorStop(0.7, "#0b1030");
        bg.addColorStop(1, "#141a40");
        g.fillStyle = bg;
        g.fillRect(0, 0, W, H);
        g.fillStyle = "#fff";
        stars.forEach(function (st) {
          g.globalAlpha = 0.35 + 0.25 * Math.sin(st.p); // slow twinkle
          g.fillRect(st.x * W, st.y * H, st.s, st.s);
        });
        g.globalAlpha = 1;
        g.globalCompositeOperation = "lighter";
        var S = sat(), Li = light();
        rockets.forEach(function (r) {
          r.trail.forEach(function (p, i) {
            var a = (i + 1) / r.trail.length, sz = 6 * unit() * a + 2;
            g.globalAlpha = a * 0.7;
            g.drawImage(glow(40, 80, 65), p.x - sz, p.y - sz, sz * 2, sz * 2);
          });
        });
        // Each spark is a soft glow with a short tail. Brightness is capped so a burst
        // never lights up the whole screen.
        var cap = calm() ? 0.55 : 0.8;
        for (var i = 0; i < sparks.length; i++) {
          var s = sparks[i], f = 1 - s.age / s.life;
          var a = Math.min(1, f * 1.4, s.age / 0.2) * cap * (0.85 + 0.15 * Math.sin(s.tw + s.age * 4)); // fades in, never pops on
          var sz = (7 * unit() + 2) * (0.6 + 0.4 * f);
          var img = glow(s.hue, S, Li);
          g.globalAlpha = a;
          g.drawImage(img, s.x - sz, s.y - sz, sz * 2, sz * 2);
          g.globalAlpha = a * 0.4;
          g.drawImage(img, s.x - s.vx * 0.06 - sz * 0.7, s.y - s.vy * 0.06 - sz * 0.7, sz * 1.4, sz * 1.4);
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
        // hills along the bottom
        g.fillStyle = "#070a1c";
        g.beginPath();
        g.moveTo(0, H);
        for (var k = 0; k < hills.length; k++) g.lineTo(k / (hills.length - 1) * W, hills[k] * H);
        g.lineTo(W, H);
        g.fill();
      }
    };
  }

  /* =====================================================================
     Activity 4: Look and Bloom
     ===================================================================== */
  function LookAndBloom(activity) {
    var flowers = [], flies = [], pictures = picturesFor(activity);
    var HUES = [330, 285, 200, 45, 15, 165];
    function bloom(x, y) {
      var max = calm() ? 10 : 18;
      var alive = flowers.filter(function (f) { return !f.leaving; });
      if (alive.length >= max) alive[0].leaving = true; // the oldest fades away
      var hue = pick(HUES) + rand(-10, 10);
      flowers.push({ x: x, y: y, size: rand(48, 80) * unit(), hue: hue, petals: Math.floor(rand(5, 9)),
                     spin: rand(-0.4, 0.4), age: 0, ph: rand(0, TAU), fade: 1, leaving: false,
                     pic: pictures().length ? pick(pictures()) : null });
      arpeggio(Math.floor(rand(5, 9)), 3, 0.12, { gain: 0.14, decay: 2 });
      var names = { 330: "pink", 285: "purple", 200: "blue", 45: "yellow", 15: "orange", 165: "green" };
      var nearest = HUES.reduce(function (a, b) { return Math.abs(b - hue) < Math.abs(a - hue) ? b : a; });
      announceSometimes("A " + names[nearest] + " flower opened.");
    }
    function freeSpot() { // somewhere away from the other flowers
      var best = null, bestD = -1;
      for (var i = 0; i < 14; i++) {
        var x = rand(0.12, 0.88) * W, y = rand(0.15, 0.8) * H, d = 1e9;
        flowers.forEach(function (f) { d = Math.min(d, (f.x - x) * (f.x - x) + (f.y - y) * (f.y - y)); });
        if (d > bestD) { bestD = d; best = [x, y]; }
      }
      return best;
    }
    function drawFlower(g, f, time) {
      var open = easeOut(f.age / 1.8);
      var sway = Math.sin(time * 0.6 + f.ph) * 0.06;
      var s = f.size * open;
      g.save();
      g.translate(f.x, f.y);
      g.rotate(sway + f.spin * open);
      g.globalAlpha = f.fade;
      // glow behind the flower
      g.globalCompositeOperation = "lighter";
      var gl = glow(f.hue, sat(), 45);
      g.drawImage(gl, -s * 2.2, -s * 2.2, s * 4.4, s * 4.4);
      g.globalCompositeOperation = "source-over";
      if (f.pic && ready(f.pic)) {
        g.drawImage(f.pic, -s * 1.1, -s * 1.1, s * 2.2, s * 2.2);
      } else {
        var L = calm() ? 60 : 66, S = calm() ? 55 : 85;
        for (var i = 0; i < f.petals; i++) {
          g.save();
          g.rotate(i / f.petals * TAU);
          var grad = g.createLinearGradient(0, 0, 0, -s);
          grad.addColorStop(0, "hsl(" + Math.round(f.hue) + "," + S + "%," + (L - 20) + "%)");
          grad.addColorStop(1, "hsl(" + Math.round(f.hue + 15) + "," + S + "%," + L + "%)");
          g.fillStyle = grad;
          g.beginPath();
          g.ellipse(0, -s * 0.55, s * 0.26, s * 0.55, 0, 0, TAU);
          g.fill();
          g.restore();
        }
        g.fillStyle = "hsl(45," + (calm() ? 60 : 95) + "%,62%)";
        g.beginPath(); g.arc(0, 0, s * 0.22, 0, TAU); g.fill();
      }
      g.restore();
    }
    return {
      start: function () {
        flies = [];
        for (var i = 0; i < 14; i++) flies.push({ x: rand(0, 1), y: rand(0.1, 0.9), vx: rand(-0.02, 0.02), vy: rand(-0.015, 0.015), p: rand(0, TAU) });
      },
      down: function (id, x, y) { bloom(x, y); },
      move: function () {},
      up: function () {},
      dwell: function (x, y) { bloom(x, y); },
      press: function () { var p = freeSpot(); bloom(p[0], p[1]); },
      update: function (dt) {
        for (var i = flowers.length - 1; i >= 0; i--) {
          var f = flowers[i];
          f.age += dt;
          if (f.age > 40) f.leaving = true;
          if (f.leaving) { f.fade -= dt / 3; if (f.fade <= 0) flowers.splice(i, 1); }
        }
        flies.forEach(function (fl) {
          fl.p += dt;
          fl.x += (fl.vx + Math.sin(fl.p * 0.7) * 0.01) * dt;
          fl.y += (fl.vy + Math.cos(fl.p * 0.5) * 0.008) * dt;
          if (fl.x < -0.05) fl.x = 1.05; if (fl.x > 1.05) fl.x = -0.05;
          if (fl.y < 0.05) fl.vy = Math.abs(fl.vy); if (fl.y > 0.92) fl.vy = -Math.abs(fl.vy);
        });
      },
      draw: function (g, time) {
        var bg = g.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, "#071226");
        bg.addColorStop(0.7, "#0c1d2c");
        bg.addColorStop(1, "#0a2418");
        g.fillStyle = bg;
        g.fillRect(0, 0, W, H);
        // gentle hills
        g.fillStyle = "#08231a";
        g.beginPath();
        g.moveTo(0, H);
        for (var x = 0; x <= W; x += W / 24) g.lineTo(x, H * 0.9 - Math.sin(x / W * 5 + 1) * H * 0.03);
        g.lineTo(W, H);
        g.closePath();
        g.fill();
        g.globalCompositeOperation = "lighter";
        flies.forEach(function (fl) {
          var s = 9 * unit();
          g.globalAlpha = 0.35 + 0.3 * Math.sin(fl.p * 0.9); // slow, gentle twinkle
          g.drawImage(glow(60, 80, 60), fl.x * W - s, fl.y * H - s, s * 2, s * 2);
        });
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
        flowers.forEach(function (f) { drawFlower(g, f, time); });
      }
    };
  }

  /* =====================================================================
     Snow Globe: you are inside the globe. Shake it (tap, switch, look, or
     shake the iPad) and the snow swirls. The more you shake, the more it
     snows. Every few shakes the sky changes or an animal comes to visit.
     All sounds are made by the computer (no sound files).
     ===================================================================== */
  function SnowGlobe() {
    var PIC = cfg.snowPictures || {};
    function img(src) { if (!src) return null; var i = new Image(); i.src = src; return i; }
    var cabinImg = img(PIC.cabin), snowmanImg = img(PIC.snowman);
    var ANIMALS = (PIC.animals && PIC.animals.length ? PIC.animals : [
      { kind: "reindeer" }, { kind: "fox" }, { kind: "owl" }, { kind: "bunny" }
    ]).map(function (a) {
      return { kind: a.kind || "picture", name: a.name || a.kind, say: a.say || ("A " + (a.name || a.kind) + " came to visit."), img: img(a.src), size: a.size || 1 };
    });
    var SKIES = [
      { name: "Starry night", say: "A starry night.", top: "#040820", mid: "#0d1b48", low: "#26407a", stars: 1, aurora: 0, hill: ["#dfe9f8", "#93a9d1"], far: "#5a6fa0", light: false },
      { name: "Northern lights", say: "Northern lights are dancing in the sky.", top: "#020d1a", mid: "#06263a", low: "#14405e", stars: 0.7, aurora: 1, hill: ["#d6ecf0", "#86aabb"], far: "#3f6a80", light: false },
      { name: "Pink sunset", say: "A pink sunset.", top: "#251a4d", mid: "#6b3c78", low: "#e0887c", stars: 0.25, aurora: 0, hill: ["#f8e6ee", "#c49dbd"], far: "#8c6a9c", light: false },
      { name: "Snowy day", say: "A snowy day.", top: "#2a5390", mid: "#4f80bf", low: "#93b5df", stars: 0, aurora: 0, hill: ["#ffffff", "#c4d6ee"], far: "#8fb0d8", light: true }
    ];
    var flakes = [], stars = [], trees = [], storm = 0.15, gust = 0, shakes = 0, discoveries = 0;
    var sky = 0, skyFrom = 0, skyT = 1, animal = -1, animalFrom = -1, animalT = 1;
    var wind = null, lastDrag = {}, beat = 0, wasStormy = false, held = {}, heldFor = 0;
    var sprite = null, shade = null, t0 = 0;
    function S() { return Math.min(W, H) / 700; }
    function maxFlakes() { return calm() ? 700 : 2000; }
    function cap() { return calm() ? 0.6 : 1; }
    function target() { return Math.round(maxFlakes() * (0.03 + 0.97 * Math.pow(storm, 1.6))); } // a light sprinkle up to a blizzard
    function horizon() { return H * 0.6; }
    function groundY(x) { return H * 0.76 + Math.sin(x / W * 5 + 0.6) * H * 0.025; }

    function makeSprites() {
      if (sprite) return;
      sprite = document.createElement("canvas"); sprite.width = sprite.height = 48;
      var g = sprite.getContext("2d"), gr = g.createRadialGradient(24, 24, 0, 24, 24, 24);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(250,252,255,0.9)");
      gr.addColorStop(0.7, "rgba(225,238,255,0.35)"); gr.addColorStop(1, "rgba(220,235,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 48, 48);
      shade = document.createElement("canvas"); shade.width = shade.height = 48; // a soft outline so flakes show on a pale sky
      g = shade.getContext("2d"); gr = g.createRadialGradient(24, 24, 0, 24, 24, 24);
      gr.addColorStop(0, "rgba(30,60,110,0.55)"); gr.addColorStop(1, "rgba(30,60,110,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 48, 48);
    }
    function newFlake(fromTop) {
      var z = Math.pow(Math.random(), 0.8) * 0.75 + 0.25;
      return { x: rand(0, W), y: fromTop ? rand(-60, -5) : rand(0, H), z: z, vx: 0, vy: (22 + 50 * z) * S(), ph: rand(0, TAU), spark: Math.random() < 0.28 };
    }

    /* ---- Shaking ---- */
    function shake(strength, dir) {
      var k = strength * (calm() ? 0.6 : 1), s = S();
      var before = storm;
      storm = Math.min(cap(), storm + (calm() ? 0.08 : 0.12) * strength);
      gust = clamp(gust + dir * 1.3 * k, -2.5, 2.5);
      flakes.forEach(function (f) {
        f.vx += dir * rand(30, 150) * s * f.z * k;
        f.vy -= rand(20, 160) * s * f.z * k;
      });
      // snow kicked up from the ground
      var extra = Math.min(Math.round((calm() ? 25 : 60) * strength), maxFlakes() - flakes.length);
      for (var i = 0; i < extra; i++) {
        var f = newFlake(false);
        f.y = rand(H * 0.7, H); f.vy = -rand(120, 360) * s * k; f.vx = dir * rand(20, 140) * s * k;
        flakes.push(f);
      }
      if (snowSound() === "bells") jingle(0.05 + 0.05 * strength, 3);
      else if (snowSound() === "music") chime(noteFreq(10 + Math.floor(rand(0, 4))), { gain: 0.07, decay: 2.6 });
      if (before < 0.68 && storm >= 0.68) announce(calm() ? "Lots of snow!" : "A blizzard!");
      else announceSometimes(storm > 0.4 ? "More snow!" : "The snow swirls around.");
      shakes++;
      if (shakes % 3 === 0) discover();
    }
    function discover() {
      if (discoveries++ % 2 === 0) {
        animalFrom = animal; animal = (animal + 1) % ANIMALS.length; animalT = 0;
        setTimeout(function () { announce(ANIMALS[animal].say); }, 1500);
      } else {
        skyFrom = sky; sky = (sky + 1) % SKIES.length; skyT = 0;
        setTimeout(function () { announce(SKIES[sky].say); }, 1500);
      }
    }

    /* ---- Sounds: wind, plus music box or sleigh bells ---- */
    function snowSound() { return settings.snowSound || "wind"; }
    function startWind() {
      if (wind || !audioReady() || !noise()) return;
      var src = actx.createBufferSource();
      src.buffer = noiseBuf; src.loop = true;
      var body = actx.createBiquadFilter(); body.type = "bandpass"; body.Q.value = 0.9; body.frequency.value = 420;
      var howl = actx.createBiquadFilter(); howl.type = "bandpass"; howl.Q.value = 7; howl.frequency.value = 760;
      var soft = actx.createBiquadFilter(); soft.type = "lowpass"; soft.frequency.value = 1800;
      var howlG = actx.createGain(), out = actx.createGain();
      howlG.gain.value = 0.3; out.gain.value = 0.0001;
      src.connect(body); body.connect(soft);
      src.connect(howl); howl.connect(howlG); howlG.connect(soft);
      soft.connect(out); out.connect(master);
      src.start();
      wind = { src: src, body: body, howl: howl, howlG: howlG, out: out, drift: 0, driftV: 0 };
    }
    // level 0 is a soft whisper of wind, level 1 is a howling blizzard
    function setWind(level, dt) {
      if (!wind) return;
      var t = actx.currentTime;
      wind.driftV = (wind.driftV + rand(-1, 1) * dt * 2) * (1 - dt * 0.8);
      wind.drift = clamp(wind.drift + wind.driftV * dt, -1, 1);
      var f = (calm() ? 260 : 300) + (calm() ? 500 : 1000) * level + 120 * wind.drift * (0.4 + level);
      wind.body.frequency.setTargetAtTime(f, t, 0.2);
      wind.howl.frequency.setTargetAtTime(f * 1.8 + 150 * wind.drift * level, t, 0.25);
      wind.howlG.gain.setTargetAtTime(0.15 + 0.9 * level, t, 0.2); // the whistle and howl come in as it gets stormy
      var g = 0.012 + (calm() ? 0.25 : 0.6) * Math.pow(level, 1.3);
      wind.out.gain.setTargetAtTime(Math.max(0.0001, g * (1 + 0.3 * wind.drift)), t, 0.18);
    }
    function stopWind() {
      if (!wind) return;
      var w = wind; wind = null;
      try { w.out.gain.setTargetAtTime(0.0001, actx.currentTime, 0.15); w.src.stop(actx.currentTime + 0.8); } catch (e) { /* ignore */ }
    }
    // A small sleigh bell: a few bright, quickly fading metal tones.
    function jingle(gain, count) {
      if (!audioReady()) return;
      gain *= calm() ? 0.6 : 1;
      for (var n = 0; n < (count || 1); n++) {
        var t = actx.currentTime + n * 0.09 + rand(0, 0.03);
        for (var i = 0; i < 4; i++) {
          var o = actx.createOscillator(), g = actx.createGain(), f = rand(2600, 5200), d = rand(0.12, 0.3);
          o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(gain / 4, t + 0.003);
          g.gain.exponentialRampToValueAtTime(0.0001, t + d);
          o.connect(g); g.connect(master); g.connect(echo);
          o.start(t); o.stop(t + d + 0.02);
          t += rand(0.005, 0.02);
        }
      }
    }
    var tune = 9;
    function playBeat(dt) {
      var mode = snowSound();
      if (mode === "wind" || !audioReady()) return;
      beat -= dt;
      if (beat > 0) return;
      if (mode === "music") { // a gentle music box that wanders up and down the scale
        beat = calm() ? 1.6 : 1.15;
        tune = clamp(tune + pick([-2, -1, -1, 1, 1, 2, 0]), 6, 15);
        chime(noteFreq(tune), { gain: 0.06, decay: 2.4, delay: 0.001 });
        if (Math.random() < 0.3) chime(noteFreq(tune - 5), { gain: 0.035, decay: 2.8, delay: 0.3 });
      } else { // sleigh bells ring faster in a heavier snowfall
        beat = (calm() ? 1.1 : 0.75) - 0.35 * storm;
        jingle(0.012 + 0.03 * storm, 1);
      }
    }

    /* ---- Drawing the world ---- */
    function drawSky(g, s, a, time) {
      g.globalAlpha = a;
      var gr = g.createLinearGradient(0, 0, 0, horizon() + H * 0.1);
      gr.addColorStop(0, s.top); gr.addColorStop(0.55, s.mid); gr.addColorStop(1, s.low);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      if (s.stars) {
        g.fillStyle = "#fff";
        stars.forEach(function (st) {
          g.globalAlpha = a * s.stars * (0.4 + 0.25 * Math.sin(st.p + time * 0.5));
          g.fillRect(st.x * W, st.y * horizon(), st.s, st.s);
        });
      }
      if (s.aurora) { // slow curtains of light, never flashing
        g.globalCompositeOperation = "lighter";
        [[150, 0.0, 0.18], [175, 1.7, 0.26], [280, 3.1, 0.34]].forEach(function (c) {
          var base = H * c[2], amp = H * 0.05, al = calm() ? 0.12 : 0.2, top = [], bot = [];
          for (var x = -10; x <= W + 30; x += 20) {
            var y = base + Math.sin(x / W * 4 + time * 0.25 + c[1]) * amp + Math.sin(x / W * 9 - time * 0.17) * amp * 0.4;
            var h = H * (0.12 + 0.05 * Math.sin(x / W * 6 + time * 0.3 + c[1]));
            top.push([x, y - h]); bot.push([x, y + h * 0.15]);
          }
          var gr2 = g.createLinearGradient(0, base - amp * 1.4 - H * 0.17, 0, base + amp * 1.4 + H * 0.03);
          gr2.addColorStop(0, "hsla(" + c[0] + ",80%,60%,0)");
          gr2.addColorStop(0.42, "hsla(" + c[0] + ",80%,60%,0)");
          gr2.addColorStop(0.8, "hsla(" + c[0] + ",80%,62%," + al + ")");
          gr2.addColorStop(1, "hsla(" + c[0] + ",80%,62%,0)");
          g.globalAlpha = a; g.fillStyle = gr2;
          g.beginPath(); g.moveTo(top[0][0], top[0][1]);
          top.forEach(function (pt) { g.lineTo(pt[0], pt[1]); });
          for (var j = bot.length - 1; j >= 0; j--) g.lineTo(bot[j][0], bot[j][1]);
          g.closePath(); g.fill();
        });
        g.globalCompositeOperation = "source-over";
      }
      // far hills
      g.globalAlpha = a; g.fillStyle = s.far;
      g.beginPath(); g.moveTo(0, H);
      for (var x = 0; x <= W + 20; x += 20) g.lineTo(x, horizon() - Math.sin(x / W * 3.2 + 1) * H * 0.04 - Math.sin(x / W * 8) * H * 0.012);
      g.lineTo(W, H); g.closePath(); g.fill();
      g.globalAlpha = 1;
    }
    function drawGround(g, s, a) {
      g.globalAlpha = a;
      var gr = g.createLinearGradient(0, H * 0.72, 0, H);
      gr.addColorStop(0, s.hill[0]); gr.addColorStop(1, s.hill[1]);
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(0, H);
      for (var x = 0; x <= W + 20; x += 20) g.lineTo(x, groundY(x));
      g.lineTo(W, H); g.closePath(); g.fill();
      g.globalAlpha = 1;
    }
    function drawTree(g, x, y, h) {
      g.fillStyle = "#4b2e1e"; g.fillRect(x - h * 0.05, y - h * 0.12, h * 0.1, h * 0.14);
      for (var k = 0; k < 3; k++) {
        var ty = y - h * 0.1 - k * h * 0.27, tw = h * (0.4 - k * 0.09);
        g.fillStyle = calm() ? "#2f5e4a" : "#1d6a44";
        g.beginPath(); g.moveTo(x - tw, ty); g.lineTo(x + tw, ty); g.lineTo(x, ty - h * 0.42); g.closePath(); g.fill();
        g.fillStyle = "rgba(240,247,255,0.95)";
        g.beginPath(); g.moveTo(x - tw * 0.9, ty); g.quadraticCurveTo(x - tw * 0.3, ty - h * 0.06, x, ty - h * 0.02); g.quadraticCurveTo(x + tw * 0.3, ty - h * 0.07, x + tw * 0.9, ty); g.lineTo(x + tw * 0.75, ty - h * 0.04); g.lineTo(x - tw * 0.75, ty - h * 0.04); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(x - tw * 0.3, ty - h * 0.3); g.lineTo(x + tw * 0.3, ty - h * 0.3); g.lineTo(x, ty - h * 0.42); g.closePath(); g.fill();
      }
    }
    function drawPicture(g, im, x, y, h) { // bottom-centre at x,y
      var w = h * im.naturalWidth / im.naturalHeight;
      g.drawImage(im, x - w / 2, y - h, w, h);
    }
    function drawCabin(g, x, y, h, time) {
      if (ready(cabinImg)) { drawPicture(g, cabinImg, x, y + h * 0.04, h * 1.25); return; }
      var w = h * 1.1;
      g.fillStyle = "#6e3b2c"; g.fillRect(x + w * 0.18, y - h * 1.12, w * 0.14, h * 0.4); // chimney
      g.fillStyle = "#a8553a"; g.fillRect(x - w / 2, y - h * 0.62, w, h * 0.66);
      g.strokeStyle = "rgba(80,35,20,0.35)"; g.lineWidth = Math.max(1, h * 0.015);
      for (var i = 1; i < 5; i++) { g.beginPath(); g.moveTo(x - w / 2, y - h * 0.62 + i * h * 0.13); g.lineTo(x + w / 2, y - h * 0.62 + i * h * 0.13); g.stroke(); }
      g.fillStyle = "#5a2f26";
      g.beginPath(); g.moveTo(x - w * 0.62, y - h * 0.6); g.lineTo(x, y - h * 1.08); g.lineTo(x + w * 0.62, y - h * 0.6); g.closePath(); g.fill();
      g.fillStyle = "#f6faff"; // snow on the roof
      g.beginPath(); g.moveTo(x - w * 0.66, y - h * 0.58); g.lineTo(x, y - h * 1.12); g.lineTo(x + w * 0.66, y - h * 0.58);
      g.quadraticCurveTo(x + w * 0.6, y - h * 0.66, x + w * 0.55, y - h * 0.66); g.lineTo(x, y - h * 1.02); g.lineTo(x - w * 0.55, y - h * 0.66); g.quadraticCurveTo(x - w * 0.6, y - h * 0.66, x - w * 0.66, y - h * 0.58); g.fill();
      var glowA = 0.55 + 0.07 * Math.sin(time * 0.6); // a slow warm glow, never a flicker
      g.globalAlpha = glowA; g.drawImage(glow(40, 90, 62), x - w * 0.42, y - h * 0.58, w * 0.5, w * 0.5); g.globalAlpha = 1;
      g.fillStyle = "#ffd27a"; g.fillRect(x - w * 0.3, y - h * 0.45, w * 0.24, h * 0.2);
      g.strokeStyle = "#5a2f26"; g.lineWidth = Math.max(1, h * 0.025);
      g.strokeRect(x - w * 0.3, y - h * 0.45, w * 0.24, h * 0.2);
      g.beginPath(); g.moveTo(x - w * 0.18, y - h * 0.45); g.lineTo(x - w * 0.18, y - h * 0.25); g.stroke();
      g.fillStyle = "#3b2018"; g.fillRect(x + w * 0.1, y - h * 0.4, w * 0.2, h * 0.44);
    }
    // arm (optional): { side: 1 or -1, tip: [x, y] } moves one stick arm, to take and put on the hat
    function drawSnowman(g, x, y, h, arm) {
      if (ready(snowmanImg)) { drawPicture(g, snowmanImg, x, y + h * 0.03, h * 1.1); return; }
      var r = h * 0.2;
      g.fillStyle = "rgba(60,80,120,0.18)"; g.beginPath(); g.ellipse(x, y + r * 0.1, r * 1.4, r * 0.25, 0, 0, TAU); g.fill();
      g.strokeStyle = "#5a3a22"; g.lineWidth = Math.max(1.5, h * 0.02); g.lineCap = "round";
      var lt = arm && arm.side < 0 ? arm.tip : [x - r * 1.8, y - r * 3.3], rt = arm && arm.side > 0 ? arm.tip : [x + r * 1.7, y - r * 3.4];
      g.beginPath(); g.moveTo(x - r * 0.7, y - r * 2.6); g.lineTo(lt[0], lt[1]); g.moveTo(x + r * 0.7, y - r * 2.6); g.lineTo(rt[0], rt[1]); g.stroke();
      [[0, r * 1.15, r * 1.2], [0, r * 2.85, r * 0.85], [0, r * 4.0, r * 0.6]].forEach(function (c) {
        var gr = g.createRadialGradient(x - c[2] * 0.35, y - c[1] - c[2] * 0.35, c[2] * 0.1, x, y - c[1], c[2]);
        gr.addColorStop(0, "#ffffff"); gr.addColorStop(1, "#cfdcf0");
        g.fillStyle = gr; g.beginPath(); g.arc(x, y - c[1], c[2], 0, TAU); g.fill();
      });
      g.fillStyle = "#c0392b"; g.fillRect(x - r * 0.75, y - r * 3.55, r * 1.5, r * 0.28); g.fillRect(x + r * 0.2, y - r * 3.5, r * 0.3, r * 0.9);
      g.fillStyle = "#1b1f2a";
      g.beginPath(); g.arc(x - r * 0.22, y - r * 4.12, r * 0.08, 0, TAU); g.arc(x + r * 0.22, y - r * 4.12, r * 0.08, 0, TAU); g.fill();
      [2.55, 2.85, 3.15].forEach(function (k) { g.beginPath(); g.arc(x, y - r * k, r * 0.07, 0, TAU); g.fill(); });
      g.fillStyle = "#f08a24"; g.beginPath(); g.moveTo(x, y - r * 3.98); g.lineTo(x + r * 0.7, y - r * 3.9); g.lineTo(x, y - r * 3.82); g.closePath(); g.fill();
    }
    // The visiting animals, drawn standing at x,y and about h tall.
    function drawAnimal(g, a, x, y, h, time, run) { // run: a running step (the fox fetching the hat)
      if (ready(a.img)) { drawPicture(g, a.img, x, y + h * 0.03, h * a.size); return; }
      g.save(); g.translate(x, y); g.scale(h / 100, h / 100);
      var bob = Math.sin(time * 1.2) * 1.2;
      g.fillStyle = "rgba(60,80,120,0.18)"; g.beginPath(); g.ellipse(0, 2, 40, 6, 0, 0, TAU); g.fill();
      if (a.kind === "bunny") {
        g.fillStyle = "#f4f4f6";
        g.beginPath(); g.ellipse(-6, -20, 24, 20, 0, 0, TAU); g.fill();
        g.beginPath(); g.arc(14, -40 + bob, 14, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(8, -68 + bob, 5, 18, -0.15, 0, TAU); g.ellipse(19, -66 + bob, 5, 18, 0.2, 0, TAU); g.fill();
        g.fillStyle = "#f2a7bb"; g.beginPath(); g.ellipse(8, -68 + bob, 2.2, 12, -0.15, 0, TAU); g.ellipse(19, -66 + bob, 2.2, 12, 0.2, 0, TAU); g.fill();
        g.fillStyle = "#fff"; g.beginPath(); g.arc(-29, -22, 7, 0, TAU); g.fill();
        g.fillStyle = "#1b1f2a"; g.beginPath(); g.arc(20, -43 + bob, 2.4, 0, TAU); g.fill();
        g.fillStyle = "#e57a96"; g.beginPath(); g.arc(27, -38 + bob, 2, 0, TAU); g.fill();
      } else if (a.kind === "fox") {
        g.fillStyle = "#e0702a";
        g.beginPath(); g.moveTo(-28, -28); g.quadraticCurveTo(-62, -40, -60, -10); g.quadraticCurveTo(-48, -2, -28, -18); g.fill(); // tail
        g.fillStyle = "#fff"; g.beginPath(); g.arc(-58, -14, 6, 0, TAU); g.fill();
        g.fillStyle = "#3a2418"; [-20, -8, 12, 22].forEach(function (lx, li) {
          if (run == null) { g.fillRect(lx, -16, 5, 16); return; }
          g.save(); g.translate(lx + 2.5, -16); g.rotate(Math.sin(run + (li % 2) * Math.PI) * 0.6); g.fillRect(-2.5, 0, 5, 16); g.restore();
        });
        g.fillStyle = "#e0702a"; g.beginPath(); g.ellipse(0, -26, 32, 14, 0, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(22, -40 + bob); g.lineTo(26, -62 + bob); g.lineTo(34, -46 + bob); g.lineTo(42, -60 + bob); g.lineTo(44, -40 + bob); g.closePath(); g.fill();
        g.beginPath(); g.arc(34, -40 + bob, 12, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(40, -44 + bob); g.lineTo(56, -36 + bob); g.lineTo(40, -32 + bob); g.closePath(); g.fill();
        g.fillStyle = "#fff"; g.beginPath(); g.moveTo(30, -34 + bob); g.lineTo(56, -36 + bob); g.lineTo(38, -28 + bob); g.closePath(); g.fill();
        g.beginPath(); g.ellipse(18, -22, 9, 7, 0, 0, TAU); g.fill();
        g.fillStyle = "#1b1f2a"; g.beginPath(); g.arc(38, -43 + bob, 2.2, 0, TAU); g.arc(56, -36 + bob, 2.4, 0, TAU); g.fill();
      } else if (a.kind === "owl") {
        g.fillStyle = "#6b4a2e"; g.fillRect(-16, -14, 32, 14); // stump
        g.fillStyle = "#f4f8ff"; g.fillRect(-18, -16, 36, 4);
        g.fillStyle = "#8a6440"; g.beginPath(); g.ellipse(0, -46 + bob, 22, 30, 0, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(-18, -66 + bob); g.lineTo(-14, -80 + bob); g.lineTo(-6, -70 + bob); g.moveTo(18, -66 + bob); g.lineTo(14, -80 + bob); g.lineTo(6, -70 + bob); g.fill();
        g.fillStyle = "#e8d7bd"; g.beginPath(); g.ellipse(0, -36 + bob, 13, 16, 0, 0, TAU); g.fill();
        var blink = (time % 6) < 0.18 ? 0.15 : 1; // a slow, occasional blink
        [-9, 9].forEach(function (ex) {
          g.fillStyle = "#f5e6c8"; g.beginPath(); g.arc(ex, -60 + bob, 9, 0, TAU); g.fill();
          g.fillStyle = "#f2b630"; g.beginPath(); g.ellipse(ex, -60 + bob, 6, 6 * blink, 0, 0, TAU); g.fill();
          g.fillStyle = "#1b1f2a"; g.beginPath(); g.ellipse(ex, -60 + bob, 3, 3 * blink, 0, 0, TAU); g.fill();
        });
        g.fillStyle = "#e08a1e"; g.beginPath(); g.moveTo(-3, -53 + bob); g.lineTo(3, -53 + bob); g.lineTo(0, -46 + bob); g.closePath(); g.fill();
      } else { // reindeer
        g.strokeStyle = "#6a4528"; g.lineWidth = 3; g.lineCap = "round";
        g.beginPath(); // antlers
        g.moveTo(30, -66 + bob); g.lineTo(22, -92 + bob); g.moveTo(25, -82 + bob); g.lineTo(14, -88 + bob); g.moveTo(23, -88 + bob); g.lineTo(28, -98 + bob);
        g.moveTo(36, -66 + bob); g.lineTo(42, -92 + bob); g.moveTo(40, -82 + bob); g.lineTo(50, -88 + bob); g.moveTo(41, -88 + bob); g.lineTo(37, -98 + bob);
        g.stroke();
        g.fillStyle = "#5b3a22"; [-24, -12, 14, 26].forEach(function (lx) { g.fillRect(lx, -24, 5, 24); });
        g.fillStyle = "#8a5a34"; g.beginPath(); g.ellipse(0, -32, 36, 16, 0, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(18, -40); g.lineTo(26, -62 + bob); g.lineTo(38, -60 + bob); g.lineTo(34, -36); g.closePath(); g.fill();
        g.beginPath(); g.ellipse(36, -62 + bob, 12, 8, 0.3, 0, TAU); g.fill();
        g.fillStyle = "#efe2cf"; g.beginPath(); g.ellipse(-30, -38, 6, 5, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(26, -44, 6, 9, 0, 0, TAU); g.fill();
        g.fillStyle = "#1b1f2a"; g.beginPath(); g.arc(36, -65 + bob, 2.2, 0, TAU); g.arc(47, -58 + bob, 3, 0, TAU); g.fill();
      }
      g.restore();
    }
    function drawFlakes(g, near, time) {
      var s = S() * sizeK(), lightSky = SKIES[sky].light && skyT > 0.5;
      for (var i = 0; i < flakes.length; i++) {
        var f = flakes[i];
        if ((f.z >= 0.55) !== near) continue;
        var sz = (3 + 15 * f.z * f.z) * s, stretch = 1 + Math.min(2.2, Math.abs(f.vx) / (260 * S())); // blown snow streaks sideways
        var a = (0.45 + 0.55 * f.z) * (f.fade === undefined ? 1 : f.fade);
        if (lightSky) { g.globalAlpha = a * 0.6; g.drawImage(shade, f.x - sz * 0.75, f.y - sz * 0.75, sz * 1.5, sz * 1.5); }
        g.globalAlpha = a;
        g.drawImage(sprite, f.x - sz * stretch / 2, f.y - sz / 2, sz * stretch, sz);
        if (f.spark && stretch < 1.5) { // a gentle twinkle (several seconds per cycle)
          var tw = Math.max(0, Math.sin(f.ph * 0.6 + time * 0.8));
          if (tw > 0.2) {
            var L = sz * 0.9 * tw;
            g.globalAlpha = 0.7 * tw * a;
            g.fillStyle = "#fff";
            g.fillRect(f.x - L, f.y - 0.6 * s, L * 2, 1.2 * s);
            g.fillRect(f.x - 0.6 * s, f.y - L, 1.2 * s, L * 2);
          }
        }
      }
      g.globalAlpha = 1;
    }
    function drawGlass(g) { // hints of the curved glass all around you
      var cx = W / 2, cy = H * 0.48, R = Math.hypot(W, H) * 0.5;
      var v = g.createRadialGradient(cx, cy, R * 0.55, cx, cy, R);
      v.addColorStop(0, "rgba(160,200,255,0)");
      v.addColorStop(0.75, "rgba(120,170,230,0.10)");
      v.addColorStop(1, "rgba(10,20,50,0.55)");
      g.fillStyle = v; g.fillRect(0, 0, W, H);
      g.lineCap = "round";
      [[1.08, 1.3, 0.09, 0.05], [1.12, 1.2, 0.12, 0.014], [1.74, 1.84, 0.06, 0.03]].forEach(function (h) {
        g.strokeStyle = "rgba(255,255,255," + h[2] + ")";
        g.lineWidth = Math.max(3, Math.min(W, H) * h[3]);
        g.beginPath(); g.ellipse(cx, cy, W * 0.47, H * 0.46, 0, Math.PI * h[0], Math.PI * h[1]); g.stroke();
      });
    }
    function scene() { // where things stand, so the animal never stands on the cabin
      return { cabin: W * 0.66, snowman: W * 0.24, animal: W * 0.44 };
    }
    /* ---- The snowman's top hat: it wobbles while you hold, blows off after
       3 seconds, and the fox brings it back ---- */
    var hat = { state: "on", t: 0, x: 0, y: 0, ang: 0, k: 0 }, fox = null;
    var FOX = ANIMALS.filter(function (a) { return a.kind === "fox"; })[0] || { kind: "fox", img: null, size: 1 };
    function sm() { // where the snowman is, and the size of his head
      var u = Math.min(W, H), h = u * 0.28, r = h * 0.2, x = scene().snowman, y = groundY(x) + u * 0.02;
      if (ready(snowmanImg)) return { x: x, y: y, r: r, headX: x, headY: y - h * 1.02, headR: r * 0.6 };
      return { x: x, y: y, r: r, headX: x, headY: y - r * 4.0, headR: r * 0.6 };
    }
    function onHead() { var m = sm(); return { x: m.headX + m.headR * 0.05, y: m.headY - m.headR * 0.72, s: m.headR }; }
    function foxH() { return Math.min(W, H) * 0.2; }
    function mouth() { var hh = foxH(); return { x: fox.x + fox.face * 0.56 * hh, y: groundY(fox.x) + Math.min(W, H) * 0.02 - 0.34 * hh }; }
    function armBase(side) { var m = sm(); return [m.x + side * m.r * 0.7, m.y - m.r * 2.6]; }
    function armTip(side, ang) { var b = armBase(side), L = sm().r * 1.3; return [b[0] + Math.cos(ang) * L, b[1] + Math.sin(ang) * L]; }
    function restAng(side) { return Math.atan2(-0.75, side * 1); }
    function windDir() { return gust * 90 + Math.pow(storm, 2) * 520 >= 0 ? 1 : -1; }
    function liftHat(x, y) {
      hat.state = "fly"; hat.t = 0; hat.x = x; hat.y = y; hat.ph = rand(0, TAU);
      hat.vx = windDir() * W * 0.5; hat.vy = -H * 0.8; hat.spin = windDir() * 5;
    }
    function updateHat(dt, holding) {
      var m = sm(), spd = W * (calm() ? 0.2 : 0.28);
      hat.t += dt;
      hat.big = (hat.big || 1) + ((hat.state === "fly" ? (calm() ? 1.5 : 1.8) : 1) - (hat.big || 1)) * Math.min(1, dt * 2.5); // bigger while flying, easy to follow
      if (hat.state === "on") {
        var k = holding ? Math.min(1, heldFor / 3) : 0;
        hat.k += (k - hat.k) * Math.min(1, dt * 5);
        if (holding && heldFor >= 3) { // whoosh, off it goes
          var o = onHead();
          liftHat(o.x, o.y);
          hat.k = 0;
          announce("Whoosh! The wind blew the snowman's hat off!");
        }
      } else if (hat.state === "fly") { // while you hold, the hat flies all around the screen
        if (!holding) { hat.state = "fall"; hat.t = 0; announceSometimes("The hat is falling down."); }
        else {
          var tt = hat.t, ux = W * (0.5 + 0.4 * Math.sin(tt * 0.83 + hat.ph) * Math.cos(tt * 0.37)),
              uy = H * (0.36 + 0.24 * Math.sin(tt * 1.21 + hat.ph * 2));
          var push = windDir() * W * 0.08 * storm;
          hat.vx += ((ux + push - hat.x) * 2.2 - hat.vx) * dt * 1.6;
          hat.vy += ((uy - hat.y) * 2.2 - hat.vy) * dt * 1.6;
          hat.x = clamp(hat.x + hat.vx * dt, W * 0.06, W * 0.94);
          hat.y = clamp(hat.y + hat.vy * dt, H * 0.08, H * 0.72);
          hat.spin += (Math.sin(tt * 0.7 + hat.ph) * 6 - hat.spin) * dt;
          hat.ang += hat.spin * dt;
        }
      } else if (hat.state === "fall") { // let go: it drops to the ground right where it is
        hat.vy += H * 1.4 * dt;
        hat.vx *= Math.exp(-dt * 2);
        hat.x = clamp(hat.x + hat.vx * dt + Math.sin(hat.t * 6) * W * 0.04 * dt, W * 0.05, W * 0.95);
        hat.y += hat.vy * dt;
        var rest = hat.vx >= 0 ? 1.45 : -1.45; // lands lying on its side
        hat.spin *= Math.exp(-dt * 3);
        hat.ang += hat.spin * dt;
        var yLand = groundY(hat.x) + Math.min(W, H) * 0.012 - m.headR * 0.75;
        if (hat.y >= yLand) {
          hat.state = "ground"; hat.t = 0; hat.y = yLand; hat.vx = hat.vy = 0;
          hat.ang = rest;
        }
      } else if (hat.state === "ground") {
        if (holding && heldFor > 0.4) { liftHat(hat.x, hat.y); announceSometimes("Whoosh! Up goes the hat again!"); }
        else if (hat.t > 1 && !holding && storm < 0.15 && !fox) { // once the snow has died down, the fox comes to help
          var pos = scene(), visiting = animal >= 0 && ANIMALS[animal].kind === "fox" && animalT >= 1;
          var edge = hat.x > m.x ? W * 1.1 : -W * 0.1; // comes in from the far side, never through the snowman
          var home = visiting ? pos.animal : edge;
          fox = { x: home, home: home, hideVisitor: visiting, face: hat.x > home ? 1 : -1, run: 0 };
          hat.state = "fetch"; hat.t = 0;
          announce("Here comes the fox to get the hat.");
        }
      } else if (hat.state === "fetch" && holding && heldFor > 0.4) { // blown away again before the fox gets there
        liftHat(hat.x, hat.y);
        fox.leaving = true;
        announceSometimes("Whoosh! Up goes the hat again!");
      }
      if (!fox) return;
      var hh = foxH();
      function goTo(tx) {
        var d = tx - fox.x;
        if (Math.abs(d) < 2) { fox.x = tx; fox.run = 0; return true; }
        fox.face = d > 0 ? 1 : -1;
        fox.x += fox.face * Math.min(Math.abs(d), spd * dt);
        fox.run += dt * 14;
        return false;
      }
      if (hat.state === "fetch") { // run to the hat, nose first
        if (goTo(hat.x - (hat.x > fox.x ? 1 : -1) * 0.5 * hh)) { hat.state = "pickup"; hat.t = 0; fox.face = hat.x > fox.x ? 1 : -1; hat.gx = hat.x; hat.gy = hat.y; hat.gang = hat.ang; }
      } else if (hat.state === "pickup") {
        var q = Math.min(1, hat.t / 0.6), mo = mouth();
        hat.x = hat.gx + (mo.x - hat.gx) * q; hat.y = hat.gy + (mo.y + m.headR * 0.4 - hat.gy) * q; hat.ang = hat.gang + (fox.face * 0.35 - hat.gang) * q;
        if (q >= 1) { hat.state = "carry"; hat.t = 0; hat.side = fox.x >= m.x ? 1 : -1; }
      } else if (hat.state === "carry") { // bring it to the snowman's hand
        var reach = armTip(hat.side, Math.atan2(0.9, hat.side * 0.45));
        var target = reach[0] + hat.side * 0.66 * hh;
        var done = goTo(target);
        var mo2 = mouth(); hat.x = mo2.x; hat.y = mo2.y + m.headR * 0.4; hat.ang = fox.face * 0.35;
        if (done) { fox.face = -hat.side; hat.state = "give"; hat.t = 0; hat.hx = hat.x; hat.hy = hat.y; }
      } else if (hat.state === "give") { // the snowman reaches down and takes it
        var q2 = easeOut(Math.min(1, hat.t / 0.9)), a0 = restAng(hat.side), a1 = Math.atan2(0.9, hat.side * 0.45);
        hat.armAng = a0 + (a1 - a0) * q2;
        var tp = armTip(hat.side, hat.armAng); hat.x = hat.hx + (tp[0] - hat.hx) * q2; hat.y = hat.hy + (tp[1] - hat.hy) * q2; hat.ang = fox.face * 0.35 * (1 - q2);
        if (q2 >= 1) { hat.state = "place"; hat.t = 0; announceSometimes("The fox gave the hat back."); }
      } else if (hat.state === "place") { // and puts it back on
        var q3 = Math.min(1, hat.t / 1.6), b0 = Math.atan2(0.9, hat.side * 0.45), b1 = Math.atan2(-1, hat.side * 0.15);
        hat.armAng = b0 + (b1 - b0) * easeOut(Math.min(1, q3 / 0.6));
        var tip = armTip(hat.side, hat.armAng), o2 = onHead();
        if (q3 < 0.6) { hat.x = tip[0]; hat.y = tip[1]; hat.ang = 0; }
        else { var w = easeOut((q3 - 0.6) / 0.4); hat.x = tip[0] + (o2.x - tip[0]) * w; hat.y = tip[1] + (o2.y - tip[1]) * w; hat.ang = 0; }
        if (q3 >= 1) { hat.state = "on"; hat.t = 0; hat.armAng = null; hat.k = 0; fox.leaving = true; announce("The snowman's hat is back on."); }
      }
      if (fox && fox.leaving) {
        if (goTo(fox.home)) { fox = null; }
      }
    }
    function drawHat(g, x, y, sz, ang) { // a classic black top hat; x,y is the middle of the brim
      g.save(); g.translate(x, y); g.rotate(ang);
      var bw = sz * 1.25, cw = sz * 0.78, ch = sz * 1.55;
      g.fillStyle = "#15171d";
      g.beginPath(); g.moveTo(-cw * 0.92, 0); g.lineTo(-cw, -ch); g.quadraticCurveTo(0, -ch - sz * 0.12, cw, -ch); g.lineTo(cw * 0.92, 0); g.closePath(); g.fill();
      g.fillStyle = "#2c3140"; // a soft shine down one side
      g.fillRect(-cw * 0.7, -ch * 0.92, cw * 0.22, ch * 0.75);
      g.fillStyle = "#8e1f2a"; // the band
      g.beginPath(); g.moveTo(-cw * 0.93, -sz * 0.08); g.lineTo(-cw * 0.95, -sz * 0.36); g.lineTo(cw * 0.95, -sz * 0.36); g.lineTo(cw * 0.93, -sz * 0.08); g.closePath(); g.fill();
      g.fillStyle = "#15171d";
      g.beginPath(); g.ellipse(0, 0, bw, sz * 0.17, 0, 0, TAU); g.fill();
      g.restore();
    }
    function drawHatNow(g, time) {
      var o;
      if (hat.state === "on") {
        o = onHead();
        var k = hat.k, dir = windDir();
        var wob = Math.sin(time * (7 + 9 * k)) * 0.28 * k + dir * 0.3 * k; // wobbles and leans into the wind
        var lift = Math.abs(Math.sin(time * (9 + 8 * k))) * o.s * 0.45 * k;
        hat.ang = wob;
        drawHat(g, o.x + dir * o.s * 0.25 * k, o.y - lift, o.s, wob);
      } else {
        drawHat(g, hat.x, hat.y, sm().headR * (hat.big || 1), hat.ang);
      }
    }
    function drawFox(g, time) {
      if (!fox) return;
      var hh = foxH(), y = groundY(fox.x) + Math.min(W, H) * 0.02;
      g.save(); g.translate(fox.x, 0); g.scale(fox.face, 1);
      drawAnimal(g, FOX, 0, y, hh, time, fox.run ? fox.run : null);
      g.restore();
    }


    return {
      start: function () {
        makeSprites();
        flakes = []; stars = []; trees = [];
        for (var i = 0; i < 90; i++) stars.push({ x: Math.random(), y: Math.random() * 0.9, s: rand(1, 2.2), p: rand(0, TAU) });
        storm = 0.12; gust = 0.4;
        for (i = 0; i < target(); i++) flakes.push(newFlake(false));
        t0 = 0;
      },
      stop: function () { stopWind(); held = {}; },
      holdExtra: 12, // holding builds the snow, so going back to the menu needs a longer hold here
      hold: function (on) { if (on) held.key = 1; else delete held.key; },
      down: function (id, x, y) { lastDrag[id] = { x: x, y: y }; held["p" + id] = 1; shake(0.7, x < W / 2 ? 1 : -1); },
      move: function (id, x, y) { // dragging stirs the snow near the finger
        var q = lastDrag[id];
        if (!q) return;
        lastDrag[id] = { x: x, y: y };
        var dx = clamp(x - q.x, -60, 60), dy = clamp(y - q.y, -60, 60), r = 170 * S() * sizeK();
        if (Math.abs(dx) + Math.abs(dy) < 1) return;
        var k = calm() ? 5 : 8;
        flakes.forEach(function (f) {
          var ex = f.x - x, ey = f.y - y, d2 = ex * ex + ey * ey;
          if (d2 > r * r) return;
          var w = 1 - d2 / (r * r);
          f.vx += dx * k * w; f.vy += dy * k * w;
        });
        gust = clamp(gust + dx * 0.004, -2.5, 2.5);
      },
      up: function (id) { delete lastDrag[id]; delete held["p" + id]; },
      dwell: function (x) { shake(0.8, x < W / 2 ? 1 : -1); },
      press: function () { shake(0.7, Math.random() < 0.5 ? -1 : 1); },
      update: function (dt) {
        startWind();
        t0 += dt;
        var s = S();
        // Holding a touch, key or switch makes the snow heavier and heavier.
        // Letting go, it calms down again to a light snowfall.
        var holding = Object.keys(held).length > 0;
        if (holding) {
          heldFor += dt;
          storm = Math.min(cap(), storm + (calm() ? 0.2 : 0.33) * dt); // about 3 seconds to a full blizzard
          gust = clamp(gust + Math.sin(heldFor * 0.7) * dt * 0.8, -2.5, 2.5); // the wind swirls around while you hold
          if (heldFor > 1.5 && storm >= cap() - 0.02) announceSometimes(calm() ? "Lots of snow." : "A blizzard!");
        } else {
          heldFor = 0;
          storm += (0.06 - storm) * dt * 0.7; // calms down quickly once you let go
        }
        updateHat(dt, holding);
        if (storm > 0.5) wasStormy = true;
        if (wasStormy && storm < 0.25) { wasStormy = false; announceSometimes("The snow is settling."); }
        gust *= Math.exp(-dt * 0.7);
        if (skyT < 1) skyT = Math.min(1, skyT + dt / 3);
        if (animalT < 1) animalT = Math.min(1, animalT + dt / 2.5);
        var swirl = storm * storm;
        for (var i = flakes.length - 1; i >= 0; i--) {
          var f = flakes[i];
          f.ph += dt;
          var fall = (20 + 48 * f.z) * s * (1 - 0.35 * swirl);
          var blow = Math.pow(storm, 2) * (calm() ? 220 : 520) * (0.75 + 0.25 * Math.sin(t0 * 0.4)); // the blizzard wind blows sideways
          var tx = (gust * 90 + blow) * s * f.z + Math.sin(f.ph * 0.9) * (8 + 14 * f.z) * s
                 + Math.sin(f.y * 0.012 + t0 * 0.7 + f.ph * 0.2) * swirl * 140 * s * f.z;
          var ty = fall + Math.cos(f.x * 0.009 + t0 * 0.5) * swirl * 70 * s * f.z;
          f.vx += (tx - f.vx) * dt * 1.3;
          f.vy += (ty - f.vy) * dt * 1.3;
          f.x += f.vx * dt; f.y += f.vy * dt;
          if (f.x < -20) f.x += W + 40; else if (f.x > W + 20) f.x -= W + 40;
          if (f.y < -80) { f.y = -80; f.vy = Math.abs(f.vy) * 0.3; }
          if (f.fade !== undefined) { f.fade -= dt / 0.9; if (f.fade <= 0) { flakes.splice(i, 1); continue; } }
          if (f.y > H + 20) { // reached the ground: fall again from the top, if the snow is still busy
            if (flakes.length > target()) flakes.splice(i, 1);
            else { var n = newFlake(true); flakes[i] = n; }
          }
        }
        // after letting go, extra snow gently fades away
        var fading = 0;
        for (var m = 0; m < flakes.length; m++) if (flakes[m].fade !== undefined) fading++;
        var toFade = Math.ceil((flakes.length - fading - target()) * dt * 2.5);
        for (m = 0; m < flakes.length && toFade > 0; m++) {
          var fm = flakes[(m * 7919 + Math.floor(t0 * 60)) % flakes.length];
          if (fm.fade === undefined) { fm.fade = 1; toFade--; }
        }
        // while held, new snow appears all over (it swirls in); otherwise it falls in from the top
        var add = holding ? 40 : 1;
        for (var n = 0; n < add && flakes.length < target(); n++) if (Math.random() < 0.6) flakes.push(newFlake(!holding));
        setWind(clamp(storm + Math.abs(gust) * 0.08, 0, 1), dt);
        playBeat(dt);
      },
      draw: function (g, time) {
        var a = SKIES[skyFrom], b = SKIES[sky];
        drawSky(g, a, 1, time);
        if (skyT < 1 || skyFrom !== sky) drawSky(g, b, easeOut(skyT), time);
        drawFlakes(g, false, time); // far snow, behind everything
        var pos = scene(), u = Math.min(W, H);
        // trees along the back
        [[0.06, 0.26], [0.13, 0.19], [0.86, 0.24], [0.94, 0.3], [0.38, 0.13]].forEach(function (t) { drawTree(g, W * t[0], groundY(W * t[0]) - H * 0.04, u * t[1]); });
        drawGround(g, a, 1);
        if (skyT < 1 || skyFrom !== sky) drawGround(g, b, easeOut(skyT));
        drawCabin(g, pos.cabin, groundY(pos.cabin) + u * 0.01, u * 0.24, time);
        var arm = hat.armAng != null ? { side: hat.side, tip: armTip(hat.side, hat.armAng) } : null;
        drawSnowman(g, pos.snowman, groundY(pos.snowman) + u * 0.02, u * 0.28, arm);
        if (hat.state === "on") drawHatNow(g, time);
        var ah = u * 0.2, hideFox = fox && fox.hideVisitor;
        if (animalFrom >= 0 && animalT < 1) { g.globalAlpha = 1 - animalT; drawAnimal(g, ANIMALS[animalFrom], pos.animal, groundY(pos.animal) + u * 0.02, ah, time); }
        if (animal >= 0 && !(hideFox && ANIMALS[animal].kind === "fox")) { g.globalAlpha = easeOut(animalT); drawAnimal(g, ANIMALS[animal], pos.animal, groundY(pos.animal) + u * 0.02, ah, time); }
        g.globalAlpha = 1;
        drawFox(g, time);
        var airborne = hat.state === "fly" || hat.state === "fall";
        if (hat.state !== "on" && !airborne) drawHatNow(g, time); // in the snow, or carried in the fox's mouth
        drawFlakes(g, true, time); // near snow, in front
        if (storm > 0.25) { // a white-out haze in a blizzard, thicker near the ground
          var hz = Math.pow((storm - 0.25) / 0.75, 1.4) * (calm() ? 0.25 : 0.5);
          var hg = g.createLinearGradient(0, 0, 0, H);
          hg.addColorStop(0, "rgba(228,236,248," + (hz * 0.6).toFixed(3) + ")");
          hg.addColorStop(1, "rgba(238,244,252," + hz.toFixed(3) + ")");
          g.fillStyle = hg; g.fillRect(0, 0, W, H);
        }
        if (airborne) drawHatNow(g, time); // the flying hat stays clear, in front of the blizzard
        drawGlass(g);
      }
    };
  }

  /* ---------- Bongo Drums: five cause-and-effect drum games ----------
     All the sounds are made by the computer (no sound files to licence).
     The game is chosen in Settings ("Bongo game") or with ?bongo=jam, band, roll, animals or echo. */
  var BONGO_MODES = {
    jam: {
      name: "Bongo Jam", hint: "Tap a drum to play it.",
      label: "Bongo jam. Two big bongo drums. Tap a drum, or press a switch, to play it. Every hit makes a splash of colour."
    },
    band: {
      name: "Play-along band", hint: "Drum and the band plays along. Stop and the music stops.",
      label: "Play-along band. Play the bongos and a band plays music with you. When you stop drumming, the music stops. Drum again to start it again."
    },
    roll: {
      name: "Drumroll", hint: "Hold down for a drumroll. Let go for a big crash!",
      label: "Drumroll. Hold your finger, key or switch down for a drumroll that gets louder and faster. Let go for a big cymbal crash."
    },
    animals: {
      name: "Dancing animals", hint: "Drum to make the animals dance. Drum lots and more come!",
      label: "Dancing animals. Every drum hit makes the animals dance. Keep drumming and more animals come to join the party."
    },
    echo: {
      name: "Echo game", hint: "Listen to the monster, then play it back.",
      label: "Echo game. A friendly monster plays a few drum beats. Then it is your turn to play them back on your drums. Every try gets a cheer."
    }
  };
  if (params.has("bongo") && BONGO_MODES[params.get("bongo")]) settings.bongoMode = params.get("bongo");
  function bongoMode() { return BONGO_MODES[settings.bongoMode] ? settings.bongoMode : "jam"; }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function perfNow() { return performance.now() / 1000; }

  // Sound: a drum bus with a small wooden room around it.
  var bgBus = null, bgVerb = null;
  function bongoBus() {
    if (bgBus || !actx) return bgBus;
    try {
      bgBus = actx.createGain();
      var comp = actx.createDynamicsCompressor();
      comp.threshold.value = -12; comp.knee.value = 6; comp.ratio.value = 5;
      comp.attack.value = 0.002; comp.release.value = 0.15;
      bgBus.connect(comp); comp.connect(master);
      var len = Math.floor(actx.sampleRate * 0.6), ir = actx.createBuffer(2, len, actx.sampleRate);
      for (var c = 0; c < 2; c++) {
        var d = ir.getChannelData(c);
        for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
      }
      var conv = actx.createConvolver(); conv.buffer = ir;
      bgVerb = actx.createGain(); bgVerb.gain.value = 0.22;
      bgVerb.connect(conv); conv.connect(comp);
    } catch (e) { bgBus = null; }
    return bgBus;
  }
  // One bongo hit. side 0 is the big low drum, side 1 the small high drum.
  // edge: hit near the rim for a brighter, ringing sound.
  function bongoHit(side, vel, edge, delay) {
    if (!audioReady() || !bongoBus() || !noise()) return;
    var t = actx.currentTime + (delay || 0), soft = calm();
    vel = clamp(vel, 0.08, 1) * (soft ? 0.55 : 0.9);
    var f = (side ? 540 : 360) * rand(0.985, 1.015) * (edge ? 1.03 : 0.96);
    var dec = (side ? 0.2 : 0.3) * (edge ? 1.15 : 0.8);
    var out = actx.createGain(), tone = actx.createBiquadFilter();
    out.gain.value = vel;
    tone.type = "lowpass"; tone.frequency.value = soft ? 2400 : 7000;
    out.connect(tone); tone.connect(bgBus); tone.connect(bgVerb);
    // the drum skin rings at a few pitches that drop quickly after the hit
    [[1, 0.8, 1], [1.59, 0.3, 0.55], [2.14, 0.16, 0.4], [2.65, 0.07, 0.3]].forEach(function (m) {
      var o = actx.createOscillator(), g = actx.createGain(), ff = f * m[0], d = dec * m[2];
      o.frequency.setValueAtTime(ff * 1.25, t);
      o.frequency.exponentialRampToValueAtTime(ff, t + 0.028);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(m[1], t + (soft ? 0.004 : 0.0015));
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + d + 0.03);
    });
    // the slap of the hand on the skin
    var n = actx.createBufferSource(), bp = actx.createBiquadFilter(), ng = actx.createGain();
    var nd = edge ? 0.05 : 0.03;
    n.buffer = noiseBuf; bp.type = "bandpass"; bp.frequency.value = edge ? 3400 : 1900; bp.Q.value = 0.8;
    ng.gain.setValueAtTime((edge ? 0.6 : 0.35) * (soft ? 0.5 : 1), t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + nd);
    n.connect(bp); bp.connect(ng); ng.connect(out);
    n.start(t, Math.random() * 1.5); n.stop(t + nd + 0.02);
  }
  // A cymbal crash: bright noise plus a shimmer of metal tones. size 0..1
  function cymbalCrash(size) {
    if (!audioReady() || !bongoBus() || !noise()) return;
    var t = actx.currentTime, soft = calm();
    size = clamp(size, 0.25, 1);
    var dur = (soft ? 1.5 : 2.8) * (0.55 + 0.45 * size), peak = (soft ? 0.22 : 0.55) * (0.45 + 0.55 * size);
    var out = actx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(peak, t + 0.004);
    out.gain.exponentialRampToValueAtTime(peak * 0.4, t + 0.15);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var hp = actx.createBiquadFilter(), lp = actx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = soft ? 2600 : 3200;
    lp.type = "lowpass"; lp.frequency.value = soft ? 6500 : 13000;
    hp.connect(lp); lp.connect(out); out.connect(bgBus); out.connect(bgVerb);
    var n = actx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    n.connect(hp); n.start(t, Math.random()); n.stop(t + dur + 0.1);
    var mg = actx.createGain(); mg.gain.value = 0.1; mg.connect(hp);
    [263, 400, 421, 474, 587, 845].forEach(function (fq) {
      var o = actx.createOscillator(); o.type = "square"; o.frequency.value = fq * 1.7;
      o.connect(mg); o.start(t); o.stop(t + dur + 0.1);
    });
  }
  // The play-along band: bass, keys, marimba and shaker.
  function bandNote(kind, freq, t, gain, dest) {
    var o, g, f;
    if (kind === "shaker") {
      if (!noise()) return;
      var n = actx.createBufferSource(); f = actx.createBiquadFilter(); g = actx.createGain();
      n.buffer = noiseBuf; f.type = "highpass"; f.frequency.value = 6500;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      n.connect(f); f.connect(g); g.connect(dest); n.start(t, Math.random() * 1.5); n.stop(t + 0.1);
      return;
    }
    var spec = {
      bass: { types: [["triangle", 1, 1], ["sine", 2, 0.35]], dec: 0.42, att: 0.008, lp: 900 },
      keys: { types: [["triangle", 1, 1], ["sine", 2, 0.2]], dec: 0.28, att: 0.005, lp: 2600 },
      marimba: { types: [["sine", 1, 1], ["sine", 3.98, 0.18]], dec: 0.55, att: 0.003, lp: 5000 }
    }[kind];
    f = actx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = spec.lp; f.connect(dest);
    spec.types.forEach(function (p) {
      o = actx.createOscillator(); g = actx.createGain();
      o.type = p[0]; o.frequency.value = freq * p[1];
      var d = spec.dec / (p[1] > 2 ? 3 : 1);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain * p[2], t + spec.att);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(f); o.start(t); o.stop(t + d + 0.05);
    });
  }
  // A happy "ta-da" for the echo game.
  function cheerSound(big) {
    arpeggio(10, big ? 5 : 4, 0.09, { gain: 0.16, decay: 1.4 });
    if (big) setTimeout(function () { cymbalCrash(0.3); }, 380);
  }

  var DANCERS = [
    { kind: "frog", name: "frog", body: "#4cc46a", belly: "#d3f5b8" },
    { kind: "bear", name: "bear", body: "#a8703f", belly: "#ecd0a6" },
    { kind: "penguin", name: "penguin", body: "#2f3a52", belly: "#f4f6fb" },
    { kind: "cat", name: "cat", body: "#f29a3a", belly: "#ffe4bd" },
    { kind: "bunny", name: "bunny", body: "#efe9f4", belly: "#ffd6e6" }
  ];
  // The echo game: the monster plays one of these, then it is the student's turn.
  // Each beat is [time in beats, drum] where drum 0 is the big drum, 1 the small one.
  var ECHO_PATTERNS = [
    [[0, 0], [1, 1]],
    [[0, 0], [1, 0]],
    [[0, 1], [1, 1]],
    [[0, 0], [1, 1], [2, 0]],
    [[0, 0], [1, 0], [2, 1]],
    [[0, 1], [0.5, 1], [1.5, 0]],
    [[0, 0], [1, 1], [2, 0], [3, 1]],
    [[0, 0], [0.5, 0], [1.5, 1], [2.5, 1]],
    [[0, 1], [1, 0], [1.5, 0], [2.5, 1]],
    [[0, 0], [1, 0], [2, 1], [2.5, 1], [3.5, 0]]
  ];
  // The band: 4 bars of G, Em, C, D, in eighth notes.
  var BAND = {
    bass: [43, 40, 48, 50],
    chords: [[59, 62, 67], [59, 64, 67], [60, 64, 67], [57, 62, 66]],
    tune: [74, 0, 71, 0, 67, 69, 71, 0, 71, 0, 67, 0, 64, 0, 67, 0, 76, 0, 74, 72, 71, 0, 67, 0, 69, 0, 66, 0, 69, 71, 74, 0]
  };

  function Bongos() {
    var mode = bongoMode(), M = BONGO_MODES[mode];
    var drums = [
      { side: 0, hue: 22, x: 0, y: 0, r: 0, k: 1.08, flash: 0, dent: 0, wob: 0, hint: 0, ripples: [] },
      { side: 1, hue: 200, x: 0, y: 0, r: 0, k: 0.9, flash: 0, dent: 0, wob: 0, hint: 0, ripples: [] }
    ];
    var bits = [], glows = [], notes = [], beams = 0, altSide = 0, t0 = 0, hits = [], total = 0;
    var holds = {}, roll = null, pendingAuto = 0, cym = { tilt: 0, v: 0, shine: 0 };
    var band = { on: false, level: 0, until: 0, step: 0, next: 0, out: null, pulse: 0 };
    var dancers = [], fewerFor = 0, nextDancer = 1;
    var echo = { state: "wait", t: 0, idx: 0, pat: null, played: 0, tries: [], last: 0, replays: 0, said: "", jump: 0, jv: 0, arm: [0, 0], mini: [0, 0], happy: 0 };
    function S() { return Math.min(W, H) / 700; }
    function calmK() { return calm() ? 0.5 : 1; }

    /* ---- Layout: the drums sit at the bottom; the top is for the cymbal, animals or monster ---- */
    function layout() {
      var top = mode === "animals" || mode === "echo" ? 0.52 : mode === "roll" ? 0.36 : 0.16;
      var avail = H * (0.97 - top);
      var r = Math.min(W * 0.2, avail / 2.1, H * 0.27) * Math.min(1.15, 0.9 + 0.1 * sizeK());
      var headY = H * 0.95 - r * 1.08 * 1.22;
      drums[0].r = r * drums[0].k; drums[1].r = r * drums[1].k;
      drums[0].x = W / 2 - r * 1.16; drums[1].x = W / 2 + r * 1.16;
      drums[0].y = drums[1].y = headY;
    }
    function whichDrum(x, y) {
      var best = 0, bestD = Infinity;
      drums.forEach(function (d, i) {
        var dx = (x - d.x) / d.r, dy = (y - d.y) / (d.r * 0.42), dd = Math.sqrt(dx * dx + dy * dy);
        if (dd < bestD) { bestD = dd; best = i; }
      });
      if (bestD > 1.25) best = x < W / 2 ? 0 : 1; // anywhere on the screen plays the nearest drum
      return { side: best, d: bestD };
    }

    /* ---- Hitting a drum ---- */
    function hit(side, vel, edge, x, y, quiet) {
      var d = drums[side];
      vel = vel === undefined ? 0.85 : vel;
      if (!quiet) bongoHit(side, vel, edge);
      d.flash = Math.min(1, d.flash + 0.55 * vel); d.dent = 1;
      if (d.ripples.length < 6) d.ripples.push({ x: x === undefined ? 0 : clamp((x - d.x) / d.r, -0.7, 0.7), y: y === undefined ? 0 : clamp((y - d.y) / (d.r * 0.42), -0.7, 0.7), t: 0 });
      splash(side, vel, x, y);
      hits.push(perfNow()); total++;
      if (hits.length > 60) hits.shift();
      onHit(side);
    }
    function splash(side, vel, x, y) {
      var d = drums[side], s = S() * sizeK(), n = Math.round((roll ? 3 : mode === "jam" ? 22 : 12) * calmK() * (0.5 + vel));
      var hx = x === undefined ? d.x : clamp(x, d.x - d.r * 0.8, d.x + d.r * 0.8);
      var hy = y === undefined ? d.y : clamp(y, d.y - d.r * 0.3, d.y + d.r * 0.3);
      var hue = (d.hue + rand(-40, 40) + total * 17) % 360;
      for (var i = 0; i < n && bits.length < 500; i++) {
        var a = rand(-Math.PI * 0.95, -Math.PI * 0.05), sp = rand(180, 620) * s * (calm() ? 0.6 : 1) * (0.6 + 0.5 * vel);
        bits.push({ x: hx, y: hy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(5, 14) * s, hue: (hue + rand(-25, 25) + 360) % 360, life: 0, max: rand(0.8, 1.4) * (calm() ? 1.3 : 1), kind: "drop" });
      }
      if (!roll || roll.n % 3 === 0) glows.push({ x: hx, y: hy - d.r * 0.2, r: d.r * 1.6, hue: hue, a: (roll ? 0.2 : 0.38) * calmK() + 0.1, life: 0, max: 1.1 });
      if (glows.length > 8) glows.shift();
    }
    function confetti(x, y, count, spread) {
      var s = S() * sizeK();
      for (var i = 0; i < count && bits.length < 600; i++) {
        var a = rand(-Math.PI, 0), sp = rand(200, 800) * s * spread * (calm() ? 0.6 : 1);
        bits.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120 * s, r: rand(6, 12) * s, hue: rand(0, 360), life: 0, max: rand(1.6, 2.6), kind: "paper", rot: rand(0, TAU), vr: rand(-8, 8) });
      }
    }
    function recentHits(sec) {
      var now = perfNow(), n = 0;
      for (var i = hits.length - 1; i >= 0 && now - hits[i] < sec; i--) n++;
      return n;
    }
    function onHit(side) {
      if (mode === "band") startBand();
      else if (mode === "animals") danceAll();
      else if (mode === "echo" && echo.state === "turn") {
        echo.tries.push(side); echo.last = perfNow();
      }
    }

    /* ---- Play-along band ---- */
    function startBand() {
      band.until = perfNow() + (calm() ? 3.2 : 2.6); // keeps playing for a moment after the last hit
      if (band.on) return;
      band.on = true;
      band.next = perfNow() + 0.06;
      if (audioReady() && bongoBus()) {
        band.out = actx.createGain(); band.out.gain.value = 0.0001;
        band.out.connect(bgBus);
        band.out.gain.setTargetAtTime(calm() ? 0.5 : 0.75, actx.currentTime, 0.05);
      }
      announceSometimes("The band is playing!");
    }
    function stopBand(say) {
      if (!band.on) return;
      band.on = false;
      if (band.out) {
        var o = band.out; band.out = null;
        try { o.gain.setTargetAtTime(0.0001, actx.currentTime, 0.12); setTimeout(function () { try { o.disconnect(); } catch (e) { /* ignore */ } }, 1500); } catch (e) { /* ignore */ }
      }
      if (say) announce("The music stopped. Play the drums to start it again.");
    }
    function updateBand(dt) {
      var now = perfNow();
      if (band.on && now > band.until) stopBand(true);
      band.level += ((band.on ? 1 : 0) - band.level) * Math.min(1, dt * (band.on ? 6 : 3));
      band.pulse *= Math.exp(-dt * 5);
      if (!band.on) return;
      var stepLen = 60 / (calm() ? 84 : 100) / 2;
      while (band.next < now + 0.12) {
        var st = band.step % 32, bar = Math.floor(st / 8), b = st % 8, when = band.next;
        if (band.out && audioReady()) {
          var t = actx.currentTime + Math.max(0, when - now), out = band.out;
          var root = BAND.bass[bar];
          if (b === 0 || b === 3) bandNote("bass", mtof(root), t, 0.55, out);
          if (b === 4) bandNote("bass", mtof(root + 7), t, 0.45, out);
          if (b === 7) bandNote("bass", mtof(root + 12), t, 0.35, out);
          if (b === 1 || b === 3 || b === 6) BAND.chords[bar].forEach(function (m) { bandNote("keys", mtof(m), t, 0.07, out); });
          if (BAND.tune[st]) bandNote("marimba", mtof(BAND.tune[st]), t, 0.2, out);
          bandNote("shaker", 0, t, b % 2 ? 0.12 : 0.06, out);
        }
        if (b % 2 === 0) queueBeat(when, st);
        band.step++;
        band.next += stepLen;
      }
    }
    var beatQueue = [];
    function queueBeat(when, st) { beatQueue.push({ t: when, st: st }); }
    function flushBeats() {
      var now = perfNow();
      while (beatQueue.length && beatQueue[0].t <= now) {
        var q = beatQueue.shift();
        band.pulse = 1;
        if (BAND.tune[q.st] && notes.length < 30) {
          var d = drums[q.st % 4 < 2 ? 0 : 1], s = S() * sizeK();
          notes.push({ x: d.x + rand(-d.r * 0.6, d.r * 0.6), y: d.y - d.r * 0.4, vx: rand(-30, 30) * s, vy: -rand(70, 120) * s, hue: rand(0, 360), life: 0, max: 3.2, sz: rand(16, 26) * s, two: Math.random() < 0.4 });
        }
      }
    }

    /* ---- Drumroll ---- */
    function startRoll(auto) {
      if (roll) { if (!auto) roll.auto = 0; return; }
      roll = { t: 0, next: perfNow(), side: 0, auto: auto || 0, n: 0 };
    }
    function updateRoll(dt) {
      if (pendingAuto && perfNow() - pendingAuto > 0.08) { pendingAuto = 0; startRoll(1.6); }
      var anyHeld = Object.keys(holds).length > 0;
      if (!roll) return;
      roll.t += dt;
      var k = easeOut(Math.min(1, roll.t / 3.5));
      var gap = calm() ? 0.22 - 0.12 * k : 0.17 - 0.125 * k;
      var now = perfNow();
      while (roll.next <= now) {
        hit(roll.side, 0.3 + 0.65 * k, roll.n % 4 === 3, undefined, undefined, false);
        roll.side ^= 1; roll.n++;
        roll.next += gap;
      }
      drums.forEach(function (d) { d.wob = Math.sin(now * 60 + d.side) * k * d.r * 0.012 * calmK(); });
      cym.shine = Math.max(cym.shine, k * 0.6);
      if (k > 0.97) announceSometimes("A big drumroll! Let go for the crash.");
      if ((roll.auto && roll.t >= roll.auto) || (!roll.auto && !anyHeld)) endRoll();
    }
    function endRoll() {
      if (!roll) return;
      var r = roll; roll = null;
      drums.forEach(function (d) { d.wob = 0; });
      if (r.t < 0.3 && !r.auto) { announceSometimes("Hold down for a drumroll."); return; } // a quick tap is just one hit
      var size = clamp(r.t / 3.5, 0.25, 1);
      cymbalCrash(size);
      cym.v += (calm() ? 3 : 7) * size; cym.shine = 1;
      var cp = cymbalPos();
      confetti(cp.x, cp.y, Math.round((30 + 110 * size) * calmK()), 0.6 + 0.6 * size);
      announce(size > 0.8 ? "Crash! What a drumroll!" : "Crash!");
    }
    function cymbalPos() {
      var cr = drums[0].r * 0.8;
      return { x: W / 2, y: Math.max(cr * 0.72 + 16, drums[0].y - drums[0].r * 1.45), r: cr };
    }

    /* ---- Dancing animals ---- */
    function addDancer(i) {
      var s = dancerSize(), fromLeft = dancers.length % 2 === 0;
      dancers.push({ a: DANCERS[i % DANCERS.length], x: fromLeft ? -s : W + s, tx: 0, jy: 0, jv: 0, tilt: 0, tt: 0, arm: 0, squash: 0, out: false, face: fromLeft ? 1 : -1, ph: rand(0, TAU), move: 0 });
      placeDancers();
    }
    function dancerSize() { return Math.min(H * 0.17, W / 8) * Math.min(1.2, 0.9 + 0.1 * sizeK()); }
    function maxDancers() { return calm() ? 3 : 5; }
    function placeDancers() {
      var stay = dancers.filter(function (d) { return !d.out; }), n = stay.length;
      stay.forEach(function (d, i) { d.tx = W * (i + 1) / (n + 1); });
    }
    function danceAll() {
      var s = dancerSize(), g = 2600 * S();
      dancers.forEach(function (d, i) {
        if (d.out) return;
        d.move = (d.move + 1) % 4;
        setTimeout(function () {
          var h = s * (calm() ? 0.2 : 0.38) * (d.move === 2 ? 1.4 : 1);
          if (d.jy > -2) d.jv = -Math.sqrt(2 * g * h);
          d.squash = -0.12;
          d.tt = d.move === 1 ? 0.22 : d.move === 3 ? -0.22 : 0;
          d.arm = 1;
        }, i * 45);
      });
      var want = Math.min(maxDancers(), 1 + Math.floor(recentHits(6) / 4));
      var count = dancers.filter(function (d) { return !d.out; }).length;
      if (want > count) {
        var idx = nextDancer++;
        addDancer(idx);
        var nm = DANCERS[idx % DANCERS.length].name;
        setTimeout(function () { announce("A " + nm + " joined the dance!"); }, 400);
      }
    }
    function updateDancers(dt) {
      var s = dancerSize(), g = 2600 * S();
      var want = Math.min(maxDancers(), 1 + Math.floor(recentHits(6) / 4));
      var stay = dancers.filter(function (d) { return !d.out; });
      if (stay.length > want && stay.length > 1) {
        fewerFor += dt;
        if (fewerFor > 3) { // the newest animal waves goodbye and walks off
          fewerFor = 0;
          var last = stay[stay.length - 1];
          last.out = true; last.tx = last.x < W / 2 ? -s * 2 : W + s * 2;
          placeDancers();
        }
      } else fewerFor = 0;
      for (var i = dancers.length - 1; i >= 0; i--) {
        var d = dancers[i];
        var speed = (d.out ? 1.2 : 2.4) * (calm() ? 0.6 : 1);
        var dx = d.tx - d.x;
        d.x += dx * Math.min(1, dt * speed);
        if (Math.abs(dx) > 4) d.face = dx > 0 ? 1 : -1;
        if (Math.abs(dx) > s * 0.3 && d.jy >= 0 && d.jv >= 0) d.jv = -Math.sqrt(2 * g * s * 0.12); // little hops while walking
        d.jv += g * dt; d.jy += d.jv * dt;
        if (d.jy > 0) { if (d.jv > 300 * S()) d.squash = 0.14; d.jy = 0; d.jv = 0; }
        d.squash *= Math.exp(-dt * 9);
        d.tilt += (d.tt - d.tilt) * Math.min(1, dt * 10);
        d.tt *= Math.exp(-dt * 2.5);
        d.arm *= Math.exp(-dt * 3);
        d.ph += dt;
        if (d.out && (d.x < -s * 1.5 || d.x > W + s * 1.5)) dancers.splice(i, 1);
      }
    }

    /* ---- Echo game ---- */
    function beatLen() { return calm() ? 0.62 : 0.48; }
    function echoNext() {
      var i = echo.idx < ECHO_PATTERNS.length ? echo.idx : 3 + Math.floor(Math.random() * (ECHO_PATTERNS.length - 3));
      echo.idx++;
      echo.pat = ECHO_PATTERNS[i]; echo.replays = 0;
      echoListen();
    }
    function echoListen() {
      echo.state = "listen"; echo.t = perfNow() + 0.9; echo.played = 0; echo.tries = [];
      announce("Listen to the monster.");
    }
    function updateEcho(dt) {
      var now = perfNow(), e = echo;
      if (e.state === "wait") { if (now > e.t) echoNext(); }
      else if (e.state === "listen") {
        while (e.played < e.pat.length && now >= e.t + e.pat[e.played][0] * beatLen()) {
          var side = e.pat[e.played][1];
          bongoHit(side, 0.8, false);
          e.mini[side] = 1; e.arm[side] = 1; drums[side].hint = 1;
          e.played++;
        }
        var end = e.t + e.pat[e.pat.length - 1][0] * beatLen() + 0.7;
        if (e.played >= e.pat.length && now > end) {
          e.state = "turn"; e.turnAt = now; e.tries = [];
          announce("Your turn!");
        }
      } else if (e.state === "turn") {
        if (e.tries.length) {
          if (now - e.last > (calm() ? 1.7 : 1.3) || e.tries.length >= e.pat.length + 4) echoCheer();
        } else if (now - e.turnAt > 9 && e.replays < 1) { e.replays++; echoListen(); }
      } else if (e.state === "cheer") {
        if (now > e.t) echoNext();
      }
      e.jv += 2600 * S() * dt; e.jump += e.jv * dt;
      if (e.jump > 0) { e.jump = 0; e.jv = 0; }
      e.mini[0] *= Math.exp(-dt * 6); e.mini[1] *= Math.exp(-dt * 6);
      e.arm[0] *= Math.exp(-dt * 7); e.arm[1] *= Math.exp(-dt * 7);
      e.happy *= Math.exp(-dt * 0.8);
    }
    function echoCheer() {
      var e = echo, same = e.tries.length === e.pat.length && e.pat.every(function (p, i) { return p[1] === e.tries[i]; });
      e.state = "cheer"; e.t = perfNow() + 2.6; e.happy = 1; e.same = same;
      e.said = same ? pick(["You copied it!", "Perfect echo!", "Just like me!"]) : pick(["Great drumming!", "Yay!", "Woo-hoo!", "Nice playing!"]);
      e.jv = -Math.sqrt(2 * 2600 * S() * monsterSize() * (calm() ? 0.2 : 0.4));
      cheerSound(same);
      var m = monsterPos();
      confetti(m.x, m.y - monsterSize() * 0.4, Math.round((same ? 80 : 50) * calmK()), same ? 1 : 0.7);
      announce(e.said);
    }
    function monsterSize() { return Math.min(H * 0.16, W * 0.14) * Math.min(1.2, 0.9 + 0.1 * sizeK()); }
    function monsterPos() { return { x: W * 0.36, y: H * 0.3 }; }

    /* ---- Drawing ---- */
    function drawBackground(g, time) {
      var c = calm();
      var bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, c ? "#120a1f" : "#1d0f33");
      bg.addColorStop(0.6, c ? "#1c1029" : "#341545");
      bg.addColorStop(1, c ? "#24150f" : "#3d2412");
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      // the wooden stage floor
      var fy = drums[0].y + drums[0].r * 0.75;
      var fl = g.createLinearGradient(0, fy, 0, H);
      fl.addColorStop(0, c ? "#3a2414" : "#5a3418"); fl.addColorStop(1, c ? "#1e120a" : "#2c180b");
      g.fillStyle = fl; g.fillRect(0, fy, W, H - fy);
      g.strokeStyle = "rgba(0,0,0,0.18)"; g.lineWidth = 2;
      for (var i = 1; i < 5; i++) { var yy = fy + (H - fy) * i / 5; g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy); g.stroke(); }
      // a warm spotlight on the drums
      var sp = g.createRadialGradient(W / 2, drums[0].y, 0, W / 2, drums[0].y, Math.max(W, H) * 0.6);
      sp.addColorStop(0, c ? "rgba(255,200,140,0.12)" : "rgba(255,200,140,0.2)"); sp.addColorStop(1, "rgba(255,200,140,0)");
      g.fillStyle = sp; g.fillRect(0, 0, W, H);
      // band mode: coloured stage lights sway while the music plays
      if (mode === "band" && band.level > 0.01) {
        var left = Math.max(0, band.until - perfNow()), fade = band.on ? Math.min(1, 0.4 + left / 1.5) : 1;
        g.save(); g.globalCompositeOperation = "lighter";
        [0.2, 0.5, 0.8].forEach(function (fx, j) {
          var ang = Math.sin(time * 0.6 + j * 2.1) * 0.35, hue = (time * 20 + j * 120) % 360;
          var x0 = W * fx, len = H * 1.1, wdt = W * 0.16;
          g.save(); g.translate(x0, -10); g.rotate(ang);
          var lg = g.createLinearGradient(0, 0, 0, len);
          var a = band.level * fade * (c ? 0.1 : 0.18) * (0.75 + 0.25 * band.pulse);
          lg.addColorStop(0, "hsla(" + hue + ",90%,65%," + a + ")"); lg.addColorStop(1, "hsla(" + hue + ",90%,65%,0)");
          g.fillStyle = lg;
          g.beginPath(); g.moveTo(-wdt * 0.12, 0); g.lineTo(wdt * 0.12, 0); g.lineTo(wdt, len); g.lineTo(-wdt, len); g.closePath(); g.fill();
          g.restore();
        });
        g.restore();
      }
    }
    function drawDrum(g, d) {
      var r = d.r, ry = r * 0.42, x = d.x + d.wob, y = d.y + d.dent * r * 0.025, sh = r * 0.88, bw = r * 0.86;
      // shadow
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.beginPath(); g.ellipse(x, d.y + sh + ry * 0.45, r * 1.0, ry * 0.5, 0, 0, TAU); g.fill();
      // wooden shell, a little narrower at the bottom
      var wood = g.createLinearGradient(x - r, 0, x + r, 0);
      wood.addColorStop(0, "#3d1a08"); wood.addColorStop(0.28, "#a85a24"); wood.addColorStop(0.42, "#dc9450");
      wood.addColorStop(0.62, "#9a4c1c"); wood.addColorStop(1, "#331505");
      g.fillStyle = wood;
      g.save();
      g.beginPath(); g.moveTo(x - r, y);
      g.lineTo(x - bw, y + sh);
      g.ellipse(x, y + sh, bw, ry * 0.8, 0, Math.PI, 0, true);
      g.lineTo(x + r, y); g.closePath(); g.fill();
      g.clip(); // the painted band stays on the shell
      // a painted band in the drum's own colour (orange for the big drum, blue for the small one)
      var band2 = d.side ? "#3fb4ff" : "#ff8a3d", by = y + sh * 0.62, bww = r - (r - bw) * 0.62;
      g.strokeStyle = band2; g.lineWidth = Math.max(4, r * 0.13);
      g.beginPath(); g.ellipse(x, by, bww * 0.99, ry * 0.9, 0, Math.PI * 0.03, Math.PI * 0.97); g.stroke();
      g.strokeStyle = "rgba(255,230,170,0.7)"; g.lineWidth = Math.max(1.5, r * 0.025);
      [-1, 1].forEach(function (o) { g.beginPath(); g.ellipse(x, by + o * r * 0.085, bww * 0.99, ry * 0.9, 0, Math.PI * 0.03, Math.PI * 0.97); g.stroke(); });
      g.restore();
      // short metal tuning lugs under the rim
      g.strokeStyle = "#cfd3da"; g.lineCap = "round"; g.lineWidth = Math.max(3, r * 0.055);
      [-0.7, -0.24, 0.24, 0.7].forEach(function (f) {
        var lx = x + f * r * 0.97, ly = y + ry * Math.sqrt(1 - f * f) * 0.95;
        g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx - f * (r - bw) * 0.3, ly + sh * 0.3); g.stroke();
      });
      g.lineCap = "butt";
      // the drum skin
      var hy = y;
      var skin = g.createRadialGradient(x - r * 0.25, hy - ry * 0.3, r * 0.05, x, hy, r);
      skin.addColorStop(0, "#fbf1d8"); skin.addColorStop(0.7, "#ecd6a6"); skin.addColorStop(1, "#c9a66b");
      g.fillStyle = skin;
      g.beginPath(); g.ellipse(x, hy, r * 0.95, ry * 0.92, 0, 0, TAU); g.fill();
      // glow of colour when it is hit, and ripples across the skin
      g.save();
      g.beginPath(); g.ellipse(x, hy, r * 0.95, ry * 0.92, 0, 0, TAU); g.clip();
      if (d.flash > 0.01) {
        g.fillStyle = "hsla(" + d.hue + ",90%,60%," + (d.flash * (calm() ? 0.3 : 0.5)).toFixed(3) + ")";
        g.fillRect(x - r, hy - ry, r * 2, ry * 2);
      }
      if (d.hint > 0.01) { // the echo monster played this drum
        g.fillStyle = "hsla(285,90%,70%," + (d.hint * 0.45).toFixed(3) + ")";
        g.fillRect(x - r, hy - ry, r * 2, ry * 2);
      }
      d.ripples.forEach(function (rp) {
        var k = rp.t / 0.7, rr = r * (0.1 + 0.9 * k);
        g.strokeStyle = "rgba(120,70,20," + (0.45 * (1 - k)).toFixed(3) + ")";
        g.lineWidth = Math.max(2, r * 0.03 * (1 - k));
        g.beginPath(); g.ellipse(x + rp.x * r * 0.9, hy + rp.y * ry * 0.9, rr, rr * 0.42, 0, 0, TAU); g.stroke();
      });
      g.restore();
      // the metal rim
      var rim = g.createLinearGradient(x - r, hy - ry, x + r, hy + ry);
      rim.addColorStop(0, "#f2f4f7"); rim.addColorStop(0.5, "#8d939c"); rim.addColorStop(1, "#e3e6ea");
      g.strokeStyle = rim; g.lineWidth = Math.max(3, r * 0.08);
      g.beginPath(); g.ellipse(x, hy, r * 0.97, ry * 0.95, 0, 0, TAU); g.stroke();
    }
    function drawBlock(g) { // the wooden block that joins the two drums
      var a = drums[0], b = drums[1], y = a.y + a.r * 0.35, h = a.r * 0.28;
      g.fillStyle = "#6e3412";
      g.fillRect(a.x + a.r * 0.85, y, (b.x - b.r * 0.85) - (a.x + a.r * 0.85), h);
      g.fillStyle = "rgba(255,210,150,0.25)";
      g.fillRect(a.x + a.r * 0.85, y, (b.x - b.r * 0.85) - (a.x + a.r * 0.85), h * 0.25);
    }
    function drawCymbal(g, time) {
      var p = cymbalPos(), r = p.r;
      // stand
      g.strokeStyle = "#9aa0aa"; g.lineWidth = Math.max(3, r * 0.06);
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x, drums[0].y + drums[0].r * 0.2); g.stroke();
      // the ring of lights fills up as the drumroll grows
      // an arch of light bulbs that light up one by one as the drumroll grows
      var k = roll ? Math.min(1, roll.t / 3.5) : 0, n = 10, br = Math.max(6, r * 0.09);
      for (var i = 0; i < n; i++) {
        var a = Math.PI + (i / (n - 1)) * Math.PI, on = k * n > i + 0.01;
        var lx = p.x + Math.cos(a) * r * 1.2, ly = p.y - r * 0.05 + Math.sin(a) * r * 0.62;
        g.fillStyle = "rgba(0,0,0,0.45)"; g.beginPath(); g.arc(lx, ly, br * 1.35, 0, TAU); g.fill();
        g.fillStyle = on ? "hsl(" + (50 - i * 5) + ",100%," + (calm() ? 60 : 68) + "%)" : "rgba(255,255,255,0.14)";
        g.beginPath(); g.arc(lx, ly, br, 0, TAU); g.fill();
      }
      g.save(); g.translate(p.x, p.y); g.rotate(cym.tilt);
      if (cym.shine > 0.02) {
        g.globalCompositeOperation = "lighter";
        var gl = glow(45, 90, 60), gs = r * 2.6 * (0.6 + 0.4 * cym.shine);
        g.globalAlpha = cym.shine * (calm() ? 0.35 : 0.6);
        g.drawImage(gl, -gs / 2, -gs / 2, gs, gs);
        g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
      }
      var gold = g.createLinearGradient(-r, 0, r, 0);
      gold.addColorStop(0, "#a0701c"); gold.addColorStop(0.35, "#ffe08a"); gold.addColorStop(0.55, "#e6b444"); gold.addColorStop(1, "#8c5e14");
      g.fillStyle = gold;
      g.beginPath(); g.ellipse(0, 0, r, r * 0.16, 0, 0, TAU); g.fill();
      g.strokeStyle = "rgba(120,80,10,0.5)"; g.lineWidth = 1.5;
      [0.45, 0.7].forEach(function (f) { g.beginPath(); g.ellipse(0, 0, r * f, r * 0.16 * f, 0, 0, TAU); g.stroke(); });
      g.fillStyle = "#c99a35"; g.beginPath(); g.ellipse(0, -r * 0.04, r * 0.18, r * 0.08, 0, 0, TAU); g.fill();
      g.restore();
    }
    function drawDancer(g, d, baseY, time) {
      var s = dancerSize(), a = d.a, kind = a.kind;
      // shadow
      var sk = 1 / (1 - d.jy / (s * 2));
      g.fillStyle = "rgba(0,0,0," + (0.3 * Math.min(1, sk)).toFixed(3) + ")";
      g.beginPath(); g.ellipse(d.x, baseY, s * 0.42 * Math.min(1, sk), s * 0.08, 0, 0, TAU); g.fill();
      var bob = Math.sin(d.ph * 3) * s * 0.02;
      g.save(); g.translate(d.x, baseY + d.jy + bob); g.rotate(d.tilt);
      g.scale(1 - d.squash, 1 + d.squash);
      var body = a.body, dark = kind === "penguin" ? "#1d2436" : "rgba(0,0,0,0.25)";
      // feet
      g.fillStyle = kind === "penguin" ? "#f5a623" : kind === "frog" ? "#3aa856" : body;
      g.beginPath(); g.ellipse(-s * 0.18, -s * 0.03, s * 0.15, s * 0.07, 0, 0, TAU); g.ellipse(s * 0.18, -s * 0.03, s * 0.15, s * 0.07, 0, 0, TAU); g.fill();
      // arms: up when the drum is hit
      var up = d.arm, sw = Math.sin(d.ph * 4) * 0.2;
      g.strokeStyle = body; g.lineCap = "round"; g.lineWidth = s * (kind === "penguin" ? 0.13 : 0.1);
      [-1, 1].forEach(function (sd) {
        var ang = (0.5 + sw * sd) * (1 - up) + (-0.9) * up;
        g.beginPath(); g.moveTo(sd * s * 0.3, -s * 0.6);
        g.lineTo(sd * (s * 0.3 + Math.cos(ang) * s * 0.32), -s * 0.6 + Math.sin(ang) * s * 0.32 * (1 - 2 * up) + up * -s * 0.05); g.stroke();
      });
      g.lineCap = "butt";
      // body and tummy
      g.fillStyle = body;
      g.beginPath(); g.ellipse(0, -s * 0.45, s * 0.36, s * 0.42, 0, 0, TAU); g.fill();
      g.fillStyle = a.belly;
      g.beginPath(); g.ellipse(0, -s * 0.4, s * 0.24, s * 0.3, 0, 0, TAU); g.fill();
      // head and ears
      var hy = -s * 1.05, hr = s * (kind === "frog" ? 0.34 : 0.32);
      g.fillStyle = body;
      if (kind === "bear") { g.beginPath(); g.arc(-hr * 0.75, hy - hr * 0.75, hr * 0.35, 0, TAU); g.arc(hr * 0.75, hy - hr * 0.75, hr * 0.35, 0, TAU); g.fill(); }
      if (kind === "cat") {
        g.beginPath(); g.moveTo(-hr * 0.9, hy - hr * 0.3); g.lineTo(-hr * 0.6, hy - hr * 1.25); g.lineTo(-hr * 0.1, hy - hr * 0.8);
        g.moveTo(hr * 0.9, hy - hr * 0.3); g.lineTo(hr * 0.6, hy - hr * 1.25); g.lineTo(hr * 0.1, hy - hr * 0.8); g.fill();
      }
      if (kind === "bunny") {
        var flop = Math.sin(d.ph * 5) * 0.12 + d.tilt;
        [-1, 1].forEach(function (sd) {
          g.save(); g.translate(sd * hr * 0.42, hy - hr * 0.7); g.rotate(sd * 0.15 - flop);
          g.fillStyle = body; g.beginPath(); g.ellipse(0, -hr * 0.75, hr * 0.26, hr * 0.8, 0, 0, TAU); g.fill();
          g.fillStyle = "#ffc2d8"; g.beginPath(); g.ellipse(0, -hr * 0.75, hr * 0.13, hr * 0.6, 0, 0, TAU); g.fill();
          g.restore();
        });
      }
      g.fillStyle = body;
      g.beginPath();
      if (kind === "frog") g.ellipse(0, hy + hr * 0.15, hr * 1.2, hr * 0.85, 0, 0, TAU); else g.arc(0, hy, hr, 0, TAU);
      g.fill();
      if (kind === "penguin") { g.fillStyle = a.belly; g.beginPath(); g.ellipse(0, hy + hr * 0.2, hr * 0.7, hr * 0.62, 0, 0, TAU); g.fill(); }
      if (kind === "bear" || kind === "cat") { g.fillStyle = a.belly; g.beginPath(); g.ellipse(0, hy + hr * 0.35, hr * 0.45, hr * 0.32, 0, 0, TAU); g.fill(); }
      // eyes (the frog's sit on top of its head)
      var ey = kind === "frog" ? hy - hr * 0.55 : hy - hr * 0.1, ex = kind === "frog" ? hr * 0.55 : hr * 0.38;
      if (kind === "frog") { g.fillStyle = body; g.beginPath(); g.arc(-ex, ey, hr * 0.38, 0, TAU); g.arc(ex, ey, hr * 0.38, 0, TAU); g.fill(); }
      var blink = Math.sin(d.ph * 0.9 + d.x) > 0.985;
      g.fillStyle = "#fff";
      g.beginPath(); g.arc(-ex, ey, hr * 0.24, 0, TAU); g.arc(ex, ey, hr * 0.24, 0, TAU); g.fill();
      g.fillStyle = "#1a1a24";
      if (blink) { g.fillRect(-ex - hr * 0.2, ey - 1, hr * 0.4, 3); g.fillRect(ex - hr * 0.2, ey - 1, hr * 0.4, 3); }
      else { g.beginPath(); g.arc(-ex + hr * 0.04, ey + hr * 0.03, hr * 0.13, 0, TAU); g.arc(ex + hr * 0.04, ey + hr * 0.03, hr * 0.13, 0, TAU); g.fill(); }
      // nose or beak, and a big smile
      if (kind === "penguin") { g.fillStyle = "#f5a623"; g.beginPath(); g.moveTo(-hr * 0.15, hy + hr * 0.15); g.lineTo(hr * 0.15, hy + hr * 0.15); g.lineTo(0, hy + hr * 0.42); g.fill(); }
      else if (kind !== "frog") { g.fillStyle = kind === "bunny" ? "#ff8fb4" : "#3a2216"; g.beginPath(); g.ellipse(0, hy + hr * 0.22, hr * 0.12, hr * 0.08, 0, 0, TAU); g.fill(); }
      g.strokeStyle = "#3a2216"; g.lineWidth = Math.max(2, s * 0.025);
      g.beginPath(); g.arc(0, hy + hr * (kind === "frog" ? 0.15 : 0.3), hr * (kind === "frog" ? 0.55 : 0.28) * (1 + up * 0.25), 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      if (kind === "cat") {
        g.lineWidth = 1.5; g.strokeStyle = "rgba(60,30,10,0.6)";
        [-1, 1].forEach(function (sd) { for (var w = -1; w <= 1; w++) { g.beginPath(); g.moveTo(sd * hr * 0.3, hy + hr * 0.3); g.lineTo(sd * hr * 0.95, hy + hr * (0.25 + w * 0.12)); g.stroke(); } });
      }
      // rosy cheeks
      g.fillStyle = "rgba(255,120,150,0.35)";
      g.beginPath(); g.arc(-hr * 0.6, hy + hr * 0.25, hr * 0.14, 0, TAU); g.arc(hr * 0.6, hy + hr * 0.25, hr * 0.14, 0, TAU); g.fill();
      g.restore();
    }
    function drawMonster(g, time) {
      var e = echo, m = monsterSize(), p = monsterPos(), x = p.x, y = p.y + e.jump;
      var mini = { r: m * 0.42, y: p.y + m * 0.78 };
      // its own little bongos
      [0, 1].forEach(function (sd) {
        var d = { side: sd, hue: drums[sd].hue, x: x + (sd ? 1 : -1) * m * 0.55, y: mini.y, r: mini.r * (sd ? 0.9 : 1.08), flash: e.mini[sd], dent: e.mini[sd], wob: 0, hint: 0, ripples: [] };
        drawDrum(g, d);
      });
      var squ = Math.sin(time * 2) * 0.03;
      g.save(); g.translate(x, y);
      // horns
      g.fillStyle = "#ffd65c";
      g.beginPath(); g.moveTo(-m * 0.45, -m * 0.6); g.lineTo(-m * 0.62, -m * 1.05); g.lineTo(-m * 0.2, -m * 0.75);
      g.moveTo(m * 0.45, -m * 0.6); g.lineTo(m * 0.62, -m * 1.05); g.lineTo(m * 0.2, -m * 0.75); g.fill();
      // body
      var bodyG = g.createRadialGradient(-m * 0.2, -m * 0.4, m * 0.1, 0, -m * 0.1, m * 0.9);
      bodyG.addColorStop(0, "#c58bff"); bodyG.addColorStop(1, "#7a3fd1");
      g.fillStyle = bodyG;
      g.beginPath(); g.ellipse(0, -m * 0.1, m * 0.72 * (1 + squ), m * 0.68 * (1 - squ), 0, 0, TAU); g.fill();
      // arms reach to the little drums
      g.strokeStyle = "#8f52e0"; g.lineCap = "round"; g.lineWidth = m * 0.14;
      [0, 1].forEach(function (sd) {
        var dir = sd ? 1 : -1, down = e.arm[sd], cheer = Math.min(1, e.happy * 1.5);
        // resting hands hover over its drums, a beat brings a hand down, a cheer throws them up
        var hx = dir * m * (0.55 + 0.35 * cheer), hy2 = (m * 0.42 + down * m * 0.32) * (1 - cheer) + cheer * -m * 0.85;
        var sx = dir * m * 0.58, sy = -m * 0.05;
        g.strokeStyle = "#8f52e0"; g.lineWidth = m * 0.15;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(hx, hy2 - e.jump * 0); g.stroke();
        g.fillStyle = "#a66bf0"; g.beginPath(); g.arc(hx, hy2, m * 0.13, 0, TAU); g.fill();
      });
      g.lineCap = "butt";
      // eyes look at the drum it is playing, or at you
      var look = e.state === "listen" ? (e.arm[1] > e.arm[0] ? 1 : -1) * 0.3 * Math.max(e.arm[0], e.arm[1]) : 0;
      [-1, 1].forEach(function (sd) {
        g.fillStyle = "#fff"; g.beginPath(); g.arc(sd * m * 0.25, -m * 0.3, m * 0.17, 0, TAU); g.fill();
        g.fillStyle = "#1a1030"; g.beginPath(); g.arc(sd * m * 0.25 + look * m * 0.2, -m * 0.27 + (e.state === "listen" ? m * 0.04 : 0), m * 0.08, 0, TAU); g.fill();
      });
      // mouth: an O while it listens to you, a big smile when it cheers
      g.fillStyle = "#3a0f4d";
      if (e.state === "turn") { g.beginPath(); g.ellipse(0, m * 0.08, m * 0.09, m * 0.11, 0, 0, TAU); g.fill(); }
      else { g.beginPath(); g.arc(0, m * 0.0, m * (0.22 + 0.12 * e.happy), 0.1 * Math.PI, 0.9 * Math.PI); g.closePath(); g.fill(); }
      g.restore();
      drawBubble2(g, x + m * 0.95, p.y - m * 0.85, m, time);
    }
    function drawBubble2(g, x, y, m, time) {
      var e = echo, text = e.state === "listen" ? "Listen..." : e.state === "turn" ? "Your turn!" : e.state === "cheer" ? e.said : "";
      if (!text) return;
      var fs = Math.max(20, Math.round(m * 0.32));
      g.font = "700 " + fs + "px 'Atkinson Hyperlegible', system-ui, sans-serif";
      var tw = g.measureText(text).width, pad = fs * 0.6, bw = tw + pad * 2, bh = fs * 1.7;
      x = Math.min(x, W - bw - 10);
      var pulse = e.state === "turn" ? 1 + Math.sin(time * 4) * 0.03 : 1;
      g.save(); g.translate(x + bw / 2, y + bh / 2); g.scale(pulse, pulse); g.translate(-(x + bw / 2), -(y + bh / 2));
      g.fillStyle = e.state === "turn" ? "#fff6c9" : "#ffffff";
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y, bw, bh, bh / 2); else g.rect(x, y, bw, bh);
      g.moveTo(x + bh * 0.4, y + bh - 2); g.lineTo(x + bh * 0.05, y + bh + fs * 0.55); g.lineTo(x + bh * 0.95, y + bh - 2);
      g.fill();
      g.fillStyle = "#2a1640"; g.textBaseline = "middle"; g.textAlign = "left";
      g.fillText(text, x + pad, y + bh / 2 + 1);
      g.restore();
      // the beats to copy, as dots: orange is the big drum, blue the small drum.
      if (!e.pat) return;
      var dots = e.pat, n = dots.length, dr = Math.max(9, m * 0.11), gap = dr * 2.8;
      var dx0 = x + pad * 0.5, dy = y + bh + fs * 1.2;
      for (var i = 0; i < n; i++) {
        var sd = dots[i][1], shown = e.state === "listen" ? i < e.played : true;
        var done = e.state !== "listen" && i < e.tries.length;
        var cx = dx0 + dots[i][0] * gap * 0.9 + i * gap * 0.35;
        g.globalAlpha = shown ? 1 : 0.25;
        g.fillStyle = sd ? "#3fb4ff" : "#ff8a3d";
        g.beginPath(); g.arc(cx, dy, dr * (sd ? 0.85 : 1.05), 0, TAU); g.fill();
        if (done) { g.strokeStyle = "#fff"; g.lineWidth = 3; g.beginPath(); g.arc(cx, dy, dr * 1.35, 0, TAU); g.stroke(); }
      }
      g.globalAlpha = 1;
    }
    function drawNote(g, n) {
      var a = clamp(Math.min(n.life / 0.3, (n.max - n.life) / 0.8), 0, 1), s = n.sz;
      g.globalAlpha = a * 0.9;
      g.fillStyle = "hsl(" + n.hue + ",85%,70%)"; g.strokeStyle = g.fillStyle; g.lineWidth = Math.max(2, s * 0.14);
      g.beginPath(); g.ellipse(n.x, n.y, s * 0.42, s * 0.3, -0.4, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(n.x + s * 0.36, n.y - s * 0.05); g.lineTo(n.x + s * 0.36, n.y - s * 1.2);
      if (n.two) { g.lineTo(n.x + s * 1.2, n.y - s * 1.35); g.lineTo(n.x + s * 1.2, n.y - s * 0.2); g.stroke(); g.beginPath(); g.ellipse(n.x + s * 0.84, n.y - s * 0.15, s * 0.42, s * 0.3, -0.4, 0, TAU); g.fill(); }
      else { g.quadraticCurveTo(n.x + s * 0.9, n.y - s * 0.9, n.x + s * 0.8, n.y - s * 0.5); g.stroke(); }
      g.globalAlpha = 1;
    }

    return {
      label: M.label,
      hint: M.name + ": " + M.hint,
      holdExtra: mode === "roll" ? 10 : 0, // holding is the drumroll here, so going back to the menu needs a longer hold
      start: function () {
        layout();
        if (mode === "animals") addDancer(0);
        if (mode === "echo") { echo.state = "wait"; echo.t = perfNow() + 1.6; }
        setTimeout(function () { announce(M.name + ". " + M.hint); }, 700);
      },
      resize: function () { layout(); placeDancers(); },
      stop: function () { stopBand(false); roll = null; holds = {}; pendingAuto = 0; },
      hold: function (on) {
        if (mode !== "roll") return;
        if (on) { pendingAuto = 0; holds.key = 1; startRoll(0); } else delete holds.key;
      },
      down: function (id, x, y) {
        var w = whichDrum(x, y), edge = w.d > 0.62 && w.d < 1.25;
        if (mode === "roll") { holds["p" + id] = 1; if (!roll) startRoll(0); return; }
        hit(w.side, 0.85, edge, x, y);
      },
      move: function () {},
      up: function (id) { delete holds["p" + id]; },
      dwell: function (x, y) {
        var w = whichDrum(x, y);
        if (mode === "roll") { startRoll(1.6); return; }
        hit(w.side, 0.85, false, x, y);
      },
      press: function (key) {
        if (mode === "roll") { if (!roll) pendingAuto = perfNow(); return; } // a tap from Switch Control gets a short drumroll
        var how = settings.bongoSwitch || "turns", side;
        if (key === "ArrowLeft") side = 0;
        else if (key === "ArrowRight") side = 1;
        else if (how === "two" && (key === " " || key === "Spacebar")) side = 0;
        else if (how === "two" && key === "Enter") side = 1;
        if (side === undefined && how === "both") { hit(0, 0.7, false); hit(1, 0.7, false); return; }
        if (side === undefined) { side = altSide; altSide ^= 1; }
        hit(side, 0.85, false);
      },
      update: function (dt) {
        t0 += dt;
        if (mode === "band") { updateBand(dt); flushBeats(); }
        if (mode === "roll") updateRoll(dt);
        if (mode === "animals") updateDancers(dt);
        if (mode === "echo") updateEcho(dt);
        drums.forEach(function (d) {
          d.flash *= Math.exp(-dt * 4); d.dent *= Math.exp(-dt * 14); d.hint *= Math.exp(-dt * 3);
          for (var i = d.ripples.length - 1; i >= 0; i--) { d.ripples[i].t += dt; if (d.ripples[i].t > 0.7) d.ripples.splice(i, 1); }
        });
        // the cymbal swings after a crash
        cym.v += (-cym.tilt * 60 - cym.v * 4) * dt; cym.tilt += cym.v * dt * 0.1;
        cym.tilt = clamp(cym.tilt, -0.5, 0.5);
        if (!roll) cym.shine *= Math.exp(-dt * 1.6);
        var gr = 900 * S();
        for (var i = bits.length - 1; i >= 0; i--) {
          var b = bits[i];
          b.life += dt;
          if (b.life > b.max) { bits.splice(i, 1); continue; }
          if (b.kind === "paper") { b.vx *= Math.exp(-dt * 1.8); b.vy = b.vy * Math.exp(-dt * 1.8) + gr * 0.5 * dt; b.rot += b.vr * dt; }
          else b.vy += gr * dt;
          b.x += b.vx * dt; b.y += b.vy * dt;
        }
        for (i = glows.length - 1; i >= 0; i--) { glows[i].life += dt; if (glows[i].life > glows[i].max) glows.splice(i, 1); }
        for (i = notes.length - 1; i >= 0; i--) {
          var n = notes[i]; n.life += dt; n.x += n.vx * dt + Math.sin(n.life * 3) * 0.4; n.y += n.vy * dt;
          if (n.life > n.max) notes.splice(i, 1);
        }
      },
      draw: function (g, time) {
        if (!drums[0].r) layout();
        drawBackground(g, time);
        // soft coloured glows behind the drums
        g.save(); g.globalCompositeOperation = "lighter";
        glows.forEach(function (gl) {
          var k = gl.life / gl.max, a = gl.a * (1 - k) * Math.min(1, gl.life / 0.08);
          var img = glow(gl.hue, sat(), light()), sz = gl.r * 2 * (0.8 + 0.4 * k);
          g.globalAlpha = a; g.drawImage(img, gl.x - sz / 2, gl.y - sz / 2, sz, sz);
        });
        g.globalAlpha = 1; g.restore();
        if (mode === "roll") drawCymbal(g, time);
        if (mode === "animals") {
          var baseY = H * 0.47;
          g.fillStyle = "rgba(255,255,255,0.05)"; g.fillRect(0, baseY - 2, W, 4);
          dancers.forEach(function (d) { drawDancer(g, d, baseY, time); });
        }
        if (mode === "echo") drawMonster(g, time);
        drawBlock(g);
        drawDrum(g, drums[0]); drawDrum(g, drums[1]);
        notes.forEach(function (n) { drawNote(g, n); });
        // colourful splashes and confetti
        bits.forEach(function (b) {
          var a = clamp(1 - (b.life / b.max), 0, 1);
          g.globalAlpha = Math.min(1, a * 1.6);
          g.fillStyle = "hsl(" + b.hue + "," + sat() + "%," + light() + "%)";
          if (b.kind === "paper") {
            g.save(); g.translate(b.x, b.y); g.rotate(b.rot);
            g.fillRect(-b.r / 2, -b.r * 0.3, b.r, b.r * 0.6 * Math.abs(Math.cos(b.rot * 1.3)) + 1);
            g.restore();
          } else {
            g.beginPath(); g.arc(b.x, b.y, b.r * (0.6 + 0.4 * a), 0, TAU); g.fill();
            g.fillStyle = "rgba(255,255,255,0.45)";
            g.beginPath(); g.arc(b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.25, 0, TAU); g.fill();
          }
        });
        g.globalAlpha = 1;
      }
    };
  }

  var MAKERS = { bongo: Bongos, snow: SnowGlobe, fish: FishTank, trails: LightPainting, bubbles: BubbleFloat, lamp: ColourLamp, bloom: LookAndBloom, fireworks: Fireworks };

  /* ---------- Running an activity ---------- */
  var current = null, currentInfo = null, running = false, lastT = 0, clock = 0;
  var slowFrames = 0, frames = 0;
  function loop(t) {
    if (!running) return;
    var dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016;
    // If this device struggles, draw fewer pixels so movement stays smooth.
    if (lastT && dpr > 1) {
      frames++;
      if (t - lastT > 24) slowFrames++;
      if (frames >= 90) {
        if (slowFrames > 45) { maxDpr = 1; fitCanvas(); }
        frames = slowFrames = 0;
      }
    }
    lastT = t;
    var sdt = dt * (calm() ? 0.6 : 1);
    clock += sdt;
    updateDwell(dt);
    if (hover && current.look) current.look(hover.x, hover.y, dt);
    current.update(sdt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    current.draw(ctx, clock);
    drawDwell(ctx);
    requestAnimationFrame(loop);
  }
  function startLoop() {
    if (running) return;
    running = true;
    lastT = 0;
    requestAnimationFrame(loop);
  }
  function stopLoop() { running = false; if (current && current.stop) current.stop(); } // e.g. the Snow Globe wind
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stopLoop();
    else if (current) startLoop();
  });

  /* ---------- Pointer input: touch, mouse, pen, eye gaze ---------- */
  var downs = {}, hover = null, lastPointerDown = 0;
  function pos(e) {
    var r = play.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  play.addEventListener("pointerdown", function (e) {
    if (!current) return;
    e.preventDefault();
    lastPointerDown = Date.now();
    try { play.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    var p = pos(e);
    downs[e.pointerId] = true;
    current.down(e.pointerId, p.x, p.y);
  });
  play.addEventListener("pointermove", function (e) {
    if (!current) return;
    var p = pos(e);
    var isTouch = e.pointerType === "touch";
    if (downs[e.pointerId]) { current.move(e.pointerId, p.x, p.y); return; }
    if (!isTouch) { // mouse, pen or eye gaze resting over the scene
      if (currentInfo.id === "trails") current.move("hover", p.x, p.y);
      hover = p;
      dwellMove(p);
    }
  });
  function endPointer(e) {
    if (!current) return;
    delete downs[e.pointerId];
    current.up(e.pointerId);
  }
  play.addEventListener("pointerup", endPointer);
  play.addEventListener("pointercancel", endPointer);
  play.addEventListener("pointerleave", function (e) {
    if (e.pointerType !== "touch") { hover = null; dwell = null; if (current) current.up("hover"); }
  });
  play.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  // VoiceOver and Switch Control "tap" the scene as a button: treat that as a switch press.
  play.addEventListener("click", function () {
    if (Date.now() - lastPointerDown < 700) return; // a real tap, already handled
    switchPress();
  });

  /* ---------- Dwell (eye gaze): rest the pointer to "tap" ---------- */
  var dwell = null;
  function dwellRadius() { return 36 * Math.max(1, sizeK()); }
  function dwellMove(p) {
    if (!settings.dwell) { dwell = null; return; }
    if (!dwell) { dwell = { x: p.x, y: p.y, t: 0, fired: false }; return; }
    var dx = p.x - dwell.x, dy = p.y - dwell.y;
    if (dx * dx + dy * dy > dwellRadius() * dwellRadius()) dwell = { x: p.x, y: p.y, t: 0, fired: false };
  }
  function updateDwell(dt) {
    if (!dwell || dwell.fired || !settings.dwell) return;
    dwell.t += dt;
    if (dwell.t >= settings.dwell) {
      dwell.fired = true; // look somewhere else before it happens again
      unlockAudio();
      current.dwell(dwell.x, dwell.y);
    }
  }
  function drawDwell(g) {
    if (!dwell || dwell.fired || !settings.dwell || dwell.t < 0.12) return;
    var f = clamp(dwell.t / settings.dwell, 0, 1);
    var r = 26 * Math.max(1, sizeK());
    g.lineWidth = 5;
    g.strokeStyle = "rgba(255,255,255,0.18)";
    g.beginPath(); g.arc(dwell.x, dwell.y, r, 0, TAU); g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.75)";
    g.beginPath(); g.arc(dwell.x, dwell.y, r, -Math.PI / 2, -Math.PI / 2 + f * TAU); g.stroke();
  }

  /* ---------- Keys and switches ---------- */
  var lastSwitch = 0;
  function switchPress(key) {
    if (!current) return;
    var now = Date.now();
    if (now - lastSwitch < (settings.switchGap || 0) * 1000) return;
    lastSwitch = now;
    current.press(key);
  }
  var IGNORE = { Tab: 1, Shift: 1, Control: 1, Alt: 1, Meta: 1, Escape: 1, CapsLock: 1, Fn: 1 };
  var holdTimer = null, hintTimer = null;
  function clearHold() {
    clearTimeout(holdTimer); clearTimeout(hintTimer);
    holdTimer = hintTimer = null;
    $("hold-hint").hidden = true;
  }
  document.addEventListener("keydown", function (e) {
    if (openPanel) return;
    if (IGNORE[e.key] || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (!current) { // the menu: with scanning on, any switch picks the lit activity
      if (!settings.scan || scanIndex < 0) return;
      if (t && t.closest && t.closest("button, input, select, a") && !t.closest(".card")) return;
      e.preventDefault();
      if (e.repeat) return;
      var card = document.querySelectorAll(".card")[scanIndex];
      if (card) card.click();
      return;
    }
    if (t && t !== play && t.closest && t.closest("button, input, select, a")) return; // let buttons work
    e.preventDefault();
    if (e.repeat) return; // holding a switch down counts once
    switchPress(e.key);
    if (current.hold) current.hold(true); // e.g. the Snow Globe: holding makes more snow
    // Holding the switch down goes back to the menu.
    clearHold();
    if (settings.holdSeconds > 0) {
      var extra = current.holdExtra || 0, hold = (settings.holdSeconds + extra) * 1000;
      hintTimer = setTimeout(function () { $("hold-hint").hidden = false; }, extra ? hold - 3000 : Math.min(1000, hold / 2));
      holdTimer = setTimeout(function () { clearHold(); showMenu(true); announce("Back to the activities."); }, hold);
    }
  });
  function letGo() { clearHold(); if (current && current.hold) current.hold(false); }
  document.addEventListener("keyup", letGo);
  window.addEventListener("blur", letGo);

  /* ---------- Switch scanning on the menu ---------- */
  var scanIndex = -1, scanTimer = null;
  function stopScan() {
    clearInterval(scanTimer); scanTimer = null;
    scanIndex = -1;
    document.querySelectorAll(".card.is-scan").forEach(function (c) { c.classList.remove("is-scan"); });
  }
  function scanStep() {
    var cards = document.querySelectorAll(".card");
    if (!cards.length) return;
    if (scanIndex >= 0 && cards[scanIndex]) cards[scanIndex].classList.remove("is-scan");
    scanIndex = (scanIndex + 1) % cards.length;
    var c = cards[scanIndex];
    c.classList.add("is-scan");
    c.focus({ preventScroll: true });
    if (c.scrollIntoView) c.scrollIntoView({ block: "nearest" });
  }
  function startScan() {
    stopScan();
    if (!settings.scan || current || openPanel) return;
    scanStep();
    scanTimer = setInterval(scanStep, (settings.scanSeconds || 2) * 1000);
  }

  /* ---------- Menu ---------- */
  var ART = {
    bongo: '<svg viewBox="0 0 160 90" aria-hidden="true"><defs><linearGradient id="b8" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d0f33"/><stop offset=".65" stop-color="#341545"/><stop offset="1" stop-color="#3d2412"/></linearGradient><linearGradient id="w8" x1="0" x2="1"><stop offset="0" stop-color="#3d1a08"/><stop offset=".3" stop-color="#a85a24"/><stop offset=".45" stop-color="#dc9450"/><stop offset=".65" stop-color="#9a4c1c"/><stop offset="1" stop-color="#331505"/></linearGradient><radialGradient id="k8" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fbf1d8"/><stop offset=".7" stop-color="#ecd6a6"/><stop offset="1" stop-color="#c9a66b"/></radialGradient></defs><rect width="160" height="90" fill="url(#b8)"/><rect y="70" width="160" height="20" fill="#5a3418"/>' +
      '<rect x="66" y="58" width="26" height="7" fill="#6e3412"/><path d="M24 50L29 82Q47 90 65 82L70 50Z" fill="url(#w8)"/><path d="M92 54L96 80Q110 86 124 80L128 54Z" fill="url(#w8)"/>' +
      '<ellipse cx="47" cy="50" rx="23" ry="9.5" fill="url(#k8)" stroke="#d9dce1" stroke-width="2.5"/><ellipse cx="110" cy="54" rx="18" ry="7.5" fill="url(#k8)" stroke="#d9dce1" stroke-width="2.5"/>' +
      [[40,30,5,"#ff5f8f"],[52,22,4,"#ffd65c"],[60,34,3.5,"#ff9a3d"],[30,36,3,"#ff7ad9"],[104,34,4.5,"#3fb4ff"],[116,26,3.5,"#2ee6c8"],[124,38,3,"#7f8cff"],[98,22,2.5,"#62ff9e"]].map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + p[2] + '" fill="' + p[3] + '"/>'; }).join("") +
      '<path d="M78 20v16" stroke="#fff" stroke-width="2.5"/><ellipse cx="75" cy="37" rx="4" ry="3" fill="#fff"/><path d="M78 20q6 3 5 9" fill="none" stroke="#fff" stroke-width="2.5"/></svg>',
    snow: '<svg viewBox="0 0 160 90" aria-hidden="true"><defs><linearGradient id="s7" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#040820"/><stop offset=".6" stop-color="#0d1b48"/><stop offset="1" stop-color="#26407a"/></linearGradient><radialGradient id="v7" cx=".5" cy=".48" r=".62"><stop offset=".7" stop-color="#78aae6" stop-opacity="0"/><stop offset="1" stop-color="#0a1432" stop-opacity=".6"/></radialGradient><radialGradient id="f7"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="160" height="90" fill="url(#s7)"/>' +
      '<path d="M0 90V56Q30 50 60 55T120 52T160 54V90Z" fill="#5a6fa0"/><path d="M14 64L22 46L30 64ZM132 62L141 42L150 62Z" fill="#1d6a44"/><path d="M0 90V68Q40 62 80 68T160 66V90Z" fill="#e8f0fb"/>' +
      '<rect x="96" y="54" width="24" height="15" fill="#a8553a"/><path d="M93 55L108 44L123 55Z" fill="#f6faff"/><rect x="100" y="58" width="6" height="5" fill="#ffd27a"/><circle cx="44" cy="63" r="6" fill="#fff"/><circle cx="44" cy="54" r="4.3" fill="#fff"/><circle cx="44" cy="47" r="3.2" fill="#fff"/>' +
      [[12,14,3],[30,30,4.5],[55,12,2.5],[70,38,5.5],[86,20,3],[104,32,4],[124,14,3.5],[140,34,5],[150,18,2.5],[24,48,3],[62,58,4],[130,70,5],[84,76,3.5],[40,24,2]].map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + p[2] + '" fill="url(#f7)"/>'; }).join("") +
      '<rect width="160" height="90" fill="url(#v7)"/><path d="M18 46A76 50 0 0 1 52 8" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="3.5" stroke-linecap="round"/></svg>',
    peek: '<img src="../home/thumbs/peek-and-find.jpg" alt="" style="width:100%;height:100%;object-fit:cover;display:block">',
    fireworks: '<svg viewBox="0 0 160 90" aria-hidden="true"><defs><filter id="a6" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.2"/></filter></defs><rect width="160" height="90" fill="#070a22"/><g filter="url(#a6)" stroke-linecap="round" stroke-width="2.5">' +
      [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(function (a) {
        var r = a * Math.PI / 180;
        return '<line x1="' + (60 + Math.cos(r) * 8).toFixed(1) + '" y1="' + (36 + Math.sin(r) * 8).toFixed(1) + '" x2="' + (60 + Math.cos(r) * 22).toFixed(1) + '" y2="' + (36 + Math.sin(r) * 22).toFixed(1) + '" stroke="#ff7ad9"/>' +
               '<line x1="' + (115 + Math.cos(r) * 5).toFixed(1) + '" y1="' + (28 + Math.sin(r) * 5).toFixed(1) + '" x2="' + (115 + Math.cos(r) * 14).toFixed(1) + '" y2="' + (28 + Math.sin(r) * 14).toFixed(1) + '" stroke="#ffd65c"/>';
      }).join("") + '</g><path d="M0 90V80L30 76L70 81L110 75L160 79V90Z" fill="#03050f"/></svg>',
    // SG's reef background and fish (made from images/fish-background.jpg and images/fish/).
    fish: '<img src="images/thumb-fish.jpg" alt="" style="width:100%;height:100%;object-fit:cover;display:block">',
    trails: '<svg viewBox="0 0 160 90" aria-hidden="true"><defs><filter id="a1" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="2.5"/></filter><linearGradient id="g1" x1="0" x2="1"><stop offset="0" stop-color="#ff5fae"/><stop offset=".5" stop-color="#ffd65c"/><stop offset="1" stop-color="#3fd0ff"/></linearGradient></defs><rect width="160" height="90" fill="#080c22"/><path d="M15 62C40 10 70 85 92 42S135 20 148 34" fill="none" stroke="url(#g1)" stroke-width="9" stroke-linecap="round" filter="url(#a1)"/><path d="M15 62C40 10 70 85 92 42S135 20 148 34" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2.5" stroke-linecap="round"/><circle cx="118" cy="66" r="12" fill="none" stroke="#9fe8ff" stroke-opacity=".5" stroke-width="2"/><circle cx="118" cy="66" r="20" fill="none" stroke="#9fe8ff" stroke-opacity=".25" stroke-width="2"/></svg>',
    bubbles: '<svg viewBox="0 0 160 90" aria-hidden="true"><defs><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d3b58"/><stop offset="1" stop-color="#04101f"/></linearGradient><radialGradient id="b2" cx=".5" cy=".5" r=".5"><stop offset=".7" stop-color="#bfe9ff" stop-opacity=".05"/><stop offset="1" stop-color="#d9f3ff" stop-opacity=".6"/></radialGradient></defs><rect width="160" height="90" fill="url(#g2)"/><g stroke="#e8c8ff" stroke-opacity=".8" stroke-width="1.5" fill="url(#b2)"><circle cx="50" cy="52" r="20"/><circle cx="96" cy="32" r="14"/><circle cx="122" cy="62" r="10"/><circle cx="78" cy="72" r="7"/></g><g fill="#fff" fill-opacity=".85"><ellipse cx="42" cy="44" rx="6" ry="3.5" transform="rotate(-35 42 44)"/><ellipse cx="91" cy="27" rx="4" ry="2.5" transform="rotate(-35 91 27)"/><ellipse cx="119" cy="58" rx="3" ry="2" transform="rotate(-35 119 58)"/></g></svg>',
    lamp: '<svg viewBox="0 0 160 90" aria-hidden="true"><defs><filter id="a3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter></defs><rect width="160" height="90" fill="#14072b"/><g filter="url(#a3)"><circle cx="55" cy="40" r="26" fill="#9b4dff"/><circle cx="100" cy="52" r="24" fill="#ff7ad9"/><circle cx="80" cy="25" r="16" fill="#4b5cff"/><circle cx="125" cy="30" r="12" fill="#2ee6c8"/></g></svg>',
    bloom: '<svg viewBox="0 0 160 90" aria-hidden="true"><defs><radialGradient id="g4"><stop offset="0" stop-color="#ff7ab8" stop-opacity=".55"/><stop offset="1" stop-color="#ff7ab8" stop-opacity="0"/></radialGradient></defs><rect width="160" height="90" fill="#071226"/><path d="M0 90V78Q40 70 80 77T160 74V90Z" fill="#08231a"/><circle cx="72" cy="44" r="34" fill="url(#g4)"/><g transform="translate(72 44)" fill="#ff7ab8">' +
      [0, 60, 120, 180, 240, 300].map(function (a) { return '<ellipse cx="0" cy="-12" rx="6" ry="12" transform="rotate(' + a + ')"/>'; }).join("") +
      '<circle r="6" fill="#ffd65c"/></g><g transform="translate(124 30) scale(.55)" fill="#7fb6ff">' +
      [0, 72, 144, 216, 288].map(function (a) { return '<ellipse cx="0" cy="-12" rx="6" ry="12" transform="rotate(' + a + ')"/>'; }).join("") +
      '<circle r="6" fill="#ffd65c"/></g><circle cx="30" cy="30" r="2" fill="#fff59e" opacity=".8"/><circle cx="140" cy="62" r="1.6" fill="#fff59e" opacity=".7"/></svg>'
  };
  function buildMenu() {
    var list = $("cards");
    cfg.activities.forEach(function (a) {
      if (!MAKERS[a.id] && !a.href) return;
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.className = "card";
      b.dataset.id = a.id;
      b.innerHTML = '<span class="card-art">' + (ART[a.id] || "") + '</span>' +
        '<span class="card-text"><span class="card-name"></span><span class="card-hint"></span></span>';
      b.querySelector(".card-name").textContent = a.name;
      b.querySelector(".card-hint").textContent = a.hint;
      b.addEventListener("click", function () {
        if (a.href) { location.href = a.href; return; }
        openActivity(a.id, true);
      });
      li.appendChild(b);
      list.appendChild(li);
    });
  }
  function infoFor(id) {
    for (var i = 0; i < cfg.activities.length; i++) if (cfg.activities[i].id === id) return cfg.activities[i];
    return null;
  }
  function openActivity(id, push) {
    var info = infoFor(id);
    if (!info || !MAKERS[id]) { showMenu(false); return; }
    if (push) {
      var q = new URLSearchParams(location.search);
      q.set("activity", id);
      try { history.pushState({ activity: id }, "", "?" + q.toString()); } catch (e) { /* ignore */ }
    }
    stopScan();
    clearHold();
    currentInfo = info;
    $("menu").hidden = true;
    play.hidden = false;
    $("btn-menu").hidden = false;
    root.classList.add("in-activity");
    $("status").textContent = info.name + ": " + info.hint;
    play.setAttribute("aria-label", info.label || info.name);
    document.title = info.name + " - " + cfg.title;
    W = H = 0;
    fitCanvas();
    downs = {}; hover = null; dwell = null;
    if (current && current.stop) current.stop();
    current = MAKERS[id](info);
    current.start();
    if (current.hint) $("status").textContent = info.name + ": " + current.hint; // e.g. the bongo game chosen in Settings
    if (current.label) play.setAttribute("aria-label", current.label);
    clock = 0;
    startLoop();
    play.focus();
  }
  function showMenu(push) {
    stopLoop();
    var wasIn = !!current;
    current = null;
    currentInfo = null;
    play.hidden = true;
    $("menu").hidden = false;
    $("btn-menu").hidden = true;
    root.classList.remove("in-activity");
    $("status").textContent = "Choose an activity";
    document.title = cfg.title;
    if (push) {
      var q = new URLSearchParams(location.search);
      q.delete("activity");
      var s = q.toString();
      try { history.pushState({}, "", s ? "?" + s : location.pathname); } catch (e) { /* ignore */ }
    }
    if (wasIn) { var first = document.querySelector(".card"); if (first) first.focus(); }
    startScan();
  }
  window.addEventListener("popstate", function () {
    var id = new URLSearchParams(location.search).get("activity");
    if (id && MAKERS[id]) openActivity(id, false); else showMenu(false);
  });

  /* ---------- Panels ---------- */
  var openPanel = null, returnFocus = null;
  function showPanel(id, opener) {
    openPanel = $(id);
    returnFocus = opener || document.activeElement;
    openPanel.hidden = false;
    stopScan();
    $("app").setAttribute("aria-hidden", "true");
    var heading = openPanel.querySelector("h2");
    setTimeout(function () { heading.focus(); }, 30);
  }
  function hidePanel() {
    if (!openPanel) return;
    openPanel.hidden = true;
    openPanel = null;
    $("app").removeAttribute("aria-hidden");
    if (returnFocus && returnFocus.focus && !returnFocus.hidden && returnFocus.offsetParent !== null) returnFocus.focus();
    else if (current) play.focus();
    if (!current) startScan();
  }
  document.querySelectorAll(".overlay").forEach(function (ov) {
    ov.addEventListener("click", function (e) {
      if (e.target === ov || e.target.closest("[data-close]")) hidePanel();
    });
  });
  document.addEventListener("keydown", function (e) {
    if (!openPanel) return;
    if (e.key === "Escape") {
      e.preventDefault();
      if (openPanel.id === "panel-pictures" && window.SensoryPictures && window.SensoryPictures.canEdit()) window.SensoryPictures.cancelEdit();
      else hidePanel();
      return;
    }
    if (e.key === "Tab") { // keep focus inside the open panel
      var items = openPanel.querySelectorAll("button, input, select");
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
  function selectValue(sel, value) {
    var best = sel.options[0], bestD = Infinity;
    for (var i = 0; i < sel.options.length; i++) {
      var d = Math.abs(parseFloat(sel.options[i].value) - value);
      if (d < bestD) { bestD = d; best = sel.options[i]; }
    }
    sel.value = best.value;
  }
  function bindSettings() {
    var sound = $("set-sound"), vol = $("set-volume"), calmBox = $("set-calm"),
        size = $("set-size"), dw = $("set-dwell"), gap = $("set-gap"),
        scan = $("set-scan"), scanSpeed = $("set-scan-speed"), hold = $("set-hold");
    scan.checked = !!settings.scan;
    selectValue(scanSpeed, settings.scanSeconds || 2);
    selectValue(hold, settings.holdSeconds || 0);
    scan.addEventListener("change", function () { settings.scan = scan.checked; saveSettings(); });
    scanSpeed.addEventListener("change", function () { settings.scanSeconds = parseFloat(scanSpeed.value); saveSettings(); });
    hold.addEventListener("change", function () { settings.holdSeconds = parseFloat(hold.value); saveSettings(); });
    sound.checked = !!settings.sound;
    vol.value = settings.volume;
    vol.setAttribute("aria-valuetext", settings.volume + " percent");
    calmBox.checked = !!settings.calm;
    selectValue(size, settings.size || 1);
    selectValue(dw, settings.dwell || 0);
    selectValue(gap, settings.switchGap || 0);
    sound.addEventListener("change", function () { settings.sound = sound.checked; saveSettings(); applyVolume(); });
    vol.addEventListener("input", function () {
      settings.volume = parseInt(vol.value, 10);
      vol.setAttribute("aria-valuetext", settings.volume + " percent");
      saveSettings(); applyVolume();
    });
    vol.addEventListener("change", function () { chime(noteFreq(7), { gain: 0.2 }); });
    calmBox.addEventListener("change", function () { settings.calm = calmBox.checked; saveSettings(); applyVolume(); });
    size.addEventListener("change", function () { settings.size = parseFloat(size.value); saveSettings(); });
    dw.addEventListener("change", function () { settings.dwell = parseFloat(dw.value); dwell = null; saveSettings(); });
    gap.addEventListener("change", function () { settings.switchGap = parseFloat(gap.value); saveSettings(); });
    var bMode = $("set-bongo-mode"), bSwitch = $("set-bongo-switch");
    if (bMode) {
      bMode.value = bongoMode();
      bMode.addEventListener("change", function () {
        settings.bongoMode = bMode.value; saveSettings();
        if (currentInfo && currentInfo.id === "bongo") openActivity("bongo", false); // start the new game straight away
      });
    }
    if (bSwitch) {
      bSwitch.value = settings.bongoSwitch || "turns";
      bSwitch.addEventListener("change", function () { settings.bongoSwitch = bSwitch.value; saveSettings(); });
    }
    var snowSnd = $("set-snow-sound");
    if (snowSnd) {
      snowSnd.value = settings.snowSound || "wind"; // (a word, not a number)
      snowSnd.addEventListener("change", function () { settings.snowSound = snowSnd.value; saveSettings(); });
    }
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
    if (on && !wasOn) announce("Full screen. To leave, use the Exit full screen button in the top corner.");
    else if (!on && wasOn) $("btn-fullscreen").focus();
    setTimeout(fitCanvas, 60);
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
  $("title").textContent = cfg.title;
  buildMenu();
  bindSettings();
  $("btn-menu").addEventListener("click", function () { showMenu(true); });
  $("btn-settings").addEventListener("click", function (e) { showPanel("panel-settings", e.currentTarget); });
  $("btn-pictures").addEventListener("click", function (e) {
    if (window.SensoryPictures) window.SensoryPictures.opened();
    showPanel("panel-pictures", e.currentTarget);
  });
  if (window.SensoryPictures) {
    window.SensoryPictures.init({ settings: settings, save: saveSettings, onChange: function () {} });
  } else {
    $("btn-pictures").hidden = true;
  }
  if (isStandalone()) { pseudoFs = true; updateFsButton(); }
  $("btn-fullscreen").addEventListener("click", toggleFullscreen);
  $("btn-exit-fs").addEventListener("click", toggleFullscreen);

  if (window.ResizeObserver) new ResizeObserver(function () { if (current) fitCanvas(); }).observe(play);
  window.addEventListener("resize", function () { if (current) fitCanvas(); });

  var startId = params.get("activity");
  if (startId && MAKERS[startId]) openActivity(startId, false);
  else startScan();
})();
