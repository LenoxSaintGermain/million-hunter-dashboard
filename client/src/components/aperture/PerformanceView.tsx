import React from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import {
  PERFORMANCE_FOOTER, closedHeading, closedSentence, dollars, lockedInLine, planCaveat, planOutcomeSentence,
  price, quickHeadline, sampleNote, signedDollars, signedR, NOT_MEASURED,
} from "@shared/performanceCopy";
import { accountStamp } from "./AccountHoldingsPortrait";
import "@/styles/performance-edition.css";

export type PerformanceOverview = inferRouterOutputs<AppRouter>["aperture"]["performance"]["overview"];
type Play = PerformanceOverview["plan"]["plays"][number];

const tone = (cents: number | null | undefined) => (cents == null ? "" : cents < 0 ? "perf-loss" : cents > 0 ? "perf-gain" : "");
const ET = (ms: number | null | undefined) => ms == null ? NOT_MEASURED : new Date(ms).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET";
const ETDay = (ms: number) => new Date(ms).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });
const dayLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });

function ageText(asOf: number | null, now: number) {
  if (asOf == null) return null;
  const mins = Math.max(0, Math.round((now - asOf) / 60_000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

function Kpi({ label, value, note, tone: t }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div className="perf-kpi">
      <span className="perf-eyebrow">{label}</span>
      <strong className={t}>{value}</strong>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

export function PerformanceKpis({ data, now }: { data: PerformanceOverview; now: number }) {
  const h = data.headline;
  const stamp = `As of your last sync, ${ET(h.asOf)} (${ageText(h.asOf, now) ?? NOT_MEASURED})`;
  const closedN = data.closed.stats.closed;
  const heldN = data.plan.plays.length;
  return (
    <div className="perf-kpis" role="list">
      <Kpi label="Account value" value={dollars(h.equityCents)} note={h.asOf ? stamp : "No saved sync yet"} />
      <Kpi label="Today" value={signedDollars(h.today.deltaCents)} note={h.today.fromAt ? `vs. first sync today` : "Needs two saved syncs today"} tone={tone(h.today.deltaCents)} />
      <Kpi label="This week" value={signedDollars(h.thisWeek.deltaCents)} note={h.thisWeek.fromAt ? "vs. Monday's first sync" : "Needs two saved syncs this week"} tone={tone(h.thisWeek.deltaCents)} />
      <Kpi label="Since start" value={signedDollars(h.sinceStart.deltaCents)} note={h.sinceStart.startingCents != null ? `Started ${dollars(h.sinceStart.startingCents)}${h.sinceStart.fromAt ? ` on ${ETDay(h.sinceStart.fromAt)}` : ""}` : "Needs two saved syncs"} tone={tone(h.sinceStart.deltaCents)} />
      <Kpi label="Realized" value={signedDollars(data.realizedCents)} note={`${closedN} closed ${closedN === 1 ? "play" : "plays"}`} tone={tone(data.realizedCents)} />
      <Kpi label="Unrealized" value={signedDollars(data.unrealizedCents)} note={`${heldN} ${heldN === 1 ? "holding" : "holdings"} at last sync`} tone={tone(data.unrealizedCents)} />
      <Kpi label="Cash" value={dollars(data.cashCents)} note="Practice cash" />
    </div>
  );
}

/** Stop → entry → now → target bar. The bar is stop-to-target; markers are placed by price. */
export function RangeBar({ play }: { play: Play }) {
  if (!play.counted || play.stopCents == null || play.targetCents == null || play.entryCents == null) return null;
  const lo = Math.min(play.stopCents, play.lastCents ?? play.stopCents);
  const hi = Math.max(play.targetCents, play.lastCents ?? play.targetCents);
  const span = hi - lo || 1;
  const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - lo) / span) * 100))}%`;
  return (
    <div className="perf-range" role="img" aria-label={`Stop ${price(play.stopCents)}, entry ${price(play.entryCents)}, now ${price(play.lastCents)}, target ${price(play.targetCents)}`}>
      <div className="perf-range-bar">
        <i className="perf-range-loss" style={{ left: 0, width: pct(play.entryCents) }} />
        <i className="perf-range-gain" style={{ left: pct(play.entryCents), right: 0 }} />
        <b className="perf-range-tick" style={{ left: pct(play.entryCents) }} />
        {play.lastCents != null ? <b className="perf-range-now" style={{ left: pct(play.lastCents) }} /> : null}
      </div>
      <div className="perf-range-labels">
        <span>Stop {price(play.stopCents)}</span><span>Entry {price(play.entryCents)}</span>
        <span>Now {price(play.lastCents)}</span><span>Target {price(play.targetCents)}</span>
      </div>
    </div>
  );
}

function PlayCard({ play }: { play: Play }) {
  return (
    <article className="perf-play">
      <header><strong>{play.symbol}</strong><span>{play.thesis ?? "No thesis recorded"}</span></header>
      {play.counted ? (
        <>
          <RangeBar play={play} />
          <p>
            {play.unrealizedCents != null && play.unrealizedCents < 0 ? `Down ${dollars(Math.abs(play.unrealizedCents))}` : `Up ${dollars(play.unrealizedCents)}`} so far.
            {" "}At its stop you'd be {play.atStopFromHereCents != null && play.atStopFromHereCents < 0 ? "down" : "up"} {dollars(Math.abs(play.atStopFromHereCents ?? 0))} from here;
            {" "}at its target, {play.atTargetFromHereCents != null && play.atTargetFromHereCents < 0 ? "down" : "up"} {dollars(Math.abs(play.atTargetFromHereCents ?? 0))}.
          </p>
        </>
      ) : (
        <p>{play.uncountedReason ?? "Not counted"}. Not counted in the totals below.</p>
      )}
    </article>
  );
}

export function EquityChart({ series, now }: { series: PerformanceOverview["series"]; now: number }) {
  const pts = series.points;
  if (pts.length < 2) {
    return <p className="perf-empty">History starts from your first saved sync. {pts.length === 1 ? "One sync is saved so far; the line needs a second." : "Nothing is saved yet."}</p>;
  }
  const W = 760, H = 230, PX = 40, PY = 22;
  const t0 = pts[0].takenAt, t1 = pts[pts.length - 1].takenAt;
  const vals = pts.map((p) => p.equityCents).concat(series.startingCents != null ? [series.startingCents] : []);
  const vmin = Math.min(...vals), vmax = Math.max(...vals);
  const vpad = (vmax - vmin || vmax * 0.01 || 1) * 0.15;
  const lo = vmin - vpad, hi = vmax + vpad;
  const x = (t: number) => PX + ((t - t0) / (t1 - t0 || 1)) * (W - PX * 2);
  const y = (v: number) => H - PY - ((v - lo) / (hi - lo)) * (H - PY * 2);
  const gaps = series.gaps.map((g) => {
    const [fy, fm, fd] = g.fromDateEt.split("-").map(Number);
    const [ty, tm, td] = g.toDateEt.split("-").map(Number);
    return { ...g, from: Date.UTC(fy, fm - 1, fd, 4), to: Date.UTC(ty, tm - 1, td, 4) + 86_400_000 };
  });
  const segments: typeof pts[] = [];
  let cur: typeof pts = [];
  pts.forEach((p, i) => {
    if (i > 0 && gaps.some((g) => g.to > pts[i - 1].takenAt && g.from < p.takenAt)) {
      segments.push(cur); cur = [];
    }
    cur.push(p);
  });
  segments.push(cur);
  return (
    <figure className="perf-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Account value from ${ETDay(t0)} to ${ETDay(t1)} across ${pts.length} saved syncs`}>
        {series.startingCents != null ? (
          <g><line x1={PX} x2={W - PX} y1={y(series.startingCents)} y2={y(series.startingCents)} className="perf-start-line" />
            <text x={W - PX} y={y(series.startingCents) - 6} textAnchor="end" className="perf-chart-text">Start {dollars(series.startingCents)}</text></g>
        ) : null}
        {gaps.map((g) => {
          const gx0 = Math.max(PX, x(g.from)), gx1 = Math.min(W - PX, x(g.to));
          if (gx1 <= gx0) return null;
          return (
            <g key={g.fromDateEt}>
              <rect x={gx0} y={PY} width={gx1 - gx0} height={H - PY * 2} className="perf-gap" />
              <text x={(gx0 + gx1) / 2} y={PY + 14} textAnchor="middle" className="perf-chart-text">No saved sync</text>
              <text x={(gx0 + gx1) / 2} y={PY + 26} textAnchor="middle" className="perf-chart-text">{dayLabel(g.fromDateEt)}{g.fromDateEt === g.toDateEt ? "" : `–${dayLabel(g.toDateEt)}`}</text>
            </g>
          );
        })}
        {segments.map((seg, i) => seg.length > 1 ? (
          <polyline key={i} className="perf-line" points={seg.map((p) => `${x(p.takenAt).toFixed(1)},${y(p.equityCents).toFixed(1)}`).join(" ")} />
        ) : null)}
        {pts.map((p) => <circle key={p.takenAt} cx={x(p.takenAt)} cy={y(p.equityCents)} r={pts.length > 120 ? 1.4 : 3} className="perf-dot"><title>{`${ET(p.takenAt)} · ${dollars(p.equityCents)}`}</title></circle>)}
        <text x={PX} y={H - 4} className="perf-chart-text">{ETDay(t0)}</text>
        <text x={W - PX} y={H - 4} textAnchor="end" className="perf-chart-text">{ETDay(t1)}</text>
      </svg>
      <figcaption>One dot per saved sync. Gaps mean no sync was saved, so nothing is drawn there. Not a price chart. {ageText(t1, now) ? `Latest sync ${ageText(t1, now)}.` : ""}</figcaption>
    </figure>
  );
}

function ClosedSummary({ data }: { data: PerformanceOverview }) {
  const s = data.closed.stats;
  const copy = { closed: s.closed, wins: s.wins, avgWinCents: s.avgWinCents, avgLossCents: s.avgLossCents, avgR: s.avgR };
  const note = sampleNote(s.closed, s.sample);
  return (
    <>
      <h3>{closedHeading(copy)}</h3>
      {closedSentence(copy) ? <p className="perf-lede">{closedSentence(copy)}</p> : null}
      {note ? <p className="perf-note">{note}</p> : null}
      {s.byThesis.length ? (
        <ul className="perf-thesis-list">
          {s.byThesis.map((t) => <li key={t.thesis}><strong>{t.thesis}</strong> · {t.plays} {t.plays === 1 ? "play" : "plays"} · <span className={tone(t.pnlCents)}>{signedDollars(t.pnlCents)}</span></li>)}
        </ul>
      ) : null}
      {data.unattributedSells > 0 ? <p className="perf-note">{data.unattributedSells} sale{data.unattributedSells === 1 ? "" : "s"} had no matching buy in this app, so {data.unattributedSells === 1 ? "its" : "their"} result is not measured.</p> : null}
    </>
  );
}

function RecordCards() {
  return (
    <section className="perf-card perf-record" aria-label="Your record">
      <span className="perf-eyebrow">Your record</span>
      <div>
        <a href="/aperture/record" className="perf-mini"><h4>Track record</h4><p>Win rate, average R and rule-following across every closed practice play. Too few plays to judge skill yet.</p></a>
        <div className="perf-mini perf-mini-proposed"><h4>Plays you skipped</h4><p>What the candidates you passed on did under the same rules.</p><small>Proposed · needs minute data</small></div>
        <a href="/aperture/record" className="perf-mini"><h4>Weekly scorecard</h4><p>This week's decisions and verified outcomes.</p></a>
      </div>
    </section>
  );
}

export function QuickPlayPerformance({ data, now }: { data: PerformanceOverview; now: number }) {
  const h = data.headline;
  const plan = data.plan;
  const lock = lockedInLine(data.realizedCents, data.unrealizedCents, data.closed.stats.closed);
  return (
    <div className="perf-page">
      <p className="perf-eyebrow perf-eyebrow-lead">Performance</p>
      <h1>How your practice money is doing</h1>
      <p className="perf-lede perf-lede-lg">{quickHeadline({ equityCents: h.equityCents, thisWeekCents: h.thisWeek.deltaCents, sinceStartCents: h.sinceStart.deltaCents, startingCents: h.sinceStart.startingCents })}</p>
      {lock ? <p className="perf-note">{lock}{h.asOf ? ` As of your last sync, ${ET(h.asOf)} (${ageText(h.asOf, now)}).` : ""}</p> : h.asOf ? <p className="perf-note">As of your last sync, {ET(h.asOf)} ({ageText(h.asOf, now)}).</p> : null}
      <hr className="perf-rule" />
      <section className="perf-card perf-card-flush"><PerformanceKpis data={data} now={now} /></section>

      <section className="perf-card">
        <span className="perf-eyebrow">Where your open plays are headed</span>
        <h2>Plan outcomes, from today's prices</h2>
        {plan.plays.length === 0 ? <p className="perf-lede">You have no open holdings at the last sync.</p> : (
          <>
            <p className="perf-lede">{planOutcomeSentence(plan.atStopFromHereCents, plan.atTargetFromHereCents)}</p>
            <p className="perf-note">{planCaveat(plan.uncountedSymbols)}</p>
            <div className="perf-play-grid">{plan.plays.map((p) => <PlayCard key={p.symbol} play={p} />)}</div>
          </>
        )}
      </section>

      <section className="perf-card"><span className="perf-eyebrow">How your closed plays went</span><ClosedSummary data={data} /></section>
      <section className="perf-card"><span className="perf-eyebrow">Account value over time</span><h2>From your saved syncs</h2><EquityChart series={data.series} now={now} /></section>
      <RecordCards />
      <p className="perf-footer">{PERFORMANCE_FOOTER}</p>
    </div>
  );
}

export function StrategistPerformance({ data, now }: { data: PerformanceOverview; now: number }) {
  const plan = data.plan;
  const s = data.closed.stats;
  return (
    <div className="perf-page perf-page-wide">
      <p className="perf-eyebrow perf-eyebrow-lead">Performance</p>
      <h1>Account results</h1>
      <p className="perf-note">{data.headline.asOf ? `As of your last sync, ${ET(data.headline.asOf)} (${ageText(data.headline.asOf, now)}). ` : ""}Practice account{data.isPracticeBook ? " (practice book)" : ""}.</p>
      <hr className="perf-rule" />
      <section className="perf-card perf-card-flush"><PerformanceKpis data={data} now={now} /></section>
      <section className="perf-card"><span className="perf-eyebrow">Account value over time</span><h2>From your saved syncs</h2><EquityChart series={data.series} now={now} /></section>

      <section className="perf-card">
        <span className="perf-eyebrow">Where your holdings are headed · plan outcomes</span>
        <h2>Open plays against stop and target</h2>
        {plan.plays.length === 0 ? <p className="perf-lede">No open holdings at the last sync.</p> : (
          <>
            <p className="perf-summary">
              If every stop hits: <b className={tone(plan.atStopFromHereCents)}>{signedDollars(plan.atStopFromHereCents)}</b> from here · If every target hits: <b className={tone(plan.atTargetFromHereCents)}>{signedDollars(plan.atTargetFromHereCents)}</b> from here · Planned loss at entry: <b>{plan.plannedLossCents == null ? NOT_MEASURED : signedDollars(-plan.plannedLossCents)}</b>
            </p>
            <div className="perf-scroll">
              <table className="perf-table">
                <thead><tr><th>Play</th><th>Thesis</th><th>Qty</th><th>Entry</th><th>Last sync</th><th>Stop</th><th>Target ({data.planTargetR}R)</th><th>Unrealized</th><th>Now</th><th>Planned loss</th><th>At stop, from here</th><th>At target, from here</th><th>Range</th></tr></thead>
                <tbody>
                  {plan.plays.map((p) => (
                    <tr key={p.symbol}>
                      <th scope="row">{p.symbol}</th><td>{p.thesis ?? "Manual record"}</td><td>{p.qty}</td><td>{price(p.entryCents)}</td><td>{price(p.lastCents)}</td>
                      <td>{p.counted ? price(p.stopCents) : "Not set"}</td><td>{p.counted ? price(p.targetCents) : "Not set"}</td>
                      <td className={tone(p.unrealizedCents)}>{signedDollars(p.unrealizedCents)}</td>
                      <td>{p.counted ? signedR(p.rNow) : NOT_MEASURED}</td>
                      <td>{p.counted && p.plannedLossCents != null ? signedDollars(-p.plannedLossCents) : NOT_MEASURED}</td>
                      <td className={tone(p.atStopFromHereCents)}>{p.counted ? signedDollars(p.atStopFromHereCents) : NOT_MEASURED}</td>
                      <td className={tone(p.atTargetFromHereCents)}>{p.counted ? signedDollars(p.atTargetFromHereCents) : NOT_MEASURED}</td>
                      <td className="perf-range-cell">{p.counted ? <RangeBar play={p} /> : p.uncountedReason}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><th scope="row" colSpan={7}>Account sum ({plan.countedCount} {plan.countedCount === 1 ? "play" : "plays"} with plan levels)</th><td className={tone(plan.unrealizedCents)}>{signedDollars(plan.unrealizedCents)}</td><td /><td>{plan.plannedLossCents == null ? NOT_MEASURED : signedDollars(-plan.plannedLossCents)}</td><td className={tone(plan.atStopFromHereCents)}>{signedDollars(plan.atStopFromHereCents)}</td><td className={tone(plan.atTargetFromHereCents)}>{signedDollars(plan.atTargetFromHereCents)}</td><td /></tr></tfoot>
              </table>
            </div>
            <p className="perf-note">Plan outcomes use your saved stop and the plan's {data.planTargetR}R target (a multiple of the risked distance, not a price objective). Marks are from the last sync. Gaps past a stop make real losses larger. Not a forecast.{plan.uncountedSymbols.length ? ` Not counted: ${plan.uncountedSymbols.join(", ")}.` : ""}</p>
          </>
        )}
      </section>

      <section className="perf-card">
        <span className="perf-eyebrow">Results · closed plays</span>
        <h2>By play and by thesis</h2>
        <div className="perf-kpis" role="list">
          <Kpi label="Closed" value={String(s.closed)} />
          <Kpi label="Win rate" value={s.winRate == null ? NOT_MEASURED : `${Math.round(s.winRate * 100)}%`} />
          <Kpi label="Average R" value={signedR(s.avgR)} />
          <Kpi label="Average win" value={s.avgWinCents == null ? NOT_MEASURED : signedDollars(s.avgWinCents)} tone="perf-gain" />
          <Kpi label="Average loss" value={s.avgLossCents == null ? NOT_MEASURED : signedDollars(-s.avgLossCents)} tone="perf-loss" />
          <Kpi label="Best" value={s.best ? `${s.best.symbol} ${signedDollars(s.best.resultCents)}` : NOT_MEASURED} />
          <Kpi label="Worst" value={s.worst ? `${s.worst.symbol} ${signedDollars(s.worst.resultCents)}` : NOT_MEASURED} tone="perf-loss" />
        </div>
        {data.closed.plays.length === 0 ? <p className="perf-empty">No closed plays yet. A play closes when its position is sold back to zero.</p> : (
          <div className="perf-two">
            <div className="perf-scroll">
              <table className="perf-table">
                <thead><tr><th>Play</th><th>Thesis</th><th>Closed</th><th>Planned loss</th><th>Result</th><th>R</th></tr></thead>
                <tbody>{data.closed.plays.map((p, i) => (
                  <tr key={`${p.symbol}-${p.closedAt}-${i}`}><th scope="row">{p.symbol}</th><td>{p.thesis}</td><td>{p.closedAt ? ETDay(p.closedAt) : NOT_MEASURED}</td><td>{p.plannedLossCents == null ? NOT_MEASURED : signedDollars(-p.plannedLossCents)}</td><td className={tone(p.resultCents)}>{signedDollars(p.resultCents)}</td><td>{signedR(p.r)}</td></tr>
                ))}</tbody>
              </table>
            </div>
            <div className="perf-scroll">
              <table className="perf-table">
                <thead><tr><th>Thesis</th><th>Plays</th><th>P&amp;L</th><th>Wins</th><th>Avg R</th><th>Avg win</th><th>Avg loss</th></tr></thead>
                <tbody>{s.byThesis.map((t) => (
                  <tr key={t.thesis}><th scope="row">{t.thesis}</th><td>{t.plays}</td><td className={tone(t.pnlCents)}>{signedDollars(t.pnlCents)}</td><td>{t.wins}/{t.plays}</td><td>{signedR(t.avgR)}</td><td>{t.avgWinCents == null ? NOT_MEASURED : signedDollars(t.avgWinCents)}</td><td>{t.avgLossCents == null ? NOT_MEASURED : signedDollars(-t.avgLossCents)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
        <p className="perf-note">R = result ÷ planned loss recorded on the order. {sampleNote(s.closed, s.sample) ?? ""}{data.unattributedSells > 0 ? ` ${data.unattributedSells} sale${data.unattributedSells === 1 ? "" : "s"} had no matching buy in this app and ${data.unattributedSells === 1 ? "is" : "are"} not measured.` : ""}</p>
      </section>
      <RecordCards />
      <p className="perf-footer">{PERFORMANCE_FOOTER}</p>
    </div>
  );
}
