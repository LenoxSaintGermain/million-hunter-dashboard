import { describe, expect, it, vi } from "vitest";
import { createCapitalEvidenceRouter } from "./capitalEvidenceRouter";

describe("Capital evidence read-only router", () => {
  const input = { decisionRunId: 10, revisionId: 11, candidateId: 12 };
  it("takes owner identity only from the authenticated context", async () => {
    const read = vi.fn().mockResolvedValue({ status: "unavailable", reason: "evidence_context_not_bound" });
    const caller = createCapitalEvidenceRouter(read).createCaller({ user: { id: 7 } } as any);
    await caller.context(input);
    expect(read).toHaveBeenCalledWith(7, input);
    await expect(caller.context({ ...input, ownerId: 8 } as any)).rejects.toThrow();
    expect(read).toHaveBeenCalledTimes(1);
  });
  it("does not invoke the loader when unauthenticated", async () => {
    const read = vi.fn();
    await expect(createCapitalEvidenceRouter(read).createCaller({ user: null } as any).context(input)).rejects.toThrow();
    expect(read).not.toHaveBeenCalled();
  });
  it("keeps context and choices read-only and confirmation explicit", () => {
    const routes = createCapitalEvidenceRouter(vi.fn())._def.procedures;
    expect(Object.keys(routes)).toEqual(["context", "options", "securityChoices", "choices", "confirmBinding"]);
    expect(routes.securityChoices._def.type).toBe("query");
    expect(routes.options._def.type).toBe("query");
    expect(routes.context._def.type).toBe("query");
    expect(routes.choices._def.type).toBe("query");
    expect(routes.confirmBinding._def.type).toBe("mutation");
  });
  it("rejects ordinary authenticated non-Capital users before loading binding choices", async () => {
    const binding = { choices: vi.fn(), confirmBinding: vi.fn() };
    const caller = createCapitalEvidenceRouter(vi.fn(), binding as any).createCaller({ user: { id: 7, role: "user" } } as any);
    await expect(caller.choices({ ...input, dealId: 20, securityId: 17, analysisRunId: "11111111-1111-4111-8111-111111111111" })).rejects.toThrow();
    expect(binding.choices).not.toHaveBeenCalled();
  });
  it("requires explicit confirmation and passes only the authenticated owner to the writer", async () => {
    const service = { choices: vi.fn(), confirmBinding: vi.fn().mockResolvedValue({ decisionRunId: 10, revisionId: 20, created: true }) };
    const caller = createCapitalEvidenceRouter(vi.fn(), service as any).createCaller({ user: { id: 7, role: "admin" } } as any);
    const request = { ...input, expectedLockVersion: 0, confirmed: true as const,
      requestId: "11111111-1111-4111-8111-111111111111", binding: {
        version: 1 as const, kind: "sec_metadata_research" as const, decisionRunId: 10, researchRunId: 13, candidateId: 12,
        canonicalThesisId: 14, capitalThesisId: 15, accountId: 16, securityId: 17, cik: "0000000001", symbol: "TEST", dealId: 18,
        analysisRunId: "22222222-2222-4222-8222-222222222222", analysisSnapshotHash: "a".repeat(64), thesisSnapshotHash: "b".repeat(64),
        criterionBindings: [{ findingId: "example", field: "beliefs" as const, index: 0 }],
        identityBasis: "operator_confirmed_security_cik_not_independently_verified" as const, relation: "same_legal_entity" as const,
      } };
    await expect(caller.confirmBinding({ ...request, confirmed: false } as any)).rejects.toThrow();
    expect(service.confirmBinding).not.toHaveBeenCalled();
    expect(await caller.confirmBinding(request)).toEqual({ decisionRunId: 10, revisionId: 20, created: true });
    expect(service.confirmBinding).toHaveBeenCalledWith(7, request);
    await expect(caller.confirmBinding({ ...request, binding: { ...request.binding, ownerId: 999 } } as any)).rejects.toThrow();
    expect(service.confirmBinding).toHaveBeenCalledTimes(1);
  });
});
