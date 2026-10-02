type Bounds = { askingPriceMin?: number; askingPriceMax?: number; cashFlowMin?: number; cashFlowMax?: number };
type Values = { askingPrice: number | null; cashFlow: number | null };
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export function AcquisitionFinancialPortrait({ values, bounds }: { values?: Values; bounds?: Bounds }) {
  if (!values || !bounds) return <p className="my-3 text-xs text-muted-foreground">Financial portrait unavailable: this saved comparison has no captured financial bounds or values.</p>;
  const rows = [
    { label: "Asking price", value: values.askingPrice, min: bounds.askingPriceMin, max: bounds.askingPriceMax },
    { label: "Annual cash flow", value: values.cashFlow, min: bounds.cashFlowMin, max: bounds.cashFlowMax },
  ];
  return <figure className="my-4 border-y border-border bg-[var(--sh-surface)] px-3 py-4">
    <figcaption className="mb-4 font-mono text-[10px] uppercase tracking-widest">Thesis × reported financials</figcaption>
    {rows.map(row => {
      const plottable = row.value != null && row.value >= 0 && row.min != null && row.max != null && row.min >= 0 && row.max > row.min;
      const ceiling = Math.max(row.max ?? 0, row.value ?? 0) * 1.15;
      return <div key={row.label} className="mb-5 last:mb-0">
        <div className="flex flex-wrap justify-between gap-2 text-xs"><span>{row.label}</span><strong className="font-serif text-xl">{row.value == null ? "Not reported" : money(row.value)}</strong></div>
        {plottable ? <>
          <div aria-hidden="true" className="relative mx-2 my-3 h-8">
            <div className="absolute inset-x-0 top-4 border-t border-border" />
            <div className="absolute top-1 h-6 border border-[var(--sh-fg-muted)]" style={{ left: `${row.min! / ceiling * 100}%`, width: `${(row.max! - row.min!) / ceiling * 100}%` }} />
            <div className="absolute top-2 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-[var(--sh-text-primary)] bg-[var(--sh-surface)]" style={{ left: `${row.value! / ceiling * 100}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground">Target {money(row.min!)}–{money(row.max!)} · {row.value! >= row.min! && row.value! <= row.max! ? "In range" : "Outside range"}</p>
          <p className="text-[10px] text-muted-foreground">Scale $0–{money(ceiling)}</p>
        </> : <p className="mt-2 border-l-2 border-dashed border-border pl-2 text-xs text-muted-foreground">{row.min == null ? "No lower bound saved" : `Minimum ${money(row.min)}`} · {row.max == null ? "No upper bound saved" : `Maximum ${money(row.max)}`}. No complete plottable range.</p>}
      </div>;
    })}
    <p className="mt-4 text-[10px] text-muted-foreground">Outlined band: saved search target. Hollow dot: reported listing value, not verified. Separate scales; not a valuation or return forecast.</p>
  </figure>;
}
