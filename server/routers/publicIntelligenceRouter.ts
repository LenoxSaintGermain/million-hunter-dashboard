import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getMacroOdds,
  searchTrademarks,
  searchFederalContractors,
  searchSecCompanies,
  getForexRates,
  getBrandFaviconUrl,
  searchInput,
  macroInput,
  forexInput,
} from "../publicIntelligence";
import type { SecIndexAccess, FeedAccess } from "../publicIntelligence";
import { evidenceRepository } from "../evidenceRepository";

export const createPublicIntelligenceRouter = (
  secAccess?: SecIndexAccess,
  feedAccess?: FeedAccess,
  callerReserve: (ownerId: number) => Promise<void> = ownerId =>
    evidenceRepository.reserveFeedCaller(ownerId)
) => {
  // Auth runs first. The shared repository owns the atomic 30/minute window;
  // neither storage failures nor quota denials may reach a provider/cache read.
  const feedProcedure = protectedProcedure.use(async ({ ctx, next }) => {
    try {
      await callerReserve(ctx.user.id);
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? error.code
          : undefined;
      if (code === "RATE_LIMITED" || code === "TOO_MANY_REQUESTS") {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Feed request limit reached; retry in one minute.",
        });
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Shared feed access storage is unavailable. No feed request was made; retry later.",
      });
    }
    return next();
  });
  return router({
    getMacroOdds: feedProcedure
      .input(macroInput)
      .query(({ input }) => getMacroOdds(input, feedAccess)),
    searchTrademarks: feedProcedure
      .input(searchInput)
      .query(({ input }) =>
        searchTrademarks(input.query, input.limit, feedAccess)
      ),
    searchFederalContractors: feedProcedure
      .input(searchInput)
      .query(({ input }) =>
        searchFederalContractors(input.query, input.limit, feedAccess)
      ),
    searchSecCompanies: feedProcedure
      .input(searchInput)
      .query(({ input }) =>
        searchSecCompanies(input.query, input.limit, secAccess)
      ),
    getForexRates: feedProcedure
      .input(forexInput)
      .query(({ input }) =>
        getForexRates(input.base, input.symbols, feedAccess)
      ),
    getBrandFaviconUrl: feedProcedure
      .input(z.object({ domain: z.string().trim().min(1).max(253) }))
      .query(({ input }) => {
        try {
          return { url: getBrandFaviconUrl(input.domain) };
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Enter a valid public domain.",
          });
        }
      }),
  });
};
export const publicIntelligenceRouter = createPublicIntelligenceRouter();
