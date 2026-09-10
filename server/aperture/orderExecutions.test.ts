import { afterEach, describe, expect, it, vi } from "vitest";
import { readOrderExecutions } from "./brokers/orderExecutions";

const orderId = "00000000-0000-4000-8000-000000000001";
const input = { brokerOrderId: orderId, expectedExternalAccountId: "paper-account" };
const now = Date.UTC(2026, 8, 10, 15);
const fill = (id = "execution::1") => ({ id, activity_type: "FILL", order_id: orderId,
  symbol: "TEST", side: "sell", type: "fill", price: "118.000000001", qty: "0.123456789",
  cum_qty: "0.123456789", leaves_qty: "0", transaction_time: "2026-09-10T14:00:00Z" });
const setup = (pages: unknown[] = [[fill()]]) => ({
  readAccount: vi.fn(async () => ({ externalAccountId: input.expectedExternalAccountId, isPaper: true })),
  readPage: vi.fn(async () => pages.shift()), now: () => now,
});

describe("bound paper order execution evidence", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("the real adapter uses only the paper activity endpoint and exact order filter", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const { alpacaPaperBroker } = await import("./brokers");
    vi.stubEnv("ALPACA_PAPER_KEY", "illustrative-key"); vi.stubEnv("ALPACA_PAPER_SECRET", "illustrative-secret");
    vi.spyOn(alpacaPaperBroker, "getAccount").mockResolvedValue({ externalAccountId: "paper-account", isPaper: true,
      cashCents: null, buyingPowerCents: null, equityValueCents: null, optionsApprovedLevel: null,
      optionsTradingLevel: null, optionsBuyingPowerCents: null, asOf: now });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([fill()]), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await alpacaPaperBroker.getOrderExecutions!(input)).executions).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(url).origin).toBe("https://paper-api.alpaca.markets");
    expect(new URL(url).pathname).toBe("/v2/account/activities");
    expect(Object.fromEntries(new URL(url).searchParams)).toEqual({ activity_types: "FILL", order_id: orderId, direction: "asc", page_size: "100" });
    expect(options.method ?? "GET").toBe("GET"); expect(options.body).toBeUndefined();
  });
  it("preserves exact decimals and separates execution coverage from gain proof", async () => {
    const dependencies = setup();
    const result = await readOrderExecutions(input, dependencies);
    expect(result).toMatchObject({ observedAt: now, externalAccountId: "paper-account",
      coverage: "complete_order_execution_query", executions: [fill()], feesVerified: false,
      costBasisVerified: false, proceedsAvailabilityVerified: false });
    expect(dependencies.readAccount).toHaveBeenCalledTimes(2);
    expect(dependencies.readPage).toHaveBeenCalledWith({ orderId, pageSize: 100 });
  });
  it("follows the last activity token until the query is complete", async () => {
    const page = Array.from({ length: 100 }, (_, index) => fill(`execution::${index}`));
    const dependencies = setup([page, [fill("execution::last")]]);
    expect((await readOrderExecutions(input, dependencies)).executions).toHaveLength(101);
    expect(dependencies.readPage).toHaveBeenNthCalledWith(2, { orderId, pageSize: 100, pageToken: "execution::99" });
  });
  it("empty coverage is not a filled order or verified proceeds", async () => {
    expect(await readOrderExecutions(input, setup([[]]))).toMatchObject({ executions: [], proceedsAvailabilityVerified: false });
  });
  it.each([null, {}, "<html>error</html>", [null], [{ ...fill(), price: "NaN" }],
    [{ ...fill(), qty: "0" }], [{ ...fill(), leaves_qty: "-1" }], [{ ...fill(), transaction_time: "not-a-date" }],
    [{ ...fill(), activity_type: "FEE" }]].map(page => ({ page })))("refuses malformed pages %#", async ({ page }) => {
    await expect(readOrderExecutions(input, setup([page]))).rejects.toThrow("execution page is malformed");
  });
  it.each([
    [{ ...fill(), order_id: "00000000-0000-4000-8000-000000000002" }], [fill(), fill()],
  ].map(page => ({ page })))("refuses wrong order or repeated identity %#", async ({ page }) => {
    await expect(readOrderExecutions(input, setup([page]))).rejects.toThrow("execution identity");
  });
  it("does not call the provider for invalid identity", async () => {
    const dependencies = setup();
    await expect(readOrderExecutions({ ...input, brokerOrderId: "" }, dependencies)).rejects.toThrow();
    expect(dependencies.readAccount).not.toHaveBeenCalled(); expect(dependencies.readPage).not.toHaveBeenCalled();
  });
  it.each([false, true])("rejects the wrong or nonpaper account before history lookup: %s", async isPaper => {
    const dependencies = setup(); dependencies.readAccount.mockResolvedValue({ externalAccountId: "other", isPaper });
    await expect(readOrderExecutions(input, dependencies)).rejects.toThrow("account does not match");
    expect(dependencies.readPage).not.toHaveBeenCalled();
  });
  it("rejects changed account binding after pagination", async () => {
    const dependencies = setup(); dependencies.readAccount.mockResolvedValueOnce({ externalAccountId: "paper-account", isPaper: true })
      .mockResolvedValueOnce({ externalAccountId: "other", isPaper: true });
    await expect(readOrderExecutions(input, dependencies)).rejects.toThrow("account does not match");
  });
  it("does not return a partial success after a later page fails", async () => {
    const dependencies = setup([Array.from({ length: 100 }, (_, index) => fill(String(index)))]);
    dependencies.readPage.mockImplementationOnce(async () => Array.from({ length: 100 }, (_, index) => fill(String(index))))
      .mockRejectedValueOnce(new Error("provider unavailable"));
    await expect(readOrderExecutions(input, dependencies)).rejects.toThrow("provider unavailable");
  });
  it("bounds pagination without calling a truncated query complete", async () => {
    const dependencies = setup(Array.from({ length: 20 }, (_, page) => Array.from({ length: 100 }, (_, index) => fill(`${page}::${index}`))));
    await expect(readOrderExecutions(input, dependencies)).rejects.toThrow("bounded history limit");
    expect(dependencies.readPage).toHaveBeenCalledTimes(20);
  });
  it("refuses future executions at the observation cutoff", async () => {
    await expect(readOrderExecutions(input, setup([[{ ...fill(), transaction_time: "2027-01-01T00:00:00Z" }]]))).rejects.toThrow("timestamps");
  });
});
