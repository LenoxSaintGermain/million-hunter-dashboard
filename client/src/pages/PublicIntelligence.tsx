import React, { useRef, useState, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import EditorialTopNav from "@/components/EditorialTopNav";
import SecEvidencePanel, {
  createCaptureRequests,
} from "@/components/SecEvidencePanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type {
  FeedResult,
  MacroOddEvent,
  TrademarkRecord,
  FederalContractor,
  SecCompanyMatch,
  FxRatesResult,
} from "@shared/publicIntelligence";
type FeedQuery<T> = {
  data?: FeedResult<T>;
  isFetching: boolean;
  error: { message: string } | null;
  refetch: () => unknown;
};
const panel = "rounded-lg border border-[var(--rule)] bg-[var(--paper)] p-4";
const action =
  "min-h-11 bg-[var(--ink)] text-[var(--bone)] hover:bg-[var(--ink)] hover:opacity-90 font-mono text-xs";
const queryOptions = {
  retry: false as const,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  trpc: { abortOnUnmount: true },
};

function SourceLink({
  href,
  children,
}: {
  href?: string | null;
  children: ReactNode;
}) {
  if (!href || !/^https?:\/\//i.test(href))
    return <span>{children} (link unavailable)</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-4 break-words"
    >
      {children} ↗
    </a>
  );
}

function Timestamp({ value }: { value?: string | null }) {
  if (!value || !Number.isFinite(Date.parse(value))) return <>Unknown</>;
  return <time dateTime={value}>{new Date(value).toLocaleString()}</time>;
}

export function FeedView<T>({
  query,
  children,
}: {
  query: FeedQuery<T>;
  children: (data: T) => ReactNode;
}) {
  const feed = query.data;
  const status = query.error ? "unavailable" : feed?.status;
  const hasData =
    feed?.data != null && (!Array.isArray(feed.data) || feed.data.length > 0);
  const canShow = hasData && (status === "ok" || status === "stale");
  const label =
    query.isFetching && !feed && !query.error
      ? "Fetching source…"
      : status === "unavailable"
        ? "Source unavailable"
        : status === "empty"
          ? "No matching records returned"
          : status === "stale"
            ? "Stale data — not current"
            : status === "ok" && hasData
              ? "Source response received"
              : "Unknown — no verified data";
  return (
    <div className="space-y-4" aria-busy={query.isFetching}>
      <div className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role={query.error || status === "unavailable" ? "alert" : "status"}
            className="min-w-0 break-words text-sm"
          >
            <p className="font-medium">{label}</p>
            {query.error && <p className="mt-1">{query.error.message}</p>}
            {feed?.message && <p className="mt-1">{feed.message}</p>}
            {status === "empty" && (
              <p className="mt-1">This is not proof that no records exist.</p>
            )}
          </div>
          <Button
            type="button"
            className={action}
            disabled={query.isFetching}
            onClick={() => query.refetch()}
          >
            {query.isFetching
              ? "Fetching…"
              : status === "ok"
                ? "Refresh"
                : "Retry"}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--sh-text-secondary)]">
          <span>
            Source:{" "}
            <SourceLink href={feed?.sourceUrl}>
              {feed?.source || "Unknown"}
            </SourceLink>
          </span>
          <span>
            Fetched: <Timestamp value={feed?.fetchedAt} />
          </span>
          <span>
            Provider attempt: <Timestamp value={feed?.attemptedAt} />
          </span>
        </div>
        <p className="mt-2 text-xs text-[var(--sh-text-secondary)]">
          Refresh may use a cached response; timestamps show the provider fetch.
        </p>
      </div>
      {canShow && children(feed!.data!)}
    </div>
  );
}

export function Probability({
  value,
  outcome,
}: {
  value: number | null;
  outcome: string | null;
}) {
  const valid =
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100 &&
    Boolean(outcome?.trim());
  if (!valid)
    return (
      <p className="text-xs text-[var(--sh-text-secondary)]">
        Probability unknown · Outcome: {outcome?.trim() || "Unknown"}
      </p>
    );
  return (
    <div className="space-y-2">
      <p className="text-xs font-mono break-words">
        {outcome}: {value}%
      </p>
      <div
        role="meter"
        aria-label={`${outcome} probability`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value!}
        aria-valuetext={`${outcome}: ${value}%`}
        className="h-1.5 overflow-hidden rounded bg-[var(--rule)]"
      >
        <div
          className="h-full bg-[var(--ink)]"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function EventMarkets({
  markets,
}: {
  markets: MacroOddEvent["markets"];
}) {
  const renderMarket = (market: MacroOddEvent["markets"][number]) => (
    <div
      key={market.id}
      className="space-y-2 border-t border-[var(--rule)] pt-3"
    >
      <p className="text-sm break-words">{market.question}</p>
      <Probability
        value={market.probabilityPct}
        outcome={market.outcomeLabel}
      />
    </div>
  );
  return (
    <div className="space-y-3">
      {markets.length === 0 && (
        <p className="text-xs">Market probabilities unknown.</p>
      )}
      {markets.slice(0, 3).map(renderMarket)}
      {markets.length > 3 && (
        <details className="border-t border-[var(--rule)] pt-2">
          <summary className="min-h-11 cursor-pointer py-3 text-xs font-mono focus-visible:outline focus-visible:outline-2">
            Show remaining {markets.length - 3} markets
          </summary>
          <div className="space-y-3">{markets.slice(3).map(renderMarket)}</div>
        </details>
      )}
    </div>
  );
}

export function GoodsServices({ text }: { text: string }) {
  return (
    <details className="border-t border-[var(--rule)]">
      <summary className="min-h-11 cursor-pointer py-3 text-xs font-mono focus-visible:outline focus-visible:outline-2">
        Goods and services
      </summary>
      <p className="whitespace-pre-wrap break-words text-sm">{text}</p>
    </details>
  );
}

function MacroOdds() {
  const [category, setCategory] = useState("economy");
  const query = trpc.publicIntelligence.getMacroOdds.useQuery(
    { tagSlug: category, limit: 8 },
    { ...queryOptions, staleTime: 60_000 }
  );
  return (
    <div className="space-y-4">
      <div
        className={`${panel} flex flex-wrap items-center justify-between gap-3`}
      >
        <div>
          <h2 className="font-serif text-lg">
            Prediction market probabilities
          </h2>
          <p className="text-xs text-[var(--sh-text-secondary)]">
            Source snapshots, not forecasts or guaranteed outcomes.
          </p>
        </div>
        <label className="text-xs font-mono">
          Category{" "}
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="ml-2 min-h-11 rounded border border-[var(--rule)] bg-[var(--bone)] px-3"
          >
            <option value="economy">Economy</option>
            <option value="politics">Politics</option>
            <option value="business">Business</option>
          </select>
        </label>
      </div>
      <FeedView<MacroOddEvent[]> query={query}>
        {events => (
          <div className="grid gap-4 md:grid-cols-2">
            {events.map(event => (
              <article key={event.id} className={`${panel} min-w-0 space-y-3`}>
                <h3 className="font-serif font-semibold break-words">
                  <SourceLink
                    href={
                      event.slug
                        ? `https://polymarket.com/event/${encodeURIComponent(event.slug)}`
                        : null
                    }
                  >
                    {event.title}
                  </SourceLink>
                </h3>
                <EventMarkets markets={event.markets} />
              </article>
            ))}
          </div>
        )}
      </FeedView>
    </div>
  );
}

type SearchKind = "trademarks" | "contractors" | "sec";
const searchLabels: Record<SearchKind, string> = {
  trademarks: "Search trademark records by brand or company",
  contractors: "Search federal recipients by company name",
  sec: "Search SEC companies by ticker or name",
};

function SearchFeed({
  kind,
  captureRequests,
}: {
  kind: SearchKind;
  captureRequests: ReturnType<typeof createCaptureRequests>;
}) {
  const [issuer, setIssuer] = useState<SecCompanyMatch | null>(null);
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [validation, setValidation] = useState("");
  const tm = trpc.publicIntelligence.searchTrademarks.useQuery(
    { query: submitted, limit: 6 },
    {
      ...queryOptions,
      enabled: kind === "trademarks" && Boolean(submitted),
      staleTime: 300_000,
    }
  );
  const fed = trpc.publicIntelligence.searchFederalContractors.useQuery(
    { query: submitted, limit: 6 },
    {
      ...queryOptions,
      enabled: kind === "contractors" && Boolean(submitted),
      staleTime: 300_000,
    }
  );
  const sec = trpc.publicIntelligence.searchSecCompanies.useQuery(
    { query: submitted, limit: 6 },
    {
      ...queryOptions,
      enabled: kind === "sec" && Boolean(submitted),
      staleTime: 600_000,
    }
  );
  const current =
    kind === "trademarks" ? tm : kind === "contractors" ? fed : sec;
  return (
    <div className="space-y-4">
      <form
        className={panel}
        onSubmit={event => {
          event.preventDefault();
          const term = input.trim();
          if (!term) {
            setValidation(
              "Enter a name or ticker; spaces alone cannot be searched."
            );
            return;
          }
          setValidation("");
          if (term === submitted) void current.refetch();
          else setSubmitted(term);
        }}
      >
        <label
          htmlFor={`${kind}-search`}
          className="mb-2 block text-xs font-mono"
        >
          {searchLabels[kind]}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id={`${kind}-search`}
            maxLength={120}
            value={input}
            onChange={e => setInput(e.target.value)}
            aria-invalid={Boolean(validation)}
            aria-describedby={validation ? `${kind}-error` : undefined}
            className="min-h-11 min-w-0 bg-[var(--bone)] border-[var(--rule)]"
          />
          <Button
            type="submit"
            disabled={current.isFetching}
            className={action}
          >
            Search
          </Button>
        </div>
        {validation && (
          <p id={`${kind}-error`} role="alert" className="mt-2 text-sm">
            {validation}
          </p>
        )}
      </form>
      {!submitted ? (
        <p role="status" className="text-sm text-[var(--sh-text-secondary)]">
          Not searched. Enter a term and select Search.
        </p>
      ) : (
        <>
          <p className="text-xs text-[var(--sh-text-secondary)] break-words">
            Results for “{submitted}”
          </p>
          {kind === "trademarks" && (
            <FeedView<TrademarkRecord[]> query={tm}>
              {records => (
                <div className="grid gap-3">
                  {records.map(record => (
                    <article
                      key={record.serialNumber}
                      className={`${panel} space-y-2 break-words`}
                    >
                      <h3 className="font-serif font-semibold">
                        {record.wordMark || "Name unknown"}
                      </h3>
                      <p className="text-xs">
                        Status:{" "}
                        {record.statusLabel ||
                          (record.statusCode
                            ? `Source code ${record.statusCode} (not interpreted)`
                            : "Unknown")}
                      </p>
                      <p className="text-xs">
                        Serial: {record.serialNumber || "Unknown"} · Owner:{" "}
                        {record.ownerName || "Unknown"}
                      </p>
                      {record.goodsServices && (
                        <GoodsServices text={record.goodsServices} />
                      )}
                      <p className="text-xs">
                        <SourceLink
                          href={
                            record.serialNumber
                              ? `https://tsdr.uspto.gov/#caseNumber=${encodeURIComponent(record.serialNumber)}&caseSearchType=US_APPLICATION&caseType=DEFAULT&searchType=statusSearch`
                              : null
                          }
                        >
                          USPTO record
                        </SourceLink>
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </FeedView>
          )}
          {kind === "contractors" && (
            <FeedView<FederalContractor[]> query={fed}>
              {records => (
                <div className="grid gap-3">
                  {records.map((record, index) => (
                    <article
                      key={`${record.recipientName}-${index}`}
                      className={`${panel} space-y-2 break-words`}
                    >
                      <h3 className="font-serif font-semibold">
                        {record.recipientName || "Name unknown"}
                      </h3>
                      <p className="text-xs">
                        UEI: {record.uei || "Unknown"} · DUNS:{" "}
                        {record.duns || "Unknown"}
                      </p>
                      <p className="text-xs text-[var(--sh-text-secondary)]">
                        Name autocomplete match only; awards and current
                        contractor status are not verified.
                      </p>
                      <p className="text-xs">
                        <SourceLink href="https://www.usaspending.gov/search">
                          Search awards on USAspending
                        </SourceLink>
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </FeedView>
          )}
          {kind === "sec" && (
            <FeedView<SecCompanyMatch[]> query={sec}>
              {records => (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {records.map(record => (
                    <article
                      key={record.cik}
                      className={`${panel} space-y-2 min-w-0 break-words`}
                    >
                      <h3 className="font-serif font-semibold">
                        {record.ticker || "Ticker unknown"}
                      </h3>
                      <p className="text-sm">
                        {record.title || "Company name unknown"}
                      </p>
                      <p className="text-xs">CIK: {record.cik || "Unknown"}</p>
                      <p className="text-xs">
                        <SourceLink
                          href={
                            record.cik
                              ? `https://www.sec.gov/edgar/browse/?CIK=${encodeURIComponent(record.cik)}`
                              : null
                          }
                        >
                          SEC filings
                        </SourceLink>
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 h-auto whitespace-normal text-xs"
                        aria-pressed={issuer?.cik === record.cik}
                        onClick={() => setIssuer(record)}
                      >
                        View saved evidence for {record.ticker || record.title}
                      </Button>
                    </article>
                  ))}
                </div>
              )}
            </FeedView>
          )}
        </>
      )}
      {kind === "sec" && issuer && (
        <SecEvidencePanel
          key={issuer.cik}
          cik={issuer.cik}
          name={issuer.title}
          captureRequests={captureRequests}
        />
      )}
    </div>
  );
}

function Forex() {
  const query = trpc.publicIntelligence.getForexRates.useQuery(
    { base: "USD" },
    { ...queryOptions, staleTime: 300_000 }
  );
  return (
    <div className="space-y-4">
      <div className={panel}>
        <h2 className="font-serif text-lg">FX reference rates</h2>
        <p className="text-xs text-[var(--sh-text-secondary)]">
          Dated reference rates via Frankfurter; not live or executable trading
          quotes.
        </p>
      </div>
      <FeedView<FxRatesResult> query={query}>
        {data => (
          <>
            <p className="text-xs font-mono">
              Rate date: {data.date || "Unknown"} · Base:{" "}
              {data.base || "Unknown"}
            </p>
            {Object.keys(data.rates).length === 0 && (
              <p className="text-sm">No rate values returned.</p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {Object.entries(data.rates).map(([symbol, rate]) => (
                <div key={symbol} className={`${panel} min-w-0 break-words`}>
                  <p className="text-xs font-mono">{symbol}</p>
                  <p className="mt-1 text-xl font-serif">
                    {typeof rate === "number" &&
                    Number.isFinite(rate) &&
                    rate > 0
                      ? rate.toFixed(4)
                      : "Unknown"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--sh-text-secondary)]">
                    per 1 {data.base || "unknown base"}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </FeedView>
    </div>
  );
}

const tabs = [
  ["macro_odds", "Macro odds"],
  ["trademarks", "Trademarks & IP"],
  ["contractors", "Federal recipients"],
  ["sec", "SEC companies"],
  ["forex", "FX benchmarks"],
] as const;

export default function PublicIntelligence() {
  const captureRequests = useRef(createCaptureRequests());
  const [activeTab, setActiveTab] = useState("macro_odds");
  return (
    <EditorialTopNav>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 text-[var(--ink)] sm:px-6 lg:px-8">
        <header className="border-b border-[var(--rule)] pb-5">
          <p className="mb-2 text-xs font-mono uppercase tracking-widest text-[var(--sh-text-secondary)]">
            Public data · Research prototype
          </p>
          <h1 className="text-3xl font-serif tracking-tight sm:text-4xl">
            Public Intelligence Radar
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--sh-text-secondary)]">
            Explore source-reported markets, company records and FX benchmarks.
            Availability and freshness vary; verify material findings with the
            linked source.
          </p>
        </header>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          activationMode="manual"
          className="gap-5"
        >
          <TabsList
            aria-label="Public intelligence sources"
            className="h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0"
          >
            {tabs.map(([id, label]) => (
              <TabsTrigger
                key={id}
                value={id}
                className="min-h-11 flex-none border-[var(--rule)] bg-[var(--paper)] px-3 text-xs font-mono text-[var(--ink)] data-[state=active]:bg-[var(--ink)] data-[state=active]:text-[var(--bone)]"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="macro_odds">
            {activeTab === "macro_odds" && <MacroOdds />}
          </TabsContent>
          {(["trademarks", "contractors", "sec"] as const).map(kind => (
            <TabsContent key={kind} value={kind}>
              {activeTab === kind && <SearchFeed kind={kind} captureRequests={captureRequests.current} />}
            </TabsContent>
          ))}
          <TabsContent value="forex">
            {activeTab === "forex" && <Forex />}
          </TabsContent>
        </Tabs>
      </div>
    </EditorialTopNav>
  );
}
