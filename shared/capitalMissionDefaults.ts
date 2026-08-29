import { easternDateTimeInputToEpoch } from "./easternMarketTime";

export type CapitalMissionHoldingPeriod = "intraday" | "overnight" | "swing" | "catalyst_window" | "position";
export type CapitalMissionInstrument = "shares" | "options" | "either";

export type CapitalMissionDefaults = {
  deployableCapitalCents: number | null;
  desiredEndingValueCents: number | null;
  maxPlannedLossCents: number | null;
  holdingPeriod: CapitalMissionHoldingPeriod | null;
  instrumentPreference: CapitalMissionInstrument | null;
  catalystAt: number | null;
  catalystLabel: string | null;
  eligibilityReviewAt: number | null;
  outcomeReviewAt: number | null;
  source: "declared" | "unknown";
  warnings: string[];
};

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function moneyCents(value: string | undefined): number | null {
  if (!value) return null;
  const amount = Number(value.replace(/,/g, ""));
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null;
}

function declaredDate(text: string): string | null {
  const match = new RegExp(`\\b(${Object.keys(MONTHS).join("|")})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b`, "i").exec(text);
  if (!match) return null;
  return `${match[3]}-${String(MONTHS[match[1].toLowerCase()]).padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function timeOnDate(date: string | null, match: RegExpMatchArray | null, defaultMeridiem: "am" | "pm" | null = null): number | null {
  if (!date || !match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const meridiem = match[3]?.toLowerCase().replace(/\./g, "") ?? defaultMeridiem;
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return easternDateTimeInputToEpoch(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
}

function firstTime(text: string, patterns: RegExp[]): RegExpMatchArray | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match;
  }
  return null;
}

function declaredCatalystLabel(text: string): string | null {
  const protectedTimes = text
    .replace(/\ba\.m\./gi, (value) => value.replace(/\./g, "__DOT__"))
    .replace(/\bp\.m\./gi, (value) => value.replace(/\./g, "__DOT__"));
  const catalystLanguage = /\bcatalyst\b|\b(?:revision|ruling|regulation|regulatory|football season|nfl season|season opener|kickoff)\b|\b(?:report|announcement|release|decision|earnings)\b[^.!?]{0,80}\b(?:scheduled|due|catalyst|window|at\s+\d{1,2}|on\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?))\b/i;
  const negatedCatalyst = /\b(?:no|not|without|avoid(?:s|ed|ing)?|exclude(?:s|d|ing)?|lacks?|missing|unknown|unverified|undeclared)\b[^.!?]{0,64}\b(?:catalyst|revision|report|announcement|ruling|regulation|regulatory|release|decision|football season|nfl season|season opener|kickoff|earnings)\b|\b(?:catalyst|revision|report|announcement|ruling|regulation|regulatory|release|decision|football season|nfl season|season opener|kickoff|earnings)\b[^.!?]{0,48}\b(?:not|avoid(?:s|ed|ing)?|exclude(?:s|d|ing)?|missing|unknown|unverified|undeclared)\b/i;
  const declarations = protectedTimes
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/__DOT__/g, ".").trim().replace(/[.!?]+$/, ""))
    .filter((sentence) => sentence.length > 0
      && !/^(?:do not|don't|never|no\b|avoid\b|exclude\b)/i.test(sentence)
      && !negatedCatalyst.test(sentence)
      && catalystLanguage.test(sentence));

  return declarations.length > 0 ? declarations.slice(0, 2).join(" · ") : null;
}

/**
 * Extract only terms the operator explicitly declared in the thesis. This is a
 * deterministic bridge into Capital Mission, not a model-generated forecast.
 * Unstated values remain null so the UI cannot resurrect values from a prior run.
 */
export function extractCapitalMissionDefaults(rawText: string): CapitalMissionDefaults {
  const text = rawText.trim();
  const date = declaredDate(text);
  const deployableCapitalCents = moneyCents(text.match(/(?:at most|up to|deploy(?:ing)?|capital(?: available)?)\s+\$([\d,]+(?:\.\d{1,2})?)(?:\s+(?:of\s+)?notional|\s+notional)?/i)?.[1]);
  const desiredEndingValueCents = moneyCents(text.match(/desired ending value(?:\s+(?:is|of))?\s+\$([\d,]+(?:\.\d{1,2})?)/i)?.[1]);
  const maxPlannedLossCents = moneyCents(text.match(/\$([\d,]+(?:\.\d{1,2})?)\s+(?:maximum|max(?:imum)?|hard)?\s*planned[- ]loss/i)?.[1]
    ?? text.match(/(?:maximum|max(?:imum)?|hard)\s+planned[- ]loss(?:\s+(?:of|is))?\s+\$([\d,]+(?:\.\d{1,2})?)/i)?.[1]);

  const catalystAt = timeOnDate(date, firstTime(text, [
    /(?:revision|release|report|announcement|decision|catalyst)\s+(?:is\s+)?(?:at|due at|scheduled for)\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*(?:ET|Eastern)?/i,
  ]));
  const catalystLabel = declaredCatalystLabel(text);
  const eligibilityReviewAt = timeOnDate(date, firstTime(text, [
    /(?:do not enter|no entry|wait|eligible|eligibility)[^.!?]{0,60}?before\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i,
    /(?:review|verify|recheck)\s+(?:at|after)\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i,
  ]));
  // In a US regular-session thesis, "close by 3:45 ET" names an afternoon
  // close-out. Preserve an explicit a.m./p.m. when supplied; only the
  // close/exit/flatten grammar receives this deterministic p.m. default.
  const outcomeReviewAt = timeOnDate(date, firstTime(text, [
    /(?:close|exit|flatten|record(?: the)? outcome)\s+(?:by|at|after)\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i,
  ]), "pm");

  const instrumentPreference: CapitalMissionInstrument | null = /\b(?:shares|equity)\s+only\b/i.test(text) || /\bshare play\b/i.test(text)
    ? "shares"
    : /\boptions?\s+only\b/i.test(text) || /\bdefined-risk options?\b/i.test(text)
      ? "options"
      : /\b(?:shares|equity)\b/i.test(text) && /\boptions?\b/i.test(text)
        ? "either"
        : null;

  const holdingPeriod: CapitalMissionHoldingPeriod | null = outcomeReviewAt && date
    ? "intraday"
    : /\bovernight\b|\bnext (?:market )?close\b/i.test(text)
      ? "overnight"
      : /\bthis week\b|\bwithin (?:the next )?\d+ (?:trading )?days?\b/i.test(text)
        ? "swing"
        : /\blong[- ]term\b|\bmulti[- ]month\b|\bposition trade\b|\bLEAPS?\b/i.test(text)
          ? "position"
          : catalystAt || /\bcatalyst window\b/i.test(text)
          ? "catalyst_window"
          : null;

  const hasDeclaredValue = [
    deployableCapitalCents,
    desiredEndingValueCents,
    maxPlannedLossCents,
    holdingPeriod,
    instrumentPreference,
    catalystAt,
    catalystLabel,
    eligibilityReviewAt,
    outcomeReviewAt,
  ].some((value) => value != null);
  const warnings: string[] = [];
  if (catalystLabel && !catalystAt) {
    warnings.push("Catalyst was declared, but its date and time were not normalized.");
  } else if (!date && !catalystAt && !eligibilityReviewAt && !outcomeReviewAt) {
    warnings.push("No dated catalyst or review point was declared.");
  }

  return {
    deployableCapitalCents,
    desiredEndingValueCents,
    maxPlannedLossCents,
    holdingPeriod,
    instrumentPreference,
    catalystAt,
    catalystLabel,
    eligibilityReviewAt,
    outcomeReviewAt,
    source: hasDeclaredValue ? "declared" : "unknown",
    warnings,
  };
}

type StructuredCapitalMissionDefaults = {
  holdingPeriod?: unknown;
  instrumentPreference?: unknown;
};

const HOLDING_PERIODS: CapitalMissionHoldingPeriod[] = ["intraday", "overnight", "swing", "catalyst_window", "position"];
const INSTRUMENTS: CapitalMissionInstrument[] = ["shares", "options", "either"];

/**
 * Resolve mission defaults without allowing narrative parsing to overwrite
 * fields the operator already saved as structured thesis data.
 */
export function resolveCapitalMissionDefaults(
  rawText: string,
  structured?: StructuredCapitalMissionDefaults | null,
): CapitalMissionDefaults {
  const inferred = extractCapitalMissionDefaults(rawText);
  const holdingPeriod = typeof structured?.holdingPeriod === "string"
    && HOLDING_PERIODS.includes(structured.holdingPeriod as CapitalMissionHoldingPeriod)
    ? structured.holdingPeriod as CapitalMissionHoldingPeriod
    : inferred.holdingPeriod;
  const instrumentPreference = typeof structured?.instrumentPreference === "string"
    && INSTRUMENTS.includes(structured.instrumentPreference as CapitalMissionInstrument)
    ? structured.instrumentPreference as CapitalMissionInstrument
    : inferred.instrumentPreference;

  return {
    ...inferred,
    holdingPeriod,
    instrumentPreference,
    source: holdingPeriod != null || instrumentPreference != null ? "declared" : inferred.source,
  };
}
