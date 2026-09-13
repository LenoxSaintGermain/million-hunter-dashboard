/** Recorded quantities only; missing fill data is not a zero fill. */
export function deskOrderQuantities(order: { qty: number | null; filledQty: number | null }) {
  const measured = (value: number | null) => value != null && Number.isFinite(value) && value >= 0 ? value : null;
  const ordered = measured(order.qty);
  const filled = measured(order.filledQty);
  return {
    ordered: ordered == null ? "Not measured" : String(ordered),
    filled: filled == null ? "Not measured" : String(filled),
    remaining: ordered == null || filled == null || filled > ordered ? "Not measured" : String(ordered - filled),
  };
}
