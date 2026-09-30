/** Presentation math only. Never combines unlike measures into a quality score. */
export type AlignmentMeasure = {
  id: string;
  label: string;
  value: number | null;
  min?: number;
  max?: number;
  unit: "usd" | "percent" | "multiple" | "number";
  basis: "reported" | "modeled" | "corroborated" | "unknown";
  wanted: string;
  explanation: string;
};

export function alignmentGeometry(row: AlignmentMeasure) {
  const { value, min, max } = row;
  if (value == null || !Number.isFinite(value) || value < 0 ||
      min == null || max == null || !Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max <= min) return null;
  const ceiling = Math.max(max, value) * 1.15;
  return { ceiling, left: min / ceiling * 100, width: (max - min) / ceiling * 100,
    point: value / ceiling * 100, fits: value >= min && value <= max };
}

export function formatAlignment(value: number | null, unit: AlignmentMeasure["unit"]) {
  if (value == null || !Number.isFinite(value)) return "Not established";
  if (unit === "usd") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value);
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "multiple") return `${value.toFixed(2)}×`;
  return value.toLocaleString("en-US");
}
