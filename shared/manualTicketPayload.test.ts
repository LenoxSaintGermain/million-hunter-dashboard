import { describe, expect, it } from "vitest";
import { buildManualTicketPayload } from "./manualTicketPayload";

const base = {
  accountId: 7, symbol: " nvda ", expression: "shares", direction: "long" as const, shareCount: 4, contracts: 1,
  limitPrice: "120.50", strikePrice: "150", spreadUpperStrike: "160", expirationDate: "2026-11-20",
  reason: "Data center demand keeps rising through the next earnings report.", invalidationCondition: "",
  holdingPeriod: "swing" as const, catalystDays: 14, notionalCents: 48_200, now: 1_000,
};

describe("buildManualTicketPayload (#118)", () => {
  it("builds the same share ticket for preflight and create", () => {
    const built = buildManualTicketPayload(base);
    expect(built.ok && built.payload).toMatchObject({ accountId: 7, symbol: "NVDA", side: "buy", qty: 4, notionalCents: 48_200, limitPriceCents: 12_050, paperAcknowledgement: "PAPER", catalystDeadlineAt: 1_000 + 14 * 86_400_000 });
  });
  it("builds an OCC contract for a long call", () => {
    const built = buildManualTicketPayload({ ...base, expression: "long_call", limitPrice: "4.20" });
    expect(built.ok && built.payload).toMatchObject({ instrumentType: "long_call", underlyingSymbol: "NVDA", contractMultiplier: 100, qty: 1, notionalCents: undefined });
    expect(built.ok && built.payload.symbol).toMatch(/^NVDA\s*261120C00150000$/);
  });
  it("refuses without an account or symbol instead of guessing", () => {
    expect(buildManualTicketPayload({ ...base, accountId: null }).ok).toBe(false);
    expect(buildManualTicketPayload({ ...base, symbol: "  " }).ok).toBe(false);
  });
});
