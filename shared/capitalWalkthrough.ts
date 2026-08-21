/**
 * Immutable, versioned record used by the admin-only Capital walkthrough.
 * This is deliberately JSON-shaped: the replay page imports it directly and
 * makes no provider, broker, database, clock, or tRPC call at render time.
 */
export interface CapitalWalkthroughFixture {
  version: string;
  capturedAt: number;
  source: {
    runId: number;
    candidateId: number;
    slateId: number | null;
    accountId: number;
    accountLabel: string;
    captureReason: string;
  };
  disclosure: string;
  account: {
    equityValueCents: number | null;
    cashCents: number | null;
    lastSyncedAt: number | null;
    syncSource: string | null;
    positionCount: number;
  };
  thesis: { name: string; holdingPeriod: string; catalystDeadlineAt: number | null };
  today: {
    cashOutcome: string;
    expiredPlayCount: number | null;
    expiredPlayBasis: string;
    queueOrderingBasis: string;
  };
  rail: {
    marketSession: string;
    marketSessionBasis: string;
    mandateVersion: string;
    tightestConstraint: string;
    tightestConstraintBasis: string;
    headroom: Record<string, unknown>;
  };
  queue: Array<{
    symbol: string;
    company: string | null;
    compositeScore: number | null;
    playSide: "long" | "short" | null;
    evidenceSummary: string;
    decision: string | null;
  }>;
  selectedPlay: Record<string, unknown>;
  trigger: Record<string, unknown>;
  recipe: Record<string, unknown>;
  evidence: {
    verifiedFields: string[];
    setAside: Array<{ symbol: string; reason: string }>;
    setAsideBasis: string;
  };
  proposal: {
    allowed: Record<string, unknown>;
    refused: Record<string, unknown>;
    refusalReason: string;
  };
  outcome: {
    captured: Record<string, unknown> | null;
    absentReason: string | null;
    sampleSufficiency: string;
  };
}

export const CAPITAL_WALKTHROUGH_DISCLOSURE = "Frozen replay of a captured Alpaca Paper research session. Values and tape state are shown exactly as captured; stale or unknown conditions are preserved and are not recalculated. Internal research tool — not investment advice. No order can be created here.";
