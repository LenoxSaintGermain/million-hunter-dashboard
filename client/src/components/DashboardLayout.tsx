import { useState } from "react";
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
  Zap,
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

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();

  const SidebarContent = () => (
    <>
      {/* ── Logo ── */}
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
            <span className="text-[13px] font-bold tracking-[-0.01em] truncate"
              style={{ color: "var(--sh-fg-1)" }}>
              Signal Hunter
            </span>
            <span className="text-[9px] font-bold uppercase tracking-[0.15em]"
              style={{ color: "var(--sh-fg-4)" }}>
              Acquisition OS
            </span>
          </div>
        )}
        <button
          className="ml-auto lg:hidden"
          style={{ color: "var(--sh-fg-3)" }}
          onClick={() => setMobileOpen(false)}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto" style={{ gap: 0 }}>
        {navSections.map((section) => (
          <div key={section.label} className="mb-4">
            {!collapsed && (
              <div className="px-3 mb-1">
                <span className="sh-label">{section.label}</span>
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  location === item.href ||
                  (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Tooltip key={item.href} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Link href={item.href} onClick={() => setMobileOpen(false)}>
                        <div
                          className={cn(
                            "nav-hover relative flex items-center gap-2.5 py-[9px] rounded-lg cursor-pointer text-[13px] font-medium",
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
                                    color: item.badge.color === "cyan"
                                      ? "var(--sh-cyan)"
                                      : "var(--sh-primary)",
                                    background: item.badge.color === "cyan"
                                      ? "var(--sh-cyan-15)"
                                      : "var(--sh-primary-15)",
                                    border: `1px solid ${item.badge.color === "cyan"
                                      ? "var(--sh-cyan-20)"
                                      : "var(--sh-primary-20)"}`,
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
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Bottom ── */}
      <div className="border-t border-border p-2 space-y-1 shrink-0">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Link href="/settings" onClick={() => setMobileOpen(false)}>
              <div
                className={cn(
                  "nav-hover flex items-center gap-2.5 py-[9px] rounded-lg cursor-pointer text-[13px] font-medium",
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

        {/* User row */}
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

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--sh-bg)" }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "oklch(0 0 0 / 0.6)" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-60 flex flex-col transition-transform duration-200 lg:hidden border-r border-border",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: "var(--sh-surface-1)" }}
      >
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r border-border shrink-0 relative",
          "transition-all duration-[280ms] cubic-bezier(0.16,1,0.3,1)",
          collapsed ? "w-16" : "w-60"
        )}
        style={{ background: "var(--sh-surface-1)" }}
      >
        <SidebarContent />
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
            <button
              className="lg:hidden p-1.5"
              style={{ color: "var(--sh-fg-3)" }}
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <TrendingUp className="w-4 h-4" style={{ color: "var(--sh-primary)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--sh-fg-3)" }}>
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              style={{ color: "var(--sh-fg-3)" }}
            >
              <Bell className="w-4 h-4" />
            </Button>
            {!isAuthenticated ? (
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => (window.location.href = getLoginUrl())}
              >
                Sign In
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                style={{ color: "var(--sh-fg-3)" }}
              >
                <User className="w-4 h-4" />
              </Button>
            )}
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
