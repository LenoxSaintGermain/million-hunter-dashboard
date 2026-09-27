import { z } from "zod";

// Reject partial numbers and empty values; never turn malformed provider data
// into a zero-dollar filter that could change the search silently.
const integer = z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)])
  .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER));
const ratio = z.union([z.number(), z.string().regex(/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/).transform(Number)])
  .pipe(z.number().min(0).max(1));
const boolean = z.union([z.boolean(), z.enum(["true", "false"]).transform(v => v === "true")]);
const strings = z.array(z.string().trim().min(1));
const schema = z.object({
  compiledFilters: z.object({
    revenueMin: integer.optional(), revenueMax: integer.optional(),
    cashFlowMin: integer.optional(), cashFlowMax: integer.optional(),
    askingPriceMin: integer.optional(), askingPriceMax: integer.optional(),
    geographies: strings.optional(), exclusions: strings.optional(),
    businessAgeMin: integer.optional(), headcountMin: integer.optional(), headcountMax: integer.optional(),
    yearBuiltMax: integer.optional(), maxStories: integer.optional(), minOccupancyRate: ratio.optional(),
    requireHistoricRegister: boolean.optional(), requireStabilized: boolean.optional(),
    requireHigherAndBetterUse: boolean.optional(), capRateMin: ratio.optional(),
    noiMin: integer.optional(), noiMax: integer.optional(),
  }),
  scoringWeights: z.array(z.object({ dimension: z.string().trim().min(1),
    weight: integer.pipe(z.number().min(1).max(100)), isCustom: z.boolean() })).min(1)
    .refine(rows => rows.reduce((sum, row) => sum + row.weight, 0) === 100, "Weights must total 100"),
  evidenceRequirements: strings, autoDisqualifiers: strings, confidenceNotes: strings,
  estimatedTargetsMin: integer, estimatedTargetsMax: integer,
  estimatedCostMin: integer, estimatedCostMax: integer,
  suggestedName: z.string().trim().min(1).max(200),
}).superRefine((value, ctx) => {
  const pairs = [
    [value.compiledFilters.revenueMin, value.compiledFilters.revenueMax],
    [value.compiledFilters.cashFlowMin, value.compiledFilters.cashFlowMax],
    [value.compiledFilters.askingPriceMin, value.compiledFilters.askingPriceMax],
    [value.compiledFilters.headcountMin, value.compiledFilters.headcountMax],
    [value.compiledFilters.noiMin, value.compiledFilters.noiMax],
    [value.estimatedTargetsMin, value.estimatedTargetsMax],
    [value.estimatedCostMin, value.estimatedCostMax],
  ];
  if (pairs.some(([min, max]) => min !== undefined && max !== undefined && min > max))
    ctx.addIssue({ code: "custom", message: "Minimum cannot exceed maximum" });
});

export function validateAcquisitionCompilation(value: unknown) {
  return schema.parse(value);
}
