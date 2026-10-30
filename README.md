# CANEX · Find Your Way

Interactive 3D wayfinding for CANEX 2026 at the Wole Soyinka Centre for Culture and Creative Arts.
Built with Next.js 16, React Three Fiber and drei.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # data, search and routing tests (incl. every start/destination pair)
npm run build && npm start
```

## What it does

- A 3D (or top-down 2D) model of every floor, traced from the V24 power-layout plans: the architecture as a backdrop, with each booth extruded from its real footprint.
- Floor switcher, plus an exploded view of the whole building.
- Search across ~145 places on six levels, with floor and category filters.
- Turn-by-turn walking directions: shortest path along the concourse, through wing doors and up the nearest lifts, with left/right turns, landmarks passed, distance and time, drawn as an animated route.
- "Nearest toilets" and "Nearest food & drink" from wherever you are.
- Search understands booth codes (E21, HM05), names, and everyday words like "restroom" or "coffee". Enter goes to the top match.
- Three map colours (exhibition, food & drink, hubs/stages/lounges), validated as colour-blind safe as a set; gates and toilets are neutral and always labelled. Labels pick white or dark ink by contrast.
- Directions still work if a device can't show the 3D map.
- Tap any booth on the map to route to it.
- Shareable deep links: `/?from=gate-a&to=e21`. A QR code at each gate linking to `/?from=gate-a` pre-sets the start point.

## Where the data lives

| What | Where |
|---|---|
| Names, codes, categories, notes | `src/lib/venue.ts` |
| Booth footprints (metres) | `src/data/footprints.json`, generated |
| Floor backdrops | `public/plans/floor-*.webp`, generated |
| Walking graph and directions | `src/lib/routing.ts` |
| Extraction from the PDF | `tools/plan-extract/` (see its README) |

Coordinates are metres from the centre of the building: x towards Gate C, y towards Gate D.

## Known gaps

- **Mezzanine:** the event guide lists booths CC01–CC20, but the V24 plans have no mezzanine sheet. The app sends people to the lifts with a note.
- **Outdoor:** the Basketball Court and Food Hub aren't on the floor plans. Their positions outside Gates A and B are approximate.
- **Upper-floor corridors:** these are modelled as a ring just inside the lift lobbies. Routes prefer walking the ground concourse and taking the lifts nearest the destination.
- **Master Class:** both rooms on the Fourth floor are labelled "Master Class B" on the plan. The southern one is listed as C, following the event guide.
- **Draft plans:** the V24 drawings are marked draft. Re-run the extraction when the final plans arrive.
