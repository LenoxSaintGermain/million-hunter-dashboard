import { TRPCError } from "@trpc/server";
import { ownerProcedure, router } from "../../_core/trpc";
import { getDb } from "../../db";
import { alpacaPaperBroker } from "../brokers";
import { configuredOwnerOpenId, sharedAlpacaKeyOwnerOnly } from "../brokers/envBrokerOwner";
import { practiceBooksConfigured, practiceBooksMode } from "./flags";
import { ensureHouseBaseline, listHouseBaselines, maskAccountNumber } from "./repository";

/** Owner-only UAT controls (`aperture.uat.*`). Every procedure is ownerProcedure. */
export const uatRouter = router({
  status: ownerProcedure.query(async () => {
    const db = await getDb();
    const baselines = db ? await listHouseBaselines(db) : [];
    return {
      mode: practiceBooksMode(),
      practiceBooksConfigured: practiceBooksConfigured(),
      sharedKeyOwnerOnly: sharedAlpacaKeyOwnerOnly(),
      ownerConfigured: Boolean(configuredOwnerOpenId()),
      houseBaselines: baselines.map((baseline) => ({ ...baseline, houseExternalAccountId: maskAccountNumber(baseline.houseExternalAccountId) })),
    };
  }),

  /**
   * Records the house starting snapshot now, if this house has none yet. Reads
   * the house account and positions once; never places, approves or cancels an order.
   */
  captureHouseBaseline: ownerProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "database unavailable" });
    if (!alpacaPaperBroker.available()) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: alpacaPaperBroker.unavailableReason() ?? "Alpaca Paper is not configured." });
    }
    const [account, positions] = await Promise.all([alpacaPaperBroker.getAccount(), alpacaPaperBroker.getPositions()]);
    if (!account.externalAccountId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Alpaca Paper did not return an account number; no baseline was recorded." });
    const { baseline, created } = await ensureHouseBaseline(db, {
      externalAccountId: account.externalAccountId,
      cashCents: account.cashCents,
      buyingPowerCents: account.buyingPowerCents,
      equityValueCents: account.equityValueCents,
      positions,
    }, ctx.user.id, Date.now());
    return { created, capturedAt: baseline.capturedAt, houseExternalAccountId: maskAccountNumber(baseline.houseExternalAccountId) };
  }),
});
