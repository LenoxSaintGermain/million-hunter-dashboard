import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
        <Button variant="outline" size="sm" className="h-7 text-[11px] border-border">
          <FileText className="w-2.5 h-2.5 mr-1" />
          Read Memo
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">{dealName} — Investment Memo</DialogTitle>
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
          <p className="text-sm text-muted-foreground mt-4">Memo content not available.</p>
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
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Investment Memos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {memos?.length ?? 0} memo{(memos?.length ?? 0) !== 1 ? "s" : ""} generated · Powered by Gemini 2.5 Pro
          </p>
        </div>
      </div>

      {/* Quick-generate banner for deals without memos */}
      {dealsWithoutMemo.length > 0 && (
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              {dealsWithoutMemo.length} deal{dealsWithoutMemo.length !== 1 ? "s" : ""} without a memo
            </CardTitle>
            <CardDescription className="text-xs text-amber-400/60">
              Generate AI investment memos to unlock full Third Signal analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {dealsWithoutMemo.slice(0, 5).map((deal) => (
                <Button
                  key={deal.id}
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  onClick={() => generateMemo.mutate({ dealId: deal.id })}
                  disabled={generateMemo.isPending}
                >
                  <RefreshCw className={cn("w-2.5 h-2.5 mr-1", generateMemo.isPending && "animate-spin")} />
                  {deal.name.length > 32 ? deal.name.slice(0, 32) + "…" : deal.name}
                </Button>
              ))}
              {dealsWithoutMemo.length > 5 && (
                <span className="text-[11px] text-muted-foreground self-center">
                  +{dealsWithoutMemo.length - 5} more
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Memos grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : !memos?.length ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="w-12 h-12 text-muted-foreground/20 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">No memos generated yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Add deals to the pipeline and generate AI investment memos
            </p>
            <Link href="/scan">
              <Button size="sm" className="mt-4 h-8 text-xs">
                <ArrowUpRight className="w-3 h-3 mr-1.5" />
                Go to Market Scan
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memos.map((memo) => {
            const deal = dealMap.get(memo.dealId);
            return (
              <Card key={memo.id} className="bg-card border-border hover:border-primary/30 transition-colors group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <Badge variant="secondary" className="text-[10px]">v{memo.version ?? 1}</Badge>
                  </div>
                  <CardTitle className="text-sm font-semibold mt-2 line-clamp-2">
                    {memo.title ?? deal?.name ?? "Investment Memo"}
                  </CardTitle>
                  {deal && (
                    <CardDescription className="text-xs flex items-center gap-1">
                      <Building2 className="w-2.5 h-2.5" />
                      {deal.name}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {memo.executiveSummary && (
                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                      {memo.executiveSummary}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {new Date(memo.createdAt).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="w-2.5 h-2.5" />
                      {memo.generatedBy ?? "Gemini 2.5 Pro"}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <MemoDialog dealId={memo.dealId} dealName={deal?.name ?? "Deal"} />
                    <Link href={`/deal/${memo.dealId}`} className="flex-1">
                      <Button variant="ghost" size="sm" className="w-full h-7 text-[11px]">
                        War Room <ChevronRight className="w-2.5 h-2.5 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
