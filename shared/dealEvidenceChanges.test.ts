import { describe, expect, it } from "vitest";
import { compareEvidenceSnapshots } from "./dealEvidenceChanges";
import type { DealEvidenceSnapshot } from "./dealEvidence";

// Deliberately minimal synthetic inputs: the comparison accepts only snapshots
// already validated by the service. No live-data or provider claims here.
const snapshot = (evidence: Array<{ cik: string; receiptId: string; payloadHash: string }>, name = "Illustrative deal", id = 1) =>
  ({ deal: { id, name }, evidence } as DealEvidenceSnapshot);
const a = { cik: "0000320193", receiptId: "old", payloadHash: "a" };
describe("recorded evidence comparison", () => {
  it("separates a changed payload from a recapture with identical content", () => {
    expect(compareEvidenceSnapshots(snapshot([a]), snapshot([{ ...a, receiptId: "new" }])).versions[0].kind).toBe("recaptured");
    expect(compareEvidenceSnapshots(snapshot([a]), snapshot([{ ...a, receiptId: "new", payloadHash: "b" }])).versions[0].kind).toBe("changed");
  });
  it("exposes additions and removals without assigning a risk score", () => {
    const result = compareEvidenceSnapshots(snapshot([a]), snapshot([{ cik: "0000000001", receiptId: "b", payloadHash: "b" }]));
    expect(result.versions.map(item => item.kind)).toEqual(["added", "removed"]);
    expect(result.changedSources).toBe(2);
    expect(result.limitation).toContain("not a material-risk");
  });
  it("tracks changed deal inputs even when the evidence is unchanged", () => {
    const result = compareEvidenceSnapshots(snapshot([a]), snapshot([a], "Revised illustrative name"));
    expect(result.dealFields).toEqual(["name"]);
    expect(result.changedSources).toBe(0);
  });
  it("ignores ordering, preserves inputs, and includes all selected versions", () => {
    const b = { ...a, receiptId: "second", payloadHash: "b" };
    const before = snapshot([a, b]);
    const frozen = JSON.stringify(before);
    expect(compareEvidenceSnapshots(before, snapshot([b, a])).versions[0].kind).toBe("unchanged");
    expect(JSON.stringify(before)).toBe(frozen);
    expect(compareEvidenceSnapshots(before, snapshot([a])).versions[0].kind).toBe("changed");
  });
  it("refuses cross-deal comparisons", () => {
    expect(() => compareEvidenceSnapshots(snapshot([a]), snapshot([a], "Other", 2))).toThrow("different deals");
  });
});
