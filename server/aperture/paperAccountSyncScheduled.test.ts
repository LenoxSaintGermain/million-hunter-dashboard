import { describe, expect, it } from "vitest";
import {
  PAPER_ACCOUNT_SYNC_CRON,
  PAPER_ACCOUNT_SYNC_PATH,
  sessionAllowsPaperAccountSync,
} from "./paperAccountSyncScheduled";

describe("scheduled paper-account freshness", () => {
  it("uses a dedicated cron-only Capital callback and a fifteen-minute cadence", () => {
    expect(PAPER_ACCOUNT_SYNC_PATH).toBe("/api/scheduled/capital-paper-account-sync");
    expect(PAPER_ACCOUNT_SYNC_CRON).toBe("0 */15 * * * *");
  });

  it("permits a regular-session read but refuses provider work when the market is closed", () => {
    // 10:00 ET on a Friday in daylight-saving time.
    expect(sessionAllowsPaperAccountSync(new Date("2026-08-21T14:00:00.000Z").getTime()).allowed).toBe(true);
    // 02:00 ET on the same Friday.
    expect(sessionAllowsPaperAccountSync(new Date("2026-08-21T06:00:00.000Z").getTime()).allowed).toBe(false);
    // Sunday afternoon ET.
    expect(sessionAllowsPaperAccountSync(new Date("2026-08-23T18:00:00.000Z").getTime()).allowed).toBe(false);
  });
});
