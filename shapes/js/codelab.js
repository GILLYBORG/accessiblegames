/* Shape Explorer: Code lab.
   Yes / not yes answers write real JavaScript. The program is shown with line numbers and colours,
   runs for real (new Function) and draws the shapes it adds to the scene. It can be stepped through
   line by line, edited by yes / not yes, saved on this device, shared as a link or downloaded.
   game.js calls window.ShapeCodeLab(api) and uses what it returns. */
window.ShapeCodeLab = function (api) {
  "use strict";

  var COLORS = { blue: "#5b8def", green: "#4fbf6a", orange: "#f2a33a", purple: "#9b7bea", pink: "#e8708f", yellow: "#e9c84a", red: "#e5534b", white: "#e8ecf5" };
  var COLOR_LIST = Object.keys(COLORS);
  var SHAPE_LIST = ["box", "prism", "pyramid", "cylinder", "cone", "sphere"];
  var DEFAULTS = {
    box: { w: 2, h: 2, d: 2 }, prism: { sides: 6, r: 1, hgt: 2 }, pyramid: { sides: 4, r: 1.2, hgt: 2 },
    cylinder: { r: 1, hgt: 2 }, cone: { r: 1, hgt: 2 }, sphere: { r: 1 }
  };
  var PARAMS = { box: ["w", "h", "d"], prism: ["sides", "r", "hgt"], pyramid: ["sides", "r", "hgt"], cylinder: ["r", "hgt"], cone: ["r", "hgt"], sphere: ["r"] };
  var LABEL = { sides: "Sides", w: "Width", h: "Height", d: "Depth", r: "Radius", hgt: "Height", repeat: "Loop count", x: "x position" };
  var SIZES = [0.5, 1, 1.5, 2, 2.5, 3, 4];
  var VALUES = { sides: [3, 4, 5, 6, 7, 8], w: SIZES, h: SIZES, d: SIZES, r: SIZES, hgt: SIZES, repeat: [2, 3, 4, 5, 6, 8], x: [-4, -2, 0, 2, 4, 6, 8, 10, 12] };
  var LAYOUTS = ["x", "y", "ring"];
  var LAYOUT_Q = { x: "Line them up along x?", y: "Stack them up on y?", ring: "Put them in a circle?" };
  var LAYOUT_BIG = { x: "along x", y: "stack on y", ring: "circle" };
  var MENU_Q = {
    add: "Add a shape?", step: "Run it step by step?", edit: "Change a line?", save: "Save this program?",
    open: "Open a saved program?", fresh: "Start a new program?", games: "Go back to the games?"
  };
  var KIND_SAY = { ctor: "making the shape", color: "the colour", pos: "the position", "for": "the loop", scale: "the growing", spin: "the spin", add: "adding it to the scene" };
  var SAVE_KEY = "shape-explorer-programs";

  var pendingProg = null;
  function C() { return api.state().code; }
  function fmt(n) { return String(Math.round(n * 100) / 100); }
  function round1(n) { return Math.round(n * 10) / 10; }
  function clamp(n, lo, hi, dflt) { n = Number(n); return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt; }

  /* ---------- Program model ---------- */
  function newBlock(shape) {
    var b = { shape: shape, color: "blue", repeat: 0, layout: "x", grow: false, spin: false, x: 0, autoX: true };
    setShape(b, shape);
    return b;
  }
  function setShape(b, shape) {
    b.shape = shape;
    var d = DEFAULTS[shape];
    Object.keys(d).forEach(function (k) { b[k] = d[k]; });
  }
  // Anything from a link or saved list is cleaned, because it becomes code.
  function sanitize(p) {
    var out = { blocks: [] };
    if (!p || !Array.isArray(p.blocks)) return out;
    p.blocks.slice(0, 12).forEach(function (s) {
      if (!s || SHAPE_LIST.indexOf(s.shape) < 0) return;
      var b = newBlock(s.shape);
      PARAMS[s.shape].forEach(function (k) { b[k] = k === "sides" ? Math.round(clamp(s[k], 3, 8, b[k])) : clamp(s[k], 0.25, 6, b[k]); });
      b.color = COLOR_LIST.indexOf(s.color) >= 0 ? s.color : "blue";
      b.repeat = Math.round(clamp(s.repeat, 0, 12, 0));
      if (b.repeat === 1) b.repeat = 0;
      b.layout = LAYOUTS.indexOf(s.layout) >= 0 ? s.layout : "x";
      b.grow = !!s.grow; b.spin = !!s.spin;
      b.autoX = s.autoX !== false;
      b.x = clamp(s.x, -20, 40, 0);
      out.blocks.push(b);
    });
    return out;
  }
  function footprint(b) { return b.shape === "box" ? Math.max(b.w, b.d) : 2 * b.r; }
  function heightOf(b) { return b.shape === "box" ? b.h : b.shape === "sphere" ? 2 * b.r : b.hgt; }
  function spacing(b) { return round1(footprint(b) * (b.grow ? 1.6 : 1) + 0.6); }
  function ringR(b) { return round1(Math.max(footprint(b), spacing(b) * b.repeat / (2 * Math.PI))); }
  // Where each block sits. Blocks left on "auto" go to the right of the one before.
  function placeX(prog) {
    var right = null;
    return prog.blocks.map(function (b) {
      var half = footprint(b) / 2 * (b.grow && b.repeat ? 1 + 0.25 * (b.repeat - 1) : 1);
      var left = half, ext = half;
      if (b.repeat && b.layout === "x") ext = (b.repeat - 1) * spacing(b) + half;
      if (b.repeat && b.layout === "ring") { left = ringR(b) + half; ext = left; }
      var x = b.autoX ? (right === null ? 0 : round1(right + 1 + left)) : b.x;
      right = right === null ? x + ext : Math.max(right, x + ext);
      return x;
    });
  }
  function ctorText(b) {
    var a = PARAMS[b.shape].map(function (k) { return fmt(b[k]); });
    return b.shape + "(" + a.join(", ") + ")";
  }
  function describe(b) {
    var s = b.repeat ? b.repeat + " " + b.shape + (b.shape === "box" ? "es" : "s") : "a " + b.shape;
    if (b.repeat) s += { x: " in a row", y: " stacked up", ring: " in a circle" }[b.layout];
    return s;
  }

  /* ---------- Writing the code ---------- */
  function generate(prog) {
    var L = [];
    function add(text, b, kind, stmt) { L.push({ text: text, b: b, kind: kind, stmt: !!stmt }); }
    add("const scene = createScene();", -1, "scene", true);
    if (!prog.blocks.length) add("// Add a shape to begin", -1, "comment");
    var xs = placeX(prog);
    prog.blocks.forEach(function (b, k) {
      var v = b.shape + (k + 1), ind = b.repeat ? "  " : "", n = b.repeat, xx = xs[k];
      add("", -1, "blank");
      add("// Shape " + (k + 1) + ": " + describe(b), k, "comment");
      if (n) add("for (let i = 0; i < " + n + "; i++) {", k, "for", true);
      add(ind + "const " + v + " = " + ctorText(b) + ";", k, "ctor", true);
      add(ind + v + '.color = "' + b.color + '";', k, "color", true);
      if (!n) add(ind + v + ".position.x = " + fmt(xx) + ";", k, "pos", true);
      else if (b.layout === "x") add(ind + v + ".position.x = " + (xx ? fmt(xx) + " + " : "") + "i * " + fmt(spacing(b)) + ";", k, "pos", true);
      else if (b.layout === "y") {
        add(ind + v + ".position.x = " + fmt(xx) + ";", k, "pos", true);
        add(ind + v + ".position.y = i * " + fmt(round1(heightOf(b))) + ";", k, "pos", true);
      } else {
        var ang = "i * 2 * Math.PI / " + n, R = fmt(ringR(b));
        add(ind + v + ".position.x = " + (xx ? fmt(xx) + " + " : "") + "Math.cos(" + ang + ") * " + R + ";", k, "pos", true);
        add(ind + v + ".position.z = Math.sin(" + ang + ") * " + R + ";", k, "pos", true);
      }
      if (n && b.grow) add(ind + v + ".scale = 1 + i * 0.25;", k, "scale", true);
      if (b.spin) add(ind + v + ".spin = true;", k, "spin", true);
      add(ind + "scene.add(" + v + ");", k, "add", true);
      if (n) add("}", k, "close");
    });
    return L;
  }
  // Runs the program for real. __at() before each statement records the line (and i) for stepping.
  var runCache = { key: "", result: null };
  function run(prog) {
    var key = JSON.stringify(prog);
    if (runCache.key === key) return runCache.result;
    var lines = generate(prog), list = [], trace = [], error = "";
    var src = lines.map(function (l, n) {
      return l.stmt ? "__at(" + n + ", typeof i === 'undefined' ? null : i); " + l.text : l.text;
    }).join("\n");
    function mk(kind, args) { return { kind: kind, args: args, color: "white", position: { x: 0, y: 0, z: 0 }, scale: 1, spin: false }; }
    try {
      var fn = new Function("createScene", "box", "prism", "pyramid", "cylinder", "cone", "sphere", "__at", "\"use strict\";\n" + src);
      fn(function () { return { add: function (o) { list.push(o); } }; },
        function (w, h, d) { return mk("box", [w, h, d]); },
        function (n, r, h) { return mk("prism", [n, r, h]); },
        function (n, r, h) { return mk("pyramid", [n, r, h]); },
        function (r, h) { return mk("cylinder", [r, h]); },
        function (r, h) { return mk("cone", [r, h]); },
        function (r) { return mk("sphere", [r]); },
        function (line, i) { trace.push({ line: line, i: i, count: list.length }); });
    } catch (err) { error = String(err && err.message || err); }
    runCache = { key: key, result: { lines: lines, objects: list, trace: trace, error: error } };
    return runCache.result;
  }

  /* ---------- Meshes for the 3D view ---------- */
  var meshCache = {};
  function meshOf(o) {
    var key = o.kind + ":" + o.args.join(",");
    if (meshCache[key]) return meshCache[key];
    var a = o.args, m, g = api.geo;
    var rot = function (n) { return -Math.PI / 2 + (n % 2 ? 0 : Math.PI / n); };
    if (o.kind === "box") m = g.box(a[0] / 2, a[1] / 2, a[2] / 2);
    else if (o.kind === "prism") m = g.prism(a[0], a[1], a[2] / 2, rot(a[0]));
    else if (o.kind === "pyramid") m = g.pyramid(a[0], a[1], -a[2] / 2, a[2] / 2, rot(a[0]));
    else if (o.kind === "cylinder") {
      m = g.prism(28, a[0], a[1] / 2, 0);
      m.f.forEach(function (f, i) { f.g = i < 2 ? i : 2; });
      m.smoothG = 2;
    } else if (o.kind === "cone") {
      m = g.pyramid(28, a[0], -a[1] / 2, a[1] / 2, 0);
      m.f.forEach(function (f, i) { f.g = i < 1 ? 0 : 1; });
      m.smoothG = 1;
    } else {
      m = g.sphere(a[0], 12, 22);
      m.smoothG = 0;
    }
    meshCache[key] = g.finish(m);
    return meshCache[key];
  }

  var objs = [], fit = null;
  function setObjects(list) {
    objs = list.map(function (o) {
      return {
        mesh: meshOf(o), color: COLORS[o.color] || "#e8ecf5",
        x: Number(o.position.x) || 0, y: Number(o.position.y) || 0, z: Number(o.position.z) || 0,
        s: Number(o.scale) || 1, spin: !!o.spin
      };
    });
    api.view.objects = objs;
    api.label(objs.length ? "" : "Empty scene");
  }
  function hexToRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function draw(ctx, cw, ch, dpr, t, angle, tilt, hc) {
    if (!objs.length) return;
    // Frame the whole scene, easing so it doesn't jump.
    var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    objs.forEach(function (o) {
      var r = o.mesh.r * o.s, p = [o.x, o.y, o.z];
      for (var k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k] - r); hi[k] = Math.max(hi[k], p[k] + r); }
    });
    var tc = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    var tr = Math.max(1, Math.sqrt(Math.pow(hi[0] - lo[0], 2) + Math.pow(hi[1] - lo[1], 2) + Math.pow(hi[2] - lo[2], 2)) / 2);
    if (!fit) fit = { c: tc, r: tr };
    var e = 0.08;
    for (var k = 0; k < 3; k++) fit.c[k] += (tc[k] - fit.c[k]) * e;
    fit.r += (tr - fit.r) * e;
    var ca = Math.cos(angle), sa = Math.sin(angle), ct = Math.cos(tilt), st = Math.sin(tilt);
    var D = 4.2, scale = Math.min(cw, ch) * 0.4, cx = cw / 2, cy = ch * 0.53;
    var L = [-0.45, 0.65, 0.62], ll = Math.sqrt(L[0] * L[0] + L[1] * L[1] + L[2] * L[2]);
    L = [L[0] / ll, L[1] / ll, L[2] / ll];
    var faces = [];
    objs.forEach(function (o) {
      var own = o.spin ? t / 1000 * 0.9 : 0, co = Math.cos(own), so = Math.sin(own);
      var P = o.mesh.v.map(function (p) {
        var x = p[0] * o.s, y = p[1] * o.s, z = p[2] * o.s;
        var x1 = x * co + z * so, z1 = -x * so + z * co;
        x = (x1 + o.x - fit.c[0]) / fit.r; y = (y + o.y - fit.c[1]) / fit.r; z = (z1 + o.z - fit.c[2]) / fit.r;
        var x2 = x * ca + z * sa, z2 = -x * sa + z * ca;
        return [x2, y * ct - z2 * st, y * st + z2 * ct];
      });
      var base = hexToRgb(hc ? "#ffffff" : o.color);
      o.mesh.f.forEach(function (f) {
        var pts = f.p.map(function (k) { return P[k]; });
        var n = api.geo.newell(pts), c = api.geo.centroid(pts);
        if (n[0] * -c[0] + n[1] * -c[1] + n[2] * (D - c[2]) <= 0) return;
        var lit = 0.38 + 0.62 * Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
        if (hc) lit = 0.15 + 0.35 * Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
        var col = "rgb(" + Math.round(base[0] * lit) + "," + Math.round(base[1] * lit) + "," + Math.round(base[2] * lit) + ")";
        faces.push({ z: c[2], pts: pts, col: col, smooth: o.mesh.smoothG === f.g });
      });
    });
    faces.sort(function (a, b) { return a.z - b.z; });
    var edge = hc ? "#ffffff" : "rgba(246,242,231,0.9)";
    ctx.lineJoin = "round";
    faces.forEach(function (f) {
      ctx.beginPath();
      f.pts.forEach(function (p, j) {
        var s = scale * D / (D - p[2]), X = cx + p[0] * s, Y = cy - p[1] * s;
        if (j) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      });
      ctx.closePath();
      ctx.fillStyle = f.col; ctx.fill();
      ctx.strokeStyle = f.smooth ? f.col : edge;
      ctx.lineWidth = (f.smooth ? 1.2 : 2.2) * dpr;
      ctx.stroke();
    });
  }

  /* ---------- Code panel ---------- */
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function highlight(line) {
    var ci = line.indexOf("//"), code = ci >= 0 ? line.slice(0, ci) : line, cm = ci >= 0 ? line.slice(ci) : "";
    var out = code.replace(/("[^"]*")|(\b\d+(?:\.\d+)?\b)|\b(const|let|for|true|false|typeof)\b|([A-Za-z_]\w*)(?=\()|([^"\w]+|\w+)/g,
      function (m, str, num, kw, fn, other) {
        if (str) return '<span class="str">' + esc(str) + "</span>";
        if (num) return '<span class="num">' + num + "</span>";
        if (kw) return '<span class="kw">' + kw + "</span>";
        if (fn) return '<span class="fn">' + fn + "</span>";
        return esc(other || m);
      });
    return out + (cm ? '<span class="cm">' + esc(cm) + "</span>" : "");
  }
  function renderCode(lines, hl) {
    var code = api.el.code;
    code.classList.add("is-lab");
    code.innerHTML = lines.map(function (l, i) {
      return "<li" + (i === hl ? ' class="is-current"' : "") + ">" + (l.text ? highlight(l.text) : "&nbsp;") + "</li>";
    }).join("");
    var cur = code.querySelector(".is-current");
    if (cur && cur.scrollIntoView) { try { cur.scrollIntoView({ block: "nearest" }); } catch (e) { /* old Safari */ } }
  }
  function lineFor(lines, b, key) {
    var kind = { sides: "ctor", w: "ctor", h: "ctor", d: "ctor", r: "ctor", hgt: "ctor", shape: "ctor", color: "color", repeat: "for", layout: "pos", x: "pos" }[key];
    if (!kind) return -1;
    for (var i = 0; i < lines.length; i++) if (lines[i].b === b && lines[i].kind === kind) return i;
    return -1;
  }

  /* ---------- Tasks: one yes / not yes question at a time ---------- */
  function numTask(b, key) { return { t: "choose", kind: "num", b: b, key: key, options: VALUES[key], idx: -1, loops: 0 }; }
  function colorTask(b) { return { t: "choose", kind: "color", b: b, key: "color", options: COLOR_LIST, idx: -1, loops: 0 }; }
  function layoutTask(b) { return { t: "choose", kind: "layout", b: b, key: "layout", options: LAYOUTS, idx: -1, loops: 0 }; }
  function shapeTask(b, isNew) { return { t: "choose", kind: "shape", b: b, key: "shape", isNew: isNew, options: SHAPE_LIST, idx: -1, loops: 0 }; }
  function saved() {
    try { var a = JSON.parse(localStorage.getItem(SAVE_KEY)); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function storeSaved(a) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(a)); return true; } catch (e) { return false; } }
  function menuTask() {
    var c = C(), has = c.prog.blocks.length > 0, opts = ["add"];
    if (has) opts.push("step", "edit", "save");
    if (saved().length) opts.push("open");
    if (has) opts.push("fresh");
    opts.push("games");
    return { t: "choose", kind: "menu", options: opts, idx: 0, loops: 0 };
  }
  function block(task) { return C().prog.blocks[task.b]; }
  function startIdx(task) {
    if (task.idx >= 0) return;
    var cur = task.kind === "shape" ? (task.isNew ? "box" : block(task).shape) : task.b !== undefined && block(task) ? block(task)[task.key] : null;
    var i = task.options.indexOf(cur);
    task.idx = i >= 0 ? i : 0;
    if (task.b !== undefined && block(task)) task.orig = task.kind === "shape" ? JSON.stringify(block(task)) : block(task)[task.key];
  }
  // Show the choice being asked about in the code and the 3D view straight away.
  function preview(task) {
    if (!task || task.t !== "choose" || task.b === undefined || !block(task)) return;
    startIdx(task);
    var b = block(task), v = task.options[task.idx];
    if (task.kind === "shape") { if (b.shape !== v) setShape(b, v); }
    else b[task.key] = v;
  }
  function revert(task) {
    var b = block(task);
    if (!b) return;
    if (task.kind === "shape") {
      if (task.isNew) { C().prog.blocks.splice(task.b, 1); C().queue = []; return; }
      var o = JSON.parse(task.orig); Object.keys(o).forEach(function (k) { b[k] = o[k]; });
    } else b[task.key] = task.orig;
  }
  function newShapeTasks(b, shape) {
    var t = [];
    if (shape === "prism" || shape === "pyramid") t.push(numTask(b, "sides"));
    t.push({ t: "yn", id: "keepSize", b: b, yes: [], no: PARAMS[shape].filter(function (k) { return k !== "sides"; }).map(function (k) { return numTask(b, k); }) });
    t.push(colorTask(b));
    t.push({ t: "yn", id: "loop", b: b, yes: [{ t: "do", op: "loop", b: b }, numTask(b, "repeat"), layoutTask(b), { t: "yn", id: "grow", b: b, cond: "notStack", yes: [{ t: "do", op: "grow", b: b }], no: [] }], no: [] });
    t.push({ t: "yn", id: "spin", b: b, yes: [{ t: "do", op: "spin", b: b }], no: [] });
    t.push({ t: "do", op: "added", b: b });
    return t;
  }
  function editableLines() {
    var lines = run(C().prog).lines, out = [];
    lines.forEach(function (l, i) { if (l.b >= 0 && KIND_SAY[l.kind] && out.every(function (j) { return !(lines[j].b === l.b && lines[j].kind === l.kind && l.kind === "pos"); })) out.push(i); });
    return out;
  }
  function fieldsFor(line) {
    var b = C().prog.blocks[line.b], k = line.b, f = [];
    if (line.kind === "ctor") {
      f.push({ id: "shape", q: "Change it to a different shape?" });
      PARAMS[b.shape].forEach(function (p) { f.push({ id: "num:" + p, q: "Change the " + LABEL[p].toLowerCase() + "?" }); });
    } else if (line.kind === "color") f.push({ id: "color" });
    else if (line.kind === "for") { f.push({ id: "num:repeat", q: "Change the loop count?" }); f.push({ id: "unloop", q: "Take the loop away?" }); }
    else if (line.kind === "pos") {
      if (b.repeat) f.push({ id: "layout", q: "Change how they are placed?" });
      f.push({ id: "num:x", q: "Change the x position?" });
    } else if (line.kind === "scale") f.push({ id: "nogrow", q: "Stop them growing?" });
    else if (line.kind === "spin") f.push({ id: "nospin", q: "Stop it spinning?" });
    else if (line.kind === "add") {
      if (!b.repeat) f.push({ id: "loop", q: "Put it in a loop?" });
      if (b.repeat && !b.grow && b.layout !== "y") f.push({ id: "grow", q: "Make each one bigger than the last?" });
      if (!b.spin) f.push({ id: "spin", q: "Make it spin?" });
      f.push({ id: "delete", q: "Delete this shape?" });
    }
    return f.map(function (x) { x.b = k; return x; });
  }
  function fieldTasks(b, id) {
    if (id.indexOf("num:") === 0) return [numTask(b, id.slice(4))];
    if (id === "color") return [colorTask(b)];
    if (id === "layout") return [layoutTask(b)];
    if (id === "shape") return [shapeTask(b, false)];
    if (id === "loop") return [{ t: "do", op: "loop", b: b }, numTask(b, "repeat"), layoutTask(b)];
    return [{ t: "do", op: id, b: b }];
  }
  function doOp(task) {
    var c = C(), b = c.prog.blocks[task.b];
    if (task.op === "fresh") { c.prog = { blocks: [] }; c.queue = []; return; }
    if (!b) return;
    if (task.op === "loop") { b.repeat = b.repeat || 3; }
    else if (task.op === "unloop") { b.repeat = 0; b.grow = false; }
    else if (task.op === "grow") b.grow = true;
    else if (task.op === "nogrow") b.grow = false;
    else if (task.op === "spin") b.spin = true;
    else if (task.op === "nospin") b.spin = false;
    else if (task.op === "delete") { c.prog.blocks.splice(task.b, 1); c.queue = []; api.sound("tick"); }
    else if (task.op === "added") {
      api.addPoint(); api.sound("good");
      c.queue.splice(1, 0, { t: "say", text: "Added! Your program has " + run(c.prog).lines.length + " lines now." });
    }
  }

  // Run "do" steps, skip questions that don't apply, then ask the next question.
  function advance(full) {
    var c = C();
    for (var guard = 0; guard < 50; guard++) {
      var head = c.queue[0];
      if (!head) { c.queue = [menuTask()]; continue; }
      if (head.t === "do") { c.queue.shift(); doOp(head); continue; }
      if (head.t === "yn" && head.cond === "notStack" && c.prog.blocks[head.b] && c.prog.blocks[head.b].layout === "y") { c.queue.shift(); continue; }
      if (head.t === "say") {
        api.say(head.text, function () { C().queue.shift(); advance(true); }, 400);
        api.renderScreen();
        return;
      }
      break;
    }
    api.ask(full !== false);
  }

  /* ---------- What game.js calls ---------- */
  function init() {
    var p = pendingProg; pendingProg = null;
    api.state().code = { prog: p || { blocks: [] }, queue: [], running: false, runIdx: -1 };
    C().queue = [menuTask()];
  }
  function question(full) {
    var c = C(), task = c.queue[0];
    if (!task) return { text: "" };
    if (task.t === "yn") {
      var b = c.prog.blocks[task.b];
      var q = { keepSize: b ? "Keep the size " + ctorText(b) + "?" : "", loop: "Put it in a loop?", grow: "Make each one bigger than the last?", spin: "Make it spin?", confirmFresh: "Delete this program and start a new one?" }[task.id];
      var sayIt = task.id === "keepSize" && b ? "Keep this size? " + PARAMS[b.shape].map(function (k) { return LABEL[k] + " " + fmt(b[k]); }).join(", ") + "." : q;
      return { text: q, say: sayIt };
    }
    var v = task.options[task.idx < 0 ? 0 : task.idx];
    if (task.kind === "menu") {
      var lead = full && !c.prog.blocks.length ? "Let's write some code. " : "";
      return { text: MENU_Q[v], say: lead + MENU_Q[v] };
    }
    if (task.kind === "shape") return { text: (task.isNew ? "Add a " : "Change it to a ") + v + "?", bigHtml: '<code class="big-code">' + v + "()</code>" };
    if (task.kind === "num") return { text: LABEL[task.key] + ": is it " + fmt(v) + "?", say: LABEL[task.key] + ". Is it " + fmt(v) + "?", big: fmt(v) };
    if (task.kind === "color") return { text: 'Colour: "' + v + '"?', say: "Make it " + v + "?", bigHtml: '<span class="swatch" style="background:' + COLORS[v] + '"></span>' };
    if (task.kind === "layout") return { text: LAYOUT_Q[v], bigHtml: '<span class="big-word">' + LAYOUT_BIG[v] + "</span>" };
    if (task.kind === "line") {
      var line = run(c.prog).lines[v];
      return { text: "Change line " + (v + 1) + "?", say: "Change line " + (v + 1) + ", " + KIND_SAY[line.kind] + "?" };
    }
    if (task.kind === "field") return { text: v.q };
    if (task.kind === "saved") {
      var s = saved()[v];
      var n = s ? s.prog.blocks.length : 0;
      return { text: "Open " + (s ? s.name : "") + "?", say: "Open " + (s ? s.name : "") + ", with " + n + " shape" + (n === 1 ? "" : "s") + "?" };
    }
    return { text: "" };
  }
  function answer(yes) {
    var c = C(), task = c.queue[0];
    if (!task) { advance(); return; }
    if (task.t === "yn") {
      c.queue.shift();
      var next = (yes ? task.yes : task.no) || [];
      if (task.id === "confirmFresh" && yes) next = [{ t: "do", op: "fresh" }];
      c.queue = next.concat(c.queue);
      if (yes) api.sound("tick");
      advance(); return;
    }
    if (yes) {
      var v = task.options[task.idx < 0 ? 0 : task.idx];
      c.queue.shift();
      api.sound("tick");
      if (task.kind === "menu") { doMenu(v); return; }
      if (task.kind === "shape" && task.isNew) c.queue = newShapeTasks(task.b, v).concat(c.queue);
      if (task.kind === "num" && task.key === "x") block(task).autoX = false;
      if (task.kind === "line") {
        var line = run(c.prog).lines[v], f = fieldsFor(line);
        var direct = f.length === 1 && /^(num:|color$|layout$)/.test(f[0].id);
        c.queue = (direct ? fieldTasks(line.b, f[0].id) : [{ t: "choose", kind: "field", options: f, idx: 0, loops: 0 }]).concat(c.queue);
      }
      if (task.kind === "field") c.queue = fieldTasks(v.b, v.id).concat(c.queue);
      if (task.kind === "saved") {
        var s = saved()[v];
        if (s) { c.prog = sanitize(s.prog); c.queue.unshift({ t: "say", text: "Opened " + s.name + ". It runs straight away." }); }
      }
      advance(); return;
    }
    task.idx += 1;
    if (task.idx >= task.options.length) {
      task.idx = 0; task.loops += 1;
      if (task.loops >= 2 && task.kind !== "menu") {
        revert(task);
        if (C().queue[0] === task) C().queue.shift();
        if (task.kind === "line" || task.kind === "field" || task.kind === "saved") C().queue = [];
        advance(); return;
      }
    }
    if (task.kind === "saved") previewSaved(task);
    api.ask(false);
  }
  function previewSaved(task) {
    var s = saved()[task.options[task.idx]];
    if (s) C().prog = sanitize(s.prog);
  }
  function doMenu(v) {
    var c = C();
    if (v === "add") {
      c.prog.blocks.push(newBlock("box"));
      if (c.prog.blocks.length > 12) { c.prog.blocks.pop(); c.queue = [{ t: "say", text: "That's 12 shapes, the most for one program." }]; advance(); return; }
      c.queue = [shapeTask(c.prog.blocks.length - 1, true)];
    } else if (v === "step") { startStep(); return; }
    else if (v === "edit") c.queue = [{ t: "choose", kind: "line", options: editableLines(), idx: 0, loops: 0 }];
    else if (v === "save") {
      var list = saved(), num = 1;
      list.forEach(function (s) { var m = /Program (\d+)/.exec(s.name); if (m) num = Math.max(num, Number(m[1]) + 1); });
      list.unshift({ name: "Program " + num, prog: JSON.parse(JSON.stringify(c.prog)), at: Date.now() });
      var ok = storeSaved(list.slice(0, 20));
      c.queue = [{ t: "say", text: ok ? "Saved as Program " + num + ". Open it again any time from Open a saved program." : "Sorry, this browser won't save. Use Copy link or Download code instead." }];
    } else if (v === "open") {
      var all = saved();
      c.queue = [{ t: "choose", kind: "saved", options: all.map(function (s, i) { return i; }), idx: 0, loops: 0, origProg: JSON.stringify(c.prog) }];
      previewSaved(c.queue[0]);
    } else if (v === "fresh") c.queue = [{ t: "yn", id: "confirmFresh", yes: [], no: [] }];
    else if (v === "games") { api.startMode("menu"); return; }
    advance();
  }

  /* Step through the program, one line at a time, with i and the scene count. */
  var stepTimer = null;
  function startStep() {
    var c = C(), r = run(c.prog);
    c.running = true; c.runIdx = 0;
    api.setQuestion("Running your program, line by line…");
    api.setBig(null);
    api.setFeedback("Press Yes to skip to the end.");
    setObjects([]);
    stepOnce();
  }
  function stepOnce() {
    var c = C();
    if (!c || !c.running) return;
    var r = run(c.prog), ev = r.trace[c.runIdx];
    if (!ev) { finishStep(); return; }
    var next = r.trace[c.runIdx + 1], count = next ? next.count : r.objects.length;
    setObjects(r.objects.slice(0, count));
    renderCode(r.lines, ev.line);
    watch((ev.i !== null ? "i = " + ev.i + "   ·   " : "") + "scene: " + count + " shape" + (count === 1 ? "" : "s"));
    api.sound("tick");
    c.runIdx += 1;
    stepTimer = api.later(stepOnce, r.trace.length > 40 ? 550 : 900);
  }
  function finishStep() {
    var c = C(), r = run(c.prog);
    c.running = false;
    setObjects(r.objects);
    renderCode(r.lines, -1);
    watch("Done: " + r.trace.length + " steps, " + r.objects.length + " shape" + (r.objects.length === 1 ? "" : "s") + " in the scene.");
    api.say("Done! Your program ran " + r.trace.length + " steps and made " + r.objects.length + " shape" + (r.objects.length === 1 ? "" : "s") + ".", function () { advance(true); }, 600);
  }
  function skip() { var c = C(); if (c && c.running) { c.running = false; finishStep(); } }
  function watch(text) { var w = document.getElementById("watch"); w.hidden = !text; w.textContent = text || ""; }

  function render() {
    var c = C(), task = c.queue[0];
    preview(task);
    var r = run(c.prog);
    if (c.running) return;
    var hl = -1;
    if (task && task.t === "choose") {
      if (task.kind === "line") hl = task.options[task.idx < 0 ? 0 : task.idx];
      else if (task.b !== undefined) hl = lineFor(r.lines, task.b, task.key);
    } else if (task && task.t === "yn" && task.b !== undefined) {
      hl = lineFor(r.lines, task.b, task.id === "keepSize" ? "w" : "x");
    }
    if (task && task.kind === "field") {
      var f = task.options[task.idx < 0 ? 0 : task.idx];
      hl = lineFor(r.lines, f.b, { color: "color", layout: "layout", shape: "shape" }[f.id] || (f.id.indexOf("num:") === 0 ? f.id.slice(4) : "x"));
      if (!/^(num:|color|layout|shape)/.test(f.id)) for (var i = 0; i < r.lines.length; i++) if (r.lines[i].b === f.b && r.lines[i].kind === "add") hl = i;
    }
    renderCode(r.lines, hl);
    watch(r.error ? "Error: " + r.error : "");
    setObjects(r.objects);
    api.view.spin = true;
  }

  /* Adult tools: share link and download. */
  function encode(prog) {
    var s = JSON.stringify(prog);
    return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function fromHash() {
    var m = /[#&]p=([A-Za-z0-9_-]+)/.exec(location.hash);
    if (!m) return null;
    try {
      var s = m[1].replace(/-/g, "+").replace(/_/g, "/");
      while (s.length % 4) s += "=";
      pendingProg = sanitize(JSON.parse(decodeURIComponent(escape(atob(s)))));
      return pendingProg;
    } catch (e) { return null; }
  }
  function message(t) { var m = document.getElementById("code-msg"); m.textContent = ""; setTimeout(function () { m.textContent = t; }, 40); }
  document.getElementById("btn-copy-code").addEventListener("click", function () {
    var url = location.origin + location.pathname + "?mode=code#p=" + encode(C().prog);
    var done = function () { message("Link copied. Anyone who opens it gets this program."); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { prompt("Copy this link:", url); });
    else { prompt("Copy this link:", url); }
  });
  document.getElementById("btn-download-code").addEventListener("click", function () {
    var head = [
      "// Made in Shape Explorer: Code lab",
      "// Shapes: box(width, height, depth), prism(sides, radius, height), pyramid(sides, radius, height),",
      "//         cylinder(radius, height), cone(radius, height), sphere(radius)",
      "// Each shape has .color, .position.x / .y / .z, .scale and .spin. scene.add(shape) shows it.",
      ""
    ];
    var text = head.concat(run(C().prog).lines.map(function (l) { return l.text; })).join("\n") + "\n";
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
    a.download = "shape-program.js";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    message("Downloaded shape-program.js.");
  });

  return {
    init: init, question: question, answer: answer, render: render, draw: draw, skip: skip, fromHash: fromHash,
    isRunning: function () { var c = C(); return !!(c && c.running); },
    stop: function () { var c = C(); if (c) c.running = false; },
    leave: function () { objs = []; fit = null; api.view.objects = null; watch(""); api.el.code.classList.remove("is-lab"); }
  };
};
