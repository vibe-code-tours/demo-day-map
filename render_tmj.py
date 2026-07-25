#!/usr/bin/env python3
"""Composite a Tiled .tmj (tile layers + tilesets) to a PNG so the map can be seen.
Usage: python3 render_tmj.py [map.tmj] [out.png] [--scale N] [--objects]"""
import json, sys, os
from PIL import Image, ImageDraw

FLIP_H, FLIP_V, FLIP_D = 0x80000000, 0x40000000, 0x20000000
IDMASK = 0x1FFFFFFF
TS = 32

def load_tilesets(mapdir, tilesets):
    out = []
    for t in tilesets:
        img = Image.open(os.path.join(mapdir, t["image"])).convert("RGBA")
        cols = img.width // TS
        out.append((t["firstgid"], cols, img))
    out.sort(key=lambda r: r[0])
    return out

def tile_for(gid, sets):
    raw = gid
    gid = raw & IDMASK
    if gid == 0:
        return None
    chosen = None
    for firstgid, cols, img in sets:
        if firstgid <= gid:
            chosen = (firstgid, cols, img)
    if not chosen:
        return None
    firstgid, cols, img = chosen
    local = gid - firstgid
    sx, sy = (local % cols) * TS, (local // cols) * TS
    tile = img.crop((sx, sy, sx + TS, sy + TS))
    if raw & FLIP_D:
        tile = tile.transpose(Image.TRANSPOSE)
    if raw & FLIP_H:
        tile = tile.transpose(Image.FLIP_LEFT_RIGHT)
    if raw & FLIP_V:
        tile = tile.transpose(Image.FLIP_TOP_BOTTOM)
    return tile

def iter_tilelayers(layers):
    for L in layers:
        if L["type"] == "tilelayer":
            yield L
        elif L["type"] == "group":
            yield from iter_tilelayers(L["layers"])

def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "demo-day.tmj"
    out = sys.argv[2] if len(sys.argv) > 2 else src.replace(".tmj", "-render.png")
    scale = 1
    if "--scale" in sys.argv:
        scale = int(sys.argv[sys.argv.index("--scale") + 1])
    show_obj = "--objects" in sys.argv
    mapdir = os.path.dirname(os.path.abspath(src))
    m = json.load(open(src))
    W, H = m["width"], m["height"]
    sets = load_tilesets(mapdir, m["tilesets"])
    canvas = Image.new("RGBA", (W * TS, H * TS), (20, 30, 48, 255))
    for L in iter_tilelayers(m["layers"]):
        if not L.get("visible", True):
            continue
        data = L["data"]
        for i, gid in enumerate(data):
            if not gid:
                continue
            t = tile_for(gid, sets)
            if t is None:
                continue
            x, y = (i % W) * TS, (i // W) * TS
            canvas.alpha_composite(t, (x, y))
    # tile-objects (objects carrying a gid, e.g. logos): anchored bottom-left, scaled to w/h
    for L in m["layers"]:
        if L["type"] == "objectgroup":
            for o in L.get("objects", []):
                if o.get("gid"):
                    t = tile_for(o["gid"], sets)
                    if t is None:
                        continue
                    w, h = int(o.get("width", TS)), int(o.get("height", TS))
                    t = t.resize((w, h), Image.NEAREST)
                    canvas.alpha_composite(t, (int(o["x"]), int(o["y"]) - h))
    if show_obj:
        d = ImageDraw.Draw(canvas)
        for L in m["layers"]:
            if L["type"] == "objectgroup":
                for o in L.get("objects", []):
                    if o.get("width") and not o.get("gid"):
                        d.rectangle([o["x"], o["y"], o["x"] + o["width"], o["y"] + o["height"]],
                                    outline=(56, 189, 248, 200), width=1)
    if scale != 1:
        canvas = canvas.resize((canvas.width * scale, canvas.height * scale), Image.NEAREST)
    canvas.convert("RGB").save(out)
    print(f"wrote {out} ({canvas.width}x{canvas.height})")

if __name__ == "__main__":
    main()
