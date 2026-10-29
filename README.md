# CANEX · Find Your Way

Interactive 3D wayfinding for CANEX at the Wole Soyinka Centre for Culture and Creative Arts.
Built with Next.js 16, React Three Fiber and drei.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## What it does

- 3D (and top-down 2D) map of the ground floor ring: every booth, hall, stage and gate from venue plan V24.1.
- Search across all 128 places on every floor, with floor and category filters.
- Step-by-step walking directions along the circular concourse (shorter direction, left/right turns, landmarks passed, rough distance and time), with an animated route on the map.
- Upper floors are shown as stacked levels. Routes go via the stairs/lifts.
- Tap any booth on the map to route to it.
- Shareable deep links: `/?from=gate-a&to=e21`. Print a QR code at each gate that links to `/?from=gate-a` and the visitor's start point is already set.

## Editing the venue

All venue data lives in `src/lib/venue.ts`.

- **Ground-floor positions** are polar: `angle` in degrees clockwise from Gate B (top of the plan), `r` in map units from the centre. Booths use `shape: { a0, a1, r0, r1 }` (an arc of the ring).
- **Upper floors** list their occupants but have no layout yet, because the plan only provides lists. Add `shape`s once floor plans are available.
- **Stairs & lifts** (`id: "core"`) are a placeholder by the main entrance. The plan doesn't show them. Update its `anchor` once confirmed.

Routing lives in `src/lib/routing.ts`. `METERS_PER_UNIT` converts map units to metres. The plan is not to scale, so calibrate it by pacing out one known distance on site.

## Known gaps in the source plan

- EX09 Africa Union is listed in Exhibition 2 but not drawn. It routes to the middle of Exhibition 2 with a note.
- Hosted Buyers, Press and Sponsor lounges sit under "Mezzanine, Second & Third" without a floor. They're filed under Third with a note.
- Names marked `*` on the plan keep the source spelling.
