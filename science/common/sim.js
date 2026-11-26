/* Science simulators: shared helpers.
   - Toolbar buttons (Talk, Settings, Full screen), the Settings panel and the full screen exit button
   - Sim.say(): every change is written to a polite live region (screen readers) and, if Talk is on, spoken
   - Sim.choices() and Sim.stepper(): big buttons instead of sliders, so touch, keyboard and switches all work
   - Sim.chart() and Sim.table(): every graph has a data table beside it
   - Switch scanning: one switch (lights move by themselves) or two switches (Space moves, Enter picks)
   Settings are remembered on this device (localStorage "ag-science"). Nothing the student makes is uploaded or kept. */
(function () {
  "use strict";
  var root = document.documentElement;
  var KEY = "ag-science";
  var params = new URLSearchParams(location.search);
  var settings = { talk: false, rate: 0.95, contrast: false, bigText: false, scan: "off", speed: 2, fsTipSeen: false };
  try { var saved = JSON.parse(localStorage.getItem(KEY) || "{}"); for (var k in saved) if (k in settings) settings[k] = saved[k]; } catch (e) {}
  // Links can set things: ?talk=1 &hc=1 &big=1 &scan=one|two &speed=3
  if (params.has("talk")) settings.talk = params.get("talk") !== "0";
  if (params.has("hc")) settings.contrast = params.get("hc") !== "0";
  if (params.has("big")) settings.bigText = params.get("big") !== "0";
  if (/^(off|one|two)$/.test(params.get("scan") || "")) settings.scan = params.get("scan");
  var sp = parseFloat(params.get("speed")); if (sp >= 1 && sp <= 8) settings.speed = sp;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) {} }

  var reducedMotion = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) for (var a in attrs) {
      if (a === "class") n.className = attrs[a];
      else if (a === "text") n.textContent = attrs[a];
      else n.setAttribute(a, attrs[a]);
    }
    if (html != null) n.innerHTML = html;
    return n;
  }
  var ICON = {
    talk: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    settings: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="16" cy="7" r="2.5" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="10" cy="17" r="2.5" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>',
    fs: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    fsExit: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    describe: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
    csv: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 19h14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  /* ---------- Speaking ---------- */
  var live, synth = window.speechSynthesis, voice = null;
  function pickVoice() {
    if (!synth) return;
    var vs = synth.getVoices() || [];
    voice = vs.filter(function (v) { return /^en(-|_)CA/i.test(v.lang); })[0] ||
            vs.filter(function (v) { return /^en(-|_)(US|GB)/i.test(v.lang) && v.localService; })[0] ||
            vs.filter(function (v) { return /^en/i.test(v.lang); })[0] || null;
  }
  if (synth) { pickVoice(); if (synth.addEventListener) synth.addEventListener("voiceschanged", pickVoice); }
  function speak(text) {
    if (!settings.talk || !synth || !text) return;
    try {
      synth.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.rate = settings.rate; if (voice) u.voice = voice; u.lang = voice ? voice.lang : "en-CA";
      synth.speak(u);
    } catch (e) {}
  }
  function say(text) {
    if (!live) return;
    live.textContent = "";
    setTimeout(function () { live.textContent = text; }, 40);
    speak(text);
  }

  /* ---------- Controls ---------- */
  var uid = 0;
  // Choice buttons: one of several, shown with aria-pressed.
  function choices(container, opt) {
    var id = "g" + (++uid);
    var g = el("div", { class: "group", role: "group", "aria-labelledby": id });
    g.appendChild(el("p", { class: "group-label", id: id, text: opt.label }));
    var row = el("div", { class: "choices" });
    var value = opt.value, buttons = [];
    opt.options.forEach(function (o) {
      var b = el("button", { type: "button", class: "btn", "aria-pressed": "false", "data-value": o.value });
      b.innerHTML = (o.icon || "") + "<span>" + o.label + "</span>";
      b.addEventListener("click", function () { if (b.disabled) return; set(o.value); if (opt.onChange) opt.onChange(o.value, o); });
      buttons.push(b); row.appendChild(b);
    });
    g.appendChild(row);
    container.appendChild(g);
    function set(v) {
      value = v;
      buttons.forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-value") === String(v) ? "true" : "false"); });
    }
    set(value);
    return { set: set, get: function () { return value; }, el: g,
      label: function () { var o = opt.options.filter(function (o) { return String(o.value) === String(value); })[0]; return o ? o.label : ""; },
      disable: function (on) { buttons.forEach(function (b) { b.disabled = !!on; }); } };
  }
  // Stepper: less / value / more. Good for switches (no dragging).
  function stepper(container, opt) {
    var id = "g" + (++uid);
    var g = el("div", { class: "group", role: "group", "aria-labelledby": id });
    g.appendChild(el("p", { class: "group-label", id: id, text: opt.label }));
    var row = el("div", { class: "stepper" });
    var less = el("button", { type: "button", class: "btn", "aria-label": opt.lessLabel || "Less" }, opt.lessIcon || "&minus;");
    var out = el("output", { "aria-live": "off" });
    var more = el("button", { type: "button", class: "btn", "aria-label": opt.moreLabel || "More" }, opt.moreIcon || "+");
    row.appendChild(less); row.appendChild(out); row.appendChild(more); g.appendChild(row);
    container.appendChild(g);
    var value = opt.value, step = opt.step || 1;
    function set(v, fire) {
      v = Math.max(opt.min, Math.min(opt.max, v));
      value = v; out.textContent = opt.format ? opt.format(v) : String(v);
      less.disabled = v <= opt.min; more.disabled = v >= opt.max;
      if (fire && opt.onChange) opt.onChange(v);
    }
    less.addEventListener("click", function () { set(value - step, true); });
    more.addEventListener("click", function () { set(value + step, true); });
    set(value, false);
    return { set: set, get: function () { return value; }, el: g };
  }

  /* ---------- Graph ---------- */
  var MARKERS = {
    circle: function (x, y) { return '<circle cx="' + x + '" cy="' + y + '" r="5.5"/>'; },
    square: function (x, y) { return '<rect x="' + (x - 5) + '" y="' + (y - 5) + '" width="10" height="10" rx="1.5"/>'; },
    triangle: function (x, y) { return '<path d="M' + x + ' ' + (y - 6.5) + 'L' + (x + 6.5) + ' ' + (y + 5) + 'L' + (x - 6.5) + ' ' + (y + 5) + 'Z"/>'; },
    diamond: function (x, y) { return '<path d="M' + x + ' ' + (y - 7) + 'L' + (x + 7) + ' ' + y + 'L' + x + ' ' + (y + 7) + 'L' + (x - 7) + ' ' + y + 'Z"/>'; }
  };
  function niceStep(range, target) {
    var raw = range / target, mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  // spec: { x: {label, min, max, ticks?, format?}, y: {label, min?, max?, format?, unit?}, series: [{name, color, marker, points: [[x, y], ...]}],
  //         empty: "text when no points", summary: "text for screen readers" }
  function chart(wrap, spec) {
    var W = 640, H = 340, L = 62, R = spec.series.length > 1 ? 92 : 24, T = 16, B = 58;
    var pw = W - L - R, ph = H - T - B;
    var all = [];
    spec.series.forEach(function (s) { s.points.forEach(function (p) { all.push(p); }); });
    var xmin = spec.x.min, xmax = spec.x.max;
    var ymin = spec.y.min != null ? spec.y.min : Math.min(0, Math.min.apply(null, all.map(function (p) { return p[1]; }).concat([0])));
    var ymaxData = Math.max.apply(null, all.map(function (p) { return p[1]; }).concat([spec.y.minTop || 1]));
    var ymax = spec.y.max != null ? Math.max(spec.y.max, ymaxData) : ymaxData;
    var ys = niceStep(ymax - ymin || 1, 5);
    ymin = Math.floor(ymin / ys) * ys; ymax = Math.ceil(ymax / ys) * ys; if (ymax === ymin) ymax = ymin + ys;
    function X(v) { return L + (v - xmin) / (xmax - xmin || 1) * pw; }
    function Y(v) { return T + ph - (v - ymin) / (ymax - ymin) * ph; }
    var fx = spec.x.format || String, fy = spec.y.format || function (v) { return String(Math.round(v * 10) / 10); };
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(spec.summary || spec.title || "Graph") + '">';
    for (var v = ymin; v <= ymax + 1e-9; v += ys) {
      var yy = Y(v).toFixed(1);
      s += '<line class="' + (Math.abs(v) < 1e-9 ? "baseline" : "grid") + '" x1="' + L + '" x2="' + (L + pw) + '" y1="' + yy + '" y2="' + yy + '"/>';
      s += '<text class="axis-text" x="' + (L - 8) + '" y="' + yy + '" dy="5" text-anchor="end">' + esc(fy(Math.round(v * 100) / 100)) + '</text>';
    }
    if (ymin < 0 || ymin > 0) s += '<line class="baseline" x1="' + L + '" x2="' + (L + pw) + '" y1="' + Y(Math.max(ymin, Math.min(0, ymax))).toFixed(1) + '" y2="' + Y(Math.max(ymin, Math.min(0, ymax))).toFixed(1) + '"/>';
    var ticks = spec.x.ticks || (function () { var st = niceStep(xmax - xmin || 1, 7), t = []; for (var v = Math.ceil(xmin / st) * st; v <= xmax + 1e-9; v += st) t.push(v); return t; })();
    ticks.forEach(function (t) {
      s += '<text class="axis-text" x="' + X(t).toFixed(1) + '" y="' + (T + ph + 22) + '" text-anchor="middle">' + esc(fx(t)) + '</text>';
    });
    s += '<text class="axis-title" x="' + (L + pw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(spec.x.label) + '</text>';
    s += '<text class="axis-title" transform="translate(16 ' + (T + ph / 2) + ') rotate(-90)" text-anchor="middle">' + esc(spec.y.label) + '</text>';
    if (!all.length) {
      s += '<text class="empty" x="' + (L + pw / 2) + '" y="' + (T + ph / 2) + '" text-anchor="middle">' + esc(spec.empty || "No results yet.") + '</text>';
    }
    // Lines, then markers with a 2px surface ring, then direct labels at the end of each line.
    var labels = [];
    spec.series.forEach(function (se) {
      var pts = se.points.slice().sort(function (a, b) { return a[0] - b[0]; });
      if (pts.length > 1 && se.line !== false) {
        s += '<path class="line" style="stroke:' + se.color + '" d="' + pts.map(function (p, i) { return (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1); }).join("") + '"/>';
      }
      s += '<g style="fill:' + se.color + ';stroke:var(--surface);stroke-width:2">';
      pts.forEach(function (p) { s += (MARKERS[se.marker] || MARKERS.circle)(+X(p[0]).toFixed(1), +Y(p[1]).toFixed(1)); });
      s += '</g>';
      if (pts.length && spec.series.length > 1) { var lp = pts[pts.length - 1]; labels.push({ y: Y(lp[1]), x: X(lp[0]), text: se.short || se.name }); }
    });
    labels.sort(function (a, b) { return a.y - b.y; });
    for (var i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 18) labels[i].y = labels[i - 1].y + 18;
    labels.forEach(function (lb) { s += '<text class="end-label" x="' + (lb.x + 12).toFixed(1) + '" y="' + lb.y.toFixed(1) + '" dy="5">' + esc(lb.text) + '</text>'; });
    s += '<line class="cross" id="' + wrap.id + '-cross" x1="0" x2="0" y1="' + T + '" y2="' + (T + ph) + '" visibility="hidden"/>';
    s += '<rect x="' + L + '" y="' + T + '" width="' + pw + '" height="' + ph + '" fill="transparent" class="hit"/>';
    s += '</svg>';
    var legend = "";
    if (spec.series.length > 1) {
      legend = '<ul class="legend" aria-hidden="true">' + spec.series.map(function (se) {
        return '<li><svg viewBox="0 0 26 16"><line x1="1" x2="25" y1="8" y2="8" stroke="' + se.color + '" stroke-width="2.5"/><g style="fill:' + se.color + ';stroke:var(--surface);stroke-width:2">' + (MARKERS[se.marker] || MARKERS.circle)(13, 8) + '</g></svg>' + esc(se.name) + '</li>';
      }).join("") + '</ul>';
    }
    wrap.innerHTML = '<div class="chart-wrap">' + s + '<div class="tip" hidden></div></div>' + legend;
    // Hover layer: crosshair and a tooltip with every series' value at the nearest x.
    var svg = wrap.querySelector("svg"), tip = wrap.querySelector(".tip"), cross = wrap.querySelector(".cross");
    var xs = []; all.forEach(function (p) { if (xs.indexOf(p[0]) < 0) xs.push(p[0]); }); xs.sort(function (a, b) { return a - b; });
    function move(e) {
      if (!xs.length) return;
      var r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * W;
      var best = xs[0]; xs.forEach(function (x) { if (Math.abs(X(x) - vx) < Math.abs(X(best) - vx)) best = x; });
      var lines = [esc(spec.x.label) + ": " + esc(fx(best))];
      spec.series.forEach(function (se) { se.points.forEach(function (p) { if (p[0] === best) lines.push(esc(se.name) + ": " + esc(fy(p[1])) + (spec.y.unit ? " " + esc(spec.y.unit) : "")); }); });
      tip.innerHTML = lines.join("<br>"); tip.hidden = false;
      cross.setAttribute("x1", X(best)); cross.setAttribute("x2", X(best)); cross.setAttribute("visibility", "visible");
      var px = X(best) / W * r.width, wrapW = r.width;
      tip.style.left = Math.min(wrapW - tip.offsetWidth - 4, Math.max(4, px + 12)) + "px";
      tip.style.top = Math.max(4, (e.clientY - r.top) - tip.offsetHeight - 12) + "px";
    }
    function leave() { tip.hidden = true; cross.setAttribute("visibility", "hidden"); }
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerdown", move);
    svg.addEventListener("pointerleave", leave);
  }

  /* ---------- Table ---------- */
  // spec: { caption, columns: [{label, num}], rows: [[...]], empty }
  function table(wrap, spec) {
    var h = '<div class="table-wrap" tabindex="0" role="region" aria-label="' + esc(spec.caption) + '"><table class="results"><caption>' + esc(spec.caption) + '</caption><thead><tr>';
    spec.columns.forEach(function (c) { h += '<th scope="col">' + esc(c.label) + '</th>'; });
    h += '</tr></thead><tbody>';
    if (!spec.rows.length) h += '<tr><td colspan="' + spec.columns.length + '">' + esc(spec.empty || "No results yet.") + '</td></tr>';
    spec.rows.forEach(function (r, i) {
      h += '<tr' + (spec.highlightLast && i === spec.rows.length - 1 ? ' class="is-new"' : '') + '>';
      r.forEach(function (v, j) { h += (j === 0 ? '<th scope="row">' : '<td' + (spec.columns[j].num ? ' class="num"' : '') + '>') + esc(v) + (j === 0 ? '</th>' : '</td>'); });
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    wrap.innerHTML = h;
    var tw = wrap.querySelector(".table-wrap");
    if (spec.highlightLast) tw.scrollTop = tw.scrollHeight;
  }
  // A results file for the teacher (made on this device, nothing is sent anywhere).
  function downloadCsv(name, columns, rows) {
    var q = function (v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var text = [columns.map(function (c) { return q(c.label || c); }).join(",")].concat(rows.map(function (r) { return r.map(q).join(","); })).join("\n");
    var a = el("a", { href: URL.createObjectURL(new Blob([text], { type: "text/csv" })), download: name });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ---------- Panels ---------- */
  var openPanel = null, panelReturn = null;
  function showPanel(id, from) {
    hidePanel(true);
    var p = $(id); p.hidden = false; openPanel = p; panelReturn = from || null;
    var h = p.querySelector("h2"); if (h) h.focus();
    restartScan();
  }
  function hidePanel(quiet) {
    if (!openPanel) return;
    openPanel.hidden = true; openPanel = null;
    if (!quiet && panelReturn && panelReturn.focus) panelReturn.focus();
    restartScan();
  }

  /* ---------- Switch scanning ---------- */
  var scanItems = [], scanIndex = -1, scanTimer = null, scanLit = null;
  function visible(n) { return !!(n.offsetWidth || n.offsetHeight || n.getClientRects().length) && !n.closest("[hidden]"); }
  function collect() {
    var scope = openPanel || document.querySelector(".app"), order = openPanel ? [openPanel] :
      [".controls", ".notice", ".data", ".bar", ".fs-exit"].map(function (s) { return document.querySelector(s); }).filter(Boolean);
    var seen = [], out = [];
    order.concat([scope]).forEach(function (r) {
      r.querySelectorAll('button, a[href], input[type="checkbox"]').forEach(function (n) {
        if (seen.indexOf(n) >= 0 || n.disabled || !visible(n) || n.closest('[data-noscan]')) return;
        seen.push(n); out.push(n);
      });
    });
    return out;
  }
  function labelOf(n) {
    if (n.getAttribute("aria-label")) return n.getAttribute("aria-label");
    if (n.type === "checkbox") { var l = n.closest("label"); return (l ? l.textContent.trim() : "") + (n.checked ? ", on" : ", off"); }
    var t = n.textContent.replace(/\s+/g, " ").trim();
    if (n.getAttribute("aria-pressed") === "true") t += ", picked";
    return t;
  }
  function light(n) {
    if (scanLit) scanLit.classList.remove("scan-on");
    scanLit = n;
    if (!n) return;
    var target = n.type === "checkbox" ? (n.closest("label") || n) : n;
    scanLit = target; target.classList.add("scan-on");
    try { target.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" }); } catch (e) { target.scrollIntoView(false); }
    speak(labelOf(n));
  }
  function scanNext() {
    scanItems = collect();
    if (!scanItems.length) return;
    scanIndex = (scanIndex + 1) % scanItems.length;
    light(scanItems[scanIndex]);
  }
  function stopScan() { clearInterval(scanTimer); scanTimer = null; light(null); scanIndex = -1; }
  function restartScan(keepPlace) {
    var keep = keepPlace && scanIndex >= 0 ? scanItems[scanIndex] : null;
    clearInterval(scanTimer); scanTimer = null;
    if (settings.scan === "off" || document.hidden) { stopScan(); return; }
    scanItems = collect();
    var at = keep ? scanItems.indexOf(keep) : -1;
    scanIndex = at >= 0 ? at - 1 : -1;
    if (document.activeElement && document.activeElement.blur && document.activeElement !== document.body && !openPanel) document.activeElement.blur();
    scanNext();
    if (settings.scan === "one") scanTimer = setInterval(scanNext, settings.speed * 1000);
  }
  function pick() {
    var n = scanItems[scanIndex];
    if (!n || !document.contains(n) || !visible(n)) { restartScan(); return; }
    n.click();
    // Stay on the same button (handy for pressing "Later" or "Next day" again), unless it went away.
    setTimeout(function () { restartScan(true); }, 60);
  }
  var IGNORE = { Tab: 1, Shift: 1, Control: 1, Alt: 1, Meta: 1, CapsLock: 1, Fn: 1, Escape: 1 };
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && openPanel) { e.preventDefault(); hidePanel(); return; }
    if (e.key === "Escape" && pseudoFs) { toggleFullscreen(); return; }
    if (settings.scan === "off" || IGNORE[e.key] || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    if (e.repeat) return; // holding a switch counts once
    if (settings.scan === "two" && (e.key === " " || e.key === "Spacebar")) { clearInterval(scanTimer); scanNext(); return; }
    pick();
  }, true);
  document.addEventListener("keyup", function (e) { if (settings.scan !== "off" && (e.key === " " || e.key === "Enter")) e.preventDefault(); }, true);
  document.addEventListener("visibilitychange", function () { if (document.hidden) stopScan(); else restartScan(); });

  /* ---------- Full screen ---------- */
  var pseudoFs = false;
  function isStandalone() {
    return window.navigator.standalone === true ||
      (window.matchMedia && (matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches));
  }
  function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function fsSupported() { return !!((root.requestFullscreen || root.webkitRequestFullscreen) && (document.fullscreenEnabled || document.webkitFullscreenEnabled)); }
  function fallbackFullscreen() {
    pseudoFs = true; updateFs();
    if (!settings.fsTipSeen && !isStandalone()) { settings.fsTipSeen = true; save(); showPanel("panel-fullscreen", $("btn-exit-fs")); }
  }
  function updateFs() {
    var on = !!fsElement() || pseudoFs, was = root.classList.contains("is-fullscreen");
    root.classList.toggle("is-fullscreen", on);
    $("btn-exit-fs").hidden = !on;
    $("fullscreen-label").textContent = on ? "Exit full screen" : "Full screen";
    if (on && !was) say("Full screen. To leave, use the Exit full screen button in the top corner.");
    else if (!on && was && settings.scan === "off") $("btn-fullscreen").focus();
    restartScan();
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

  /* ---------- Build the shared parts of the page ---------- */
  function applyLook() {
    root.classList.toggle("hc", !!settings.contrast);
    root.classList.toggle("big-text", !!settings.bigText);
  }
  function init(opt) {
    opt = opt || {};
    applyLook();
    var actions = document.querySelector(".actions");
    var talk = el("button", { type: "button", class: "btn", id: "btn-talk", "aria-pressed": "false" },
      ICON.talk + '<span>Talk: <span class="state" id="talk-state">Off</span></span>');
    var setb = el("button", { type: "button", class: "btn", id: "btn-settings", "aria-haspopup": "dialog", "aria-controls": "panel-settings" }, ICON.settings + "<span>Settings</span>");
    var fsb = el("button", { type: "button", class: "btn", id: "btn-fullscreen" }, ICON.fs + '<span id="fullscreen-label">Full screen</span>');
    [talk, setb, fsb].forEach(function (b) { actions.appendChild(b); });
    var app = document.querySelector(".app");
    var exit = el("button", { type: "button", class: "btn fs-exit", id: "btn-exit-fs", hidden: "" }, ICON.fsExit + "<span>Exit full screen</span>");
    app.appendChild(exit);
    live = el("div", { class: "sr-only", id: "live", "aria-live": "polite", "aria-atomic": "true" });
    app.appendChild(live);

    function showTalk() { talk.setAttribute("aria-pressed", settings.talk ? "true" : "false"); $("talk-state").textContent = settings.talk ? "On" : "Off"; }
    talk.addEventListener("click", function () {
      settings.talk = !settings.talk; save(); showTalk();
      if (settings.talk) speak("Talking is on. I will tell you what changes."); else if (synth) synth.cancel();
      syncSettings();
    });
    showTalk();
    fsb.addEventListener("click", toggleFullscreen);
    exit.addEventListener("click", toggleFullscreen);

    // Settings panel
    var panel = el("div", { class: "overlay", id: "panel-settings", role: "dialog", "aria-modal": "true", "aria-labelledby": "settings-title", hidden: "" });
    panel.innerHTML =
      '<div class="panel"><div class="panel-head"><h2 id="settings-title" tabindex="-1">Settings</h2><button type="button" class="btn btn-primary" data-close>Done</button></div>' +
      '<div class="panel-body">' +
      '<section aria-labelledby="st-talk"><h3 id="st-talk">Talking</h3><div id="set-talk"></div><div id="set-rate"></div>' +
      '<p class="help">Screen readers (VoiceOver, ChromeVox) hear every change without Talk turned on. Turn Talk on for students who do not use a screen reader.</p></section>' +
      '<section aria-labelledby="st-look"><h3 id="st-look">Look</h3><div id="set-contrast"></div><div id="set-big"></div></section>' +
      '<section aria-labelledby="st-scan"><h3 id="st-scan">Switches</h3><div id="set-scan"></div><div id="set-speed"></div>' +
      '<p class="help">One switch: the yellow light moves by itself, press when it is on the button you want. Two switches: Space moves the light, Enter picks. Any switch that types a key works.</p></section>' +
      (opt.teacherNotes ? '<section aria-labelledby="st-notes" class="prose"><h3 id="st-notes">For the teacher</h3>' + opt.teacherNotes + '</section>' : '') +
      '</div></div>';
    document.body.appendChild(panel);
    var fsp = el("div", { class: "overlay", id: "panel-fullscreen", role: "dialog", "aria-modal": "true", "aria-labelledby": "fs-title", hidden: "" });
    fsp.innerHTML = '<div class="panel"><div class="panel-head"><h2 id="fs-title" tabindex="-1">Full screen</h2><button type="button" class="btn btn-primary" data-close>Done</button></div>' +
      '<div class="panel-body prose"><p>This browser cannot hide its own address bar, so the buttons at the top are hidden instead. Use <strong>Exit full screen</strong> in the corner to get them back.</p>' +
      '<p>For true full screen on an iPad, add this page to the Home Screen once: tap Share, then <strong>Add to Home Screen</strong>.</p></div></div>';
    document.body.appendChild(fsp);
    [panel, fsp].forEach(function (p) {
      p.addEventListener("click", function (e) { if (e.target === p || (e.target.closest && e.target.closest("[data-close]"))) hidePanel(); });
    });
    var onoff = [{ value: "on", label: "On" }, { value: "off", label: "Off" }];
    var cTalk = choices($("set-talk"), { label: "Talk (read changes aloud)", options: onoff, value: settings.talk ? "on" : "off",
      onChange: function (v) { settings.talk = v === "on"; save(); showTalk(); if (settings.talk) speak("Talking is on."); } });
    var cRate = stepper($("set-rate"), { label: "Talking speed", min: 0.6, max: 1.3, step: 0.1, value: settings.rate, lessLabel: "Slower", moreLabel: "Faster",
      format: function (v) { return v < 0.85 ? "Slow" : v < 1.05 ? "Normal" : "Fast"; },
      onChange: function (v) { settings.rate = Math.round(v * 10) / 10; save(); speak("This is how fast I talk."); } });
    choices($("set-contrast"), { label: "High contrast", options: onoff, value: settings.contrast ? "on" : "off",
      onChange: function (v) { settings.contrast = v === "on"; save(); applyLook(); if (opt.onLook) opt.onLook(); } });
    choices($("set-big"), { label: "Bigger text", options: onoff, value: settings.bigText ? "on" : "off",
      onChange: function (v) { settings.bigText = v === "on"; save(); applyLook(); } });
    choices($("set-scan"), { label: "Switch scanning", value: settings.scan,
      options: [{ value: "off", label: "Off" }, { value: "one", label: "One switch" }, { value: "two", label: "Two switches" }],
      onChange: function (v) { settings.scan = v; save(); if (v === "off") stopScan(); } });
    stepper($("set-speed"), { label: "Light moves every", min: 1, max: 8, step: 0.5, value: settings.speed, lessLabel: "Faster", moreLabel: "Slower",
      format: function (v) { return v + " seconds"; }, onChange: function (v) { settings.speed = v; save(); } });
    function syncSettings() { cTalk.set(settings.talk ? "on" : "off"); }
    setb.addEventListener("click", function () { showPanel("panel-settings", setb); });

    // After a tap, take focus off the button so a later switch press does not press it again.
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("button");
      if (b && e.detail > 0 && settings.scan !== "off") setTimeout(function () { b.blur(); }, 0);
    });
    window.addEventListener("pageshow", function () { setTimeout(restartScan, 300); });
    return { settings: settings };
  }

  window.Sim = {
    init: init, say: say, speak: speak, choices: choices, stepper: stepper, chart: chart, table: table,
    downloadCsv: downloadCsv, icon: ICON, el: el, $: $, reducedMotion: reducedMotion,
    settings: function () { return settings; }, rescan: function () { if (settings.scan !== "off") restartScan(true); }
  };
})();
