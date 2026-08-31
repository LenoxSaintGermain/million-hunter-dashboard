import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Capital Aperture lifecycle safety contracts", () => {
  it("keeps option proposals blocked until current contract-market evidence is modeled", () => {
    const flow = read("server/aperture/orderFlow.ts");

    expect(flow).toContain('key: "option_chain_market_evidence"');
    expect(flow).toContain("passed: false");
    expect(flow).toContain("current bid/ask, spread, volume, open interest, implied volatility, and quote time");
  });

  it("queues a paper outcome only after a verified fill, including mirrored fills", () => {
    const flow = read("server/aperture/orderFlow.ts");

    expect(flow).toContain('if (newStatus === "filled" && decisionAuthorization?.source === "authoritative"');
    expect(flow).toContain('if (newStatus === "filled" && order.decisionRunId != null && order.decisionRevisionId != null)');
    expect(flow).toContain("decisionRunId: order.decisionRunId");
    expect(flow).toContain("revisionId: order.decisionRevisionId");
  });

  it("preserves the selected candidate and refuses monitoring without open filled exposure", () => {
    const page = read("client/src/pages/aperture/ApertureExecute.tsx");
    const router = read("server/apertureRouter.ts");

    expect(page).toContain('onProposalCreated={() => navigate(`/aperture/run/${runId}/execute?candidate=${proposalCandidate.id}`)}');
    expect(page).toContain("<MonitoringPanel runId={runId} candidate={proposalCandidate}");
    expect(page).not.toContain("candidate={proposalCandidate ?? data?.candidates[0]}");
    expect(router).toContain("const netFilledQty = filledOrders.reduce");
    expect(router).toContain('eq(brokerOrders.status, "filled")');
    expect(router).toContain("No open filled paper exposure exists for this candidate");
  });
});
