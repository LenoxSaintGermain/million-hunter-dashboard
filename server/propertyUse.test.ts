import { describe, it, expect } from "vitest";
import {
  classifyUseFromName, classifyUseFromCountyCode,
  ADAPTIVE_REUSE_CATEGORIES, NEVER_REUSABLE,
} from "../shared/propertyUse";

const cat = (n: string) => classifyUseFromName(n).category;

describe("classifyUseFromName", () => {
  it("keeps churches, schools and theatres — these are the adaptive-reuse plays", () => {
    // The whole point of the thesis: a closed school becomes lofts.
    expect(cat("Welsh Presbyterian Church")).toBe("institutional");
    expect(cat("Indianola Junior High School")).toBe("institutional");
    expect(cat("York Lodge No. 563")).toBe("institutional");
    expect(cat("Ohio Theatre")).toBe("entertainment");
    expect(cat("Valley Dale Ballroom")).toBe("entertainment");
    for (const n of ["Welsh Presbyterian Church", "Ohio Theatre"]) {
      expect(ADAPTIVE_REUSE_CATEGORIES).toContain(cat(n));
    }
  });

  it("filters single-family houses, which cannot be converted to leasable space", () => {
    expect(cat("Jeffrey, Malcolm, House")).toBe("residential");
    expect(cat("McCracken-Sells House")).toBe("residential");
    expect(ADAPTIVE_REUSE_CATEGORIES).not.toContain("residential");
  });

  it("does not mistake a named building for a monument", () => {
    // "Orton Memorial Laboratory" is a lab, not a statue — the real failure
    // this guard was written for.
    expect(cat("Orton Memorial Laboratory")).toBe("industrial");
    expect(cat("Smith Memorial Hospital")).toBe("institutional");
    expect(cat("Carnegie Memorial Library")).toBe("institutional");
  });

  it("still catches actual monuments, cemeteries and bridges", () => {
    expect(cat("Soldiers and Sailors Monument")).toBe("civic_monument");
    expect(cat("Lincoln Memorial")).toBe("civic_monument");
    expect(cat("Greenlawn Cemetery")).toBe("funerary");
    expect(cat("Roebling Suspension Bridge")).toBe("infrastructure");
    for (const n of ["Soldiers and Sailors Monument", "Greenlawn Cemetery", "Roebling Suspension Bridge"]) {
      expect(NEVER_REUSABLE).toContain(cat(n));
    }
  });

  it("resolves names where a specific use competes with a generic one", () => {
    expect(cat("Grand Opera House")).toBe("entertainment");   // not residential
    expect(cat("Old Stone Schoolhouse")).toBe("institutional"); // not residential
    expect(cat("Columbus Transfer Company Warehouse")).toBe("industrial");
  });

  it("returns unknown rather than guessing, and unknown is KEPT", () => {
    // "Columbia Building" says nothing about use — that's a prompt to look,
    // not a reason to discard.
    expect(cat("Columbia Building")).toBe("unknown");
    expect(cat("Kahiki, The")).toBe("unknown");
    expect(ADAPTIVE_REUSE_CATEGORIES).toContain("unknown");
    expect(classifyUseFromName("").confidence).toBe(0);
  });

  it("reports the term it matched so a user can judge the call", () => {
    expect(classifyUseFromName("Ohio National Bank").matchedTerm).toBe("Bank");
    expect(classifyUseFromName("Columbia Building").matchedTerm).toBeNull();
  });
});

describe("classifyUseFromCountyCode", () => {
  it("trusts a real county use code above a name heuristic", () => {
    const county = classifyUseFromCountyCode("OFFICE - 1-2 STORIES");
    const name = classifyUseFromName("Some Office Building");
    expect(county.category).toBe("commercial");
    expect(county.confidence).toBeGreaterThan(name.confidence);
  });

  it("handles an empty code", () => {
    expect(classifyUseFromCountyCode(null).category).toBe("unknown");
  });
});
