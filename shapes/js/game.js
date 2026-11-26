/* Shape Explorer: a partner-assisted yes / not yes game about 3D shapes.
   The student answers in their own way (for example a long blink = yes). The adult presses
   Yes or Not yes for them, or uses one switch where "no press before the wait ends" = not yes.
   Nothing here needs fast timing from the student. Everything is drawn in the browser (no art files). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var params = new URLSearchParams(location.search);
  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Settings (saved on this device) and progress ---------- */
  var SKEY = "shape-explorer-settings", PKEY = "shape-explorer-progress";
  function load(key) { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; } }
  function store(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  var defaults = {
    answer: "two", wait: 10, keys: "enter-yes", gap: 0.5,
    faces: true, edges: true, vertices: true, vword: "vertices", allShapes: false,
    voice: true, rate: 0.85, sounds: true, volume: 60, spin: reduceMotion ? 0 : 1, contrast: false
  };
  var settings = Object.assign({}, defaults, load(SKEY));
  function saveSettings() { store(SKEY, settings); }
  // Teacher links (not saved): ?mode=quiz|count|build|explore&answer=one|two&wait=10&spin=0|1|2&voice=0&all=1
  if (params.get("answer") === "one" || params.get("answer") === "two") settings.answer = params.get("answer");
  var pw = Number(params.get("wait")); if (pw >= 3 && pw <= 60) settings.wait = pw;
  if (params.get("voice") === "0") settings.voice = false;
  if (params.has("spin") && /^[012]$/.test(params.get("spin"))) settings.spin = Number(params.get("spin"));
  if (params.get("all") === "1") settings.allShapes = true;
  if (params.get("vword") === "corners" || params.get("vword") === "vertices") settings.vword = params.get("vword");

  var progress = Object.assign({ points: 0, level: 1, step: 0 }, load(PKEY));
  function saveProgress() { store(PKEY, progress); }

  /* ---------- 3D shapes ---------- */
  function ring(n, r, y, rot) {
    var a = [];
    for (var i = 0; i < n; i++) { var t = rot + i * 2 * Math.PI / n; a.push([r * Math.cos(t), y, r * Math.sin(t)]); }
    return a;
  }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function newell(pts) {
    var n = [0, 0, 0];
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      n[0] += (a[1] - b[1]) * (a[2] + b[2]);
      n[1] += (a[2] - b[2]) * (a[0] + b[0]);
      n[2] += (a[0] - b[0]) * (a[1] + b[1]);
    }
    var l = Math.sqrt(dot(n, n)) || 1;
    return [n[0] / l, n[1] / l, n[2] / l];
  }
  function centroid(pts) {
    var c = [0, 0, 0];
    pts.forEach(function (p) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; });
    return [c[0] / pts.length, c[1] / pts.length, c[2] / pts.length];
  }
  // Make every face point outward, list which faces touch each edge, and centre the shape.
  function finish(m) {
    var c = centroid(m.v);
    m.v = m.v.map(function (p) { return sub(p, c); });
    m.f.forEach(function (face, i) {
      if (face.g === undefined) face.g = i;
      var pts = face.p.map(function (k) { return m.v[k]; });
      if (dot(newell(pts), centroid(pts)) < 0) face.p.reverse();
    });
    var key = function (a, b) { return a < b ? a + "-" + b : b + "-" + a; };
    var touch = {};
    m.f.forEach(function (face, fi) {
      for (var i = 0; i < face.p.length; i++) {
        var k = key(face.p[i], face.p[(i + 1) % face.p.length]);
        (touch[k] = touch[k] || []).push(fi);
      }
    });
    m.e = m.e || [];
    m.adj = m.e.map(function (e) { return touch[key(e[0], e[1])] || []; });
    m.r = 0;
    m.v.forEach(function (p) { m.r = Math.max(m.r, Math.sqrt(dot(p, p))); });
    m.groups = 0;
    m.f.forEach(function (f) { m.groups = Math.max(m.groups, f.g + 1); });
    m.gcenter = [];
    for (var g = 0; g < m.groups; g++) {
      var vs = [];
      m.f.forEach(function (f) { if (f.g === g) f.p.forEach(function (k) { vs.push(m.v[k]); }); });
      m.gcenter.push(centroid(vs));
    }
    return m;
  }
  function prism(n, r, h, rot) {
    var v = ring(n, r, -h, rot).concat(ring(n, r, h, rot));
    var f = [], e = [], i;
    f.push({ p: range(n) });
    f.push({ p: range(n).map(function (k) { return n + k; }) });
    for (i = 0; i < n; i++) f.push({ p: [i, (i + 1) % n, n + (i + 1) % n, n + i] });
    for (i = 0; i < n; i++) e.push([i, (i + 1) % n]);
    for (i = 0; i < n; i++) e.push([n + i, n + (i + 1) % n]);
    for (i = 0; i < n; i++) e.push([i, n + i]);
    return { v: v, f: f, e: e };
  }
  function pyramid(n, r, yb, yt, rot) {
    var v = ring(n, r, yb, rot).concat([[0, yt, 0]]);
    var f = [{ p: range(n) }], e = [], i;
    for (i = 0; i < n; i++) f.push({ p: [i, (i + 1) % n, n] });
    for (i = 0; i < n; i++) e.push([i, (i + 1) % n]);
    for (i = 0; i < n; i++) e.push([i, n]);
    return { v: v, f: f, e: e };
  }
  function box(sx, sy, sz) {
    var m = prism(4, Math.SQRT2, 1, Math.PI / 4);
    m.v = m.v.map(function (p) { return [p[0] * sx, p[1] * sy, p[2] * sz]; });
    return m;
  }
  function octahedron() {
    var s = 1.25;
    var v = [[s, 0, 0], [0, 0, s], [-s, 0, 0], [0, 0, -s], [0, s, 0], [0, -s, 0]];
    var f = [], e = [], i;
    for (i = 0; i < 4; i++) f.push({ p: [i, (i + 1) % 4, 4] });
    for (i = 0; i < 4; i++) f.push({ p: [i, (i + 1) % 4, 5] });
    for (i = 0; i < 4; i++) e.push([i, (i + 1) % 4]);
    for (i = 0; i < 4; i++) e.push([i, 4]);
    for (i = 0; i < 4; i++) e.push([i, 5]);
    return { v: v, f: f, e: e };
  }
  function cylinder() {
    var n = 40, m = prism(n, 0.95, 0.95, 0);
    m.f.forEach(function (f, i) { f.g = i < 2 ? i : 2; });
    m.e = m.e.slice(0, 2 * n);
    m.curved = true;
    return m;
  }
  function cone() {
    var n = 40, m = pyramid(n, 1.05, -0.85, 1.15, 0);
    m.f.forEach(function (f, i) { f.g = i < 1 ? 0 : 1; });
    m.e = m.e.slice(0, n);
    m.curved = true;
    return m;
  }
  function sphere() {
    var lat = 22, lon = 40, r = 1.15, v = [], f = [], i, j;
    for (i = 0; i <= lat; i++) {
      var th = Math.PI * i / lat;
      for (j = 0; j < lon; j++) {
        var ph = 2 * Math.PI * j / lon;
        v.push([r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph)]);
      }
    }
    for (i = 0; i < lat; i++) {
      for (j = 0; j < lon; j++) {
        var a = i * lon + j, b = i * lon + (j + 1) % lon, c = (i + 1) * lon + (j + 1) % lon, d = (i + 1) * lon + j;
        f.push({ p: i === 0 ? [a, c, d] : i === lat - 1 ? [a, b, d] : [a, b, c, d], g: 0 });
      }
    }
    return { v: v, f: f, e: [], curved: true, ball: r };
  }
  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }

  // The game's shapes. level = the level that unlocks it.
  var SHAPES = {
    cube:       { name: "cube", a: "a", level: 1, color: "#5b8def", make: function () { return box(1, 1, 1); }, faces: 6, edges: 12, vertices: 8, rolls: false, point: false, tri: false, square: true },
    sphere:     { name: "sphere", a: "a", level: 1, color: "#e8708f", make: sphere, curved: true, rolls: true, point: false, tri: false, square: false },
    cylinder:   { name: "cylinder", a: "a", level: 1, color: "#3fb6a8", make: cylinder, curved: true, rolls: true, point: false, tri: false, square: false },
    cone:       { name: "cone", a: "a", level: 1, color: "#f2a33a", make: cone, curved: true, rolls: true, point: true, tri: false, square: false },
    sqPyramid:  { name: "square pyramid", a: "a", level: 2, color: "#e9c84a", still: 0.2, make: function () { return pyramid(4, 1.25, -0.8, 1.05, Math.PI / 4); }, faces: 5, edges: 8, vertices: 5, rolls: false, point: true, tri: true, square: true },
    triPrism:   { name: "triangular prism", a: "a", level: 3, color: "#9b7bea", still: 0.45, make: function () { var m = prism(3, 0.95, 1.25, 0); m.v = m.v.map(function (p) { return [p[1], p[0], p[2]]; }); return m; }, faces: 5, edges: 9, vertices: 6, rolls: false, point: false, tri: true, square: false },
    cuboid:     { name: "rectangular prism", a: "a", level: 4, color: "#4fb0e6", make: function () { return box(1.35, 0.62, 0.85); }, faces: 6, edges: 12, vertices: 8, rolls: false, point: false, tri: false, square: false },
    triPyramid: { name: "triangular pyramid", a: "a", level: 5, color: "#ef8a5b", still: 0.2, make: function () { return pyramid(3, 1.25, -0.6, 1.15, Math.PI / 2); }, faces: 4, edges: 6, vertices: 4, rolls: false, point: true, tri: true, square: false },
    hexPrism:   { name: "hexagonal prism", a: "a", level: 6, color: "#62c46e", make: function () { return prism(6, 1.05, 0.7, 0); }, faces: 8, edges: 18, vertices: 12, rolls: false, point: false, tri: false, square: false },
    pentPrism:  { name: "pentagonal prism", a: "a", level: 7, color: "#d98ad6", make: function () { return prism(5, 1.05, 0.75, -Math.PI / 2); }, faces: 7, edges: 15, vertices: 10, rolls: false, point: false, tri: false, square: false },
    octahedron: { name: "octahedron", a: "an", level: 8, color: "#56c2c9", make: octahedron, faces: 8, edges: 12, vertices: 6, rolls: false, point: null, tri: true, square: false }
  };
  var ORDER = ["cube", "sphere", "cylinder", "cone", "sqPyramid", "triPrism", "cuboid", "triPyramid", "hexPrism", "pentPrism", "octahedron"];
  var MAX_LEVEL = 8, PER_LEVEL = 5;
  var meshCache = {};
  function meshFor(key) {
    if (!meshCache[key]) meshCache[key] = finish(SHAPES[key].make());
    return meshCache[key];
  }
  function unlocked() {
    return ORDER.filter(function (k) { return settings.allShapes || SHAPES[k].level <= progress.level; });
  }
  function solids() { return unlocked().filter(function (k) { return !SHAPES[k].curved; }); }
  function aName(key) { var s = SHAPES[key]; return s.a + " " + s.name; }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function vword(what) { return what === "vertices" ? settings.vword : what; }

  /* ---------- Drawing ---------- */
  var canvas = $("canvas"), ctx = canvas.getContext("2d");
  var view = { key: null, mesh: null, color: "#5b8def", glass: false, spin: true, angle: 0.6, appear: 1, appearStart: 0, hl: null };
  var dpr = 1, cw = 0, ch = 0;
  function fitCanvas() {
    var r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = Math.max(1, Math.round(r.width * dpr)); ch = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  }
  function setMesh(key, mesh, color, label) {
    var changed = view.mesh !== mesh;
    view.key = key; view.mesh = mesh; view.color = color;
    if (changed && !reduceMotion) { view.appear = 0; view.appearStart = performance.now(); }
    $("shape-name").textContent = label || "";
    canvas.setAttribute("aria-label", label ? "A " + label.toLowerCase() : "A 3D shape");
  }
  function showShape(key, named) {
    if (!settings.spin && view.key !== key) view.angle = SHAPES[key].still || 0.6;
    setMesh(key, meshFor(key), SHAPES[key].color, named ? cap(SHAPES[key].name) : "");
  }
  function hexToRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  var LIGHT = (function () { var l = [-0.45, 0.65, 0.62], s = Math.sqrt(dot(l, l)); return [l[0] / s, l[1] / s, l[2] / s]; })();
  var lastT = 0;
  function frame(t) {
    var dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0;
    lastT = t;
    var speed = [0, 0.28, 0.6][settings.spin] || 0;
    if (view.spin && speed) view.angle += dt * speed;
    draw(t);
    requestAnimationFrame(frame);
  }
  function draw(t) {
    fitCanvas();
    ctx.clearRect(0, 0, cw, ch);
    var m = view.mesh;
    if (!m) return;
    var hc = root.classList.contains("hc");
    var a = view.angle, tilt = view.tilt || 0.42;
    var ca = Math.cos(a), sa = Math.sin(a), ct = Math.cos(tilt), st = Math.sin(tilt);
    var ease = 1;
    if (view.appear < 1) {
      view.appear = Math.min(1, (t - view.appearStart) / 450);
      ease = 0.82 + 0.18 * (1 - Math.pow(1 - view.appear, 3));
    }
    var D = 7, scale = Math.min(cw, ch * 1.05) * 0.33 / m.r * ease;
    var cx = cw / 2, cy = ch * 0.53;
    var P = m.v.map(function (p) {
      var x = p[0] * ca + p[2] * sa, z = -p[0] * sa + p[2] * ca, y = p[1];
      var y2 = y * ct - z * st, z2 = y * st + z * ct;
      return [x, y2, z2];
    });
    var S2 = P.map(function (p) { var s = scale * D / (D - p[2]); return [cx + p[0] * s, cy - p[1] * s]; });
    var base = hexToRgb(hc ? "#ffffff" : view.color);
    if (m.ball) { // a smooth ball looks better than lots of little faces
      var br = scale * m.ball * D / Math.sqrt(D * D - m.ball * m.ball);
      var lift = function (k) { return "rgb(" + Math.round(Math.min(255, base[0] * k)) + "," + Math.round(Math.min(255, base[1] * k)) + "," + Math.round(Math.min(255, base[2] * k)) + ")"; };
      var gr = ctx.createRadialGradient(cx - br * 0.38, cy - br * 0.42, br * 0.05, cx, cy, br);
      gr.addColorStop(0, lift(hc ? 0.75 : 1.18)); gr.addColorStop(0.55, lift(hc ? 0.45 : 0.82)); gr.addColorStop(1, lift(hc ? 0.18 : 0.42));
      ctx.beginPath(); ctx.arc(cx, cy, br, 0, Math.PI * 2); ctx.fillStyle = gr; ctx.fill();
      return;
    }
    var faces = m.f.map(function (f, i) {
      var pts = f.p.map(function (k) { return P[k]; });
      var n = newell(pts), c = centroid(pts);
      var front = dot(n, sub([0, 0, D], c)) > 0;
      return { i: i, g: f.g, p: f.p, n: n, z: c[2], front: front };
    });
    var hl = view.hl, glass = view.glass;
    var counted = function (kind, idx) { return hl && hl.kind === kind && idx < hl.upto; };
    var current = function (kind, idx) { return hl && hl.kind === kind && idx === hl.upto - 1; };
    faces.sort(function (p, q) { return p.z - q.z; });
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    faces.forEach(function (f) {
      if (!glass && !f.front) return;
      var lit = 0.38 + 0.62 * Math.max(0, dot(f.n, LIGHT));
      if (hc) lit = 0.15 + 0.35 * Math.max(0, dot(f.n, LIGHT));
      var col = "rgb(" + Math.round(base[0] * lit) + "," + Math.round(base[1] * lit) + "," + Math.round(base[2] * lit) + ")";
      var alpha = 1;
      if (glass) alpha = f.front ? 0.34 : 0.16;
      if (counted("faces", f.g)) { col = current("faces", f.g) ? "#ffd23f" : "#c9a52c"; alpha = current("faces", f.g) ? 0.92 : 0.6; }
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      f.p.forEach(function (k, j) { var s = S2[k]; if (j) ctx.lineTo(s[0], s[1]); else ctx.moveTo(s[0], s[1]); });
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      if (m.curved && !glass) { ctx.strokeStyle = col; ctx.lineWidth = 1.2 * dpr; ctx.stroke(); } // hide seams on curved surfaces
    });
    ctx.globalAlpha = 1;
    // Edges
    var frontOf = {};
    faces.forEach(function (f) { frontOf[f.i] = f.front; });
    var edgeCol = hc ? "#ffffff" : "rgba(246,242,231,0.95)";
    m.e.forEach(function (e, i) {
      var vis = m.adj[i].some(function (fi) { return frontOf[fi]; });
      if (!vis && !glass) return;
      var isHl = counted("edges", i), isCur = current("edges", i);
      ctx.beginPath();
      ctx.moveTo(S2[e[0]][0], S2[e[0]][1]);
      ctx.lineTo(S2[e[1]][0], S2[e[1]][1]);
      if (isHl) {
        ctx.setLineDash([]);
        ctx.strokeStyle = isCur ? "#ffd23f" : "#d8b43a";
        ctx.lineWidth = (isCur ? 9 : 6) * dpr;
      } else {
        ctx.setLineDash(vis ? [] : [7 * dpr, 7 * dpr]);
        ctx.strokeStyle = edgeCol;
        ctx.globalAlpha = vis ? 1 : 0.55;
        ctx.lineWidth = (m.curved ? 2.2 : 3) * dpr;
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    ctx.setLineDash([]);
    // Corners (vertices) are shown in glass mode, for counting.
    if (glass && !m.curved) {
      m.v.forEach(function (p, i) {
        var vis = P[i][2] > -0.2;
        var isHl = counted("vertices", i), isCur = current("vertices", i);
        ctx.beginPath();
        ctx.arc(S2[i][0], S2[i][1], (isCur ? 13 : isHl ? 10 : vis ? 6 : 4.5) * dpr, 0, Math.PI * 2);
        ctx.fillStyle = isHl ? (isCur ? "#ffd23f" : "#d8b43a") : edgeCol;
        ctx.globalAlpha = isHl || vis ? 1 : 0.55;
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    }
    // Count labels
    if (hl && hl.upto > 0) {
      for (var k = 0; k < hl.upto; k++) {
        var pt;
        if (hl.kind === "faces") {
          var gc = m.gcenter[k], gx = gc[0] * ca + gc[2] * sa, gz = -gc[0] * sa + gc[2] * ca;
          var gy2 = gc[1] * ct - gz * st, gz2 = gc[1] * st + gz * ct, gs = scale * D / (D - gz2);
          pt = [cx + gx * gs, cy - gy2 * gs];
        } else if (hl.kind === "edges") {
          var e = m.e[k];
          pt = [(S2[e[0]][0] + S2[e[1]][0]) / 2, (S2[e[0]][1] + S2[e[1]][1]) / 2];
        } else {
          pt = S2[k];
        }
        var curr = k === hl.upto - 1, rad = (curr ? 22 : 15) * dpr;
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], rad, 0, Math.PI * 2);
        ctx.fillStyle = curr ? "#ffd23f" : "#101a30";
        ctx.fill();
        ctx.lineWidth = 3 * dpr;
        ctx.strokeStyle = "#ffd23f";
        ctx.stroke();
        ctx.fillStyle = curr ? "#101a30" : "#ffffff";
        ctx.font = "800 " + Math.round((curr ? 24 : 16) * dpr) + "px Nunito, system-ui, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(k + 1), pt[0], pt[1] + 1 * dpr);
      }
    }
  }

  /* ---------- Speech and sound ---------- */
  var live = $("live");
  function announce(text) { live.textContent = ""; setTimeout(function () { live.textContent = text; }, 40); }
  var synth = window.speechSynthesis || null;
  var actx = null, started = false;
  function unlockAudio() {
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* ignore */ }
    if (synth && !started) {
      try { var u = new SpeechSynthesisUtterance(" "); u.volume = 0; synth.speak(u); } catch (e) { /* ignore */ }
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!actx && AC) actx = new AC();
      if (actx && actx.state === "suspended" && actx.resume) actx.resume();
    } catch (e) { /* ignore */ }
  }
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
  var keepAlive = [], speakToken = 0;
  // Speak, then call done() once (when speech ends, or after a safe guess if the browser never says).
  function speak(text, done) {
    var token = ++speakToken, finished = false, guard = null;
    function end() {
      if (finished || token !== speakToken) return;
      finished = true; clearTimeout(guard);
      if (done) done();
    }
    var useVoice = settings.voice && synth && window.SpeechSynthesisUtterance && settings.volume > 0 && started;
    if (!useVoice) { guard = setTimeout(end, Math.min(2600, 500 + text.length * 28)); return; }
    if (!chosenVoice) pickVoice();
    var u = new SpeechSynthesisUtterance(text);
    if (chosenVoice) { u.voice = chosenVoice; u.lang = chosenVoice.lang; } else { u.lang = "en-US"; }
    u.rate = settings.rate;
    u.volume = Math.max(0, Math.min(100, settings.volume)) / 100;
    u.onend = end; u.onerror = end;
    keepAlive.push(u); if (keepAlive.length > 8) keepAlive.shift();
    if (synth.speaking || synth.pending) {
      synth.cancel();
      setTimeout(function () { if (token === speakToken) synth.speak(u); }, 90); // Safari drops a phrase spoken right after cancel()
    } else {
      synth.speak(u);
    }
    guard = setTimeout(end, 2500 + text.length * 95 / settings.rate);
  }
  function stopSpeech() { speakToken++; if (synth && (synth.speaking || synth.pending)) synth.cancel(); }

  function tone(freq, start, len, vol, type) {
    var t0 = actx.currentTime + start;
    var o = actx.createOscillator(), g = actx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    o.connect(g); g.connect(actx.destination);
    o.start(t0); o.stop(t0 + len + 0.05);
  }
  function sound(kind) {
    if (!settings.sounds || !actx || settings.volume <= 0) return;
    var v = settings.volume / 100 * 0.22;
    try {
      if (kind === "press") tone(520, 0, 0.12, v * 0.5);
      else if (kind === "good") { tone(523.25, 0, 0.5, v); tone(659.25, 0.14, 0.6, v); }
      else if (kind === "level") { tone(523.25, 0, 0.6, v); tone(659.25, 0.2, 0.6, v); tone(783.99, 0.4, 0.9, v); }
      else if (kind === "tick") tone(700, 0, 0.1, v * 0.45, "triangle");
    } catch (e) { /* ignore */ }
  }

  /* ---------- Game state ---------- */
  var MODES = [
    { id: "quiz", name: "Shape quiz", about: "Is it a cube? Can it roll?" },
    { id: "count", name: "Count it", about: "Faces, edges and vertices." },
    { id: "build", name: "Build it", about: "Make a shape with code." },
    { id: "explore", name: "Explore", about: "Pick shapes to look at." }
  ];
  var COLORS = [
    { name: "blue", hex: "#5b8def" }, { name: "green", hex: "#4fbf6a" }, { name: "orange", hex: "#f2a33a" },
    { name: "purple", hex: "#9b7bea" }, { name: "pink", hex: "#e8708f" }, { name: "yellow", hex: "#e9c84a" }
  ];
  var POLY = { 3: "triangle", 4: "square", 5: "pentagon", 6: "hexagon", 7: "heptagon", 8: "octagon" };
  var PRISM = { 3: "triangular", 4: "square", 5: "pentagonal", 6: "hexagonal", 7: "heptagonal", 8: "octagonal" };

  var S = { screen: "menu", phase: "ask", menu: 0 };
  var undoStack = [];
  var timers = [];
  function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; stopWait(); }
  var silentRun = 0, paused = false, askedAt = 0, lastPress = 0;

  /* ---------- Rendering the side panel ---------- */
  var el = {
    question: $("question"), big: $("big"), modes: $("modes"), code: $("code"), feedback: $("feedback"),
    wait: $("wait"), waitFill: $("wait-fill"), waitText: $("wait-text"), answers: $("answers")
  };
  function setQuestion(text) { el.question.textContent = text; }
  function setBig(html) { if (html === null) { el.big.hidden = true; el.big.innerHTML = ""; } else { el.big.hidden = false; el.big.innerHTML = html; } }
  function setFeedback(text) { el.feedback.hidden = !text; el.feedback.textContent = text || ""; }
  function renderHud() {
    $("hud-level").textContent = progress.level >= MAX_LEVEL && !settings.allShapes ? "Level " + progress.level + " · Shape master" : "Level " + progress.level;
    $("hud-points").textContent = progress.points;
    var pips = $("pips"); pips.innerHTML = "";
    for (var i = 0; i < PER_LEVEL; i++) {
      var s = document.createElement("span");
      s.className = "pip" + (i < progress.step ? " on" : "");
      pips.appendChild(s);
    }
  }
  function buildModes() {
    el.modes.innerHTML = "";
    MODES.forEach(function (m, i) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button"; b.className = "mode"; b.dataset.index = i;
      b.innerHTML = "<strong></strong><span></span>";
      b.firstChild.textContent = m.name; b.lastChild.textContent = m.about;
      b.addEventListener("click", function () { unlockAudio(); startMode(m.id, true); });
      li.appendChild(b); el.modes.appendChild(li);
    });
  }
  function markMode() {
    Array.prototype.forEach.call(el.modes.querySelectorAll(".mode"), function (b, i) {
      b.classList.toggle("is-current", i === S.menu);
    });
  }

  /* ---------- Points and levels ---------- */
  function addPoint() {
    progress.points += 10;
    var unlockedKey = null;
    if (!settings.allShapes && progress.level < MAX_LEVEL) {
      progress.step += 1;
      if (progress.step >= PER_LEVEL) {
        progress.level += 1; progress.step = 0;
        ORDER.forEach(function (k) { if (SHAPES[k].level === progress.level) unlockedKey = k; });
      }
    } else {
      progress.step = (progress.step + 1) % PER_LEVEL;
    }
    saveProgress(); renderHud();
    return unlockedKey;
  }
  function levelUpText(key) {
    return key ? " Level " + progress.level + "! You unlocked the " + SHAPES[key].name + "." : "";
  }

  /* ---------- Asking ---------- */
  function questionFor(full) {
    var q = S.screen;
    if (q === "menu") return { text: "Play " + MODES[S.menu].name + "?" };
    if (q === "quiz") return { text: S.quiz.text };
    if (q === "count") {
      var c = S.count, n = c.options[c.idx];
      var head = "How many " + vword(c.what) + " does " + aName(c.shape) + " have?";
      var pre = c.loops > 0 && c.idx === 0 ? "Let's listen again. " : "";
      return { text: head, say: (full || c.first ? head + " " : pre) + "Is it " + n + "?", big: n + "?" };
    }
    if (q === "build") return buildQuestion(full);
    if (q === "explore") return { text: "Look at " + aName(S.explore.list[S.explore.idx]) + "?" };
    return { text: "" };
  }
  function ask(full) {
    clearTimers();
    S.phase = "ask";
    paused = false;
    setFeedback("");
    el.answers.classList.remove("is-waiting");
    renderScreen();
    var q = questionFor(full);
    setQuestion(q.text);
    if (q.big !== undefined) setBig(q.bigHtml || String(q.big)); else if (q.bigHtml) setBig(q.bigHtml); else setBig(null);
    if (S.screen === "count") S.count.first = false;
    askedAt = Date.now();
    announce(q.say || q.text);
    speak(q.say || q.text, startWait);
  }
  // The shape and extra panels for the current screen.
  function renderScreen() {
    el.modes.hidden = S.screen !== "menu";
    el.code.hidden = S.screen !== "build";
    view.hl = null;
    view.glass = false;
    view.tilt = 0.42;
    view.spin = true;
    if (S.screen === "menu") { markMode(); showShape(["cube", "triPrism", "sqPyramid", "sphere"][S.menu] || "cube", false); }
    else if (S.screen === "quiz") showShape(S.quiz.shape, false);
    else if (S.screen === "count") { showShape(S.count.shape, false); view.glass = true; }
    else if (S.screen === "build") renderBuild();
    else if (S.screen === "explore") showShape(S.explore.list[S.explore.idx], true);
  }

  /* One switch: no press before the wait ends counts as "not yes". */
  var waitTimer = null, waitStart = 0, waitRaf = 0;
  function startWait() {
    if (settings.answer !== "one" || S.phase !== "ask" || !started) return;
    stopWait();
    el.wait.hidden = false;
    waitStart = performance.now();
    var total = settings.wait * 1000;
    el.waitText.textContent = "Press for yes. Waiting " + settings.wait + " seconds, then it counts as not yes.";
    (function tick() {
      var p = Math.min(1, (performance.now() - waitStart) / total);
      el.waitFill.style.width = (p * 100).toFixed(1) + "%";
      if (p < 1) waitRaf = requestAnimationFrame(tick);
    })();
    waitTimer = setTimeout(function () {
      stopWait();
      silentRun += 1;
      if (silentRun >= 8) { pause(); return; }
      answer(false, true);
    }, total);
  }
  function stopWait() {
    clearTimeout(waitTimer); waitTimer = null;
    cancelAnimationFrame(waitRaf);
    el.wait.hidden = true;
    el.waitFill.style.width = "0";
  }
  function pause() {
    clearTimers(); stopSpeech();
    paused = true;
    setFeedback("Paused. Press Yes or Not yes to carry on.");
    speak("Paused.");
  }

  /* ---------- Answers ---------- */
  function press(yes) {
    unlockAudio();
    var now = Date.now();
    if (now - lastPress < settings.gap * 1000) return;
    lastPress = now;
    if (!started) { started = true; sound("press"); ask(true); return; }
    if (paused) { silentRun = 0; ask(true); return; }
    if (S.phase !== "ask") return;
    if (now - askedAt < Math.min(400, settings.gap * 1000)) return;
    silentRun = 0;
    sound("press");
    answer(yes, false);
  }
  function answer(yes, timedOut) {
    if (S.phase !== "ask") return;
    clearTimers();
    undoStack.push(JSON.stringify({ S: S, progress: progress }));
    if (undoStack.length > 40) undoStack.shift();
    $("btn-undo").disabled = false;
    S.phase = "busy";
    var flash = $(yes ? "btn-yes" : "btn-no");
    if (!timedOut) { flash.classList.add("is-pressed"); setTimeout(function () { flash.classList.remove("is-pressed"); }, 160); }
    if (S.screen === "menu") answerMenu(yes);
    else if (S.screen === "quiz") answerQuiz(yes);
    else if (S.screen === "count") answerCount(yes);
    else if (S.screen === "build") answerBuild(yes);
    else if (S.screen === "explore") answerExplore(yes);
  }
  function say(text, next, pauseAfter) {
    S.phase = "busy";
    setFeedback(text);
    announce(text);
    speak(text, function () { later(next, pauseAfter === undefined ? 900 : pauseAfter); });
  }
  function undo() {
    if (!undoStack.length) return;
    clearTimers(); stopSpeech();
    var snap = JSON.parse(undoStack.pop());
    S = snap.S; progress = snap.progress;
    saveProgress(); renderHud();
    $("btn-undo").disabled = !undoStack.length;
    announce("Answer undone.");
    if (S.screen === "build" && S.build.running) S.build.running = false;
    ask(true);
  }
  function sayAgain() {
    unlockAudio();
    if (!started) { started = true; ask(true); return; }
    if (paused) { ask(true); return; }
    if (S.phase === "ask") ask(true);
  }

  /* ---------- Menu ---------- */
  function answerMenu(yes) {
    if (yes) { startMode(MODES[S.menu].id, false); return; }
    S.menu = (S.menu + 1) % MODES.length;
    ask(false);
  }
  function startMode(id, fromTap) {
    clearTimers(); stopSpeech();
    if (fromTap) started = true;
    if (id === "menu") { S = { screen: "menu", phase: "ask", menu: 0 }; ask(true); return; }
    S.screen = id;
    if (id === "quiz") newQuiz();
    if (id === "count") newCount();
    if (id === "build") newBuild();
    if (id === "explore") S.explore = { list: unlocked(), idx: 0 };
    ask(true);
  }

  /* ---------- Shape quiz ---------- */
  var PROPS = {
    curved: { q: "Does it have a curved surface?", yes: "{A} has a curved surface.", no: "{A} has no curved surface. All its faces are flat." },
    rolls:  { q: "Can it roll?", yes: "{A} can roll.", no: "{A} cannot roll. It slides." },
    point:  { q: "Does it come to a point?", yes: "{A} comes to a point at the top.", no: "{A} does not come to a point." },
    tri:    { q: "Does it have a triangle face?", yes: "{A} has triangle faces.", no: "{A} has no triangle faces." },
    square: { q: "Does it have a square face?", yes: "{A} has a square face.", no: "{A} has no square faces." }
  };
  function newQuiz() {
    var list = unlocked(), prev = S.quiz ? S.quiz.shape : null;
    var shape = pick(list.length > 1 ? list.filter(function (k) { return k !== prev; }) : list);
    var sh = SHAPES[shape], r = Math.random(), q = { shape: shape };
    var whats = ["faces", "edges", "vertices"].filter(function (w) { return settings[w]; });
    if (r < 0.4 || list.length < 2) {
      q.type = "name";
      q.truth = Math.random() < 0.5;
      q.other = q.truth ? shape : pick(list.filter(function (k) { return k !== shape; }));
      q.text = "Is this " + aName(q.other) + "?";
    } else if (r < 0.75 || sh.curved || !whats.length) {
      q.type = "prop";
      var props = Object.keys(PROPS).filter(function (p) { return p === "curved" ? true : sh[p] !== null; });
      q.prop = pick(props);
      q.truth = q.prop === "curved" ? !!sh.curved : !!sh[q.prop];
      q.text = PROPS[q.prop].q;
    } else {
      q.type = "count";
      q.what = pick(whats);
      var real = sh[q.what];
      q.truth = Math.random() < 0.5;
      q.n = q.truth ? real : Math.max(1, real + pick([-2, -1, 1, 2]));
      if (q.n === real) q.n = real + 1;
      q.text = "Does it have " + q.n + " " + vword(q.what) + "?";
    }
    S.quiz = q;
  }
  function quizFact(q, positive) {
    var A = cap(aName(q.shape));
    if (q.type === "name") return q.truth ? "It is " + aName(q.shape) + "." : "It is " + aName(q.shape) + ", not " + aName(q.other) + ".";
    if (q.type === "prop") return (q.truth ? PROPS[q.prop].yes : PROPS[q.prop].no).replace("{A}", A);
    var real = SHAPES[q.shape][q.what];
    return A + " has " + real + " " + vword(q.what) + (q.truth ? "." : ", not " + q.n + ".");
  }
  function answerQuiz(yes) {
    var q = S.quiz, right = yes === q.truth, text;
    $("shape-name").textContent = cap(SHAPES[q.shape].name);
    if (right) {
      sound("good");
      var un = addPoint();
      text = (yes ? "Yes! " : "That's right! ") + quizFact(q) + levelUpText(un);
      if (un) { sound("level"); showShape(un, true); }
    } else {
      text = (yes ? "Good try. " : "Let's look. ") + quizFact(q);
    }
    say(text, function () { newQuiz(); ask(true); }, 1400);
  }

  /* ---------- Count it ---------- */
  function newCount() {
    var list = solids(), prev = S.count ? S.count.shape : null;
    if (!list.length) list = ["cube"];
    var shape = pick(list.length > 1 ? list.filter(function (k) { return k !== prev; }) : list);
    var whats = ["faces", "edges", "vertices"].filter(function (w) { return settings[w]; });
    if (!whats.length) whats = ["faces"];
    var what = pick(whats), real = SHAPES[shape][what];
    var opts = [real], tries = 0;
    while (opts.length < 4 && tries++ < 50) {
      var n = real + pick([-3, -2, -1, 1, 2, 3, 4]);
      if (n > 0 && opts.indexOf(n) < 0) opts.push(n);
    }
    opts.sort(function (a, b) { return a - b; });
    S.count = { shape: shape, what: what, options: opts, idx: 0, loops: 0, first: true };
  }
  function answerCount(yes) {
    var c = S.count, real = SHAPES[c.shape][c.what], name = aName(c.shape), w = vword(c.what);
    if (yes) {
      if (c.options[c.idx] === real) {
        sound("good");
        var un = addPoint();
        say("Yes! " + cap(name) + " has " + real + " " + w + ". Let's count them.", function () {
          countTogether(function () {
            say(real + " " + w + "!" + levelUpText(un), function () { if (un) { sound("level"); showShape(un, true); } later(function () { newCount(); ask(true); }, un ? 2500 : 0); }, 900);
          });
        }, 300);
      } else {
        say("Good try. Let's count them together.", function () {
          countTogether(function () { say(cap(name) + " has " + real + " " + w + ".", function () { newCount(); ask(true); }, 1200); });
        }, 300);
      }
      return;
    }
    c.idx += 1;
    if (c.idx >= c.options.length) {
      c.idx = 0; c.loops += 1;
      if (c.loops >= 2) {
        say("Let's count them together.", function () {
          countTogether(function () { say(cap(name) + " has " + real + " " + w + ".", function () { newCount(); ask(true); }, 1200); });
        }, 300);
        return;
      }
    }
    ask(false);
  }
  // Light up each face / edge / vertex in turn and say the number.
  function countTogether(done) {
    var c = S.count, real = SHAPES[c.shape][c.what];
    view.glass = true;
    view.hl = { kind: c.what, upto: 0 };
    setBig("0");
    var step = function () {
      if (S.screen !== "count") return;
      view.hl.upto += 1;
      setBig(String(view.hl.upto));
      sound("tick");
      speak(String(view.hl.upto));
      if (view.hl.upto >= real) later(done, 900);
      else later(step, real > 10 ? 850 : 1050);
    };
    later(step, 500);
  }

  /* ---------- Build it (coding) ---------- */
  function newBuild() {
    S.build = { sides: 3, kind: null, color: null, spin: false, step: "sides", colorIdx: 0, kindLoops: 0, colorLoops: 0, running: false, runLine: -1, first: true };
  }
  function buildName(b) {
    if (b.kind === "prism") return b.sides === 4 ? "cube" : PRISM[b.sides] + " prism";
    if (b.kind === "pyramid") return (b.sides === 4 ? "square" : PRISM[b.sides]) + " pyramid";
    return POLY[b.sides];
  }
  function buildMesh(b) {
    var key = "b-" + b.sides + "-" + (b.kind || "flat");
    if (!meshCache[key]) {
      var n = b.sides, rot = -Math.PI / 2 + (n % 2 ? 0 : Math.PI / n), m;
      if (b.kind === "prism") m = n === 4 ? box(1, 1, 1) : prism(n, 1.1, 0.8, rot);
      else if (b.kind === "pyramid") m = pyramid(n, 1.2, -0.75, 1.1, rot);
      else m = prism(n, 1.2, 0.04, rot);
      meshCache[key] = finish(m);
    }
    return meshCache[key];
  }
  // The program, one line per yes.
  function programLines(b) {
    var lines = ['<span class="kw">let</span> shape = <span class="fn">polygon</span>(<span class="num">3</span>);  <span class="cm">// triangle</span>'];
    for (var s = 4; s <= b.sides; s++) lines.push('shape.<span class="fn">addSide</span>();  <span class="cm">// ' + s + ' sides</span>');
    if (b.kind === "prism") lines.push('shape.<span class="fn">makeTall</span>();  <span class="cm">// prism</span>');
    if (b.kind === "pyramid") lines.push('shape.<span class="fn">makePoint</span>();  <span class="cm">// pyramid</span>');
    if (b.color) lines.push('shape.<span class="fn">paint</span>(<span class="str">"' + b.color + '"</span>);');
    if (b.spin) lines.push('shape.<span class="fn">spin</span>();');
    return lines;
  }
  function renderCode(b, highlight) {
    var lines = programLines(b);
    el.code.innerHTML = lines.map(function (l, i) {
      return '<li' + (i === highlight ? ' class="is-current"' : '') + '>' + l + '</li>';
    }).join("");
  }
  function colorHex(name) { var c = COLORS.filter(function (x) { return x.name === name; })[0]; return c ? c.hex : "#3fb6a8"; }
  function renderBuild() {
    var b = S.build;
    var color = b.step === "paint" ? COLORS[b.colorIdx].hex : colorHex(b.color);
    setMesh("build", buildMesh(b), color, b.step === "again" || b.step === "run" ? cap(buildName(b)) : "");
    view.spin = b.spin || b.step === "spin" ? true : false;
    view.tilt = b.kind && b.kind !== "flat" ? 0.42 : 0.95;
    if (!view.spin) view.angle = 0.55;
    renderCode(b, b.running ? b.runLine : programLines(b).length - 1);
  }
  function buildQuestion(full) {
    var b = S.build;
    if (b.step === "sides") {
      var lead = b.first ? "Your program starts with a triangle. " : "";
      b.first = false;
      var t = "Add another side?";
      return { text: t, say: (full && b.sides === 3 ? "Your program starts with a triangle. " : lead) + t, big: b.sides + " sides" };
    }
    if (b.step === "kind") return { text: "Make it tall, like a prism?" };
    if (b.step === "kind2") return { text: "Make it pointy, like a pyramid?" };
    if (b.step === "paint") {
      var c = COLORS[b.colorIdx];
      return { text: "Paint it " + c.name + "?", bigHtml: '<span class="swatch" style="background:' + c.hex + '"></span>' };
    }
    if (b.step === "spin") return { text: "Make it spin?" };
    if (b.step === "run") return { text: "Run your program?" };
    if (b.step === "again") return { text: "Build another shape?" };
    return { text: "" };
  }
  function answerBuild(yes) {
    var b = S.build;
    if (b.step === "sides") {
      if (yes) {
        b.sides += 1;
        sound("tick");
        if (b.sides >= 8) { b.step = "kind"; say("8 sides. That's the most!", function () { ask(true); }, 300); return; }
        renderBuild();
        ask(false);
        return;
      }
      b.step = "kind";
      say("Okay. " + cap(POLY[b.sides]) + ".", function () { ask(true); }, 200);
      return;
    }
    if (b.step === "kind") {
      if (yes) { b.kind = "prism"; b.step = "paint"; sound("tick"); renderBuild(); say("It's tall now!", function () { ask(true); }, 300); return; }
      b.step = "kind2"; ask(true); return;
    }
    if (b.step === "kind2") {
      if (yes) { b.kind = "pyramid"; b.step = "paint"; sound("tick"); renderBuild(); say("It has a point now!", function () { ask(true); }, 300); return; }
      b.kindLoops += 1;
      if (b.kindLoops >= 2) { b.kind = "flat"; b.step = "paint"; say("It can stay flat.", function () { ask(true); }, 300); return; }
      b.step = "kind"; ask(true); return;
    }
    if (b.step === "paint") {
      if (yes) { b.color = COLORS[b.colorIdx].name; b.step = "spin"; sound("tick"); ask(true); return; }
      b.colorIdx += 1;
      if (b.colorIdx >= COLORS.length) {
        b.colorIdx = 0; b.colorLoops += 1;
        if (b.colorLoops >= 2) { b.step = "spin"; ask(true); return; }
      }
      ask(false);
      return;
    }
    if (b.step === "spin") {
      if (yes) { b.spin = true; sound("tick"); }
      b.step = "run"; ask(true); return;
    }
    if (b.step === "run") {
      if (yes) { runProgram(); return; }
      finishBuild(); return;
    }
    if (b.step === "again") {
      if (yes) { newBuild(); ask(true); return; }
      startMode("menu");
    }
  }
  // Step through the program one line at a time, changing the shape as each line runs.
  function runProgram() {
    var b = S.build, lines = programLines(b), i = 0;
    var target = JSON.parse(JSON.stringify(b));
    var temp = { sides: 3, kind: null, color: null, spin: false };
    b.running = true;
    setQuestion("Running your program…");
    setFeedback("");
    var words = [];
    var step = function () {
      if (S.screen !== "build" || !S.build.running) return;
      if (i === 0) { words.push("Start with a triangle."); }
      else if (temp.sides < target.sides) { temp.sides += 1; words.push("Add a side."); }
      else if (target.kind && target.kind !== "flat" && temp.kind !== target.kind) { temp.kind = target.kind; words.push(target.kind === "prism" ? "Make it tall." : "Make a point."); }
      else if (target.color && !temp.color) { temp.color = target.color; words.push("Paint it " + target.color + "."); }
      else if (target.spin && !temp.spin) { temp.spin = true; words.push("Spin!"); }
      b.runLine = i;
      setMesh("build", buildMesh(temp), colorHex(temp.color), "");
      view.tilt = temp.kind ? 0.42 : 0.95;
      view.spin = temp.spin;
      renderCode(target, i);
      sound("tick");
      speak(words[words.length - 1]);
      i += 1;
      if (i < lines.length) later(step, 1300);
      else later(function () { b.running = false; finishBuild(); }, 1300);
    };
    step();
  }
  function finishBuild() {
    var b = S.build, name = buildName(b), text;
    b.step = "again";
    renderBuild();
    var un = addPoint();
    sound("good");
    var col = b.color ? b.color + " " : "";
    if (b.kind === "prism") text = "You made a " + col + name + "! It has " + (b.sides + 2) + " faces, " + (3 * b.sides) + " edges and " + (2 * b.sides) + " " + settings.vword + ".";
    else if (b.kind === "pyramid") text = "You made a " + col + name + "! It has " + (b.sides + 1) + " faces, " + (2 * b.sides) + " edges and " + (b.sides + 1) + " " + settings.vword + ".";
    else text = "You made a " + col + name + "! It is flat, with " + b.sides + " sides.";
    if (b.kind === "prism" && b.sides === 4) text = text.replace("a " + col + "cube", "a " + col + "cube. A cube is a square prism");
    say(text + levelUpText(un), function () { ask(true); }, 1200);
  }

  /* ---------- Explore ---------- */
  function answerExplore(yes) {
    var x = S.explore, key = x.list[x.idx], s = SHAPES[key];
    var next = function () { x.list = unlocked(); x.idx = (x.idx + 1) % x.list.length; ask(false); };
    if (!yes) { next(); return; }
    var text;
    if (key === "sphere") text = "A sphere is round like a ball. It has one curved surface and no edges or " + settings.vword + ". It can roll.";
    else if (key === "cylinder") text = "A cylinder has 2 flat circle faces and a curved surface. It can roll.";
    else if (key === "cone") text = "A cone has a flat circle face, a curved surface and a point at the top.";
    else text = cap(aName(key)) + " has " + s.faces + " faces, " + s.edges + " edges and " + s.vertices + " " + settings.vword + ".";
    if (!s.curved) { view.glass = true; }
    sound("good");
    say(text, function () { view.glass = false; next(); }, 1800);
  }

  /* ---------- Panels ---------- */
  var openPanel = null, returnFocus = null;
  var openedByKey = false;
  function showPanel(id, opener, byKey) {
    openedByKey = !!byKey;
    clearTimers(); stopSpeech();
    if (S.phase === "ask") paused = true;
    openPanel = $(id); returnFocus = opener || document.activeElement;
    openPanel.hidden = false;
    $("app").setAttribute("aria-hidden", "true");
    setTimeout(function () { openPanel.querySelector("h2").focus(); }, 30);
  }
  function hidePanel() {
    if (!openPanel) return;
    openPanel.hidden = true; openPanel = null;
    $("app").removeAttribute("aria-hidden");
    if (openedByKey && returnFocus && returnFocus.focus && !returnFocus.closest("[hidden]")) returnFocus.focus();
    if (S.build) S.build.running = false;
    if (started && S.phase === "ask") ask(true);
    else if (S.phase === "busy") ask(true);
  }
  document.querySelectorAll(".overlay").forEach(function (ov) {
    ov.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]") || e.target === ov) hidePanel();
    });
  });

  function applySettings() {
    root.classList.toggle("hc", !!settings.contrast);
    $("field-wait").hidden = settings.answer !== "one";
    $("btn-no").hidden = false;
    var w = { faces: "Faces", edges: "Edges", vertices: settings.vword === "corners" ? "Corners" : "Vertices" };
    $("set-vertices").nextElementSibling.textContent = w.vertices;
  }
  function bindSettings() {
    var bindSel = function (id, key, num) {
      var x = $(id); x.value = String(settings[key]);
      x.addEventListener("change", function () { settings[key] = num ? Number(x.value) : x.value; saveSettings(); applySettings(); });
    };
    var bindChk = function (id, key) {
      var x = $(id); x.checked = !!settings[key];
      x.addEventListener("change", function () { settings[key] = x.checked; saveSettings(); applySettings(); renderHud(); });
    };
    var bindRange = function (id, key, out, fmt) {
      var x = $(id); x.value = String(settings[key]);
      var show = function () { $(out).textContent = fmt(settings[key]); };
      show();
      x.addEventListener("input", function () { settings[key] = Number(x.value); saveSettings(); show(); });
    };
    bindSel("set-answer", "answer"); bindSel("set-keys", "keys"); bindSel("set-vword", "vword"); bindSel("set-spin", "spin", true);
    bindChk("set-faces", "faces"); bindChk("set-edges", "edges"); bindChk("set-vertices", "vertices");
    bindChk("set-all", "allShapes"); bindChk("set-voice", "voice"); bindChk("set-sounds", "sounds"); bindChk("set-contrast", "contrast");
    bindRange("set-wait", "wait", "wait-out", function (v) { return v + " seconds"; });
    bindRange("set-gap", "gap", "gap-out", function (v) { return v ? v + " s" : "Off"; });
    bindRange("set-rate", "rate", "rate-out", function (v) { return v < 0.75 ? "Slow" : v > 1 ? "Fast" : "Normal"; });
    var vol = $("set-volume"); vol.value = String(settings.volume);
    vol.addEventListener("input", function () { settings.volume = Number(vol.value); saveSettings(); });
    var armed = false;
    $("btn-reset").addEventListener("click", function () {
      if (!armed) { armed = true; $("reset-msg").textContent = "Press again to go back to level 1 with 0 points."; return; }
      armed = false;
      progress = { points: 0, level: 1, step: 0 }; saveProgress(); renderHud();
      undoStack = []; $("btn-undo").disabled = true;
      $("reset-msg").textContent = "Done. Back to level 1.";
      S = { screen: "menu", phase: "ask", menu: 0 };
    });
  }

  /* ---------- Keys and switches ---------- */
  document.addEventListener("keydown", function (e) {
    if (openPanel) {
      if (e.key === "Escape") { e.preventDefault(); hidePanel(); }
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key, t = e.target;
    var onControl = t && t.closest && t.closest("button, a, input, select, textarea");
    if (k === "Tab" || k === "Shift") return;
    if (onControl && (k === "Enter" || k === " ")) return; // let focused buttons work normally
    if (e.repeat) { e.preventDefault(); return; }
    var lower = k.length === 1 ? k.toLowerCase() : k;
    if (lower === "r") { e.preventDefault(); sayAgain(); return; }
    if (k === "Backspace" || lower === "u") { e.preventDefault(); undo(); return; }
    if (k === "Escape") { if (pseudoFs) toggleFullscreen(); return; }
    var yes = null;
    if (lower === "y" || lower === "1") yes = true;
    else if (lower === "n" || lower === "2") yes = false;
    else if (k === "Enter") yes = settings.keys === "enter-yes";
    else if (k === " ") yes = settings.keys !== "enter-yes";
    else if (settings.answer === "one" && k.length === 1) yes = true;
    if (settings.answer === "one" && yes === false && (k === "Enter" || k === " ")) yes = true; // one switch: any press is yes
    if (yes === null) return;
    e.preventDefault();
    press(yes);
  });
  function bindAnswer(id, yes) {
    var b = $(id);
    b.addEventListener("click", function (e) {
      press(yes);
      if (e.detail > 0) b.blur(); // so a switch press afterwards doesn't re-click this button
    });
  }
  bindAnswer("btn-yes", true);
  bindAnswer("btn-no", false);
  el.question.addEventListener("click", sayAgain);
  $("btn-again").addEventListener("click", sayAgain);
  $("btn-undo").addEventListener("click", undo);
  $("btn-undo").disabled = true;
  $("btn-menu").addEventListener("click", function () { unlockAudio(); started = true; startMode("menu"); });
  $("btn-settings").addEventListener("click", function (e) { showPanel("panel-settings", e.currentTarget, e.detail === 0); });
  // After a tap or mouse click, take focus off toolbar buttons so a switch (Enter / Space) answers
  // the question instead of pressing that button again.
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".bar button, .bar a, .mode, .question");
    if (b && e.detail > 0) setTimeout(function () { b.blur(); }, 0);
  });
  ["touchend", "click", "keydown"].forEach(function (type) { document.addEventListener(type, unlockAudio, true); });

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
    if (!settings.fsTipSeen && !isStandalone()) { settings.fsTipSeen = true; saveSettings(); showPanel("panel-fullscreen", $("btn-exit-fs")); }
  }
  function updateFs() {
    var on = !!fsElement() || pseudoFs, was = root.classList.contains("is-fullscreen");
    root.classList.toggle("is-fullscreen", on);
    $("btn-exit-fs").hidden = !on;
    $("fullscreen-label").textContent = on ? "Exit full screen" : "Full screen";
    if (on && !was) announce("Full screen. To leave, use the Exit full screen button in the top corner.");
    else if (!on && was) $("btn-fullscreen").focus();
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
  buildModes();
  renderHud();
  var startId = params.get("mode");
  if (MODES.some(function (m) { return m.id === startId; })) startMode(startId, false);
  else ask(true);
  // Until the first tap or key, browsers block speech, so show how to begin.
  setFeedback("Press Yes, Not yes or Say again to begin.");
  if (isStandalone()) { pseudoFs = true; updateFs(); }
  requestAnimationFrame(frame);
  window.ShapeExplorer = { state: function () { return S; }, view: view };
})();
