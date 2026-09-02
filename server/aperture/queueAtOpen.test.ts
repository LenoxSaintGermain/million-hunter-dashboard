import { describe, expect, it } from "vitest";
import { requestsQueueAtOpen } from "./queueAtOpen";

const mission = (over: Partial<Parameters<typeof requestsQueueAtOpen>[0]> = {}) => ({
  missionText: "Queue one IWM LIMIT/DAY share buy for release into the next regular session.",
  objective: "deploy_today",
  instrumentPreference: "shares",
  holdingPeriod: "intraday",
  ...over,
});

describe("requestsQueueAtOpen", () => {
  it("honours an explicit bounded queue instruction", () => {
    expect(requestsQueueAtOpen(mission())).toBe(true);
  });

  it("does not rewrite an ordinary intraday thesis into a queue-at-open order", () => {
    expect(requestsQueueAtOpen(mission({ missionText: "Buy IWM after its opening range and VWAP confirm." }))).toBe(false);
  });

  it("requires shares, intraday horizon, and deploy-today authority", () => {
    expect(requestsQueueAtOpen(mission({ instrumentPreference: "options" }))).toBe(false);
    expect(requestsQueueAtOpen(mission({ holdingPeriod: "swing" }))).toBe(false);
    expect(requestsQueueAtOpen(mission({ objective: "best_qualified_play" }))).toBe(false);
  });
});
