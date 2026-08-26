export type HorizonKey = "today" | "week" | "thirty_days" | "long_term";
export type ScenarioResult = "eligible" | "conditional" | "no_trade";
export type EvidenceState = "verified" | "conditional" | "blocked";

export type CapitalMission = {
  prompt: string;
  thesis: string;
  capital: number;
  target: number;
  maxLoss: number;
  horizon: HorizonKey;
};

export type ScenarioPlay = {
  symbol: string;
  title: string;
  playType: string;
  entry: string;
  stop: string;
  timeBoundary: string;
  plannedLoss: number;
  evidenceState: EvidenceState;
  evidenceLabel: string;
  notionalPerUnit: number;
  riskPerUnit: number;
  unitLabel: string;
};

export type PressureTestScenario = {
  id: string;
  group: "Intraday" | "Swing" | "Options" | "Portfolio" | "Disclosure" | "Novice";
  name: string;
  operatorSkill: string;
  thesisTitle: string | null;
  draftThesis?: string;
  mission: CapitalMission;
  promptStarters: [string, string, string];
  result: ScenarioResult;
  dataFreshness: string;
  contextWarning: string;
  universe: { researched: number; cleared: number; parked: number };
  plays: ScenarioPlay[];
  blockingGate: string;
  noTradeCondition: string;
  summary: string;
  requiredNow: string[];
  optionalDepth: string[];
  uiRisks: string[];
  acceptance: string;
};

// PROTOTYPE FIXTURES — illustrative/modelled, paper-only, and not investment advice.
// These cases pressure-test the UI and state model; they are not current market claims.
export const APERTURE_PRESSURE_TEST_SCENARIOS: PressureTestScenario[] = [
  {
    id: "intraday-ai-aspiration",
    group: "Intraday",
    name: "Impossible same-day aspiration",
    operatorSkill: "Intermediate momentum trader",
    thesisTitle: "AI Infrastructure Momentum",
    mission: {
      prompt: "Where can I deploy $5,000 against my AI-infrastructure thesis and try to finish with $8,000 before today’s close?",
      thesis: "Illustrative liquid equities associated with AI infrastructure may show opening momentum after a qualifying catalyst. Participation requires fresh evidence, adequate liquidity, and confirmation above VWAP.",
      capital: 5000,
      target: 8000,
      maxLoss: 150,
      horizon: "today",
    },
    promptStarters: [
      "Where can I best deploy $5,000 against my AI-infrastructure thesis today?",
      "How can I express this thesis today with a bounded loss?",
      "What must be true before this same-day setup qualifies?",
    ],
    result: "conditional",
    dataFreshness: "Market data · 6m ago",
    contextWarning: "NVDA uses 96% of its single-name allowance",
    universe: { researched: 57, cleared: 8, parked: 49 },
    plays: [
      { symbol: "CRDO", title: "Opening-range breakout", playType: "Long shares", entry: "30-minute range breaks and price holds above VWAP", stop: "Opening-range low or confirmed VWAP failure", timeBoundary: "No entry after 2:30 PM · flat by 3:55 PM", plannedLoss: 145, evidenceState: "conditional", evidenceLabel: "Setup complete; concentration review remains", notionalPerUnit: 232.14, riskPerUnit: 7.26, unitLabel: "shares" },
      { symbol: "ANET", title: "VWAP continuation", playType: "Long shares", entry: "VWAP reclaim followed by a higher low", stop: "Reclaim pivot fails", timeBoundary: "Flat by 3:55 PM", plannedLoss: 120, evidenceState: "conditional", evidenceLabel: "Volume confirmation missing", notionalPerUnit: 118.2, riskPerUnit: 4.8, unitLabel: "shares" },
    ],
    blockingGate: "Single-name concentration must be acknowledged before approval.",
    noTradeCondition: "Preserve cash if no trigger confirms, the target cannot be pursued inside the loss ceiling, or concentration blocks the exposure.",
    summary: "A risk-compliant play exists, but it does not credibly support the requested 60% same-day gain.",
    requiredNow: ["Target is an aspiration, not a forecast", "Maximum planned loss", "Concentration gate"],
    optionalDepth: ["Opening-range calculations", "VWAP observations", "Full candidate ranking"],
    uiRisks: ["Target can look like a forecast", "Two candidates can accidentally exceed the mission risk", "Concentration warning can overpower the decision"],
    acceptance: "The summary labels the 60% target as unsupported, shows only risk-compliant alternatives, and preserves cash as an explicit decision.",
  },
  {
    id: "intraday-stale-open",
    group: "Intraday",
    name: "Stale opening-range evidence",
    operatorSkill: "Advanced day trader",
    thesisTitle: null,
    draftThesis: "Opening momentum is eligible only when current spread, volume, VWAP, and entry-window evidence are all fresh enough to verify.",
    mission: { prompt: "What is the strongest opening-range momentum play for $10,000 this morning?", thesis: "", capital: 10000, target: 10400, maxLoss: 200, horizon: "today" },
    promptStarters: ["Where is the strongest opening-range play this morning?", "How can I deploy $10,000 without using stale evidence?", "What will invalidate the opening setup before entry?"],
    result: "no_trade",
    dataFreshness: "Market data · 18m stale",
    contextWarning: "Opening evidence is outside the 2-minute freshness gate",
    universe: { researched: 42, cleared: 0, parked: 42 },
    plays: [
      { symbol: "LIQ-A", title: "Five-minute breakout", playType: "Long shares", entry: "Break above the first five-minute high", stop: "Opening-range midpoint", timeBoundary: "Entry window expired at 10:00 AM", plannedLoss: 120, evidenceState: "blocked", evidenceLabel: "Market data is 18 minutes stale", notionalPerUnit: 85, riskPerUnit: 2.4, unitLabel: "shares" },
      { symbol: "LIQ-B", title: "VWAP pullback", playType: "Long shares", entry: "First higher low above VWAP", stop: "Close below VWAP", timeBoundary: "Setup expires at 10:30 AM", plannedLoss: 80, evidenceState: "blocked", evidenceLabel: "VWAP and spread unavailable", notionalPerUnit: 110, riskPerUnit: 2, unitLabel: "shares" },
    ],
    blockingGate: "Required intraday evidence is stale; no candidate is eligible.",
    noTradeCondition: "Never stage a play when freshness, spread, volume, or VWAP state cannot be verified.",
    summary: "No paper play—market evidence is stale and the entry window cannot be reconstructed safely.",
    requiredNow: ["No-trade outcome", "Data age", "Expired entry window"],
    optionalDepth: ["Stale calculations", "Provider timestamps", "Rejected ranking rationale"],
    uiRisks: ["A polished blocked card can look actionable", "Refresh can resurrect an expired setup", "Highest ranked can be confused with eligible"],
    acceptance: "Stale intraday evidence fails closed, removes approval controls, and makes data age part of the primary result.",
  },
  {
    id: "swing-ranked-catalyst",
    group: "Swing",
    name: "Ranked catalyst swing",
    operatorSkill: "Disciplined swing trader",
    thesisTitle: "AI Infrastructure Demand Cycle",
    mission: { prompt: "Which qualifying AI-infrastructure play gives me the best risk-defined setup for this week?", thesis: "Illustrative suppliers may benefit from a modelled demand catalyst during the next two weeks. Participation requires confirmed price strength, sufficient liquidity, and no thesis-invalidating guidance.", capital: 10000, target: 10800, maxLoss: 250, horizon: "week" },
    promptStarters: ["Where is the cleanest catalyst swing this week?", "How can I rank these suppliers without duplicating factor exposure?", "What must hold for five trading days?"],
    result: "eligible",
    dataFreshness: "Evidence pack · current",
    contextWarning: "Overnight gaps can exceed a modeled stop",
    universe: { researched: 134, cleared: 9, parked: 125 },
    plays: [
      { symbol: "INFRA-A", title: "Breakout and retest", playType: "Equity swing", entry: "Close above resistance, then hold the retest zone", stop: "Close below retest zone or catalyst contradiction", timeBoundary: "Five trading days", plannedLoss: 120, evidenceState: "verified", evidenceLabel: "Catalyst, liquidity, confirmation and invalidation complete", notionalPerUnit: 96, riskPerUnit: 3.2, unitLabel: "shares" },
      { symbol: "INFRA-B", title: "Pullback continuation", playType: "Equity swing", entry: "Controlled pullback holds modeled support", stop: "Support failure", timeBoundary: "Seven trading days", plannedLoss: 100, evidenceState: "conditional", evidenceLabel: "Liquidity confirmation stale", notionalPerUnit: 74, riskPerUnit: 2.8, unitLabel: "shares" },
    ],
    blockingGate: "No blocking gate; human approval remains required.",
    noTradeCondition: "Preserve cash if confirmation fails or required catalyst and liquidity evidence becomes incomplete.",
    summary: "INFRA-A is the only approval-eligible play; alternatives remain visible but explicitly non-actionable.",
    requiredNow: ["One eligible leader", "Five-day boundary", "Overnight gap warning"],
    optionalDepth: ["Source records", "Comparison matrix", "Modeled levels"],
    uiRisks: ["Candidates can appear equally actionable", "Aspiration can look forecasted", "Stop can imply false overnight precision"],
    acceptance: "Exactly one play is approval-eligible and the desired ending value remains labelled as an aspiration.",
  },
  {
    id: "swing-event-wait",
    group: "Swing",
    name: "Post-event wait state",
    operatorSkill: "Advanced event trader",
    thesisTitle: "Post-Event Repricing",
    mission: { prompt: "If the event confirms my thesis, what is the cleanest swing setup without taking uncontrolled overnight risk?", thesis: "A liquid company may reprice after a scheduled event, but direction is not assumed. A swing becomes valid only after the event when price behavior and evidence agree.", capital: 15000, target: 16000, maxLoss: 300, horizon: "week" },
    promptStarters: ["Where is the cleanest post-event setup?", "How can I avoid uncontrolled overnight gap risk?", "What will confirm the thesis after the event?"],
    result: "conditional",
    dataFreshness: "Event evidence · pending",
    contextWarning: "The catalyst has not occurred",
    universe: { researched: 23, cleared: 0, parked: 22 },
    plays: [
      { symbol: "EVENT-A", title: "Post-event confirmation", playType: "Equity swing", entry: "First post-event close confirms, then next session holds", stop: "Post-event base fails", timeBoundary: "Six trading days after confirmation", plannedLoss: 150, evidenceState: "conditional", evidenceLabel: "Event has not occurred", notionalPerUnit: 65, riskPerUnit: 3, unitLabel: "shares" },
      { symbol: "EVENT-B", title: "Pre-event speculation", playType: "Equity swing", entry: "Before the announcement", stop: "Price stop below support", timeBoundary: "Across the event", plannedLoss: 150, evidenceState: "blocked", evidenceLabel: "Gap risk defeats the loss ceiling", notionalPerUnit: 41, riskPerUnit: 2.5, unitLabel: "shares" },
    ],
    blockingGate: "The post-event confirmation does not exist yet.",
    noTradeCondition: "Do not enter before the event; remain in cash if the post-event close fails or gap geometry exceeds the loss ceiling.",
    summary: "Wait—nothing is approvable yet. Queue a post-event review instead of presenting a ready plan.",
    requiredNow: ["Wait state", "Exact post-event trigger", "Next review point"],
    optionalDepth: ["Event transcript", "Gap scenarios", "Support derivation"],
    uiRisks: ["A modeled plan can look executable", "Planned loss can imply false gap precision", "Return timing can be unclear"],
    acceptance: "Before the event, the primary action schedules a review and no approval control is enabled.",
  },
  {
    id: "options-entitlement-blocked",
    group: "Options",
    name: "Entitlement-blocked options study",
    operatorSkill: "Expert volatility trader",
    thesisTitle: "Policy Disclosure Follow-Through",
    mission: { prompt: "What defined-risk options expression could test this disclosure thesis over the next thirty days without risking more than $500?", thesis: "A delayed hypothetical disclosure may support a thirty-day directional research thesis. It is contextual evidence—not sufficient evidence for timing, contract selection, or execution.", capital: 25000, target: 30000, maxLoss: 500, horizon: "thirty_days" },
    promptStarters: ["Where is a defined-risk expression for this thesis?", "How can I cap premium risk at $500?", "What contract evidence must exist before approval?"],
    result: "no_trade",
    dataFreshness: "Options chain · unavailable",
    contextWarning: "Options entitlement and contract evidence are missing",
    universe: { researched: 18, cleared: 0, parked: 18 },
    plays: [
      { symbol: "XYZ-LIQUID", title: "Long call", playType: "Single-leg option", entry: "Only after disclosure, catalyst, and chain validation", stop: "Premium reaches modeled loss limit", timeBoundary: "Before final expiration-risk window", plannedLoss: 400, evidenceState: "blocked", evidenceLabel: "Expiry, IV, Greeks, quote and entitlement unavailable", notionalPerUnit: 400, riskPerUnit: 400, unitLabel: "contracts" },
      { symbol: "XYZ-SPREAD", title: "Bull call debit spread", playType: "Multi-leg option", entry: "Both legs price reliably inside the width limit", stop: "Thesis invalidates or spread quality fails", timeBoundary: "Thirty days maximum", plannedLoss: 475, evidenceState: "blocked", evidenceLabel: "Multi-leg support and chain unavailable", notionalPerUnit: 475, riskPerUnit: 475, unitLabel: "spreads" },
    ],
    blockingGate: "Options entitlement and every contract-level fact are unavailable.",
    noTradeCondition: "Return no trade if entitlement, expiry, liquidity, quote freshness, or every spread leg cannot be verified.",
    summary: "Both modeled expressions are blocked. Equity research may continue separately; no automatic substitution is allowed.",
    requiredNow: ["No-trade result", "Exact entitlement blocker", "No automatic equity substitution"],
    optionalDepth: ["Disclosure lag", "Entity confidence", "IV and Greeks"],
    uiRisks: ["Modeled contracts can look quoted", "Shares can be substituted without consent", "Deep research can hide the decisive blocker"],
    acceptance: "Missing options entitlement leaves every candidate blocked and renders no approval control.",
  },
  {
    id: "portfolio-defensive-gap",
    group: "Portfolio",
    name: "Missing defensive sleeve",
    operatorSkill: "Portfolio allocator",
    thesisTitle: "Durable Cash-Flow Balance",
    mission: { prompt: "What is the cleanest way to fill our defensive portfolio gap without duplicating exposures we already own?", thesis: "Add a liquid, lower-volatility portfolio sleeve intended to reduce dependence on growth assets while preserving long-horizon participation.", capital: 500000, target: 550000, maxLoss: 20000, horizon: "long_term" },
    promptStarters: ["Where can this portfolio add a defensive sleeve?", "How can we reduce growth concentration?", "What will prove this allocation actually diversifies?"],
    result: "eligible",
    dataFreshness: "Portfolio facts · current",
    contextWarning: "Aggregate planned loss must stay below $20,000",
    universe: { researched: 81, cleared: 4, parked: 77 },
    plays: [
      { symbol: "USMV", title: "Staged minimum-volatility sleeve", playType: "ETF allocation", entry: "Three equal paper tranches after look-through review", stop: "Sleeve fails to reduce portfolio volatility or duplicates holdings", timeBoundary: "Six-month assessment", plannedLoss: 15000, evidenceState: "verified", evidenceLabel: "Portfolio-fit evidence complete", notionalPerUnit: 85, riskPerUnit: 5, unitLabel: "shares" },
      { symbol: "TLT", title: "Duration hedge", playType: "Bond ETF allocation", entry: "Smaller staged hedge", stop: "Duration sensitivity conflicts with mandate", timeBoundary: "Quarterly review", plannedLoss: 10000, evidenceState: "conditional", evidenceLabel: "Duration-risk acknowledgement missing", notionalPerUnit: 92, riskPerUnit: 4, unitLabel: "shares" },
    ],
    blockingGate: "No blocking gate for the lead sleeve; combined approval must be evaluated separately.",
    noTradeCondition: "Preserve cash if no candidate improves the portfolio gap after fees, overlap, correlation, and liquidity checks.",
    summary: "USMV leads as a modeled portfolio role, not because the product is inherently defensive.",
    requiredNow: ["Gap being filled", "Before/after overlap", "Aggregate risk budget"],
    optionalDepth: ["Scenario analysis", "Correlation calculations", "Look-through holdings"],
    uiRisks: ["Defensive can look inherent", "Long-horizon review can look like an exit", "Combined allocations can exceed the budget"],
    acceptance: "Multiple allocations show aggregate planned loss and cannot be combined above the portfolio ceiling.",
  },
  {
    id: "portfolio-concentration-collision",
    group: "Portfolio",
    name: "Concentration collision",
    operatorSkill: "Family-office allocator",
    thesisTitle: "AI Infrastructure Compounding",
    mission: { prompt: "Where can I deploy $250,000 against our AI-infrastructure thesis without increasing semiconductor concentration?", thesis: "Over a multi-year horizon, infrastructure providers may benefit from continued AI capital spending. New exposure must add differentiated drivers rather than duplicate existing technology concentration.", capital: 250000, target: 300000, maxLoss: 12500, horizon: "long_term" },
    promptStarters: ["Where can we deploy without duplicating semiconductors?", "How can we express the thesis with lower overlap?", "What will breach the cluster ceiling?"],
    result: "conditional",
    dataFreshness: "Portfolio sync · 7m ago",
    contextWarning: "Existing semiconductor cluster is at 91% of its ceiling",
    universe: { researched: 96, cleared: 0, parked: 94 },
    plays: [
      { symbol: "NVDA", title: "Staged long equity", playType: "Equity allocation", entry: "After thesis and portfolio-overlap review", stop: "Cluster ceiling or thesis evidence fails", timeBoundary: "Quarterly checkpoints", plannedLoss: 12500, evidenceState: "conditional", evidenceLabel: "Direct overlap confirmed", notionalPerUnit: 180, riskPerUnit: 9, unitLabel: "shares" },
      { symbol: "XLK", title: "Sector proxy", playType: "ETF allocation", entry: "Only after look-through concentration review", stop: "No meaningful diversification", timeBoundary: "Twelve-month review", plannedLoss: 8000, evidenceState: "blocked", evidenceLabel: "Look-through overlap unresolved", notionalPerUnit: 210, riskPerUnit: 7, unitLabel: "shares" },
    ],
    blockingGate: "Every candidate collides with the existing semiconductor cluster.",
    noTradeCondition: "No candidate proceeds if direct or look-through exposure breaches the correlated-cluster ceiling.",
    summary: "Preserve cash until a differentiated expression clears the overlap gate.",
    requiredNow: ["Current and post-play concentration", "Binding mandate", "Cash control"],
    optionalDepth: ["Look-through holdings", "Collision graph", "Sizing simulations"],
    uiRisks: ["ETF can look diversified", "Loss can hide the true binding constraint", "Large numbers can dominate the blocker"],
    acceptance: "Concentration conflict appears before modeled return and prevents approval until overlap review completes.",
  },
  {
    id: "disclosure-catalyst-bridge",
    group: "Disclosure",
    name: "Disclosure-to-catalyst bridge",
    operatorSkill: "Disclosure researcher",
    thesisTitle: "Regulated Infrastructure Spending",
    mission: { prompt: "Does this newly published disclosure strengthen my infrastructure thesis enough to justify a paper play this week?", thesis: "A hypothetical public disclosure may support research into regulated infrastructure spending. It is evidence of past activity—not a signal to copy the actor.", capital: 10000, target: 10800, maxLoss: 200, horizon: "week" },
    promptStarters: ["Where does this disclosure add real thesis evidence?", "How can I separate filing evidence from timing?", "What catalyst is still missing?"],
    result: "conditional",
    dataFreshness: "Primary filing · verified",
    contextWarning: "Transaction-to-disclosure lag · 34 days",
    universe: { researched: 64, cleared: 0, parked: 62 },
    plays: [
      { symbol: "TICKER-A", title: "Independent confirmation", playType: "Long shares", entry: "Independent confirmation level holds", stop: "Support fails or entity is corrected", timeBoundary: "Five sessions", plannedLoss: 125, evidenceState: "conditional", evidenceLabel: "High entity confidence; catalyst missing", notionalPerUnit: 62, riskPerUnit: 2.5, unitLabel: "shares" },
      { symbol: "ETF-INFRA", title: "Diversified proxy", playType: "ETF research expression", entry: "Only if single-name confidence blocks", stop: "Basket fails confirmation", timeBoundary: "Five sessions", plannedLoss: 75, evidenceState: "blocked", evidenceLabel: "Exposure modelled; not directly disclosed", notionalPerUnit: 48, riskPerUnit: 1.5, unitLabel: "shares" },
    ],
    blockingGate: "An independent catalyst has not confirmed the historical disclosure evidence.",
    noTradeCondition: "No play if the source cannot open, entity confidence falls, the filing predates the move, or another event explains the signal.",
    summary: "Primary evidence is verified, but the research thesis is not yet a timing signal.",
    requiredNow: ["Transaction and filing dates", "Measured lag", "Missing catalyst"],
    optionalDepth: ["Source document", "Entity-resolution reasoning", "Collision chronology"],
    uiRisks: ["Primary source can look trade-ready", "Lag can hide below the fold", "Proxy can look directly disclosed"],
    acceptance: "A verified filing without an independent catalyst remains conditional and disables approval.",
  },
  {
    id: "disclosure-independent-cluster",
    group: "Disclosure",
    name: "Independent disclosure cluster",
    operatorSkill: "Expert event researcher",
    thesisTitle: "Domestic Compute-Capacity Expansion",
    mission: { prompt: "Do these independent disclosures strengthen my long-term thesis, and what is the cleanest paper expression within my risk limit?", thesis: "Multiple hypothetical disclosures may support a compute-capacity thesis when actors are independent, entity resolution is reliable, and company fundamentals independently support the exposure. The thesis does not assume superior filer timing.", capital: 25000, target: 30000, maxLoss: 500, horizon: "long_term" },
    promptStarters: ["Where does the disclosure cluster strengthen the thesis?", "How can I verify actor independence?", "What expression stays inside the $500 loss ceiling?"],
    result: "eligible",
    dataFreshness: "3 filings · provenance complete",
    contextWarning: "3 records resolve to 2 independent actors",
    universe: { researched: 112, cleared: 3, parked: 109 },
    plays: [
      { symbol: "TICKER-C", title: "Staged long-equity study", playType: "Long shares", entry: "Two tranches after fundamental and price confirmation", stop: "Named thesis metric deteriorates", timeBoundary: "90-day re-underwrite", plannedLoss: 250, evidenceState: "verified", evidenceLabel: "Two records; collision check passed", notionalPerUnit: 125, riskPerUnit: 5, unitLabel: "shares" },
      { symbol: "TICKER-D", title: "Complementary supplier", playType: "Long shares", entry: "Only if it reduces concentration", stop: "Supplier relationship fails", timeBoundary: "90-day review", plannedLoss: 150, evidenceState: "conditional", evidenceLabel: "Exposure evidence conditional", notionalPerUnit: 75, riskPerUnit: 3, unitLabel: "shares" },
      { symbol: "ETF-COMPUTE", title: "Diversified proxy", playType: "ETF expression", entry: "Fallback after concentration review", stop: "Basket no longer matches thesis", timeBoundary: "90-day review", plannedLoss: 100, evidenceState: "verified", evidenceLabel: "Modelled proxy; not directly disclosed", notionalPerUnit: 50, riskPerUnit: 2, unitLabel: "shares" },
    ],
    blockingGate: "No blocking gate; the $500 aggregate ceiling remains binding.",
    noTradeCondition: "No deployment if actors collide, the cluster collapses to one event, or independent company evidence fails.",
    summary: "Evidence supports research, not copy trading; actor count and aggregate risk remain visible before approval.",
    requiredNow: ["3 records versus 2 actors", "Collision checks", "$500 aggregate planned loss"],
    optionalDepth: ["Actor graph", "Filing chronology", "Exposure-chain documents"],
    uiRisks: ["Record count can hide actor count", "Single name can overpower proxy", "Aggregate risk can be hard to compare"],
    acceptance: "The summary shows both counts, passed collision checks, and prevents any added play from exceeding $500.",
  },
  {
    id: "novice-double-today",
    group: "Novice",
    name: "Double it today",
    operatorSkill: "Novice operator",
    thesisTitle: null,
    draftThesis: "A same-day play is eligible only when a specific market belief, fresh trigger, bounded invalidation, and realistic loss ceiling are all present.",
    mission: { prompt: "Where can I put this $5,000 today to double it without risking much?", thesis: "", capital: 5000, target: 10000, maxLoss: 75, horizon: "today" },
    promptStarters: ["Where can I put $5,000 today?", "How can I limit the loss to $75?", "What thesis and evidence are missing?"],
    result: "no_trade",
    dataFreshness: "Market data · current",
    contextWarning: "The target requires a 100% same-day gain",
    universe: { researched: 57, cleared: 0, parked: 57 },
    plays: [
      { symbol: "SPY", title: "Opening-range breakout", playType: "Long shares", entry: "Confirmed opening-range break", stop: "Range failure", timeBoundary: "Flat by close", plannedLoss: 75, evidenceState: "blocked", evidenceLabel: "No thesis and real-time trigger missing", notionalPerUnit: 650, riskPerUnit: 7.5, unitLabel: "shares" },
      { symbol: "QQQ", title: "VWAP reclaim", playType: "Long shares", entry: "Confirmed reclaim and hold", stop: "VWAP failure", timeBoundary: "Flat by close", plannedLoss: 75, evidenceState: "blocked", evidenceLabel: "Thesis incomplete", notionalPerUnit: 560, riskPerUnit: 7.5, unitLabel: "shares" },
    ],
    blockingGate: "No thesis is assigned and the desired return cannot fit the $75 loss ceiling.",
    noTradeCondition: "No play if the return cannot be credibly modeled inside the loss ceiling or the thesis and real-time trigger are missing.",
    summary: "No qualifying paper play. Cash is the primary outcome, and the thesis can be built in place.",
    requiredNow: ["Plain-language mismatch", "Build-thesis action", "Cash outcome"],
    optionalDepth: ["Rejected setups", "Risk arithmetic", "Evidence checklist"],
    uiRisks: ["System can invent a thesis", "Candidates can imply recommendation", "Technical language can hide the mismatch"],
    acceptance: "No thesis plus a 100% same-day aspiration resolves to no trade without forcing candidate-by-candidate review.",
  },
];

export const DEFAULT_APERTURE_SCENARIO = APERTURE_PRESSURE_TEST_SCENARIOS[0];

export function findApertureScenario(id: string | null | undefined) {
  return APERTURE_PRESSURE_TEST_SCENARIOS.find((scenario) => scenario.id === id) ?? DEFAULT_APERTURE_SCENARIO;
}
