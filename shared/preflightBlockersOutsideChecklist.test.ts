import { describe, expect, it } from "vitest";
import { buildGuardrailChecklist } from "./guardrailChecklist";
import { preflightBlockersOutsideChecklist } from "./orderSubmitReadiness";

describe("preflight gap counts agree with the checklist (#118 retest)", () => {
  const results = Array.from({ length: 9 }, (_, i) => ({ key: `gate_${i}`, passed: i >= 7, detail: `detail ${i}` }));
  const preflight = {
    evaluation: { passed: false, results },
    blocking: [...results.filter((r) => !r.passed).map((r) => r.detail), "qty: Expected number", "detail 0"],
    schemaErrors: ["qty: Expected number"],
  };
  it("lists only blockers the checklist does not already show", () => {
    const failed = buildGuardrailChecklist(preflight.evaluation).rows.filter((row) => !row.passed).length;
    expect(failed).toBe(7);
    expect(preflightBlockersOutsideChecklist(preflight)).toEqual(["Share count needs a valid value."]);
  });
  it("returns nothing when every blocker is a checklist gate", () => {
    expect(preflightBlockersOutsideChecklist({ ...preflight, blocking: ["detail 1"], schemaErrors: [] })).toEqual([]);
  });
});
