// Venue data for CANEX at the Wole Soyinka Centre for Culture and Creative Arts.
// Transcribed from the schematic "Find your way" plan (venue plan V24.1).
//
// Ground-floor positions are polar: `angle` in degrees clockwise from north
// (Gate B at the top of the plan), `r` in map units from the centre of the
// atrium. The plan is schematic, so treat positions as approximate.

export type Category =
  | "exhibition"
  | "food"
  | "room"
  | "hub"
  | "outdoor"
  | "vip"
  | "medical"
  | "accreditation";

export const CATEGORIES: Record<Category, { label: string; color: string }> = {
  exhibition: { label: "Exhibition booths", color: "#0f7b7b" },
  food: { label: "Food & drink", color: "#d97a29" },
  room: { label: "Rooms & lounges", color: "#8a4fa3" },
  hub: { label: "Hubs & activities", color: "#3a73c0" },
  outdoor: { label: "Outdoor sport", color: "#5e8c3a" },
  vip: { label: "VIP entrance", color: "#a8701d" },
  medical: { label: "Medical entrance", color: "#d23c4a" },
  accreditation: { label: "Accreditation & registration", color: "#4150a3" },
};

export type FloorId = "G" | "M" | "2" | "3" | "4" | "5";

export const FLOORS: { id: FloorId; name: string; short: string; level: number }[] = [
  { id: "G", name: "Ground floor", short: "G", level: 0 },
  { id: "M", name: "Mezzanine", short: "M", level: 1 },
  { id: "2", name: "Second floor", short: "2", level: 2 },
  { id: "3", name: "Third floor", short: "3", level: 3 },
  { id: "4", name: "Fourth floor", short: "4", level: 4 },
  { id: "5", name: "Fifth floor", short: "5", level: 5 },
];

export const floorById = (id: FloorId) => FLOORS.find((f) => f.id === id)!;

/** An annular sector on the ground-floor plan. */
export interface Sector {
  a0: number;
  a1: number;
  r0: number;
  r1: number;
  /** Extrusion height in the 3D view. */
  h?: number;
}

export interface Place {
  id: string;
  code?: string;
  name: string;
  category: Category;
  floor: FloorId;
  zone?: string;
  note?: string;
  /** Footprint drawn on the ground-floor map. */
  shape?: Sector;
  /** A point on the map for places without a footprint of their own. */
  anchor?: { angle: number; r: number };
  /** Located inside another place; routes and highlights use the parent. */
  within?: string;
  /** Reached from the concourse through this gate (outdoor places). */
  via?: string;
  /** Not shown as a destination in search (e.g. stairs and lifts). */
  hidden?: boolean;
}

// Radial bands of the ground-floor ring.
export const RING = {
  atrium: 2.7,
  concourseInner: 2.8,
  concourseOuter: 3.45,
  /** The walking line along the circular concourse. */
  walk: 3.1,
  gate: 7.3,
  floorEdge: 7.0,
};
const INNER: [number, number] = [3.6, 4.5];
const OUTER: [number, number] = [4.7, 6.6];

const stall = (a0: number, a1: number): Sector => ({ a0, a1, r0: INNER[0], r1: INNER[1], h: 0.32 });
const hall = (a0: number, a1: number, r0 = OUTER[0], r1 = OUTER[1], h = 0.6): Sector => ({ a0, a1, r0, r1, h });

const ex1 = "Exhibition 1 · between Gates B and C";
const ex2 = "Exhibition 2 · between Gates A and B";
const hubsCD = "Hubs · between Gates C and D";
const zoneDA = "Between Gates D and A";
const unnamed = "Name not supplied";
const spelling = "Spelling as supplied by the source plan.";

const ground: Place[] = [
  // Gates
  { id: "gate-a", code: "Gate A", name: "VIP Entrance", category: "vip", floor: "G", anchor: { angle: 270, r: RING.gate } },
  { id: "gate-b", code: "Gate B", name: "Food Hub Exit", category: "food", floor: "G", anchor: { angle: 0, r: RING.gate } },
  { id: "gate-c", code: "Gate C", name: "Medical Entrance", category: "medical", floor: "G", anchor: { angle: 90, r: RING.gate } },
  { id: "gate-d", code: "Gate D", name: "Main Entrance · Accreditation & Registration", category: "accreditation", floor: "G", anchor: { angle: 180, r: RING.gate } },

  // Outdoor
  { id: "food-hub", name: "Food Hub", category: "food", floor: "G", zone: "Outside, at the Gate B exit", anchor: { angle: 14, r: 9.2 }, via: "gate-b" },
  { id: "basketball-court", name: "Basketball Court", category: "outdoor", floor: "G", zone: "Outside VIP Entrance A", note: "Separate from the Basketball Africa booth inside Exhibition 1.", anchor: { angle: 257, r: 9.6 }, via: "gate-a" },

  // Exhibition 1: pavilions
  { id: "ex01", code: "EX01", name: "Afrique Femme", category: "exhibition", floor: "G", zone: ex1, shape: hall(8, 18) },
  { id: "ex02", code: "EX02", name: "Basketball Africa booth", category: "exhibition", floor: "G", zone: ex1, shape: hall(19, 30) },
  { id: "ex03", code: "EX03", name: "Presidential Suite", category: "room", floor: "G", zone: ex1, shape: hall(31, 52, 5.6, 6.6, 0.7) },
  { id: "ex06", code: "EX06", name: "Lagos State", category: "exhibition", floor: "G", zone: ex1, shape: hall(31, 52, 4.7, 5.45, 0.5) },
  { id: "ex04", code: "EX04", name: "FMITI", category: "exhibition", floor: "G", zone: ex1, shape: hall(60, 69, 4.7, 6.2) },
  { id: "ex05", code: "EX05", name: "Nigeria Host Country", category: "exhibition", floor: "G", zone: ex1, shape: hall(70, 83) },
  // Exhibition 1: stalls
  { id: "e07", code: "E07", name: "Fedility", category: "exhibition", floor: "G", zone: ex1, note: spelling, shape: stall(11, 17) },
  { id: "e06", code: "E06", name: "Cambridge", category: "exhibition", floor: "G", zone: ex1, shape: stall(18, 24) },
  { id: "e05", code: "E05", name: "Cardinal Torch", category: "exhibition", floor: "G", zone: ex1, shape: stall(25, 31) },
  { id: "e04", code: "E04", name: "EU Global Gateway", category: "exhibition", floor: "G", zone: ex1, shape: stall(32, 38) },
  { id: "e03", code: "E03", name: "Bet9ja / Value Jet", category: "exhibition", floor: "G", zone: ex1, shape: stall(39, 45) },
  { id: "e02", code: "E02", name: unnamed, category: "exhibition", floor: "G", zone: ex1, shape: stall(46, 52) },
  { id: "e01", code: "E01", name: "iDICE", category: "exhibition", floor: "G", zone: ex1, shape: stall(53, 59) },

  // Exhibition 2: pavilions and areas
  { id: "ex07", code: "EX07", name: "Afreximbank Pavilion", category: "exhibition", floor: "G", zone: ex2, shape: hall(277, 297) },
  { id: "ex08", code: "EX08", name: "AfCFTA", category: "exhibition", floor: "G", zone: ex2, shape: hall(298, 313) },
  { id: "ex09", code: "EX09", name: "Africa Union", category: "exhibition", floor: "G", zone: ex2, note: "Listed in Exhibition 2 but not marked on the map. Ask a steward on arrival.", anchor: { angle: 315, r: 4.6 } },
  { id: "innovation-hub", name: "Innovation Hub", category: "exhibition", floor: "G", zone: ex2, shape: hall(315, 334, 4.7, 5.4, 0.45) },
  { id: "fashion-stalls", name: "Fashion stalls", category: "exhibition", floor: "G", zone: ex2, shape: hall(315, 336, 5.5, 6.6, 0.5) },
  { id: "networking", name: "Networking area", category: "exhibition", floor: "G", zone: ex2, shape: hall(338, 352, 4.7, 5.4, 0.3) },
  { id: "thread-of-nation", name: "Thread of Nation", category: "exhibition", floor: "G", zone: ex2, note: "10 booths.", shape: hall(338, 352, 5.5, 6.3, 0.5) },
  { id: "panel-discussion", name: "Panel Discussion Stage", category: "room", floor: "G", zone: ex2, shape: hall(339, 352, 6.4, 7.0, 0.6) },
  // Exhibition 2: stalls
  { id: "e14", code: "E14", name: "IATF Sales", category: "exhibition", floor: "G", zone: ex2, shape: stall(282, 288) },
  { id: "e13", code: "E13", name: "PAPS", category: "exhibition", floor: "G", zone: ex2, shape: stall(289, 295) },
  { id: "e12", code: "E12", name: "NBS Malawi", category: "exhibition", floor: "G", zone: ex2, shape: stall(296, 302) },
  { id: "e11", code: "E11", name: "Hands Down Coffee", category: "food", floor: "G", zone: ex2, shape: stall(303, 309) },
  { id: "e10", code: "E10", name: "FDH Holding", category: "exhibition", floor: "G", zone: ex2, shape: stall(311, 317) },
  { id: "e09", code: "E09", name: "Oak Wood Capital", category: "exhibition", floor: "G", zone: ex2, shape: stall(319, 325) },
  { id: "e08", code: "E08", name: "Zenith Bank", category: "exhibition", floor: "G", zone: ex2, shape: stall(332, 338) },

  // Hubs between C and D
  { id: "sport-hub", name: "Sport Hub Stage", category: "hub", floor: "G", zone: hubsCD, shape: hall(97, 122, 4.7, 6.6, 0.5) },
  { id: "film-hub", name: "Film Hub Stage", category: "hub", floor: "G", zone: hubsCD, shape: hall(124, 147, 4.7, 6.6, 0.5) },
  { id: "live-theatre", name: "Live Theatre Stage", category: "hub", floor: "G", zone: hubsCD, shape: hall(149, 176, 4.7, 6.6, 0.5) },
  { id: "e27", code: "E27", name: unnamed, category: "exhibition", floor: "G", zone: hubsCD, shape: stall(99, 105) },
  { id: "e26", code: "E26", name: "Arise", category: "exhibition", floor: "G", zone: hubsCD, shape: stall(106, 112) },
  { id: "e25", code: "E25", name: "ITC Fashion", category: "exhibition", floor: "G", zone: hubsCD, shape: stall(116, 122) },
  { id: "e24", code: "E24", name: "ITC", category: "exhibition", floor: "G", zone: hubsCD, shape: stall(125, 131) },
  { id: "e23", code: "E23", name: "National Revenue Service", category: "exhibition", floor: "G", zone: hubsCD, shape: stall(143, 149) },
  { id: "e22", code: "E22", name: "Flatter Wave", category: "exhibition", floor: "G", zone: hubsCD, note: spelling, shape: stall(159, 165) },

  // Between D and A
  { id: "canex-programming", name: "CANEX Programming Events", category: "hub", floor: "G", zone: zoneDA, shape: hall(184, 262, 4.7, 6.6, 0.45) },
  { id: "e21", code: "E21", name: "British Council", category: "exhibition", floor: "G", zone: zoneDA, shape: stall(186, 192) },
  { id: "e20", code: "E20", name: "Heych", category: "exhibition", floor: "G", zone: zoneDA, shape: stall(193, 199) },
  { id: "e19", code: "E19", name: "Media Craft Africa", category: "exhibition", floor: "G", zone: zoneDA, shape: stall(200, 206) },
  { id: "e18", code: "E18", name: "Yutee Rone", category: "exhibition", floor: "G", zone: zoneDA, shape: stall(207, 213) },
  { id: "e17", code: "E17", name: "Development Bank Nigeria", category: "exhibition", floor: "G", zone: zoneDA, shape: stall(216, 222) },
  { id: "e16", code: "E16", name: "Ojude Aso", category: "exhibition", floor: "G", zone: zoneDA, shape: stall(225, 231) },
  { id: "e15", code: "E15", name: unnamed, category: "exhibition", floor: "G", zone: zoneDA, shape: stall(234, 240) },

  // Vertical circulation. The plan doesn't show stairs or lifts, so this is a
  // placeholder by the main entrance. Update `anchor` once confirmed on site.
  { id: "core", name: "Stairs & lifts", category: "accreditation", floor: "G", hidden: true, anchor: { angle: 180, r: 2.35 } },
];

const fashionStalls = [
  "Arantiwa Global Fasion",
  "Afro Fashion Paradise",
  "Shop Soma",
  "Trax Apparel",
  "YYDTS Personal Care",
  "Israella Kobla",
  "Sustainablaty",
  "Circular Business",
  "Lal Labode Heritage Foundation",
  "Republic of Ruru",
  "Fashion Future Program",
].map<Place>((name) => ({
  id: `fashion-${slug(name)}`,
  name,
  category: "exhibition",
  floor: "G",
  zone: "Fashion stalls · Exhibition 2",
  within: "fashion-stalls",
  note: name.endsWith("Fasion") || name === "Sustainablaty" ? spelling : undefined,
}));

const upper = (floor: FloorId, category: Category, entries: string[]): Place[] =>
  entries.map((entry) => {
    const m = entry.match(/^([A-Z]{2}\d{2})\s+(.*)$/);
    const name = m ? m[2] : entry;
    return { id: `${floor}-${slug(entry)}`, code: m?.[1], name, category, floor };
  });

const upperFloorNote = "The plan groups this with Mezzanine–Third without naming the floor. Check signage at the lifts.";

const upperFloors: Place[] = [
  { id: "M-cc-booths", code: "CC01–CC20", name: "Mezzanine booths", category: "exhibition", floor: "M" },
  { id: "M-ex10", code: "EX10", name: "Meera State", category: "exhibition", floor: "M", note: spelling },
  { id: "2-afreximbank-offices", name: "Afreximbank offices", category: "room", floor: "2" },
  { id: "2-podcast", name: "Podcast", category: "hub", floor: "2" },
  { id: "2-soup-kitchen", name: "Soup Kitchen", category: "food", floor: "2" },
  { id: "3-ministerial-vip-lounge", name: "Ministerial VIP Lounge", category: "room", floor: "3" },
  { id: "3-hosted-buyers-lounge", name: "Hosted Buyers Lounge", category: "room", floor: "3", note: upperFloorNote },
  { id: "3-press-lounge", name: "Press Lounge", category: "room", floor: "3", note: upperFloorNote },
  { id: "3-sponsor-lounge", name: "Sponsor Lounge", category: "room", floor: "3", note: upperFloorNote },

  ...upper("4", "exhibition", [
    "Nuit", "Fashion Law Academy", "Mashakara", "Beauty B", "Woven Africa", "Niaga", "Nancy Hanson", "Culture",
    "Afrix", "Abia", "Kwara Grment", "Spoof", "Tiffany Amber", "Kene Rafu", "Neptunes Female", "NEPC",
    "Beauty in the Motherland", "AMCE", "World Bank", "SEDC",
  ]),
  ...upper("4", "food", ["Ounje & Co", "VIP Dining"]),
  ...upper("4", "room", ["Writing Workshop", "Master Class B", "Master Class C", "Studio Music Hub", "Offices"]),

  ...upper("5", "exhibition", [
    "HM01 Lele Labs & Living", "HM02 Xandria", "HM03 Arawa", "HM04 Ron Beard", "HM05 Ram Creation",
    "HM06 K&S Aisha Abu.", "HM07 Femi Goods", "HM08 Geometric", "HM09 Eleventh Edition",
    "FB01 Adire Teens", "FB02 Jon Pelumi Clothing",
    "LB01 Narrative Creative", "LB02 Roving Heights Ltd", "LB03 Roving Heights Ltd", "LB04 Casava Republic",
    "LB05 Book Buz", "LB06 Marie Lora-Mugai", "LB07 XP Global", "LB08 Selina Venture",
    "TB01 Lebara Nigeria", "TB02 Jalent Africa", "TB03 Eleve Creative", "TB04 Mano River Week",
    "AB01 Maison des Mondes", "AB02 Raritan Consultation", "AB03 Ovico Gallery",
    "Art Exhibition", "Literature booths", "Executive Marketplace",
  ]),
  ...upper("5", "hub", ["Reading Corner"]),
];

export const PLACES: Place[] = [...ground, ...fashionStalls, ...upperFloors];

const byId = new Map(PLACES.map((p) => [p.id, p]));
export const getPlace = (id: string | null | undefined) => (id ? byId.get(id) : undefined);

/** The place whose footprint represents `p` on the map (itself, or its parent). */
export const footprintOf = (p: Place): Place => (p.within ? byId.get(p.within) ?? p : p);

export const GATES = ground.filter((p) => p.id.startsWith("gate-"));

export const label = (p: Place) => (p.code ? `${p.code} · ${p.name}` : p.name);

function slug(s: string) {
  return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
