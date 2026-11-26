/* Plant Lab (Grade 3, Growth and Changes in Plants; Soils in the Environment).
   Three pots. Each pot gets its own light, water and soil. Grow day by day and compare: a fair test.
   The growth model is simple on purpose and is written as small tables below so a teacher can read it. */
(function () {
  "use strict";
  var $ = Sim.$;
  var MAX_DAY = 21;

  var LIGHT = { none: { label: "No light", f: 0 }, some: { label: "Some light", f: 0.6 }, lots: { label: "Lots of light", f: 1 } };
  var WATER = { none: "No water", little: "A little water", right: "Just right", much: "Too much water" };
  var SOIL = { garden: { label: "Garden soil", food: 1, color: "#5b3a24", dot: "#7a5136" },
               sand: { label: "Sand", food: 0.6, color: "#d9b97a", dot: "#b8975a" },
               clay: { label: "Clay", food: 0.75, color: "#a4573a", dot: "#874530" } };
  // How well the roots get water, for each amount of water and each soil.
  // Sand drains fast (a little water is not enough, too much drains away). Clay holds water (too much makes it soggy).
  var WATER_F = { none: { garden: 0, sand: 0, clay: 0 },
                  little: { garden: 0.6, sand: 0.4, clay: 0.7 },
                  right: { garden: 1, sand: 0.8, clay: 0.85 },
                  much: { garden: 0.6, sand: 0.85, clay: 0.35 } };
  var SOGGY = { garden: 4, sand: 1, clay: 8 }; // health lost each day with too much water
  var BEST_GROWTH = 1.5; // cm per day with lots of light, just right water, garden soil

  var POTS = [
    { id: "A", marker: "circle", color: "var(--s1)" },
    { id: "B", marker: "square", color: "var(--s2)" },
    { id: "C", marker: "triangle", color: "var(--s3)" }
  ];
  var START = { A: { light: "lots", water: "right", soil: "garden" },
                B: { light: "some", water: "right", soil: "garden" },
                C: { light: "none", water: "right", soil: "garden" } };

  var day, pots, rows, current = "A", playing = null, guess = "none";

  function reset() {
    stop();
    day = 0;
    pots = POTS.map(function (p) {
      var s = START[p.id];
      return { id: p.id, marker: p.marker, color: p.color, light: s.light, water: s.water, soil: s.soil,
               height: 0, health: 100, wet: 0, sprouted: false, reserve: 6, dry: 0, dead: false, hist: [[0, 0]] };
    });
    rows = [[0, "seed", "seed", "seed"]];
  }

  /* ---------- One day of growing ---------- */
  function grow(p) {
    if (p.dead) return;
    var W = WATER_F[p.water][p.soil], food = SOIL[p.soil].food, L = LIGHT[p.light].f;
    if (!p.sprouted) {
      if (p.water === "none") return;          // a dry seed just waits
      p.wet++;
      if (p.wet >= 3) { p.sprouted = true; p.height = 0.5; } // seeds sprout in the dark too: they use food stored in the seed
      return;
    }
    if (p.water === "none") { p.dry++; p.health -= 25; }
    else {
      p.dry = 0;
      if (L === 0) {
        if (p.reserve > 0) { p.height += 1.1; p.reserve--; } // stretches up, pale and thin, looking for light
        else p.health -= 12;                                  // the seed's food is used up
      } else {
        p.height += BEST_GROWTH * L * W * food * (p.health / 100);
        if (p.water === "much") p.health -= SOGGY[p.soil];
        else p.health = Math.min(100, p.health + 10);
      }
    }
    p.height = Math.min(32, p.height);
    if (p.health <= 0) { p.health = 0; p.dead = true; }
  }
  function cm(p) { return Math.round(p.height * 10) / 10; }

  /* ---------- Words ---------- */
  function looks(p) {
    if (p.dead) return "has died. It is brown and flat";
    if (!p.sprouted) return p.water === "none" ? "is still a dry seed. Seeds need water to start growing" : "is a seed soaking up water";
    var h = cm(p) + " cm tall";
    if (p.water === "none") return "is " + h + " and drooping. It needs water";
    if (p.light === "none") return p.reserve > 0 ? "is " + h + ", pale yellow and thin. It is stretching to find light" : "is " + h + ", pale and floppy. It needs light to make food";
    if (p.health < 60 && p.water === "much") return "is " + h + " with yellow leaves. The soil is too wet";
    if (p.health < 60) return "is " + h + " and getting better";
    var slow = WATER_F[p.water][p.soil] * SOIL[p.soil].food * LIGHT[p.light].f < 0.7;
    return "is " + h + ", green" + (slow ? ", but growing slowly" : " and strong");
  }
  function potSentence(p) { return "Pot " + p.id + " " + looks(p) + "."; }
  function setupWords(p) { return LIGHT[p.light].label.toLowerCase() + ", " + WATER[p.water].toLowerCase() + ", " + SOIL[p.soil].label.toLowerCase(); }
  function fairTest() {
    var diff = [];
    if (!same("light")) diff.push("the light");
    if (!same("water")) diff.push("the water");
    if (!same("soil")) diff.push("the soil");
    if (!diff.length) return "All three pots are the same.";
    if (diff.length === 1) return "Fair test: only " + diff[0] + " is different.";
    return "Not a fair test yet: " + diff.join(" and ") + " are different, so it is hard to tell what made the change.";
  }
  function same(k) { return pots[0][k] === pots[1][k] && pots[1][k] === pots[2][k]; }
  function tallest() {
    var alive = pots.filter(function (p) { return p.sprouted && !p.dead; });
    if (!alive.length) return null;
    alive.sort(function (a, b) { return b.height - a.height; });
    return alive[0].height - (alive[1] ? alive[1].height : 0) >= 0.5 ? alive[0] : null;
  }
  function dayWords() { return day === 0 ? "Day 0. The seeds are planted." : "Day " + day + "."; }

  /* ---------- Picture ---------- */
  function sunIcon(cx, cy, r, rays, color) {
    var s = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + color + '"/>';
    for (var i = 0; i < rays; i++) {
      var a = i / rays * Math.PI * 2, x1 = cx + Math.cos(a) * (r + 6), y1 = cy + Math.sin(a) * (r + 6), x2 = cx + Math.cos(a) * (r + 16), y2 = cy + Math.sin(a) * (r + 16);
      s += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="' + color + '" stroke-width="5" stroke-linecap="round"/>';
    }
    return s;
  }
  function marker(kind, x, y, color) {
    if (kind === "square") return '<rect x="' + (x - 9) + '" y="' + (y - 9) + '" width="18" height="18" rx="2" fill="' + color + '"/>';
    if (kind === "triangle") return '<path d="M' + x + ' ' + (y - 11) + 'L' + (x + 11) + ' ' + (y + 8) + 'L' + (x - 11) + ' ' + (y + 8) + 'Z" fill="' + color + '"/>';
    return '<circle cx="' + x + '" cy="' + y + '" r="10" fill="' + color + '"/>';
  }
  function drop(x, y, fill) { return '<path d="M' + x + ' ' + (y - 12) + 'C' + (x + 9) + ' ' + (y - 1) + ' ' + (x + 8) + ' ' + (y + 8) + ' ' + x + ' ' + (y + 8) + 'C' + (x - 8) + ' ' + (y + 8) + ' ' + (x - 9) + ' ' + (y - 1) + ' ' + x + ' ' + (y - 12) + 'Z" fill="' + fill + '"/>'; }
  var PX = 9, GROUND = 400; // 9 pixels per cm; the soil top is at y = 400

  function plant(p, cx) {
    var s = "";
    if (!p.sprouted) {
      s += '<ellipse cx="' + cx + '" cy="' + (GROUND - 4) + '" rx="9" ry="6" fill="#c9a36a" stroke="#6d5233" stroke-width="2"/>';
      if (p.wet > 0) s += '<path d="M' + cx + ' ' + (GROUND - 8) + 'q4 -8 0 -12" stroke="#e8e39a" stroke-width="3" fill="none" stroke-linecap="round"/>';
      return s;
    }
    var hc = Math.max(0.5, p.height), top = GROUND - hc * PX;
    var dark = p.light === "none";
    var col = p.dead ? "#7a5a3a" : dark ? "#e3dc8c" : p.health < 60 ? "#b8b648" : "#3fae4a";
    var leafCol = p.dead ? "#6b4b2e" : dark ? "#eee7a0" : p.health < 60 ? "#c9c24a" : "#4cc15a";
    var droop = p.dead ? 1 : (p.water === "none" && p.dry > 0) || p.health < 40 ? 0.7 : 0;
    var lean = p.dead ? 70 : droop ? 18 : 0;
    var sw = dark ? 3 : 5 + Math.min(3, hc / 10);
    var tipX = cx + Math.sin(lean * Math.PI / 180) * hc * PX * 0.5;
    if (p.dead) { top = GROUND - Math.min(hc, 3) * PX; tipX = cx + hc * PX * 0.6; }
    s += '<path d="M' + cx + ' ' + GROUND + 'Q' + cx + ' ' + ((GROUND + top) / 2) + ' ' + tipX.toFixed(1) + ' ' + top.toFixed(1) + '" stroke="' + col + '" stroke-width="' + sw.toFixed(1) + '" fill="none" stroke-linecap="round"/>';
    var n = Math.min(8, Math.floor(hc / 3.2) + 1);
    for (var i = 0; i < n; i++) {
      var t = (i + 1) / (n + 0.6), y = GROUND - (GROUND - top) * t, x = cx + (tipX - cx) * t * t;
      var side = i % 2 ? 1 : -1, size = (dark ? 9 : 15) + Math.min(10, hc / 2.5);
      var ang = side * (35 + droop * 70);
      s += '<ellipse cx="' + (x + side * size * 0.8).toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="' + size.toFixed(1) + '" ry="' + (size * 0.42).toFixed(1) + '" fill="' + leafCol + '" transform="rotate(' + ang.toFixed(0) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')"/>';
    }
    return s;
  }
  function draw() {
    var hc = document.documentElement.classList.contains("hc");
    var s = '<defs><linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22355c"/><stop offset="1" stop-color="#1a2847"/></linearGradient></defs>';
    s += '<rect width="900" height="560" fill="' + (hc ? "#000" : "url(#wall)") + '"/>';
    // Ruler in cm
    s += '<rect x="20" y="' + (GROUND - 30 * PX - 14) + '" width="52" height="' + (30 * PX + 14) + '" rx="6" fill="#f2d98a"/>';
    for (var c = 0; c <= 30; c++) {
      var y = GROUND - c * PX, big = c % 5 === 0;
      s += '<line x1="20" x2="' + (big ? 44 : 32) + '" y1="' + y + '" y2="' + y + '" stroke="#3b2f12" stroke-width="' + (big ? 2.5 : 1.2) + '"/>';
      if (big) s += '<text x="66" y="' + (y + 6) + '" text-anchor="end" font-size="17" font-weight="700" fill="#3b2f12">' + c + '</text>';
    }
    s += '<text x="46" y="' + (GROUND + 26) + '" text-anchor="middle" font-size="17" font-weight="700" fill="#f6f2e7">cm</text>';
    // Shelf
    s += '<rect x="90" y="470" width="800" height="16" rx="4" fill="#8a6a46"/>';
    pots.forEach(function (p, i) {
      var cx = 230 + i * 260, lit = LIGHT[p.light];
      // Light from above, or a dark box over the pot
      if (p.light === "none") {
        s += '<rect x="' + (cx - 118) + '" y="20" width="236" height="452" rx="12" fill="#05070d" opacity="' + (hc ? 1 : 0.82) + '" stroke="#55627e" stroke-width="3" stroke-dasharray="10 8"/>';
        s += '<text x="' + cx + '" y="58" text-anchor="middle" font-size="22" font-weight="700" fill="#c3cde3">Dark box</text>';
      } else {
        var big = p.light === "lots";
        s += '<path d="M' + (cx - 30) + ' 70 L' + (cx - 110) + ' 400 L' + (cx + 110) + ' 400 L' + (cx + 30) + ' 70Z" fill="#ffe27a" opacity="' + (big ? 0.2 : 0.09) + '"/>';
        s += sunIcon(cx, 58, big ? 24 : 15, big ? 10 : 6, "#ffd23f");
      }
      s += plant(p, cx);
      // Pot and soil
      s += '<path d="M' + (cx - 78) + ' 396 L' + (cx + 78) + ' 396 L' + (cx + 62) + ' 470 L' + (cx - 62) + ' 470Z" fill="#c8693a" stroke="#7d3c1c" stroke-width="3"/>';
      s += '<rect x="' + (cx - 84) + '" y="388" width="168" height="18" rx="5" fill="#d9794a" stroke="#7d3c1c" stroke-width="3"/>';
      s += '<ellipse cx="' + cx + '" cy="' + (GROUND + 1) + '" rx="74" ry="7" fill="' + SOIL[p.soil].color + '"/>';
      if (p.water === "much") s += '<ellipse cx="' + cx + '" cy="' + (GROUND) + '" rx="56" ry="5" fill="#5fb0ff" opacity="0.85"/>';
      // Water drops on the pot: none, 1, 2 or 3
      var nd = { none: 0, little: 1, right: 2, much: 3 }[p.water];
      if (!nd) s += '<g transform="translate(' + cx + ' 440)">' + drop(0, 0, "none").replace('fill="none"', 'fill="none" stroke="#fff" stroke-width="3"') + '<line x1="-12" y1="10" x2="12" y2="-12" stroke="#fff" stroke-width="3.5"/></g>';
      for (var d = 0; d < nd; d++) s += drop(cx + (d - (nd - 1) / 2) * 26, 440, "#5fb0ff");
      // Label with the same shape as the graph
      s += marker(p.marker, cx - 46, 516, p.color);
      s += '<text x="' + (cx - 28) + '" y="525" font-size="26" font-weight="800" fill="#f6f2e7" font-family="Nunito, sans-serif">Pot ' + p.id + '</text>';
      s += '<text x="' + cx + '" y="552" text-anchor="middle" font-size="19" fill="#c3cde3">' + (p.sprouted ? cm(p) + " cm" : "seed") + '</text>';
      if (p.id === current) s += '<rect x="' + (cx - 124) + '" y="14" width="248" height="546" rx="16" fill="none" stroke="#ffd23f" stroke-width="5"/>';
    });
    s += '<text x="46" y="44" text-anchor="middle" font-size="22" font-weight="700" fill="#c3cde3">Day</text>';
    s += '<text x="46" y="86" text-anchor="middle" font-size="40" font-weight="800" fill="#f6f2e7" font-family="Nunito, sans-serif">' + day + '</text>';
    $("scene").innerHTML = s;
    $("scene-desc").textContent = "Day " + day + ". " + pots.map(function (p) { return "Pot " + p.id + ": " + setupWords(p) + ". The plant " + looks(p).replace(/^is /, "is ") + "."; }).join(" ");
  }

  /* ---------- Panels: notice, chart, table ---------- */
  function notice() {
    var h = "<p><strong>" + dayWords() + "</strong></p>";
    pots.forEach(function (p) { h += "<p>" + potSentence(p) + "</p>"; });
    h += '<ul class="facts"><li>' + fairTest() + "</li>";
    if (guess !== "none") {
      var t = tallest();
      h += "<li>My guess: Pot " + guess + " will grow tallest." + (day >= 10 && t ? (t.id === guess ? " Right so far!" : " So far Pot " + t.id + " is tallest.") : "") + "</li>";
    }
    h += "</ul>";
    $("notice").innerHTML = h;
  }
  function results() {
    Sim.chart($("chart"), {
      x: { label: "Day", min: 0, max: MAX_DAY, ticks: [0, 3, 6, 9, 12, 15, 18, 21] },
      y: { label: "Height (cm)", min: 0, max: 10, unit: "cm" },
      series: pots.map(function (p) { return { name: "Pot " + p.id, color: p.color, marker: p.marker, points: p.hist }; }),
      summary: "Line graph of plant height by day. " + pots.map(function (p) { return "Pot " + p.id + " " + cm(p) + " cm"; }).join(", ") + " on day " + day + ". The table next to it has every day."
    });
    Sim.table($("table"), {
      caption: "Height of each plant (cm)",
      columns: [{ label: "Day" }, { label: "Pot A", num: true }, { label: "Pot B", num: true }, { label: "Pot C", num: true }],
      rows: rows, highlightLast: true
    });
  }
  function render() { draw(); notice(); results(); syncPot(); timeButtons(); }

  /* ---------- Controls ---------- */
  var cPot, cLight, cWater, cSoil, cGuess, bDay, bWeek, bPlay, bReset;
  function potOf(id) { return pots.filter(function (p) { return p.id === id; })[0]; }
  function syncPot() {
    var p = potOf(current);
    cPot.set(current); cLight.set(p.light); cWater.set(p.water); cSoil.set(p.soil);
  }
  function change(key, v, words) {
    var p = potOf(current); p[key] = v;
    if (key === "water" && v !== "none" && p.dead) { /* too late: a dead plant stays dead */ }
    render();
    Sim.say("Pot " + p.id + ": " + words + ". " + fairTest());
  }
  function buildControls() {
    var pc = $("pot-controls");
    cPot = Sim.choices(pc, { label: "Pot", value: current, options: POTS.map(function (p) { return { value: p.id, label: "Pot " + p.id }; }),
      onChange: function (v) { current = v; render(); var p = potOf(v); Sim.say("Pot " + v + ": " + setupWords(p) + "."); } });
    cLight = Sim.choices(pc, { label: "Light", value: "lots", options: Object.keys(LIGHT).map(function (k) { return { value: k, label: LIGHT[k].label }; }),
      onChange: function (v) { change("light", v, LIGHT[v].label.toLowerCase()); } });
    cWater = Sim.choices(pc, { label: "Water each day", value: "right", options: Object.keys(WATER).map(function (k) { return { value: k, label: WATER[k] }; }),
      onChange: function (v) { change("water", v, WATER[v].toLowerCase()); } });
    cSoil = Sim.choices(pc, { label: "Soil", value: "garden", options: Object.keys(SOIL).map(function (k) { return { value: k, label: SOIL[k].label }; }),
      onChange: function (v) { change("soil", v, SOIL[v].label.toLowerCase()); } });

    var tc = $("time-controls");
    cGuess = Sim.choices(tc, { label: "My guess: which pot will grow tallest?", value: "none",
      options: [{ value: "A", label: "A" }, { value: "B", label: "B" }, { value: "C", label: "C" }, { value: "none", label: "Not sure" }],
      onChange: function (v) { guess = v; notice(); Sim.say(v === "none" ? "Not sure yet. That's OK." : "Your guess: Pot " + v + " will grow tallest."); } });
    var row = Sim.el("div", { class: "row", style: "margin-top:12px" });
    bDay = Sim.el("button", { type: "button", class: "btn btn-primary" }, "<span>Grow 1 day</span>");
    bWeek = Sim.el("button", { type: "button", class: "btn" }, "<span>Grow 1 week</span>");
    bPlay = Sim.el("button", { type: "button", class: "btn", "aria-pressed": "false" }, "<span>Play</span>");
    bReset = Sim.el("button", { type: "button", class: "btn" }, "<span>Plant new seeds</span>");
    [bDay, bWeek, bPlay, bReset].forEach(function (b) { row.appendChild(b); });
    tc.appendChild(row);
    bDay.addEventListener("click", function () { stop(); step(1); });
    bWeek.addEventListener("click", function () { stop(); step(7); });
    bPlay.addEventListener("click", function () { if (playing) { stop(); tell(); } else play(); });
    bReset.addEventListener("click", function () { reset(); render(); Sim.say("New seeds are planted. Day 0. " + fairTest()); });
    $("btn-describe").innerHTML = Sim.icon.describe + "<span>Describe the plants</span>";
    $("btn-describe").addEventListener("click", tell);
    $("btn-csv").innerHTML = Sim.icon.csv + "<span>Save results (CSV)</span>";
    $("btn-csv").addEventListener("click", function () {
      Sim.downloadCsv("plant-lab-results.csv", ["Day", "Pot A (cm)", "Pot B (cm)", "Pot C (cm)"], rows);
      Sim.say("Results saved as a file.");
    });
  }
  function timeButtons() {
    var done = day >= MAX_DAY;
    bDay.disabled = done; bWeek.disabled = done; bPlay.disabled = done && !playing;
    bPlay.setAttribute("aria-pressed", playing ? "true" : "false");
    bPlay.querySelector("span").textContent = playing ? "Pause" : "Play";
  }
  function step(n) {
    for (var i = 0; i < n && day < MAX_DAY; i++) {
      day++;
      pots.forEach(grow);
      pots.forEach(function (p) { p.hist.push([day, cm(p)]); });
      rows.push([day].concat(pots.map(function (p) { return p.sprouted ? cm(p) : "seed"; })));
    }
    render();
    if (!playing) tell();
    else Sim.say("Day " + day + ".");
    if (day >= MAX_DAY) { stop(); tell(true); }
  }
  function tell(end) {
    var t = tallest();
    var text = dayWords() + " " + pots.map(potSentence).join(" ");
    if (end === true) text = "Three weeks are done. " + text + (t ? " Pot " + t.id + " grew tallest." : "") + (guess !== "none" && t ? (t.id === guess ? " Your guess was right!" : " Your guess was Pot " + guess + ".") : "");
    Sim.say(text);
  }
  function play() {
    if (day >= MAX_DAY) return;
    playing = setInterval(function () { step(1); }, Sim.settings().talk ? 2200 : 1300);
    timeButtons(); Sim.say("Playing.");
  }
  function stop() { if (playing) { clearInterval(playing); playing = null; if (bPlay) timeButtons(); } }

  Sim.init({
    onLook: function () { draw(); },
    teacherNotes:
      "<p>Ontario Science and Technology (2022), Grade 3: <strong>Growth and Changes in Plants</strong> (what plants need: light, water, soil) and <strong>Soils in the Environment</strong>.</p>" +
      "<ul><li>Start: Pot A has lots of light, Pot B some, Pot C none. Everything else is the same, so it is a fair test about light.</li>" +
      "<li>Try a test about water or soil: make the light the same in all three pots, then change one other thing.</li>" +
      "<li>Seeds sprout in the dark, using food stored in the seed, then grow pale and thin and stop. Dry seeds never sprout.</li>" +
      "<li>Sand drains fast. Clay holds water, so too much water in clay makes leaves go yellow.</li>" +
      "<li>The model is simplified: real plants grow at different speeds.</li></ul>"
  });
  reset();
  buildControls();
  render();
  Sim.say("Plant Lab. Three seeds are planted. " + fairTest());
})();
