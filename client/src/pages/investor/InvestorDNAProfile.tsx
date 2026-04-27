import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import InvestorLayout from "@/components/InvestorLayout";
import DNACard from "@/components/investor/DNACard";
import { Button } from "@/components/ui/button";
import { RefreshCw, Zap, TrendingUp, Shield, Clock } from "lucide-react";

// ─── Archetype meta (mirrors DNACard) ─────────────────────────────────────────
const ARCHETYPES: Record<string, { label: string; tagline: string; color: string; glyph: string; description: string; traits: string[] }> = {
  "ALPHA-7": {
    label: "Alpha Hunter",
    tagline: "You hunt asymmetric returns.",
    color: "var(--sh-signal)",
    glyph: "⚡",
    description: "High conviction, long horizon, high risk tolerance. You see deals others miss and move fast when the signal is clear. You're built for the concentrated bet — the kind that changes your financial trajectory.",
    traits: ["Concentrated positions", "Operator-friendly", "5–10 year holds", "High IRR targets"],
  },
  "IMPACT-4": {
    label: "Impact Allocator",
    tagline: "Returns with a reason.",
    color: "#a78bfa",
    glyph: "🌱",
    description: "You want your capital to compound AND create change. You prioritize businesses that build community wealth alongside financial returns.",
    traits: ["ESG-aligned deals", "Community impact", "Patient capital", "Mission-driven operators"],
  },
  "COMPOUNDER-9": {
    label: "Long Compounder",
    tagline: "Slow money, deep roots.",
    color: "var(--sh-amber)",
    glyph: "🌳",
    description: "You think in decades. You lock capital into durable cash-flowing businesses and let compounding do the work. Patience is your edge.",
    traits: ["Long-duration holds", "Cash flow focus", "Low turnover", "Generational wealth"],
  },
  "SPRINT-3": {
    label: "Sprint Allocator",
    tagline: "Fast in, faster out.",
    color: "var(--sh-red)",
    glyph: "🚀",
    description: "You want velocity. Short holds, clear exits, and a deal flow that keeps your capital working without waiting.",
    traits: ["2–3 year exits", "High IRR focus", "Active portfolio management", "Quick deployment"],
  },
  "ANCHOR-1": {
    label: "Steady Anchor",
    tagline: "Steady, reliable, compounding.",
    color: "#34d399",
    glyph: "⚓",
    description: "You value stability over excitement. You want predictable cash flow from proven businesses with low operational risk.",
    traits: ["Stable cash flow", "Low volatility", "Diversified exposure", "Capital preservation"],
  },
};

// ─── Stat chip ────────────────────────────────────────────────────────────────
function StatChip({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl p-4" style={{ background: "var(--sh-surface-1)", border: "1px solid var(--sh-border)" }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--sh-fg-4)" }}>{label}</p>
        <p className="text-sm font-black font-mono" style={{ color: "var(--sh-fg-1)" }}>{value}</p>
      </div>
    </div>
  );
}

export default function InvestorDNAProfile() {
  const [, navigate] = useLocation();
  const [showRetakeConfirm, setShowRetakeConfirm] = useState(false);
  const { data: dna, isLoading } = trpc.investor.getDnaStatus.useQuery();

  if (isLoading) {
    return (
      <InvestorLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-full mx-auto animate-pulse" style={{ background: "var(--sh-surface-2)" }} />
            <p className="text-sm" style={{ color: "var(--sh-fg-3)" }}>Loading your DNA profile…</p>
          </div>
        </div>
      </InvestorLayout>
    );
  }

  // No DNA yet — redirect to onboarding
  if (!dna?.quizCompleted || !dna.archetypeCode) {
    return (
      <InvestorLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-6 max-w-sm">
            <div className="text-5xl">🧬</div>
            <div>
              <h2 className="text-xl font-black mb-2" style={{ color: "var(--sh-fg-1)" }}>No DNA Profile Yet</h2>
              <p className="text-sm" style={{ color: "var(--sh-fg-3)" }}>
                Complete the 5-step Investor DNA quiz to unlock your personalized deal feed and archetype profile.
              </p>
            </div>
            <Button
              onClick={() => navigate("/investor/onboarding")}
              className="w-full font-bold"
              style={{ background: "var(--sh-signal)", color: "#000" }}
            >
              Build My DNA Profile →
            </Button>
          </div>
        </div>
      </InvestorLayout>
    );
  }

  const archMeta = ARCHETYPES[dna.archetypeCode] ?? ARCHETYPES["ALPHA-7"];
  const sectors: string[] = (dna as any).sectorAffinity ?? [];
  const riskPct = Math.round(((dna as any).riskTolerance ?? 0.7) * 100);
  const horizonPct = Math.round(((dna as any).timeHorizon ?? 0.7) * 100);
  const illiqPct = Math.round((1 - ((dna as any).liquidityNeed ?? 0.3)) * 100);

  return (
    <InvestorLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{archMeta.glyph}</span>
              <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: archMeta.color }}>
                Investor DNA · {dna.archetypeCode}
              </p>
            </div>
            <h1 className="text-3xl font-black" style={{ color: "var(--sh-fg-1)" }}>{archMeta.label}</h1>
            <p className="text-base italic mt-1" style={{ color: "var(--sh-fg-3)" }}>{archMeta.tagline}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRetakeConfirm(true)}
            className="shrink-0 gap-2"
            style={{ borderColor: "var(--sh-border)", color: "var(--sh-fg-3)" }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retake Quiz
          </Button>
        </div>

        {/* Retake confirmation */}
        {showRetakeConfirm && (
          <div className="rounded-xl p-4 flex items-center justify-between gap-4" style={{ background: "var(--sh-amber)18", border: "1px solid var(--sh-amber)40" }}>
            <p className="text-sm" style={{ color: "var(--sh-fg-2)" }}>
              Retaking the quiz will update your archetype and personalized deal feed. Your expressed interests are preserved.
            </p>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => setShowRetakeConfirm(false)} style={{ color: "var(--sh-fg-3)" }}>Cancel</Button>
              <Button size="sm" onClick={() => navigate("/investor/onboarding")} style={{ background: "var(--sh-amber)", color: "#000" }}>
                Retake →
              </Button>
            </div>
          </div>
        )}

        {/* Two-column layout: DNA Card + Details */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Full DNA Card */}
          <div className="lg:col-span-2">
            <DNACard />
          </div>

          {/* Right: Archetype detail + stats */}
          <div className="lg:col-span-3 space-y-6">
            {/* Archetype description */}
            <div className="rounded-2xl p-6 space-y-4" style={{ background: "var(--sh-surface-1)", border: "1px solid var(--sh-border)" }}>
              <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: "var(--sh-fg-3)" }}>Archetype Profile</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--sh-fg-2)" }}>{archMeta.description}</p>
              <div className="flex flex-wrap gap-2">
                {archMeta.traits.map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                    style={{ background: `${archMeta.color}18`, color: archMeta.color, border: `1px solid ${archMeta.color}30` }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Stat chips */}
            <div className="grid grid-cols-2 gap-3">
              <StatChip icon={Shield} label="Risk Appetite" value={`${riskPct}%`} color="var(--sh-signal)" />
              <StatChip icon={Clock} label="Time Horizon" value={`${horizonPct}%`} color="var(--sh-amber)" />
              <StatChip icon={TrendingUp} label="Illiquidity Tolerance" value={`${illiqPct}%`} color="#a78bfa" />
              <StatChip icon={Zap} label="Target IRR" value="20%+" color="var(--sh-red)" />
            </div>

            {/* Sector affinity */}
            {sectors.length > 0 && (
              <div className="rounded-2xl p-6 space-y-4" style={{ background: "var(--sh-surface-1)", border: "1px solid var(--sh-border)" }}>
                <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: "var(--sh-fg-3)" }}>Sector Affinity</h3>
                <div className="flex flex-wrap gap-2">
                  {sectors.map((s) => (
                    <span
                      key={s}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                      style={{ background: `${archMeta.color}15`, color: archMeta.color, border: `1px solid ${archMeta.color}25` }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Deal parameters */}
            <div className="rounded-2xl p-6 space-y-4" style={{ background: "var(--sh-surface-1)", border: "1px solid var(--sh-border)" }}>
              <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: "var(--sh-fg-3)" }}>Deal Parameters</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--sh-fg-4)" }}>Deal Range</p>
                  <p className="text-sm font-black font-mono" style={{ color: "var(--sh-fg-1)" }}>$0.5M – $5M</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--sh-fg-4)" }}>Target IRR</p>
                  <p className="text-sm font-black font-mono" style={{ color: archMeta.color }}>20%+</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--sh-fg-4)" }}>Structures</p>
                  <p className="text-sm font-black font-mono" style={{ color: "var(--sh-fg-1)" }}>SBA · Seller Fin.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA row */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={() => navigate("/investor")}
            className="font-bold gap-2"
            style={{ background: "var(--sh-signal)", color: "#000" }}
          >
            <Zap className="w-4 h-4" />
            View My Deal Room
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/investor/scan")}
            style={{ borderColor: "var(--sh-border)", color: "var(--sh-fg-2)" }}
          >
            Run Market Scan
          </Button>
        </div>
      </div>
    </InvestorLayout>
  );
}
