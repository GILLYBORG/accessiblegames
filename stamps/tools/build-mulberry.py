#!/usr/bin/env python3
"""Copy the Mulberry Symbols into stamps/symbols/mulberry/ and build index.json.

Usage: python3 build-mulberry.py <mulberry-symbols checkout> [<folder of svgo-minified EN svgs>]

Source: https://github.com/mulberrysymbols/mulberry-symbols (CC BY-SA, Steve Lee).
Symbols marked "rated" (adult body parts) are left out.
File names are made web-safe (lower case, a-z 0-9 _ -).
"""
import csv, json, os, re, shutil, sys

src = sys.argv[1]
svgdir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(src, "EN")
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, "..", "symbols", "mulberry")
if os.path.isdir(out):
    shutil.rmtree(out)
os.makedirs(out)

def slug(name):
    s = name.lower()
    if "_,_to" in s:  # verbs, e.g. "close_,_to" -> "to_close"
        s = "to_" + s.replace("_,_to", "")
    s = re.sub(r"[^a-z0-9_-]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s

def label(name):
    s = name.replace("_,_to", "").replace("_", " ")
    s = re.sub(r"\s+", " ", s).strip(" ,")
    s = re.sub(r" (\d+[a-z]?|[a-z]?\d+)$", "", s)  # "baker 2a" -> "baker"
    return s

rows = list(csv.DictReader(open(os.path.join(src, "scripts", "data", "symbol-info.csv"), encoding="utf-8")))
cats, items, seen = [], [], set()
for r in rows:
    if r["rated"] != "0":
        continue
    sid = slug(r["symbol-en"])
    if sid in seen:
        raise SystemExit("duplicate slug " + sid)
    seen.add(sid)
    shutil.copyfile(os.path.join(svgdir, r["symbol-en"] + ".svg"), os.path.join(out, sid + ".svg"))
    cat = r["category-en"].strip()
    if cat not in cats:
        cats.append(cat)
    items.append([sid, label(r["symbol-en"]), cats.index(cat), r["tags"].strip()])

with open(os.path.join(out, "index.json"), "w", encoding="utf-8") as f:
    json.dump({"categories": cats, "symbols": items}, f, separators=(",", ":"))
shutil.copyfile(os.path.join(src, "LICENSE.txt"), os.path.join(out, "LICENSE.txt"))
print(len(items), "symbols,", len(cats), "categories")
