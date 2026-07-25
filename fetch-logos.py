#!/usr/bin/env python3
"""Build a 64x64 logo atlas (logo-atlas.png) for the WA map, one tile per team.
Per team: try the live site's og:image / icon link / favicon.ico; validate it's a real
image; else render a clean colored team-number badge (also serves as booth signage)."""
import json, os, io, re, colorsys, urllib.parse, urllib.request
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
teams = json.load(open(os.path.join(HERE, "../vibe-code-tours-site/src/data/teams.json")))
teams.sort(key=lambda t: t["team_no"])
CELL, COLS = 64, 5
ROWS = (len(teams) + COLS - 1) // COLS
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) vct-demoday/1.0"}
def font(sz):
    try: return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", sz)
    except Exception: return ImageFont.load_default()

def get(url, timeout=12):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(), r.headers.get("Content-Type", "")

def as_icon(data):
    """Return a 64x64 RGBA if data is a real, non-trivial image, else None."""
    try:
        im = Image.open(io.BytesIO(data)).convert("RGBA")
    except Exception:
        return None
    if min(im.size) < 16 or im.getbbox() is None:
        return None
    return im.resize((CELL, CELL), Image.LANCZOS)

def find_logo(live):
    origin = f"{urllib.parse.urlparse(live).scheme or 'https'}://{urllib.parse.urlparse(live).netloc}"
    try:
        html, _ = get(live)
        html = html.decode("utf-8", "ignore")
    except Exception:
        html = ""
    cands = []
    m = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', html, re.I)
    if m: cands.append(m.group(1))
    for m in re.finditer(r'<link[^>]+rel=["\'][^"\']*icon[^"\']*["\'][^>]+href=["\']([^"\']+)', html, re.I):
        cands.append(m.group(1))
    cands += ["/apple-touch-icon.png", "/favicon.png", "/favicon.ico"]
    for c in cands:
        url = c if c.startswith("http") else urllib.parse.urljoin(origin + "/", c)
        try:
            data, _ = get(url)
            ic = as_icon(data)
            if ic: return ic, url
        except Exception:
            continue
    return None, None

def badge(t):
    n = t["team_no"]
    h = (n * 0.61803398875) % 1.0            # golden-ratio hue spread → distinct colors
    r, g, b = [int(x * 255) for x in colorsys.hls_to_rgb(h, 0.42, 0.72)]
    im = Image.new("RGBA", (CELL, CELL), (r, g, b, 255))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, CELL - 1, CELL - 1], outline=(255, 255, 255, 230), width=2)
    s = str(n)
    fw = font(34); w = d.textlength(s, font=fw)
    d.text(((CELL - w) / 2, 8), s, fill="white", font=fw)
    d.text((6, CELL - 16), "TEAM", fill=(255, 255, 255, 220), font=font(11))
    return im

atlas = Image.new("RGBA", (COLS * CELL, ROWS * CELL), (0, 0, 0, 0))
manifest = []
for i, t in enumerate(teams):
    live = t.get("live_url")
    icon, src = (None, None)
    if live:
        try: icon, src = find_logo(live)
        except Exception: icon = None
    if icon is not None:
        card = Image.new("RGBA", (CELL, CELL), (255, 255, 255, 240))
        card.alpha_composite(icon); tile = card; kind = f"logo:{src}"
    else:
        tile = badge(t); kind = "badge"
    atlas.alpha_composite(tile, ((i % COLS) * CELL, (i // COLS) * CELL))
    manifest.append({"team_no": t["team_no"], "tile": i, "kind": kind})
    print(f"T{t['team_no']:02d} tile{i:2d}  {kind}")

atlas.save(os.path.join(HERE, "logo-atlas.png"))
json.dump({"cell": CELL, "cols": COLS, "rows": ROWS, "teams": manifest},
          open(os.path.join(HERE, "logo-atlas.json"), "w"), indent=1)
real = sum(1 for m in manifest if m["kind"].startswith("logo"))
print(f"\nwrote logo-atlas.png ({COLS*CELL}x{ROWS*CELL}) — {real} real logos, {len(manifest)-real} badges")
