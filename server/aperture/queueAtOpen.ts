export interface QueueAtOpenMission {
  missionText: string;
  objective: string;
  instrumentPreference: string;
  holdingPeriod: string;
}

/**
 * Queue-at-open is an operator-declared execution mode, never an inference from
 * a generic intraday thesis. Requiring all four clauses keeps ordinary day
 * trades on their opening-range/VWAP path.
 */
export function requestsQueueAtOpen(mission: QueueAtOpenMission | null | undefined): boolean {
  if (!mission) return false;
  const text = mission.missionText.toLowerCase();
  const namesQueue = /\bqueue(?:d|ing)?\b/.test(text);
  const namesBoundedDayOrder = /\blimit\s*(?:\/|\+|and)?\s*day\b/.test(text);
  const namesNextRegularSession = /\bnext regular session\b|\bnext market open\b|\bmarket open\b/.test(text);
  return mission.objective === "deploy_today"
    && mission.instrumentPreference === "shares"
    && mission.holdingPeriod === "intraday"
    && namesQueue
    && namesBoundedDayOrder
    && namesNextRegularSession;
}
