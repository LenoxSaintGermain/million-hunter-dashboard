/**
 * Public Multi-Asset Opportunities Fixture & Registry
 *
 * Single source of truth for deterministic public explorer demo rails.
 * Follows Prime Directive 2: Zero-API deterministic demo fixtures for prospect safety.
 * Spans all 4 core pillars of Signal Hunter OS:
 * 1. Private Operating Acquisitions & SMBs
 * 2. Commercial Real Estate & Tangible Assets
 * 3. Capital Aperture (Macro Theses & Liquid Strategies)
 * 4. Deep Research & Opportunity Radar (Sonar Pro cited signals)
 */

export type PublicAssetClass =
  | "private_mna"
  | "commercial_real_estate"
  | "capital_aperture"
  | "deep_research";

export interface PublicOpportunity {
  id: string | number;
  name: string;
  assetClass: PublicAssetClass;
  assetClassLabel: string;
  category: string;
  location: string;
  stage: "qualified" | "in_diligence" | "high_priority" | "new" | "active_scan";
  stageLabel: string;
  scoreBlurred: number;
  metric1Label: string;
  metric1Value: string;
  metric2Label: string;
  metric2Value: string;
  metric3Label: string;
  metric3Value: string;
  adversarialInsight: string;
  auditFlag: string;
}

export const PUBLIC_OPPORTUNITIES: PublicOpportunity[] = [
  // ─── Pillar I: Private Operating Acquisitions ──────────────────────────────
  {
    id: "PUB-PMA-001",
    name: "Apex Commercial Cleaning Co.",
    assetClass: "private_mna",
    assetClassLabel: "Private Buyout",
    category: "Commercial Services",
    location: "Charlotte, NC",
    stage: "in_diligence",
    stageLabel: "In Diligence",
    scoreBlurred: 0.7,
    metric1Label: "Revenue",
    metric1Value: "$1.85M",
    metric2Label: "Stated SDE",
    metric2Value: "$720K",
    metric3Label: "Asking Price",
    metric3Value: "$2.10M",
    adversarialInsight: "Top 2 clients represent 54% of revenue. Hospital contract rebid scheduled 14 months post-close.",
    auditFlag: "$223K questionable owner add-backs stripped in forensic review",
  },
  {
    id: "PUB-PMA-002",
    name: "Piedmont Precision Machining",
    assetClass: "private_mna",
    assetClassLabel: "Private Buyout",
    category: "Advanced Manufacturing",
    location: "Greenville, SC",
    stage: "qualified",
    stageLabel: "Qualified",
    scoreBlurred: 0.8,
    metric1Label: "Revenue",
    metric1Value: "$3.40M",
    metric2Label: "Normalized EBITDA",
    metric2Value: "$890K",
    metric3Label: "Asking Price",
    metric3Value: "$3.20M",
    adversarialInsight: "Single lead CNC programmer holds all AS9100 aerospace customer relationships without employment agreement.",
    auditFlag: "Clean customer diversification; 18-month key person transition required",
  },
  {
    id: "PUB-PMA-003",
    name: "Blue Ridge Medical Transport",
    assetClass: "private_mna",
    assetClassLabel: "Private Buyout",
    category: "Healthcare Logistics",
    location: "Roanoke, VA",
    stage: "new",
    stageLabel: "New Opportunity",
    scoreBlurred: 0.6,
    metric1Label: "Revenue",
    metric1Value: "$2.20M",
    metric2Label: "Cash Flow",
    metric2Value: "$510K",
    metric3Label: "Asking Price",
    metric3Value: "$1.75M",
    adversarialInsight: "Fleet equipment average age is 7.8 years. $210K deferred vehicle capex backlog uncovered.",
    auditFlag: "State Medicaid non-emergency transport rate revision pending in Q4",
  },

  // ─── Pillar II: Commercial Real Estate & Tangible Assets ──────────────────
  {
    id: "PUB-CRE-001",
    name: "1420 Peachtree Industrial Center",
    assetClass: "commercial_real_estate",
    assetClassLabel: "Commercial Real Estate",
    category: "Light Industrial / Flex",
    location: "Atlanta, GA",
    stage: "in_diligence",
    stageLabel: "In Diligence",
    scoreBlurred: 0.8,
    metric1Label: "Gross SF",
    metric1Value: "44,500 SF",
    metric2Label: "In-Place Cap",
    metric2Value: "7.4% NNN",
    metric3Label: "Offering Basis",
    metric3Value: "$4.80M",
    adversarialInsight: "Anchor logistics tenant (62% of GLA) lease rolls in 11 months with below-market renewal option.",
    auditFlag: "Phase I environmental clear; county parcel tax abatement confirmed",
  },
  {
    id: "PUB-CRE-002",
    name: "Allegheny Historic Medical Pavilion",
    assetClass: "commercial_real_estate",
    assetClassLabel: "Commercial Real Estate",
    category: "Historic Adaptive Reuse",
    location: "Pittsburgh, PA",
    stage: "high_priority",
    stageLabel: "High Priority",
    scoreBlurred: 0.9,
    metric1Label: "Gross SF",
    metric1Value: "62,000 SF",
    metric2Label: "HTC Tax Equity",
    metric2Value: "$1.85M",
    metric3Label: "Acquisition Basis",
    metric3Value: "$5.90M",
    adversarialInsight: "Zoning variance for medical outpatient use approved by municipal board; Part 2 HTC signoff pending.",
    auditFlag: "Qualified Opportunity Zone (QOZ) tract ID: 42003020100 with 100% lien clearance",
  },
  {
    id: "PUB-CRE-003",
    name: "Savannah Port Cold Logistics Facility",
    assetClass: "commercial_real_estate",
    assetClassLabel: "Commercial Real Estate",
    category: "Cold Storage & Distribution",
    location: "Savannah, GA",
    stage: "qualified",
    stageLabel: "Qualified",
    scoreBlurred: 0.7,
    metric1Label: "Pallet Positions",
    metric1Value: "3,800",
    metric2Label: "Occupancy",
    metric2Value: "96.5%",
    metric3Label: "Asking Price",
    metric3Value: "$8.25M",
    adversarialInsight: "Ammonia refrigeration compliance upgrade required within 18 months per EPA RMP update.",
    auditFlag: "DSCR 1.82x on conservative debt sizing at 6.75% interest",
  },

  // ─── Pillar III: Capital Aperture (Macro Theses & Liquid Horizons) ─────────
  {
    id: "PUB-CAP-001",
    name: "Power Grid Electrification & Modernization",
    assetClass: "capital_aperture",
    assetClassLabel: "Capital Aperture",
    category: "Infrastructure Macro Thesis",
    location: "North America / PJM Interconnect",
    stage: "high_priority",
    stageLabel: "Active Board",
    scoreBlurred: 0.9,
    metric1Label: "Horizon",
    metric1Value: "6 – 18 Months",
    metric2Label: "Strategy Envelope",
    metric2Value: "$100K – $500K",
    metric3Label: "Drawdown Cap",
    metric3Value: "-8.5% Fail-Closed",
    adversarialInsight: "Transformer lead times at historic 114 weeks; execution bounded by strict dry-powder buffer.",
    auditFlag: "Primary fact ledger verified: Federal FERC Order 1920 transmission mandate",
  },
  {
    id: "PUB-CAP-002",
    name: "Domestic Defense & Semiconductor Re-Shoring",
    assetClass: "capital_aperture",
    assetClassLabel: "Capital Aperture",
    category: "Critical Supply Chain Thesis",
    location: "National / Defense Industrial Base",
    stage: "in_diligence",
    stageLabel: "Active Board",
    scoreBlurred: 0.8,
    metric1Label: "Horizon",
    metric1Value: "12 – 24 Months",
    metric2Label: "Strategy Envelope",
    metric2Value: "$250K – $1.0M",
    metric3Label: "Drawdown Cap",
    metric3Value: "-10.0% Bound",
    adversarialInsight: "Tier-2 titanium alloy supplier bottleneck identified by RippleEffect scanner.",
    auditFlag: "Direct alignment with Title III Defense Production Act appropriations",
  },

  // ─── Pillar IV: Deep Research & Opportunity Radar ────────────────────────
  {
    id: "PUB-RES-001",
    name: "TIDE Federal Capital Inflow: Grid Resilience",
    assetClass: "deep_research",
    assetClassLabel: "Deep Research Radar",
    category: "Federal Capital Tracking",
    location: "Southeast Regional Reliability Council",
    stage: "high_priority",
    stageLabel: "Cited Radar",
    scoreBlurred: 0.8,
    metric1Label: "Federal Disbursed",
    metric1Value: "$1.42B Ingested",
    metric2Label: "Active Rulemakings",
    metric2Value: "14 Rule Changes",
    metric3Label: "Market Lead Time",
    metric3Value: "75 Days Lead",
    adversarialInsight: "Public funds concentrated across 8 municipal cooperatives; commercial listing exchanges lagging 60+ days.",
    auditFlag: "100% cited via USASpending API & Federal Register ingestion feeds",
  },
  {
    id: "PUB-RES-002",
    name: "Off-Market Distressed Commercial Paper Audit",
    assetClass: "deep_research",
    assetClassLabel: "Deep Research Radar",
    category: "Distressed Debt Research",
    location: "Mid-Atlantic Urban Corridors",
    stage: "active_scan",
    stageLabel: "Live Sonar Scan",
    scoreBlurred: 0.7,
    metric1Label: "Maturity Cliff",
    metric1Value: "Q3–Q4 2026",
    metric2Label: "Estimated Debt Gap",
    metric2Value: "$48M Aggregate",
    metric3Label: "Discount Range",
    metric3Value: "28–42% to UPB",
    adversarialInsight: "CMBS loan maturities facing 350 bps rate refi shock; special servicers initiating pre-foreclosure workouts.",
    auditFlag: "Sonar Pro verified county courthouse filings & UCC lien records",
  },
];
