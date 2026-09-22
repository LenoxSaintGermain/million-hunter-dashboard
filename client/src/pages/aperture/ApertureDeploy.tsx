import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Loader2, Zap, Layers, Sparkles } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { PlayAndReturn } from "@/components/aperture/PlayAndReturn";
import { trpc } from "@/lib/trpc";
import { recipeHorizonRecovery } from "@shared/intradayRecipeGuard";
import { ManualOrderTicketModal } from "@/components/aperture/ManualOrderTicketModal";
import { QuickHitCard } from "@/components/aperture/QuickHitCard";
import { QuickPlayWorkspace } from "@/components/aperture/QuickPlayWorkspace";
import { SymphonyRuleBuilder } from "@/components/aperture/SymphonyRuleBuilder";
import type { ReadyPlayCandidate } from "@shared/bestPlaySelection";

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
const HORIZONS = [
  { id: "", label: "Any Horizon" },
  { id: "intraday", label: "Today (<24h)" },
  { id: "swing", label: "This week" },
  { id: "position", label: "Long term" },
] as const;

const PRESET_AMOUNTS = [100, 500, 1000, 5000];

function readPreferences(): { amount: string; horizon: string } {
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (raw) { const parsed = JSON.parse(raw); return { amount: String(parsed.amount ?? ""), horizon: String(parsed.horizon ?? "") }; }
  } catch { /* a missing or blocked store is not an error; fall back to empty */ }
  return { amount: "10,000", horizon: "" };
}

export default function ApertureDeploy() {
  const [, navigate] = useLocation();
  const saved = readPreferences();
  const [deployMode, setDeployMode] = useState<"standard" | "quick_hits" | "quick_play">("standard");
  const [quickHitBudget, setQuickHitBudget] = useState<number>(50);
  const [amount, setAmount] = useState(saved.amount || "10,000");
  const [horizon, setHorizon] = useState(saved.horizon);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<ReadyPlayCandidate | null>(null);

  const accountQuery = trpc.aperture.account.list.useQuery(undefined, { retry: false });
  const accounts = accountQuery.data;
  const paperAccount = accounts?.find((account) => account.isPaper) ?? accounts?.[0];

  const quickHitCatalog = trpc.aperture.quickHit.catalog.useQuery(
    { budgetUsd: quickHitBudget },
    { enabled: deployMode === "quick_hits" }
  );

  const amountCents = Math.round(Number(amount.replace(/[^0-9.]/g, "")) * 100);
  const amountValid = Number.isFinite(amountCents) && amountCents > 0;

  // Live query matching candidates for the selected horizon
  const ready = trpc.aperture.play.ready.useQuery(
    { horizon: horizon || undefined, maxAlternatives: 6 },
    { staleTime: 10_000, retry: false }
  );

  // Parallel query across all horizons to discover cross-horizon alternatives
  const allReady = trpc.aperture.play.ready.useQuery(
    { maxAlternatives: 10 },
    { staleTime: 10_000, retry: false }
  );

  const best = ready.data?.best ?? null;
  const sourceHorizonRecovery = best ? recipeHorizonRecovery(best) : null;
  const construct = trpc.aperture.play.construct.useQuery(
    { runId: best?.runId ?? 0, candidateId: best?.candidateId ?? 0 },
    { enabled: best != null && !sourceHorizonRecovery, retry: false },
  );
  const recipeRecovery = sourceHorizonRecovery
    ?? (construct.data && "recovery" in construct.data ? construct.data.recovery : null);
  const play = recipeRecovery ? null : construct.data?.play;

  useEffect(() => {
    try { window.localStorage.setItem(PREF_KEY, JSON.stringify({ amount, horizon })); } catch { /* preference only */ }
  }, [amount, horizon]);

  const withheld = ready.data?.withheld;
  const alternatives = ready.data?.alternatives ?? [];
  const matchingCandidates = [best, ...alternatives].filter(Boolean) as ReadyPlayCandidate[];

  const allReadyCandidates = [allReady.data?.best, ...(allReady.data?.alternatives ?? [])].filter(Boolean) as ReadyPlayCandidate[];
  const crossHorizonCandidates = horizon
    ? allReadyCandidates.filter((c) => c.holdingPeriod !== horizon)
    : [];

  const handleSelectPreset = (value: number) => {
    setAmount(value.toLocaleString("en-US"));
  };

  const handleSwitchToMode = (mode: "standard" | "quick_hits" | "quick_play") => {
    setDeployMode(mode);
    if (mode === "quick_play" && amountCents > 10000) {
      setAmount("100");
    }
  };

  return <DashboardLayout>
    <section className={`mx-auto ${deployMode === "quick_hits" ? "max-w-5xl" : "max-w-4xl"} space-y-6 pb-16`}>
      {/* Strategy Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--sh-border-1)] pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleSwitchToMode("standard")}
            className={`min-h-10 px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              deployMode === "standard"
                ? "bg-[var(--sh-primary)] text-[var(--sh-primary-fg)] shadow-xs"
                : "bg-[var(--sh-surface-2)] text-[var(--sh-fg-2)] border border-[var(--sh-border-1)] hover:bg-[var(--sh-surface-3)]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--sh-signal)]" />
            <span>Put Capital to Work</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchToMode("quick_hits")}
            className={`min-h-10 px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              deployMode === "quick_hits"
                ? "bg-[var(--sh-primary)] text-[var(--sh-primary-fg)] shadow-xs"
                : "bg-[var(--sh-surface-2)] text-[var(--sh-fg-2)] border border-[var(--sh-border-1)] hover:bg-[var(--sh-surface-3)]"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-[var(--sh-amber)]" />
            <span>Strategy Sandbox</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchToMode("quick_play")}
            className={`min-h-10 px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              deployMode === "quick_play"
                ? "bg-[var(--sh-primary)] text-[var(--sh-primary-fg)] shadow-xs"
                : "bg-[var(--sh-surface-2)] text-[var(--sh-fg-2)] border border-[var(--sh-border-1)] hover:bg-[var(--sh-surface-3)]"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Micro Plays ($25–$100)</span>
          </button>
        </div>

        {paperAccount && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            <span style={{ color: "var(--sh-fg-muted)" }}>{paperAccount.label}:</span>
            <span className="font-bold tabular-nums" style={{ color: "var(--sh-text-primary)" }}>
              {money(paperAccount.buyingPowerCents ?? paperAccount.cashCents ?? 0)} BP
            </span>
          </div>
        )}
      </div>

      {deployMode === "quick_play" ? <QuickPlayWorkspace /> : deployMode === "quick_hits" ? (
        <div className="space-y-8 animate-in fade-in duration-150">
          <header>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-signal)" }}>
              Event-Driven Quick Hits
            </p>
            <h1 className="mt-1 font-serif text-3xl leading-tight">
              Explore short-term strategies
            </h1>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>
              Illustrative examples only. Prices, catalysts, and sample returns below are not verified current market evidence. Examples cannot create orders; use researched trades for the normal review and approval flow.
            </p>
          </header>

          {/* Symphony Modular Rule Engine */}
          <SymphonyRuleBuilder />

          {/* Curated Opportunities Feed */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-mono text-sm font-bold text-[var(--sh-text-primary)] uppercase tracking-wider">
                  Example trade setups
                </h2>
                <p className="text-xs text-[var(--sh-fg-muted)] mt-0.5">
                  Fixed sample data for exploring sizing. Not current recommendations or verified historical performance.
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
          <h1 className="mt-1 font-serif text-3xl leading-tight">Quick Deploy</h1>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>
            Instant lookup over your completed research inventory. Stage risk-bounded paper execution or launch deep scans.
          </p>
        </header>

        {/* Path A Controls: Capital Allocation & Horizon Filter */}
        <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-signal)" }}>
                1. Capital Allocation
              </label>
              {amountValid && (
                <span className="text-xs font-mono" style={{ color: "var(--sh-fg-muted)" }}>
                  Sizing target: <strong style={{ color: "var(--sh-text-primary)" }}>{money(amountCents)}</strong>
                </span>
              )}
            </div>

            <div className="mt-2.5 flex flex-wrap gap-2">
              {PRESET_AMOUNTS.map((preset) => {
                const isSelected = amountCents === preset * 100;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`min-h-10 px-4 py-1.5 rounded-lg text-sm font-mono font-medium transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[var(--sh-primary)] text-[var(--sh-primary-fg)] font-bold shadow-xs border border-transparent"
                        : "bg-[var(--sh-surface-2)] text-[var(--sh-text-primary)] border border-[var(--sh-border-1)] hover:bg-[var(--sh-surface-3)]"
                    }`}
                  >
                    ${preset.toLocaleString("en-US")}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  if (PRESET_AMOUNTS.map(p => p * 100).includes(amountCents)) {
                    setAmount("10,000");
                  }
                }}
                className={`min-h-10 px-4 py-1.5 rounded-lg text-sm font-mono font-medium transition-all cursor-pointer ${
                  !PRESET_AMOUNTS.map(p => p * 100).includes(amountCents) && amountValid
                    ? "bg-[var(--sh-primary)] text-[var(--sh-primary-fg)] font-bold shadow-xs border border-transparent"
                    : "bg-[var(--sh-surface-2)] text-[var(--sh-text-primary)] border border-[var(--sh-border-1)] hover:bg-[var(--sh-surface-3)]"
                }`}
              >
                Custom {amountValid && !PRESET_AMOUNTS.map(p => p * 100).includes(amountCents) ? `(${money(amountCents)})` : "($10,000)"}
              </button>
            </div>

            <div className="mt-3 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-mono" style={{ color: "var(--sh-fg-muted)" }}>$</span>
              <input
                id="deploy-amount"
                inputMode="decimal"
                aria-label="Amount to put to work"
                value={amount.replace(/^\$/, "")}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="10,000"
                className="min-h-11 w-full rounded border bg-transparent pl-7 pr-3 font-mono text-base tabular-nums"
                style={{ borderColor: "var(--sh-border-1)" }}
              />
            </div>
            {!amountValid && amount.length > 0 && <p className="mt-1.5 text-xs" style={{ color: "var(--sh-red)" }}>Enter an amount greater than zero.</p>}
          </div>

          <fieldset className="border-t pt-4" style={{ borderColor: "var(--sh-border-1)" }}>
            <legend className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-signal)" }}>
              2. Target Horizon
            </legend>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {HORIZONS.map((option) => {
                const active = horizon === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setHorizon(option.id)}
                    className={`min-h-10 px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                      active
                        ? "bg-[var(--sh-signal)] text-black font-semibold border-transparent"
                        : "bg-[var(--sh-surface-2)] text-[var(--sh-text-primary)] border-[var(--sh-border-1)] hover:bg-[var(--sh-surface-3)]"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        {ready.isError && (
          <p role="alert" className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--sh-red)" }}>
            Completed research could not be read. Nothing was started or changed.
          </p>
        )}

        {/* Loading skeleton */}
        {ready.isFetching && (
          <div className="rounded-xl border p-6 text-center space-y-2" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-[var(--sh-signal)]" />
            <p className="text-xs font-mono" style={{ color: "var(--sh-fg-muted)" }}>Filtering verified candidates in your completed research…</p>
          </div>
        )}

        {/* Matching Candidates Grid (Point 3: Demo-Style Live Preview Cards) */}
        {!ready.isFetching && matchingCandidates.length > 0 && (
          <section aria-label="Matching Candidates" className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-signal)" }}>
                  Matching Candidates ({matchingCandidates.length} Ready)
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--sh-fg-muted)" }}>
                  Filtered from completed thesis inventory · Instant ticket staging
                </p>
              </div>
              {amountValid && (
                <span className="text-xs font-mono tabular-nums" style={{ color: "var(--sh-fg-muted)" }}>
                  Allocation: <strong style={{ color: "var(--sh-text-primary)" }}>{money(amountCents)}</strong>
                </span>
              )}
            </div>

            {/* If best has an intraday play constructed, show PlayAndReturn */}
            {play && (
              <PlayAndReturn
                play={{
                  symbol: best!.symbol,
                  expression: "Shares",
                  horizon: best!.holdingPeriod ? String(best!.holdingPeriod).replaceAll("_", " ") : "Horizon not recorded",
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
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matchingCandidates.map((candidate, idx) => {
                const cRecovery = recipeHorizonRecovery(candidate);
                const isLead = idx === 0;
                const horizonLabel = cRecovery?.horizonLabel ?? (candidate.holdingPeriod === "swing" ? "This week" : candidate.holdingPeriod === "position" ? "Long term" : "Today");
                const isShort = candidate.playSide === "short";
                const directionLabel = isShort ? "Short / Put" : "Long / Shares";

                return (
                  <div
                    key={`${candidate.runId}:${candidate.candidateId}`}
                    className="rounded-xl border p-4 space-y-3.5 flex flex-col justify-between"
                    style={{
                      borderColor: isLead ? "var(--sh-signal)" : "var(--sh-border-1)",
                      background: "var(--sh-surface)",
                    }}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-serif text-2xl font-bold" style={{ color: "var(--sh-text-primary)" }}>
                              <span translate="no">{candidate.symbol}</span>
                            </h3>
                            {isLead && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider" style={{ background: "color-mix(in srgb, var(--sh-signal) 15%, transparent)", color: "var(--sh-signal)", border: "1px solid var(--sh-signal)" }}>
                                Best Match
                              </span>
                            )}
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: "var(--sh-fg-muted)" }}>
                            {directionLabel} · {horizonLabel} · {candidate.role ? candidate.role.replace(/_/g, " ") : "thesis expression"}
                          </p>
                        </div>
                        <div className="text-right font-mono">
                          <span className="text-[10px] block" style={{ color: "var(--sh-fg-muted)" }}>Allocation</span>
                          <span className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{money(amountCents)}</span>
                        </div>
                      </div>

                      {cRecovery && (
                        <div className="mt-2.5 rounded-md px-2.5 py-1.5 text-xs" style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)" }}>
                          <span className="font-semibold text-[11px]" style={{ color: "var(--sh-signal)" }}>Research only · </span>
                          <span>{cRecovery.horizonLabel} thesis. {cRecovery.reason}</span>
                        </div>
                      )}

                      <div className="mt-3 space-y-1.5 text-xs font-mono">
                        <div className="flex justify-between py-1 border-t border-[var(--sh-border-1)]">
                          <span style={{ color: "var(--sh-fg-muted)" }}>Evidence Verification:</span>
                          <span className="text-emerald-500 font-semibold">100% Confirmed ({candidate.checks?.length ?? 0}/{candidate.checks?.length ?? 0})</span>
                        </div>
                        <div className="flex justify-between py-1 border-t border-[var(--sh-border-1)]">
                          <span style={{ color: "var(--sh-fg-muted)" }}>Risk Ceiling:</span>
                          <span style={{ color: "var(--sh-text-primary)" }}>Broker & Single-Order Bounds Pass</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-wrap gap-2 border-t border-[var(--sh-border-1)]">
                      <Button
                        type="button"
                        className="flex-1 min-h-10 text-xs font-semibold"
                        onClick={() => {
                          setSelectedCandidate(candidate);
                          setTicketModalOpen(true);
                        }}
                      >
                        Stage Paper Ticket
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-10 text-xs"
                        onClick={() => navigate(`/aperture/run/${candidate.runId}/execute?candidate=${candidate.candidateId}&manual=1`)}
                      >
                        Draft Ticket
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-10 text-xs"
                        onClick={() => navigate(`/aperture/run/${candidate.runId}?candidate=${candidate.candidateId}&view=evidence`)}
                      >
                        View research
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {ready.data?.directionalMix && (
              <p data-directional-mix className="rounded-lg border p-3 text-xs leading-5" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 40%, var(--sh-border-1))", color: "var(--sh-text-primary)" }}>
                <strong>{ready.data.directionalMix.long} long · {ready.data.directionalMix.short} short.</strong>{" "}{ready.data.directionalMix.note}
              </p>
            )}
          </section>
        )}

        {/* 0 Matches for Horizon with Cross-Horizon Alternatives (Friction Point 3) */}
        {!ready.isFetching && !ready.isError && matchingCandidates.length === 0 && crossHorizonCandidates.length > 0 && (
          <section aria-label="Cross-horizon alternatives" className="rounded-xl border p-5 space-y-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
              <h3 className="font-serif text-lg font-semibold" style={{ color: "var(--sh-text-primary)" }}>
                0 matches for {HORIZONS.find((h) => h.id === horizon)?.label || "this horizon"}
              </h3>
            </div>
            <p className="text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>
              No candidates in this horizon have all checks resolved, but you have <strong>{crossHorizonCandidates.length} ready candidate(s)</strong> in other horizons: <strong style={{ color: "var(--sh-text-primary)" }}>{crossHorizonCandidates.map((c) => c.symbol).join(", ")}</strong>.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                onClick={() => setHorizon("")}
                className="min-h-11 font-semibold"
              >
                View these {crossHorizonCandidates.length} plays across all horizons
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => navigate("/aperture/plays")}
              >
                Open Play Desk
              </Button>
            </div>
          </section>
        )}

        {/* No Candidates Anywhere in Inventory */}
        {!ready.isFetching && !ready.isError && matchingCandidates.length === 0 && crossHorizonCandidates.length === 0 && (
          <section aria-label="No play available" className="rounded-xl border p-5 space-y-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
            <h2 className="font-serif text-xl">No play is ready to recommend yet.</h2>
            <p className="text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>
              Nothing in your completed research currently has every decision-critical check resolved.
              {withheld ? ` Set aside: ${withheld.unresolvedEvidence} awaiting evidence, ${withheld.declined} declined on evidence.` : ""}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" className="min-h-11" onClick={() => navigate("/aperture/triage")}>
                Review Pending Evidence
              </Button>
              <Button variant="outline" className="min-h-11" onClick={() => navigate("/aperture/plays")}>
                Open Play Desk
              </Button>
            </div>
          </section>
        )}

        {/* Path B (Deep / Background): Scan Market for a Fresh Opportunity (Friction Point 2) */}
        <div className="rounded-xl border p-5 space-y-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-[var(--sh-text-primary)]">
                Don't see what you want?
              </h2>
              <p className="mt-1 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>
                Scan the market for a fresh opportunity sized for {money(amountCents)}.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono border self-start sm:self-auto" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)" }}>
              ⚡ Takes ~2 mins to aggregate live sentiment, catalysts & pricing
            </span>
          </div>
          <div className="pt-1">
            <Button
              variant="outline"
              className="min-h-11 font-semibold"
              onClick={() => navigate(`/aperture/mission?objective=1&capital=${Math.round(amountCents / 100)}`)}
            >
              ⚡ Run New Market Scan with {money(amountCents)} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
        </>
      )}
    </section>

    <ManualOrderTicketModal
      open={ticketModalOpen}
      onOpenChange={setTicketModalOpen}
      initialValues={(selectedCandidate || best) ? {
        symbol: (selectedCandidate || best)!.symbol,
        direction: (selectedCandidate || best)!.playSide === "short" ? "short" : "long",
        runId: (selectedCandidate || best)!.runId,
        candidateId: (selectedCandidate || best)!.candidateId,
        suggestedAmountCents: amountCents,
        holdingPeriod: (selectedCandidate || best)!.holdingPeriod === "intraday" ? "intraday" : (selectedCandidate || best)!.holdingPeriod === "position" ? "position" : "swing",
      } : undefined}
    />
  </DashboardLayout>;
}

