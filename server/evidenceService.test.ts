import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createEvidenceService, evidencePayloadHash } from "./evidenceService";
import { createPublicEvidenceRouter } from "./routers/publicEvidenceRouter";
import type { TrpcContext } from "./_core/context";
import type { SecSubmissionsResult } from "../shared/secEvidence";

// Explicit synthetic unit fixture, never used in a live response or public demo.
const fixture: SecSubmissionsResult = {
  status: "ok", company: { cik: "0000000123", name: "Illustrative unit issuer" },
  sourceUrl: "https://data.sec.gov/submissions/CIK0000000123.json",
  retrievedAt: "2026-10-11T12:00:00.000Z", message: null, failureCode: null,
  filings: [{ accessionNumber: "0000000123-26-000001", form: "10-K", filingDate: "2026-10-01",
    reportDate: "2026-09-30", primaryDocument: "example.htm", url: "https://www.sec.gov/Archives/edgar/data/123/000000012326000001/example.htm" }],
};
function setup() {
  const receipts: any[] = [];
  const repo = {
    list: vi.fn(async (ownerId: number, subjectKey: string) => receipts.filter(r => r.ownerId === ownerId && r.subjectKey === subjectKey)),
    get: vi.fn(async (ownerId: number, id: string) => receipts.find(r => r.ownerId === ownerId && r.id === id) ?? null),
    findRequest: vi.fn(async (ownerId: number, requestId: string) => receipts.find(r => r.ownerId === ownerId && r.requestId === requestId) ?? null),
    reserveSecBudget: vi.fn(async (_ownerId: number) => undefined),
    reserveCaptureAttempt: vi.fn(async (_ownerId: number) => undefined),
    reserveSecProviderBudget: vi.fn(async () => undefined),
    setSecCooldown: vi.fn(async (_until: Date) => undefined),
    claimCapture: vi.fn(async (_ownerId: number, _requestId: string, _subjectKey: string) => ({ status: "claimed" as "claimed" | "pending", startedAt: new Date() })),
    append: vi.fn(async (input: any) => { const receipt = { ...input, id: randomUUID(), recordedAt: new Date("2026-10-11T12:00:01Z") }; receipts.push(receipt); return receipt; }),
  };
  const fetch = vi.fn(async (_cik: string) => structuredClone(fixture));
  const enabled = vi.fn(() => true);
  const service = createEvidenceService({ repository: repo, fetch, enabled });
  const router = createPublicEvidenceRouter(service);
  const caller = (id: number | null) => router.createCaller({ user: id === null ? null : { id, role: "user" }, req: {}, res: {} } as TrpcContext);
  return { repo, fetch, enabled, service, caller, receipts };
}
const request = () => ({ cik: "123", requestId: randomUUID() });

describe("Owner-scoped SEC capture workflow", () => {
  it("rejects guests on reads and writes without DB or upstream access", async () => {
    const h = setup(); const c = h.caller(null);
    for (const result of await Promise.allSettled([c.capture(request()), c.list({ cik: "123" }), c.get({ id: randomUUID() })])) {
      expect(result.status).toBe("rejected");
      if (result.status === "rejected") expect(result.reason.code).toBe("UNAUTHORIZED");
    }
    expect(h.fetch).not.toHaveBeenCalled(); expect(h.repo.findRequest).not.toHaveBeenCalled();
  });
  it("requires a server-scoped subject and rejects owner/URL injection", async () => {
    const h = setup();
    for (const input of [{ ...request(), ownerId: 2 }, { ...request(), sourceUrl: "http://localhost" },
      { ...request(), cik: "../123" }, { ...request(), cik: "0" }, { ...request(), requestId: "bad" }]) {
      await expect(h.caller(1).capture(input as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(h.fetch).not.toHaveBeenCalled();
  });
  it("persists immutable provenance, hashes, owner and successful observation time", async () => {
    const h = setup(); const receipt = await h.caller(1).capture(request());
    expect(receipt).toMatchObject({ ownerId: 1, subjectKey: "sec:CIK0000000123", provider: "sec-submissions", schemaVersion: 1, payload: fixture });
    expect(receipt.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.retrievedAt).toEqual(new Date(fixture.retrievedAt!));
    expect(receipt.recordedAt).toEqual(new Date("2026-10-11T12:00:01Z"));
    expect(receipt.expiresAt).toEqual(new Date("2026-10-12T12:00:00Z"));
    expect(h.repo.reserveSecBudget.mock.invocationCallOrder[0]).toBeLessThan(h.fetch.mock.invocationCallOrder[0]);
    const summaries = await h.caller(1).list({ cik: "123" });
    expect(summaries).toHaveLength(1); expect(summaries[0]).not.toHaveProperty("payload");
  });
  it("does not disclose another owner's receipt even to guessed IDs", async () => {
    const h = setup(); const receipt = await h.caller(1).capture(request());
    await expect(h.caller(2).get({ id: receipt.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await h.caller(2).list({ cik: "123" })).toEqual([]);
  });
  it("replays a saved request without another fetch, including with capture disabled", async () => {
    const h = setup(); const input = request(); const first = await h.caller(1).capture(input);
    h.enabled.mockReturnValue(false);
    expect(await h.caller(1).capture(input)).toEqual(first);
    expect(h.fetch).toHaveBeenCalledTimes(1);
    await expect(h.caller(1).capture({ ...input, cik: "456" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(h.caller(1).capture(request())).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("creates distinct revisions without replacing older payloads", async () => {
    const h = setup(); const first = await h.caller(1).capture(request());
    const changed = structuredClone(fixture); changed.filings[0].form = "10-K/A";
    h.fetch.mockResolvedValue(changed);
    const next = await h.caller(1).capture(request());
    expect(next.id).not.toBe(first.id); expect(next.payloadHash).not.toBe(first.payloadHash);
    expect((await h.caller(1).get({ id: first.id })).payload).toEqual(fixture);
  });
  it("records provider failures without successful retrieval or invented filing data", async () => {
    const h = setup(); h.fetch.mockResolvedValue({ ...fixture, status: "unavailable", retrievedAt: null, company: null, filings: [], failureCode: "TIMEOUT", message: "SEC request timed out." });
    const receipt = await h.caller(1).capture(request());
    expect(receipt.status).toBe("unavailable"); expect(receipt.retrievedAt).toBeNull(); expect(receipt.expiresAt).toBeNull();
    expect(receipt.payload.filings).toEqual([]); expect(receipt.failureCode).toBe("TIMEOUT");
  });
  it("stops before upstream access on storage or shared-budget failure", async () => {
    const h = setup(); h.repo.reserveSecBudget.mockRejectedValueOnce(Object.assign(new Error(), { code: "RATE_LIMITED" }));
    await expect(h.caller(1).capture(request())).resolves.toMatchObject({ status: "unavailable", failureCode: "RATE_LIMITED", retrievedAt: null, message: expect.stringContaining("No source request was made") });
    h.repo.findRequest.mockRejectedValueOnce(new Error("secret database connection details"));
    await expect(h.caller(1).capture(request())).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: expect.not.stringContaining("secret") });
    expect(h.fetch).not.toHaveBeenCalled();
  });
  it("does not return unsaved provider results or a false empty library on storage failure", async () => {
    const h = setup(); h.repo.append.mockRejectedValueOnce(new Error("write failed"));
    await expect(h.caller(1).capture(request())).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: expect.stringContaining("not confirmed saved") });
    h.repo.list.mockRejectedValueOnce(new Error("read failed"));
    await expect(h.caller(1).list({ cik: "123" })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("hashes evidence consistently across observation times", () => {
    expect(evidencePayloadHash(fixture)).toBe(evidencePayloadHash({ ...fixture, retrievedAt: "2026-10-12T12:00:00Z" }));
    expect(evidencePayloadHash(fixture)).not.toBe(evidencePayloadHash({ ...fixture, filings: [] }));
  });
  it("does not execute a concurrent claimed request a second time", async () => {
    const h = setup();
    h.repo.claimCapture.mockResolvedValue({ status: "pending", startedAt: new Date() });
    await expect(h.caller(1).capture(request())).rejects.toMatchObject({ code: "CONFLICT" });
    expect(h.fetch).not.toHaveBeenCalled(); expect(h.repo.reserveSecBudget).not.toHaveBeenCalled();
  });
  it("resolves an interrupted claim honestly without replaying the provider", async () => {
    const h = setup();
    h.repo.claimCapture.mockResolvedValue({ status: "pending", startedAt: new Date(Date.now() - 31_000) });
    const receipt = await h.caller(1).capture(request());
    expect(receipt).toMatchObject({ status: "unavailable", failureCode: "CAPTURE_INTERRUPTED", retrievedAt: null });
    expect(h.fetch).not.toHaveBeenCalled();
  });
  it("persists SEC cooldown before returning a saved failure", async () => {
    const h = setup();
    h.fetch.mockResolvedValue({ ...fixture, status: "unavailable", company: null, filings: [], retrievedAt: null,
      failureCode: "RATE_LIMITED", retryAt: "2026-10-11T13:00:00Z", message: "SEC throttled" });
    await h.caller(1).capture(request());
    expect(h.repo.setSecCooldown).toHaveBeenCalledWith(new Date("2026-10-11T13:00:00Z"));
    expect(h.repo.setSecCooldown.mock.invocationCallOrder[0]).toBeLessThan(h.repo.append.mock.invocationCallOrder[0]);
  });
});
