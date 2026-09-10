import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { arbitrateTodayRead, deriveApertureAttention, type ApertureAttentionInput } from "../../shared/apertureAttention";

const fixture = vi.hoisted(() => ({ queries: {} as Record<string, any>, mutate: vi.fn(), navigate: vi.fn(), refetch: vi.fn() }));
vi.mock("wouter", () => ({ useLocation: () => ["/aperture/plays", fixture.navigate], useSearch: () => "" }));
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: any) => children }));
vi.mock("@/lib/trpc", () => ({ trpc: { aperture: {
  desk: { summary: { useQuery: () => fixture.queries.desk }, markSeen: { useMutation: () => ({ mutate: fixture.mutate }) } },
  run: { list: { useQuery: () => fixture.queries.runs } },
  play: { list: { useQuery: () => fixture.queries.plays } },
  runway: { pending: { useQuery: () => fixture.queries.outcomes } },
} } }));
import AperturePlayDesk from "../../client/src/pages/aperture/AperturePlayDesk";
import { TodayAttentionBriefing } from "../../client/src/components/aperture/TodayAttentionBriefing";

const now = Date.UTC(2026, 8, 9, 14);
const dueAt = Date.UTC(2026, 9, 1, 14);
const narrative = "**Illustrative underlying outlook** supports a long bullish thesis [1][3][5]. ".repeat(20);
const order = { id: 12, runId: 360001, candidateId: 240003, accountId: 3, accountLabel: "Fixture Paper", symbol: "DKNG261120P00020000", underlyingSymbol: "DKNG", instrumentType: "long_put" as const, status: "filled" as const, intent: "open", qty: 1, filledQty: 1, brokerOrderId: "fixture", dispatchError: null, updatedAt: now, timeStopAt: null };
const finding = { id: 4, orderId: 12, runId: 360001, candidateId: 240003, symbol: "DKNG", kind: "material_change" as const, checkType: "catalyst", finding: narrative, citations: ["https://example.org/fixture-source"], checkedAt: now };
const input = (overrides: Partial<ApertureAttentionInput> = {}): ApertureAttentionInput => ({ now, mission: null, underwriting: null, evidenceTasks: [], orders: [order], activePlays: [], pendingReviews: [], monitoringFindings: [finding], checks: { state: "complete", asOf: now, monitoring: "on_demand" }, ...overrides });
const query = (data: unknown) => ({ data, error: null, isLoading: false, isFetching: false, dataUpdatedAt: now, refetch: fixture.refetch });
const today = (attention: ReturnType<typeof deriveApertureAttention>) => renderToStaticMarkup(React.createElement(TodayAttentionBriefing, { attention, accountLabel: "Fixture Paper", modeLabel: "Paper", loading: false, failed: null, onOpen: fixture.navigate, onRetry: fixture.refetch, onNewMission: fixture.mutate }));
const desk = () => renderToStaticMarkup(React.createElement(AperturePlayDesk));

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.clearAllMocks();
  fixture.queries = { desk: query({ orders: [order], activePlays: [], attention: deriveApertureAttention(input(), null) }), runs: query([]), plays: query({ plays: [] }), outcomes: query([]) };
});

describe("Authenticated UAT attention regressions — illustrative records, zero APIs", () => {
  it("formats compact in-motion option rows without raw OCC headings", () => {
    const html = today(deriveApertureAttention(input({ monitoringFindings: [] }), null));
    expect(html).toContain("DKNG · $20 Put · Nov 20, 2026");
    expect(html).not.toContain("DKNG261120P00020000 · 1 filled");
  });

  it("does not tell an operator that saved-status refresh cures stale monitoring", () => {
    const attention = deriveApertureAttention(input({ checks: { state: "stale", asOf: now, monitoring: "on_demand", issues: [{ source: "monitoring", state: "stale", label: "MGM monitoring", impact: "Fresh checks needed", lastSuccessAt: now - 86_400_001, actionLabel: "Review MGM checks", href: "/aperture/run/360001/execute?candidate=240002&lifecycle=monitoring", recovery: "review_checks" }] } }), null);
    const html = today(attention);
    expect(html).not.toContain("Refresh status before relying on current eligibility");
    expect(html).toContain("Open the affected play below for new checks");
    expect(fixture.refetch).not.toHaveBeenCalled();
  });

  it("UAT02 gives mobile a bounded decision summary before its action; retains the complete cited record in Evidence", () => {
    const attention = deriveApertureAttention(input(), null);
    expect(attention.primary!.reason.length).toBeLessThan(180);
    expect(attention.primary!.reason).not.toContain("[1]");
    const html = today(attention);
    const action = html.indexOf(">Review what changed<");
    expect(action).toBeGreaterThan(0);
    expect(html.slice(0, action)).not.toContain("Illustrative underlying outlook");
    // Evidence is formatted, not truncated: compare its complete visible text.
    expect(html.replace(/<[^>]+>/g, "")).toContain(narrative.replace(/\*\*/g, "").trim());
    expect(html).toContain("<strong>Illustrative underlying outlook</strong>");
    expect(html).toContain("https://example.org/fixture-source");
    expect(html.indexOf(">Evidence<")).toBeGreaterThan(action);
  });

  it("UAT03 binds implications to the selected put, without converting headline words into directional advice", () => {
    const result = deriveApertureAttention(input(), null);
    expect(result.primary!.title).toContain("Put");
    expect(result.primary!.consequence).toMatch(/put/i);
    expect(result.primary!.consequence).toMatch(/not establish|not verified/i);
    expect(result.primary!.consequence).not.toMatch(/bullish|bearish|supports|accelerat|buy|sell/i);
    const opposite = deriveApertureAttention(input({ monitoringFindings: [{ ...finding, finding: "Bearish pressure from unrelated headlines" }] }), null);
    expect(opposite.primary!.consequence).toBe(result.primary!.consequence);
    expect(result.primary!.href).toContain("candidate=240003&lifecycle=monitoring");
    expect(fixture.mutate).not.toHaveBeenCalled();
  });

  it("UAT04 exposes named missing monitoring, its last success and exact check-recovery instead of another status refresh", () => {
    const attention = deriveApertureAttention(input({ checks: { state: "partial", asOf: now, monitoring: "on_demand", issues: [{ source: "monitoring", state: "stale", label: "DKNG catalyst monitoring", impact: "The catalyst cannot support current eligibility.", lastSuccessAt: now - 86_400_001, actionLabel: "Review DKNG checks", href: "/aperture/run/360001/execute?candidate=240003&lifecycle=monitoring", recovery: "review_checks" }] } } as any), null);
    const html = today(attention);
    expect(html).toContain("DKNG catalyst monitoring");
    expect(html).toContain("The catalyst cannot support current eligibility");
    expect(html).toContain("Last successful check");
    expect(html).toContain("Review DKNG checks");
    expect(html).toContain("Refresh reads saved status only");
    expect(fixture.refetch).not.toHaveBeenCalled();
  });

  it("UAT05 renders the same primary task in Today and Play Desk when a saved status source is partial", () => {
    const attention = deriveApertureAttention(input({ checks: { state: "partial", asOf: now, monitoring: "on_demand" } }), null);
    fixture.queries.desk.data.attention = attention;
    const expected = arbitrateTodayRead({ briefing: attention, refreshing: false, failed: false }).layout!.primary!.key;
    const todayHtml = today(attention);
    const deskHtml = desk();
    expect(todayHtml).toContain(`data-attention-key="${expected}"`);
    expect(deskHtml).toContain(`data-attention-key="${expected}"`);
    expect(deskHtml).not.toContain("Some decisions cannot be verified");
    expect(fixture.refetch).not.toHaveBeenCalled();
    expect(fixture.mutate).not.toHaveBeenCalled();
  });

  it("UAT07 uses recorded human reviews on the order card and a readable contract checkpoint", () => {
    const review = { id: 18, kind: "play_outcome", dueAt, updatedAt: now, orderRunId: order.runId, orderCandidateId: order.candidateId, orderSymbol: order.symbol, decisionRunId: 8, revisionId: 9 };
    fixture.queries.outcomes.data = [review];
    const attention = deriveApertureAttention(input({ pendingReviews: [{ ...review, kind: "play_outcome", title: `${order.symbol} review`, href: "/aperture/run/360001/execute?candidate=240003" }] }), null);
    fixture.queries.desk.data.attention = attention;
    expect(attention.nextCheckpoint!.title).toContain("DKNG · $20 Put · Nov 20, 2026");
    const html = desk();
    expect(html).toContain("Human review");
    expect(html).not.toContain("Not scheduled");
    expect(html).toContain("Oct 1");
    expect(html).toContain("not proof of automatic checks or exits");
  });

  it("UAT08 distinguishes same-title PW research cards with persisted run identities, not invented revisions", () => {
    const candidateStates = { total: 1, ready: 1, active: 0, expired: 0, declined: 0, blocked: 0, failed: 0, actionableCandidateId: 540001, actionableSymbol: "PWR", label: "1 ready" };
    fixture.queries.runs.data = [690001, 690002].map(id => ({ id, thesisId: 720001, thesisName: "PW", status: "complete", createdAt: now, candidateCount: 1, candidateStates }));
    const html = desk();
    expect(html).toContain("Run #690001");
    expect(html).toContain("Run #690002");
    expect(html).not.toContain("Revision #");
  });
});
