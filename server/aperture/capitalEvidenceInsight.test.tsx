import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { CapitalEvidenceView } from "../../shared/capitalEvidenceContext";
const hooks = vi.hoisted(() => ({ query: vi.fn(), options: vi.fn(), securities: vi.fn(), mutate: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: { useUtils: () => ({}), aperture: { capitalEvidence: { context: { useQuery: hooks.query }, options: { useQuery: hooks.options }, securityChoices: { useQuery: hooks.securities }, confirmBinding: { useMutation: () => ({ mutateAsync: hooks.mutate }) } } } } }));
import { CapitalEvidenceInsight, CapitalEvidenceInsightView, CapitalEvidenceBindingManager, CapitalEvidenceConfirmForm } from "../../client/src/components/aperture/CapitalEvidenceInsight";
const scope = { decisionRunId: 1, revisionId: 2, candidateId: 3 };
const fixture = (): CapitalEvidenceView => ({
  status: "ready", reason: null, scope, authority: "research_only", attention: [],
  source: { analysisRunId: "illustrative-analysis", completedAt: 100, limitation: "SEC metadata only; not financial verification." },
  findings: [{ id: "I1", criterion: "Illustrative criterion", statement: "Illustrative research hypothesis", classification: "hypothesis", rationale: "Illustrative rationale", uncertainty: "Unverified contents", citationIds: ["E1"], receiptIds: ["illustrative-receipt"], analysisRunId: "illustrative-analysis", citations: [], staleAtRun: false, expiredNow: false, nextAction: "review_research_basis" }],
});
const render = (result = fixture()) => load(renderToStaticMarkup(<CapitalEvidenceInsightView scope={scope} result={result} />));
describe("Capital evidence insight", () => {
  beforeEach(() => { hooks.query.mockReset(); hooks.options.mockReset(); hooks.securities.mockReset(); hooks.mutate.mockReset(); });
  it("has one inspection action and no visible raw receipt or run IDs", () => {
    const $ = render();
    expect($("button")).toHaveLength(1);
    expect($("button").text()).toBe("Review research basis");
    expect($("button").attr("aria-expanded")).toBe("false");
    expect($.text()).not.toContain("illustrative-receipt");
    expect($.text()).not.toContain("illustrative-analysis");
    expect($.text()).toContain("not trade clearance");
  });
  it("keeps genuinely unbound small and non-alerting", () => {
    const $ = render({ ...fixture(), status: "unavailable", reason: "evidence_context_not_bound", findings: [], source: null });
    expect($.text()).toBe("No bound public evidence.");
    expect($("section,button,[role=alert]")).toHaveLength(0);
  });
  it.each(["decisionRunId", "revisionId", "candidateId"] as const)("fails closed on %s mismatch", field => {
    const $ = render({ ...fixture(), scope: { ...scope, [field]: 99 } });
    expect($("[role=alert]")).toHaveLength(1);
    expect($.text()).not.toContain("Illustrative research hypothesis");
  });
  it("labels reassessment without claiming a cleared gate", () => {
    expect(render({ ...fixture(), status: "needs_reassessment" }).text()).toContain("Reassessment needed");
  });
  it("bounds the default statement and leaves full content for inspection", () => {
    const result = fixture(); result.findings[0].statement = "x".repeat(1200);
    const $ = render(result);
    expect($.text()).not.toContain("x".repeat(181));
    expect($.text()).toContain("x".repeat(180) + "…");
  });
  it("does not query without an explicit scope", () => {
    renderToStaticMarkup(<CapitalEvidenceInsight scope={null} />);
    expect(hooks.query).not.toHaveBeenCalled();
  });
  it("rejects invalid scopes without a read", () => {
    renderToStaticMarkup(<CapitalEvidenceInsight scope={{ ...scope, revisionId: 0 }} />);
    expect(hooks.query).not.toHaveBeenCalled();
  });
  it("does not present an old implication while refreshing", () => {
    hooks.query.mockReturnValue({ data: fixture(), isFetching: true });
    const html = renderToStaticMarkup(<CapitalEvidenceInsight scope={scope} />);
    expect(html).toContain("Reading bound research");
    expect(html).not.toContain("Illustrative research hypothesis");
  });
  it("distinguishes invalid binding from genuinely unbound", () => {
    const $ = render({ ...fixture(), status: "unavailable", reason: "binding_or_source_invalid" });
    expect($.text()).toContain("unavailable; no implication inferred");
    expect($.text()).not.toContain("No bound public evidence");
  });
  it("does not fabricate findings when source or findings are missing", () => {
    expect(render({ ...fixture(), findings: [] }).text()).toContain("No supported research implication");
    expect(render({ ...fixture(), source: null }).text()).toContain("No supported research implication");
  });
  it("does not create a dangling inspector aria-controls while collapsed", () => {
    expect(render()("button").attr("aria-controls")).toBeUndefined();
  });
  it("uses defined border tokens and responsive controls with focus-return wiring", () => {
    const css = readFileSync("client/src/index.css", "utf8");
    expect(css).toMatch(/--sh-border-1\s*:/);
    const source = readFileSync("client/src/components/aperture/CapitalEvidenceInsight.tsx", "utf8");
    expect(source).toContain("h-auto min-h-11 max-w-full whitespace-normal");
    expect(source).toContain("ref={focusInspector} tabIndex={-1}");
    expect(source).toContain("onClick={closeInspector}");
    expect(source).toContain("[overflow-wrap:anywhere]");
  });
  it("queries exact scope through the real bridge with automatic retries disabled", () => {
    hooks.query.mockReturnValue({ data: fixture(), isFetching: false });
    renderToStaticMarkup(<CapitalEvidenceInsight scope={scope} />);
    expect(hooks.query).toHaveBeenCalledWith(scope, { retry: false, refetchOnWindowFocus: false, refetchInterval: 60_000, refetchIntervalInBackground: false });
    expect(hooks.options).not.toHaveBeenCalled();
    expect(hooks.securities).not.toHaveBeenCalled();
  });
  it("loads authorized manager options only on demand and leaves every selector empty", () => {
    hooks.options.mockReturnValue({ data: { runs: [{ dealId: 7, dealName: "Illustrative owned deal", analysisRunId: "saved-version", mode: "red_team", startedAt: new Date(0) }], hasMore: false, limitation: "Saved attempts only" } });
    hooks.securities.mockReturnValue({ data: { choices: [{ id: 8, symbol: "SAMPLE", cik: "0000000001", assetType: "equity" }], limitation: "Suggestions only" } });
    const $ = load(renderToStaticMarkup(<CapitalEvidenceBindingManager scope={scope} />));
    expect(hooks.options).toHaveBeenCalledWith(scope, { retry: false, refetchOnWindowFocus: false });
    expect(hooks.securities).toHaveBeenCalledWith(scope, { retry: false, refetchOnWindowFocus: false });
    expect($("select")).toHaveLength(3);
    $("select").each((_, element) => expect($(element).find("option[selected]").attr("value")).toBe(""));
    expect($.text()).toContain("Illustrative owned deal");
    expect($.text()).toContain("CIK 0000000001");
    expect($("input[type=text],input[type=number]")).toHaveLength(0);
    expect(hooks.mutate).not.toHaveBeenCalled();
  });
  it("does not substitute a security when the choices read fails", () => {
    hooks.options.mockReturnValue({ data: { runs: [], hasMore: false, limitation: "Saved attempts only" } });
    hooks.securities.mockReturnValue({ error: new Error("unavailable"), refetch: vi.fn() });
    const $ = load(renderToStaticMarkup(<CapitalEvidenceBindingManager scope={scope} />));
    expect($.text()).toContain("No identity has been substituted");
    expect(hooks.mutate).not.toHaveBeenCalled();
  });
  it("requires explicit mappings and human confirmation before enabling the write", () => {
    const choices: React.ComponentProps<typeof CapitalEvidenceConfirmForm>["choices"] = {
      expectedLockVersion: 0,
      binding: { version: 1, kind: "sec_metadata_research", decisionRunId: 1, researchRunId: 4, candidateId: 3, canonicalThesisId: 5, capitalThesisId: 6, accountId: 7, securityId: 8, cik: "0000000001", symbol: "SAMPLE", dealId: 9, analysisRunId: "00000000-0000-4000-8000-000000000001", analysisSnapshotHash: "a".repeat(64), thesisSnapshotHash: "b".repeat(64), identityBasis: "operator_confirmed_security_cik_not_independently_verified", relation: "same_legal_entity" },
      findings: [{ id: "I1", criterion: "filing_coverage", statement: "Illustrative hypothesis", classification: "hypothesis", rationale: "Illustrative rationale", uncertainty: "Metadata only", citationIds: ["E1"] }],
      criteria: [{ field: "beliefs", index: 0, text: "Illustrative saved belief" }],
      issuer: { securityId: 8, symbol: "SAMPLE", cik: "0000000001" },
    };
    const $ = load(renderToStaticMarkup(<CapitalEvidenceConfirmForm scope={scope} choices={choices} reload={() => {}} />));
    expect($("select option[selected]").attr("value")).toBe("");
    expect($("input[type=checkbox]").is(":checked")).toBe(false);
    expect($("button").filter((_, element) => $(element).text() === "Confirm and create new revision").is(":disabled")).toBe(true);
    expect(hooks.mutate).not.toHaveBeenCalled();
  });
  it("does not show cached success when read failed", () => {
    hooks.query.mockReturnValue({ data: fixture(), error: new Error("unavailable"), refetch: vi.fn() });
    const $ = load(renderToStaticMarkup(<CapitalEvidenceInsight scope={scope} />));
    expect($("[role=alert]").text()).toContain("No result substituted");
    expect($.text()).not.toContain("Illustrative research hypothesis");
  });
  it("wires actual CandidateBoard authority and excludes mutation or scoring calls", () => {
    const page = readFileSync("client/src/pages/aperture/CandidateBoard.tsx", "utf8");
    expect(page).toContain("<CapitalEvidenceInsight scope={data.decisionAuthority && focusCandidate");
    const component = readFileSync("client/src/components/aperture/CapitalEvidenceInsight.tsx", "utf8");
    const reader = component.slice(component.indexOf("function ConnectedInsight"));
    expect(reader).not.toMatch(/useMutation|consensusScore|killProbability|\.mutate\(/);
    expect(component).toContain('event.key === "Escape"');
    expect(component).toContain("trigger.current?.focus()");
    expect(component).toContain("min-h-11");
  });
  it("requeries the authoritative run after success without patching a local revision", () => {
    const component = readFileSync("client/src/components/aperture/CapitalEvidenceInsight.tsx", "utf8");
    expect(component).toContain("await utils.aperture.run.get.invalidate({ id: choices.binding.researchRunId })");
    expect(component).toContain("await utils.aperture.run.get.fetch({ id: choices.binding.researchRunId })");
    expect(component).toContain("latest.decisionAuthority?.revisionId !== savedRevision.revisionId");
    expect(component).not.toMatch(/\.setData\(|setScope\(/);
    expect(component).toContain("request.current?.key !== key");
  });
  it("polls only the mounted context reader, not binding choices or writes", () => {
    const source = readFileSync("client/src/components/aperture/CapitalEvidenceInsight.tsx", "utf8");
    expect(source.match(/refetchInterval:/g)).toHaveLength(1);
    expect(source.slice(0, source.indexOf("function ConnectedInsight"))).not.toContain("refetchInterval:");
    const page = readFileSync("client/src/pages/aperture/CandidateBoard.tsx", "utf8");
    expect(page).toMatch(/view === "ledger"[\s\S]*?<ResearchLedger[\s\S]*?\) : \([\s\S]*?<CapitalEvidenceInsight/);
  });
});
