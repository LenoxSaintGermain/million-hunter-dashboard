import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, FileSearch, FileText, Landmark, LayoutDashboard, Route, Wallet } from "lucide-react";
import EditorialTopNav from "@/components/EditorialTopNav";
import { cn } from "@/lib/utils";
import { CapitalCockpitRail } from "@/components/aperture/CapitalCockpitRail";
import { useAuth } from "@/_core/hooks/useAuth";

const APERTURE_NAV = [
  { href: "/aperture", label: "Decision Center", icon: LayoutDashboard },
  { href: "/aperture/runs", label: "Research Journeys", icon: Route },
  { href: "/aperture/theses", label: "Saved theses", icon: BookOpen },
  { href: "/aperture/disclosures", label: "Disclosure plans", icon: FileSearch },
  { href: "/thesis", label: "New thesis", icon: BookOpen },
  { href: "/aperture/accounts", label: "Accounts", icon: Wallet },
  { href: "/aperture/memos", label: "Memo Library", icon: FileText },
] as const;

const TRADER_NAV = [
  { href: "/aperture", label: "Today", icon: LayoutDashboard },
  { href: "/aperture?setup=1", label: "Why", icon: BookOpen },
  { href: "/aperture/record", label: "Record", icon: FileText },
] as const;

export default function ApertureShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const runId = Number(location.match(/^\/aperture\/run\/(\d+)/)?.[1]) || undefined;
  const nav = user?.defaultWorkspace === "capital_aperture_trader" ? TRADER_NAV : APERTURE_NAV;

  return (
    <EditorialTopNav>
      <section className="border-b border-rule bg-paper">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center rounded-sm bg-ink text-bone">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Capital Aperture</p>
              <p className="font-body-base text-body-base text-ink">Paper portfolio research &amp; re-underwriting</p>
            </div>
          </div>
          <div className="inline-flex w-fit items-center gap-2 border border-amber/30 bg-amber/5 px-2.5 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber" />
            <span className="font-eyebrow text-eyebrow text-amber uppercase tracking-widest">Paper only · operator workspace</span>
          </div>
        </div>
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 overflow-x-auto">
          <nav className="flex min-w-max gap-5" aria-label="Capital Aperture navigation">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/aperture"
                ? location === "/aperture"
                : location.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href}>
                  <span className={cn(
                    "flex items-center gap-1.5 border-b-2 py-3 text-[12px] font-medium transition-colors",
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
      </section>
      <main className="aperture-editorial max-w-[1280px] mx-auto w-full px-6 lg:px-10 py-8 lg:py-10">
        <CapitalCockpitRail runId={runId} />
        {children}
      </main>
    </EditorialTopNav>
  );
}
