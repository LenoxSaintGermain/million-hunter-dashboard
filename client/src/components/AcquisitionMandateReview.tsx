import { useState } from "react";
import { acquisitionMandateSchema, exampleMandate, type AcquisitionMandate } from "@shared/acquisitionV2";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const fields: Array<[Exclude<keyof AcquisitionMandate, "version" | "managementRequired" | "geographies">, string, string]> = [
  ["priceMin", "Minimum asking price ($)", "1"], ["priceMax", "Maximum asking price ($)", "1"],
  ["sdeMin", "Pursue SDE floor ($)", "1"], ["watchlistMin", "Watchlist SDE floor ($)", "1"],
  ["marginMin", "Minimum SDE / revenue (0–1)", ".01"], ["dscrMin", "Minimum modeled coverage", ".01"],
  ["equityPct", "Equity fraction (0–1)", ".01"], ["closingCosts", "Closing costs assumption ($)", "1"],
  ["rate", "Annual interest assumption (0–1)", ".001"], ["termYears", "Loan term (years)", "1"],
  ["singleCustomerMax", "Largest customer cap (0–1)", ".01"], ["top3Max", "Top-three customer cap (0–1)", ".01"],
];
export function AcquisitionMandateReview({ initial, onConfirm, onClose }: {
  initial?: Partial<AcquisitionMandate>; onConfirm: (mandate: AcquisitionMandate) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string | boolean>>(() => Object.fromEntries(Object.entries({ ...exampleMandate, ...initial }).map(([k,v]) => [k, Array.isArray(v) ? v.join("; ") : typeof v === "boolean" ? v : String(v)])));
  const [accepted, setAccepted] = useState(false);
  const parsed = acquisitionMandateSchema.safeParse(Object.fromEntries(Object.entries(draft).map(([k,v]) => [k, k === "geographies" ? String(v).split(";").map(s => s.trim()).filter(Boolean) : k === "version" || k === "managementRequired" ? v : v === "" ? undefined : Number(v)])));
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
    <DialogHeader><DialogTitle className="font-serif text-2xl">What must a deal clear?</DialogTitle><DialogDescription>V2 research mandate · review before this search. Saved financial bounds prefill where available; remaining values are editable example assumptions, not inferred requirements.</DialogDescription></DialogHeader>
    <p className="border-l-2 border-[var(--sh-signal)] pl-3 text-sm">Missing evidence means HOLD. Unavailable listings are excluded. Benchmark-dependent detectors remain disabled without approved data. This is screening, not approval to buy or contact anyone.</p>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{fields.map(([key,label,step]) => <label key={key} className="space-y-1 text-sm"><span>{label}</span><Input type="number" min="0" step={step} value={String(draft[key])} onChange={e => { setDraft({ ...draft, [key]: e.target.value }); setAccepted(false); }} /></label>)}</div>
    <label className="space-y-1 text-sm">Geographies · separate entries with semicolons; blank means unrestricted<Input value={String(draft.geographies)} onChange={e => { setDraft({ ...draft, geographies: e.target.value }); setAccepted(false); }} /></label>
    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(draft.managementRequired)} onChange={e => { setDraft({ ...draft, managementRequired: e.target.checked }); setAccepted(false); }} />Require an existing management layer</label>
    <label className="flex min-h-11 items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />I reviewed these bounds and financing assumptions for this run. They supplement the saved thesis; they do not replace its other criteria.</label>
    {!parsed.success && <p role="alert" className="text-sm text-destructive">Enter all fields with valid bounds. The watchlist floor cannot exceed the pursue floor.</p>}
    <Button disabled={!accepted || !parsed.success} onClick={() => { if (parsed.success) onConfirm({ ...parsed.data, version: `operator-${new Date().toISOString()}` }); }}>Confirm mandate & start research</Button>
  </DialogContent></Dialog>;
}
