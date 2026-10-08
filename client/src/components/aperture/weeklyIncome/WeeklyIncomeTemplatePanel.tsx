/**
 * Weekly Income template (#83): picker and rules panel. Guided mode reads the
 * rules in plain English; Pro mode sees the full parameter table. Display only;
 * the server validates and stores parameters.
 */
import { WI_COPY } from "@shared/weeklyIncome/copy";
import { WI_EXAMPLE_SPREAD, buildGuidedSpreadExplainer } from "@shared/weeklyIncome/guided";
import {
  WEEKLY_INCOME_PARAMETERS,
  WEEKLY_INCOME_TEMPLATE_LABEL,
  WI_GROUPS,
  formatParamValue,
  plainRuleSummary,
  tightenOnlySource,
  type WeeklyIncomeParameters,
  type WiMandateCeilings,
  type WiParamDef,
  type WiParamKey,
} from "@shared/strategyTemplates/weeklyIncome";
import { useExperienceMode } from "@/contexts/ExperienceModeContext";
import { WeeklyIncomeIntro, WeeklyIncomeSpreadExplainer, WiLabel } from "./WeeklyIncomeGuide";

const DEFS = WEEKLY_INCOME_PARAMETERS as readonly WiParamDef[];
const BUTTON = "min-h-11 border px-4 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.12em]";

export function WeeklyIncomeTemplatePicker({ onUse }: { onUse: () => void }) {
  return (
    <section data-wi-template-picker className="border p-4" style={{ borderColor: "var(--rule)", background: "var(--paper)", borderRadius: 0 }}>
      <WiLabel>Start from a template</WiLabel>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          <p className="font-serif text-lg leading-snug" style={{ color: "var(--ink)" }}>{WEEKLY_INCOME_TEMPLATE_LABEL}</p>
          <p className="mt-1 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{WI_COPY["wi.thesis.oneLiner"]} {WI_COPY["wi.thesis.noTarget"]}</p>
        </div>
        <button type="button" onClick={onUse} className={BUTTON} style={{ borderColor: "var(--sh-signal)", background: "var(--sh-signal)", color: "var(--paper)", borderRadius: 0 }}>Use this template</button>
      </div>
    </section>
  );
}

function rangeLabel(def: WiParamDef): string {
  if (def.locked) return def.locked;
  switch (def.kind) {
    case "number": return `${formatParamValue(def, def.min)} – ${formatParamValue(def, def.max)}`;
    case "time": return `${def.min} – ${def.max} ET`;
    case "enum": return def.options.join(" / ");
    case "boolean": return "on / off";
    case "structures": return "P1 / P2 / P3 (P2 after owner decision O1)";
    case "days": return "Mon – Thu";
    case "tiers": return `$${def.min} – $${def.max} each`;
    case "blackout": return "0–15 before / 5–30 after";
  }
}

export function WeeklyIncomeParameterTable({ parameters, mandate }: { parameters: WeeklyIncomeParameters; mandate?: WiMandateCeilings | null }) {
  const values = parameters as unknown as Record<string, unknown>;
  return (
    <div data-wi-parameter-table className="space-y-4">
      {WI_GROUPS.map((group) => (
        <div key={group}>
          <WiLabel tone="muted">{group}</WiLabel>
          <table className="mt-1 w-full border-collapse text-left text-xs">
            <thead><tr style={{ color: "var(--sh-fg-muted)" }}><th className="py-1 pr-2 font-normal">Parameter</th><th className="py-1 pr-2 font-normal">Value</th><th className="py-1 pr-2 font-normal">Range</th><th className="py-1 font-normal">Source</th></tr></thead>
            <tbody>
              {DEFS.filter((def) => def.group === group).map((def) => (
                <tr key={def.key} className="border-t align-top" style={{ borderColor: "var(--rule)", color: "var(--ink)" }}>
                  <td className="py-1.5 pr-2"><span className="font-mono">{def.key}</span><span className="block" style={{ color: "var(--sh-fg-muted)" }}>{def.label}</span></td>
                  <td className="py-1.5 pr-2 font-mono tabular-nums">{formatParamValue(def, values[def.key])}</td>
                  <td className="py-1.5 pr-2" style={{ color: "var(--sh-fg-muted)" }}>{rangeLabel(def)}</td>
                  <td className="py-1.5" style={{ color: "var(--sh-fg-muted)" }}>{def.mandateKey ? (mandate ? tightenOnlySource(def.key as WiParamKey, parameters, mandate) : `Tighten-only · mandate ${def.mandateKey}`) : def.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export function WeeklyIncomePlainRules({ parameters }: { parameters: WeeklyIncomeParameters }) {
  return (
    <dl data-wi-plain-rules className="grid gap-3 text-sm sm:grid-cols-2">
      {plainRuleSummary(parameters).map((row) => (
        <div key={row.group} className="border-t pt-2" style={{ borderColor: "var(--rule)" }}>
          <dt><WiLabel tone="muted">{row.group}</WiLabel></dt>
          <dd className="mt-1 leading-6" style={{ color: "var(--ink)" }}>{row.text}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Shown once the template is chosen (unsaved) or on a saved Weekly Income thesis.
 */
export function WeeklyIncomeTemplatePanel({ parameters, mandate, parameterHash, isGuided: guidedOverride, onRemove, showExample }: {
  parameters: WeeklyIncomeParameters;
  mandate?: WiMandateCeilings | null;
  parameterHash?: string | null;
  /** Defaults to the user's experience mode; fixtures pass it explicitly. */
  isGuided?: boolean;
  onRemove?: () => void;
  /** Defaults to Guided mode only. */
  showExample?: boolean;
}) {
  const mode = useExperienceMode();
  const isGuided = guidedOverride ?? mode.isGuided;
  const example = buildGuidedSpreadExplainer(WI_EXAMPLE_SPREAD);
  return (
    <section data-wi-template-panel className="space-y-4">
      {isGuided && <WeeklyIncomeIntro />}
      <div className="border p-4" style={{ borderColor: "var(--rule)", background: "var(--paper)", borderRadius: 0 }}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <WiLabel>{isGuided ? "The rules, in plain English" : "Strategy parameters · v0.1"}</WiLabel>
            <p className="mt-1 font-serif text-lg" style={{ color: "var(--ink)" }}>{WEEKLY_INCOME_TEMPLATE_LABEL}</p>
          </div>
          {onRemove && <button type="button" onClick={onRemove} className={BUTTON} style={{ borderColor: "var(--rule)", color: "var(--ink)", borderRadius: 0 }}>Remove template</button>}
        </div>
        <div className="mt-3">{isGuided ? <WeeklyIncomePlainRules parameters={parameters} /> : <WeeklyIncomeParameterTable parameters={parameters} mandate={mandate} />}</div>
        <p className="mt-3 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{WI_COPY["wi.halt"]} {parameterHash ? <span className="font-mono">Parameter set {parameterHash.slice(0, 19)}…</span> : "Defaults shown; the server checks every value when you save."}</p>
      </div>
      {isGuided && (showExample ?? true) && !("error" in example) && <WeeklyIncomeSpreadExplainer explainer={example} title="Worked example: one floor-protected trade" />}
    </section>
  );
}
