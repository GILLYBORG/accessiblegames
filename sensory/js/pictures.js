/*
 * My pictures: a teacher adds their own pictures from the device.
 * - Pictures are kept on this device only (in the browser's storage). Nothing is uploaded.
 * - The file picker on a Chromebook or iPad can also open Google Drive.
 * - Optional background remover, also on the device:
 *     "Plain background": instant, for pictures on a plain colour (like most Canva exports).
 *     "Busy photo": a small AI model (U-2-Net small, Apache 2.0) run with ONNX Runtime Web (MIT).
 *       Downloads about 15 MB the first time. Results on busy photos may not be perfect.
 */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var MAX_SIDE = 640;
  var ORT_VERSION = "1.20.1";
  var ORT_BASE = "https://cdn.jsdelivr.net/npm/onnxruntime-web@" + ORT_VERSION + "/dist/";
  // The model sits next to this script's folder, so other pages (like Peek and Find) can use it too.
  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || location.href;
  var MODEL_URL = new URL("../models/u2netp.onnx", SCRIPT_SRC).href;

  /* ---------- Storage (IndexedDB) ---------- */
  var dbPromise = null;
  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (ok, bad) {
      if (!window.indexedDB) { bad(new Error("no storage")); return; }
      var req = indexedDB.open("sensory-room", 1);
      req.onupgradeneeded = function () { req.result.createObjectStore("pictures", { keyPath: "id", autoIncrement: true }); };
      req.onsuccess = function () { ok(req.result); };
      req.onerror = function () { bad(req.error); };
    });
    return dbPromise;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (ok, bad) {
        var t = d.transaction("pictures", mode), store = t.objectStore("pictures"), out;
        var r = fn(store);
        if (r) r.onsuccess = function () { out = r.result; };
        t.oncomplete = function () { ok(out); };
        t.onerror = function () { bad(t.error); };
      });
    });
  }
  function getAll() { return tx("readonly", function (s) { return s.getAll(); }).then(function (r) { return r || []; }); }
  function put(rec) { return tx("readwrite", function (s) { return s.put(rec); }); }
  function remove(id) { return tx("readwrite", function (s) { return s.delete(id); }); }

  /* ---------- Images ---------- */
  function blobToImage(blob) {
    return new Promise(function (ok, bad) {
      var img = new Image();
      var url = URL.createObjectURL(blob);
      img.onload = function () { ok(img); };
      img.onerror = function () { URL.revokeObjectURL(url); bad(new Error("not a picture")); };
      img.src = url;
    });
  }
  function canvasToBlob(c) {
    return new Promise(function (ok) {
      if (c.toBlob) c.toBlob(ok, "image/png");
      else { var d = atob(c.toDataURL("image/png").split(",")[1]), a = new Uint8Array(d.length);
             for (var i = 0; i < d.length; i++) a[i] = d.charCodeAt(i); ok(new Blob([a], { type: "image/png" })); }
    });
  }
  // Shrink big photos so they are quick to draw and small to store.
  function normalise(file) {
    return blobToImage(file).then(function (img) {
      var k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      var c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      return canvasToBlob(c);
    });
  }
  function imageData(img) {
    var c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    var g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    return { canvas: c, g: g, data: g.getImageData(0, 0, c.width, c.height) };
  }
  // Trim see-through edges so the picture fills its bubble or flower.
  function trim(c) {
    var g = c.getContext("2d"), d = g.getImageData(0, 0, c.width, c.height).data;
    var x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (var y = 0; y < c.height; y++) for (var x = 0; x < c.width; x++) {
      if (d[(y * c.width + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return c;
    var pad = 4, w = x1 - x0 + 1 + pad * 2, h = y1 - y0 + 1 + pad * 2;
    var out = document.createElement("canvas");
    out.width = w; out.height = h;
    out.getContext("2d").drawImage(c, x0 - pad, y0 - pad, w, h, 0, 0, w, h);
    return out;
  }

  /* ---------- Background remover 1: plain background (instant) ---------- */
  // Starts at the edges and clears every connected pixel close to the edge colour.
  function removePlain(img, strength) {
    var im = imageData(img), w = im.canvas.width, h = im.canvas.height, d = im.data.data;
    var tol = 18 + strength * 0.9; // strength 0-100
    var seen = new Uint8Array(w * h), queue = new Int32Array(w * h), seed = new Int32Array(w * h);
    var head = 0, tail = 0;
    function push(i, s) { if (!seen[i]) { seen[i] = 1; seed[i] = s; queue[tail++] = i; } }
    for (var x = 0; x < w; x++) { push(x, x); push((h - 1) * w + x, (h - 1) * w + x); }
    for (var y = 0; y < h; y++) { push(y * w, y * w); push(y * w + w - 1, y * w + w - 1); }
    while (head < tail) {
      var i = queue[head++], s = seed[i] * 4, p = i * 4;
      if (d[p + 3] < 10) { d[p + 3] = 0; } else {
        var dr = d[p] - d[s], dg = d[p + 1] - d[s + 1], db = d[p + 2] - d[s + 2];
        var dist = Math.sqrt(dr * dr + dg * dg + db * db);
        if (dist > tol) continue; // part of the picture: stop here
        // Soft edge: nearly-matching pixels fade instead of vanishing.
        var a = dist < tol * 0.6 ? 0 : (dist - tol * 0.6) / (tol * 0.4);
        d[p + 3] = Math.round(d[p + 3] * a);
      }
      var px = i % w;
      if (px > 0) push(i - 1, seed[i]);
      if (px < w - 1) push(i + 1, seed[i]);
      if (i >= w) push(i - w, seed[i]);
      if (i < w * (h - 1)) push(i + w, seed[i]);
    }
    im.g.putImageData(im.data, 0, 0);
    return trim(im.canvas);
  }

  /* ---------- Background remover 2: busy photo (AI, on the device) ---------- */
  var sessionPromise = null;
  function loadScript(src) {
    return new Promise(function (ok, bad) {
      var s = document.createElement("script");
      s.src = src; s.crossOrigin = "anonymous";
      s.onload = ok; s.onerror = function () { bad(new Error("Could not download the background remover.")); };
      document.head.appendChild(s);
    });
  }
  function aiSession() {
    if (sessionPromise) return sessionPromise;
    sessionPromise = (window.ort ? Promise.resolve() : loadScript(ORT_BASE + "ort.wasm.min.js")).then(function () {
      var ort = window.ort;
      ort.env.wasm.wasmPaths = ORT_BASE;
      ort.env.wasm.numThreads = 1; // works without special server headers (GitHub Pages)
      return ort.InferenceSession.create(MODEL_URL, { executionProviders: ["wasm"] });
    });
    sessionPromise.catch(function () { sessionPromise = null; });
    return sessionPromise;
  }
  function removeBusy(img) {
    return aiSession().then(function (session) {
      var ort = window.ort, S = 320;
      var c = document.createElement("canvas");
      c.width = c.height = S;
      var g = c.getContext("2d");
      g.drawImage(img, 0, 0, S, S);
      var px = g.getImageData(0, 0, S, S).data, input = new Float32Array(3 * S * S);
      var mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
      for (var i = 0; i < S * S; i++) {
        for (var ch = 0; ch < 3; ch++) input[ch * S * S + i] = (px[i * 4 + ch] / 255 - mean[ch]) / std[ch];
      }
      var feeds = {};
      feeds[session.inputNames[0]] = new ort.Tensor("float32", input, [1, 3, S, S]);
      return session.run(feeds).then(function (out) {
        var mask = out[session.outputNames[0]].data, lo = Infinity, hi = -Infinity;
        for (i = 0; i < mask.length; i++) { if (mask[i] < lo) lo = mask[i]; if (mask[i] > hi) hi = mask[i]; }
        // Turn the mask into a see-through layer and stretch it to the picture's size.
        var m = document.createElement("canvas");
        m.width = m.height = S;
        var mg = m.getContext("2d"), md = mg.createImageData(S, S);
        for (i = 0; i < S * S; i++) {
          var v = (mask[i] - lo) / (hi - lo || 1);
          v = Math.max(0, Math.min(1, (v - 0.15) / 0.7)); // firmer edges
          md.data[i * 4 + 3] = Math.round(v * 255);
        }
        mg.putImageData(md, 0, 0);
        var im = imageData(img);
        im.g.globalCompositeOperation = "destination-in";
        im.g.imageSmoothingEnabled = true;
        im.g.drawImage(m, 0, 0, im.canvas.width, im.canvas.height);
        return trim(im.canvas);
      });
    });
  }

  /* ---------- The "My pictures" panel ---------- */
  var records = [], images = [], onChange = function () {}, settingsRef = null, save = function () {};
  var editing = null, editImg = null, previewCanvas = null, mode = "plain";

  function refreshImages() {
    images.forEach(function (im) { try { URL.revokeObjectURL(im.src); } catch (e) { /* ignore */ } });
    images = [];
    return Promise.all(records.map(function (r) {
      return blobToImage(r.useCut && r.cut ? r.cut : r.original).catch(function () { return null; });
    })).then(function (list) {
      images = list.filter(Boolean);
      onChange();
    });
  }
  function load() {
    return getAll().then(function (r) { records = r; return refreshImages(); }).catch(function () { records = []; });
  }

  function say(text) { var s = $("pics-status"); s.textContent = ""; setTimeout(function () { s.textContent = text; }, 50); }

  function renderList() {
    var list = $("pics-list");
    list.innerHTML = "";
    $("pics-empty").hidden = records.length > 0;
    records.forEach(function (r, n) {
      var li = document.createElement("li");
      li.className = "pic";
      var thumb = document.createElement("img");
      thumb.className = "pic-thumb checker";
      thumb.alt = "Picture " + (n + 1) + (r.useCut && r.cut ? ", background removed" : "");
      blobToImage(r.useCut && r.cut ? r.cut : r.original).then(function (im) { thumb.src = im.src; });
      var actions = document.createElement("div");
      actions.className = "pic-actions";
      var bg = button("Remove background", function () { openEditor(r); });
      actions.appendChild(bg);
      if (r.cut) {
        actions.appendChild(button(r.useCut ? "Undo: show original" : "Use cut-out again", function () {
          r.useCut = !r.useCut;
          put(r).then(function () { renderList(); refreshImages(); say(r.useCut ? "Using the cut-out." : "Back to the original picture."); });
        }));
      }
      actions.appendChild(button("Delete", function () {
        remove(r.id).then(load).then(function () { renderList(); say("Picture deleted."); $("btn-add-pics").focus(); });
      }));
      li.appendChild(thumb);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }
  function button(text, fn) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "btn btn-small"; b.textContent = text;
    b.addEventListener("click", fn);
    return b;
  }

  function addFiles(files) {
    var list = Array.prototype.slice.call(files || []).filter(function (f) { return /^image\//.test(f.type) || /\.(png|jpe?g|gif|webp|heic)$/i.test(f.name); });
    if (!list.length) return;
    say("Adding " + list.length + (list.length === 1 ? " picture..." : " pictures..."));
    var added = 0;
    list.reduce(function (p, f) {
      return p.then(function () {
        return normalise(f).then(function (blob) {
          added++;
          return put({ original: blob, cut: null, useCut: false, added: Date.now() });
        }).catch(function () { /* skip files the browser cannot open */ });
      });
    }, Promise.resolve()).then(load).then(function () {
      renderList();
      if (settingsRef) { settingsRef.useMine = true; $("set-use-mine").checked = true; save(); }
      say(added ? "Added " + added + (added === 1 ? " picture." : " pictures.") : "That file could not be opened as a picture.");
    });
  }

  /* Editor: preview the cut-out on a checkerboard, then keep or cancel. */
  function openEditor(r) {
    editing = r;
    $("pics-main").hidden = true;
    $("pics-editor").hidden = false;
    blobToImage(r.original).then(function (img) {
      editImg = img;
      setMode("plain");
      $("edit-title").focus();
    });
  }
  function closeEditor() {
    editing = null; editImg = null; previewCanvas = null;
    $("pics-editor").hidden = true;
    $("pics-main").hidden = false;
  }
  function showPreview(c) {
    previewCanvas = c;
    var box = $("edit-preview");
    box.innerHTML = "";
    c.className = "checker";
    c.setAttribute("role", "img");
    c.setAttribute("aria-label", "Preview of the picture with its background removed");
    box.appendChild(c);
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
    if (m === "plain") {
      showPreview(removePlain(editImg, parseInt($("edit-strength").value, 10)));
    } else {
      $("edit-preview").innerHTML = '<p class="edit-wait">Working on it. The first time, this downloads the remover (about 15 MB) and can take a minute.</p>';
      say("Removing the background. This can take a minute the first time.");
      var img = editImg;
      removeBusy(img).then(function (c) {
        if (editImg !== img || mode !== "ai") return;
        showPreview(c);
        say("Done. Check the preview, then choose Keep this or Cancel.");
      }).catch(function (err) {
        if (editImg !== img) return;
        $("edit-preview").innerHTML = '<p class="edit-wait">Sorry, the background remover could not run here. Check the internet connection and try again, or use Plain background.</p>';
        say("The background remover could not run.");
      });
    }
  }

  window.SensoryPictures = {
    // Shared tools for other pages: shrink a file, and the two background removers.
    tools: { normalise: normalise, blobToImage: blobToImage, canvasToBlob: canvasToBlob, removePlain: removePlain, removeBusy: removeBusy },
    images: function () { return images; },
    init: function (opts) {
      onChange = opts.onChange || onChange;
      settingsRef = opts.settings;
      save = opts.save || save;
      var input = $("pics-input"), use = $("set-use-mine");
      use.checked = settingsRef.useMine !== false;
      use.addEventListener("change", function () { settingsRef.useMine = use.checked; save(); onChange(); });
      $("btn-add-pics").addEventListener("click", function () { input.value = ""; input.click(); });
      input.addEventListener("change", function () { addFiles(input.files); });
      $("edit-mode-plain").addEventListener("click", function () { setMode("plain"); });
      $("edit-mode-ai").addEventListener("click", function () { setMode("ai"); });
      var t = null;
      $("edit-strength").addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(function () { if (mode === "plain" && editImg) showPreview(removePlain(editImg, parseInt($("edit-strength").value, 10))); }, 120);
      });
      $("btn-edit-cancel").addEventListener("click", function () { closeEditor(); renderList(); });
      $("btn-edit-keep").addEventListener("click", function () {
        if (!editing || !previewCanvas) return;
        var r = editing;
        canvasToBlob(previewCanvas).then(function (blob) {
          r.cut = blob; r.useCut = true;
          return put(r);
        }).then(load).then(function () {
          closeEditor(); renderList();
          say("Background removed. You can undo this any time.");
        });
      });
      return load().then(renderList);
    },
    opened: function () { closeEditor(); renderList(); },
    canEdit: function () { return !!editing; },
    cancelEdit: function () { closeEditor(); renderList(); }
  };
})();
