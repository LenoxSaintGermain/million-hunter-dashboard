import { useState } from "react";
import {
  JIM_ANGLES,
  JIM_CONTROLS,
  JIM_DEFAULTS,
  JIM_GATES,
  evaluateJimVenture,
  type JimAssumptions,
} from "../../../shared/jimsVenture";
import "../styles/jims-file.css";

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
type Decision = "validate" | "revise" | "shelve";
export default function JimsFile() {
  const [assumptions, setAssumptions] = useState<JimAssumptions>({
    ...JIM_DEFAULTS,
  });
  const [gate, setGate] = useState(0);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const result = evaluateJimVenture(assumptions);
  const scale = Math.max(
    result.revenue,
    result.variableCosts + assumptions.fixedMonthlyCost,
    1
  );
  function update(key: keyof JimAssumptions, value: number) {
    setAssumptions(previous => ({ ...previous, [key]: value }));
    setDecision(null);
  }
  return (
    <main className="jim-file">
      <nav className="jim-masthead" aria-label="Case navigation">
        <a href="/">← Signal Hunter</a>
        <span>The venture papers / No. 01</span>
      </nav>
      <header className="jim-intro">
        <p className="jim-eyebrow">A little something for Jim</p>
        <h1>Before the first ride.</h1>
        <p className="jim-deck">
          An idea is a starting point. Not yet an investment case.
        </p>
        <p className="jim-disclosure">
          Illustrative Cybercab venture · fictional assumptions · zero API · no
          orders
        </p>
        <details>
          <summary>About this file</summary>
          <p>
            A hypothetical autonomous-mobility venture, not a submitted customer
            case, endorsement or affiliation. No vehicle price, availability,
            approval or commercial capability is asserted. This example does not
            process documents or conduct live research.
          </p>
        </details>
      </header>
      <section className="jim-spread" aria-labelledby="jim-idea">
        <div>
          <p className="jim-eyebrow">01 / The proposition</p>
          <h2 id="jim-idea">
            What if the asset could earn while you weren’t driving?
          </h2>
          <p>
            Explore a one-vehicle service. First separate the attractive
            arithmetic from the conditions that would let the business exist.
          </p>
        </div>
        <aside className="jim-margin">
          <span className="jim-eyebrow">The senior’s question</span>
          <h3>Who pays for the hours nobody buys?</h3>
          <p>
            Idle time, empty travel and service interruptions can consume the
            margin before the first financing payment.
          </p>
        </aside>
      </section>
      <section aria-labelledby="jim-economics" className="jim-chapter">
        <p className="jim-eyebrow">02 / Pencil the economics</p>
        <h2 id="jim-economics">Make the assumptions work for their place.</h2>
        <p className="jim-caption">
          One hypothetical vehicle · 30 days × 16 scheduled hours · monthly USD
        </p>
        <div className="jim-spread">
          <div className="jim-controls">
            {JIM_CONTROLS.map(control => (
              <label key={control.key} htmlFor={`jim-${control.key}`}>
                <span>
                  {control.label}
                  <small>{control.unit}</small>
                </span>
                <output htmlFor={`jim-${control.key}`}>
                  {control.key === "downtime" || control.key === "utilization"
                    ? `${assumptions[control.key]}%`
                    : money(assumptions[control.key])}
                </output>
                <input
                  id={`jim-${control.key}`}
                  type="range"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={assumptions[control.key]}
                  onChange={event =>
                    update(control.key, Number(event.target.value))
                  }
                />
              </label>
            ))}
          </div>
          <div className="jim-ledger">
            <p className="jim-eyebrow">The hypothetical month</p>
            <div
              className="jim-bars"
              aria-label={`Revenue ${money(result.revenue)}. Variable costs ${money(result.variableCosts)}. Fixed costs ${money(assumptions.fixedMonthlyCost)}.`}
            >
              <div>
                <span>
                  Revenue <b>{money(result.revenue)}</b>
                </span>
                <i style={{ width: `${(result.revenue / scale) * 100}%` }} />
              </div>
              <div>
                <span>
                  All modeled costs{" "}
                  <b>
                    {money(result.variableCosts + assumptions.fixedMonthlyCost)}
                  </b>
                </span>
                <i
                  className="jim-cost-bar"
                  style={{
                    width: `${((result.variableCosts + assumptions.fixedMonthlyCost) / scale) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div className="jim-result" aria-live="polite" aria-atomic="true">
              <span>Modeled monthly residual</span>
              <strong data-negative={result.residual < 0}>
                {money(result.residual)}
              </strong>
              <small>
                Pre-tax scenario—not profit, valuation or a forecast.
              </small>
            </div>
            <dl className="jim-measures">
              <div>
                <dt>Paid hours</dt>
                <dd>{result.paidHours.toFixed(1)}</dd>
              </div>
              <div>
                <dt>Break-even utilization</dt>
                <dd>
                  {result.breakEvenUtilization === null
                    ? "Not attainable"
                    : `${result.breakEvenUtilization.toFixed(1)}%`}
                </dd>
              </div>
            </dl>
            <p className="jim-caption">
              {result.breakEvenMode === "all-utilizations"
                ? "Residual is zero at every utilization setting: no fixed costs and no net hourly contribution or available hours. This is not an operating return."
                : result.breakEvenMode === "zero-only"
                  ? "Only zero paid utilization breaks even. Each paid hour loses money under these assumptions."
                  : !result.feasibleBreakEven
                    ? "These assumptions cannot cover fixed costs within available hours."
                    : result.residual < 0
                      ? "Paid time falls short of modeled break-even."
                      : "The arithmetic clears modeled costs. The four real-world gates remain open."}
            </p>
            <details>
              <summary>Read the formula & exclusions</summary>
              <p>
                Available hours = 480 × (1 − downtime). Paid hours = available
                hours × utilization. Residual = paid hours × (hourly revenue −
                variable cost) − fixed costs. Break-even utilization = fixed
                costs ÷ (available hours × hourly contribution).
              </p>
              <p>
                All numbers are invented teaching inputs. Variable cost is per
                paid hour; include empty travel, energy, cleaning and platform
                charges in that allowance. Fixed costs must cover your assumed
                insurance, support, overhead and capital reserve. Taxes,
                financing structure, acquisition cash outlay and resale value
                are not separately modeled. This is not a payback or
                investment-return calculation.
              </p>
            </details>
          </div>
        </div>
      </section>
      <section className="jim-chapter" aria-labelledby="jim-gates">
        <p className="jim-eyebrow">03 / Four questions before capital</p>
        <h2 id="jim-gates">Four gates. Still an open case.</h2>
        <div className="jim-gates">
          {JIM_GATES.map((item, index) => (
            <button
              key={item.title}
              aria-pressed={gate === index}
              aria-controls="jim-gate-detail"
              onClick={() => setGate(index)}
            >
              <span aria-hidden="true">○</span>
              <strong>{item.title}</strong>
              <small>Unverified</small>
            </button>
          ))}
        </div>
        <div
          id="jim-gate-detail"
          className="jim-gate-detail"
          aria-live="polite"
        >
          <h3>{JIM_GATES[gate].title}</h3>
          <p>{JIM_GATES[gate].request}</p>
          <small>
            Opening a question does not verify it. This illustrative file cannot
            clear these gates.
          </small>
        </div>
      </section>
      <section className="jim-chapter" aria-labelledby="jim-angles">
        <p className="jim-eyebrow">04 / Another way in</p>
        <h2 id="jim-angles">Maybe the vehicle isn’t the whole play.</h2>
        <p className="jim-caption">
          Strategic hypotheses—not findings or recommendations.
        </p>
        {JIM_ANGLES.map(angle => (
          <details className="jim-angle" key={angle.title}>
            <summary>{angle.title}</summary>
            <p>{angle.hypothesis}</p>
            <p>
              <strong>What would test it?</strong> {angle.test}
            </p>
          </details>
        ))}
      </section>
      <section className="jim-chapter" aria-labelledby="jim-decision">
        <p className="jim-eyebrow">05 / Your next move</p>
        <h2 id="jim-decision">Resolve the next question. Right here.</h2>
        <p className="jim-caption">
          A local rehearsal only. Nothing is submitted, saved or approved.
        </p>
        <div className="jim-actions">
          {(["validate", "revise", "shelve"] as const).map(action => (
            <button
              key={action}
              aria-pressed={decision === action}
              onClick={() => setDecision(action)}
            >
              {action === "validate"
                ? "Plan validation"
                : action === "revise"
                  ? "Revise the idea"
                  : "Shelve for now"}
            </button>
          ))}
        </div>
        {decision && (
          <div className="jim-decision" aria-live="polite">
            <h3>
              {decision === "validate"
                ? "Start with the right to operate."
                : decision === "revise"
                  ? "Change the premise, not just the spreadsheet."
                  : "Preserve the option. Avoid the commitment."}
            </h3>
            <p>
              {decision === "validate"
                ? "Name the jurisdiction and a customer segment. Request written operating, vehicle-use and insurance terms before a paid pilot. No request has been sent."
                : decision === "revise"
                  ? "Try a demand-first contract, a service-site model or a capped partnership. Then rework costs and revisit every unresolved gate."
                  : "Reopen only when a named evidence gap changes. This selection does not change a real portfolio or create a reminder."}
            </p>
            <label htmlFor="jim-note">
              Your next evidence request or revised premise
            </label>
            <textarea
              id="jim-note"
              value={note}
              maxLength={1200}
              rows={3}
              placeholder="What would you need to learn next?"
              onChange={event => setNote(event.target.value)}
            />
            <small>
              Session only. Do not enter confidential information. Changing the
              economics clears this decision.
            </small>
          </div>
        )}
        <button
          className="jim-reset"
          onClick={() => {
            setAssumptions({ ...JIM_DEFAULTS });
            setGate(0);
            setDecision(null);
            setNote("");
          }}
        >
          Reset the illustrative file ↺
        </button>
      </section>
      <footer className="jim-footer">
        Jim’s file / A venture-evaluation example, not investment approval.{" "}
        <a href="/">Back to Signal Hunter ↗</a>
      </footer>
    </main>
  );
}
