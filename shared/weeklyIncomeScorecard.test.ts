import { describe, expect, it } from "vitest";
import { buildWeeklyIncomeScorecard, weeklyIncomeHistory, type WiPositionRecord, type WiWeekInput } from "./weeklyIncomeScorecard";
import { passesWeeklyIncomeLanguage } from "./weeklyIncome/copy";

// Example data: a hypothetical fixture week (3 take-profits, 1 stop, 1 time exit). Not real fills.
const H = 3_600_000;
const T = Date.parse("2026-10-12T04:00:00Z"); // Mon 00:00 ET
const pos = (id: string, credit: number, contracts: number, debit: number, maxLoss: number, open: number, close: number, exitReason: WiPositionRecord["exitReason"], basis: WiPositionRecord["basis"] = "paper_fill"): WiPositionRecord => ({
  id, underlying: id, basis, openedAt: T + open * H, closedAt: T + close * H, contracts, openingCreditCents: credit, closingDebitCents: debit,
  markDebitCents: null, markAsOf: null, maxLossCents: maxLoss * 100, feesCents: 0, exitReason,
});
const week = (positions: WiPositionRecord[], over: Partial<WiWeekInput> = {}): WiWeekInput => ({
  weekOf: "2026-10-12", weekStartMs: T, weekEndMs: T + 100 * H, mondayEquityCents: 5_000_000, mondayEquityAsOf: T,
  positions, skippedReasons: ["earnings", "earnings", "liquidity", "delta"], asOf: T + 100 * H, ...over,
});
const FIXTURE = [
  pos("AAA", 40, 2, 20, 440, 0, 50, "take_profit"),
  pos("BBB", 50, 1, 25, 210, 0, 100, "take_profit"),
  pos("CCC", 30, 3, 15, 240, 0, 25, "take_profit"),
  pos("DDD", 40, 2, 80, 440, 50, 100, "stop"),
  pos("EEE", 45, 1, 30, 215, 0, 100, "time_exit"),
];
const value = (card: ReturnType<typeof buildWeeklyIncomeScorecard>, key: string) => card.metrics.find((m) => m.key === key)!;

describe("Weekly Income scorecard (#86)", () => {
  const card = buildWeeklyIncomeScorecard(week(FIXTURE), "paper_fill");

  it("produces exact figures for the fixture week", () => {
    expect(value(card, "gross_premium").value).toBe(34_500);
    expect(value(card, "paid_to_close").value).toBe(30_000);
    expect(value(card, "net_kept").value).toBe(4_500);
    expect(value(card, "avg_capital_at_risk").value).toBe(92_500);
    expect(value(card, "peak_max_loss_pct").display).toBe("$1,105 · 2.21%");
    expect(value(card, "return_on_capital_at_risk").display).toBe("4.86%");
    expect(value(card, "return_on_account").value).toBeCloseTo(0.0009, 10);
    expect(value(card, "annualized_simple").display).toBe("4.68%");
    expect(value(card, "annualized_compound").display).toBe("4.79%");
    expect(value(card, "win_rate").display).toBe("80%");
    expect(value(card, "avg_win").display).toBe("$31.25 · 0.46× credit");
    expect(value(card, "avg_loss").display).toBe("$80 · 1.00× credit");
    expect(value(card, "breakeven_win_rate").display).toBe("71.91%");
    expect(value(card, "worst_position").display).toBe("DDD -$80 · 0.16% · within stated max");
    expect(value(card, "exits").display).toBe("3 / 1 / 1");
    expect(value(card, "skipped_by_rule").display).toBe("4 · top: earnings (2), liquidity (1), delta (1)");
    for (const m of card.metrics) expect(m).toMatchObject({ basis: "paper_fill", asOf: T + 100 * H });
  });

  it("states annualization as arithmetic, shows the sample limit, and passes the language check", () => {
    expect(card.annualized).toBe("0.09% for one week is 4.68% a year if multiplied by 52, or 4.79% compounded. That's arithmetic, not a forecast.");
    expect(card.sampleLimit).toBe("5 closed positions. This is process evidence, not enough to show an edge or an expected return.");
    expect(card.guided.headline).toBe("This week your practice account gained 0.09%. Trades that closed kept $45 after paying to close. On average $925 was at risk.");
    expect(card.guided.winRate).toBe("80% of closed trades made money. Because one loss is bigger than one win, you'd need to win at least 71.91% just to break even.");
    for (const text of [card.annualized!, card.sampleLimit, ...Object.values(card.guided).filter(Boolean) as string[], ...card.metrics.map((m) => m.plain)]) {
      expect(passesWeeklyIncomeLanguage(text)).toBe(true);
    }
  });

  it("never uses declared capital: missing equity or an unmarked open position is Not measured", () => {
    const noEquity = buildWeeklyIncomeScorecard(week(FIXTURE, { mondayEquityCents: null }), "paper_fill");
    expect(value(noEquity, "return_on_account")).toMatchObject({ value: null, display: "Not measured: Monday's measured account value" });
    expect(noEquity.annualized).toBeNull();
    const open = { ...FIXTURE[0], id: "OPEN", underlying: "OPEN", closedAt: null, closingDebitCents: null, exitReason: null };
    const unmarked = buildWeeklyIncomeScorecard(week([...FIXTURE, open]), "paper_fill");
    expect(value(unmarked, "return_on_account").display).toBe("Not measured: current price for OPEN");
    const marked = buildWeeklyIncomeScorecard(week([...FIXTURE, { ...open, markDebitCents: 10, markAsOf: T }]), "paper_fill");
    expect(value(marked, "return_on_account").value).toBeCloseTo((4_500 + 6_000) / 5_000_000, 10);
  });

  it("keeps counterfactual rows out of paper-fill totals and labels them", () => {
    const cf = pos("ZZZ", 100, 1, 0, 400, 0, 100, "time_exit", "counterfactual");
    const paper = buildWeeklyIncomeScorecard(week([...FIXTURE, cf]), "paper_fill");
    expect(value(paper, "gross_premium").value).toBe(34_500);
    const counter = buildWeeklyIncomeScorecard(week([...FIXTURE, cf]), "counterfactual");
    expect(counter.basisLabel).toBe("Counterfactual, not a fill");
    expect(value(counter, "gross_premium").value).toBe(10_000);
    expect(counter.metrics.every((m) => m.basis === "counterfactual")).toBe(true);
    expect(counter.guided.headline).toMatch(/^Had every idea been taken and closed by the plan, the practice account would have gained/);
  });

  it("worst week and max drawdown across weeks", () => {
    const h = weeklyIncomeHistory([{ weekOf: "2026-10-05", returnOnAccount: 0.0009 }, { weekOf: "2026-10-12", returnOnAccount: -0.003 }, { weekOf: "2026-10-19", returnOnAccount: null }, { weekOf: "2026-10-26", returnOnAccount: 0.002 }]);
    expect(h.worstWeek).toEqual({ weekOf: "2026-10-12", returnOnAccount: -0.003 });
    expect(h.maxDrawdown).toBeCloseTo(0.003, 10);
    expect(h.display).toEqual({ worstWeek: "-0.3% (week of 2026-10-12)", maxDrawdown: "0.3%" });
    expect(h.unmeasuredWeeks).toBe(1);
    expect(weeklyIncomeHistory([]).display.worstWeek).toBe("Not measured: no measured week");
  });
});
