import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ runs: [] as any[], error: false, loading: false, synthetic: false, queryOptions: null as any }));
vi.mock("streamdown", () => ({ Streamdown: ({ children }: any) => <div>{children}</div> }));
vi.mock("wouter", () => ({ useParams: () => ({ id: "1" }), Link: ({ children, href }: any) => <a href={href}>{children}</a> }));
vi.mock("@/components/EditorialTopNav", () => ({ default: ({ children }: any) => children }));
vi.mock("@/components/AgentMonitoringPanel", () => ({ default: () => null, DealDossierModule: () => <div>Source dossier</div> }));
vi.mock("../client/src/pages/LOIGeneration", () => ({ default: () => null }));
vi.mock("@/components/DealEvidenceDesk", () => ({ default: () => <div>Evidence workbench marker</div> }));
vi.mock("@/lib/trpc", () => ({ trpc: new Proxy({}, { get: (_target, namespace) => new Proxy({}, { get: (_t, procedure) => ({
  useQuery: (_input: unknown, options: unknown) => {
    if (namespace === "dealEvidence" && procedure === "runs") {
      state.queryOptions = options;
      return { data: state.runs, isError: state.error, isLoading: state.loading };
    }
    return { data: namespace === "deals" && procedure === "getById" ? {
      deal: { id: 1, name: "Illustrative business", isSynthetic: state.synthetic, stage: "new" }, signal: null, memo: null,
    } : undefined, isLoading: false, refetch: vi.fn() };
  },
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}) }) }) }));
import DealDetail from "../client/src/pages/DealDetail";
beforeEach(() => { state.runs = []; state.error = false; state.loading = false; state.synthetic = false; });
it("keeps receipt administration out of the default source chapter", () => {
  const html = renderToStaticMarkup(<DealDetail />);
  expect(html).toContain("Evidence belongs with the decision it informs");
  expect(html).not.toContain("Evidence workbench marker");
});
it("uses the latest failed attempt rather than silently substituting older success", () => {
  state.runs = [{ mode: "red_team", status: "failed" }, { mode: "red_team", status: "complete" }];
  const html = renderToStaticMarkup(<DealDetail />);
  expect(html).toContain("Latest evidence review failed");
  expect(html).not.toContain("Risk analysis has not been run");
});
it("acknowledges completed evidence IC in the committee navigation", () => {
  state.runs = [{ mode: "ic", status: "complete" }];
  const html = renderToStaticMarkup(<DealDetail />);
  expect(html).toContain("Evidence review saved");
  expect(html).not.toContain("Panel has not reported");
});
it("exposes failed status reads rather than an implied empty ledger", () => {
  state.error = true;
  state.runs = [{ mode: "red_team", status: "complete" }, { mode: "ic", status: "complete" }];
  expect(renderToStaticMarkup(<DealDetail />)).toContain("Evidence status needs checking");
  expect(renderToStaticMarkup(<DealDetail />)).not.toContain("Evidence review saved");
});
it("does not mistake initial loading for an absent analysis", () => {
  state.loading = true;
  const html = renderToStaticMarkup(<DealDetail />);
  expect(html).toContain("Checking the saved evidence");
  expect(html).not.toContain("Panel has not reported");
  expect(html).not.toContain("Risk analysis has not been run");
});
it("disables evidence queries for synthetic deals", () => {
  state.synthetic = true;
  renderToStaticMarkup(<DealDetail />);
  expect(state.queryOptions.enabled).toBe(false);
});
