import { describe, expect, it } from "vitest";
import { destinations, search } from "./search";

const ids = (q: string, ...rest: Parameters<typeof search> extends [string, ...infer R] ? R : never) => search(q, ...rest).map((p) => p.id);

describe("search", () => {
  it("lists every destination for an empty query", () => {
    expect(search("")).toHaveLength(destinations.length);
  });

  it("ranks an exact booth code first", () => {
    expect(ids("E21")[0]).toBe("e21");
    expect(ids("e 21")[0]).toBe("e21");
    expect(ids("hm05")[0]).toBe("hm05");
  });

  it("finds by name, case and punctuation insensitive", () => {
    expect(ids("coffee")[0]).toBe("e11");
    expect(ids("ounje & co")).toContain("ounje-and-co");
    expect(ids("shop soma")).toContain("fashion-shop-soma");
  });

  it("understands everyday words", () => {
    expect(search("restroom").every((p) => p.category === "amenity")).toBe(true);
    expect(search("toilet").length).toBeGreaterThan(0);
    expect(ids("medical")).toContain("gate-c");
  });

  it("filters by floor and category", () => {
    expect(search("", null, "5").every((p) => p.floor === "5")).toBe(true);
    expect(search("", "food").every((p) => p.category === "food")).toBe(true);
  });

  it("returns nothing for gibberish", () => {
    expect(search("zzqqxx")).toEqual([]);
  });
});
