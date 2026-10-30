# Plan extraction

Turns the CANEX power-layout PDF into the app's footprint data
(`src/data/footprints.json`) and floor backdrops (`public/plans/floor-*.webp`).

The PDF's text layer is unusable (AutoCAD export with broken font maps), so
booths are found by their fill colours and names are matched to the detected
shapes by position, in `build.py`.

## Requirements

- macOS (renders the PDF with PDFKit via `swift`)
- Python 3 with `pillow numpy scipy opencv-python-headless`

```bash
python3 -m venv .plan-work/venv
.plan-work/venv/bin/pip install pillow numpy scipy opencv-python-headless
```

## Pipeline

```bash
export PLAN_WORK=.plan-work
mkdir -p $PLAN_WORK/pdf $PLAN_WORK/hi $PLAN_WORK/plan
cp "path/to/CANEX - V24 - POWER LAYOUT.pdf" $PLAN_WORK/pdf/layout.pdf

# 1. Render each sheet at 3x (2384x1684 pt landscape; page 2 is stored portrait
#    but drawn landscape, so render raw rather than with the page rotation).
for i in 1 2 3 4 5; do
  swift tools/plan-extract/raw.swift $PLAN_WORK/pdf/layout.pdf $i $PLAN_WORK/hi/page$i.png 3 2384 1684 0 0
done

# 2. Detect colour-filled booths and rooms.
$PLAN_WORK/venv/bin/python tools/plan-extract/seg.py $PLAN_WORK 1,2,3,4,5

# 3. Check detections visually (ids, outlines) for any region, in metres.
$PLAN_WORK/venv/bin/python tools/plan-extract/overlay.py 1 -85 -82 0 -12 /tmp/nw.png
# Re-render a region at high resolution to read small labels.
$PLAN_WORK/venv/bin/python tools/plan-extract/zoom.py 4 -44 -42 -14 -10 /tmp/zoom.png 10

# 4. Write footprints.json and the backdrops.
$PLAN_WORK/venv/bin/python tools/plan-extract/build.py .
```

## Calibration

`cal.py` holds, per sheet, the building centre in PDF points and metres per
point. The centre comes from the symmetry of the six lift cars (identical on
every floor); the scale from rooms with printed areas (Soup Kitchen and
Podcast 72 m², Innovation Hub 72 m², Afreximbank Pavilion 400 m²). Sheet 2 is
drawn about 1.8% smaller than the others.

Plan coordinates are metres from the centre: x towards Gate C, y towards Gate D.

## When the plan changes

1. Re-run steps 1–2.
2. `build.py` matches each footprint to the nearest detected shape within 2 m
   and stops with an error naming any booth it can't find. Moved booths need
   their coordinates updated there; new booths need an entry there and in
   `src/lib/venue.ts`.
3. `npm test` checks every footprint against the areas printed on the plan.
