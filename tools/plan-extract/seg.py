# Detect colour-filled booths/rooms on each floor plan and export footprints
# in building metres (origin centre, x east, y south).
import sys, json, numpy as np, cv2
sys.path.insert(0, sys.argv[0].rsplit("/", 1)[0])
from cal import CAL
S = 3.0
root = sys.argv[1]; pages = [int(p) for p in sys.argv[2].split(",")]
res = {}
for page in pages:
    cx, cy, mpp = CAL[page]
    bgr = cv2.imread(f"{root}/hi/page{page}.png")
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    H, Sat, V = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    h, w = H.shape
    yy, xx = np.mgrid[0:h, 0:w]
    rm = np.hypot((xx / S - cx) * mpp, (yy / S - cy) * mpp)
    inside = (rm < 90) & (xx / S < 2080)
    colored = (Sat > 45) & (V > 110) & inside
    yellow_label = (H >= 22) & (H <= 34) & (Sat > 90) & (V > 235)
    magenta = (H >= 140) & (H <= 165) & (Sat > 150) & (V > 200)
    red_line = ((H <= 6) | (H >= 174)) & (Sat >= 150)
    classes = {
        "tan": (H >= 10) & (H <= 22) & (Sat < 140),
        "green": (H >= 45) & (H <= 80),
        "blue": (H >= 95) & (H <= 125),
        "purple": (H >= 125) & (H <= 175) & ~magenta,
        "olive": (H >= 22) & (H <= 40) & ~yellow_label & (V < 235),
        "orange": (H >= 8) & (H <= 22) & (Sat >= 140),
        "salmon": ((H <= 8) | (H >= 172)) & (Sat >= 70) & (Sat < 150) & (V > 200),
    }
    if page == 5:
        # Yellow LB booths share the label colour; keep only the booth ring.
        classes["yellow"] = (H >= 22) & (H <= 34) & (V > 200) & (rm > 25) & (rm < 46)
    out = []
    for name, m in classes.items():
        m = (m & colored & (~red_line if name != "salmon" else True)).astype(np.uint8)
        k = 9 if name == "tan" else 3
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((k, k), np.uint8))
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in cnts:
            area = cv2.contourArea(c) / (S * S) * mpp * mpp
            if area < 1.2:
                continue
            eps = 0.35 / mpp * S
            poly = cv2.approxPolyDP(c, eps, True)[:, 0, :]
            pm = [[round((x / S - cx) * mpp, 2), round((y / S - cy) * mpp, 2)] for x, y in poly]
            M = cv2.moments(c)
            ctr = [round((M["m10"] / M["m00"] / S - cx) * mpp, 2), round((M["m01"] / M["m00"] / S - cy) * mpp, 2)]
            (rx, ry), (rw, rh), ang = cv2.minAreaRect(c)
            out.append({"cls": name, "area": round(area, 1), "c": ctr, "poly": pm,
                        "rect": [round(rw / S * mpp, 2), round(rh / S * mpp, 2), round(ang, 1)]})
    out.sort(key=lambda o: (round(np.degrees(np.arctan2(o["c"][0], -o["c"][1])) % 360), o["area"]))
    for i, o in enumerate(out):
        o["id"] = f"{page}-{i}"
    res[page] = out
    print(f"page {page}: {len(out)} shapes")
json.dump(res, open(f"{root}/plan/shapes.json", "w"), indent=0)
