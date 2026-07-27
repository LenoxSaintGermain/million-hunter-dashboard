/**
 * Asset-Class Registry — the single source of truth for every bespoke thesis.
 *
 * Adding a new asset class = add ONE config object here. From that config the app
 * derives: intake form fields, DB storage (class_metadata JSON — no migration),
 * the scoring model (dimensions/gates/factors), search filters, and all labels.
 * Every surface reads this registry, so a new class propagates automatically.
 *
 * The proven Historic A–G scorer (server/scoring/historicScore.ts) stays as the
 * `scorer: "historic"` implementation so we never regress it. New classes use the
 * declarative `scorer: "generic"` engine driven by their `scoring` config.
 */

export type FieldType = "text" | "number" | "currency" | "percent" | "year" | "boolean" | "select";

export interface FieldDef {
  key: string;                 // stored in commercial_assets.class_metadata[key] (or a native column for historic)
  label: string;
  type: FieldType;
  group?: string;              // intake form section
  options?: { value: string; label: string }[];
  help?: string;
  placeholder?: string;
  critical?: boolean;          // counts toward the confidence score (must be verified for Tier 1)
}

/** A scoring band: first matching band wins. Use for numeric fields. */
export interface Band { lte?: number; gte?: number; lt?: number; gt?: number; eq?: string | number | boolean; points: number }

export interface FactorDef {
  key: string;
  label: string;
  max: number;
  field: string;               // which field (native or class_metadata) this reads
  bands?: Band[];              // numeric/threshold scoring (first match wins)
  whenTrue?: number;           // boolean field → points when true
  map?: Record<string, number>;// select value → points
  missing?: number;            // conservative points when the field is absent (default 0)
  verifyWhenMissing?: boolean; // raise a VERIFY flag when absent
}

export interface DimensionDef {
  key: string;                 // "A".."G" or any label
  label: string;
  max: number;
  gate?: number;               // Tier-1 hard gate: this dimension must be >= gate
  factors: FactorDef[];
}

export interface ScoringModel {
  dimensions: DimensionDef[];
  tier1MinComposite: number;   // composite >= this AND all gates AND all critical verified → Tier 1
  tier2MinComposite: number;
  tier3MinComposite: number;   // below this → archive
  // Optional derived values computed from other fields (e.g. price per SF), made
  // available to factors by key. `get` reads any native/class_metadata field.
  derive?: (get: (k: string) => number | undefined) => Record<string, number | undefined>;
}

/** Analysis modules a class supports. The dossier renders exactly these, so a
 *  new thesis declares its diligence surface instead of forking a page. */
export type AnalysisModule =
  | "agScorecard"      // 7-dimension historic scorecard
  | "classScorecard"   // generic config-driven scorecard
  | "economics"        // §9 underwriting math
  | "provenance"       // source + freshness verification
  | "incentiveStack"   // HTC / OZ / NMTC / abatements
  | "envelope"         // FAR, coverage, tripling path
  | "environmental"    // Phase I ESA / prior-use risk
  | "titleEasements"   // ownership, easements, covenants
  | "ownerPsychology"  // BUSINESS-only: seller negotiation profile
  | "digitalAudit"     // BUSINESS-only: web/tech footprint
  | "sbaCapitalStack"  // BUSINESS-only: SBA 7(a) structuring
  | "icConsensus"      // 3-agent committee vote
  | "redTeam";         // adversarial risk pass

export interface AssetClass {
  id: string;                  // stored in commercial_assets.asset_class
  label: string;               // "Historic Adaptive Reuse"
  shortLabel: string;          // "Historic"
  icon: string;                // lucide-react icon name, e.g. "Landmark"
  accent: string;              // tailwind color token, e.g. "amber"
  description: string;
  scorer: "historic" | "generic";
  fields: FieldDef[];
  scoring?: ScoringModel;      // required for scorer:"generic"; historic uses its bespoke engine
  markets?: string[];          // optional priority markets (states/cities)
  /** Diligence modules this class supports — the dossier renders these only. */
  analysisModules: AnalysisModule[];
  /** True only for operating-business classes. Property classes must NEVER be
   *  copied into the business `deals` table: the business agents then judge a
   *  building on revenue/EBITDA and confidently recommend archiving it. */
  promotesToBusinessDeals: boolean;
}

// ─── Historic Adaptive Reuse (existing, bespoke A–G scorer) ───────────────────
const HISTORIC: AssetClass = {
  id: "historic",
  label: "Historic Adaptive Reuse",
  shortLabel: "Historic",
  icon: "Landmark",
  accent: "amber",
  description: "Pre-1945 commercial buildings, triplable GSF, NR-eligible, stackable incentives (HTC + OZ + abatements).",
  scorer: "historic",
  markets: ["OH", "IN", "KY", "TN", "GA", "SC", "NC", "AL", "MO", "IL", "KS"],
  analysisModules: ["agScorecard", "economics", "provenance", "incentiveStack", "envelope", "environmental", "titleEasements", "redTeam"],
  promotesToBusinessDeals: false,
  // These map to NATIVE commercial_assets columns (not class_metadata) for back-compat.
  fields: [
    { key: "yearBuilt", label: "Year Built", type: "year", group: "Building", critical: true, placeholder: "1908" },
    { key: "stories", label: "Stories", type: "number", group: "Building", placeholder: "3" },
    { key: "squareFootage", label: "Sq Ft", type: "number", group: "Building", critical: true, placeholder: "18000" },
    { key: "lotSqFt", label: "Lot Sq Ft", type: "number", group: "Building", placeholder: "30000" },
    { key: "occupancyRate", label: "Occupancy %", type: "percent", group: "Financials", placeholder: "0 (vacant)" },
    { key: "capRate", label: "Cap Rate %", type: "percent", group: "Financials", placeholder: "6.5" },
    { key: "askingPrice", label: "Asking Price", type: "currency", group: "Financials", placeholder: "630000" },
    { key: "isHistoric", label: "NR Listed", type: "boolean", group: "Historic", critical: true },
    { key: "historicRegisterEligible", label: "NR Eligible", type: "boolean", group: "Historic" },
    { key: "isStabilized", label: "Stabilized", type: "boolean", group: "Financials" },
    { key: "hasAirRights", label: "Air Rights", type: "boolean", group: "Building" },
    { key: "higherAndBetterUseNotes", label: "H&BU Notes", type: "text", group: "Historic" },
  ],
};

// ─── Example NEW class: Self-Storage (fully config-driven, proves the pattern) ─
// Adding this required ZERO schema/page edits — just this config. Its fields live
// in class_metadata; its score comes from the generic engine below.
const SELF_STORAGE: AssetClass = {
  id: "self_storage",
  label: "Self-Storage Facilities",
  shortLabel: "Storage",
  icon: "Boxes",
  accent: "sky",
  description: "Stabilized self-storage in growth submarkets — occupancy, rate-per-SF, expansion land, and low supply overhang.",
  scorer: "generic",
  markets: ["TX", "FL", "GA", "NC", "SC", "TN", "AZ", "NV"],
  analysisModules: ["classScorecard", "provenance", "redTeam"],
  promotesToBusinessDeals: false,
  fields: [
    { key: "netRentableSqFt", label: "Net Rentable Sq Ft", type: "number", group: "Facility", critical: true, placeholder: "55000" },
    { key: "units", label: "Unit Count", type: "number", group: "Facility", placeholder: "420" },
    { key: "occupancyRate", label: "Physical Occupancy %", type: "percent", group: "Operations", critical: true, placeholder: "92" },
    { key: "rentPerSqFt", label: "Rate / Sq Ft ($/yr)", type: "number", group: "Operations", placeholder: "14" },
    { key: "capRate", label: "Cap Rate %", type: "percent", group: "Financials", placeholder: "6.5" },
    { key: "askingPrice", label: "Asking Price", type: "currency", group: "Financials", critical: true, placeholder: "6500000" },
    { key: "climateControlled", label: "Climate-Controlled", type: "boolean", group: "Facility" },
    { key: "expansionLand", label: "Expansion Land Available", type: "boolean", group: "Facility" },
    { key: "thirdPartyMgmt", label: "Third-Party Managed", type: "boolean", group: "Operations" },
    { key: "supplyRatio", label: "Submarket SF per Capita", type: "number", group: "Market", help: "national avg ≈ 7", placeholder: "6.2" },
  ],
  scoring: {
    tier1MinComposite: 75,
    tier2MinComposite: 60,
    tier3MinComposite: 45,
    derive: (get) => {
      const ask = get("askingPrice"), sf = get("netRentableSqFt");
      return { pricePerSqFt: ask && sf ? ask / sf : undefined };
    },
    dimensions: [
      {
        key: "A", label: "Cash Flow & Occupancy", max: 30, gate: 15,
        factors: [
          { key: "occ", label: "Physical occupancy", max: 15, field: "occupancyRate", missing: 4, verifyWhenMissing: true,
            bands: [{ gte: 0.9, points: 15 }, { gte: 0.85, points: 11 }, { gte: 0.75, points: 6 }, { gt: 0, points: 2 }] },
          { key: "cap", label: "Cap rate", max: 10, field: "capRate", missing: 3, verifyWhenMissing: true,
            bands: [{ gte: 0.075, points: 10 }, { gte: 0.065, points: 8 }, { gte: 0.055, points: 5 }, { gt: 0, points: 2 }] },
          { key: "mgmt", label: "Third-party managed (assumable)", max: 5, field: "thirdPartyMgmt", whenTrue: 5 },
        ],
      },
      {
        key: "B", label: "Supply & Market", max: 25, gate: 10,
        factors: [
          { key: "supply", label: "Supply overhang (SF/capita)", max: 15, field: "supplyRatio", missing: 5, verifyWhenMissing: true,
            bands: [{ lte: 5, points: 15 }, { lte: 7, points: 10 }, { lte: 9, points: 5 }, { gt: 9, points: 0 }] },
          { key: "rate", label: "Rate / SF", max: 10, field: "rentPerSqFt", missing: 3,
            bands: [{ gte: 16, points: 10 }, { gte: 12, points: 7 }, { gte: 9, points: 4 }, { gt: 0, points: 2 }] },
        ],
      },
      {
        key: "C", label: "Upside & Asset Quality", max: 25,
        factors: [
          { key: "expand", label: "Expansion land", max: 10, field: "expansionLand", whenTrue: 10 },
          { key: "climate", label: "Climate-controlled", max: 8, field: "climateControlled", whenTrue: 8 },
          { key: "scale", label: "Net rentable scale", max: 7, field: "netRentableSqFt", missing: 2,
            bands: [{ gte: 60000, points: 7 }, { gte: 40000, points: 5 }, { gte: 25000, points: 3 }, { gt: 0, points: 1 }] },
        ],
      },
      {
        key: "D", label: "Basis", max: 20,
        factors: [
          { key: "ppsf", label: "Price per net rentable SF", max: 20, field: "pricePerSqFt", missing: 4, verifyWhenMissing: true,
            bands: [{ lte: 80, points: 20 }, { lte: 110, points: 14 }, { lte: 150, points: 8 }, { gt: 150, points: 2 }] },
        ],
      },
    ],
  },
};

// ─── Registry ─────────────────────────────────────────────────────────────────
export const ASSET_CLASSES: AssetClass[] = [HISTORIC, SELF_STORAGE];

export const DEFAULT_ASSET_CLASS = "historic";

export function getAssetClass(id?: string | null): AssetClass {
  return ASSET_CLASSES.find((c) => c.id === id) ?? HISTORIC;
}

export function listAssetClasses(): AssetClass[] {
  return ASSET_CLASSES;
}

/** Does this class support a given diligence module? Surfaces + agents gate on this. */
export function classSupportsModule(cls: AssetClass, m: AnalysisModule): boolean {
  return cls.analysisModules.includes(m);
}

/** Critical field keys for a class (drives the confidence score). */
export function criticalFields(cls: AssetClass): string[] {
  return cls.fields.filter((f) => f.critical).map((f) => f.key);
}
