import { describe, expect, it } from "vitest";
import { normalizeJsonRecord, normalizeStringList } from "../../shared/stringList";

describe("normalizeStringList", () => {
  it("accepts current arrays and removes non-string entries", () => {
    expect(normalizeStringList([" https://example.com/source ", null, 3, ""])).toEqual([
      "https://example.com/source",
    ]);
  });

  it("accepts legacy JSON strings and wrapped citation payloads", () => {
    expect(normalizeStringList('["illustrative-uat-fixture://qualified-play"]')).toEqual([
      "illustrative-uat-fixture://qualified-play",
    ]);
    expect(normalizeStringList({ citations: ["https://example.com/one"] })).toEqual([
      "https://example.com/one",
    ]);
  });

  it("fails closed for unsupported shapes", () => {
    expect(normalizeStringList({ source: "https://example.com/not-a-citation-list" })).toEqual([]);
  });

  it("normalizes JSON records without treating malformed text as data", () => {
    expect(normalizeJsonRecord('{"basis":"Illustrative only"}')).toEqual({ basis: "Illustrative only" });
    expect(normalizeJsonRecord("not JSON")).toBeNull();
    expect(normalizeJsonRecord(["not", "a", "record"])).toBeNull();
  });
});
