import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

const RELEASE_SHA = import.meta.env.VITE_RELEASE_SHA || "unavailable";

export default function AuthUnavailable() {
  return (
    <main className="min-h-screen bg-[var(--bone)] text-[var(--ink)]">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between border-b border-[var(--rule)] pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-[8px] bg-[var(--ink)] text-[var(--bone)]">
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--sh-fg-3)]">
                Third Signal · Capital Aperture
              </p>
              <p className="text-sm font-semibold">Access checkpoint</p>
            </div>
          </div>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--sh-fg-4)] sm:block">
            Paper research · no orders
          </span>
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.25fr_0.75fr] lg:py-20">
          <div>
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--amber)]">
              Sign-in is being connected
            </p>
            <h1 className="max-w-3xl font-display text-4xl leading-[1.05] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
              The research workspace is protected. The public walkthrough is ready now.
            </h1>
            <p className="mt-6 max-w-2xl text-[15px] leading-7 text-[var(--sh-fg-2)]">
              This Third Signal deployment is healthy, but its identity provider is not yet available on this host. We stopped here instead of showing an empty screen or opening an unverified session.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/walkthrough" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[var(--ink)] px-5 text-sm font-semibold text-[var(--bone)] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--amber)]">
                Open the guided walkthrough
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/brief" className="inline-flex min-h-11 items-center justify-center rounded-[8px] border border-[var(--rule)] bg-[var(--paper)] px-5 text-sm font-semibold transition-colors hover:bg-[var(--sh-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--amber)]">
                View the product brief
              </Link>
            </div>
          </div>

          <aside className="overflow-hidden rounded-[12px] border border-[var(--rule)] bg-[var(--paper)]">
            <div className="border-b border-[var(--rule)] px-5 py-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--sh-fg-3)]">Deployment state</p>
            </div>
            <div className="space-y-5 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-[var(--sage)]" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold">Fail-closed access</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--sh-fg-3)]">No account data or operator controls are exposed without a verified identity.</p>
                </div>
              </div>
              <dl className="grid gap-3 border-t border-[var(--rule)] pt-4 font-mono text-[11px]">
                <div className="flex items-center justify-between gap-4">
                  <dt className="uppercase tracking-[0.12em] text-[var(--sh-fg-4)]">Application</dt>
                  <dd>Healthy</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="uppercase tracking-[0.12em] text-[var(--sh-fg-4)]">Identity</dt>
                  <dd className="text-[var(--amber)]">Configuration required</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="uppercase tracking-[0.12em] text-[var(--sh-fg-4)]">Release</dt>
                  <dd>{RELEASE_SHA.slice(0, 8)}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
