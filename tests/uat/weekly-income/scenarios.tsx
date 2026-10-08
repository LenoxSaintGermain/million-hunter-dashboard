import type { ReactNode } from "react";
import { SixPercentNote, WeeklyIncomeGlossary, WeeklyIncomeIntro, WeeklyIncomeSpreadExplainer } from "../../../client/src/components/aperture/weeklyIncome/WeeklyIncomeGuide";
import { WI_EXAMPLE_SPREAD, buildGuidedSpreadExplainer } from "../../../shared/weeklyIncome/guided";

const example = buildGuidedSpreadExplainer(WI_EXAMPLE_SPREAD);

/** Each scenario is one Guided-mode state. Later PRs append their states here. */
export const SCENARIOS: Record<string, { title: string; render: () => ReactNode }> = {
  "intro": { title: "What Weekly Income is (Guided intro)", render: () => <WeeklyIncomeIntro /> },
  "worked-example": { title: "Worked example: put credit spread (Example data)", render: () => ("error" in example ? <p>{example.error}</p> : <WeeklyIncomeSpreadExplainer explainer={example} />) },
  "glossary": { title: "Words used here, in plain English", render: () => <section className="border p-5" style={{ borderColor: "var(--rule)", background: "var(--paper)" }}><WeeklyIncomeGlossary open /></section> },
  "six-percent": { title: "Weekly target note (mission setup)", render: () => <section className="border p-4 text-sm" style={{ borderColor: "var(--rule)", background: "var(--paper)" }}><p className="font-semibold">6% per week required · aggressive</p><p className="mt-1" style={{ color: "var(--sh-fg-muted)" }}>$600 target ÷ $10,000 declared mission capital (Example data). An aspiration, not a forecast; it never increases allowed risk.</p><SixPercentNote /></section> },
};
