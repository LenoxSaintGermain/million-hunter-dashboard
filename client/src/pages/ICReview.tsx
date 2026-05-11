/**
 * ICReview.tsx
 *
 * Investment Committee Review — Signal Hunter Editorial Edition.
 * Editorial article layout with:
 * - Left gutter float annotations (AI commentary)
 * - Main content: deal thesis, financial summary, risk matrix
 * - Right aside: Consensus Dashboard (3-model vote, divergence detection)
 * - Framer Motion blur-fade entrance animations
 */

import { useState } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import EditorialTopNav from "@/components/EditorialTopNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ArrowLeft, AlertTriangle, CheckCircle2, XCircle, TrendingUp, DollarSign, Users, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const fadeUp = { initial: { opacity: 0, y: 12, filter: "blur(4px)" }, animate: { opacity: 1, y: 0, filter: "blur(0px)" }, transition: { duration: 0.4 } };

function GutterNote({ children, type = "insight" }: { children: React.ReactNode; type?: "insight" | "warning" | "flag" }) {
  const colors = {
    insight: "border-l-[#ffba20] bg-[#fffdf7]",
    warning: "border-l-amber-400 bg-amber-50",
    flag: "border-l-red-400 bg-red-50",
  };
  const icons = { insight: "lightbulb", warning: "warning", flag: "flag" };
  return (
    <div className={cn("border-l-2 pl-3 py-2 rounded-r", colors[type])}>
      <div className="flex items-start gap-2">
        <span className="material-symbols-outlined text-[14px] text-[#8b7355] mt-0.5">{icons[type]}</span>
        <p className="text-xs text-[#3d2e1e] leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function VerdictChip({ verdict, confidence }: { verdict?: string; confidence?: number }) {
  if (!verdict) return <span className="text-xs text-[#8b7355]">Pending</span>;
  const map: Record<string, { bg: string; text: string; border: string }> = {
    GO: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    HOLD: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    PASS: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  };
  const style = map[verdict] ?? { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" };
  return (
    <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold", style.bg, style.text, style.border)}>
      {verdict === "GO" && <CheckCircle2 className="w-3 h-3" />}
      {verdict === "HOLD" && <AlertTriangle className="w-3 h-3" />}
      {verdict === "PASS" && <XCircle className="w-3 h-3" />}
      {verdict}
      {confidence != null && <span className="opacity-70">· {Math.round(confidence * 100)}%</span>}
    </div>
  );
}

function ConsensusDashboard({ dealId }: { dealId: number }) {
  const { toast } = useToast();
  const { data: consensusData, refetch } = trpc.agents.getConsensusScore.useQuery({ dealId }, { enabled: !!dealId });
  const runConsensus = trpc.agents.consensusScore.useMutation({
    onSuccess: () => { toast({ title: "Consensus scoring complete" }); refetch(); },
    onError: (e) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const models = [
    { key: "claudeScore", label: "Claude", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
    { key: "geminiScore", label: "Gemini", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
    { key: "sonarScore", label: "Sonar", color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
  ];

  const cs = consensusData;
  const toNum = (v: any) => v == null ? null : parseFloat(String(v));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-[#8b7355] uppercase tracking-wider mb-0.5">IC Consensus</div>
          <div className="text-sm font-semibold text-[#1a1208]">Model Vote</div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs border-[#e8e0d4] hover:border-[#ffba20] hover:bg-[#fffdf7]"
          onClick={() => runConsensus.mutate({ dealId })}
          disabled={runConsensus.isPending}
        >
          {runConsensus.isPending ? "Scoring..." : "Run Consensus"}
        </Button>
      </div>

      {cs ? (
        <>
          {/* Consensus score */}
          <div className="p-4 bg-[#faf7f2] border border-[#e8e0d4] rounded-xl text-center">
            <div className="text-xs font-medium text-[#8b7355] uppercase tracking-wider mb-2">Consensus Score</div>
            <div className="font-mono text-3xl font-bold text-[#1a1208]">
              {toNum(cs.consensusScore)?.toFixed(3) ?? "—"}
            </div>
            {cs.divergenceFlag && (
              <div className="mt-2 flex items-center justify-center gap-1 text-xs text-amber-600">
                <AlertTriangle className="w-3 h-3" />
                Models diverged ({Math.round((toNum(cs.divergenceScore) ?? 0) * 100)}%)
              </div>
            )}
          </div>

          {/* Model votes */}
          <div className="space-y-2">
            {models.map(({ key, label, color, bg, border }) => {
              const score = toNum((cs as any)[key]);
              const verdict = (cs as any)[`${key.replace("Score", "")}Verdict`] ?? (score != null ? (score >= 0.7 ? "GO" : score >= 0.5 ? "HOLD" : "PASS") : null);
              return (
                <div key={key} className={cn("flex items-center justify-between p-2.5 rounded-lg border", bg, border)}>
                  <span className={cn("text-xs font-semibold", color)}>{label}</span>
                  <div className="flex items-center gap-2">
                    {score != null && <span className="font-mono text-xs text-[#3d2e1e]">{score.toFixed(3)}</span>}
                    <VerdictChip verdict={verdict} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Synthesis */}
              {cs.model1Rationale && (
                <div className="p-3 bg-white border border-[#e8e0d4] rounded-lg">
                  <div className="text-xs font-medium text-[#8b7355] mb-1.5">Synthesis</div>
                  <p className="text-xs text-[#3d2e1e] leading-relaxed">{String(cs.model1Rationale)}</p>
                </div>
              )}
        </>
      ) : (
        <div className="text-center py-8 border border-dashed border-[#e8e0d4] rounded-xl">
          <span className="material-symbols-outlined text-[28px] text-[#c4b49a] block mb-2">how_to_vote</span>
          <div className="text-sm text-[#8b7355]">No consensus data yet</div>
          <div className="text-xs text-[#c4b49a] mt-1">Run consensus scoring to see model votes</div>
        </div>
      )}
    </div>
  );
}

export default function ICReview() {
  const params = useParams<{ id: string }>();
  const dealId = Number(params.id);
  const [activeSection, setActiveSection] = useState("thesis");

  const { data, isLoading } = trpc.deals.getById.useQuery({ id: dealId });

  const toNum = (v: any) => v == null ? null : parseFloat(String(v));
  const fmt = (n: any, prefix = "$") => {
    const v = toNum(n);
    if (v == null || isNaN(v)) return "—";
    if (v >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `${prefix}${(v / 1_000).toFixed(0)}k`;
    return `${prefix}${v}`;
  };
  const pct = (n: any) => { const v = toNum(n); return v == null ? "—" : `${Math.round(v * 100)}%`; };

  if (isLoading) {
    return (
      <EditorialTopNav>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </EditorialTopNav>
    );
  }

  if (!data) {
    return (
      <EditorialTopNav>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground/20 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">Deal not found</p>
          <Link href="/scan">
            <Button variant="outline" size="sm" className="mt-4">
              <ArrowLeft className="w-3 h-3 mr-1.5" /> Back to Scan
            </Button>
          </Link>
        </div>
      </EditorialTopNav>
    );
  }

  const { deal, signal, memo } = data;
  const score = toNum(deal.score);

  const dscr = deal.cashFlow && deal.askingPrice
    ? (toNum(deal.cashFlow)! / (toNum(deal.askingPrice)! * 0.065))
    : null;

  const multiple = deal.cashFlow && deal.askingPrice
    ? (toNum(deal.askingPrice)! / toNum(deal.cashFlow)!)
    : toNum(deal.multiple);

  return (
    <EditorialTopNav>
      {/* Back nav */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/deal/${dealId}`}>
          <Button variant="ghost" size="sm" className="h-8 text-xs text-[#8b7355] hover:text-[#1a1208] -ml-2">
            <ArrowLeft className="w-3 h-3 mr-1.5" />
            Back to Dossier
          </Button>
        </Link>
        <span className="text-[#c4b49a] text-xs">·</span>
        <span className="text-xs font-medium text-[#8b7355] uppercase tracking-wider">IC Review</span>
      </div>

      {/* Article header */}
      <motion.div {...fadeUp} className="mb-8">
        <div className="text-xs font-mono font-bold text-[#ffba20] uppercase tracking-widest mb-3">
          Investment Committee · Confidential
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-normal text-[#1a1208] leading-tight mb-3" style={{ fontFamily: "var(--font-display, 'Fraunces', serif)" }}>
          {deal.name}
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          {deal.industry && <span className="text-sm text-[#8b7355]">{deal.industry}</span>}
          {deal.location && (
            <>
              <span className="text-[#c4b49a]">·</span>
              <span className="text-sm text-[#8b7355]">{deal.location}</span>
            </>
          )}
          <span className="text-[#c4b49a]">·</span>
          <span className="text-sm font-mono font-bold text-[#1a1208]">
            Score: {score != null ? score.toFixed(3) : "—"}
          </span>
          <Badge variant="outline" className="text-xs border-[#e8e0d4] text-[#8b7355] capitalize">
            {deal.stage.replace(/_/g, " ")}
          </Badge>
        </div>
        {/* Rule */}
        <div className="mt-4 h-px bg-gradient-to-r from-[#ffba20]/40 via-[#e8e0d4] to-transparent" />
      </motion.div>

      {/* Editorial 2-column layout */}
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">

        {/* Main content */}
        <div className="space-y-8">

          {/* Section nav */}
          <div className="flex gap-4 border-b border-[#e8e0d4] pb-0">
            {["thesis", "financials", "risk", "structure"].map((s) => (
              <button
                key={s}
                onClick={() => setActiveSection(s)}
                className={cn(
                  "pb-3 text-sm font-medium border-b-2 -mb-px transition-colors capitalize",
                  activeSection === s
                    ? "border-[#ffba20] text-[#1a1208]"
                    : "border-transparent text-[#8b7355] hover:text-[#1a1208]"
                )}
              >
                {s === "thesis" ? "Investment Thesis" : s === "financials" ? "Financials" : s === "risk" ? "Risk Matrix" : "Deal Structure"}
              </button>
            ))}
          </div>

          {/* Investment Thesis */}
          {activeSection === "thesis" && (
            <motion.div {...fadeUp} className="space-y-6">
              {/* Gutter note */}
              <GutterNote type="insight">
                AI analysis based on {deal.industry ?? "industry"} comparables and current SBA 7(a) lending conditions.
              </GutterNote>

              {/* Thesis body */}
              <div className="prose prose-sm max-w-none">
                <h2 className="text-lg font-semibold text-[#1a1208] mb-3" style={{ fontFamily: "var(--font-display, 'Fraunces', serif)" }}>
                  Executive Summary
                </h2>
                {memo?.content ? (
                  <div className="text-sm text-[#3d2e1e] leading-relaxed whitespace-pre-wrap">
                    {String(memo.content).split('\n').slice(0, 8).join('\n')}
                  </div>
                ) : (
                  <div className="space-y-3 text-sm text-[#3d2e1e] leading-relaxed">
                    <p>
                      <strong>{deal.name}</strong> represents a {deal.industry ?? "service business"} acquisition opportunity
                      {deal.location ? ` in ${deal.location}` : ""} with an asking price of {fmt(deal.askingPrice)}.
                      {deal.cashFlow ? ` The business generates ${fmt(deal.cashFlow)} in annual cash flow,` : ""}
                      {multiple ? ` implying a ${multiple.toFixed(1)}x EBITDA multiple.` : "."}
                    </p>
                    {deal.description && (
                      <p>{deal.description}</p>
                    )}
                    <p>
                      The deal {score != null && score >= 0.7 ? "meets" : "partially meets"} our acquisition criteria
                      with a composite SCORER rating of <strong>{score?.toFixed(3) ?? "—"}</strong>.
                      {dscr != null ? ` Estimated DSCR of ${dscr.toFixed(2)}x ${dscr >= 1.25 ? "satisfies" : "falls below"} SBA 7(a) threshold.` : ""}
                    </p>
                  </div>
                )}
              </div>

              {/* Key metrics strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Revenue", value: fmt(deal.revenue), icon: TrendingUp },
                  { label: "Cash Flow", value: fmt(deal.cashFlow), icon: DollarSign },
                  { label: "Asking Price", value: fmt(deal.askingPrice), icon: Building2 },
                  { label: "Employees", value: deal.employees ? String(deal.employees) : "—", icon: Users },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="p-3 bg-[#faf7f2] border border-[#e8e0d4] rounded-lg">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Icon className="w-3 h-3 text-[#8b7355]" />
                      <span className="text-xs font-medium text-[#8b7355] uppercase tracking-wider">{label}</span>
                    </div>
                    <div className="font-mono text-lg font-bold text-[#1a1208]">{value}</div>
                  </div>
                ))}
              </div>

              {/* Signal analysis */}
              {signal && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-[#1a1208]" style={{ fontFamily: "var(--font-display, 'Fraunces', serif)" }}>
                    Third Signal Intelligence
                  </h3>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="p-3 bg-white border border-[#e8e0d4] rounded-lg">
                      <div className="text-xs font-medium text-[#8b7355] mb-1">Owner Distress</div>
                      <div className="font-mono text-lg font-bold text-[#1a1208]">{pct(signal.ownerDistressScore)}</div>
                    </div>
                    <div className="p-3 bg-white border border-[#e8e0d4] rounded-lg">
                      <div className="text-xs font-medium text-[#8b7355] mb-1">Digital Alpha</div>
                      <div className="font-mono text-lg font-bold text-[#1a1208]">{pct((signal as any).digitalAlphaScore)}</div>
                    </div>
                    <div className="p-3 bg-white border border-[#e8e0d4] rounded-lg">
                      <div className="text-xs font-medium text-[#8b7355] mb-1">Negotiation Style</div>
                      <div className="text-sm font-semibold text-[#1a1208] capitalize">{signal.ownerNegotiationStyle ?? "—"}</div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Financials */}
          {activeSection === "financials" && (
            <motion.div {...fadeUp} className="space-y-6">
              <GutterNote type="insight">
                Financial ratios benchmarked against SBA 7(a) underwriting standards. DSCR threshold: 1.25x.
              </GutterNote>
              <h2 className="text-lg font-semibold text-[#1a1208]" style={{ fontFamily: "var(--font-display, 'Fraunces', serif)" }}>
                Financial Summary
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e8e0d4]">
                      <th className="text-left py-2 text-xs font-medium text-[#8b7355] uppercase tracking-wider">Metric</th>
                      <th className="text-right py-2 text-xs font-medium text-[#8b7355] uppercase tracking-wider">Value</th>
                      <th className="text-right py-2 text-xs font-medium text-[#8b7355] uppercase tracking-wider">Benchmark</th>
                      <th className="text-right py-2 text-xs font-medium text-[#8b7355] uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0ebe3]">
                    {[
                      { metric: "Revenue", value: fmt(deal.revenue), benchmark: "> $1M", pass: toNum(deal.revenue) != null && toNum(deal.revenue)! >= 1_000_000 },
                      { metric: "Cash Flow (SDE)", value: fmt(deal.cashFlow), benchmark: "> $200k", pass: toNum(deal.cashFlow) != null && toNum(deal.cashFlow)! >= 200_000 },
                      { metric: "EBITDA Multiple", value: multiple != null ? `${multiple.toFixed(1)}x` : "—", benchmark: "< 5x", pass: multiple != null && multiple < 5 },
                      { metric: "Est. DSCR", value: dscr != null ? dscr.toFixed(2) + "x" : "—", benchmark: "≥ 1.25x", pass: dscr != null && dscr >= 1.25 },
                      { metric: "Asking Price", value: fmt(deal.askingPrice), benchmark: "< $5M", pass: toNum(deal.askingPrice) != null && toNum(deal.askingPrice)! < 5_000_000 },
                      { metric: "Employees", value: deal.employees ? String(deal.employees) : "—", benchmark: "< 50", pass: deal.employees != null && deal.employees < 50 },
                    ].map(({ metric, value, benchmark, pass }) => (
                      <tr key={metric} className="hover:bg-[#faf7f2] transition-colors">
                        <td className="py-2.5 font-medium text-[#1a1208]">{metric}</td>
                        <td className="py-2.5 text-right font-mono text-[#1a1208]">{value}</td>
                        <td className="py-2.5 text-right text-[#8b7355]">{benchmark}</td>
                        <td className="py-2.5 text-right">
                          {value === "—" ? (
                            <span className="text-xs text-[#c4b49a]">N/A</span>
                          ) : pass ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-500 ml-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Risk Matrix */}
          {activeSection === "risk" && (
            <motion.div {...fadeUp} className="space-y-6">
              {signal?.redFlags && (
                <GutterNote type="warning">
                  {String(signal.redFlags).split(',').length} red flag{String(signal.redFlags).split(',').length !== 1 ? "s" : ""} identified by the SCORER model.
                </GutterNote>
              )}
              <h2 className="text-lg font-semibold text-[#1a1208]" style={{ fontFamily: "var(--font-display, 'Fraunces', serif)" }}>
                Risk Assessment
              </h2>
              {signal?.redFlags ? (
                <div className="space-y-2">
                  {String(signal.redFlags).split(',').filter(Boolean).map((flag, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                      <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <span className="text-sm text-red-800">{flag.trim()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 border border-dashed border-[#e8e0d4] rounded-xl">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <div className="text-sm text-[#8b7355]">No red flags identified</div>
                  <div className="text-xs text-[#c4b49a] mt-1">Run Third Signal analysis to generate risk flags</div>
                </div>
              )}

              {/* Risk dimensions from SCORER */}
              {(deal as any).scoreDimensions && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-[#1a1208]">SCORER Dimension Breakdown</h3>
                  <div className="space-y-2">
                    {Object.entries((deal as any).scoreDimensions as Record<string, number>).map(([dim, val]) => (
                      <div key={dim} className="flex items-center gap-3">
                        <div className="w-32 text-xs text-[#8b7355] capitalize">{dim.replace(/_/g, " ")}</div>
                        <div className="flex-1 h-1.5 bg-[#f0ebe3] rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", val >= 0.7 ? "bg-emerald-400" : val >= 0.5 ? "bg-amber-400" : "bg-red-400")}
                            style={{ width: `${val * 100}%` }}
                          />
                        </div>
                        <div className="w-12 text-right font-mono text-xs text-[#3d2e1e]">{(val * 100).toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Deal Structure */}
          {activeSection === "structure" && (
            <motion.div {...fadeUp} className="space-y-6">
              <GutterNote type="insight">
                SBA 7(a) structure assumes 10% equity injection, 90% bank financing at current prime + 2.75%.
              </GutterNote>
              <h2 className="text-lg font-semibold text-[#1a1208]" style={{ fontFamily: "var(--font-display, 'Fraunces', serif)" }}>
                Proposed Capital Structure
              </h2>
              {deal.askingPrice ? (
                <div className="space-y-3">
                  {[
                    { label: "SBA 7(a) Loan (90%)", value: fmt(toNum(deal.askingPrice)! * 0.9), color: "bg-blue-400" },
                    { label: "Equity Injection (10%)", value: fmt(toNum(deal.askingPrice)! * 0.1), color: "bg-[#ffba20]" },
                    { label: "Seller Note (0%)", value: "$0", color: "bg-[#e8e0d4]" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center gap-4 p-3 bg-[#faf7f2] border border-[#e8e0d4] rounded-lg">
                      <div className={cn("w-2 h-8 rounded-full", color)} />
                      <div className="flex-1">
                        <div className="text-xs text-[#8b7355]">{label}</div>
                        <div className="font-mono text-base font-bold text-[#1a1208]">{value}</div>
                      </div>
                    </div>
                  ))}
                  <div className="p-3 bg-[#1a1208] text-white rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium opacity-70">Total Acquisition Cost</span>
                      <span className="font-mono text-lg font-bold">{fmt(deal.askingPrice)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 border border-dashed border-[#e8e0d4] rounded-xl">
                  <DollarSign className="w-8 h-8 text-[#c4b49a] mx-auto mb-2" />
                  <div className="text-sm text-[#8b7355]">No asking price set</div>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Right aside — Consensus Dashboard */}
        <div className="space-y-4">
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="sticky top-4 p-4 bg-[#faf7f2] border border-[#e8e0d4] rounded-xl"
          >
            <ConsensusDashboard dealId={dealId} />
          </motion.div>

          {/* Quick links */}
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="p-4 bg-white border border-[#e8e0d4] rounded-xl space-y-2"
          >
            <div className="text-xs font-medium text-[#8b7355] uppercase tracking-wider mb-3">Quick Links</div>
            <Link href={`/deal/${dealId}`}>
              <Button variant="outline" size="sm" className="w-full justify-start h-8 text-xs border-[#e8e0d4] text-[#3d2e1e] hover:border-[#ffba20]">
                <span className="material-symbols-outlined text-[14px] mr-2">description</span>
                Intelligence Dossier
              </Button>
            </Link>
            <Link href={`/behavioral/${dealId}`}>
              <Button variant="outline" size="sm" className="w-full justify-start h-8 text-xs border-[#e8e0d4] text-[#3d2e1e] hover:border-[#ffba20]">
                <span className="material-symbols-outlined text-[14px] mr-2">psychology</span>
                Behavioral Profile
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </EditorialTopNav>
  );
}
