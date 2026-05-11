import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  LayoutDashboard,
  Search,
  FileText,
  Mail,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bell,
  User,
  Menu,
  X,
  Target,
  BarChart3,
  Radar,
  Sparkles,
  Building2,
  Activity,
  LogOut,
  Zap,
  Shield,
  Settings2,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// ── Nav structure ─────────────────────────────────────────────────────────────
const navSections = [
  {
    label: "Operations",
    items: [
      { href: "/", icon: LayoutDashboard, label: "Command Center", badge: null },
      { href: "/scan", icon: Search, label: "Market Scan", badge: { label: "Live", color: "sage" } },
      { href: "/thesis", icon: Sparkles, label: "Thesis Engine", badge: { label: "New", color: "amber" } },
      { href: "/scout", icon: Building2, label: "Asset Scout", badge: { label: "New", color: "amber" } },
      { href: "/memos", icon: FileText, label: "Investment Memos", badge: null },
      { href: "/outreach", icon: Mail, label: "Outreach Pipeline", badge: null },
    ],
  },
  {
    label: "Capital Stack",
    items: [
      { href: "/stack", icon: Layers, label: "Capital Stack Modeler", badge: { label: "New", color: "amber" } },
      { href: "/freedom-map", icon: Target, label: "Freedom Map", badge: null },
      { href: "/strategy-blender", icon: BarChart3, label: "Strategy Blender", badge: null },
      { href: "/opportunity-radar", icon: Radar, label: "Opportunity Radar", badge: null },
      { href: "/investor-dossier", icon: Sparkles, label: "Investor Dossier", badge: null },
      { href: "/tide", icon: Activity, label: "TIDE Intelligence", badge: { label: "New", color: "amber" } },
    ],
  },
  {
    label: "Partners",
    items: [
      { href: "/insurance-prospector", icon: Shield, label: "Insurance Prospector", badge: { label: "New", color: "amber" }, roles: ["admin", "insurance"] as string[] },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/admin", icon: Settings2, label: "Admin Panel", badge: null, roles: ["admin"] as string[] },
    ],
  },
];

// ── Badge color map ───────────────────────────────────────────────────────────
function badgeStyle(color: string) {
  if (color === "sage") return {
    color: "var(--sage)",
    background: "oklch(0.55 0.06 155 / 0.10)",
    border: "1px solid oklch(0.55 0.06 155 / 0.30)",
  };
  if (color === "amber") return {
    color: "var(--amber)",
    background: "oklch(0.66 0.14 55 / 0.10)",
    border: "1px solid oklch(0.66 0.14 55 / 0.30)",
  };
  return {
    color: "var(--sh-fg-2)",
    background: "var(--sh-primary-8)",
    border: "1px solid var(--rule)",
  };
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

// ── Nav item ──────────────────────────────────────────────────────────────────
function NavItem({
  item,
  isActive,
  collapsed,
  onNavigate,
}: {
  item: { href: string; icon: React.ElementType; label: string; badge: { label: string; color: string } | null };
  isActive: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Link href={item.href} onClick={onNavigate}>
          <div
            className={cn(
              "relative flex items-center gap-2.5 rounded-md cursor-pointer transition-all duration-150",
              collapsed ? "justify-center px-0 py-2.5" : "px-3 py-[8px]",
              isActive
                ? "bg-[var(--sh-primary-15)]"
                : "hover:bg-[var(--sh-primary-8)]"
            )}
          >
            {/* Active left bar */}
            {isActive && (
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-r-full"
                style={{ background: "var(--signal-gold, #ffba20)" }}
              />
            )}
            <item.icon
              className={cn("shrink-0", collapsed ? "w-[17px] h-[17px]" : "w-[15px] h-[15px]")}
              style={{
                color: isActive ? "var(--on-surface, #dae3ee)" : "var(--sh-fg-3)",
              }}
            />
            {!collapsed && (
              <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                <span
                  className="flex-1 truncate text-[13px] font-medium"
                  style={{
                    color: isActive ? "var(--signal-gold, #ffba20)" : "var(--sh-fg-2)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {item.label}
                </span>
                {item.badge && (
                  <span
                    className="inline-flex items-center text-[9px] font-bold px-1.5 h-[16px] rounded-[4px]"
                    style={{
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      ...badgeStyle(item.badge.color),
                    }}
                  >
                    {item.badge.label}
                  </span>
                )}
              </div>
            )}
          </div>
        </Link>
      </TooltipTrigger>
      {collapsed && (
        <TooltipContent side="right" className="text-xs">
          {item.label}
        </TooltipContent>
      )}
    </Tooltip>
  );
}

// ── Logo block ────────────────────────────────────────────────────────────────
function LogoBlock({ collapsed, onClose }: { collapsed?: boolean; onClose?: () => void }) {
  return (
    <div
      className={cn(
        "flex items-center h-14 border-b shrink-0",
        collapsed ? "justify-center px-0" : "px-4 gap-2.5"
      )}
      style={{ borderColor: "rgba(81,69,50,0.15)" }}
    >
      <div
        className="flex items-center justify-center w-7 h-7 rounded-[7px] shrink-0 overflow-hidden"
        style={{ background: "rgba(255,186,32,0.12)", border: "1px solid rgba(255,186,32,0.25)" }}
      >
        <Zap className="w-3.5 h-3.5" style={{ color: "var(--signal-gold, #ffba20)" }} />
      </div>
      {!collapsed && (
        <div className="fade-in flex flex-col min-w-0 overflow-hidden">
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 14,
              fontWeight: 400,
              letterSpacing: "-0.025em",
              color: "var(--on-surface, #dae3ee)",
              lineHeight: 1.15,
            }}
          >
            Signal Hunter
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              fontWeight: 500,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--sh-fg-4)",
              marginTop: 1,
            }}
          >
            Acquisition OS
          </span>
        </div>
      )}
      {onClose && (
        <button
          className="ml-auto w-7 h-7 flex items-center justify-center rounded-md"
          style={{ color: "var(--sh-fg-3)" }}
          onClick={onClose}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Desktop sidebar nav ───────────────────────────────────────────────────────
function SidebarNav({
  collapsed,
  location,
  user,
  userRole,
  onNavigate,
}: {
  collapsed: boolean;
  location: string;
  user: { name?: string | null } | null;
  userRole?: string | null;
  onNavigate: () => void;
}) {
  return (
    <>
      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        {navSections.map((section, si) => {
          const visibleItems = section.items.filter((item) => {
            const roles = (item as any).roles as string[] | undefined;
            if (!roles) return true;
            return roles.includes(userRole ?? "user");
          });
          if (visibleItems.length === 0) return null;
          return (
          <div key={section.label} className={cn("mb-1", si > 0 && "mt-3 pt-3 border-t")} style={{ borderColor: "var(--rule)" }}>
            {!collapsed && (
              <div className="px-3 mb-1.5">
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--sh-fg-4)",
                  }}
                >
                  {section.label}
                </span>
              </div>
            )}
            <div className="space-y-0.5">
              {visibleItems.map((item) => {
                const isActive =
                  location === item.href ||
                  (item.href !== "/" && location.startsWith(item.href));
                return (
                  <NavItem
                    key={item.href}
                    item={item}
                    isActive={isActive}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                );
              })}
            </div>
          </div>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t px-2 py-2 space-y-0.5 shrink-0" style={{ borderColor: "var(--rule)" }}>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Link href="/settings" onClick={onNavigate}>
              <div
                className={cn(
                  "flex items-center gap-2.5 rounded-md cursor-pointer transition-all duration-150 hover:bg-[oklch(0.18_0.018_250_/_0.04)]",
                  collapsed ? "justify-center px-0 py-2.5" : "px-3 py-[8px]"
                )}
              >
                <Settings
                  className={cn("shrink-0", collapsed ? "w-[17px] h-[17px]" : "w-[15px] h-[15px]")}
                  style={{ color: "var(--sh-fg-3)" }}
                />
                {!collapsed && (
                  <span className="text-[13px] font-medium" style={{ color: "oklch(0.40 0.018 250)", letterSpacing: "-0.01em" }}>
                    Settings
                  </span>
                )}
              </div>
            </Link>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right" className="text-xs">Settings</TooltipContent>}
        </Tooltip>

        {/* User row */}
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-md",
            collapsed ? "justify-center px-0 py-2" : "px-3 py-2"
          )}
        >
          <Avatar className="w-6 h-6 shrink-0">
            <AvatarFallback
              className="text-[10px] font-bold"
              style={{
                background: "oklch(0.18 0.018 250 / 0.10)",
                color: "var(--ink)",
              }}
            >
              {user?.name?.charAt(0) ?? "L"}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p
                className="text-[12px] font-medium truncate"
                style={{ color: "var(--ink)", letterSpacing: "-0.01em" }}
              >
                {user?.name ?? "Lenox Saint Germain"}
              </p>
              <p
                className="text-[10px] truncate"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--sh-fg-4)",
                  letterSpacing: "0.04em",
                }}
              >
                Operator
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Mobile Bottom Sheet ───────────────────────────────────────────────────────
function MobileBottomSheet({
  open,
  onClose,
  location,
  user,
  userRole,
  logout,
}: {
  open: boolean;
  onClose: () => void;
  location: string;
  user: { name?: string | null } | null;
  userRole?: string | null;
  logout: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const currentYRef = useRef<number>(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    const delta = e.touches[0].clientY - startYRef.current;
    currentYRef.current = delta;
    if (delta > 0) setDragOffset(delta);
  }, []);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    if (currentYRef.current > 80) onClose();
    setDragOffset(0);
    startYRef.current = null;
    currentYRef.current = 0;
  }, [onClose]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        style={{ background: "oklch(0 0 0 / 0.60)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className={cn("fixed bottom-0 left-0 right-0 z-50 lg:hidden flex flex-col rounded-t-[18px] border-t")}
        style={{
          background: "var(--paper)",
          borderColor: "var(--rule)",
          maxHeight: "88dvh",
          transform: open ? `translateY(${dragOffset}px)` : "translateY(100%)",
          transition: isDragging ? "none" : "transform 0.38s cubic-bezier(0.16, 1, 0.3, 1)",
          willChange: "transform",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-8 h-[3px] rounded-full" style={{ background: "var(--rule)" }} />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: "var(--rule)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[7px] flex items-center justify-center shrink-0" style={{ background: "var(--ink)" }}>
              <Zap className="w-3.5 h-3.5" style={{ color: "var(--amber)" }} />
            </div>
            <div>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 400, letterSpacing: "-0.025em", color: "var(--ink)" }}>
                Signal Hunter
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--sh-fg-4)" }}>
                Acquisition OS
              </p>
            </div>
          </div>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-md"
            style={{ background: "var(--bone)", color: "var(--sh-fg-3)" }}
            onClick={onClose}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-3">
          {navSections.map((section, si) => {
            const visibleItems = section.items.filter((item) => {
              const roles = (item as any).roles as string[] | undefined;
              if (!roles) return true;
              return roles.includes(userRole ?? "user");
            });
            if (visibleItems.length === 0) return null;
            return (
            <div key={section.label} className={cn("mb-1", si > 0 && "mt-4 pt-4 border-t")} style={{ borderColor: "var(--rule)" }}>
              <div className="px-3 mb-2">
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--sh-fg-4)" }}>
                  {section.label}
                </span>
              </div>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                  return (
                    <Link key={item.href} href={item.href} onClick={onClose}>
                      <div
                        className={cn(
                          "relative flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-all duration-150",
                          isActive ? "bg-[var(--sh-primary-15)]" : "hover:bg-[var(--sh-primary-8)]"
                        )}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-r-full" style={{ background: "var(--amber)" }} />
                        )}
                        <item.icon
                          className="w-[16px] h-[16px] shrink-0"
                          style={{ color: isActive ? "var(--ink)" : "var(--sh-fg-3)" }}
                        />
                        <span
                          className="flex-1 text-[14px] font-medium"
                          style={{ color: isActive ? "var(--ink)" : "var(--sh-fg-2)", letterSpacing: "-0.01em" }}
                        >
                          {item.label}
                        </span>
                        {item.badge && (
                          <span
                            className="inline-flex items-center text-[9px] font-bold px-1.5 h-[16px] rounded-[4px]"
                            style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", ...badgeStyle(item.badge.color) }}
                          >
                            {item.badge.label}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
            );
          })}

          <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--rule)" }}>
            <Link href="/settings" onClick={onClose}>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer hover:bg-[oklch(0.18_0.018_250_/_0.04)] transition-all duration-150">
                <Settings className="w-[16px] h-[16px] shrink-0" style={{ color: "var(--sh-fg-3)" }} />
                <span className="text-[14px] font-medium" style={{ color: "var(--sh-fg-2)", letterSpacing: "-0.01em" }}>Settings</span>
              </div>
            </Link>
          </div>
        </div>

        <div className="border-t px-4 py-4 shrink-0 flex items-center gap-3" style={{ borderColor: "var(--rule)", paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarFallback className="text-xs font-bold" style={{ background: "var(--sh-primary-8)", color: "var(--ink)" }}>
              {user?.name?.charAt(0) ?? "L"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium truncate" style={{ color: "var(--ink)", letterSpacing: "-0.01em" }}>
              {user?.name ?? "Lenox Saint Germain"}
            </p>
            <p className="text-[10px] truncate" style={{ fontFamily: "var(--font-mono)", color: "var(--sh-fg-4)", letterSpacing: "0.04em" }}>
              Acquisition OS · Operator
            </p>
          </div>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-md shrink-0"
            style={{ background: "var(--bone)", color: "var(--sh-fg-3)" }}
            onClick={() => { onClose(); logout(); }}
            title="Sign out"
          >
            <LogOut className="w-3 h-3" />
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main layout ───────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const userRole = (user as any)?.role as string | undefined;

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--surface-container, #182028)" }}>
      <MobileBottomSheet
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        location={location}
        user={user}
        userRole={userRole}
        logout={logout ?? (() => {})}
      />

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r shrink-0 relative transition-all duration-[280ms]",
          collapsed ? "w-[52px]" : "w-[220px]"
        )}
        style={{ background: "var(--surface, #1e2a34)", borderColor: "rgba(81,69,50,0.15)" }}
      >
        <LogoBlock collapsed={collapsed} />
        <SidebarNav
          collapsed={collapsed}
          location={location}
          user={user}
          userRole={userRole}
          onNavigate={() => {}}
        />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-[72px] w-6 h-6 flex items-center justify-center rounded-full border z-10 transition-colors"
          style={{ background: "var(--surface, #1e2a34)", borderColor: "rgba(81,69,50,0.15)", color: "var(--sh-fg-3)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sh-fg-3)")}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header
          className="h-14 border-b flex items-center justify-between px-4 lg:px-6 shrink-0"
          style={{ background: "var(--surface, #1e2a34)", borderColor: "rgba(81,69,50,0.15)" }}
        >
          <div className="flex items-center gap-3">
            {/* Mobile logo */}
            <div className="flex items-center gap-2 lg:hidden">
              <div className="w-7 h-7 rounded-[7px] flex items-center justify-center shrink-0" style={{ background: "rgba(255,186,32,0.12)", border: "1px solid rgba(255,186,32,0.25)" }}>
                <Zap className="w-3.5 h-3.5" style={{ color: "var(--signal-gold, #ffba20)" }} />
              </div>
              <div>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 400, letterSpacing: "-0.025em", color: "var(--ink)", lineHeight: 1.2 }}>
                  Signal Hunter
                </p>
              </div>
            </div>
            {/* Desktop dateline */}
            <div className="hidden lg:flex items-center gap-2">
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: "0.06em",
                  color: "var(--sh-fg-4)",
                }}
              >
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md"
              style={{ color: "var(--sh-fg-3)" }}
            >
              <Bell className="w-3.5 h-3.5" />
            </Button>
            {!isAuthenticated ? (
              <Button
                size="sm"
                className="h-7 text-xs px-3 rounded-md"
                style={{ background: "var(--ink)", color: "var(--paper)" }}
                onClick={() => (window.location.href = getLoginUrl())}
              >
                Sign In
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-md"
                style={{ color: "var(--sh-fg-3)" }}
              >
                <User className="w-3.5 h-3.5" />
              </Button>
            )}
            {/* Mobile menu */}
            <button
              className="lg:hidden h-8 w-8 flex items-center justify-center rounded-md"
              style={{ color: "var(--sh-fg-3)", background: "rgba(255,255,255,0.05)" }}
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6" style={{ background: "var(--surface-container, #182028)" }}>
          <div className="max-w-[1400px] mx-auto space-y-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
