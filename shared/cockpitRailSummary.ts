export type CockpitHeadroomLine = {
  key: string;
  label: string;
  subject: string | null;
  usedCents: number | null;
  ceilingCents: number | null;
  remainingCents: number | null;
  usedPct: number | null;
  ceilingPct: number;
  basis: string;
  reason: string | null;
};

export type ConstraintSeverity = "quiet" | "warning" | "critical" | "unmeasurable";

export const STALE_ACCOUNT_MS = 4 * 60 * 60 * 1000;
export const CRITICAL_CONSTRAINT_PCT = 85;

/** Acknowledgement applies only to this exact measured constraint state. */
export function cockpitConstraintSignature(line: CockpitHeadroomLine | null | undefined) {
  if (!line || line.usedCents == null || line.ceilingCents == null) return null;
  return `${line.key}|${line.subject ?? ""}|${line.usedCents}|${line.ceilingCents}`;
}

function isReferenceCeiling(line: CockpitHeadroomLine) {
  return line.key === "single_order" || line.key === "planned_risk_per_play";
}

function isMeasurable(line: CockpitHeadroomLine) {
  return !isReferenceCeiling(line)
    && line.usedCents != null
    && line.ceilingCents != null
    && line.usedPct != null;
}

function utilizationPct(line: CockpitHeadroomLine) {
  if (line.usedCents != null && line.ceilingCents != null && line.ceilingCents > 0) {
    return (line.usedCents / line.ceilingCents) * 100;
  }
  return line.usedPct;
}

function sameMeasuredValue(left: CockpitHeadroomLine, right: CockpitHeadroomLine) {
  // An unclassified cluster is the same holding as the name. Its cluster ceiling
  // may differ from the single-name ceiling, but showing both repeats the same
  // exposure amount and hides the binding signal in a roster.
  return left.usedCents === right.usedCents;
}

export function buildCockpitRailSummary(lines: CockpitHeadroomLine[], stalenessMs: number | null) {
  const measurable = lines.filter(isMeasurable);
  const binding = measurable.slice().sort((a, b) => (utilizationPct(b) ?? -Infinity) - (utilizationPct(a) ?? -Infinity))[0] ?? null;
  const sameName = lines.find((line) => /single name/i.test(line.label)) ?? null;
  const cluster = lines.find((line) => /cluster/i.test(line.label)) ?? null;
  const duplicatedUnclassifiedCluster = Boolean(
    sameName && cluster && /unclassified/i.test(cluster.subject ?? "") && sameMeasuredValue(sameName, cluster),
  );

  const severity: ConstraintSeverity = binding == null
    ? "unmeasurable"
    : (utilizationPct(binding) ?? 0) >= CRITICAL_CONSTRAINT_PCT
      ? "critical"
      : (utilizationPct(binding) ?? 0) >= 70
        ? "warning"
        : "quiet";

  return {
    binding,
    bindingUtilizationPct: binding ? utilizationPct(binding) : null,
    severity,
    accountStale: stalenessMs != null && stalenessMs > STALE_ACCOUNT_MS,
    duplicatedUnclassifiedCluster,
    expandedLines: duplicatedUnclassifiedCluster ? lines.filter((line) => line !== cluster) : lines,
  };
}
