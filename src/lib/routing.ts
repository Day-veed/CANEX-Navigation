// Walking routes through the building.
//
// Each floor gets a small walking graph built from the plan geometry: the
// ground-floor concourse ring, gate entrances, exhibition-wing doors and hall
// aisles, an upper-floor corridor ring, and the three lift/stair cores that
// link every level. Places attach to their nearest walkable node, Dijkstra
// finds the path, and the path is described as turn-by-turn steps.

import {
  bearing,
  CORES,
  floorById,
  footprintOf,
  fromPolar,
  getPlace,
  isGate,
  label,
  PLACES,
  placePoint,
  radius,
  RING,
  type FloorId,
  type Place,
  type Vec2,
} from "./venue";

const WALKING_SPEED_MPS = 1.2;
const LIFT_MINUTES = 1;
/** Cost of one floor in the lift/stairs, in metre-equivalents. */
const FLOOR_COST = 12;
/** Waiting for and boarding a lift, so routes don't hop between cores. */
const BOARDING_COST = 20;
/** The ground concourse is the main circulation; prefer it over upper corridors. */
const UPPER_CORRIDOR_FACTOR = 1.6;
const RING_STEP = 4;
/** Vertical spacing between floors in the 3D view (scene units are metres). */
export const FLOOR_GAP = 16;

export type Vec3 = [number, number, number];

type Kind = "ring" | "gate" | "threshold" | "door" | "aisle" | "core" | "place";

interface Node {
  id: string;
  floor: FloorId;
  p: Vec2;
  kind: Kind;
  /** Wing, gate or core this node belongs to. */
  group?: string;
}

interface Wing {
  id: string;
  name: string;
  doors: number[];
  from: number;
  to: number;
}

/** Exhibition wings beyond the concourse wall, with their door bearings. */
const WINGS: Wing[] = [
  { id: "ex1", name: "Exhibition 1", doors: [25, 69], from: 16, to: 80 },
  { id: "ex2", name: "Exhibition 2", doors: [291, 335], from: 280, to: 344 },
  { id: "canex", name: "CANEX Programming Events hall", doors: [205, 251], from: 200, to: 256 },
];

const GATE_BEARINGS: Record<string, number> = { "gate-b": 0, "gate-c": 90, "gate-d": 180, "gate-a": 270 };
const UPPER: FloorId[] = ["2", "3", "4", "5"];
const STACK: FloorId[] = ["G", "M", "2", "3", "4", "5"];

// ---------------------------------------------------------------- graph

class Graph {
  nodes = new Map<string, Node>();
  adj = new Map<string, { to: string; cost: number }[]>();

  add(n: Node) {
    this.nodes.set(n.id, n);
    if (!this.adj.has(n.id)) this.adj.set(n.id, []);
    return n.id;
  }

  link(a: string, b: string, cost?: number) {
    const c = cost ?? dist(this.nodes.get(a)!.p, this.nodes.get(b)!.p);
    this.adj.get(a)!.push({ to: b, cost: c });
    this.adj.get(b)!.push({ to: a, cost: c });
  }

  nearest(ids: string[], p: Vec2) {
    let best = ids[0];
    let d = Infinity;
    for (const id of ids) {
      const dd = dist(this.nodes.get(id)!.p, p);
      if (dd < d) {
        d = dd;
        best = id;
      }
    }
    return best;
  }
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const norm = (a: number) => ((a % 360) + 360) % 360;
const ringId = (floor: FloorId, a: number) => `${floor}:ring:${norm(Math.round(a / RING_STEP) * RING_STEP)}`;

function inArc(a: number, from: number, to: number) {
  const span = norm(to - from);
  return norm(a - from) <= span;
}

function wingOf(p: Vec2): Wing | undefined {
  if (radius(p) < RING.wingWall) return undefined;
  return WINGS.find((w) => inArc(bearing(p), w.from, w.to));
}

function buildGraph() {
  const g = new Graph();

  const ring = (floor: FloorId, r: number, factor = 1) => {
    for (let a = 0; a < 360; a += RING_STEP) g.add({ id: ringId(floor, a), floor, p: fromPolar(a, r), kind: "ring" });
    const step = 2 * Math.PI * r * (RING_STEP / 360) * factor;
    for (let a = 0; a < 360; a += RING_STEP) g.link(ringId(floor, a), ringId(floor, a + RING_STEP), step);
  };

  ring("G", RING.concourse);
  for (const f of UPPER) ring(f, RING.upper, UPPER_CORRIDOR_FACTOR);

  // Gates: forecourt -> threshold in the facade -> concourse.
  for (const [gate, a] of Object.entries(GATE_BEARINGS)) {
    const thr = g.add({ id: `G:thr:${gate}`, floor: "G", p: fromPolar(a, 62), kind: "threshold", group: gate });
    g.add({ id: `G:${gate}`, floor: "G", p: getPlace(gate)!.point!, kind: "gate", group: gate });
    g.link(`G:${gate}`, thr);
    g.link(thr, ringId("G", a));
  }

  // Wings: doors through the concourse wall and an aisle along the hall.
  for (const w of WINGS) {
    const aisle: string[] = [];
    for (let a = w.from; norm(a - w.from) <= norm(w.to - w.from); a += RING_STEP) {
      aisle.push(g.add({ id: `G:aisle:${w.id}:${norm(a)}`, floor: "G", p: fromPolar(a, 65), kind: "aisle", group: w.id }));
      if (aisle.length > 1) g.link(aisle[aisle.length - 2], aisle[aisle.length - 1]);
    }
    for (const a of w.doors) {
      const door = g.add({ id: `G:door:${w.id}:${a}`, floor: "G", p: fromPolar(a, RING.wingWall + 0.5), kind: "door", group: w.id });
      g.link(door, ringId("G", a));
      g.link(door, g.nearest(aisle, fromPolar(a, 65)));
    }
  }

  // Lift and stair cores on every level, linked vertically.
  for (const c of CORES) {
    STACK.forEach((floor, i) => {
      const id = g.add({ id: `${floor}:${c.id}`, floor, p: c.point, kind: "core", group: c.id });
      if (floor !== "M") {
        const r = ringId(floor, bearing(c.point));
        g.link(id, r, dist(c.point, g.nodes.get(r)!.p) + BOARDING_COST / 2);
      }
      if (i > 0) g.link(`${STACK[i - 1]}:${c.id}`, id, FLOOR_COST);
    });
  }
  return g;
}

let graph: Graph | null = null;
const getGraph = () => (graph ??= buildGraph());

/** Graph nodes a place can be reached from. */
function attachTo(g: Graph, p: Place): { node: string; point: Vec2 } {
  const point = placePoint(p);
  if (isGate(p)) return { node: `G:${p.id}`, point };
  const f = footprintOf(p);
  if (f.via) return { node: `G:${f.via}`, point };
  if (p.floor === "M") return { node: `M:${CORES[1].id}`, point: CORES[1].point };
  const ids = [...g.nodes.values()].filter((n) => n.floor === p.floor);
  const wing = p.floor === "G" ? wingOf(point) : undefined;
  const pool = wing
    ? ids.filter((n) => n.kind === "aisle" && n.group === wing.id)
    : ids.filter((n) => n.kind === "ring" || (n.kind === "core" && dist(n.p, point) < 14));
  return { node: g.nearest(pool.map((n) => n.id), point), point };
}

function dijkstra(g: Graph, start: string) {
  const d = new Map<string, number>([[start, 0]]);
  const prev = new Map<string, string>();
  const done = new Set<string>();
  // The graph is a few hundred nodes, so a linear scan is plenty.
  const open = new Set([start]);
  while (open.size) {
    let u = "";
    let best = Infinity;
    for (const id of open) {
      if (d.get(id)! < best) {
        best = d.get(id)!;
        u = id;
      }
    }
    open.delete(u);
    done.add(u);
    for (const { to, cost } of g.adj.get(u) ?? []) {
      if (done.has(to)) continue;
      const nd = best + cost;
      if (nd < (d.get(to) ?? Infinity)) {
        d.set(to, nd);
        prev.set(to, u);
        open.add(to);
      }
    }
  }
  return { d, prev };
}

// ---------------------------------------------------------------- routes

export type StepKind = "start" | "turn-left" | "turn-right" | "straight" | "walk" | "lift" | "exit" | "arrive" | "info";

export interface Step {
  kind: StepKind;
  text: string;
  detail?: string;
}

export interface Route {
  from: Place;
  to: Place;
  /** Polyline in scene coordinates (x, height, z). */
  points: Vec3[];
  /** Floors the route walks on (start, destination and any floor in between where you walk). */
  floors: FloorId[];
  steps: Step[];
  meters: number;
  minutes: number;
}

interface PathPoint {
  floor: FloorId;
  p: Vec2;
  node?: Node;
}

const sceneY = (floor: FloorId) => floorById(floor).level * FLOOR_GAP + 0.4;
export const toScene = (floor: FloorId, [x, y]: Vec2, lift = 0): Vec3 => [x, sceneY(floor) + lift, y];

const placeName = (p: Place) => (isGate(p) ? `${p.code} (${p.name})` : label(p));

export function findRoute(fromId: string, toId: string): Route | null {
  const from = getPlace(fromId);
  const to = getPlace(toId);
  if (!from || !to) return null;
  const g = getGraph();
  const A = attachTo(g, from);
  const B = attachTo(g, to);
  const { prev } = dijkstra(g, A.node);

  const nodes: Node[] = [];
  for (let id: string | undefined = B.node; id; id = id === A.node ? undefined : prev.get(id)) nodes.unshift(g.nodes.get(id)!);
  if (nodes[0]?.id !== A.node) return null;

  const path: PathPoint[] = [
    { floor: from.floor, p: A.point },
    ...nodes.map((n) => ({ floor: n.floor, p: n.p, node: n })),
    { floor: to.floor, p: B.point },
  ].filter((pt, i, a) => i === 0 || dist(pt.p, a[i - 1].p) > 0.01 || pt.floor !== a[i - 1].floor);

  return describe(from, to, path);
}

/** The reachable place matching `test` that's quickest to walk to. */
export function nearest(fromId: string, test: (p: Place) => boolean): Place | undefined {
  const from = getPlace(fromId);
  if (!from) return undefined;
  const g = getGraph();
  const { d } = dijkstra(g, attachTo(g, from).node);
  let best: Place | undefined;
  let bestCost = Infinity;
  for (const p of PLACES) {
    if (!test(p) || p.hidden || p.id === from.id) continue;
    const a = attachTo(g, p);
    const c = (d.get(a.node) ?? Infinity) + dist(g.nodes.get(a.node)!.p, a.point);
    if (c < bestCost) {
      bestCost = c;
      best = p;
    }
  }
  return best;
}

// ---------------------------------------------------------------- directions

type Turn = "left" | "right" | "straight" | "back";

function turn(a: Vec2, b: Vec2): Turn {
  // Plan y points south, so a positive cross product is a clockwise (right) turn.
  const cross = a[0] * b[1] - a[1] * b[0];
  const dot = a[0] * b[0] + a[1] * b[1];
  const ang = (Math.atan2(cross, dot) * 180) / Math.PI;
  if (Math.abs(ang) < 30) return "straight";
  if (Math.abs(ang) > 150) return "back";
  return ang > 0 ? "right" : "left";
}

const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
const side = (t: Turn) => (t === "left" ? "on your left" : t === "right" ? "on your right" : "ahead");
const round5 = (m: number) => Math.max(5, Math.round(m / 5) * 5);

const coreName = (group?: string) => CORES.find((c) => c.id === group)?.name ?? "lifts";
const wingName = (group?: string) => WINGS.find((w) => w.id === group)?.name ?? "hall";

function describe(from: Place, to: Place, path: PathPoint[]): Route {
  const steps: Step[] = [];
  const points = path.map((pt) => toScene(pt.floor, pt.p));
  const floors = [...new Set(path.filter((pt, i) => pt === path[0] || pt === path[path.length - 1] || path[i - 1]?.floor === pt.floor).map((pt) => pt.floor))];

  let walked = 0;
  for (let i = 1; i < path.length; i++) if (path[i].floor === path[i - 1].floor) walked += dist(path[i].p, path[i - 1].p);
  const rides = path.filter((pt, i) => i > 0 && pt.floor !== path[i - 1].floor).length;
  const meters = round5(walked);
  const minutes = Math.max(1, Math.round(walked / WALKING_SPEED_MPS / 60 + (rides ? LIFT_MINUTES : 0)));

  if (from.id === to.id) {
    return { from, to, points, floors, meters: 0, minutes: 0, steps: [{ kind: "arrive", text: `You're already at ${placeName(to)}.` }] };
  }

  steps.push({ kind: "start", text: `Start at ${placeName(from)}`, detail: [floorById(from.floor).name, footprintOf(from).zone].filter(Boolean).join(" · ") });
  const fromF = footprintOf(from);
  if (fromF.via) steps.push({ kind: "walk", text: `Head back inside through ${getPlace(fromF.via)!.code}.` });

  let heading: Vec2 | null = null;
  let i = 1;
  while (i < path.length - 1) {
    const pt = path[i];
    const n = pt.node!;
    const into = sub(pt.p, path[i - 1].p);

    if (n.kind === "ring") {
      // Run of ring nodes on this floor.
      let j = i;
      while (j + 1 < path.length - 1 && path[j + 1].node?.kind === "ring" && path[j + 1].floor === pt.floor) j++;
      const ground = pt.floor === "G";
      const where = ground ? "the concourse" : `the ${floorById(pt.floor).name.toLowerCase()} corridor`;
      if (j === i) {
        const next = path[j + 1].node;
        steps.push({ kind: "straight", text: next?.kind === "core" ? `Head straight across to the ${coreName(next.group)}.` : `Cross ${where}.` });
        heading = sub(path[j + 1].p, pt.p);
      } else {
        const along = sub(path[i + 1].p, pt.p);
        const t = turn(into, along);
        const len = arcLength(path, i, j);
        steps.push({
          kind: t === "left" ? "turn-left" : t === "right" ? "turn-right" : "straight",
          text: t === "left" || t === "right" ? `Join ${where} and turn ${t}.` : `Join ${where}.`,
        });
        const passed = landmarks(pt.floor, path.slice(i + 1, j).map((q) => q.node!.id), from, to);
        steps.push({ kind: "walk", text: `Follow it for about ${round5(len)} m.`, detail: passed.length ? `You'll pass ${joinList(passed)}.` : undefined });
        heading = sub(path[j].p, path[j - 1].p);
      }
      i = j + 1;
      continue;
    }

    if (n.kind === "door") {
      const t = heading ? turn(heading, sub(path[i + 1].p, path[i - 1].p)) : "straight";
      steps.push({ kind: "walk", text: `Go through the ${wingName(n.group)} doors${t === "left" || t === "right" ? ` ${side(t)}` : ""}.` });
      heading = sub(path[i + 1].p, pt.p);
      i++;
      continue;
    }

    if (n.kind === "aisle") {
      let j = i;
      while (j + 1 < path.length - 1 && path[j + 1].node?.kind === "aisle") j++;
      const len = arcLength(path, i, j);
      if (len > 8) steps.push({ kind: "walk", text: `Walk through the hall for about ${round5(len)} m.` });
      heading = j > i ? sub(path[j].p, path[j - 1].p) : into;
      i = j + 1;
      continue;
    }

    if (n.kind === "core") {
      let j = i;
      while (j + 1 < path.length - 1 && path[j + 1].node?.kind === "core" && path[j + 1].node?.group === n.group) j++;
      if (path[j].floor !== pt.floor) {
        const up = floorById(path[j].floor).level > floorById(pt.floor).level;
        steps.push({
          kind: "lift",
          text: `Take the lift or stairs at the ${coreName(n.group)} ${up ? "up" : "down"} to the ${floorById(path[j].floor).name}.`,
          detail: "Two lifts with stairs between them.",
        });
        heading = null;
      }
      i = j + 1;
      continue;
    }

    if (n.kind === "gate" || n.kind === "threshold") {
      const gate = getPlace(n.group);
      const toF = footprintOf(to);
      const leaving = toF.via === n.group && path[i + 1] && radius(path[i + 1].p) > radius(pt.p);
      if (n.kind === "gate" && leaving) steps.push({ kind: "exit", text: `Leave through ${gate?.code}. ${toF.name} is just outside.` });
      heading = into;
      i++;
      continue;
    }
    i++;
  }

  // Arrival
  const last = path[path.length - 1];
  const before = path[path.length - 2];
  const toF = footprintOf(to);
  if (toF.via && !steps.some((s) => s.kind === "exit")) {
    steps.push({ kind: "exit", text: `Leave through ${getPlace(toF.via)!.code}. ${toF.name} is just outside.` });
  }
  if (to.floor === "M") {
    steps.push({ kind: "arrive", text: `Follow the signs on the Mezzanine to ${placeName(to)}.` });
  } else if (!toF.via) {
    const approach = sub(last.p, before.p);
    const t = heading ? turn(heading, approach) : "straight";
    const name = to !== toF ? toF.name : placeName(to);
    const near = dist(last.p, before.p) < 12;
    if (before.node?.kind === "core") {
      steps.push({ kind: "arrive", text: near ? `${name} is right by the lifts.` : `Walk about ${round5(dist(last.p, before.p))} m from the lifts to ${name}.` });
    } else {
      steps.push({ kind: "arrive", text: to !== toF ? `Head to ${name} ${side(t)}.` : `${name} is ${side(t)}.` });
    }
    if (to !== toF) steps[steps.length - 1].detail = `${to.name} is inside${to.code ? ` (${to.code})` : ""}.`;
  } else if (to !== toF) {
    steps.push({ kind: "arrive", text: `Look for ${placeName(to)}.` });
  }
  if (to.note) steps.push({ kind: "info", text: to.note });

  return { from, to, points, floors, steps, meters, minutes };
}

function arcLength(path: PathPoint[], i: number, j: number) {
  let s = 0;
  for (let k = i + 1; k <= j; k++) s += dist(path[k].p, path[k - 1].p);
  return s;
}

let attachIndex: Map<string, Place[]> | null = null;

/** Notable places along a stretch of ring, for "you'll pass…". */
function landmarks(floor: FloorId, ringNodes: string[], from: Place, to: Place): string[] {
  if (!attachIndex) {
    const g = getGraph();
    attachIndex = new Map();
    for (const p of PLACES) {
      if (p.hidden || p.within || p.category === "amenity" || footprintOf(p).via) continue;
      const a = attachTo(g, p);
      if (!attachIndex.has(a.node)) attachIndex.set(a.node, []);
      attachIndex.get(a.node)!.push(p);
    }
    // Gates sit on the ring too.
    for (const [gate, a] of Object.entries(GATE_BEARINGS)) {
      const id = ringId("G", a);
      attachIndex.set(id, [getPlace(gate)!, ...(attachIndex.get(id) ?? [])]);
    }
  }
  const skip = new Set([footprintOf(from).id, footprintOf(to).id]);
  const seen: Place[] = [];
  for (const id of ringNodes) for (const p of attachIndex.get(id) ?? []) if (p.floor === floor && !skip.has(p.id)) seen.push(p);
  const gates = seen.filter(isGate);
  const others = seen.filter((p) => !isGate(p));
  const picks: Place[] = [];
  const want = Math.min(3, others.length);
  for (let k = 0; k < want; k++) picks.push(others[Math.floor((k * (others.length - 1)) / Math.max(1, want - 1))]);
  const names = [...new Set(picks)].map((p) => (p.code && !p.code.includes("–") ? `${p.code} ${p.name === "Name not supplied" ? "" : p.name}`.trim() : p.name));
  return [...names, ...gates.map((g) => g.code!)];
}

function joinList(xs: string[]) {
  return xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}
