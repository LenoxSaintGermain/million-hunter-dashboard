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
} from "../shared/dealEvidence";
import type { DealEvidenceRun } from "./dealEvidenceRepository";
import DealEvidenceDesk, {
  DealEvidenceRunView,
  createDealEvidenceRequests,
} from "../client/src/components/DealEvidenceDesk";

const hooks = vi.hoisted(() => ({
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
    const $ = load(renderToStaticMarkup(<DealEvidenceDesk dealId={1} />));
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
    const $ = load(renderToStaticMarkup(<DealEvidenceDesk dealId={1} />));
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
    expect($('ol[aria-label="Evidence workflow"] > li')).toHaveLength(3);
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
    const html = renderToStaticMarkup(<DealEvidenceDesk dealId={1} />);
    expect(html).toContain("Attachments unavailable: Storage offline");
    expect(html).toContain("Run history unavailable: History unavailable");
    expect(html).not.toContain("No saved attachments");
    expect(html).not.toContain("No saved evidence-aware runs");
  });
  it("selects latest failure without substituting an older successful run", () => {
    const failed: DealEvidenceRun = {
      ...runFixture,
      id: "60000000-0000-4000-8000-000000000001",
      startedAt: new Date("2026-10-12T13:00:00Z"),
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
    expect(html).toContain("Latest saved run failed");
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
    const page = readFileSync(
      new URL("../client/src/pages/DealDetail.tsx", import.meta.url),
      "utf8"
    );
    expect(page).toContain('workPane === "research" && <DealEvidenceDesk');
    expect(page).toContain("demo={Boolean(deal.isSynthetic)}");
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
          output: {
            consensusScore: 0.4,
            divergenceScore: 0.2,
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
    expect(html).toContain("Model consensus score: 0.400");
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
  it("retains request UUID for unknown outcomes and rotates only after saved terminal result", async () => {
    const requests = createDealEvidenceRequests();
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
