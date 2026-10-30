# usage: zoom.py page x0 y0 x1 y1 out.png scale  (metres) - re-renders the PDF region at high scale
import sys, subprocess, os
sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0])))
from cal import CAL
root = os.environ.get("PLAN_WORK", ".plan-work")
here = os.path.dirname(os.path.abspath(sys.argv[0]))
page = int(sys.argv[1]); x0, y0, x1, y1 = map(float, sys.argv[2:6]); out = sys.argv[6]; scale = sys.argv[7]
cx, cy, mpp = CAL[page]
X0, X1 = cx + x0 / mpp, cx + x1 / mpp
Y0, Y1 = cy + y0 / mpp, cy + y1 / mpp
W, H = X1 - X0, Y1 - Y0
subprocess.run(["swift", f"{here}/raw.swift", f"{root}/pdf/layout.pdf", str(page), out, scale,
                str(W), str(H), str(-X0), str(-(1684 - Y1))], check=True, capture_output=True)
print(out)
