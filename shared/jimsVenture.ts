/** Frozen, fictional teaching assumptions. No vehicle quote or operating forecast. */
export const JIM_DEFAULTS = Object.freeze({
  utilization: 45,
  revenuePerHour: 28,
  variableCostPerHour: 9,
  fixedMonthlyCost: 2400,
  downtime: 15,
});
export type JimAssumptions = Record<keyof typeof JIM_DEFAULTS, number>;
export const JIM_CONTROLS = [
  {
    key: "utilization",
    label: "Paid utilization",
    unit: "% of available hours",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    key: "revenuePerHour",
    label: "Revenue per paid hour",
    unit: "USD / paid hour",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    key: "variableCostPerHour",
    label: "Variable cost per paid hour",
    unit: "USD / paid hour",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    key: "fixedMonthlyCost",
    label: "Fixed costs & capital reserve",
    unit: "USD / month",
    min: 0,
    max: 15000,
    step: 100,
  },
  {
    key: "downtime",
    label: "Unavailable time",
    unit: "% of scheduled hours",
    min: 0,
    max: 100,
    step: 1,
  },
] as const;
export const JIM_GATES = [
  {
    title: "Vehicle & commercial rights",
    request:
      "Obtain written availability, delivery terms, permitted commercial use and support commitments. No availability is established here.",
  },
  {
    title: "Permission to operate",
    request:
      "Identify the jurisdiction and obtain qualified confirmation of required licenses, operating permissions and restrictions.",
  },
  {
    title: "Insurance & liability",
    request:
      "Obtain a written commercial coverage quote, exclusions and a responsibility map for incidents and remote assistance.",
  },
  {
    title: "Paying demand",
    request:
      "Test a named route and customer segment. Measure paid hours, empty travel, pricing and repeat demand with a lawful pilot.",
  },
] as const;
export const JIM_ANGLES = [
  {
    title: "Own the bottleneck, not the fleet.",
    hypothesis:
      "A charging, cleaning or staging site might serve several operators without concentrating capital in vehicles.",
    test: "Verify site rights, power capacity and contracted third-party demand. Model land, equipment and environmental costs separately.",
  },
  {
    title: "Secure demand before machinery.",
    hypothesis:
      "A narrow, contracted service could be more testable than open-market ride demand.",
    test: "Seek non-binding customer interviews and route requirements first. A letter of interest is not revenue or operating permission.",
  },
  {
    title: "Buy an option to learn.",
    hypothesis:
      "A staged partnership might reduce irreversible spending while uncertainty is highest.",
    test: "Define a capped pilot budget, exit rights and evidence milestones. Partner access and lawful operation remain unverified.",
  },
] as const;
export function evaluateJimVenture(input: JimAssumptions) {
  for (const control of JIM_CONTROLS) {
    const value = input[control.key];
    if (!Number.isFinite(value) || value < control.min || value > control.max)
      throw new RangeError(`Invalid ${control.key}`);
  }
  const scheduledHours = 30 * 16;
  const availableHours = scheduledHours * (1 - input.downtime / 100);
  const paidHours = (availableHours * input.utilization) / 100;
  const revenue = paidHours * input.revenuePerHour;
  const variableCosts = paidHours * input.variableCostPerHour;
  const contributionPerHour = input.revenuePerHour - input.variableCostPerHour;
  const breakEvenUtilization =
    input.fixedMonthlyCost === 0
      ? 0
      : availableHours > 0 && contributionPerHour > 0
        ? (100 * input.fixedMonthlyCost) /
          (availableHours * contributionPerHour)
        : null;
  const breakEvenMode =
    input.fixedMonthlyCost === 0 &&
    (availableHours === 0 || contributionPerHour === 0)
      ? "all-utilizations"
      : input.fixedMonthlyCost === 0 && contributionPerHour < 0
        ? "zero-only"
        : breakEvenUtilization !== null && breakEvenUtilization <= 100
          ? "minimum-utilization"
          : "unattainable";
  return {
    scheduledHours,
    availableHours,
    paidHours,
    revenue,
    variableCosts,
    residual: revenue - variableCosts - input.fixedMonthlyCost,
    breakEvenUtilization,
    breakEvenMode,
    feasibleBreakEven:
      breakEvenUtilization !== null && breakEvenUtilization <= 100,
    readiness: "unverified" as const,
    unresolvedGates: JIM_GATES.length,
  };
}
