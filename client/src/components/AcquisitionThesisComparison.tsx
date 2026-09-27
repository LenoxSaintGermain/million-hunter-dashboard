import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

export function AcquisitionThesisComparison({ jobId }: { jobId: number }) {
  const { data, isLoading, isError, refetch } = trpc.scan.getThesisComparison.useQuery({ jobId });
  if (isLoading) return <p role="status" className="p-4 text-sm">Loading thesis comparison…</p>;
  if (isError) return <div role="alert" className="p-4 text-sm">Thesis comparison could not load. This is not a no-opportunity result. <button className="underline min-h-11" onClick={() => refetch()}>Retry comparison</button></div>;
  if (!data) return null;
  return <section aria-label="Thesis comparison" className="border-t border-border p-4 space-y-3">
    <h3 className="font-semibold">How these opportunities fit your thesis</h3>
    <p className="text-sm text-muted-foreground">Ordered by supported weighted points, not expected returns. Broker claims are unverified. Missing evidence keeps the overall score incomplete.</p>
    {data.stale && <p role="alert" className="text-sm">This saved comparison is out of date. Recheck source availability and claims before relying on it.</p>}
    <p className="text-sm text-muted-foreground">Saved {new Date(data.createdAt).toLocaleString()} · Thesis #{data.thesisId} · Search #{jobId}</p>
    {!data.items.length && <p>No candidates passed the source and financial screen. Review the criteria and screening reasons above.</p>}
    {data.items.map(item => <article key={item.dealId} className="border-t border-border pt-3 space-y-2">
      <h4 className="font-medium">{item.name}</h4>
      {item.assessmentFailed ? <p role="alert">Assessment unavailable. No thesis-fit conclusion can be drawn.</p> :
        <p>{item.comparison.score == null ? "Fit incomplete" : `Assessed fit: ${item.comparison.score.toFixed(0)}/100`} · {item.comparison.coveredWeight}% of weighted criteria has source evidence</p>}
      <details>
        <summary className="min-h-11 cursor-pointer py-3 text-sm">Criteria, evidence and missing information</summary>
        <ul className="space-y-3 text-sm">
          {item.comparison.dimensions.map(row => <li key={row.dimension}>
            <p className="font-medium">{row.dimension} · weight {row.weight}% · {row.score == null ? "Not established" : `${row.contribution!.toFixed(1)} points`}</p>
            <p>{row.explanation}</p>
            {row.evidence.map((evidence, index) => <blockquote key={index} className="border-l border-border pl-3 my-2">
              <p>{evidence.quote}</p><a className="underline inline-flex min-h-11 items-center" href={evidence.sourceUrl} target="_blank" rel="noopener noreferrer">Inspect source claim</a>
            </blockquote>)}
          </li>)}
        </ul>
      </details>
      <Link href={`/deal/${item.dealId}`} className="inline-flex min-h-11 items-center underline text-sm">Review opportunity evidence</Link>
    </article>)}
  </section>;
}
