/*
 * Sound It Out - game logic.
 * You should not need to edit this file. Change words, pictures and recordings in js/config.js.
 *
 * How a turn works:
 *   1. Empty boxes show (with a light gray letter in each, if the teacher wants).
 *   2. The student taps a letter tile and hears its sound. Any tile, any time: exploring is fine.
 *   3. They put it in the next box: tap the box, drag the tile there, or (teacher setting)
 *      the right tile goes in by itself. Boxes fill left to right.
 *   4. When every box is full, the game plays each sound in order, then says the whole word.
 */
(function () {
  "use strict";

  /* ---------- Config ---------- */
  var userCfg = window.GAME_CONFIG || {};
  var cfg = {
    pictures: userCfg.pictures || {},
    wordLists: userCfg.wordLists || [],
    startSetup: userCfg.startSetup || {},
    teams: userCfg.teams || {},
    phrases: Object.assign({ build: "Build the word", buildSecret: "Build a word", tryAgain: "Try again.", great: "You did it!" }, userCfg.phrases || {}),
    recordings: Object.assign({ sounds: "sounds/{key}.wav", words: {}, build: "", tryAgain: "", great: "" }, userCfg.recordings || {}),
    voiceRate: typeof userCfg.voiceRate === "number" ? userCfg.voiceRate : 0.8,
    defaults: Object.assign({ voice: true, voiceName: "", rate: userCfg.voiceRate || 0.8, sounds: true, volume: 90, animation: true, highContrast: false }, userCfg.defaults || {})
  };
  var root = document.documentElement;

  /* ---------- Settings (remembered on this device) ---------- */
  var STORE_KEY = "sound-it-out.settings";
  var SETUP_KEY = "sound-it-out.setup";
  var prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var settings = Object.assign({}, cfg.defaults);
  if (prefersReduced) settings.animation = false;
  try {
    var saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (saved && typeof saved === "object") Object.assign(settings, saved);
  } catch (e) { /* storage unavailable: use defaults */ }
  function saveSettings() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
  }

  /* ---------- Setup: the word list and how the game plays ---------- */
  // A word is letters, with optional dashes to say where the tiles split (b-oo-k).
  function cleanWord(w) {
    return String(w || "").toLowerCase().replace(/[^a-z-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 16);
  }
  function cleanWords(list) {
    if (typeof list === "string") list = list.split(/\r?\n|\||,/);
    if (!Array.isArray(list)) return [];
    return list.map(cleanWord).filter(function (w) { return w.replace(/-/g, "").length > 0; }).slice(0, 60);
  }
  function pick(v, allowed, dflt) { return allowed.indexOf(v) >= 0 ? v : dflt; }
  function flag(v, dflt) {
    if (v === true || v === "1" || v === 1) return true;
    if (v === false || v === "0" || v === 0) return false;
    return dflt;
  }
  function cleanSetup(s) {
    s = s || {};
    var turns = parseInt(s.turns, 10);
    var extra = parseInt(s.extra, 10);
    var out = {
      words: cleanWords(s.words),
      turns: turns >= 0 && turns <= 60 ? turns : 5,
      order: pick(s.order, ["mix", "in"], "in"),
      tiles: pick(s.tiles, ["mix", "in"], "mix"),
      extra: extra >= 0 && extra <= 2 ? extra : 0,
      place: pick(s.place, ["box", "auto"], "box"),
      ghost: flag(s.ghost, true),
      sayFirst: flag(s.sayFirst, false),
      picture: pick(s.picture, ["end", "start", "never"], "end"),
      blend: pick(s.blend, ["word", "fast"], "word"),
      letterCase: pick(s.letterCase, ["lower", "upper"], "lower")
    };
    if (!out.words.length) out.words = ["cat", "dog", "mat"];
    return out;
  }

  // A link holds a setup, for example ?words=cat|dog|b-oo-k&n=5&place=box
  function setupFromUrl() {
    try {
      var q = new URLSearchParams(location.search);
      if (!q.get("words")) return null;
      return cleanSetup({
        words: q.get("words"), turns: q.has("n") ? q.get("n") : 5, order: q.get("order"), tiles: q.get("tiles"),
        extra: q.get("extra"), place: q.get("place"), ghost: q.get("ghost"), sayFirst: q.get("say"),
        picture: q.get("pic"), blend: q.get("blend"), letterCase: q.get("case")
      });
    } catch (e) { return null; }
  }
  function linkFor(s, lock) {
    var base = location.href.split("#")[0].split("?")[0];
    return base + "?words=" + s.words.map(encodeURIComponent).join("|") +
      "&n=" + s.turns + "&order=" + s.order + "&tiles=" + s.tiles + "&extra=" + s.extra + "&place=" + s.place +
      "&ghost=" + (s.ghost ? 1 : 0) + "&say=" + (s.sayFirst ? 1 : 0) + "&pic=" + s.picture + "&blend=" + s.blend +
      "&case=" + s.letterCase + (lock ? "&lock=1" : "");
  }
  var locked = false;
  try { locked = new URLSearchParams(location.search).get("lock") === "1"; } catch (e) { /* ignore */ }

  var setup = setupFromUrl();
  if (setup) {
    try { localStorage.setItem(SETUP_KEY, JSON.stringify(setup)); } catch (e) { /* ignore */ }
  } else {
    try {
      var savedSetup = JSON.parse(localStorage.getItem(SETUP_KEY) || "null");
      if (savedSetup) setup = cleanSetup(savedSetup);
    } catch (e) { /* ignore */ }
    if (!setup) setup = cleanSetup(cfg.startSetup);
  }
  function saveSetup() {
    try { localStorage.setItem(SETUP_KEY, JSON.stringify(setup)); } catch (e) { /* ignore */ }
  }

  /* ---------- Words into tiles ---------- */
  // "book" -> ["b", "oo", "k"] (oo is a team); "b-oo-k" -> the same; "c-a-t" -> ["c", "a", "t"].
  function unitsOf(w) {
    if (w.indexOf("-") >= 0) return w.split("-").filter(Boolean);
    var out = [], i = 0;
    while (i < w.length) {
      var two = w.substr(i, 2);
      if (two.length === 2 && cfg.teams[two]) { out.push(two); i += 2; }
      else { out.push(w.charAt(i)); i += 1; }
    }
    return out;
  }
  function plain(w) { return w.replace(/-/g, ""); }
  function shown(u) { return setup.letterCase === "upper" ? u.toUpperCase() : u; }

  /* ---------- Elements ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var stage = $("stage");
  var boxesEl = $("boxes");
  var trayEl = $("tray");
  var live = $("live");
  var hintLine = $("hint-line");
  var picEl = $("word-pic");

  /* ---------- Announcements for screen readers ---------- */
  var announceTimer = null;
  function announce(text) {
    live.textContent = "";
    clearTimeout(announceTimer);
    announceTimer = setTimeout(function () { live.textContent = text; }, 60);
  }

  /* ---------- Sound: the letter sounds (Web Audio, so short sounds play right away) ---------- */
  var actx = null;
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC) actx = new AC();
  } catch (e) { actx = null; }
  var buffers = {}, loading = {};
  function soundUrl(key) { return cfg.recordings.sounds.replace("{key}", key); }
  function loadSound(url) {
    if (buffers[url] || loading[url] || !actx || !window.fetch) return;
    loading[url] = true;
    fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (data) {
      // Older Safari only has the callback form.
      return new Promise(function (ok, bad) {
        var p = actx.decodeAudioData(data, ok, bad);
        if (p && p.then) p.then(ok, bad);
      });
    }).then(function (buf) { buffers[url] = buf; }).catch(function () { loading[url] = false; });
  }
  // iPhones and iPads only allow sound that starts during a real tap. On the first
  // tap (or key), wake up the sound engine, the clip player and the voice.
  var synth = window.speechSynthesis || null;
  var unlocked = false;
  var player = new Audio();
  player.preload = "auto";
  var SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
  function unlockAudio() {
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* ignore */ }
    try { if (actx && actx.state !== "running" && actx.resume) actx.resume(); } catch (e) { /* ignore */ }
    if (unlocked) return;
    unlocked = true;
    try {
      // A silent sound through Web Audio, so later sounds are allowed.
      if (actx) { var b = actx.createBuffer(1, 1, 22050), s = actx.createBufferSource(); s.buffer = b; s.connect(actx.destination); s.start(0); }
    } catch (e) { /* ignore */ }
    try { player.src = SILENT; var pr = player.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) { /* ignore */ }
    if (synth) { try { var u = new SpeechSynthesisUtterance(" "); u.volume = 0; synth.speak(u); } catch (e) { /* ignore */ } }
  }
  ["touchend", "pointerup", "click", "keydown"].forEach(function (type) {
    document.addEventListener(type, unlockAudio, true);
  });
  function vol() { return Math.max(0, Math.min(100, settings.volume)) / 100; }

  var current = null; // what is playing now, so it can be stopped
  function playSound(url, done) {
    var buf = buffers[url];
    if (buf && actx) {
      try {
        if (actx.state === "suspended" && actx.resume) actx.resume();
        var src = actx.createBufferSource(), g = actx.createGain();
        g.gain.value = vol();
        src.buffer = buf;
        src.connect(g); g.connect(actx.destination);
        var ended = false;
        var end = function () { if (ended) return; ended = true; clearTimeout(guard); current = null; done(); };
        var guard = setTimeout(end, buf.duration * 1000 + 400);
        src.onended = end;
        current = { stop: function () { try { src.stop(); } catch (e) { /* ignore */ } end(); } };
        src.start(0);
        return;
      } catch (e) { /* fall back to the clip player */ }
    }
    playClip({ clip: url }, done);
  }

  /* ---------- Sound: recorded clips (teacher's voice) and the computer voice ---------- */
  var badClips = {};
  function playClip(x, done) {
    var ended = false, guard = null;
    function end() {
      if (ended) return;
      ended = true;
      clearTimeout(guard);
      player.onended = player.onerror = null;
      current = null;
      done();
    }
    function fallback() {
      if (ended) return;
      ended = true;
      clearTimeout(guard);
      player.onended = player.onerror = null;
      badClips[x.clip] = true;
      current = null;
      if (x.text && speechOk()) sayNow(x.text, done); else done();
    }
    if (badClips[x.clip]) { if (x.text && speechOk()) sayNow(x.text, done); else done(); return; }
    try {
      player.onended = end;
      player.onerror = fallback;
      player.src = x.clip;
      player.volume = vol();
      current = { stop: function () { try { player.pause(); } catch (e) { /* ignore */ } end(); } };
      var pr = player.play();
      if (pr && pr.catch) pr.catch(function () { fallback(); });
      guard = setTimeout(end, 5000);
    } catch (e) { fallback(); }
  }

  var NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|pipe organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley)\b/i;
  var GOOD_NAMES = /\b(ava|samantha|allison|susan|zoe|evan|nathan|noelle|joelle|nicky|tom|serena|karen|daniel|kate|moira|tessa|aria|jenny|guy|michelle)\b/i;
  var chosenVoice = null, voiceSearched = false, badVoices = {};
  function scoreVoice(v) {
    var name = v.name || "", lang = (v.lang || "").replace("_", "-").toLowerCase();
    if (lang.indexOf("en") !== 0) return -1;
    if (NOVELTY.test(name) || badVoices[v.voiceURI || name]) return -1;
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
  function englishVoices() {
    if (!synth || !synth.getVoices) return [];
    return (synth.getVoices() || []).filter(function (v) { return scoreVoice(v) >= 0; })
      .sort(function (x, y) { return scoreVoice(y) - scoreVoice(x); });
  }
  function pickVoice() {
    if (!synth || !synth.getVoices) return null;
    var voices = synth.getVoices() || [];
    if (!voices.length) return null;
    voiceSearched = true;
    var best = null, bestScore = -1;
    voices.forEach(function (v) {
      if (settings.voiceName && v.name === settings.voiceName && !badVoices[v.voiceURI || v.name]) { best = v; bestScore = 1e9; return; }
      var sc = scoreVoice(v); if (sc > bestScore) { bestScore = sc; best = v; }
    });
    chosenVoice = best;
    fillVoiceList();
    return best;
  }
  function fillVoiceList() {
    var sel = $("set-voice-name");
    if (!sel) return;
    var keep = settings.voiceName || "";
    sel.innerHTML = '<option value="">Automatic (the best voice on this device)</option>';
    englishVoices().forEach(function (v) {
      var o = document.createElement("option");
      o.value = v.name;
      o.textContent = v.name + (v.localService === false ? " (needs internet)" : "");
      sel.appendChild(o);
    });
    sel.value = keep;
    if (sel.value !== keep) sel.value = "";
  }
  if (synth) {
    pickVoice();
    if (synth.addEventListener) synth.addEventListener("voiceschanged", pickVoice);
    else synth.onvoiceschanged = pickVoice;
  }
  function speechOk() { return synth && window.SpeechSynthesisUtterance; }
  var keepAlive = [];
  function sayNow(text, done) {
    if (!speechOk() || !settings.voice || !(settings.volume > 0)) { done(); return; }
    if (!voiceSearched) pickVoice();
    var u = new SpeechSynthesisUtterance(text);
    var v = chosenVoice;
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = root.lang || "en"; }
    u.rate = Math.max(0.5, Math.min(1.3, Number(settings.rate) || cfg.voiceRate));
    u.volume = vol();
    var ended = false, guard = null;
    function end() { if (ended) return; ended = true; clearTimeout(guard); current = null; done(); }
    u.onend = end;
    u.onerror = function (ev) {
      if (v && !v.localService && ev && ev.error !== "interrupted" && ev.error !== "canceled") {
        badVoices[v.voiceURI || v.name] = true;
        pickVoice();
      }
      end();
    };
    // Some browsers forget to say when they finish; move on after a generous guess.
    guard = setTimeout(end, 1500 + text.length * 120 / u.rate);
    keepAlive.push(u);
    if (keepAlive.length > 6) keepAlive.shift();
    current = { stop: function () { try { synth.cancel(); } catch (e) { /* ignore */ } end(); } };
    try { synth.speak(u); } catch (e) { end(); }
  }

  /*
   * play(parts, done): plays a list of parts one after another, never cutting one off.
   * A part is: text for the computer voice, { snd: url } a letter sound,
   * { clip: url, text } a recording (text is said if it won't play), { gap: ms } a pause,
   * or { fn: function } to run something at that moment (like lighting up a box).
   * A new play() waits for the one before it, unless hush() is called first.
   */
  var playing = false, waiting = null, playGen = 0;
  function play(parts, done) {
    if (!Array.isArray(parts)) parts = [parts];
    parts = parts.filter(Boolean);
    if (playing) {
      var before = waiting && waiting.done;
      waiting = { parts: parts, done: before && done ? function () { before(); done(); } : (done || before) };
      return;
    }
    playing = true;
    var i = 0, gen = playGen;
    (function next() {
      if (gen !== playGen) i = parts.length;
      if (i >= parts.length) {
        playing = false;
        if (gen === playGen && done) done();
        if (waiting) { var w = waiting; waiting = null; setTimeout(function () { play(w.parts, w.done); }, 120); }
        return;
      }
      var x = parts[i++];
      if (typeof x === "string") sayNow(x, next);
      else if (x.snd) playSound(x.snd, next);
      else if (x.clip) playClip(x, next);
      else if (x.gap) setTimeout(next, x.gap);
      else if (x.fn) { try { x.fn(); } catch (e) { /* ignore */ } next(); }
      else next();
    })();
  }
  function hush() {
    waiting = null;
    playGen++;
    if (current) current.stop();
    if (synth && (synth.speaking || synth.pending)) { try { synth.cancel(); } catch (e) { /* ignore */ } }
  }

  // The sound a tile makes.
  function unitPart(u) {
    var team = cfg.teams[u];
    if (team) {
      if (team.rec) return { clip: team.rec, text: team.say || u };
      if (team.clip) return { snd: soundUrl(team.clip) };
      return team.say || u;
    }
    if (u.length === 1) return { snd: soundUrl(u) };
    return u; // a tile the teacher made with dashes: the computer voice says it
  }
  function phrase(key, textKey) {
    var text = cfg.phrases[textKey || key] || "";
    var clip = cfg.recordings[key];
    return clip && settings.voice ? { clip: clip, text: text } : text;
  }
  function wordPart(w) {
    var clip = cfg.recordings.words && cfg.recordings.words[w];
    return clip ? { clip: clip, text: w + "." } : w + ".";
  }

  /* ---------- Sound: game sounds made in the browser (no files) ---------- */
  function tone(freq, at, dur, type, gain, toFreq) {
    if (!settings.sounds || !(settings.volume > 0) || !actx) return;
    try {
      if (actx.state === "suspended" && actx.resume) actx.resume();
      var t0 = actx.currentTime + at;
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || "triangle";
      o.frequency.setValueAtTime(freq, t0);
      if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, (gain || 0.2) * vol()), t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) { /* ignore */ }
  }
  function sfxPlace() { tone(660, 0, 0.12, "triangle", 0.18, 880); }
  function sfxSoft() { tone(330, 0, 0.2, "sine", 0.14, 294); } // gentle, never a buzzer
  function sfxWord() { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.1, 0.4, "triangle", 0.2); }); }
  function sfxAll() { [523, 659, 784, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.13, 0.45, "triangle", 0.22); }); }

  /* ---------- Game state ---------- */
  var queue = [], lastWord = "";
  var word = "", units = [];   // the word now (as written in the list) and its tiles
  var filled = 0;              // boxes filled so far (left to right)
  var tiles = [];              // { u: "c", el: button, used: false }
  var selected = null;         // the tile picked, waiting to go in a box
  var wrongs = 0;
  var busy = false;            // the word is being blended
  var built = false;           // all boxes are full
  var done = 0, total = 0, doneWords = [];
  var finished = false;

  function nextWords() {
    var src = setup.words.slice();
    if (setup.order === "mix") {
      shuffle(src);
      if (src.length > 1 && src[0] === lastWord) src.push(src.shift());
    }
    return src;
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function takeWord() {
    if (!queue.length) queue = nextWords();
    lastWord = queue.shift();
    return lastWord;
  }

  function newGame() {
    hush();
    finished = false;
    done = 0; doneWords = [];
    queue = [];
    lastWord = "";
    total = setup.turns ? setup.turns : setup.words.length;
    $("btn-setup").hidden = locked;
    $("btn-hear-word").hidden = !setup.sayFirst;
    nextWord(true);
  }

  function nextWord(first) {
    word = takeWord();
    units = unitsOf(word);
    filled = 0;
    selected = null;
    wrongs = 0;
    busy = false;
    built = false;
    // The tiles: the word's own, plus any extra letters, mixed up or in order.
    var list = units.slice();
    if (setup.extra) {
      var have = plain(word);
      var pool = shuffle("abcdefghijklmnoprstuvwz".split("").filter(function (c) { return have.indexOf(c) < 0; }));
      list = list.concat(pool.slice(0, setup.extra));
    }
    if (setup.tiles === "mix" && list.length > 1) {
      var orig = list.join("|");
      for (var tries = 0; tries < 6 && list.join("|") === orig; tries++) shuffle(list);
    }
    tiles = list.map(function (u) { return { u: u, used: false, el: null }; });
    $("after").hidden = true;
    trayEl.hidden = false;
    trayEl.classList.remove("is-waiting");
    $("pic-slot").hidden = setup.picture === "never";
    boxesEl.classList.remove("is-built");
    picEl.classList.remove("is-pop");
    showPicture(setup.picture === "start");
    renderBoxes();
    renderTray();
    renderProgress();
    fitStage();
    preloadWord();
    var intro = introParts();
    if (!first) { play(intro); }
    announce(srIntro());
    setHint();
    if (!first) focusFirstTile();
  }
  function preloadWord() {
    tiles.forEach(function (t) { var p = unitPart(t.u); if (p && p.snd) loadSound(p.snd); });
  }
  function introParts() {
    if (setup.sayFirst) return [phrase("build"), wordPart(plain(word))];
    return [phrase("build", "buildSecret")];
  }
  function srIntro() {
    var t = (setup.sayFirst ? "Build the word " + plain(word) + ". " : "Build a word. ") + units.length + " boxes. ";
    if (setup.ghost) t += "The boxes show " + units.map(shown).join(", ") + ". ";
    return t + "Pick a letter to hear its sound.";
  }
  function showPicture(on) {
    var src = cfg.pictures[plain(word)];
    picEl.hidden = !(on && src);
    if (on && src) { picEl.src = src; picEl.alt = plain(word); }
  }
  function setHint() {
    var t;
    if (built) t = "";
    else if (setup.place === "auto") t = "Tap a letter to hear it. The right one goes in the box.";
    else if (selected) t = "Now tap the glowing box.";
    else t = filled === 0 ? "Tap a letter to hear its sound." : "Tap the next letter.";
    hintLine.textContent = t;
  }

  /* ---------- Drawing the boxes and tiles ---------- */
  // Only the box to fill next (with a tile picked) is a button, so switches and
  // the Tab key never stop on boxes that can't be used yet.
  function renderBoxes() {
    boxesEl.innerHTML = "";
    units.forEach(function (u, i) {
      var isFull = i < filled;
      var ready = !built && !isFull && i === filled && setup.place === "box" && selected;
      var el = document.createElement(ready ? "button" : "div");
      if (ready) el.type = "button";
      el.className = "box" + (u.length > 1 ? " is-wide" : "") + (isFull ? " is-full" : "") +
        (!built && i === filled ? " is-next" : "") + (ready ? " is-ready" : "");
      el.dataset.i = i;
      el.textContent = isFull || setup.ghost ? shown(u) : "";
      if (ready) {
        el.setAttribute("aria-label", "Put " + shown(selected.u) + " in box " + (i + 1) + (setup.ghost ? ", the box for " + shown(u) : ""));
        el.addEventListener("click", function () { tryPlace(selected, i); });
      } else {
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", "Box " + (i + 1) + ", " + (isFull ? shown(u) : "empty" + (setup.ghost ? ", for " + shown(u) : "")));
        // Tapping a full box plays its sound again (pointer only: it would be one more stop for switches).
        if (isFull) el.addEventListener("click", function () { if (!busy) { hush(); play([unitPart(u)]); } });
      }
      boxesEl.appendChild(el);
    });
  }
  function renderTray() {
    trayEl.innerHTML = "";
    tiles.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "tile" + (t.u.length > 1 ? " is-wide" : "") + (t.used ? " is-gone" : "");
      b.textContent = shown(t.u);
      b.setAttribute("aria-label", shown(t.u));
      if (setup.place === "box") b.setAttribute("aria-pressed", "false");
      if (t.used) { b.tabIndex = -1; b.setAttribute("aria-hidden", "true"); b.disabled = true; }
      t.el = b;
      bindTile(t);
      trayEl.appendChild(b);
    });
  }
  function refreshTiles() {
    tiles.forEach(function (t) {
      if (!t.el) return;
      if (setup.place === "box") t.el.setAttribute("aria-pressed", selected === t ? "true" : "false");
      t.el.classList.toggle("is-gone", t.used);
      if (t.used) { t.el.tabIndex = -1; t.el.setAttribute("aria-hidden", "true"); t.el.disabled = true; }
    });
  }
  function renderProgress() {
    var p = $("progress");
    p.innerHTML = "";
    if (total > 12) {
      p.classList.add("is-count");
      p.textContent = "Word " + Math.min(done + 1, total) + " of " + total;
    } else {
      p.classList.remove("is-count");
      for (var i = 0; i < total; i++) {
        var d = document.createElement("span");
        d.className = "dot" + (i < done ? " is-full" : "") + (i === done && !finished ? " is-now" : "");
        p.appendChild(d);
      }
    }
    p.setAttribute("aria-label", "Word " + Math.min(done + 1, total) + " of " + total);
  }
  function focusFirstTile() {
    var t = tiles.filter(function (x) { return !x.used; })[0];
    if (t && t.el) t.el.focus({ preventScroll: true });
  }
  function boxEl(i) { return boxesEl.querySelector('[data-i="' + i + '"]'); }

  /* ---------- Playing ---------- */
  function tapTile(t) {
    if (busy || built || t.used || openPanel) return;
    hush();
    if (setup.place === "auto") {
      var right = t.u === units[filled];
      if (right) { play([unitPart(t.u)]); place(t); }
      else {
        // Exploring is fine: it plays its sound and stays put.
        play([unitPart(t.u)]);
        wrongs++;
        wobble(t);
        if (wrongs >= 3) showHint();
        announce(shown(t.u) + ". Not this one yet.");
      }
      return;
    }
    selected = t;
    play([unitPart(t.u)]);
    refreshTiles();
    renderBoxes();
    setHint();
    announce(shown(t.u) + ". Now choose the box.");
    // Keyboard and switch users go straight to the box.
    var b = boxEl(filled);
    if (b && b.tagName === "BUTTON" && lastInputKey) b.focus({ preventScroll: true });
  }
  function tryPlace(t, i) {
    if (!t || busy || built || t.used || i !== filled) return;
    if (t.u === units[i]) { place(t); return; }
    // Not the right sound for this box: it goes back, gently.
    wrongs++;
    selected = null;
    sfxSoft();
    play([phrase("tryAgain")]);
    wobble(t);
    refreshTiles();
    renderBoxes();
    setHint();
    if (wrongs >= 2) showHint();
    announce("Try again. " + shown(t.u) + " goes back.");
    if (lastInputKey && t.el) t.el.focus({ preventScroll: true });
  }
  function showHint() {
    var right = tiles.filter(function (x) { return !x.used && x.u === units[filled]; })[0];
    if (right && right.el) right.el.classList.add("is-hint");
  }
  function wobble(t) {
    if (!settings.animation || !t.el) return;
    t.el.classList.remove("is-wobble");
    void t.el.offsetWidth;
    t.el.classList.add("is-wobble");
    setTimeout(function () { if (t.el) t.el.classList.remove("is-wobble"); }, 400);
  }
  function place(t) {
    var i = filled;
    var from = t.el.getBoundingClientRect();
    t.used = true;
    selected = null;
    wrongs = 0;
    filled++;
    tiles.forEach(function (x) { if (x.el) x.el.classList.remove("is-hint"); });
    sfxPlace();
    refreshTiles();
    renderBoxes();
    flyTo(t, from, boxEl(i));
    setHint();
    if (filled >= units.length) {
      built = true;
      setHint();
      announce(shown(t.u) + " in box " + (i + 1) + ". All the boxes are full. Listen.");
      setTimeout(blend, settings.animation ? 450 : 150);
    } else {
      announce(shown(t.u) + " in box " + (i + 1) + ". Next letter.");
      if (lastInputKey) focusFirstTile();
    }
  }
  function flyTo(t, from, to) {
    if (!settings.animation || !to) return;
    var r = to.getBoundingClientRect();
    var f = document.createElement("div");
    f.className = t.el.className.replace("is-gone", "") + " flyer";
    f.textContent = shown(t.u);
    f.style.left = from.left + "px";
    f.style.top = from.top + "px";
    document.body.appendChild(f);
    to.style.visibility = "hidden";
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        f.style.left = (r.left + (r.width - from.width) / 2) + "px";
        f.style.top = (r.top + (r.height - from.height) / 2) + "px";
      });
    });
    setTimeout(function () { f.remove(); to.style.visibility = ""; }, 340);
  }

  // All the boxes are full: each sound in turn, lighting up its box, then the whole word.
  function blendParts() {
    var parts = [];
    function light(i) { return { fn: function () { lightBox(i); } }; }
    function pass(gap) {
      units.forEach(function (u, i) {
        parts.push(light(i), unitPart(u), { gap: gap });
      });
    }
    pass(450);
    if (setup.blend === "fast") { parts.push({ gap: 300 }); pass(60); }
    parts.push(light(-1), { gap: 300 }, { fn: function () { lightBox("all"); if (setup.picture !== "never") { showPicture(true); if (settings.animation) picEl.classList.add("is-pop"); } } });
    parts.push(wordPart(plain(word)));
    return parts;
  }
  function lightBox(i) {
    Array.prototype.forEach.call(boxesEl.children, function (b, k) {
      b.classList.toggle("is-say", i === k);
      b.classList.toggle("is-word", i === "all");
    });
  }
  function blend() {
    busy = true;
    trayEl.classList.add("is-waiting");
    boxesEl.classList.add("is-built");
    hush();
    play(blendParts(), function () {
      lightBox(-1);
      busy = false;
      if (!doneWords.length || doneWords[doneWords.length - 1] !== word) {
        done++;
        doneWords.push(plain(word));
      }
      sfxWord();
      renderProgress();
      var last = done >= total;
      $("next-label").textContent = last ? "Finish" : "Next word";
      trayEl.hidden = true;
      $("after").hidden = false;
      announce("The word is " + plain(word) + ".");
      $("btn-next").focus({ preventScroll: true });
    });
  }
  function replay() {
    if (busy) return;
    busy = true;
    hush();
    play(blendParts(), function () { lightBox(-1); busy = false; });
  }
  function finish() {
    finished = true;
    hush();
    sfxAll();
    renderProgress();
    $("done-desc").textContent = "You built " + done + (done === 1 ? " word." : " words.");
    $("done-words").textContent = doneWords.map(function (w) { return setup.letterCase === "upper" ? w.toUpperCase() : w; }).join(", ");
    play([phrase("great")]);
    showPanel("panel-done", null, $("done-title"));
  }

  /* ---------- Dragging a tile to the box ---------- */
  var drag = null, suppressClick = false;
  function bindTile(t) {
    var b = t.el;
    b.addEventListener("click", function (e) {
      if (suppressClick) { suppressClick = false; e.preventDefault(); return; }
      tapTile(t);
    });
    b.addEventListener("pointerdown", function (e) {
      if (e.button > 0 || busy || built || t.used || setup.place !== "box") return;
      drag = { t: t, id: e.pointerId, x: e.clientX, y: e.clientY, moving: false, ghost: null };
    });
  }
  function overBox(x, y) {
    var b = boxEl(filled);
    if (!b) return false;
    var r = b.getBoundingClientRect(), pad = r.width * 0.35;
    return x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad;
  }
  document.addEventListener("pointermove", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moving) {
      if (dx * dx + dy * dy < 144) return; // a small wobble is still a tap
      drag.moving = true;
      // Picking it up plays its sound, like a tap.
      if (selected !== drag.t) { hush(); selected = drag.t; play([unitPart(drag.t.u)]); refreshTiles(); renderBoxes(); setHint(); }
      var g = document.createElement("div");
      g.className = drag.t.el.className + " drag-ghost";
      g.textContent = shown(drag.t.u);
      var r = drag.t.el.getBoundingClientRect();
      g.style.width = r.width + "px"; g.style.height = r.height + "px";
      document.body.appendChild(g);
      drag.ghost = g;
      drag.t.el.classList.add("is-dragging");
    }
    e.preventDefault();
    drag.ghost.style.left = e.clientX + "px";
    drag.ghost.style.top = e.clientY + "px";
    var b = boxEl(filled);
    if (b) b.classList.toggle("is-drop", overBox(e.clientX, e.clientY));
  }, { passive: false });
  function endDrag(e, cancelled) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    var d = drag;
    drag = null;
    if (!d.moving) return;
    suppressClick = true;
    setTimeout(function () { suppressClick = false; }, 400);
    if (d.ghost) d.ghost.remove();
    if (d.t.el) d.t.el.classList.remove("is-dragging");
    var b = boxEl(filled);
    if (b) b.classList.remove("is-drop");
    if (!cancelled && e && overBox(e.clientX, e.clientY)) tryPlace(d.t, filled);
  }
  document.addEventListener("pointerup", function (e) { endDrag(e, false); });
  document.addEventListener("pointercancel", function (e) { endDrag(e, true); });

  /* ---------- Real keyboards ---------- */
  // Typing a letter picks that tile; Enter puts the picked tile in the box.
  var lastInputKey = false;
  document.addEventListener("keydown", function () { lastInputKey = true; }, true);
  document.addEventListener("pointerdown", function (e) { lastInputKey = e.pointerType === "" ? lastInputKey : false; }, true);
  document.addEventListener("keydown", function (e) {
    if (openPanel || e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    var k = (e.key || "").toLowerCase();
    if (/^[a-z]$/.test(k) && !busy && !built) {
      // The first unused tile starting with that letter (a two-letter tile counts too).
      var t = tiles.filter(function (x) { return !x.used && x.u.charAt(0) === k; });
      if (setup.place === "auto") t.sort(function (a, b) { return (b.u === units[filled]) - (a.u === units[filled]); });
      if (t.length) { e.preventDefault(); tapTile(t[0]); }
    } else if (k === "enter" && selected && setup.place === "box" && !(e.target && e.target.tagName === "BUTTON")) {
      e.preventDefault();
      tryPlace(selected, filled);
    } else if (k === "escape" && selected) {
      selected = null; refreshTiles(); renderBoxes(); setHint();
    }
  });

  /* ---------- Fit the game to the screen ---------- */
  function fitStage() {
    var W = stage.clientWidth, H = stage.clientHeight;
    if (!W || !H) return;
    var boxW = units.reduce(function (a, u) { return a + (u.length > 1 ? 1.5 : 1); }, 0) + 0.14 * (units.length - 1);
    var tileW = tiles.reduce(function (a, t) { return a + (t.u.length > 1 ? 1.5 : 1); }, 0) + 0.2 * (tiles.length - 1);
    // The boxes stay on one row; the tiles may wrap onto a second row on narrow screens.
    // Take the biggest size where everything fits: progress and hint (about 90px),
    // the picture (1.1 b), the boxes (1.2 b), each row of tiles (1.2 b) and the gaps.
    var pic = setup.picture === "never" ? 0 : 1.1;
    var b = Math.min(200, (W - 8) / boxW);
    for (; b > 48; b -= 2) {
      var rows = Math.ceil(tileW * b / (W - 8));
      if (90 + b * (pic + 1.2 + rows * 1.2 + 0.4) <= H) break;
    }
    b = Math.max(48, b);
    root.style.setProperty("--b", Math.floor(b) + "px");
  }

  /* ---------- Panels ---------- */
  var openPanel = null, returnFocus = null;
  function showPanel(id, opener, focusEl) {
    if (openPanel) hidePanel(true);
    openPanel = $(id);
    returnFocus = opener || document.activeElement;
    openPanel.hidden = false;
    $("app").setAttribute("aria-hidden", "true");
    var f = focusEl || openPanel.querySelector("h2");
    setTimeout(function () { f.focus(); }, 30);
  }
  function hidePanel(silent) {
    if (!openPanel) return;
    var was = openPanel.id;
    if (was === "panel-setup" && !silent) applyDraft();
    openPanel.hidden = true;
    openPanel = null;
    $("app").removeAttribute("aria-hidden");
    if (silent) return;
    if (was === "panel-done") { newGame(); play(introParts()); focusFirstTile(); return; }
    if (returnFocus && returnFocus.focus && document.contains(returnFocus) && !returnFocus.closest("[hidden]")) returnFocus.focus();
    else focusFirstTile();
  }
  document.querySelectorAll(".overlay").forEach(function (ov) {
    ov.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) { hidePanel(); return; }
      if (e.target === ov && ov.id !== "panel-done") hidePanel();
    });
  });
  document.addEventListener("keydown", function (e) {
    if (!openPanel) return;
    if (e.key === "Escape") { e.preventDefault(); hidePanel(); return; }
    if (e.key === "Tab") { // keep focus inside the open panel
      var items = Array.prototype.filter.call(openPanel.querySelectorAll("button, input, select, textarea"), function (el) {
        return !el.disabled && !el.closest("[hidden]");
      });
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === openPanel.querySelector("h2"))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
  });

  /* ---------- Teacher setup ---------- */
  var draft = null;
  function openSetup(e) {
    draft = JSON.parse(JSON.stringify(setup));
    var wp = $("word-presets");
    wp.innerHTML = "";
    cfg.wordLists.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "btn"; b.textContent = p.name;
      b.addEventListener("click", function () {
        $("set-words").value = p.words.join("\n");
        draft.words = cleanWords(p.words);
        updateLink();
      });
      wp.appendChild(b);
    });
    $("set-words").value = draft.words.join("\n");
    $("set-turns").value = String(draft.turns);
    if (!$("set-turns").value) $("set-turns").value = "5";
    $("set-order").value = draft.order;
    $("set-place").value = draft.place;
    $("set-tiles").value = draft.tiles;
    $("set-extra").value = String(draft.extra);
    $("set-case").value = draft.letterCase;
    $("set-ghost").checked = draft.ghost;
    $("set-say").checked = draft.sayFirst;
    $("set-pic").value = draft.picture;
    $("set-blend").value = draft.blend;
    $("set-lock").checked = false;
    $("copied").textContent = "";
    updateLink();
    showPanel("panel-setup", e && e.currentTarget);
  }
  function updateLink() {
    if (!draft) return;
    var ok = draft.words.length > 0;
    $("share-link").value = ok ? linkFor(draft, $("set-lock").checked) : "";
    $("btn-setup-done").disabled = !ok;
    $("copied").textContent = "";
    // Show how each word splits into tiles.
    var pv = $("tiles-preview");
    pv.innerHTML = "";
    if (!ok) { pv.textContent = "Type at least one word."; return; }
    pv.appendChild(document.createTextNode("Tiles: "));
    draft.words.slice(0, 12).forEach(function (w, n) {
      if (n) pv.appendChild(document.createTextNode("  "));
      unitsOf(w).forEach(function (u) {
        var s = document.createElement("span");
        s.className = "tp"; s.textContent = u;
        pv.appendChild(s);
      });
    });
    if (draft.words.length > 12) pv.appendChild(document.createTextNode(" …"));
  }
  function applyDraft() {
    if (!draft || !draft.words.length) { draft = null; return; }
    var changed = JSON.stringify(cleanSetup(draft)) !== JSON.stringify(setup);
    setup = cleanSetup(draft);
    draft = null;
    saveSetup();
    if (changed) {
      try {
        if (/[?&]words=/.test(location.search) && history.replaceState) {
          history.replaceState(null, "", location.pathname + (locked ? "?lock=1" : "") + location.hash);
        }
      } catch (e) { /* ignore */ }
      newGame();
      play(introParts());
    }
  }
  $("set-words").addEventListener("input", function (e) { draft.words = cleanWords(e.target.value); updateLink(); });
  $("set-turns").addEventListener("change", function (e) { draft.turns = Number(e.target.value); updateLink(); });
  $("set-order").addEventListener("change", function (e) { draft.order = e.target.value; updateLink(); });
  $("set-place").addEventListener("change", function (e) { draft.place = e.target.value; updateLink(); });
  $("set-tiles").addEventListener("change", function (e) { draft.tiles = e.target.value; updateLink(); });
  $("set-extra").addEventListener("change", function (e) { draft.extra = Number(e.target.value); updateLink(); });
  $("set-case").addEventListener("change", function (e) { draft.letterCase = e.target.value; updateLink(); });
  $("set-ghost").addEventListener("change", function (e) { draft.ghost = e.target.checked; updateLink(); });
  $("set-say").addEventListener("change", function (e) { draft.sayFirst = e.target.checked; updateLink(); });
  $("set-pic").addEventListener("change", function (e) { draft.picture = e.target.value; updateLink(); });
  $("set-blend").addEventListener("change", function (e) { draft.blend = e.target.value; updateLink(); });
  $("set-lock").addEventListener("change", updateLink);
  $("btn-setup-done").addEventListener("click", function () {
    var before = JSON.stringify(setup);
    hidePanel();
    if (JSON.stringify(setup) === before) { newGame(); play(introParts()); }
    focusFirstTile();
  });
  $("btn-copy-link").addEventListener("click", function () {
    var input = $("share-link");
    var text = input.value;
    var ok = function () { $("copied").textContent = "Link copied! Paste it in Google Classroom, an email or a message."; };
    var fallback = function () {
      try {
        input.focus(); input.select(); input.setSelectionRange(0, text.length);
        if (document.execCommand && document.execCommand("copy")) ok();
        else $("copied").textContent = "The link is selected. Copy it from the box above.";
      } catch (e) { $("copied").textContent = "Copy the link from the box above."; }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback);
    else fallback();
  });
  if (navigator.share) {
    $("btn-share-link").hidden = false;
    $("btn-share-link").addEventListener("click", function () {
      try { navigator.share({ title: "Sound It Out", url: $("share-link").value }).catch(function () {}); } catch (e) { /* ignore */ }
    });
  }

  /* ---------- Settings controls ---------- */
  function applySettings() {
    root.classList.toggle("hc", !!settings.highContrast);
    root.classList.toggle("no-motion", !settings.animation);
  }
  function bindSettings() {
    var voice = $("set-voice"), sounds = $("set-sounds"), volEl = $("set-volume"),
        anim = $("set-animation"), hc = $("set-contrast"), vname = $("set-voice-name"), rate = $("set-rate");
    voice.checked = !!settings.voice;
    sounds.checked = !!settings.sounds;
    volEl.value = settings.volume;
    volEl.setAttribute("aria-valuetext", settings.volume + " percent");
    anim.checked = !!settings.animation;
    hc.checked = !!settings.highContrast;
    fillVoiceList();
    rate.value = String(settings.rate);
    if (!rate.value) rate.value = "0.8";
    var sample = function () { hush(); play(["cat.", { snd: soundUrl("c") }, { snd: soundUrl("a") }, { snd: soundUrl("t") }]); };
    voice.addEventListener("change", function () { settings.voice = voice.checked; saveSettings(); if (voice.checked) play("Voice on."); });
    vname.addEventListener("change", function () { settings.voiceName = vname.value; saveSettings(); pickVoice(); hush(); play("cat."); });
    rate.addEventListener("change", function () { settings.rate = Number(rate.value); saveSettings(); hush(); play("cat."); });
    $("btn-hear").addEventListener("click", sample);
    sounds.addEventListener("change", function () { settings.sounds = sounds.checked; saveSettings(); sfxPlace(); });
    volEl.addEventListener("input", function () {
      settings.volume = Number(volEl.value);
      volEl.setAttribute("aria-valuetext", settings.volume + " percent");
      saveSettings();
    });
    volEl.addEventListener("change", function () { hush(); play([{ snd: soundUrl("m") }]); });
    anim.addEventListener("change", function () { settings.animation = anim.checked; saveSettings(); applySettings(); });
    hc.addEventListener("change", function () { settings.highContrast = hc.checked; saveSettings(); applySettings(); });
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
  // iPhone Safari can't make a page full screen: the button still hides the top bar,
  // and the first time it explains Add to Home Screen for true full screen.
  var pseudoFs = false;
  function fallbackFullscreen() {
    pseudoFs = true;
    updateFsButton();
    fitStage();
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
  }
  function toggleFullscreen() {
    if (pseudoFs) { pseudoFs = false; updateFsButton(); fitStage(); return; }
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
  document.addEventListener("fullscreenchange", function () { updateFsButton(); fitStage(); });
  document.addEventListener("webkitfullscreenchange", function () { updateFsButton(); fitStage(); });

  /* ---------- Directions ---------- */
  function directionsText() {
    var t = "Tap a letter to hear its sound. ";
    t += setup.place === "auto" ? "When it is the right one, it goes in the box. "
                                : "Then tap the glowing box to put it in, or drag it there. ";
    t += "Fill the boxes from left to right. When they are all full, listen to the sounds, and then the word.";
    return t;
  }

  /* ---------- Start ---------- */
  "abcdefghijklmnopqrstuvwxyz".split("").forEach(function (c) { loadSound(soundUrl(c)); });
  applySettings();
  bindSettings();
  newGame();

  $("btn-new").addEventListener("click", function () { newGame(); play(introParts()); focusFirstTile(); });
  $("btn-directions").addEventListener("click", function () { hush(); announce(directionsText()); play(directionsText()); });
  $("btn-hear-word").addEventListener("click", function () { if (!busy) { hush(); play([wordPart(plain(word))]); } });
  $("btn-settings").addEventListener("click", function (e) { showPanel("panel-settings", e.currentTarget); });
  $("btn-setup").addEventListener("click", openSetup);
  $("btn-again").addEventListener("click", function () { hidePanel(); });
  $("btn-replay").addEventListener("click", replay);
  $("btn-next").addEventListener("click", function () {
    if (busy) return;
    if (done >= total) { finish(); return; }
    nextWord(false);
  });

  if (isStandalone()) { pseudoFs = true; updateFsButton(); }
  $("btn-fullscreen").addEventListener("click", toggleFullscreen);
  $("btn-exit-fs").addEventListener("click", toggleFullscreen);

  if (window.ResizeObserver) new ResizeObserver(fitStage).observe(stage);
  window.addEventListener("resize", fitStage);
  window.addEventListener("orientationchange", function () { setTimeout(fitStage, 200); });
  fitStage();
})();
