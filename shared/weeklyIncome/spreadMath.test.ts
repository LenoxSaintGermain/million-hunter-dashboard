import { describe, expect, it } from "vitest";
import { formatPct, formatStrike, formatUsdCents, putCreditSpreadRisk } from "./spreadMath";

describe("put credit spread arithmetic (#82 §11)", () => {
  it("matches the worked example exactly", () => {
    const risk = putCreditSpreadRisk({ shortStrike: 95, longStrike: 90, credit: 1, contracts: 1 });
    expect(risk).toMatchObject({
      ok: true, widthCents: 500, creditPctOfWidth: 20, creditReceivedCents: 10_000,
      structuralMaxLossCents: 40_000, allowanceCents: 1_000, maxLossCents: 41_000,
      breakevenCents: 9_400, takeProfitDebitCents: 50, keepAtTakeProfitCents: 5_000,
      stopDebitCents: 200, lossAtStopCents: 10_000, takeProfitsErasedByMaxLoss: 8,
    });
  });

  it("scales by whole contracts and includes fees", () => {
    const risk = putCreditSpreadRisk({ shortStrike: 95, longStrike: 90, credit: 1, contracts: 2, feePerContractUsd: 0.65 });
    if (!risk.ok) throw new Error(risk.reason);
    expect(risk.maxLossCents).toBe(80_000 + 2_000 + 130);
  });

  it("never sets the stop beyond the spread width", () => {
    const risk = putCreditSpreadRisk({ shortStrike: 51, longStrike: 50, credit: 0.6, contracts: 1 });
    if (!risk.ok) throw new Error(risk.reason);
    expect(risk.stopDebitCents).toBe(100);
  });

  it("works in cents so $2.50 widths do not drift", () => {
    const risk = putCreditSpreadRisk({ shortStrike: 72.5, longStrike: 70, credit: 0.55, contracts: 3, slippagePerLegUsd: 0 });
    if (!risk.ok) throw new Error(risk.reason);
    expect(risk.widthCents).toBe(250);
    expect(risk.maxLossCents).toBe((250 - 55) * 300);
  });

  it("refuses inverted strikes, zero credit, fractional contracts and credit ≥ width", () => {
    expect(putCreditSpreadRisk({ shortStrike: 90, longStrike: 95, credit: 1, contracts: 1 }).ok).toBe(false);
    expect(putCreditSpreadRisk({ shortStrike: 95, longStrike: 90, credit: 0, contracts: 1 }).ok).toBe(false);
    expect(putCreditSpreadRisk({ shortStrike: 95, longStrike: 90, credit: 1, contracts: 1.5 }).ok).toBe(false);
    expect(putCreditSpreadRisk({ shortStrike: 95, longStrike: 90, credit: 5, contracts: 1 }).ok).toBe(false);
  });

  it("formats dollars for people", () => {
    expect(formatUsdCents(41_000)).toBe("$410");
    expect(formatUsdCents(1_250)).toBe("$12.50");
    expect(formatUsdCents(-10_000)).toBe("-$100");
    expect(formatUsdCents(123_456_700)).toBe("$1,234,567");
    expect(formatStrike(92.5)).toBe("$92.50");
    expect(formatPct(0.75)).toBe("0.75%");
  });
});
