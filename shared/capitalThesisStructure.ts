import type { CapitalMissionHoldingPeriod, CapitalMissionInstrument } from "./capitalMissionDefaults";

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
  const source = Array.isArray(value) ? value : String(value ?? "").split(/[\s,;]+/);
  return Array.from(new Set(source
    .map((symbol) => symbol.trim().toUpperCase().replace(/^\$/, ""))
    .filter((symbol) => /^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol))));
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
    instrumentPreference: instrument(input?.instrument),
  };
}

export function buildCapitalThesisCompilationFields(details: CapitalThesisDetails) {
  return {
    compiledFilters: {
      holdingPeriod: details.holdingPeriod,
      instrumentPreference: details.instrumentPreference,
      researchSymbols: details.researchSymbols,
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

const stringArray = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
  : [];

/** Read only operator-declared Capital fields from the canonical receipt. */
export function detailsFromCanonicalFields(source: CanonicalFields): CapitalThesisDetails {
  const filters = source.compiledFilters && typeof source.compiledFilters === "object"
    ? source.compiledFilters as Record<string, unknown>
    : {};
  const detail = filters.capitalTradeDetails && typeof filters.capitalTradeDetails === "object"
    ? filters.capitalTradeDetails as Record<string, unknown>
    : {};
  return normalizeCapitalThesisDetails({
    belief: clean(detail.belief),
    evidence: stringArray(source.evidenceRequirements)[0] ?? "",
    seeks: clean(detail.seeks),
    avoids: clean(detail.avoids),
    horizon: clean(detail.horizon),
    holdingPeriod: holdingPeriod(filters.holdingPeriod),
    invalidation: stringArray(source.autoDisqualifiers)[0] ?? "",
    risk: clean(detail.risk),
    symbols: stringArray(filters.researchSymbols),
    instrument: instrument(filters.instrumentPreference),
  });
}
