import { expect, it } from "vitest";
import { prioritizesWingate } from "./wingatePresentation";
it("only prioritizes Wingate for a completed historic investor profile", () => {
  expect(prioritizesWingate("investor", { quizCompleted: true, assetClass: "historic" })).toBe(true);
  for (const role of [undefined, "admin", "user", "insurance", "capital_operator"])
    expect(prioritizesWingate(role, { quizCompleted: true, assetClass: "historic" })).toBe(false);
  expect(prioritizesWingate("investor", undefined)).toBe(false);
  expect(prioritizesWingate("investor", { quizCompleted: false, assetClass: "historic" })).toBe(false);
  expect(prioritizesWingate("investor", { quizCompleted: true, assetClass: "private_mna" })).toBe(false);
});
