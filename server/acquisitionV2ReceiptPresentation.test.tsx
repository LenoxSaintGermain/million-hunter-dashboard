import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ state: {} as any, report: {} as any, stateQuery: vi.fn(), reportQuery: vi.fn() }));
vi.mock("../client/src/lib/trpc", () => ({ trpc: { scan: {
  getV2State: { useQuery: (...args: any[]) => { fixture.stateQuery(...args); return fixture.state; } },
  getV2Report: { useQuery: (...args: any[]) => { fixture.reportQuery(...args); return fixture.report; } },
} } }));
import { AcquisitionV2Report } from "../client/src/components/AcquisitionV2Report";
const manifest = () => ({ userId: 7, jobId: 9, state: "capturing", capturesSaved: false, captures: [], mandate: { version: "test mandate" },
  approvedAt: "2026-09-30T12:00:00Z", engineVersion: "acquisition-v2.2", mandateHash: "test-mandate-hash", contentHash: "test-receipt-hash" });
const render = () => renderToStaticMarkup(<AcquisitionV2Report jobId={9}/>);
beforeEach(() => {
  fixture.state = { data: manifest(), refetch: vi.fn() };
  fixture.report = { data: [], refetch: vi.fn() };
  fixture.stateQuery.mockClear(); fixture.reportQuery.mockClear();
});
it("shows saved pending state without claiming an active worker or starting another search", () => {
  const html = render();
  expect(html).toContain("The capture is still open.");
  expect(html).toContain("not proof that a worker is still running");
  expect(html).toContain("Refresh saved receipt");
  expect(html).toContain("Reloads saved records only.");
  expect(html).not.toContain("Annual cash worksheet");
  expect(fixture.stateQuery).toHaveBeenCalledWith({ jobId: 9 }, { refetchInterval: false });
  expect(fixture.reportQuery).toHaveBeenCalledWith({ jobId: 9 }, { enabled: false, refetchInterval: false });
  expect(fixture.state.refetch).not.toHaveBeenCalled();
  expect(fixture.report.refetch).not.toHaveBeenCalled();
});
it.each([false, true])("refresh invokes only the allowed saved queries (capturesSaved=%s)", saved => {
  fixture.state.data.capturesSaved = saved;
  const findRefresh = (node: any): any => {
    if (!node || typeof node !== "object") return undefined;
    if (node.type === "button" && node.props.children === "Refresh saved receipt") return node;
    return React.Children.toArray(node.props?.children).map(findRefresh).find(Boolean);
  };
  const button = findRefresh(AcquisitionV2Report({ jobId: 9 }));
  expect(button).toBeDefined();
  button.props.onClick();
  expect(fixture.state.refetch).toHaveBeenCalledTimes(1);
  expect(fixture.report.refetch).toHaveBeenCalledTimes(saved ? 1 : 0);
});
it("distinguishes completed empty capture from absence of matching businesses", () => {
  Object.assign(fixture.state.data, { state: "completed", capturesSaved: true });
  const html = render();
  expect(html).toContain("No listing captures were returned.");
  expect(html).toContain("does not establish that no matching businesses exist");
  expect(html).toContain("Run record &amp; approval");
  expect(html).toContain("test-mandate-hash");
  expect(html).not.toContain("Annual cash worksheet");
  expect(fixture.reportQuery).toHaveBeenCalledWith({ jobId: 9 }, { enabled: true, refetchInterval: false });
});
it("shows failure without inventing a source and retains the recorded reason in disclosure", () => {
  Object.assign(fixture.state.data, { state: "failed", reason: "Capture failed <script>not executable</script>" });
  const html = render();
  expect(html).toContain("The search did not finish.");
  expect(html).toContain('role="alert"');
  expect(html).toContain("No completed search conclusion can be drawn.");
  expect(html).toContain("Capture failed &lt;script&gt;");
  expect(html).not.toContain("No listing captures were returned.");
});
it("preserves unsuccessful captures under a failed run, visibly marked incomplete", () => {
  Object.assign(fixture.state.data, { state: "failed", capturesSaved: true, captures: [{ url: "https://example.org/fixture" }] });
  fixture.report.data = [{ url: "https://example.org/fixture", state: "unresolved", reason: "Source blocked", stale: true, report: null }];
  const html = render();
  expect(html).toContain("incomplete record"); expect(html).toContain("Source blocked"); expect(html).toContain("Saved evidence is stale.");
});
it("hides cached evidence on manifest error, even when previous data exists", () => {
  fixture.state.isError = true;
  fixture.state.error = { message: "V2 job access denied" };
  fixture.report.data = [{ reason: "PRIVATE FOREIGN CAPTURE", report: null }];
  const html = render();
  expect(html).toContain("The saved receipt is unavailable.");
  expect(html).not.toContain("PRIVATE FOREIGN CAPTURE");
  expect(html).not.toContain("test-mandate-hash");
  expect(fixture.reportQuery.mock.calls[0][1].enabled).toBe(false);
});
it("provides explicit review guidance rather than a research retry for an old engine", () => {
  fixture.state = { isError: true, error: { message: "V2 engine version mismatch; explicit re-evaluation required" } };
  const html = render();
  expect(html).toContain("This receipt needs a new review.");
  expect(html).toContain("refreshing will not rerun research");
});
it("does not treat missing/legacy manifest as a completed empty V2 run", () => {
  fixture.state.data = null;
  expect(render()).toBe("");
  expect(fixture.reportQuery.mock.calls[0][1].enabled).toBe(false);
});
it("distinguishes loading from capturing and disables refresh while fetching", () => {
  fixture.state = { data: undefined, isFetching: true };
  const html = render();
  expect(html).toContain("Reading the saved receipt.");
  expect(html).not.toContain("The capture is still open.");
  expect(html).toContain('disabled=""');
});
it.each(["error", "missing rows"])("does not report empty success when evidence is unavailable: %s", kind => {
  Object.assign(fixture.state.data, { state: "completed", capturesSaved: true, captures: [{ url: "https://example.org/fixture" }] });
  fixture.report.isError = kind === "error";
  const html = render();
  expect(html).toContain("The saved evidence could not be verified.");
  expect(html).not.toContain("No listing captures were returned.");
});
