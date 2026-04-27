import { useState, useEffect, useRef, useCallback } from "react";
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
  TrendingUp,
  Menu,
  X,
  Target,
  BarChart3,
  Radar,
  Sparkles,
  Building2,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const navSections = [
  {
    label: "Operations",
    items: [
      { href: "/", icon: LayoutDashboard, label: "Command Center", badge: null },
      { href: "/scan", icon: Search, label: "Market Scan", badge: { label: "Live", color: "primary" } },
      { href: "/scout", icon: Building2, label: "Asset Scout", badge: { label: "New", color: "cyan" } },
      { href: "/memos", icon: FileText, label: "Investment Memos", badge: null },
      { href: "/outreach", icon: Mail, label: "Outreach Pipeline", badge: null },
    ],
  },
  {
    label: "Capital Stack",
    items: [
      { href: "/freedom-map", icon: Target, label: "Freedom Map", badge: { label: "New", color: "cyan" } },
      { href: "/strategy-blender", icon: BarChart3, label: "Strategy Blender", badge: null },
      { href: "/opportunity-radar", icon: Radar, label: "Opportunity Radar", badge: null },
      { href: "/investor-dossier", icon: Sparkles, label: "Investor Dossier", badge: null },
    ],
  },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

// ── Shared nav item renderer ──────────────────────────────────────────────────
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
              "relative flex items-center gap-2.5 py-[9px] rounded-lg cursor-pointer text-[13px] font-medium transition-all duration-150",
              collapsed ? "justify-center px-0" : "px-3"
            )}
            style={{
              color: isActive ? "var(--sh-primary)" : "var(--sh-fg-3)",
              background: isActive ? "var(--sh-primary-15)" : "transparent",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = "oklch(0.55 0.01 260 / 0.08)";
                (e.currentTarget as HTMLElement).style.color = "var(--sh-fg-1)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "var(--sh-fg-3)";
              }
            }}
          >
            {/* Active indicator bar */}
            {isActive && (
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full"
                style={{ background: "var(--sh-primary)" }}
              />
            )}
            <item.icon
              className={cn("shrink-0", collapsed ? "w-[18px] h-[18px]" : "w-4 h-4")}
              style={{ color: isActive ? "var(--sh-primary)" : undefined }}
            />
            {!collapsed && (
              <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && (
                  <span
                    className="inline-flex items-center text-[10px] font-bold px-1.5 h-[18px] rounded-[5px]"
                    style={{
                      color: item.badge.color === "cyan" ? "var(--sh-cyan)" : "var(--sh-primary)",
                      background: item.badge.color === "cyan" ? "var(--sh-cyan-15)" : "var(--sh-primary-15)",
                      border: `1px solid ${item.badge.color === "cyan" ? "var(--sh-cyan-20)" : "var(--sh-primary-20)"}`,
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
      {collapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
    </Tooltip>
  );
}

// ── Logo block ────────────────────────────────────────────────────────────────
function LogoBlock({ collapsed, onClose }: { collapsed?: boolean; onClose?: () => void }) {
  return (
    <div
      className={cn(
        "flex items-center h-16 border-b border-border gap-2.5 shrink-0 px-4",
        collapsed && "justify-center px-0"
      )}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 overflow-hidden">
        <img
          src="/manus-storage/sh-icon-final_9231defd.png"
          alt="Signal Hunter"
          className="w-8 h-8 object-cover rounded-lg"
        />
      </div>
      {!collapsed && (
        <div className="fade-in flex flex-col min-w-0 overflow-hidden">
          <span className="text-[13px] font-bold tracking-[-0.01em] truncate" style={{ color: "var(--sh-fg-1)" }}>
            Signal Hunter
          </span>
          <span className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--sh-fg-4)" }}>
            Acquisition OS
          </span>
        </div>
      )}
      {onClose && (
        <button className="ml-auto" style={{ color: "var(--sh-fg-3)" }} onClick={onClose}>
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ── Desktop sidebar nav content ───────────────────────────────────────────────
function SidebarNav({
  collapsed,
  location,
  user,
  onNavigate,
}: {
  collapsed: boolean;
  location: string;
  user: { name?: string | null } | null;
  onNavigate: () => void;
}) {
  return (
    <>
      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.label} className="mb-4">
            {!collapsed && (
              <div className="px-3 mb-1">
                <span className="sh-label">{section.label}</span>
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
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
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border p-2 space-y-1 shrink-0">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Link href="/settings" onClick={onNavigate}>
              <div
                className={cn(
                  "flex items-center gap-2.5 py-[9px] rounded-lg cursor-pointer text-[13px] font-medium transition-all duration-150",
                  collapsed ? "justify-center px-0" : "px-3"
                )}
                style={{ color: "var(--sh-fg-3)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "var(--sh-fg-1)";
                  (e.currentTarget as HTMLElement).style.background = "oklch(0.55 0.01 260 / 0.08)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "var(--sh-fg-3)";
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <Settings className={cn("shrink-0", collapsed ? "w-[18px] h-[18px]" : "w-4 h-4")} />
                {!collapsed && <span>Settings</span>}
              </div>
            </Link>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Settings</TooltipContent>}
        </Tooltip>

        <div
          className={cn(
            "flex items-center gap-2.5 py-[9px] rounded-lg",
            collapsed ? "justify-center px-0" : "px-3"
          )}
        >
          <Avatar className="w-7 h-7 shrink-0">
            <AvatarFallback
              className="text-xs font-bold"
              style={{ background: "var(--sh-primary-20)", color: "var(--sh-primary)" }}
            >
              {user?.name?.charAt(0) ?? "L"}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: "var(--sh-fg-1)" }}>
                {user?.name ?? "Lenox Saint Germain"}
              </p>
              <p className="text-[10px] truncate" style={{ color: "var(--sh-fg-4)" }}>
                Acquisition OS
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
  logout,
}: {
  open: boolean;
  onClose: () => void;
  location: string;
  user: { name?: string | null } | null;
  logout: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const currentYRef = useRef<number>(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
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
    if (currentYRef.current > 80) {
      onClose();
    }
    setDragOffset(0);
    startYRef.current = null;
    currentYRef.current = 0;
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        style={{ background: "oklch(0 0 0 / 0.65)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 lg:hidden flex flex-col",
          "rounded-t-[20px] border-t border-border",
        )}
        style={{
          background: "var(--sh-surface-1)",
          maxHeight: "88dvh",
          transform: open
            ? `translateY(${dragOffset}px)`
            : "translateY(100%)",
          transition: isDragging ? "none" : "transform 0.38s cubic-bezier(0.16, 1, 0.3, 1)",
          willChange: "transform",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: "var(--sh-border)" }}
          />
        </div>

        {/* Sheet header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0">
              <img src="/manus-storage/sh-icon-final_9231defd.png" alt="Signal Hunter" className="w-7 h-7 object-cover" />
            </div>
            <div>
              <p className="text-[13px] font-bold" style={{ color: "var(--sh-fg-1)" }}>Signal Hunter</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--sh-fg-4)" }}>Acquisition OS</p>
            </div>
          </div>
          <button
            className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-3)" }}
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable nav */}
        <div className="flex-1 overflow-y-auto py-3 px-3">
          {navSections.map((section) => (
            <div key={section.label} className="mb-5">
              <div className="px-3 mb-2">
                <span className="sh-label">{section.label}</span>
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                  return (
                    <Link key={item.href} href={item.href} onClick={onClose}>
                      <div
                        className="relative flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer text-[14px] font-medium transition-all duration-150"
                        style={{
                          color: isActive ? "var(--sh-primary)" : "var(--sh-fg-2)",
                          background: isActive ? "var(--sh-primary-15)" : "transparent",
                        }}
                      >
                        {isActive && (
                          <div
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                            style={{ background: "var(--sh-primary)" }}
                          />
                        )}
                        <item.icon
                          className="w-[18px] h-[18px] shrink-0"
                          style={{ color: isActive ? "var(--sh-primary)" : "var(--sh-fg-3)" }}
                        />
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <span
                            className="inline-flex items-center text-[10px] font-bold px-1.5 h-[18px] rounded-[5px]"
                            style={{
                              color: item.badge.color === "cyan" ? "var(--sh-cyan)" : "var(--sh-primary)",
                              background: item.badge.color === "cyan" ? "var(--sh-cyan-15)" : "var(--sh-primary-15)",
                              border: `1px solid ${item.badge.color === "cyan" ? "var(--sh-cyan-20)" : "var(--sh-primary-20)"}`,
                            }}
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
          ))}

          {/* Settings row */}
          <div className="mb-5">
            <div className="space-y-0.5">
              <Link href="/settings" onClick={onClose}>
                <div
                  className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer text-[14px] font-medium"
                  style={{ color: "var(--sh-fg-3)" }}
                >
                  <Settings className="w-[18px] h-[18px] shrink-0" />
                  <span>Settings</span>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* User footer */}
        <div
          className="border-t border-border px-4 py-4 shrink-0 flex items-center gap-3"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <Avatar className="w-9 h-9 shrink-0">
            <AvatarFallback
              className="text-sm font-bold"
              style={{ background: "var(--sh-primary-20)", color: "var(--sh-primary)" }}
            >
              {user?.name?.charAt(0) ?? "L"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold truncate" style={{ color: "var(--sh-fg-1)" }}>
              {user?.name ?? "Lenox Saint Germain"}
            </p>
            <p className="text-[11px] truncate" style={{ color: "var(--sh-fg-4)" }}>Acquisition OS · Operator</p>
          </div>
          <button
            className="w-8 h-8 flex items-center justify-center rounded-full shrink-0"
            style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-3)" }}
            onClick={() => { onClose(); logout(); }}
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
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

  // Close sheet on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--sh-bg)" }}>
      {/* ── Mobile bottom sheet ── */}
      <MobileBottomSheet
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        location={location}
        user={user}
        logout={logout ?? (() => {})}
      />

      {/* ── Desktop sidebar ── */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r border-border shrink-0 relative",
          "transition-all duration-[280ms]",
          collapsed ? "w-16" : "w-60"
        )}
        style={{ background: "var(--sh-surface-1)" }}
      >
        <LogoBlock collapsed={collapsed} />
        <SidebarNav
          collapsed={collapsed}
          location={location}
          user={user}
          onNavigate={() => {}}
        />
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 flex items-center justify-center rounded-full border border-border z-10"
          style={{ background: "var(--sh-surface-1)", color: "var(--sh-fg-3)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--sh-fg-1)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--sh-fg-3)")}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header
          className="h-16 border-b border-border flex items-center justify-between px-4 lg:px-6 shrink-0"
          style={{ background: "oklch(0.14 0.01 260 / 0.5)" }}
        >
          <div className="flex items-center gap-3">
            {/* Mobile: logo + hamburger */}
            <div className="flex items-center gap-2 lg:hidden">
              <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0">
                <img src="/manus-storage/sh-icon-final_9231defd.png" alt="Signal Hunter" className="w-7 h-7 object-cover" />
              </div>
              <div>
                <p className="text-[12px] font-bold leading-none" style={{ color: "var(--sh-fg-1)" }}>Signal Hunter</p>
                <p className="text-[8px] font-bold uppercase tracking-[0.12em] leading-none mt-0.5" style={{ color: "var(--sh-fg-4)" }}>Acquisition OS</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <TrendingUp className="w-4 h-4" style={{ color: "var(--sh-primary)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--sh-fg-3)" }}>
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" style={{ color: "var(--sh-fg-3)" }}>
              <Bell className="w-4 h-4" />
            </Button>
            {!isAuthenticated ? (
              <Button size="sm" className="h-8 text-xs" onClick={() => (window.location.href = getLoginUrl())}>
                Sign In
              </Button>
            ) : (
              <Button variant="ghost" size="icon" className="h-8 w-8" style={{ color: "var(--sh-fg-3)" }}>
                <User className="w-4 h-4" />
              </Button>
            )}
            {/* Mobile menu trigger */}
            <button
              className="lg:hidden h-8 w-8 flex items-center justify-center rounded-lg"
              style={{ color: "var(--sh-fg-3)", background: "var(--sh-surface-2)" }}
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-[1400px] mx-auto space-y-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
