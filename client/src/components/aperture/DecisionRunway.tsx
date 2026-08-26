import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, CircleSlash2, FileSearch, Library, ShieldCheck, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { DailyPlayList } from "./DailyPlayList";

type Props = {
  onNewResearch: () => void;
  onOpenRun: (runId: number, candidateId: number, view?: string) => void;
};

const DEFAULT_MISSIONS = [
  {
    id: "evidence",
    label: "Verify a dated catalyst",
    text: "Verify the stated catalyst, transmission mechanism, liquidity, invalidation condition, and paper-only decision window before considering any candidate.",
    reason: "Turns an existing thesis into one falsifiable paper-research question.",
  },
  {
    id: "overlap",
    label: "Check portfolio overlap",
    text: "Identify whether the active Capital thesis creates correlated exposure with the current paper portfolio, and keep cash if that overlap cannot be measured.",
    reason: "Uses the linked paper account only to measure concentration and overlap—not to direct an order.",
  },
  {
    id: "cash",
    label: "Preserve cash pending evidence",
    text: "Preserve cash until a dated catalyst, evidence record, liquidity check, and invalidation condition resolve clearly enough for paper research.",
    reason: "Cash is a recorded operator decision, not a missing recommendation.",
  },
] as const;

function readableBranch(branch: "research" | "eligible" | "conditional" | "cash") {
  return branch === "cash" ? "Cash / no-trade recorded" : branch === "conditional" ? "Conditional — verification required" : branch === "eligible" ? "Eligible for paper research" : "Research context ready";
}

export function DecisionRunway({ onNewResearch, onOpenRun }: Props) {
  const [mission, setMission] = useState("");
  const [reason, setReason] = useState("");
  const [showLibrary, setShowLibrary] = useState(false);
  const [selectedCanonicalId, setSelectedCanonicalId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const { data: runway } = trpc.aperture.runway.latest.useQuery();
  const { data: canonicalTheses } = trpc.thesis.list.useQuery();
  const { data: capitalTheses } = trpc.aperture.thesis.list.useQuery();
  const { data: accounts } = trpc.aperture.account.list.useQuery();
  const activeCanonicalId = selectedCanonicalId ?? runway?.activeCanonicalThesisId ?? null;
  const activeThesis = useMemo(() => (canonicalTheses ?? []).find((item) => item.id === activeCanonicalId) ?? null, [canonicalTheses, activeCanonicalId]);
  const capitalLibrary = useMemo(() => (capitalTheses ?? []).filter((item) => item.sourceCompilationId != null), [capitalTheses]);
  const paperAccount = useMemo(() => (accounts ?? []).find((item) => item.isPaper && item.brokerId === "alpaca_paper") ?? (accounts ?? []).find((item) => item.isPaper) ?? null, [accounts]);
  const saveMission = trpc.aperture.runway.begin.useMutation({
    onSuccess: () => void utils.aperture.runway.latest.invalidate(),
  });

  const currentMission = mission || runway?.latest?.missionText || "";
  const status = runway?.latest ? readableBranch(runway.latest.branch) : "Choose one decision";
  const statusColor = runway?.latest?.branch === "cash" ? "var(--sh-signal)" : "var(--sh-text-primary)";
  const startMission = (branch: "research" | "conditional" | "cash") => {
    const text = mission.trim();
    if (text.length < 20) return;
    saveMission.mutate({
      missionText: text,
      canonicalThesisId: activeThesis?.id ?? null,
      accountId: paperAccount?.id ?? null,
      branch,
      reason: branch === "cash" ? reason.trim() : null,
    }, {
      onSuccess: () => {
        if (branch === "research") onNewResearch();
        if (branch === "cash") setMission("");
      },
    });
  };

  return <section className="mx-auto max-w-[1440px] space-y-5 pb-24">
    <header className="grid gap-5 rounded-2xl border p-5 lg:grid-cols-[minmax(0,1fr)_22rem]" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-signal)" }}><Target className="h-3.5 w-3.5" /> Capital Aperture · Decision Runway</p>
        <h1 className="mt-2 font-serif text-3xl leading-tight" style={{ color: "var(--sh-text-primary)" }}>Orient. Choose one decision. Verify what matters.</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>This is a paper-only decision workspace. It preserves what you knew, the branch you selected, and why cash, a condition, or further research was appropriate. It never creates, approves, or submits an order.</p>
      </div>
      <div className="rounded-xl border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.13em]" style={{ color: "var(--sh-fg-muted)" }}>Active context</p>
        <p className="mt-1 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{activeThesis?.name ?? "No active Capital thesis"}</p>
        <p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{paperAccount ? `${paperAccount.label} · paper account${paperAccount.lastSyncedAt ? ` · synced ${new Date(paperAccount.lastSyncedAt).toLocaleString()}` : " · sync not measured"}` : "No paper account in scope"}</p>
        <p className="mt-3 text-xs font-semibold" style={{ color: statusColor }}>{status}</p>
      </div>
    </header>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(21rem,28rem)]">
      <section className="space-y-5">
        <div className="rounded-2xl border p-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Capital Mission</p><h2 className="mt-1 font-serif text-2xl" style={{ color: "var(--sh-text-primary)" }}>What is the single paper decision you need to make?</h2></div><Button type="button" variant="outline" className="min-h-11" onClick={() => setShowLibrary((value) => !value)}><Library className="mr-2 h-4 w-4" />Mission library</Button></div>
          <label htmlFor="capital-mission" className="sr-only">Capital Mission</label>
          <Textarea id="capital-mission" value={mission} onChange={(event) => setMission(event.target.value)} className="mt-4 min-h-28 text-sm leading-6" placeholder="Example: Verify whether the active catalyst still supports a paper swing setup before its deadline, or preserve cash if the evidence is incomplete." />
          <div className="mt-3 rounded-lg border p-3 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)" }}><span className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>Mission preview:</span> {currentMission ? currentMission : "Write one decision. The library can provide a real-context starting point, but the operator owns the wording and branch."}</div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row"><Button type="button" className="min-h-11" disabled={mission.trim().length < 20 || saveMission.isPending} onClick={() => startMission("research")}><FileSearch className="mr-2 h-4 w-4" />Verify with paper research <ArrowRight className="ml-2 h-4 w-4" /></Button><Button type="button" variant="outline" className="min-h-11" disabled={mission.trim().length < 20 || saveMission.isPending} onClick={() => startMission("conditional")}><ShieldCheck className="mr-2 h-4 w-4" />Set conditional branch</Button></div>
          {showLibrary && <div className="mt-4 grid gap-2 sm:grid-cols-3">{DEFAULT_MISSIONS.map((item) => <button key={item.id} type="button" className="rounded-xl border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }} onClick={() => { setMission(item.text); if (item.id === "cash") setReason("Evidence or paper-risk conditions are not sufficient to proceed today."); }}><p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{item.label}</p><p className="mt-1 text-[11px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>{item.reason}</p></button>)}</div>}
        </div>

        <div className="rounded-2xl border p-5" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 35%, var(--sh-border-1))", background: "color-mix(in srgb, var(--sh-signal) 5%, var(--sh-surface))" }}>
          <div className="flex gap-3"><CircleSlash2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--sh-signal)" }} /><div className="min-w-0"><p className="font-serif text-xl" style={{ color: "var(--sh-text-primary)" }}>Cash is an explicit outcome.</p><p className="mt-1 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>Record a no-trade branch when evidence, trigger, risk, or concentration conditions do not clear. This durable decision has no candidate, proposal, or broker path.</p><label htmlFor="cash-reason" className="sr-only">Why cash is correct</label><Textarea id="cash-reason" value={reason} onChange={(event) => setReason(event.target.value)} className="mt-3 min-h-20 text-xs" placeholder="Why is cash the right decision for this mission?" /><Button type="button" variant="outline" className="mt-3 min-h-11" disabled={mission.trim().length < 20 || reason.trim().length < 3 || saveMission.isPending} onClick={() => startMission("cash")}>Record cash / no-trade</Button></div></div>
        </div>

        <DailyPlayList onNewResearch={onNewResearch} onOpenRun={onOpenRun} />
      </section>

      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><div className="flex items-center gap-2"><BookOpen className="h-4 w-4" style={{ color: "var(--sh-signal)" }} /><p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>Mission Library</p></div><p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Only saved Capital contexts with a projection are listed. Choosing one changes this mission’s source context; it never changes the user’s active thesis, rules, or account.</p><div className="mt-3 space-y-2">{capitalLibrary.slice(0, 5).map((thesis) => <button key={thesis.id} type="button" className="w-full rounded-lg border p-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ borderColor: thesis.sourceCompilationId === activeThesis?.id ? "var(--sh-signal)" : "var(--sh-border-1)", background: "var(--sh-surface-2)" }} onClick={() => { setSelectedCanonicalId(thesis.sourceCompilationId!); setMission(`Assess the Capital thesis “${thesis.name ?? "Untitled thesis"}” through one dated, falsifiable paper-research decision. Preserve cash if the evidence, catalyst, liquidity, or invalidation conditions cannot be verified.`); }}><p className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>{thesis.name ?? "Untitled thesis"}</p><p className="mt-1 text-[10px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>{thesis.sourceCompilationId === activeThesis?.id ? "Mission source context" : "Use for this mission only"}</p></button>)}</div></div>
        <div className="rounded-2xl border p-4 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)" }}><p className="flex items-center gap-2 font-semibold" style={{ color: "var(--sh-text-primary)" }}><Sparkles className="h-4 w-4" style={{ color: "var(--sh-signal)" }} />Decision integrity</p><ul className="mt-2 space-y-1"><li>• Mission state is durable and owner-scoped.</li><li>• Conditional and cash branches remain visible.</li><li>• Cash blocks linked-run proposal promotion.</li><li>• Paper research is not an order instruction.</li></ul></div>
      </aside>
    </div>

    <div className="fixed inset-x-0 bottom-0 z-20 border-t p-3 shadow-lg md:hidden" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><div className="mx-auto flex max-w-lg gap-2"><Button type="button" className="min-h-11 flex-1" disabled={mission.trim().length < 20 || saveMission.isPending} onClick={() => startMission("research")}>Verify mission</Button><Button type="button" variant="outline" className="min-h-11" onClick={() => setShowLibrary(true)}>Library</Button></div></div>
  </section>;
}
