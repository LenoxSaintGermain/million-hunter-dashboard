import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { isOptionInstrument, paperInstrumentDisplayLabel, parseOccOptionSymbol } from "@shared/paperInstrument";
import { deskOrderReturn, formatMarkProvenance, formatReturnAmount, formatReturnPercent, type PositionMark } from "@shared/positionReturn";
import { MONITORING_FRESHNESS_MS } from "@shared/monitoringState";

export interface InspectableOrder {
  id: number;
  runId: number;
  candidateId: number | null;
  symbol: string;
  underlyingSymbol?: string | null;
  instrumentType: "shares" | "long_call" | "long_put" | null;
  optionExpirationDate?: string | null;
  optionStrikePriceCents?: number | null;
  accountLabel: string;
  thesisName?: string | null;
  reason?: string | null;
  side?: string | null;
  intent?: string | null;
  status: string;
  qty: number | null;
  filledQty: number | null;
  notionalCents?: number | null;
  plannedRiskCents?: number | null;
  holdingPeriod?: string | null;
  brokerOrderId?: string | null;
  clientOrderId?: string | null;
  filledAvgPriceCents?: number | null;
  dispatchError?: string | null;
  timeStopAt?: number | null;
  createdAt?: number | null;
  updatedAt?: number | null;
  latestMark?: PositionMark | null;
  markSourceUnavailable?: boolean;
  monitoring?: Array<{
    id: number; checkType: string; finding: string | null;
    flagged?: boolean; citations?: string[] | null; checkedAt: number;
  }>;
}

const money = (cents?: number | null) => cents == null || !Number.isFinite(cents)
  ? null
  : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(cents / 100);

const at = (ms?: number | null) => ms == null || !Number.isFinite(ms) || !Number.isFinite(new Date(ms).getTime())
  ? null
  : new Date(ms).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

const safeUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? value : null;
  } catch { return null; }
};

/**
 * One labelled fact. `value` null means the record does not carry it, and the
 * stated absence is shown instead — never an empty cell, a dash, or a zero.
 */
function Fact({ label, value, absent, mono = false, tone }: {
  label: string; value: string | null; absent: string; mono?: boolean; tone?: string;
}) {
  return <div className="min-w-0 border-t py-2 first:border-t-0" style={{ borderColor: "var(--sh-border-1)" }}>
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--sh-fg-muted)" }}>{label}</p>
    <p
      className={`mt-0.5 break-words text-sm leading-5 ${mono ? "font-mono text-xs" : ""}`}
      style={{ color: value == null ? "var(--sh-fg-muted)" : tone ?? "var(--sh-text-primary)" }}
    >{value ?? absent}</p>
  </div>;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="min-w-0">
    <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>{title}</h3>
    <div className="mt-1">{children}</div>
  </section>;
}

/**
 * The drawer's contents, separated from the Sheet so it can be rendered and
 * asserted on directly — a Radix portal does not survive static rendering, and
 * a panel whose claims are only checked by reading the source is not checked.
 */
export function PlayInspectionBody({ order, stateLabel, humanReviewAt, reviewsUnavailable, now }: {
  order: InspectableOrder;
  stateLabel: string;
  humanReviewAt: number | null;
  /** True when the scheduled-review source could not be read at all. */
  reviewsUnavailable: boolean;
  now: number;
}) {
  const option = parseOccOptionSymbol(order.symbol);
  const isOption = isOptionInstrument(order.instrumentType);
  const result = deskOrderReturn(order, now);
  const quantities = {
    ordered: order.qty != null && Number.isFinite(order.qty) && order.qty >= 0 ? String(order.qty) : "Not measured",
    filled: order.filledQty != null && Number.isFinite(order.filledQty) && order.filledQty >= 0 ? String(order.filledQty) : "Not measured",
  };

  return <div data-inspection-body className="min-w-0 space-y-5">
    <p className="text-sm font-semibold" style={{ color: "var(--sh-signal)" }}>{stateLabel}</p>

    {order.dispatchError && <p role="alert" className="rounded-lg border p-3 text-sm leading-5" style={{ borderColor: "var(--sh-red)", color: "var(--sh-red)" }}>
      <strong>Dispatch unresolved.</strong> {order.dispatchError} This is a transport failure, not a broker rejection: the order may or may not exist at the broker. Reconcile before creating another ticket.
    </p>}

    <Group title="Position">
      <Fact label="Status" value={order.status.replaceAll("_", " ")} absent="Not recorded" />
      <Fact label="Quantity" value={`${quantities.ordered} ordered · ${quantities.filled} filled`} absent="Not recorded" />
      <Fact
        label={isOption ? "Premium at risk" : "Planned loss at modeled stop"}
        value={money(order.plannedRiskCents)}
        absent="No risk figure was recorded on this ticket."
      />
      {!isOption && <p className="text-[11px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>A share stop is a modeled scenario. Stop execution may differ from the modeled price and the loss can be greater.</p>}
      <Fact label="Notional" value={money(order.notionalCents)} absent="Not recorded" />
      <Fact
        label="Unrealized return"
        value={result.measured ? `${formatReturnAmount(result)}${formatReturnPercent(result) ? ` · ${formatReturnPercent(result)}` : ""} — ${formatMarkProvenance(result)}` : null}
        absent={result.measured ? "" : result.reason}
        tone={result.measured ? (result.pnlCents > 0 ? "var(--sh-emerald)" : result.pnlCents < 0 ? "var(--sh-red)" : undefined) : undefined}
      />
    </Group>

    <Group title="Broker receipts">
      <Fact label="Broker order ID" value={order.brokerOrderId ?? null} absent="Not assigned — no broker acknowledgement is recorded for this ticket." mono />
      <Fact label="Client order ID" value={order.clientOrderId ?? null} absent="Not recorded. This ticket predates persisted idempotency keys; reconcile by symbol and time." mono />
      <Fact label="Filled average price" value={money(order.filledAvgPriceCents)} absent="No fill price is recorded. A filled quantity without a price is not a confirmed execution." />
      <Fact label="Account" value={order.accountLabel} absent="Not recorded" />
      <Fact label="Recorded" value={at(order.createdAt)} absent="Not recorded" />
      <Fact label="Last change" value={at(order.updatedAt)} absent="Not recorded" />
    </Group>

    <Group title="Instrument">
      <Fact label="Contract" value={paperInstrumentDisplayLabel(order)} absent="Not recorded" />
      {isOption && <>
        <Fact label="Raw OCC symbol" value={order.symbol} absent="Not recorded" mono />
        <Fact label="Underlying" value={order.underlyingSymbol ?? option?.underlyingSymbol ?? null} absent="Not recorded on this ticket." />
        <Fact label="Expiration" value={order.optionExpirationDate ?? option?.expirationDate ?? null} absent="Not recorded" />
        <Fact label="Strike" value={money(order.optionStrikePriceCents ?? option?.strikePriceCents ?? null)} absent="Not recorded" />
      </>}
      <Fact label="Direction" value={order.side && order.intent ? `${order.side} · ${order.intent}s exposure` : order.side ?? null} absent="Not recorded" />
    </Group>

    <Group title="Thesis context">
      <Fact label="Thesis" value={order.thesisName ?? null} absent="No named thesis is linked to this run." />
      <Fact label="Recorded rationale" value={order.reason ?? null} absent="No rationale was recorded on this ticket. Open the full record before acting on it." />
      <Fact label="Horizon" value={order.holdingPeriod ? order.holdingPeriod.replaceAll("_", " ") : null} absent="No horizon declared" />
      <Fact label="Time stop" value={at(order.timeStopAt)} absent="No time stop recorded. This is a documented review point when present, never an automatic exit." />
      <Fact
        label="Human review"
        value={humanReviewAt != null ? at(humanReviewAt) : null}
        absent={reviewsUnavailable ? "Review status is unavailable; absence here does not mean no checkpoint exists." : "No checkpoint is recorded. This is a human checkpoint, not proof that an automatic check or exit occurred."}
      />
    </Group>

    <Group title={`Monitoring · ${order.monitoring?.length ?? 0}`}>
      {order.monitoring?.length
        ? <ul className="space-y-2">{order.monitoring.map((check) => {
          const stale = !Number.isFinite(check.checkedAt) || now - check.checkedAt > MONITORING_FRESHNESS_MS;
          const links = (check.citations ?? []).map(safeUrl);
          return <li key={check.id} className="border-t py-2" style={{ borderColor: "var(--sh-border-1)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: check.flagged ? "var(--sh-red)" : "var(--sh-fg-muted)" }}>
              {check.checkType.replaceAll("_", " ")}{check.flagged ? " · flagged" : ""}{stale ? " · stale" : ""}
            </p>
            <p className="mt-0.5 break-words text-sm leading-5">{check.finding ?? "Nothing material was recorded for this check."}</p>
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>
              Checked {at(check.checkedAt) ?? "at an unrecorded time"}.
              {links.length ? "" : " No source links recorded; this finding is unverified."}
            </p>
            {links.length > 0 && <p className="mt-1 flex flex-wrap gap-2">{links.map((href, index) => href
              ? <a key={index} href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center break-all text-sm underline underline-offset-4" style={{ color: "var(--sh-signal)" }}>Source {index + 1}</a>
              : <span key={index} className="inline-flex min-h-11 items-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>Source {index + 1} · link unavailable</span>)}</p>}
          </li>;
        })}</ul>
        : <p className="text-sm leading-5" style={{ color: "var(--sh-fg-muted)" }}>No sourced monitoring check is recorded against this ticket. That is an absence of evidence, not an all-clear.</p>}
    </Group>

    <p className="text-[11px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>
      Inspecting a play changes nothing: it acknowledges no finding, resolves no review, and moves no order.
    </p>
  </div>;
}

/** Read-only inspection of one ticket. Every action stays on the full record. */
export function PlayInspectionDrawer({ order, stateLabel, humanReviewAt, reviewsUnavailable, onClose, onOpenFull }: {
  order: InspectableOrder | null;
  stateLabel: string;
  humanReviewAt: number | null;
  reviewsUnavailable: boolean;
  onClose: () => void;
  onOpenFull: (order: InspectableOrder) => void;
}) {
  return <Sheet open={order != null} onOpenChange={(open) => { if (!open) onClose(); }}>
    <SheetContent
      side="right"
      data-play-inspection
      aria-describedby={undefined}
      className="w-full overflow-y-auto sm:max-w-lg [&>button]:min-h-11 [&>button]:min-w-11"
      style={{ background: "var(--sh-surface)" }}
    >
      {order && <>
        <SheetHeader className="gap-1">
          <SheetTitle className="break-words font-serif text-xl">{paperInstrumentDisplayLabel(order)}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6">
          <PlayInspectionBody
            order={order}
            stateLabel={stateLabel}
            humanReviewAt={humanReviewAt}
            reviewsUnavailable={reviewsUnavailable}
            now={Date.now()}
          />
          <Button className="mt-5 min-h-12 w-full" onClick={() => onOpenFull(order)}>
            Open full record<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4 shrink-0" />
          </Button>
        </div>
      </>}
    </SheetContent>
  </Sheet>;
}
