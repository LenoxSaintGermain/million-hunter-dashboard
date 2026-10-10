/**
 * Plain-language wording for the Performance page. Pure, so the sentences a tester
 * reads are covered by tests. Unmeasured values never read as zero, and plan outcomes
 * are always called plan outcomes, never a forecast.
 */

const whole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fine = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const NOT_MEASURED = "Not measured";

export const dollars = (cents: number | null | undefined) => cents == null || !Number.isFinite(cents) ? NOT_MEASURED : whole.format(cents / 100);
export const price = (cents: number | null | undefined) => cents == null || !Number.isFinite(cents) ? NOT_MEASURED : fine.format(cents / 100);
export const signedDollars = (cents: number | null | undefined) => {
  if (cents == null || !Number.isFinite(cents)) return NOT_MEASURED;
  return `${cents < 0 ? "−" : "+"}${whole.format(Math.abs(cents) / 100)}`;
};
export const signedR = (r: number | null | undefined) => r == null || !Number.isFinite(r) ? NOT_MEASURED : `${r < 0 ? "−" : "+"}${Math.abs(r).toFixed(2)}R`;

const upDown = (cents: number) => (cents < 0 ? `down ${dollars(Math.abs(cents))}` : `up ${dollars(cents)}`);

export interface HeadlineCopyInput {
  equityCents: number | null;
  thisWeekCents: number | null;
  sinceStartCents: number | null;
  startingCents: number | null;
}

export function quickHeadline(h: HeadlineCopyInput): string {
  if (h.equityCents == null) return "Your account value hasn't been measured yet. Sync your account to save the first point.";
  const worth = `Your account is worth ${dollars(h.equityCents)}.`;
  const parts: string[] = [];
  if (h.thisWeekCents != null) parts.push(`${upDown(h.thisWeekCents)} this week`);
  if (h.sinceStartCents != null) {
    parts.push(`${h.thisWeekCents != null && (h.thisWeekCents < 0) === (h.sinceStartCents < 0) ? upDown(h.sinceStartCents).replace(/^(up|down) /, "") : upDown(h.sinceStartCents)} since you started${h.startingCents != null ? ` with ${dollars(h.startingCents)}` : ""}`);
  }
  if (!parts.length) return `${worth} Changes show after your next saved sync.`;
  const lead = `You're ${parts.join(" and ")}.`;
  return `${lead} ${worth}`;
}

export function lockedInLine(realizedCents: number | null, unrealizedCents: number | null, closedCount: number): string | null {
  const bits: string[] = [];
  if (realizedCents != null && closedCount > 0) bits.push(`${dollars(Math.abs(realizedCents))} ${realizedCents < 0 ? "was lost" : "of that is locked in"} from plays you closed.`);
  if (unrealizedCents != null) bits.push(`${dollars(Math.abs(unrealizedCents))} is ${unrealizedCents < 0 ? "a paper loss" : "on paper"} in plays still open, and can still change.`);
  return bits.length ? bits.join(" ") : null;
}

export function planOutcomeSentence(atStopCents: number | null, atTargetCents: number | null): string {
  if (atStopCents == null || atTargetCents == null) return "Plan outcomes need a stop and a price on at least one open play.";
  return `If every open play hits its stop, you'd be ${upDown(atStopCents)} from here. If every one reaches its target, you'd be ${upDown(atTargetCents)} from here.`;
}

export function planCaveat(uncountedSymbols: string[]): string {
  const base = "These are the stops and targets you planned, not a forecast. Prices can jump past a stop, so a real loss can be bigger.";
  if (!uncountedSymbols.length) return base;
  const names = uncountedSymbols.join(", ");
  return `${base} ${uncountedSymbols.length === 1 ? `One holding (${names}) has` : `${uncountedSymbols.length} holdings (${names}) have`} no stop or target saved, so ${uncountedSymbols.length === 1 ? "it isn't" : "they aren't"} counted.`;
}

export interface ClosedCopyInput { closed: number; wins: number; avgWinCents: number | null; avgLossCents: number | null; avgR: number | null }

export function closedHeading(c: ClosedCopyInput): string {
  return c.closed === 0 ? "No closed plays yet" : `${c.wins} of ${c.closed} made money`;
}

export function closedSentence(c: ClosedCopyInput): string | null {
  if (c.closed === 0) return null;
  const parts: string[] = [];
  if (c.avgWinCents != null && c.avgLossCents != null) parts.push(`Your wins averaged ${dollars(c.avgWinCents)} and your losses averaged ${dollars(c.avgLossCents)}.`);
  else if (c.avgWinCents != null) parts.push(`Your wins averaged ${dollars(c.avgWinCents)}. You have no losing plays yet.`);
  else if (c.avgLossCents != null) parts.push(`Your losses averaged ${dollars(c.avgLossCents)}. You have no winning plays yet.`);
  if (c.avgR != null) parts.push(c.avgR >= 0 ? `On average a play made ${c.avgR.toFixed(1)}× what you planned to risk on it.` : `On average a play lost ${Math.abs(c.avgR).toFixed(1)}× what you planned to risk on it.`);
  return parts.join(" ") || null;
}

export function sampleNote(closed: number, sample: "process_only" | "indicative" | "edge_capable"): string | null {
  if (closed === 0) return null;
  if (sample === "process_only") return `${closed} closed ${closed === 1 ? "play is" : "plays are"} too few to tell skill from luck. Treat this as a record of how you followed your plan.`;
  if (sample === "indicative") return `${closed} closed plays is an early read, not proof of an edge.`;
  return `${closed} closed plays is a meaningful sample, still a record of paper results.`;
}

export const PERFORMANCE_FOOTER = "Practice account. Results are from saved syncs and recorded fills, not live prices. Plan outcomes show what your own stops and targets would mean; they are not a forecast or a promise.";
