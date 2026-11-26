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
          g.drawImage(sprite(b.hue), b.x - r, b.y - r, r * 2, r * 2);
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
     Activity 3: Colour Lamp
     ===================================================================== */
  function ColourLamp() {
    var colours = cfg.lampColours;
    var index = 0, from = null, to = null, mix = 1;
    var blobs = [], small = document.createElement("canvas"), sg = small.getContext("2d");
    function hexToRgb(h) {
      var n = parseInt(h.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function paletteRgb(p) { return { bg: hexToRgb(p.bg), c: p.colours.map(hexToRgb) }; }
    function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
    function now() {
      return {
        bg: lerp(from.bg, to.bg, easeOut(mix)),
        c: to.c.map(function (c, i) { return lerp(from.c[i % from.c.length], c, easeOut(mix)); })
      };
    }
    function rgb(c, a) { return "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + "," + a + ")"; }
    function next(x, y) {
      var cur = now();
      index = (index + 1) % colours.length;
      from = cur;
      to = paletteRgb(colours[index]);
      mix = 0;
      // A soft chord that changes with the colour.
      var base = [0, 2, 4, 1, 3, 5][index % 6];
      [0, 2, 4].forEach(function (s, i) {
        chime(noteFreq(base + s + 3), { type: "pad", gain: 0.12, attack: 0.5, decay: 3, delay: 0.001 + i * 0.05 });
      });
      announce(colours[index].name);
    }
    return {
      start: function () {
        index = Math.floor(rand(0, colours.length));
        from = to = paletteRgb(colours[index]);
        mix = 1;
        blobs = [];
        for (var i = 0; i < 7; i++) {
          blobs.push({ ax: rand(0.15, 0.35), ay: rand(0.2, 0.4), fx: rand(0.05, 0.12), fy: rand(0.04, 0.1),
                       px: rand(0, TAU), py: rand(0, TAU), r: rand(0.22, 0.38), c: i });
        }
        setTimeout(function () { announce(colours[index].name); }, 1200);
      },
      down: function (id, x, y) { next(x, y); },
      move: function () {},
      up: function () {},
      dwell: function (x, y) { next(x, y); },
      press: function () { next(); },
      update: function (dt) { mix = Math.min(1, mix + dt / 2.5); }, // 2.5 s fade, never a flash
      draw: function (g, time) {
        var sw = Math.max(40, Math.round(W / 8)), sh = Math.max(30, Math.round(H / 8));
        if (small.width !== sw || small.height !== sh) { small.width = sw; small.height = sh; }
        var p = now(), t = time * (calm() ? 0.5 : 1);
        sg.globalCompositeOperation = "source-over";
        sg.fillStyle = rgb(p.bg, 1);
        sg.fillRect(0, 0, sw, sh);
        sg.globalCompositeOperation = "lighter";
        var m = Math.min(sw, sh);
        blobs.forEach(function (b, i) {
          var x = sw * (0.5 + Math.sin(t * b.fx * TAU * 0.25 + b.px) * b.ax);
          var y = sh * (0.5 + Math.sin(t * b.fy * TAU * 0.25 + b.py) * b.ay);
          var r = m * b.r * (1 + 0.12 * Math.sin(t * 0.3 + i));
          var c = p.c[b.c % p.c.length];
          var grad = sg.createRadialGradient(x, y, 0, x, y, r);
          grad.addColorStop(0, rgb(c, calm() ? 0.5 : 0.7));
          grad.addColorStop(0.5, rgb(c, calm() ? 0.22 : 0.32));
          grad.addColorStop(1, rgb(c, 0));
          sg.fillStyle = grad;
          sg.beginPath(); sg.arc(x, y, r, 0, TAU); sg.fill();
        });
        // Scaling the small picture up blurs it into a smooth glow.
        g.imageSmoothingEnabled = true;
        if ("imageSmoothingQuality" in g) g.imageSmoothingQuality = "high";
        g.drawImage(small, 0, 0, W, H);
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

  var MAKERS = { trails: LightPainting, bubbles: BubbleFloat, lamp: ColourLamp, bloom: LookAndBloom };

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
      if (card) openActivity(card.dataset.id, true);
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
      if (!MAKERS[a.id]) return;
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.className = "card";
      b.dataset.id = a.id;
      b.innerHTML = '<span class="card-art">' + (ART[a.id] || "") + '</span>' +
        '<span class="card-text"><span class="card-name"></span><span class="card-hint"></span></span>';
      b.querySelector(".card-name").textContent = a.name;
      b.querySelector(".card-hint").textContent = a.hint;
      b.addEventListener("click", function () { openActivity(a.id, true); });
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
