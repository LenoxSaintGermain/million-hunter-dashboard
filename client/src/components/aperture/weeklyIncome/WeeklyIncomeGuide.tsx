/**
 * Weekly Income (#82) Guided-mode building blocks. Presentation only: these
 * components take numbers computed by shared/weeklyIncome and never fetch,
 * gate or submit anything.
 */
import type { ReactNode } from "react";
import { WI_COPY, WI_GLOSSARY } from "@shared/weeklyIncome/copy";
import type { GuidedSpreadExplainer } from "@shared/weeklyIncome/guided";

const LABEL = "font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em]";

export function WiLabel({ children, tone = "signal" }: { children: ReactNode; tone?: "signal" | "muted" }) {
  return <p className={LABEL} style={{ color: tone === "signal" ? "var(--sh-signal)" : "var(--sh-fg-muted)" }}>{children}</p>;
}

/** Shown wherever numbers are hypothetical. Never optional for fixture data. */
export function ExampleDataBadge() {
  return <span data-example-data className={`${LABEL} inline-block border px-1.5 py-0.5`} style={{ borderColor: "var(--sh-signal)", color: "var(--sh-signal)" }}>{WI_COPY["wi.guided.example.label"]}</span>;
}

export function PaperFidelityNote() {
  return <p data-wi-fidelity className="border-t pt-3 text-xs leading-5" style={{ borderColor: "var(--rule)", color: "var(--sh-fg-muted)" }}>{WI_COPY["wi.paper.fidelity"]}</p>;
}

/** wi.math.sixPercent: display only, next to a weekly profit target. Never changes feasibility. */
export function SixPercentNote() {
  return <p data-wi-six-percent className="mt-2 border-l-2 pl-3 text-xs leading-5" style={{ borderColor: "var(--sh-signal)", color: "var(--sh-fg-muted)" }}>{WI_COPY["wi.math.sixPercent"]}</p>;
}

export function WeeklyIncomeGlossary({ terms, open = false }: { terms?: string[]; open?: boolean }) {
  const rows = terms ? WI_GLOSSARY.filter((entry) => terms.includes(entry.term)) : WI_GLOSSARY;
  return (
    <details open={open} className="border-t pt-3" style={{ borderColor: "var(--rule)" }}>
      <summary className={`${LABEL} min-h-10 cursor-pointer`} style={{ color: "var(--sh-signal)" }}>{WI_COPY["wi.guided.wordsHeading"]}</summary>
      <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {rows.map((entry) => (
          <div key={entry.term}>
            <dt className="font-semibold" style={{ color: "var(--ink)" }}>{entry.term}</dt>
            <dd className="leading-5" style={{ color: "var(--sh-fg-muted)" }}>{entry.plain}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/**
 * The Guided explanation of one put credit spread: plain sentence, the most you
 * can lose in dollars, a what-can-go-wrong line, and the exit plan.
 */
export function WeeklyIncomeSpreadExplainer({ explainer, title }: { explainer: GuidedSpreadExplainer; title?: string }) {
  return (
    <section data-wi-explainer aria-label={title ?? "How this trade works"} className="border p-5" style={{ borderColor: "var(--rule)", background: "var(--paper)", borderRadius: 0 }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <WiLabel>{WI_COPY["wi.guided.eyebrow"]}</WiLabel>
        {explainer.isExample && <ExampleDataBadge />}
      </div>
      <h3 className="mt-2 font-serif text-2xl leading-tight" style={{ color: "var(--ink)" }}>{title ?? explainer.headline}</h3>
      <p className="mt-3 max-w-3xl text-[0.95rem] leading-6" style={{ color: "var(--ink)" }}>{explainer.summary}</p>
      {explainer.isExample && <p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>{WI_COPY["wi.guided.example.note"]}</p>}

      <div className="mt-4 grid items-start gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div data-wi-max-loss className="border p-4" style={{ borderColor: "var(--ink)", borderRadius: 0 }}>
          <WiLabel tone="muted">Most you can lose</WiLabel>
          <p className="mt-1 font-serif text-4xl tabular-nums" style={{ color: "var(--ink)" }}>{explainer.maxLoss.replace("Most you can lose: ", "")}</p>
          <p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{explainer.maxLossDetail}</p>
        </div>
        <dl className="grid gap-2 text-sm">
          {explainer.rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b pb-2" style={{ borderColor: "var(--rule)" }}>
              <dt style={{ color: "var(--ink)" }}>{row.label}<span className="block text-xs leading-4" style={{ color: "var(--sh-fg-muted)" }}>{row.plain}</span></dt>
              <dd className="font-mono tabular-nums" style={{ color: "var(--ink)" }}>{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-4 space-y-2 text-sm leading-6" style={{ color: "var(--ink)" }}>
        <p>{explainer.keep} {explainer.closeEarly}</p>
        <p>{explainer.breakeven}</p>
        <p data-wi-what-can-go-wrong className="border-l-2 pl-3" style={{ borderColor: "var(--sh-red, #b42318)" }}><strong>{explainer.whatCanGoWrong.split(":")[0]}:</strong>{explainer.whatCanGoWrong.slice(explainer.whatCanGoWrong.indexOf(":") + 1)} {explainer.gapRisk}</p>
        <p style={{ color: "var(--sh-fg-muted)" }}>{explainer.plan}</p>
      </div>
      <p className="mt-3 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{WI_COPY["wi.guided.noPromise"]}</p>
      <div className="mt-3 space-y-3">
        <WeeklyIncomeGlossary terms={["Put credit spread", "Premium (credit)", "Strike price", "Expiration", "Maximum loss", "Breakeven", "Collateral", "Assignment"]} />
        <PaperFidelityNote />
      </div>
    </section>
  );
}

/** Intro card: what Weekly Income is, in plain words, before any numbers. */
export function WeeklyIncomeIntro({ children }: { children?: ReactNode }) {
  return (
    <section data-wi-intro className="border p-5" style={{ borderColor: "var(--rule)", background: "var(--paper)", borderRadius: 0 }}>
      <WiLabel>{WI_COPY["wi.guided.eyebrow"]}</WiLabel>
      <h3 className="mt-2 font-serif text-2xl leading-tight" style={{ color: "var(--ink)" }}>{WI_COPY["wi.guided.headline"]}</h3>
      <p className="mt-3 max-w-3xl text-[0.95rem] leading-6" style={{ color: "var(--ink)" }}>{WI_COPY["wi.guided.howItWorks"]}</p>
      <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--ink)" }}>{WI_COPY["wi.guided.closeEarly"]} {WI_COPY["wi.thesis.noTarget"]}</p>
      <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{WI_COPY["wi.guided.spreadsOnly"]}</p>
      {children}
    </section>
  );
}
