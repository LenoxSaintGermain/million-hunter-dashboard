/**
 * Capital Aperture — UAT practice-account reconciliation (owner only, UAT-E4).
 * Σ practice books vs the shared Alpaca paper account. Reads only, apart from
 * audited sell pauses and append-only adjustments. Never places an order.
 */
import { unattributedOrderLabel } from "@shared/unattributedOrderLabel";
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { accountMoney, accountStamp } from "@/components/aperture/AccountHoldingsPortrait";
import "@/styles/account-portfolio-editorial.css";

export const RECONCILIATION_COPY = {
  title: "Practice account reconciliation",
  subtitle: "Owner only · every practice book against the shared Alpaca paper account",
  balanced: "Books and the shared account agree.",
  unbalanced: "Books and the shared account disagree. Affected symbols have sells paused; buys stay allowed.",
  unfreezePrompt: (symbol: string) => `Resume sells of ${symbol} for every practice book? Add a note for the audit log (what you checked or adjusted).`,
} as const;

const muted = { color: "var(--sh-fg-muted)" } as const;

export default function ApertureUatReconciliation() {
  const [, navigate] = useLocation();
  const report = trpc.aperture.uat.reconciliation.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const [adjustment, setAdjustment] = useState({ bookId: "", kind: "cash_adjustment", symbol: "", qty: "", cash: "", note: "" });
  const unfreeze = trpc.aperture.uat.unfreezeSymbol.useMutation({
    onSuccess: ({ symbol }) => { toast.success(`Sells of ${symbol} resumed`); report.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const postAdjustment = trpc.aperture.uat.appendAdjustment.useMutation({
    onSuccess: ({ id }) => { toast.success(`Adjustment #${id} posted`); setAdjustment({ bookId: "", kind: "cash_adjustment", symbol: "", qty: "", cash: "", note: "" }); report.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const data = report.data;

  const handleUnfreeze = (symbol: string) => {
    const note = window.prompt(RECONCILIATION_COPY.unfreezePrompt(symbol));
    if (note && note.trim()) unfreeze.mutate({ symbol, note: note.trim() });
  };
  const handleAdjustment = () => {
    const bookId = Number(adjustment.bookId);
    if (!Number.isInteger(bookId) || bookId <= 0) return toast.error("Enter the practice book number");
    if (!adjustment.note.trim()) return toast.error("Explain the adjustment in a note");
    const cashCents = adjustment.cash.trim() ? Math.round(Number(adjustment.cash) * 100) : undefined;
    const qty = adjustment.qty.trim() ? Number(adjustment.qty) : undefined;
    if (!window.confirm(`Post a ${adjustment.kind.replace(/_/g, " ")} to practice book #${bookId}? Adjustments are permanent and audited; no order is placed.`)) return;
    postAdjustment.mutate({
      bookId, kind: adjustment.kind as "cash_adjustment" | "corporate_action" | "reconciliation_writeoff",
      symbol: adjustment.symbol.trim() || undefined, qty, cashCents, note: adjustment.note.trim(),
    });
  };

  return (
    <DashboardLayout>
      <div className="account-portfolio mx-auto max-w-5xl space-y-5 px-4 py-5 sm:px-6 sm:py-7">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Back to Portfolio" onClick={() => navigate("/aperture/accounts")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--sh-text-primary)" }}>{RECONCILIATION_COPY.title}</h1>
            <p className="text-sm" style={muted}>{RECONCILIATION_COPY.subtitle}</p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto min-h-11" onClick={() => report.refetch()} disabled={report.isFetching}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> {report.isFetching ? "Checking…" : "Check again"}
          </Button>
        </div>

        {report.isError && <div role="alert" className="rounded-lg border border-clay p-4 text-sm"><p>{report.error.message}</p></div>}
        {report.isLoading && <p className="text-sm" style={muted}>Reading the shared practice account…</p>}

        {data && (
          <>
            <div role="status" className={`rounded-md border px-3 py-2 text-sm ${data.balanced ? "border-sage/45 bg-sage/5" : "border-clay/45 bg-clay/5"}`}>
              {data.balanced ? RECONCILIATION_COPY.balanced : RECONCILIATION_COPY.unbalanced}
              <span className="block text-xs" style={muted}>Shared account {data.houseExternalAccountId} · {accountStamp(data.asOf)}</span>
            </div>

            <Card className="account-sheet">
              <CardHeader className="pb-3">
                <p className="account-annotation">Positions / all books vs shared account</p>
                <CardTitle className="account-title">By symbol</CardTitle>
              </CardHeader>
              <CardContent>
                {data.symbols.length === 0 ? <p className="text-sm" style={muted}>No positions in the shared account or any book.</p> : (
                  <table className="w-full text-sm" aria-label="Positions by symbol">
                    <thead><tr className="text-left text-xs" style={muted}><th className="py-2">Symbol</th><th>Shared account</th><th>Books</th><th>Difference</th><th>Sells</th></tr></thead>
                    <tbody>
                      {data.symbols.map((line) => (
                        <tr key={line.symbol} className="border-t" style={{ borderColor: "var(--sh-border-1)" }}>
                          <td className="py-2 font-semibold">{line.symbol}</td>
                          <td>{line.houseQty}</td>
                          <td title={line.books.map((book) => `book #${book.bookId} (${book.status}): ${book.qty}`).join("\n")}>{line.bookQty}</td>
                          <td>{line.balanced ? "—" : line.delta > 0 ? `+${line.delta}` : line.delta}</td>
                          <td>{line.frozen ? <Button variant="outline" size="sm" className="min-h-11" aria-label={`Resume sells of ${line.symbol}`} disabled={unfreeze.isPending} onClick={() => handleUnfreeze(line.symbol)}>Paused · Resume</Button> : "Allowed"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <Card className="account-sheet">
              <CardHeader className="pb-3">
                <p className="account-annotation">Cash and orders</p>
                <CardTitle className="account-title">Attribution checks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>Cash drift since the baseline: {data.cash.driftCents == null ? "not measured (no baseline yet)" : `${accountMoney(data.cash.driftCents)} ${data.cash.withinTolerance ? "(within $1)" : "(beyond $1, investigate)"}`}</p>
                <p>Active book cash {accountMoney(data.bookCash.activeBookCashCents)} vs shared buying power {accountMoney(data.bookCash.houseBuyingPowerCents)}{data.bookCash.withinBuyingPower === false ? ": books exceed the shared account" : ""}</p>
                {data.ordersError && <p role="alert">{data.ordersError}</p>}
                {data.unattributedOrders && (data.unattributedOrders.length === 0
                  ? <p style={muted}>Every recent order in the shared account carries a practice-book or owner tag.</p>
                  : <div><p className="font-semibold">Unattributed orders</p><ul className="mt-1 space-y-1">{data.unattributedOrders.map((order) => <li key={order.brokerOrderId} className="text-xs">{unattributedOrderLabel(order)}</li>)}</ul></div>)}
                {data.missingAtHouse && data.missingAtHouse.length > 0 && <div><p className="font-semibold">Booked fills not found in the shared account</p><ul className="mt-1 space-y-1">{data.missingAtHouse.map((order) => <li key={order.orderId} className="text-xs">order #{order.orderId} · book #{order.bookId} · {order.symbol} · {order.brokerOrderId ?? "no broker id"}</li>)}</ul></div>}
              </CardContent>
            </Card>

            <Card className="account-sheet">
              <CardHeader className="pb-3">
                <p className="account-annotation">Append-only · audited</p>
                <CardTitle className="account-title">Post an adjustment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5"><Label className="text-xs" htmlFor="adj-book">Practice book #</Label><Input id="adj-book" inputMode="numeric" value={adjustment.bookId} onChange={(e) => setAdjustment({ ...adjustment, bookId: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label className="text-xs" htmlFor="adj-kind">Kind</Label>
                    <select id="adj-kind" className="h-9 w-full rounded-md border bg-transparent px-2 text-sm" value={adjustment.kind} onChange={(e) => setAdjustment({ ...adjustment, kind: e.target.value })}>
                      <option value="cash_adjustment">Cash adjustment</option><option value="corporate_action">Corporate action</option><option value="reconciliation_writeoff">Reconciliation write-off</option>
                    </select></div>
                  <div className="space-y-1.5"><Label className="text-xs" htmlFor="adj-cash">Cash ($, optional)</Label><Input id="adj-cash" inputMode="decimal" value={adjustment.cash} onChange={(e) => setAdjustment({ ...adjustment, cash: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label className="text-xs" htmlFor="adj-symbol">Symbol (optional)</Label><Input id="adj-symbol" value={adjustment.symbol} onChange={(e) => setAdjustment({ ...adjustment, symbol: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label className="text-xs" htmlFor="adj-qty">Quantity (± shares)</Label><Input id="adj-qty" inputMode="decimal" value={adjustment.qty} onChange={(e) => setAdjustment({ ...adjustment, qty: e.target.value })} /></div>
                </div>
                <div className="space-y-1.5"><Label className="text-xs" htmlFor="adj-note">Note (required)</Label><Input id="adj-note" value={adjustment.note} onChange={(e) => setAdjustment({ ...adjustment, note: e.target.value })} /></div>
                <Button size="sm" className="min-h-11" onClick={handleAdjustment} disabled={postAdjustment.isPending}>{postAdjustment.isPending ? "Posting…" : "Post adjustment"}</Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
