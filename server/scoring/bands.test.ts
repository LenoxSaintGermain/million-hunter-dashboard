import { describe, it, expect } from "vitest";
import { bandPoints, resolveFactor, scoreDimensions, gatesPass, failedGates } from "./bands";
import { scoreGenericAsset } from "./genericScore";
import { getAssetClass } from "../../shared/assetClasses";

describe("bandPoints", () => {
  const bands = [{ gte: 0.9, points: 15 }, { gte: 0.85, points: 11 }, { gte: 0.75, points: 6 }, { gt: 0, points: 2 }];

  it("takes the first matching band, not the best one", () => {
    expect(bandPoints(0.95, bands)).toBe(15);
    expect(bandPoints(0.86, bands)).toBe(11);
    expect(bandPoints(0.8, bands)).toBe(6);
    expect(bandPoints(0.1, bands)).toBe(2);
  });

  it("returns null when nothing matches rather than guessing", () => {
    expect(bandPoints(0, bands)).toBeNull();
  });

  it("handles descending (lte) bands and exact eq matches", () => {
    expect(bandPoints(4, [{ lte: 5, points: 15 }, { lte: 7, points: 10 }])).toBe(15);
    expect(bandPoints(6, [{ lte: 5, points: 15 }, { lte: 7, points: 10 }])).toBe(10);
    expect(bandPoints(3, [{ eq: 3, points: 9 }, { gt: 0, points: 1 }])).toBe(9);
    expect(bandPoints(4, [{ eq: 3, points: 9 }, { gt: 0, points: 1 }])).toBe(1);
  });
});

describe("resolveFactor — a gap never scores as good news", () => {
  const get = (v: Record<string, any>) => (k: string) => v[k];

  it("scores a missing field at `missing` and can raise VERIFY", () => {
    const f = { key: "occ", label: "Occupancy", max: 15, field: "occupancyRate", missing: 4, verifyWhenMissing: true, bands: [{ gte: 0.9, points: 15 }] };
    const r = resolveFactor(f, get({}));
    expect(r.points).toBe(4);
    expect(r.verify).toBe(true);
    expect(r.note).toMatch(/conservative/);
  });

  it("defaults a missing field to zero when no `missing` is declared", () => {
    const f = { key: "x", label: "X", max: 10, field: "nope", bands: [{ gte: 1, points: 10 }] };
    expect(resolveFactor(f, get({})).points).toBe(0);
  });

  it("treats empty string as missing, but zero as a real value", () => {
    const f = { key: "x", label: "X", max: 10, field: "v", missing: 3, bands: [{ gt: 0, points: 10 }] };
    expect(resolveFactor(f, get({ v: "" })).points).toBe(3);
    expect(resolveFactor(f, get({ v: 0 })).points).toBe(0); // present, but no band matches
  });

  it("accepts truthy boolean spellings for whenTrue", () => {
    const f = { key: "b", label: "B", max: 5, field: "flag", whenTrue: 5 };
    expect(resolveFactor(f, get({ flag: true })).points).toBe(5);
    expect(resolveFactor(f, get({ flag: "true" })).points).toBe(5);
    expect(resolveFactor(f, get({ flag: 1 })).points).toBe(5);
    expect(resolveFactor(f, get({ flag: false })).points).toBe(0);
  });

  it("maps select values and scores unknown options at zero", () => {
    const f = { key: "m", label: "M", max: 10, field: "grade", map: { high: 10, low: 2 } };
    expect(resolveFactor(f, get({ grade: "high" })).points).toBe(10);
    expect(resolveFactor(f, get({ grade: "sideways" })).points).toBe(0);
  });
});

describe("scoreDimensions", () => {
  const dims = [
    {
      key: "A", label: "Alpha", max: 20, gate: 10,
      factors: [
        { key: "a1", label: "A1", max: 15, field: "x", bands: [{ gte: 10, points: 15 }] },
        { key: "a2", label: "A2", max: 10, field: "missing_field", missing: 2, verifyWhenMissing: true },
      ],
    },
    { key: "B", label: "Beta", max: 10, factors: [{ key: "b1", label: "B1", max: 10, field: "y", whenTrue: 10 }] },
  ];

  it("clamps a dimension to its max even when factors overshoot", () => {
    const { dimResults } = scoreDimensions(dims, (k) => ({ x: 12, y: true })[k]);
    expect(dimResults[0].score).toBe(17); // 15 + 2, under the 20 cap
    expect(dimResults[1].score).toBe(10);
  });

  it("collects VERIFY flags labelled by dimension", () => {
    const { verifyFields } = scoreDimensions(dims, (k) => ({ x: 12 })[k]);
    expect(verifyFields).toContain("A: A2");
  });

  it("reports gates as failed when a gated dimension falls short", () => {
    const { dimResults } = scoreDimensions(dims, (k) => ({ x: 1 })[k]);
    expect(gatesPass(dimResults)).toBe(false);
    expect(failedGates(dimResults).map((d) => d.key)).toEqual(["A"]);
  });
});

// ── Regression lock: extracting these primitives out of genericScore.ts must
// not have changed a single number the property engine produces. ─────────────
describe("scoreGenericAsset — unchanged by the bands.ts extraction", () => {
  const storage = getAssetClass("self_storage");

  const STRONG = {
    city: "Austin", state: "TX",
    classMetadata: {
      netRentableSqFt: 62000, units: 430, occupancyRate: 0.93, rentPerSqFt: 17,
      capRate: 0.078, askingPrice: 4_500_000, climateControlled: true,
      expansionLand: true, thirdPartyMgmt: true, supplyRatio: 4.5,
    },
  };

  it("scores a fully-specified facility in a target market as Tier 1", () => {
    const r = scoreGenericAsset(storage, STRONG);
    // A: occ 15 + cap 10 + mgmt 5 = 30 · B: supply 15 + rate 10 = 25
    // C: expand 10 + climate 8 + scale 7 = 25 · D: $72.58/SF → 20
    expect(r.dimA).toBe(30);
    expect(r.dimB).toBe(25);
    expect(r.dimC).toBe(25);
    expect(r.dimD).toBe(20);
    expect(r.compositeScore).toBe(100);
    expect(r.confidenceScore).toBe(1);
    expect(r.verifyFields).toHaveLength(0);
    expect(r.marketTier).toBe("A");
    expect(r.assetTier).toBe("tier1");
  });

  it("derives price per net rentable SF rather than reading it from a field", () => {
    // 62,000 net rentable SF throughout — only the price moves.
    const at = (askingPrice: number) =>
      scoreGenericAsset(storage, { ...STRONG, classMetadata: { ...STRONG.classMetadata, askingPrice } }).dimD;

    expect(at(4_500_000)).toBe(20); // ~$73/SF  → ≤80
    expect(at(6_500_000)).toBe(14); // ~$105/SF → ≤110
    expect(at(8_060_000)).toBe(8); //  $130/SF → ≤150
    expect(at(12_400_000)).toBe(2); // $200/SF → >150
  });

  it("holds a sparse asset out of Tier 1 and names what needs verifying", () => {
    const sparse = { city: "Austin", state: "TX", classMetadata: { netRentableSqFt: 30000 } };
    const r = scoreGenericAsset(storage, sparse);
    expect(r.assetTier).not.toBe("tier1");
    expect(r.confidenceScore).toBeLessThan(1);
    expect(r.verifyFields.join(" ")).toMatch(/Occupancy|Asking Price/i);
  });

  it("drops an off-market-geography asset to market tier C", () => {
    const r = scoreGenericAsset(storage, { ...STRONG, state: "OH" });
    expect(r.marketTier).toBe("C");
    expect(r.assetTier).not.toBe("tier1"); // tier 1 requires a target market
  });
});
