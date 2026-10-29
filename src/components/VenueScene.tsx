"use client";

import { CameraControls, Html, Line, Text } from "@react-three/drei";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { FLOOR_GAP, placePoint, polar, type Route, type Vec3 } from "@/lib/routing";
import { CATEGORIES, FLOORS, footprintOf, getPlace, PLACES, RING, type Place, type Sector } from "@/lib/venue";

const FONT = "/fonts/inter-600.woff";
const FONT_BOLD = "/fonts/inter-800.woff";
const ROUTE_COLOR = "#e8451e";

export type ViewMode = "3d" | "2d";

interface Props {
  route: Route | null;
  fromId: string;
  toId: string | null;
  view: ViewMode;
  showFloors: boolean;
  onSelect: (id: string) => void;
}

export default function VenueScene({ route, fromId, toId, view, showFloors, onSelect }: Props) {
  const to = getPlace(toId);
  const from = getPlace(fromId);
  const focus = useMemo(() => {
    const ids = new Set<string>();
    if (to) ids.add(footprintOf(to).id);
    if (from) ids.add(footprintOf(from).id);
    return ids;
  }, [to, from]);
  const targetLevel = to && to.floor !== "G" ? FLOORS.find((f) => f.id === to.floor)!.level : null;
  const fromLevel = from && from.floor !== "G" ? FLOORS.find((f) => f.id === from.floor)!.level : null;
  const floorsVisible = showFloors || targetLevel !== null || fromLevel !== null;

  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 13, 11], fov: 45, near: 0.1, far: 200 }} onPointerMissed={() => (document.body.style.cursor = "")}>
      <color attach="background" args={["#e9eeeb"]} />
      <hemisphereLight args={["#ffffff", "#b9c4bf", 1.6]} />
      <directionalLight position={[6, 14, 8]} intensity={1.6} />

      <Ground />
      {PLACES.filter((p) => p.shape).map((p) => (
        <Booth key={p.id} place={p} focused={focus.has(p.id)} dimmed={!!route && !focus.has(p.id)} onSelect={onSelect} />
      ))}
      {PLACES.filter((p) => p.id.startsWith("gate-")).map((p) => (
        <Gate key={p.id} place={p} focused={focus.has(p.id)} onSelect={onSelect} />
      ))}
      <BasketballCourt focused={focus.has("basketball-court")} onSelect={onSelect} />
      <FoodHub focused={focus.has("food-hub")} onSelect={onSelect} />
      <Core height={floorsVisible ? 5 * FLOOR_GAP : 0.9} />
      {floorsVisible && <UpperFloors highlight={[targetLevel, fromLevel]} />}

      {route && route.points.length > 1 && <RoutePath points={route.points} />}
      {from && <Marker position={endPoint(from, route, "start")} label="You are here" tone="start" />}
      {to && to.id !== from?.id && <Marker position={endPoint(to, route, "end")} label={to.code ?? to.name} tone="end" />}

      <CameraRig view={view} route={route} />
    </Canvas>
  );
}

function endPoint(p: Place, route: Route | null, which: "start" | "end"): Vec3 {
  if (route && route.points.length) return which === "start" ? route.points[0] : route.points[route.points.length - 1];
  return placePoint(p);
}

// Geometry helpers

function sectorShape(s: Sector) {
  const phi = (a: number) => ((90 - a) * Math.PI) / 180;
  const p0 = phi(s.a0);
  const p1 = phi(s.a1);
  const shape = new THREE.Shape();
  shape.moveTo(s.r1 * Math.cos(p0), s.r1 * Math.sin(p0));
  shape.absarc(0, 0, s.r1, p0, p1, true);
  shape.lineTo(s.r0 * Math.cos(p1), s.r0 * Math.sin(p1));
  shape.absarc(0, 0, s.r0, p1, p0, false);
  shape.closePath();
  return shape;
}

function useSectorGeometry(s: Sector) {
  return useMemo(() => {
    const g = new THREE.ExtrudeGeometry(sectorShape(s), { depth: s.h ?? 0.4, bevelEnabled: false, curveSegments: 32 });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [s]);
}

/** Text lying flat on the floor, oriented to read along the ring. */
function FlatLabel({ angle, r, y, children, size, maxWidth, bold }: { angle: number; r: number; y: number; children: string; size: number; maxWidth?: number; bold?: boolean }) {
  const flip = angle > 90 && angle < 270;
  return (
    <group rotation={[0, (-angle * Math.PI) / 180, 0]}>
      <Text
        font={bold ? FONT_BOLD : FONT}
        position={[0, y, -r]}
        rotation={[-Math.PI / 2, 0, flip ? Math.PI : 0]}
        fontSize={size}
        maxWidth={maxWidth}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        lineHeight={1.1}
        color="#ffffff"
      >
        {children}
      </Text>
    </group>
  );
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

// Scene pieces

function Ground() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
        <circleGeometry args={[40, 64]} />
        <meshStandardMaterial color="#dfe6e2" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0}>
        <circleGeometry args={[RING.floorEdge, 128]} />
        <meshStandardMaterial color="#f7f8f6" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.01}>
        <ringGeometry args={[RING.concourseInner, RING.concourseOuter, 128]} />
        <meshStandardMaterial color="#d3dcd7" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.012}>
        <circleGeometry args={[RING.atrium, 96]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {[0, 90, 180, 270].map((a) => (
        <mesh key={a} rotation={[-Math.PI / 2, 0, (-a * Math.PI) / 180]} position={polar(a, (RING.concourseOuter + RING.gate) / 2, 0.011)}>
          <planeGeometry args={[0.55, RING.gate - RING.concourseOuter]} />
          <meshStandardMaterial color="#d3dcd7" />
        </mesh>
      ))}
      <Text font={FONT_BOLD} position={[0, 0.03, -0.25]} rotation-x={-Math.PI / 2} fontSize={0.42} color="#20302b">
        GROUND FLOOR
      </Text>
      <Text font={FONT} position={[0, 0.03, 0.35]} rotation-x={-Math.PI / 2} fontSize={0.17} color="#5d6d67" maxWidth={3.6} textAlign="center">
        Follow the circular concourse
      </Text>
    </group>
  );
}

function Booth({ place, focused, dimmed, onSelect }: { place: Place; focused: boolean; dimmed: boolean; onSelect: (id: string) => void }) {
  const s = place.shape!;
  const geometry = useSectorGeometry(s);
  const ref = useRef<THREE.Group>(null);
  const { hovered, handlers } = usePointer(onSelect, place.id);
  const base = CATEGORIES[place.category].color;
  const color = useMemo(() => {
    const c = new THREE.Color(base);
    if (dimmed) c.lerp(new THREE.Color("#f2f4f3"), 0.6);
    if (hovered) c.offsetHSL(0, 0, 0.08);
    return c;
  }, [base, dimmed, hovered]);

  useFrame((state, dt) => {
    if (!ref.current) return;
    const lift = focused ? 0.18 + Math.sin(state.clock.elapsedTime * 3) * 0.05 : 0;
    ref.current.position.y = THREE.MathUtils.damp(ref.current.position.y, lift, 8, dt);
  });

  const h = s.h ?? 0.4;
  const angle = (s.a0 + s.a1) / 2;
  const rMid = (s.r0 + s.r1) / 2;
  const arc = ((s.a1 - s.a0) * Math.PI * rMid) / 180;
  const isStall = s.r1 - s.r0 < 1;
  const text = isStall ? place.code ?? place.name : place.code ? `${place.code}\n${place.name}` : place.name;
  const size = isStall ? 0.16 : arc < 2.2 ? 0.17 : 0.26;

  return (
    <group ref={ref}>
      <mesh geometry={geometry} {...handlers}>
        <meshStandardMaterial color={color} emissive={focused ? base : "#000000"} emissiveIntensity={focused ? 0.35 : 0} roughness={0.7} />
      </mesh>
      <FlatLabel angle={angle} r={rMid} y={h + 0.01} size={size} maxWidth={isStall ? undefined : arc * 0.85} bold={!isStall}>
        {text}
      </FlatLabel>
    </group>
  );
}

function Gate({ place, focused, onSelect }: { place: Place; focused: boolean; onSelect: (id: string) => void }) {
  const { angle, r } = place.anchor!;
  const { hovered, handlers } = usePointer(onSelect, place.id);
  const color = new THREE.Color(CATEGORIES[place.category].color);
  if (hovered) color.offsetHSL(0, 0, 0.08);
  const flip = angle > 90 && angle < 270;
  return (
    <group position={polar(angle, r)} rotation={[0, (-angle * Math.PI) / 180, 0]}>
      <mesh position-y={0.25} {...handlers}>
        <boxGeometry args={[2.2, 0.5, 0.7]} />
        <meshStandardMaterial color={color} emissive={focused ? color : "#000"} emissiveIntensity={focused ? 0.3 : 0} />
      </mesh>
      <group position-y={0.51} rotation={[-Math.PI / 2, 0, flip ? Math.PI : 0]}>
        <Text font={FONT_BOLD} fontSize={0.2} position-y={0.09} color="#fff" anchorX="center" anchorY="middle">
          {place.code!.toUpperCase()}
        </Text>
        <Text font={FONT} fontSize={0.11} position-y={-0.14} maxWidth={2} textAlign="center" color="#fff" anchorX="center" anchorY="middle">
          {place.name.toUpperCase()}
        </Text>
      </group>
    </group>
  );
}

function BasketballCourt({ focused, onSelect }: { focused: boolean; onSelect: (id: string) => void }) {
  const p = getPlace("basketball-court")!;
  const { hovered, handlers } = usePointer(onSelect, p.id);
  const pos = polar(p.anchor!.angle, p.anchor!.r);
  const line = "#ffffff";
  const w = 2.4;
  const d = 1.5;
  return (
    <group position={pos}>
      <mesh position-y={0.04} {...handlers}>
        <boxGeometry args={[w, 0.08, d]} />
        <meshStandardMaterial color={hovered ? "#6f9e49" : CATEGORIES.outdoor.color} emissive={focused ? CATEGORIES.outdoor.color : "#000"} emissiveIntensity={focused ? 0.35 : 0} />
      </mesh>
      <Line points={[[-w / 2 + 0.1, 0.09, -d / 2 + 0.1], [w / 2 - 0.1, 0.09, -d / 2 + 0.1], [w / 2 - 0.1, 0.09, d / 2 - 0.1], [-w / 2 + 0.1, 0.09, d / 2 - 0.1], [-w / 2 + 0.1, 0.09, -d / 2 + 0.1]]} color={line} lineWidth={1.5} />
      <Line points={[[0, 0.09, -d / 2 + 0.1], [0, 0.09, d / 2 - 0.1]]} color={line} lineWidth={1.5} />
      <mesh rotation-x={-Math.PI / 2} position-y={0.09}>
        <ringGeometry args={[0.2, 0.23, 32]} />
        <meshBasicMaterial color={line} />
      </mesh>
      <Text font={FONT_BOLD} position={[0, 0.1, d / 2 + 0.25]} rotation-x={-Math.PI / 2} fontSize={0.2} color="#3d5a26">
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
    <group position={polar(p.anchor!.angle, p.anchor!.r)}>
      <mesh position-y={0.3} {...handlers}>
        <boxGeometry args={[2.2, 0.6, 1.1]} />
        <meshStandardMaterial color={color} emissive={focused ? color : "#000"} emissiveIntensity={focused ? 0.3 : 0} />
      </mesh>
      <Text font={FONT_BOLD} position={[0, 0.61, 0]} rotation-x={-Math.PI / 2} fontSize={0.24} color="#fff">
        FOOD HUB
      </Text>
    </group>
  );
}

function Core({ height }: { height: number }) {
  const p = getPlace("core")!;
  const [x, , z] = polar(p.anchor!.angle, p.anchor!.r);
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={height / 2}>
        <cylinderGeometry args={[0.22, 0.22, height, 24]} />
        <meshStandardMaterial color="#4b5a55" transparent opacity={0.85} />
      </mesh>
      <Html position={[0, height + 0.25, 0]} center distanceFactor={14} zIndexRange={[10, 0]}>
        <div className="pointer-events-none whitespace-nowrap rounded-md bg-[#2f3b37] px-2 py-1 text-[11px] font-semibold text-white shadow">Stairs & lifts (TBC)</div>
      </Html>
    </group>
  );
}

function UpperFloors({ highlight }: { highlight: (number | null)[] }) {
  return (
    <group>
      {FLOORS.filter((f) => f.level > 0).map((f) => {
        const active = highlight.includes(f.level);
        const y = f.level * FLOOR_GAP;
        return (
          <group key={f.id} position-y={y}>
            <mesh rotation-x={-Math.PI / 2}>
              <ringGeometry args={[RING.concourseInner, 6.6, 96]} />
              <meshBasicMaterial color={active ? "#e8451e" : "#7f8f89"} transparent opacity={active ? 0.1 : 0.04} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
            <Line points={ringOutline(6.6)} color={active ? "#e8451e" : "#9aa8a3"} lineWidth={active ? 2.5 : 1} transparent opacity={active ? 0.9 : 0.5} />
            <Line points={ringOutline(RING.concourseInner)} color={active ? "#e8451e" : "#9aa8a3"} lineWidth={active ? 2 : 1} transparent opacity={active ? 0.7 : 0.4} />
            <Html position={polar(20, 6.9)} center distanceFactor={16} zIndexRange={[10, 0]}>
              <div className={`pointer-events-none whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold shadow ${active ? "bg-[#e8451e] text-white" : "bg-white/85 text-[#3a4743]"}`}>{f.name}</div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

function ringOutline(r: number): Vec3[] {
  return Array.from({ length: 97 }, (_, i) => polar((i * 360) / 96, r));
}

function RoutePath({ points }: { points: Vec3[] }) {
  const lineRef = useRef<{ material: { dashOffset: number } } | null>(null);
  const walker = useRef<THREE.Mesh>(null);
  const { cumulative, total } = useMemo(() => {
    const cumulative = [0];
    for (let i = 1; i < points.length; i++) {
      const [ax, ay, az] = points[i - 1];
      const [bx, by, bz] = points[i];
      cumulative.push(cumulative[i - 1] + Math.hypot(bx - ax, by - ay, bz - az));
    }
    return { cumulative, total: cumulative[cumulative.length - 1] };
  }, [points]);

  useFrame((state, dt) => {
    if (lineRef.current) lineRef.current.material.dashOffset -= dt * 1.2;
    if (!walker.current || total === 0) return;
    const d = ((state.clock.elapsedTime * 2.2) % (total + 1.5)) - 0;
    const t = Math.min(d, total);
    let i = 1;
    while (i < cumulative.length - 1 && cumulative[i] < t) i++;
    const seg = cumulative[i] - cumulative[i - 1] || 1;
    const k = (t - cumulative[i - 1]) / seg;
    const a = points[i - 1];
    const b = points[i];
    walker.current.position.set(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k + 0.12, a[2] + (b[2] - a[2]) * k);
  });

  return (
    <group>
      <Line points={points} color="#ffffff" lineWidth={9} transparent opacity={0.9} />
      <Line ref={lineRef as never} points={points} color={ROUTE_COLOR} lineWidth={5} dashed dashSize={0.35} gapSize={0.18} />
      <mesh ref={walker}>
        <sphereGeometry args={[0.13, 24, 24]} />
        <meshStandardMaterial color={ROUTE_COLOR} emissive={ROUTE_COLOR} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

function Marker({ position, label, tone }: { position: Vec3; label: string; tone: "start" | "end" }) {
  const color = tone === "start" ? "#1f2d29" : ROUTE_COLOR;
  return (
    <group position={position}>
      <mesh rotation-x={Math.PI} position-y={0.32}>
        <coneGeometry args={[0.17, 0.55, 20]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position-y={0.66}>
        <sphereGeometry args={[0.2, 24, 24]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Html position={[0, 1.2, 0]} center zIndexRange={[20, 10]}>
        <div className="pointer-events-none whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold text-white shadow-lg" style={{ background: color }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

function CameraRig({ view, route }: { view: ViewMode; route: Route | null }) {
  const ref = useRef<CameraControls>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    if (view === "2d") {
      c.minPolarAngle = 0;
      c.maxPolarAngle = 0;
    } else {
      c.minPolarAngle = 0;
      c.maxPolarAngle = Math.PI * 0.42;
    }
  }, [view]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    if (route && route.points.length > 1) {
      const box = new THREE.Box3().setFromPoints(route.points.map((p) => new THREE.Vector3(...p)));
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      sphere.radius = Math.max(sphere.radius + 1.2, 3.5);
      const dist = sphere.radius * 2.6;
      const [cx, cy, cz] = sphere.center.toArray();
      if (view === "2d") c.setLookAt(cx, cy + dist * 1.2, cz + 0.001, cx, cy, cz, true);
      else c.setLookAt(cx, cy + dist * 0.85, cz + dist * 0.75, cx, cy, cz, true);
    } else if (view === "2d") {
      c.setLookAt(0, 24, 0.001, 0, 0, 0, true);
    } else {
      c.setLookAt(0, 13, 11, 0, 0, 0, true);
    }
  }, [route, view]);

  return <CameraControls ref={ref} makeDefault minDistance={3} maxDistance={40} dollySpeed={0.6} />;
}
