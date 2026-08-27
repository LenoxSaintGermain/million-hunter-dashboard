import { describe, expect, it } from "vitest";
import { missionLibraryBindingState } from "./missionLibraryQuery";

describe("missionLibraryBindingState", () => {
  it("fail-closes before every owner-scoped binding exists", () => {
    expect(missionLibraryBindingState({ canonicalThesisId: null, capitalThesisId: null, accountId: null })).toEqual({
      ready: false,
      missing: ["assigned thesis", "Capital thesis projection", "paper account"],
    });
    expect(missionLibraryBindingState({ canonicalThesisId: 1, capitalThesisId: null, accountId: 1 })).toEqual({
      ready: false,
      missing: ["Capital thesis projection"],
    });
  });

  it("permits only a complete contextual binding", () => {
    expect(missionLibraryBindingState({ canonicalThesisId: 7, capitalThesisId: 9, accountId: 11 })).toEqual({
      ready: true,
      missing: [],
    });
  });
});
