/**
 * Dossier sections — ONE set of presentational modules rendered by both the
 * full-page dossier (/wingate/asset/:id) and the quick-scan preview modal in
 * /wingate. Editorial tokens throughout (ink / rule / paper / amber / sage /
 * clay) so a property dossier reads like the business Deal Room, not a
 * separate app.
 *
 * Everything here is presentational: no queries, no mutations. Data comes from
 * scout.getScoredById / scout.search, which return the same shape.
 */
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, ExternalLink, XCircle } from "lucide-react";

export type Factor = { label: string; points: number; max: number; note?: string; verify?: boolean };
export type Dimension = { key: string; label: string; score: number; max: number; factors: Factor[] };
export type HistoricScore = {
  dimA: number; dimB: number; dimC: number; dimD: number; dimE: number; dimF: number; dimG: number;
  compositeScore: number; penalties: number; bonuses: number; confidenceScore: number; rankScore: number;
  assetTier: "tier1" | "tier2" | "tier3" | "archive" | "fasttrack";
  marketTier: "A" | "B" | "C"; dispositionCode: string | null; verifyFields: string[]; hardStopFailed: string | null;
  scorecard: {
    dimensions: Dimension[]; penalties: Factor[]; bonuses: Factor[];
    strengths: string[]; risks: string[]; marketNote: string; sourceNote: string;
  };
};
export type ScoredAsset = Record<string, any> & { historicScore: HistoricScore };

export const TIER_META: Record<HistoricScore["assetTier"], { label: string; cls: string }> = {
  tier1:     { label: "Tier 1",     cls: "text-amber border-amber/40 bg-amber/10" },
  fasttrack: { label: "Fast-Track", cls: "text-clay border-clay/40 bg-clay/10" },
  tier2:     { label: "Tier 2",     cls: "text-ink border-rule bg-paper" },
  tier3:     { label: "Tier 3",     cls: "text-muted-foreground border-rule bg-paper" },
  archive:   { label: "Archive",    cls: "text-muted-foreground border-rule bg-paper" },
};

export const fmtMoney = (n?: number | null) =>
  n == null ? "—" : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}k` : `$${n}`;

/** Section heading, shared by every module so the page reads as one document. */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest", className)}>
      {children}
    </p>
  );
}

/** Rank / composite / confidence — the three numbers that decide everything. */
export function ScoreHeadline({ s, dense }: { s: HistoricScore; dense?: boolean }) {
  const items = [
    { label: "Rank Score", value: String(Math.round(s.rankScore)), sub: "composite × confidence", accent: "text-amber" },
    { label: "Composite", value: String(s.compositeScore), sub: `+${s.bonuses} bonus · −${s.penalties} penalty`, accent: "text-ink" },
    {
      label: "Confidence", value: `${Math.round(s.confidenceScore * 100)}%`,
      sub: `${5 - s.verifyFields.length}/5 critical fields verified`,
      accent: s.confidenceScore >= 0.8 ? "text-sage" : "text-amber",
    },
  ];
  return (
    <div className={cn("grid grid-cols-3 gap-0 border border-rule divide-x divide-rule", dense && "text-center")}>
      {items.map((m) => (
        <div key={m.label} className={cn("px-4 bg-paper", dense ? "py-3" : "py-5 px-6")}>
          <p className={cn("font-data-mono leading-none", m.accent, dense ? "text-[22px]" : "text-section-h2")}>{m.value}</p>
          <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mt-2">{m.label}</p>
          <p className="font-body-base text-[11px] text-muted-foreground/80 mt-1 leading-snug">{m.sub}</p>
        </div>
      ))}
    </div>
  );
}

export function HardStopBanner({ s }: { s: HistoricScore }) {
  if (!s.hardStopFailed) return null;
  return (
    <div className="border-l-2 border-clay pl-5 py-3 flex items-start gap-3">
      <XCircle className="w-4 h-4 text-clay shrink-0 mt-0.5" />
      <div>
        <p className="font-eyebrow text-eyebrow text-clay uppercase tracking-widest mb-1">
          Hard stop{s.dispositionCode ? ` · ${s.dispositionCode}` : ""}
        </p>
        <p className="font-body-base text-body-base text-ink/80 leading-relaxed">{s.hardStopFailed}</p>
      </div>
    </div>
  );
}

/** §9 underwriting math. `dense` trims it to the three headline numbers. */
export function EconomicsPanel({ economics, dense }: { economics: any; dense?: boolean }) {
  if (!economics) return null;
  const headline = [
    { label: "Project cost", v: economics.headline.totalProjectCost, fmt: (n: number) => fmtMoney(n) },
    { label: "Incentive equity", v: economics.headline.incentiveEquity, fmt: (n: number) => fmtMoney(n) },
    { label: "Equity gap", v: economics.headline.equityGapPct, fmt: (n: number) => `${Math.round(n * 100)}%` },
  ];
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <SectionLabel>Deal Economics</SectionLabel>
        {economics.archetype && (
          <span className="font-eyebrow text-eyebrow text-muted-foreground">archetype · {economics.archetype}</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-0 border border-rule divide-x divide-rule mb-6">
        {headline.map((x) => (
          <div key={x.label} className="px-4 py-4 bg-paper">
            <p className="font-data-mono text-[22px] text-ink leading-none">
              {x.v == null ? "—" : x.fmt(x.v as number)}
            </p>
            <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mt-2">{x.label}</p>
          </div>
        ))}
      </div>

      {!dense && (
        <>
          <div className="divide-y divide-rule border-t border-b border-rule max-w-[680px]">
            {economics.metrics.map((m: any) => {
              const valueCls =
                m.status === "pass" ? "text-sage" :
                m.status === "watch" ? "text-amber" :
                m.status === "fail" ? "text-clay" : "text-muted-foreground";
              return (
                <div key={m.key} className="py-3 flex items-start gap-4">
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0 mt-2",
                    m.status === "pass" ? "bg-sage" : m.status === "watch" ? "bg-amber" :
                    m.status === "fail" ? "bg-clay" : "bg-muted-foreground/40")} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="font-body-base text-body-base text-ink">{m.label}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        {m.basis === "modeled" && (
                          <span className="font-eyebrow text-[9px] px-1.5 py-0.5 rounded-sm border border-rule text-muted-foreground uppercase tracking-widest">est</span>
                        )}
                        {m.basis === "verified" && (
                          <span className="font-eyebrow text-[9px] px-1.5 py-0.5 rounded-sm border border-sage/40 text-sage uppercase tracking-widest">verified</span>
                        )}
                        <span className={cn("font-data-mono text-data-mono", valueCls)}>{m.display}</span>
                      </span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {m.target && <p className="font-body-base text-[12px] text-muted-foreground">target {m.target}</p>}
                      {m.assumption && <p className="font-body-base text-[12px] text-muted-foreground">Assumption: {m.assumption}</p>}
                      {m.note && <p className="font-body-base text-[12px] text-muted-foreground">{m.note}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="font-body-base text-[12px] text-muted-foreground leading-relaxed mt-4">{economics.disclaimer}</p>
        </>
      )}
    </div>
  );
}

/** A–G dimensions. On the page these are always open; in the modal, collapsed. */
export function DimensionsPanel({ s, collapsible }: { s: HistoricScore; collapsible?: boolean }) {
  return (
    <div className="border-t border-rule max-w-[680px]">
      {s.scorecard.dimensions.map((d) => {
        const gated = d.key === "A" || d.key === "B";
        const gateOk = d.score >= 12;
        const header = (
          <div className="flex items-center gap-3 py-3">
            <span className="font-eyebrow text-eyebrow text-amber w-4">{d.key}</span>
            <span className="font-card-title text-[17px] text-ink leading-none">{d.label}</span>
            <span className="flex-1 border-b border-dotted border-rule translate-y-[-2px]" aria-hidden />
            {gated && (
              <span className={cn("font-eyebrow text-eyebrow uppercase tracking-widest", gateOk ? "text-sage" : "text-clay")}>
                {gateOk ? "gate pass" : "gate fail"}
              </span>
            )}
            <span className="font-data-mono text-data-mono text-ink">
              {d.score}<span className="text-muted-foreground">/{d.max}</span>
            </span>
          </div>
        );
        const factors = (
          <div className="pb-4 pl-7 space-y-1.5">
            {d.factors.map((f, i) => (
              <div key={i} className="flex items-baseline gap-3">
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0 translate-y-[-2px]", f.points > 0 ? "bg-sage" : "bg-muted-foreground/30")} />
                <span className="font-body-base text-[13px] text-ink/75">
                  {f.label}{f.note ? ` — ${f.note}` : ""}
                </span>
                <span className="flex-1 border-b border-dotted border-rule/60 translate-y-[-3px]" aria-hidden />
                {f.verify && <AlertTriangle className="w-3 h-3 text-amber shrink-0" />}
                <span className="font-data-mono text-[12px] text-muted-foreground shrink-0">{f.points}/{f.max}</span>
              </div>
            ))}
          </div>
        );
        return collapsible ? (
          <details key={d.key} className="border-b border-rule">
            <summary className="cursor-pointer list-none">{header}</summary>
            {factors}
          </details>
        ) : (
          <div key={d.key} className="border-b border-rule">{header}{factors}</div>
        );
      })}
    </div>
  );
}

export function PenaltiesBonuses({ s }: { s: HistoricScore }) {
  if (!s.scorecard.penalties.length && !s.scorecard.bonuses.length) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="border border-rule bg-paper p-5">
        <SectionLabel className="mb-3">Penalties</SectionLabel>
        {s.scorecard.penalties.length
          ? s.scorecard.penalties.map((p, i) => (
              <p key={i} className="font-body-base text-[13px] text-ink/80 leading-relaxed">
                <span className="font-data-mono text-clay">−{p.points}</span> {p.label}
              </p>
            ))
          : <p className="font-body-base text-[13px] text-muted-foreground">None applied.</p>}
      </div>
      <div className="border border-rule bg-paper p-5">
        <SectionLabel className="mb-3">Alpha Bonuses</SectionLabel>
        {s.scorecard.bonuses.length
          ? s.scorecard.bonuses.map((b, i) => (
              <p key={i} className="font-body-base text-[13px] text-ink/80 leading-relaxed">
                <span className="font-data-mono text-sage">+{b.points}</span> {b.label}
              </p>
            ))
          : <p className="font-body-base text-[13px] text-muted-foreground">None applied.</p>}
      </div>
    </div>
  );
}

export function VerifyList({ s }: { s: HistoricScore }) {
  if (!s.verifyFields.length) return null;
  return (
    <div className="border-l-2 border-amber pl-5 py-2">
      <p className="font-eyebrow text-eyebrow text-amber uppercase tracking-widest mb-2">
        {s.verifyFields.length} of 5 critical fields unverified — capped below Tier 1
      </p>
      {s.verifyFields.map((v) => (
        <p key={v} className="font-body-base text-[13px] text-ink/80 leading-relaxed">· {v}</p>
      ))}
    </div>
  );
}

export function StrengthsRisks({ s }: { s: HistoricScore }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <SectionLabel className="mb-3">Strengths</SectionLabel>
        {s.scorecard.strengths.length
          ? s.scorecard.strengths.map((x, i) => (
              <p key={i} className="font-body-base text-[13px] text-ink/80 leading-relaxed mb-1.5">
                <span className="text-sage">✓</span> {x}
              </p>
            ))
          : <p className="font-body-base text-[13px] text-muted-foreground">None recorded.</p>}
      </div>
      <div>
        <SectionLabel className="mb-3">Risks</SectionLabel>
        {s.scorecard.risks.length
          ? s.scorecard.risks.map((x, i) => (
              <p key={i} className="font-body-base text-[13px] text-ink/80 leading-relaxed mb-1.5">
                <span className="text-clay">!</span> {x}
              </p>
            ))
          : <p className="font-body-base text-[13px] text-muted-foreground">None recorded.</p>}
      </div>
    </div>
  );
}

export type DiligenceItem = { m: string; label: string; done: boolean; detail: string };

/** Build the class-declared diligence checklist. Shared so page + modal agree. */
export function buildDiligenceItems(asset: ScoredAsset, has: (m: any) => boolean): DiligenceItem[] {
  const items: DiligenceItem[] = [];
  const hi = (asset.historicInputs ?? {}) as any;
  if (has("incentiveStack")) items.push({
    m: "incentiveStack", label: "Incentive stack confirmed",
    done: !!(hi.abatementAvailable != null || hi.nmtcTract != null || hi.tifDistrict != null),
    detail: [asset.opportunityZone ? "OZ" : null, hi.nmtcTract ? "NMTC" : null, hi.tifDistrict ? "TIF" : null, hi.abatementAvailable ? "abatement" : null]
      .filter(Boolean).join(" · ") || "OZ / NMTC / TIF / abatement status not yet confirmed",
  });
  if (has("envelope")) items.push({
    m: "envelope", label: "Development envelope",
    done: hi.farUtilization != null,
    detail: hi.farUtilization != null
      ? `FAR utilization ${hi.farUtilization} · headroom ${(1 / hi.farUtilization).toFixed(1)}×`
      : "Needs zoning max FAR vs. existing GSF",
  });
  if (has("environmental")) items.push({
    m: "environmental", label: "Phase I ESA / prior use",
    done: hi.highRiskPriorUse != null || !!hi.priorUse,
    detail: hi.highRiskPriorUse ? `High-risk prior use: ${hi.priorUse ?? "flagged"}`
      : hi.priorUse ? `Prior use: ${hi.priorUse}` : "Prior-use history not researched",
  });
  if (has("titleEasements")) items.push({
    m: "titleEasements", label: "Title, easements & covenants",
    done: hi.ownershipVerified === true,
    detail: hi.facadeEasement ? "Facade easement recorded — restricts vertical addition"
      : hi.ownershipVerified ? "Ownership verified" : "Ownership entity & title unverified",
  });
  return items;
}

export function DiligencePanel({ items, classLabel }: { items: DiligenceItem[]; classLabel: string }) {
  if (!items.length) return null;
  return (
    <div>
      <SectionLabel className="mb-4">
        {classLabel} diligence · {items.filter((i) => i.done).length}/{items.length} resolved
      </SectionLabel>
      <div className="divide-y divide-rule border-t border-b border-rule">
        {items.map((i) => (
          <div key={i.m} className="py-3 flex items-start gap-3">
            {i.done
              ? <CheckCircle2 className="w-4 h-4 text-sage shrink-0 mt-0.5" />
              : <AlertTriangle className="w-4 h-4 text-amber shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <p className="font-body-base text-body-base text-ink">{i.label}</p>
              <p className="font-body-base text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{i.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const LISTING_STATUS_CLS: Record<string, string> = {
  active: "text-sage border-sage/40",
  stale: "text-amber border-amber/40",
  withdrawn: "text-clay border-clay/40",
  sold: "text-clay border-clay/40",
  unknown: "text-muted-foreground border-rule",
};

export function ProvenancePanel({ asset, verification }: { asset: ScoredAsset; verification?: any }) {
  const st = verification?.status ?? asset.listingStatus;
  const note = verification?.note ?? asset.verificationNote;
  const citations: string[] = verification?.citations ?? asset.verificationSources ?? [];
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <SectionLabel>Source &amp; Verification</SectionLabel>
        <span className={cn("font-eyebrow text-eyebrow px-2 py-0.5 rounded-sm border uppercase tracking-widest",
          LISTING_STATUS_CLS[st] ?? "text-muted-foreground border-rule")}>
          {st ? String(st) : "unverified"}
        </span>
      </div>
      {asset.sourceUrl ? (
        <a href={asset.sourceUrl} target="_blank" rel="noopener noreferrer"
           className="inline-flex items-start gap-2 font-body-base text-[13px] text-amber hover:underline break-all mb-2">
          <ExternalLink className="w-3 h-3 shrink-0 mt-1" />{String(asset.sourceUrl)}
        </a>
      ) : (
        <p className="font-body-base text-[13px] text-muted-foreground mb-2">No source URL on record — added manually.</p>
      )}
      <p className="font-body-base text-[12px] text-muted-foreground">
        {asset.lastVerifiedAt
          ? `Last checked ${Math.max(0, Math.round((Date.now() - Number(asset.lastVerifiedAt)) / 86400000))}d ago`
          : "Never checked against the live web"}
        {asset.updatedAt ? ` · record updated ${new Date(Number(asset.updatedAt)).toLocaleDateString()}` : ""}
      </p>
      {note && (
        <p className="font-body-base text-[13px] text-ink/80 leading-relaxed border-l-2 border-amber pl-4 mt-3">{note}</p>
      )}
      {!!citations.length && (
        <div className="flex flex-wrap gap-2 mt-3">
          {citations.slice(0, 6).map((c: string, i: number) => (
            <a key={i} href={c} target="_blank" rel="noopener noreferrer"
               className="font-eyebrow text-eyebrow px-2 py-0.5 rounded-sm border border-rule text-muted-foreground hover:text-amber hover:border-amber/40 uppercase tracking-widest">
              source {i + 1}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function NarrativePanel({ narrative }: { narrative: { summary: string; strengths: string[]; risks: string[] } | null }) {
  if (!narrative) return null;
  return (
    <div>
      <SectionLabel className="mb-3">Analyst Narrative</SectionLabel>
      <p className="font-body-base text-body-base text-ink/85 leading-relaxed">{narrative.summary}</p>
      {(narrative.strengths.length > 0 || narrative.risks.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div>{narrative.strengths.slice(0, 4).map((x, i) => (
            <p key={i} className="font-body-base text-[13px] text-ink/80 mb-1"><span className="text-sage">✓</span> {x}</p>
          ))}</div>
          <div>{narrative.risks.slice(0, 4).map((x, i) => (
            <p key={i} className="font-body-base text-[13px] text-ink/80 mb-1"><span className="text-clay">!</span> {x}</p>
          ))}</div>
        </div>
      )}
    </div>
  );
}
