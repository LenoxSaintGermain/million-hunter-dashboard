import { useRef, useState } from "react";
import { Link } from "wouter";
import { HunterPublicShell } from "@/components/HunterPublicShell";
import { TodayAttentionBriefing } from "@/components/aperture/TodayAttentionBriefing";
import type { TodayExecutionData } from "@/components/aperture/TodayExecutionSnapshot";
import type { ApertureAttentionBriefing } from "@shared/apertureAttention";

// Frozen, synthetic fixtures. This route never reads an account or runs an agent.
const recordedAt = Date.UTC(2026, 8, 28, 16);
const symbols = ["DEMO-A", "DEMO-B", "DEMO-C"];
const execution: TodayExecutionData = {
  account: { id: 1, label: "Illustrative paper account", cashCents: 2500000, buyingPowerCents: 2500000, lastSyncedAt: recordedAt, syncSource: "Frozen UAT fixture" },
  orders: symbols.map((symbol, i) => ({ id: i + 1, accountId: 1, accountLabel: "Illustrative paper account", symbol, instrumentType: "equity", status: "filled", qty: 10, filledQty: 10, plannedRiskCents: 5000, orderType: "limit", limitPriceCents: 10000, side: "buy", timeInForce: "day", latestMark: { qty: 10, avgCostCents: 10000, lastPriceCents: [9600, 10300, 9800][i], priceAsOf: recordedAt, priceSource: "Frozen UAT fixture", marketValueCents: [96000, 103000, 98000][i] } })),
};
const attention: ApertureAttentionBriefing = {
  entryState: "check_in", readState: "stale", quiet: false, quietMessage: null,
  primary: { key: "sample-evidence", kind: "evidence_missing", priority: 1, critical: true, symbol: "DEMO-A", title: "The price moved. The thesis still needs evidence.", stateLabel: "Review required", reason: "The sample position is below its recorded cost. Price alone does not tell us whether the underlying demand thesis still holds.", consequence: "Refresh the evidence before preparing a new paper proposal. A saved price is not a current quote.", actionLabel: "Inspect the thesis gap", href: "#sample-review", updatedAt: recordedAt },
  otherCritical: [], otherAttention: [], changed: [],
  inMotion: execution.orders.map(order => ({ key: `order:${order.id}`, symbol: order.symbol, stateLabel: "Open position", detail: "Synthetic equity fixture · ten shares. No broker connection.", href: `#sample-${order.symbol}`, updatedAt: recordedAt })),
  nextCheckpoint: null, changeHeading: "Current status", baseline: { capturedAt: recordedAt, items: [] }, baselineToken: "illustrative-only",
  scopeNote: "All records on this page are synthetic. Nothing is saved, transmitted, acknowledged or approved.", monitoringNote: "Frozen sample · no live checks, agents or broker calls.",
  sourceIssues: [{ source: "monitoring", state: "stale", label: "Sample demand evidence", impact: "The saved fixture does not establish current monitoring eligibility.", lastSuccessAt: recordedAt, actionLabel: "Review sample evidence", href: "#sample-review", recovery: "review_checks" }],
};

export default function CapitalDeskPreview() {
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const panel = useRef<HTMLElement>(null);
  const open = (href: string) => {
    setSelected(href);
    requestAnimationFrame(() => { panel.current?.scrollIntoView({ behavior: "auto", block: "start" }); panel.current?.focus({ preventScroll: true }); });
  };
  const selectedSymbol = selected?.startsWith("#sample-DEMO") ? selected.slice(8) : "DEMO-A";
  return <HunterPublicShell><main className="hunter-public-main capital-story-desk">
    <div className="capital-preview-banner"><strong>UAT preview / illustrative composite records</strong><span>No login, live APIs or orders. Same briefing components as the signed-in workspace.</span><Link href="/aperture">Open your actual Capital workspace →</Link></div>
    <TodayAttentionBriefing previewOnly attention={attention} execution={execution} accountLabel="Illustrative paper account" modeLabel="Paper example" loading={false} failed={null} onOpen={open} onRetry={() => setNotice("This preview is frozen. No checks ran and no account was refreshed.")} onNewMission={() => open("#sample-mission")} />
    {notice && <p role="status" className="capital-preview-banner">{notice}</p>}
    <section className="capital-preview-investigation" ref={panel} tabIndex={-1} aria-label="Sample decision review">
      <header><p className="hunter-eyebrow">{selected ? `${selectedSymbol} / the focused read` : "The opportunity edition"}</p><h2>{selected === "/aperture/deploy" ? "Review comes before a paper order." : selected === "#sample-mission" ? "Start with the condition that must hold." : "What would make this idea hold?"}</h2><p>Illustrative thesis: demand must persist without exceeding the operator’s recorded loss boundary.</p></header>
      <div className="capital-thesis-receipt">
        <div><span>01 / Thesis</span><p>Demand persists</p><small>Requirement, not an established fact.</small></div>
        <div><span>02 / Reality</span><p>A saved price. No new demand evidence.</p><small>Frozen sample, not a market observation.</small></div>
        <div data-unresolved="true"><span>03 / To establish</span><p>Current demand + risk review</p><small>The gap remains open at every price.</small></div>
      </div>
      <div className="capital-preview-spread"><div><h3>The observation is not the explanation.</h3><p>A recorded decline can prompt a review. It cannot, by itself, prove why a price changed or that the thesis failed.</p><details><summary>Inspect the sample calculation</summary><p>DEMO-A: 10 shares × ($96 saved mark − $100 cost) = −$40 unrealized. The other samples are +$30 and −$20, totaling −$30. Fees and taxes are excluded. These are synthetic values, not real instruments.</p></details></div><aside><p className="hunter-eyebrow">The Senior / authored sample note</p><h3>What evidence would change your mind?</h3><p>Separate price movement from the demand claim. Establish the missing evidence, then re-check exposure. No new agent analysis ran.</p><button className="hunter-cta" onClick={() => setNotice("Sample decision: evidence review remains open. No approval, account change or order was recorded.")}>Preview the review receipt</button></aside></div>
    </section>
  </main></HunterPublicShell>;
}
