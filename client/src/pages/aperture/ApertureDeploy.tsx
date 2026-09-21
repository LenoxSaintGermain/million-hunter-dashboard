import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Loader2, Zap, Layers, Sparkles } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { PlayAndReturn } from "@/components/aperture/PlayAndReturn";
import { trpc } from "@/lib/trpc";
import { recipeHorizonRecovery } from "@shared/intradayRecipeGuard";
import { ManualOrderTicketModal } from "@/components/aperture/ManualOrderTicketModal";
import { QuickHitCard } from "@/components/aperture/QuickHitCard";
import { SymphonyRuleBuilder } from "@/components/aperture/SymphonyRuleBuilder";

/**
 * TSL-BUILD-2026-009, taps 1-3. Tap 1 arrives here from Today. Tap 2 asks for
 * the best current play. Tap 3 opens it.
 *
 * This ranks research the engine has already completed. It starts no run and
 * contacts no provider, so it answers immediately — and when nothing is ready
 * it says so plainly rather than manufacturing a recommendation.
 */

const PREF_KEY = "aperture.deploy.preferences";
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
const HORIZONS = [{ id: "", label: "Any" }, { id: "intraday", label: "Today" }, { id: "swing", label: "This week" }, { id: "position", label: "Long term" }] as const;

function readPreferences(): { amount: string; horizon: string } {
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (raw) { const parsed = JSON.parse(raw); return { amount: String(parsed.amount ?? ""), horizon: String(parsed.horizon ?? "") }; }
  } catch { /* a missing or blocked store is not an error; fall back to empty */ }
  return { amount: "", horizon: "" };
}

export default function ApertureDeploy() {
  const [, navigate] = useLocation();
  const saved = readPreferences();
  const [deployMode, setDeployMode] = useState<"standard" | "quick_hits">("standard");
  const [quickHitBudget, setQuickHitBudget] = useState<number>(50);
  const [amount, setAmount] = useState(saved.amount);
  const [horizon, setHorizon] = useState(saved.horizon);
  const [asked, setAsked] = useState(false);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);

  const quickHitCatalog = trpc.aperture.quickHit.catalog.useQuery(
    { budgetUsd: quickHitBudget },
    { enabled: deployMode === "quick_hits" }
  );

  const amountCents = Math.round(Number(amount.replace(/[^0-9.]/g, "")) * 100);
  const amountValid = Number.isFinite(amountCents) && amountCents > 0;
  const ready = trpc.aperture.play.ready.useQuery({ horizon: horizon || undefined }, { enabled: false, retry: false });
  const best = ready.data?.best ?? null;
  const sourceHorizonRecovery = best ? recipeHorizonRecovery(best) : null;
  const construct = trpc.aperture.play.construct.useQuery(
    { runId: best?.runId ?? 0, candidateId: best?.candidateId ?? 0 },
    { enabled: asked && best != null && !sourceHorizonRecovery, retry: false },
  );
  const recipeRecovery = sourceHorizonRecovery
    ?? (construct.data && "recovery" in construct.data ? construct.data.recovery : null);
  const play = recipeRecovery ? null : construct.data?.play;

  const findPlay = async () => {
    try { window.localStorage.setItem(PREF_KEY, JSON.stringify({ amount, horizon })); } catch { /* preference only */ }
    setAsked(true);
    await ready.refetch();
  };

  const withheld = ready.data?.withheld;
  const deployedCents = play?.notionalCents ?? null;

  return <DashboardLayout>
    <section className={`mx-auto ${deployMode === "quick_hits" ? "max-w-5xl" : "max-w-3xl"} space-y-6 pb-16`}>
      {/* Strategy Mode Switcher: Quick Hits vs Standard Thesis */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--sh-border-1)] pb-4">
        <button
          type="button"
          onClick={() => setDeployMode("quick_hits")}
          className={`min-h-10 px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
            deployMode === "quick_hits"
              ? "bg-[var(--sh-primary)] text-[var(--sh-primary-fg)] shadow-xs"
              : "bg-[var(--sh-surface-2)] text-[var(--sh-fg-2)] border border-[var(--sh-border-1)] hover:bg-[var(--sh-surface-3)]"
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-[var(--sh-amber)]" />
          <span>Quick Hits & Symphony Lite ($25–$100)</span>
        </button>
        <button
          type="button"
          onClick={() => setDeployMode("standard")}
          className={`min-h-10 px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
            deployMode === "standard"
              ? "bg-[var(--sh-primary)] text-[var(--sh-primary-fg)] shadow-xs"
              : "bg-[var(--sh-surface-2)] text-[var(--sh-fg-2)] border border-[var(--sh-border-1)] hover:bg-[var(--sh-surface-3)]"
          }`}
        >
          <span>Institutional Thesis Deploy (Options / Equities)</span>
        </button>
      </div>

      {deployMode === "quick_hits" ? (
        <div className="space-y-8 animate-in fade-in duration-150">
          <header>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-signal)" }}>
              Event-Driven Quick Hits
            </p>
            <h1 className="mt-1 font-serif text-3xl leading-tight">
              Event Momentum & Micro-Cap Cockpit
            </h1>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>
              Disciplined short-term plays inspired by Composer rule-blocks. Automated brackets with mandatory limit orders — no manual audit friction.
            </p>
          </header>

          {/* Symphony Modular Rule Engine */}
          <SymphonyRuleBuilder />

          {/* Curated Opportunities Feed */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-mono text-sm font-bold text-[var(--sh-text-primary)] uppercase tracking-wider">
                  Curated Catalyst Plays
                </h2>
                <p className="text-xs text-[var(--sh-fg-muted)] mt-0.5">
                  SEC 8-K filings, clinical catalysts, and breakout volume. Spread capped &le; 2.0%, ADV &gt; 500k shares.
                </p>
              </div>

              {/* Global Quick Budget Toggle */}
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-[var(--sh-fg-muted)]">Default Budget:</span>
                {[25, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setQuickHitBudget(amt)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                      quickHitBudget === amt
                        ? "bg-[var(--sh-primary)] text-[var(--sh-primary-fg)] font-bold shadow-xs"
                        : "bg-[var(--sh-surface-2)] text-[var(--sh-fg-2)] border border-[var(--sh-border-1)] hover:bg-[var(--sh-surface-3)]"
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </div>

            {quickHitCatalog.isLoading ? (
              <div className="p-12 text-center text-xs font-mono text-[var(--sh-fg-muted)] border rounded-xl" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[var(--sh-signal)]" />
                Loading curated catalyst plays...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(quickHitCatalog.data ?? []).map((play) => (
                  <QuickHitCard
                    key={play.id}
                    play={play}
                    defaultBudget={quickHitBudget}
                    onAuthorized={() => {
                      // Navigate or show indicator
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
      <header>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-signal)" }}>Capital Aperture</p>
        <h1 className="mt-1 font-serif text-3xl leading-tight">How much do you want to put to work?</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>No thesis or mission setup. This ranks research already completed; nothing is ordered.</p>
      </header>

      <div className="rounded-xl border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
        <label className="block text-sm font-medium" htmlFor="deploy-amount">Amount
          <input id="deploy-amount" inputMode="decimal" aria-label="Amount to put to work" value={amount}
            onChange={(event) => setAmount(event.target.value)} placeholder="$10,000"
            className="mt-1 min-h-12 w-full rounded border bg-transparent px-3 font-mono text-lg tabular-nums"
            style={{ borderColor: "var(--sh-border-1)" }} />
        </label>
        <fieldset className="mt-4">
          <legend className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Horizon</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {HORIZONS.map((option) => <button key={option.id} type="button" aria-pressed={horizon === option.id}
              onClick={() => setHorizon(option.id)} className="min-h-11 rounded-full border px-3 text-sm"
              style={{ borderColor: horizon === option.id ? "var(--sh-signal)" : "var(--sh-border-1)", color: horizon === option.id ? "var(--sh-signal)" : "var(--sh-text-primary)" }}>{option.label}</button>)}
          </div>
        </fieldset>
        <Button className="mt-4 min-h-12 w-full text-base" disabled={!amountValid || ready.isFetching} onClick={() => void findPlay()}>
          {ready.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {ready.isFetching ? "Reviewing completed research…" : "Find my best play"}
        </Button>
        {!amountValid && amount.length > 0 && <p className="mt-2 text-xs" style={{ color: "var(--sh-red)" }}>Enter an amount greater than zero.</p>}
      </div>

      {amountValid && <div className="rounded-xl border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
        <h2 className="text-sm font-semibold">Nothing here fits?</h2>
        <p className="mt-1 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>
          Research a new opportunity for this amount. Unlike the recommendation above, this starts a fresh run against live sources — it takes a few minutes and is not instant. No order is created.
        </p>
        <Button variant="outline" className="mt-3 min-h-11" onClick={() => navigate(`/aperture/mission?objective=1&capital=${Math.round(amountCents / 100)}`)}>
          Research something new with {money(amountCents)}<ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>}

      {asked && ready.isError && <p role="alert" className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--sh-red)" }}>Completed research could not be read. Nothing was started or changed.</p>}

      {asked && !ready.isFetching && !ready.isError && best == null && <section aria-label="No play available" className="rounded-xl border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
        <h2 className="font-serif text-xl">No play is ready to recommend.</h2>
        <p className="mt-2 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>
          Nothing in your completed research has every decision-critical check resolved, so there is no recommendation to make. This is not a market view.
          {withheld ? ` Set aside: ${withheld.unresolvedEvidence} awaiting evidence, ${withheld.declined} declined on evidence, ${withheld.outOfHorizon} outside this horizon.` : ""}
        </p>
        <Button variant="outline" className="mt-3 min-h-11" onClick={() => navigate("/aperture/plays")}>Open Play Desk</Button>
      </section>}

      {asked && best && <section aria-label={recipeRecovery ? "Research candidate" : "Best play right now"} className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-signal)" }}>{recipeRecovery ? "Research candidate" : "Best play right now"}</h2>
          {amountValid && deployedCents != null && <p className="text-sm tabular-nums" style={{ color: "var(--sh-fg-muted)" }}>
            Recommended deployment: <strong style={{ color: "var(--sh-text-primary)" }}>{money(deployedCents)}</strong> of your {money(amountCents)}
            {deployedCents > amountCents ? " — this exceeds the amount you entered." : ""}
          </p>}
        </div>

        {recipeRecovery && <div className="space-y-3 rounded-xl border p-4" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--sh-signal)" }}>Research only · no paper recipe</p>
          <h3 className="font-serif text-2xl"><span translate="no">{best.symbol}</span> · {recipeRecovery.horizonLabel}</h3>
          <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>{recipeRecovery.side ? `Recorded direction: ${recipeRecovery.side}` : "Direction not recorded — no direction assumed."}</p>
          <p className="text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{recipeRecovery.reason} {recipeRecovery.nextStep}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              className="min-h-11 font-semibold"
              onClick={() => setTicketModalOpen(true)}
            >
              Stage Ad-Hoc Paper Ticket for {best.symbol}
            </Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => navigate(`/aperture/run/${best.runId}?candidate=${best.candidateId}&view=evidence`)}>View research</Button>
          </div>
        </div>}
        {!recipeRecovery && construct.isFetching && <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>Reading the recorded play…</p>}
        {play && play.readiness !== "constructed" && <p className="rounded-lg border p-3 text-sm leading-6" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 40%, var(--sh-border-1))", background: "var(--sh-surface)", color: "var(--sh-fg-muted)" }}>
          <strong style={{ color: "var(--sh-text-primary)" }}>{play.readiness === "expired" ? "This recipe\u2019s window has passed." : "Levels are not derivable yet."}</strong>{" "}
          {play.unavailableReasons?.[0] ?? "The constructor could not measure entry, stop or size from the recorded tape."}{" "}
          {play.readiness === "expired"
            ? "Its levels were measured and remain readable, but they cannot be entered as a new practice order now. The next regular session re-derives them."
            : "The play stands; its entry and stop need an observed session before any figure can be stated."}
        </p>}
        {!recipeRecovery && construct.isError && <p role="alert" className="text-sm" style={{ color: "var(--sh-red)" }}>This play's recorded terms could not be read. Nothing was changed.</p>}

        {play && <>
          <PlayAndReturn
            play={{
              symbol: best.symbol,
              expression: "Shares",
              horizon: best.holdingPeriod ? String(best.holdingPeriod).replaceAll("_", " ") : "Horizon not recorded",
              entryCondition: play.entry?.priceCents == null ? "Entry not measured" : `holds above ${money(play.entry.priceCents)}`,
              invalidation: play.stop?.priceCents == null ? "Stop not measured" : `below ${money(play.stop.priceCents)}`,
              target: play.targets?.[0]?.priceCents == null ? "Target not measured" : money(play.targets[0].priceCents),
            }}
            terms={{
              quantity: play.qty ?? null,
              entryCents: play.entry?.priceCents ?? null,
              stopCents: play.stop?.priceCents ?? null,
              targets: (play.targets ?? []).map((target: any) => ({ label: `${target.rMultiple}R target`, priceCents: target.priceCents })),
            }}
          />
          <Button className="min-h-12 w-full text-base" onClick={() => navigate(`/aperture/run/${best.runId}/execute?candidate=${best.candidateId}`)}>
            Review play<ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </>}

        <details className="rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold">Why this one? · See alternatives</summary>
          <div className="space-y-3 border-t px-4 py-3 text-sm leading-6" style={{ borderColor: "var(--sh-border-1)" }}>
            <p style={{ color: "var(--sh-fg-muted)" }}>Highest recorded rank among candidates whose decision-critical checks are all resolved. Ranking is the research score already stored for this candidate; it is not a return estimate.</p>
            {ready.data?.alternatives.length
              ? <ul className="space-y-2">{ready.data.alternatives.map((alternative) => <li key={`${alternative.runId}:${alternative.candidateId}`} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{alternative.symbol}</span>
                  <Button variant="outline" size="sm" className="min-h-11" onClick={() => navigate(`/aperture/run/${alternative.runId}/execute?candidate=${alternative.candidateId}`)}>Review {alternative.symbol}</Button>
                </li>)}</ul>
              : <p style={{ color: "var(--sh-fg-muted)" }}>No other candidate has every check resolved.</p>}
            {ready.data?.directionalMix && <p data-directional-mix className="rounded-lg border p-3" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 40%, var(--sh-border-1))", color: "var(--sh-text-primary)" }}>
              <strong>{ready.data.directionalMix.long} long · {ready.data.directionalMix.short} short.</strong>{" "}{ready.data.directionalMix.note}
            </p>}
            {withheld && <p style={{ color: "var(--sh-fg-muted)" }}>Set aside: {withheld.unresolvedEvidence} awaiting evidence, {withheld.declined} declined on evidence, {withheld.outOfHorizon} outside this horizon, {withheld.duplicateSymbol} repeat{withheld.duplicateSymbol === 1 ? "" : "s"} of a name already offered.</p>}
          </div>
        </details>
      </section>}
      </>
      )}
    </section>
    <ManualOrderTicketModal
      open={ticketModalOpen}
      onOpenChange={setTicketModalOpen}
      initialValues={best ? {
        symbol: best.symbol,
        direction: recipeRecovery?.side === "short" ? "short" : "long",
        runId: best.runId,
        candidateId: best.candidateId,
        suggestedAmountCents: amountCents,
        holdingPeriod: horizon === "intraday" ? "intraday" : horizon === "position" ? "position" : "swing",
      } : undefined}
    />
  </DashboardLayout>;
}
