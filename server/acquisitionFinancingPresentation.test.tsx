import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("streamdown", () => ({ Streamdown: ({ children }: any) => <div>{children}</div> }));
vi.mock("wouter", () => ({ useParams: () => ({ id: "1" }), Link: ({ children, href }: any) => <a href={href}>{children}</a> }));
vi.mock("@/components/EditorialTopNav", () => ({ default: ({ children }: any) => children }));
vi.mock("@/components/CoPilot", () => ({ default: () => null }));
vi.mock("@/components/AgentMonitoringPanel", () => ({ default: () => null, DealDossierModule: () => <div data-testid="full-width-dossier">Saved source research</div> }));
vi.mock("../client/src/pages/LOIGeneration", () => ({ default: () => null }));
vi.mock("@/lib/trpc", () => ({ trpc: new Proxy({}, { get: (_target, namespace) => new Proxy({}, { get: (_t, procedure) => ({
  useQuery: () => ({ data: namespace === "deals" && procedure === "getById" ? { deal: { id: 1, name: "Illustrative test business", askingPrice: 1100000, cashFlow: 338930, revenue: 2792789, stage: "new" }, signal: null, memo: null } : undefined, isLoading: false, refetch: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}) }) }) }));
import DealDetail from "../client/src/pages/DealDetail";
it("shows a qualified amortized scenario, not a fabricated DSCR or SBA approval", () => {
  const html = renderToStaticMarkup(<DealDetail />);
  expect(html).toContain("2.03");
  expect(html).not.toContain("4.40");
  expect(html).not.toContain("SBA 7(a) DOWN");
  expect(html).toContain("CASH COVERAGE · MODELED");
  expect(html).toContain("Not lender terms or financing approval.");
  expect(html).toContain("It is not a lender-verified DSCR.");
  expect(html.indexOf('aria-label="Opportunity research"')).toBeLessThan(html.indexOf("Analysis tools and financing assumptions"));
  expect(html).toContain("Risk analysis has not been run; risk is still unknown.");
  expect(html.match(/data-testid="full-width-dossier"/g)).toHaveLength(1);
  expect(html).not.toContain("lg:col-span-4 lg:border-l");
});
