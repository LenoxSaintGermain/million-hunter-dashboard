import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { apertureCandidates, apertureRuns, brokerOrders, portfolioAccounts, type BrokerOrder } from "../../drizzle/schema";
import type { NamedCapitalAccount, RealizedGainsCapitalSource } from "../../shared/capitalStrategy";
import { isAttentionDispatchUnresolved } from "../../shared/apertureAttention";
import { STALE_ACCOUNT_MS } from "../../shared/cockpitRailSummary";
import { isOptionInstrument, optionPremiumAtRiskCents, parseOccOptionSymbol } from "../../shared/paperInstrument";
import { getDb } from "../db";

const id = z.number().int().positive().safe();
/** Identities only. Authenticated userId is supplied separately by server context. */
const selectionSchema = z.object({ accountId: id, runId: id, candidateId: id, orderId: id }).strict();
export type RealizedGainSelection = z.infer<typeof selectionSchema>;
type Gap = { code: string; explanation: string; requiredEvidence: string[] };

/**
 * Schema gaps, not optional inputs that a client can declare "verified".
 * These must be closed by authoritative persisted ingestion before this reader
 * can produce a RealizedGainsCapitalSource. Do not put new proof into arbitrary
 * gateSnapshot/result JSON and assume it is a broker receipt.
 */
export const REALIZED_GAIN_SCHEMA_GAPS: readonly Gap[] = [
  { code: "closing_fill_ledger_missing", explanation: "Orders contain aggregate fill quantity and average price, not uniquely identified closing executions.", requiredEvidence: ["broker execution/activity ID", "broker/external account and currency", "closing order ID", "executed quantity, gross proceeds and source timestamp", "ingested timestamp and correction/bust lineage"] },
  { code: "attributed_cost_basis_missing", explanation: "No persisted closing-fill to opening-lot allocation proves the returned principal. A current position average or matching ticker is not closed-lot cost basis.", requiredEvidence: ["closing fill ID to opening lot/fill ID", "attributed quantity", "cost-basis method and amount", "opening fees and basis adjustments"] },
  { code: "fees_missing", explanation: "Order fill averages do not establish net proceeds. No persisted fee record proves either the amount or an explicit zero.", requiredEvidence: ["closing execution fee/commission amount and currency", "fee completeness receipt", "net proceeds with fees deducted exactly once"] },
  { code: "reconciliation_missing", explanation: "A filled order or cleared dispatch error is not reconciliation of proceeds, fees, and cost basis.", requiredEvidence: ["reconciliation ID/version", "covered execution and lot IDs", "reconciliation result", "source and completed/observed timestamps"] },
  { code: "availability_missing", explanation: "Synced cash and buying power are account totals, not proof these particular proceeds are settled and unencumbered. Never add the proceeds to an existing account balance.", requiredEvidence: ["settlement/availability receipt for the closing event", "available amount/currency/as-of", "account restrictions and existing holds", "cash versus margin treatment"] },
  { code: "reserve_policy_missing", explanation: "No source-event-bound profit-reserve selection or declared policy is persisted. Missing reserve is not zero and is not a tax calculation.", requiredEvidence: ["operator-selected or declared-policy reserve amount", "owner, source event, revision and recorded timestamp"] },
  { code: "allocation_ledger_missing", explanation: "No durable capital event and claim ledger proves the gains are not already earmarked. Read-only previews cannot prevent simultaneous allocations.", requiredEvidence: ["unique broker/account/closing event identity", "pending/committed/consumed/released allocation claims", "idempotent claim identity", "transactional claim revalidation in the existing proposal workflow"] },
];

type Observations = {
  account: NamedCapitalAccount;
  accountSnapshotAt: number | null;
  accountFreshness: "fresh" | "stale" | "unknown";
  /** Rounded aggregate fill arithmetic only; excludes unknown fees and basis. */
  modeledGrossSaleProceedsCents: number | null;
  orderState: "dispatch_unresolved" | "awaiting_closing_fill" | "partial_fill" | "closing_fill_recorded" | "not_confirmed_close";
  fillObservedAt: number | null;
  /** Current snapshots do not prove P&L provenance, including synthetic post-fill zeroes. */
  positionMark: null;
};

export type RealizedGainSourceResult = {
  status: "missing_evidence" | "hypothetical_only" | "unavailable" | "not_found" | "invalid_request";
  asOf: number;
  /** Null until all ledger proofs exist; never build the shared type using zero defaults. */
  source: RealizedGainsCapitalSource | null;
  lineage: (RealizedGainSelection & {
    userId: number;
    /** Not resolved by the exact order query; never echo unverified foreign keys. */
    capitalThesisId: null; portfolioContextAccountId: null;
    decisionRunId: null; decisionRevisionId: null;
    brokerOrderId: string | null; clientOrderId: string | null;
    /** An order ID is not a fill ID or deduplicated capital event. */
    closingFillIds: null; capitalEventId: null;
  }) | null;
  observations: Observations | null;
  recordedCostBasisCents: null;
  netSaleProceedsCents: null;
  realizedProfitLossCents: null;
  feesCents: null;
  reserveCents: null;
  alreadyAllocatedCents: null;
  verifiedDeployableCents: null;
  missingEvidence: Gap[];
  nextStep: string;
  mayIncreaseRiskBudget: false;
  sideEffects: { capitalReserved: false; proposalCreated: false; orderCreated: false; brokerInvoked: false };
};

const safeTime = (value: number | null | undefined, now: number): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= now;
const positiveCents = (value: number | null): value is number => value != null && Number.isSafeInteger(value) && value > 0;

function recordedOrderState(order: BrokerOrder): Observations["orderState"] {
  if (isAttentionDispatchUnresolved(order)) return "dispatch_unresolved";
  if (order.intent !== "close" || order.side !== "sell") return "not_confirmed_close";
  if (order.filledQty != null && order.filledQty > 0 && ((order.qty != null && order.filledQty < order.qty) || order.status !== "filled")) return "partial_fill";
  if (order.status !== "filled" || !order.brokerOrderId?.trim() || !(order.filledQty != null && Number.isFinite(order.filledQty) && order.filledQty > 0)) return "awaiting_closing_fill";
  return "closing_fill_recorded";
}

function grossObservation(order: BrokerOrder, now: number): number | null {
  if (order.intent !== "close" || order.side !== "sell" || isAttentionDispatchUnresolved(order)
    || !order.brokerOrderId?.trim() || !safeTime(order.filledAt, now)
    || !positiveCents(order.filledAvgPriceCents) || order.filledQty == null
    || !Number.isFinite(order.filledQty) || order.filledQty <= 0
    || (order.qty != null && (!Number.isFinite(order.qty) || order.qty <= 0))
    || (order.qty != null && order.filledQty > order.qty)) return null;
  let value: number | null;
  if (isOptionInstrument(order.instrumentType)) {
    const terms = parseOccOptionSymbol(order.symbol);
    // Do not inherit the sizing helper's default multiplier for missing records.
    if (!terms || terms.instrumentType !== order.instrumentType || order.contractMultiplier !== 100
      || terms.underlyingSymbol !== order.underlyingSymbol || terms.expirationDate !== order.optionExpirationDate
      || terms.strikePriceCents !== order.optionStrikePriceCents) return null;
    value = optionPremiumAtRiskCents({ instrumentType: order.instrumentType, qty: order.filledQty, entryPriceCents: order.filledAvgPriceCents, contractMultiplier: order.contractMultiplier, slippageCents: 0 });
  } else {
    if (order.instrumentType !== "shares" || parseOccOptionSymbol(order.symbol)) return null;
    value = Math.round(order.filledQty * order.filledAvgPriceCents);
  }
  return value != null && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function emptyResult(asOf: number): RealizedGainSourceResult {
  return {
    status: "missing_evidence", asOf, source: null, lineage: null, observations: null,
    recordedCostBasisCents: null, netSaleProceedsCents: null, realizedProfitLossCents: null,
    feesCents: null, reserveCents: null, alreadyAllocatedCents: null, verifiedDeployableCents: null,
    missingEvidence: REALIZED_GAIN_SCHEMA_GAPS.map(gap => ({ ...gap, requiredEvidence: [...gap.requiredEvidence] })),
    nextStep: "Verify closing executions, attributed basis, fees, reconciliation, availability and existing claims before selecting gains for redeployment. Research remains hypothetical; no capital is reserved.",
    mayIncreaseRiskBudget: false,
    sideEffects: { capitalReserved: false, proposalCreated: false, orderCreated: false, brokerInvoked: false },
  };
}

/**
 * Production read adapter for the CURRENT persistence model. No broker/API call,
 * sync, scoring refresh, or mutation. Reads only the exact owned lifecycle.
 *
 * A position snapshot's priceBasis does not prove its P&L provenance:
 * orderFlow also writes synthetic zero P&L at fill time, including closing fills.
 * Do not query/expose those snapshots as current marks, subtract inferred buys,
 * or use them as attributed closing basis. Without a closing
 * ledger, even a plausible $10k -> $11.8k example cannot earn `verified` here.
 * A future verified branch must supply authoritative proofs to the existing
 * deriveCapitalEnvelope; it must not introduce a second sizing/cash authority.
 */
export async function readRealizedGainSource(userId: number, selection: unknown): Promise<RealizedGainSourceResult> {
  const now = Date.now();
  const result = emptyResult(now);
  const parsed = selectionSchema.safeParse(selection);
  if (!id.safeParse(userId).success || !parsed.success) {
    return { ...result, status: "invalid_request", missingEvidence: [{ code: "invalid_selection", explanation: "Select the exact account, research run, candidate and order. Capital claims are not accepted by this reader.", requiredEvidence: ["authenticated user", "accountId", "runId", "candidateId", "orderId"] }], nextStep: "Open the source play and select its recorded order." };
  }
  const target = parsed.data;
  try {
    const db = await getDb();
    if (!db) throw new Error("storage unavailable");
    const [row] = await db.select({ account: portfolioAccounts, order: brokerOrders,
      run: { id: apertureRuns.id, userId: apertureRuns.userId, createdAt: apertureRuns.createdAt },
      candidate: { id: apertureCandidates.id, runId: apertureCandidates.runId },
    }).from(brokerOrders)
      .innerJoin(portfolioAccounts, eq(portfolioAccounts.id, brokerOrders.accountId))
      .innerJoin(apertureRuns, eq(apertureRuns.id, brokerOrders.runId))
      .innerJoin(apertureCandidates, and(eq(apertureCandidates.id, brokerOrders.candidateId), eq(apertureCandidates.runId, brokerOrders.runId)))
      .where(and(eq(brokerOrders.id, target.orderId), eq(brokerOrders.accountId, target.accountId), eq(brokerOrders.runId, target.runId), eq(brokerOrders.candidateId, target.candidateId),
        eq(brokerOrders.userId, userId), eq(portfolioAccounts.userId, userId), eq(apertureRuns.userId, userId))).limit(1);
    // Defense in depth for corrupted/imported associations; never return another owner's records.
    if (!row || row.order.userId !== userId || row.account.userId !== userId || row.run.userId !== userId
      || row.order.id !== target.orderId || row.order.accountId !== target.accountId || row.account.id !== target.accountId
      || row.order.runId !== target.runId || row.run.id !== target.runId || row.candidate.runId !== target.runId
      || row.order.candidateId !== target.candidateId || row.candidate.id !== target.candidateId) {
      return { ...result, status: "not_found", missingEvidence: [{ code: "source_not_found", explanation: "The exact source order is not available in this operator's account and play.", requiredEvidence: ["owned source order"] }], nextStep: "Return to the source play; do not substitute another account or ticker." };
    }
    const { account, order, run } = row;
    result.lineage = { ...target, userId, capitalThesisId: null, portfolioContextAccountId: null,
      decisionRunId: null, decisionRevisionId: null, brokerOrderId: order.brokerOrderId, clientOrderId: order.clientOrderId,
      closingFillIds: null, capitalEventId: null };
    result.missingEvidence.unshift({ code: "secondary_lineage_unverified",
      explanation: "Only the owned account, research run, candidate and order associations were checked. Thesis, portfolio-context account and Decision Run/revision links are omitted, not inferred from stored IDs.",
      requiredEvidence: ["owned Capital thesis linked to this research run", "owned portfolio-context account linked to this order/run", "owned Decision Run linked to this research run/account and the order's exact revision"] });
    // These are mutable current rows, not a historical ledger. Never backdate them.
    if (![order.createdAt, order.updatedAt, account.createdAt, account.updatedAt, run.createdAt].every(time => safeTime(time, now))) {
      result.missingEvidence.unshift({ code: "record_time_unverified", explanation: "The current record was not demonstrably available at this decision time; a historical snapshot is required.", requiredEvidence: ["valid record creation/update timestamps at or before the decision"] });
      return result;
    }
    const supported = account.isPaper && account.brokerId === "alpaca_paper" && Boolean(account.externalAccountId?.trim());
    const orderState = recordedOrderState(order);
    const synced = safeTime(account.lastSyncedAt, now) && account.syncSource === "alpaca_paper" && !account.syncError;
    result.observations = {
      account: { id: String(account.id), name: account.label, mode: account.isPaper ? "paper" : "live" },
      accountSnapshotAt: safeTime(account.lastSyncedAt, now) ? account.lastSyncedAt : null,
      accountFreshness: !synced ? "unknown" : now - account.lastSyncedAt! > STALE_ACCOUNT_MS ? "stale" : "fresh",
      modeledGrossSaleProceedsCents: supported ? grossObservation(order, now) : null,
      orderState, fillObservedAt: safeTime(order.filledAt, now) ? order.filledAt : null, positionMark: null,
    };
    if (supported && orderState === "closing_fill_recorded" && result.observations.modeledGrossSaleProceedsCents == null) {
      result.missingEvidence.unshift({ code: "fill_values_unverified", explanation: "The closing order status is recorded, but its quantity, price, observation time or instrument terms cannot support proceeds arithmetic.", requiredEvidence: ["valid filled quantity/price/time", "exact instrument terms and multiplier"] });
    }
    if (!supported || orderState !== "closing_fill_recorded") {
      result.status = "hypothetical_only";
      result.missingEvidence.unshift({ code: !supported ? "supported_paper_account_missing" : "closing_order_unconfirmed",
        explanation: !supported ? "This adapter cannot verify gains from manual/live/unsupported accounts or an unbound paper destination." : "This order does not yet establish a completed closing sale. A fill, a partial fill and unresolved dispatch are different states.",
        requiredEvidence: ["bound paper execution account", "explicit closing sale", "completed broker fill receipt"] });
    }
    return result;
  } catch {
    result.status = "unavailable";
    result.missingEvidence.unshift({ code: "storage_unavailable", explanation: "A required persisted source read failed. Any preserved observations are incomplete, not available capital.", requiredEvidence: ["successful source record read"] });
    result.nextStep = "Retry this same source read. Do not submit an allocation or infer zero gain from the failure.";
    return result;
  }
}
