import { useState } from "react";
import { toast } from "sonner";
import "@/styles/capital-active-thesis.css";
import { trpc } from "@/lib/trpc";
import { isTestThesisName, resolveActiveThesis, thesisOptions } from "@shared/activeThesis";

/**
 * The one active-thesis selector (POC v3 context strip: "Every step uses this
 * thesis."). Selection is read only from `thesis.activeCapital`; changing it
 * calls the existing `aperture.thesis.activate`. Test/UAT theses are hidden
 * unless shown. Selecting a thesis never starts research or creates an order.
 */
export function ActiveThesisSelect({ variant = "strip" }: { variant?: "strip" | "inline" }) {
  const t = trpc as any;
  const utils = typeof t.useUtils === "function" ? t.useUtils() : null;
  const activeQuery = t.thesis?.activeCapital?.useQuery ? t.thesis.activeCapital.useQuery() : { data: undefined, isLoading: false, isSuccess: false };
  const listQuery = t.aperture?.thesis?.list?.useQuery ? t.aperture.thesis.list.useQuery() : { data: [] };
  const activate = t.aperture?.thesis?.activate?.useMutation ? t.aperture.thesis.activate.useMutation({
    onSuccess: async (data: any) => {
      await Promise.all([utils?.aperture?.invalidate?.(), utils?.thesis?.invalidate?.()]);
      toast.success(`Active thesis is now "${data?.name ?? "the selected thesis"}". Nothing was researched or ordered.`);
    },
    onError: (error: any) => toast.error(`Couldn't switch thesis: ${error?.message ?? "try again"}`),
  }) : null;
  const [showTest, setShowTest] = useState(false);
  const projections: Array<{ id: number; name: string | null; sourceCompilationId?: number | null }> = listQuery.data ?? [];
  const selection = resolveActiveThesis({
    activeLoaded: activeQuery.data !== undefined && !activeQuery.isLoading,
    active: activeQuery.data?.thesis ?? null,
    projections,
  });
  const { visible, hiddenCount } = thesisOptions(projections, { showTest, keepId: selection.selectedId });
  const placeholder = selection.state === "loading" ? "Reading your active thesis…"
    : selection.state === "not_prepared" ? `${selection.activeName ?? "Active thesis"} · not yet prepared for Capital`
      : selection.state === "none" ? "No active thesis · choose one" : null;
  const select = <select
    aria-label="Active thesis"
    className={variant === "strip" ? "capital-thesis-select" : "bg-transparent font-semibold cursor-pointer text-[11px] focus:outline-none"}
    style={variant === "inline" ? { color: "var(--sh-text-primary)", maxWidth: 170 } : undefined}
    value={selection.selectedId}
    disabled={activate?.isPending || selection.state === "loading"}
    onChange={(event) => {
      const candidate = projections.find((item) => item.id === Number(event.target.value));
      if (candidate && activate?.mutate) activate.mutate({ id: candidate.id, compilationId: candidate.sourceCompilationId ?? candidate.id });
    }}
  >
    {placeholder && <option value="" disabled>{placeholder}</option>}
    {visible.map((item) => <option key={item.id} value={String(item.id)}>{item.name ?? `Thesis #${item.id}`}{isTestThesisName(item.name) ? " (test)" : ""}</option>)}
  </select>;
  const toggle = (hiddenCount > 0 || showTest) && <button type="button" className="capital-thesis-toggle" aria-pressed={showTest} onClick={() => setShowTest((value) => !value)}>
    {showTest ? "Hide test theses" : `Show ${hiddenCount} test ${hiddenCount === 1 ? "thesis" : "theses"}`}
  </button>;
  if (variant === "inline") return <span className="inline-flex items-center gap-1.5">{select}{toggle}</span>;
  return <div data-active-thesis={selection.state}>
    <label className="capital-context-label" htmlFor="capital-active-thesis">Active thesis</label>
    <div id="capital-active-thesis" className="capital-thesis-control">{select}</div>
    <small>Every step uses this thesis. Switching it doesn't start research or place an order.{toggle ? <> · {toggle}</> : null}</small>
  </div>;
}
