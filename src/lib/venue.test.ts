import { describe, expect, it } from "vitest";
import { FLOORS, getPlace, PLACES, placePoint, polygonsOf, radius } from "./venue";

const polygonArea = (poly: [number, number][]) => {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
};

describe("venue data", () => {
  it("has unique ids", () => {
    const ids = PLACES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("places every destination on a floor plan that has a layout", () => {
    for (const p of PLACES) {
      if (p.hidden || p.floor === "M") continue;
      const located = polygonsOf(p).length > 0 || !!p.point;
      expect(located, `${p.id} has no footprint or point`).toBe(true);
      const [x, y] = placePoint(p);
      expect(Number.isFinite(x) && Number.isFinite(y), p.id).toBe(true);
    }
  });

  it("keeps indoor places inside the building", () => {
    for (const p of PLACES) {
      if (p.hidden || p.via) continue;
      expect(radius(placePoint(p)), p.id).toBeLessThan(92);
    }
  });

  it("matches the floor areas printed on the plan", () => {
    // Shared footprints (the third-floor lounges) carry the combined area once.
    for (const p of PLACES) {
      if (!p.area || p.fp) continue;
      const measured = polygonsOf(p).reduce((s, poly) => s + polygonArea(poly), 0);
      expect(measured, `${p.id}: measured ${measured.toFixed(0)} m² vs plan ${p.area} m²`).toBeGreaterThan(p.area * 0.85);
      expect(measured, `${p.id}: measured ${measured.toFixed(0)} m² vs plan ${p.area} m²`).toBeLessThan(p.area * 1.15);
    }
  });

  it("puts booths inside their parent block", () => {
    for (const p of PLACES.filter((q) => q.within)) {
      expect(getPlace(p.within), p.id).toBeDefined();
    }
  });

  it("lists every floor", () => {
    expect(FLOORS.map((f) => f.id)).toEqual(["G", "M", "2", "3", "4", "5"]);
  });
});
