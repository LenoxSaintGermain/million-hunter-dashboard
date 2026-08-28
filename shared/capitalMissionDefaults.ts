import { easternDateTimeInputToEpoch } from "./easternMarketTime";

export type CapitalMissionHoldingPeriod = "intraday" | "overnight" | "swing" | "catalyst_window";
export type CapitalMissionInstrument = "shares" | "options" | "either";

export type CapitalMissionDefaults = {
  deployableCapitalCents: number | null;
  desiredEndingValueCents: number | null;
  maxPlannedLossCents: number | null;
  holdingPeriod: CapitalMissionHoldingPeriod | null;
  instrumentPreference: CapitalMissionInstrument | null;
  catalystAt: number | null;
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
    eligibilityReviewAt,
    outcomeReviewAt,
  ].some((value) => value != null);
  const warnings: string[] = [];
  if (!date && !catalystAt && !eligibilityReviewAt && !outcomeReviewAt) {
    warnings.push("No dated catalyst or review point was declared.");
  }

  return {
    deployableCapitalCents,
    desiredEndingValueCents,
    maxPlannedLossCents,
    holdingPeriod,
    instrumentPreference,
    catalystAt,
    eligibilityReviewAt,
    outcomeReviewAt,
    source: hasDeclaredValue ? "declared" : "unknown",
    warnings,
  };
}
