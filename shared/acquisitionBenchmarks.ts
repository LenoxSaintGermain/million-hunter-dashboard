import { z } from "zod";

export const CATEGORY_BENCHMARKS_VERSION = "2026-09-29/bizbuysell-comps-v1" as const;

export const categoryBenchmarkSchema = z.object({
  category: z.string().min(1).max(64),
  label: z.string().min(1).max(128),
  sdeMarginP90: z.number().min(0).max(1),
  multipleP25: z.number().positive(),
  multipleMedian: z.number().positive(),
  revenuePerEmployeeP90: z.number().positive(),
  source: z.string().min(1),
});

export type CategoryBenchmark = z.infer<typeof categoryBenchmarkSchema>;

/**
 * Standard industry comp distributions for Main Street & lower-middle-market acquisitions.
 * Source: Aggregated Pratt's Stats / BizBuySell Insight closed transaction distributions.
 * When a deal does not provide an approved category or falls outside this catalog,
 * benchmark-dependent detectors (R8, R14, benchmark-driven Lemons/Auction) are explicitly disabled.
 */
export const CATEGORY_BENCHMARKS: Record<string, CategoryBenchmark> = {
  hvac: {
    category: "hvac",
    label: "HVAC & Mechanical Contracting",
    sdeMarginP90: 0.28,
    multipleP25: 2.3,
    multipleMedian: 3.1,
    revenuePerEmployeeP90: 275000,
    source: "BizBuySell Insight & Pratt's Stats comps distribution",
  },
  plumbing_septic: {
    category: "plumbing_septic",
    label: "Plumbing, Septic & Environmental Services",
    sdeMarginP90: 0.32,
    multipleP25: 2.2,
    multipleMedian: 2.9,
    revenuePerEmployeeP90: 250000,
    source: "BizBuySell Insight & Pratt's Stats comps distribution",
  },
  commercial_cleaning: {
    category: "commercial_cleaning",
    label: "Commercial Cleaning & Janitorial",
    sdeMarginP90: 0.24,
    multipleP25: 1.9,
    multipleMedian: 2.5,
    revenuePerEmployeeP90: 160000,
    source: "BizBuySell Insight & Pratt's Stats comps distribution",
  },
  precision_machining: {
    category: "precision_machining",
    label: "Precision Machining & Metal Fabrication",
    sdeMarginP90: 0.26,
    multipleP25: 2.5,
    multipleMedian: 3.4,
    revenuePerEmployeeP90: 310000,
    source: "BizBuySell Insight & Pratt's Stats comps distribution",
  },
  fire_protection: {
    category: "fire_protection",
    label: "Fire Protection & Safety Equipment",
    sdeMarginP90: 0.22,
    multipleP25: 2.4,
    multipleMedian: 3.2,
    revenuePerEmployeeP90: 290000,
    source: "BizBuySell Insight & Pratt's Stats comps distribution",
  },
  industrial_distribution: {
    category: "industrial_distribution",
    label: "Industrial & Commercial Distribution",
    sdeMarginP90: 0.20,
    multipleP25: 2.6,
    multipleMedian: 3.5,
    revenuePerEmployeeP90: 450000,
    source: "BizBuySell Insight & Pratt's Stats comps distribution",
  },
  general_services: {
    category: "general_services",
    label: "General B2B Services",
    sdeMarginP90: 0.25,
    multipleP25: 2.1,
    multipleMedian: 2.8,
    revenuePerEmployeeP90: 220000,
    source: "BizBuySell Insight & Pratt's Stats comps distribution",
  },
};

export function lookupCategoryBenchmark(categoryName?: string | null): CategoryBenchmark | null {
  if (!categoryName) return null;
  const normalized = categoryName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (CATEGORY_BENCHMARKS[normalized]) return CATEGORY_BENCHMARKS[normalized];
  
  if (normalized.includes("hvac") || normalized.includes("air_cond")) return CATEGORY_BENCHMARKS.hvac;
  if (normalized.includes("septic") || normalized.includes("plumb")) return CATEGORY_BENCHMARKS.plumbing_septic;
  if (normalized.includes("clean") || normalized.includes("janitor")) return CATEGORY_BENCHMARKS.commercial_cleaning;
  if (normalized.includes("machin") || normalized.includes("cnc") || normalized.includes("tool")) return CATEGORY_BENCHMARKS.precision_machining;
  if (normalized.includes("fire") || normalized.includes("sprinkler")) return CATEGORY_BENCHMARKS.fire_protection;
  if (normalized.includes("distrib") || normalized.includes("wholesale") || normalized.includes("ice")) return CATEGORY_BENCHMARKS.industrial_distribution;
  
  return null;
}
