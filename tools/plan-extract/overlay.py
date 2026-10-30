# usage: overlay.py page x0 y0 x1 y1 out.png [maxpx]
import sys, json
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, sys.argv[0].rsplit("/", 1)[0])
from cal import CAL
Image.MAX_IMAGE_PIXELS = None
S = 3.0
import os
root = os.environ.get("PLAN_WORK", ".plan-work")
page = int(sys.argv[1]); x0, y0, x1, y1 = map(float, sys.argv[2:6]); out = sys.argv[6]
maxpx = int(sys.argv[7]) if len(sys.argv) > 7 else 1600
cx, cy, mpp = CAL[page]
im = Image.open(f"{root}/hi/page{page}.png").convert("RGB")
px = lambda mx, my: ((cx + mx / mpp) * S, (cy + my / mpp) * S)
a, b = px(x0, y0), px(x1, y1)
c = im.crop((int(a[0]), int(a[1]), int(b[0]), int(b[1])))
k = min(1.0, maxpx / max(c.size)); c = c.resize((int(c.size[0] * k), int(c.size[1] * k)), Image.LANCZOS)
ppm = c.size[0] / (x1 - x0)
t = lambda p: ((p[0] - x0) * ppm, (p[1] - y0) * ppm)
d = ImageDraw.Draw(c, "RGBA")
f = ImageFont.load_default(size=15)
for s in json.load(open(f"{root}/plan/shapes.json"))[str(page)]:
    if not (x0 - 5 < s["c"][0] < x1 + 5 and y0 - 5 < s["c"][1] < y1 + 5):
        continue
    pts = [t(p) for p in s["poly"]]
    d.polygon(pts, outline=(255, 0, 0, 255), width=2)
    lx, ly = t(s["c"])
    tag = s["id"].split("-")[1]
    d.rectangle([lx - 12, ly - 9, lx + 12, ly + 9], fill=(0, 0, 0, 200))
    d.text((lx - 10, ly - 8), tag, fill=(255, 255, 0, 255), font=f)
c.save(out); print(out, c.size)
