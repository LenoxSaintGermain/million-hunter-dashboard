export type DailyPlayPrimaryDestination = "evidence" | "execute";

/**
 * Keyboard acceleration opens the same human-controlled next screen as the visible card action.
 * It never creates, approves, or submits an order.
 */
export function dailyPlayPrimaryDestination(readiness: string): DailyPlayPrimaryDestination {
  return readiness === "ready_to_prepare" ? "execute" : "evidence";
}
