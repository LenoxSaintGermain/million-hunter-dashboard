import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Database, Brain, Bell, Settings2, RefreshCw,
} from "lucide-react";

const SOURCES = [
  { id: "bizbuysell", label: "BizBuySell", tier: "Primary" },
  { id: "dealstream", label: "DealStream", tier: "Primary" },
  { id: "flippa", label: "Flippa", tier: "Primary" },
  { id: "quietlight", label: "Quiet Light", tier: "Premium" },
  { id: "empireflippers", label: "Empire Flippers", tier: "Premium" },
  { id: "axial", label: "Axial", tier: "Enterprise" },
  { id: "bizquest", label: "BizQuest", tier: "Primary" },
  { id: "sunbeltnetwork", label: "Sunbelt Network", tier: "Primary" },
  { id: "loopnet", label: "LoopNet", tier: "Commercial" },
  { id: "businessbroker", label: "BusinessBroker.net", tier: "Primary" },
  { id: "acquire", label: "Acquire.com", tier: "SaaS" },
];

const TIER_COLOR: Record<string, string> = {
  Primary: "bg-blue-500/20 text-blue-400",
  Premium: "bg-purple-500/20 text-purple-400",
  Enterprise: "bg-amber-500/20 text-amber-400",
  Commercial: "bg-emerald-500/20 text-emerald-400",
  SaaS: "bg-pink-500/20 text-pink-400",
};

export default function Settings() {
  const [enabledSources, setEnabledSources] = useState<Set<string>>(
    new Set(["bizbuysell", "dealstream", "flippa", "quietlight", "empireflippers"])
  );
  const [minCashFlow, setMinCashFlow] = useState([500000]);
  const [maxMultiple, setMaxMultiple] = useState([4.5]);
  const [autoScore, setAutoScore] = useState(true);
  const [autoMemo, setAutoMemo] = useState(false);
  const [notifyOnRedFlag, setNotifyOnRedFlag] = useState(true);
  const [notifyOnHighScore, setNotifyOnHighScore] = useState(true);

  const triggerScan = trpc.scan.trigger.useMutation({
    onSuccess: (data) => toast.success(data.message),
    onError: (e) => toast.error(`Scan failed: ${e.message}`),
  });

  const toggleSource = (id: string) => {
    setEnabledSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">System Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Configure the Signal Hunter acquisition engine</p>
        </div>
        <Button size="sm" className="h-9 text-xs" onClick={() => triggerScan.mutate({ sources: Array.from(enabledSources), minCashFlow: minCashFlow[0], maxMultiple: maxMultiple[0] })} disabled={triggerScan.isPending}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${triggerScan.isPending ? "animate-spin" : ""}`} />
          {triggerScan.isPending ? "Triggering..." : "Trigger Scan Now"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Scan Sources */}
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Market Scan Sources</CardTitle>
            </div>
            <CardDescription className="text-xs">{enabledSources.size} of {SOURCES.length} sources active</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {SOURCES.map((source) => (
                <button key={source.id} onClick={() => toggleSource(source.id)} className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${enabledSources.has(source.id) ? "border-primary/50 bg-primary/10" : "border-border bg-muted/20 opacity-50"}`}>
                  <div>
                    <p className="text-xs font-medium text-foreground">{source.label}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-medium ${TIER_COLOR[source.tier]}`}>{source.tier}</span>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${enabledSources.has(source.id) ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Scoring Filters */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-amber-400" /> Scoring Filters
            </CardTitle>
            <CardDescription className="text-xs">Minimum thresholds for deal qualification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Min. Annual Cash Flow</Label>
                <span className="text-xs font-bold text-foreground">${(minCashFlow[0] / 1000).toFixed(0)}k</span>
              </div>
              <Slider value={minCashFlow} onValueChange={setMinCashFlow} min={100000} max={2000000} step={50000} />
              <div className="flex justify-between text-[10px] text-muted-foreground/60"><span>$100k</span><span>$2M</span></div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Max. EBITDA Multiple</Label>
                <span className="text-xs font-bold text-foreground">{maxMultiple[0].toFixed(1)}x</span>
              </div>
              <Slider value={maxMultiple} onValueChange={setMaxMultiple} min={1} max={10} step={0.5} />
              <div className="flex justify-between text-[10px] text-muted-foreground/60"><span>1x</span><span>10x</span></div>
            </div>
          </CardContent>
        </Card>

        {/* AI Automation */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-400" /> AI Automation
            </CardTitle>
            <CardDescription className="text-xs">Configure Gemini-powered automation triggers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { id: "auto-score", label: "Auto-Score New Deals", desc: "Run Gemini scoring on every new listing found", model: "gemini-2.5-flash", value: autoScore, set: setAutoScore },
              { id: "auto-memo", label: "Auto-Generate Memos", desc: "Generate investment memos for deals scoring >0.75", model: "gemini-2.5-pro", value: autoMemo, set: setAutoMemo },
            ].map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-foreground">{item.label}</p>
                    <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-sm">{item.model}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
                <Switch checked={item.value} onCheckedChange={item.set} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-400" /> Notifications
            </CardTitle>
            <CardDescription className="text-xs">Alert preferences for deal pipeline events</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { id: "red-flag", label: "Red Flag Alerts", desc: "Notify when Red Team kill probability exceeds 70%", value: notifyOnRedFlag, set: setNotifyOnRedFlag },
              { id: "high-score", label: "High-Score Alerts", desc: "Notify when a deal scores above 0.80", value: notifyOnHighScore, set: setNotifyOnHighScore },
            ].map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-xs font-medium text-foreground">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
                <Switch checked={item.value} onCheckedChange={item.set} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Model Configuration */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Brain className="w-4 h-4 text-emerald-400" /> Model Configuration
            </CardTitle>
            <CardDescription className="text-xs">AI model assignments per Third Signal module</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { module: "Deal Scoring", model: "gemini-2.5-flash", purpose: "Fast batch scoring" },
                { module: "Owner Psychology", model: "claude-3-5-sonnet", purpose: "Human behavioral analysis" },
                { module: "Digital Audit", model: "sonar-pro", purpose: "Live web research" },
                { module: "Red Team Analysis", model: "gemini-2.5-pro", purpose: "Deep adversarial reasoning" },
                { module: "Capital Stack", model: "gemini-2.5-flash", purpose: "Financial modeling" },
                { module: "Investment Memo", model: "gemini-2.5-pro", purpose: "Long-form synthesis" },
              ].map((row) => (
                <div key={row.module} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                  <div>
                    <p className="text-xs font-medium text-foreground">{row.module}</p>
                    <p className="text-[10px] text-muted-foreground">{row.purpose}</p>
                  </div>
                  <span className="text-[10px] bg-muted/40 text-muted-foreground px-2 py-0.5 rounded-md font-mono">{row.model}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
