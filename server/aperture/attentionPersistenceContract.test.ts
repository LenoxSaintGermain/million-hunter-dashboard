import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Aperture attention persistence contracts", () => {
  it("keeps status reads non-mutating and stores only the displayed seen baseline", () => {
    const router = read("server/apertureRouter.ts");
    const summaryStart = router.indexOf("summary: capitalOperatorProcedure.query");
    const seenStart = router.indexOf("markSeen: capitalOperatorProcedure", summaryStart);
    const summary = router.slice(summaryStart, seenStart);
    const seen = router.slice(seenStart, router.indexOf("run: router({", seenStart));

    expect(summaryStart).toBeGreaterThan(-1);
    expect(seenStart).toBeGreaterThan(summaryStart);
    expect(summary).not.toContain("apertureAttentionBaselines).values");
    expect(summary).not.toContain("onDuplicateKeyUpdate");
    expect(seen).toContain("apertureAttentionBaselines");
    expect(seen).not.toContain("brokerOrders).set");
    expect(seen).not.toContain("apertureDecisionRuns).set");
    expect(seen).not.toContain("apertureEvidenceReviews).set");
  });

  it("captures the comparison baseline only from items actually displayed", () => {
    const briefing = read("client/src/components/aperture/TodayAttentionBriefing.tsx");

    expect(briefing).toContain("displayedAttentionBaseline(attention, observed)");
    expect(briefing).toContain("IntersectionObserver");
    expect(briefing).toContain('document.visibilityState !== "visible"');
    expect(briefing).toContain("markSeen.mutate(displayedBaseline,");
    expect(briefing).not.toContain("invalidate()");
  });

  it("persists Updated/Seen comparison state without redefining acknowledgement or resolution", () => {
    const schema = read("drizzle/schema.ts");
    const attention = read("shared/apertureAttention.ts");

    expect(schema).toContain('mysqlTable("aperture_attention_baselines"');
    expect(schema).toContain("Comparison only");
    expect(attention).toContain('changeHeading: "Current status" | "Changed since your last review"');
    expect(attention).toContain("Routine timestamp changes are intentionally excluded");
  });
});
