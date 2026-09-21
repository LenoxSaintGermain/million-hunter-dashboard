import { describe, expect, it } from "vitest";
import { missionReceiptReadEnabled } from "../../client/src/lib/canonicalMissionHandoff";

describe("Mission receipt read scope", () => {
  it("does not read an unrelated latest receipt for a new thesis", () => {
    expect(missionReceiptReadEnabled(true, null)).toBe(false);
  });
  it("reads an exact completed handoff receipt", () => {
    expect(missionReceiptReadEnabled(true, { decisionRunId: 87, revisionId: 120 })).toBe(true);
  });
  it("retains latest-receipt recovery on ordinary Mission entry", () => {
    expect(missionReceiptReadEnabled(false, null)).toBe(true);
  });
});
