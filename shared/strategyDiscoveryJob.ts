import type { CapitalSearchScope } from "./capitalStrategy";
import type { UnderwritingHoldingPeriod } from "./playUnderwriting";

/** Saved by the server from an accepted Mission, never from classifier output. */
export type StrategyDiscoveryRequest = {
  schemaVersion: 1;
  requestId: string;
  missionHash: string;
  searchScope: CapitalSearchScope;
  universePolicy: "declared_symbols" | "cited_us_security_leads";
  permittedUniverse: string[];
  mission: string;
  holdingPeriods: UnderwritingHoldingPeriod[];
  instrumentPreference: "shares" | "options" | "either";
};

/** Resource bounds, not investment/risk policy. Each attempt uses bounded providers. */
export const DISCOVERY_MAX_ATTEMPTS = 3;
export const DISCOVERY_RECORD_SCHEMA_VERSION = 1;
