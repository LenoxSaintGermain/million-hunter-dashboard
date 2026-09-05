import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, ChevronDown, FileCheck2, Loader2, Pencil, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { aperturePathForFixture, readIsolatedUatIdentity } from "@shared/isolatedUatIdentity";
import { isCapitalThesisEligible } from "@shared/capitalThesisEligibility";
import { canonicalThesisLabel } from "@shared/canonicalThesisLabel";
import type { ThesisSaveReceipt } from "@shared/thesisSaveReceipt";

type Purpose = "capital" | "acquisition" | "property";
type HoldingPeriod = "intraday" | "overnight" | "swing" | "catalyst_window" | "position";
type Instrument = "shares" | "options" | "either";

const EMPTY_DETAIL = { belief: "", evidence: "", seeks: "", avoids: "", horizon: "", holdingPeriod: "position" as HoldingPeriod, invalidation: "", risk: "", symbols: "", instrument: "either" as Instrument };

const PURPOSES: Array<{ id: Purpose; label: string }> = [
  { id: "capital", label: "Capital" },
  { id: "acquisition", label: "Acquisition" },
  { id: "property", label: "Property" },
];

const STARTER = "I am researching a paper-only capital thesis. State the belief, evidence basis, what it seeks, what it avoids, time horizon, invalidation condition, and risk boundary. Do not infer missing facts or create an order.";

function route(path: string) {
  return aperturePathForFixture(path, readIsolatedUatIdentity());
}

export function CapitalThesisWorkspace() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: theses, isLoading, error } = trpc.thesis.list.useQuery();
  const [purpose, setPurpose] = useState<Purpose>("capital");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [missionError, setMissionError] = useState<string | null>(null);
  const [saveReceipt, setSaveReceipt] = useState<ThesisSaveReceipt | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftText, setDraftText] = useState(STARTER);
  const [detail, setDetail] = useState(EMPTY_DETAIL);

  const capitalTheses = useMemo(
    () => (theses ?? []).filter(isCapitalThesisEligible),
    [theses],
  );
  const active = capitalTheses.find((thesis: any) => thesis.isActiveCapital) ?? capitalTheses[0] ?? null;
  const selected = creating ? null : capitalTheses.find((thesis: any) => thesis.id === selectedId) ?? active;

  useEffect(() => {
    if (selected) {
      setSelectedId(selected.id);
      setDraftName(selected.name ?? "");
      setDraftText(selected.thesisText ?? "");
      const filters = (selected.compiledFilters ?? {}) as Record<string, any>;
      const typed = (filters.capitalTradeDetails ?? {}) as Record<string, any>;
      setDetail({
        belief: typed.belief ?? "",
        evidence: selected.evidenceRequirements?.[0] ?? "",
        seeks: typed.seeks ?? "",
        avoids: typed.avoids ?? "",
        horizon: typed.horizon ?? "",
        holdingPeriod: filters.holdingPeriod ?? "position",
        invalidation: selected.autoDisqualifiers?.[0] ?? "",
        risk: typed.risk ?? "",
        symbols: Array.isArray(filters.researchSymbols) ? filters.researchSymbols.join(", ") : "",
        instrument: filters.instrumentPreference ?? "either",
      });
    }
  }, [selected?.id]);

  const createCapital = trpc.thesis.createCapital.useMutation({
    onSuccess: async ({ compilationId, persistedName, nameMatchesRequest }) => {
      await utils.thesis.list.invalidate();
      setSelectedId(compilationId);
      setSaveReceipt({ compilationId, persistedName, nameMatchesRequest });
      setCreating(false);
      setEditing(false);
    },
  });
  const activate = trpc.thesis.setActiveCapital.useMutation();
  const project = trpc.thesis.useInAperture.useMutation();

  const detailedThesisText = () => {
    const rows = [
      ["Belief", detail.belief], ["Evidence basis", detail.evidence], ["Seeks", detail.seeks], ["Avoids", detail.avoids],
      ["Horizon", detail.horizon], ["Invalidation", detail.invalidation], ["Risk boundary", detail.risk],
    ].filter(([, value]) => value.trim()).map(([label, value]) => `${label}: ${value.trim()}`);
    return rows.length ? `${draftText.trim()}\n\nThesis detail\n${rows.join("\n")}` : draftText.trim();
  };
  const applyFraming = (starter: string) => {
    setDraftText((current) => current.trim() ? `${starter} ${current.trim()}` : starter);
  };
  const createInline = async (openMission = false) => {
    if (draftText.trim().length < 20) return;
    const result = await createCapital.mutateAsync({ thesisText: detailedThesisText(), name: draftName.trim() || undefined, details: { ...detail } });
    toast.success(`Saved exactly as “${result.persistedName}”`, { description: openMission ? "Opening Capital Mission." : `Canonical thesis #${result.compilationId}` });
    if (openMission) await useInMissionFor(result.compilationId);
  };
  const useInMissionFor = async (compilationId: number) => {
    setMissionError(null);
    try {
      await activate.mutateAsync({ compilationId });
      const projection = await project.mutateAsync({ compilationId });
      if (projection.compilerStatus === "needs_structure") {
        const missing = projection.missingFields.join(", ");
        setMissionError(`Add the missing thesis structure before research: ${missing}. Your thesis is saved; no empty run was created.`);
        setEditing(true);
        setShowDetails(true);
        return;
      }
      if (projection.incompatibilities.length) {
        setMissionError(projection.incompatibilities.join(" "));
        return;
      }
      // The projection mutation writes the Capital record, but the Decision
      // Runway can still have a warm, empty thesis-list cache from the thesis
      // workspace. Invalidate every binding the next screen consumes before
      // navigating so a newly-created thesis never requires a manual reload.
      await Promise.all([
        utils.thesis.list.invalidate(),
        utils.thesis.activeCapital.invalidate(),
        utils.aperture.thesis.list.invalidate(),
        utils.aperture.runway.latest.invalidate(),
      ]);
      navigate(route("/aperture"));
    } catch (error) {
      setMissionError(error instanceof Error ? error.message : "This thesis could not be bound to a Capital Mission. Review its type and try again.");
    }
  };
  const useInMission = async () => { if (selected) await useInMissionFor(selected.id); };

  const alternatives = capitalTheses.filter((thesis: any) => thesis.id !== selected?.id);
  const visibleAlternatives = showMore ? alternatives : alternatives.slice(0, 3);
  const deadline = selected?.latestCatalystDeadlineAt ? new Date(Number(selected.latestCatalystDeadlineAt)) : null;
  const Composer = ({ versioning = false }: { versioning?: boolean }) => <section className="mt-4 space-y-3 rounded-md border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
    <div><p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>{versioning ? "New canonical version" : "New canonical thesis"}</p><p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>{versioning ? "The active source and every prior mission receipt remain unchanged." : "Save a source first. Starting a mission remains a separate choice."}</p></div>
    <label className="block text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>Thesis statement<textarea value={draftText} onChange={(event) => setDraftText(event.target.value)} aria-label="Thesis statement" className="mt-2 min-h-32 w-full resize-y rounded border bg-transparent p-3 text-sm leading-6" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-text-primary)" }} /></label>
    <div className="flex flex-wrap gap-2" aria-label="Thesis framing helpers">{[["Where can I…", "Where can I find evidence for this paper-only thesis?"], ["How can I…", "How can I test this belief without exceeding the stated risk boundary?"], ["What would…", "What would invalidate the current thesis framing?" ]].map(([label, starter]) => <button key={label} type="button" onClick={() => applyFraming(starter)} className="min-h-9 rounded-full border px-3 text-xs font-semibold" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-text-primary)" }}>{label}</button>)}</div>
    <p className="text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>Helpers prepend an editable framing prompt and preserve your current statement. They never replace content.</p>
    <button type="button" onClick={() => setShowDetails((current) => !current)} aria-expanded={showDetails} className="inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}><ChevronDown className={showDetails ? "h-3.5 w-3.5 rotate-180" : "h-3.5 w-3.5"} />Add thesis detail</button>
    {showDetails && <div className="grid gap-2 sm:grid-cols-2">
      {[["belief", "Belief"], ["evidence", "Evidence basis"], ["seeks", "Seeks"], ["avoids", "Avoids"], ["horizon", "Horizon"], ["invalidation", "Invalidation"], ["risk", "Risk boundary"], ["symbols", "Symbols or research universe"]].map(([key, label]) => <label key={key} className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>{label}<input value={detail[key as keyof typeof detail]} onChange={(event) => setDetail((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 min-h-10 w-full rounded border bg-transparent px-3 text-sm" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-text-primary)" }} /></label>)}
      <label className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>Holding horizon<select value={detail.holdingPeriod} onChange={(event) => setDetail((current) => ({ ...current, holdingPeriod: event.target.value as HoldingPeriod }))} className="mt-1 min-h-10 w-full rounded border bg-transparent px-3 text-sm" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-text-primary)" }}><option value="intraday">Today</option><option value="overnight">Next close</option><option value="swing">2–10 sessions</option><option value="catalyst_window">Named catalyst window</option><option value="position">Multi-week / position</option></select></label>
      <label className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>Instrument<select value={detail.instrument} onChange={(event) => setDetail((current) => ({ ...current, instrument: event.target.value as Instrument }))} className="mt-1 min-h-10 w-full rounded border bg-transparent px-3 text-sm" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-text-primary)" }}><option value="shares">Shares only</option><option value="options">Defined-risk options</option><option value="either">Either; keep explicit at mission setup</option></select></label>
    </div>}
    <label className="block text-xs" style={{ color: "var(--sh-fg-muted)" }}>Version name<input value={draftName} onChange={(event) => setDraftName(event.target.value)} aria-label="Thesis name" placeholder="Name this thesis version" className="mt-1 min-h-10 w-full rounded border bg-transparent px-3 text-sm" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-text-primary)" }} /></label>
    <div className="flex flex-col gap-2 sm:flex-row"><Button type="button" variant="outline" className="min-h-11" onClick={() => void createInline(false)} disabled={createCapital.isPending || draftText.trim().length < 20}>{createCapital.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save without starting a run</Button><Button type="button" className="min-h-11 flex-1" onClick={() => void createInline(true)} disabled={createCapital.isPending || activate.isPending || project.isPending || draftText.trim().length < 20}>{createCapital.isPending || activate.isPending || project.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}Save and use in Capital Mission</Button></div>
  </section>;

  return (
    <main className="mx-auto w-full max-w-[1040px] space-y-5 px-4 py-8 sm:px-6 lg:py-10">
      <section className="border-b pb-5" style={{ borderColor: "var(--sh-border-1)" }}>
        <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-fg-muted)" }}>Thesis workspace · owner-scoped</p>
        <h1 className="mt-2 font-serif text-[clamp(1.75rem,4vw,2.65rem)] leading-[1.04]" style={{ color: "var(--sh-text-primary)" }}>What belief should frame this decision?</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>Start with one saved belief, test its evidence, then choose a single compatible workspace. A thesis is not an order.</p>
      </section>

      <section className="rounded-lg border p-1" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }} aria-label="Purpose">
        <div className="grid grid-cols-3 gap-1">
          {PURPOSES.map((item) => <button key={item.id} type="button" onClick={() => {
            if (item.id === "capital") {
              setPurpose("capital");
              return;
            }
            navigate(route(`/thesis?scope=${item.id}`));
          }} aria-pressed={purpose === item.id} className="min-h-10 rounded px-2 text-left text-xs font-semibold transition-colors" style={purpose === item.id ? { background: "var(--sh-paper)", color: "var(--sh-text-primary)", boxShadow: "0 1px 2px rgb(0 0 0 / .08)" } : { color: "var(--sh-fg-muted)" }}>{item.label}</button>)}
        </div>
      </section>

      {saveReceipt && <section role="status" className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: "var(--sh-emerald)", background: "var(--sh-surface-2)" }}><FileCheck2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--sh-emerald)" }} /><div className="min-w-0"><p className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>Saved exactly as</p><p className="mt-1 break-words font-serif text-lg" style={{ color: "var(--sh-text-primary)" }}>{saveReceipt.persistedName}</p><p className="mt-1 font-mono text-[10px]" style={{ color: "var(--sh-fg-muted)" }}>Canonical thesis #{saveReceipt.compilationId}</p></div></section>}

      {purpose !== "capital" ? (
        <section className="rounded-lg border p-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>{purpose} workspace</p>
          <p className="mt-2 text-sm" style={{ color: "var(--sh-text-primary)" }}>Your canonical thesis remains unchanged. Switch back to Capital to continue the paper-research handoff.</p>
        </section>
      ) : isLoading ? <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>Loading your saved thesis context…</p> : error ? <section className="rounded-lg border p-5" style={{ borderColor: "var(--sh-signal)" }}><p className="text-sm" style={{ color: "var(--sh-text-primary)" }}>Thesis context is unavailable. Retry before starting a Capital Mission; no default thesis is substituted.</p><Button className="mt-3" variant="outline" onClick={() => void utils.thesis.list.invalidate()}>Retry context</Button></section> : selected ? (
        <>
          <section className="rounded-lg border p-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-paper)" }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0"><p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>Active thesis · canonical source</p><h2 className="mt-1 font-serif text-2xl" style={{ color: "var(--sh-text-primary)" }}>{selected.name ?? "Untitled Capital thesis"}</h2></div>
              <button type="button" onClick={() => setChoosing((current) => !current)} aria-expanded={choosing} className="inline-flex min-h-10 items-center gap-1.5 rounded border px-3 text-xs font-semibold" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-text-primary)" }}><Pencil className="h-3.5 w-3.5" />Change thesis</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 font-mono text-[0.65rem] uppercase tracking-[0.08em]" style={{ color: "var(--sh-fg-muted)" }}><span>Capital</span><span>·</span><span>{selected.status ?? "review"}</span><span>·</span><span>{deadline ? `freshness due ${deadline.toLocaleDateString()}` : "freshness not measured"}</span><span>·</span><span>version {selected.id}</span></div>
            {choosing && <div className="mt-4 rounded-md border p-3" style={{ borderColor: "var(--sh-border-1)" }}><p className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>Owner-scoped alternatives</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{alternatives.map((thesis: any) => <button type="button" key={thesis.id} onClick={() => { setSelectedId(thesis.id); setChoosing(false); setEditing(false); }} className="min-h-10 rounded border px-3 text-left text-xs" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-text-primary)" }}>{canonicalThesisLabel(thesis)}</button>)}</div><button type="button" onClick={() => { setCreating(true); setChoosing(false); setDraftName(""); setDraftText(STARTER); setDetail(EMPTY_DETAIL); }} className="mt-3 min-h-10 text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>Create a new thesis</button><button type="button" onClick={() => { setEditing(true); setChoosing(false); }} className="ml-4 min-h-10 text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>Edit as new version</button></div>}
            {editing ? <Composer versioning /> : <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-6" style={{ color: "var(--sh-text-primary)" }}>{selected.thesisText}</p>}
          </section>

          <section className="grid gap-3 lg:grid-cols-[1.15fr_.85fr]">
            <div className="rounded-lg border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><div className="flex items-center gap-2"><FileCheck2 className="h-4 w-4" style={{ color: "var(--sh-signal)" }} /><p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>Compiled thesis receipt</p></div><p className="mt-3 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{selected.thesisText}</p><dl className="mt-3 grid gap-2 text-xs"><div><dt style={{ color: "var(--sh-fg-muted)" }}>Primary evidence requirement</dt><dd style={{ color: "var(--sh-text-primary)" }}>{selected.evidenceRequirements?.[0] ?? "Unknown — collect before paper research."}</dd></div><div><dt style={{ color: "var(--sh-fg-muted)" }}>Invalidation</dt><dd style={{ color: "var(--sh-text-primary)" }}>{selected.autoDisqualifiers?.[0] ?? "Unknown — state before any paper proposal."}</dd></div><div><dt style={{ color: "var(--sh-fg-muted)" }}>Horizon</dt><dd style={{ color: "var(--sh-text-primary)" }}>{typeof (selected.compiledFilters as any)?.holdingPeriod === "string" ? (selected.compiledFilters as any).holdingPeriod : "Unknown — operator has not specified a horizon."}</dd></div></dl></div>
            <div className="rounded-lg border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" style={{ color: "var(--sh-signal)" }} /><p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>Allowed next action</p></div><p className="mt-3 text-sm leading-6" style={{ color: "var(--sh-text-primary)" }}>Open one paper-only Capital Mission with this canonical thesis bound. Research and paper approval remain separate human gates.</p><p className="mt-3 text-xs" style={{ color: "var(--sh-fg-muted)" }}>Paper research · no orders</p></div>
          </section>

          <section className="rounded-lg border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-paper)" }}><div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>Contextual Thesis Library</p><p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>Owner-scoped Capital alternatives. Ranking is descriptive, never approval.</p></div></div><div className="mt-3 grid gap-2 sm:grid-cols-3">{visibleAlternatives.map((thesis: any) => <button key={thesis.id} type="button" onClick={() => { setSelectedId(thesis.id); setEditing(false); }} className="min-h-16 rounded border p-3 text-left text-xs" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-text-primary)" }}><span className="block font-semibold">{thesis.name ?? "Untitled thesis"}</span><span className="mt-1 block" style={{ color: "var(--sh-fg-muted)" }}>{thesis.status ?? "review"} · v{thesis.id}</span></button>)}</div>{alternatives.length > 3 && <button type="button" onClick={() => setShowMore((current) => !current)} className="mt-3 inline-flex min-h-10 items-center gap-1 text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}><ChevronDown className="h-3.5 w-3.5" /> {showMore ? "Show less" : `Show ${alternatives.length - 3} more`}</button>}</section>

          {missionError && <p role="alert" className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--sh-red)", color: "var(--sh-red)" }}>{missionError}</p>}
          <div className="flex flex-col gap-2 sm:flex-row"><Button className="min-h-11 flex-1" onClick={() => void useInMission()} disabled={activate.isPending || project.isPending}>{activate.isPending || project.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}Use in Capital Mission</Button><Button variant="outline" className="min-h-11" onClick={() => { setMissionError(null); setCreating(true); setDraftName(""); setDraftText(STARTER); setDetail(EMPTY_DETAIL); setEditing(false); }}>Create new Capital thesis</Button></div>
        </>
      ) : <section className="rounded-lg border p-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-paper)" }}><p className="font-mono text-[0.65rem] uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>New Capital thesis</p><h2 className="mt-2 font-serif text-2xl" style={{ color: "var(--sh-text-primary)" }}>Frame the decision in one statement.</h2><Composer /></section>}
    </main>
  );
}
