import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, FileText, Landmark, LayoutDashboard, ListTodo, Route, Wallet } from "lucide-react";
import EditorialTopNav from "@/components/EditorialTopNav";
import { cn } from "@/lib/utils";
import { OPERATING_INVARIANT } from "@shared/operatingInvariant";
import { CapitalCockpitRail } from "@/components/aperture/CapitalCockpitRail";
import { useAuth } from "@/_core/hooks/useAuth";
import { aperturePathForFixture, readIsolatedUatIdentity } from "@shared/isolatedUatIdentity";

const APERTURE_NAV = [
  { href: "/aperture", label: "Today", icon: LayoutDashboard },
  { href: "/aperture/mission", label: "Mission", icon: FileText },
  { href: "/aperture/plays", label: "Play Desk", icon: ListTodo },
  { href: "/aperture/runs", label: "Research", icon: Route },
  { href: "/aperture/accounts", label: "Portfolio", icon: Wallet },
  { href: "/aperture/theses", label: "Theses", icon: BookOpen },
  { href: "/thesis", label: "New thesis", icon: BookOpen },
] as const;

const TRADER_NAV = [
  { href: "/aperture", label: "Today", icon: LayoutDashboard },
  { href: "/aperture/mission", label: "Mission", icon: FileText },
  { href: "/aperture/plays", label: "Play Desk", icon: ListTodo },
  { href: "/aperture/runs", label: "Follow-ups", icon: Route },
  { href: "/aperture/accounts", label: "Portfolio", icon: Wallet },
  { href: "/thesis", label: "Theses", icon: BookOpen },
  { href: "/aperture/record", label: "Record", icon: FileText },
] as const;

export default function ApertureShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const runId = Number(location.match(/^\/aperture\/run\/(\d+)/)?.[1]) || undefined;
  const nav = user?.defaultWorkspace === "capital_aperture_trader" ? TRADER_NAV : APERTURE_NAV;

  return (
    <EditorialTopNav workspaceId="aperture-workspace">
      {/* One banded row: identity, the paper-only boundary and the menu. A second
          stacked band cost 211px before any decision text on every route.

          The operating invariant does NOT belong in that row. Measured on
          2026-09-12 at a 1498px viewport: the sentence occupies 472px of a
          1280px-capped row that also needs 319px of identity and 603px of menu,
          so the row overflowed by 130px and clipped the last two destinations
          behind a scrollbar. The content cap means the sentence can never fit
          beside the menu at any viewport width. Navigation is not the thing
          that yields, so the invariant gets its own ~20px line — which is the
          cost of a line of text, not a second identity band. */}
      <section data-workspace-bar className="border-b border-rule bg-paper">
        <div className="w-full min-w-0 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10">
          <div data-workspace-row className="flex items-center gap-4 overflow-x-auto">
            <div className="flex shrink-0 items-center gap-2 py-2">
              <div className="w-6 h-6 flex items-center justify-center rounded-sm bg-ink text-bone">
                <Landmark className="w-3.5 h-3.5" />
              </div>
              <span className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest whitespace-nowrap">Capital Aperture</span>
              <span className="inline-flex shrink-0 items-center gap-1.5 border border-amber/30 bg-amber/5 px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber" />
                <span className="font-eyebrow text-eyebrow text-amber uppercase tracking-widest whitespace-nowrap">Paper only</span>
              </span>
            </div>
            <nav data-workspace-menu className="flex shrink-0 min-w-max gap-5 sm:ml-auto" aria-label="Capital Aperture workspace menu">
              {nav.map((item) => {
                const Icon = item.icon;
                const active = item.href === "/aperture"
                  ? location === "/aperture"
                  : location.startsWith(item.href);
                return (
                  <Link key={item.href} href={aperturePathForFixture(item.href, readIsolatedUatIdentity())}>
                    <span className={cn(
                      "flex items-center gap-1.5 whitespace-nowrap border-b-2 py-2.5 sm:py-3 text-[12px] font-medium transition-colors",
                      active ? "border-ink text-ink" : "border-transparent text-muted-foreground hover:text-ink"
                    )}>
                      <Icon className="w-3.5 h-3.5" />
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
          <p data-operating-invariant className="hidden pb-1.5 text-[11px] leading-4 lg:block" style={{ color: "var(--sh-fg-muted)" }}>{OPERATING_INVARIANT}</p>
        </div>
      </section>
      <main id="aperture-workspace" tabIndex={-1} aria-label="Capital Aperture workspace" className="aperture-editorial scroll-mt-16 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 max-w-[1280px] mx-auto w-full px-4 sm:px-6 lg:px-10 py-5 sm:py-8 lg:py-10">
        <CapitalCockpitRail runId={runId} compactOnly={location === "/aperture/plays" || location.startsWith("/aperture/run/")} />
        {children}
      </main>
    </EditorialTopNav>
  );
}
