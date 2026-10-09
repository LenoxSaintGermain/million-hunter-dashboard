/**
 * Weekly Income research screen results (#84). Quick Play explains each idea
 * in plain English with the most you could lose in dollars; Strategist shows the
 * exact filter values. Research only: nothing here can place a trade.
 */
import { useMemo, useState } from "react";
import type { ScreenRefusal } from "../../../../../server/aperture/weeklyIncomeRouter";
import type { ScreenSkip, SpreadCandidate } from "../../../../../server/aperture/weeklyIncomeScreen";
import { WI_COPY } from "@shared/weeklyIncome/copy";
import { formatStrike, formatUsdCents } from "@shared/weeklyIncome/spreadMath";
import { useExperienceMode } from "@/contexts/ExperienceModeContext";
import { trpc } from "@/lib/trpc";
import { ExampleDataBadge, PaperFidelityNote, WeeklyIncomeGlossary, WiLabel } from "./WeeklyIncomeGuide";
import { WeeklyIncomeSkipped } from "./WeeklyIncomeSkipped";

export type WiScreenResult = {
  asOf: number;
  session: string | null;
  refusal: ScreenRefusal | null;
  candidates: SpreadCandidate[];
  skipped: ScreenSkip[];
};

const CARD = { borderColor: "var(--rule)", background: "var(--paper)", borderRadius: 0 } as const;
const BUTTON = "min-h-11 border px-4 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.12em]";
const strike = (cents: number) => formatStrike(cents / 100);

const CHECK_NAMES: Record<string, string> = {
  feed: "Live price feed",
  quote_age: "Price is fresh",
  bid_ask: "Real buyers and sellers",
  spread_width: "Small gap between buy and sell prices",
  volume: "Traded today",
  iv: "Volatility measured",
  open_interest: "Enough open contracts",
  delta: "Market-implied chance of being reached",
  dte: "Days until it ends",
  credit_pct_of_width: "Payment is worth the risk",
};

function GuidedCandidate({ candidate, isExample }: { candidate: SpreadCandidate; isExample: boolean }) {
  const g = candidate.guided;
  const totalMaxLoss = candidate.maxLossTotalCents ?? candidate.maxLossPerContractCents;
  return (
    <article data-wi-candidate className="border p-5" style={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <WiLabel>{candidate.underlying} · ends {candidate.expiration} · {candidate.dte} days</WiLabel>
        {isExample && <ExampleDataBadge />}
      </div>
      {g ? (
        <>
          <h4 className="mt-2 font-serif text-xl leading-snug" style={{ color: "var(--ink)" }}>{g.headline}</h4>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--ink)" }}>{g.summary}</p>
        </>
      ) : <p className="mt-2 text-sm" style={{ color: "var(--ink)" }}>Plain-language summary not available for this idea.</p>}
      <div data-wi-max-loss className="mt-4 border-l-2 pl-3" style={{ borderColor: "var(--sh-signal)" }}>
        <WiLabel>Most you could lose</WiLabel>
        <p className="font-serif text-3xl" style={{ color: "var(--ink)" }}>{formatUsdCents(totalMaxLoss)}</p>
        <p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>
          {candidate.contracts == null ? "For one contract. " : `For ${candidate.contracts} contract${candidate.contracts === 1 ? "" : "s"}. `}
          {candidate.pctOfEquity != null ? `That's ${candidate.pctOfEquity}% of your practice balance. ` : ""}
          {candidate.sizing}
        </p>
      </div>
      {g && (
        <dl className="mt-4 grid gap-3 text-sm leading-6 sm:grid-cols-2" style={{ color: "var(--ink)" }}>
          <div><dt><WiLabel tone="muted">You get paid up front</WiLabel></dt><dd>{g.keep}</dd></div>
          <div><dt><WiLabel tone="muted">The plan</WiLabel></dt><dd>{g.plan}</dd></div>
          <div data-wi-what-can-go-wrong><dt><WiLabel tone="muted">What can go wrong</WiLabel></dt><dd>{g.whatCanGoWrong}</dd></div>
          <div><dt><WiLabel tone="muted">Breakeven</WiLabel></dt><dd>{g.breakeven}</dd></div>
        </dl>
      )}
      {candidate.previewReason && <p data-wi-preview className="mt-3 border p-2 text-xs" style={{ borderColor: "var(--sh-signal)", color: "var(--ink)" }}>{candidate.previewReason}</p>}
      <details className="mt-3 border-t pt-2" style={{ borderColor: "var(--rule)" }}>
        <summary className="min-h-10 cursor-pointer font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-signal)" }}>Why it made the list</summary>
        <ul className="mt-1 grid gap-1 text-xs" style={{ color: "var(--ink)" }}>
          {[...candidate.short.checks, ...candidate.structureChecks].map((check, i) => (
            <li key={`${check.name}-${i}`}>✓ {CHECK_NAMES[check.name] ?? check.name}: <span style={{ color: "var(--sh-fg-muted)" }}>{check.detail}</span></li>
          ))}
        </ul>
      </details>
    </article>
  );
}

function ProTable({ candidates }: { candidates: SpreadCandidate[] }) {
  return (
    <div className="overflow-x-auto border" style={CARD}>
      <table data-wi-pro-table className="w-full min-w-[760px] text-left font-mono text-[0.72rem]" style={{ color: "var(--ink)" }}>
        <thead><tr className="border-b uppercase tracking-[0.08em]" style={{ borderColor: "var(--rule)", color: "var(--sh-fg-muted)" }}>
          {["Underlying", "Exp · DTE", "Short / long", "Δ short", "Credit", "% width", "Max loss / ct", "Cts", "Max loss", "% eq", "Bid/ask %", "OI", "Feed"].map((h) => <th key={h} className="px-2 py-2 font-semibold">{h}</th>)}
        </tr></thead>
        <tbody>
          {candidates.map((c) => (
            <tr key={`${c.short.symbol}-${c.long.symbol}`} className="border-b" style={{ borderColor: "var(--rule)" }}>
              <td className="px-2 py-2 font-semibold">{c.underlying}</td>
              <td className="px-2 py-2">{c.expiration} · {c.dte}</td>
              <td className="px-2 py-2">{strike(c.short.strikeCents)} / {strike(c.long.strikeCents)}</td>
              <td className="px-2 py-2">{c.short.delta == null ? "Not measured" : Math.abs(c.short.delta).toFixed(2)}</td>
              <td className="px-2 py-2">{formatUsdCents(c.creditCents)}</td>
              <td className="px-2 py-2">{c.creditPctOfWidth}%</td>
              <td className="px-2 py-2">{formatUsdCents(c.maxLossPerContractCents)}</td>
              <td className="px-2 py-2">{c.contracts ?? "Not measured"}</td>
              <td className="px-2 py-2">{c.maxLossTotalCents == null ? "Not measured" : formatUsdCents(c.maxLossTotalCents)}</td>
              <td className="px-2 py-2">{c.pctOfEquity == null ? "Not measured" : `${c.pctOfEquity}%`}</td>
              <td className="px-2 py-2">{c.short.spreadPct ?? "?"}% / {c.long.spreadPct ?? "?"}%</td>
              <td className="px-2 py-2">{c.short.openInterest ?? "?"} / {c.long.openInterest ?? "?"}</td>
              <td className="px-2 py-2">{c.short.feed ?? "?"}{c.previewReason ? " · closed" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WeeklyIncomeScreenResults({ result, isGuided, isExample = false }: { result: WiScreenResult; isGuided: boolean; isExample?: boolean }) {
  const asOf = new Date(result.asOf).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <section data-wi-screen className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <WiLabel>{isGuided ? "This week's research ideas" : `Screen · P1 put credit spreads · ${result.candidates.length} shown`}</WiLabel>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.08em]" style={{ color: "var(--sh-fg-muted)" }}>As of {asOf} ET · research only, nothing is traded</p>
      </div>
      {result.refusal ? (
        <div data-wi-refusal className="border p-4 text-sm" style={{ ...CARD, borderColor: "var(--sh-signal)", color: "var(--ink)" }}>
          <p>{result.refusal.plain}</p>
          {!isGuided && <p className="mt-1 font-mono text-[0.7rem]" style={{ color: "var(--sh-fg-muted)" }}>{result.refusal.code} · {result.refusal.detail}</p>}
        </div>
      ) : result.candidates.length === 0 ? (
        <p className="border p-4 text-sm" style={{ ...CARD, color: "var(--ink)" }}>{WI_COPY["wi.week.empty"]}</p>
      ) : isGuided ? (
        result.candidates.map((candidate) => <GuidedCandidate key={`${candidate.short.symbol}-${candidate.long.symbol}`} candidate={candidate} isExample={isExample} />)
      ) : (
        <ProTable candidates={result.candidates} />
      )}
      {!result.refusal && <WeeklyIncomeSkipped items={result.skipped} isGuided={isGuided} />}
      {isGuided && <WeeklyIncomeGlossary terms={["Put", "Put credit spread", "Delta", "Maximum loss", "Breakeven", "Open interest", "Bid/ask spread", "OPRA quote"]} />}
      <PaperFidelityNote />
    </section>
  );
}

/** Live panel on a saved Weekly Income thesis. Read-only query; runs only when asked. */
export function WeeklyIncomeScreenPanel({ compilationId, defaultSymbols }: { compilationId: number; defaultSymbols: string[] }) {
  const { isGuided } = useExperienceMode();
  const accountsQuery = trpc.aperture.account.list.useQuery(undefined, { retry: false });
  const paperAccounts = useMemo(() => (accountsQuery.data ?? []).filter((a: any) => a.brokerId === "alpaca_paper" && a.isPaper), [accountsQuery.data]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [symbolText, setSymbolText] = useState(defaultSymbols.join(", "));
  const [request, setRequest] = useState<{ accountId: number; symbols: string[] } | null>(null);
  const chosenAccount = accountId ?? paperAccounts[0]?.id ?? null;
  const symbols = symbolText.split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z]{1,6}$/.test(s)).slice(0, 10);
  const screen = trpc.aperture.weeklyIncome.screen.useQuery(
    { compilationId, accountId: request?.accountId ?? 0, symbols: request?.symbols ?? ["X"] },
    { enabled: request != null, retry: false, refetchOnWindowFocus: false },
  );
  return (
    <section data-wi-screen-panel className="aperture-editorial grid gap-3 border p-5" style={CARD}>
      <WiLabel>{isGuided ? "Find this week's ideas" : "Research screen"}</WiLabel>
      {isGuided && <p className="text-sm leading-6" style={{ color: "var(--ink)" }}>We check each stock you list against every rule in your plan and show only the trades that pass, with the most you could lose in dollars. This is research: it never places a trade.</p>}
      {paperAccounts.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--ink)" }}>{accountsQuery.isLoading ? "Loading your practice accounts…" : "You need a practice (paper) account to run the screen."}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <label className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>Practice account
            <select value={chosenAccount ?? ""} onChange={(e) => setAccountId(Number(e.target.value))} className="mt-1 min-h-11 w-full border bg-transparent px-2 text-sm" style={{ borderColor: "var(--rule)", color: "var(--ink)", borderRadius: 0 }}>
              {paperAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.label ?? `Account ${a.id}`}</option>)}
            </select>
          </label>
          <label className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>Stocks to check (up to 10)
            <input value={symbolText} onChange={(e) => setSymbolText(e.target.value)} placeholder="Ticker symbols, separated by commas" className="mt-1 min-h-11 w-full border bg-transparent px-3 text-sm" style={{ borderColor: "var(--rule)", color: "var(--ink)", borderRadius: 0 }} />
          </label>
          <button type="button" disabled={!chosenAccount || symbols.length === 0 || screen.isFetching} onClick={() => chosenAccount && setRequest({ accountId: chosenAccount, symbols })} className={BUTTON} style={{ borderColor: "var(--sh-signal)", background: "var(--sh-signal)", color: "var(--paper)", borderRadius: 0 }}>
            {screen.isFetching ? "Checking…" : "Run research screen"}
          </button>
        </div>
      )}
      {screen.error && <p role="alert" className="text-sm" style={{ color: "var(--sh-red)" }}>{screen.error.message}</p>}
      {screen.data && <WeeklyIncomeScreenResults result={screen.data as WiScreenResult} isGuided={isGuided} />}
    </section>
  );
}
