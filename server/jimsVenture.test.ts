import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  JIM_DEFAULTS,
  JIM_GATES,
  evaluateJimVenture,
} from "../shared/jimsVenture";

describe("illustrative Jim venture arithmetic", () => {
  it("calculates paid hours, residual and break-even from explicit inputs", () => {
    const result = evaluateJimVenture({ ...JIM_DEFAULTS });
    expect(result.availableHours).toBe(408);
    expect(result.paidHours).toBeCloseTo(183.6);
    expect(result.revenue).toBeCloseTo(5140.8);
    expect(result.residual).toBeCloseTo(1088.4);
    expect(result.breakEvenUtilization).toBeCloseTo(30.95975);
  });
  it("keeps readiness unknown even with very favorable economics", () => {
    const result = evaluateJimVenture({
      ...JIM_DEFAULTS,
      utilization: 100,
      revenuePerHour: 100,
      downtime: 0,
    });
    expect(result.residual).toBeGreaterThan(0);
    expect(result.readiness).toBe("unverified");
    expect(result.unresolvedGates).toBe(JIM_GATES.length);
  });
  it("does not divide by zero when downtime is total or contribution nonpositive", () => {
    for (const input of [
      { ...JIM_DEFAULTS, downtime: 100 },
      { ...JIM_DEFAULTS, revenuePerHour: 9 },
      { ...JIM_DEFAULTS, revenuePerHour: 0 },
    ]) {
      const result = evaluateJimVenture(input);
      expect(result.breakEvenUtilization).toBeNull();
      expect(result.feasibleBreakEven).toBe(false);
      expect(Number.isFinite(result.residual)).toBe(true);
    }
  });
  it("reports infeasible break-even above available capacity without clamping", () => {
    const result = evaluateJimVenture({
      ...JIM_DEFAULTS,
      fixedMonthlyCost: 15000,
    });
    expect(result.breakEvenUtilization).toBeGreaterThan(100);
    expect(result.feasibleBreakEven).toBe(false);
  });
  it("allows zero fixed costs and preserves losses at zero utilization", () => {
    expect(
      evaluateJimVenture({ ...JIM_DEFAULTS, fixedMonthlyCost: 0 })
        .breakEvenUtilization
    ).toBe(0);
    expect(
      evaluateJimVenture({ ...JIM_DEFAULTS, utilization: 0 }).residual
    ).toBe(-2400);
  });
  it.each([NaN, Infinity, -1, 101])(
    "rejects invalid utilization %s",
    utilization => {
      expect(() =>
        evaluateJimVenture({ ...JIM_DEFAULTS, utilization })
      ).toThrow(RangeError);
    }
  );
  it.each([0, 45, 100])(
    "breaks even with no fixed costs and zero contribution at %s utilization",
    utilization => {
      const result = evaluateJimVenture({
        ...JIM_DEFAULTS,
        fixedMonthlyCost: 0,
        revenuePerHour: 9,
        utilization,
      });
      expect(result.breakEvenUtilization).toBe(0);
      expect(result.feasibleBreakEven).toBe(true);
      expect(result.residual).toBe(0);
      expect(result.breakEvenMode).toBe("all-utilizations");
    }
  );
  it.each([0, 9, 28])(
    "breaks even with no fixed costs and no availability at hourly revenue %s",
    revenuePerHour => {
      const result = evaluateJimVenture({
        ...JIM_DEFAULTS,
        fixedMonthlyCost: 0,
        downtime: 100,
        revenuePerHour,
      });
      expect(result.breakEvenUtilization).toBe(0);
      expect(result.feasibleBreakEven).toBe(true);
      expect(result.residual).toBe(0);
      expect(result.breakEvenMode).toBe("all-utilizations");
    }
  );
  it("breaks even only at zero utilization when contribution is negative and fixed costs are zero", () => {
    for (const utilization of [0, 1, 100]) {
      const result = evaluateJimVenture({
        ...JIM_DEFAULTS,
        fixedMonthlyCost: 0,
        revenuePerHour: 8,
        utilization,
      });
      expect(result.breakEvenUtilization).toBe(0);
      expect(result.feasibleBreakEven).toBe(true);
      expect(result.breakEvenMode).toBe("zero-only");
      if (utilization === 0) expect(result.residual).toBe(0);
      else expect(result.residual).toBeLessThan(0);
    }
  });
  it("is deterministic and leaves the defaults unchanged", () => {
    expect(evaluateJimVenture({ ...JIM_DEFAULTS })).toEqual(
      evaluateJimVenture({ ...JIM_DEFAULTS })
    );
    expect(JIM_DEFAULTS.utilization).toBe(45);
  });
  it("keeps the public case local and discloses its limits", () => {
    const page = readFileSync("client/src/pages/JimsFile.tsx", "utf8");
    expect(page).not.toMatch(/fetch\(|axios|trpc|localStorage|sessionStorage/);
    expect(page).toContain("fictional assumptions");
    expect(page).toContain("Four gates. Still an open case.");
    expect(page).not.toContain("Good math.");
    expect(page.replace(/\s+/g, " ")).toContain(
      "not a submitted customer case, endorsement or affiliation"
    );
    expect(page).toContain("setDecision(null)");
    expect(page).toMatch(/setNote\(["']{2}\)/);
    expect(page).toContain("Nothing is submitted, saved or approved");
    expect(readFileSync("client/src/styles/jims-file.css", "utf8")).toMatch(
      /prefers-reduced-motion:\s*reduce/
    );
  });
});
