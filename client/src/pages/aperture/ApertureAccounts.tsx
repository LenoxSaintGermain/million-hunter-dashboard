/**
 * Capital Aperture — Account Management
 * Create and manage portfolio accounts (Alpaca paper, manual entry).
 * INTERNAL RESEARCH TOOL — NOT INVESTMENT ADVICE.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Plus, RefreshCw, Upload, Wallet, CheckCircle2, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

const DISCLAIMER = "Internal research tool — not investment advice. Paper only — no real capital.";

function fmt(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export default function ApertureAccounts() {
  const [, navigate] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [label, setLabel] = useState("");
  const [brokerId, setBrokerId] = useState<"alpaca_paper" | "manual" | "robinhood_mcp">("alpaca_paper");
  const [cashCents, setCashCents] = useState("");
  const [csvAccountId, setCsvAccountId] = useState<number | null>(null);
  const [csvText, setCsvText] = useState("");
  const [syncFeedback, setSyncFeedback] = useState<{ accountId: number; message: string; tone: "success" | "error" } | null>(null);

  const { data: accounts, refetch } = trpc.aperture.account.list.useQuery();
  const { data: brokers } = trpc.aperture.brokers.useQuery();

  const createAccount = trpc.aperture.account.create.useMutation({
    onSuccess: () => {
      toast.success("Account created");
      setShowCreate(false);
      setLabel(""); setCashCents("");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const syncAccount = trpc.aperture.account.sync.useMutation({
    onSuccess: (_, variables) => {
      const message = "Paper account snapshot refreshed. No order was created or changed.";
      setSyncFeedback({ accountId: variables.id, message, tone: "success" });
      toast.success("Account synced");
      refetch();
    },
    onError: (e, variables) => {
      setSyncFeedback({ accountId: variables.id, message: e.message, tone: "error" });
      toast.error(e.message);
      refetch();
    },
  });

  const configureSyncSchedule = trpc.aperture.account.configureSyncSchedule.useMutation({
    onSuccess: ({ enabled }) => { toast.success(enabled ? "Paper-account freshness schedule enabled" : "Paper-account freshness schedule paused"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const importCsv = trpc.aperture.account.importCsv.useMutation({
    onSuccess: ({ imported }) => {
      toast.success(`${imported} position(s) imported`);
      setCsvText(""); setCsvAccountId(null);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!label.trim()) return toast.error("Enter an account label");
    createAccount.mutate({
      label: label.trim(),
      brokerId,
      isPaper: true,
    });
  };

  const handleImportCsv = (accountId: number) => {
    if (!csvText.trim()) return toast.error("Paste CSV data first");
    const rows = csvText.trim().split("\n").map((line) => {
      const [sym, qty, avgCost, mktVal] = line.split(",").map((s) => s.trim());
      return {
        symbol: sym,
        qty: parseFloat(qty) || 0,
        avgCostCents: avgCost ? Math.round(parseFloat(avgCost) * 100) : undefined,
        marketValueCents: mktVal ? Math.round(parseFloat(mktVal) * 100) : undefined,
      };
    }).filter((r) => r.symbol && r.qty > 0);
    if (!rows.length) return toast.error("No valid rows — format: symbol,qty,avg_cost,market_value");
    importCsv.mutate({ accountId, rows });
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 sm:px-6 sm:py-7">
        {/* Disclaimer */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium"
          style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)", border: "1px solid var(--sh-border-1)" }}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-signal)" }} />
          {DISCLAIMER}
        </div>

        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/aperture")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--sh-text-primary)" }}>Paper readiness</h1>
            <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>
              See how research becomes a human-approved paper action. No live capital and no autonomous order.
            </p>
          </div>
          <Button className="ml-auto" size="sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Account
          </Button>
        </div>

        <section className="border border-rule bg-paper p-4" aria-label="Research to paper action flow">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-eyebrow text-eyebrow text-amber">How this works</p><p className="mt-1 text-sm text-ink">Research informs a proposed paper action; a human controls every approval and submission.</p></div>
            <button onClick={() => navigate("/aperture/runs")} className="inline-flex shrink-0 items-center gap-1 text-xs text-amber hover:underline">Open research journeys <ArrowRight className="h-3 w-3" /></button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-rule pt-4 sm:grid-cols-4">
            {["1 · Sync context", "2 · Review decisive checks", "3 · Approve paper order", "4 · Track fill & follow-up"].map((step, index) => <div key={step} className="min-w-0"><p className="font-eyebrow text-eyebrow text-muted-foreground">{step}</p><p className="mt-1 text-xs leading-5 text-ink/70">{["Refresh a connected Alpaca Paper account now, or opt in to bounded freshness checks; manual accounts use CSV.", "Only decision-critical evidence gates order review.", "Approval and submission are separate human actions.", "Filled paper orders enter monitoring and outcome analysis."][index]}</p></div>)}
          </div>
        </section>

        {/* Create form */}
        {showCreate && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">New Account</CardTitle>
              <CardDescription>Alpaca Paper can refresh this account on demand when the broker is reachable; no order is created by a sync.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Label</Label>
                  <Input placeholder="e.g. Alpaca Paper — AI Thesis" value={label} onChange={(e) => setLabel(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Broker</Label>
                  <Select value={brokerId} onValueChange={(v) => setBrokerId(v as "alpaca_paper" | "manual" | "robinhood_mcp")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {brokers?.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.label}
                          {!b.available && <span className="ml-2 opacity-50 text-xs">(not configured)</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Starting Cash ($) <span className="opacity-50">optional — overridden by sync</span></Label>
                <Input placeholder="e.g. 25000" value={cashCents} onChange={(e) => setCashCents(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreate} disabled={createAccount.isPending}>
                  {createAccount.isPending ? "Creating…" : "Create Account"}
                </Button>
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Account list */}
        {accounts?.length === 0 && !showCreate && (
          <Card>
            <CardContent className="pt-8 pb-8 text-center">
              <Wallet className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>No accounts yet</p>
              <p className="text-xs mt-1 mb-4" style={{ color: "var(--sh-fg-muted)" }}>
                Create an Alpaca paper account to test the full order flow, or a manual account to enter holdings by CSV.
              </p>
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Create Account
              </Button>
            </CardContent>
          </Card>
        )}

        {accounts?.map((account) => (
          <Card key={account.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {account.label}
                    <Badge variant="outline" className="text-xs">
                      {account.brokerId}
                    </Badge>
                    {account.isPaper && (
                      <Badge className="text-xs" style={{ background: "oklch(0.45 0.15 145)", color: "#fff" }}>paper</Badge>
                    )}
                  </CardTitle>
                  <p className="text-xs mt-0.5" style={{ color: "var(--sh-fg-muted)" }}>
                    Cash: {fmt(account.cashCents)} · Buying power: {fmt(account.buyingPowerCents)} · Equity: {fmt(account.equityValueCents)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncAccount.mutate({ id: account.id })}
                  disabled={syncAccount.isPending || account.brokerId === "manual"}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  {account.brokerId === "manual" ? "Imported context" : "Sync"}
                </Button>
              </div>
              {syncFeedback?.accountId === account.id && (
                <div role={syncFeedback.tone === "error" ? "alert" : "status"} className={`mt-3 rounded-md border px-3 py-2 text-xs leading-5 ${syncFeedback.tone === "error" ? "border-clay/45 bg-clay/5 text-ink" : "border-sage/45 bg-sage/5 text-ink"}`}>
                  {syncFeedback.message}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Broker availability */}
              {account.brokerId === "manual" ? (
                <div className="flex items-center gap-2 text-xs">
                  <XCircle className="h-3.5 w-3.5" style={{ color: "var(--sh-fg-muted)" }} />
                  <span style={{ color: "var(--sh-fg-muted)" }}><strong>Manual context:</strong> these holdings came from an import. They inform research, but nothing syncs automatically and no broker order can be sent from this account.</span>
                </div>
              ) : brokers?.find((b) => b.id === account.brokerId) && (
                <div className="flex items-center gap-2 text-xs">
                  {brokers.find((b) => b.id === account.brokerId)!.available ? (
                    <><CheckCircle2 className="h-3.5 w-3.5" style={{ color: "oklch(0.55 0.15 145)" }} />
                    <span style={{ color: "oklch(0.55 0.15 145)" }}><strong>Connected:</strong> sync now, or enable a bounded freshness schedule below. Research still requires human evidence review, order approval, and a separate paper submission.</span></>
                  ) : (
                    <><XCircle className="h-3.5 w-3.5" style={{ color: "var(--sh-fg-muted)" }} />
                    <span style={{ color: "var(--sh-fg-muted)" }}>
                      <strong>Manual context:</strong> {brokers.find((b) => b.id === account.brokerId)!.unavailableReason ?? "positions are not connected; import a CSV to use them in research."}
                    </span></>
                  )}
                </div>
              )}

              {/* Constraints */}
              {brokers?.find((b) => b.id === account.brokerId)?.capabilities?.constraints?.length ? (
                <div className="space-y-1">
                  {brokers.find((b) => b.id === account.brokerId)!.capabilities.constraints!.map((c: string, i: number) => (
                    <p key={i} className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>• {c}</p>
                  ))}
                </div>
              ) : null}

              {account.brokerId === "alpaca_paper" && account.isPaper && (
                <div className="rounded-lg border p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>Paper-account freshness</p>
                      <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>When enabled, this account is read every 15 minutes during active US market sessions. It updates the research denominator only; it cannot create, approve, or submit an order.</p>
                      {account.syncScheduleLastResult && <p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>Last check: {account.syncScheduleLastResult}</p>}
                    </div>
                    <Button
                      variant={account.syncScheduleEnabled ? "outline" : "default"}
                      size="sm"
                      onClick={() => configureSyncSchedule.mutate({ id: account.id, enabled: !account.syncScheduleEnabled })}
                      disabled={configureSyncSchedule.isPending || !brokers?.find((b) => b.id === account.brokerId)?.available}
                    >
                      {account.syncScheduleEnabled ? "Pause freshness" : "Enable freshness"}
                    </Button>
                  </div>
                </div>
              )}

              <Separator />

              {/* CSV import */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Import Positions (CSV)</Label>
                  <span className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>symbol,qty,avg_cost,market_value</span>
                </div>
                {csvAccountId === account.id ? (
                  <div className="space-y-2">
                    <textarea
                      className="w-full h-24 text-xs p-2 rounded border font-mono resize-none"
                      style={{ background: "var(--sh-surface-2)", borderColor: "var(--sh-border-1)", color: "var(--sh-text-primary)" }}
                      placeholder={"NVDA,50,450.00,22500\nMSFT,30,380.00,11400\nAAPL,40,195.00,7800"}
                      value={csvText}
                      onChange={(e) => setCsvText(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleImportCsv(account.id)} disabled={importCsv.isPending}>
                        <Upload className="h-3.5 w-3.5 mr-1" />
                        {importCsv.isPending ? "Importing…" : "Import"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { setCsvAccountId(null); setCsvText(""); }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setCsvAccountId(account.id)}>
                    <Upload className="h-3.5 w-3.5 mr-1" /> Import CSV
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Broker status panel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Available Broker Rails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {brokers?.map((b) => (
              <div key={b.id} className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>{b.label}</p>
                  {b.unavailableReason && (
                    <p className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>{b.unavailableReason}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className="text-xs" style={{ color: b.available ? "oklch(0.55 0.15 145)" : "var(--sh-fg-muted)" }}>
                    {b.available ? "connected" : "not configured"}
                  </Badge>
                  {b.capabilities?.serverSideExecution && <Badge variant="outline" className="text-xs">server-side</Badge>}
                  {b.capabilities?.paperTrading && <Badge variant="outline" className="text-xs" style={{ color: "oklch(0.55 0.15 145)" }}>paper</Badge>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
