# Builds the app's footprint data and floor-plan backdrops from the segmented
# PDF (see README.md for the full pipeline).
#
# usage: PLAN_WORK=.plan-work python build.py <repo root>
#
# Footprints are matched to detected shapes by position (`near`), so re-running
# segmentation on a revised plan keeps the mapping as long as booths don't move
# more than MATCH_RADIUS metres.
import json, math, os, sys
import numpy as np, cv2
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cal import CAL

Image.MAX_IMAGE_PIXELS = None
WORK = os.environ.get("PLAN_WORK", ".plan-work")
REPO = sys.argv[1]
S = 3.0
MATCH_RADIUS = 2.0
PAGE = {"G": 1, "2": 2, "3": 3, "4": 4, "5": 5}

shapes = {int(k): v for k, v in json.load(open(f"{WORK}/plan/shapes.json")).items()}


def near(floor, x, y):
    page = PAGE[floor]
    best = min(shapes[page], key=lambda s: math.hypot(s["c"][0] - x, s["c"][1] - y))
    d = math.hypot(best["c"][0] - x, best["c"][1] - y)
    if d > MATCH_RADIUS:
        raise SystemExit(f"no shape near {floor} ({x}, {y}); closest {best['id']} at {d:.1f} m")
    return best


def poly_of(s):
    return [[round(p[0], 2), round(p[1], 2)] for p in s["poly"]]


def rect(cx, cy, w, h, rot=None):
    """Rectangle w (tangential) x h (radial). rot in degrees, default tangent to the ring."""
    if rot is None:
        rot = math.degrees(math.atan2(cy, cx)) + 90
    t = math.radians(rot)
    ux, uy = math.cos(t), math.sin(t)
    vx, vy = -uy, ux
    pts = []
    for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        pts.append([round(cx + sx * w / 2 * ux + sy * h / 2 * vx, 2), round(cy + sx * w / 2 * uy + sy * h / 2 * vy, 2)])
    return pts


def sector(a0, a1, r0, r1, step=3):
    """Annular sector; angles clockwise from north (Gate B)."""
    n = max(2, int(abs(a1 - a0) / step) + 1)
    pt = lambda a, r: [round(r * math.sin(math.radians(a)), 2), round(-r * math.cos(math.radians(a)), 2)]
    outer = [pt(a0 + (a1 - a0) * i / (n - 1), r1) for i in range(n)]
    inner = [pt(a1 - (a1 - a0) * i / (n - 1), r0) for i in range(n)]
    return outer + inner


def split(s, fractions, index):
    """Split a detected shape's bounding rectangle along its long axis."""
    pts = np.array(s["poly"], dtype=np.float32)
    (cx, cy), (w, h), ang = cv2.minAreaRect(pts)
    t = math.radians(ang)
    ax = (math.cos(t), math.sin(t)) if w >= h else (-math.sin(t), math.cos(t))
    L, Wd = max(w, h), min(w, h)
    start = -L / 2 + sum(fractions[:index]) * L
    seg = fractions[index] * L
    mid = start + seg / 2
    rot = math.degrees(math.atan2(ax[1], ax[0]))
    return rect(cx + ax[0] * mid, cy + ax[1] * mid, seg, Wd, rot)


def seed(floor, x, y, light=True, tol=30):
    """Flood-fill a region of similar colour (e.g. an outline-only room)."""
    page = PAGE[floor]
    cx, cy, mpp = CAL[page]
    img = cv2.imread(f"{WORK}/hi/page{page}.png")
    px, py = int((cx + x / mpp) * S), int((cy + y / mpp) * S)
    mask = np.zeros((img.shape[0] + 2, img.shape[1] + 2), np.uint8)
    cv2.floodFill(img.copy(), mask, (px, py), (0, 0, 0), (tol,) * 3, (tol,) * 3, cv2.FLOODFILL_MASK_ONLY | cv2.FLOODFILL_FIXED_RANGE | (255 << 8) | 8)
    m = mask[1:-1, 1:-1]
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    c = max(cnts, key=cv2.contourArea)
    poly = cv2.approxPolyDP(c, 0.35 / mpp * S, True)[:, 0, :]
    area = cv2.contourArea(c) / (S * S) * mpp * mpp
    print(f"  seed {floor} ({x},{y}) -> {area:.0f} m2")
    return [[round((u / S - cx) * mpp, 2), round((v / S - cy) * mpp, 2)] for u, v in poly]


N = lambda f, x, y: [poly_of(near(f, x, y))]

# footprint id -> list of polygons (metres; x east, y south)
FP = {
    # ---------- Ground floor ----------
    "e07": N("G", 17.4, -55.2), "e08": N("G", -17.9, -55.5),
    "ex01": N("G", 34.2, -68.1), "ex02": N("G", 44.7, -66.7), "ex03": N("G", 58.4, -53.5),
    "ex06": N("G", 45.3, -47.6), "ex04": N("G", 58.5, -31.6), "ex05": N("G", 71.9, -32.6),
    "e06": N("G", 31.6, -48.6), "e05": N("G", 36.6, -45.4), "e04": N("G", 41.0, -41.1),
    "e03": N("G", 45.0, -36.7), "e02": N("G", 48.4, -31.8), "e01": N("G", 51.1, -27.1),
    "e27": N("G", 57.0, 11.2), "e26": N("G", 55.8, 15.6), "e25": N("G", 53.5, 23.9),
    "e24": N("G", 47.0, 34.1), "e23": N("G", 33.9, 46.4), "e22": N("G", 16.3, 55.5),
    "e21": N("G", -17.1, 55.1), "e20": N("G", -31.6, 48.5), "e19": N("G", -36.4, 45.0),
    "e18": N("G", -40.8, 41.1), "e17": N("G", -44.7, 36.9), "e16": N("G", -48.3, 32.0), "e15": N("G", -51.5, 27.0),
    "ex07": N("G", -68.6, -32.3), "ex08": N("G", -61.1, -47.8), "ex09": N("G", -49.7, -37.8),
    "e14": N("G", -51.1, -27.3), "e13": N("G", -48.8, -32.2), "e12": N("G", -44.9, -36.6),
    "e11": N("G", -41.0, -41.1), "e10": N("G", -36.9, -45.3), "e09": N("G", -31.6, -48.6),
    "innovation-hub": N("G", -44.2, -48.1),
    "fashion-booths": N("G", -55.1, -56.2) + N("G", -50.2, -59.6) + N("G", -48.5, -60.8),
    "thread-of-nation": N("G", -41.8, -58.9) + N("G", -30.1, -64.9),
    "panel-discussion": [rect(-39.8, -70.5, 10, 9, -36)],
    "networking": [rect(-33.5, -60.5, 7, 7, -36)],
    "sport-hub": [sector(108, 120, 61, 87)],
    "film-hub": [sector(120, 132, 61, 87)],
    "live-theatre": [sector(132, 153, 62, 87)],
    "canex-programming": [sector(205, 251, 62, 87)],
    "cinema-bar": [rect(46, 19, 4, 6)],
    "conference-bar": [rect(-53.9, 13.8, 8, 5)],
    "bar-ex2": [rect(-46.6, -20.5, 7, 4)],
    "bar-ex1": [rect(47.9, -20.6, 7, 4)],
    # ---------- Second floor ----------
    "meera-state": N("2", -1.3, 32.3),
    "podcast": N("2", 24.1, 40.7),
    "afrexim-offices": N("2", 40.9, 36.6),
    "soup-kitchen": None,  # filled below (dark fill the segmenter skips)
    # ---------- Third floor ----------
    "lounges-3": N("3", 0.5, -34.5),
    "ministerial-vip": [sector(253, 312, 30, 42)],
    "ministerial-meeting": [sector(312, 324, 30, 42)],
    # ---------- Fourth floor ----------
    "writing-workshop": N("4", 41.5, -37.8), "master-class-b": N("4", 43.9, -19.6), "master-class-c": N("4", 43.6, 19.0),
    "studio-music-hub": N("4", 47.5, -0.2), "offices-4": N("4", 57.1, -0.2), "vip-dining": N("4", -53.4, -1.0),
    "sedc": N("4", -1.4, 35.3), "world-bank": N("4", -12.7, 32.7),
    "neptunes-female": N("4", -24.4, 32.9), "kene-rafu": N("4", -27.0, 30.6), "tiffany-amber": N("4", -30.7, 26.3),
    "amce": N("4", -25.2, 18.5), "pwc": N("4", -36.7, 17.3), "spoof": N("4", -39.1, 9.9), "kwara-grment": N("4", -39.5, 5.4),
    "afrix": N("4", -39.9, -0.9), "abia": N("4", -39.1, -8.6), "nepc": N("4", -37.1, -16.7),
    "nuit": N("4", -25.7, -33.3), "fashion-law-academy": N("4", -27.9, -31.5), "mashakara": N("4", -30.0, -29.4),
    "beauty-b": N("4", -32.2, -26.9), "nancy-hanson": N("4", -25.5, -28.8), "niaga": N("4", -27.5, -26.9),
    "woven-africa": N("4", -29.4, -24.8), "aga-culture": N("4", -23.2, -26.2), "ounje-and-co": N("4", -25.2, -24.2),
    "beauty-in-the-motherland": [sector(326, 372, 31.5, 39.3)],
    # ---------- Fifth floor ----------
    "hm01": N("5", -34.1, -21.3), "hm02": N("5", -35.3, -19.1), "hm03": N("5", -36.5, -16.8), "hm04": N("5", -37.4, -14.4),
    "hm05": N("5", -38.2, -11.9), "hm06": N("5", -38.9, -9.5), "hm07": N("5", -39.5, -6.1), "hm08": N("5", -39.9, -3.6),
    "hm09": N("5", -40.0, -1.1), "fb01": N("5", -39.2, 4.3), "fb02": N("5", -39.2, 8.6),
    "lb01": N("5", -29.5, -27.5), "lb02": N("5", -27.2, -29.8), "lb03": N("5", -25.3, -31.4), "lb04": N("5", -23.2, -33.0),
    "lb05": N("5", -25.7, -17.9), "lb06": N("5", -24.3, -20.0), "lb07": N("5", -22.6, -22.2), "lb08": N("5", -20.8, -24.0),
    "tb02": N("5", -11.8, -30.4), "tb03": N("5", -14.7, -29.1), "tb04": N("5", -17.4, -27.5),
    "ab02": N("5", -0.6, -33.2), "ab03": N("5", 4.8, -32.8),
    "tb01": [split(near("5", -6.3, -32.6), [0.4, 0.6], 0)],
    "ab01": [split(near("5", -6.3, -32.6), [0.4, 0.6], 1)],
    "art-exhibition": sum((N("5", x, y) for x, y in [
        (-36.6, 16.8), (-31.9, 25.4), (-29.6, 28.1), (-26.9, 30.6), (-24.4, 32.6), (-22.3, 34.1), (-20.2, 35.4),
        (-17.1, 26.8), (-14.9, 28.1), (-12.7, 29.4), (-10.3, 30.4), (-7.8, 31.2), (-5.3, 31.7)]), []),
    "reading-corner": [rect(27.5, -30.0, 8, 6)],
}
FP["soup-kitchen"] = [seed("2", -27.5, 38.5, tol=40)]  # off-centre: the label box sits in the middle
FP["executive-marketplace"] = sum((FP[k] for k in ["hm01", "hm02", "hm03", "hm04", "hm05", "hm06", "hm07", "hm08", "hm09"]), [])
FP["literature-booths"] = sum((FP[f"lb0{i}"] for i in range(1, 9)), [])

# Toilet blocks (WC fixtures drawn on the plan) and lift/stair cores.
for f in ["G", "4", "5"]:
    for k, (x, y) in enumerate([(32, -37), (32, 36), (-33, 37), (-31, -36)]):
        FP[f"wc-{f}-{k}"] = [rect(x, y, 8, 5)]

os.makedirs(f"{REPO}/src/data", exist_ok=True)
json.dump(FP, open(f"{REPO}/src/data/footprints.json", "w"), separators=(",", ":"))
print(f"wrote {len(FP)} footprints")

# ---------- floor-plan backdrops ----------
# Greyscale line work with alpha, so it reads as a subtle architectural layer.
HALF = 92  # metres either side of the centre
os.makedirs(f"{REPO}/public/plans", exist_ok=True)
for floor, page in PAGE.items():
    cx, cy, mpp = CAL[page]
    im = Image.open(f"{WORK}/hi/page{page}.png").convert("RGB")
    x0, y0 = (cx - HALF / mpp) * S, (cy - HALF / mpp) * S
    x1, y1 = (cx + HALF / mpp) * S, (cy + HALF / mpp) * S
    c = np.asarray(im.crop((int(x0), int(y0), int(x1), int(y1))).resize((2048, 2048), Image.LANCZOS)).astype(np.float32)
    lum = c.mean(axis=2)
    sat = c.max(axis=2) - c.min(axis=2)
    alpha = np.clip((255 - lum) * 1.6, 0, 255)
    # Booth and label fills are drawn in 3D instead; keep only the line work.
    alpha = np.where(sat > 40, alpha * 0.12, alpha).astype(np.uint8)
    # Mask to the building disc so the title block and legend don't show.
    yy, xx = np.mgrid[0:2048, 0:2048]
    rr = np.hypot(xx - 1023.5, yy - 1023.5) / 1024 * HALF
    alpha[rr > 90] = 0
    rgba = np.dstack([np.full_like(alpha, 40), np.full_like(alpha, 52), np.full_like(alpha, 48), alpha])
    Image.fromarray(rgba).save(f"{REPO}/public/plans/floor-{floor}.webp", "WEBP", quality=82, method=6)
    print(f"  backdrop floor-{floor}.webp")
