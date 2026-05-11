import { useState } from "react";
import { trpc } from "@/lib/trpc";
import EditorialTopNav from "@/components/EditorialTopNav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  FileText, Building2, Calendar, ChevronRight,
  Zap, RefreshCw, ArrowUpRight,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

function MemoDialog({ dealId, dealName }: { dealId: number; dealName: string }) {
  const [open, setOpen] = useState(false);
  const { data: memo, isLoading } = trpc.memos.getByDealId.useQuery(
    { dealId },
    { enabled: open }
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px]"
          style={{ borderColor: "var(--sh-border)", background: "transparent" }}
        >
          <FileText className="w-2.5 h-2.5 mr-1" />
          Read Memo
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-3xl max-h-[80vh] overflow-y-auto"
        style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border)" }}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold" style={{ color: "var(--sh-fg-1)" }}>
            {dealName} — Investment Memo
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-3 mt-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
          </div>
        ) : memo ? (
          <div className="prose prose-sm prose-invert max-w-none mt-4">
            <Streamdown>{memo.content ?? ""}</Streamdown>
          </div>
        ) : (
          <p className="text-sm mt-4" style={{ color: "var(--sh-fg-3)" }}>Memo content not available.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Memos() {
  const { data: memos, isLoading, refetch } = trpc.memos.list.useQuery();
  const { data: deals } = trpc.deals.list.useQuery({ limit: 100 });
  const generateMemo = trpc.memos.generate.useMutation({
    onSuccess: () => { toast.success("Memo generated"); refetch(); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const dealMap = new Map(deals?.map((d) => [d.id, d]) ?? []);
  const dealsWithoutMemo = (deals ?? []).filter(
    (d) => !(memos ?? []).some((m) => m.dealId === d.id)
  );

  return (
    <EditorialTopNav>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="sh-heading-2" style={{ color: "var(--sh-fg-1)" }}>Investment Memos</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--sh-fg-3)" }}>
            {memos?.length ?? 0} memo{(memos?.length ?? 0) !== 1 ? "s" : ""} generated · Powered by Gemini 2.5 Pro
          </p>
        </div>
      </div>

      {/* ── Quick-generate banner ── */}
      {dealsWithoutMemo.length > 0 && (
        <div
          className="rounded-xl border p-4"
          style={{ background: "oklch(0.66 0.14 55 / 0.08)", borderColor: "oklch(0.66 0.14 55 / 0.25)" }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Zap className="w-3.5 h-3.5" style={{ color: "var(--sh-amber)" }} />
            <span className="text-xs font-semibold" style={{ color: "var(--sh-amber)" }}>
              {dealsWithoutMemo.length} deal{dealsWithoutMemo.length !== 1 ? "s" : ""} without a memo
            </span>
          </div>
          <p className="text-xs mb-3" style={{ color: "oklch(0.75 0.20 80 / 0.70)" }}>
            Generate AI investment memos to unlock full Third Signal analysis
          </p>
          <div className="flex flex-wrap gap-2">
            {dealsWithoutMemo.slice(0, 5).map((deal) => (
              <Button
                key={deal.id}
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                style={{ borderColor: "oklch(0.75 0.20 80 / 0.30)", color: "var(--sh-amber)", background: "transparent" }}
                onClick={() => generateMemo.mutate({ dealId: deal.id })}
                disabled={generateMemo.isPending}
              >
                <RefreshCw className={cn("w-2.5 h-2.5 mr-1", generateMemo.isPending && "animate-spin")} />
                {deal.name.length > 32 ? deal.name.slice(0, 32) + "…" : deal.name}
              </Button>
            ))}
            {dealsWithoutMemo.length > 5 && (
              <span className="text-[11px] self-center" style={{ color: "var(--sh-fg-3)" }}>
                +{dealsWithoutMemo.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Memos grid ── */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : !memos?.length ? (
        <div
          className="rounded-xl border flex flex-col items-center justify-center py-20 text-center"
          style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border)" }}
        >
          <FileText className="w-12 h-12 mb-4" style={{ color: "var(--sh-fg-3)", opacity: 0.3 }} />
          <p className="text-sm font-medium" style={{ color: "var(--sh-fg-3)" }}>No memos generated yet</p>
          <p className="text-xs mt-1" style={{ color: "var(--sh-fg-3)", opacity: 0.6 }}>
            Add deals to the pipeline and generate AI investment memos
          </p>
          <Link href="/scan">
            <Button size="sm" className="mt-4 h-8 text-xs">
              <ArrowUpRight className="w-3 h-3 mr-1.5" />
              Go to Market Scan
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memos.map((memo) => {
            const deal = dealMap.get(memo.dealId);
            return (
              <div
                key={memo.id}
                className="rounded-xl border transition-colors group"
                style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border)" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--sh-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--sh-border)")}
              >
                {/* Card header */}
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "var(--sh-primary-20)" }}
                    >
                      <FileText className="w-4 h-4" style={{ color: "var(--sh-primary)" }} />
                    </div>
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-3)" }}
                    >
                      v{memo.version ?? 1}
                    </span>
                  </div>
                  <p className="text-sm font-semibold line-clamp-2 mb-1" style={{ color: "var(--sh-fg-1)" }}>
                    {memo.title ?? deal?.name ?? "Investment Memo"}
                  </p>
                  {deal && (
                    <div className="flex items-center gap-1 text-xs" style={{ color: "var(--sh-fg-3)" }}>
                      <Building2 className="w-2.5 h-2.5" />
                      {deal.name}
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="px-4 pb-4 space-y-3">
                  {memo.executiveSummary && (
                    <p className="text-xs line-clamp-3 leading-relaxed" style={{ color: "var(--sh-fg-3)" }}>
                      {memo.executiveSummary}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-[10px]" style={{ color: "var(--sh-fg-3)" }}>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {new Date(memo.createdAt).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Zap className="w-2.5 h-2.5" />
                      {memo.generatedBy ?? "Gemini 2.5 Pro"}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <MemoDialog dealId={memo.dealId} dealName={deal?.name ?? "Deal"} />
                    <Link href={`/deal/${memo.dealId}`} className="flex-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-7 text-[11px]"
                        style={{ color: "var(--sh-fg-2)" }}
                      >
                        War Room <ChevronRight className="w-2.5 h-2.5 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </EditorialTopNav>
  );
}
