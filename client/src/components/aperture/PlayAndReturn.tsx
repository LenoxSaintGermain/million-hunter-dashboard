import { useState } from "react";
import { buildPlayReturn, type PlayReturnInput } from "@shared/playReturn";

/**
 * TSL-BUILD-2026-009: the two surfaces an operator actually asked for.
 * PLAY answers what to do. RETURN answers what could happen if they do it.
 * Desktop splits one card; mobile flips between them. Everything else on the
 * screen is progressive disclosure beneath this.
 */

const money = (cents: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: Math.abs(cents) % 100 ? 2 : 0,
}).format(cents / 100);
const signed = (cents: number) => `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${money(Math.abs(cents))}`;
const pct = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}%`;

export type PlaySide = {
  symbol: string;
  expression: string;
  horizon: string;
  entryCondition: string;
  invalidation: string;
  target: string;
};

function Fact({ label, value, tone }: { label: string; value: string; tone?: "risk" | "gain" }) {
  return <div className="flex items-baseline justify-between gap-3 border-t py-2 first:border-t-0" style={{ borderColor: "var(--sh-border-1)" }}>
    <span className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>{label}</span>
    <span className="text-right text-sm font-semibold tabular-nums" style={{ color: tone === "risk" ? "var(--sh-red)" : tone === "gain" ? "var(--sh-emerald)" : "var(--sh-text-primary)" }}>{value}</span>
  </div>;
}

export function PlayAndReturn({ play, terms }: { play: PlaySide; terms: PlayReturnInput }) {
  const [side, setSide] = useState<"play" | "return">("play");
  const result = buildPlayReturn(terms);

  const playPanel = <div data-side="play" className="min-w-0">
    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>The play</p>
    <h3 className="mt-1 font-serif text-2xl leading-tight" style={{ color: "var(--sh-text-primary)" }}>{play.symbol}</h3>
    <p className="mt-0.5 text-sm" style={{ color: "var(--sh-fg-muted)" }}>{play.expression} · {play.horizon}</p>
    <dl className="mt-3">
      <Fact label="Buy only if" value={play.entryCondition} />
      <Fact label="Stop" value={play.invalidation} />
      <Fact label="Target" value={play.target} />
      <Fact label="Holding period" value={play.horizon} />
    </dl>
  </div>;

  const returnPanel = <div data-side="return" className="min-w-0">
    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>The return</p>
    {result.measured ? <>
      <h3 className="mt-1 font-serif text-2xl leading-tight tabular-nums" style={{ color: "var(--sh-text-primary)" }}>{money(result.deployedCents)}</h3>
      <p className="mt-0.5 text-sm" style={{ color: "var(--sh-fg-muted)" }}>deployed</p>
      <dl className="mt-3">
        <Fact label="At risk if stopped" value={`${signed(-result.plannedDownsideCents)} · ${pct(result.downsideRoiPct)}`} tone="risk" />
        {result.outcomes.map(outcome => <Fact
          key={outcome.label}
          label={`If it reaches the ${outcome.label}`}
          value={`${signed(outcome.profitCents)} · ${pct(outcome.roiPct)}${outcome.rMultiple != null ? ` · ${outcome.rMultiple.toFixed(1)}R` : ""}`}
          tone="gain"
        />)}
      </dl>
      <p className="mt-3 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{result.disclosure}</p>
    </> : <>
      <h3 className="mt-1 font-serif text-2xl leading-tight" style={{ color: "var(--sh-text-primary)" }}>Not measured</h3>
      <p className="mt-2 text-sm leading-5" style={{ color: "var(--sh-fg-muted)" }}>
        No return can be stated without {result.missing.join(", ")}. An unmeasurable loss is not a small one, so no figure is shown here.
      </p>
    </>}
  </div>;

  return <section aria-label="Play and return" className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
    <div role="tablist" aria-label="Play or return" className="flex border-b sm:hidden" style={{ borderColor: "var(--sh-border-1)" }}>
      {(["play", "return"] as const).map(key => <button
        key={key} type="button" role="tab" aria-selected={side === key}
        onClick={() => setSide(key)}
        className="min-h-11 flex-1 text-xs font-semibold uppercase tracking-[0.12em]"
        style={{ color: side === key ? "var(--sh-text-primary)" : "var(--sh-fg-muted)", borderBottom: side === key ? "2px solid var(--sh-signal)" : "2px solid transparent" }}
      >{key === "play" ? "Play" : "Return"}</button>)}
    </div>
    <div className="grid gap-px sm:grid-cols-2" style={{ background: "var(--sh-border-1)" }}>
      <div className={`p-4 sm:block ${side === "play" ? "" : "hidden"}`} style={{ background: "var(--sh-surface)" }}>{playPanel}</div>
      <div className={`p-4 sm:block ${side === "return" ? "" : "hidden"}`} style={{ background: "var(--sh-surface)" }}>{returnPanel}</div>
    </div>
  </section>;
}
