"use client";

import { CameraControls, Html, Line, Text, useTexture } from "@react-three/drei";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { FLOOR_GAP, toScene, type Route, type Vec3 } from "@/lib/routing";
import {
  bearing,
  CATEGORIES,
  CORES,
  FLOORS,
  floorById,
  footprintOf,
  fromPolar,
  getPlace,
  GATES,
  LIFTS,
  PLACES,
  placePoint,
  polygonsOf,
  type Floor,
  type FloorId,
  type Place,
  type Polygon,
} from "@/lib/venue";

const FONT = "/fonts/inter-600.woff";
const FONT_BOLD = "/fonts/inter-800.woff";
const ROUTE_COLOR = "#e8451e";
const PLAN_HALF = 92;
const INK = "#1f2d29";

/** White or dark ink, whichever reads better on a fill (WCAG contrast). */
function labelInk(fill: string) {
  // Relative luminance from the sRGB hex (THREE.Color would already linearise it).
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const f = lum(fill);
  const ink = lum(INK);
  const onWhite = 1.05 / (f + 0.05);
  const onInk = (f + 0.05) / (ink + 0.05);
  return onWhite >= 4.5 || onWhite >= onInk ? "#ffffff" : INK;
}

export type ViewMode = "3d" | "2d";

interface Props {
  route: Route | null;
  fromId: string;
  toId: string | null;
  floor: FloorId;
  stacked: boolean;
  view: ViewMode;
  onSelect: (id: string) => void;
}

/** Places that own a footprint drawn on the map (one per footprint key). */
const DRAWN = (() => {
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const p of PLACES) {
    if (p.within || p.composite || !polygonsOf(p).length) continue;
    const key = p.fp ?? p.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
})();

/** Label for a footprint shared by several places. */
const sharedName = (p: Place) => {
  if (!p.fp) return null;
  const all = PLACES.filter((q) => q.fp === p.fp);
  return all.length > 1 ? all.map((q) => q.name.replace(/ Lounge$/, "")).join(" · ") + " Lounge" : null;
};

export default function VenueScene({ route, fromId, toId, floor, stacked, view, onSelect }: Props) {
  const to = getPlace(toId);
  const from = getPlace(fromId);
  const focus = useMemo(() => {
    const ids = new Set<string>();
    for (const p of [to, from]) {
      if (!p) continue;
      const f = footprintOf(p);
      ids.add(f.fp ?? f.id);
      // Zones like "Literature Booths" highlight their member booths.
      if (p.composite) for (const q of PLACES) if (q.zone === p.name) ids.add(q.fp ?? q.id);
    }
    return ids;
  }, [to, from]);

  const visible = useMemo(() => {
    if (stacked) return new Set(FLOORS.map((f) => f.id));
    return new Set<FloorId>([floor, ...(route?.floors ?? [])]);
  }, [stacked, floor, route]);

  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 150, 130], fov: 42, near: 1, far: 2000 }} onPointerMissed={() => (document.body.style.cursor = "")}>
      <color attach="background" args={["#e9eeeb"]} />
      <hemisphereLight args={["#ffffff", "#b9c4bf", 1.5]} />
      <directionalLight position={[60, 140, 80]} intensity={1.5} />

      <mesh rotation-x={-Math.PI / 2} position-y={-0.05}>
        <circleGeometry args={[260, 64]} />
        <meshStandardMaterial color="#dfe6e2" />
      </mesh>

      <Suspense fallback={null}>
        {FLOORS.filter((f) => visible.has(f.id)).map((f) => (
          <FloorLayer
            key={f.id}
            floor={f}
            active={f.id === floor || route?.to.floor === f.id}
            dimmed={!!route && !route.floors.includes(f.id)}
            seeThrough={visible.size > 1 && f.level > 0}
            showName={visible.size > 1}
            focus={focus}
            hasRoute={!!route}
            onSelect={onSelect}
          />
        ))}
      </Suspense>

      {route && route.points.length > 1 && <RoutePath points={route.points} />}
      {from && <Marker position={route?.points[0] ?? toScene(from.floor, placePoint(from))} label="You are here" tone="start" />}
      {to && to.id !== from?.id && <Marker position={route?.points[route.points.length - 1] ?? toScene(to.floor, placePoint(to))} label={to.code && !to.code.includes("–") ? to.code : to.name} tone="end" />}

      <CameraRig view={view} route={route} floor={floor} stacked={stacked} />
    </Canvas>
  );
}

// ---------------------------------------------------------------- floors

function FloorLayer({
  floor,
  active,
  dimmed,
  seeThrough,
  showName,
  focus,
  hasRoute,
  onSelect,
}: {
  floor: Floor;
  active: boolean;
  dimmed: boolean;
  seeThrough: boolean;
  showName: boolean;
  focus: Set<string>;
  hasRoute: boolean;
  onSelect: (id: string) => void;
}) {
  const y = floor.level * FLOOR_GAP;
  const places = DRAWN.filter((p) => p.floor === floor.id);
  return (
    <group position-y={y}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.01}>
        <circleGeometry args={[90, 128]} />
        <meshStandardMaterial color="#f7f8f6" transparent opacity={floor.level === 0 ? 1 : dimmed ? 0.3 : seeThrough ? 0.55 : 0.92} depthWrite={floor.level === 0} />
      </mesh>
      {floor.plan && <Backdrop url={floor.plan} opacity={dimmed ? 0.35 : 1} />}
      {!floor.plan && <NoPlan />}
      {places.map((p) => {
        const key = p.fp ?? p.id;
        return <Booth key={key} place={p} focused={focus.has(key)} dimmed={dimmed || (hasRoute && !focus.has(key))} onSelect={onSelect} />;
      })}
      {floor.id === "G" && (
        <>
          {GATES.map((g) => (
            <Gate key={g.id} place={g} focused={focus.has(g.id)} onSelect={onSelect} />
          ))}
          <BasketballCourt focused={focus.has("basketball-court")} onSelect={onSelect} />
          <FoodHub focused={focus.has("food-hub")} onSelect={onSelect} />
        </>
      )}
      <Lifts showLabels={active} />
      {showName && (
        <Html position={[fromPolar(300, 96)[0], 2, fromPolar(300, 96)[1]]} center zIndexRange={[10, 0]}>
          <div className={`pointer-events-none whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-semibold shadow ${active ? "bg-[#1f2d29] text-white" : "bg-white/90 text-[#3a4743]"}`}>{floor.name}</div>
        </Html>
      )}
    </group>
  );
}

function Backdrop({ url, opacity }: { url: string; opacity: number }) {
  const tex = useTexture(url, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
  });
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
      <planeGeometry args={[PLAN_HALF * 2, PLAN_HALF * 2]} />
      <meshBasicMaterial map={tex} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function NoPlan() {
  const ring = useMemo(() => Array.from({ length: 97 }, (_, i) => toScene("G", fromPolar((i * 360) / 96, 62))), []);
  return (
    <>
      <Line points={ring} color="#9aa8a3" lineWidth={1} dashed dashSize={3} gapSize={2} />
      <Text font={FONT} position={[0, 0.2, 0]} rotation-x={-Math.PI / 2} fontSize={4} color="#7f8f89">
        No layout in the V24 plans
      </Text>
    </>
  );
}

// ---------------------------------------------------------------- booths

function shapesOf(polys: Polygon[]) {
  // Plan y points south; the shape is built in x/-y then laid flat.
  return polys.map((poly) => new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, -y))));
}

function areaOf(polys: Polygon[]) {
  let a = 0;
  for (const poly of polys) for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
}

function heightOf(p: Place, area: number) {
  if (p.category === "amenity") return 0.8;
  if (p.category === "venue" && area > 400) return 0.6;
  if (area > 400) return 0.8;
  if (area > 150) return 2.8;
  if (area > 40) return 2.5;
  return 2.1;
}

function usePointer(onSelect: (id: string) => void, id: string) {
  const [hovered, setHovered] = useState(false);
  return {
    hovered,
    handlers: {
      onClick: (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect(id);
      },
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      },
      onPointerOut: () => {
        setHovered(false);
        document.body.style.cursor = "";
      },
    },
  };
}

function Booth({ place, focused, dimmed, onSelect }: { place: Place; focused: boolean; dimmed: boolean; onSelect: (id: string) => void }) {
  const polys = polygonsOf(place);
  const area = useMemo(() => areaOf(polys), [polys]);
  const h = heightOf(place, area);
  const geometry = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(shapesOf(polys), { depth: h, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [polys, h]);
  const ref = useRef<THREE.Group>(null);
  const { hovered, handlers } = usePointer(onSelect, place.id);
  const base = CATEGORIES[place.category].color;
  const color = useMemo(() => {
    const c = new THREE.Color(base);
    if (dimmed) c.lerp(new THREE.Color("#eef1ef"), 0.65);
    if (hovered) c.offsetHSL(0, 0, 0.08);
    return c;
  }, [base, dimmed, hovered]);

  useFrame((state, dt) => {
    if (!ref.current) return;
    const lift = focused ? 1.2 + Math.sin(state.clock.elapsedTime * 3) * 0.35 : 0;
    ref.current.position.y = THREE.MathUtils.damp(ref.current.position.y, lift, 8, dt);
  });

  const centre = placePoint(place);
  const angle = bearing(centre);
  const shared = sharedName(place);
  const small = area < 14;
  const text = place.category === "amenity" ? "WC" : small ? place.code ?? place.name : shared ?? (place.code && !place.code.includes("–") ? `${place.code}\n${place.name}` : place.name);
  const size = THREE.MathUtils.clamp(Math.sqrt(area) * (small ? 0.24 : 0.13), 0.45, 3.2);
  const flip = angle > 90 && angle < 270;

  return (
    <group ref={ref}>
      <mesh geometry={geometry} {...handlers}>
        <meshStandardMaterial color={color} emissive={focused ? base : "#000000"} emissiveIntensity={focused ? 0.35 : 0} roughness={0.75} />
      </mesh>
      {!dimmed || focused ? (
        <group position={[centre[0], h + 0.05, centre[1]]} rotation={[0, (-angle * Math.PI) / 180, 0]}>
          <Text
            font={small ? FONT : FONT_BOLD}
            rotation={[-Math.PI / 2, 0, flip ? Math.PI : 0]}
            fontSize={size}
            maxWidth={Math.sqrt(area) * 1.1}
            textAlign="center"
            anchorX="center"
            anchorY="middle"
            lineHeight={1.1}
            color={labelInk(base)}
          >
            {text}
          </Text>
        </group>
      ) : null}
    </group>
  );
}

function Gate({ place, focused, onSelect }: { place: Place; focused: boolean; onSelect: (id: string) => void }) {
  const angle = bearing(place.point!);
  const [x, z] = fromPolar(angle, 76);
  const { hovered, handlers } = usePointer(onSelect, place.id);
  const color = new THREE.Color(CATEGORIES[place.category].color);
  if (hovered) color.offsetHSL(0, 0, 0.08);
  const flip = angle > 90 && angle < 270;
  const ink = labelInk(CATEGORIES[place.category].color);
  return (
    <group position={[x, 0, z]} rotation={[0, (-angle * Math.PI) / 180, 0]}>
      <mesh position-y={1.5} {...handlers}>
        <boxGeometry args={[22, 3, 7]} />
        <meshStandardMaterial color={color} emissive={focused ? color : "#000"} emissiveIntensity={focused ? 0.3 : 0} />
      </mesh>
      <group position-y={3.05} rotation={[-Math.PI / 2, 0, flip ? Math.PI : 0]}>
        <Text font={FONT_BOLD} fontSize={2.4} position-y={0.9} color={ink} anchorX="center" anchorY="middle">
          {place.code!.toUpperCase()}
        </Text>
        <Text font={FONT} fontSize={1.15} position-y={-1.5} maxWidth={20} textAlign="center" color={ink} anchorX="center" anchorY="middle">
          {place.name.toUpperCase()}
        </Text>
      </group>
    </group>
  );
}

function BasketballCourt({ focused, onSelect }: { focused: boolean; onSelect: (id: string) => void }) {
  const p = getPlace("basketball-court")!;
  const { hovered, handlers } = usePointer(onSelect, p.id);
  const [x, y] = p.point!;
  const w = 15;
  const d = 28;
  const l = (pts: [number, number][]) => pts.map(([a, b]) => [a, 0.45, b] as Vec3);
  return (
    <group position={[x, 0, y]}>
      <mesh position-y={0.2} {...handlers}>
        <boxGeometry args={[w, 0.4, d]} />
        <meshStandardMaterial color={hovered ? "#4a8ee0" : CATEGORIES.venue.color} emissive={focused ? CATEGORIES.venue.color : "#000"} emissiveIntensity={focused ? 0.35 : 0} />
      </mesh>
      <Line points={l([[-w / 2 + 0.6, -d / 2 + 0.6], [w / 2 - 0.6, -d / 2 + 0.6], [w / 2 - 0.6, d / 2 - 0.6], [-w / 2 + 0.6, d / 2 - 0.6], [-w / 2 + 0.6, -d / 2 + 0.6]])} color="#fff" lineWidth={1.5} />
      <Line points={l([[-w / 2 + 0.6, 0], [w / 2 - 0.6, 0]])} color="#fff" lineWidth={1.5} />
      <mesh rotation-x={-Math.PI / 2} position-y={0.45}>
        <ringGeometry args={[1.7, 1.9, 40]} />
        <meshBasicMaterial color="#fff" />
      </mesh>
      <Text font={FONT_BOLD} position={[w / 2 + 2.2, 0.5, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} fontSize={2} color="#1f2d29">
        BASKETBALL COURT
      </Text>
    </group>
  );
}

function FoodHub({ focused, onSelect }: { focused: boolean; onSelect: (id: string) => void }) {
  const p = getPlace("food-hub")!;
  const { hovered, handlers } = usePointer(onSelect, p.id);
  const color = new THREE.Color(CATEGORIES.food.color);
  if (hovered) color.offsetHSL(0, 0, 0.08);
  return (
    <group position={[p.point![0], 0, p.point![1]]}>
      <mesh position-y={1.6} {...handlers}>
        <boxGeometry args={[22, 3.2, 11]} />
        <meshStandardMaterial color={color} emissive={focused ? color : "#000"} emissiveIntensity={focused ? 0.3 : 0} />
      </mesh>
      <Text font={FONT_BOLD} position={[0, 3.25, 0]} rotation-x={-Math.PI / 2} fontSize={2.6} color={labelInk(CATEGORIES.food.color)}>
        FOOD HUB
      </Text>
    </group>
  );
}

function Lifts({ showLabels }: { showLabels: boolean }) {
  return (
    <group>
      {LIFTS.map(([x, y], i) => (
        <mesh key={i} position={[x, 1.6, y]} rotation-y={(-bearing([x, y]) * Math.PI) / 180}>
          <boxGeometry args={[4.6, 3.2, 3.4]} />
          <meshStandardMaterial color="#4b5a55" transparent opacity={0.85} />
        </mesh>
      ))}
      {showLabels &&
        CORES.map((c) => (
          <Html key={c.id} position={[c.point[0], 5, c.point[1]]} center zIndexRange={[10, 0]}>
            <div className="pointer-events-none whitespace-nowrap rounded-md bg-[#2f3b37]/90 px-1.5 py-0.5 text-[11px] font-semibold text-white shadow">{c.name}</div>
          </Html>
        ))}
    </group>
  );
}

// ---------------------------------------------------------------- route

function RoutePath({ points }: { points: Vec3[] }) {
  const lineRef = useRef<{ material: { dashOffset: number } } | null>(null);
  const walker = useRef<THREE.Mesh>(null);
  const lifted = useMemo(() => points.map(([x, y, z]) => [x, y + 0.6, z] as Vec3), [points]);
  const { cumulative, total } = useMemo(() => {
    const cumulative = [0];
    for (let i = 1; i < lifted.length; i++) {
      const [ax, ay, az] = lifted[i - 1];
      const [bx, by, bz] = lifted[i];
      cumulative.push(cumulative[i - 1] + Math.hypot(bx - ax, by - ay, bz - az));
    }
    return { cumulative, total: cumulative[cumulative.length - 1] };
  }, [lifted]);

  useFrame((state, dt) => {
    if (lineRef.current) lineRef.current.material.dashOffset -= dt * 8;
    if (!walker.current || total === 0) return;
    const t = Math.min((state.clock.elapsedTime * 22) % (total + 20), total);
    let i = 1;
    while (i < cumulative.length - 1 && cumulative[i] < t) i++;
    const k = (t - cumulative[i - 1]) / (cumulative[i] - cumulative[i - 1] || 1);
    const a = lifted[i - 1];
    const b = lifted[i];
    walker.current.position.set(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k + 0.8, a[2] + (b[2] - a[2]) * k);
  });

  return (
    <group>
      <Line points={lifted} color="#ffffff" lineWidth={10} transparent opacity={0.9} />
      <Line ref={lineRef as never} points={lifted} color={ROUTE_COLOR} lineWidth={5} dashed dashSize={3} gapSize={1.6} />
      <mesh ref={walker}>
        <sphereGeometry args={[1.3, 24, 24]} />
        <meshStandardMaterial color={ROUTE_COLOR} emissive={ROUTE_COLOR} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

function Marker({ position, label, tone }: { position: Vec3; label: string; tone: "start" | "end" }) {
  const color = tone === "start" ? "#1f2d29" : ROUTE_COLOR;
  return (
    <group position={position}>
      <mesh rotation-x={Math.PI} position-y={2.6}>
        <coneGeometry args={[1.4, 4.4, 20]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position-y={5.6}>
        <sphereGeometry args={[1.8, 24, 24]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Html position={[0, 9.5, 0]} center zIndexRange={[20, 10]}>
        <div className="pointer-events-none whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold text-white shadow-lg" style={{ background: color }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

// ---------------------------------------------------------------- camera

function CameraRig({ view, route, floor, stacked }: { view: ViewMode; route: Route | null; floor: FloorId; stacked: boolean }) {
  const ref = useRef<CameraControls>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.minPolarAngle = 0;
    c.maxPolarAngle = view === "2d" ? 0 : Math.PI * 0.42;
  }, [view]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    let centre: THREE.Vector3;
    let r: number;
    // Frame the route unless the visitor picked another floor (or the stack) to look at.
    if (route && route.points.length > 1 && !stacked && route.floors.includes(floor)) {
      const sphere = new THREE.Box3().setFromPoints(route.points.map((p) => new THREE.Vector3(...p))).getBoundingSphere(new THREE.Sphere());
      centre = sphere.center;
      r = Math.max(sphere.radius + (route.floors.length > 1 ? 34 : 18), 40);
    } else if (stacked) {
      centre = new THREE.Vector3(0, (FLOORS.length - 1) * FLOOR_GAP * 0.5, 0);
      r = 120;
    } else {
      centre = new THREE.Vector3(0, floorById(floor).level * FLOOR_GAP, 0);
      r = 95;
    }
    const d = r * 2.3;
    const [x, y, z] = centre.toArray();
    if (view === "2d") c.setLookAt(x, y + d * 1.15, z + 0.01, x, y, z, true);
    else c.setLookAt(x, y + d * 0.8, z + d * 0.72, x, y, z, true);
  }, [route, view, floor, stacked]);

  return <CameraControls ref={ref} makeDefault minDistance={12} maxDistance={600} dollySpeed={0.6} />;
}
