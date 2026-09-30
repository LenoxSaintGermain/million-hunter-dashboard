import { useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Link } from "wouter";
import { HunterPublicShell } from "@/components/HunterPublicShell";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/lib/firebaseAuth";
import { sanitizeReturnPath } from "@shared/authRouting";

function readReturnPath() {
  if (typeof window === "undefined") return "/";
  return sanitizeReturnPath(new URLSearchParams(window.location.search).get("returnPath"));
}

export default function FirebaseSignIn() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const continueWithGoogle = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const idToken = await signInWithGoogle();
      const response = await fetch("/api/auth/firebase/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Could not establish a secure session");
      }
      window.location.replace(readReturnPath());
    } catch (cause) {
      const code = typeof cause === "object" && cause && "code" in cause
        ? String((cause as { code?: unknown }).code)
        : "";
      if (code.includes("popup-closed-by-user")) {
        setError("Sign-in was closed before it finished. Choose Continue with Google to try again.");
      } else if (code.includes("popup-blocked")) {
        setError("Your browser blocked the sign-in window. Allow pop-ups for this site, then try again.");
      } else {
        setError(cause instanceof Error ? cause.message : "Sign-in could not be completed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <HunterPublicShell><main className="hunter-public-main hunter-signin">
      <div>
        <header className="sr-only">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-[8px] bg-[var(--ink)] text-[var(--bone)]">
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--sh-fg-3)]">Third Signal Lab</p>
              <p className="text-sm font-semibold">Signal Hunter OS</p>
            </div>
          </div>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--sh-fg-4)] sm:block">Multi-Asset Diligence & Decision Suite</span>
        </header>

        <section className="hunter-spread">
          <div>
            <p className="hunter-eyebrow">Return to your research desk</p>
            <h1>Your next decision starts here.</h1>
            <p className="hunter-lead">Sign in with the account you use for Signal Hunter. Your assigned permissions determine the workspaces you can open.</p>
            <Link href="/walkthrough" className="inline-flex items-center gap-2 underline py-3">Just exploring? Work through a sample <ArrowRight size={16} /></Link>
          </div>

          <aside className="hunter-access-form" aria-labelledby="signin-heading">
            <div className="border-b border-[var(--rule)] px-6 py-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--sh-fg-3)]">Continue to your workspace</p>
              <h2 id="signin-heading" className="mt-2 font-display text-2xl">Open your desk.</h2>
            </div>
            <div className="space-y-5 p-6">
              <div className="flex items-start gap-3 border-b border-rule pb-4">
                <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <p className="text-sm leading-6 text-[var(--sh-fg-2)]">Google confirms your identity. Signing in does not approve a deal, grant administrator access or submit an order.</p>
              </div>
              <Button className="min-h-12 w-full justify-between bg-[var(--ink)] px-5 text-[var(--bone)] hover:bg-[var(--ink)]/90" disabled={submitting} onClick={continueWithGoogle}>
                <span>{submitting ? "Verifying account…" : "Continue with Google"}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              {error ? <p role="alert" className="border-l-2 border-amber pl-3 text-sm leading-5">{error}</p> : null}
              <p role="status" className="text-xs text-muted-foreground">{submitting ? "Waiting for identity confirmation and a workspace session…" : "No invitation yet?"} {!submitting && <Link href="/#request-access" className="underline">Request access</Link>}</p>
            </div>
          </aside>
        </section>
      </div>
    </main></HunterPublicShell>
  );
}
