import { describe, expect, it } from "vitest";
import { accountFundsLabel, practiceAccountLabel } from "../../shared/apertureLanguage";

describe("account language preserves measured state", () => {
  it("only labels verified simulation as practice", () => {
    expect(practiceAccountLabel(true)).toBe("Practice account");
    for (const mode of [false, null, undefined]) {
      expect(practiceAccountLabel(mode)).toBe("Account mode unconfirmed");
    }
  });
  it("does not call fallback cash buying power", () => {
    expect(accountFundsLabel(null)).toBe("Cash");
    expect(accountFundsLabel(undefined)).toBe("Cash");
    expect(accountFundsLabel(0)).toBe("Buying power");
    expect(accountFundsLabel(120000)).toBe("Buying power");
  });
});
