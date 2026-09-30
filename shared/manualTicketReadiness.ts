/** Client guidance only. Server order/preflight gates remain authoritative. */
export function manualTicketBlocker(input: {
  expression: string; missionAccountId?: number | null; accountId?: number | null;
  runId?: number | null; brokerId?: string | null; equityCents: number;
  notionalCents: number; buyingPowerCents: number; exceedsLimit: boolean;
  acknowledgement: string;
}): string | null {
  if (!input.missionAccountId || !input.runId) return "Bind a Capital Mission and research run before staging.";
  if (input.accountId !== input.missionAccountId) return "Use the account bound to this Mission.";
  if (!["shares", "long_call", "long_put"].includes(input.expression)) return "Multi-leg tickets are not supported here. No single leg will be substituted.";
  if (input.brokerId !== "alpaca_paper") return "Select a connected paper execution account through Mission. Manual ledgers cannot stage broker orders.";
  if (!Number.isFinite(input.equityCents) || input.equityCents <= 0) return "Account equity is unavailable. Refresh the account before sizing.";
  if (!Number.isFinite(input.notionalCents) || input.notionalCents <= 0) return "Enter a positive order size and limit price.";
  if (input.exceedsLimit) return "Reduce the ticket to the recorded account limits.";
  if (!Number.isFinite(input.buyingPowerCents) || input.buyingPowerCents < input.notionalCents) return "Recorded buying power is insufficient or unavailable.";
  if (input.acknowledgement !== "PAPER") return "Type PAPER to acknowledge this practice ticket.";
  return null;
}
