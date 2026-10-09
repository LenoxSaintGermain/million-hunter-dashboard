import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { maskAccountNumber } from "./accountNumberMask";

describe("maskAccountNumber (#119)", () => {
  it("keeps only the last 4", () => {
    expect(maskAccountNumber("PA3X46OF7EKJ")).toBe("••••7EKJ");
    expect(maskAccountNumber(null)).toBeNull();
  });
  it("no tester-facing screen prints the raw account number", () => {
    for (const file of [
      "client/src/pages/aperture/ApertureAccounts.tsx",
      "client/src/pages/aperture/ApertureExecute.tsx",
      "client/src/components/aperture/PaperProposalForm.tsx",
    ]) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/\{([^{}]*externalAccountId[^{}]*)\}/g)) {
        if (/\$\{|\{/.test(match[0]) && /(·|account )\s*\$?\{?[^}]*externalAccountId/.test(match[0])) {
          expect(match[1], `${file}: ${match[0]}`).toContain("maskAccountNumber");
        }
      }
      expect(source).toContain("maskAccountNumber");
    }
  });
});
