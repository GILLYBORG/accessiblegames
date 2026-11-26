/* Sun and Shadows (Grade 1, Earth and Space Systems: Daily and Seasonal Changes).
   Pick a time of day and a season. The sun moves across the sky like it does in southern Ontario
   (latitude 43.7 degrees north). Your shadow is long when the sun is low and short when it is high.
   Measure it in blocks (you are 4 blocks tall). */
(function () {
  "use strict";
  var $ = Sim.$;
  var LAT = 43.7 * Math.PI / 180, RAD = Math.PI / 180;
  var KID = 4;          // the child is 4 blocks tall
  var MAXB = 20;        // longest shadow we draw / record
  var SEASONS = {
    spring: { label: "Spring", tilt: 0, noon: 13, mean: 8, amp: 6, color: "var(--s3)", marker: "circle" },
    summer: { label: "Summer", tilt: 23.44, noon: 13, mean: 23, amp: 6, color: "var(--s2)", marker: "square" },
    fall: { label: "Fall", tilt: 0, noon: 13, mean: 12, amp: 5, color: "var(--s4)", marker: "diamond" },
    winter: { label: "Winter", tilt: -23.44, noon: 12, mean: -5, amp: 4, color: "var(--s1)", marker: "triangle" }
  };
  // Clocks change for daylight saving time, so the sun is highest at about 1 pm from spring to fall and 12 noon in winter.
  var ORDER = ["spring", "summer", "fall", "winter"];
  var hour = 10, season = "summer", playing = null, measures = [];

  function sun(h, se) {
    var S = SEASONS[se], dec = S.tilt * RAD, H = (h - S.noon) * 15 * RAD;
    var sinEl = Math.sin(LAT) * Math.sin(dec) + Math.cos(LAT) * Math.cos(dec) * Math.cos(H);
    var el = Math.asin(sinEl) / RAD;
    var az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(LAT) - Math.tan(dec) * Math.cos(LAT)) / RAD + 180;
    var h0 = Math.acos(-Math.tan(LAT) * Math.tan(dec)) / RAD / 15;
    return { el: el, az: az, rise: S.noon - h0, set: S.noon + h0, daylight: 2 * h0 };
  }
  function shadowLen(el) { return el <= 0.5 ? Infinity : KID / Math.tan(el * RAD); }
  function temp(h, se) { var S = SEASONS[se]; return Math.round(S.mean + S.amp * Math.cos(2 * Math.PI * (h - 15) / 24)); }

  /* ---------- Words ---------- */
  function clock(h) {
    var hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    if (mm === 60) { hh++; mm = 0; }
    var ap = hh >= 12 ? "pm" : "am", h12 = hh % 12 || 12;
    if (hh === 12 && mm === 0) return "12 noon";
    return h12 + (mm ? ":" + (mm < 10 ? "0" : "") + mm : "") + " " + ap;
  }
  function partOfDay(h) { return h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night"; }
  function compass(az) { return ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"][Math.round(((az % 360) + 360) % 360 / 45) % 8]; }
  function height(el) { return el < 15 ? "low in the sky" : el < 40 ? "partway up the sky" : "high in the sky"; }
  function blocksWords(L) {
    if (L === Infinity) return "no shadow from the sun";
    if (L > MAXB) return "very, very long: more than " + MAXB + " blocks";
    var n = Math.round(L);
    if (n < 1) return "tiny: less than 1 block";
    var size = n <= 2 ? "short" : n <= 5 ? "medium" : "long";
    return size + ": about " + n + " block" + (n === 1 ? "" : "s");
  }
  function feel(t) { return t <= -1 ? "freezing cold" : t < 10 ? "chilly" : t < 18 ? "cool" : t < 25 ? "warm" : "hot"; }
  function wear(se, t) {
    if (se === "winter") return "Wear a warm coat, a hat, mittens and boots.";
    if (t >= 22) return "Wear a T-shirt, a sun hat and sunscreen.";
    if (t >= 15) return "Wear a sweater or a light jacket.";
    return se === "spring" ? "Wear a rain jacket and rain boots." : "Wear a warm jacket.";
  }
  function describe() {
    var s = sun(hour, season), t = temp(hour, season), name = SEASONS[season].label.toLowerCase();
    var out = { head: clock(hour) + " in the " + partOfDay(hour) + ", " + name + ".", lines: [], facts: [] };
    if (s.el <= 0) {
      out.lines.push(hour < 12 ? "The sun is not up yet. It is dark." : "The sun has set. It is dark.");
      out.lines.push("No sun means no sun shadow.");
    } else {
      out.lines.push("The sun is " + height(s.el) + ", in the " + compass(s.az) + ".");
      var L = shadowLen(s.el);
      out.lines.push("Your shadow is " + blocksWords(L) + ". It points " + compass(s.az + 180) + ", away from the sun.");
    }
    out.lines.push("It feels " + feel(t) + ": " + t + " °C. " + wear(season, t));
    out.facts = ["Sunrise " + clock(s.rise), "Sunset " + clock(s.set), "About " + Math.round(s.daylight) + " hours of daylight"];
    return out;
  }

  /* ---------- Picture ---------- */
  var GY = 390, BX = 28; // ground line; block size in pixels
  function mix(a, b, t) {
    var pa = [1, 3, 5].map(function (i) { return parseInt(a.substr(i, 2), 16); }), pb = [1, 3, 5].map(function (i) { return parseInt(b.substr(i, 2), 16); });
    return "#" + pa.map(function (v, i) { var c = Math.round(v + (pb[i] - v) * t).toString(16); return c.length < 2 ? "0" + c : c; }).join("");
  }
  function tree(x, se) {
    var s = '<rect x="' + (x - 9) + '" y="' + (GY - 120) + '" width="18" height="122" rx="5" fill="#6b4a2c"/>';
    s += '<path d="M' + x + ' ' + (GY - 80) + 'l-34 -40M' + x + ' ' + (GY - 95) + 'l30 -42" stroke="#6b4a2c" stroke-width="8" stroke-linecap="round"/>';
    if (se === "winter") {
      s += '<path d="M' + (x - 38) + ' ' + (GY - 122) + 'q6 -6 12 0M' + (x + 22) + ' ' + (GY - 139) + 'q6 -6 12 0" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>';
      return s;
    }
    var leaf = se === "fall" ? ["#e0662a", "#f2a43a", "#c9432a"] : se === "summer" ? ["#2f8f3a", "#3aa648", "#277a31"] : ["#5cbf55", "#7fd06a", "#4aa94a"];
    [[0, -165, 58], [-40, -140, 42], [40, -140, 44], [-18, -195, 38], [22, -190, 40]].forEach(function (c, i) {
      s += '<circle cx="' + (x + c[0]) + '" cy="' + (GY + c[1]) + '" r="' + c[2] + '" fill="' + leaf[i % 3] + '"/>';
    });
    if (se === "spring") [[-30, -170], [10, -200], [35, -150], [-5, -140], [-45, -135]].forEach(function (c) {
      s += '<circle cx="' + (x + c[0]) + '" cy="' + (GY + c[1]) + '" r="7" fill="#ffc6de"/>';
    });
    if (se === "fall") [[-60, 4], [-30, 6], [50, 3], [70, 7]].forEach(function (c) {
      s += '<ellipse cx="' + (x + c[0]) + '" cy="' + (GY + c[1]) + '" rx="8" ry="4" fill="#e0662a"/>';
    });
    return s;
  }
  function kid(x, se) {
    var top = GY - KID * BX, body = { winter: "#2f6fd0", summer: "#ff8a3d", spring: "#ffd23f", fall: "#c0532c" }[se];
    var s = '<circle cx="' + x + '" cy="' + (top + 17) + '" r="17" fill="#c68a5a"/>';
    s += '<rect x="' + (x - 20) + '" y="' + (top + 36) + '" width="40" height="40" rx="10" fill="' + body + '"/>';
    s += '<rect x="' + (x - 16) + '" y="' + (top + 74) + '" width="13" height="38" rx="5" fill="#33415e"/><rect x="' + (x + 3) + '" y="' + (top + 74) + '" width="13" height="38" rx="5" fill="#33415e"/>';
    s += '<path d="M' + (x - 20) + ' ' + (top + 44) + 'l-14 26M' + (x + 20) + ' ' + (top + 44) + 'l14 26" stroke="' + body + '" stroke-width="10" stroke-linecap="round"/>';
    if (se === "winter") s += '<path d="M' + (x - 18) + ' ' + (top + 12) + 'q18 -26 36 0z" fill="#d23a3a"/><circle cx="' + x + '" cy="' + (top - 8) + '" r="6" fill="#fff"/>';
    if (se === "summer") s += '<ellipse cx="' + x + '" cy="' + (top + 4) + '" rx="30" ry="7" fill="#f2d98a"/><path d="M' + (x - 15) + ' ' + (top + 4) + 'q15 -22 30 0z" fill="#f2d98a"/>';
    if (se === "spring") s += '<path d="M' + (x - 19) + ' ' + (top + 14) + 'q19 -30 38 0z" fill="#ffd23f"/>';
    return s;
  }
  function draw() {
    var hc = document.documentElement.classList.contains("hc");
    var s = sun(hour, season), el = s.el;
    var day = Math.max(0, Math.min(1, (el + 4) / 16));            // 0 = night, 1 = full day
    var dusk = el > -6 && el < 10 ? 1 - Math.abs(el - 2) / 8 : 0;   // orange near sunrise and sunset
    var skyTop = mix("#070d22", season === "winter" ? "#6ea7d9" : "#4b9be0", day), skyLow = mix("#16224a", season === "winter" ? "#cfe3f2" : "#bfe2fb", day);
    if (dusk > 0) skyLow = mix(skyLow, "#f29b5c", Math.min(0.8, dusk));
    var g = '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + skyTop + '"/><stop offset="1" stop-color="' + skyLow + '"/></linearGradient></defs>';
    g += '<rect width="900" height="' + GY + '" fill="' + (hc ? (el > 0 ? "#000" : "#000") : "url(#sky)") + '"/>';
    // Path of the sun today (dotted)
    var path = "";
    for (var h = 3; h <= 23; h += 0.25) { var p = sun(h, season); if (p.el > 0) path += (path ? "L" : "M") + skyX(p.az).toFixed(1) + " " + skyY(p.el).toFixed(1); }
    g += '<path d="' + path + '" fill="none" stroke="' + (hc ? "#fff" : "#ffffff") + '" stroke-opacity="' + (hc ? 0.8 : 0.45) + '" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round"/>';
    // Ground
    var ground = { spring: "#6fbf5a", summer: "#4fa34a", fall: "#8f9a45", winter: "#eef3f7" }[season];
    g += '<rect y="' + GY + '" width="900" height="' + (560 - GY) + '" fill="' + ground + '"/>';
    g += tree(140, season);
    if (el <= 0) {
      [[90, 60], [200, 120], [320, 50], [520, 90], [640, 40], [760, 130], [840, 70], [420, 160], [700, 200]].forEach(function (c) { g += '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="3" fill="#fff"/>'; });
      g += '<circle cx="' + (hour < 12 ? 720 : 180) + '" cy="90" r="30" fill="#f4f0d8"/><circle cx="' + (hour < 12 ? 734 : 194) + '" cy="80" r="28" fill="' + (hc ? "#000" : skyTop) + '"/>';
    } else {
      var sx = skyX(s.az), sy = skyY(el);
      for (var i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2; g += '<line x1="' + (sx + Math.cos(a) * 40).toFixed(1) + '" y1="' + (sy + Math.sin(a) * 40).toFixed(1) + '" x2="' + (sx + Math.cos(a) * 54).toFixed(1) + '" y2="' + (sy + Math.sin(a) * 54).toFixed(1) + '" stroke="#ffd23f" stroke-width="6" stroke-linecap="round"/>'; }
      g += '<circle cx="' + sx.toFixed(1) + '" cy="' + sy.toFixed(1) + '" r="32" fill="#ffd23f" stroke="#fff3b0" stroke-width="4"/>';
    }
    // Blocks to measure with
    var KX = 450;
    for (var b = -14; b < 14; b++) {
      g += '<rect x="' + (KX + b * BX + 1) + '" y="' + (GY + 8) + '" width="' + (BX - 2) + '" height="' + (BX - 2) + '" rx="3" fill="' + (season === "winter" ? "#d4dde6" : "#e9d7a8") + '" stroke="#8a6a46" stroke-width="1.5"/>';
    }
    if (el > 0) {
      var L = Math.min(shadowLen(el), 15.5) * BX, dir = Math.sin(s.az * RAD) > 0 ? 1 : -1; // we face south: sun in the east (left) puts the shadow to the west (right)
      if (Math.abs(Math.sin(s.az * RAD)) < 0.05) dir = 1;
      var end = KX + dir * L;
      g += '<path d="M' + (KX - 14) + ' ' + (GY + 3) + ' L' + (end - dir * 16).toFixed(1) + ' ' + (GY + 2) + ' L' + (end - dir * 16).toFixed(1) + ' ' + (GY + 28) + ' L' + (KX + 14) + ' ' + (GY + 34) + 'Z" fill="#000" opacity="' + (hc ? 0.9 : 0.55) + '"/>';
      g += '<ellipse cx="' + (end - dir * 10).toFixed(1) + '" cy="' + (GY + 18) + '" rx="12" ry="14" fill="#000" opacity="' + (hc ? 0.9 : 0.55) + '"/>';
      var n = Math.min(14, Math.round(shadowLen(el)));
      for (var k = 1; k <= n; k++) {
        var cx = KX + dir * (k - 0.5) * BX;
        g += '<text x="' + cx.toFixed(1) + '" y="' + (GY + 58) + '" text-anchor="middle" font-size="16" font-weight="700" fill="' + (season === "winter" ? "#14213d" : "#fff") + '">' + k + '</text>';
      }
    }
    g += kid(KX, season);
    if (el <= 0 && !hc) g += '<rect width="900" height="560" fill="#050a1e" opacity="0.45"/>';
    // Clock and thermometer
    g += '<rect x="16" y="16" width="210" height="64" rx="14" fill="#101a30" opacity="0.85"/><text x="121" y="60" text-anchor="middle" font-size="34" font-weight="800" fill="#fff" font-family="Nunito, sans-serif">' + clock(hour) + '</text>';
    var t = temp(hour, season), th = Math.max(4, Math.min(110, (t + 20) / 55 * 110));
    g += '<rect x="764" y="16" width="120" height="150" rx="14" fill="#101a30" opacity="0.85"/>';
    g += '<rect x="786" y="30" width="16" height="110" rx="8" fill="#fff"/><rect x="789" y="' + (140 - th) + '" width="10" height="' + th + '" rx="5" fill="#e8483d"/><circle cx="794" cy="146" r="13" fill="#e8483d"/>';
    g += '<text x="866" y="96" text-anchor="end" font-size="30" font-weight="800" fill="#fff" font-family="Nunito, sans-serif">' + t + '°</text><text x="866" y="122" text-anchor="end" font-size="18" fill="#c3cde3">C</text>';
    $("scene").innerHTML = g;
    var d = describe();
    $("scene-desc").textContent = d.head + " " + d.lines.join(" ");
  }
  function skyX(az) { return Math.max(40, Math.min(860, 450 + (az - 180) / 115 * 400)); }
  function skyY(el) { return GY - 30 - el / 72 * (GY - 80); }

  /* ---------- Notice, chart, table ---------- */
  function notice() {
    var d = describe();
    $("notice").innerHTML = "<p><strong>" + d.head + "</strong></p>" + d.lines.map(function (l) { return "<p>" + l + "</p>"; }).join("") +
      '<ul class="facts">' + d.facts.map(function (f) { return "<li>" + f + "</li>"; }).join("") + "</ul>";
  }
  function results() {
    var series = ORDER.map(function (se) {
      return { name: SEASONS[se].label, color: SEASONS[se].color, marker: SEASONS[se].marker,
        points: measures.filter(function (m) { return m.season === se; }).map(function (m) { return [m.hour, m.blocks]; }) };
    }).filter(function (x) { return x.points.length; });
    if (!series.length) series = [{ name: "Shadow", color: "var(--s1)", marker: "circle", points: [] }];
    Sim.chart($("chart"), {
      x: { label: "Time of day", min: 5, max: 21, ticks: [6, 9, 12, 15, 18, 21], format: function (h) { return clock(h).replace(" noon", ""); } },
      y: { label: "Shadow length (blocks)", min: 0, max: 10, unit: "blocks" },
      series: series,
      empty: "Press Measure my shadow to add a result.",
      summary: measures.length ? "Line graph of shadow length through the day for " + series.map(function (x) { return x.name; }).join(", ") + ". Shadows are longest in the morning and evening and shortest in the middle of the day. The table next to it has every measurement." : "Empty graph. No measurements yet."
    });
    var sorted = measures.slice().sort(function (a, b) { return ORDER.indexOf(a.season) - ORDER.indexOf(b.season) || a.hour - b.hour; });
    Sim.table($("table"), {
      caption: "My shadow measurements",
      columns: [{ label: "Season" }, { label: "Time" }, { label: "Shadow (blocks)", num: true }, { label: "Sun" }],
      rows: sorted.map(function (m) { return [SEASONS[m.season].label, clock(m.hour), m.blocks >= MAXB ? MAXB + " or more" : m.blocks, m.sun]; }),
      empty: "No measurements yet."
    });
  }
  function render() { draw(); notice(); results(); cTime.set(hour); cSeason.set(season); syncPlay(); }

  /* ---------- Controls ---------- */
  var cTime, cSeason, bPlay, bMeasure, bClear, bAll;
  function changed() {
    render();
    var d = describe();
    Sim.say(d.head + " " + d.lines.join(" "));
  }
  function measure(quiet) {
    var s = sun(hour, season);
    if (s.el <= 0) { if (!quiet) Sim.say("The sun is down, so there is no sun shadow to measure."); return false; }
    var L = shadowLen(s.el), blocks = Math.min(MAXB, Math.max(0.5, Math.round(L * 2) / 2));
    measures = measures.filter(function (m) { return !(m.season === season && m.hour === hour); });
    measures.push({ season: season, hour: hour, blocks: blocks, sun: s.el < 15 ? "low" : s.el < 40 ? "partway up" : "high" });
    if (!quiet) { results(); Sim.say("Measured. " + SEASONS[season].label + ", " + clock(hour) + ": " + (blocks >= MAXB ? "more than " + MAXB : blocks) + " blocks."); }
    return true;
  }
  function buildControls() {
    var dc = $("day-controls");
    cTime = Sim.stepper(dc, { label: "Time of day", min: 5, max: 21, value: hour, lessLabel: "Earlier", moreLabel: "Later",
      lessIcon: '<span aria-hidden="true">&#8678;</span>', moreIcon: '<span aria-hidden="true">&#8680;</span>',
      format: clock, onChange: function (v) { stop(); hour = v; changed(); } });
    cSeason = Sim.choices(dc, { label: "Season", value: season, options: ORDER.map(function (k) { return { value: k, label: SEASONS[k].label }; }),
      onChange: function (v) { season = v; changed(); } });
    var row = Sim.el("div", { class: "row", style: "margin-top:12px" });
    bPlay = Sim.el("button", { type: "button", class: "btn", "aria-pressed": "false" }, "<span>Play the day</span>");
    row.appendChild(bPlay); dc.appendChild(row);
    bPlay.addEventListener("click", function () { if (playing) { stop(); changed(); } else play(); });

    var mc = $("measure-controls");
    var r2 = Sim.el("div", { class: "row" });
    bMeasure = Sim.el("button", { type: "button", class: "btn btn-primary" }, "<span>Measure my shadow</span>");
    bAll = Sim.el("button", { type: "button", class: "btn" }, "<span>Measure every hour</span>");
    bClear = Sim.el("button", { type: "button", class: "btn" }, "<span>Clear results</span>");
    [bMeasure, bAll, bClear].forEach(function (b) { r2.appendChild(b); });
    mc.appendChild(r2);
    mc.appendChild(Sim.el("p", { class: "help", style: "margin:10px 0 0" }, "You are 4 blocks tall. Count the blocks your shadow covers."));
    bMeasure.addEventListener("click", function () { measure(); });
    bAll.addEventListener("click", function () {
      var keep = hour, n = 0;
      for (var h = 5; h <= 21; h++) { hour = h; if (measure(true)) n++; }
      hour = keep; results();
      Sim.say("Measured " + n + " times through a " + SEASONS[season].label.toLowerCase() + " day. Look at the graph: shadows are long in the morning and evening, and short in the middle of the day.");
    });
    bClear.addEventListener("click", function () { measures = []; results(); Sim.say("Results cleared."); });
    $("btn-describe").innerHTML = Sim.icon.describe + "<span>Describe the picture</span>";
    $("btn-describe").addEventListener("click", function () { var d = describe(); Sim.say(d.head + " " + d.lines.join(" ") + " " + d.facts.join(". ") + "."); });
    $("btn-csv").innerHTML = Sim.icon.csv + "<span>Save results (CSV)</span>";
    $("btn-csv").addEventListener("click", function () {
      var sorted = measures.slice().sort(function (a, b) { return ORDER.indexOf(a.season) - ORDER.indexOf(b.season) || a.hour - b.hour; });
      Sim.downloadCsv("shadow-results.csv", ["Season", "Time", "Shadow (blocks)", "Sun"], sorted.map(function (m) { return [SEASONS[m.season].label, clock(m.hour), m.blocks, m.sun]; }));
      Sim.say("Results saved as a file.");
    });
  }
  function syncPlay() { bPlay.setAttribute("aria-pressed", playing ? "true" : "false"); bPlay.querySelector("span").textContent = playing ? "Pause" : "Play the day"; }
  function play() {
    if (hour >= 21) hour = 5;
    playing = setInterval(function () {
      if (hour >= 21) { stop(); changed(); return; }
      hour++; render();
      var s = sun(hour, season);
      Sim.say(clock(hour) + ". " + (s.el > 0 ? "Shadow " + blocksWords(shadowLen(s.el)).split(":").pop().trim() + "." : "No sun."));
    }, Sim.settings().talk ? 2600 : 1400);
    render(); Sim.say("Playing the day from " + clock(hour) + ".");
  }
  function stop() { if (playing) { clearInterval(playing); playing = null; syncPlay(); } }

  Sim.init({
    onLook: function () { draw(); },
    teacherNotes:
      "<p>Ontario Science and Technology (2022), Grade 1: <strong>Daily and Seasonal Changes</strong> (the sun as a source of light and heat; changes through the day and the seasons; how they affect what we wear and do).</p>" +
      "<ul><li>Shadows are measured in blocks, a non-standard unit. The child is 4 blocks tall.</li>" +
      "<li>The sun follows its real path for southern Ontario (about Toronto). Clocks use daylight saving time from spring to fall, so the sun is highest near 1 pm then, and near 12 noon in winter.</li>" +
      "<li>Seasons are shown at their middle: the spring and fall equinoxes, and the longest and shortest days.</li>" +
      "<li>Try: Measure every hour in summer, then in winter, and compare the two lines.</li>" +
      "<li>Temperatures are typical, not exact.</li></ul>"
  });
  buildControls();
  render();
  Sim.say("Sun and Shadows. " + describe().head + " " + describe().lines.join(" "));
})();
