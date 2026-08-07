/**
 * Sourcing schedules — /schedules (operator only)
 *
 * Daily or weekly automated sourcing. Every schedule is OFF when created:
 * an unattended job that spends tokens should never start itself.
 *
 * The run log matters as much as the switch. A nightly job that quietly returns
 * nothing for two weeks is worse than one that fails loudly, so every run —
 * scheduled or manual, success or failure — is recorded and shown here.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import EditorialTopNav from "@/components/EditorialTopNav";
import { listAssetClasses } from "@shared/assetClasses";
import { toast } from "sonner";
import { Loader2, Plus, Play, Trash2, Clock, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const fmtWhen = (ms?: number | null) =>
  ms == null ? "—" : new Date(Number(ms)).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

type Draft = {
  id?: number;
  name: string;
  assetClass: string;
  cadence: "daily" | "weekly";
  hourUtc: number;
  nationwide: boolean;
  marketsPerRun: number;
  limitPerRun: number;
};

const newDraft = (): Draft => ({
  name: "", assetClass: "historic", cadence: "daily", hourUtc: 9,
  nationwide: true, marketsPerRun: 5, limitPerRun: 10,
});

export default function SourcingSchedules() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const q = trpc.sourcingSchedule.list.useQuery(undefined, { refetchOnWindowFocus: false });

  const save = trpc.sourcingSchedule.save.useMutation({
    onSuccess: () => { toast.success("Schedule saved — it starts disabled"); setDraft(null); q.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const setEnabled = trpc.sourcingSchedule.setEnabled.useMutation({
    onSuccess: (r) => { toast.success(r.enabled ? "Schedule armed" : "Schedule paused"); q.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.sourcingSchedule.remove.useMutation({
    onSuccess: () => { toast.success("Schedule removed"); q.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const runNow = trpc.sourcingSchedule.runNow.useMutation({
    onSuccess: (r: any) => {
      toast.success(r.error ? `Run failed: ${r.error}` : (r.message ?? `Created ${r.createdCount}`));
      q.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const schedules = q.data?.schedules ?? [];
  const runs = q.data?.recentRuns ?? [];

  return (
    <EditorialTopNav>
      <div className="max-w-[1280px] mx-auto w-full px-6 lg:px-10 py-10">

        <div className="flex items-start justify-between gap-6 flex-wrap border-b border-rule pb-8 mb-8">
          <div className="max-w-2xl">
            <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-2 inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber" /> Sourcing schedules
            </p>
            <h1 className="font-hero-h1 text-[clamp(2rem,4vw,3rem)] text-ink leading-[1.05] mb-3">
              Let it hunt overnight
            </h1>
            <p className="font-body-base text-body-base text-muted-foreground leading-relaxed">
              Daily or weekly sourcing against a thesis. Every schedule is created switched OFF —
              nothing spends tokens until you arm it. Duplicate listings are skipped, so a re-read
              costs a search but never a duplicate row.
            </p>
          </div>
          <button
            onClick={() => setDraft(newDraft())}
            className="flex items-center gap-2 bg-ink text-bone font-eyebrow text-eyebrow px-4 py-2 rounded-full hover:opacity-90 transition-all uppercase tracking-widest shrink-0">
            <Plus className="w-3 h-3" /> New schedule
          </button>
        </div>

        {/* ── Draft editor ─────────────────────────────────────────────── */}
        {draft && (
          <div className="border border-rule bg-paper p-6 mb-10 max-w-3xl space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Name</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Nightly historic sweep" className="h-9 mt-1 border-rule bg-transparent" />
              </div>
              <div>
                <Label className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Asset class</Label>
                <Select value={draft.assetClass} onValueChange={(v) => setDraft({ ...draft, assetClass: v })}>
                  <SelectTrigger className="h-9 mt-1 text-xs border-rule bg-transparent"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {listAssetClasses().map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Cadence</Label>
                <Select value={draft.cadence} onValueChange={(v) => setDraft({ ...draft, cadence: v as any })}>
                  <SelectTrigger className="h-9 mt-1 text-xs border-rule bg-transparent"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Hour (UTC)</Label>
                <Input type="number" min={0} max={23} value={draft.hourUtc}
                  onChange={(e) => setDraft({ ...draft, hourUtc: Number(e.target.value) })}
                  className="h-9 mt-1 border-rule bg-transparent" />
              </div>
              <div>
                <Label className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Markets / run</Label>
                <Input type="number" min={1} max={10} value={draft.marketsPerRun}
                  onChange={(e) => setDraft({ ...draft, marketsPerRun: Number(e.target.value) })}
                  className="h-9 mt-1 border-rule bg-transparent" />
              </div>
              <div>
                <Label className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Listings / run</Label>
                <Input type="number" min={1} max={24} value={draft.limitPerRun}
                  onChange={(e) => setDraft({ ...draft, limitPerRun: Number(e.target.value) })}
                  className="h-9 mt-1 border-rule bg-transparent" />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-rule pt-4">
              <div>
                <p className="font-body-base text-[13px] text-ink">Search nationwide</p>
                <p className="font-body-base text-[11px] text-muted-foreground">
                  Off keeps it inside the thesis's declared markets.
                </p>
              </div>
              <Switch checked={draft.nationwide} onCheckedChange={(v) => setDraft({ ...draft, nationwide: v })} />
            </div>

            <div className="flex items-center gap-3 border-t border-rule pt-4">
              <button
                onClick={() => save.mutate({ ...draft, enabled: false })}
                disabled={save.isPending || !draft.name.trim()}
                className="flex items-center gap-2 bg-ink text-bone font-eyebrow text-eyebrow px-4 py-2.5 rounded-full hover:opacity-90 transition-all uppercase tracking-widest disabled:opacity-50">
                {save.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Create (disabled)
              </button>
              <button onClick={() => setDraft(null)}
                className="font-eyebrow text-eyebrow text-muted-foreground hover:text-ink uppercase tracking-widest">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* ── Schedules ─────────────────────────────────────────────── */}
          <div className="lg:col-span-7 space-y-4">
            {q.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber" />
            ) : !schedules.length ? (
              <p className="font-body-base text-[13px] text-muted-foreground">
                No schedules yet. Create one — it will sit disabled until you arm it.
              </p>
            ) : (
              schedules.map((s: any) => (
                <div key={s.id} className={cn("border p-5", s.enabled ? "border-amber/40 bg-amber/5" : "border-rule bg-paper")}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-card-title text-[18px] text-ink leading-tight">{s.name}</p>
                      <p className="font-body-base text-[12px] text-muted-foreground mt-0.5">
                        {s.assetClass} · {s.cadence} at {String(s.hourUtc).padStart(2, "0")}:00 UTC ·
                        {s.nationwide ? " nationwide" : " thesis markets"} · {s.limitPerRun}/run
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn("font-eyebrow text-eyebrow uppercase tracking-widest",
                        s.enabled ? "text-amber" : "text-muted-foreground")}>
                        {s.enabled ? "Armed" : "Off"}
                      </span>
                      <Switch
                        checked={!!s.enabled}
                        onCheckedChange={(v) => setEnabled.mutate({ id: s.id, enabled: v })}
                        disabled={setEnabled.isPending}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4 border-t border-rule pt-3">
                    <div>
                      <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Last run</p>
                      <p className="font-body-base text-[12px] text-ink/80">{fmtWhen(s.lastRunAt)}</p>
                      {s.lastRunMessage && (
                        <p className="font-body-base text-[11px] text-muted-foreground mt-0.5 leading-snug">{s.lastRunMessage}</p>
                      )}
                    </div>
                    <div>
                      <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Next run</p>
                      <p className="font-body-base text-[12px] text-ink/80">{s.enabled ? fmtWhen(s.nextRunAt) : "—"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-4">
                    <button
                      onClick={() => runNow.mutate({ id: s.id })}
                      disabled={runNow.isPending}
                      className="font-eyebrow text-eyebrow text-amber hover:underline uppercase tracking-widest inline-flex items-center gap-1 disabled:opacity-50">
                      {runNow.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      Run now
                    </button>
                    <button
                      onClick={() => { if (confirm(`Remove "${s.name}"?`)) remove.mutate({ id: s.id }); }}
                      className="font-eyebrow text-eyebrow text-muted-foreground hover:text-clay uppercase tracking-widest inline-flex items-center gap-1 ml-auto">
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Run log ───────────────────────────────────────────────── */}
          <div className="lg:col-span-5">
            <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-4">
              Recent runs · {runs.length}
            </p>
            {!runs.length ? (
              <p className="font-body-base text-[13px] text-muted-foreground">Nothing has run yet.</p>
            ) : (
              <div className="divide-y divide-rule border-t border-b border-rule">
                {runs.map((r: any) => (
                  <div key={r.id} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-body-base text-[12px] text-muted-foreground">{fmtWhen(r.ranAt)}</span>
                      <span className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">{r.trigger}</span>
                      <span className={cn("font-data-mono text-[13px]", r.error ? "text-clay" : "text-amber")}>
                        {r.error ? "fail" : `+${r.createdCount}`}
                      </span>
                    </div>
                    <p className="font-body-base text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      {r.error ? (
                        <span className="text-clay inline-flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{r.error}
                        </span>
                      ) : (r.message ?? "—")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </EditorialTopNav>
  );
}
