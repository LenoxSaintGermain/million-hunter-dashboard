import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Menu,
  LogOut,
  Settings,
  User,
  ChevronDown,
  Scan,
  LayoutDashboard,
  FileText,
  Mail,
  TrendingUp,
  Radar,
  Map,
  Layers,
  Zap,
  Shield,
  BookOpen,
  Building2,
  BarChart3,
  Target,
  Users,
  ShieldCheck,
  Waves,
} from "lucide-react";

/* ── Nav items ─────────────────────────────────────────────────────────────── */
const PRIMARY_NAV = [
  { label: "Command Center", href: "/", icon: LayoutDashboard },
  { label: "TIDE", href: "/tide", icon: Zap },
  { label: "Memos", href: "/memos", icon: FileText },
  { label: "Outreach", href: "/outreach", icon: Mail },
];

const MORE_NAV = [
  { label: "Freedom Map", href: "/freedom-map", icon: Map },
  { label: "Strategy Blender", href: "/strategy-blender", icon: Layers },
  { label: "Scout", href: "/scout", icon: Target },
  { label: "Thesis Engine", href: "/thesis", icon: BookOpen },
  { label: "Capital Stack", href: "/stack", icon: BarChart3 },
  { label: "Investor Dossier", href: "/investor-dossier", icon: Building2 },
  { label: "Insurance Prospector", href: "/insurance-prospector", icon: Shield },
  { label: "RippleEffect", href: "/ripple", icon: Waves },
];

// Labs — Sonar-powered live research
const LABS_NAV = [
  { label: "Market Scan", href: "/scan", icon: Scan, badge: "Sonar" },
  { label: "Opportunity Radar", href: "/opportunity-radar", icon: Radar, badge: "Live" },
];

/* ── NavLink ────────────────────────────────────────────────────────────────── */
function NavLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link href={href} onClick={onClick}>
      <span
        className={cn(
          "relative text-[13px] font-medium tracking-wide transition-colors duration-200 cursor-pointer",
          "after:absolute after:bottom-[-2px] after:left-0 after:h-[1px] after:bg-[var(--ink)] after:transition-all after:duration-300",
          active
            ? "text-[var(--ink)] after:w-full"
            : "text-[var(--sh-fg-3)] hover:text-[var(--ink)] after:w-0 hover:after:w-full"
        )}
      >
        {label}
      </span>
    </Link>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────────── */
export default function EditorialTopNav({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const userRole = (user as any)?.role as string | undefined;
  const isAdmin = userRole === "admin";
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  /* Scroll detection for header blur */
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  const hasMoreActive = MORE_NAV.some((n) => isActive(n.href));

  return (
    <div className="min-h-screen bg-[var(--bone)]">
      {/* ── Top Nav ─────────────────────────────────────────────────────────── */}
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          scrolled
            ? "bg-[var(--paper)]/90 backdrop-blur-md border-b border-[var(--rule)] shadow-[0_1px_0_0_var(--rule)]"
            : "bg-[var(--paper)] border-b border-[var(--rule)]"
        )}
        style={{ height: "56px" }}
      >
        <div className="max-w-[1280px] mx-auto px-6 h-full flex items-center justify-between gap-8">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer shrink-0">
              <div
                className="w-7 h-7 rounded-sm flex items-center justify-center"
                style={{ background: "var(--ink)" }}
              >
                <TrendingUp className="w-4 h-4 text-[var(--bone)]" />
              </div>
              <div className="flex flex-col leading-none">
                <span
                  className="text-[13px] font-semibold tracking-tight text-[var(--ink)]"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  Signal Hunter
                </span>
                <span
                  className="text-[9px] tracking-[0.18em] uppercase text-[var(--sh-fg-4)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  OS Editorial
                </span>
              </div>
            </div>
          </Link>

          {/* Primary Nav — desktop */}
          <nav className="hidden md:flex items-center gap-7">
            {PRIMARY_NAV.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={isActive(item.href)}
              />
            ))}

            {/* More dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-1 text-[13px] font-medium tracking-wide transition-colors duration-200 outline-none",
                    hasMoreActive
                      ? "text-[var(--ink)]"
                      : "text-[var(--sh-fg-3)] hover:text-[var(--ink)]"
                  )}
                >
                  More
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 bg-[var(--paper)] border-[var(--rule)] shadow-lg"
              >
                {MORE_NAV.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={item.href}>
                        <span
                          className={cn(
                            "flex items-center gap-2.5 w-full text-[13px] cursor-pointer",
                            isActive(item.href)
                              ? "text-[var(--ink)] font-medium"
                              : "text-[var(--sh-fg-2)]"
                          )}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          {item.label}
                        </span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator className="bg-[var(--rule)]" />
                <div className="px-3 py-1">
                  <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--sh-fg-4)] font-medium">Labs</p>
                </div>
                {LABS_NAV.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={item.href}>
                        <span
                          className={cn(
                            "flex items-center gap-2.5 w-full text-[13px] cursor-pointer",
                            isActive(item.href)
                              ? "text-[var(--ink)] font-medium"
                              : "text-[var(--sh-fg-4)]"
                          )}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          {item.label}
                          <span className="ml-auto text-[10px] font-medium text-amber-600">{item.badge}</span>
                        </span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-3">

            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 outline-none group">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-[var(--bone)] transition-opacity group-hover:opacity-80"
                      style={{ background: "var(--ink)" }}
                    >
                      {(user as any)?.name?.charAt(0)?.toUpperCase() ?? "L"}
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--sh-fg-3)] hidden sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 bg-[var(--paper)] border-[var(--rule)]"
                >
                  <div className="px-3 py-2 border-b border-[var(--rule)]">
                    <p className="text-[12px] font-medium text-[var(--ink)] truncate">
                      {(user as any)?.name ?? "Lenox"}
                    </p>
                    <p className="text-[11px] text-[var(--sh-fg-4)] truncate">
                      {(user as any)?.email ?? "Operator"}
                    </p>
                  </div>
                  <DropdownMenuItem asChild>
                    <Link href="/profile">
                      <span className="flex items-center gap-2 text-[13px] text-[var(--sh-fg-2)] cursor-pointer w-full">
                        <User className="w-3.5 h-3.5" />
                        Operator Identity
                      </span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <span className="flex items-center gap-2 text-[13px] text-[var(--sh-fg-2)] cursor-pointer w-full">
                        <Settings className="w-3.5 h-3.5" />
                        Settings
                      </span>
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator className="bg-[var(--rule)]" />
                      <div className="px-3 py-1">
                        <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--sh-fg-4)] font-medium">Admin</p>
                      </div>
                      <DropdownMenuItem asChild>
                        <Link href="/admin">
                          <span className="flex items-center gap-2 text-[13px] text-[var(--sh-fg-2)] cursor-pointer w-full">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Admin Panel
                          </span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/operator-registry">
                          <span className="flex items-center gap-2 text-[13px] text-[var(--sh-fg-2)] cursor-pointer w-full">
                            <Users className="w-3.5 h-3.5" />
                            Operator Registry
                          </span>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator className="bg-[var(--rule)]" />
                  <DropdownMenuItem
                    onClick={() => logout()}
                    className="text-[var(--clay)] focus:text-[var(--clay)]"
                  >
                    <LogOut className="w-3.5 h-3.5 mr-2" />
                    <span className="text-[13px]">Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                size="sm"
                className="h-8 px-4 text-[12px] rounded-full bg-[var(--ink)] text-[var(--bone)] hover:opacity-90"
                onClick={() => (window.location.href = getLoginUrl())}
              >
                Sign in
              </Button>
            )}

            {/* Mobile menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-8 w-8 text-[var(--sh-fg-2)]"
                >
                  <Menu className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-72 bg-[var(--paper)] border-[var(--rule)] p-0"
              >
                <div className="flex flex-col h-full">
                  {/* Mobile nav header */}
                  <div className="px-6 py-5 border-b border-[var(--rule)]">
                    <p
                      className="text-[11px] tracking-[0.18em] uppercase text-[var(--sh-fg-4)]"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      Navigation
                    </p>
                  </div>

                  {/* Mobile nav items */}
                  <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                    {[...PRIMARY_NAV, ...MORE_NAV].map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                        >
                          <div
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors cursor-pointer",
                              active
                                ? "bg-[var(--bone)] text-[var(--ink)]"
                                : "text-[var(--sh-fg-2)] hover:bg-[var(--bone)] hover:text-[var(--ink)]"
                            )}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="text-[13px] font-medium">{item.label}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </nav>

                  {/* Mobile footer */}
                  {isAuthenticated && (
                    <div className="px-4 py-4 border-t border-[var(--rule)]">
                      <button
                        onClick={() => { logout(); setMobileOpen(false); }}
                        className="flex items-center gap-2 text-[13px] text-[var(--clay)] w-full px-3 py-2"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* ── Page Content ────────────────────────────────────────────────────── */}
      <main style={{ paddingTop: "56px" }}>
        {children}
      </main>
    </div>
  );
}
