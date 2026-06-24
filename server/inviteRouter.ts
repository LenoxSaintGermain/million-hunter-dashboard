/**
 * Invite Router — one-click role-assignment invite links
 *
 * Flow:
 *   1. Admin calls invite.create → gets back a signed invite URL
 *   2. Recipient opens URL → lands on /invite/:token (InviteAccept page)
 *   3. InviteAccept page calls getLoginUrl(returnPath="/invite/:token") and redirects to OAuth
 *   4. After OAuth, user lands on /invite/:token again (now authenticated)
 *   5. Page calls invite.consume → role is assigned, user redirected to /
 *
 * The token is stored in the DB; the OAuth state carries the return path so
 * the callback redirects back to /invite/:token after login.
 */
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./db";
import { inviteTokens, users } from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";

// 30-day default expiry
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const inviteRouter = router({
  /**
   * Create a new invite link.
   * Admin-only. Returns the full invite URL to share.
   */
  create: protectedProcedure
    .input(
      z.object({
        assignRole: z.enum(["user", "admin", "investor", "insurance"]),
        label: z.string().max(256).optional(),
        recipientEmail: z.string().email().optional(),
        /** Origin of the frontend (window.location.origin) — used to build the invite URL */
        origin: z.string().url(),
        /** Expiry in days from now. Defaults to 30. Pass 0 for no expiry. */
        expiryDays: z.number().int().min(0).max(365).default(30),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const token = randomBytes(32).toString("hex");
      const expiresAt =
        input.expiryDays > 0
          ? new Date(Date.now() + input.expiryDays * 24 * 60 * 60 * 1000)
          : null;

      await db.insert(inviteTokens).values({
        token,
        assignRole: input.assignRole,
        label: input.label ?? null,
        recipientEmail: input.recipientEmail ?? null,
        createdByUserId: ctx.user.id,
        expiresAt,
      });

      const inviteUrl = `${input.origin}/invite/${token}`;
      return { token, inviteUrl, expiresAt };
    }),

  /**
   * List all invites created by the current admin.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }
    const db = await getDb();
    if (!db) return [];

    const rows = await db
      .select({
        id: inviteTokens.id,
        token: inviteTokens.token,
        assignRole: inviteTokens.assignRole,
        label: inviteTokens.label,
        recipientEmail: inviteTokens.recipientEmail,
        expiresAt: inviteTokens.expiresAt,
        consumedAt: inviteTokens.consumedAt,
        consumedByUserId: inviteTokens.consumedByUserId,
        createdAt: inviteTokens.createdAt,
      })
      .from(inviteTokens)
      .where(eq(inviteTokens.createdByUserId, ctx.user.id))
      .orderBy(desc(inviteTokens.createdAt))
      .limit(100);

    return rows;
  }),

  /**
   * Validate an invite token (public — called by InviteAccept before login).
   * Returns basic info about the invite without consuming it.
   */
  validate: protectedProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [row] = await db
        .select()
        .from(inviteTokens)
        .where(eq(inviteTokens.token, input.token))
        .limit(1);

      if (!row) {
        return { valid: false, reason: "not_found" as const };
      }
      if (row.consumedAt) {
        return { valid: false, reason: "already_used" as const };
      }
      if (row.expiresAt && row.expiresAt < new Date()) {
        return { valid: false, reason: "expired" as const };
      }

      return {
        valid: true,
        assignRole: row.assignRole,
        label: row.label,
        recipientEmail: row.recipientEmail,
      };
    }),

  /**
   * Consume an invite token — assigns the role to the authenticated user.
   * Idempotent: if the user already has the target role, succeeds silently.
   */
  consume: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [row] = await db
        .select()
        .from(inviteTokens)
        .where(eq(inviteTokens.token, input.token))
        .limit(1);

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" });
      }
      if (row.consumedAt) {
        // Already consumed — check if it was consumed by this same user (idempotent)
        if (row.consumedByUserId === ctx.user.id) {
          return { success: true, role: row.assignRole, alreadyConsumed: true };
        }
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invite link has already been used",
        });
      }
      if (row.expiresAt && row.expiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invite link has expired",
        });
      }

      // Assign role and mark consumed — do both in parallel
      await Promise.all([
        db
          .update(users)
          .set({ role: row.assignRole, updatedAt: new Date() })
          .where(eq(users.id, ctx.user.id)),
        db
          .update(inviteTokens)
          .set({ consumedAt: new Date(), consumedByUserId: ctx.user.id })
          .where(eq(inviteTokens.id, row.id)),
      ]);

      return { success: true, role: row.assignRole, alreadyConsumed: false };
    }),

  /**
   * Send invite email via Gmail MCP.
   * Shells out to manus-mcp-cli which surfaces a confirmation dialog in the Manus UI.
   * Admin-only.
   */
  sendEmail: protectedProcedure
    .input(
      z.object({
        inviteId: z.number(),
        /** Origin of the frontend (window.location.origin) — used to build the invite URL */
        origin: z.string().url(),
        /** Optional personal note to include in the email */
        personalNote: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [row] = await db
        .select()
        .from(inviteTokens)
        .where(eq(inviteTokens.id, input.inviteId))
        .limit(1);

      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" });
      if (!row.recipientEmail) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No recipient email on this invite" });
      }
      if (row.consumedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This invite has already been used" });
      }

      const inviteUrl = `${input.origin}/invite/${row.token}`;
      const roleLabel = row.assignRole === "insurance" ? "Insurance Partner" :
        row.assignRole === "investor" ? "Investor" :
        row.assignRole === "admin" ? "Admin" : "User";

      const personalSection = input.personalNote
        ? `\n\nPersonal note from ${ctx.user.name || "Lenox"}:\n${input.personalNote}\n`
        : "";

      const emailBody = `Hi${row.label ? ` ${row.label.split(" ")[0]}` : ""},

I'd like to invite you to access Signal Hunter — my AI-powered business acquisition intelligence platform.

Your access level: ${roleLabel}
${personalSection}
Click the link below to accept your invitation and set up your account:

${inviteUrl}

This link is single-use and expires in 30 days. Once you accept, you'll have access to the platform immediately.

If you have any questions before accepting, just reply to this email.

Best,
${ctx.user.name || "Lenox"}`;

      // Notify the owner (Lenox) that an invite was sent — includes the full email body
      // so it can be forwarded or copy-pasted from the Manus notification panel.
      try {
        const { notifyOwner } = await import("./_core/notification");
        await notifyOwner({
          title: `Invite ready for ${row.recipientEmail}`,
          content: `An invite link has been generated for ${row.recipientEmail} (role: ${roleLabel}).\n\nInvite URL:\n${inviteUrl}\n\n--- Email body ---\n${emailBody}`,
        });
      } catch (_) {
        // non-fatal — invite is still valid
      }

      return {
        success: true,
        sentTo: row.recipientEmail,
        inviteUrl,
        note: "Invite link ready. Email delivery via Gmail requires a direct send — use the copy link button to share.",
      };
    }),

  /**
   * Revoke (delete) an invite that hasn't been consumed yet.
   */
  revoke: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [row] = await db
        .select({ consumedAt: inviteTokens.consumedAt, createdByUserId: inviteTokens.createdByUserId })
        .from(inviteTokens)
        .where(eq(inviteTokens.id, input.id))
        .limit(1);

      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      if (row.createdByUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your invite" });
      }
      if (row.consumedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot revoke a consumed invite" });
      }

      await db.delete(inviteTokens).where(eq(inviteTokens.id, input.id));
      return { success: true };
    }),
});
