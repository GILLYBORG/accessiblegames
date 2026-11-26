/* Hot and Cold (Grade 2, Properties of Liquids and Solids; Air and Water in the Environment).
   Heat or cool ice, chocolate or crayon wax. Solids melt into liquids, liquids freeze into solids,
   and water boils into steam. The temperature stays the same while something is melting, freezing or boiling,
   which shows up as a flat part on the graph. */
(function () {
  "use strict";
  var $ = Sim.$;
  var MAXMIN = 90;
  var MATS = {
    water: { label: "Ice and water", solid: "ice", liquid: "water", melt: 0, boil: 100, max: 100, start: -10, Lf: 9, Lv: 60,
             solidColor: "#d8f0ff", liquidColor: "#4f9fe8", floats: true },
    chocolate: { label: "Chocolate", solid: "chocolate", liquid: "melted chocolate", melt: 34, boil: null, max: 60, start: 20, Lf: 6,
             solidColor: "#6b3e26", liquidColor: "#8a5034" },
    wax: { label: "Crayon wax", solid: "crayon wax", liquid: "melted wax", melt: 62, boil: null, max: 95, start: 20, Lf: 7,
             solidColor: "#d9443a", liquidColor: "#ef6a5f" }
  };
  var HEAT = {
    freezer: { label: "Freezer", words: "in the freezer" },
    off: { label: "Room (no heat)", words: "sitting in the room" },
    low: { label: "Low heat", words: "on low heat" },
    high: { label: "High heat", words: "on high heat" }
  };
  var mat = "water", heat = "low", lid = false, zoom = false;
  var S, rows, playing = null;

  function reset() {
    stop();
    var m = MATS[mat];
    S = { minute: 0, T: m.start, solid: 1, liquid: 0, boiling: false, empty: false, trend: 0, lost: 0 };
    rows = [[0, HEAT[heat].label, m.start, see()]];
  }

  /* ---------- One minute ---------- */
  function heatIn() {
    var T = S.T;
    if (heat === "freezer") return T > -18 ? Math.max(-7, (-18 - T) * 0.5) : 0;
    if (heat === "off") return (20 - T) * 0.12;
    return heat === "low" ? 3 : 8;
  }
  function apply(Q) {
    var m = MATS[mat], guard = 0, d;
    S.boiling = false; S.trend = Q > 0.05 ? 1 : Q < -0.05 ? -1 : 0;
    while (Math.abs(Q) > 1e-6 && guard++ < 12) {
      if (Q > 0) {
        if (S.solid > 0 && S.T < m.melt) { d = Math.min(Q, m.melt - S.T); S.T += d; Q -= d; continue; }
        if (S.solid > 0) { d = Math.min(S.solid, Q / m.Lf); S.solid -= d; S.liquid += d; Q -= d * m.Lf; if (S.solid < 1e-6) S.solid = 0; continue; }
        if (S.liquid <= 0) { Q = 0; break; }
        if (S.T < m.max) { d = Math.min(Q, m.max - S.T); S.T += d; Q -= d; continue; }
        if (m.boil != null) {
          S.boiling = true;
          if (lid) { Q = 0; break; } // steam hits the lid, turns back into drops and falls back in
          d = Math.min(S.liquid, Q / m.Lv); S.liquid -= d; S.lost += d; Q -= d * m.Lv;
          if (S.liquid < 1e-6) { S.liquid = 0; S.empty = true; }
          continue;
        }
        Q = 0; // the stove keeps it at its top temperature so it does not burn
      } else {
        if (S.liquid > 0 && S.T > m.melt) { d = Math.max(Q, m.melt - S.T); S.T += d; Q -= d; continue; }
        if (S.liquid > 0) { d = Math.min(S.liquid, -Q / m.Lf); S.liquid -= d; S.solid += d; Q += d * m.Lf; if (S.liquid < 1e-6) S.liquid = 0; continue; }
        if (S.solid <= 0) { Q = 0; break; }
        S.T += Q; Q = 0;
      }
    }
    if (S.empty) S.boiling = false;
  }
  function tick() {
    S.minute++;
    apply(heatIn());
    rows.push([S.minute, HEAT[heat].label, round(S.T), see()]);
  }
  function round(t) { return Math.round(t * 10) / 10; }

  /* ---------- Words ---------- */
  function see() {
    var m = MATS[mat];
    if (S.empty) return "an empty pot. All the water boiled away into the air";
    if (S.solid > 0 && S.liquid > 0) return S.trend < 0 ? m.liquid + " freezing into " + m.solid : m.solid + " melting into " + m.liquid;
    if (S.solid > 0) return "solid " + m.solid;
    if (S.boiling) return lid ? "boiling water. Steam turns back into drops on the lid" : "boiling water. Steam is going into the air";
    if (mat === "water" && S.T >= 60) return "hot water with a little steam";
    if (S.T >= m.max && m.boil == null && heat !== "off" && heat !== "freezer") return m.liquid + ", kept at " + m.max + " °C so it does not burn";
    return "liquid " + m.liquid;
  }
  function temp(t) { t = Math.round(t); return t + " °C"; }
  function state() {
    if (S.empty) return "nothing left";
    if (S.solid > 0 && S.liquid > 0) return "solid and liquid";
    return S.solid > 0 ? "solid" : S.boiling ? "liquid boiling into gas" : "liquid";
  }
  function summary() {
    var m = MATS[mat];
    var h = "Minute " + S.minute + ". The " + (mat === "water" ? "pot" : m.solid) + " is " + HEAT[heat].words + (lid ? ", with the lid on" : "") + ".";
    var l = ["It is " + temp(S.T) + ". You see " + see() + "."];
    if (S.solid > 0 && S.liquid > 0) l.push("The temperature stays at " + temp(m.melt) + " until it has all " + (S.trend < 0 ? "frozen" : "melted") + ".");
    if (S.boiling && !lid) l.push("The temperature stays at 100 °C while it boils. The water level goes down.");
    if (S.boiling && lid) l.push("The temperature stays at 100 °C while it boils.");
    if (S.lost > 0.02 && !S.empty) l.push("Some water has gone into the air as steam.");
    return { head: h, lines: l, facts: ["State: " + state(), m.solid.charAt(0).toUpperCase() + m.solid.slice(1) + " melts at " + temp(m.melt)].concat(m.boil != null ? ["Water boils at 100 °C"] : []) };
  }

  /* ---------- Picture ---------- */
  var PX = 280, PW = 260, PT = 210, PB = 420; // pot left, width, top, bottom
  function draw() {
    var hc = document.documentElement.classList.contains("hc"), m = MATS[mat];
    var g = '<rect width="900" height="560" fill="' + (hc ? "#000" : "#1b2a4a") + '"/>';
    g += '<rect y="470" width="900" height="90" fill="' + (hc ? "#000" : "#2a3b60") + '" stroke="' + (hc ? "#fff" : "none") + '"/>';
    // Heat source
    var cx = PX + PW / 2;
    if (heat === "freezer") {
      g += '<rect x="' + (PX - 60) + '" y="120" width="' + (PW + 120) + '" height="350" rx="18" fill="#bfe6ff" opacity="' + (hc ? 0.25 : 0.22) + '" stroke="#bfe6ff" stroke-width="5"/>';
      g += '<text x="' + cx + '" y="155" text-anchor="middle" font-size="26" font-weight="800" fill="#d8f0ff" font-family="Nunito, sans-serif">Freezer</text>';
      [[PX - 35, 170], [PX - 35, 300], [PX - 35, 420], [PX + PW + 35, 170], [PX + PW + 35, 300], [PX + PW + 35, 420]].forEach(function (f) { g += snow(f[0], f[1]); });
    }
    g += '<rect x="' + (PX - 30) + '" y="440" width="' + (PW + 60) + '" height="30" rx="8" fill="#55607a"/>';
    if (heat === "low" || heat === "high") {
      var big = heat === "high";
      for (var i = 0; i < (big ? 7 : 5); i++) {
        var fx = PX + 20 + i * ((PW - 40) / ((big ? 7 : 5) - 1)), fh = big ? 30 : 16;
        g += '<path d="M' + (fx - 10) + ' 440 Q' + fx + ' ' + (440 - fh * 2) + ' ' + (fx + 10) + ' 440Z" fill="#ff8a3d"/><path d="M' + (fx - 5) + ' 440 Q' + fx + ' ' + (440 - fh) + ' ' + (fx + 5) + ' 440Z" fill="#ffd23f"/>';
      }
    }
    if (heat === "off") g += '<text x="' + cx + '" y="462" text-anchor="middle" font-size="18" fill="#c3cde3">stove off</text>';
    // Pot
    g += '<rect x="' + PX + '" y="' + PT + '" width="' + PW + '" height="' + (PB - PT) + '" rx="14" fill="#9aa7bf" stroke="#d8dfeb" stroke-width="5"/>';
    g += '<rect x="' + (PX + 10) + '" y="' + (PT + 6) + '" width="' + (PW - 20) + '" height="' + (PB - PT - 16) + '" rx="10" fill="' + (hc ? "#000" : "#2a3550") + '"/>';
    g += '<rect x="' + (PX - 50) + '" y="' + (PT + 20) + '" width="50" height="14" rx="7" fill="#d8dfeb"/><rect x="' + (PX + PW) + '" y="' + (PT + 20) + '" width="50" height="14" rx="7" fill="#d8dfeb"/>';
    // Contents
    var inner = PB - 10, fullH = 150;
    var lh = S.liquid * fullH, top = inner - lh;
    if (lh > 0) {
      g += '<rect x="' + (PX + 10) + '" y="' + top.toFixed(1) + '" width="' + (PW - 20) + '" height="' + lh.toFixed(1) + '" rx="8" fill="' + m.liquidColor + '"/>';
      if (S.boiling) for (var b = 0; b < 9; b++) g += '<circle cx="' + (PX + 30 + (b * 27) % (PW - 50)) + '" cy="' + (inner - 12 - ((b * 37) % Math.max(10, lh - 20))).toFixed(1) + '" r="' + (5 + b % 3 * 2) + '" fill="none" stroke="#fff" stroke-width="2.5"/>';
    }
    var n = S.solid > 0 ? Math.max(1, Math.round(S.solid * 6)) : 0, size = 22 + 14 * Math.min(1, S.solid * 1.5);
    for (var c = 0; c < n; c++) {
      var col = c % 3, rowi = Math.floor(c / 3);
      var x = PX + 40 + col * 62 + (rowi % 2) * 24;
      var y = m.floats && lh > 20 ? top - size * 0.55 + rowi * 6 : inner - size - rowi * (size + 2);
      if (!m.floats || lh <= 20) y = inner - size - rowi * (size + 2) - (lh > 0 && !m.floats ? 0 : 0);
      g += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + size.toFixed(1) + '" height="' + size.toFixed(1) + '" rx="6" fill="' + m.solidColor + '" stroke="' + (mat === "water" ? "#8fc6ea" : "#00000055") + '" stroke-width="3"/>';
    }
    if (S.empty) g += '<text x="' + cx + '" y="' + (inner - 30) + '" text-anchor="middle" font-size="22" fill="#c3cde3">empty</text>';
    // Lid, steam
    if (lid) {
      g += '<rect x="' + (PX - 8) + '" y="' + (PT - 16) + '" width="' + (PW + 16) + '" height="18" rx="8" fill="#c9d3e3" stroke="#eef2f8" stroke-width="3"/><rect x="' + (cx - 20) + '" y="' + (PT - 32) + '" width="40" height="16" rx="6" fill="#55607a"/>';
      if (S.boiling || (mat === "water" && S.T >= 60 && S.liquid > 0)) for (var dd = 0; dd < 8; dd++) g += '<ellipse cx="' + (PX + 26 + dd * 30) + '" cy="' + (PT + 12 + (dd % 2) * 6) + '" rx="5" ry="7" fill="#9fd3ff"/>';
    } else if (S.boiling || (mat === "water" && S.T >= 60 && S.liquid > 0)) {
      var many = S.boiling ? 5 : 2;
      for (var p = 0; p < many; p++) g += cloud(PX + 50 + p * 42, PT - 40 - (p % 2) * 50, S.boiling ? 1 : 0.6);
    }
    // Thermometer
    var tx = 690, tTop = 60, tBot = 420, lo = -20, hi = 110;
    function ty(v) { return tBot - (v - lo) / (hi - lo) * (tBot - tTop); }
    g += '<rect x="' + (tx - 14) + '" y="' + (tTop - 10) + '" width="28" height="' + (tBot - tTop + 20) + '" rx="14" fill="#fff"/>';
    var tv = Math.max(lo, Math.min(hi, S.T));
    g += '<rect x="' + (tx - 7) + '" y="' + ty(tv).toFixed(1) + '" width="14" height="' + (tBot + 10 - ty(tv)).toFixed(1) + '" rx="7" fill="#e8483d"/><circle cx="' + tx + '" cy="' + (tBot + 22) + '" r="22" fill="#e8483d"/>';
    [-20, 0, 20, 40, 60, 80, 100].forEach(function (v) {
      g += '<line x1="' + (tx + 16) + '" x2="' + (tx + 30) + '" y1="' + ty(v) + '" y2="' + ty(v) + '" stroke="#f6f2e7" stroke-width="2"/><text x="' + (tx + 36) + '" y="' + (ty(v) + 6) + '" font-size="17" fill="#f6f2e7">' + v + '</text>';
    });
    g += '<line x1="' + (tx - 34) + '" x2="' + (tx - 16) + '" y1="' + ty(m.melt) + '" y2="' + ty(m.melt) + '" stroke="#7fd1ff" stroke-width="4"/><text x="' + (tx - 40) + '" y="' + (ty(m.melt) + 6) + '" text-anchor="end" font-size="17" font-weight="700" fill="#7fd1ff">' + "melts" + '</text>';
    if (m.boil != null) g += '<line x1="' + (tx - 34) + '" x2="' + (tx - 16) + '" y1="' + ty(m.boil) + '" y2="' + ty(m.boil) + '" stroke="#ffb27a" stroke-width="4"/><text x="' + (tx - 40) + '" y="' + (ty(m.boil) + 6) + '" text-anchor="end" font-size="17" font-weight="700" fill="#ffb27a">boils</text>';
    g += '<rect x="742" y="470" width="150" height="62" rx="14" fill="#101a30" stroke="#4a5d86" stroke-width="3"/><text x="817" y="514" text-anchor="middle" font-size="34" font-weight="800" fill="#fff" font-family="Nunito, sans-serif">' + Math.round(S.T) + ' °C</text>';
    g += '<rect x="16" y="16" width="190" height="56" rx="14" fill="#101a30" opacity="0.9"/><text x="111" y="54" text-anchor="middle" font-size="28" font-weight="800" fill="#fff" font-family="Nunito, sans-serif">Minute ' + S.minute + '</text>';
    if (zoom) g += '<g id="zoom"><circle cx="110" cy="330" r="96" fill="#0b1222" stroke="#ffd23f" stroke-width="5"/><text x="110" y="452" text-anchor="middle" font-size="18" font-weight="700" fill="#ffd23f">Tiny bits, zoomed in</text><g id="parts"></g></g>';
    $("scene").innerHTML = g;
    var d = summary();
    $("scene-desc").textContent = d.head + " " + d.lines.join(" ");
    if (zoom) initParts();
  }
  function snow(x, y) { return '<g stroke="#e8f6ff" stroke-width="3" stroke-linecap="round" opacity="0.8"><path d="M' + (x - 9) + ' ' + y + 'h18M' + x + ' ' + (y - 9) + 'v18M' + (x - 6) + ' ' + (y - 6) + 'l12 12M' + (x + 6) + ' ' + (y - 6) + 'l-12 12"/></g>'; }
  function cloud(x, y, o) { return '<g fill="#eef6ff" opacity="' + (0.75 * o) + '"><circle cx="' + x + '" cy="' + y + '" r="20"/><circle cx="' + (x + 20) + '" cy="' + (y - 8) + '" r="22"/><circle cx="' + (x + 40) + '" cy="' + y + '" r="18"/></g>'; }

  /* ---------- Zoomed in: how the tiny bits move ---------- */
  var parts = [], raf = null;
  function mode() { return S.empty ? "none" : S.boiling && !lid ? "gas" : S.solid >= S.liquid ? "solid" : "liquid"; }
  function initParts() {
    var md = mode(); parts = [];
    var R = 84, cx = 110, cy = 330;
    if (md === "solid") for (var r = 0; r < 5; r++) for (var c = 0; c < 6; c++) parts.push({ hx: cx - 60 + c * 24, hy: cy - 10 + r * 20, x: 0, y: 0 });
    if (md === "liquid") for (var i = 0; i < 26; i++) parts.push({ x: cx - 60 + (i % 6) * 24 + Math.random() * 6, y: cy + 4 + Math.floor(i / 6) * 18, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8 });
    if (md === "gas") for (var j = 0; j < 9; j++) parts.push({ x: cx + (Math.random() - 0.5) * 100, y: cy + (Math.random() - 0.5) * 100, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5 });
    parts.mode = md; parts.R = R; parts.cx = cx; parts.cy = cy;
    if (!raf) raf = requestAnimationFrame(loop);
    paintParts(0);
  }
  function paintParts(t) {
    var host = document.getElementById("parts"); if (!host) return;
    var md = parts.mode, col = MATS[mat][md === "solid" ? "solidColor" : "liquidColor"], h = "";
    var move = !Sim.reducedMotion;
    parts.forEach(function (p, i) {
      if (md === "solid") { var a = move ? 1.6 * (1 + S.T / 120) : 0; p.x = p.hx + Math.sin(t / 90 + i) * a; p.y = p.hy + Math.cos(t / 80 + i * 2) * a; }
      else if (move) {
        p.x += p.vx; p.y += p.vy;
        if (md === "liquid") { p.vx += (Math.random() - 0.5) * 0.3; p.vy += (Math.random() - 0.5) * 0.3 + 0.02; p.vx *= 0.95; p.vy *= 0.95; }
        var dx = p.x - parts.cx, dy = p.y - parts.cy, dist = Math.sqrt(dx * dx + dy * dy), lim = parts.R - 10;
        if (md === "liquid" && p.y < parts.cy - 8) { p.vy = Math.abs(p.vy) + 0.2; }
        if (dist > lim) { p.x = parts.cx + dx / dist * lim; p.y = parts.cy + dy / dist * lim; var nx = dx / dist, ny = dy / dist, dot = p.vx * nx + p.vy * ny; p.vx -= 2 * dot * nx; p.vy -= 2 * dot * ny; }
      }
      h += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="9" fill="' + (md === "gas" ? "#d8ecff" : col) + '" stroke="#fff" stroke-width="1.5"/>';
    });
    host.innerHTML = h;
  }
  function loop(t) {
    raf = null;
    if (!zoom || !document.getElementById("parts")) return;
    paintParts(t);
    if (!Sim.reducedMotion) raf = requestAnimationFrame(loop);
  }

  /* ---------- Notice, chart, table ---------- */
  function notice() {
    var d = summary();
    $("notice").innerHTML = "<p><strong>" + d.head + "</strong></p>" + d.lines.map(function (l) { return "<p>" + l + "</p>"; }).join("") +
      '<ul class="facts">' + d.facts.map(function (f) { return "<li>" + f + "</li>"; }).join("") + "</ul>";
  }
  function results() {
    var pts = rows.map(function (r) { return [r[0], r[2]]; });
    Sim.chart($("chart"), {
      x: { label: "Minutes", min: 0, max: Math.max(20, Math.ceil(S.minute / 10) * 10) },
      y: { label: "Temperature (°C)", min: mat === "water" ? -20 : 0, max: mat === "water" ? 100 : MATS[mat].max, unit: "°C" },
      series: [{ name: "Temperature", color: "var(--s2)", marker: "circle", points: pts }],
      summary: "Line graph of temperature over " + S.minute + " minutes. It is now " + temp(S.T) + ". Flat parts show melting, freezing or boiling. The table next to it has every minute."
    });
    Sim.table($("table"), {
      caption: "Temperature each minute",
      columns: [{ label: "Minute" }, { label: "Heat" }, { label: "Temperature (°C)", num: true }, { label: "What you see" }],
      rows: rows, highlightLast: true
    });
  }
  function render() { draw(); notice(); results(); syncButtons(); }

  /* ---------- Controls ---------- */
  var cMat, cHeat, cLid, cZoom, bNext, bFive, bPlay, bReset;
  function buildControls() {
    var sc = $("setup-controls");
    cMat = Sim.choices(sc, { label: "What is in the pot", value: mat, options: Object.keys(MATS).map(function (k) { return { value: k, label: MATS[k].label }; }),
      onChange: function (v) { mat = v; reset(); render(); var d = summary(); Sim.say("New pot: " + MATS[v].label + ". " + d.lines.join(" ")); } });
    cHeat = Sim.choices(sc, { label: "Heat", value: heat, options: Object.keys(HEAT).map(function (k) { return { value: k, label: HEAT[k].label }; }),
      onChange: function (v) { heat = v; if (rows.length) rows[rows.length - 1][1] = HEAT[v].label; render(); Sim.say("The pot is now " + HEAT[v].words + ". Press Next minute to see what happens."); } });
    cLid = Sim.choices(sc, { label: "Lid", value: "off", options: [{ value: "off", label: "Lid off" }, { value: "on", label: "Lid on" }],
      onChange: function (v) { lid = v === "on"; render(); Sim.say(lid ? "The lid is on. Steam will hit the lid and turn back into water drops." : "The lid is off. Steam can go into the air."); } });
    cZoom = Sim.choices(sc, { label: "Zoom in to see the tiny bits", value: "off", options: [{ value: "off", label: "Zoom off" }, { value: "on", label: "Zoom on" }],
      onChange: function (v) { zoom = v === "on"; render(); Sim.say(zoom ? zoomWords() : "Zoom off."); } });

    var tc = $("time-controls");
    var row = Sim.el("div", { class: "row" });
    bNext = Sim.el("button", { type: "button", class: "btn btn-primary" }, "<span>Next minute</span>");
    bFive = Sim.el("button", { type: "button", class: "btn" }, "<span>5 minutes</span>");
    bPlay = Sim.el("button", { type: "button", class: "btn", "aria-pressed": "false" }, "<span>Play</span>");
    bReset = Sim.el("button", { type: "button", class: "btn" }, "<span>Start over</span>");
    [bNext, bFive, bPlay, bReset].forEach(function (b) { row.appendChild(b); });
    tc.appendChild(row);
    bNext.addEventListener("click", function () { stop(); step(1); });
    bFive.addEventListener("click", function () { stop(); step(5); });
    bPlay.addEventListener("click", function () { if (playing) { stop(); tell(); } else play(); });
    bReset.addEventListener("click", function () { reset(); render(); tell("Start over. "); });
    $("btn-describe").innerHTML = Sim.icon.describe + "<span>Describe the pot</span>";
    $("btn-describe").addEventListener("click", function () { tell(); if (zoom) setTimeout(function () { Sim.say(zoomWords()); }, 50); });
    $("btn-csv").innerHTML = Sim.icon.csv + "<span>Save results (CSV)</span>";
    $("btn-csv").addEventListener("click", function () {
      Sim.downloadCsv("hot-and-cold-results.csv", ["Minute", "Heat", "Temperature (°C)", "What you see"], rows);
      Sim.say("Results saved as a file.");
    });
  }
  function zoomWords() {
    var md = mode();
    if (md === "solid") return "Zoomed in: in a solid, the tiny bits are packed in rows. They only wiggle in place.";
    if (md === "liquid") return "Zoomed in: in a liquid, the tiny bits are close together but slide past each other.";
    if (md === "gas") return "Zoomed in: in steam, a gas, the tiny bits are far apart and zoom around fast.";
    return "Zoomed in: the pot is empty.";
  }
  function syncButtons() {
    var done = S.minute >= MAXMIN;
    bNext.disabled = done; bFive.disabled = done;
    bPlay.setAttribute("aria-pressed", playing ? "true" : "false");
    bPlay.querySelector("span").textContent = playing ? "Pause" : "Play";
  }
  function step(n) {
    var before = state();
    for (var i = 0; i < n && S.minute < MAXMIN; i++) tick();
    render();
    if (!playing || state() !== before) tell(); else Sim.say("Minute " + S.minute + ". " + temp(S.T) + ".");
    if (S.minute >= MAXMIN) stop();
  }
  function tell(prefix) { var d = summary(); Sim.say((prefix || "") + d.head + " " + d.lines.join(" ")); }
  function play() {
    playing = setInterval(function () { step(1); }, Sim.settings().talk ? 2600 : 1200);
    syncButtons(); Sim.say("Playing.");
  }
  function stop() { if (playing) { clearInterval(playing); playing = null; if (bPlay) syncButtons(); } }

  Sim.init({
    onLook: function () { draw(); },
    teacherNotes:
      "<p>Ontario Science and Technology (2022), Grade 2: <strong>Properties of Liquids and Solids</strong> (changes of state when heated or cooled) and <strong>Air and Water in the Environment</strong> (water as ice, water and steam).</p>" +
      "<ul><li>Start: ice at −10 °C on low heat. Press Next minute and watch the graph go up, stay flat at 0 °C while the ice melts, then go up again.</li>" +
      "<li>Leave the lid off and boil: the water level goes down because steam goes into the air. Put the lid on: drops form on the lid and fall back in.</li>" +
      "<li>Move a pot of water to the Freezer to see it freeze. Try Room (no heat) to see ice melt slowly.</li>" +
      "<li>Chocolate and crayon wax are solid at room temperature. Compare their melting points with ice: which needs the most heat to melt?</li>" +
      "<li>Zoom on shows tiny bits (particles): useful later for Grade 5 matter. Times are sped up.</li></ul>"
  });
  reset();
  buildControls();
  render();
  tell("Hot and Cold. ");
})();
