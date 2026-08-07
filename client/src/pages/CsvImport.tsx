/**
 * CSV import — /import (operator only)
 *
 * The CoStar workaround from the Wingate call. Export from CoStar, Crexi, or a
 * broker's spreadsheet, paste it here, and run it through the same scoring
 * logic as everything else.
 *
 * Deliberately two-step: the first pass parses and previews without writing, so
 * you can see how columns were matched, what was ignored, and how the rows
 * actually score before committing them to the pipeline.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import EditorialTopNav from "@/components/EditorialTopNav";
import { listAssetClasses } from "@shared/assetClasses";
import { toast } from "sonner";
import { Loader2, Upload, AlertTriangle, Check, FileSpreadsheet } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function CsvImport() {
  const [csv, setCsv] = useState("");
  const [assetClass, setAssetClass] = useState("historic");
  const [sourceLabel, setSourceLabel] = useState("costar-export");
  const [result, setResult] = useState<any>(null);
  const [committed, setCommitted] = useState(false);

  const run = trpc.scout.importCsv.useMutation({
    onSuccess: (r: any, vars: any) => {
      setResult(r);
      if (!vars.dryRun) {
        setCommitted(true);
        toast.success(`Imported ${r.imported} assets`);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const onFile = async (f: File | null) => {
    if (!f) return;
    const text = await f.text();
    setCsv(text);
    setResult(null); setCommitted(false);
  };

  const mapped = (result?.headerMap ?? []).filter((h: any) => h.mappedTo);
  const ignored = (result?.headerMap ?? []).filter((h: any) => !h.mappedTo);

  return (
    <EditorialTopNav>
      <div className="max-w-[1280px] mx-auto w-full px-6 lg:px-10 py-10">

        <div className="border-b border-rule pb-8 mb-8 max-w-2xl">
          <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-2 inline-flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber" /> CSV import
          </p>
          <h1 className="font-hero-h1 text-[clamp(2rem,4vw,3rem)] text-ink leading-[1.05] mb-3">
            Bring your own listings
          </h1>
          <p className="font-body-base text-body-base text-muted-foreground leading-relaxed">
            Export from CoStar, Crexi, or a broker's spreadsheet and run it through the same
            scoring logic as everything else. Column names are matched loosely — anything that
            can't be matched is reported rather than dropped quietly.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Asset class</Label>
                <Select value={assetClass} onValueChange={setAssetClass}>
                  <SelectTrigger className="h-9 mt-1 text-xs border-rule bg-transparent"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {listAssetClasses().map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Source label</Label>
                <Input value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)}
                  className="h-9 mt-1 border-rule bg-transparent" />
              </div>
            </div>

            <div>
              <Label className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">CSV file</Label>
              <input type="file" accept=".csv,text/csv"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                className="block w-full mt-1 text-xs file:mr-3 file:border file:border-rule file:bg-paper file:px-3 file:py-1.5 file:rounded-full file:text-[11px] file:uppercase file:tracking-widest file:font-eyebrow" />
            </div>

            <div>
              <Label className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">…or paste it</Label>
              <Textarea
                value={csv}
                onChange={(e) => { setCsv(e.target.value); setResult(null); setCommitted(false); }}
                rows={12}
                placeholder={"Property Name,Street Address,City,State,Year Built,RBA,Asking Price,Cap Rate\nSmith Block,122 Main St,Columbus,OH,1908,18500,$2750000,6.5%"}
                className="mt-1 font-data-mono text-[12px] border-rule bg-transparent"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => { setCommitted(false); run.mutate({ csv, assetClass, sourceLabel, dryRun: true }); }}
                disabled={run.isPending || csv.trim().length < 10}
                className="flex items-center gap-2 border border-rule font-eyebrow text-eyebrow px-4 py-2.5 rounded-full hover:border-amber/40 hover:text-amber transition-all uppercase tracking-widest disabled:opacity-50">
                {run.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                Preview
              </button>
              {result && !committed && result.willImport > 0 && (
                <button
                  onClick={() => run.mutate({ csv, assetClass, sourceLabel, dryRun: false })}
                  disabled={run.isPending}
                  className="flex items-center gap-2 bg-ink text-bone font-eyebrow text-eyebrow px-4 py-2.5 rounded-full hover:opacity-90 transition-all uppercase tracking-widest disabled:opacity-50">
                  {run.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Import {result.willImport}
                </button>
              )}
            </div>
          </div>

          {/* ── Parse report ─────────────────────────────────────────────── */}
          <div className="lg:col-span-5">
            {!result ? (
              <div className="border border-rule bg-paper p-6">
                <p className="font-card-title text-[18px] text-ink mb-2">Nothing parsed yet</p>
                <p className="font-body-base text-[13px] text-muted-foreground leading-relaxed">
                  Preview first. Nothing is written until you confirm, and you'll see how each
                  column was matched plus how the rows score.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-0 border border-rule divide-x divide-rule">
                  {[
                    { label: "Parsed", v: result.parsed },
                    { label: "Duplicates", v: result.duplicates },
                    { label: committed ? "Imported" : "To import", v: committed ? result.imported : result.willImport },
                  ].map((x) => (
                    <div key={x.label} className="px-4 py-4 bg-paper">
                      <p className="font-data-mono text-[22px] text-ink leading-none">{x.v}</p>
                      <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mt-2">{x.label}</p>
                    </div>
                  ))}
                </div>

                {committed && (
                  <p className="font-body-base text-[13px] text-sage border-l-2 border-sage/50 pl-4">
                    Imported. These are unverified — they'll appear in the Verification Queue.
                  </p>
                )}

                <div>
                  <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-3">
                    Columns matched · {mapped.length}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {mapped.map((h: any) => (
                      <span key={h.column} className="font-eyebrow text-eyebrow px-2 py-0.5 rounded-sm border border-sage/40 text-sage">
                        {h.column} → {h.mappedTo.replace("class:", "")}
                      </span>
                    ))}
                  </div>
                  {ignored.length > 0 && (
                    <>
                      <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mt-4 mb-2">
                        Ignored · {ignored.length}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {ignored.map((h: any) => (
                          <span key={h.column} className="font-eyebrow text-eyebrow px-2 py-0.5 rounded-sm border border-rule text-muted-foreground">
                            {h.column}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {result.preview?.length > 0 && (
                  <div>
                    <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-3">
                      How they score
                    </p>
                    <div className="divide-y divide-rule border-t border-b border-rule">
                      {result.preview.map((p: any) => (
                        <div key={p.name} className="py-2.5 flex items-baseline gap-3">
                          <span className="flex-1 font-body-base text-[13px] text-ink truncate">{p.name}</span>
                          <span className="font-body-base text-[11px] text-muted-foreground shrink-0">{p.city}, {p.state}</span>
                          <span className={cn("font-eyebrow text-eyebrow uppercase tracking-widest shrink-0",
                            p.tier === "archive" ? "text-muted-foreground" : "text-amber")}>{p.tier}</span>
                          <span className="font-data-mono text-[12px] text-ink w-8 text-right shrink-0">{p.rank}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.errors?.length > 0 && (
                  <div className="border-l-2 border-amber pl-4">
                    <p className="font-eyebrow text-eyebrow text-amber uppercase tracking-widest mb-2 inline-flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" /> Notes
                    </p>
                    {result.errors.map((e: string, i: number) => (
                      <p key={i} className="font-body-base text-[12px] text-muted-foreground leading-relaxed">{e}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </EditorialTopNav>
  );
}
