/**
 * Capital Aperture memo triage — compact, mobile-first research record.
 * INTERNAL RESEARCH TOOL — NOT INVESTMENT ADVICE.
 */
import { useEffect, useMemo, useRef, useState } from "react";
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

function MemoDetailPanel({ selectedRow, selectedMemo, onOpenChecks, onOpenFullRecord, onClose, panelRef }: {
  selectedRow: any;
  selectedMemo: any;
  onOpenChecks: () => void;
  onOpenFullRecord: () => void;
  onClose: () => void;
  panelRef?: React.RefObject<HTMLElement | null>;
}) {
  const candidate = selectedRow.candidate;
  const isValidated = candidate.memoStatus === "ok";
  return (
    <section ref={panelRef} tabIndex={-1} className="border border-amber/45 bg-bone p-4 shadow-[0_12px_32px_rgb(36_29_18/0.08)] sm:p-5" aria-live="polite" aria-label={`Research record ${candidate.symbol}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-eyebrow text-eyebrow text-amber">Selected record · {candidate.symbol}</p>
          <h2 className="mt-1 font-card-title text-xl text-ink">{selectedMemo?.generationBasis === "fact_ledger_fallback" ? "Fact-ledger recovery record" : isValidated ? "Validated decision record" : "Evidence needs attention"}</h2>
        </div>
        <button onClick={onClose} className="shrink-0 text-xs text-muted-foreground hover:text-ink">Close</button>
      </div>
      <p className="mt-3 text-sm leading-6 text-ink/75">{selectedMemo?.thesisFit ?? candidate.memoRejectReason ?? "This record needs more sourced evidence before it can support a paper-review decision."}</p>
      <div className="mt-4 grid gap-2 border-t border-rule pt-4 sm:grid-cols-2">
        <button onClick={onOpenChecks} className="bg-ink px-4 py-2.5 text-left font-eyebrow text-eyebrow text-bone hover:opacity-90">Open decisive checks <span className="block pt-1 font-body-base text-xs normal-case text-bone/65">Return to the exact evidence queue for this research run.</span></button>
        <button onClick={onOpenFullRecord} className="border border-rule bg-paper px-4 py-2.5 text-left font-eyebrow text-eyebrow text-ink hover:border-amber">Full research record <span className="block pt-1 font-body-base text-xs normal-case text-muted-foreground">View every fact, source, and memo section.</span></button>
      </div>
    </section>
  );
}

export default function ApertureMemoLibrary() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const detailRef = useRef<HTMLElement | null>(null);
  const { data, isLoading } = trpc.aperture.memo.list.useQuery();
  const { data: selectedDetail } = trpc.aperture.memo.get.useQuery({ candidateId: selectedId ?? 0 }, { enabled: selectedId !== null });

  const totals = useMemo(() => ({
    validated: data?.filter((row) => row.candidate.memoStatus === "ok").length ?? 0,
    needs: data?.filter((row) => row.candidate.memoStatus !== "ok").length ?? 0,
  }), [data]);
  const memos = useMemo(() => (data ?? []).filter((row) => {
    const searchable = `${row.candidate.symbol} ${row.thesisName ?? ""} ${row.candidate.role}`.toLowerCase();
    return searchable.includes(query.trim().toLowerCase()) && (filter === "all" || (filter === "validated" ? row.candidate.memoStatus === "ok" : row.candidate.memoStatus !== "ok"));
  }), [data, filter, query]);
  const selectedRow = data?.find((row) => row.candidate.id === selectedId);
  const selectedMemo = selectedDetail?.candidate.memo as any;

  useEffect(() => {
    if (!selectedId || !detailRef.current) return;
    const timer = window.setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 0);
    return () => window.clearTimeout(timer);
  }, [selectedId]);

  const detailProps = selectedRow ? {
    selectedRow,
    selectedMemo,
    onOpenChecks: () => navigate(`/aperture/run/${selectedRow.run.id}?view=evidence`),
    onOpenFullRecord: () => navigate(`/aperture/memos/${selectedRow.candidate.id}`),
    onClose: () => setSelectedId(null),
  } : null;

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-7">
        <header className="flex flex-col gap-4 border-b border-rule pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-eyebrow text-eyebrow text-amber uppercase tracking-widest">Capital Aperture · Memo triage</p>
            <h1 className="mt-1 font-card-title text-[clamp(1.75rem,4vw,2.5rem)] leading-none text-ink">Research records</h1>
            <p className="mt-2 max-w-xl font-body-base text-body-base text-muted-foreground">Open a record to see its decision answer immediately, then continue to the same evidence queue. A memo is research—not a trade instruction.</p>
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

        {selectedRow && detailProps && <div className="lg:hidden"><MemoDetailPanel {...detailProps} panelRef={detailRef} /></div>}

        {isLoading ? <div className="grid gap-2 sm:grid-cols-2">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 animate-pulse border border-rule bg-paper" />)}</div>
          : memos.length === 0 ? <div className="border border-rule bg-paper p-10 text-center"><FileText className="mx-auto mb-3 h-8 w-8 text-amber" /><p className="font-card-title text-lg text-ink">No records match this filter.</p><button onClick={() => { setFilter("all"); setQuery(""); }} className="mt-3 text-xs text-amber hover:underline">Show all memo records</button></div>
          : <div className={selectedRow ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(21rem,0.7fr)] lg:items-start" : ""}>
            <div className="grid gap-2 sm:grid-cols-2">
              {memos.map(({ candidate, run, thesisName }) => {
                const isOpen = candidate.id === selectedId;
                const isOk = candidate.memoStatus === "ok";
                const Icon = isOk ? CheckCircle2 : candidate.memoStatus === "skipped" ? SkipForward : ShieldAlert;
                return <button key={candidate.id} aria-pressed={isOpen} onClick={() => setSelectedId(isOpen ? null : candidate.id)} className={`group min-h-[122px] border p-4 text-left transition-colors ${isOpen ? "border-amber bg-bone ring-1 ring-amber/25" : "border-rule bg-paper hover:bg-bone"}`}>
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-eyebrow text-eyebrow text-muted-foreground uppercase">{thesisName ?? `Run #${run.id}`}</p><div className="mt-2 flex items-baseline gap-2"><h2 className="font-card-title text-2xl text-ink">{candidate.symbol}</h2><span className="font-data-mono text-data-mono text-muted-foreground">{roleLabel[candidate.role] ?? candidate.role}</span></div></div><Icon className={`h-4 w-4 shrink-0 ${isOk ? "text-sage" : "text-clay"}`} /></div>
                  <div className="mt-4 flex items-center justify-between border-t border-rule pt-3"><Badge variant="outline" className={isOk ? "border-sage/30 text-sage" : "border-clay/30 text-clay"}>{statusLabel(candidate.memoStatus)}</Badge><span className="inline-flex items-center gap-1 font-eyebrow text-eyebrow text-amber">{isOpen ? "Selected" : "Review"}<ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} /></span></div>
                </button>;
              })}
            </div>
            {selectedRow && detailProps && <aside className="sticky top-4 hidden lg:block"><MemoDetailPanel {...detailProps} panelRef={detailRef} /></aside>}
          </div>}
      </main>
    </DashboardLayout>
  );
}
