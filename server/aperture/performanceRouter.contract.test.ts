import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./performanceRouter.ts", import.meta.url), "utf8");

describe("performance router contract", () => {
  it("is operator-gated and read-only", () => {
    expect(source).toContain("capitalOperatorProcedure");
    expect(source).not.toMatch(/\.mutation\(|\.insert\(|\.update\(|\.delete\(/);
  });

  it("scopes every table it reads to the signed-in user", () => {
    expect(source).toContain("eq(portfolioAccounts.userId, ctx.user.id)");
    expect(source).toContain("eq(accountEquitySnapshots.userId, ctx.user.id)");
    expect(source).toContain("eq(brokerOrders.userId, ctx.user.id)");
    expect(source).toContain("eq(apertureRuns.userId, ctx.user.id)");
    expect(source).toContain("eq(capitalTheses.userId, ctx.user.id)");
  });

  it("filters a practice book to its own generation", () => {
    expect(source).toContain("eq(brokerOrders.practiceBookId, book.id)");
    expect(source).toContain("eq(accountEquitySnapshots.practiceBookId, book.id)");
  });
});
