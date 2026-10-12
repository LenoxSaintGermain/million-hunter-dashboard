import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { EvidenceReceipt } from "./evidenceRepository";
import { DealEvidenceReceiptSummary } from "../client/src/components/DealEvidenceReceiptSummary";
import { DealEvidenceRunComparison } from "../client/src/components/DealEvidenceRunComparison";
import type { DealEvidenceSnapshot } from "../shared/dealEvidence";
import {
  SEC_ANALYSIS_LIMITATION,
  DEAL_EVIDENCE_PROMPT_VERSION,
  DEAL_EVIDENCE_FINDINGS_PROMPT_VERSION,
} from "../shared/dealEvidence";
import { projectDealEvidenceRun } from "../shared/dealEvidenceProjection";
import {
  DealEvidenceFindingProof,
  DealEvidenceInsightContent,
} from "../client/src/components/DealEvidenceInsight";
import { scheduleEvidenceExpiry } from "../client/src/components/DealEvidenceExpiry";
import { createEvidenceInspectorFocus } from "../client/src/components/DealEvidenceFocus";
import type { DealEvidenceRun } from "./dealEvidenceRepository";
import DealEvidenceDesk, {
  DealEvidenceRunView,
  DealEvidenceInsight,
  createDealEvidenceRequests,
  evidenceInspectorRunId,
  DealEvidencePinnedProof,
} from "../client/src/components/DealEvidenceDesk";

const hooks = vi.hoisted(() => ({
  identity: vi.fn(),
  attachments: vi.fn(),
  runs: vi.fn(),
  getRun: vi.fn(),
  receipt: vi.fn(),
  receipts: vi.fn(),
  attach: vi.fn(),
  redTeam: vi.fn(),
  ic: vi.fn(),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    auth: { me: { useQuery: hooks.identity } },
    useUtils: () => ({
      dealEvidence: {
        runs: { invalidate: vi.fn() },
        getRun: { invalidate: vi.fn() },
      },
    }),
    dealEvidence: {
      attachments: { useQuery: hooks.attachments },
      runs: { useQuery: hooks.runs },
      getRun: { useQuery: hooks.getRun },
      attach: { useMutation: hooks.attach },
      runRedTeam: { useMutation: hooks.redTeam },
      runIC: { useMutation: hooks.ic },
    },
    publicEvidence: {
      get: { useQuery: hooks.receipt },
      list: { useQuery: hooks.receipts },
    },
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  hooks.identity.mockReturnValue({ data: { id: 1 }, error: null });
  for (const hook of [hooks.attachments, hooks.runs, hooks.receipts])
    hook.mockReturnValue({
      data: [],
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });
  for (const hook of [hooks.getRun, hooks.receipt])
    hook.mockReturnValue({
      data: undefined,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });
  for (const hook of [hooks.attach, hooks.redTeam, hooks.ic])
    hook.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });
});

describe("Deal evidence input comparison", () => {
  const previous = {
    deal: { id: 1, name: "Illustrative deal" },
    evidence: [{ cik: "0000000001", receiptId: "old", payloadHash: "same" }],
  } as DealEvidenceSnapshot;
  it("labels same-hash recapture separately from content changes", () => {
    const next = {
      ...previous,
      evidence: [{ ...previous.evidence[0], receiptId: "new" }],
    };
    const $ = load(
      renderToStaticMarkup(
        <DealEvidenceRunComparison previous={previous} next={next} />
      )
    );
    expect($.text()).toContain("Recaptured · same content hash");
    expect($.text()).not.toContain("Captured content changed");
    expect($.text()).toContain("not a material-risk assessment");
    expect($("details[open]")).toHaveLength(0);
    expect($("details").text()).toContain("old");
    expect($("details").text()).toContain("new");
  });
  it("shows actual changed fields and content changes from the shared helper", () => {
    const next = {
      ...previous,
      deal: { ...previous.deal, name: "Revised illustrative deal" },
      evidence: [{ ...previous.evidence[0], payloadHash: "different" }],
    };
    const html = renderToStaticMarkup(
      <DealEvidenceRunComparison previous={previous} next={next} />
    );
    expect(html).toContain("Deal fields: name");
    expect(html).toContain("Captured content changed");
  });
  it("does not invent a zero change count when history is absent", () => {
    const $ = load(
      renderToStaticMarkup(
        <DealEvidenceRunComparison previous={null} next={previous} />
      )
    );
    expect($.text()).toContain("No previous saved input snapshot");
    expect($("dd")).toHaveLength(0);
  });
  it("refuses different-deal comparisons visibly", () => {
    const $ = load(
      renderToStaticMarkup(
        <DealEvidenceRunComparison
          previous={previous}
          next={{ ...previous, deal: { ...previous.deal, id: 2 } }}
        />
      )
    );
    expect($('[role="alert"]').text()).toContain("different deals");
    expect($("dd")).toHaveLength(0);
  });
});

const receipt: EvidenceReceipt = {
  id: "10000000-0000-4000-8000-000000000001",
  ownerId: 1,
  requestId: "20000000-0000-4000-8000-000000000001",
  subjectKey: "sec:CIK0000000001",
  provider: "sec-submissions",
  schemaVersion: 1,
  status: "ok",
  sourceUrl: "https://data.sec.gov/submissions/CIK0000000001.json",
  payloadHash: "a".repeat(64),
  recordedAt: new Date("2026-10-11T12:01:00Z"),
  retrievedAt: new Date("2026-10-11T12:00:00Z"),
  expiresAt: new Date("2026-10-12T12:00:00Z"),
  message: null,
  failureCode: null,
  payload: {
    status: "ok",
    company: { cik: "0000000001", name: "Illustrative test issuer" },
    sourceUrl: "https://data.sec.gov/submissions/CIK0000000001.json",
    retrievedAt: "2026-10-11T12:00:00Z",
    message: null,
    failureCode: null,
    filings: ["10-K", "8-K", "8-K"].map((form, index) => ({
      form,
      accessionNumber: `test-${index}`,
      filingDate: `2026-01-0${index + 1}`,
      reportDate: null,
      primaryDocument: "test.htm",
      url: "https://www.sec.gov/Archives/test.htm",
    })),
  },
};
const runFixture: DealEvidenceRun = {
  id: "30000000-0000-4000-8000-000000000001",
  requestId: "40000000-0000-4000-8000-000000000001",
  requestHash: "b".repeat(64),
  ownerId: 1,
  dealId: 1,
  mode: "red_team",
  models: ["illustrative-test-model"],
  startedAt: new Date("2026-10-11T13:00:00Z"),
  completedAt: new Date("2026-10-11T13:01:00Z"),
  status: "complete",
  failureCode: null,
  message: null,
  inputSnapshot: {
    schemaVersion: 1,
    promptVersion: DEAL_EVIDENCE_PROMPT_VERSION,
    limitation: SEC_ANALYSIS_LIMITATION,
    deal: {
      id: 1,
      name: "Illustrative test deal",
      description: null,
      industry: null,
      location: null,
      revenue: null,
      cashFlow: null,
      askingPrice: null,
      multiple: null,
      employees: null,
      yearEstablished: null,
    },
    evidence: [
      {
        attachmentId: "50000000-0000-4000-8000-000000000001",
        receiptId: receipt.id,
        payloadHash: receipt.payloadHash,
        cik: "0000000001",
        issuerName: "Illustrative test issuer",
        sourceUrl: receipt.sourceUrl,
        retrievedAt: "2026-10-11T12:00:00Z",
        expiresAt: "2026-10-12T12:00:00Z",
        staleAtRun: false,
        relation: "same_legal_entity",
        identityBasis: "owner_confirmed_not_independently_verified",
        status: "ok",
        totalFilings: 3,
        includedFilings: 3,
      },
    ],
    citations: [
      {
        id: "E1",
        receiptId: receipt.id,
        payloadHash: receipt.payloadHash,
        sourceUrl: receipt.sourceUrl,
        fact: "Illustrative saved filing metadata.",
      },
    ],
    gaps: ["Filing content not retrieved."],
  },
  output: {
    killProbability: 0.25,
    redFlags: ["Illustrative diligence hypothesis"],
    summary: "Illustrative saved analysis, not a real recommendation.",
    citations: [
      { citationId: "E1", quote: "Illustrative saved filing metadata." },
    ],
  },
};

describe("DealEvidenceDesk workflow", () => {
  it("opens with the selected insight, not receipt administration", () => {
    hooks.runs.mockReturnValue({ data: [runFixture], isFetching: false });
    hooks.getRun.mockReturnValue({ data: runFixture, isFetching: false });
    const $ = load(
      renderToStaticMarkup(<DealEvidenceDesk dealId={1} mode="red_team" />)
    );
    expect($.text()).toContain("Saved diligence hypothesis");
    expect($.text()).toContain("Inspect analysis basis");
    expect($.text()).not.toContain("Issuer CIK");
    expect($.text()).not.toContain("Saved run version");
    expect($.text()).not.toContain(receipt.id);
    expect($.text()).not.toContain(receipt.payloadHash);
    expect($("input, select")).toHaveLength(0);
    expect(hooks.attachments.mock.calls[0][1].enabled).toBe(false);
  });
  it("filters the latest attempt per mode and does not substitute success for pending", () => {
    const pending = {
      ...runFixture,
      id: "60000000-0000-4000-8000-000000000001",
      mode: "ic",
      status: "pending",
      output: null,
      completedAt: null,
      startedAt: new Date("2026-10-12"),
    };
    hooks.runs.mockReturnValue({ data: [runFixture, pending] });
    hooks.getRun.mockReturnValue({ data: pending });
    const html = renderToStaticMarkup(
      <DealEvidenceDesk dealId={1} mode="ic" />
    );
    expect(hooks.getRun.mock.calls[0][0].id).toBe(pending.id);
    expect(html).toContain("Analysis pending");
    expect(html).not.toContain("Illustrative saved analysis");
  });
  it("respects a controlled null result and labels empty IC correctly", () => {
    hooks.runs.mockReturnValue({ data: [runFixture] });
    const html = renderToStaticMarkup(
      <DealEvidenceDesk dealId={1} mode="ic" selectedRunId={null} />
    );
    expect(hooks.getRun.mock.calls[0][1].enabled).toBe(false);
    expect(html).toContain("Committee");
    expect(html).not.toContain("Red Team");
    expect(html).not.toContain("Illustrative saved analysis");
  });
  it("keeps full attachment identifiers in closed provenance and buttons editorial", () => {
    hooks.attachments.mockReturnValue({
      data: [
        {
          id: "50000000-0000-4000-8000-000000000001",
          receiptId: receipt.id,
          confirmedCik: "0000000001",
          createdAt: receipt.recordedAt,
          payloadHash: receipt.payloadHash,
        },
      ],
      error: null,
      isFetching: false,
    });
    const $ = load(
      renderToStaticMarkup(<DealEvidenceDesk dealId={1} managerOnly />)
    );
    const row = $(
      'section[aria-label="Attached evidence versions"] li'
    ).first();
    expect(row.find("label").text()).toContain("Version 10000000");
    expect(row.find("label").text()).not.toContain(receipt.id);
    expect(row.find("details").text()).toContain(receipt.id);
    expect(row.find("details[open]")).toHaveLength(0);
    $("button").each((_, element) => {
      expect($(element).attr("class")).toContain("rounded-none");
      expect($(element).attr("class")).toContain("shadow-none");
      expect($(element).attr("class")).not.toMatch(
        /(?:^|\s)rounded-md(?:\s|$)/
      );
    });
  });
  it("defaults to explicit issuer lookup and keeps UUID entry advanced", () => {
    const $ = load(
      renderToStaticMarkup(<DealEvidenceDesk dealId={1} managerOnly />)
    );
    expect($.text()).toContain("Issuer CIK");
    expect($.text()).toContain("Find saved receipts");
    $('input:not([type="checkbox"]), select').each((_, element) => {
      expect($(element).attr("class")).toContain("rounded-none");
    });
    expect(
      $("summary")
        .filter((_, element) =>
          $(element).text().includes("Advanced: open a receipt ID")
        )
        .parent()
        .attr("open")
    ).toBeUndefined();
    expect(hooks.receipts.mock.calls[0][1].enabled).toBe(false);
    expect(hooks.receipt.mock.calls[0][1].enabled).toBe(false);
    expect(hooks.getRun.mock.calls[0][1].enabled).toBe(false);
    for (const mutation of [hooks.attach, hooks.redTeam, hooks.ic])
      expect(mutation.mock.results[0].value.mutateAsync).not.toHaveBeenCalled();
    expect($('ol[aria-label="Evidence workflow"] > li')).toHaveLength(0);
    expect(
      $("button")
        .filter((_, element) => $(element).text().startsWith("Run "))
        .filter("[disabled]")
    ).toHaveLength(2);
  });
  it("demo mode invokes no query or mutation hooks", () => {
    const html = renderToStaticMarkup(<DealEvidenceDesk dealId={1} demo />);
    expect(html).toContain("Illustrative demo");
    for (const hook of Object.values(hooks))
      expect(hook).not.toHaveBeenCalled();
  });
  it("shows attachment and history read failures without empty success claims", () => {
    hooks.attachments.mockReturnValue({
      data: undefined,
      error: { message: "Storage offline" },
    });
    hooks.runs.mockReturnValue({
      data: undefined,
      error: { message: "History unavailable" },
    });
    const html = renderToStaticMarkup(
      <DealEvidenceDesk dealId={1} managerOnly />
    );
    expect(html).toContain("Attachments unavailable: Storage offline");
    expect(html).not.toContain("No saved evidence-aware runs");
    expect(html).not.toContain("No saved attachments");
    expect(html).not.toContain("No saved evidence-aware runs");
  });
  it("selects latest failure without substituting an older successful run", () => {
    const failed: DealEvidenceRun = {
      ...runFixture,
      id: "60000000-0000-4000-8000-000000000001",
      startedAt: new Date("2026-10-12T13:00:00Z"),
      completedAt: new Date("2026-10-12T13:01:00Z"),
      status: "failed",
      output: null,
      failureCode: "INVALID_OUTPUT",
      message: "No decision recorded.",
    };
    hooks.runs.mockReturnValue({
      data: [runFixture, failed],
      error: null,
      isFetching: false,
    });
    hooks.getRun.mockReturnValue({
      data: failed,
      error: null,
      isFetching: false,
    });
    const html = renderToStaticMarkup(<DealEvidenceDesk dealId={1} />);
    expect(hooks.getRun.mock.calls[0][0]).toEqual({ dealId: 1, id: failed.id });
    expect(html).toContain("Analysis failed; the question remains open");
    expect(html).not.toContain("25.0%");
  });
  it("keeps CIK confirmation, version selection, and explicit action inputs wired", () => {
    const source = readFileSync(
      new URL("../client/src/components/DealEvidenceDesk.tsx", import.meta.url),
      "utf8"
    );
    expect(source).toContain('relation: "same_legal_entity"');
    expect(source).toContain("confirmed: true");
    expect(source).toContain("confirmedCik");
    expect(source).toContain("attachmentIds");
    expect(source).toContain("requestId");
    expect(source).toContain("utils.dealEvidence.runs.invalidate");
  });
});

describe("Query-free contextual insight", () => {
  const actions = { onInspect: vi.fn(), onManageInputs: vi.fn() };
  const v2Run = (): DealEvidenceRun => ({
    ...runFixture,
    inputSnapshot: {
      ...runFixture.inputSnapshot,
      promptVersion: DEAL_EVIDENCE_FINDINGS_PROMPT_VERSION,
    },
    output: {
      outputVersion: 2,
      summary: "Illustrative v2 output",
      killProbability: 0.25,
      redFlags: [],
      citations: [
        { citationId: "E1", quote: "Illustrative saved filing metadata." },
      ],
      insights: [
        {
          id: "I1",
          kind: "hypothesis",
          interpretation: "Financing assumptions need document reconciliation.",
          rationale: "The saved metadata does not establish debt service.",
          uncertainty: "No financial statements were reviewed.",
          criterion: "financing",
          action: "inspect_financing",
          citations: [
            { citationId: "E1", quote: "Illustrative saved filing metadata." },
          ],
        },
      ],
    },
  });
  function buttons(node: React.ReactNode): React.ReactElement<{
    children?: React.ReactNode;
    onClick?: () => void;
  }>[] {
    if (Array.isArray(node)) return node.flatMap(buttons);
    if (
      !React.isValidElement<{
        children?: React.ReactNode;
        onClick?: () => void;
      }>(node)
    )
      return [];
    return [
      ...(node.type === "button" ? [node] : []),
      ...buttons(node.props.children),
    ];
  }
  it("renders a validated implication and routes its exact action context only on click", () => {
    const run = v2Run();
    const onNavigate = vi.fn();
    const tree = DealEvidenceInsightContent({ run, onNavigate, ...actions });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain(
      "Financing assumptions need document reconciliation"
    );
    expect(html).not.toContain("No financial statements were reviewed");
    expect(html).not.toContain(
      "The saved metadata does not establish debt service"
    );
    expect(html).toContain("SEC metadata only");
    expect(html).toContain("Review financing assumptions");
    expect(html).not.toContain("Legacy saved summary");
    expect(onNavigate).not.toHaveBeenCalled();
    buttons(tree)[0].props.onClick!();
    expect(onNavigate).toHaveBeenCalledWith(
      "capital",
      expect.objectContaining({
        dealId: 1,
        runId: run.id,
        receiptIds: [receipt.id],
        insightKey: `${run.id}:1:I1`,
      })
    );
    buttons(tree)[1].props.onClick!();
    expect(actions.onInspect).toHaveBeenCalledWith(
      expect.objectContaining({ key: `${run.id}:1:I1` })
    );
  });
  it("keeps each finding attached to its quoted facts and immutable receipt", () => {
    const finding = projectDealEvidenceRun(v2Run(), new Date()).insights[0];
    const onInspectReceipt = vi.fn();
    const tree = DealEvidenceFindingProof({ finding, onInspectReceipt });
    const $ = load(renderToStaticMarkup(tree));
    expect($.text()).toContain("Illustrative saved filing metadata.");
    expect($.text()).toContain("No financial statements were reviewed");
    expect($.text()).toContain(
      "The saved metadata does not establish debt service"
    );
    expect($.text()).toContain("not independent verification of the inference");
    expect($("details[open]")).toHaveLength(0);
    buttons(tree)[0].props.onClick!();
    expect(onInspectReceipt).toHaveBeenCalledWith(receipt.id);
  });
  it.each(["complete", "failed"] as const)(
    "pins finding inspection to run A when newer %s run B arrives",
    status => {
      const runA = v2Run();
      const findingA = projectDealEvidenceRun(runA, new Date()).insights[0];
      const runB: DealEvidenceRun = {
        ...runA,
        id: "90000000-0000-4000-8000-000000000001",
        startedAt: new Date("2026-10-12T13:00:00Z"),
        completedAt: new Date("2026-10-12T13:01:00Z"),
        status,
        output: status === "failed" ? null : runA.output,
        failureCode: status === "failed" ? "PROVIDER_UNAVAILABLE" : null,
        message: status === "failed" ? "Provider unavailable" : null,
      };
      const inspectorId = evidenceInspectorRunId(runB.id, runA.id, findingA);
      expect(inspectorId).toBe(runA.id);
      const inspected = [runB, runA].find(run => run.id === inspectorId)!;
      expect(
        projectDealEvidenceRun(inspected, new Date()).insights[0].key
      ).toBe(findingA.key);
      expect(projectDealEvidenceRun(runB, new Date()).state).toBe(
        status === "failed" ? "failed" : "ready"
      );
      expect(evidenceInspectorRunId(runB.id, null, findingA)).toBe(runA.id);
      expect(evidenceInspectorRunId(runB.id, null, null)).toBe(runB.id);
    }
  );
  it("shows a pinned A refresh failure beside retained cached proof when B is latest", () => {
    const runA = v2Run();
    const findingA = projectDealEvidenceRun(runA, new Date()).insights[0];
    const latestB = "90000000-0000-4000-8000-000000000001";
    expect(evidenceInspectorRunId(latestB, runA.id, findingA)).toBe(runA.id);
    const retry = vi.fn();
    const tree = DealEvidencePinnedProof({
      finding: findingA,
      refreshError: { message: "Saved run unavailable" },
      onRetry: retry,
      onInspectReceipt: vi.fn(),
    });
    const $ = load(
      renderToStaticMarkup(
        <section>
          {tree}
          <details>
            <summary>Run history</summary>
          </details>
        </section>
      )
    );
    const warning = $('[role="alert"]');
    expect(warning.text()).toContain(
      "Pinned run refresh failed: Saved run unavailable"
    );
    expect(warning.text()).toContain(
      "Showing cached proof from the original run"
    );
    expect(warning.parents("details, [hidden]")).toHaveLength(0);
    expect($.text()).toContain(findingA.interpretation);
    expect($("details[open]")).toHaveLength(0);
    expect(warning.find("button").text()).toBe("Retry pinned run refresh");
    const source = readFileSync(
      "client/src/components/DealEvidenceDesk.tsx",
      "utf8"
    );
    expect(source).toContain("refreshError={runDetail.error}");
    expect(source.indexOf("{pinnedFinding && (")).toBeLessThan(
      source.indexOf("<details open={!finding}>")
    );
  });
  it("bounds the default statement while preserving full text in basis inspection", () => {
    const run = v2Run();
    const statement = "A recorded diligence hypothesis. ".repeat(12);
    if (run.output && "redFlags" in run.output)
      run.output.insights![0].interpretation = statement;
    const projection = projectDealEvidenceRun(run, new Date());
    const $ = load(
      renderToStaticMarkup(
        <DealEvidenceInsight run={run} {...actions} onNavigate={() => {}} />
      )
    );
    expect($("article h3").text()).toBe(statement.slice(0, 160) + "…");
    expect($("article p")).toHaveLength(1);
    const proof = renderToStaticMarkup(
      <DealEvidenceFindingProof
        finding={projection.insights[0]}
        onInspectReceipt={() => {}}
      />
    );
    expect(proof).toContain(statement);
  });
  it("blocks an invalid v2 fact rather than promoting it to an implication", () => {
    const run = v2Run();
    if (run.output && "redFlags" in run.output)
      run.output.insights![0].citations[0].quote = "Invented fact";
    const html = renderToStaticMarkup(
      <DealEvidenceInsight run={run} {...actions} onNavigate={() => {}} />
    );
    expect(html).toContain("could not be validated");
    expect(html).not.toContain("Review financing assumptions");
    expect(html).not.toContain("Financing assumptions need");
  });
  it("rejects a supplied projection for another selected run", () => {
    const projection = projectDealEvidenceRun(v2Run(), new Date());
    const html = renderToStaticMarkup(
      <DealEvidenceInsight
        run={{ ...v2Run(), id: "90000000-0000-4000-8000-000000000001" }}
        projection={projection}
        {...actions}
      />
    );
    expect(html).toContain("does not match this run or mode");
    expect(html).not.toContain("Financing assumptions need");
  });
  it("does not invent finding-level implications from legacy prose", () => {
    const html = renderToStaticMarkup(
      <DealEvidenceInsight run={runFixture} {...actions} />
    );
    expect(html).toContain(
      "finding-level implications and next steps were not recorded"
    );
    expect(html).not.toContain("Review financing");
    for (const hook of Object.values(hooks))
      expect(hook).not.toHaveBeenCalled();
  });
  it("keeps read failure visible instead of presenting cached output", () => {
    const html = renderToStaticMarkup(
      <DealEvidenceInsight
        run={runFixture}
        error="Storage offline"
        onRetry={() => {}}
        {...actions}
      />
    );
    expect(html).toContain("Retry saved analysis");
    expect(html).toContain("No older success has been substituted");
    expect(html).not.toContain("Illustrative saved analysis");
  });
  it("distinguishes current expiry from freshness at run time", () => {
    const html = renderToStaticMarkup(
      <DealEvidenceInsight
        run={{
          ...runFixture,
          inputSnapshot: {
            ...runFixture.inputSnapshot,
            evidence: runFixture.inputSnapshot.evidence.map(item => ({
              ...item,
              retrievedAt: "2000-01-01T00:00:00Z",
              expiresAt: "2000-01-02T00:00:00Z",
              staleAtRun: false,
            })),
          },
        }}
        {...actions}
      />
    );
    expect(html).toContain("Source basis expired now");
    expect(html).not.toContain("An expired snapshot was used at run time");
  });
});

describe("Saved evidence analysis rendering", () => {
  it("shows exact input counts and resolved source references as saved model hypotheses", () => {
    const $ = load(
      renderToStaticMarkup(<DealEvidenceRunView run={runFixture} />)
    );
    expect($.text()).toContain("3 of 3 captured filing entries included");
    expect($.text()).toContain("3 of 3 captured metadata entries included");
    expect(
      $("summary")
        .filter((_, element) =>
          $(element).text().includes("Inspect evidence versions")
        )
        .parent()
        .attr("open")
    ).toBeUndefined();
    expect($.text()).toContain("25.0% · not a calibrated probability");
    expect($.text()).toContain("requires human review; not approval");
    expect($.text()).toContain(receipt.payloadHash);
    expect($.text()).toContain(receipt.id);
    expect(
      $('section[aria-label="Saved analysis citations"] a').attr("href")
    ).toBe(receipt.sourceUrl);
    expect($("details[open]")).toHaveLength(0);
  });
  it.each(["pending", "failed"] as const)(
    "does not show successful output for %s runs",
    status => {
      const html = renderToStaticMarkup(
        <DealEvidenceRunView run={{ ...runFixture, status }} />
      );
      expect(html).not.toContain("25.0%");
      expect(html).not.toContain(
        "Illustrative saved analysis, not a real recommendation"
      );
      expect(html).toContain(
        status === "pending" ? "no completed result" : "no decision recorded"
      );
    }
  );
  it("renders IC as three saved model opinions, not verification", () => {
    const html = renderToStaticMarkup(
      <DealEvidenceRunView
        run={{
          ...runFixture,
          mode: "ic",
          models: ["test-1", "test-2", "test-3"],
          output: {
            consensusScore: 0.5,
            divergenceScore: Math.sqrt(0.125 / 3),
            divergenceFlag: true,
            summary: "Illustrative committee output",
            scores: [1, 2, 3].map(index => ({
              model: `test-${index}`,
              score: index / 4,
              rationale: "Illustrative rationale",
              citations: [
                {
                  citationId: "E1",
                  quote: "Illustrative saved filing metadata.",
                },
              ],
            })),
          },
        }}
      />
    );
    for (const seat of [
      "The Structuralist",
      "The Restructurer",
      "The Market Analyst",
    ])
      expect(html).toContain(seat);
    expect(html).toContain("Review-seat labels, not verified provider roles");
    expect(html).not.toContain("Panel member");
    expect(html).toContain("Model consensus score: 0.500");
    expect(html).toContain("Disagreement flagged");
    const $ = load(html);
    expect($.text()).toContain("not probabilities");
    const bars = $('summary span[aria-hidden="true"] > span');
    expect(bars).toHaveLength(3);
    expect(bars.map((_, element) => $(element).attr("style")).get()).toEqual([
      "width:25%",
      "width:50%",
      "width:75%",
    ]);
    expect($("details[open]")).toHaveLength(0);
  });
});

describe("Deal evidence mutation request identity", () => {
  function journalStorage() {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
  }
  it("reuses a lost-response request after remount and clears a confirmed terminal outcome", async () => {
    const store = journalStorage();
    const scope = { ownerId: 7, dealId: 9 };
    const invoke = vi
      .fn()
      .mockRejectedValueOnce(new Error("Response lost"))
      .mockResolvedValue({ status: "complete" });
    await expect(
      createDealEvidenceRequests(scope, store).submit(
        "run:9:ic:attachment-a",
        invoke
      )
    ).rejects.toThrow("Response lost");
    await createDealEvidenceRequests(scope, store).submit(
      "run:9:ic:attachment-a",
      invoke
    );
    expect(invoke.mock.calls[1][0]).toBe(invoke.mock.calls[0][0]);
    await createDealEvidenceRequests(scope, store).submit(
      "run:9:ic:attachment-a",
      invoke
    );
    expect(invoke.mock.calls[2][0]).not.toBe(invoke.mock.calls[1][0]);
  });
  it("isolates unresolved retry identities by owner, deal, mode and exact inputs", async () => {
    const store = journalStorage();
    const invoke = vi.fn().mockResolvedValue({ status: "pending" });
    const keep = () => false;
    await createDealEvidenceRequests({ ownerId: 1, dealId: 1 }, store).submit(
      "run:1:ic:a",
      invoke,
      keep
    );
    await createDealEvidenceRequests({ ownerId: 2, dealId: 1 }, store).submit(
      "run:1:ic:a",
      invoke,
      keep
    );
    await createDealEvidenceRequests({ ownerId: 1, dealId: 2 }, store).submit(
      "run:2:ic:a",
      invoke,
      keep
    );
    await createDealEvidenceRequests({ ownerId: 1, dealId: 1 }, store).submit(
      "run:1:red_team:a",
      invoke,
      keep
    );
    await createDealEvidenceRequests({ ownerId: 1, dealId: 1 }, store).submit(
      "run:1:ic:b",
      invoke,
      keep
    );
    expect(new Set(invoke.mock.calls.map(call => call[0])).size).toBe(5);
    await createDealEvidenceRequests({ ownerId: 1, dealId: 1 }, store).submit(
      "run:1:ic:a",
      invoke,
      keep
    );
    expect(invoke.mock.calls[5][0]).toBe(invoke.mock.calls[0][0]);
  });
  it("clears a lost response when saved history confirms that same request", async () => {
    const store = journalStorage();
    const scope = { ownerId: 1, dealId: 1 };
    const invoke = vi.fn().mockRejectedValue(new Error("Unknown outcome"));
    await createDealEvidenceRequests(scope, store)
      .submit("run:1:ic:a", invoke)
      .catch(() => {});
    const oldId = invoke.mock.calls[0][0];
    createDealEvidenceRequests(scope, store).reconcile([oldId]);
    await createDealEvidenceRequests(scope, store)
      .submit("run:1:ic:a", invoke)
      .catch(() => {});
    expect(invoke.mock.calls[1][0]).not.toBe(oldId);
  });
  it("does not start paid work when the retry identity cannot be persisted", async () => {
    const invoke = vi.fn();
    const store = {
      getItem: () => null,
      setItem: () => {
        throw new Error("Storage unavailable");
      },
    };
    await expect(
      createDealEvidenceRequests({ ownerId: 1, dealId: 1 }, store).submit(
        "run:1:ic:a",
        invoke
      )
    ).rejects.toThrow("Storage unavailable");
    expect(invoke).not.toHaveBeenCalled();
  });
  it("updates a frozen projection at expiry using only the local clock", () => {
    vi.useFakeTimers();
    try {
      const expires = Date.parse(
        runFixture.inputSnapshot.evidence[0].expiresAt
      );
      vi.setSystemTime(expires - 1000);
      const projection = projectDealEvidenceRun(runFixture, new Date());
      let html = "";
      const render = () => {
        html = renderToStaticMarkup(
          <DealEvidenceInsightContent
            run={runFixture}
            projection={projection}
            now={Date.now()}
            onInspect={() => {}}
            onManageInputs={() => {}}
          />
        );
      };
      render();
      expect(html).not.toContain("Source basis expired now");
      const notify = vi.fn(render);
      const cancel = scheduleEvidenceExpiry([expires], notify);
      vi.advanceTimersByTime(999);
      expect(notify).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(notify).toHaveBeenCalledOnce();
      expect(html).toContain("Source basis expired now");
      expect(html).not.toContain("An expired snapshot was used at run time");
      for (const hook of Object.values(hooks))
        expect(hook).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
      cancel();
    } finally {
      vi.useRealTimers();
    }
  });
  it("re-arms for distinct expiries and cancels cleanly on unmount", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(10000);
      const notify = vi.fn();
      const cancel = scheduleEvidenceExpiry(
        [9000, NaN, 11000, 11000, 12000, 13000],
        notify
      );
      vi.advanceTimersByTime(2000);
      expect(notify).toHaveBeenCalledTimes(2);
      cancel();
      vi.advanceTimersByTime(10000);
      expect(notify).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
  it("returns focus to the exact opening control after close reveals its context", () => {
    const frames: Array<() => void> = [];
    const focus = createEvidenceInspectorFocus(work => frames.push(work));
    const trigger = { focus: vi.fn(), isConnected: true };
    const heading = { focus: vi.fn(), isConnected: true };
    const onOpen = () => focus.open(trigger, () => heading);
    const onClose = () => focus.close();
    onOpen();
    expect(heading.focus).not.toHaveBeenCalled();
    frames.shift()!();
    expect(heading.focus).toHaveBeenCalledOnce();
    onClose();
    expect(trigger.focus).not.toHaveBeenCalled();
    frames.shift()!();
    expect(trigger.focus).toHaveBeenCalledOnce();
  });
  it("keeps nested receipt return separate and focuses the new insight on success", () => {
    const frames: Array<() => void> = [];
    const outer = createEvidenceInspectorFocus(work => frames.push(work));
    const inner = createEvidenceInspectorFocus(work => frames.push(work));
    const origin = { focus: vi.fn() };
    const receiptTrigger = { focus: vi.fn() };
    const insight = { focus: vi.fn() };
    outer.open(origin, () => receiptTrigger);
    frames.shift()!();
    inner.open(receiptTrigger, () => ({ focus: vi.fn() }));
    frames.shift()!();
    inner.close();
    frames.shift()!();
    expect(receiptTrigger.focus).toHaveBeenCalledTimes(2);
    expect(origin.focus).not.toHaveBeenCalled();
    outer.move(() => insight);
    frames.shift()!();
    expect(insight.focus).toHaveBeenCalledOnce();
    expect(origin.focus).not.toHaveBeenCalled();
  });
  it("retains request UUID for unknown outcomes and rotates only after saved terminal result", async () => {
    const journal = new Map<string, string>();
    const requests = createDealEvidenceRequests(
      { ownerId: 1, dealId: 1 },
      {
        getItem: key => journal.get(key) || null,
        setItem: (key, value) => {
          journal.set(key, value);
        },
      }
    );
    const invoke = vi
      .fn()
      .mockRejectedValueOnce(new Error("Unknown save"))
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValue({ status: "failed" });
    const terminal = (value: { status: string }) => value.status !== "pending";
    await requests.submit("same-intent", invoke, terminal).catch(() => {});
    await requests.submit("same-intent", invoke, terminal);
    await requests.submit("same-intent", invoke, terminal);
    expect(invoke.mock.calls[0][0]).toBe(invoke.mock.calls[1][0]);
    expect(invoke.mock.calls[1][0]).toBe(invoke.mock.calls[2][0]);
    await requests.submit("same-intent", invoke, terminal);
    expect(invoke.mock.calls[3][0]).not.toBe(invoke.mock.calls[2][0]);
  });
});
describe("Deal evidence receipt summary", () => {
  it("renders actual counts, range, and selected immutable provenance without claiming attachment", () => {
    const $ = load(
      renderToStaticMarkup(
        <DealEvidenceReceiptSummary
          receipt={receipt}
          now={Date.parse("2026-10-11T13:00:00Z")}
        />
      )
    );
    expect($.text()).toContain("Selected version · not attached");
    expect(
      $("dt")
        .filter((_, element) => $(element).text() === "Captured filings")
        .next()
        .text()
    ).toBe("3");
    expect(
      $("dt")
        .filter((_, element) => $(element).text() === "Form types")
        .next()
        .text()
    ).toBe("2");
    expect($.text()).toContain("2026-01-01 – 2026-01-03");
    expect($.text()).toContain(receipt.id);
    expect($.text()).toContain(receipt.payloadHash);
    expect($("details[open]")).toHaveLength(0);
    expect($("a").attr("href")).toBe(receipt.sourceUrl);
  });
  it("discloses expired pinned snapshots rather than substituting a fresh version", () => {
    const html = renderToStaticMarkup(
      <DealEvidenceReceiptSummary
        receipt={receipt}
        attached
        now={Date.parse("2026-10-13")}
      />
    );
    expect(html).toContain("Attached immutable version");
    expect(html).toContain("Expired snapshot; not current evidence");
    expect(html).toContain("A newer capture does not replace this version");
  });
  it("failed receipts have unknown counts, never zero or a successful fetch time", () => {
    const failed: EvidenceReceipt = {
      ...receipt,
      status: "unavailable",
      retrievedAt: null,
      expiresAt: null,
      payload: {
        ...receipt.payload,
        status: "unavailable",
        company: null,
        filings: [],
        retrievedAt: null,
      },
    };
    const $ = load(
      renderToStaticMarkup(<DealEvidenceReceiptSummary receipt={failed} />)
    );
    expect(
      $("dt")
        .filter((_, element) => $(element).text() === "Captured filings")
        .next()
        .text()
    ).toBe("Unknown");
    expect($.text()).toContain("No successful fetch");
    expect($.text()).toContain("Issuer not verified");
  });
  it("keeps empty observations distinct from unavailable evidence", () => {
    const $ = load(
      renderToStaticMarkup(
        <DealEvidenceReceiptSummary
          receipt={{
            ...receipt,
            status: "empty",
            payload: { ...receipt.payload, status: "empty", filings: [] },
          }}
        />
      )
    );
    expect(
      $("dt")
        .filter((_, element) => $(element).text() === "Captured filings")
        .next()
        .text()
    ).toBe("0");
    expect($.text()).toContain("No filings in this saved response");
  });
  it("does not render unsafe source links", () => {
    const $ = load(
      renderToStaticMarkup(
        <DealEvidenceReceiptSummary
          receipt={{ ...receipt, sourceUrl: "javascript:alert(1)" }}
        />
      )
    );
    expect($("a")).toHaveLength(0);
  });
});
