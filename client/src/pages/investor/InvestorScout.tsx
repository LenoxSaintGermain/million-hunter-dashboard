import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Building2, MapPin, Lock, Send, CheckCircle, Loader2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import InvestorLayout from "@/components/InvestorLayout";

const PROPERTY_TYPES = ["Retail", "Industrial", "Office", "Mixed Use", "Multifamily", "Land"];

function capRateColor(rate: number) {
  if (rate >= 7) return "oklch(0.72 0.19 142)";
  if (rate >= 5) return "oklch(0.78 0.18 75)";
  return "oklch(0.65 0.18 25)";
}

export default function InvestorScout() {
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [ozOnly, setOzOnly] = useState(false);
  const [requestedInterest, setRequestedInterest] = useState<Set<number>>(new Set<number>());

  const { data: assets, isLoading } = trpc.scout.list.useQuery({});

  const expressInterest = trpc.investor.expressInterest.useMutation({
    onSuccess: (_, vars) => {
      setRequestedInterest(prev => { const next = new Set(Array.from(prev)); next.add(vars.dealId); return next; });
      toast.success("Interest submitted — the operator will review and share analysis with you.");
    },
    onError: (e) => toast.error(`Failed to submit interest: ${e.message}`),
  });

  const filtered = (assets ?? []).filter((a: any) => {
    if (typeFilter.length > 0 && !typeFilter.includes(a.propertyType)) return false;
    if (ozOnly && !a.opportunityZone) return false;
    return true;
  });

  return (
    <InvestorLayout>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--sh-fg-1)" }}>Asset Scout</h1>
          <p className="text-sm mt-1" style={{ color: "var(--sh-fg-3)" }}>
            Commercial real estate signals in your target markets. Express interest to request operator analysis.
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
          style={{ background: "oklch(0.55 0.18 280 / 0.12)", color: "oklch(0.75 0.18 280)", border: "1px solid oklch(0.55 0.18 280 / 0.2)" }}
        >
          <Lock className="w-3.5 h-3.5" />
          AI scoring requires operator approval
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl p-4 flex flex-wrap items-center gap-3" style={{ background: "var(--sh-surface-1)", border: "1px solid var(--sh-border-1)" }}>
        <Filter className="w-4 h-4 shrink-0" style={{ color: "var(--sh-fg-4)" }} />
        {PROPERTY_TYPES.map(t => {
          const active = typeFilter.includes(t);
          return (
            <button
              key={t}
              onClick={() => setTypeFilter(prev => active ? prev.filter(x => x !== t) : [...prev, t])}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: active ? "oklch(0.55 0.18 280 / 0.15)" : "var(--sh-surface-2)",
                color: active ? "oklch(0.75 0.18 280)" : "var(--sh-fg-3)",
                border: `1px solid ${active ? "oklch(0.55 0.18 280 / 0.3)" : "var(--sh-border-1)"}`,
              }}
            >{t}</button>
          );
        })}
        <button
          onClick={() => setOzOnly(!ozOnly)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: ozOnly ? "oklch(0.72 0.19 142 / 0.15)" : "var(--sh-surface-2)",
            color: ozOnly ? "oklch(0.72 0.19 142)" : "var(--sh-fg-3)",
            border: `1px solid ${ozOnly ? "oklch(0.72 0.19 142 / 0.3)" : "var(--sh-border-1)"}`,
          }}
        >🟢 OZ Only</button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--sh-primary)" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--sh-fg-4)" }}>
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No assets match your filters</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((asset: any) => {
            const hasInterest = requestedInterest.has(asset.id);
            const capRate = Number(asset.capRate ?? 0);
            return (
              <div
                key={asset.id}
                className="rounded-2xl p-5 flex flex-col gap-4 transition-all"
                style={{ background: "var(--sh-surface-1)", border: "1px solid var(--sh-border-1)" }}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-sm font-bold" style={{ color: "var(--sh-fg-1)" }}>{asset.name}</h3>
                      {asset.opportunityZone && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "oklch(0.72 0.19 142 / 0.15)", color: "oklch(0.72 0.19 142)" }}>OZ</span>
                      )}
                      {asset.tadDistrict && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "oklch(0.72 0.19 230 / 0.15)", color: "oklch(0.72 0.19 230)" }}>TAD</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs" style={{ color: "var(--sh-fg-3)" }}>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{asset.city && asset.state ? `${asset.city}, ${asset.state}` : (asset.city ?? asset.state ?? "Location TBD")}</span>
                      {asset.propertyType && (
                        <span className="px-1.5 py-0.5 rounded" style={{ background: "var(--sh-surface-2)" }}>{asset.propertyType}</span>
                      )}
                    </div>
                  </div>
                  {capRate > 0 && (
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--sh-fg-4)" }}>Cap Rate</p>
                      <p className="text-xl font-black font-mono" style={{ color: capRateColor(capRate) }}>{capRate.toFixed(1)}%</p>
                    </div>
                  )}
                </div>

                {/* Financial grid */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Asking", value: asset.askingPrice ? `$${(Number(asset.askingPrice) / 1000000).toFixed(1)}M` : "—" },
                    { label: "NOI", value: asset.noi ? `$${(Number(asset.noi) / 1000).toFixed(0)}K` : "—" },
                    { label: "Sq Ft", value: asset.squareFootage ? `${(Number(asset.squareFootage) / 1000).toFixed(0)}K` : "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl p-2.5 text-center" style={{ background: "var(--sh-surface-2)" }}>
                      <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--sh-fg-4)" }}>{label}</p>
                      <p className="text-sm font-black font-mono" style={{ color: "var(--sh-fg-1)" }}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Action */}
                {hasInterest ? (
                  <div
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: "oklch(0.72 0.19 142 / 0.1)", color: "oklch(0.72 0.19 142)", border: "1px solid oklch(0.72 0.19 142 / 0.2)" }}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Interest Submitted
                  </div>
                ) : (
                  <Button
                    className="w-full h-9 text-sm font-semibold"
                    onClick={() => expressInterest.mutate({ dealId: asset.id, allocationAmount: 0, investorNote: "Requesting analysis on commercial asset" })}
                    disabled={expressInterest.isPending}
                    style={{ background: "var(--sh-primary)", color: "var(--sh-primary-fg)" }}
                  >
                    <Send className="w-3.5 h-3.5 mr-2" />
                    Request Analysis
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    </InvestorLayout>
  );
}
