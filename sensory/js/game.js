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
    // The background picture (config.js fishBackground). Calm mode uses the plainer drawn tank.
    var photo = null;
    if (cfg.fishBackground) { photo = new Image(); photo.src = cfg.fishBackground; }
    function usePhoto() { return !calm() && ready(photo); }
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
          veil.addColorStop(0, "rgba(10,70,110,0.08)");
          veil.addColorStop(0.5, "rgba(10,70,110,0.22)");
          veil.addColorStop(1, "rgba(6,40,70,0.42)");
          g.fillStyle = veil;
          g.fillRect(0, 0, W, H);
        } else {
          var bg = g.createLinearGradient(0, 0, 0, H);
          bg.addColorStop(0, calm() ? "#1a5470" : "#1b6f95");
          bg.addColorStop(0.6, calm() ? "#0f3a55" : "#0f4a6e");
          bg.addColorStop(1, "#082338");
          g.fillStyle = bg;
          g.fillRect(0, 0, W, H);
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

  var MAKERS = { fish: FishTank, trails: LightPainting, bubbles: BubbleFloat, lamp: ColourLamp, bloom: LookAndBloom, fireworks: Fireworks };

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
  function stopLoop() { running = false; }
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
  function switchPress() {
    if (!current) return;
    var now = Date.now();
    if (now - lastSwitch < (settings.switchGap || 0) * 1000) return;
    lastSwitch = now;
    current.press();
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
    switchPress();
    // Holding the switch down goes back to the menu.
    clearHold();
    if (settings.holdSeconds > 0) {
      var hold = settings.holdSeconds * 1000;
      hintTimer = setTimeout(function () { $("hold-hint").hidden = false; }, Math.min(1000, hold / 2));
      holdTimer = setTimeout(function () { clearHold(); showMenu(true); announce("Back to the activities."); }, hold);
    }
  });
  document.addEventListener("keyup", clearHold);
  window.addEventListener("blur", clearHold);

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
    current = MAKERS[id](info);
    current.start();
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
