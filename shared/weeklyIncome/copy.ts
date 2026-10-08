/**
 * Weekly Income (#82, #87) copy library. Display text only: nothing here
 * changes a gate, a limit, or stored state.
 *
 * Voice follows docs/CAPITAL_APERTURE_LANGUAGE_LIBRARY.md. Guided mode speaks
 * Main Street English: every trading term is either avoided or explained in one
 * plain line where it first appears. No string may promise or imply a return.
 */
import { PROHIBITED_LANGUAGE } from "../disclosure";

/**
 * Income-hype words that `wi.*` copy must never use. Applies to Weekly Income
 * copy only; it does not change disclosure behaviour.
 */
export const INCOME_HYPE_LANGUAGE = /\b(pay\s*-?\s*checks?|guarantee[sd]?|guaranteeing|risk[\s-]*free|passive\s+income|safe|safely|sure\s+thing|can'?t\s+lose)\b/i;

export const WI_COPY = {
  // ── §14 keys (thesis spec) ─────────────────────────────────────────────────
  "wi.thesis.title": "Weekly Income: defined-risk premium selling (practice)",
  "wi.thesis.oneLiner": "Collect option premium one week at a time, with the most you can lose set before you start.",
  "wi.thesis.noTarget": "This plan doesn't aim for a return. It measures what premium selling collects against what it puts at risk.",
  "wi.play.p1": "Put credit spread: you're paid now for agreeing that {symbol} stays above {shortStrike} until {expiration}. The most you can lose is {maxLoss}.",
  "wi.play.p2": "Cash-secured put: you're paid now for agreeing to buy {symbol} at {strike}. You set aside {securedCash}. If {symbol} falls a lot, you lose like a shareholder would, less the payment.",
  "wi.play.p3": "Covered call: you're paid now for agreeing to sell your {symbol} shares at {strike}. If {symbol} rises above that, you give up the extra gain.",
  "wi.risk.p1": "Maximum loss {maxLoss} ({pctEquity} of account value).",
  "wi.risk.p2": "Planned loss at the stop: {plannedLoss}. Execution can differ. If {symbol} opened {gapPct} below the strike, the loss would be about {gapLoss}.",
  "wi.risk.p3": "No new downside. Your shares' existing risk is unchanged. Upside above {capPrice} is given up until {expiration}.",
  "wi.sizing.skip": "One contract would exceed your {limitName} ({limitValue}). This week's idea is skipped. Nothing was changed to make it fit.",
  "wi.mgmt.plan": "Plan to close at {takeProfitPrice} (half the credit kept), at {stopPrice} (a loss of about one credit), or by {timeExit}, whichever comes first.",
  "wi.mgmt.noRoll": "Rolling isn't available in this version. Close the position, record the result, and review next week.",
  "wi.week.limitHit": "This week's loss reached your weekly limit ({limit}). New ideas resume Monday. Closing positions still works.",
  "wi.week.empty": "No idea met every rule this week. Waiting is a valid result.",
  "wi.scorecard.headline": "Return on account this week: {weekReturn}. Premium kept: {netPremium} on {capitalAtRisk} at risk.",
  "wi.scorecard.annualized": "{weekReturn} for one week is {simpleAnnual} a year if multiplied by 52, or {compoundAnnual} compounded. That's arithmetic, not a forecast.",
  "wi.scorecard.sample": "{n} closed positions. This is process evidence, not enough to show an edge or an expected return.",
  "wi.paper.fidelity": "Practice fills use the best quoted price without checking size. Dividends and early assignment aren't simulated. Assignment records post the next day.",
  "wi.halt": "Weekly Income is halted. New ideas are blocked until the owner lifts the halt. Closing positions still works.",
  "wi.math.sixPercent": "6% a week compounds to about 20.7 times your starting amount in a year. Published weekly put-selling research shows about 0.7% average weekly premium on the S&P 500 before losses.",

  // ── Guided mode (Main Street) ──────────────────────────────────────────────
  "wi.guided.eyebrow": "Weekly Income · practice money",
  "wi.guided.headline": "Get paid up front for a promise about a stock's price, with a floor on what you can lose.",
  "wi.guided.howItWorks": "You get paid up front to agree to buy a stock you like at a lower price. You also buy a cheaper agreement a little lower down. That second agreement is the floor: it fixes the most you can lose before you start.",
  "wi.guided.p1": "You get paid {credit} now for agreeing to buy {symbol} at {shortStrike} if it falls that far by {expiration}. You also pay for a floor at {longStrike}, so the most you can lose is {maxLoss}.",
  "wi.guided.noTarget": "This plan doesn't aim for a return. It measures what these up-front payments add up to against what they put at risk.",
  "wi.guided.closeEarly": "We plan to close every position before expiration day, so you aren't expected to end up owning the shares.",
  "wi.guided.keep": "If {symbol} stays above {shortStrike}, you keep the payment. The plan closes early once you've kept {keepAtTakeProfit}.",
  "wi.guided.maxLoss": "Most you can lose: {maxLoss}",
  "wi.guided.maxLossDetail": "That's {structuralMaxLoss} from the spread itself plus a {allowance} allowance for trading costs. Real fills can differ slightly.",
  "wi.guided.breakeven": "You start losing money if {symbol} ends below {breakeven} (the promise price minus what you were paid).",
  "wi.guided.whatCanGoWrong": "What can go wrong: if {symbol} drops below {longStrike}, you lose the full {maxLoss}. One full loss erases about {takeProfitsErased} trades that each kept {keepAtTakeProfit}.",
  "wi.guided.gapRisk": "A sudden drop can jump past the planned exit, so a loss can be bigger than the planned {lossAtStop}. The floor still caps it at {maxLoss}.",
  "wi.guided.plan": "The plan closes it early, whichever comes first: once you've kept {keepAtTakeProfit}, once the loss reaches about {lossAtStop}, or by {timeExit}.",
  "wi.guided.noPromise": "This uses simulated money. It doesn't aim for a weekly return, and practice results don't predict future ones.",
  "wi.guided.example.label": "Example data",
  "wi.guided.example.note": "Hypothetical stock XYZ. These are not market quotes and not results. No order was placed or prepared.",
  "wi.guided.spreadsOnly": "This version uses only the floor-protected version (a put credit spread). Selling a put without a floor, or selling calls against shares, isn't available here.",
  "wi.guided.cspNotAvailable": "Selling a put without a floor (a cash-secured put) has no floor under it: if the stock falls a lot, you lose like a shareholder would. It stays off until the owner decides how its loss is counted.",
  "wi.guided.wordsHeading": "Words used here, in plain English",
} as const;

export type WiCopyKey = keyof typeof WI_COPY;

/**
 * Plain-English one-liners for every trading term Guided mode shows. The rule:
 * no jargon without a one-line plain explanation next to it.
 */
export const WI_GLOSSARY = [
  { term: "Option", plain: "A contract that gives someone the right to buy or sell 100 shares at a set price until a set date." },
  { term: "Put", plain: "An option that lets its buyer sell 100 shares at the set price. If you sell a put, you're the one agreeing to buy." },
  { term: "Strike price", plain: "The set price written into the option." },
  { term: "Expiration", plain: "The last day the option exists. This plan closes the day before." },
  { term: "Premium (credit)", plain: "The money you're paid up front for making the promise. It's yours to keep if the promise isn't called on." },
  { term: "Put credit spread", plain: "Selling one put and buying a cheaper, lower one at the same time. You collect the difference, and the lower put sets a floor on your loss." },
  { term: "Spread width", plain: "The gap between the two strike prices. It, minus what you were paid, is the most you can lose per share." },
  { term: "Maximum loss", plain: "The most this position can lose, in dollars, worked out before you start." },
  { term: "Breakeven", plain: "The stock price where you neither make nor lose money at expiration." },
  { term: "Collateral", plain: "Money set aside while the position is open, equal to the most it can lose. You can't use it for anything else until it closes." },
  { term: "Delta", plain: "A rough market-implied chance the option ends up worth paying out. 0.20 is roughly a 1-in-5 chance." },
  { term: "Days to expiration", plain: "How many calendar days until the option expires. This plan uses 4 to 10." },
  { term: "Open interest", plain: "How many of these contracts already exist. More means it's easier to get out later." },
  { term: "Bid/ask spread", plain: "The gap between what buyers offer and sellers ask. A wide gap costs you money to get in and out." },
  { term: "OPRA quote", plain: "The official, real-time price feed for US options. The plan only uses these." },
  { term: "Indicative quote", plain: "A delayed, adjusted price estimate. Not good enough to trade on, so the plan skips it." },
  { term: "Assignment", plain: "When the other side uses the option and you have to buy the shares. Closing early is how the plan avoids it." },
  { term: "Take profit", plain: "Closing early once you've kept a set share of the payment (half, by default)." },
  { term: "Stop", plain: "Closing early when a loss reaches a set size (about one payment, by default)." },
  { term: "Earnings blackout", plain: "Skipping a stock when it reports results before the trade would end, because surprise moves are larger then." },
  { term: "Ex-dividend date", plain: "The cutoff for a stock's dividend. Options near it behave differently, so the plan treats it as a blackout for calls." },
] as const;

export type WiCopyVars = Record<string, string | number>;

/** Interpolates `{name}` placeholders. A missing variable throws, so no half-filled sentence reaches the screen. */
export function wiCopy(key: WiCopyKey, vars: WiCopyVars = {}): string {
  return WI_COPY[key].replace(/\{(\w+)\}/g, (_, name: string) => {
    if (!(name in vars)) throw new Error(`Missing copy variable "${name}" for ${key}.`);
    return String(vars[name]);
  });
}

/** Every placeholder a key needs, for tests and fixture builders. */
export function wiCopyPlaceholders(key: WiCopyKey): string[] {
  return Array.from(WI_COPY[key].matchAll(/\{(\w+)\}/g), (match) => match[1]);
}

/** True when text passes both the house disclosure rule and the income-hype rule. */
export function passesWeeklyIncomeLanguage(text: string): boolean {
  return !PROHIBITED_LANGUAGE.test(text) && !INCOME_HYPE_LANGUAGE.test(text);
}
