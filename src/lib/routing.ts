// Walking routes on the ground-floor ring.
//
// Every ground-floor place opens onto the circular concourse, so a route is:
// leave the start place, walk the shorter way round the concourse, then step
// off it into the destination. Upper floors are reached via the stairs/lifts.

import { floorById, footprintOf, getPlace, label, PLACES, RING, type Place } from "./venue";

/** Map units to metres. The plan is not to scale; calibrate on site. */
export const METERS_PER_UNIT = 6;
const WALKING_SPEED_MPS = 1.2;
const LIFT_MINUTES = 1;
/** Vertical spacing between floors in the 3D view. */
export const FLOOR_GAP = 1.8;
const WALK_Y = 0.06;

export type Vec3 = [number, number, number];

export function polar(angle: number, r: number, y = 0): Vec3 {
  const t = (angle * Math.PI) / 180;
  return [r * Math.sin(t), y, -r * Math.cos(t)];
}

/** Angle in degrees at the centre of a place's footprint. */
export function placeAngle(p: Place): number {
  const f = footprintOf(p);
  if (f.shape) return (f.shape.a0 + f.shape.a1) / 2;
  if (f.via) return getPlace(f.via)!.anchor!.angle;
  return f.anchor?.angle ?? 0;
}

export function placePoint(p: Place, y = WALK_Y): Vec3 {
  const f = footprintOf(p);
  if (f.shape) return polar(placeAngle(f), (f.shape.r0 + f.shape.r1) / 2, y);
  return polar(f.anchor!.angle, f.anchor!.r, y);
}

interface Endpoint {
  ringAngle: number;
  /** Points from the concourse out to the place. */
  approach: Vec3[];
  /** True when the place is on the atrium side of the walking line. */
  inside: boolean;
}

const core = () => getPlace("core")!;

function groundEndpoint(p: Place): Endpoint {
  if (p.floor !== "G") return groundEndpoint(core());
  const f = footprintOf(p);
  if (f.via) {
    const gate = getPlace(f.via)!;
    const a = gate.anchor!.angle;
    return { ringAngle: a, approach: [polar(a, RING.walk, WALK_Y), polar(a, RING.gate, WALK_Y), placePoint(f)], inside: false };
  }
  if (f.shape) {
    const a = placeAngle(f);
    return { ringAngle: a, approach: [polar(a, RING.walk, WALK_Y), polar(a, f.shape.r0 - 0.05, WALK_Y)], inside: false };
  }
  const { angle, r } = f.anchor!;
  return { ringAngle: angle, approach: [polar(angle, RING.walk, WALK_Y), polar(angle, r, WALK_Y)], inside: r < RING.walk };
}

/** Signed shortest turn from a to b, in (-180, 180]. Positive is clockwise. */
function angleDelta(a: number, b: number) {
  let d = (((b - a) % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

/** Is `x` strictly between `start` and `start + delta` along the walk? */
function passes(start: number, delta: number, x: number) {
  const along = delta >= 0 ? angleDelta(start, x) : -angleDelta(start, x);
  const d = Math.abs(delta);
  const pos = along < 0 ? along + 360 : along;
  return pos > 3 && pos < d - 3;
}

export type StepKind = "start" | "turn-left" | "turn-right" | "straight" | "walk" | "lift" | "exit" | "arrive" | "info";

export interface Step {
  kind: StepKind;
  text: string;
  detail?: string;
}

export interface Route {
  from: Place;
  to: Place;
  points: Vec3[];
  steps: Step[];
  meters: number;
  minutes: number;
}

const placeName = (p: Place) => (p.id.startsWith("gate-") ? `${p.code} (${p.name})` : label(p));

export function findRoute(fromId: string, toId: string): Route | null {
  const from = getPlace(fromId);
  const to = getPlace(toId);
  if (!from || !to) return null;

  const A = groundEndpoint(from);
  const B = groundEndpoint(to);
  const delta = angleDelta(A.ringAngle, B.ringAngle);
  const clockwise = delta >= 0;

  // Geometry
  const arc: Vec3[] = [];
  const n = Math.max(1, Math.ceil(Math.abs(delta) / 3));
  for (let i = 1; i < n; i++) arc.push(polar(A.ringAngle + (delta * i) / n, RING.walk, WALK_Y));
  let ground = [...[...A.approach].reverse(), ...arc, ...B.approach];
  // Outdoor trips through the gate you're already at don't touch the concourse.
  const fromF = footprintOf(from);
  const toF = footprintOf(to);
  const outdoorShortcut = from.floor === "G" && to.floor === "G" && (toF.via === fromF.id || fromF.via === toF.id || (!!toF.via && toF.via === fromF.via));
  if (outdoorShortcut) {
    const gate = getPlace(toF.via ?? fromF.via)!;
    const g = polar(gate.anchor!.angle, RING.gate, WALK_Y);
    ground = [placePoint(fromF), g, placePoint(toF)].filter((p, i, a) => i === 0 || p.some((v, k) => v !== a[i - 1][k]));
  }
  const points: Vec3[] = [];
  if (from.floor !== "G") points.push(withY(ground[0], floorById(from.floor).level * FLOOR_GAP + WALK_Y));
  points.push(...ground);
  if (to.floor !== "G") points.push(withY(ground[ground.length - 1], floorById(to.floor).level * FLOOR_GAP + WALK_Y));

  let units = 0;
  for (let i = 1; i < ground.length; i++) units += Math.hypot(ground[i][0] - ground[i - 1][0], ground[i][2] - ground[i - 1][2]);
  const meters = Math.round((units * METERS_PER_UNIT) / 5) * 5;
  const liftRides = Number(from.floor !== "G") + Number(to.floor !== "G");
  const minutes = Math.max(1, Math.round(meters / WALKING_SPEED_MPS / 60 + liftRides * LIFT_MINUTES));

  // Directions
  const steps: Step[] = [];

  if (from.id === to.id) {
    return { from, to, points, meters: 0, minutes: 0, steps: [{ kind: "arrive", text: `You're already at ${placeName(to)}.` }] };
  }
  if (from.floor !== "G" && to.floor !== "G") {
    const c = A.approach[A.approach.length - 1];
    const fromFloor = floorById(from.floor);
    const toFloor = floorById(to.floor);
    const sameFloor = from.floor === to.floor;
    return {
      from,
      to,
      points: sameFloor ? [] : [withY(c, fromFloor.level * FLOOR_GAP + WALK_Y), withY(c, toFloor.level * FLOOR_GAP + WALK_Y)],
      meters: 0,
      minutes: sameFloor ? 1 : LIFT_MINUTES + 1,
      steps: [
        { kind: "start", text: `Start at ${placeName(from)}`, detail: fromFloor.name },
        ...(sameFloor ? [] : [{ kind: "lift" as const, text: `Take the stairs or lift ${toFloor.level > fromFloor.level ? "up" : "down"} to the ${toFloor.name}.` }]),
        { kind: "arrive", text: `Follow the floor signs to ${placeName(to)}.` },
        ...(to.note ? [{ kind: "info" as const, text: to.note }] : []),
      ],
    };
  }

  steps.push({ kind: "start", text: `Start at ${placeName(from)}`, detail: from.floor !== "G" ? floorById(from.floor).name : from.zone });
  if (outdoorShortcut) {
    if (fromF.via) steps.push({ kind: "walk", text: `Walk back to ${getPlace(fromF.via)!.code}.` });
    if (toF.via) steps.push({ kind: "exit", text: `Go out through ${getPlace(toF.via)!.code}. ${toF.name} is just outside.` });
    if (to !== toF) steps.push({ kind: "arrive", text: `Look for ${placeName(to)}.` });
    if (to.note) steps.push({ kind: "info", text: to.note });
    return { from, to, points, steps, meters, minutes };
  }
  if (from.floor !== "G") steps.push({ kind: "lift", text: "Take the stairs or lift down to the ground floor." });
  if (fromF.via) steps.push({ kind: "walk", text: `Head back inside through ${getPlace(fromF.via)!.code}.` });

  const sameSpot = Math.abs(delta) < 4;
  if (sameSpot) {
    steps.push({
      kind: "straight",
      text: to.floor !== "G" ? "Step onto the concourse. The stairs and lifts are straight ahead." : "Step onto the concourse. Your destination is just across it.",
    });
  } else {
    // Facing the atrium, clockwise is to your left. From the atrium side it flips.
    const left = clockwise !== A.inside;
    steps.push({ kind: left ? "turn-left" : "turn-right", text: `Join the circular concourse and turn ${left ? "left" : "right"}.` });

    const passed = landmarks(A.ringAngle, delta, from, to);
    const share = Math.abs(delta) / 360;
    const howFar =
      share < 0.12 ? "a short way" : share < 0.2 ? "about a sixth of the way round" : share < 0.3 ? "about a quarter of the way round" : share < 0.4 ? "about a third of the way round" : "about halfway round";
    steps.push({
      kind: "walk",
      text: `Follow the concourse ${howFar} (~${meters} m).`,
      detail: passed.length ? `You'll pass ${joinList(passed)}.` : undefined,
    });
  }

  if (to.floor !== "G") {
    steps.push({ kind: "lift", text: `Take the stairs or lift up to the ${floorById(to.floor).name}.`, detail: "Stairs & lifts are by the main entrance (location to be confirmed on site)." });
    steps.push({ kind: "arrive", text: `Follow the floor signs to ${placeName(to)}.` });
  } else if (toF.via) {
    steps.push({ kind: "exit", text: `Leave through ${getPlace(toF.via)!.code}. ${toF.name} is just outside.` });
    if (to !== toF) steps.push({ kind: "arrive", text: `Look for ${placeName(to)}.` });
  } else {
    // Walking clockwise, the atrium is on your right and the booths on your left.
    const side = sameSpot ? "ahead" : clockwise !== B.inside ? "on your left" : "on your right";
    if (to !== toF) {
      steps.push({ kind: "arrive", text: `Head into ${toF.name} ${side}.`, detail: `${to.name} is inside.` });
    } else {
      steps.push({ kind: "arrive", text: `${placeName(to)} is ${side}.` });
    }
  }
  if (to.note) steps.push({ kind: "info", text: to.note });

  return { from, to, points, steps, meters, minutes };
}

function landmarks(start: number, delta: number, from: Place, to: Place): string[] {
  const skip = new Set([footprintOf(from).id, footprintOf(to).id]);
  const gates = PLACES.filter((p) => p.id.startsWith("gate-") && !skip.has(p.id) && passes(start, delta, p.anchor!.angle));
  // Inner stalls and big halls make the best landmarks; skip fine-grained items.
  const candidates = PLACES.filter(
    (p) => p.floor === "G" && p.shape && !skip.has(p.id) && passes(start, delta, placeAngle(p)) && (p.shape.r0 < 4 || p.shape.a1 - p.shape.a0 >= 18),
  ).sort((a, b) => Math.abs(angleDelta(start, placeAngle(a))) - Math.abs(angleDelta(start, placeAngle(b))));

  const picks: Place[] = [];
  const want = Math.min(3, candidates.length);
  for (let i = 0; i < want; i++) picks.push(candidates[Math.floor((i * (candidates.length - 1)) / Math.max(1, want - 1))]);
  const names = [...new Set(picks)].map((p) => (p.code ? `${p.code} ${p.name === "Name not supplied" ? "" : p.name}`.trim() : p.name));
  return [...names, ...gates.map((g) => g.code!)];
}

function joinList(xs: string[]) {
  return xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

function withY([x, , z]: Vec3, y: number): Vec3 {
  return [x, y, z];
}
