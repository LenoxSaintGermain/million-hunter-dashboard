/**
 * Market Scan for a client on a bespoke PROPERTY thesis.
 *
 * The business version of this page browses `deals` (operating companies) with
 * revenue/EBITDA filters — meaningless for a building. This one scans the
 * client's own asset class, grouped by market, using the same scored data that
 * backs their pipeline and dossiers.
 *
 * Everything is read-only: clients never mutate the pipeline (the server
 * enforces that with operatorProcedure).
 */
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import InvestorLayout from "@/components/InvestorLayout";
import { getAssetClass } from "@shared/assetClasses";
import { Loader2, MapPin, ArrowRight, Search, GraduationCap } from "lucide-react";
import { isTutorialAsset } from "@shared/tutorial";
import { Input } from "@/components/ui/input";
import { TIER_META, fmtMoney, type ScoredAsset } from "@/components/AssetDossierSections";

export default function PropertyMarketScan({ assetClass }: { assetClass: string }) {
  const cls = getAssetClass(assetClass);
  const [q, setQ] = useState("");
  const search = trpc.scout.search.useQuery({ assetClass }, { refetchOnWindowFocus: false });
  const results: ScoredAsset[] = (search.data?.results ?? []) as any;

  const filtered = useMemo(
    () =>
      results.filter((a) => {
        if (!q.trim()) return true;
        const hay = `${a.name} ${a.city} ${a.state}`.toLowerCase();
        return hay.includes(q.trim().toLowerCase());
      }),
    [results, q],
  );

  /** Group by market (state) — the unit a property investor actually scans in. */
  const markets = useMemo(() => {
    const byState = new Map<string, ScoredAsset[]>();
    filtered.forEach((a) => {
      const k = String(a.state ?? "—");
      byState.set(k, [...(byState.get(k) ?? []), a]);
    });
    return Array.from(byState.entries())
      .map(([state, assets]: [string, ScoredAsset[]]) => ({
        state,
        assets: assets.slice().sort((x, y) => y.historicScore.rankScore - x.historicScore.rankScore),
        best: Math.max(...assets.map((a) => a.historicScore.rankScore)),
      }))
      .sort((a, b) => b.best - a.best);
  }, [filtered]);

  /** Target markets the thesis declares but where we hold nothing yet. */
  const coveredStates = new Set(markets.map((m) => m.state));
  const untouched = (cls.markets ?? []).filter((m) => !coveredStates.has(m));

  return (
    <InvestorLayout>
      <div className="space-y-8">
        <div>
          <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-2">
            {cls.label}
          </p>
          <h1 className="font-card-title text-[28px] text-ink leading-tight">Market Scan</h1>
          <p className="font-body-base text-body-base text-muted-foreground mt-1">
            Every asset sourced against your thesis, grouped by market. Open a dossier for the
            full scorecard, economics, and provenance.
          </p>
        </div>

        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by name, city, or state"
            className="pl-9 h-9 text-sm border-rule bg-transparent"
          />
        </div>

        {search.isLoading ? (
          <div className="flex items-center gap-3 py-16">
            <Loader2 className="w-4 h-4 animate-spin text-amber" />
            <span className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">
              Scanning markets
            </span>
          </div>
        ) : !markets.length ? (
          <p className="font-body-base text-body-base text-muted-foreground py-16">
            No assets match this thesis yet. Your analyst is sourcing — check back shortly.
          </p>
        ) : (
          <div className="space-y-10">
            {markets.map((m) => (
              <section key={m.state}>
                <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2 mb-4">
                  <h2 className="font-card-title text-[20px] text-ink flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    {m.state}
                  </h2>
                  <span className="font-data-mono text-data-mono text-muted-foreground">
                    {m.assets.length} {m.assets.length === 1 ? "asset" : "assets"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {m.assets.map((a: ScoredAsset) => {
                    const sc = a.historicScore;
                    const tier = TIER_META[sc.assetTier as keyof typeof TIER_META];
                    return (
                      <Link key={a.id} href={`/wingate/asset/${a.id}`}>
                        <div className="group border border-rule bg-paper p-5 h-full cursor-pointer hover:shadow-[0_8px_30px_-12px_rgba(15,20,40,0.12)] transition-shadow">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <span className="font-data-mono text-[22px] text-amber leading-none">
                              {Math.round(sc.rankScore)}
                            </span>
                            {isTutorialAsset(a as any) ? (
                              <span className="font-eyebrow text-eyebrow px-2 py-0.5 rounded-sm border border-amber/50 bg-amber/10 text-amber uppercase tracking-widest inline-flex items-center gap-1">
                                <GraduationCap className="w-3 h-3" /> Tutorial
                              </span>
                            ) : (
                              <span className={cn("font-eyebrow text-eyebrow px-2 py-0.5 rounded-sm border uppercase tracking-widest", tier.cls)}>
                                {tier.label}
                              </span>
                            )}
                          </div>
                          <p className="font-card-title text-[17px] text-ink leading-tight mb-1">{a.name}</p>
                          <p className="font-body-base text-[12px] text-muted-foreground mb-4">
                            {a.city}, {a.state} · Market {sc.marketTier}
                          </p>
                          <div className="grid grid-cols-3 gap-3 border-t border-rule pt-3">
                            {[
                              { label: "Asking", value: fmtMoney(a.askingPrice == null ? null : Number(a.askingPrice)) },
                              { label: "Composite", value: String(sc.compositeScore) },
                              { label: "Confidence", value: `${Math.round(sc.confidenceScore * 100)}%` },
                            ].map((x) => (
                              <div key={x.label}>
                                <p className="font-eyebrow text-[9px] text-muted-foreground uppercase tracking-widest mb-1">{x.label}</p>
                                <p className="font-data-mono text-[13px] text-ink">{x.value}</p>
                              </div>
                            ))}
                          </div>
                          <span className="mt-4 inline-flex items-center gap-1 font-eyebrow text-eyebrow text-muted-foreground group-hover:text-amber uppercase tracking-widest">
                            Open dossier <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {untouched.length > 0 && (
          <section className="border-t border-rule pt-6">
            <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-3">
              Target markets with no inventory yet
            </p>
            <div className="flex flex-wrap gap-2">
              {untouched.map((m) => (
                <span key={m} className="font-eyebrow text-eyebrow px-2 py-1 rounded-sm border border-rule text-muted-foreground uppercase tracking-widest">
                  {m}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </InvestorLayout>
  );
}
