/**
 * Research Router — tRPC procedures for deep research integration
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDealDossier, getRadarSignals, getCachedResearch, getIndustryResearch } from "../deepResearch";
import { getDealById } from "../db";
import { TRPCError } from "@trpc/server";

export const researchRouter = router({
  /**
   * Get (or generate) a research dossier for a specific deal.
   * Uses sonar-pro, cached 72h.
   */
  getForDeal: protectedProcedure
    .input(
      z.object({
        dealId: z.number(),
        forceRefresh: z.boolean().optional().default(false),
      })
    )
    .query(async ({ input }) => {
      const deal = await getDealById(input.dealId);
      if (!deal) throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });

      const result = await getDealDossier(
        deal.id,
        deal.name,
        deal.location ?? "Unknown location",
        deal.industry ?? "business",
        input.forceRefresh
      );

      if (!result) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Research failed" });

      return {
        id: result.id,
        subjectKey: result.subjectKey,
        model: result.model,
        content: result.content,
        citations: result.citations as string[],
        searchResults: (result.searchResults ?? []) as Array<{
          title: string;
          url: string;
          snippet: string;
          date?: string;
        }>,
        numSearchQueries: result.numSearchQueries,
        costUsd: result.costUsd,
        createdAt: result.createdAt,
        expiresAt: result.expiresAt,
        isCached: !input.forceRefresh,
      };
    }),

  /**
   * Get (or generate) live Opportunity Radar signals for a location.
   * Uses sonar-pro, cached 24h.
   */
  getRadarSignals: protectedProcedure
    .input(
      z.object({
        location: z.string().min(2).max(128),
        forceRefresh: z.boolean().optional().default(false),
      })
    )
    .query(async ({ input }) => {
      const result = await getRadarSignals(input.location, input.forceRefresh);
      if (!result) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Research failed" });

      return {
        id: result.id,
        subjectKey: result.subjectKey,
        model: result.model,
        content: result.content,
        citations: result.citations as string[],
        searchResults: (result.searchResults ?? []) as Array<{
          title: string;
          url: string;
          snippet: string;
          date?: string;
        }>,
        numSearchQueries: result.numSearchQueries,
        costUsd: result.costUsd,
        createdAt: result.createdAt,
        expiresAt: result.expiresAt,
      };
    }),

  /**
   * Get (or generate) industry research for a sector + location.
   * Uses sonar-pro, cached 48h.
   */
  getIndustryResearch: protectedProcedure
    .input(
      z.object({
        industry: z.string().min(2).max(128),
        location: z.string().min(2).max(128),
        forceRefresh: z.boolean().optional().default(false),
      })
    )
    .query(async ({ input }) => {
      const result = await getIndustryResearch(input.industry, input.location, input.forceRefresh);
      if (!result) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Research failed" });

      return {
        id: result.id,
        model: result.model,
        content: result.content,
        citations: result.citations as string[],
        searchResults: (result.searchResults ?? []) as Array<{
          title: string;
          url: string;
          snippet: string;
          date?: string;
        }>,
        numSearchQueries: result.numSearchQueries,
        costUsd: result.costUsd,
        createdAt: result.createdAt,
        expiresAt: result.expiresAt,
      };
    }),

  /**
   * Check if a cached result exists for a subject key (no API call).
   */
  getCacheStatus: protectedProcedure
    .input(z.object({ subjectKey: z.string() }))
    .query(async ({ input }) => {
      const cached = await getCachedResearch(input.subjectKey);
      return {
        exists: !!cached,
        expiresAt: cached?.expiresAt ?? null,
        createdAt: cached?.createdAt ?? null,
        model: cached?.model ?? null,
      };
    }),
});
