import { describe, expect, it } from "vitest";
import { buildBriefResearchPlan, isRunStale, nextFollowUpOffset, STALE_RUN_AFTER_MS } from "./runRecovery";

describe("Capital Brief stale-run recovery", () => {
  const now = 1_800_000_000_000;

  it("marks an active run stale after the bounded recovery window", () => {
    expect(isRunStale({ status: "researching", startedAt: now - STALE_RUN_AFTER_MS - 1 }, now)).toBe(true);
  });

  it("keeps a recently active run live", () => {
    expect(isRunStale({ status: "researching", startedAt: now - STALE_RUN_AFTER_MS + 1 }, now)).toBe(false);
  });

  it("never offers recovery for a terminal run", () => {
    expect(isRunStale({ status: "completed", startedAt: now - STALE_RUN_AFTER_MS - 1 }, now)).toBe(false);
    expect(isRunStale({ status: "failed", startedAt: now - STALE_RUN_AFTER_MS - 1 }, now)).toBe(false);
  });

  it("keeps an intraday first brief decision-sized and catalyst-led", () => {
    const plan = buildBriefResearchPlan(Array.from({ length: 45 }, (_, i) => `S${i}`), "intraday");
    expect(plan.items).toHaveLength(8);
    expect(plan.deferredCount).toBe(37);
    expect(plan.passes).toEqual(["catalyst", "technical"]);
  });

  it("keeps longer-horizon first briefs bounded without removing their full pass set", () => {
    const plan = buildBriefResearchPlan(Array.from({ length: 45 }, (_, i) => `S${i}`), "swing_2_10");
    expect(plan.items).toHaveLength(12);
    expect(plan.deferredCount).toBe(33);
    expect(plan.passes).toBeUndefined();
  });

  it("advances from an initial bounded brief to its next unseen symbol", () => {
    expect(nextFollowUpOffset({ universeCount: 12, droppedNote: "33 symbols deferred to a follow-up brief" })).toBe(12);
  });

  it("advances a chained follow-up from its persisted research offset", () => {
    expect(nextFollowUpOffset({ universeCount: 12, droppedNote: "Follow-up research from run #150004; research offset 24. · 9 symbols deferred" })).toBe(36);
  });
});
