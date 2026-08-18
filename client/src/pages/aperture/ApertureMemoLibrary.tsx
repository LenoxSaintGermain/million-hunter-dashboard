/**
 * Capital Aperture memo triage — compact, mobile-first research record.
 * INTERNAL RESEARCH TOOL — NOT INVESTMENT ADVICE.
 */
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, ChevronDown, FileText, Search, ShieldAlert, SkipForward, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/DashboardLayout";

const roleLabel: Record<string, string> = { core: "Core", complementary: "Complementary", remainder: "Remainder", alternative_expression: "Alt expression" };
type Filter = "all" | "validated" | "needs";

function statusLabel(status: string | null) {
  if (status === "ok") return "Validated";
  if (status === "skipped") return "Needs facts";
  return "Needs review";
}

export default function ApertureMemoLibrary() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data, isLoading } = trpc.aperture.memo.list.useQuery();
  const { data: selectedDetail } = trpc.aperture.memo.get.useQuery({ candidateId: selectedId ?? 0 }, { enabled: selectedId !== null });

  const totals = useMemo(() => ({
    validated: data?.filter((row) => row.candidate.memoStatus === "ok").length ?? 0,
    needs: data?.filter((row) => row.candidate.memoStatus !== "ok").length ?? 0,
  }), [data]);
  const memos = useMemo(() => (data ?? []).filter((row) => {
    const searchable = `${row.candidate.symbol} ${row.thesisName ?? ""} ${row.candidate.role}`.toLowerCase();
    const matchesQuery = searchable.includes(query.trim().toLowerCase());
    const matchesStatus = filter === "all" || (filter === "validated" ? row.candidate.memoStatus === "ok" : row.candidate.memoStatus !== "ok");
    return matchesQuery && matchesStatus;
  }), [data, filter, query]);
  const selectedRow = data?.find((row) => row.candidate.id === selectedId);
  const selectedMemo = selectedDetail?.candidate.memo as any;

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-7">
        <header className="flex flex-col gap-4 border-b border-rule pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-eyebrow text-eyebrow text-amber uppercase tracking-widest">Capital Aperture · Memo triage</p>
            <h1 className="mt-1 font-card-title text-[clamp(1.75rem,4vw,2.5rem)] leading-none text-ink">Research records</h1>
            <p className="mt-2 max-w-xl font-body-base text-body-base text-muted-foreground">Open a record here, decide what needs attention, then continue to the same evidence queue. A memo is research—not a trade instruction.</p>
          </div>
          <div className="flex items-center gap-2 text-xs" title="Validated means every figure in the memo traces to a source fact. Needs review means a fact-only record or more evidence is required.">
            <button onClick={() => setFilter(filter === "validated" ? "all" : "validated")} className={`rounded-full border px-3 py-2 text-left ${filter === "validated" ? "border-sage bg-sage/10 text-sage" : "border-rule bg-paper text-ink"}`}><span className="font-data-mono text-lg">{totals.validated}</span> <span className="font-eyebrow text-eyebrow">validated</span></button>
            <button onClick={() => setFilter(filter === "needs" ? "all" : "needs")} className={`rounded-full border px-3 py-2 text-left ${filter === "needs" ? "border-clay bg-clay/10 text-clay" : "border-rule bg-paper text-ink"}`}><span className="font-data-mono text-lg">{totals.needs}</span> <span className="font-eyebrow text-eyebrow">needs review</span></button>
          </div>
        </header>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a symbol or thesis" className="h-10 bg-paper pl-9 border-rule" /></div>
          {filter !== "all" && <button onClick={() => setFilter("all")} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-ink"><X className="h-3 w-3" /> Clear filter</button>}
        </div>

        {isLoading ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 animate-pulse border border-rule bg-paper" />)}</div>
          : memos.length === 0 ? <div className="border border-rule bg-paper p-10 text-center"><FileText className="mx-auto mb-3 h-8 w-8 text-amber" /><p className="font-card-title text-lg text-ink">No records match this filter.</p><button onClick={() => { setFilter("all"); setQuery(""); }} className="mt-3 text-xs text-amber hover:underline">Show all memo records</button></div>
          : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {memos.map(({ candidate, run, thesisName }) => {
              const isOpen = candidate.id === selectedId;
              const isOk = candidate.memoStatus === "ok";
              const Icon = isOk ? CheckCircle2 : candidate.memoStatus === "skipped" ? SkipForward : ShieldAlert;
              return <button key={candidate.id} onClick={() => setSelectedId(isOpen ? null : candidate.id)} className={`group min-h-[132px] border p-4 text-left transition-colors ${isOpen ? "border-amber bg-bone" : "border-rule bg-paper hover:bg-bone"}`}>
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-eyebrow text-eyebrow text-muted-foreground uppercase">{thesisName ?? `Run #${run.id}`}</p><div className="mt-2 flex items-baseline gap-2"><h2 className="font-card-title text-2xl text-ink">{candidate.symbol}</h2><span className="font-data-mono text-data-mono text-muted-foreground">{roleLabel[candidate.role] ?? candidate.role}</span></div></div><Icon className={`h-4 w-4 shrink-0 ${isOk ? "text-sage" : "text-clay"}`} /></div>
                <div className="mt-4 flex items-center justify-between border-t border-rule pt-3"><Badge variant="outline" className={isOk ? "border-sage/30 text-sage" : "border-clay/30 text-clay"}>{statusLabel(candidate.memoStatus)}</Badge><span className="inline-flex items-center gap-1 font-eyebrow text-eyebrow text-amber">{isOpen ? "Close" : "Review"}<ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} /></span></div>
              </button>;
            })}
          </div>}

        {selectedRow && <section className="border border-amber/40 bg-bone p-4 sm:p-5" aria-live="polite">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-eyebrow text-eyebrow text-amber">Open research record · {selectedRow.candidate.symbol}</p><h2 className="mt-1 font-card-title text-xl text-ink">{selectedMemo?.generationBasis === "fact_ledger_fallback" ? "Fact-ledger recovery record" : selectedRow.candidate.memoStatus === "ok" ? "Validated decision record" : "Evidence needs attention"}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-ink/75">{selectedMemo?.thesisFit ?? selectedRow.candidate.memoRejectReason ?? "This record needs more sourced evidence before it can support a paper-review decision."}</p></div><Badge variant="outline">{statusLabel(selectedRow.candidate.memoStatus)}</Badge></div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-rule pt-4"><button onClick={() => navigate(`/aperture/run/${selectedRow.run.id}?view=evidence`)} className="bg-ink px-4 py-2 font-eyebrow text-eyebrow text-bone hover:opacity-90">Open decisive checks</button><button onClick={() => navigate(`/aperture/memos/${selectedRow.candidate.id}`)} className="border border-rule bg-paper px-4 py-2 font-eyebrow text-eyebrow text-ink hover:border-amber">Full research record</button><button onClick={() => setSelectedId(null)} className="px-2 text-xs text-muted-foreground hover:text-ink">Close</button></div>
        </section>}
      </main>
    </DashboardLayout>
  );
}
