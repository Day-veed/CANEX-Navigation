import { describe, expect, it } from "vitest";
import { findRoute, nearest, type Route } from "./routing";
import { GATES, PLACES } from "./venue";

const kinds = (r: Route) => r.steps.map((s) => s.kind);
const text = (r: Route) => r.steps.map((s) => s.text).join(" | ");

describe("findRoute", () => {
  const destinations = PLACES.filter((p) => !p.hidden);

  it.each(GATES.map((g) => g.id))("reaches every destination from %s", (gate) => {
    for (const p of destinations) {
      const r = findRoute(gate, p.id);
      expect(r, `${gate} -> ${p.id}`).not.toBeNull();
      expect(r!.steps.length, `${gate} -> ${p.id}`).toBeGreaterThan(0);
      expect(r!.steps.at(-1)!.kind === "arrive" || r!.steps.some((s) => s.kind === "arrive" || s.kind === "exit"), `${gate} -> ${p.id}: ${text(r!)}`).toBe(true);
      for (const pt of r!.points) expect(pt.every(Number.isFinite), `${gate} -> ${p.id}`).toBe(true);
    }
  });

  it("routes between every pair of places with readable steps", () => {
    let checked = 0;
    for (const a of destinations) {
      for (const b of destinations) {
        const r = findRoute(a.id, b.id);
        expect(r, `${a.id} -> ${b.id}`).not.toBeNull();
        const all = r!.steps.map((s) => `${s.text} ${s.detail ?? ""}`).join(" ");
        expect(all, `${a.id} -> ${b.id}`).not.toMatch(/undefined|NaN|null/);
        expect(r!.steps.some((s) => s.kind === "arrive" || s.kind === "exit"), `${a.id} -> ${b.id}: ${text(r!)}`).toBe(true);
        expect(r!.minutes, `${a.id} -> ${b.id}`).toBeLessThan(15);
        checked++;
      }
    }
    expect(checked).toBe(destinations.length ** 2);
  }, 60_000);

  it("routes between upper-floor booths", () => {
    const r = findRoute("nuit", "hm01")!;
    expect(r.floors).toEqual(["4", "5"]);
    expect(kinds(r).filter((k) => k === "lift")).toHaveLength(1);
  });

  it("turns right from Gate D towards Exhibition 1 and enters through its doors", () => {
    const r = findRoute("gate-d", "ex05")!;
    expect(kinds(r)).toContain("turn-right");
    expect(text(r)).toContain("Exhibition 1 doors");
    expect(r.floors).toEqual(["G"]);
  });

  it("turns left from Gate D to the British Council stall and finds it on the left", () => {
    const r = findRoute("gate-d", "e21")!;
    expect(kinds(r)).toContain("turn-left");
    expect(r.steps.at(-1)!.text).toMatch(/on your left/);
  });

  it("goes straight out of Gate A to the basketball court", () => {
    const r = findRoute("gate-a", "basketball-court")!;
    expect(kinds(r)).toEqual(["start", "exit", "info"]);
  });

  it("takes a single lift ride, at the core nearest the destination", () => {
    const r = findRoute("gate-d", "vip-dining")!;
    const lifts = r.steps.filter((s) => s.kind === "lift");
    expect(lifts).toHaveLength(1);
    expect(lifts[0].text).toContain("Gate A lifts");
    expect(r.floors).toEqual(["G", "4"]);
  });

  it("describes booths inside a block", () => {
    const r = findRoute("gate-c", "fashion-shop-soma")!;
    expect(r.steps.at(-1)!.detail).toContain("Shop Soma is inside");
  });
});

describe("nearest", () => {
  it("never suggests the place you're already at", () => {
    expect(nearest("e11", (p) => p.category === "food")!.id).not.toBe("e11");
  });

  it("finds ground-floor toilets from a gate", () => {
    expect(nearest("gate-d", (p) => p.category === "amenity")!.floor).toBe("G");
  });

  it("finds toilets on the same floor when you're upstairs", () => {
    expect(nearest("hm05", (p) => p.category === "amenity")!.floor).toBe("5");
  });
});
