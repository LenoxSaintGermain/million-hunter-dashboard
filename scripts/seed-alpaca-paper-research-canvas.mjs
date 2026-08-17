/**
 * One-time, explicitly approved PAPER-only research canvas setup.
 * No live endpoint or credentials are used. Run manually only after user confirmation.
 */
const BASE_URL = "https://paper-api.alpaca.markets/v2";
const key = process.env.ALPACA_PAPER_KEY;
const secret = process.env.ALPACA_PAPER_SECRET;

if (!key || !secret) throw new Error("ALPACA_PAPER_KEY and ALPACA_PAPER_SECRET are required");

const headers = {
  "APCA-API-KEY-ID": key,
  "APCA-API-SECRET-KEY": secret,
  "Content-Type": "application/json",
};

const canvas = [
  ["NVDA", 10_000],
  ["MSFT", 8_000],
  ["AVGO", 7_000],
  ["VRT", 6_000],
  ["ETN", 5_000],
  ["CEG", 4_000],
];

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers: { ...headers, ...(options.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${path}: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

const account = await request("/account");
if (account.account_blocked || account.trading_blocked) throw new Error("Paper account is blocked from trading; no order was submitted.");
if (Number(account.buying_power) < 40_000) throw new Error(`Insufficient paper buying power: ${account.buying_power}. No order was submitted.`);

console.log(JSON.stringify({ paper: true, buyingPower: account.buying_power, action: "submit approved AI-infrastructure research canvas" }));

const existingOrders = await request("/orders?status=all&limit=100&direction=desc");

for (const [symbol, notional] of canvas) {
  const clientOrderId = `mh-research-canvas-20260816-${symbol.toLowerCase()}`;
  const existing = existingOrders.find((order) => order.client_order_id === clientOrderId);
  if (existing) {
    console.log(JSON.stringify({ symbol, notional, paper: true, orderId: existing.id, status: existing.status, clientOrderId, reusedExistingOrder: true }));
    continue;
  }
  const order = await request("/orders", {
    method: "POST",
    body: JSON.stringify({
      symbol,
      notional: String(notional),
      side: "buy",
      type: "market",
      time_in_force: "day",
      client_order_id: clientOrderId,
    }),
  });
  console.log(JSON.stringify({ symbol, notional, paper: true, orderId: order.id, status: order.status, clientOrderId }));
}

const orders = await request("/orders?status=open&limit=20&direction=desc");
console.log(JSON.stringify({ openPaperOrders: orders.filter((order) => order.client_order_id?.startsWith("mh-research-canvas-20260816-")).map((order) => ({ symbol: order.symbol, status: order.status, orderId: order.id })) }));
