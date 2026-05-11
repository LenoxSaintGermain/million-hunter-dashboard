/**
 * STACK Module Router — TSL-SCI-BRIEF-001-A2
 * Capital stack modeler: templates, custom stacks, layer management
 */
import { z } from "zod";
import { sql } from "drizzle-orm";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { TRPCError } from "@trpc/server";

// ─── Default layer templates for each stack template ─────────────────────────
const DEFAULT_LAYERS: Record<string, Array<{
  layer_order: number;
  layer_type: string;
  label: string;
  pct_of_total: number;
  interest_rate: number;
  term_months: number;
  lender: string;
  notes: string;
}>> = {
  raleigh_keystone: [
    { layer_order: 1, layer_type: "sba_7a", label: "SBA 7(a) — Senior Debt", pct_of_total: 75, interest_rate: 11.5, term_months: 120, lender: "SBA-Approved Lender", notes: "Prime + 2.75%. 10-year term. Covers business acquisition." },
    { layer_order: 2, layer_type: "reap", label: "USDA REAP Grant", pct_of_total: 5, interest_rate: 0, term_months: 0, lender: "USDA Rural Development", notes: "Up to 50% of eligible cap-ex, max $1M. Reduces equity requirement." },
    { layer_order: 3, layer_type: "seller_note", label: "Seller Note", pct_of_total: 15, interest_rate: 6.0, term_months: 60, lender: "Seller", notes: "Deferred for 12 months post-close. Subordinated to SBA." },
    { layer_order: 4, layer_type: "earnout", label: "Performance Earnout", pct_of_total: 3, interest_rate: 0, term_months: 24, lender: "Seller", notes: "Tied to Year 1–2 revenue retention targets." },
    { layer_order: 5, layer_type: "equity", label: "Buyer Equity Injection", pct_of_total: 2, interest_rate: 0, term_months: 0, lender: "Buyer", notes: "Minimum SBA equity injection. REAP grant reduces effective equity to near-zero." },
  ],
  standard_sba_7a: [
    { layer_order: 1, layer_type: "sba_7a", label: "SBA 7(a) — Senior Debt", pct_of_total: 90, interest_rate: 11.5, term_months: 120, lender: "SBA-Approved Lender", notes: "Prime + 2.75%. Standard 10-year acquisition loan." },
    { layer_order: 2, layer_type: "equity", label: "Buyer Equity Injection", pct_of_total: 10, interest_rate: 0, term_months: 0, lender: "Buyer", notes: "Standard 10% equity injection required by SBA." },
  ],
  sba_504_seller: [
    { layer_order: 1, layer_type: "senior_debt", label: "First Mortgage — Bank", pct_of_total: 50, interest_rate: 7.5, term_months: 120, lender: "Conventional Bank", notes: "50% first mortgage from conventional lender." },
    { layer_order: 2, layer_type: "sba_504", label: "SBA 504 — CDC Debenture", pct_of_total: 40, interest_rate: 6.5, term_months: 240, lender: "Certified Development Company", notes: "20-year fixed rate. Covers real estate or major equipment." },
    { layer_order: 3, layer_type: "seller_note", label: "Seller Note", pct_of_total: 10, interest_rate: 5.0, term_months: 60, lender: "Seller", notes: "Replaces buyer equity requirement. Subordinated to both senior tranches." },
  ],
  independent_sponsor: [
    { layer_order: 1, layer_type: "equity", label: "LP / Family Office Equity", pct_of_total: 65, interest_rate: 0, term_months: 0, lender: "LP Investor", notes: "Single LP or family office. Preferred return 8%. Sponsor carry 20%." },
    { layer_order: 2, layer_type: "senior_debt", label: "Senior Debt", pct_of_total: 25, interest_rate: 9.0, term_months: 60, lender: "Commercial Bank", notes: "5-year term loan. Secured by business assets." },
    { layer_order: 3, layer_type: "rollover_equity", label: "Management Rollover", pct_of_total: 10, interest_rate: 0, term_months: 0, lender: "Seller / Management", notes: "Seller or key management retains minority equity stake." },
  ],
  veteran_anchored: [
    { layer_order: 1, layer_type: "sba_7a", label: "SBA 7(a) — Veteran Pricing", pct_of_total: 85, interest_rate: 11.0, term_months: 120, lender: "SBA-Approved Lender", notes: "Prime + 2.25% veteran pricing. SDVOSB eligible post-close." },
    { layer_order: 2, layer_type: "seller_note", label: "Seller Note", pct_of_total: 5, interest_rate: 5.0, term_months: 36, lender: "Seller", notes: "Bridges equity gap. Short 3-year term." },
    { layer_order: 3, layer_type: "equity", label: "Buyer Equity Injection", pct_of_total: 10, interest_rate: 0, term_months: 0, lender: "Buyer", notes: "10% equity injection. Veteran SBA Express available for working capital." },
  ],
  rollup_addon: [
    { layer_order: 1, layer_type: "senior_debt", label: "Platform Credit Facility", pct_of_total: 55, interest_rate: 8.5, term_months: 60, lender: "Existing Platform Lender", notes: "Draw on existing revolving credit facility." },
    { layer_order: 2, layer_type: "seller_note", label: "Seller Note", pct_of_total: 25, interest_rate: 6.0, term_months: 48, lender: "Seller", notes: "Deferred 6 months. Subordinated to platform facility." },
    { layer_order: 3, layer_type: "earnout", label: "Revenue Earnout", pct_of_total: 15, interest_rate: 0, term_months: 24, lender: "Seller", notes: "Tied to customer retention and revenue targets post-integration." },
    { layer_order: 4, layer_type: "equity", label: "Sponsor Equity Top-Up", pct_of_total: 5, interest_rate: 0, term_months: 0, lender: "Buyer", notes: "Minimal equity injection." },
  ],
  reap_enhanced: [
    { layer_order: 1, layer_type: "sba_7a", label: "SBA 7(a) — Senior Debt", pct_of_total: 75, interest_rate: 11.5, term_months: 120, lender: "SBA-Approved Lender", notes: "Standard SBA 7(a) acquisition loan." },
    { layer_order: 2, layer_type: "reap", label: "USDA REAP Grant", pct_of_total: 13, interest_rate: 0, term_months: 0, lender: "USDA Rural Development", notes: "Up to 50% of eligible cap-ex. Reduces equity to near-zero." },
    { layer_order: 3, layer_type: "seller_note", label: "Seller Note", pct_of_total: 10, interest_rate: 5.5, term_months: 60, lender: "Seller", notes: "Subordinated. Deferred 12 months." },
    { layer_order: 4, layer_type: "equity", label: "Buyer Equity Injection", pct_of_total: 2, interest_rate: 0, term_months: 0, lender: "Buyer", notes: "Near-zero equity after REAP grant application." },
  ],
};

// ─── Router ───────────────────────────────────────────────────────────────────
export const stackRouter = router({
  /** List all active capital stack templates */
  listTemplates: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.execute(sql.raw(
      "SELECT * FROM capital_stack_templates WHERE is_active = 1 ORDER BY is_principal_default DESC, name ASC"
    )) as any;
    return (rows[0] ?? rows) as any[];
  }),

  /** Get the principal default template (Raleigh Keystone) */
  getPrincipalDefault: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.execute(sql.raw(
      "SELECT * FROM capital_stack_templates WHERE is_principal_default = 1 LIMIT 1"
    )) as any;
    const data = rows[0] ?? rows;
    return Array.isArray(data) ? (data[0] ?? null) : null;
  }),

  /** List all stacks for the current user */
  listStacks: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.execute(
      sql`SELECT * FROM capital_stacks WHERE user_id = ${ctx.user.id} ORDER BY updated_at DESC`
    ) as any;
    return (rows[0] ?? rows) as any[];
  }),

  /** Get a single stack with its layers */
  getStack: protectedProcedure
    .input(z.object({ stackId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const stackRows = await db.execute(
        sql`SELECT * FROM capital_stacks WHERE id = ${input.stackId}`
      ) as any;
      const stacks = stackRows[0] ?? stackRows;
      const stack = Array.isArray(stacks) ? stacks[0] : null;
      if (!stack) throw new TRPCError({ code: "NOT_FOUND" });
      if (stack.user_id !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const layerRows = await db.execute(
        sql`SELECT * FROM capital_stack_layers WHERE stack_id = ${input.stackId} ORDER BY layer_order ASC`
      ) as any;
      const layers = layerRows[0] ?? layerRows;
      return { stack, layers: Array.isArray(layers) ? layers : [] };
    }),

  /** Create a new stack from a template */
  createFromTemplate: protectedProcedure
    .input(z.object({
      templateId: z.string(),
      dealId: z.string().optional(),
      dealName: z.string().optional(),
      purchasePrice: z.number().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const tmplRows = await db.execute(
        sql`SELECT * FROM capital_stack_templates WHERE template_id = ${input.templateId} AND is_active = 1`
      ) as any;
      const templates = tmplRows[0] ?? tmplRows;
      const template = Array.isArray(templates) ? templates[0] : null;
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });

      const now = Date.now();
      const stackName = input.dealName ? `${template.name} — ${input.dealName}` : template.name;

      const stackResult = await db.execute(
        sql`INSERT INTO capital_stacks (deal_id, template_id, user_id, name, purchase_price, total_capital, status, created_at, updated_at)
            VALUES (${input.dealId ?? null}, ${input.templateId}, ${ctx.user.id}, ${stackName}, ${input.purchasePrice}, ${input.purchasePrice}, 'draft', ${now}, ${now})`
      ) as any;
      const stackId = (stackResult[0] ?? stackResult)?.insertId as number;

      const defaultLayers = DEFAULT_LAYERS[input.templateId] ?? [];
      for (const layer of defaultLayers) {
        const amount = Math.round((layer.pct_of_total / 100) * input.purchasePrice);
        await db.execute(
          sql`INSERT INTO capital_stack_layers (stack_id, layer_order, layer_type, label, amount, pct_of_total, interest_rate, term_months, lender, notes, created_at)
              VALUES (${stackId}, ${layer.layer_order}, ${layer.layer_type}, ${layer.label}, ${amount}, ${layer.pct_of_total}, ${layer.interest_rate}, ${layer.term_months}, ${layer.lender}, ${layer.notes}, ${now})`
        );
      }

      return { stackId, templateId: input.templateId };
    }),

  /** Update a layer's amount */
  updateLayer: protectedProcedure
    .input(z.object({
      stackId: z.number(),
      layerId: z.number(),
      amount: z.number().nonnegative(),
      interestRate: z.number().optional(),
      termMonths: z.number().optional(),
      lender: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const stackRows = await db.execute(
        sql`SELECT * FROM capital_stacks WHERE id = ${input.stackId}`
      ) as any;
      const stacks = stackRows[0] ?? stackRows;
      const stack = Array.isArray(stacks) ? stacks[0] : null;
      if (!stack || stack.user_id !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const totalCapital = stack.purchase_price ?? 1;
      const pct = (input.amount / totalCapital) * 100;

      await db.execute(
        sql`UPDATE capital_stack_layers SET amount = ${input.amount}, pct_of_total = ${pct},
            interest_rate = COALESCE(${input.interestRate ?? null}, interest_rate),
            term_months = COALESCE(${input.termMonths ?? null}, term_months),
            lender = COALESCE(${input.lender ?? null}, lender),
            notes = COALESCE(${input.notes ?? null}, notes)
            WHERE id = ${input.layerId} AND stack_id = ${input.stackId}`
      );
      await db.execute(sql`UPDATE capital_stacks SET updated_at = ${Date.now()} WHERE id = ${input.stackId}`);
      return { success: true };
    }),

  /** Delete a stack */
  deleteStack: protectedProcedure
    .input(z.object({ stackId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const stackRows = await db.execute(
        sql`SELECT * FROM capital_stacks WHERE id = ${input.stackId}`
      ) as any;
      const stacks = stackRows[0] ?? stackRows;
      const stack = Array.isArray(stacks) ? stacks[0] : null;
      if (!stack || stack.user_id !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await db.execute(sql`DELETE FROM capital_stack_layers WHERE stack_id = ${input.stackId}`);
      await db.execute(sql`DELETE FROM capital_stacks WHERE id = ${input.stackId}`);
      return { success: true };
    }),
});
