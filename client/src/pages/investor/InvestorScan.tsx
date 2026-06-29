import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Search, MapPin, Building2, TrendingUp, Clock, Lock, Send, CheckCircle, AlertCircle, Loader2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const INDUSTRY_OPTIONS = [
  "Commercial Cleaning", "Logistics & Delivery", "Healthcare Staffing",
  "B2B Services", "Government Contracts", "HVAC / Mechanical",
  "Pest Control", "Landscaping", "Security Services", "Staffing Agency",
];

const LOCATION_PRESETS = [
  { label: "Miami, FL", value: "Miami, FL" },
  { label: "Fort Lauderdale, FL", value: "Fort Lauderdale, FL" },
  { label: "Boca Raton, FL", value: "Boca Raton, FL" },
  { label: "West Palm Beach, FL", value: "West Palm Beach, FL" },
  { label: "Orlando, FL", value: "Orlando, FL" },
];

function scoreColor(score: number) {
  if (score >= 0.8) return "oklch(0.72 0.19 142)";
  if (score >= 0.65) return "oklch(0.78 0.18 75)";
  return "oklch(0.65 0.18 25)";
}

export default function InvestorScan() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [locations, setLocations] = useState(["Miami, FL", "Fort Lauderdale, FL"]);
  const [locationInput, setLocationInput] = useState("");
  const [industries, setIndustries] = useState<string[]>([]);
  const [minRevenue, setMinRevenue] = useState(500000);
  const [maxAsking, setMaxAsking] = useState(5000000);
  const [requestedInterest, setRequestedInterest] = useState<Set<number>>(new Set<number>());

  // Investor sees the public deal list (no AI scoring trigger)
  const { data: dealsData, isLoading } = trpc.deals.list.useQuery({
    limit: 50,
  });

  // Express interest mutation (sends to operator for approval)
  const expressInterest = trpc.investor.expressInterest.useMutation({
    onSuccess: (_, vars) => {
      setRequestedInterest(prev => { const next = new Set(Array.from(prev)); next.add(vars.dealId); return next; });
      toast({
        title: "Interest Submitted",
        description: "The operator will run AI analysis and share results with you.",
      });
    },
  });

  const deals = (dealsData as any[]) ?? [];
  const filteredDeals = deals.filter((d: any) => {
    if (industries.length > 0 && !industries.some(i => d.industry?.toLowerCase().includes(i.toLowerCase()))) return false;
    if (d.revenue && d.revenue < minRevenue) return false;
    if (d.asking && d.asking > maxAsking) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--sh-fg-1)" }}>
            Market Scan
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--sh-fg-3)" }}>
            Browse active acquisition opportunities. Express interest to request AI analysis from the operator.
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
      <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--sh-surface-1)", border: "1px solid var(--sh-border-1)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4" style={{ color: "var(--sh-primary)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--sh-fg-1)" }}>Scan Filters</span>
        </div>

        {/* Location chips */}
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: "var(--sh-fg-3)" }}>Target Markets</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {locations.map(loc => (
              <button
                key={loc}
                onClick={() => setLocations(prev => prev.filter(l => l !== loc))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: "oklch(0.55 0.18 280 / 0.15)", color: "oklch(0.75 0.18 280)", border: "1px solid oklch(0.55 0.18 280 / 0.3)" }}
              >
                <MapPin className="w-3 h-3" />
                {loc}
                <span className="ml-0.5 opacity-60">×</span>
              </button>
            ))}
            {LOCATION_PRESETS.filter(p => !locations.includes(p.value)).map(p => (
              <button
                key={p.value}
                onClick={() => setLocations(prev => [...prev, p.value])}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-3)", border: "1px solid var(--sh-border-1)" }}
              >
                + {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add custom market..."
              value={locationInput}
              onChange={e => setLocationInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && locationInput.trim()) {
                  setLocations(prev => [...prev, locationInput.trim()]);
                  setLocationInput("");
                }
              }}
              className="h-8 text-xs max-w-[200px]"
            />
          </div>
        </div>

        {/* Industry chips */}
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: "var(--sh-fg-3)" }}>Industries</p>
          <div className="flex flex-wrap gap-2">
            {INDUSTRY_OPTIONS.map(ind => {
              const active = industries.includes(ind);
              return (
                <button
                  key={ind}
                  onClick={() => setIndustries(prev => active ? prev.filter(i => i !== ind) : [...prev, ind])}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: active ? "oklch(0.55 0.18 280 / 0.15)" : "var(--sh-surface-2)",
                    color: active ? "oklch(0.75 0.18 280)" : "var(--sh-fg-3)",
                    border: `1px solid ${active ? "oklch(0.55 0.18 280 / 0.3)" : "var(--sh-border-1)"}`,
                  }}
                >
                  {ind}
                </button>
              );
            })}
          </div>
        </div>

        {/* Revenue / Asking range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: "var(--sh-fg-3)" }}>Min Revenue</p>
            <select
              value={minRevenue}
              onChange={e => setMinRevenue(Number(e.target.value))}
              className="w-full h-8 rounded-lg px-2 text-xs"
              style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-2)", border: "1px solid var(--sh-border-1)" }}
            >
              {[250000, 500000, 1000000, 2000000, 5000000].map(v => (
                <option key={v} value={v}>${(v / 1000).toFixed(0)}K+</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: "var(--sh-fg-3)" }}>Max Asking</p>
            <select
              value={maxAsking}
              onChange={e => setMaxAsking(Number(e.target.value))}
              className="w-full h-8 rounded-lg px-2 text-xs"
              style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-2)", border: "1px solid var(--sh-border-1)" }}
            >
              {[1000000, 2500000, 5000000, 10000000, 25000000].map(v => (
                <option key={v} value={v}>Under ${(v / 1000000).toFixed(1)}M</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--sh-primary)" }} />
        </div>
      ) : filteredDeals.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--sh-fg-4)" }}>
          <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No deals match your current filters</p>
          <p className="text-xs mt-1">Try adjusting your market or industry selections</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-medium" style={{ color: "var(--sh-fg-4)" }}>
            {filteredDeals.length} opportunities found
          </p>
          {filteredDeals.map((deal: any) => {
            const hasInterest = requestedInterest.has(deal.id);
            const score = deal.aiScore ?? 0;
            return (
              <div
                key={deal.id}
                className="rounded-2xl p-5 transition-all"
                style={{ background: "var(--sh-surface-1)", border: "1px solid var(--sh-border-1)" }}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-sm font-bold truncate" style={{ color: "var(--sh-fg-1)" }}>{deal.name}</h3>
                      {deal.opportunityZone && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "oklch(0.72 0.19 142 / 0.15)", color: "oklch(0.72 0.19 142)" }}>OZ</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs" style={{ color: "var(--sh-fg-3)" }}>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{deal.location ?? "South Florida"}</span>
                      {deal.industry && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{deal.industry}</span>}
                    </div>
                  </div>
                  {score > 0 ? (
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--sh-fg-4)" }}>AI Score</p>
                      <p className="text-xl font-black font-mono" style={{ color: scoreColor(score) }}>{score.toFixed(3)}</p>
                    </div>
                  ) : (
                    <div
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                      style={{ background: "oklch(0.55 0.18 280 / 0.08)", color: "var(--sh-fg-4)", border: "1px solid var(--sh-border-1)" }}
                    >
                      <Lock className="w-3 h-3" />
                      Score pending
                    </div>
                  )}
                </div>

                {/* Financial grid */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "Revenue", value: deal.revenue ? `$${(deal.revenue / 1000000).toFixed(1)}M` : "—" },
                    { label: "Cash Flow", value: deal.cashFlow ? `$${(deal.cashFlow / 1000).toFixed(0)}K` : "—" },
                    { label: "Asking", value: deal.asking ? `$${(deal.asking / 1000000).toFixed(1)}M` : "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl p-3 text-center" style={{ background: "var(--sh-surface-2)" }}>
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
                    Interest Submitted — Awaiting Analysis
                  </div>
                ) : (
                  <Button
                    className="w-full h-10 text-sm font-semibold"
                    onClick={() => expressInterest.mutate({ dealId: deal.id, allocationAmount: 0, investorNote: "Requesting AI analysis" })}
                    disabled={expressInterest.isPending}
                    style={{ background: "var(--sh-primary)", color: "var(--sh-primary-fg)" }}
                  >
                    {expressInterest.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Request AI Analysis
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
