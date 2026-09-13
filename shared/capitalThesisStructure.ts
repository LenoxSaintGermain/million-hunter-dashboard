import type { CapitalMissionHoldingPeriod, CapitalMissionInstrument } from "./capitalMissionDefaults";
import { extractCapitalMissionDefaults } from "./capitalMissionDefaults";

export type CapitalThesisDetailsInput = {
  belief?: string;
  evidence?: string;
  seeks?: string;
  avoids?: string;
  horizon?: string;
  holdingPeriod?: CapitalMissionHoldingPeriod | null;
  invalidation?: string;
  risk?: string;
  symbols?: string | string[];
  /** Descriptive research scope; never a verified security or ticker list. */
  researchUniverse?: string;
  instrument?: CapitalMissionInstrument | null;
};

export type CapitalThesisDetails = {
  belief: string;
  evidence: string;
  seeks: string;
  avoids: string;
  horizon: string;
  holdingPeriod: CapitalMissionHoldingPeriod | null;
  invalidation: string;
  risk: string;
  researchSymbols: string[];
  researchUniverse: string;
  /** Read-repair diagnostic; never permission to infer a replacement scope. */
  researchUniverseNeedsReview?: boolean;
  instrumentPreference: CapitalMissionInstrument | null;
};

const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
const HOLDING_PERIODS: CapitalMissionHoldingPeriod[] = ["intraday", "overnight", "swing", "catalyst_window", "position"];
const INSTRUMENTS: CapitalMissionInstrument[] = ["shares", "options", "either"];

const holdingPeriod = (value: unknown): CapitalMissionHoldingPeriod | null =>
  typeof value === "string" && HOLDING_PERIODS.includes(value as CapitalMissionHoldingPeriod)
    ? value as CapitalMissionHoldingPeriod
    : null;

const instrument = (value: unknown): CapitalMissionInstrument | null =>
  typeof value === "string" && INSTRUMENTS.includes(value as CapitalMissionInstrument)
    ? value as CapitalMissionInstrument
    : null;

export function normalizeResearchSymbols(value: string | string[] | undefined): string[] {
  if (value == null || value === "") return [];
  if (!Array.isArray(value) && typeof value !== "string") return [];
  const text = typeof value === "string" ? value.trim() : "";
  // Whitespace-only lists must already look like declarations, not prose that
  // becomes ticker-shaped only after uppercasing. Comma/semicolon lists and
  // arrays declare their boundaries explicitly; validate every item, never
  // salvage the word-shaped pieces from an invalid sentence.
  const source = Array.isArray(value) ? value
    : /[,;]/.test(text) ? text.split(/[,;]/).map((part) => part.trim())
    : text.split(/\s+/);
  if (!Array.isArray(value) && !/[,;]/.test(text) && source.length > 1
    && source.some((symbol) => symbol !== symbol.toUpperCase())) return [];
  if (source.length > 50 || source.some((symbol) => typeof symbol !== "string"
    || !/^\$?[A-Za-z]{1,5}(?:[.-][A-Za-z]{1,2})?$/.test(symbol.trim()))) return [];
  return Array.from(new Set(source.map((symbol) => symbol.trim().toUpperCase().replace(/^\$/, ""))));
}

/** Deterministic read repair, without mutating the saved receipt or guessing identities. */
export function repairCapitalThesisResearchScope(source: {
  researchSymbols?: unknown;
  researchUniverse?: unknown;
  researchUniverseNeedsReview?: unknown;
}, rawText?: unknown): { researchSymbols: string[]; researchUniverse: string; symbolsWithheld: boolean } {
  const text = clean(rawText);
  const declarations = Array.from(text.matchAll(/^\s*Symbols(?: or research universe)?:[ \t]*([^\r\n]*)/gim), (match) => match[1].trim()).filter(Boolean);
  const descriptions = Array.from(text.matchAll(/^\s*Research universe:[ \t]*([^\r\n]*)/gim), (match) => match[1].trim()).filter(Boolean);
  const malformedDeclarations = declarations.filter((value) => normalizeResearchSymbols(value).length === 0);
  const stored = source.researchSymbols;
  const hasStored = stored != null && stored !== "" && !(Array.isArray(stored) && stored.length === 0);
  const normalized = normalizeResearchSymbols(stored as string | string[] | undefined);
  const symbolsWithheld = (hasStored && normalized.length === 0) || malformedDeclarations.length > 0
    || source.researchUniverseNeedsReview === true;
  const researchUniverse = clean(source.researchUniverse) || descriptions.join("\n")
    || malformedDeclarations.join("\n")
    // Only a still-intact raw string can recover a lost descriptive field.
    // An array of uppercased fragments cannot reconstruct the operator's prose.
    || (typeof stored === "string" && hasStored && normalized.length === 0 ? stored.trim() : "");
  return {
    researchSymbols: symbolsWithheld ? [] : hasStored ? normalized : normalizeResearchSymbols(declarations.flatMap((value) => normalizeResearchSymbols(value))),
    researchUniverse,
    symbolsWithheld,
  };
}

export function normalizeCapitalThesisDetails(input: CapitalThesisDetailsInput | null | undefined): CapitalThesisDetails {
  return {
    belief: clean(input?.belief),
    evidence: clean(input?.evidence),
    seeks: clean(input?.seeks),
    avoids: clean(input?.avoids),
    horizon: clean(input?.horizon),
    holdingPeriod: holdingPeriod(input?.holdingPeriod),
    invalidation: clean(input?.invalidation),
    risk: clean(input?.risk),
    researchSymbols: normalizeResearchSymbols(input?.symbols),
    researchUniverse: clean(input?.researchUniverse),
    instrumentPreference: instrument(input?.instrument),
  };
}

export function buildCapitalThesisCompilationFields(details: CapitalThesisDetails) {
  return {
    compiledFilters: {
      holdingPeriod: details.holdingPeriod,
      instrumentPreference: details.instrumentPreference,
      researchSymbols: details.researchSymbols,
      researchUniverse: details.researchUniverse,
      capitalTradeDetails: {
        belief: details.belief,
        seeks: details.seeks,
        avoids: details.avoids,
        horizon: details.horizon,
        risk: details.risk,
      },
    },
    evidenceRequirements: details.evidence ? [details.evidence] : [],
    autoDisqualifiers: details.invalidation ? [details.invalidation] : [],
  };
}

type CanonicalFields = {
  compiledFilters?: unknown;
  evidenceRequirements?: unknown;
  autoDisqualifiers?: unknown;
};

type CanonicalRecord = CanonicalFields & {
  thesisText?: unknown;
};

const record = (value: unknown): Record<string, unknown> => {
  if (typeof value === "string") {
    try { return record(JSON.parse(value)); } catch { return {}; }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
};

const stringArray = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
  : [];

/** Read only operator-declared Capital fields from the canonical receipt. */
export function detailsFromCanonicalFields(source: CanonicalFields): CapitalThesisDetails {
  const filters = record(source.compiledFilters);
  const scope = repairCapitalThesisResearchScope(filters);
  const detail = filters.capitalTradeDetails && typeof filters.capitalTradeDetails === "object"
    ? filters.capitalTradeDetails as Record<string, unknown>
    : {};
  return { ...normalizeCapitalThesisDetails({
    belief: clean(detail.belief),
    evidence: stringArray(source.evidenceRequirements)[0] ?? "",
    seeks: clean(detail.seeks),
    avoids: clean(detail.avoids),
    horizon: clean(detail.horizon),
    holdingPeriod: holdingPeriod(filters.holdingPeriod),
    invalidation: stringArray(source.autoDisqualifiers)[0] ?? "",
    risk: clean(detail.risk),
    symbols: scope.researchSymbols,
    researchUniverse: scope.researchUniverse,
    instrument: instrument(filters.instrumentPreference),
  }), researchUniverseNeedsReview: scope.symbolsWithheld && !scope.researchUniverse };
}

const NON_SYMBOL_ACRONYMS = new Set([
  "ADV", "AI", "API", "BLS", "CEO", "CPI", "EPS", "ET", "ETF", "FINRA",
  "FOMC", "GDP", "NFL", "NYSE", "OCC", "OPRA", "PCE", "SEC", "USD", "VWAP",
]);

/**
 * Recover only symbol declarations that are explicit in legacy free-text
 * canonical theses. This intentionally avoids broad all-caps extraction so
 * market terms such as VWAP, BLS, and ET cannot become research securities.
 */
export function extractDeclaredResearchSymbols(rawText: string): string[] {
  const candidates: string[] = [];
  const patterns = [
    /\$\s*([A-Z][A-Z0-9.-]{0,9})\b/g,
    /\b(?:long|short|buy|sell|research|compare|trade)\s+(?:a\s+|an\s+|the\s+)?(?:long\s+|short\s+|bullish\s+|bearish\s+)?([A-Z][A-Z0-9.-]{0,9})\b/g,
    /\b([A-Z][A-Z0-9.-]{0,9})\s+(?:shares?|stock|equity|options?|calls?|puts?|is\s+(?:above|below))\b/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(rawText)) !== null) {
      const symbol = match[1]?.toUpperCase();
      if (symbol && !NON_SYMBOL_ACRONYMS.has(symbol)) candidates.push(symbol);
    }
  }
  return normalizeResearchSymbols(candidates);
}

function firstDeclaredClause(rawText: string, pattern: RegExp): string {
  return rawText.match(pattern)?.[0]?.trim() ?? "";
}

/**
 * Canonical rows created before structured Capital authoring keep the operator's
 * declarations in `thesisText`. Fill only missing structured fields from exact
 * clauses in that text; never ask a model to reinterpret the historical receipt.
 */
export function detailsFromCanonicalRecord(source: CanonicalRecord): CapitalThesisDetails {
  const structured = detailsFromCanonicalFields(source);
  const thesisText = clean(source.thesisText);
  if (!thesisText) return structured;
  const scope = repairCapitalThesisResearchScope(record(source.compiledFilters), thesisText);

  const defaults = extractCapitalMissionDefaults(thesisText);
  const explicitShares = /\b(?:shares?\s+only|share\s+expression\s+only|long\s+[A-Z][A-Z0-9.-]{0,9}\s+share\s+expression)\b/i.test(thesisText);
  const explicitOptions = /\b(?:options?\s+only|defined-risk options?|long\s+(?:call|put)|buy\s+(?:a\s+)?(?:call|put))\b/i.test(thesisText);
  const inferredInstrument: CapitalMissionInstrument | null = explicitShares
    ? "shares"
    : explicitOptions
      ? "options"
      : defaults.instrumentPreference;
  const inferredHoldingPeriod: CapitalMissionHoldingPeriod | null = defaults.holdingPeriod
    ?? (/\bintraday\b/i.test(thesisText) ? "intraday" : null);

  const evidence = firstDeclaredClause(thesisText, /\bonly if\s+[^.!?]+(?:[.!?]|$)/i);
  const invalidation = firstDeclaredClause(thesisText, /\b(?:preserve cash|invalidate|do not enter|skip)\s+[^.!?]+(?:[.!?]|$)/i);
  const seeks = firstDeclaredClause(thesisText, /\bresearch\s+[^.!?]+(?:[.!?]|$)/i);
  const risk = firstDeclaredClause(thesisText, /\b(?:use|deploy)[^.!?]*(?:maximum|max(?:imum)?)[^.!?]*(?:planned[- ]loss|loss)[^.!?]*(?:[.!?]|$)/i);
  const horizon = firstDeclaredClause(thesisText, /\b[^.!?]*(?:intraday|overnight|this week|long[- ]term|multi[- ]month|catalyst window)[^.!?]*(?:[.!?]|$)/i);

  return { ...normalizeCapitalThesisDetails({
    belief: structured.belief,
    evidence: structured.evidence || evidence,
    seeks: structured.seeks || seeks,
    avoids: structured.avoids,
    horizon: structured.horizon || horizon,
    holdingPeriod: structured.holdingPeriod ?? inferredHoldingPeriod,
    invalidation: structured.invalidation || invalidation,
    risk: structured.risk || risk,
    researchUniverse: scope.researchUniverse,
    symbols: scope.symbolsWithheld ? [] : scope.researchSymbols.length > 0
      ? scope.researchSymbols
      : scope.researchUniverse ? [] : extractDeclaredResearchSymbols(thesisText),
    instrument: structured.instrumentPreference ?? inferredInstrument,
  }), researchUniverseNeedsReview: scope.symbolsWithheld && !scope.researchUniverse };
}
