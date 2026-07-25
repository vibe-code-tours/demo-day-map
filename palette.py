#!/usr/bin/env python3
"""Render a tileset PNG with GID numbers overlaid, so tiles can be picked by GID.
Usage: python3 palette.py <tileset-name-substr>  e.g. python3 palette.py Seats"""
import json, sys, os
from PIL import Image, ImageDraw, ImageFont
TS = 32
sub = sys.argv[1] if len(sys.argv) > 1 else "Room_Builder"
ts = json.load(open("_tilesets.json"))
t = next(x for x in ts if sub.lower() in x["image"].lower())
firstgid = t["firstgid"]
img = Image.open(t["image"]).convert("RGBA")
cols = img.width // TS
rows = img.height // TS
S = 2  # upscale for legibility
big = img.resize((img.width * S, img.height * S), Image.NEAREST).convert("RGBA")
d = ImageDraw.Draw(big)
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 11)
except Exception:
    font = ImageFont.load_default()
for r in range(rows):
    for c in range(cols):
        gid = firstgid + r * cols + c
        x, y = c * TS * S, r * TS * S
        d.rectangle([x, y, x + TS * S - 1, y + TS * S - 1], outline=(0, 0, 0, 120))
        d.text((x + 1, y + 1), str(gid), fill=(255, 255, 0, 255), font=font,
               stroke_width=1, stroke_fill=(0, 0, 0, 255))
out = f"palette-{os.path.basename(t['image']).replace('.png','')}.png"
big.convert("RGB").save(out)
print(f"wrote {out}  firstgid={firstgid} cols={cols} rows={rows} (gid range {firstgid}..{firstgid+cols*rows-1})")
