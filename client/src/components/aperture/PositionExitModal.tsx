import React, { useState, useEffect } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, DollarSign, ShieldAlert, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { isOptionInstrument, paperInstrumentDisplayLabel, type PaperInstrumentType } from "@shared/paperInstrument";

export interface ExitTarget {
  symbol: string;
  instrumentType?: PaperInstrumentType | null;
  underlyingSymbol?: string | null;
  optionExpirationDate?: string | null;
  optionStrikePriceCents?: number | null;
  contractMultiplier?: number | null;
  qty: number;
  side?: string | null;
  accountId: number;
  accountLabel?: string;
  runId?: number;
  candidateId?: number | null;
  lastPriceCents?: number | null;
  marketValueCents?: number | null;
}

interface PositionExitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ExitTarget | null;
  onSuccess?: () => void;
}

const fmtMoney = (cents?: number | null) => {
  if (cents == null || !Number.isFinite(cents)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(cents / 100);
};

const QUICK_REASONS = [
  "Target reached · taking profit",
  "Modeled stop triggered · cutting loss",
  "Thesis premise invalidated",
  "Discretionary risk reduction",
];

export function PositionExitModal({ open, onOpenChange, target, onSuccess }: PositionExitModalProps) {
  const utils = typeof (trpc as any).useUtils === "function" ? (trpc as any).useUtils() : null;

  const heldQty = Math.abs(target?.qty ?? 1);
  const isShort = target?.side === "short" || (target?.qty != null && target.qty < 0);
  const exitSide: "buy" | "sell" = isShort ? "buy" : "sell";

  const [exitPortion, setExitPortion] = useState<"full" | "half" | "custom">("full");
  const [customQty, setCustomQty] = useState<string>("1");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState<string>("");
  const [reason, setReason] = useState<string>(QUICK_REASONS[0]);
  const [approveImmediately, setApproveImmediately] = useState<boolean>(false);
  const [approveConfirmation, setApproveConfirmation] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Reset modal state when target changes
  useEffect(() => {
    if (target) {
      setExitPortion("full");
      setCustomQty(String(Math.max(1, Math.floor(heldQty / 2))));
      setOrderType("market");
      if (target.lastPriceCents) {
        setLimitPrice((target.lastPriceCents / 100).toFixed(2));
      } else {
        setLimitPrice("");
      }
      setReason(QUICK_REASONS[0]);
      setApproveImmediately(false);
      setApproveConfirmation("");
    }
  }, [target, heldQty]);

  const resolvedQty = exitPortion === "full"
    ? heldQty
    : exitPortion === "half"
      ? Math.max(1, Math.floor(heldQty / 2))
      : Math.min(heldQty, Math.max(1, parseInt(customQty, 10) || 1));

  const createOrderMutation = typeof (trpc as any).aperture?.order?.create?.useMutation === "function"
    ? (trpc as any).aperture.order.create.useMutation()
    : { mutateAsync: async () => ({ orderId: 1 }) };
  const approveOrderMutation = typeof (trpc as any).aperture?.order?.approve?.useMutation === "function"
    ? (trpc as any).aperture.order.approve.useMutation()
    : { mutateAsync: async () => ({}) };

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
    }
  };

  const handleExitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;

    if (resolvedQty <= 0 || resolvedQty > heldQty) {
      toast.error(`Exit quantity must be between 1 and ${heldQty}.`);
      return;
    }

    if (!reason || reason.trim().length < 8) {
      toast.error("Please enter an exit reason (at least 8 characters).");
      return;
    }

    let limitPriceCents: number | undefined;
    if (orderType === "limit") {
      const parsed = parseFloat(limitPrice);
      if (isNaN(parsed) || parsed <= 0) {
        toast.error("Please enter a valid limit price.");
        return;
      }
      limitPriceCents = Math.round(parsed * 100);
    }

    if (approveImmediately && approveConfirmation.trim() !== "APPROVE PAPER") {
      toast.error('To approve immediately, type "APPROVE PAPER" exactly.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createOrderMutation.mutateAsync({
        accountId: target.accountId,
        runId: target.runId,
        candidateId: target.candidateId ?? undefined,
        symbol: target.symbol,
        instrumentType: target.instrumentType ?? "shares",
        underlyingSymbol: target.underlyingSymbol ?? undefined,
        optionExpirationDate: target.optionExpirationDate ?? undefined,
        optionStrikePriceCents: target.optionStrikePriceCents ?? undefined,
        contractMultiplier: target.contractMultiplier ?? undefined,
        side: exitSide,
        intent: "close",
        qty: resolvedQty,
        orderType,
        limitPriceCents,
        timeInForce: "day",
        reason: reason.trim(),
        invalidationCondition: "Position exit — closing or reducing held exposure.",
        catalystDeadlineAt: Date.now() + 86400000,
        holdingPeriod: "swing",
        paperAcknowledgement: "PAPER",
      });

      if (approveImmediately && result.orderId) {
        await approveOrderMutation.mutateAsync({
          orderId: result.orderId,
          paperConfirmation: "APPROVE PAPER",
        });
        toast.success(`Exit order #${result.orderId} created and approved! Submit it to the broker when ready.`);
      } else {
        toast.success(`Exit proposal created for ${target.symbol}! Ready for approval on the Play Desk.`);
      }

      if (utils?.aperture) {
        await Promise.all([
          utils.aperture.desk?.summary?.invalidate?.(),
          utils.aperture.play?.list?.invalidate?.(),
          utils.aperture.runway?.pending?.invalidate?.(),
          utils.aperture.account?.getPositions?.invalidate?.({ accountId: target.accountId }),
          utils.aperture.account?.listActivePlays?.invalidate?.({ accountId: target.accountId }),
          utils.aperture.account?.list?.invalidate?.(),
          utils.aperture.order?.list?.invalidate?.(),
        ]);
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to create exit proposal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!target) return null;

  const instrumentLabel = paperInstrumentDisplayLabel({
    symbol: target.symbol,
    instrumentType: target.instrumentType,
    underlyingSymbol: target.underlyingSymbol,
    optionExpirationDate: target.optionExpirationDate,
    optionStrikePriceCents: target.optionStrikePriceCents,
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg overflow-y-auto max-h-[90vh]" style={{ background: "var(--sh-surface)" }}>
        <DialogHeader>
          <DialogTitle className="font-serif text-xl flex items-center gap-2">
            Exit or Reduce Position
          </DialogTitle>
          <DialogDescription className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>
            Submit an intent-aware closing order to reduce or exit your held exposure. Closing orders bypass entry gates.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleExitSubmit} className="space-y-4 pt-2">
          {/* Position summary badge card */}
          <div className="rounded-lg border p-3.5 space-y-2" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-base" style={{ color: "var(--sh-text-primary)" }}>{instrumentLabel}</h3>
                <p className="text-xs font-mono" style={{ color: "var(--sh-fg-muted)" }}>{target.symbol}</p>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border" style={{ borderColor: "var(--sh-border-1)" }}>
                  {exitSide === "sell" ? "Sell to Close" : "Buy to Cover"}
                </span>
                <p className="text-xs mt-1" style={{ color: "var(--sh-fg-muted)" }}>
                  {target.accountLabel ?? `Account #${target.accountId}`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 border-t text-xs" style={{ borderColor: "var(--sh-border-1)" }}>
              <div>
                <span className="block text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>Held Quantity</span>
                <span className="font-medium">{heldQty} {isOptionInstrument(target.instrumentType) ? "contracts" : "shares"}</span>
              </div>
              <div>
                <span className="block text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>Last Mark</span>
                <span className="font-medium">{fmtMoney(target.lastPriceCents)}</span>
              </div>
              <div>
                <span className="block text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>Market Value</span>
                <span className="font-medium">{fmtMoney(target.marketValueCents)}</span>
              </div>
            </div>
          </div>

          {/* Exit Quantity selection */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Exit Quantity ({resolvedQty} of {heldQty} {isOptionInstrument(target.instrumentType) ? "contracts" : "shares"})</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={exitPortion === "full" ? "default" : "outline"}
                size="sm"
                className="min-h-10 text-xs"
                onClick={() => setExitPortion("full")}
              >
                100% (All {heldQty})
              </Button>
              {heldQty > 1 ? (
                <Button
                  type="button"
                  variant={exitPortion === "half" ? "default" : "outline"}
                  size="sm"
                  className="min-h-10 text-xs"
                  onClick={() => setExitPortion("half")}
                >
                  50% ({Math.floor(heldQty / 2)})
                </Button>
              ) : (
                <Button type="button" variant="outline" size="sm" className="min-h-10 text-xs opacity-50" disabled>
                  50%
                </Button>
              )}
              <Button
                type="button"
                variant={exitPortion === "custom" ? "default" : "outline"}
                size="sm"
                className="min-h-10 text-xs"
                onClick={() => setExitPortion("custom")}
              >
                Custom
              </Button>
            </div>

            {exitPortion === "custom" && (
              <div className="pt-1.5 flex items-center gap-2">
                <Input
                  id="exit-custom-qty"
                  aria-label="Custom exit quantity"
                  type="number"
                  min={1}
                  max={heldQty}
                  value={customQty}
                  onChange={(e) => setCustomQty(e.target.value)}
                  disabled={isSubmitting}
                  className="min-h-10 text-sm w-32"
                  placeholder="Qty"
                />
                <span className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>
                  of {heldQty} held
                </span>
              </div>
            )}
          </div>

          {/* Order Type & Limit Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Order Type</Label>
              <RadioGroup
                value={orderType}
                onValueChange={(v) => setOrderType(v as "market" | "limit")}
                disabled={isSubmitting}
                className="flex gap-4 pt-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="market" id="exit-market" />
                  <Label htmlFor="exit-market" className="text-xs cursor-pointer">Market</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="limit" id="exit-limit" />
                  <Label htmlFor="exit-limit" className="text-xs cursor-pointer">Limit</Label>
                </div>
              </RadioGroup>
            </div>

            {orderType === "limit" && (
              <div className="space-y-1.5">
                <Label htmlFor="exit-limit-price" className="text-xs font-semibold">Limit Price ($)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 opacity-50" />
                  <Input
                    id="exit-limit-price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    disabled={isSubmitting}
                    className="pl-8 min-h-10 text-sm font-mono"
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Exit Reason / Note */}
          <div className="space-y-2">
            <Label htmlFor="exit-reason" className="text-xs font-semibold">Exit Reason & Operator Note</Label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REASONS.map((qr) => (
                <button
                  key={qr}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setReason(qr)}
                  className="text-[11px] px-2 py-1 rounded border transition-colors text-left"
                  style={{
                    borderColor: reason === qr ? "var(--sh-signal)" : "var(--sh-border-1)",
                    background: reason === qr ? "color-mix(in srgb, var(--sh-signal) 12%, var(--sh-surface))" : "var(--sh-surface-2)",
                    color: "var(--sh-text-primary)",
                  }}
                >
                  {qr}
                </button>
              ))}
            </div>
            <Input
              id="exit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
              placeholder="Enter why this position is being closed or reduced..."
              className="min-h-10 text-xs"
              minLength={8}
              maxLength={2000}
            />
          </div>

          {/* Immediate Approval Option */}
          <div className="rounded-lg border p-3 space-y-2 text-xs" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
            <label className="flex items-center gap-2 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={approveImmediately}
                onChange={(e) => setApproveImmediately(e.target.checked)}
                disabled={isSubmitting}
                className="rounded border-gray-400"
              />
              <span>Approve proposal immediately after creation</span>
            </label>
            {approveImmediately && (
              <div className="pt-1.5 space-y-1.5">
                <p className="text-[11px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>
                  Aperture mandate requires operator confirmation to approve paper orders:
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    id="exit-approve-confirmation"
                    aria-label='Type "APPROVE PAPER" to confirm immediate order approval'
                    placeholder='Type "APPROVE PAPER"'
                    value={approveConfirmation}
                    onChange={(e) => setApproveConfirmation(e.target.value)}
                    disabled={isSubmitting}
                    className="min-h-10 text-xs font-mono uppercase"
                  />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">exact phrase</span>
                </div>
              </div>
            )}
          </div>

          {/* Submit Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--sh-border-1)" }}>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              className="min-h-11 px-5"
              disabled={isSubmitting || (approveImmediately && approveConfirmation.trim() !== "APPROVE PAPER")}
            >
              {isSubmitting ? (
                "Submitting Exit…"
              ) : approveImmediately ? (
                "Create & Approve Exit"
              ) : (
                "Create Exit Proposal"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
