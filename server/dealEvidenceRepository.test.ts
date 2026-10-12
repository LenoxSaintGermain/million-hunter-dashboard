import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { getTableColumns } from "drizzle-orm";
import { dealEvidenceAttachments as attachments, dealEvidenceAnalysisRequests as requests, dealEvidenceAnalysisResults as results } from "../drizzle/dealEvidenceSchema";
import { createDealEvidenceRepository, type DealEvidenceRequest } from "./dealEvidenceRepository";
import { DEAL_EVIDENCE_PROMPT_VERSION, SEC_ANALYSIS_LIMITATION, type DealEvidenceSnapshot } from "../shared/dealEvidence";
import { GEMINI_STRONG } from "../shared/models";

function harness() {
  const responses: unknown[] = [], calls: { sql: string; params: unknown[] }[] = [];
  const query = vi.fn(async (options: { sql: string }, params: unknown[]) => {
    calls.push({ sql: options.sql, params });
    if (/^(begin|commit|rollback)/i.test(options.sql)) return [{ affectedRows: 0 }, []];
    const response = responses.shift(); if (response instanceof Error) throw response;
    return [response ?? [], []];
  });
  const db = drizzle({ query } as any);
  return { repo: createDealEvidenceRepository(async () => db), responses, calls };
}
function row(table: any, data: Record<string, unknown>) {
  return Object.keys(getTableColumns(table)).map(key => {
    const value = data[key];
    return value instanceof Date ? value.toISOString().replace("T", " ").replace("Z", "") : value;
  });
}
function fixture() {
  const attachmentId = randomUUID(), receiptId = randomUUID();
  const snapshot: DealEvidenceSnapshot = {
    schemaVersion: 1, promptVersion: DEAL_EVIDENCE_PROMPT_VERSION, limitation: SEC_ANALYSIS_LIMITATION,
    deal: { id: 8, name: "Illustrative target", description: null, industry: null, location: null, revenue: null, cashFlow: null, askingPrice: null, multiple: null, employees: null, yearEstablished: null },
    evidence: [{ attachmentId, receiptId, payloadHash: "a".repeat(64), cik: "0000000001", issuerName: "Illustrative issuer", sourceUrl: "https://data.sec.gov/submissions/CIK0000000001.json", retrievedAt: "2026-10-11T12:00:00.000Z", expiresAt: "2026-10-12T12:00:00.000Z", staleAtRun: false, relation: "same_legal_entity", identityBasis: "owner_confirmed_not_independently_verified", status: "empty", totalFilings: 0, includedFilings: 0 }],
    citations: [{ id: "E1", receiptId, payloadHash: "a".repeat(64), sourceUrl: "https://data.sec.gov/submissions/CIK0000000001.json", fact: "Illustrative metadata only." }], gaps: ["Financials not verified."],
  };
  const request: DealEvidenceRequest = { id: randomUUID(), ownerId: 7, dealId: 8, requestId: randomUUID(), requestHash: "b".repeat(64), mode: "red_team", models: [GEMINI_STRONG], inputSnapshot: snapshot, startedAt: new Date("2026-10-11T12:00:01Z") };
  const output = { killProbability: 0.5, redFlags: [], summary: "Diligence hypothesis.", citations: [{ citationId: "E1", quote: snapshot.citations[0].fact }] };
  const result = { id: request.id, ownerId: 7, dealId: 8, status: "complete" as const, output, failureCode: null, message: null, completedAt: new Date("2026-10-11T12:01:00Z") };
  return { request, result, snapshot, attachmentId, receiptId };
}
const duplicate = () => Object.assign(new Error("duplicate"), { code: "ER_DUP_ENTRY", errno: 1062 });

describe("PD06 real SQL generation with isolated fake driver", () => {
  it("fails closed with no DB", async () => {
    const repo = createDealEvidenceRepository(async () => null);
    for (const pending of [repo.getDeal(7, 8), repo.listAttachments(7, 8), repo.listRuns(7, 8), repo.findRequest(7, randomUUID()), repo.getRun(7, 8, randomUUID())]) await expect(pending).rejects.toMatchObject({ code: "DATABASE_UNAVAILABLE" });
  });
  it("qualifies deal, attachment and run reads by owner and deal", async () => {
    const h = harness();
    await h.repo.getDeal(7, 8); expect(h.calls[0].params).toEqual([7, 8, false, 1]);
    expect(h.calls[0].sql).toContain("owner_user_id"); expect(h.calls[0].sql).toContain("isArchived");
    await h.repo.listAttachments(7, 8); expect(h.calls[1].params).toEqual([7, 8, 100]);
    expect(h.calls[1].sql).toMatch(/order by .*created_at.*desc.*id.*desc/);
    await h.repo.listRuns(7, 8); expect(h.calls[2].params).toEqual([7, 8, 20]);
    const id = randomUUID(); await h.repo.getRun(7, 8, id); expect(h.calls[3].params).toEqual([7, 8, id, 1]);
  });
  it("decodes MariaDB JSON and verifies citations on saved readback", async () => {
    const h = harness(); const f = fixture();
    h.responses.push([row(requests, { ...f.request, models: JSON.stringify(f.request.models), inputSnapshot: JSON.stringify(f.snapshot) })], [row(results, { ...f.result, output: JSON.stringify(f.result.output) })]);
    const saved = await h.repo.getRun(7, 8, f.request.id);
    expect(saved?.inputSnapshot).toEqual(f.snapshot); expect(saved?.output).toEqual(f.result.output);
    expect(saved?.startedAt).toEqual(f.request.startedAt); expect(saved?.completedAt).toEqual(f.result.completedAt);
    expect(h.calls[1].params).toEqual([7, 8, f.request.id, 1]);
  });
  it.each(["bad JSON", "bad citation", "failed with output"])("fails closed on persisted %s", async problem => {
    const h = harness(); const f = fixture();
    h.responses.push([row(requests, { ...f.request, inputSnapshot: problem === "bad JSON" ? "{" : JSON.stringify(f.snapshot) })]);
    h.responses.push([row(results, { ...f.result, status: problem === "failed with output" ? "failed" : "complete", output: JSON.stringify({ ...f.result.output, citations: [{ citationId: "E99", quote: "invented" }] }) })]);
    await expect(h.repo.getRun(7, 8, f.request.id)).rejects.toThrow();
  });
  it("locks current deal ownership and commits an immutable request with distributed quotas", async () => {
    const h = harness(); const f = fixture();
    h.responses.push([{ id: 8 }], { affectedRows: 1 }, { affectedRows: 1 }, [{ count: 1 }], { affectedRows: 1 }, [{ count: 1 }], []);
    const started = await h.repo.start(f.request);
    expect(started.claimed).toBe(true); expect(started.run.status).toBe("pending");
    expect(h.calls[1].sql).toContain("FOR UPDATE"); expect(h.calls[1].params).toEqual([8, 7]);
    expect(h.calls[2].sql).toContain("insert into `deal_evidence_analysis_requests`");
    expect(h.calls[3].params).toEqual(["deal-analysis:global"]);
    expect(h.calls[5].params).toEqual(["deal-analysis:owner:7"]);
    expect(h.calls.some(call => call.sql === "commit")).toBe(true);
    expect(h.calls.some(call => /^(update|delete) /i.test(call.sql))).toBe(false);
  });
  it("rejects an archived/transferred deal inside the write transaction", async () => {
    const h = harness(); h.responses.push([]);
    await expect(h.repo.start(fixture().request)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(h.calls.at(-1)?.sql).toBe("rollback"); expect(h.calls.some(call => call.sql.includes("insert into"))).toBe(false);
  });
  it("returns concurrent request winner without charging quotas or replaying", async () => {
    const h = harness(); const f = fixture();
    h.responses.push([{ id: 8 }], duplicate(), [row(requests, f.request)], []);
    const started = await h.repo.start(f.request);
    expect(started.claimed).toBe(false); expect(started.run.id).toBe(f.request.id);
    expect(h.calls.some(call => call.sql.includes("public_evidence_budgets"))).toBe(false);
  });
  it("conflicts on idempotency-key rebinding", async () => {
    const h = harness(); const f = fixture();
    h.responses.push([{ id: 8 }], duplicate(), [row(requests, { ...f.request, requestHash: "c".repeat(64) })]);
    await expect(h.repo.start(f.request)).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("rolls back request and quota when global admission is exhausted", async () => {
    const h = harness(); h.responses.push([{ id: 8 }], { affectedRows: 1 }, { affectedRows: 1 }, [{ count: 31 }]);
    await expect(h.repo.start(fixture().request)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(h.calls.at(-1)?.sql).toBe("rollback");
  });
  it("append-only completion retains first result after a duplicate finish", async () => {
    const h = harness(); const f = fixture();
    h.responses.push([row(requests, f.request)], [{ id: 8 }], duplicate(), [row(results, f.result)]);
    const saved = await h.repo.finish({ ...f.result, output: { ...f.result.output, killProbability: 0.9 } });
    expect(saved.output).toEqual(f.result.output);
    expect(h.calls.some(call => /^(update|delete) /i.test(call.sql))).toBe(false);
  });
  it("attachments are immutable and duplicate retries cannot change the target", async () => {
    const h = harness(); const f = fixture();
    const input = { ownerId: 7, dealId: 8, requestId: randomUUID(), receiptId: f.receiptId, payloadHash: "a".repeat(64), confirmedCik: "0000000001", relation: "same_legal_entity" as const, identityBasis: "owner_confirmed_not_independently_verified" as const };
    const existing = { ...input, id: f.attachmentId, createdAt: new Date() };
    h.responses.push([{ id: 8 }], [row(attachments, existing)]);
    expect((await h.repo.attach(input)).id).toBe(existing.id);
    expect(h.calls.some(call => call.sql.includes("public_evidence_budgets"))).toBe(false);
    const other = harness(); other.responses.push([{ id: 8 }], [row(attachments, { ...existing, dealId: 9 })]);
    await expect(other.repo.attach(input)).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it.each([[120, 30, true], [121, 1, false], [1, 31, false]])("attachment admission global %s owner %s allowed %s", async (global, owner, allowed) => {
    const h = harness(); const f = fixture();
    const input = { ownerId: 7, dealId: 8, requestId: randomUUID(), receiptId: f.receiptId, payloadHash: "a".repeat(64), confirmedCik: "0000000001", relation: "same_legal_entity" as const, identityBasis: "owner_confirmed_not_independently_verified" as const };
    h.responses.push([{ id: 8 }], [], { affectedRows: 1 }, [{ count: global }], { affectedRows: 1 }, [{ count: owner }], { affectedRows: 1 });
    if (allowed) {
      expect((await h.repo.attach(input)).receiptId).toBe(f.receiptId);
      expect(h.calls[3].params).toEqual(["deal-attachment:global"]);
      expect(h.calls[5].params).toEqual(["deal-attachment:owner:7"]);
      expect(h.calls[7].sql).toContain("insert into `deal_evidence_attachments`");
      expect(h.calls.at(-1)?.sql).toBe("commit");
    } else {
      await expect(h.repo.attach(input)).rejects.toMatchObject({ code: "RATE_LIMITED" });
      expect(h.calls.some(call => call.sql.includes("insert into `deal_evidence_attachments`"))).toBe(false);
      expect(h.calls.at(-1)?.sql).toBe("rollback");
    }
  });
});
