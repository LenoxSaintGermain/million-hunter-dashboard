import { useState } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
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
    <main className="min-h-screen bg-[var(--bone)] text-[var(--ink)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between border-b border-[var(--rule)] pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-[8px] bg-[var(--ink)] text-[var(--bone)]">
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--sh-fg-3)]">Third Signal</p>
              <p className="text-sm font-semibold">Capital Aperture</p>
            </div>
          </div>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--sh-fg-4)] sm:block">Paper research · human approval</span>
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
          <div>
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--amber)]">Verified operator access</p>
            <h1 className="max-w-3xl font-display text-4xl leading-[1.04] tracking-[-0.035em] sm:text-5xl lg:text-6xl">Turn a market thesis into a clear, risk-bounded paper play.</h1>
            <p className="mt-6 max-w-2xl text-[15px] leading-7 text-[var(--sh-fg-2)]">Sign in with the Google account tied to your invitation. Your thesis, portfolio context, research, and approvals remain attached to your operator profile.</p>
          </div>

          <aside className="overflow-hidden rounded-[12px] border border-[var(--rule)] bg-[var(--paper)]">
            <div className="border-b border-[var(--rule)] px-6 py-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--sh-fg-3)]">Continue to your workspace</p>
              <h2 className="mt-2 font-display text-2xl">Operator sign-in</h2>
            </div>
            <div className="space-y-5 p-6">
              <div className="flex items-start gap-3 rounded-[8px] bg-[var(--sh-surface)] p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sage)]" aria-hidden="true" />
                <p className="text-sm leading-6 text-[var(--sh-fg-2)]">We use your verified email to reconnect existing work or accept an email-specific invite. A new identity never inherits another operator’s account.</p>
              </div>
              <Button className="min-h-12 w-full justify-between bg-[var(--ink)] px-5 text-[var(--bone)] hover:bg-[var(--ink)]/90" disabled={submitting} onClick={continueWithGoogle}>
                <span>{submitting ? "Verifying account…" : "Continue with Google"}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              {error ? <p role="alert" className="rounded-[8px] border border-red-300 bg-red-50 p-3 text-sm leading-5 text-red-800">{error}</p> : null}
              <p className="text-center font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--sh-fg-4)]">No real-money access · no automatic orders</p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
