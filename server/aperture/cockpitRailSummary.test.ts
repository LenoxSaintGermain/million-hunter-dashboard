import { describe, expect, it } from "vitest";
import { buildCockpitRailSummary, STALE_ACCOUNT_MS, type CockpitHeadroomLine } from "@shared/cockpitRailSummary";

const line = (patch: Partial<CockpitHeadroomLine>): CockpitHeadroomLine => ({
  key: "single_name",
  label: "Largest single name",
  subject: "NVDA",
  usedCents: 975_800,
  ceilingCents: 989_500,
  remainingCents: 13_700,
  usedPct: 98.6,
  ceilingPct: 10,
  basis: "measured",
  reason: null,
  ...patch,
});

describe("buildCockpitRailSummary", () => {
  it("selects the tightest measurable running constraint and escalates at 85%", () => {
    const summary = buildCockpitRailSummary([
      line({ key: "run_gross", label: "This run, gross deployed", usedCents: 400_000, ceilingCents: 989_500, usedPct: 4.0 }),
      line({ key: "single_name", label: "Largest single name", usedCents: 975_800, ceilingCents: 989_500, usedPct: 9.9 }),
      line({ key: "single_order", label: "Single order", usedCents: null, usedPct: null }),
    ], 0);
    expect(summary.binding?.key).toBe("single_name");
    expect(summary.severity).toBe("critical");
  });

  it("does not promote per-play reference ceilings or unmeasurable lines into collapsed status", () => {
    const summary = buildCockpitRailSummary([
      line({ key: "single_order", label: "Single order", usedCents: null, usedPct: null }),
      line({ key: "planned_risk_per_play", label: "Planned loss, one play", usedCents: null, usedPct: null }),
    ], null);
    expect(summary.binding).toBeNull();
    expect(summary.severity).toBe("unmeasurable");
  });

  it("marks stale account context only after four hours", () => {
    expect(buildCockpitRailSummary([], STALE_ACCOUNT_MS).accountStale).toBe(false);
    expect(buildCockpitRailSummary([], STALE_ACCOUNT_MS + 1).accountStale).toBe(true);
  });

  it("collapses an unclassified cluster only when it is the same measured exposure as the name", () => {
    const name = line({ label: "Largest single name", subject: "NVDA" });
    const cluster = line({ key: "largest_cluster", label: "Largest correlated cluster", subject: "NVDA (unclassified)", ceilingCents: 2_473_800 });
    const summary = buildCockpitRailSummary([name, cluster], 0);
    expect(summary.duplicatedUnclassifiedCluster).toBe(true);
    expect(summary.expandedLines).toEqual([name]);
  });
});
