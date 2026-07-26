import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useLocation as useNav } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
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
  Landmark,
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
  Search,
  X,
  ArrowRight,
  MapPin,
  Tag,
} from "lucide-react";

/* ── Nav items ─────────────────────────────────────────────────────────────── */
const PRIMARY_NAV = [
  { label: "Command Center", href: "/", icon: LayoutDashboard },
  { label: "Wingate", href: "/wingate", icon: Landmark },
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

// Labs (Experimental).
// Market Scan = LLM-generated listings (runScanPipeline), NOT live marketplace
// data — it must never carry a "Sonar"/"Live" badge. Opportunity Radar IS
// genuinely sonar-pro backed with citations (005 WP-DR2), so "Live" is honest there.
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

/* ── Global Market Search Palette ──────────────────────────────────────────── */
function GlobalSearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [, navigate] = useNav();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 280);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setDebouncedQ("");
    }
  }, [open]);

  const { data, isLoading } = trpc.publicDeals.search.useQuery(
    { q: debouncedQ || undefined, limit: 6 },
    { enabled: open, staleTime: 30_000 }
  );

  const results = data?.results ?? [];
  const total = data?.total ?? 0;

  const handleSelect = (href: string) => {
    navigate(href);
    onClose();
  };

  const handleViewAll = () => {
    const params = query ? `?q=${encodeURIComponent(query)}` : "";
    navigate(`/explore${params}`);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[80px] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[var(--ink)]/30 backdrop-blur-sm" />

      {/* Palette panel */}
      <div
        className="relative w-full max-w-[620px] bg-[var(--paper)] border border-[var(--rule)] shadow-2xl rounded-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--rule)]">
          <Search className="w-4 h-4 text-[var(--sh-fg-3)] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter") handleViewAll();
            }}
            placeholder="Search market — industry, location, business name..."
            className="flex-1 bg-transparent text-[14px] text-[var(--ink)] placeholder:text-[var(--sh-fg-4)] outline-none"
          />
          <div className="flex items-center gap-1.5">
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-[var(--bone)] border border-[var(--rule)] rounded text-[var(--sh-fg-3)]">ESC</kbd>
            <button onClick={onClose} className="text-[var(--sh-fg-3)] hover:text-[var(--ink)] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {isLoading && debouncedQ && (
            <div className="px-4 py-8 text-center">
              <div className="inline-block w-4 h-4 border-2 border-[var(--sh-fg-3)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <div>
              <div className="px-4 py-2 border-b border-[var(--rule)]">
                <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--sh-fg-4)] font-medium">
                  {debouncedQ ? `${total} result${total !== 1 ? "s" : ""} for "${debouncedQ}"` : `${total} active market listings`}
                </p>
              </div>
              {results.map((deal: any) => (
                <button
                  key={deal.id}
                  onClick={() => handleSelect(`/explore`)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[var(--bone)] transition-colors text-left border-b border-[var(--rule)] last:border-0 group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[var(--ink)] truncate group-hover:text-[var(--sh-accent)] transition-colors">
                      {deal.name}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {deal.industry && (
                        <span className="flex items-center gap-1 text-[11px] text-[var(--sh-fg-3)]">
                          <Tag className="w-2.5 h-2.5" />
                          {deal.industry}
                        </span>
                      )}
                      {deal.location && (
                        <span className="flex items-center gap-1 text-[11px] text-[var(--sh-fg-3)]">
                          <MapPin className="w-2.5 h-2.5" />
                          {deal.location}
                        </span>
                      )}
                    </div>
                  </div>
                  {deal.scoreBlurred !== null && (
                    <span
                      className="text-[12px] font-mono font-bold shrink-0"
                      style={{
                        color: deal.scoreBlurred >= 0.8 ? "#16a34a" : deal.scoreBlurred >= 0.65 ? "#d97706" : "#6b7280"
                      }}
                    >
                      {deal.scoreBlurred.toFixed(2)}
                    </span>
                  )}
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--sh-fg-4)] group-hover:text-[var(--sh-fg-2)] shrink-0" />
                </button>
              ))}
            </div>
          )}

          {!isLoading && results.length === 0 && debouncedQ && (
            <div className="px-4 py-8 text-center">
              <p className="text-[13px] text-[var(--sh-fg-3)]">No results for <span className="font-medium text-[var(--ink)]">"{debouncedQ}"</span></p>
              <p className="text-[11px] text-[var(--sh-fg-4)] mt-1">Try a different industry, city, or business type</p>
            </div>
          )}

          {!isLoading && results.length === 0 && !debouncedQ && (
            <div className="px-4 py-6">
              <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--sh-fg-4)] font-medium mb-3">Quick searches</p>
              <div className="flex flex-wrap gap-2">
                {["Commercial cleaning", "HVAC", "Logistics", "Atlanta, GA", "Chicago, IL", "Historic building"].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      // Historic assets live in Wingate (commercial_assets), not the deal market.
                      if (s === "Historic building") { navigate("/wingate"); onClose(); }
                      else setQuery(s);
                    }}
                    className="text-[12px] px-3 py-1.5 bg-[var(--bone)] hover:bg-[var(--rule)] border border-[var(--rule)] rounded-sm text-[var(--sh-fg-2)] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[var(--rule)] flex items-center justify-between bg-[var(--bone)]/50">
          <div className="flex items-center gap-3">
            <p className="text-[11px] text-[var(--sh-fg-4)]">
              Deal market · <kbd className="font-mono">↵</kbd> for all
            </p>
            <button
              onClick={() => { navigate("/wingate"); onClose(); }}
              className="text-[11px] font-medium text-[var(--amber)] hover:underline"
            >
              Historic assets → Wingate
            </button>
          </div>
          <button
            onClick={handleViewAll}
            className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--sh-fg-2)] hover:text-[var(--ink)] transition-colors"
          >
            Browse market
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
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
  const [searchOpen, setSearchOpen] = useState(false);
  /* Scroll detection for header blur */
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  /* cmd-K / ctrl-K global shortcut */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
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
                  <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--sh-fg-4)] font-medium">Labs (Experimental)</p>
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
            {/* Global market search trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden sm:flex items-center gap-2 h-8 px-3 bg-[var(--bone)] border border-[var(--rule)] rounded-sm text-[var(--sh-fg-3)] hover:text-[var(--ink)] hover:border-[var(--sh-fg-3)] transition-all text-[12px] group"
              title="Search market (⌘K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="text-[12px] hidden lg:inline">Search market</span>
              <kbd className="hidden lg:inline text-[10px] font-mono px-1 py-0.5 bg-[var(--paper)] border border-[var(--rule)] rounded text-[var(--sh-fg-4)] ml-1">⌘K</kbd>
            </button>

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

      {/* ── Global Search Palette ────────────────────────────────────────────── */}
      <GlobalSearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* ── Page Content ────────────────────────────────────────────────────── */}
      <main style={{ paddingTop: "56px" }}>
        {children}
      </main>
    </div>
  );
}
