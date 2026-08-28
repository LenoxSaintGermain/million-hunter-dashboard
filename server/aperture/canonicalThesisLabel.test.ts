import { describe, expect, it } from "vitest";
import { canonicalThesisLabel } from "../../shared/canonicalThesisLabel";

describe("canonicalThesisLabel", () => {
  it("distinguishes same-name canonical records by immutable version id", () => {
    expect(canonicalThesisLabel({ id: 480001, name: "Post-Benchmark Small-Cap Confirmation" }))
      .toBe("Post-Benchmark Small-Cap Confirmation · v480001");
    expect(canonicalThesisLabel({ id: 510001, name: "Post-Benchmark Small-Cap Confirmation", isActiveCapital: true }))
      .toBe("Post-Benchmark Small-Cap Confirmation · v510001 · active");
  });

  it("labels unnamed records without hiding their identity", () => {
    expect(canonicalThesisLabel({ id: 42, name: null })).toBe("Untitled Capital thesis · v42");
  });
});
