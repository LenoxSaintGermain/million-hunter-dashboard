/**
 * Capital Aperture — Account Management
 * Create and manage portfolio accounts (Alpaca paper, manual entry).
 * INTERNAL RESEARCH TOOL — NOT INVESTMENT ADVICE.
 */
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { invalidateAccountRefreshReads } from "@/lib/accountRefreshInvalidation";
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
import { AccountContextPanel } from "@/components/aperture/AccountContextPanel";
import { parsePortfolioCsv } from "@shared/portfolioCsv";
import { AccountHoldingsPortrait, accountMoney, accountStamp } from "@/components/aperture/AccountHoldingsPortrait";
import "@/styles/account-portfolio-editorial.css";

const DISCLAIMER = "Internal research tool — not investment advice. Practice trading only — no real capital.";

/** UAT-E3 copy for book-mode rows (Practice Books). */
export const PRACTICE_BOOK_COPY = {
  title: "Your practice book",
  subtitle: "Alpaca paper fills · shared practice account",
  source: "Practice book (Alpaca paper fills)",
  explainer: "Your cash, positions and limits are yours alone. Orders fill in a shared Alpaca paper account, so another tester's open order can briefly block yours.",
  resetConfirm: "Archive this book and start fresh with $100,000? Your history and scorecard stay in Record.",
  disconnectTitle: "Stop using this old account",
  disconnectExplainer: "This older Alpaca paper row is not your practice book. Disconnect it so pages stop picking it.",
  disconnectConfirm: "Disconnect this old Alpaca paper account? Nothing is sold or cancelled at Alpaca. This row just stops being used here, and its saved positions are cleared from this app.",
} as const;

/** Only a tester's own older raw Alpaca paper row gets Disconnect; the owner's row and practice books never do. */
export function canDisconnectAccount(account: { brokerId: string; practiceBook?: unknown | null }, isOwner: boolean): boolean {
  return !isOwner && account.brokerId === "alpaca_paper" && account.practiceBook == null;
}

export function bookAge(openedAt: number, now = Date.now()): string {
  const days = Math.max(0, Math.floor((now - openedAt) / 86_400_000));
  return days === 0 ? "Opened today" : `${days} day${days === 1 ? "" : "s"}`;
}

function signedMoney(cents: number | null | undefined): string {
  if (cents == null) return "Not measured yet";
  return `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${accountMoney(Math.abs(cents))}`;
}

function fmt(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export default function ApertureAccounts() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [showCreate, setShowCreate] = useState(false);
  const [label, setLabel] = useState("");
  const [brokerId, setBrokerId] = useState<"alpaca_paper" | "manual" | "robinhood_mcp">("alpaca_paper");
  const [startingCash, setStartingCash] = useState("");
  const [csvAccountId, setCsvAccountId] = useState<number | null>(null);
  const [csvText, setCsvText] = useState("");
  const [syncFeedback, setSyncFeedback] = useState<{ accountId: number; message: string; tone: "success" | "error" } | null>(null);

  const { user } = useAuth();
  const isOwner = user?.role === "admin";
  const { data: accounts, refetch, isLoading, isError } = trpc.aperture.account.list.useQuery();
  const { data: brokers, isError: brokersFailed, refetch: retryBrokers } = trpc.aperture.brokers.useQuery();

  const createAccount = trpc.aperture.account.create.useMutation({
    onSuccess: () => {
      toast.success("Account created");
      setShowCreate(false);
      setLabel(""); setStartingCash("");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const syncAccount = trpc.aperture.account.sync.useMutation({
    onSuccess: async (_, variables) => {
      const message = "Paper account snapshot refreshed. No order was created or changed.";
      setSyncFeedback({ accountId: variables.id, message, tone: "success" });
      toast.success("Account synced");
      await invalidateAccountRefreshReads(utils.aperture, variables.id);
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

  const resetBook = trpc.aperture.practiceBook.reset.useMutation({
    onSuccess: async (result, variables) => {
      const message = result.measured
        ? "New practice book opened with $100,000. Your earlier trades stay in Record."
        : "New practice book opened with $100,000. Refresh balances to measure it. Your earlier trades stay in Record.";
      setSyncFeedback({ accountId: variables.accountId, message, tone: "success" });
      toast.success("Practice book reset");
      await invalidateAccountRefreshReads(utils.aperture, variables.accountId);
    },
    onError: (e, variables) => {
      setSyncFeedback({ accountId: variables.accountId, message: e.message, tone: "error" });
      toast.error(e.message);
      refetch();
    },
  });

  const disconnectAccount = trpc.aperture.account.disconnect.useMutation({
    onSuccess: async (_, variables) => {
      toast.success("Old account disconnected. Nothing changed at Alpaca.");
      await invalidateAccountRefreshReads(utils.aperture, variables.id);
      refetch();
    },
    onError: (e, variables) => {
      setSyncFeedback({ accountId: variables.id, message: e.message, tone: "error" });
      toast.error(e.message);
    },
  });

  const importCsv = trpc.aperture.account.importCsv.useMutation({
    onSuccess: async ({ imported }, variables) => {
      toast.success(`${imported} position(s) imported`);
      setCsvText(""); setCsvAccountId(null);
      await invalidateAccountRefreshReads(utils.aperture, variables.accountId);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!label.trim()) return toast.error("Enter an account label");
    if (startingCash.trim() && (!Number.isFinite(Number(startingCash)) || Number(startingCash) < 0)) return toast.error("Enter a valid non-negative paper cash amount");
    if (!window.confirm(`Create paper account “${label.trim()}” with ${brokerId}? No order will be placed.`)) return;
    createAccount.mutate({
      label: label.trim(),
      brokerId,
      isPaper: true,
      startingCashCents: startingCash.trim() && Number.isFinite(Number(startingCash))
        ? Math.round(Number(startingCash) * 100)
        : undefined,
    });
  };

  const csvPreview = useMemo(() => parsePortfolioCsv(csvText), [csvText]);
  const csvErrors = csvPreview.filter((row) => row.error);
  const csvRows = csvPreview.filter((row) => !row.error).map(({ error: _error, ...row }) => row);

  const handleImportCsv = (accountId: number, mode: "merge" | "replace") => {
    if (!csvText.trim()) return toast.error("Paste CSV data first");
    if (csvErrors.length) return toast.error(csvErrors[0]?.error ?? "Fix the invalid CSV rows before importing.");
    if (!csvRows.length) return toast.error("No valid holdings found.");
    const target = accounts?.find(account => account.id === accountId);
    if (!target || csvAccountId !== accountId) return;
    if (!window.confirm(`${mode === "replace" ? "Replace all existing holdings" : "Merge holdings"} in “${target.label}” (account #${accountId}) with ${csvRows.length} CSV rows? ${mode === "replace" ? "Existing holdings will be removed first. " : "Other tickers will be preserved. "}No broker order will be placed.`)) return;
    importCsv.mutate({ accountId, mode, rows: csvRows });
  };

  return (
    <DashboardLayout>
      <div className="account-portfolio mx-auto max-w-5xl space-y-5 px-4 py-5 sm:px-6 sm:py-7">
        {/* Disclaimer */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium"
          style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)", border: "1px solid var(--sh-border-1)" }}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-signal)" }} />
          {DISCLAIMER}
        </div>

        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Back to Today" onClick={() => navigate("/aperture")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--sh-text-primary)" }}>Portfolio</h1>
            <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>
              A saved portrait of each account. Balances stay separate.
            </p>
          </div>
          <Button className="ml-auto min-h-11" size="sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Account
          </Button>
        </div>

        {isLoading && <p role="status">Loading accounts…</p>}
        {isError && <div role="alert" className="rounded-lg border border-clay p-4 text-sm"><p>Account refresh failed. {accounts ? "Showing the last loaded balances; they may be out of date." : "Balances and holdings are unavailable."}</p><Button variant="outline" className="mt-2 min-h-11" onClick={() => refetch()}>Retry accounts</Button></div>}
        {brokersFailed && <div role="alert" className="rounded-lg border border-clay p-4 text-sm"><p>Broker connection status is unavailable. Account balances alone do not confirm connectivity.</p><Button variant="outline" className="mt-2 min-h-11" onClick={() => retryBrokers()}>Retry connections</Button></div>}

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
                <Label className="text-xs">Starting paper cash ($) <span className="opacity-50">optional — replaced by an Alpaca Paper sync</span></Label>
                <Input placeholder="e.g. 25000" value={startingCash} onChange={(e) => setStartingCash(e.target.value)} inputMode="decimal" />
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
        {!isError && !isLoading && accounts?.length === 0 && !showCreate && (
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
          <Card key={account.id} className="account-sheet">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="account-annotation">Account #{account.id} / {account.practiceBook ? `practice book · generation ${account.practiceBook.generation}` : "isolated snapshot"}</p>
                  <CardTitle className="account-title flex flex-wrap items-center gap-2 break-words">
                    {account.practiceBook ? PRACTICE_BOOK_COPY.title : account.label}
                    <Badge variant="outline" className="text-xs">
                      {brokers?.find((broker) => broker.id === account.brokerId)?.label ?? (account.brokerId === "alpaca_paper" ? "Alpaca Paper" : account.brokerId === "manual" ? "Manual import" : "Robinhood context")}
                    </Badge>
                    {account.isPaper && (
                      <Badge className="text-xs" style={{ background: "oklch(0.45 0.15 145)", color: "#fff" }}>paper</Badge>
                    )}
                  </CardTitle>
                  <p className="text-xs mt-1 break-words" style={{ color: "var(--sh-fg-muted)" }}>
                    {account.practiceBook
                      ? `${PRACTICE_BOOK_COPY.subtitle}${account.practiceBook.houseAccount ? ` · ${account.practiceBook.houseAccount}` : ""}`
                      : account.externalAccountId ? `Paper account · ${account.externalAccountId}` : account.brokerId === "manual" ? "Research only · cannot send orders" : "Paper account not linked yet"}
                    {` · ${accountStamp(account.lastSyncedAt)}`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-11 shrink-0"
                  onClick={() => { if (window.confirm(`Refresh saved balances and holdings for “${account.label}” (account #${account.id}) from the broker? No orders or research will be started.`)) syncAccount.mutate({ id: account.id }); }}
                  disabled={syncAccount.isPending || account.brokerId === "manual"}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  {account.brokerId === "manual" ? "Use CSV below" : syncAccount.isPending && syncAccount.variables?.id === account.id ? "Refreshing…" : "Refresh balances"}
                </Button>
              </div>
              {syncFeedback?.accountId === account.id && (
                <div role={syncFeedback.tone === "error" ? "alert" : "status"} className={`mt-3 rounded-md border px-3 py-2 text-xs leading-5 ${syncFeedback.tone === "error" ? "border-clay/45 bg-clay/5 text-ink" : "border-sage/45 bg-sage/5 text-ink"}`}>
                  {syncFeedback.message}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="account-spread">
                <div className="account-value">
                  <span className="account-annotation">{account.practiceBook ? "Practice book equity" : "Recorded account equity"}</span>
                  <strong>{accountMoney(account.practiceBook ? account.practiceBook.equityValueCents : account.equityValueCents)}</strong>
                  <p>{accountStamp(account.lastSyncedAt)}</p>
                  <p>Source: {account.practiceBook ? PRACTICE_BOOK_COPY.source : account.syncSource || (account.brokerId === "manual" ? "Manual record" : "Not recorded")}</p>
                  {account.syncError && <p role="alert">Last sync failed: {account.syncError}. These are saved values.</p>}
                  {account.practiceBook?.status === "frozen" && <p role="alert">Paused for owner review: {account.practiceBook.frozenReason ?? "the shared practice account is being reconciled"}.</p>}
                  {account.practiceBook ? (
                    <dl aria-label="Practice book summary">
                      <div><dt>Starting cash</dt><dd>{accountMoney(account.practiceBook.startingCashCents)}</dd></div>
                      <div><dt>P&amp;L since start</dt><dd>{signedMoney(account.practiceBook.pnlSinceStartCents)}</dd></div>
                      <div><dt>Cash</dt><dd>{accountMoney(account.cashCents)}</dd></div>
                      <div><dt>Book buying power</dt><dd>{accountMoney(account.buyingPowerCents)}</dd></div>
                      <div><dt>Book age</dt><dd>{bookAge(account.practiceBook.openedAt)}</dd></div>
                    </dl>
                  ) : (
                    <dl><div><dt>Cash</dt><dd>{accountMoney(account.cashCents)}</dd></div><div><dt>Broker buying power</dt><dd>{accountMoney(account.buyingPowerCents)}</dd></div></dl>
                  )}
                  <small>{account.practiceBook ? PRACTICE_BOOK_COPY.explainer : "Buying power may include leverage. It is not cash or permission to deploy."}</small>
                </div>
                <AccountHoldingsPortrait accountId={account.id} />
              </div>
              <details className="account-controls">
                <summary>Account controls · connection, CSV and freshness schedule</summary>
                <div className="space-y-3 py-3">
              {/* Broker availability */}
              {account.brokerId === "manual" ? (
                <div className="flex items-center gap-2 text-xs">
                  <XCircle className="h-3.5 w-3.5" style={{ color: "var(--sh-fg-muted)" }} />
                  <span style={{ color: "var(--sh-fg-muted)" }}>Imported holdings · update by CSV. No automatic refresh or broker orders.</span>
                </div>
              ) : brokers?.find((b) => b.id === account.brokerId) && (
                <div className="flex items-center gap-2 text-xs">
                  {brokers.find((b) => b.id === account.brokerId)!.available ? (
                    <><CheckCircle2 className="h-3.5 w-3.5" style={{ color: "oklch(0.55 0.15 145)" }} />
                    <span style={{ color: "var(--sh-fg-muted)" }}>Broker available · account linkage and snapshot freshness are separate checks.</span></>
                  ) : (
                    <><XCircle className="h-3.5 w-3.5" style={{ color: "var(--sh-fg-muted)" }} />
                    <span style={{ color: "var(--sh-fg-muted)" }}>
                      <strong>Not connected:</strong> {brokers.find((b) => b.id === account.brokerId)!.unavailableReason ?? "Import a CSV for research, or configure the broker connection."}
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
                      <p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>Automatic balance updates · {account.syncScheduleEnabled ? "On" : "Off"}</p>
                      <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Every 15 minutes during active US market sessions when enabled. Balances only—not play monitoring or orders.</p>
                      {!brokers?.find((b) => b.id === account.brokerId)?.available && <p className="mt-1 text-xs">Connect the broker before changing automatic updates.</p>}
                      {account.syncScheduleLastResult && <p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>Last check: {account.syncScheduleLastResult}</p>}
                    </div>
                    <Button
                      variant={account.syncScheduleEnabled ? "outline" : "default"}
                      size="sm"
                      className="min-h-11 shrink-0"
                      onClick={() => { if (window.confirm(`${account.syncScheduleEnabled ? "Pause" : "Enable"} automatic balance updates for “${account.label}” (account #${account.id})? This affects balances only, never research or orders.`)) configureSyncSchedule.mutate({ id: account.id, enabled: !account.syncScheduleEnabled }); }}
                      disabled={configureSyncSchedule.isPending || !brokers?.find((b) => b.id === account.brokerId)?.available}
                    >
                      {account.syncScheduleEnabled ? "Pause updates" : "Enable updates"}
                    </Button>
                  </div>
                </div>
              )}

              {canDisconnectAccount(account, isOwner) && (
                <div className="border p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>{PRACTICE_BOOK_COPY.disconnectTitle}</p>
                      <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{PRACTICE_BOOK_COPY.disconnectExplainer}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 shrink-0 rounded-none"
                      aria-label={`Disconnect old Alpaca paper account #${account.id}`}
                      onClick={() => { if (window.confirm(PRACTICE_BOOK_COPY.disconnectConfirm)) disconnectAccount.mutate({ id: account.id }); }}
                      disabled={disconnectAccount.isPending}
                    >
                      {disconnectAccount.isPending && disconnectAccount.variables?.id === account.id ? "Disconnecting…" : "Disconnect"}
                    </Button>
                  </div>
                </div>
              )}

              {account.practiceBook && (
                <div className="rounded-lg border p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>Start a fresh book</p>
                      <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Archives this book and opens a new one with $100,000. Your history and scorecard stay in Record.</p>
                      {account.practiceBook.resetBlockedReason && <p id={`reset-blocked-${account.id}`} className="mt-1 text-xs">{account.practiceBook.resetBlockedReason}</p>}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 shrink-0"
                      aria-label={`Reset practice book for account #${account.id}`}
                      aria-describedby={account.practiceBook.resetBlockedReason ? `reset-blocked-${account.id}` : undefined}
                      onClick={() => { if (window.confirm(PRACTICE_BOOK_COPY.resetConfirm)) resetBook.mutate({ accountId: account.id }); }}
                      disabled={resetBook.isPending || Boolean(account.practiceBook.resetBlockedReason)}
                    >
                      {resetBook.isPending && resetBook.variables?.accountId === account.id ? "Resetting…" : "Reset book"}
                    </Button>
                  </div>
                </div>
              )}

              <Separator />

              {/* CSV import */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-xs font-medium">Import Positions (CSV)</Label>
                  {csvAccountId === account.id && <span className="text-xs break-all" style={{ color: "var(--sh-fg-muted)" }}>Broker export or symbol,qty,avg_cost,market_value</span>}
                </div>
                {csvAccountId === account.id ? (
                  <div className="space-y-2">
                    <textarea
                      aria-label={`CSV holdings for ${account.label}, account ${account.id}`}
                      className="w-full h-24 text-xs p-2 rounded border font-mono resize-none"
                      style={{ background: "var(--sh-surface-2)", borderColor: "var(--sh-border-1)", color: "var(--sh-text-primary)" }}
                      placeholder={"symbol,qty,avg_cost,market_value\nNVDA,50,450.00,22500\nMSFT,30,380.00,11400"}
                      value={csvText}
                      onChange={(e) => setCsvText(e.target.value)}
                    />
                    {csvPreview.length > 0 && (
                      <div className="overflow-hidden rounded-md border" style={{ borderColor: csvErrors.length ? "var(--sh-red)" : "var(--sh-border-1)" }}>
                        <div className="grid grid-cols-[1fr_0.7fr_1fr] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider" style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)" }}><span>Ticker</span><span>Quantity</span><span>Market value</span></div>
                        {csvPreview.slice(0, 6).map((row, index) => <div key={`${row.symbol}-${index}`} className="grid grid-cols-[1fr_0.7fr_1fr] gap-2 border-t px-3 py-2 text-xs" style={{ borderColor: "var(--sh-border-1)", color: row.error ? "var(--sh-red)" : "var(--sh-text-primary)" }}><span>{row.symbol || "Invalid row"}</span><span>{row.qty || "—"}</span><span>{row.error ?? fmt(row.marketValueCents)}</span></div>)}
                        {csvPreview.length > 6 && <p className="border-t px-3 py-2 text-[11px]" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>+ {csvPreview.length - 6} more row(s)</p>}
                      </div>
                    )}
                    <p className="text-[11px] leading-5" style={{ color: "var(--sh-fg-muted)" }}>Merge updates matching tickers and preserves the rest. Replace removes every existing holding first. Negative quantities remain short positions.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => handleImportCsv(account.id, "merge")} disabled={importCsv.isPending || !csvRows.length || csvErrors.length > 0}>
                        <Upload className="h-3.5 w-3.5 mr-1" />
                        {importCsv.isPending ? "Importing…" : `Merge ${csvRows.length || ""} holding${csvRows.length === 1 ? "" : "s"}`}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleImportCsv(account.id, "replace")} disabled={importCsv.isPending || !csvRows.length || csvErrors.length > 0}>Replace all holdings</Button>
                      <Button variant="outline" size="sm" onClick={() => { setCsvAccountId(null); setCsvText(""); }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => { setCsvText(""); setCsvAccountId(account.id); }}>
                    <Upload className="h-3.5 w-3.5 mr-1" /> Import CSV
                  </Button>
                )}
              </div>

                </div>
              </details>
              <details>
                <summary>Holding actions · exit review and recorded plays</summary>
                <p className="account-annotation py-3">Account #{account.id} only. Exit opens a review; approval and submission remain separate human actions.</p>
                <AccountContextPanel accountId={account.id} />
              </details>
            </CardContent>
          </Card>
        ))}

        {/* Broker status panel */}
        <details className="rounded-lg border border-rule p-4">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-medium">Connections and order safeguards</summary>
          <p className="mb-3 text-sm">Research → evidence review → practice order. Approval and submission are separate human actions.</p>
          <Button variant="outline" className="mb-3 min-h-11" onClick={() => navigate("/aperture/runs")}>Open research <ArrowRight className="ml-2 h-4 w-4" /></Button>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Broker connections</CardTitle>
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
                  {b.capabilities?.paperTrading && <Badge variant="outline" className="text-xs" style={{ color: "oklch(0.55 0.15 145)" }}>paper</Badge>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        </details>
      </div>
    </DashboardLayout>
  );
}
