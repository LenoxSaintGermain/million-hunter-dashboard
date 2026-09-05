export const PAPER_INSTRUMENT_TYPES = ["shares", "long_call", "long_put"] as const;
export type PaperInstrumentType = typeof PAPER_INSTRUMENT_TYPES[number];

export interface OptionContractTerms {
  instrumentType: "long_call" | "long_put";
  underlyingSymbol: string;
  expirationDate: string;
  strikePriceCents: number;
  contractMultiplier: number;
  contractSymbol: string;
}

export interface PaperInstrumentInput {
  instrumentType?: PaperInstrumentType | null;
  symbol: string;
  underlyingSymbol?: string | null;
  optionExpirationDate?: string | null;
  optionStrikePriceCents?: number | null;
  contractMultiplier?: number | null;
  qty?: number | null;
  entryPriceCents?: number | null;
  slippageCents?: number | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const OCC_SYMBOL = /^([A-Z]{1,6})(\d{6})([CP])(\d{8})$/;

export function normalizeUnderlyingSymbol(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9.]/g, "");
}

export function isOptionInstrument(value: unknown): value is "long_call" | "long_put" {
  return value === "long_call" || value === "long_put";
}

/** Pick a valid standard monthly (third-Friday) expiration. */
export function nextStandardMonthlyOptionExpiration(now = Date.now(), minimumDays = 75): string {
  const threshold = new Date(now + minimumDays * 86_400_000);
  threshold.setUTCHours(0, 0, 0, 0);

  let year = threshold.getUTCFullYear();
  let month = threshold.getUTCMonth();
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const first = new Date(Date.UTC(year, month, 1));
    const firstFriday = 1 + ((5 - first.getUTCDay() + 7) % 7);
    const thirdFriday = new Date(Date.UTC(year, month, firstFriday + 14));
    if (thirdFriday >= threshold) return thirdFriday.toISOString().slice(0, 10);
    month += 1;
    if (month === 12) { month = 0; year += 1; }
  }

  throw new Error("Unable to determine a standard monthly option expiration.");
}

export function buildOccOptionSymbol(input: {
  underlyingSymbol: string;
  expirationDate: string;
  optionType: "call" | "put";
  strikePriceCents: number;
}): string | null {
  const root = normalizeUnderlyingSymbol(input.underlyingSymbol);
  if (!/^[A-Z]{1,6}$/.test(root) || !ISO_DATE.test(input.expirationDate)) return null;
  const date = new Date(`${input.expirationDate}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.expirationDate) return null;
  if (!Number.isInteger(input.strikePriceCents) || input.strikePriceCents <= 0) return null;
  const strikeThousandths = input.strikePriceCents * 10;
  if (!Number.isSafeInteger(strikeThousandths) || strikeThousandths > 99_999_999) return null;
  const yymmdd = input.expirationDate.slice(2).replaceAll("-", "");
  return `${root}${yymmdd}${input.optionType === "call" ? "C" : "P"}${String(strikeThousandths).padStart(8, "0")}`;
}

export function parseOccOptionSymbol(symbol: string): OptionContractTerms | null {
  const normalized = symbol.trim().toUpperCase();
  const match = OCC_SYMBOL.exec(normalized);
  if (!match) return null;
  const [, root, yymmdd, right, strike] = match;
  const expirationDate = `20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
  const rebuilt = buildOccOptionSymbol({
    underlyingSymbol: root,
    expirationDate,
    optionType: right === "C" ? "call" : "put",
    strikePriceCents: Number(strike) / 10,
  });
  if (rebuilt !== normalized) return null;
  return {
    instrumentType: right === "C" ? "long_call" : "long_put",
    underlyingSymbol: root,
    expirationDate,
    strikePriceCents: Number(strike) / 10,
    contractMultiplier: 100,
    contractSymbol: normalized,
  };
}

export function optionPremiumAtRiskCents(input: Pick<PaperInstrumentInput, "instrumentType" | "qty" | "entryPriceCents" | "slippageCents" | "contractMultiplier">): number | null {
  if (!isOptionInstrument(input.instrumentType)) return null;
  const qty = input.qty;
  const premium = input.entryPriceCents;
  const slippage = input.slippageCents ?? 0;
  const multiplier = input.contractMultiplier ?? 100;
  if (!Number.isInteger(qty) || qty == null || qty <= 0) return null;
  if (premium == null || premium <= 0 || slippage < 0) return null;
  if (!Number.isInteger(multiplier) || multiplier <= 0) return null;
  return Math.round(qty * multiplier * (premium + slippage));
}

export function validatePaperInstrument(input: PaperInstrumentInput, now = Date.now()): {
  instrumentType: PaperInstrumentType;
  failures: string[];
  optionTerms: OptionContractTerms | null;
} {
  const instrumentType = input.instrumentType ?? "shares";
  if (!isOptionInstrument(instrumentType)) {
    return { instrumentType: "shares", failures: [], optionTerms: null };
  }

  const failures: string[] = [];
  const underlyingSymbol = normalizeUnderlyingSymbol(input.underlyingSymbol ?? "");
  const expirationDate = input.optionExpirationDate ?? "";
  const strikePriceCents = input.optionStrikePriceCents ?? 0;
  const multiplier = input.contractMultiplier ?? 100;
  const expected = buildOccOptionSymbol({
    underlyingSymbol,
    expirationDate,
    optionType: instrumentType === "long_call" ? "call" : "put",
    strikePriceCents,
  });

  if (!underlyingSymbol) failures.push("Choose the underlying ticker for this option contract.");
  if (!expected) failures.push("Expiration, strike, or underlying cannot form a valid OCC option symbol.");
  if (expected && input.symbol.trim().toUpperCase() !== expected) failures.push(`Contract symbol must match the declared terms (${expected}).`);
  if (!Number.isInteger(input.qty) || (input.qty ?? 0) <= 0) failures.push("Options quantity must be a whole number of contracts.");
  if (multiplier !== 100) failures.push("Only standard 100-share option contracts are supported in this paper flow.");
  const expiryAt = ISO_DATE.test(expirationDate) ? Date.parse(`${expirationDate}T20:00:00Z`) : Number.NaN;
  if (!Number.isFinite(expiryAt) || expiryAt <= now) failures.push("Option expiration must be in the future.");

  return {
    instrumentType,
    failures,
    optionTerms: expected ? {
      instrumentType,
      underlyingSymbol,
      expirationDate,
      strikePriceCents,
      contractMultiplier: multiplier,
      contractSymbol: expected,
    } : null,
  };
}

export function paperInstrumentLabel(input: Pick<PaperInstrumentInput, "instrumentType" | "symbol" | "underlyingSymbol" | "optionExpirationDate" | "optionStrikePriceCents">): string {
  if (!isOptionInstrument(input.instrumentType)) return `${input.symbol.toUpperCase()} shares`;
  const right = input.instrumentType === "long_call" ? "call" : "put";
  const strike = input.optionStrikePriceCents == null ? "—" : `$${(input.optionStrikePriceCents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `${normalizeUnderlyingSymbol(input.underlyingSymbol ?? input.symbol)} ${input.optionExpirationDate ?? "—"} ${strike} ${right}`;
}

/** Human-first contract identity for decision surfaces; raw OCC stays secondary. */
export function paperInstrumentDisplayLabel(input: Pick<PaperInstrumentInput, "instrumentType" | "symbol" | "underlyingSymbol" | "optionExpirationDate" | "optionStrikePriceCents">): string {
  if (!isOptionInstrument(input.instrumentType)) return `${normalizeUnderlyingSymbol(input.symbol)} shares`;
  const parsed = parseOccOptionSymbol(input.symbol);
  const underlying = normalizeUnderlyingSymbol(input.underlyingSymbol ?? parsed?.underlyingSymbol ?? input.symbol);
  const expirationDate = input.optionExpirationDate ?? parsed?.expirationDate ?? null;
  const strikePriceCents = input.optionStrikePriceCents ?? parsed?.strikePriceCents ?? null;
  const right = input.instrumentType === "long_call" ? "Call" : "Put";
  const strike = strikePriceCents == null
    ? "Strike not recorded"
    : `$${(strikePriceCents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const expiration = expirationDate == null
    ? "Expiration not recorded"
    : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${expirationDate}T00:00:00Z`));
  return `${underlying} · ${strike} ${right} · ${expiration}`;
}
