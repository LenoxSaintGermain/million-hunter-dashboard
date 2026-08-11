import { describe, expect, it } from "vitest";

const BASE_URL = "https://paper-api.alpaca.markets/v2";

describe("Alpaca Paper credential validation", () => {
  it("authenticates to the read-only paper account endpoint", async () => {
    const key = process.env.ALPACA_PAPER_KEY;
    const secret = process.env.ALPACA_PAPER_SECRET;

    expect(key, "ALPACA_PAPER_KEY must be configured").toBeTruthy();
    expect(secret, "ALPACA_PAPER_SECRET must be configured").toBeTruthy();

    const response = await fetch(`${BASE_URL}/account`, {
      headers: {
        "APCA-API-KEY-ID": key!,
        "APCA-API-SECRET-KEY": secret!,
      },
    });

    expect(response.status, `Alpaca Paper account request failed with ${response.status}`).toBe(200);
    const account = await response.json() as { id?: string; account_number?: string; status?: string };
    expect(account.id || account.account_number, "Alpaca returned no account identifier").toBeTruthy();
    expect(account.status, "Alpaca account must be ACTIVE").toBe("ACTIVE");
  }, 15_000);
});
