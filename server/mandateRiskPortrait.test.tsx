import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MissionRiskPortrait, ThesisRiskComparison, recordedRiskCents, riskMoney, thesisHorizonKey } from "../client/src/components/aperture/MandateRiskPortrait";

describe("saved mandate risk visuals", () => {
  it("never converts missing, invalid or negative amounts into zero", () => {
    for (const value of [undefined, null, "", "100", NaN, Infinity, -1]) {
      expect(recordedRiskCents(value)).toBeNull();
      expect(riskMoney(value)).toBe("Not recorded");
    }
    expect(recordedRiskCents(0)).toBe(0);
    expect(riskMoney(125)).toBe("$1.25");
  });
  it("encodes effective allowance on the same zero-based scale as the limit", () => {
    const html = renderToStaticMarkup(<MissionRiskPortrait limitCents={50000} effectiveCents={12500} />);
    expect(html).toContain("25% of operator limit");
    expect(html).toContain('width="99"');
    expect(html).toContain('width="396"');
    expect(html).toContain("not measured risk used");
    expect(html).toContain("not current headroom or permission to trade");
  });
  it("distinguishes unknown from measured zero without fake ratios", () => {
    const missing = renderToStaticMarkup(<MissionRiskPortrait limitCents={null} effectiveCents={undefined} />);
    expect(missing).not.toContain("<svg");
    expect(missing).not.toContain("0%");
    const zero = renderToStaticMarkup(<MissionRiskPortrait limitCents={0} effectiveCents={0} />);
    expect(zero).toContain("<circle");
    expect(zero).toContain("Share of operator limit unavailable");
    expect(zero).not.toContain("NaN");
  });
  it("does not clamp away an inconsistent saved allowance", () => {
    const html = renderToStaticMarkup(<MissionRiskPortrait limitCents={10000} effectiveCents={15000} />);
    expect(html).toContain("150% of operator limit");
    expect(html).toContain("Saved allowance exceeds the operator limit");
  });
  it("shows actual horizon counts and shared-scale amounts without starting work", () => {
    const onReview = vi.fn();
    const html = renderToStaticMarkup(<ThesisRiskComparison theses={[
      { id: 1, name: "First", missionDefaults: { maxPlannedLossCents: 50000, holdingPeriod: "intraday" } },
      { id: 2, name: "Second", missionDefaults: { maxPlannedLossCents: 25000, holdingPeriod: "position" } },
      { id: 3, name: "Third", missionDefaults: { maxPlannedLossCents: null, holdingPeriod: "unrecognized" } },
    ]} onReview={onReview} />);
    expect(html).toContain("3 theses in this library view");
    expect(html).toContain("1 without a recorded planned-loss limit");
    expect(html).toContain('width="198"');
    expect(html).toContain("Bars show thesis counts, not duration");
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("Not recorded — no bar drawn");
    expect(onReview).not.toHaveBeenCalled();
    expect(thesisHorizonKey("unrecognized")).toBe("unknown");
  });
});
