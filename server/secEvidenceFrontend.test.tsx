import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import SecEvidencePanel, {
  ReceiptView,
  createCaptureRequests,
  type EvidenceReceipt,
} from "../client/src/components/SecEvidencePanel";

const hooks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  capture: vi.fn(),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    publicEvidence: {
      list: { useQuery: hooks.list },
      get: { useQuery: hooks.get },
      capture: { useMutation: hooks.capture },
    },
  },
}));
const receipt: EvidenceReceipt = {
  id: "10000000-0000-4000-8000-000000000001",
  requestId: "20000000-0000-4000-8000-000000000001",
  ownerId: 1,
  subjectKey: "sec:CIK0000320193",
  provider: "sec-submissions",
  schemaVersion: 1,
  sourceUrl: "https://data.sec.gov/submissions/CIK0000320193.json",
  status: "ok",
  payloadHash: "a".repeat(64),
  recordedAt: new Date("2026-10-11T12:01:00Z"),
  retrievedAt: new Date("2026-10-11T12:00:00Z"),
  expiresAt: new Date("2099-10-12T12:00:00Z"),
  message: null,
  failureCode: null,
  payload: {
    company: { cik: "0000320193", name: "Illustrative issuer" },
    status: "ok",
    sourceUrl: "https://data.sec.gov/submissions/CIK0000320193.json",
    retrievedAt: "2026-10-11T12:00:00Z",
    message: null,
    failureCode: null,
    filings: Array.from({ length: 5 }, (_, i) => ({
      accessionNumber: `accession-${i}`,
      form: i < 3 ? "10-K" : "8-K",
      filingDate: `2026-01-0${i + 1}`,
      reportDate: null,
      primaryDocument: `filing-${i}.htm`,
      url: `https://www.sec.gov/Archives/edgar/data/320193/filing-${i}.htm`,
    })),
  },
};
const failed: EvidenceReceipt = {
  ...receipt,
  id: "30000000-0000-4000-8000-000000000001",
  status: "unavailable",
  recordedAt: new Date("2026-10-12T12:00:00Z"),
  retrievedAt: null,
  expiresAt: null,
  message: "Provider timed out",
  failureCode: "TIMEOUT",
  payload: {
    ...receipt.payload,
    status: "unavailable",
    company: null,
    filings: [],
    retrievedAt: null,
    failureCode: "TIMEOUT",
  },
};
const metadata = ({ payload: _, ...rest }: EvidenceReceipt) => rest;
const render = () =>
  renderToStaticMarkup(
    <SecEvidencePanel cik="320193" name="Illustrative issuer" />
  );
beforeEach(() => {
  vi.clearAllMocks();
  hooks.list.mockReturnValue({
    data: [],
    error: null,
    isFetching: false,
    refetch: vi.fn(),
  });
  hooks.get.mockReturnValue({
    data: undefined,
    error: null,
    isFetching: false,
    refetch: vi.fn(),
  });
  hooks.capture.mockReturnValue({
    isPending: false,
    error: null,
    mutateAsync: vi.fn(),
  });
});

describe("SEC evidence presentation", () => {
  it("bounds 34 form types to six ranked bars with exact remaining counts", () => {
    const filings = Array.from({ length: 34 }, (_, index) =>
      Array.from({ length: index + 1 }, (_, occurrence) => ({
        ...receipt.payload.filings[0],
        form: `FORM-${index + 1}`,
        accessionNumber: `${index}-${occurrence}`,
      }))
    ).flat();
    const $ = load(renderToStaticMarkup(<ReceiptView receipt={{ ...receipt, payload: { ...receipt.payload, filings } }} />));
    const shown = $('ul[aria-label="Captured filings by form"] > li');
    const hidden = $('ul[aria-label="Remaining captured filings by form"] > li');
    expect(shown).toHaveLength(6);
    expect(shown.first().text()).toBe("FORM-34: 34");
    expect(shown.last().text()).toBe("FORM-29: 29");
    expect(hidden).toHaveLength(28);
    expect(hidden.first().text()).toBe("FORM-28: 28");
    expect(hidden.last().text()).toBe("FORM-1: 1");
    expect(hidden.first().closest("details").attr("open")).toBeUndefined();
    expect($("summary").first().text()).toBe("Show remaining 28 form types · 406 captured filings");
    expect($.text()).toContain("595 captured filings");
    expect($('ul[aria-label="Filing preview"] > li')).toHaveLength(3);
    expect($("details[open]")).toHaveLength(0);
  });
  it("computes exact form counts and date range, previews three with closed disclosure", () => {
    const $ = load(renderToStaticMarkup(<ReceiptView receipt={receipt} />));
    expect($.text()).toContain("5 captured filings · 2026-01-01 to 2026-01-05");
    expect($('ul[aria-label="Captured filings by form"]').text()).toContain(
      "10-K: 3"
    );
    expect($('ul[aria-label="Captured filings by form"]').text()).toContain(
      "8-K: 2"
    );
    expect($('ul[aria-label="Filing preview"] > li')).toHaveLength(3);
    expect($("summary").first().text()).toBe("Show remaining 2 filings");
    expect($("details[open]")).toHaveLength(0);
  });
  it("renders complete provenance without inventing successful failure timestamps", () => {
    const html = renderToStaticMarkup(<ReceiptView receipt={failed} />);
    for (const value of [
      failed.id,
      failed.requestId,
      failed.payloadHash,
      failed.subjectKey,
      failed.sourceUrl,
      "TIMEOUT",
      "Recorded",
      "No successful fetch",
      "Not applicable",
      "Filing count unknown",
    ])
      expect(html).toContain(value);
    expect(html).not.toContain("0 filings");
    expect(html).not.toContain("capture has expired");
  });
  it("labels expired successful snapshots stale and older selections historical", () => {
    const html = renderToStaticMarkup(
      <ReceiptView
        receipt={{ ...receipt, expiresAt: new Date("2020-01-01") }}
        historical
      />
    );
    expect(html).toContain("Stale — capture has expired");
    expect(html).toContain("Historical receipt — not the latest capture");
  });
  it("labels empty as a bounded observation, not proof of no filings", () => {
    const html = renderToStaticMarkup(
      <ReceiptView
        receipt={{
          ...receipt,
          status: "empty",
          payload: { ...receipt.payload, status: "empty", filings: [] },
        }}
      />
    );
    expect(html).toContain("0 filings in the captured response");
    expect(html).not.toContain("Captured filings by form");
  });
  it("blocks non-SEC source URLs", () => {
    const html = renderToStaticMarkup(
      <ReceiptView receipt={{ ...failed, sourceUrl: "javascript:alert(1)" }} />
    );
    expect(html).not.toContain('href="javascript:');
  });
});

describe("SEC evidence panel read/capture states", () => {
  it("reads only saved history on selection; capture requires issuer confirmation", () => {
    const $ = load(render());
    expect(hooks.list).toHaveBeenCalledWith(
      { cik: "0000320193" },
      expect.objectContaining({ retry: false, refetchOnWindowFocus: false })
    );
    expect(hooks.get.mock.calls[0][1].enabled).toBe(false);
    expect(
      $("button")
        .filter((_, e) => $(e).text() === "Capture SEC filings")
        .attr("disabled")
    ).toBeDefined();
    expect(
      hooks.capture.mock.results[0].value.mutateAsync
    ).not.toHaveBeenCalled();
    expect($.text()).toContain("Nothing is attached to a deal automatically");
    expect($.text()).toContain("up to 20 latest");
  });
  it("loads one detail from metadata and sorts by recordedAt, never nullable retrievedAt", () => {
    hooks.list.mockReturnValue({
      data: [metadata(receipt), metadata(failed)],
      error: null,
      isFetching: false,
    });
    hooks.get.mockReturnValue({ data: failed, error: null, isFetching: false });
    const html = render();
    expect(hooks.get).toHaveBeenCalledWith(
      { id: failed.id },
      expect.objectContaining({
        enabled: true,
        retry: false,
        refetchOnWindowFocus: false,
      })
    );
    expect(html).toContain("Latest saved capture failed");
    expect(html).not.toContain("5 captured filings");
  });
  it("does not turn history read errors into empty libraries", () => {
    hooks.list.mockReturnValue({
      data: undefined,
      error: { message: "Storage offline" },
      isFetching: false,
    });
    const html = render();
    expect(html).toContain(
      "Saved history could not be loaded: Storage offline"
    );
    expect(html).toContain("Retry saved history");
    expect(html).not.toContain("No saved receipts");
  });
  it("shows loading and failure for selected receipt detail", () => {
    hooks.list.mockReturnValue({
      data: [metadata(receipt)],
      error: null,
      isFetching: false,
    });
    hooks.get.mockReturnValue({
      data: undefined,
      error: null,
      isFetching: true,
    });
    expect(render()).toContain("Loading saved receipt detail");
    hooks.get.mockReturnValue({
      data: undefined,
      error: { message: "Not found" },
      isFetching: false,
    });
    expect(render()).toContain("Saved receipt could not be loaded: Not found");
  });
  it("shows pending capture without painting old data as current", () => {
    hooks.list.mockReturnValue({
      data: [metadata(receipt)],
      error: null,
      isFetching: false,
    });
    hooks.get.mockReturnValue({
      data: receipt,
      error: null,
      isFetching: false,
    });
    hooks.capture.mockReturnValue({ isPending: true, error: null });
    const html = render();
    expect(html).toContain("Capture pending; no saved result confirmed yet");
    expect(html).toContain("Historical receipt");
  });
  it("surfaces transport/save errors and same-request retry", () => {
    hooks.capture.mockReturnValue({
      isPending: false,
      error: { message: "Save response lost" },
    });
    const html = render();
    expect(html).toContain("Capture/save not confirmed: Save response lost");
    expect(html).toContain("Retry capture (same request)");
  });
  it("rejects receipt detail belonging to a different issuer", () => {
    hooks.list.mockReturnValue({
      data: [metadata(receipt)],
      error: null,
      isFetching: false,
    });
    hooks.get.mockReturnValue({
      data: { ...receipt, subjectKey: "sec:CIK0000000001" },
      error: null,
      isFetching: false,
    });
    expect(render()).toContain("This receipt belongs to a different issuer");
    expect(render()).not.toContain("5 captured filings");
  });
  it("mounts exactly one panel outside the lookup card loop", () => {
    const source = readFileSync(
      new URL("../client/src/pages/PublicIntelligence.tsx", import.meta.url),
      "utf8"
    );
    expect(source.match(/<SecEvidencePanel\b/g)).toHaveLength(1);
    expect(source).toContain('kind === "sec" && issuer');
  });
});

describe("capture idempotency", () => {
  it("retains the key after unknown outcomes and rotates after any saved receipt, including provider failure", async () => {
    const requests = createCaptureRequests();
    const mutate = vi
      .fn()
      .mockRejectedValueOnce(new Error("Lost save response"))
      .mockResolvedValue(failed);
    await expect(requests.run("320193", mutate)).rejects.toThrow(
      "Lost save response"
    );
    await requests.run("320193", mutate);
    expect(mutate.mock.calls[0][0].requestId).toBe(
      mutate.mock.calls[1][0].requestId
    );
    await requests.run("320193", mutate);
    expect(mutate.mock.calls[2][0].requestId).not.toBe(
      mutate.mock.calls[1][0].requestId
    );
  });
  it("keeps unknown request IDs separate per selected issuer", async () => {
    const requests = createCaptureRequests();
    const mutate = vi.fn().mockRejectedValue(new Error("Unknown"));
    for (const cik of ["320193", "1", "320193"])
      await requests.run(cik, mutate).catch(() => {});
    expect(mutate.mock.calls[0][0].requestId).toBe(
      mutate.mock.calls[2][0].requestId
    );
    expect(mutate.mock.calls[0][0].requestId).not.toBe(
      mutate.mock.calls[1][0].requestId
    );
  });
});
