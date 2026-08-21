import { etClock, marketSession } from "./marketSession";

/**
 * One-time research-only proof point for the active GLP-1 thesis.
 * This is deliberately distinct from the daily outcome refresher: it may create
 * a Capital research run, but it cannot create a proposal or a broker order.
 */
export const ONE_TIME_GLP1_RESEARCH_PATH = "/api/scheduled/capital-one-time-glp1-research";
export const GLP1_POST_OPEN_MINUTES_ET = 10 * 60;
export const GLP1_LAUNCH_GRACE_MS = 15 * 60_000;

export function oneTimeResearchCron(targetAt: number): string {
  const target = new Date(targetAt);
  if (!Number.isFinite(targetAt) || Number.isNaN(target.getTime())) {
    throw new Error("A valid target timestamp is required for the one-time research schedule.");
  }
  // Heartbeat uses sec min hour dom mon dow, in UTC. The callback turns itself
  // terminal, so this calendar expression cannot create a recurring brief.
  return `0 ${target.getUTCMinutes()} ${target.getUTCHours()} ${target.getUTCDate()} ${target.getUTCMonth() + 1} *`;
}

export type OneTimeResearchGate = {
  eligible: boolean;
  reason: string;
};

/** A scheduled run may be delayed by retries, but never moved outside its named ET window. */
export function oneTimePostOpenResearchGate(now: number, targetAt: number): OneTimeResearchGate {
  const targetClock = etClock(targetAt);
  const nowClock = etClock(now);
  if (!targetClock || !nowClock) {
    return { eligible: false, reason: "The Eastern-market clock could not be determined, so research was not started." };
  }
  if (targetClock.dateEt !== nowClock.dateEt) {
    return { eligible: false, reason: "The scheduled GLP-1 research date has passed, so the one-time brief was not recreated on a later session." };
  }
  if (now < targetAt || now > targetAt + GLP1_LAUNCH_GRACE_MS) {
    return { eligible: false, reason: "The scheduled post-open window was missed, so research was not started outside its stated measurement period." };
  }
  const session = marketSession(now);
  if (session.session !== "regular" || (session.etMinutes ?? 0) < GLP1_POST_OPEN_MINUTES_ET) {
    return { eligible: false, reason: "The opening range is not yet measurable in the regular session, so GLP-1 research remains deferred." };
  }
  return { eligible: true, reason: "Regular-session opening-range gate passed." };
}
