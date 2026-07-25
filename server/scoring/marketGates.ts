/**
 * Market Gate reference data — Historic Adaptive Reuse spec §3.
 *
 * ⚠ HONESTY NOTE: these metrics are SEEDED PLACEHOLDERS for the priority markets,
 * not live feeds. Every record carries `dataStatus: "seeded_placeholder"`. The UI
 * must label them as such (prime directive: nothing says "live" that isn't) and
 * they must be re-verified from real sources before any capital decision. State
 * HTC figures especially change — verify at scoring time (spec §13.5).
 *
 * Market Tier: A = passes all gates + preferred on 4+; B = passes all gates;
 * C = fails a gate / not a priority market (log, do not fully score).
 */

export type MarketTier = "A" | "B" | "C";

export interface MarketGate {
  city: string;
  state: string;
  tier: MarketTier;
  popGrowth5yr: number;         // %, 5-yr
  vacancy: number;              // multifamily submarket %
  rentGrowthCagr3yr: number;    // %, 3-yr CAGR
  forwardSupplyRatio: number;   // units under construction ÷ existing stock, %
  adaptiveReuseComps: number;   // documented comps within 3 mi
  stateHtcRate: number;         // %, 0 = no state credit
  stateHtcTransferable: boolean;
  stateHtcAsOfRight: boolean;   // true = as-of-right, false = competitive allocation
  hpcDenialRate: number;        // % denial on addition/new-construction COAs
  anchorInstitution: boolean;
  dataStatus: "seeded_placeholder";
}

// Per-state HTC posture (seeded; verify at scoring time). rate 0 = no state credit.
const STATE_HTC: Record<string, { rate: number; transferable: boolean; asOfRight: boolean }> = {
  OH: { rate: 25, transferable: true, asOfRight: false },  // competitive round
  IN: { rate: 25, transferable: true, asOfRight: false },
  KY: { rate: 30, transferable: true, asOfRight: false },  // has an aggregate cap
  TN: { rate: 0, transferable: false, asOfRight: false },  // NO state historic credit
  NC: { rate: 15, transferable: false, asOfRight: true },
  SC: { rate: 25, transferable: true, asOfRight: true },   // + Bailey Bill abatement
  GA: { rate: 25, transferable: true, asOfRight: false },
  AL: { rate: 25, transferable: true, asOfRight: false },  // competitive
  MO: { rate: 25, transferable: true, asOfRight: true },
  IL: { rate: 25, transferable: true, asOfRight: true },   // statewide 25%
  KS: { rate: 25, transferable: true, asOfRight: true },
};

// Priority markets (spec §3) + the app's Wingate-corridor cities.
const SEED: Array<Omit<MarketGate, "dataStatus" | "stateHtcRate" | "stateHtcTransferable" | "stateHtcAsOfRight">> = [
  { city: "Nashville",    state: "TN", tier: "A", popGrowth5yr: 9.5, vacancy: 5.6, rentGrowthCagr3yr: 5.0, forwardSupplyRatio: 6.5, adaptiveReuseComps: 3, hpcDenialRate: 18, anchorInstitution: true },
  { city: "Columbus",     state: "OH", tier: "A", popGrowth5yr: 4.8, vacancy: 5.2, rentGrowthCagr3yr: 4.2, forwardSupplyRatio: 3.1, adaptiveReuseComps: 3, hpcDenialRate: 15, anchorInstitution: true },
  { city: "Indianapolis", state: "IN", tier: "A", popGrowth5yr: 3.6, vacancy: 5.8, rentGrowthCagr3yr: 4.0, forwardSupplyRatio: 2.8, adaptiveReuseComps: 2, hpcDenialRate: 20, anchorInstitution: true },
  { city: "Charlotte",    state: "NC", tier: "A", popGrowth5yr: 8.9, vacancy: 6.4, rentGrowthCagr3yr: 4.5, forwardSupplyRatio: 7.2, adaptiveReuseComps: 2, hpcDenialRate: 22, anchorInstitution: true },
  { city: "Atlanta",      state: "GA", tier: "A", popGrowth5yr: 6.2, vacancy: 6.8, rentGrowthCagr3yr: 3.8, forwardSupplyRatio: 5.9, adaptiveReuseComps: 3, hpcDenialRate: 24, anchorInstitution: true },
  { city: "Louisville",   state: "KY", tier: "B", popGrowth5yr: 2.1, vacancy: 5.9, rentGrowthCagr3yr: 3.5, forwardSupplyRatio: 2.4, adaptiveReuseComps: 2, hpcDenialRate: 21, anchorInstitution: true },
  { city: "Greenville",   state: "SC", tier: "B", popGrowth5yr: 7.0, vacancy: 5.5, rentGrowthCagr3yr: 4.6, forwardSupplyRatio: 4.8, adaptiveReuseComps: 2, hpcDenialRate: 19, anchorInstitution: true },
  { city: "Savannah",     state: "GA", tier: "B", popGrowth5yr: 3.4, vacancy: 6.1, rentGrowthCagr3yr: 3.9, forwardSupplyRatio: 3.6, adaptiveReuseComps: 2, hpcDenialRate: 26, anchorInstitution: true },
  { city: "Chattanooga",  state: "TN", tier: "B", popGrowth5yr: 3.0, vacancy: 6.0, rentGrowthCagr3yr: 3.7, forwardSupplyRatio: 3.0, adaptiveReuseComps: 1, hpcDenialRate: 20, anchorInstitution: true },
  { city: "Kansas City",  state: "MO", tier: "B", popGrowth5yr: 2.6, vacancy: 6.3, rentGrowthCagr3yr: 3.4, forwardSupplyRatio: 3.3, adaptiveReuseComps: 3, hpcDenialRate: 17, anchorInstitution: true },
  { city: "Birmingham",   state: "AL", tier: "B", popGrowth5yr: 0.9, vacancy: 6.7, rentGrowthCagr3yr: 3.2, forwardSupplyRatio: 2.2, adaptiveReuseComps: 2, hpcDenialRate: 23, anchorInstitution: true },
  { city: "Memphis",      state: "TN", tier: "B", popGrowth5yr: 0.4, vacancy: 7.4, rentGrowthCagr3yr: 2.8, forwardSupplyRatio: 2.0, adaptiveReuseComps: 1, hpcDenialRate: 25, anchorInstitution: true },
];

const normalize = (s: string) => s.trim().toLowerCase();

const TABLE: MarketGate[] = SEED.map((m) => {
  const htc = STATE_HTC[m.state] ?? { rate: 0, transferable: false, asOfRight: false };
  return { ...m, stateHtcRate: htc.rate, stateHtcTransferable: htc.transferable, stateHtcAsOfRight: htc.asOfRight, dataStatus: "seeded_placeholder" as const };
});

/**
 * Look up a market gate by city + state. Unknown markets return a Tier C stub
 * (log, do not fully score — spec §3) so out-of-corridor assets are gated, never
 * silently scored as if in-market.
 */
export function getMarketGate(city?: string | null, state?: string | null): MarketGate {
  if (city && state) {
    const hit = TABLE.find((m) => normalize(m.city) === normalize(city) && normalize(m.state) === normalize(state));
    if (hit) return hit;
  }
  const htc = state ? STATE_HTC[state.toUpperCase()] : undefined;
  return {
    city: city ?? "Unknown", state: state ?? "??", tier: "C",
    popGrowth5yr: 0, vacancy: 8.5, rentGrowthCagr3yr: 0, forwardSupplyRatio: 0,
    adaptiveReuseComps: 0,
    stateHtcRate: htc?.rate ?? 0, stateHtcTransferable: htc?.transferable ?? false, stateHtcAsOfRight: htc?.asOfRight ?? false,
    hpcDenialRate: 100, anchorInstitution: false, dataStatus: "seeded_placeholder",
  };
}

export function allMarketGates(): MarketGate[] {
  return TABLE;
}
