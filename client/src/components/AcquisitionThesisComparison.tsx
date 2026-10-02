import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import type { compareAcquisitionToThesis } from "@shared/acquisitionThesisComparison";
import { AlignmentPortrait } from "./AlignmentPortrait";
import { AcquisitionV2Report } from "./AcquisitionV2Report";
import type { AlignmentMeasure } from "@shared/alignmentPortrait";

type Comparison = ReturnType<typeof compareAcquisitionToThesis>;

export function AcquisitionCriterionDetail({ comparison }: { comparison: Comparison }) {
  const missing = comparison.dimensions.filter(row => row.score == null);
  return <div className="space-y-6">
    <section aria-label="Criteria summary">
      <h3 className="mb-2 text-sm font-semibold">Your criteria</h3>
      <div className="divide-y divide-border rounded-lg border border-border">
        {comparison.dimensions.map(row => <div key={row.dimension} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2 text-sm">
          <span>{row.dimension}<span className="ml-2 text-muted-foreground">{row.weight}% weight</span></span>
          <span className="font-medium tabular-nums">{row.score == null ? "Not established" : `${row.contribution!.toFixed(1)} pts`}</span>
        </div>)}
      </div>
      {missing.length > 0 && <p className="mt-2 text-sm text-muted-foreground">{missing.length} criteria still need evidence. Missing information is not a positive or neutral score.</p>}
    </section>
    {comparison.dimensions.filter(row => row.score != null).map(row => <section key={row.dimension} className="space-y-2">
      <h3 className="font-semibold">{row.dimension}</h3><p className="text-sm leading-6">{row.explanation}</p>
      {row.evidence.map((evidence, index) => <blockquote key={index} className="border-l-2 border-border pl-3 text-sm leading-6">
        <p>{evidence.quote}</p><a className="inline-flex min-h-11 items-center gap-1 underline" href={evidence.sourceUrl} target="_blank" rel="noopener noreferrer">Inspect source claim<ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></a>
      </blockquote>)}
    </section>)}
  </div>;
}

export function AcquisitionThesisComparison({ jobId }: { jobId: number }) {
  const { data, isLoading, isError, refetch } = trpc.scan.getThesisComparison.useQuery({ jobId });
  if (isLoading) return <p role="status" className="p-4 text-sm">Loading shortlist…</p>;
  if (isError) return <div role="alert" className="p-4 text-sm">Thesis comparison could not load. This is not a no-opportunity result. <button className="underline min-h-11" onClick={() => refetch()}>Retry comparison</button></div>;
  if (!data) return <AcquisitionV2Report jobId={jobId} />;
  return <section aria-label="Thesis comparison" className="border-t border-border p-4 sm:p-5">
    <AcquisitionV2Report jobId={jobId} />
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs uppercase tracking-widest text-muted-foreground">Thesis match</p><h3 className="mt-1 text-2xl font-serif">Your shortlist <span className="text-muted-foreground">/ {data.items.length}</span></h3></div>
      <p className="text-sm text-muted-foreground">Saved {new Date(data.createdAt).toLocaleDateString()}</p>
    </header>
    <p className="mb-4 text-sm text-muted-foreground">Ranked by supported criteria—not expected returns. Seller claims are unverified.</p>
    {data.stale && <p role="alert" className="mb-4 border-l-2 border-[var(--sh-signal)] pl-3 text-sm">This comparison is out of date. Recheck sources before relying on it.</p>}
    {!data.items.length && <p>No candidates passed the source and financial screen. Review the criteria and screening reasons above.</p>}
    <div className="hunter-shortlist" aria-label="Opportunity profiles">
      {data.items.map((item, index) => <article key={item.dealId} className="hunter-profile">
        <div className="mb-3 flex items-center justify-between gap-2"><span className="font-mono text-sm text-muted-foreground">{String(index + 1).padStart(2, "0")}</span><span className="rounded border border-border px-2 py-1 text-xs font-medium">{item.assessmentFailed ? "Assessment unavailable" : item.comparison.score == null ? "Fit incomplete" : `Assessed fit: ${item.comparison.score.toFixed(0)}/100`}</span></div>
        <AlignmentPortrait compact title={item.name} subtitle="Saved listing · reported, not independently verified" stale={Boolean(data.stale)} measures={[
          { id: "asking", label: "Asking price", value: item.financials?.askingPrice ?? null, min: data.financialBounds?.askingPriceMin, max: data.financialBounds?.askingPriceMax, unit: "usd", basis: "reported", wanted: "Price within your range", explanation: "Asking price captured with this search. The band uses the search's saved financial bounds, not current edits to your thesis." },
          { id: "cash", label: "Annual cash flow", value: item.financials?.cashFlow ?? null, min: data.financialBounds?.cashFlowMin, max: data.financialBounds?.cashFlowMax, unit: "usd", basis: "reported", wanted: "Documented cash flow", explanation: "Reported cash flow is not audited earnings. Reconcile owner compensation, add-backs and recurring expenses before debt sizing." },
          ...item.comparison.dimensions.filter(row => row.score == null).slice(0, 2).map(row => ({ id: row.dimension, label: "Thesis condition", value: null, unit: "number", basis: "unknown", wanted: row.dimension, explanation: row.explanation || "This saved assessment does not establish the condition. Inspect the criterion and request supporting evidence." } as AlignmentMeasure)),
        ]} />
        {item.assessmentFailed ? <p role="alert" className="mt-3 text-sm">No thesis-fit conclusion is available.</p> : <div className="mb-4">
          <p className="text-sm"><strong className="text-xl tabular-nums">{item.comparison.coveredWeight}%</strong> evidence coverage</p>
          <div aria-hidden="true" className="my-2 h-1 overflow-hidden rounded bg-[var(--sh-border-1)]"><div className="h-full bg-[var(--sh-fg-muted)]" style={{ width: `${item.comparison.coveredWeight}%` }} /></div>
          <p className="text-sm text-muted-foreground">{item.comparison.dimensions.filter(row => row.score != null).length} of {item.comparison.dimensions.length} criteria supported · weighted coverage</p>
        </div>}
        <div className="hunter-profile-actions">
          <Sheet><SheetTrigger asChild><Button variant="outline" className="min-h-11" aria-label={`Compare evidence for ${item.name}`}>Compare evidence</Button></SheetTrigger>
            <SheetContent className="w-full overflow-y-auto sm:max-w-xl motion-reduce:transition-none motion-reduce:animate-none [&>button]:min-h-11 [&>button]:min-w-11">
              <SheetHeader className="border-b border-border pr-16"><SheetTitle className="font-serif text-xl">{item.name}</SheetTitle><SheetDescription>Source claims, not verified facts. {item.comparison.score == null ? "Overall fit remains incomplete." : "Weighted assessment—not a return forecast."}</SheetDescription></SheetHeader>
              <div className="space-y-5 px-4 pb-6">
                {data.stale && <p role="alert" className="text-sm">Saved comparison is out of date. Recheck sources.</p>}
                {item.assessmentFailed ? <p role="alert">Assessment unavailable. No thesis-fit conclusion can be drawn.</p> : <AcquisitionCriterionDetail comparison={item.comparison} />}
                <Link href={`/deal/${item.dealId}`} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--sh-text-primary)] px-4 text-sm text-[var(--sh-surface)]">Review opportunity<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
                <p className="text-sm text-muted-foreground">Saved {new Date(data.createdAt).toLocaleString()} · Thesis #{data.thesisId} · Search #{jobId}</p>
              </div>
            </SheetContent>
          </Sheet>
          <Link href={`/deal/${item.dealId}`} className="inline-flex min-h-11 items-center gap-1 text-sm underline">Open opportunity<ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link>
        </div>
      </article>)}
    </div>
  </section>;
}
