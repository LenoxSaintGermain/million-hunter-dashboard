import { beforeEach, describe, expect, it, vi } from "vitest";
import { decisionActionBlock } from "./decisionRunway";

const seam = vi.hoisted(() => ({ db: vi.fn(), create: vi.fn() }));
vi.mock("../db", () => ({ getDb: seam.db }));
vi.mock("./orderFlow", async original => ({ ...await original<typeof import("./orderFlow")>(), createOrder: seam.create }));
import { apertureRouter } from "../apertureRouter";

const caller = () => apertureRouter.createCaller({ user: { id: 7, role: "admin" } as any, req: {} as any, res: {} as any });
const legacyInput = { candidatePlayId: "qh_plug_fleet_contract", symbol: "PLUG", budgetUsd: 100,
  limitPriceCents: 215, stopLossPriceCents: 195, takeProfitPriceCents: 260 };

beforeEach(() => {
  vi.clearAllMocks();
  const results = [[{ id: 22, userId: 7, isPaper: true }], [{ id: 33, userId: 7, accountId: 11, status: "completed" }]];
  seam.db.mockResolvedValue({ select: () => {
    const rows = results.shift() ?? [];
    const chain: any = { then: (resolve: any) => Promise.resolve(rows).then(resolve) };
    for (const key of ["from", "where", "orderBy", "limit"]) chain[key] = () => chain;
    return chain;
  } });
  seam.create.mockImplementation(async input => {
    const blocked = decisionActionBlock({ source: "authoritative", decisionRunId: 44, revisionId: 55,
      effectiveBranch: "eligible", accountId: 11, researchRunId: 33, maxPlannedLossCents: 2000,
      contextKind: "thesis", validBinding: true }, "create_proposal", "open", input);
    if (blocked) throw new Error(blocked);
    return { orderId: 66 };
  });
});

describe("Quick Play old-client boundary", () => {
  it("rejects illustrative authorization before selecting unrelated records or creating orders", async () => {
    await expect(caller().quickHit.authorize(legacyInput)).rejects.toThrow("Example strategies cannot create orders");
    expect(seam.db).not.toHaveBeenCalled();
    expect(seam.create).not.toHaveBeenCalled();
  });
});
