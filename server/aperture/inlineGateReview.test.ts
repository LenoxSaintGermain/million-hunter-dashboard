import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { InlineGateReview, inlineGateTarget } from "../../client/src/components/aperture/InlineGateReview";
vi.stubGlobal("React", React);
const f = vi.hoisted(() => ({ query: {} as any, read: vi.fn(), retry: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: { aperture: { runway: { latest: { useQuery: (...args: any[]) => { f.read(...args); return f.query; } } } } } }));
const target = { decisionRunId: 12, revisionId: 4 };
const render = () => renderToStaticMarkup(React.createElement(InlineGateReview, { target, onRevise: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  f.query = { isLoading: false, isError: false, refetch: f.retry, data: { latest: {
    authority: "authoritative", decisionRunId: 12, decisionRevisionId: 4,
    branch: "conditional", blocker: "Account evidence was stale", reopenCondition: "Refresh account evidence and verify headroom",
    createdAt: 1000, binding: { accountLabel: "Illustrative paper account", decisionVersion: 4 },
  } } };
});
it("reads only the exact saved gate in place, without evaluating or resolving it", () => {
  const html = render();
  expect(f.read).toHaveBeenCalledWith(target, expect.objectContaining({ refetchOnWindowFocus: false, retry: false }));
  expect(html).toContain("Account evidence was stale");
  expect(html).toContain("Refresh account evidence and verify headroom");
  expect(html).toContain("not been re-evaluated");
  expect(html).toContain("No gate was cleared");
  expect(f.retry).not.toHaveBeenCalled();
});
it.each(["loading", "failed", "missing", "wrong_revision"])("does not offer revision from %s data", state => {
  if (state === "loading") f.query.isLoading = true;
  if (state === "failed") f.query.isError = true;
  if (state === "missing") f.query.data = { latest: null };
  if (state === "wrong_revision") f.query.data.latest.decisionRevisionId = 5;
  const html = render();
  expect(html).not.toContain(">Revise this condition<");
  expect(html).not.toContain("Gate cleared");
});
it("accepts only local exact gate review routes", () => {
  expect(inlineGateTarget({ kind: "review_due", key: "review:9", href: "/aperture/decision/12/revision/4", reviewKind: "gate_review" })).toEqual(target);
  for (const href of ["https://evil.test/aperture/decision/12/revision/4", "/aperture/decision/0/revision/4", "/aperture/decision/12/revision/4?other=1"])
    expect(inlineGateTarget({ kind: "review_due", key: "review:9", href, reviewKind: "gate_review" })).toBeNull();
});
