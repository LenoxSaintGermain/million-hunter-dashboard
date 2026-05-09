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
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2, Link2 } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  insurance: "Insurance Partner",
  investor: "Investor",
  admin: "Administrator",
  user: "Member",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  insurance: "Access the Insurance Prospector — score commercial insurance prospects from the live deal pipeline, generate pre-call briefs, and manage your prospect list.",
  investor: "Access the full acquisition intelligence platform — deal pipeline, thesis engine, TIDE capital flow intelligence, and investment memos.",
  admin: "Full platform access including user management, admin panel, and all features.",
  user: "Access the Signal Hunter platform.",
};

export default function InviteAccept() {
  const [, params] = useRoute("/invite/:token");
  const [, navigate] = useLocation();
  const token = params?.token ?? "";

  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [consumed, setConsumed] = useState(false);
  const [consumeError, setConsumeError] = useState<string | null>(null);

  // Validate the token (works even before login)
  const { data: validation, isLoading: validating } = trpc.invite.validate.useQuery(
    { token },
    { enabled: !!token && isAuthenticated, retry: false }
  );

  // Consume mutation
  const consume = trpc.invite.consume.useMutation({
    onSuccess: (data) => {
      setConsumed(true);
      // Brief pause so the user sees the success state, then redirect
      setTimeout(() => navigate("/"), 2000);
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

  // Build the login URL with the invite path as returnPath
  const loginUrl = (() => {
    const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
    const appId = import.meta.env.VITE_APP_ID;
    const redirectUri = `${window.location.origin}/api/oauth/callback`;
    // Encode origin + returnPath in state so the callback redirects back here
    const statePayload = btoa(
      JSON.stringify({ origin: window.location.origin, returnPath: `/invite/${token}` })
    );
    const url = new URL(`${oauthPortalUrl}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", statePayload);
    url.searchParams.set("type", "signIn");
    return url.toString();
  })();

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (authLoading || (isAuthenticated && validating)) {
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
            Redirecting you to the platform…
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Loading dashboard…</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Error states ─────────────────────────────────────────────────────────────
  if (isAuthenticated && validation && !validation.valid) {
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
  // We don't know the role until after login (token validation requires auth),
  // so show a generic welcome with the platform branding.
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
            You've been granted access to the <strong>Signal Hunter acquisition intelligence platform</strong>. 
            Sign in with your Google account to activate your access.
          </p>
        </div>

        {/* What you'll get */}
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">What you'll access</p>
          <ul className="space-y-1.5">
            {[
              "Live deal pipeline — ranked acquisition opportunities",
              "Insurance Prospector — commercial prospect scoring",
              "Capital flow intelligence — TIDE macro signals",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--sh-amber)" }} />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <a href={loginUrl} className="block">
          <Button
            className="w-full h-11 font-semibold text-sm"
            style={{
              background: "var(--sh-amber)",
              color: "oklch(0.13 0.02 250)",
              border: "none",
            }}
          >
            Accept Invite & Sign In
          </Button>
        </a>

        <p className="text-[11px] text-muted-foreground text-center">
          By accepting, you agree to use this platform in accordance with the operator's terms.
          This invite is single-use and expires in 30 days.
        </p>
      </div>
    </div>
  );
}
