import type { ReactNode } from "react";
import { SixPercentNote, WeeklyIncomeGlossary, WeeklyIncomeIntro, WeeklyIncomeSpreadExplainer } from "../../../client/src/components/aperture/weeklyIncome/WeeklyIncomeGuide";
import { WI_EXAMPLE_SPREAD, buildGuidedSpreadExplainer } from "../../../shared/weeklyIncome/guided";
import { WeeklyIncomeTemplatePanel, WeeklyIncomeTemplatePicker } from "../../../client/src/components/aperture/weeklyIncome/WeeklyIncomeTemplatePanel";
import { weeklyIncomeDefaults } from "../../../shared/strategyTemplates/weeklyIncome";

const FIXTURE_MANDATE = { version: "v2", maxPlannedRiskPctPerPlay: 0.75, maxAggregateOpenRiskPct: 3, maxDailyPlannedRiskPct: 2, maxCorrelatedPlannedRiskPct: 1.25, maxWeeklyPlannedRiskPct: 4, minAdvUsd30d: 20_000_000 };

const example = buildGuidedSpreadExplainer(WI_EXAMPLE_SPREAD);

/** Each scenario is one Quick Play state. Later PRs append their states here. */
export const SCENARIOS: Record<string, { title: string; render: () => ReactNode }> = {
  "intro": { title: "What Weekly Income is (Quick Play intro)", render: () => <WeeklyIncomeIntro /> },
  "worked-example": { title: "Worked example: put credit spread (Example data)", render: () => ("error" in example ? <p>{example.error}</p> : <WeeklyIncomeSpreadExplainer explainer={example} />) },
  "glossary": { title: "Words used here, in plain English", render: () => <section className="border p-5" style={{ borderColor: "var(--rule)", background: "var(--paper)" }}><WeeklyIncomeGlossary open /></section> },
  "six-percent": { title: "Weekly target note (mission setup)", render: () => <section className="border p-4 text-sm" style={{ borderColor: "var(--rule)", background: "var(--paper)" }}><p className="font-semibold">6% per week required · aggressive</p><p className="mt-1" style={{ color: "var(--sh-fg-muted)" }}>$600 target ÷ $10,000 declared mission capital (Example data). An aspiration, not a forecast; it never increases allowed risk.</p><SixPercentNote /></section> },
  "template-picker": { title: "New Capital thesis: template choice", render: () => <WeeklyIncomeTemplatePicker onUse={() => undefined} /> },
  "template-quick-play": { title: "Weekly Income template chosen (Quick Play)", render: () => <WeeklyIncomeTemplatePanel parameters={weeklyIncomeDefaults()} isGuided onRemove={() => undefined} showExample={false} /> },
  "template-strategist": { title: "Weekly Income template chosen (Strategist parameter table)", render: () => <WeeklyIncomeTemplatePanel parameters={weeklyIncomeDefaults()} mandate={FIXTURE_MANDATE} parameterHash="sha256:fixture-not-a-real-hash" isGuided={false} /> },
};
