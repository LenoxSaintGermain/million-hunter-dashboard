import { useState, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import {
  Radar,
  Briefcase,
  Building2,
  TrendingUp,
  Search,
  Lock,
  LockOpen,
  ShieldAlert,
  ArrowRight,
  Filter,
  CheckCircle2,
  X,
} from "lucide-react";

// Stage label map
const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  high_priority: { label: "High Priority", color: "#16a34a" },
  qualified: { label: "Qualified", color: "#d97706" },
  new: { label: "New Listing", color: "#6b7280" },
  in_diligence: { label: "In Diligence", color: "#2563eb" },
  loi_sent: { label: "LOI Sent", color: "#7c3aed" },
  active_scan: { label: "Active Radar", color: "#0891b2" },
};

const ASSET_TABS = [
  { id: "all", label: "All Opportunities" },
  { id: "private_mna", label: "Private Buyouts" },
  { id: "commercial_real_estate", label: "Commercial Real Estate" },
  { id: "capital_aperture", label: "Capital Aperture" },
  { id: "deep_research", label: "Deep Research Radar" },
];

function getAssetClassMeta(assetClass: string | undefined) {
  switch (assetClass) {
    case "commercial_real_estate":
      return {
        label: "Commercial Real Estate",
        icon: Building2,
        color: "#2563eb",
        bg: "rgba(37, 99, 235, 0.08)",
        border: "rgba(37, 99, 235, 0.2)",
      };
    case "capital_aperture":
      return {
        label: "Capital Aperture",
        icon: TrendingUp,
        color: "#16a34a",
        bg: "rgba(22, 163, 74, 0.08)",
        border: "rgba(22, 163, 74, 0.2)",
      };
    case "deep_research":
      return {
        label: "Deep Research Radar",
        icon: Radar,
        color: "#9333ea",
        bg: "rgba(147, 51, 234, 0.08)",
        border: "rgba(147, 51, 234, 0.2)",
      };
    default:
      return {
        label: "Private Buyout",
        icon: Briefcase,
        color: "#d97706",
        bg: "rgba(217, 119, 6, 0.08)",
        border: "rgba(217, 119, 6, 0.2)",
      };
  }
}

// ─── Multi-Asset Opportunity Card ───────────────────────────────────────────
function PublicOpportunityCard({
  opp,
  loginUrl,
}: {
  opp: any;
  loginUrl: string;
}) {
  const stageInfo = STAGE_LABELS[opp.stage] ?? {
    label: opp.stageLabel || opp.stage,
    color: "#6b7280",
  };
  const assetMeta = getAssetClassMeta(opp.assetClass);
  const AssetIcon = assetMeta.icon;
  const score = opp.scoreBlurred;

  return (
    <div className="group border border-[#e8e0d4] bg-[#faf8f5] p-6 relative flex flex-col justify-between overflow-hidden hover:border-[#ffba20] transition-all duration-300">
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.12em] uppercase px-2.5 py-1 rounded-sm"
              style={{
                color: assetMeta.color,
                background: assetMeta.bg,
                border: `1px solid ${assetMeta.border}`,
              }}
            >
              <AssetIcon className="w-3 h-3" />
              {opp.assetClassLabel || assetMeta.label}
            </span>
            <span
              className="text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-1 rounded-sm"
              style={{ color: stageInfo.color, background: `${stageInfo.color}14` }}
            >
              {stageInfo.label}
            </span>
          </div>

          {score !== null && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#8b7355] uppercase tracking-wider">Score</span>
              <span
                className="font-['JetBrains_Mono',_monospace] text-sm font-bold"
                style={{ color: score >= 0.8 ? "#16a34a" : score >= 0.65 ? "#d97706" : "#6b7280" }}
              >
                {typeof score === "number" ? score.toFixed(1) : score}
              </span>
              <span className="text-[#8b7355] text-xs">/ 1.0</span>
            </div>
          )}
        </div>

        {/* Name */}
        <h3 className="font-['Fraunces',_serif] text-xl font-bold text-[#1a1208] mb-2 leading-snug group-hover:text-[#3d2e1e] transition-colors">
          {opp.name}
        </h3>

        {/* Meta: Category & Location */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-5 text-xs text-[#8b7355]">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">domain</span>
            {opp.category || opp.industry}
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">location_on</span>
            {opp.location}
          </span>
        </div>

        {/* 3 Metrics Block */}
        <div className="grid grid-cols-3 gap-2 mb-4 bg-[#f2ede6] p-3 rounded-sm border border-[#e8e0d4]/60">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-[#8b7355] font-semibold truncate">
              {opp.metric1Label || "Metric 1"}
            </div>
            <div className="text-xs font-bold text-[#1a1208] mt-0.5 truncate font-['JetBrains_Mono',_monospace]">
              {opp.metric1Value || "Audited"}
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-[#8b7355] font-semibold truncate">
              {opp.metric2Label || "Metric 2"}
            </div>
            <div className="text-xs font-bold text-[#1a1208] mt-0.5 truncate font-['JetBrains_Mono',_monospace]">
              {opp.metric2Value || "Normalized"}
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-[#8b7355] font-semibold truncate">
              {opp.metric3Label || "Metric 3"}
            </div>
            <div className="text-xs font-bold text-[#1a1208] mt-0.5 truncate font-['JetBrains_Mono',_monospace]">
              {opp.metric3Value || "Institutional"}
            </div>
          </div>
        </div>

        {/* Adversarial Red Team / Audit Finding strip */}
        {(opp.adversarialInsight || opp.auditFlag) && (
          <div className="bg-[#1a1208]/5 border-l-2 border-[#ffba20] p-2.5 mb-5 rounded-r-sm">
            <div className="flex items-start gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[#d97706] shrink-0 mt-0.5" />
              <div className="text-[11px] text-[#5c4a32] leading-tight">
                <span className="font-semibold text-[#1a1208]">Diligence Finding: </span>
                {opp.adversarialInsight || opp.auditFlag}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Financials / IC Model Gate */}
      <div className="pt-2 border-t border-[#e8e0d4]/80 flex items-center justify-between">
        <span className="text-[11px] text-[#8b7355] flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-[#16a34a]" />
          Pre-Commitment Filter
        </span>
        <a
          href={loginUrl}
          className="inline-flex items-center gap-1.5 bg-[#1a1208] text-[#faf8f5] text-xs font-semibold px-3 py-1.5 hover:bg-[#3d2e1e] transition-colors"
        >
          <Lock className="w-3 h-3 text-[#ffba20]" />
          Unlock Dossier
        </a>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PublicSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const loginUrl = getLoginUrl();

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading } = trpc.publicDeals.search.useQuery(
    {
      q: debouncedQ || undefined,
      assetClass: activeTab === "all" ? undefined : activeTab,
      limit: 12,
    },
    { staleTime: 60_000 }
  );

  const results = data?.results ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="min-h-screen bg-[#faf8f5]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Top nav ── */}
      <header className="border-b border-[#e8e0d4] bg-[#faf8f5]/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 bg-[#1a1208] rounded-sm flex items-center justify-center">
              <Radar className="text-[#ffba20] w-4 h-4" />
            </div>
            <div>
              <div className="font-['Fraunces',_serif] font-black text-[#1a1208] text-sm leading-none">
                SIGNAL HUNTER OS
              </div>
              <div className="text-[9px] tracking-[0.2em] text-[#8b7355] uppercase leading-none mt-0.5">
                DECISION & DILIGENCE SUITE
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs text-[#8b7355] hover:text-[#1a1208] transition-colors hidden sm:block"
            >
              ← Back to Home
            </Link>
            <Link
              href="/walkthrough"
              className="text-xs text-[#8b7355] hover:text-[#1a1208] transition-colors hidden md:block"
            >
              Inspect Walkthrough
            </Link>
            <a
              href={loginUrl}
              className="bg-[#1a1208] text-[#faf8f5] text-xs font-semibold px-4 py-2 hover:bg-[#3d2e1e] transition-colors flex items-center gap-1.5"
            >
              <LockOpen className="w-3.5 h-3.5 text-[#ffba20]" />
              Operator Access
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero search bar ── */}
      <section className="py-16 px-6 bg-[#1a1208]">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px w-8 bg-[#ffba20]" />
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#8b7355] uppercase">
              Multi-Asset Opportunity Pipeline
            </span>
            <div className="h-px w-8 bg-[#ffba20]" />
          </div>
          <h1 className="font-['Fraunces',_serif] text-4xl lg:text-5xl font-black text-[#faf8f5] mb-4 leading-tight">
            Explore Active Pipeline
          </h1>
          <p className="text-[#d8c8b4] text-base mb-2 max-w-xl mx-auto leading-relaxed">
            Public pipeline across private operating buyouts, commercial real estate, and macro capital theses — audited upstream of capital commitment.
          </p>
          <p className="text-[#8b7355] text-xs mb-8 max-w-lg mx-auto">
            {total > 0 ? `${total} opportunities across 4 asset classes.` : "Loading opportunities..."} Sign in to unlock forensic financial models, 3-agent IC consensus, and live cited dossiers.
          </p>

          {/* Search input */}
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8b7355] w-5 h-5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by asset class, sector, location, or thesis keyword..."
              className="w-full bg-[#faf8f5] text-[#1a1208] placeholder:text-[#8b7355] pl-12 pr-10 py-3.5 text-sm border-0 outline-none focus:ring-2 focus:ring-[#ffba20]"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8b7355] hover:text-[#1a1208] transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Asset Class Tabs & Filter Bar ── */}
      <section className="border-b border-[#e8e0d4] bg-[#faf8f5]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-2 overflow-x-auto py-3 no-scrollbar">
            {ASSET_TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-xs font-semibold rounded-sm whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    active
                      ? "bg-[#1a1208] text-[#faf8f5]"
                      : "bg-[#f2ede6] text-[#5c4a32] hover:bg-[#e8e0d4] hover:text-[#1a1208]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Results grid ── */}
      <section className="py-12 px-6 max-w-7xl mx-auto">
        {/* Results summary header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#e8e0d4]">
          <div className="text-sm text-[#8b7355]">
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                Searching pipeline across asset classes...
              </span>
            ) : (
              <>
                Showing <span className="font-semibold text-[#1a1208]">{results.length}</span>
                {debouncedQ ? ` results for "${debouncedQ}"` : " audited opportunities"}
                {total > results.length && (
                  <span className="text-[#8b7355]"> · {total - results.length} more in operator pipeline</span>
                )}
              </>
            )}
          </div>
          <a
            href={loginUrl}
            className="text-xs font-semibold text-[#b8860b] flex items-center gap-1 hover:text-[#1a1208] transition-colors"
          >
            <LockOpen className="w-3.5 h-3.5 text-[#ffba20]" />
            Unlock complete pipeline
          </a>
        </div>

        {/* Cards */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border border-[#e8e0d4] bg-[#f2ede6] p-6 animate-pulse h-72" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-20 bg-[#faf8f5] border border-[#e8e0d4] p-8">
            <span className="material-symbols-outlined text-[#e8e0d4] text-6xl mb-4 block">search_off</span>
            <p className="text-[#1a1208] text-lg font-bold mb-2">No opportunities match this filter.</p>
            <p className="text-[#8b7355] text-sm max-w-md mx-auto mb-6">
              Try clearing your search term or switching to "All Opportunities" to view the full multi-asset pipeline.
            </p>
            <button
              onClick={() => {
                setQuery("");
                setActiveTab("all");
              }}
              className="bg-[#1a1208] text-[#faf8f5] text-xs font-semibold px-4 py-2 hover:bg-[#3d2e1e] transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((opp: any) => (
              <PublicOpportunityCard key={opp.id} opp={opp} loginUrl={loginUrl} />
            ))}
          </div>
        )}

        {/* Gate CTA banner */}
        <div className="mt-16 border border-[#ffba20] bg-[#1a1208] p-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px w-8 bg-[#ffba20]" />
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#8b7355] uppercase">Operator Access</span>
            <div className="h-px w-8 bg-[#ffba20]" />
          </div>
          <h2 className="font-['Fraunces',_serif] text-3xl lg:text-4xl font-black text-[#faf8f5] mb-4">
            You're seeing the surface.<br />
            <span className="text-[#ffba20]">The intelligence is underneath.</span>
          </h2>
          <p className="text-[#8b7355] max-w-2xl mx-auto mb-8 text-sm leading-relaxed">
            Operator access unlocks full forensic financial models, 3-agent IC consensus scorecards, commercial property lease roll verification, Capital Aperture macro execution rails, and TIDE capital flow intelligence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={loginUrl}
              className="inline-flex items-center justify-center gap-2 bg-[#ffba20] text-[#1a1208] text-sm font-bold px-8 py-3.5 hover:bg-[#ffd060] transition-colors"
            >
              <LockOpen className="w-4 h-4" />
              Request Operator Access
            </a>
            <Link
              href="/walkthrough"
              className="inline-flex items-center justify-center gap-2 border border-[#8b7355] text-[#8b7355] text-sm font-medium px-8 py-3.5 hover:border-[#faf8f5] hover:text-[#faf8f5] transition-colors"
            >
              Inspect Walkthrough
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
