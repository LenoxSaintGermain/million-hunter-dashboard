import { useState, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";

// Stage label map
const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  high_priority: { label: "High Priority", color: "#16a34a" },
  qualified: { label: "Qualified", color: "#d97706" },
  new: { label: "New Listing", color: "#6b7280" },
  in_diligence: { label: "In Diligence", color: "#2563eb" },
  loi_sent: { label: "LOI Sent", color: "#7c3aed" },
};

// ─── Blurred deal card ────────────────────────────────────────────────────────
function PublicDealCard({
  deal,
  loginUrl,
}: {
  deal: { id: number; name: string; industry: string; location: string; stage: string; scoreBlurred: number | null };
  loginUrl: string;
}) {
  const stageInfo = STAGE_LABELS[deal.stage] ?? { label: deal.stage, color: "#6b7280" };
  const score = deal.scoreBlurred;

  return (
    <div className="group border border-[#e8e0d4] bg-[#faf8f5] p-6 relative overflow-hidden hover:border-[#ffba20] transition-all duration-300">
      {/* Stage badge */}
      <div className="flex items-center justify-between mb-4">
        <span
          className="text-[10px] font-bold tracking-[0.15em] uppercase px-2 py-1"
          style={{ color: stageInfo.color, background: `${stageInfo.color}18` }}
        >
          {stageInfo.label}
        </span>
        {score !== null && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#8b7355] uppercase tracking-wider">Score</span>
            <span
              className="font-['JetBrains_Mono',_monospace] text-sm font-bold"
              style={{ color: score >= 0.8 ? "#16a34a" : score >= 0.65 ? "#d97706" : "#6b7280" }}
            >
              {score.toFixed(1)}
            </span>
            <span className="text-[#8b7355] text-xs">/ 1.0</span>
          </div>
        )}
      </div>

      {/* Deal name */}
      <h3 className="font-['Fraunces',_serif] text-lg font-bold text-[#1a1208] mb-2 leading-snug group-hover:text-[#3d2e1e] transition-colors">
        {deal.name}
      </h3>

      {/* Meta */}
      <div className="flex items-center gap-4 mb-5 text-sm text-[#8b7355]">
        <span className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">factory</span>
          {deal.industry}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">location_on</span>
          {deal.location}
        </span>
      </div>

      {/* Blurred financials gate */}
      <div className="relative">
        <div className="grid grid-cols-3 gap-3 mb-4">
          {["Revenue", "Cash Flow", "Asking"].map((label) => (
            <div key={label} className="bg-[#f2ede6] p-3 rounded-sm">
              <div className="text-[10px] text-[#8b7355] uppercase tracking-wider mb-1">{label}</div>
              <div className="h-5 bg-[#1a1208]/10 rounded blur-sm select-none" style={{ filter: "blur(4px)" }}>
                $0.0M
              </div>
            </div>
          ))}
        </div>
        {/* Gate overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-[#faf8f5]/80 backdrop-blur-[2px]">
          <a
            href={loginUrl}
            className="flex items-center gap-2 bg-[#1a1208] text-[#faf8f5] text-xs font-semibold px-4 py-2 hover:bg-[#3d2e1e] transition-colors"
          >
            <span className="material-symbols-outlined text-[#ffba20] text-[14px]">lock</span>
            Unlock Financials
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PublicSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const loginUrl = getLoginUrl();

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading } = trpc.publicDeals.search.useQuery(
    { q: debouncedQ || undefined, limit: 9 },
    { staleTime: 60_000 }
  );

  const results = data?.results ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="min-h-screen bg-[#faf8f5]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Top nav ── */}
      <header className="border-b border-[#e8e0d4] bg-[#faf8f5]/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-6 h-6 bg-[#1a1208] rounded-sm flex items-center justify-center">
              <span className="material-symbols-outlined text-[#ffba20] text-[13px]">radar</span>
            </div>
            <div>
              <div className="font-['Fraunces',_serif] font-black text-[#1a1208] text-xs leading-none">SIGNAL HUNTER</div>
              <div className="text-[8px] tracking-[0.2em] text-[#8b7355] uppercase leading-none mt-0.5">OS EDITORIAL</div>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xs text-[#8b7355] hover:text-[#1a1208] transition-colors hidden sm:block">
              ← Back to Home
            </Link>
            <a
              href={loginUrl}
              className="bg-[#1a1208] text-[#faf8f5] text-xs font-semibold px-4 py-2 hover:bg-[#3d2e1e] transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[#ffba20] text-[14px]">lock_open</span>
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
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#8b7355] uppercase">Deal Explorer</span>
            <div className="h-px w-8 bg-[#ffba20]" />
          </div>
          <h1 className="font-['Fraunces',_serif] text-4xl lg:text-5xl font-black text-[#faf8f5] mb-4 leading-tight">
            Browse Active Deals
          </h1>
          <p className="text-[#8b7355] mb-8 max-w-lg mx-auto">
            {total > 0 ? `${total} deals in the pipeline.` : "Deals loading..."} Sign in to unlock financials, AI scores, and full intelligence dossiers.
          </p>

          {/* Search input */}
          <div className="relative max-w-xl mx-auto">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#8b7355] text-[20px]">search</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by industry, location, or business name..."
              className="w-full bg-[#faf8f5] text-[#1a1208] placeholder:text-[#8b7355] pl-11 pr-4 py-3.5 text-sm border-0 outline-none focus:ring-2 focus:ring-[#ffba20]"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8b7355] hover:text-[#1a1208] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Results grid ── */}
      <section className="py-12 px-6 max-w-7xl mx-auto">
        {/* Filter hint bar */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#e8e0d4]">
          <div className="text-sm text-[#8b7355]">
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                Searching...
              </span>
            ) : (
              <>
                Showing <span className="font-semibold text-[#1a1208]">{results.length}</span>
                {debouncedQ ? ` results for "${debouncedQ}"` : " active deals"}
                {total > results.length && (
                  <span className="text-[#8b7355]"> · {total - results.length} more require operator access</span>
                )}
              </>
            )}
          </div>
          <a
            href={loginUrl}
            className="text-xs font-semibold text-[#ffba20] flex items-center gap-1 hover:text-[#1a1208] transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">lock_open</span>
            Unlock full pipeline
          </a>
        </div>

        {/* Deal cards */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border border-[#e8e0d4] bg-[#f2ede6] p-6 animate-pulse h-56" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-[#e8e0d4] text-6xl mb-4 block">search_off</span>
            <p className="text-[#8b7355] text-lg mb-2">No deals match your search.</p>
            <p className="text-[#8b7355] text-sm">Try a different industry or location.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((deal) => (
              <PublicDealCard key={deal.id} deal={deal} loginUrl={loginUrl} />
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
          <p className="text-[#8b7355] max-w-xl mx-auto mb-8 text-sm leading-relaxed">
            Operator access unlocks full financials, AI scoring across 6 dimensions, IC Review with 3-model consensus, behavioral seller profiles, TIDE capital flow intelligence, and agent-run diligence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={loginUrl}
              className="inline-flex items-center justify-center gap-2 bg-[#ffba20] text-[#1a1208] text-sm font-bold px-8 py-3.5 hover:bg-[#ffd060] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">lock_open</span>
              Request Operator Access
            </a>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 border border-[#8b7355] text-[#8b7355] text-sm font-medium px-8 py-3.5 hover:border-[#faf8f5] hover:text-[#faf8f5] transition-colors"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
