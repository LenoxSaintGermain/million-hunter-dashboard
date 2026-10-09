import { Check, X } from "lucide-react";
import { buildGuardrailChecklist } from "@shared/guardrailChecklist";

type Evaluation = Parameters<typeof buildGuardrailChecklist>[0];

/**
 * Every guardrail the server checked for this ticket, pass and fail, with a
 * square readiness meter. Renders the server's evaluation only.
 */
export function GuardrailChecklist({ evaluation, checking = false, checkedAt }: { evaluation: Evaluation; checking?: boolean; checkedAt?: number | null }) {
  const list = buildGuardrailChecklist(evaluation);
  const failed = list.rows.filter((row) => !row.passed);
  const passedRows = list.rows.filter((row) => row.passed);
  return <section aria-labelledby="guardrail-checklist-heading" data-guardrail-checklist={list.state} className="guardrail-checklist border p-3.5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <p id="guardrail-checklist-heading" className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Guardrail check</p>
      <p className="text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>
        {checking ? "Checking this ticket…" : list.state === "not_checked" ? "Not checked yet" : `Checked${checkedAt ? ` ${new Date(checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""} · checks run again when you send`}
      </p>
    </div>
    {list.state === "not_checked" ? <p className="mt-2 text-sm" style={{ color: "var(--sh-fg-muted)" }}>
      {checking ? "Running the guardrail checks for this ticket." : "The checks run once the ticket has a price, an exit price and a size. Not checked is not a pass."}
    </p> : <>
      <p className="mt-1 font-serif text-xl leading-tight" style={{ color: "var(--sh-text-primary)" }}>
        {list.passed} of {list.total} checks pass{failed.length ? ` · ${failed.length} to fix` : ""}
      </p>
      <div role="meter" aria-label="Guardrail checks passed" aria-valuemin={0} aria-valuemax={list.total} aria-valuenow={list.passed} aria-valuetext={`${list.passed} of ${list.total} checks pass`} className="mt-2 flex h-2.5 gap-px">
        {list.rows.map((row) => <span key={row.key} className="h-full flex-1" style={{ background: row.passed ? "var(--sh-text-primary)" : "var(--sh-red)", opacity: row.passed ? 0.78 : 1 }} />)}
      </div>
      {failed.length > 0 && <ul aria-label="Checks to fix" className="mt-3 divide-y border" style={{ borderColor: "var(--sh-red)" }}>
        {failed.map((row) => <li key={row.key} className="flex gap-2 p-2.5" style={{ borderColor: "var(--sh-border-1)" }}>
          <X aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--sh-red)" }} />
          <div className="min-w-0 text-xs leading-5">
            <p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}><span className="sr-only">Fails: </span>{row.problem}</p>
            {row.remedy && <p className="mt-0.5" style={{ color: "var(--sh-text-primary)" }}><span className="font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--sh-signal)" }}>What to do · </span>{row.remedy}</p>}
          </div>
        </li>)}
      </ul>}
      {passedRows.length > 0 && <ul aria-label="Checks that pass" className="mt-3 grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {passedRows.map((row) => <li key={row.key} className="flex items-start gap-1.5 text-xs leading-5" title={row.detail} style={{ color: "var(--sh-text-primary)" }}>
          <Check aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-fg-muted)" }} /><span><span className="sr-only">Passes: </span>{row.name}</span>
        </li>)}
      </ul>}
      <p className="mt-3 text-[11px] leading-5" style={{ color: "var(--sh-fg-muted)" }}>Send stays off while any check fails. Nothing is sent until you confirm.</p>
    </>}
  </section>;
}
