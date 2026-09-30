import { beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({ getDb: vi.fn(), brokerFor: vi.fn() }));
vi.mock("../db", () => ({ getDb: deps.getDb }));
vi.mock("./brokers/index", () => ({ brokerFor: deps.brokerFor }));
import { approveOrder, createOrder, preflightOrder, submitOrder, type CreateOrderInput } from "./orderFlow";

const expressions = ["bull_call_spread", "bear_put_spread", "bull_put_credit_spread", "collar_hedge"];
const input: CreateOrderInput = { userId: 7, accountId: 11, runId: 22, candidateId: 33,
  symbol: "TEST261120C00100000", instrumentType: "long_call", side: "buy", qty: 1 };

describe("legacy manual multi-leg expression safety", () => {
  beforeEach(() => { vi.resetAllMocks(); deps.getDb.mockResolvedValue(null); });

  it.each(expressions)("rejects %s before database access or provider calls", async expression => {
    for (const instrumentType of ["long_call", "long_put", "shares"] as const) {
      for (const action of [createOrder, preflightOrder]) {
        await expect(action({ ...input, instrumentType, reason: `[${expression.toUpperCase()} EXPR] Operator rationale` }))
          .rejects.toThrow("Multi-leg manual expressions");
      }
    }
    expect(deps.getDb).not.toHaveBeenCalled();
    expect(deps.brokerFor).not.toHaveBeenCalled();
  });

  it("handles case and leading whitespace without accepting a stale marker", async () => {
    await expect(createOrder({ ...input, reason: " \n[bull_call_spread expr] Rationale" })).rejects.toThrow("Multi-leg manual expressions");
    expect(deps.getDb).not.toHaveBeenCalled();
  });

  it.each([
    "[LONG_CALL EXPR] Defined premium at risk",
    "[LONG_PUT EXPR] Downside thesis",
    "Prefer a long call over a bull_call_spread; no spread is requested.",
    "A collar hedge is not requested. This is a standalone long put.",
    "Tight bid/ask spread; buy one call.",
    null,
  ])("leaves ordinary single-leg rationale to existing gates: %s", async reason => {
    for (const instrumentType of ["long_call", "long_put"] as const) {
      await expect(preflightOrder({ ...input, instrumentType, reason })).rejects.toThrow("database unavailable");
    }
    expect(deps.getDb).toHaveBeenCalledTimes(2);
    expect(deps.brokerFor).not.toHaveBeenCalled();
  });

  it.each(expressions)("blocks stored %s proposals at approval and submission without writes", async expression => {
    for (const phase of ["approve", "submit"] as const) {
      const order = { ...input, id: 41, status: phase === "approve" ? "pending_approval" : "approved",
        reason: `[${expression.toUpperCase()} EXPR] Legacy flattened ticket` };
      const db = { select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: async () => [order] }) }) })),
        update: vi.fn(), insert: vi.fn(), transaction: vi.fn() };
      deps.getDb.mockResolvedValue(db);
      await expect(phase === "approve" ? approveOrder(41, 7, "APPROVE PAPER") : submitOrder(41, 7, "SUBMIT PAPER"))
        .rejects.toThrow("Multi-leg manual expressions");
      expect(db.select).toHaveBeenCalledTimes(1);
      expect(db.update).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
      expect(db.transaction).not.toHaveBeenCalled();
    }
    expect(deps.brokerFor).not.toHaveBeenCalled();
  });
});
