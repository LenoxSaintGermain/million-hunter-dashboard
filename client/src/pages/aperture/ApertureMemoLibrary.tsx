/**
 * Capital Aperture Memo Library — persistent, cross-run index of candidate memos.
 * INTERNAL RESEARCH TOOL — NOT INVESTMENT ADVICE.
 */
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, FileText, Search, ShieldAlert, SkipForward } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/DashboardLayout";

const roleLabel: Record<string, string> = {
  core: "Core",
  complementary: "Complementary",
  remainder: "Remainder",
  alternative_expression: "Alt expression",
};

export default function ApertureMemoLibrary() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const { data, isLoading } = trpc.aperture.memo.list.useQuery();

  const memos = useMemo(() => (data ?? []).filter((row) => {
    const searchable = `${row.candidate.symbol} ${row.thesisName ?? ""} ${row.candidate.role}`.toLowerCase();
    return searchable.includes(query.trim().toLowerCase());
  }), [data, query]);

  const approved = data?.filter((row) => row.candidate.memoStatus === "ok").length ?? 0;
  const needsEvidence = data?.filter((row) => row.candidate.memoStatus !== "ok").length ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="border-b border-rule pb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-eyebrow text-eyebrow text-amber uppercase tracking-widest mb-3">Capital Aperture · Research Record</p>
            <h1 className="font-display text-[clamp(2.2rem,5vw,4.25rem)] leading-[0.92] tracking-[-0.04em] text-ink">Memo Library</h1>
            <p className="font-body-base text-body-base text-muted-foreground max-w-2xl mt-4">Every candidate memo is retained with its originating run, thesis, score, citations, and validation outcome. A memo is evidence—not a trade instruction.</p>
          </div>
          <div className="flex gap-5 border-t border-rule pt-4 lg:border-t-0 lg:pt-0">
            <div><p className="font-data-mono text-data-mono text-muted-foreground uppercase">Validated</p><p className="font-display text-3xl text-ink mt-1">{approved}</p></div>
            <div className="pl-5 border-l border-rule"><p className="font-data-mono text-data-mono text-muted-foreground uppercase">Needs evidence</p><p className="font-display text-3xl text-clay mt-1">{needsEvidence}</p></div>
          </div>
        </header>

        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search symbol, thesis, or role" className="pl-9 bg-paper border-rule" />
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-px bg-rule border border-rule">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-44 bg-paper animate-pulse" />)}</div>
        ) : memos.length === 0 ? (
          <div className="border border-rule bg-paper py-20 px-6 text-center">
            <FileText className="w-9 h-9 text-amber mx-auto mb-4" />
            <p className="font-card-title text-xl text-ink">No generated candidate memos yet.</p>
            <p className="font-body-base text-body-base text-muted-foreground max-w-md mx-auto mt-2">Run a thesis, select a candidate, then choose <strong className="text-ink">Generate Memo</strong>. It will be saved here automatically with its source trail.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-px bg-rule border border-rule">
            {memos.map(({ candidate, run, thesisName }) => {
              const isOk = candidate.memoStatus === "ok";
              const Icon = isOk ? CheckCircle2 : candidate.memoStatus === "skipped" ? SkipForward : ShieldAlert;
              return (
                <button key={candidate.id} onClick={() => navigate(`/aperture/memos/${candidate.id}`)} className="group text-left bg-paper p-6 hover:bg-bone transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-data-mono text-data-mono text-muted-foreground uppercase">{thesisName ?? `Run #${run.id}`}</p>
                      <div className="flex items-baseline gap-2 mt-2"><h2 className="font-display text-3xl tracking-[-0.03em] text-ink">{candidate.symbol}</h2><span className="font-data-mono text-data-mono text-muted-foreground">{roleLabel[candidate.role] ?? candidate.role}</span></div>
                    </div>
                    <Icon className={`w-5 h-5 ${isOk ? "text-sage" : "text-clay"}`} />
                  </div>
                  <div className="mt-7 pt-4 border-t border-rule flex items-center justify-between">
                    <Badge variant="outline" className={isOk ? "border-sage/30 text-sage" : "border-clay/30 text-clay"}>{isOk ? "Validated memo" : candidate.memoStatus}</Badge>
                    <span className="font-eyebrow text-eyebrow uppercase tracking-widest text-amber group-hover:underline">Continue decision →</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
