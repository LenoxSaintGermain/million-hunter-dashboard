/**
 * Verification Queue — /verify (operator only)
 *
 * Confidence caps every tier, so five of seven assets read as "Archive" when the
 * real problem is that nobody has confirmed their year built. This page pools
 * every unverified critical field across the pipeline, ranks assets by how much
 * rank they would GAIN once confirmed, researches each field against public
 * records with citations, and writes it back on explicit accept.
 *
 * Nothing enters the record unreviewed: research returns a proposal, an operator
 * accepts it, and the asset rescores in place so the unlock is visible.
 */
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import EditorialTopNav from "@/components/EditorialTopNav";
import { listAssetClasses, getAssetClass } from "@shared/assetClasses";
import { isTutorialAsset } from "@shared/tutorial";
import { toast } from "sonner";
import {
  Loader2, ShieldCheck, ArrowRight, ExternalLink, Check, X, Search, GraduationCap,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Proposal = {
  field: string; short: string; parsed: any; summary: string;
  note: string; citations: string[]; applicable: boolean;
};

export default function VerificationQueue() {
  const [assetClass, setAssetClass] = useState("historic");
  const [active, setActive] = useState<{ id: number; field: string } | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);

  const q = trpc.scout.verificationQueue.useQuery({ assetClass }, { refetchOnWindowFocus: false });

  const research = trpc.scout.researchField.useMutation({
    onSuccess: (r: any) => {
      setProposal(r);
      if (!r.applicable) toast.warning("Inconclusive — nothing to accept from this search.");
    },
    onError: (e) => { toast.error(e.message); setActive(null); },
  });

  const accept = trpc.scout.acceptFieldValue.useMutation({
    onSuccess: (r: any) => {
      toast.success(
        `Confirmed — confidence ${Math.round(r.confidenceScore * 100)}%, rank ${r.rankScore}` +
        (r.remainingFields.length ? ` · ${r.remainingFields.length} field(s) left` : " · fully verified"),
      );
      setActive(null); setProposal(null); q.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const data = q.data;
  const rows = data?.assets ?? [];

  const startResearch = (id: number, field: string) => {
    setActive({ id, field });
    setProposal(null);
    research.mutate({ id, field });
  };

  return (
    <EditorialTopNav>
      <div className="max-w-[1280px] mx-auto w-full px-6 lg:px-10 py-10">

        <div className="flex items-start justify-between gap-6 flex-wrap border-b border-rule pb-8 mb-8">
          <div className="max-w-2xl">
            <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-2 inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-sage" /> Verification queue
            </p>
            <h1 className="font-hero-h1 text-[clamp(2rem,4vw,3rem)] text-ink leading-[1.05] mb-3">
              Unlock what you already own
            </h1>
            <p className="font-body-base text-body-base text-muted-foreground leading-relaxed">
              An unverified field is scored conservatively and caps the asset below Tier 1. These are
              not rejections — they are the research queue. Confirm a field and the tier moves.
            </p>
          </div>

          <div className="flex items-center gap-6 shrink-0">
            <div>
              <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-1">Open fields</p>
              <p className="font-data-mono text-section-h2 text-ink leading-none">{data?.totalOpenFields ?? "—"}</p>
            </div>
            <div>
              <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-1">Rank locked up</p>
              <p className="font-data-mono text-section-h2 text-amber leading-none">
                +{data?.totalRankUpside ?? "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8 max-w-[240px]">
          <Select value={assetClass} onValueChange={setAssetClass}>
            <SelectTrigger className="h-9 text-xs border-rule bg-transparent"><SelectValue /></SelectTrigger>
            <SelectContent>
              {listAssetClasses().map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {q.isLoading ? (
          <div className="flex items-center gap-3 py-16">
            <Loader2 className="w-4 h-4 animate-spin text-amber" />
            <span className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Building queue</span>
          </div>
        ) : !rows.length ? (
          <p className="font-body-base text-body-base text-muted-foreground py-16">
            Nothing outstanding — every {getAssetClass(assetClass).shortLabel} asset has its critical
            fields confirmed.
          </p>
        ) : (
          <div className="divide-y divide-rule border-t border-rule">
            {rows.map((row: any) => (
              <div key={row.id} className="py-6">
                <div className="flex items-start justify-between gap-6 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Link href={`/wingate/asset/${row.id}`}>
                        <span className="font-card-title text-[19px] text-ink leading-tight hover:text-amber cursor-pointer">
                          {row.name}
                        </span>
                      </Link>
                      {isTutorialAsset(row) && (
                        <span className="font-eyebrow text-eyebrow px-2 py-0.5 rounded-sm border border-amber/50 bg-amber/10 text-amber uppercase tracking-widest inline-flex items-center gap-1">
                          <GraduationCap className="w-3 h-3" /> Tutorial
                        </span>
                      )}
                    </div>
                    <p className="font-body-base text-[12px] text-muted-foreground">
                      {row.city}, {row.state} · rank {row.currentRank} · confidence {Math.round(row.confidenceScore * 100)}%
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-1">Rank if confirmed</p>
                    <p className="font-data-mono text-[22px] text-amber leading-none">
                      {row.potentialRank}
                      <span className="text-[13px] text-muted-foreground ml-2">+{row.rankUpside}</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  {row.fields.map((f: any) => {
                    const isActive = active?.id === row.id && active?.field === f.key;
                    const pending = isActive && research.isPending;
                    return (
                      <button
                        key={f.key}
                        onClick={() => startResearch(row.id, f.key)}
                        disabled={research.isPending || accept.isPending}
                        className={cn(
                          "inline-flex items-center gap-1.5 font-eyebrow text-eyebrow px-3 py-1.5 rounded-sm border uppercase tracking-widest transition-all disabled:opacity-50",
                          isActive ? "border-amber/60 bg-amber/10 text-amber" : "border-rule text-muted-foreground hover:border-amber/40 hover:text-amber",
                        )}
                      >
                        {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                        {f.short}
                      </button>
                    );
                  })}
                </div>

                {/* Proposal for this asset's active field */}
                {active?.id === row.id && proposal && (
                  <div className="mt-5 border border-rule bg-paper p-5 max-w-3xl">
                    <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-2">
                      Proposed · {proposal.short}
                    </p>
                    <p className="font-card-title text-[18px] text-ink leading-tight mb-2">{proposal.summary}</p>
                    {proposal.note && (
                      <p className="font-body-base text-[13px] text-ink/80 leading-relaxed mb-3">{proposal.note}</p>
                    )}

                    {!!proposal.citations.length && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {proposal.citations.map((c, i) => (
                          <a key={i} href={c} target="_blank" rel="noopener noreferrer"
                             className="font-eyebrow text-eyebrow px-2 py-0.5 rounded-sm border border-rule text-muted-foreground hover:text-amber hover:border-amber/40 uppercase tracking-widest inline-flex items-center gap-1">
                            <ExternalLink className="w-2.5 h-2.5" /> source {i + 1}
                          </a>
                        ))}
                      </div>
                    )}

                    {proposal.applicable ? (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => accept.mutate({ id: row.id, field: proposal.field, parsed: proposal.parsed, citations: proposal.citations })}
                          disabled={accept.isPending}
                          className="inline-flex items-center gap-2 bg-ink text-bone font-eyebrow text-eyebrow px-4 py-2 rounded-full hover:opacity-90 transition-all uppercase tracking-widest disabled:opacity-50">
                          {accept.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Accept &amp; rescore
                        </button>
                        <button
                          onClick={() => { setActive(null); setProposal(null); }}
                          className="inline-flex items-center gap-2 border border-rule font-eyebrow text-eyebrow px-4 py-2 rounded-full hover:border-clay/50 hover:text-clay transition-all uppercase tracking-widest">
                          <X className="w-3 h-3" /> Discard
                        </button>
                      </div>
                    ) : (
                      <p className="font-body-base text-[12px] text-muted-foreground">
                        Inconclusive — the sources did not confirm this field. Try again later, or
                        confirm it manually from the county record.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="font-body-base text-[12px] text-muted-foreground mt-10 pt-6 border-t border-rule max-w-2xl">
          Research runs against public records via sonar-pro and returns citations. Nothing is written
          until you accept it, and every accepted value stamps its sources onto the asset's provenance.
        </p>
      </div>
    </EditorialTopNav>
  );
}
