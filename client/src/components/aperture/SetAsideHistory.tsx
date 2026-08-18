import { AlertTriangle } from "lucide-react";

export function SetAsideHistory({
  records,
  note,
}: {
  records: Array<{ id: number; symbol: string; reason: string; createdAt: number }>;
  note: string | null;
}) {
  return <section className="rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
    <div className="border-b px-4 py-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
      <p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>What research set aside</p>
      <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>These symbols were reviewed in this brief and did not clear a hard-stop rule. They are not missing search results.</p>
    </div>
    {note ? <div className="flex gap-2 px-4 py-3 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-signal)" }} />{note}</div> : records.length ? <div className="divide-y" style={{ borderColor: "var(--sh-border-1)" }}>{records.map((record) => <div key={record.id} className="flex gap-3 px-4 py-3"><span className="font-mono text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>{record.symbol}</span><p className="min-w-0 flex-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{record.reason}</p></div>)}</div> : <p className="px-4 py-3 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>No symbols were set aside by a recorded hard-stop rule in this brief.</p>}
  </section>;
}
