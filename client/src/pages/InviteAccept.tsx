/**
 * InviteAccept — one-click invite landing page
 *
 * Flow:
 *   1. Recipient opens /invite/:token
 *   2. If not logged in → show invite preview + "Accept & Sign In" button
 *      (redirects to OAuth with returnPath=/invite/:token encoded in state)
 *   3. After OAuth callback, user lands here again (now authenticated)
 *   4. Page auto-calls invite.consume → role assigned → redirect to /
 */
import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2, Link2 } from "lucide-react";
import { getLoginUrl } from "@/const";

const ROLE_LABELS: Record<string, string> = {
  insurance: "Insurance Partner",
  investor: "Investor",
  capital_operator: "Capital Operator",
  admin: "Administrator",
  user: "Member",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  insurance: "Access the Insurance Prospector — score commercial insurance prospects from the live deal pipeline, generate pre-call briefs, and manage your prospect list.",
  investor: "Access the full acquisition intelligence platform — deal pipeline, thesis engine, TIDE capital flow intelligence, and investment memos.",
  capital_operator: "Access the paper-only Capital Aperture workspace, thesis builder, evidence review, and human-approved paper decision flow.",
  admin: "Full platform access including user management, admin panel, and all features.",
  user: "Access the Signal Hunter platform.",
};

export default function InviteAccept() {
  const [, params] = useRoute("/invite/:token");
  const [, navigate] = useLocation();
  const token = params?.token ?? "";

  const { loading: authLoading, isAuthenticated } = useAuth();
  const [consumed, setConsumed] = useState(false);
  const [consumeError, setConsumeError] = useState<string | null>(null);

  // Validate the token (works even before login)
  const { data: validation, isLoading: validating } = trpc.invite.validate.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  // Consume mutation
  const consume = trpc.invite.consume.useMutation({
    onSuccess: (data) => {
      setConsumed(true);
      // Brief pause so the user sees the success state, then redirect
      setTimeout(() => navigate(data.role === "capital_operator" ? "/aperture" : "/"), 1500);
    },
    onError: (e) => {
      setConsumeError(e.message);
    },
  });

  // Auto-consume once authenticated and validation passes
  useEffect(() => {
    if (
      isAuthenticated &&
      validation?.valid &&
      !consumed &&
      !consume.isPending &&
      !consumeError
    ) {
      consume.mutate({ token });
    }
  }, [isAuthenticated, validation?.valid]);

  const loginUrl = getLoginUrl(`/invite/${token}`);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (authLoading || validating) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--sh-amber)" }} />
          <p className="text-sm text-muted-foreground">Verifying invite…</p>
        </div>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────────
  if (consumed) {
    const role = validation?.assignRole ?? consume.data?.role ?? "user";
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--background)" }}>
        <div
          className="max-w-md w-full rounded-2xl border p-8 text-center space-y-4"
          style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border)" }}
        >
          <CheckCircle2 className="w-12 h-12 mx-auto" style={{ color: "var(--sh-amber)" }} />
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}>
            Welcome to Signal Hunter
          </h1>
          <p className="text-sm text-muted-foreground">
            You've been granted <strong className="text-foreground">{ROLE_LABELS[role] ?? role}</strong> access.
            Redirecting you to {role === "capital_operator" ? "Capital Aperture" : "the platform"}…
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Loading your workspace…</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Error states ─────────────────────────────────────────────────────────────
  if (validation && !validation.valid) {
    const reasonMessages: Record<string, string> = {
      not_found: "This invite link doesn't exist or has been revoked.",
      already_used: "This invite link has already been used.",
      expired: "This invite link has expired. Ask the sender to generate a new one.",
    };
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--background)" }}>
        <div
          className="max-w-md w-full rounded-2xl border p-8 text-center space-y-4"
          style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border)" }}
        >
          <AlertTriangle className="w-12 h-12 mx-auto text-amber-500" />
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}>
            Invite Unavailable
          </h1>
          <p className="text-sm text-muted-foreground">
            {(validation.reason ? reasonMessages[validation.reason] : null) ?? "This invite link is not valid."}
          </p>
          <Button variant="outline" onClick={() => navigate("/")} className="mt-2">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (consumeError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--background)" }}>
        <div
          className="max-w-md w-full rounded-2xl border p-8 text-center space-y-4"
          style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border)" }}
        >
          <AlertTriangle className="w-12 h-12 mx-auto text-red-500" />
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}>
            Could Not Accept Invite
          </h1>
          <p className="text-sm text-muted-foreground">{consumeError}</p>
          <Button variant="outline" onClick={() => navigate("/")} className="mt-2">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // ── Pre-login: show invite preview ───────────────────────────────────────────
  const invitedRole = validation?.valid ? (validation.assignRole ?? "user") : "user";
  const capitalInvite = invitedRole === "capital_operator";
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--background)" }}
    >
      {/* Ambient glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 40% at 50% 30%, oklch(0.75 0.18 85 / 0.06) 0%, transparent 70%)",
        }}
      />

      <div
        className="relative max-w-md w-full rounded-2xl border p-8 space-y-6"
        style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--sh-amber)", color: "oklch(0.13 0.02 250)" }}
          >
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="eyebrow text-muted-foreground">Signal Hunter OS</p>
            <h1
              className="text-xl font-bold leading-tight"
              style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
            >
              You've been invited
            </h1>
          </div>
        </div>

        {/* Invite details */}
        <div
          className="rounded-xl border p-4 space-y-3"
          style={{ background: "var(--sh-surface-2)", borderColor: "var(--sh-border)" }}
        >
          <div className="flex items-center gap-2">
            <Link2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-muted-foreground font-mono truncate">{token.slice(0, 16)}…</p>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            You've been invited to <strong>{capitalInvite ? "Capital Aperture" : "Signal Hunter"}</strong>.
            {validation?.valid && validation.label ? ` Your workspace will display as ${validation.label}.` : ""}
            {validation?.valid && validation.recipientHint ? ` Sign in with ${validation.recipientHint}.` : " Sign in with the invited Google account."}
          </p>
        </div>

        {/* What you'll get */}
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">What you'll access</p>
          <ul className="space-y-1.5">
            {(capitalInvite ? [
              "Start with a thesis, or build one in the workspace",
              "Mirror current holdings and plays without creating an order",
              "Review researched paper plays with explicit risk gates",
              "Approve and submit only to a named paper account",
            ] : [
              "Signal Hunter workspace access",
              ROLE_DESCRIPTIONS[invitedRole] ?? ROLE_DESCRIPTIONS.user,
            ]).map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--sh-amber)" }} />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        {loginUrl ? <a href={loginUrl} className="block">
          <Button
            className="w-full h-11 font-semibold text-sm"
            style={{
              background: "var(--sh-amber)",
              color: "oklch(0.13 0.02 250)",
              border: "none",
            }}
          >
            Continue with Google
          </Button>
        </a> : <div className="space-y-2"><Button className="w-full h-11 font-semibold text-sm" disabled>Sign-in temporarily unavailable</Button><p role="alert" className="text-center text-xs text-muted-foreground">This invite is still valid and has not been consumed. Ask the sender to finish sign-in setup, then reopen this link.</p></div>}

        <p className="text-[11px] text-muted-foreground text-center">
          {capitalInvite ? "Paper research only — not investment advice. No real-money trading is enabled. " : ""}
          This invite is single-use{validation?.valid && validation.expiresAt ? ` and expires ${new Date(validation.expiresAt).toLocaleDateString()}` : ""}.
        </p>
      </div>
    </div>
  );
}
