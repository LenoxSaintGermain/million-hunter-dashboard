import { createHash } from "node:crypto";
import { z } from "zod";
import {
  assessCausalEconomicPath,
  type CausalAssertion,
  type CausalEconomicPath,
  type CausalEvidenceSource,
  type CausalPathAssessment,
} from "../../shared/capitalStrategy";

/** Transport/resource bounds, not portfolio policy or investment ranking. */
export const STRATEGY_DISCOVERY_LIMITS = { contentBytes: 262_144, hypotheses: 12, sources: 100, hops: 3 } as const;
const id = z.string().trim().min(1).max(160);
const prose = z.string().trim().min(1).max(2_000);
const texts = z.array(prose).max(30);
const time = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const url = z.string().max(2_048).refine((value) => {
  try { const parsed = new URL(value); return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password; }
  catch { return false; }
}, "Expected an http(s) citation without credentials");
const state = z.object({ status: z.enum(["available", "partial", "failed"]), failures: texts }).strict().superRefine((value, ctx) => {
  if ((value.status === "available") !== (value.failures.length === 0)) ctx.addIssue({ code: "custom", message: "Availability and failures disagree" });
});
const sourceIds = z.array(id).max(20);
const assertion = z.object({
  id, statement: prose,
  assertionClass: z.enum(["reported_observation", "issuer_claim", "analyst_inference", "user_hypothesis"]),
  sourceIds, requiredConditions: texts, contradictions: texts, unknowns: texts, invalidation: prose,
}).strict();
const launch = z.enum(["not_documented", "announced", "launched"]);
const pathSchema = z.object({
  id,
  originatingSignal: assertion,
  hops: z.array(z.object({
    id, from: prose, to: prose, assertion,
    mechanism: z.object({
      kind: z.enum(["transactional", "revenue_share", "variable_usage", "fixed_fee", "minimum_commitment", "unknown"]),
      commercialTermsStatus: z.enum(["verified", "unverified"]),
    }).strict(),
    estimatedImpact: z.object({
      basis: z.enum(["reported", "modeled", "usage_driven", "unsupported"]),
      amountCents: z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER).nullable(), description: prose,
    }).strict().superRefine((value, ctx) => {
      if (value.basis === "unsupported" && value.amountCents !== null) ctx.addIssue({ code: "custom", message: "Unsupported impact cannot carry an amount" });
    }).nullable(),
    expectedTiming: prose, nextFactToVerify: prose, failureCondition: prose,
  }).strict()).max(STRATEGY_DISCOVERY_LIMITS.hops),
  affectedEntities: z.array(prose).min(1).max(20),
  securityMapping: z.object({ entity: prose, symbol: id.nullable(), status: z.enum(["verified", "unverified", "not_public"]) }).strict(),
  // An explicit empty value is an honest gap; the existing guard refuses promotion.
  whatChangedFromExpectations: z.string().trim().max(2_000), counterargument: prose,
  expectationsBaseline: z.object({ asOf: time, commercialLaunchStatus: launch, sourceIds, incrementalChange: assertion.nullable() }).strict().nullable(),
  technologyPermission: z.object({
    technicalCapabilityDocumented: z.boolean(), rightsDocumented: z.boolean(), jurisdictionAndProductIdentified: z.boolean(),
    permissionStatus: z.enum(["verified", "unverified", "not_required"]), commercialLaunchStatus: launch,
    adoptionObserved: z.boolean(), financialImpactSupportable: z.boolean(),
  }).strict().nullable(),
  marketMeasurement: z.object({
    kind: z.enum(["odds", "listed_markets", "reported_activity", "operator_revenue", "customer_adoption"]),
    volumeObserved: z.boolean(), claimedMetrics: z.array(z.enum(["odds", "listed_markets", "handle", "customer_count", "revenue", "profitability"])).max(6),
    methodology: prose, coverage: prose, asOf: time,
  }).strict().nullable(),
  reviewAt: time.nullable(), expiresAt: time.nullable(),
}).strict();

/** Expected structured content. No confidence, score, risk, capital, or order fields. */
export const strategyDiscoveryPayloadSchema = z.object({
  schemaVersion: z.literal(1),
  searchScope: z.enum(["current_thesis", "related_opportunities", "broader_permitted_universe"]),
  reviewedUniverse: z.array(id).max(100), coverageGaps: texts,
  hypotheses: z.array(z.object({
    id, title: prose, use: z.enum(["new_play", "incremental_existing_thesis"]),
    horizon: z.enum(["intraday", "overnight", "swing", "catalyst_window", "position"]),
    disposition: z.enum(["research_lead", "reject"]), rejectionReasons: texts,
    whyThisUse: prose, whyNow: prose, whyNotAlternatives: prose, changeCondition: prose,
    causalPath: pathSchema,
  }).strict().superRefine((value, ctx) => {
    if ((value.disposition === "reject") !== (value.rejectionReasons.length > 0)) ctx.addIssue({ code: "custom", message: "Disposition and rejection reasons disagree" });
  })).max(STRATEGY_DISCOVERY_LIMITS.hypotheses),
}).strict();

const sourceReceipt = z.object({
  id,
  originId: id.nullable(), originUrl: url.nullable(),
  sourceName: prose, sourceUrl: url,
  observedAt: time.nullable(), publishedAt: time.nullable(), retrievedAt: time,
  quality: z.object({ kind: z.enum(["primary", "secondary", "unknown"]), basis: prose }).strict(),
}).strict();

/**
 * Supplied by the retrieval/job adapter, NOT extracted from model prose.
 * The caller must authorize the scope and establish source/origin/quality lineage.
 * deepResearch's content/citations alone do not supply this complete manifest.
 */
export const strategyDiscoveryContextSchema = z.object({
  requestId: id, provider: id, asOf: time, receivedAt: time,
  searchScope: z.enum(["current_thesis", "related_opportunities", "broader_permitted_universe"]),
  // Authorization to research a cited symbol is not verified listing/tradability.
  universePolicy: z.enum(["declared_symbols", "cited_us_security_leads"]).optional(),
  permittedUniverse: z.array(id).max(100),
  citations: z.array(url).max(STRATEGY_DISCOVERY_LIMITS.sources),
  sources: z.array(sourceReceipt).max(STRATEGY_DISCOVERY_LIMITS.sources),
  providerState: state, classifierState: state,
}).strict().superRefine((value, ctx) => {
  if (value.universePolicy === "cited_us_security_leads" && value.searchScope !== "broader_permitted_universe") {
    ctx.addIssue({ code: "custom", path: ["universePolicy"], message: "Broad symbol discovery requires explicit broad-search permission" });
  }
  if (value.universePolicy !== "cited_us_security_leads" && value.permittedUniverse.length === 0) {
    ctx.addIssue({ code: "custom", path: ["permittedUniverse"], message: "An exact-symbol search requires an explicit universe" });
  }
});

export type StrategyDiscoveryPayload = z.infer<typeof strategyDiscoveryPayloadSchema>;
export type StrategyDiscoveryContext = z.infer<typeof strategyDiscoveryContextSchema>;
type ProviderHypothesis = StrategyDiscoveryPayload["hypotheses"][number];
export type StrategyDiscoveryHypothesis = Omit<ProviderHypothesis, "causalPath" | "disposition" | "rejectionReasons"> & {
  causalPath: CausalEconomicPath;
  assessment: CausalPathAssessment;
  disposition: "research_lead" | "rejected" | "unavailable";
  reasons: string[];
  /** Structural and citation checks do not produce probability of profit. */
  confidence: null;
};
export type StrategyDiscoveryResult = {
  /** Receipt completeness, not fact verification, investment eligibility, or completed E2E discovery. */
  status: "complete" | "incomplete" | "unavailable";
  requestId: string | null;
  asOf: number | null;
  contentSha256: string | null;
  context: StrategyDiscoveryContext | null;
  reviewedUniverse: string[];
  coverageGaps: string[];
  hypotheses: StrategyDiscoveryHypothesis[];
  rejectedHypotheses: Array<{ index: number; id: string | null; reasons: string[] }>;
  issues: Array<{ path: string; code: string }>;
  sourceOrigins: Array<{ originId: string; sourceIds: string[] }>;
  /** Discovery never creates investment alternatives; the existing Strategist caps those at two AFTER underwriting. */
  investmentAlternatives: [];
  confidence: null;
  sideEffects: { providerInvoked: false; persistenceWritten: false; capitalReserved: false; orderCreated: false };
};

function canonicalUrl(value: string) {
  const parsed = new URL(value);
  parsed.hash = "";
  for (const key of Array.from(parsed.searchParams.keys())) if (/^utm_/i.test(key)) parsed.searchParams.delete(key);
  parsed.searchParams.sort();
  return parsed.href;
}
function assertions(path: z.infer<typeof pathSchema>) {
  return [path.originatingSignal, ...path.hops.map((hop) => hop.assertion), ...(path.expectationsBaseline?.incrementalChange ? [path.expectationsBaseline.incrementalChange] : [])];
}
function references(path: z.infer<typeof pathSchema>) {
  return [...assertions(path).flatMap((item) => item.sourceIds), ...(path.expectationsBaseline?.sourceIds ?? [])];
}
function schemaIssues(error: z.ZodError) {
  // Never echo raw provider prose, source contents, or credentials in an error.
  return error.issues.map((issue) => ({ path: issue.path.map(String).join("."), code: issue.code }));
}

/**
 * Strict, side-effect-free production parsing seam for cited discovery output.
 * Not a provider call, fact verifier, Underwriter run, or stakeholder E2E journey.
 * Reject a malformed batch atomically; never salvage a partial JSON substring or
 * turn an error into a successful empty search. The hash identifies the raw receipt.
 *
 * Integration contract: persist this receipt and its exclusions, then pass only
 * deliberately selected research_lead hypotheses into existing research and
 * underwriting. The existing Strategist accepts independently underwritten
 * candidates, NOT this output. Its mapper must retain discovery disposition;
 * a structurally valid but explicitly rejected hypothesis must not be promoted.
 */
export function parseStrategyDiscovery(payload: unknown, contextInput: unknown): StrategyDiscoveryResult {
  const base: StrategyDiscoveryResult = {
    status: "unavailable", requestId: null, asOf: null, contentSha256: null, context: null,
    reviewedUniverse: [], coverageGaps: [], hypotheses: [], rejectedHypotheses: [], issues: [], sourceOrigins: [],
    investmentAlternatives: [], confidence: null,
    sideEffects: { providerInvoked: false, persistenceWritten: false, capitalReserved: false, orderCreated: false },
  };
  let raw: unknown = payload;
  const reject = (code: string, issues = [{ path: "", code }]): StrategyDiscoveryResult => {
    const rawHypotheses = raw && typeof raw === "object" && "hypotheses" in raw && Array.isArray(raw.hypotheses) ? raw.hypotheses : [];
    return { ...base, coverageGaps: [...base.coverageGaps, code], issues,
      rejectedHypotheses: rawHypotheses.map((item, index) => ({ index, id: id.safeParse(item?.id).success ? item.id.trim() : null, reasons: [code] })),
    };
  };
  try {
    const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);
    if (typeof serialized !== "string" || Buffer.byteLength(serialized, "utf8") > STRATEGY_DISCOVERY_LIMITS.contentBytes) { raw = null; return reject("invalid_content_size"); }
    base.contentSha256 = createHash("sha256").update(serialized).digest("hex");
    raw = typeof payload === "string" ? JSON.parse(payload) : payload;
  } catch { return reject("invalid_json"); }
  const contextResult = strategyDiscoveryContextSchema.safeParse(contextInput);
  if (!contextResult.success) return reject("invalid_provider_manifest", schemaIssues(contextResult.error));
  const context = contextResult.data;
  Object.assign(base, { context, requestId: context.requestId, asOf: context.asOf, coverageGaps: [...context.providerState.failures, ...context.classifierState.failures] });
  const parsed = strategyDiscoveryPayloadSchema.safeParse(raw);
  if (!parsed.success) return reject("invalid_discovery_schema", schemaIssues(parsed.error));
  const body = parsed.data;
  const issues: StrategyDiscoveryResult["issues"] = [];
  const fail = (path: string, code: string) => issues.push({ path, code });
  if (context.asOf > context.receivedAt) fail("asOf", "evaluation_after_receipt");
  const sources = new Map<string, StrategyDiscoveryContext["sources"][number]>();
  const originsByUrl = new Map<string, string>();
  const urlsByOrigin = new Map<string, string>();
  const citationUrls = new Set(context.citations.map(canonicalUrl));
  for (const [index, source] of Array.from(context.sources.entries())) {
    if (sources.has(source.id)) fail(`sources.${index}`, "duplicate_source_id");
    if (source.retrievedAt > context.receivedAt) fail(`sources.${index}`, "retrieval_after_receipt");
    if (source.originId && source.originUrl) {
      const originUrl = canonicalUrl(source.originUrl);
      for (const address of [originUrl, canonicalUrl(source.sourceUrl)]) {
        if (originsByUrl.has(address) && originsByUrl.get(address) !== source.originId) fail(`sources.${index}`, "conflicting_source_origin");
        originsByUrl.set(address, source.originId);
      }
      if (urlsByOrigin.has(source.originId) && urlsByOrigin.get(source.originId) !== originUrl) fail(`sources.${index}`, "conflicting_source_origin");
      urlsByOrigin.set(source.originId, originUrl);
    }
    sources.set(source.id, source);
  }
  if (body.searchScope !== context.searchScope) fail("searchScope", "unauthorized_search_scope");
  const permitted = new Set(context.permittedUniverse);
  const authorizedSymbol = (symbol: string) => context.universePolicy === "cited_us_security_leads"
    ? /^[A-Z]{1,5}(\.[A-Z])?$/.test(symbol) : permitted.has(symbol);
  if (body.reviewedUniverse.some((symbol) => !authorizedSymbol(symbol))) fail("reviewedUniverse", "outside_permitted_universe");
  const identities = new Set<string>();
  for (const [index, item] of Array.from(body.hypotheses.entries())) {
    for (const identity of [`hypothesis:${item.id}`, `path:${item.causalPath.id}`]) {
      if (identities.has(identity)) fail(`hypotheses.${index}`, "duplicate_hypothesis_identity");
      identities.add(identity);
    }
    const path = item.causalPath;
    const symbol = path.securityMapping.symbol;
    if (symbol && (!authorizedSymbol(symbol) || !body.reviewedUniverse.includes(symbol))) fail(`hypotheses.${index}`, "unreviewed_or_unauthorized_security");
    if (context.universePolicy === "cited_us_security_leads" && path.securityMapping.status === "verified") fail(`hypotheses.${index}`, "security_mapping_requires_independent_verification");
    const assertionIds = assertions(path).map((item) => item.id);
    if (new Set(assertionIds).size !== assertionIds.length || new Set(path.hops.map((hop) => hop.id)).size !== path.hops.length) fail(`hypotheses.${index}`, "duplicate_path_identity");
    for (const sourceId of references(path)) {
      const source = sources.get(sourceId);
      if (!source || !citationUrls.has(canonicalUrl(source.sourceUrl))) fail(`hypotheses.${index}`, "unbound_citation");
    }
  }
  if (issues.length) return reject("invalid_discovery_lineage", issues);

  const resolveSources = (ids: string[]): CausalEvidenceSource[] => ids.map((sourceId) => {
    const { quality: _quality, originUrl, originId, ...source } = sources.get(sourceId)!;
    // Missing origin identity is excluded by the existing guard, never counted as independent proof.
    return { ...source, originId: originUrl && originId ? originId : "" };
  });
  const resolveAssertion = ({ sourceIds, ...item }: z.infer<typeof assertion>): CausalAssertion => ({ ...item, sources: resolveSources(sourceIds) });
  const hypotheses: StrategyDiscoveryHypothesis[] = body.hypotheses.map((item) => {
    const rawPath = item.causalPath;
    const usedSources = Array.from(new Set(references(rawPath))).map((id) => sources.get(id)!);
    const gaps = usedSources.filter((source) => source.quality.kind === "unknown").map((source) => `Source quality not established: ${source.id}`);
    const classifierState = context.classifierState.status === "failed" ? context.classifierState
      : gaps.length ? { status: "partial" as const, failures: [...context.classifierState.failures, ...gaps] } : context.classifierState;
    const { expectationsBaseline, ...rest } = rawPath;
    const path: CausalEconomicPath = {
      ...rest,
      originatingSignal: resolveAssertion(rawPath.originatingSignal),
      hops: rawPath.hops.map((hop) => ({ ...hop, assertion: resolveAssertion(hop.assertion) })),
      expectationsBaseline: expectationsBaseline ? {
        asOf: expectationsBaseline.asOf, commercialLaunchStatus: expectationsBaseline.commercialLaunchStatus,
        sources: resolveSources(expectationsBaseline.sourceIds),
        incrementalChange: expectationsBaseline.incrementalChange ? resolveAssertion(expectationsBaseline.incrementalChange) : null,
      } : null,
      providerState: context.providerState, classifierState,
    };
    const assessment = assessCausalEconomicPath(path, context.asOf);
    const reasons = Array.from(new Set([...item.rejectionReasons, ...assessment.reasons, ...(gaps.length ? ["source_quality_unverified"] : [])]));
    const { disposition: _disposition, rejectionReasons: _rejections, causalPath: _raw, ...fields } = item;
    return { ...fields, causalPath: path, assessment, confidence: null,
      disposition: assessment.status === "unavailable" ? "unavailable" : item.disposition === "reject" || assessment.status === "rejected" ? "rejected" : "research_lead",
      reasons,
    };
  });
  const originGroups = new Map<string, string[]>();
  for (const [index, hypothesis] of Array.from(hypotheses.entries())) {
    const eligibleOrigins = new Set(hypothesis.assessment.sources.map((source) => source.originId));
    const excludedIds = new Set(hypothesis.assessment.excludedSources.map(({ source }) => source.id));
    for (const sourceId of references(body.hypotheses[index].causalPath)) {
      const source = sources.get(sourceId)!;
      if (!source.originId || !eligibleOrigins.has(source.originId) || excludedIds.has(sourceId)) continue;
      const group = originGroups.get(source.originId) ?? [];
      if (!group.includes(source.id)) group.push(source.id);
      originGroups.set(source.originId, group);
    }
  }
  const unavailable = context.providerState.status === "failed" || context.classifierState.status === "failed";
  return {
    ...base,
    status: unavailable ? "unavailable" : context.providerState.status === "partial" || context.classifierState.status === "partial"
      || body.coverageGaps.length > 0 || hypotheses.some((item) => item.assessment.status === "conditional_research") ? "incomplete" : "complete",
    reviewedUniverse: Array.from(new Set(body.reviewedUniverse)),
    coverageGaps: Array.from(new Set([...base.coverageGaps, ...body.coverageGaps, ...hypotheses.flatMap((item) => [...item.assessment.unknowns, ...(item.causalPath.classifierState?.failures ?? [])])])),
    hypotheses,
    rejectedHypotheses: hypotheses.flatMap((item, index) => item.disposition === "research_lead" ? [] : [{ index, id: item.id, reasons: item.reasons }]),
    sourceOrigins: Array.from(originGroups).map(([originId, sourceIds]) => ({ originId, sourceIds })),
  };
}
