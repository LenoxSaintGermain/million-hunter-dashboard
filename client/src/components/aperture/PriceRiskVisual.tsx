type PricePoint = {
  label: string;
  priceCents: number | null | undefined;
  tone?: "risk" | "entry" | "target";
};

const compactMoney = (cents: number) => new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  maximumFractionDigits: 2,
}).format(cents / 100);

export function PriceRiskVisual({
  entryCents,
  stopCents,
  targets = [],
  label = "Modeled price plan",
}: {
  entryCents: number | null | undefined;
  stopCents: number | null | undefined;
  targets?: Array<{ label?: string; priceCents: number | null | undefined }>;
  label?: string;
}) {
  const rawPoints: PricePoint[] = [
    { label: "Stop", priceCents: stopCents, tone: "risk" },
    { label: "Entry", priceCents: entryCents, tone: "entry" },
    ...targets.map((target, index) => ({ label: target.label ?? `${index + 1}R`, priceCents: target.priceCents, tone: "target" as const })),
  ];
  const points = rawPoints.filter((point): point is PricePoint & { priceCents: number } => typeof point.priceCents === "number" && Number.isFinite(point.priceCents));

  if (points.length < 2) return <div className="rounded-lg border px-4 py-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>{label}</p>
    <p className="mt-1 text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>Price levels are not modeled yet.</p>
  </div>;

  const rawMin = Math.min(...points.map((point) => point.priceCents));
  const rawMax = Math.max(...points.map((point) => point.priceCents));
  const span = Math.max(1, rawMax - rawMin);
  const min = rawMin - span * 0.08;
  const max = rawMax + span * 0.08;
  const position = (priceCents: number) => Math.min(96, Math.max(4, ((priceCents - min) / (max - min)) * 100));
  const color = (tone: PricePoint["tone"]) => tone === "risk" ? "var(--sh-red)" : tone === "target" ? "var(--sh-emerald)" : "var(--sh-signal)";

  return <figure className="rounded-lg border px-4 py-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
    <figcaption className="flex items-center justify-between gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>{label}</span>
      <span className="text-[10px] font-mono uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>modeled · verify live</span>
    </figcaption>
    <div className="relative mt-8 h-12" aria-label={points.map((point) => `${point.label} ${compactMoney(point.priceCents)}`).join(", ")}>
      <div className="absolute inset-x-0 top-3 h-1 rounded-full" style={{ background: "var(--sh-border-1)" }} />
      {points.map((point) => <div key={`${point.label}-${point.priceCents}`} className="absolute top-0 -translate-x-1/2 text-center" style={{ left: `${position(point.priceCents)}%` }}>
        <span className="mx-auto block h-7 w-0.5" style={{ background: color(point.tone) }} />
        <span className="mt-1 block whitespace-nowrap font-mono text-[10px] font-semibold tabular-nums" style={{ color: "var(--sh-text-primary)" }}>{point.label} {compactMoney(point.priceCents)}</span>
      </div>)}
    </div>
  </figure>;
}
