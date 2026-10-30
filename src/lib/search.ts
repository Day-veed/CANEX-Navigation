import { CATEGORIES, floorById, PLACES, type Category, type FloorId, type Place } from "./venue";

export const destinations = PLACES.filter((p) => !p.hidden);

/** Common words people type that don't appear in place names. */
const SYNONYMS: Record<string, string> = {
  restroom: "toilets",
  restrooms: "toilets",
  bathroom: "toilets",
  bathrooms: "toilets",
  wc: "toilets",
  loo: "toilets",
  eat: "food",
  entrance: "gate",
  exit: "gate",
};

export function normalize(s: string) {
  return s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

/** Places matching a query, best first. An empty query lists everything. */
export function search(query: string, category: Category | null = null, floor: FloorId | null = null): Place[] {
  const q = normalize(query);
  const tokens = q.split(" ").filter(Boolean).map((t) => SYNONYMS[t] ?? t);
  const scored: [Place, number][] = [];
  for (const p of destinations) {
    if (category && p.category !== category) continue;
    if (floor && p.floor !== floor) continue;
    if (!tokens.length) {
      scored.push([p, 0]);
      continue;
    }
    const code = normalize(p.code ?? "");
    const name = normalize(p.name);
    const hay = `${code} ${name} ${normalize(p.zone ?? "")} ${normalize(CATEGORIES[p.category].label)} ${normalize(floorById(p.floor).name)}`;
    let score = 0;
    if (code && code === q) score = 100;
    else if (code && code.startsWith(q)) score = 80;
    else if (name.startsWith(q)) score = 60;
    else if (tokens.every((t) => hay.includes(t))) score = 40;
    if (score) scored.push([p, score]);
  }
  return scored.sort((a, b) => b[1] - a[1]).map(([p]) => p);
}
