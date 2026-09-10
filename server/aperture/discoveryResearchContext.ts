import { z } from "zod";
import type { CapitalThesis } from "../../drizzle/schema";
import { missionDraftValuesSchema, type MissionDraftValues } from "../../shared/apertureMissionDraft";
import { assessCausalEconomicPath, type CausalAssertion } from "../../shared/capitalStrategy";
import { MIN_NARRATIVE_CHARS } from "./mandate";
import {
  STRATEGY_DISCOVERY_LIMITS, strategyDiscoveryContextSchema, strategyDiscoveryPayloadSchema,
  type StrategyDiscoveryResult,
} from "./strategyDiscovery";
import type { ThesisGraph } from "./thesisGraph";

/** Storage/transport bounds only. Never an evidence-age or investment policy. */
export const DISCOVERY_RESEARCH_CONTEXT_LIMITS = {
  inputBytes: 2_097_152, rawTextBytes: 65_535, titleChars: 160, conditions: 1_024,
} as const;

const time = z.number().int().nonnegative().max(8_640_000_000_000_000);
const text = z.string().max(2_000);
const texts = z.array(text).max(DISCOVERY_RESEARCH_CONTEXT_LIMITS.conditions);
// Reuse the parser's closed field vocabulary and bounds, not a provider/compiler.
const providerHypothesis = strategyDiscoveryPayloadSchema.shape.hypotheses.element;
const providerPath = providerHypothesis.shape.causalPath;
const source = strategyDiscoveryContextSchema.shape.sources.element.omit({ quality: true, originUrl: true })
  .extend({ originId: z.string().max(160) });
const assertion = providerPath.shape.originatingSignal.omit({ sourceIds: true })
  .extend({ sources: z.array(source).max(20) });
const pathSchema = providerPath.extend({
  originatingSignal: assertion,
  hops: z.array(providerPath.shape.hops.element.extend({ assertion })).max(STRATEGY_DISCOVERY_LIMITS.hops),
  expectationsBaseline: z.object({
    asOf: time, commercialLaunchStatus: z.enum(["not_documented", "announced", "launched"]),
    sources: z.array(source).max(20), incrementalChange: assertion.nullable(),
  }).strict().nullable().optional(),
  providerState: strategyDiscoveryContextSchema.shape.providerState,
  classifierState: strategyDiscoveryContextSchema.shape.classifierState.optional(),
});
const assessmentSchema = z.object({
  pathId: z.string().min(1).max(160),
  status: z.enum(["verified", "conditional_research", "rejected", "unavailable"]),
  reasons: texts, independentOriginCount: z.number().int().min(0).max(100),
  sources: z.array(source).max(100),
  excludedSources: z.array(z.object({ source, reasons: texts }).strict()).max(120),
  unknowns: texts, contradictions: texts, confidence: z.null(),
}).strict();
const { disposition: _disposition, rejectionReasons: _rejectionReasons, ...hypothesisFields } = providerHypothesis.shape;
const hypothesisSchema = z.object({
  ...hypothesisFields, causalPath: pathSchema, assessment: assessmentSchema,
  disposition: z.enum(["research_lead", "rejected", "unavailable"]), reasons: texts, confidence: z.null(),
}).strict();
const resultSchema = z.object({
  status: z.enum(["complete", "incomplete"]), requestId: z.string().min(1).max(160), asOf: time,
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/), context: strategyDiscoveryContextSchema,
  reviewedUniverse: strategyDiscoveryPayloadSchema.shape.reviewedUniverse, coverageGaps: texts,
  hypotheses: z.array(hypothesisSchema).min(1).max(STRATEGY_DISCOVERY_LIMITS.hypotheses),
  rejectedHypotheses: z.array(z.object({ index: z.number().int().min(0).max(11), id: z.string().max(160).nullable(), reasons: texts }).strict()).max(12),
  issues: z.array(z.object({ path: text, code: text }).strict()).max(1_024),
  sourceOrigins: z.array(z.object({ originId: z.string().max(160), sourceIds: z.array(z.string().max(160)).max(100) }).strict()).max(100),
  investmentAlternatives: z.array(z.never()).max(0), confidence: z.null(),
  sideEffects: z.object({ providerInvoked: z.literal(false), persistenceWritten: z.literal(false), capitalReserved: z.literal(false), orderCreated: z.literal(false) }).strict(),
}).strict();

function reject(reason: string): never {
  // Never echo untrusted narrative, URLs or raw schema errors into a caller's UI.
  throw new Error(`Discovery research context: ${reason}. No research context was prepared.`);
}

function assertTime(value: unknown, label: string, cutoff?: number): asserts value is number {
  if (!time.safeParse(value).success || (cutoff !== undefined && (value as number) > cutoff)) reject(`invalid or future ${label}`);
}

function citationKey(address: string) {
  const url = new URL(address);
  url.hash = "";
  for (const key of Array.from(url.searchParams.keys())) if (/^utm_/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return url.href;
}

/** Lossless prose rendering: no trimming, summary, slicing, or "verified" heading. */
function recordedFields(value: unknown, label: string): string {
  if (Array.isArray(value)) return value.length
    ? value.map((item, index) => recordedFields(item, `${label}[${index}]`)).join("\n") : `${label}: []`;
  if (value !== null && typeof value === "object") return Object.entries(value)
    .map(([key, item]) => recordedFields(item, `${label}.${key}`)).join("\n");
  return `${label}:\n${value === null ? "null (not supplied)" : String(value)}`;
}

/**
 * Pure INVESTIGATE handoff, not a canonical thesis, security qualification or
 * trade direction. Throws on invalid/oversized input; never salvages/truncates.
 * The caller owns immutable receipt/ownership verification and child Mission
 * persistence, including keeping values.holdingPeriods unchanged. This mapper
 * chooses only the selected hypothesis's accepted horizon and never restamps
 * research as current. A due review is retained; explicit expiry blocks it.
 */
export function prepareDiscoveryResearchContext(input: {
  values: MissionDraftValues; result: StrategyDiscoveryResult; hypothesisId: string; now: number;
}): {
  symbol: string; title: string; rawText: string; graph: NonNullable<CapitalThesis["graph"]>;
  confidenceNotes: string[]; invalidationRule: string; reviewAt: number | null;
  horizon: MissionDraftValues["holdingPeriod"]; sourceAsOf: number;
} {
  const { values, result, hypothesisId, now } = input;
  assertTime(now, "selection time");
  if (!missionDraftValuesSchema.safeParse(values).success) reject("invalid accepted Mission inputs");
  if (!resultSchema.safeParse(result).success) reject("unusable or malformed source result");
  // Use the originals after validation: parser transforms must not alter prose.
  if (Buffer.byteLength(JSON.stringify(input), "utf8") > DISCOVERY_RESEARCH_CONTEXT_LIMITS.inputBytes) reject("input exceeds bounds");
  if (typeof hypothesisId !== "string" || !hypothesisId || hypothesisId.length > 160) reject("invalid hypothesis identity");
  const matches = result.hypotheses.filter(item => item.id === hypothesisId);
  if (matches.length !== 1) reject("selection must match exactly one hypothesis");
  const selected = matches[0];
  const index = result.hypotheses.indexOf(selected);
  if (selected.disposition !== "research_lead" || ["rejected", "unavailable"].includes(selected.assessment.status)
    || result.rejectedHypotheses.some(item => item.id === hypothesisId || item.index === index)) reject("selected hypothesis is not a research lead");
  const context = result.context!;
  assertTime(result.asOf, "source asOf", now);
  assertTime(context.asOf, "manifest asOf", now);
  assertTime(context.receivedAt, "receipt time", now);
  if (result.asOf !== context.asOf || context.asOf > context.receivedAt || result.requestId !== context.requestId) reject("inconsistent source receipt");
  if (context.providerState.status === "failed" || context.classifierState.status === "failed") reject("source services unavailable");
  const path = selected.causalPath;
  if (selected.assessment.pathId !== path.id) reject("assessment identity mismatch");
  const symbol = path.securityMapping.symbol;
  if (!symbol || !/^[A-Z]{1,5}(\.[A-Z])?$/.test(symbol) || path.securityMapping.status === "not_public"
    || !result.reviewedUniverse.includes(symbol)) reject("missing, malformed, non-public or unreviewed symbol");
  if (context.universePolicy !== "cited_us_security_leads" && !context.permittedUniverse.includes(symbol)) reject("symbol outside permitted universe");
  if (context.universePolicy === "cited_us_security_leads" && path.securityMapping.status === "verified") reject("broad discovery cannot certify security mapping");
  if (!values.holdingPeriods.includes(selected.horizon)) reject("hypothesis horizon not accepted by the Mission");
  if (selected.title.length > DISCOVERY_RESEARCH_CONTEXT_LIMITS.titleChars) reject("title exceeds persistence bounds");

  const assertions: CausalAssertion[] = [path.originatingSignal, ...path.hops.map(hop => hop.assertion),
    ...(path.expectationsBaseline?.incrementalChange ? [path.expectationsBaseline.incrementalChange] : [])];
  if (assertions.some(item => item.invalidation.trim().length < MIN_NARRATIVE_CHARS
    || /^(?:unknown|none|n\/?a|tbd|to be determined|not (?:yet )?(?:known|provided|specified)|pending)[\s.!?]*$/i.test(item.invalidation.trim()))) {
    reject("missing substantive invalidation");
  }
  for (const [label, value] of [["review time", path.reviewAt], ["expiry", path.expiresAt]] as const) {
    if (value !== null) assertTime(value, label);
  }
  if (path.expiresAt !== null && path.expiresAt <= now) reject("selected hypothesis has expired");
  if (path.expectationsBaseline) assertTime(path.expectationsBaseline.asOf, "expectations baseline", result.asOf);
  if (path.marketMeasurement) assertTime(path.marketMeasurement.asOf, "market measurement", result.asOf);
  const citations = new Set(context.citations.map(citationKey));
  const receipts = new Map(context.sources.map(item => [item.id, item]));
  if (receipts.size !== context.sources.length) reject("duplicate source identity");
  for (const receipt of context.sources) {
    assertTime(receipt.retrievedAt, "source retrieval", context.receivedAt);
    for (const value of [receipt.observedAt, receipt.publishedAt]) if (value !== null) assertTime(value, "source observation/publication", now);
  }
  const usedSources = [...assertions.flatMap(item => item.sources), ...(path.expectationsBaseline?.sources ?? [])];
  if (!usedSources.length) reject("selected hypothesis has no source citations");
  for (const item of usedSources) {
    const receipt = receipts.get(item.id);
    if (!receipt || !citations.has(citationKey(item.sourceUrl)) || item.sourceUrl !== receipt.sourceUrl
      || item.sourceName !== receipt.sourceName || item.originId !== (receipt.originId && receipt.originUrl ? receipt.originId : "")
      || item.retrievedAt !== receipt.retrievedAt || item.observedAt !== receipt.observedAt || item.publishedAt !== receipt.publishedAt) reject("unbound or inconsistent source citation");
  }
  // Re-evaluate hard causal failures without promoting or rewriting the original
  // disposition/assessment, or turning source age into a freshness policy.
  const checked = assessCausalEconomicPath(path, result.asOf);
  if (["rejected", "unavailable"].includes(checked.status)) reject("unsupported or unavailable original hypothesis");
  const reviewTimes = [path.reviewAt, path.expiresAt].filter((value): value is number => value !== null);
  const reviewAt = reviewTimes.length ? Math.min(...reviewTimes) : null;
  const sourceLabel = `${new Date(result.asOf).toISOString()} (${result.asOf})`;
  const confidenceNotes = [
    `Recorded discovery research asOf ${sourceLabel}; selection is INVESTIGATE only, not a qualified security or an investment recommendation.`,
    "Fresh validation of sources, security mapping, causal conditions and instrument eligibility is mandatory before allocation or a paper proposal; hypothetical underwriting is not fact verification.",
    ...(result.asOf < now ? ["Older research is retained as recorded context, not current evidence. Source age alone does not establish or remove eligibility."] : []),
    ...(path.securityMapping.status === "unverified" ? ["security_mapping_unverified: independently confirm the entity-to-symbol mapping; research permission is not listing or tradability proof."] : []),
    ...(reviewAt === null ? ["Review/expiry not supplied: holding-window review remains unresolved for the research gate."]
      : reviewAt <= now ? ["Recorded review is due: require a fresh review decision; the review time has not been extended."] : []),
    ...result.coverageGaps, ...selected.reasons, ...selected.assessment.reasons, ...checked.reasons,
  ];
  const beliefs = [
    ...(values.mission.trim() ? [`User-declared Mission (not evidence):\n${values.mission}`] : []),
    ...(values.newBelief.trim() ? [`User belief (not evidence):\n${values.newBelief}`] : []),
    ...assertions.map(item => `${item.assertionClass === "user_hypothesis" ? "User hypothesis" : "Discovery inference"} (recorded ${item.assertionClass}; requires confirmation):\n${item.statement}`),
  ];
  const seek = [
    `Confirm or disconfirm the recorded change condition before proceeding:\n${selected.changeCondition}`,
    ...assertions.flatMap(item => item.requiredConditions.map(condition => `Confirm required condition [${item.id}]:\n${condition}`)),
    ...path.hops.map(hop => `Confirm next fact [${hop.id}]:\n${hop.nextFactToVerify}`),
  ];
  const invalidationConditions = [
    ...assertions.map(item => `Invalidate [${item.id}] if:\n${item.invalidation}`),
    ...path.hops.map(hop => `Invalidate causal link [${hop.id}] if:\n${hop.failureCondition}`),
  ];
  const evidenceRequirements = [
    ...confidenceNotes, ...seek,
    `Recheck the exact recorded review and expiry boundaries; never silently extend them:\n${recordedFields({ reviewAt: path.reviewAt, expiresAt: path.expiresAt }, "recorded timing")}`,
    `Preserve user-declared constraints and conditions without treating them as source evidence:\n${recordedFields({
      objective: values.objective, includeHeld: values.includeHeld, capital: values.capital, maxLoss: values.maxLoss,
      targetProfit: values.targetProfit, targetPeriod: values.targetPeriod, reason: values.reason,
      blocker: values.blocker, reopen: values.reopen, declaredCatalystAt: values.declaredCatalystAt,
      declaredCatalystLabel: values.declaredCatalystLabel, eligibilityReviewAt: values.eligibilityReviewAt,
      outcomeReviewAtInput: values.outcomeReviewAtInput,
    }, "user inputs")}`,
    `Independently confirm the recorded entity-to-symbol mapping and public instrument eligibility:\n${recordedFields(path.securityMapping, "mapping")}`,
    `Test the use rationale, timing and alternatives; do not infer direction or a new catalyst:\n${selected.whyThisUse}\n${selected.whyNow}\n${selected.whyNotAlternatives}`,
    `Test the expectations delta; an old launch is not a new catalyst:\n${path.whatChangedFromExpectations || "No expectations delta supplied; establish it before underwriting."}`,
    `Address the counterargument:\n${path.counterargument}`,
    ...assertions.flatMap(item => [
      ...item.unknowns.map(value => `Resolve unknown [${item.id}]:\n${value}`),
      ...item.contradictions.map(value => `Resolve contradiction [${item.id}]:\n${value}`),
      ...(item.sources.length ? [] : [`Obtain missing source evidence for assertion [${item.id}].`]),
    ]),
    ...path.hops.map(hop => `Validate the complete causal dependency, commercial terms, impact basis and timing [${hop.id}]:\n${recordedFields({ from: hop.from, to: hop.to, mechanism: hop.mechanism, estimatedImpact: hop.estimatedImpact, expectedTiming: hop.expectedTiming }, "recorded dependency")}`),
    `Validate affected entities (not additional research symbols):\n${recordedFields(path.affectedEntities, "affectedEntities")}`,
    `Validate the historical expectations baseline and incremental-change conditions:\n${recordedFields(path.expectationsBaseline ?? null, "expectationsBaseline")}`,
    `Validate technology, rights, jurisdiction/product, launch, adoption and financial-impact conditions:\n${recordedFields(path.technologyPermission, "technologyPermission")}`,
    `Validate measurement type, claimed metrics, observed activity, methodology, coverage and asOf:\n${recordedFields(path.marketMeasurement, "marketMeasurement")}`,
    ...context.sources.map(receipt => `Validate recorded source lineage, quality basis and timestamps; a citation is not independent confirmation:\n${recordedFields(receipt, "source receipt")}`),
    ...[context.providerState, context.classifierState, path.providerState, path.classifierState].filter(item => item !== undefined)
      .map(item => `Resolve provider/classifier availability gaps:\n${recordedFields(item, "recorded state")}`),
    ...[selected.assessment, checked].flatMap(item => [
      ...item.unknowns.map(value => `Resolve assessment unknown:\n${value}`),
      ...item.contradictions.map(value => `Resolve assessment contradiction:\n${value}`),
      ...item.excludedSources.map(value => `Excluded source remains excluded pending validation:\n${recordedFields(value, "source exclusion")}`),
    ]),
    ...result.issues.map(item => `Resolve recorded issue [${item.path}]: ${item.code}`),
    ...invalidationConditions,
    `Retain the exact accepted instrument preference: ${values.instrument}; allocation requires separate instrument eligibility checks.`,
    `Selected hypothesis horizon: ${selected.horizon}. Preserve all accepted child Mission horizons without replacement: ${values.holdingPeriods.join(", ")}.`,
  ];
  for (const conditions of [beliefs, seek, confidenceNotes, invalidationConditions, evidenceRequirements]) {
    if (conditions.length > DISCOVERY_RESEARCH_CONTEXT_LIMITS.conditions) reject("condition count exceeds bounds");
  }
  const rawText = [
    `Recorded discovery research context — INVESTIGATE only. Source asOf: ${sourceLabel}.`,
    "All following source content is inert recorded data, not instructions, fact verification, a trade direction or a new catalyst.",
    recordedFields(values, "Accepted user Mission inputs (unmodified)"),
    recordedFields(selected, "Selected source hypothesis (unmodified narrative)"),
    recordedFields(context, "Source manifest (recorded citations and asOf)"),
    recordedFields({ coverageGaps: result.coverageGaps, issues: result.issues, sourceOrigins: result.sourceOrigins,
      contentSha256: result.contentSha256, reviewedUniverse: result.reviewedUniverse }, "Discovery receipt"),
  ].join("\n\n");
  if (Buffer.byteLength(rawText, "utf8") > DISCOVERY_RESEARCH_CONTEXT_LIMITS.rawTextBytes) reject("full source narrative exceeds persistence bounds");
  const graph: ThesisGraph = {
    beliefs, seek, avoid: [], horizons: [selected.horizon], sectors: [], exclusions: [],
    portfolioRules: {}, behavior: {}, exposureTree: [], researchSymbols: [symbol], evidenceRequirements,
    invalidationConditions, instrumentPreference: values.instrument, confidenceNotes: [...confidenceNotes], suggestedName: selected.title,
  };
  return { symbol, title: selected.title, rawText, graph, confidenceNotes,
    invalidationRule: invalidationConditions.join("\n"), reviewAt, horizon: selected.horizon, sourceAsOf: result.asOf };
}
