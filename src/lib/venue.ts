// Venue data for CANEX 2026 at the Wole Soyinka Centre for Culture and Creative Arts.
//
// Source: "CANEX - V24 - Power Layout" master floor plans (DWTC-GF.1 to GF.5,
// rev 24, 20 Oct 2026). Footprints in `src/data/footprints.json` are extracted
// from the PDF by `tools/plan-extract`; this file holds names and metadata.
//
// Coordinates are metres on the plan: origin at the centre of the building,
// x towards Gate C (east), y towards Gate D (south). Gate B is north.

import footprintData from "@/data/footprints.json";

export type Vec2 = [number, number];
export type Polygon = Vec2[];

export type Category = "exhibition" | "food" | "venue" | "amenity" | "entrance";

// Three hues carry identity on the map (validated colour-blind safe as a set,
// all pairs); toilets and gates are neutral and always labelled.
export const CATEGORIES: Record<Category, { label: string; color: string }> = {
  exhibition: { label: "Exhibition booths", color: "#1baf7a" },
  food: { label: "Food & drink", color: "#eb6834" },
  venue: { label: "Hubs, stages & lounges", color: "#2a78d6" },
  amenity: { label: "Toilets", color: "#c9d2ce" },
  entrance: { label: "Entrances", color: "#2f3b37" },
};

export type FloorId = "G" | "M" | "2" | "3" | "4" | "5";

export interface Floor {
  id: FloorId;
  name: string;
  short: string;
  /** Position in the stack, used for the 3D view. */
  level: number;
  /** Finished floor level from the plans, in mm. */
  elevation?: number;
  /** Backdrop image traced from the plan. */
  plan?: string;
}

export const FLOORS: Floor[] = [
  { id: "G", name: "Ground floor", short: "G", level: 0, elevation: 0, plan: "/plans/floor-G.webp" },
  { id: "M", name: "Mezzanine", short: "M", level: 1 },
  { id: "2", name: "Second floor", short: "2", level: 2, elevation: 3150, plan: "/plans/floor-2.webp" },
  { id: "3", name: "Third floor", short: "3", level: 3, elevation: 4950, plan: "/plans/floor-3.webp" },
  { id: "4", name: "Fourth floor", short: "4", level: 4, elevation: 6750, plan: "/plans/floor-4.webp" },
  { id: "5", name: "Fifth floor", short: "5", level: 5, elevation: 8550, plan: "/plans/floor-5.webp" },
];

export const floorById = (id: FloorId) => FLOORS.find((f) => f.id === id)!;

export interface Place {
  id: string;
  code?: string;
  name: string;
  category: Category;
  floor: FloorId;
  zone?: string;
  note?: string;
  /** Floor area from the plan, m². */
  area?: number;
  /** Footprint key in footprints.json; defaults to `id`. */
  fp?: string;
  /** Position for places without a footprint (or a pin inside a shared one). */
  point?: Vec2;
  /** Inside another place (a booth in a block); highlights use the parent. */
  within?: string;
  /** Reached through this gate (outdoor places). */
  via?: string;
  /** Not offered as a destination. */
  hidden?: boolean;
  /** A zone made of other places' booths (highlights its members, draws nothing itself). */
  composite?: boolean;
}

const FOOTPRINTS = footprintData as unknown as Record<string, Polygon[]>;

// Building rings, metres from the centre.
export const RING = {
  /** Ground-floor concourse walking line. */
  concourse: 54.5,
  /** Wing walls: anything further out is inside an exhibition wing. */
  wingWall: 61,
  /** Upper-floor corridor walking line, just inside the lift lobbies. */
  upper: 43,
  /** Building edge at the gates. */
  gate: 70,
  outer: 88,
};

/** Angle in degrees clockwise from north (Gate B) of a plan point. */
export const bearing = ([x, y]: Vec2) => ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360;
export const radius = ([x, y]: Vec2) => Math.hypot(x, y);
export const fromPolar = (angle: number, r: number): Vec2 => [r * Math.sin((angle * Math.PI) / 180), -r * Math.cos((angle * Math.PI) / 180)];

const spelling = "Spelling as on the venue plan.";
const ex1 = "Exhibition 1 · between Gates B and C";
const ex2 = "Exhibition 2 · between Gates A and B";
const conC = "Concourse · between Gates C and D";
const conD = "Concourse · between Gates D and A";
const conB = "Concourse · by Gate B";
const unnamed = "Name not supplied";

type P = Omit<Place, "floor" | "category"> & Partial<Pick<Place, "category">>;
const on = (floor: FloorId, category: Category, items: P[]): Place[] => items.map((p) => ({ category, floor, ...p }));

const ground: Place[] = [
  // Gates
  ...on("G", "entrance", [{ id: "gate-a", code: "Gate A", name: "VIP Entrance", point: fromPolar(270, RING.gate) }]),
  ...on("G", "entrance", [{ id: "gate-b", code: "Gate B", name: "Food Hub Exit", point: fromPolar(0, RING.gate) }]),
  ...on("G", "entrance", [{ id: "gate-c", code: "Gate C", name: "Medical Entrance", point: fromPolar(90, RING.gate) }]),
  ...on("G", "entrance", [{ id: "gate-d", code: "Gate D", name: "Main Entrance · Accreditation & Registration", point: fromPolar(180, RING.gate) }]),

  // Outdoor (not drawn on the floor plans; positions approximate)
  ...on("G", "food", [{ id: "food-hub", name: "Food Hub", zone: "Outside, at the Gate B exit", via: "gate-b", point: [22, -102], note: "Outside the building. Position is approximate." }]),
  ...on("G", "venue", [
    { id: "basketball-court", name: "Basketball Court", zone: "Outside VIP Entrance A", via: "gate-a", point: [-108, 16], note: "Outside the building, separate from the Basketball Africa booth in Exhibition 1." },
  ]),

  // Concourse by Gate B
  ...on("G", "exhibition", [
    { id: "e07", code: "E07", name: "Fidelity", zone: conB, area: 36 },
    { id: "e08", code: "E08", name: "Zenith Bank", zone: conB, area: 36 },
  ]),

  // Exhibition 1
  ...on("G", "exhibition", [
    { id: "ex01", code: "EX01", name: "Afrique Femme", zone: ex1, area: 108 },
    { id: "ex02", code: "EX02", name: "Basketball Africa", zone: ex1, area: 90 },
    { id: "ex06", code: "EX06", name: "Lagos State", zone: ex1, area: 234 },
    { id: "ex04", code: "EX04", name: "FMITI", zone: ex1, area: 100 },
    { id: "ex05", code: "EX05", name: "Nigeria Host Country", zone: ex1, area: 232 },
    { id: "e06", code: "E06", name: "Cambridge", zone: ex1 },
    { id: "e05", code: "E05", name: "Cardinal Torch", zone: ex1 },
    { id: "e04", code: "E04", name: "EU Global Gateway", zone: ex1 },
    { id: "e03", code: "E03", name: "Bet9ja / Value Jet", zone: ex1 },
    { id: "e02", code: "E02", name: unnamed, zone: ex1 },
    { id: "e01", code: "E01", name: "iDICE", zone: ex1 },
  ]),
  ...on("G", "venue", [{ id: "ex03", code: "EX03", name: "Presidential Suite", zone: ex1, area: 288 }]),

  // Exhibition 2
  ...on("G", "exhibition", [
    { id: "ex07", code: "EX07", name: "Afreximbank Pavilion", zone: ex2, area: 400 },
    { id: "ex08", code: "EX08", name: "African Continental Free Trade Area (AfCFTA)", zone: ex2, area: 200 },
    { id: "ex09", code: "EX09", name: "Africa Union", zone: ex2, area: 12 },
    { id: "innovation-hub", name: "Innovation Hub", zone: ex2, area: 72 },
    { id: "fashion-booths", name: "Fashion Booths", zone: ex2, note: "11 booths, FA01–FA11." },
    { id: "thread-of-nation", code: "LF01–LF10", name: "Thread of Nation booths", zone: ex2, note: "10 booths in two rows." },
    { id: "networking", name: "Networking Area", zone: ex2 },
    { id: "e14", code: "E14", name: "IATF Sales", zone: ex2 },
    { id: "e13", code: "E13", name: "PAPS", zone: ex2 },
    { id: "e12", code: "E12", name: "NBS Malawi", zone: ex2 },
    { id: "e10", code: "E10", name: "FDH Holding", zone: ex2 },
    { id: "e09", code: "E09", name: "Oak Wood Capital", zone: ex2 },
  ]),
  ...on("G", "food", [{ id: "e11", code: "E11", name: "Hands Down Coffee", zone: ex2 }]),
  ...on("G", "venue", [{ id: "panel-discussion", name: "Panel Discussion Stage", zone: ex2, note: "Stage with LED screen, seats 52." }]),

  // Hubs between C and D
  ...on("G", "venue", [
    { id: "sport-hub", name: "Sport Hub", zone: "Hubs · between Gates C and D", note: "Has its own stage." },
    { id: "film-hub", name: "Film Hub", zone: "Hubs · between Gates C and D", note: "Has its own stage." },
    { id: "live-theatre", name: "Live Theater", zone: "Hubs · between Gates C and D", note: "Has its own stage." },
    { id: "canex-programming", name: "CANEX Programming Events", zone: "Between Gates D and A" },
  ]),
  ...on("G", "exhibition", [
    { id: "e27", code: "E27", name: unnamed, zone: conC },
    { id: "e26", code: "E26", name: "Arise", zone: conC },
    { id: "e25", code: "E25", name: "ITC Fashion", zone: conC },
    { id: "e24", code: "E24", name: "ITC", zone: conC },
    { id: "e23", code: "E23", name: "National Revenue Service", zone: conC },
    { id: "e22", code: "E22", name: "Flatter Wave", zone: conC, note: spelling },
    { id: "e21", code: "E21", name: "British Council", zone: conD },
    { id: "e20", code: "E20", name: "Heych", zone: conD },
    { id: "e19", code: "E19", name: "Media Craft Africa", zone: conD },
    { id: "e18", code: "E18", name: "Yutee Rone", zone: conD },
    { id: "e17", code: "E17", name: "Development Bank of Nigeria", zone: conD },
    { id: "e16", code: "E16", name: "Ojude Aso", zone: conD },
    { id: "e15", code: "E15", name: unnamed, zone: conD },
  ]),

  // Bars
  ...on("G", "food", [
    { id: "cinema-bar", name: "Cinema Bar", zone: "Concourse · by the Sport Hub" },
    { id: "conference-bar", name: "Conference Banquet Hall Bar", zone: "By Gate A" },
    { id: "bar-ex2", name: "Exhibition Hall Bar (Exhibition 2 side)", zone: "Concourse · between Gates A and B" },
    { id: "bar-ex1", name: "Exhibition Hall Bar (Exhibition 1 side)", zone: "Concourse · between Gates B and C" },
  ]),
];

const fashion = [
  ["FA01", "Trax Apparel", [-48.0, -56.4]],
  ["FA02", "Shop Soma", [-49.8, -58.4]],
  ["FA03", "Afro Fashion Paradise", [-51.7, -60.7]],
  ["FA04", "Arantiwa Global Fasion", [-53.5, -62.9]],
  ["FA05", "YYDTS Personal Care", [-56.5, -59.3]],
  ["FA06", "Circular Business", [-52.9, -57.6]],
  ["FA07", "Lal Labode Heritage Foundation", [-55.3, -53.6]],
  ["FA08", "Israella Kobla", [-57.6, -57.2]],
  ["FA09", "Sustainablaty", [-59.2, -59.9]],
  [undefined, "Republic of Ruru", [-50.4, -64.3]],
  [undefined, "Fashion Future Program", [-46.8, -59.7]],
] as const;

const fashionBooths: Place[] = fashion.map(([code, name, point]) => ({
  id: `fashion-${slug(name)}`,
  code,
  name,
  category: "exhibition",
  floor: "G",
  zone: "Fashion Booths · Exhibition 2",
  within: "fashion-booths",
  point: point as unknown as Vec2,
  note: name.includes("Fasion") || name === "Sustainablaty" ? spelling : undefined,
}));

const second: Place[] = [
  ...on("2", "exhibition", [{ id: "meera-state", code: "EX10", name: "Meera State", area: 200, zone: "By the Gate D lifts", note: spelling }]),
  ...on("2", "venue", [{ id: "podcast", name: "Podcast", area: 72, zone: "By the Gate D lifts" }]),
  ...on("2", "food", [{ id: "soup-kitchen", name: "Soup Kitchen", area: 72, zone: "By the Gate D lifts" }]),
  ...on("2", "venue", [{ id: "afrexim-offices", name: "Afreximbank Office Space", zone: "Between Gates C and D", note: "Offices 1–16." }]),
];

const third: Place[] = on("3", "venue", [
  { id: "hosted-buyers-lounge", name: "Hosted Buyers Lounge", fp: "lounges-3", area: 572, zone: "By the Gate B lifts", note: "Shares a 572 m² space with the Press and Sponsor lounges." },
  { id: "press-lounge", name: "Press Lounge", fp: "lounges-3", zone: "By the Gate B lifts", note: "Shares a 572 m² space with the Hosted Buyers and Sponsor lounges." },
  { id: "sponsor-lounge", name: "Sponsor Lounge", fp: "lounges-3", zone: "By the Gate B lifts", note: "Shares a 572 m² space with the Hosted Buyers and Press lounges." },
  { id: "ministerial-vip", name: "Ministerial VIP Lounge", area: 480, zone: "By the Gate A lifts" },
  { id: "ministerial-meeting", name: "Ministerial Meeting Space", area: 100, zone: "By the Gate A lifts" },
]);

const fourth: Place[] = [
  ...on("4", "venue", [
    { id: "writing-workshop", name: "Writing Workshop", zone: "Between Gates B and C" },
    { id: "master-class-b", name: "Master Class B", zone: "C side, north" },
    { id: "master-class-c", name: "Master Class C", zone: "C side, south", note: "Labelled “Master Class B” on the plan; listed as C in the event guide." },
    { id: "studio-music-hub", name: "Studio Music Hub", zone: "C side" },
    { id: "offices-4", name: "Offices", zone: "C side" },
  ]),
  ...on("4", "food", [
    { id: "vip-dining", name: "VIP Dining", zone: "By the Gate A lifts", note: "Spelled “VIP Dinning” on the plan." },
    { id: "ounje-and-co", code: "ML09", name: "Ounje & Co", zone: "Marketplace tables" },
  ]),
  ...on("4", "exhibition", [
    { id: "nuit", code: "ML01", name: "Nuit", zone: "Marketplace tables" },
    { id: "fashion-law-academy", code: "ML02", name: "Fashion Law Academy", zone: "Marketplace tables" },
    { id: "mashakara", code: "ML03", name: "Mashakara", zone: "Marketplace tables" },
    { id: "beauty-b", code: "ML04", name: "Beauty B", zone: "Marketplace tables" },
    { id: "nancy-hanson", code: "ML05", name: "Nancy Hanson", zone: "Marketplace tables" },
    { id: "niaga", code: "ML06", name: "Niaga", zone: "Marketplace tables" },
    { id: "woven-africa", code: "ML07", name: "Woven Africa", zone: "Marketplace tables" },
    { id: "aga-culture", code: "ML08", name: "Aga Culture", zone: "Marketplace tables" },
    { id: "spoof", code: "Y01", name: "Spoof" },
    { id: "amce", code: "Y02", name: "AMCE" },
    { id: "nepc", code: "Y03", name: "NEPC", area: 36 },
    { id: "abia", code: "Y04", name: "Abia" },
    { id: "afrix", code: "Y05", name: "Afrix" },
    { id: "kwara-grment", code: "Y06", name: "Kwara Grment", note: spelling },
    { id: "tiffany-amber", code: "Y07", name: "Tiffany Amber" },
    { id: "beauty-in-the-motherland", code: "Y08", name: "Beauty in the Motherland", area: 218 },
    { id: "world-bank", code: "Y09", name: "World Bank", area: 72 },
    { id: "sedc", code: "Y10", name: "SEDC", area: 72 },
    { id: "pwc", name: "PWC" },
    { id: "neptunes-female", code: "BM01", name: "Neptunes Female" },
    { id: "kene-rafu", code: "BM02", name: "Kene Rafu" },
  ]),
];

const fifth: Place[] = [
  ...on("5", "exhibition", [
    { id: "executive-marketplace", name: "Executive Marketplace", note: "HM01–HM09.", composite: true },
    { id: "hm01", code: "HM01", name: "Lele Labs & Living", zone: "Executive Marketplace" },
    { id: "hm02", code: "HM02", name: "Xandria", zone: "Executive Marketplace" },
    { id: "hm03", code: "HM03", name: "Arawa", zone: "Executive Marketplace" },
    { id: "hm04", code: "HM04", name: "Ron Beard Ram", zone: "Executive Marketplace" },
    { id: "hm05", code: "HM05", name: "K&S Creation", zone: "Executive Marketplace" },
    { id: "hm06", code: "HM06", name: "Aisha Abu", zone: "Executive Marketplace" },
    { id: "hm07", code: "HM07", name: "Femi Goods", zone: "Executive Marketplace" },
    { id: "hm08", code: "HM08", name: "Geometric", zone: "Executive Marketplace" },
    { id: "hm09", code: "HM09", name: "Eleventh Edition", zone: "Executive Marketplace" },
    { id: "fb01", code: "FB01", name: "Adire Teems" },
    { id: "fb02", code: "FB02", name: "Jon Pelumi Clothing" },
    { id: "literature-booths", name: "Literature Booths", note: "LB01–LB08.", composite: true },
    { id: "lb01", code: "LB01", name: "Narrative Creative", zone: "Literature Booths" },
    { id: "lb02", code: "LB02", name: "Roving Heights Ltd", zone: "Literature Booths" },
    { id: "lb03", code: "LB03", name: "Roving Heights Ltd", zone: "Literature Booths" },
    { id: "lb04", code: "LB04", name: "Cassava Republic", zone: "Literature Booths" },
    { id: "lb05", code: "LB05", name: "Book Buzz", zone: "Literature Booths" },
    { id: "lb06", code: "LB06", name: "Marie Lora-Mugai", zone: "Literature Booths" },
    { id: "lb07", code: "LB07", name: "XP Global", zone: "Literature Booths" },
    { id: "lb08", code: "LB08", name: "Selina Venture", zone: "Literature Booths" },
    { id: "tb01", code: "TB01", name: "Lebara Nigeria" },
    { id: "tb02", code: "TB02", name: "Jalent Africa" },
    { id: "tb03", code: "TB03", name: "Eleve Creative" },
    { id: "tb04", code: "TB04", name: "Mano River Week" },
    { id: "ab01", code: "AB01", name: "Maison des Mondes" },
    { id: "ab02", code: "AB02", name: "Raritan Consultation Ltd" },
    { id: "ab03", code: "AB03", name: "Ovico Gallery" },
    { id: "art-exhibition", code: "A01–A13", name: "Art Exhibition", note: "13 booths." },
  ]),
  ...on("5", "venue", [{ id: "reading-corner", name: "Reading Corner", note: "Seats 20." }]),
];

const mezzanine: Place[] = on("M", "exhibition", [
  {
    id: "mezzanine-booths",
    code: "CC01–CC20",
    name: "Mezzanine booths",
    note: "Listed in the event guide; the V24 floor plans don't include a mezzanine layout. Ask a steward at the lifts.",
  },
]);

const WC_SPOTS: [string, string][] = [
  ["0", "between Gates B and C"],
  ["1", "between Gates C and D"],
  ["2", "between Gates D and A"],
  ["3", "between Gates A and B"],
];
const toilets: Place[] = (["G", "4", "5"] as const).flatMap((floor) =>
  WC_SPOTS.map(([k, side]) => ({ id: `wc-${floor}-${k}`, name: "Toilets", zone: `${floorById(floor).name} · ${side}`, category: "amenity" as const, floor })),
);

/** Lift and stair cores, the same on every floor. */
export const CORES = [
  { id: "core-b", name: "Gate B lifts", point: [0, -46] as Vec2 },
  { id: "core-d", name: "Gate D lifts", point: [0, 46] as Vec2 },
  { id: "core-a", name: "Gate A lifts", point: [-46.5, 0] as Vec2 },
];
/** Individual lift cars, for drawing. */
export const LIFTS: Vec2[] = [
  [-12.3, -45.9], [12.3, -45.9], [-12.0, 45.5], [12.3, 45.5], [-46.5, -7.6], [-46.5, 7.7],
];

export const PLACES: Place[] = [...ground, ...fashionBooths, ...mezzanine, ...second, ...third, ...fourth, ...fifth, ...toilets];

const byId = new Map(PLACES.map((p) => [p.id, p]));
export const getPlace = (id: string | null | undefined) => (id ? byId.get(id) : undefined);

/** The place whose footprint represents `p` on the map (itself, or its parent block). */
export const footprintOf = (p: Place): Place => (p.within ? byId.get(p.within) ?? p : p);

export function polygonsOf(p: Place): Polygon[] {
  const f = footprintOf(p);
  return FOOTPRINTS[f.fp ?? f.id] ?? [];
}

/** Where to put the pin for a place: its own point, else its footprint's centre. */
export function placePoint(p: Place): Vec2 {
  if (p.point) return p.point;
  const polys = polygonsOf(p);
  if (!polys.length) return CORES[1].point;
  let sx = 0, sy = 0, n = 0;
  for (const poly of polys) {
    for (const [x, y] of poly) {
      sx += x;
      sy += y;
      n++;
    }
  }
  return [sx / n, sy / n];
}

export const GATES = ground.filter((p) => p.id.startsWith("gate-"));
export const isGate = (p: Place) => p.id.startsWith("gate-");

export const label = (p: Place) => (p.code ? `${p.code} · ${p.name}` : p.name);

function slug(s: string) {
  return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
