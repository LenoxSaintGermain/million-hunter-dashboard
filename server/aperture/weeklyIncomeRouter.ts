/**
 * Weekly Income research screen (#84). Read-only: one query, no mutation, no
 * order path. It never imports the order flow and cannot create a proposal,
 * a ticket or an order. Phase 1 is research only (#82).
 */
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { capitalOperatorProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { portfolioAccounts, thesisCompilations } from "../../drizzle/schema";
import { brokerFor } from "./brokers/index";
import { alpacaDataProvider } from "./providers/marketData";
import { benzingaProvider } from "./providers/paid";
import { isMarketHoliday, marketSession } from "./marketSession";
import { evaluateEventWindow, earningsRecordFromFact } from "./weeklyIncomeEventWindows";
import { rankCandidates, screenUnderlying, weeklyExpirationsInRange, type ScreenExpiration, type ScreenSkip, type SpreadCandidate } from "./weeklyIncomeScreen";
import { readStoredWeeklyIncomeTemplate } from "../../shared/strategyTemplates/weeklyIncome";

/** P1 (put credit spreads) needs options level 3 at Alpaca. */
export const WI_P1_MIN_OPTIONS_LEVEL = 3;
const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX = 6;
const recentRuns = new Map<number, number[]>();

/** Per-user in-memory limit so the screen cannot hammer the shared data feed. */
export function takeScreenSlot(userId: number, now: number, store: Map<number, number[]> = recentRuns): boolean {
  const kept = (store.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (kept.length >= RATE_MAX) { store.set(userId, kept); return false; }
  kept.push(now);
  store.set(userId, kept);
  return true;
}

export type ScreenRefusal = { code: "not_paper" | "options_level" | "options_level_unknown" | "opra_not_entitled" | "no_template" | "rate_limited" | "outside_calendar"; plain: string; detail: string };

export function screenAccountGate(account: { isPaper: boolean; optionsTradingLevel: number | null }): ScreenRefusal | null {
  if (!account.isPaper) return { code: "not_paper", plain: "Weekly Income is practice-only for now. Pick a paper (practice) account.", detail: "Account is not paper" };
  if (account.optionsTradingLevel == null) return { code: "options_level_unknown", plain: "We couldn't confirm this account is approved for floor-protected option trades, so the screen won't run.", detail: "Not measured: options trading level" };
  if (account.optionsTradingLevel < WI_P1_MIN_OPTIONS_LEVEL) return { code: "options_level", plain: "This account isn't approved for floor-protected option trades (spreads) yet.", detail: `Options level ${account.optionsTradingLevel} < ${WI_P1_MIN_OPTIONS_LEVEL}` };
  return null;
}

const etDate = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(ms));
const dayLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export const weeklyIncomeRouter = router({
  screen: capitalOperatorProcedure
    .input(z.object({
      compilationId: z.number().int().positive(),
      accountId: z.number().int().positive(),
      symbols: z.array(z.string().trim().toUpperCase().regex(/^[A-Z]{1,6}$/)).min(1).max(10),
    }))
    .query(async ({ ctx, input }) => {
      const now = Date.now();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [compilation] = await db.select().from(thesisCompilations)
        .where(and(eq(thesisCompilations.id, input.compilationId), eq(thesisCompilations.userId, ctx.user.id))).limit(1);
      if (!compilation) throw new TRPCError({ code: "NOT_FOUND", message: "Thesis not found" });
      const template = readStoredWeeklyIncomeTemplate(compilation.compiledFilters);
      const base = { asOf: now, candidates: [] as SpreadCandidate[], skipped: [] as ScreenSkip[], session: null as string | null, parameterHash: template?.parameterHash ?? null, researchOnly: true as const };
      if (!template) return { ...base, refusal: { code: "no_template", plain: "This thesis doesn't use the Weekly Income plan.", detail: "No stored Weekly Income template" } as ScreenRefusal };
      if (!takeScreenSlot(ctx.user.id, now)) return { ...base, refusal: { code: "rate_limited", plain: "You've run the screen a lot in the last few minutes. Try again shortly.", detail: `Max ${RATE_MAX} runs per ${RATE_WINDOW_MS / 60_000} minutes` } as ScreenRefusal };

      const [row] = await db.select().from(portfolioAccounts)
        .where(and(eq(portfolioAccounts.id, input.accountId), eq(portfolioAccounts.userId, ctx.user.id))).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      const broker = brokerFor(row.brokerId, row.id, row);
      const account = await broker.getAccount();
      const gate = screenAccountGate({ isPaper: row.isPaper && account.isPaper, optionsTradingLevel: account.optionsTradingLevel });
      if (gate) return { ...base, refusal: gate };
      if (!broker.getOptionChain) return { ...base, refusal: { code: "opra_not_entitled", plain: "This account can't read option prices, so the screen won't run.", detail: "Broker has no option chain" } as ScreenRefusal };

      const session = marketSession(now);
      const entryDateEt = session.dateEt ?? etDate(now);
      const p = template.parameters;
      const expirations = weeklyExpirationsInRange(entryDateEt, p.dte_min, p.dte_max, isMarketHoliday);
      const screenCtx = {
        params: p, now, regularSession: session.session === "regular", equityCents: account.equityValueCents,
        expirationLabel: dayLabel,
        timeExitLabel: (iso: string) => {
          const d = new Date(`${iso}T12:00:00Z`);
          d.setUTCDate(d.getUTCDate() - 1);
          return `${dayLabel(d.toISOString().slice(0, 10))} ${p.time_exit} ET`;
        },
      };
      const candidates: SpreadCandidate[] = [];
      const skipped: ScreenSkip[] = [];
      let sawOpra = false;
      let sawIndicativeOnly = false;
      const benzingaOn = Boolean(process.env.BENZINGA_API_KEY);

      for (const symbol of input.symbols) {
        const facts = await (alpacaDataProvider.fetchSecurityFacts?.(symbol, { now, timeoutMs: 10_000 }) ?? Promise.resolve([])).catch(() => []);
        const priceFact = facts.find((f) => f.factKey === "last_price" && f.basis === "verified");
        const advFact = facts.find((f) => f.factKey === "adv_usd_30d" && f.basis === "verified");
        const priceCents = priceFact?.valueNum != null ? Math.round(priceFact.valueNum * 100) : null;
        const earningsFacts = benzingaOn ? await (benzingaProvider.fetchSecurityFacts?.(symbol, { now, timeoutMs: 10_000 }) ?? Promise.resolve([])).catch(() => []) : [];
        const earning = earningsRecordFromFact(symbol, earningsFacts.find((f) => f.factKey === "next_earnings_date"));
        const exps: ScreenExpiration[] = [];
        for (const exp of expirations) {
          const events = evaluateEventWindow({
            symbol, structure: "P1", entryDateEt, expirationDateEt: exp.date,
            // Unknown earnings are excluded (fail closed); ex-dividend does not affect P1.
            earnings: benzingaOn ? (earning ? [earning] : []) : null, exDividends: [],
            earningsWindowSessionsAfter: p.earnings_window_sessions_after, exDividendBlackoutCalls: p.ex_dividend_blackout_calls,
          });
          const rows = events.eligible && priceCents != null
            ? await broker.getOptionChain({ underlyingSymbol: symbol, expirationDate: exp.date, type: "put", strikePriceGteCents: Math.floor(priceCents * 0.7), strikePriceLteCents: priceCents, limit: 80 })
            : [];
          for (const r of rows) if (r.market?.feed === "opra") sawOpra = true;
          if (rows.length && rows.every((r) => r.market == null || r.market.feed === "indicative") && rows.some((r) => r.market)) sawIndicativeOnly = true;
          exps.push({ ...exp, rows, events });
        }
        const result = screenUnderlying({ symbol, priceCents, advUsd: advFact?.valueNum ?? null }, exps, screenCtx);
        candidates.push(...result.candidates);
        skipped.push(...result.skipped);
      }
      if (sawIndicativeOnly && !sawOpra) {
        return { ...base, session: session.session, refusal: { code: "opra_not_entitled", plain: "This account only sees delayed, indicative option prices. Weekly Income needs live OPRA prices, so nothing is shown.", detail: "Option quotes are indicative; OPRA not entitled" } as ScreenRefusal };
      }
      return { ...base, session: session.session, refusal: null as ScreenRefusal | null, candidates: rankCandidates(candidates, p.max_candidates_per_week), skipped };
    }),
});
