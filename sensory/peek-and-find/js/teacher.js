/*
 * Peek and Find: teachers choose their own cover, reveal and surprise pictures.
 * Pictures stay on this device (browser storage) and are never uploaded.
 * The background remover is shared with the Sensory Room (../js/pictures.js).
 */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var cfg = window.GAME_CONFIG;
  var tools = window.SensoryPictures && window.SensoryPictures.tools;
  if (!cfg || !window.PeekFind || !tools) { var b = $("btn-pictures"); if (b) b.hidden = true; return; }

  var SLOTS = [
    { key: "coverImage", name: "Cover", help: "What every square shows at the start." },
    { key: "revealImage", name: "Underneath", help: "What most squares show when they open." },
    { key: "specialImage", name: "Surprise", help: "Hidden under one square. It moves every new game." }
  ];
  // The built-in pictures, so "Use built-in" can put them back.
  var builtIn = {};
  SLOTS.forEach(function (s) { builtIn[s.key] = { src: cfg[s.key].src, alt: cfg[s.key].alt }; });

  /* ---------- Storage ---------- */
  var dbP = null;
  function db() {
    if (dbP) return dbP;
    dbP = new Promise(function (ok, bad) {
      if (!window.indexedDB) { bad(new Error("no storage")); return; }
      var r = indexedDB.open("peek-and-find", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("slots", { keyPath: "key" }); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { bad(r.error); };
    });
    return dbP;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (ok, bad) {
        var t = d.transaction("slots", mode), req = fn(t.objectStore("slots")), out;
        if (req) req.onsuccess = function () { out = req.result; };
        t.oncomplete = function () { ok(out); };
        t.onerror = function () { bad(t.error); };
      });
    });
  }
  var records = {}; // key -> { key, original, cut, useCut, alt }
  function load() {
    return tx("readonly", function (s) { return s.getAll(); }).then(function (all) {
      records = {};
      (all || []).forEach(function (r) { records[r.key] = r; });
    }).catch(function () { records = {}; });
  }
  function save(r) { return tx("readwrite", function (s) { return s.put(r); }); }
  function drop(key) { return tx("readwrite", function (s) { return s.delete(key); }); }

  /* ---------- Put the pictures into the game ---------- */
  var urls = {};
  function apply() {
    SLOTS.forEach(function (s) {
      if (urls[s.key]) { URL.revokeObjectURL(urls[s.key]); urls[s.key] = null; }
      var r = records[s.key];
      if (r) {
        urls[s.key] = URL.createObjectURL(r.useCut && r.cut ? r.cut : r.original);
        cfg[s.key].src = urls[s.key];
        cfg[s.key].alt = r.alt || s.name;
      } else {
        cfg[s.key].src = builtIn[s.key].src;
        cfg[s.key].alt = builtIn[s.key].alt;
      }
    });
    window.PeekFind.refreshPictures();
  }

  /* ---------- Panel ---------- */
  function say(t) { var el = $("pics-status"); el.textContent = ""; setTimeout(function () { el.textContent = t; }, 50); }
  function button(text, fn, primary) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "btn btn-small" + (primary ? " btn-primary" : ""); b.textContent = text;
    b.addEventListener("click", fn);
    return b;
  }
  var picking = null;
  function render() {
    var list = $("slots");
    list.innerHTML = "";
    SLOTS.forEach(function (s) {
      var r = records[s.key];
      var li = document.createElement("li");
      li.className = "slot";
      var img = document.createElement("img");
      img.className = "slot-thumb checker";
      img.alt = "";
      img.src = cfg[s.key].src;
      var body = document.createElement("div");
      body.className = "slot-body";
      var h = document.createElement("h3");
      h.textContent = s.name + (r ? "" : " (built-in)");
      var p = document.createElement("p");
      p.className = "help"; p.textContent = s.help;
      body.appendChild(h); body.appendChild(p);
      if (r) {
        var lab = document.createElement("label");
        lab.className = "slot-name";
        lab.textContent = "Name read aloud ";
        var inp = document.createElement("input");
        inp.type = "text"; inp.value = r.alt || ""; inp.placeholder = s.name; inp.maxLength = 40;
        inp.addEventListener("change", function () { r.alt = inp.value.trim(); save(r).then(apply); });
        lab.appendChild(inp);
        body.appendChild(lab);
      }
      var row = document.createElement("div");
      row.className = "row";
      row.appendChild(button("Choose picture", function () { picking = s; $("pics-input").value = ""; $("pics-input").click(); }, true));
      if (r) {
        row.appendChild(button("Remove background", function () { openEditor(s.key); }));
        if (r.cut) row.appendChild(button(r.useCut ? "Undo: show original" : "Use cut-out again", function () {
          r.useCut = !r.useCut;
          save(r).then(function () { apply(); render(); say(r.useCut ? "Using the cut-out." : "Back to the original picture."); });
        }));
        row.appendChild(button("Use built-in", function () {
          drop(s.key).then(load).then(function () { apply(); render(); say(s.name + ": back to the built-in picture."); });
        }));
      }
      body.appendChild(row);
      li.appendChild(img); li.appendChild(body);
      list.appendChild(li);
    });
  }
  $("pics-input").addEventListener("change", function () {
    var f = $("pics-input").files && $("pics-input").files[0], s = picking;
    if (!f || !s) return;
    say("Adding the picture...");
    tools.normalise(f).then(function (blob) {
      var r = { key: s.key, original: blob, cut: null, useCut: false, alt: (records[s.key] && records[s.key].alt) || "" };
      return save(r);
    }).then(load).then(function () { apply(); render(); say(s.name + " picture added."); })
      .catch(function () { say("That file could not be opened as a picture."); });
  });

  /* ---------- Background remover editor ---------- */
  var editing = null, editImg = null, preview = null, mode = "plain";
  function openEditor(key) {
    editing = records[key];
    $("pics-main").hidden = true;
    $("pics-editor").hidden = false;
    tools.blobToImage(editing.original).then(function (img) { editImg = img; setMode("plain"); $("edit-title").focus(); });
  }
  function closeEditor() {
    editing = editImg = preview = null;
    $("pics-editor").hidden = true;
    $("pics-main").hidden = false;
  }
  function show(c) {
    preview = c;
    c.className = "checker";
    c.setAttribute("role", "img");
    c.setAttribute("aria-label", "Preview of the picture with its background removed");
    $("edit-preview").innerHTML = "";
    $("edit-preview").appendChild(c);
    $("btn-edit-keep").disabled = false;
  }
  function setMode(m) {
    mode = m;
    $("edit-mode-plain").setAttribute("aria-pressed", m === "plain");
    $("edit-mode-ai").setAttribute("aria-pressed", m === "ai");
    $("edit-plain-opts").hidden = m !== "plain";
    $("edit-ai-note").hidden = m !== "ai";
    $("btn-edit-keep").disabled = true;
    if (!editImg) return;
    if (m === "plain") { show(tools.removePlain(editImg, parseInt($("edit-strength").value, 10))); return; }
    var img = editImg;
    $("edit-preview").innerHTML = '<p class="edit-wait">Working on it. The first time, this downloads the remover (about 15 MB) and can take a minute.</p>';
    say("Removing the background. This can take a minute the first time.");
    tools.removeBusy(img).then(function (c) {
      if (editImg === img && mode === "ai") { show(c); say("Done. Check the preview, then choose Keep this or Cancel."); }
    }).catch(function () {
      if (editImg !== img) return;
      $("edit-preview").innerHTML = '<p class="edit-wait">Sorry, the background remover could not run here. Check the internet connection and try again, or use Plain background.</p>';
    });
  }
  $("edit-mode-plain").addEventListener("click", function () { setMode("plain"); });
  $("edit-mode-ai").addEventListener("click", function () { setMode("ai"); });
  var t = null;
  $("edit-strength").addEventListener("input", function () {
    clearTimeout(t);
    t = setTimeout(function () { if (mode === "plain" && editImg) show(tools.removePlain(editImg, parseInt($("edit-strength").value, 10))); }, 120);
  });
  $("btn-edit-cancel").addEventListener("click", function () { closeEditor(); render(); });
  $("btn-edit-keep").addEventListener("click", function () {
    if (!editing || !preview) return;
    var r = editing;
    tools.canvasToBlob(preview).then(function (blob) { r.cut = blob; r.useCut = true; return save(r); })
      .then(load).then(function () { closeEditor(); apply(); render(); say("Background removed. You can undo this any time."); });
  });
  // Typing a name should not press squares on the board.
  $("panel-pictures").addEventListener("keydown", function (e) { if (e.key !== "Escape" && e.key !== "Tab") e.stopPropagation(); });

  $("btn-pictures").addEventListener("click", function (e) {
    closeEditor();
    render();
    window.PeekFind.showPanel("panel-pictures", e.currentTarget);
  });

  load().then(function () { if (Object.keys(records).length) apply(); });
})();
