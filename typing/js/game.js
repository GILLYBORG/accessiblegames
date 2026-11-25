/*
 * Monster Keys - game logic.
 * You should not need to edit this file. Change pictures, word lists and words in js/config.js.
 *
 * How a turn works:
 *   1. The game shows (and says) a letter, or a word one letter at a time.
 *   2. The student finds that key: on a real keyboard, on the big keys on screen,
 *      with any finger, a pointer, a head stick or a switch. Speed never counts.
 *   3. The right key feeds the letter to the monster. A wrong key just gets a gentle
 *      "try again" and nothing is taken away.
 *   4. When the monster's belly is full, the game is done.
 */
(function () {
  "use strict";

  /* ---------- Config ---------- */
  var userCfg = window.GAME_CONFIG || {};
  var cfg = {
    monster: userCfg.monster || "images/monster.png",
    monsterClosed: userCfg.monsterClosed || userCfg.monster || "images/monster-closed.png",
    pictures: userCfg.pictures || {},
    letterSets: userCfg.letterSets || [],
    wordLists: userCfg.wordLists || [],
    startSetup: userCfg.startSetup || {},
    yums: Array.isArray(userCfg.yums) ? userCfg.yums : [],
    phrases: Object.assign({ find: "Find", tryAgain: "Try again.", type: "Type", full: "The monster is full!" }, userCfg.phrases || {}),
    recordings: Object.assign({ letters: "", numbers: "", find: "", tryAgain: "", type: "", full: "", words: {} }, userCfg.recordings || {}),
    voiceRate: typeof userCfg.voiceRate === "number" ? userCfg.voiceRate : 0.8,
    defaults: Object.assign({ voice: true, recorded: true, voiceName: "", rate: userCfg.voiceRate || 0.8, echo: true, sounds: true, volume: 90, animation: true, highContrast: false, deviceKeyboard: false }, userCfg.defaults || {})
  };
  var root = document.documentElement;

  /* ---------- Settings (remembered on this device) ---------- */
  var STORE_KEY = "monster-keys.settings";
  var SETUP_KEY = "monster-keys.setup";
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

  /* ---------- Setup: what to practise and how ---------- */
  var TYPABLE = /[a-z0-9 .,]/;
  function cleanKeys(s) {
    var out = "";
    String(s || "").toLowerCase().split("").forEach(function (c) {
      if (/[a-z0-9]/.test(c) && out.indexOf(c) < 0) out += c;
    });
    return out.slice(0, 36);
  }
  function cleanWord(w) {
    return String(w || "").replace(/[‘’]/g, "'").replace(/[^A-Za-z0-9 .,]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
  }
  function cleanWords(list) {
    if (typeof list === "string") list = list.split(/\r?\n|\|/);
    if (!Array.isArray(list)) return [];
    return list.map(cleanWord).filter(function (w) { return w.length > 0; }).slice(0, 60);
  }
  function pick(v, allowed, dflt) { return allowed.indexOf(v) >= 0 ? v : dflt; }
  function cleanSetup(s) {
    s = s || {};
    var turns = parseInt(s.turns, 10);
    var wait = parseInt(s.wait, 10);
    var out = {
      mode: pick(s.mode, ["letters", "words"], "letters"),
      keys: cleanKeys(s.keys),
      words: cleanWords(s.words),
      turns: turns >= 0 && turns <= 100 ? turns : 10,
      order: pick(s.order, ["mix", "in"], "mix"),
      hint: pick(s.hint, ["always", "wrong", "ask"], "always"),
      others: pick(s.others, ["show", "dim", "hide"], "show"),
      letterCase: pick(s.letterCase, ["lower", "upper", "asis"], "lower"),
      keyCase: pick(s.keyCase, ["upper", "match"], "upper"),
      wait: wait >= 0 && wait <= 5000 ? wait : 0
    };
    if (!out.keys) out.keys = "satpin";
    if (!out.words.length) out.words = ["cat", "dog", "sun"];
    return out;
  }
  function setupOk(s) { return s.mode === "letters" ? s.keys.length > 0 : s.words.length > 0; }

  // A link holds a setup, for example ?mode=letters&keys=satpin&n=10 or ?mode=words&words=cat|dog|sun
  function setupFromUrl() {
    try {
      var q = new URLSearchParams(location.search);
      if (!q.get("mode")) return null;
      return cleanSetup({
        mode: q.get("mode"), keys: q.get("keys"), words: q.get("words") || "",
        turns: q.has("n") ? q.get("n") : 10, order: q.get("order"), hint: q.get("hint"),
        others: q.get("others"), letterCase: q.get("case"), keyCase: q.get("kcase"), wait: q.get("wait")
      });
    } catch (e) { return null; }
  }
  function linkFor(s, lock) {
    var base = location.href.split("#")[0].split("?")[0];
    var p = "?mode=" + s.mode;
    if (s.mode === "letters") p += "&keys=" + encodeURIComponent(s.keys);
    else p += "&words=" + s.words.map(function (w) { return encodeURIComponent(w); }).join("|");
    p += "&n=" + s.turns + "&order=" + s.order + "&hint=" + s.hint + "&others=" + s.others +
      "&case=" + s.letterCase + "&kcase=" + s.keyCase + "&wait=" + s.wait + (lock ? "&lock=1" : "");
    return base + p;
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

  /* ---------- Elements ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var stage = $("stage");
  var kbEl = $("kb");
  var typeBox = $("type-box");
  var targetEl = $("target");
  var monsterEl = $("monster");
  var bellyEl = $("belly");
  var live = $("live");

  /* ---------- Words ---------- */
  var ORD = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
  // What the voice says for a key. Most voices say a lone "A" as "uh", so spell that one out.
  function spoken(c) {
    if (c === " ") return "space";
    if (c === ".") return "dot";
    if (c === ",") return "comma";
    if (c === "a") return "ay";
    return c.toUpperCase();
  }
  // What a screen reader is given for a key.
  function written(c) {
    if (c === " ") return "space";
    if (c === ".") return "dot";
    if (c === ",") return "comma";
    return c.toUpperCase();
  }
  function shown(c, word) {
    if (setup.letterCase === "upper") return c.toUpperCase();
    if (setup.letterCase === "asis" && word) return c;
    return c.toLowerCase();
  }
  function fill(tpl, key, val) { return tpl.replace("{" + key + "}", val); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function listWords(parts) {
    if (parts.length <= 1) return parts.join("");
    return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
  }

  /* ---------- Sound: voice ---------- */
  var synth = window.speechSynthesis || null;
  var speechUnlocked = false;
  var actx = null;
  // iPhones and iPads only allow sound that starts during a real tap. On the first
  // tap (or key), start the sound engine and speak a silent word.
  function unlockAudio() {
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* ignore */ }
    if (synth && !speechUnlocked) {
      speechUnlocked = true;
      try { var u = new SpeechSynthesisUtterance(" "); u.volume = 0; synth.speak(u); } catch (e) { /* ignore */ }
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!actx && AC) actx = new AC();
      if (actx && actx.state === "suspended" && actx.resume) actx.resume();
    } catch (e) { /* ignore */ }
  }
  ["touchend", "click", "keydown"].forEach(function (type) {
    document.addEventListener(type, unlockAudio, true);
  });

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
  // The teacher's chosen voice (Settings > Voice), or else the best-sounding one on this device.
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
  if (synth) {
    pickVoice();
    if (synth.addEventListener) synth.addEventListener("voiceschanged", pickVoice);
    else synth.onvoiceschanged = pickVoice;
  }

  function fillVoiceList() {
    var sel = document.getElementById("set-voice-name");
    if (!sel) return;
    var list = englishVoices();
    var keep = settings.voiceName || "";
    sel.innerHTML = '<option value="">Automatic (the best voice on this device)</option>';
    list.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v.name;
      o.textContent = v.name + (v.localService === false ? " (needs internet)" : "");
      sel.appendChild(o);
    });
    sel.value = keep;
    if (sel.value !== keep) sel.value = "";
  }

  // Speech never cuts itself off: a phrase always finishes before the next one starts.
  // If several phrases pile up (lots of quick presses), only the newest waiting one is kept.
  var keepAlive = [];
  var speaking = false, waiting = null, speakGen = 0;
  function voiceOn() { return settings.voice && settings.volume > 0; }
  function speechOk() { return synth && window.SpeechSynthesisUtterance; }

  // What to say is a list of parts. A part is text for the computer voice, or
  // { clip: "sounds/....mp3", text: "what to say if the clip won't play" }.
  // speak() also takes plain text.
  function speak(parts, done) {
    if (!Array.isArray(parts)) parts = [parts];
    parts = parts.filter(function (x) { return x && (typeof x === "string" ? x.trim() : true); });
    if (!parts.length || !voiceOn()) { if (done) setTimeout(done, 0); return; }
    if (speaking) {
      var before = waiting && waiting.done;
      waiting = { parts: parts, done: before && done ? function () { before(); done(); } : (done || before) };
      return;
    }
    speaking = true;
    // Join text that sits side by side into one phrase, so it flows.
    var list = [];
    parts.forEach(function (x) {
      if (typeof x === "string" && typeof list[list.length - 1] === "string") list[list.length - 1] += " " + x;
      else list.push(x);
    });
    var i = 0, gen = speakGen;
    (function next() {
      if (gen !== speakGen) i = list.length; // hushed: skip the rest
      if (i >= list.length) {
        speaking = false;
        if (done) done();
        if (waiting) {
          var w = waiting; waiting = null;
          setTimeout(function () { speak(w.parts, w.done); }, 150); // a short breath between phrases
        }
        return;
      }
      var x = list[i++];
      if (typeof x === "string") sayNow(x, next);
      else playClip(x, next);
    })();
  }

  // Recorded clips (the teacher's own voice).
  var player = new Audio();
  player.preload = "auto";
  var playerUnlocked = false;
  var SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
  function unlockPlayer() {
    if (playerUnlocked) return;
    playerUnlocked = true;
    try { player.src = SILENT; var pr = player.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) { /* ignore */ }
  }
  ["touchend", "click", "keydown"].forEach(function (type) {
    document.addEventListener(type, unlockPlayer, true);
  });
  var badClips = {};
  function playClip(x, done) {
    var ended = false, guard = null;
    function end() {
      if (ended) return;
      ended = true;
      clearTimeout(guard);
      player.onended = player.onerror = null;
      done();
    }
    function fallback() {
      if (ended) return;
      ended = true;
      clearTimeout(guard);
      player.onended = player.onerror = null;
      badClips[x.clip] = true;
      if (x.text && speechOk()) sayNow(x.text, done); else done();
    }
    if (badClips[x.clip]) { ended = true; if (x.text && speechOk()) sayNow(x.text, done); else done(); return; }
    try {
      player.onended = end;
      player.onerror = fallback;
      player.src = x.clip;
      player.volume = Math.max(0, Math.min(100, settings.volume)) / 100;
      var pr = player.play();
      if (pr && pr.catch) pr.catch(function () { fallback(); });
      guard = setTimeout(end, 4000);
    } catch (e) { fallback(); }
  }
  // Warm up the clips so the first one doesn't lag.
  function preloadClips(urls) {
    urls.forEach(function (u) { try { var a = new Audio(); a.preload = "auto"; a.src = u; } catch (e) { /* ignore */ } });
  }

  function sayNow(text, done) {
    if (!speechOk()) { done(); return; }
    if (!voiceSearched) pickVoice();
    var u = new SpeechSynthesisUtterance(text);
    var v = chosenVoice;
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = root.lang || "en"; }
    u.rate = Math.max(0.5, Math.min(1.3, Number(settings.rate) || cfg.voiceRate));
    u.volume = Math.max(0, Math.min(100, settings.volume)) / 100;
    var ended = false, guard = null;
    function end() {
      if (ended) return;
      ended = true;
      clearTimeout(guard);
      done();
    }
    u.onend = end;
    u.onerror = function (ev) {
      if (v && !v.localService && ev && ev.error !== "interrupted" && ev.error !== "canceled") {
        badVoices[v.voiceURI || v.name] = true; // an online voice failed: use another next time
        pickVoice();
      }
      end();
    };
    // Some browsers forget to say when they finish; move on after a generous guess.
    guard = setTimeout(end, 1500 + text.length * 120 / u.rate);
    keepAlive.push(u);
    if (keepAlive.length > 6) keepAlive.shift();
    try { synth.speak(u); } catch (e) { end(); }
  }

  /* ---------- What the voice says, as parts (recorded clip or computer voice) ---------- */
  function useRec() { return settings.recorded !== false; }
  function phrase(key) {
    var text = cfg.phrases[key] || "";
    var clip = useRec() && cfg.recordings[key];
    return clip ? { clip: clip, text: text } : text;
  }
  function keyPart(c) {
    var text = spoken(c) + ".";
    var pat = /[a-z]/.test(c) ? cfg.recordings.letters : (/[0-9]/.test(c) ? cfg.recordings.numbers : "");
    return useRec() && pat ? { clip: pat.replace("{key}", c), text: text } : text;
  }
  function wordPart(w) {
    var clip = useRec() && cfg.recordings.words && cfg.recordings.words[w.toLowerCase()];
    return clip ? { clip: clip, text: w + "." } : w + ".";
  }
  // Stop talking now (new game, closing the game).
  function hush() {
    waiting = null;
    speakGen++;
    try { player.pause(); if (player.onended) player.onended(); } catch (e) { /* ignore */ }
    if (synth && (synth.speaking || synth.pending)) { try { synth.cancel(); } catch (e) { /* ignore */ } }
  }

  /* ---------- Sound: made in the browser (no files) ---------- */
  function sfxOk() { return settings.sounds && settings.volume > 0 && actx; }
  function level(g) { return g * Math.max(0, Math.min(100, settings.volume)) / 100; }
  function tone(freq, at, dur, type, gain, toFreq) {
    if (!sfxOk()) return;
    try {
      if (actx.state === "suspended" && actx.resume) actx.resume();
      var t0 = actx.currentTime + at;
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || "triangle";
      o.frequency.setValueAtTime(freq, t0);
      if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(level(gain || 0.25), t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) { /* ignore */ }
  }
  function sfxTap() { tone(1200, 0, 0.04, "square", 0.05); }
  function sfxChomp() { tone(220, 0, 0.09, "square", 0.16, 110); tone(200, 0.13, 0.09, "square", 0.16, 100); }
  function sfxSoft() { tone(330, 0, 0.18, "sine", 0.12, 294); } // gentle, never a buzzer
  function sfxWord() { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.1, 0.4, "triangle", 0.22); }); }
  function sfxFull() { [523, 659, 784, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.13, 0.45, "triangle", 0.24); }); }

  /* ---------- Announcements for screen readers ---------- */
  var announceTimer = null;
  function announce(text) {
    live.textContent = "";
    clearTimeout(announceTimer);
    announceTimer = setTimeout(function () { live.textContent = text; }, 60);
  }

  /* ---------- The on-screen keyboard ---------- */
  // Laid out like a Chromebook or iPad keyboard. "at" is how far the row starts from the left, in keys.
  var ROWS = [
    { name: "the number row", keys: "1234567890", at: 0, numbers: true },
    { name: "the top letter row", keys: "qwertyuiop", at: 0.5 },
    { name: "the middle letter row", keys: "asdfghjkl", at: 0.8 },
    { name: "the bottom letter row", keys: "zxcvbnm,.", at: 1.3 }
  ];
  var KB_COLS = 10.8;
  var keyEls = {};
  function lessonChars() {
    var set = {};
    if (setup.mode === "letters") setup.keys.split("").forEach(function (c) { set[c] = true; });
    else setup.words.forEach(function (w) { w.toLowerCase().split("").forEach(function (c) { set[c] = true; }); });
    return set;
  }
  function needsNumbers() {
    var set = lessonChars();
    return Object.keys(set).some(function (c) { return /[0-9]/.test(c); });
  }
  function buildKeyboard() {
    kbEl.innerHTML = "";
    keyEls = {};
    var inLesson = lessonChars();
    var nums = needsNumbers();
    var rows = ROWS.filter(function (r) { return !r.numbers || nums; });
    kbEl.style.setProperty("--rows", rows.length + 1);
    rows.forEach(function (r) {
      var row = document.createElement("div");
      row.className = "kb-row";
      row.style.paddingLeft = "calc(var(--k) * " + r.at + ")";
      r.keys.split("").forEach(function (c) { row.appendChild(makeKey(c, inLesson[c])); });
      kbEl.appendChild(row);
    });
    var srow = document.createElement("div");
    srow.className = "kb-row";
    srow.style.paddingLeft = "calc(var(--k) * 2.6)";
    srow.appendChild(makeKey(" ", inLesson[" "]));
    kbEl.appendChild(srow);
    updateKeyLabels();
  }
  function makeKey(c, inLesson) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "key" + (c === " " ? " key-space" : "") + (c === "f" || c === "j" ? " key-bump" : "");
    b.dataset.key = c;
    var lab = document.createElement("span");
    lab.className = "key-label";
    lab.setAttribute("aria-hidden", "true");
    b.appendChild(lab);
    if (!inLesson) {
      if (setup.others === "dim") b.classList.add("is-dim");
      if (setup.others === "hide") { b.classList.add("is-hidden"); b.tabIndex = -1; b.setAttribute("aria-hidden", "true"); }
    }
    b.addEventListener("click", function (e) {
      e.preventDefault();
      press(c, b);
    });
    keyEls[c] = b;
    return b;
  }
  function updateKeyLabels() {
    Object.keys(keyEls).forEach(function (c) {
      var b = keyEls[c];
      b.querySelector(".key-label").textContent = c === " " ? "space" : (setup.keyCase === "match" ? shown(c, false) : c.toUpperCase());
      var isTarget = b.classList.contains("is-target");
      b.setAttribute("aria-label", written(c) + (isTarget ? ", this one" : ""));
    });
  }
  function whereIs(c) {
    if (c === " ") return "Space is the long bar at the bottom.";
    for (var i = 0; i < ROWS.length; i++) {
      var k = ROWS[i].keys.indexOf(c);
      if (k < 0) continue;
      var n = ROWS[i].keys.length;
      var fromLeft = k, fromRight = n - 1 - k;
      var pos = fromLeft <= fromRight ? (fromLeft === 0 ? "the first key on the left" : "the " + ORD[fromLeft] + " key from the left")
                                      : (fromRight === 0 ? "the last key on the right" : "the " + ORD[fromRight] + " key from the right");
      var t = written(c) + " is in " + ROWS[i].name + ", " + pos + ".";
      if (c === "f" || c === "j") t += " It has a little bump you can feel.";
      else if (i === 2 && k < 4) t += " It is near F, the key with the bump.";
      else if (i === 2 && k > 4) t += " It is near J, the key with the bump.";
      return t;
    }
    return "";
  }

  /* ---------- Fit the game to the screen ---------- */
  function fitStage() {
    var W = kbEl.parentNode.clientWidth;
    var H = stage.clientHeight;
    var rows = Number(kbEl.style.getPropertyValue("--rows")) || 4;
    var gap = 0.12;
    // Keys get about 58% of the height and all of the width, up to 104px each.
    var byW = W / (KB_COLS + 0.2);
    var byH = (H * 0.58) / (rows * (1 + gap));
    var k = Math.max(26, Math.min(104, byW, byH));
    root.style.setProperty("--k", Math.floor(k) + "px");
    stage.classList.toggle("is-narrow", stage.clientWidth < 640);
  }

  /* ---------- Game state ---------- */
  var queue = [];          // the letters or words still to come
  var item = "";           // the current letter or word (as written)
  var pos = 0;             // which letter of the word is next
  var wrongs = 0;          // wrong tries on the current letter
  var helped = false;      // the key is lit up for this letter
  var busy = false;        // a short pause between turns
  var done = 0;            // turns finished
  var lettersDone = 0, firstTry = 0;
  var practise = {};       // keys that took more than one try
  var lastPressAt = 0, lastItem = "";
  var finished = false;

  function expected() { return item.charAt(pos).toLowerCase(); }
  function nextItems() {
    var src = setup.mode === "letters" ? setup.keys.split("") : setup.words.slice();
    if (setup.order === "mix") {
      for (var i = src.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = src[i]; src[i] = src[j]; src[j] = t; }
      if (src.length > 1 && src[0] === lastItem) src.push(src.shift()); // no repeats back to back
    }
    return src;
  }
  function takeItem() {
    if (!queue.length) queue = nextItems();
    var it = queue.shift();
    lastItem = it;
    return it;
  }

  var gameId = 0;
  function newGame() {
    gameId++;
    hush();
    finished = false;
    busy = false;
    done = 0; lettersDone = 0; firstTry = 0; practise = {};
    queue = [];
    lastItem = "";
    $("btn-setup").hidden = locked;
    $("target-label").textContent = setup.mode === "letters" ? "Find" : "Type";
    buildKeyboard();
    renderBelly();
    nextTurn(true);
    fitStage();
  }

  function nextTurn(first) {
    item = takeItem();
    pos = 0;
    startLetter();
    renderTarget();
    var pic = setup.mode === "words" ? cfg.pictures[item.toLowerCase()] : null;
    $("word-pic").hidden = !pic;
    if (pic) $("word-pic").src = pic;
    if (!first) { speak(promptWords(true)); announce(srPrompt()); }
  }
  function startLetter() {
    wrongs = 0;
    helped = setup.hint === "always";
    lightTarget();
  }
  // The words for "what to do now". whole: say the whole word first.
  function promptWords(whole) {
    var c = expected();
    var out = [];
    if (setup.mode === "words" && whole) out.push(phrase("type"), wordPart(item));
    out.push(phrase("find"), keyPart(c));
    return out;
  }
  function srPrompt() {
    var c = expected();
    if (setup.mode === "letters") return "Find " + written(c) + ".";
    var t = "Type " + item + ". ";
    if (pos > 0) t += "Done: " + item.slice(0, pos).split("").map(written).join(" ") + ". ";
    return t + "Next: " + written(c) + ".";
  }

  function renderTarget() {
    targetEl.innerHTML = "";
    targetEl.className = "target" + (setup.mode === "words" ? " is-word" : "") + (item.length > 8 ? " is-long" : "") + (item.length > 14 ? " is-longer" : "");
    item.split("").forEach(function (c, i) {
      var s = document.createElement("span");
      s.className = "t-ch" + (c === " " ? " t-space" : "") + (i < pos ? " is-done" : "") + (i === pos ? " is-now" : "");
      s.textContent = c === " " ? "" : shown(c, true);
      targetEl.appendChild(s);
    });
    $("target-sr").textContent = srPrompt();
    typeBox.setAttribute("aria-label", "Typing box. " + srPrompt());
  }
  function lightTarget() {
    Object.keys(keyEls).forEach(function (c) {
      keyEls[c].classList.remove("is-target");
    });
    var b = keyEls[expected()];
    if (b && helped && !finished) {
      b.classList.add("is-target");
      if (b.classList.contains("is-hidden")) b.classList.remove("is-hidden");
    }
    updateKeyLabels();
  }
  // The monster grows a little with every letter it eats: from a bit over half size to full size.
  function growMonster() {
    var total;
    if (!setup.turns) total = 30;
    else if (setup.mode === "letters") total = setup.turns;
    else {
      var avg = setup.words.reduce(function (a, w) { return a + w.replace(/ /g, "").length; }, 0) / setup.words.length;
      total = Math.max(1, Math.round(setup.turns * avg));
    }
    var g = 0.55 + 0.45 * Math.min(1, lettersDone / total);
    root.style.setProperty("--grow", g.toFixed(3));
  }
  function renderBelly() {
    growMonster();
    bellyEl.innerHTML = "";
    if (!setup.turns) {
      bellyEl.textContent = String(done);
      bellyEl.classList.add("is-count");
      bellyEl.setAttribute("aria-label", "Fed " + done);
      return;
    }
    bellyEl.classList.remove("is-count");
    for (var i = 0; i < setup.turns; i++) {
      var d = document.createElement("span");
      d.className = "dot" + (i < done ? " is-full" : "");
      bellyEl.appendChild(d);
    }
    bellyEl.classList.toggle("is-many", setup.turns > 15);
    bellyEl.setAttribute("aria-label", done + " of " + setup.turns + " " + (setup.mode === "letters" ? "letters" : "words"));
  }

  /* ---------- Key presses ---------- */
  function press(c, fromKey) {
    if (finished || busy || openPanel) return;
    c = c.toLowerCase();
    if (!TYPABLE.test(c) || c.length !== 1) return;
    var t = now();
    if (setup.wait && t - lastPressAt < setup.wait) return;
    lastPressAt = t;
    sfxTap();
    flashKey(c);
    if (c === expected()) right(c, fromKey);
    else wrong(c);
  }
  function now() { return window.performance && performance.now ? performance.now() : Date.now(); }
  function flashKey(c) {
    var b = keyEls[c];
    if (!b) return;
    b.classList.remove("is-pressed");
    void b.offsetWidth;
    b.classList.add("is-pressed");
    setTimeout(function () { b.classList.remove("is-pressed"); }, 220);
  }

  function right(c, fromKey) {
    lettersDone++;
    if (wrongs === 0) firstTry++;
    flyToMonster(c);
    chomp();
    growMonster();
    pos++;
    if (pos < item.length) {
      // Next letter of the word.
      startLetter();
      renderTarget();
      speak((settings.echo ? [keyPart(c)] : []).concat(promptWords(false)));
      announce(written(c) + ". " + srPrompt());
      return;
    }
    // The letter or word is done.
    done++;
    renderTarget();
    lightTarget();
    busy = true;
    renderBelly();
    var yum = cfg.yums.length ? cfg.yums[Math.floor(Math.random() * cfg.yums.length)] : "";
    var msg;
    if (setup.mode === "words") {
      msg = [wordPart(item)];
      sfxWord();
      $("target-card").classList.add("is-done");
    } else {
      msg = (settings.echo ? [keyPart(c)] : []).concat(yum ? [yum] : []);
    }
    announce((setup.mode === "words" ? item + "." : (written(c) + ". " + yum).trim()));
    // Move on once the voice has finished AND a short pause has passed.
    var left = 2, gid = gameId;
    var go = function () {
      if (--left > 0 || gid !== gameId) return;
      $("target-card").classList.remove("is-done");
      busy = false;
      if (setup.turns && done >= setup.turns) { finish(); return; }
      if (!openPanel) nextTurn(false);
      else nextTurn(true);
    };
    speak(msg, go);
    setTimeout(go, setup.mode === "words" ? 1600 : 800);
  }
  function wrong(c) {
    wrongs++;
    practise[expected()] = true;
    sfxSoft();
    var b = keyEls[c];
    if (b && settings.animation) {
      b.classList.remove("is-wobble");
      void b.offsetWidth;
      b.classList.add("is-wobble");
    }
    var help = "";
    if (setup.hint === "wrong" && !helped) { helped = true; lightTarget(); }
    if (wrongs >= 3 && wrongs % 3 === 0) help = " " + whereIs(expected());
    speak((settings.echo ? [keyPart(c)] : []).concat([phrase("tryAgain")], promptWords(false), help ? [help] : []));
    announce((settings.echo ? "That was " + written(c) + ". " : "") + "Try again. " + srPrompt() + help);
  }
  function showWhere() {
    if (finished) return;
    helped = true;
    lightTarget();
    var t = whereIs(expected());
    speak(t);
    announce(t);
    var b = keyEls[expected()];
    if (b && settings.animation) {
      b.classList.remove("is-spot");
      void b.offsetWidth;
      b.classList.add("is-spot");
    }
  }

  /* ---------- The monster ---------- */
  var chompTimer = null;
  function chomp() {
    sfxChomp();
    clearTimeout(chompTimer);
    setTimeout(function () {
      monsterEl.src = cfg.monsterClosed;
      $("monster-box").classList.add("is-chomp");
      chompTimer = setTimeout(function () {
        monsterEl.src = cfg.monster;
  preloadClips(["find", "tryAgain", "type", "full"].map(function (k) { return cfg.recordings[k]; }).filter(Boolean));
  if (cfg.recordings.letters) preloadClips("abcdefghijklmnopqrstuvwxyz".split("").map(function (c) { return cfg.recordings.letters.replace("{key}", c); }));
        $("monster-box").classList.remove("is-chomp");
      }, 260);
    }, settings.animation ? 300 : 0);
  }
  function flyToMonster(c) {
    if (!settings.animation) return;
    var from = keyEls[c] || targetEl;
    var a = from.getBoundingClientRect();
    var m = monsterEl.getBoundingClientRect();
    if (!a.width || !m.width) return;
    var el = document.createElement("span");
    el.className = "flyer";
    el.setAttribute("aria-hidden", "true");
    el.textContent = c === " " ? "␣" : shown(c, false);
    el.style.left = (a.left + a.width / 2) + "px";
    el.style.top = (a.top + a.height / 2) + "px";
    document.body.appendChild(el);
    var dx = (m.left + m.width / 2) - (a.left + a.width / 2);
    var dy = (m.top + m.height * 0.52) - (a.top + a.height / 2);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.style.transform = "translate(-50%, -50%) translate(" + dx + "px, " + dy + "px) scale(0.3)";
        el.style.opacity = "0.2";
      });
    });
    setTimeout(function () { el.remove(); }, 450);
  }

  /* ---------- End of a game ---------- */
  function finish() {
    finished = true;
    lightTarget();
    sfxFull();
    var what = setup.mode === "letters" ? (done === 1 ? "letter" : "letters") : (done === 1 ? "word" : "words");
    $("done-desc").textContent = "You " + (setup.mode === "letters" ? "found " : "typed ") + done + " " + what + ".";
    $("done-first").textContent = firstTry + " of " + lettersDone + " keys on the first try.";
    var keys = Object.keys(practise);
    $("done-practise").hidden = !keys.length;
    $("done-practise").textContent = keys.length ? "Keys to practise: " + keys.map(written).join(", ") : "";
    $("win-monster").src = cfg.monster;
    speak([phrase("full")]);
    showPanel("panel-done", null, $("done-title"));
  }

  /* ---------- Typing from a real keyboard ---------- */
  function keyFromEvent(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return null;
    if (e.isComposing || !e.key || e.key.length !== 1) return null;
    return e.key;
  }
  document.addEventListener("keydown", function (e) {
    if (openPanel) return;
    var tag = (e.target && e.target.tagName) || "";
    if (e.target !== typeBox && (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA")) return;
    var k = keyFromEvent(e);
    if (!k) return;
    // Space and Enter on a button press that button (for switches and keyboards).
    if (k === " " && tag === "BUTTON") return;
    e.preventDefault();
    if (e.repeat) return; // holding a key down counts once
    press(k);
  });
  // Tablet keyboards and some Chromebook keyboards only send "input", not a usable key.
  typeBox.addEventListener("input", function () {
    var v = typeBox.value;
    typeBox.value = "";
    if (!v) return;
    press(v.charAt(v.length - 1));
  });
  function focusTypeBox() {
    try { typeBox.focus({ preventScroll: true }); } catch (e) { typeBox.focus(); }
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
    if (was === "panel-setup" && !silent) { applyDraft(); }
    openPanel.hidden = true;
    openPanel = null;
    $("app").removeAttribute("aria-hidden");
    if (silent) return;
    if (was === "panel-done") {
      newGame();
      startSpeech("New game. ");
      focusTypeBox();
      return;
    }
    if (returnFocus && returnFocus.focus && !returnFocus.closest("[hidden]")) returnFocus.focus();
    else focusTypeBox();
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
      var items = Array.prototype.filter.call(openPanel.querySelectorAll("button, input, select, textarea, [tabindex='0']"), function (el) {
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
    var lp = $("letter-presets");
    lp.innerHTML = "";
    cfg.letterSets.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "btn"; b.textContent = p.name;
      b.addEventListener("click", function () {
        $("set-keys").value = p.keys;
        draft.keys = cleanKeys(p.keys);
        updateLink();
        $("setup-live").textContent = p.name + ": " + draft.keys.split("").join(" ");
      });
      lp.appendChild(b);
    });
    var wp = $("word-presets");
    wp.innerHTML = "";
    cfg.wordLists.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "btn"; b.textContent = p.name;
      b.addEventListener("click", function () {
        $("set-words").value = p.words.join("\n");
        draft.words = cleanWords(p.words);
        updateLink();
        $("setup-live").textContent = p.name + ": " + listWords(draft.words);
      });
      wp.appendChild(b);
    });
    document.querySelectorAll('input[name="mode"]').forEach(function (r) { r.checked = r.value === draft.mode; });
    $("set-keys").value = draft.keys;
    $("set-words").value = draft.words.join("\n");
    $("set-turns").value = String(draft.turns);
    if (!$("set-turns").value) $("set-turns").value = "10";
    $("set-order").value = draft.order;
    $("set-case").value = draft.letterCase;
    $("set-keycase").value = draft.keyCase;
    $("set-hint").value = draft.hint;
    $("set-others").value = draft.others;
    $("set-wait").value = String(draft.wait);
    if (!$("set-wait").value) $("set-wait").value = "0";
    $("set-lock").checked = false;
    $("copied").textContent = "";
    showMode();
    updateLink();
    showPanel("panel-setup", e && e.currentTarget);
  }
  function showMode() {
    var letters = draft.mode === "letters";
    $("sec-letters").hidden = !letters;
    $("sec-words").hidden = letters;
    $("turns-label").textContent = letters ? "Letters in a game" : "Words in a game";
  }
  function updateLink() {
    if (!draft) return;
    var ok = setupOk(draft);
    $("share-link").value = ok ? linkFor(draft, $("set-lock").checked) : "";
    $("btn-setup-done").disabled = !ok;
    $("copied").textContent = "";
  }
  function applyDraft() {
    if (!draft || !setupOk(draft)) { draft = null; return; }
    var changed = JSON.stringify(draft) !== JSON.stringify(setup);
    setup = cleanSetup(draft);
    draft = null;
    saveSetup();
    if (changed) {
      try {
        if (/[?&]mode=/.test(location.search) && history.replaceState) {
          history.replaceState(null, "", location.pathname + (locked ? "?lock=1" : "") + location.hash);
        }
      } catch (e) { /* ignore */ }
      newGame();
      startSpeech("New game. ");
    }
  }
  document.querySelectorAll('input[name="mode"]').forEach(function (r) {
    r.addEventListener("change", function () { draft.mode = r.value; showMode(); updateLink(); });
  });
  $("set-keys").addEventListener("input", function (e) {
    draft.keys = cleanKeys(e.target.value);
    updateLink();
  });
  $("set-keys").addEventListener("change", function (e) {
    var k = cleanKeys(e.target.value);
    $("setup-live").textContent = k ? "Letters: " + k.split("").join(" ") : "Type at least one letter.";
  });
  $("set-words").addEventListener("input", function (e) { draft.words = cleanWords(e.target.value); updateLink(); });
  $("set-turns").addEventListener("change", function (e) { draft.turns = Number(e.target.value); updateLink(); });
  $("set-order").addEventListener("change", function (e) { draft.order = e.target.value; updateLink(); });
  $("set-case").addEventListener("change", function (e) { draft.letterCase = e.target.value; updateLink(); });
  $("set-keycase").addEventListener("change", function (e) { draft.keyCase = e.target.value; updateLink(); });
  $("set-hint").addEventListener("change", function (e) { draft.hint = e.target.value; updateLink(); });
  $("set-others").addEventListener("change", function (e) { draft.others = e.target.value; updateLink(); });
  $("set-wait").addEventListener("change", function (e) { draft.wait = Number(e.target.value); updateLink(); });
  $("set-lock").addEventListener("change", updateLink);
  $("btn-setup-done").addEventListener("click", function () {
    var before = JSON.stringify(setup);
    hidePanel();
    if (JSON.stringify(setup) === before) { newGame(); startSpeech("New game. "); }
    focusTypeBox();
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
      try { navigator.share({ title: "Monster Keys", url: $("share-link").value }).catch(function () {}); } catch (e) { /* ignore */ }
    });
  }

  /* ---------- Settings controls ---------- */
  function applySettings() {
    root.classList.toggle("hc", !!settings.highContrast);
    root.classList.toggle("no-motion", !settings.animation);
    typeBox.setAttribute("inputmode", settings.deviceKeyboard ? "text" : "none");
  }
  function bindSettings() {
    var voice = $("set-voice"), echo = $("set-echo"), sounds = $("set-sounds"), vol = $("set-volume"),
        anim = $("set-animation"), hc = $("set-contrast"), devkb = $("set-devkb");
    voice.checked = !!settings.voice;
    echo.checked = !!settings.echo;
    sounds.checked = !!settings.sounds;
    vol.value = settings.volume;
    vol.setAttribute("aria-valuetext", settings.volume + " percent");
    anim.checked = !!settings.animation;
    hc.checked = !!settings.highContrast;
    devkb.checked = !!settings.deviceKeyboard;
    voice.addEventListener("change", function () { settings.voice = voice.checked; saveSettings(); if (voice.checked) speak("Voice on."); });
    var rec = $("set-recorded");
    rec.checked = settings.recorded !== false;
    rec.addEventListener("change", function () { settings.recorded = rec.checked; saveSettings(); hush(); speak([phrase("find"), keyPart("t")]); });
    var vname = $("set-voice-name"), rate = $("set-rate");
    fillVoiceList();
    rate.value = String(settings.rate);
    if (!rate.value) rate.value = "0.8";
    var sample = function () { hush(); speak([phrase("find"), keyPart("t")]); };
    vname.addEventListener("change", function () { settings.voiceName = vname.value; saveSettings(); pickVoice(); sample(); });
    rate.addEventListener("change", function () { settings.rate = Number(rate.value); saveSettings(); sample(); });
    $("btn-hear").addEventListener("click", sample);
    echo.addEventListener("change", function () { settings.echo = echo.checked; saveSettings(); });
    sounds.addEventListener("change", function () { settings.sounds = sounds.checked; saveSettings(); sfxChomp(); });
    vol.addEventListener("input", function () {
      settings.volume = Number(vol.value);
      vol.setAttribute("aria-valuetext", vol.value + " percent");
      saveSettings();
    });
    vol.addEventListener("change", function () { sfxChomp(); speak("Volume " + vol.value + " percent."); });
    anim.addEventListener("change", function () { settings.animation = anim.checked; saveSettings(); applySettings(); });
    hc.addEventListener("change", function () { settings.highContrast = hc.checked; saveSettings(); applySettings(); });
    devkb.addEventListener("change", function () { settings.deviceKeyboard = devkb.checked; saveSettings(); applySettings(); });
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
    if (on && !wasOn) {
      focusTypeBox();
      announce("Full screen. To leave, use the Exit full screen button in the top corner.");
    } else if (!on && wasOn) {
      $("btn-fullscreen").focus();
    }
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
    var t = setup.mode === "letters"
      ? "Find the key that matches the letter and press it. "
      : "Type the word one letter at a time. ";
    t += "Use any finger, a pointer, or the big keys on the screen. Take your time. Every key you find feeds the monster. ";
    t += "If you get stuck, press Where is it?. ";
    return t;
  }
  function startSpeech(prefix) {
    speak(promptWords(true));
    announce((prefix || "") + srPrompt());
  }

  /* ---------- Start ---------- */
  monsterEl.src = cfg.monster;
  preloadClips(["find", "tryAgain", "type", "full"].map(function (k) { return cfg.recordings[k]; }).filter(Boolean));
  if (cfg.recordings.letters) preloadClips("abcdefghijklmnopqrstuvwxyz".split("").map(function (c) { return cfg.recordings.letters.replace("{key}", c); }));
  (new Image()).src = cfg.monsterClosed;
  applySettings();
  bindSettings();
  newGame();
  $("target-sr").textContent = srPrompt();
  setTimeout(focusTypeBox, 50);

  $("btn-new").addEventListener("click", function () { newGame(); startSpeech("New game. "); });
  $("btn-directions").addEventListener("click", function () {
    announce(directionsText() + srPrompt());
    speak([directionsText()].concat(promptWords(true)));
  });
  $("btn-hint").addEventListener("click", showWhere);
  $("btn-settings").addEventListener("click", function (e) { showPanel("panel-settings", e.currentTarget); });
  $("btn-setup").addEventListener("click", openSetup);
  $("btn-again").addEventListener("click", function () { hidePanel(); });
  // Tapping the big letter says it again.
  $("target-card").addEventListener("click", function () {
    if (finished || busy) return;
    speak(promptWords(true));
  });

  if (isStandalone()) { pseudoFs = true; updateFsButton(); fitStage(); }
  $("btn-fullscreen").addEventListener("click", toggleFullscreen);
  $("btn-exit-fs").addEventListener("click", toggleFullscreen);

  if (window.ResizeObserver) new ResizeObserver(fitStage).observe(stage);
  window.addEventListener("resize", fitStage);
  window.addEventListener("orientationchange", function () { setTimeout(fitStage, 200); });
})();
