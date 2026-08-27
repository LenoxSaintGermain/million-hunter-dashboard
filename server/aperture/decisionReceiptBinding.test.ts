import { describe, expect, it } from "vitest";
import { immutableReceiptBindingIssue } from "./decisionReceiptBinding";

const run = { ownerId: 1, canonicalThesisId: 11, capitalThesisId: 21, accountId: 31 };
const contextSnapshot = { canonicalThesisId: 11, capitalThesisId: 21, accountId: 31 };
const gateSnapshot = { mandateVersion: "capital-v1" };

describe("immutable Decision Runway receipt bindings", () => {
  it("accepts the exact owner, thesis, account, and mandate snapshot", () => {
    expect(immutableReceiptBindingIssue({ requestedOwnerId: 1, run, contextSnapshot, gateSnapshot })).toBeNull();
  });

  it.each([
    ["other owner", { requestedOwnerId: 2, run, contextSnapshot, gateSnapshot }, "owner"],
    ["canonical thesis drift", { requestedOwnerId: 1, run, contextSnapshot: { ...contextSnapshot, canonicalThesisId: 12 }, gateSnapshot }, "canonical_thesis"],
    ["projection drift", { requestedOwnerId: 1, run, contextSnapshot: { ...contextSnapshot, capitalThesisId: 22 }, gateSnapshot }, "capital_thesis"],
    ["account drift", { requestedOwnerId: 1, run, contextSnapshot: { ...contextSnapshot, accountId: 32 }, gateSnapshot }, "account"],
    ["missing mandate revision", { requestedOwnerId: 1, run, contextSnapshot, gateSnapshot: {} }, "mandate"],
  ])("fail-closes %s", (_label, input, expected) => {
    expect(immutableReceiptBindingIssue(input)).toBe(expected);
  });
});
