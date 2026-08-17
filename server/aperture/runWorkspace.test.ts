import { describe, expect, it } from "vitest";
import { buildResearchJourneys } from "@shared/runWorkspace";

describe("Capital Aperture research journeys", () => {
  it("groups bounded follow-up briefs into one decision journey", () => {
    const journeys = buildResearchJourneys([
      { id: 10, thesisId: 4, thesisName: "GLP-1 catalyst events", status: "completed", universeCount: 12, candidateCount: 12, droppedNote: "33 symbols deferred to a follow-up brief", createdAt: 100 },
      { id: 11, thesisId: 4, thesisName: "GLP-1 catalyst events", status: "completed", universeCount: 12, candidateCount: 12, droppedNote: "Follow-up research from run #10; research offset 12. · 21 symbols deferred to a follow-up brief", createdAt: 200 },
      { id: 12, thesisId: 4, thesisName: "GLP-1 catalyst events", status: "completed", universeCount: 9, candidateCount: 9, droppedNote: "Follow-up research from run #11; research offset 24.", createdAt: 300 },
    ]);
    expect(journeys).toHaveLength(1);
    expect(journeys[0]).toMatchObject({ rootId: 10, symbolsReviewed: 33, evidenceCandidates: 33, remainingDeferred: 0, state: "ready_to_review" });
  });

  it("prioritizes an unfinished chain and describes the next work", () => {
    const [journey] = buildResearchJourneys([
      { id: 20, thesisId: 7, thesisName: "AI infrastructure", status: "completed", universeCount: 12, candidateCount: 12, droppedNote: "21 symbols deferred to a follow-up brief", createdAt: 100 },
    ]);
    expect(journey.state).toBe("more_research_available");
    expect(journey.nextLabel).toBe("Research next 12 symbols");
  });

  it("folds a superseded zero-candidate interruption into its immediate recovered journey", () => {
    const journeys = buildResearchJourneys([
      { id: 30, thesisId: 9, thesisName: "GLP-1", status: "failed", universeCount: 45, candidateCount: 0, createdAt: 100 },
      { id: 31, thesisId: 9, thesisName: "GLP-1", status: "completed", universeCount: 12, candidateCount: 12, droppedNote: "33 symbols deferred to a follow-up brief", createdAt: 200 },
    ]);
    expect(journeys).toHaveLength(1);
    expect(journeys[0].runs.map((run) => run.id)).toEqual([30, 31]);
    expect(journeys[0]).toMatchObject({ state: "more_research_available", symbolsReviewed: 12 });
  });
});
