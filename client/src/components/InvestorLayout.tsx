import { useState, useCallback, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  Bell,
  Menu,
  X,
  LogOut,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const investorNav = [
  { href: "/investor", icon: LayoutDashboard, label: "Deal Room", description: "Curated acquisition opportunities" },
  { href: "/investor/memos", icon: FileText, label: "Memo Vault", description: "Investment analysis & theses" },
  { href: "/investor/position", icon: Briefcase, label: "My Position", description: "Portfolio & committed capital" },
];

interface InvestorLayoutProps {
  children: React.ReactNode;
}

// ── Mobile bottom sheet for investor nav ─────────────────────────────────────
function InvestorMobileSheet({
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
  const startYRef = useRef<number | null>(null);
  const currentYRef = useRef<number>(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
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
        style={{ background: "oklch(0 0 0 / 0.65)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden flex flex-col rounded-t-[20px] border-t border-border"
        style={{
          background: "var(--sh-surface-1)",
          maxHeight: "80dvh",
          transform: open ? `translateY(${dragOffset}px)` : "translateY(100%)",
          transition: isDragging ? "none" : "transform 0.38s cubic-bezier(0.16, 1, 0.3, 1)",
          willChange: "transform",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--sh-border)" }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0">
              <img src="/manus-storage/sh-icon-final_9231defd.png" alt="Signal Hunter" className="w-7 h-7 object-cover" />
            </div>
            <div>
              <p className="text-[13px] font-bold" style={{ color: "var(--sh-fg-1)" }}>Investor Portal</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--sh-fg-4)" }}>Signal Hunter OS</p>
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

        {/* Nav items */}
        <div className="flex-1 overflow-y-auto py-4 px-3">
          <div className="space-y-1">
            {investorNav.map((item) => {
              const isActive = location === item.href || (item.href !== "/investor" && location.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href} onClick={onClose}>
                  <div
                    className="relative flex items-center gap-3 px-4 py-3.5 rounded-xl cursor-pointer transition-all duration-150"
                    style={{
                      background: isActive ? "var(--sh-primary-15)" : "transparent",
                    }}
                  >
                    {isActive && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
                        style={{ background: "var(--sh-primary)" }}
                      />
                    )}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: isActive ? "var(--sh-primary-20)" : "var(--sh-surface-2)",
                      }}
                    >
                      <item.icon
                        className="w-4 h-4"
                        style={{ color: isActive ? "var(--sh-primary)" : "var(--sh-fg-3)" }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold" style={{ color: isActive ? "var(--sh-primary)" : "var(--sh-fg-1)" }}>
                        {item.label}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--sh-fg-4)" }}>{item.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--sh-fg-4)" }} />
                  </div>
                </Link>
              );
            })}
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
              style={{ background: "oklch(0.55 0.18 280 / 0.2)", color: "oklch(0.75 0.18 280)" }}
            >
              {user?.name?.charAt(0) ?? "I"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold truncate" style={{ color: "var(--sh-fg-1)" }}>
              {user?.name ?? "Investor"}
            </p>
            <p className="text-[11px] truncate" style={{ color: "var(--sh-fg-4)" }}>Capital Partner · Read-only</p>
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

// ── Main investor layout ──────────────────────────────────────────────────────
export default function InvestorLayout({ children }: InvestorLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--sh-bg)" }}>
      {/* ── Mobile bottom sheet ── */}
      <InvestorMobileSheet
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        location={location}
        user={user}
        logout={logout ?? (() => {})}
      />

      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden lg:flex flex-col w-64 border-r border-border shrink-0"
        style={{ background: "var(--sh-surface-1)" }}
      >
        {/* Logo */}
        <div className="flex items-center h-16 border-b border-border gap-3 px-5 shrink-0">
          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
            <img src="/manus-storage/sh-icon-final_9231defd.png" alt="Signal Hunter" className="w-8 h-8 object-cover" />
          </div>
          <div>
            <p className="text-[13px] font-bold" style={{ color: "var(--sh-fg-1)" }}>Investor Portal</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--sh-fg-4)" }}>Signal Hunter OS</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <div className="px-2 mb-3">
            <span className="sh-label">Navigation</span>
          </div>
          <div className="space-y-1">
            {investorNav.map((item) => {
              const isActive = location === item.href || (item.href !== "/investor" && location.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className="relative flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-150"
                    style={{
                      background: isActive ? "var(--sh-primary-15)" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = "oklch(0.55 0.01 260 / 0.08)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    {isActive && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                        style={{ background: "var(--sh-primary)" }}
                      />
                    )}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: isActive ? "var(--sh-primary-20)" : "var(--sh-surface-2)",
                      }}
                    >
                      <item.icon
                        className="w-4 h-4"
                        style={{ color: isActive ? "var(--sh-primary)" : "var(--sh-fg-3)" }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[13px] font-semibold truncate"
                        style={{ color: isActive ? "var(--sh-primary)" : "var(--sh-fg-1)" }}
                      >
                        {item.label}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: "var(--sh-fg-4)" }}>
                        {item.description}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Bottom user row */}
        <div className="border-t border-border p-3 shrink-0">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl" style={{ background: "var(--sh-surface-2)" }}>
            <Avatar className="w-8 h-8 shrink-0">
              <AvatarFallback
                className="text-xs font-bold"
                style={{ background: "oklch(0.55 0.18 280 / 0.2)", color: "oklch(0.75 0.18 280)" }}
              >
                {user?.name?.charAt(0) ?? "I"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold truncate" style={{ color: "var(--sh-fg-1)" }}>
                {user?.name ?? "Investor"}
              </p>
              <p className="text-[10px] truncate" style={{ color: "var(--sh-fg-4)" }}>Capital Partner</p>
            </div>
            <button
              className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0"
              style={{ color: "var(--sh-fg-3)" }}
              onClick={() => logout?.()}
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header
          className="h-16 border-b border-border flex items-center justify-between px-4 lg:px-6 shrink-0"
          style={{ background: "oklch(0.14 0.01 260 / 0.5)" }}
        >
          <div className="flex items-center gap-3">
            {/* Mobile: logo */}
            <div className="flex items-center gap-2 lg:hidden">
              <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0">
                <img src="/manus-storage/sh-icon-final_9231defd.png" alt="Signal Hunter" className="w-7 h-7 object-cover" />
              </div>
              <div>
                <p className="text-[12px] font-bold leading-none" style={{ color: "var(--sh-fg-1)" }}>Investor Portal</p>
                <p className="text-[8px] font-bold uppercase tracking-[0.12em] leading-none mt-0.5" style={{ color: "var(--sh-fg-4)" }}>Signal Hunter OS</p>
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
              <div
                className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: "var(--sh-surface-2)" }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: "oklch(0.55 0.18 280 / 0.2)", color: "oklch(0.75 0.18 280)" }}
                >
                  {user?.name?.charAt(0) ?? "I"}
                </div>
                <span className="text-[12px] font-medium" style={{ color: "var(--sh-fg-2)" }}>
                  {user?.name?.split(" ")[0] ?? "Investor"}
                </span>
              </div>
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
          <div className="max-w-[1200px] mx-auto space-y-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
