import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildDeskGlance, type GlanceAccount, type GlanceOrder } from "@shared/deskGlance";
import { formatSignedCents } from "@shared/positionReturn";

const money = (cents: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0,
}).format(cents / 100);

const at = (ms: number) => new Date(ms).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

/**
 * Three cards read before any row: what is at stake, what it is worth now, what
 * is left to deploy. Each figure states what it counted; a partial total says
 * so beside the number rather than in a footnote, because a footnote is read
 * after the decision.
 */
function Card({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return <div className="min-w-0 rounded-xl border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>{eyebrow}</p>
    {children}
  </div>;
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[11px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>{children}</p>;
}

export function DeskGlanceLayer({ orders, account, accountUnavailable, attentionCount, onPrimary, primaryLabel, onFindBestPlay }: {
  orders: GlanceOrder[];
  account: GlanceAccount | null;
  accountUnavailable?: string | null;
  /** Critical items Today is already showing. Counted here, never restated. */
  attentionCount: number;
  onPrimary: () => void;
  primaryLabel: string | null;
  onFindBestPlay: () => void;
}) {
  const glance = buildDeskGlance(orders, account, Date.now());
  const pnl = glance.unrealized;
  const tone = pnl.pnlCents == null ? "var(--sh-text-primary)"
    : pnl.pnlCents > 0 ? "var(--sh-emerald)" : pnl.pnlCents < 0 ? "var(--sh-red)" : "var(--sh-text-primary)";

  return <section aria-label="Desk at a glance" data-desk-glance className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <Card eyebrow={attentionCount > 0 ? "Needs you" : "Nothing needs you"}>
      {attentionCount > 0
        ? <>
          <p className="mt-1 font-serif text-2xl leading-tight" style={{ color: "var(--sh-red)" }}>
            {attentionCount} {attentionCount === 1 ? "decision" : "decisions"}
          </p>
          {primaryLabel && <Button size="sm" className="mt-3 h-auto min-h-11 w-full whitespace-normal" onClick={onPrimary}>
            {primaryLabel}<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4 shrink-0" />
          </Button>}
          <Note>Counted from the same records shown above. Acting here does not resolve anything on its own.</Note>
        </>
        : <>
          <p className="mt-1 font-serif text-2xl leading-tight" style={{ color: "var(--sh-text-primary)" }}>Clear</p>
          <Note>No critical item is recorded right now. This is a record of what was checked, not an all-clear on the market.</Note>
        </>}
    </Card>

    <Card eyebrow="At stake · unrealized">
      <p className="mt-1 font-serif text-2xl leading-tight tabular-nums" style={{ color: "var(--sh-text-primary)" }}>
        {money(glance.atRisk.cents)}
      </p>
      <p className="text-[11px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>
        {glance.atRisk.label} · {glance.atRisk.counted} {glance.atRisk.counted === 1 ? "order" : "orders"}
        {glance.atRisk.uncounted > 0 ? ` · ${glance.atRisk.uncounted} with no recorded risk, not in this total` : ""}
      </p>
      <p data-glance-unrealized className="mt-2 text-lg font-semibold tabular-nums" style={{ color: tone }}>
        {pnl.measured && pnl.pnlCents != null ? formatSignedCents(pnl.pnlCents) : "Not measured"}
        <span className="ml-1.5 text-[11px] font-normal" style={{ color: "var(--sh-fg-muted)" }}>
          unrealized{pnl.measured ? ` · ${pnl.marked} of ${pnl.openPositions} open marked` : ""}
        </span>
      </p>
      {pnl.caveat && <Note>{pnl.caveat}</Note>}
      {pnl.measured && pnl.asOf != null && <Note>Oldest mark in this total: {at(pnl.asOf)}.</Note>}
    </Card>

    <Card eyebrow="Deployable">
      {glance.deployable.cents != null
        ? <>
          <p className="mt-1 font-serif text-2xl leading-tight tabular-nums" style={{ color: "var(--sh-text-primary)" }}>
            {money(glance.deployable.cents)}
          </p>
          <p className="text-[11px] leading-4" style={{ color: glance.deployable.stale ? "var(--sh-red)" : "var(--sh-fg-muted)" }}>
            {glance.deployable.stale ? "Stale · " : ""}{glance.deployable.asOf != null ? at(glance.deployable.asOf) : "no sync time"} · {glance.deployable.source}
          </p>
        </>
        : <>
          <p className="mt-1 font-serif text-2xl leading-tight" style={{ color: "var(--sh-fg-muted)" }}>Not measured</p>
          <Note>{accountUnavailable ?? glance.deployable.unavailableReason}</Note>
        </>}
      <Button variant="outline" size="sm" className="mt-3 h-auto min-h-11 w-full whitespace-normal" onClick={onFindBestPlay}>
        Find my best play<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4 shrink-0" />
      </Button>
      <Note>
        {glance.inMotion.openPositions} open · {glance.inMotion.awaitingFill} awaiting a fill. Reads completed research only; it starts nothing and creates no order.
      </Note>
    </Card>
  </section>;
}
