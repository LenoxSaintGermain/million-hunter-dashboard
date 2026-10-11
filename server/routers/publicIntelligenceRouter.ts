import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getMacroOdds, searchTrademarks, searchFederalContractors, searchSecCompanies, getForexRates, getBrandFaviconUrl, searchInput, macroInput, forexInput } from "../publicIntelligence";

// Per-instance caller budget shared by all six procedures. Never evict live
// windows to let identity churn reset a caller's quota.
const callers = new Map<number, { start: number; count: number }>();
const feedProcedure = protectedProcedure.use(({ ctx, next }) => {
  const now = Date.now();
  for (const [key, entry] of Array.from(callers)) if (now - entry.start >= 60_000) callers.delete(key);
  let entry = callers.get(ctx.user.id);
  if (!entry) {
    if (callers.size >= 5000) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Feed is busy; retry in one minute." });
    entry = { start: now, count: 0 };
    callers.set(ctx.user.id, entry);
  }
  if (++entry.count > 30) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Feed request limit reached; retry in one minute." });
  return next();
});

export const publicIntelligenceRouter = router({
  getMacroOdds: feedProcedure.input(macroInput).query(({ input }) => getMacroOdds(input)),
  searchTrademarks: feedProcedure.input(searchInput).query(({ input }) => searchTrademarks(input.query, input.limit)),
  searchFederalContractors: feedProcedure.input(searchInput).query(({ input }) => searchFederalContractors(input.query, input.limit)),
  searchSecCompanies: feedProcedure.input(searchInput).query(({ input }) => searchSecCompanies(input.query, input.limit)),
  getForexRates: feedProcedure.input(forexInput).query(({ input }) => getForexRates(input.base, input.symbols)),
  getBrandFaviconUrl: feedProcedure.input(z.object({ domain: z.string().trim().min(1).max(253) })).query(({ input }) => {
    try { return { url: getBrandFaviconUrl(input.domain) }; }
    catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a valid public domain." }); }
  }),
});
