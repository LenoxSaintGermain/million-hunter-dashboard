import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, Zap, AlertTriangle, CheckCircle2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";

interface LOIGenerationProps {
  dealId: number;
  dealName: string;
  askingPrice?: number | null;
}

interface LOIResult {
  dealName: string;
  purchasePrice: number;
  earnOutYear1?: number;
  earnOutYear2?: number;
  exclusivityDays: number;
  contingencies: string[];
  loiText: string;
  repsAndWarrantiesNote: string;
  earnOutRationale: string;
  coAnalystContext: string;
  agentLog: Array<{ time: string; action: string; type: string }>;
}

export default function LOIGeneration({ dealId, dealName, askingPrice }: LOIGenerationProps) {
  const defaultPrice = askingPrice ? Math.round(askingPrice * 0.9) : 1000000;
  const [purchasePrice, setPurchasePrice] = useState(defaultPrice);
  const [earnOutY1, setEarnOutY1] = useState(5000000);
  const [earnOutY2, setEarnOutY2] = useState(5000000);
  const [exclusivityDays, setExclusivityDays] = useState(60);
  const [contingencies, setContingencies] = useState<string[]>(["Key Employee Retention", "IP Assignment Audit"]);
  const [result, setResult] = useState<LOIResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateLOI = trpc.loi.generate.useMutation({
    onMutate: () => setIsGenerating(true),
    onSuccess: (data) => {
      setResult(data);
      setIsGenerating(false);
      toast.success("LOI Draft generated — review before sharing with counsel");
    },
    onError: (e) => {
      setIsGenerating(false);
      toast.error(`LOI generation failed: ${e.message}`);
    },
  });

  const fmtM = (n: number) => `$${(n / 1e6).toFixed(2)}M`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* ── Left: LOI Parameters + Draft Canvas ──────────────────────────── */}
      <div className="lg:col-span-2 space-y-4">
        {/* Parameters */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-[0.2em] text-[#8b7355] uppercase">LOI Parameters</span>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Purchase Price</Label>
              <Input
                type="number"
                className="h-9 text-sm bg-background border-border font-mono"
                value={purchasePrice}
                onChange={e => setPurchasePrice(Number(e.target.value))}
              />
              <p className="text-[10px] text-muted-foreground">{fmtM(purchasePrice)}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Earn-Out Structure</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="Year 1"
                    className="h-9 text-xs bg-background border-border font-mono"
                    value={earnOutY1}
                    onChange={e => setEarnOutY1(Number(e.target.value))}
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">${(earnOutY1 / 1e6).toFixed(1)}M Y1</p>
                </div>
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="Year 2"
                    className="h-9 text-xs bg-background border-border font-mono"
                    value={earnOutY2}
                    onChange={e => setEarnOutY2(Number(e.target.value))}
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">${(earnOutY2 / 1e6).toFixed(1)}M Y2</p>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Exclusivity Period</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  className="h-9 text-sm bg-background border-border"
                  value={exclusivityDays}
                  onChange={e => setExclusivityDays(Number(e.target.value))}
                />
                <span className="text-xs text-muted-foreground shrink-0">Days</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Contingencies</Label>
              <div className="flex flex-wrap gap-1">
                {contingencies.map(c => (
                  <Badge
                    key={c}
                    variant="outline"
                    className="text-[10px] cursor-pointer hover:bg-destructive/10 hover:border-destructive/40"
                    onClick={() => setContingencies(prev => prev.filter(x => x !== c))}
                  >
                    {c} ×
                  </Badge>
                ))}
                {["IP Assignment Audit", "Key Employee Retention", "Environmental Review", "Lease Assignment"].filter(c => !contingencies.includes(c)).map(c => (
                  <Badge
                    key={c}
                    variant="outline"
                    className="text-[10px] cursor-pointer opacity-40 hover:opacity-100"
                    onClick={() => setContingencies(prev => [...prev, c])}
                  >
                    + {c}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Draft Canvas */}
        <Card className={cn(
          "border-2 transition-all duration-500",
          isGenerating
            ? "border-[var(--amber)] shadow-[0_0_20px_rgba(var(--amber-rgb),0.15)] animate-pulse"
            : result
            ? "border-border"
            : "border-dashed border-border"
        )}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isGenerating && <div className="w-2 h-2 rounded-full bg-[var(--amber)] animate-pulse" />}
                <span className="text-[10px] font-bold tracking-[0.2em] text-[#8b7355] uppercase">
                  {isGenerating ? "Agentic Drafting Active" : result ? "Draft Complete" : "Draft Canvas"}
                </span>
              </div>
              {result && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => {
                      navigator.clipboard.writeText(result.loiText);
                      toast.success("LOI copied to clipboard");
                    }}
                  >
                    <Share2 className="w-3 h-3" />
                    Share with Counsel
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1.5 bg-foreground text-background hover:bg-foreground/90"
                  >
                    <FileText className="w-3 h-3" />
                    Review Final Draft
                  </Button>
                </div>
              )}
            </div>
            {result && (
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="font-mono font-semibold text-foreground">{fmtM(result.purchasePrice)}</span>
                <span>·</span>
                <span>Earn-Out: ${(earnOutY1 / 1e6).toFixed(1)}M Y1 / ${(earnOutY2 / 1e6).toFixed(1)}M Y2</span>
                <span>·</span>
                <span>{result.exclusivityDays} Days Exclusivity</span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--amber)]" />
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">The Architect is drafting your LOI</p>
                  <p className="text-xs text-muted-foreground">Pulling behavioral profile from Deal Room · Tailoring R&W section</p>
                </div>
              </div>
            ) : result ? (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <Streamdown>{result.loiText}</Streamdown>
                {result.repsAndWarrantiesNote && (
                  <div className="mt-4 p-3 rounded-lg border border-[var(--amber)]/30 bg-[var(--amber)]/5">
                    <p className="text-[10px] font-bold tracking-[0.15em] text-[var(--amber)] uppercase mb-1">Drafting in progress based on Deal DNA...</p>
                    <p className="text-xs text-muted-foreground">{result.repsAndWarrantiesNote}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Configure parameters and generate</p>
                  <p className="text-xs text-muted-foreground mt-0.5">The Architect will draft a tailored LOI using behavioral profile data from the Deal Room</p>
                </div>
                <Button
                  className="mt-2 gap-2"
                  onClick={() => generateLOI.mutate({
                    dealId,
                    purchasePrice,
                    earnOutYear1: earnOutY1,
                    earnOutYear2: earnOutY2,
                    exclusivityDays,
                    contingencies,
                  })}
                >
                  <Zap className="w-4 h-4" />
                  Generate LOI Draft →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Right: Agent Monitoring Sidebar ──────────────────────────────── */}
      <div className="space-y-4">
        {/* Agent Status */}
        <Card className="border-border bg-card sticky top-4">
          <CardHeader className="pb-3">
            <div className="space-y-2">
              {[
                { label: "The Orchestrator", active: isGenerating, done: !!result },
                { label: "The Auditor", active: isGenerating, done: !!result },
                { label: "The Architect", active: isGenerating, done: !!result },
              ].map(agent => (
                <div key={agent.label} className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all",
                  agent.active ? "bg-[var(--amber)]/10 border border-[var(--amber)]/30" : agent.done ? "bg-muted/40" : "bg-muted/20"
                )}>
                  {agent.active ? (
                    <Loader2 className="w-3 h-3 animate-spin text-[var(--amber)] shrink-0" />
                  ) : agent.done ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                  ) : (
                    <div className="w-3 h-3 rounded-full border border-border shrink-0" />
                  )}
                  <span className={cn("font-medium", agent.active ? "text-[var(--amber)]" : agent.done ? "text-foreground" : "text-muted-foreground")}>
                    {agent.label}
                  </span>
                </div>
              ))}
            </div>
          </CardHeader>

          {/* Live Activity Log */}
          {(isGenerating || result) && (
            <CardContent className="pt-0 space-y-2 border-t border-border">
              <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase pt-3">Live Activity</p>
              {isGenerating ? (
                <div className="space-y-2">
                  {[
                    "Pulling Deal DNA from pipeline...",
                    "Inserting behavioral profile into R&W clause...",
                    "Structuring earn-out milestones...",
                  ].map((msg, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <Loader2 className="w-2.5 h-2.5 animate-spin text-[var(--amber)] shrink-0 mt-0.5" />
                      <p className="text-[10px] text-muted-foreground">{msg}</p>
                    </div>
                  ))}
                </div>
              ) : result?.agentLog ? (
                <div className="space-y-2">
                  {result.agentLog.map((item, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="text-[9px] font-mono text-muted-foreground shrink-0 mt-0.5">{item.time}</span>
                      <p className={cn("text-[10px] leading-relaxed", item.type === "flag" ? "text-[var(--amber)]" : "text-muted-foreground")}>
                        {item.action}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          )}

          {/* Co-Analyst Context */}
          {result?.coAnalystContext && (
            <CardContent className="pt-0 border-t border-border">
              <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase pt-3 mb-2">Co-Analyst Context</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{result.coAnalystContext}</p>
            </CardContent>
          )}

          {/* Generate Button (sidebar) */}
          {!result && !isGenerating && (
            <CardContent className="pt-0 border-t border-border">
              <Button
                size="sm"
                className="w-full mt-3 gap-2 bg-foreground text-background hover:bg-foreground/90"
                onClick={() => generateLOI.mutate({
                  dealId,
                  purchasePrice,
                  earnOutYear1: earnOutY1,
                  earnOutYear2: earnOutY2,
                  exclusivityDays,
                  contingencies,
                })}
                disabled={isGenerating}
              >
                <Zap className="w-3.5 h-3.5" />
                Initialize New Run →
              </Button>
              <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground justify-center">
                <span className="flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" /> System Logs</span>
                <span>·</span>
                <span>Settings</span>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
