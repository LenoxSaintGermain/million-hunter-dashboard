/**
 * Weekly Income: ideas skipped by a rule (#85 blackouts, #84 screen filters).
 * Quick Play says why in plain English; Strategist adds the exact rule and the
 * source of any date. Display only.
 */
import { WI_COPY } from "@shared/weeklyIncome/copy";
import { WiLabel } from "./WeeklyIncomeGuide";

export type WiSkippedItem = {
  symbol: string;
  plain: string;
  detail: string;
  source?: { name: string; url?: string | null; recordedBy?: string | null; recordedAt?: number | null } | null;
};

export function WeeklyIncomeSkipped({ items, isGuided, emptyIsValid = true }: { items: WiSkippedItem[]; isGuided: boolean; emptyIsValid?: boolean }) {
  return (
    <section data-wi-skipped className="border p-4" style={{ borderColor: "var(--rule)", background: "var(--paper)", borderRadius: 0 }}>
      <WiLabel>{isGuided ? "Skipped this week, and why" : `Skipped by rule · ${items.length}`}</WiLabel>
      {items.length === 0 ? (
        <p className="mt-2 text-sm" style={{ color: "var(--ink)" }}>{emptyIsValid ? WI_COPY["wi.week.empty"] : "Nothing was skipped."}</p>
      ) : (
        <ul className="mt-2 divide-y text-sm" style={{ borderColor: "var(--rule)" }}>
          {items.map((item, index) => (
            <li key={`${item.symbol}-${index}`} className="py-2" style={{ borderColor: "var(--rule)" }}>
              <p style={{ color: "var(--ink)" }}><span className="font-mono font-semibold">{item.symbol}</span> · {item.plain}</p>
              {!isGuided && <p className="mt-0.5 font-mono text-[0.7rem]" style={{ color: "var(--sh-fg-muted)" }}>{item.detail}{item.source ? ` · source: ${item.source.name}${item.source.recordedBy ? `, recorded by ${item.source.recordedBy}` : ""}` : ""}{item.source?.url ? ` · ${item.source.url}` : ""}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
