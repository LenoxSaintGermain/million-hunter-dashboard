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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Command Center", badge: null },
  { href: "/scan", icon: Search, label: "Market Scan", badge: "Live" },
  { href: "/memos", icon: FileText, label: "Investment Memos", badge: null },
  { href: "/outreach", icon: Mail, label: "Outreach Pipeline", badge: null },
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
      {/* Logo */}
      <div className={cn("flex items-center h-16 px-4 border-b border-border gap-3 shrink-0", collapsed && "justify-center px-0")}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20 shrink-0">
          <Zap className="w-4 h-4 text-primary" />
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-foreground tracking-tight truncate">Signal Hunter</span>
            <span className="text-[10px] text-muted-foreground tracking-widest uppercase">Acquisition OS</span>
          </div>
        )}
        <button className="ml-auto lg:hidden text-muted-foreground" onClick={() => setMobileOpen(false)}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Tooltip key={item.href} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link href={item.href} onClick={() => setMobileOpen(false)}>
                  <div className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 text-sm font-medium",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    collapsed && "justify-center px-0"
                  )}>
                    <item.icon className={cn("shrink-0", collapsed ? "w-5 h-5" : "w-4 h-4")} />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/20 text-primary border-0">
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                </Link>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
            </Tooltip>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border p-2 space-y-1 shrink-0">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Link href="/settings" onClick={() => setMobileOpen(false)}>
              <div className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent",
                collapsed && "justify-center px-0"
              )}>
                <Settings className={cn("shrink-0", collapsed ? "w-5 h-5" : "w-4 h-4")} />
                {!collapsed && <span>Settings</span>}
              </div>
            </Link>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Settings</TooltipContent>}
        </Tooltip>

        <div className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg", collapsed && "justify-center px-0")}>
          <Avatar className="w-7 h-7 shrink-0">
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
              {user?.name?.charAt(0) ?? "L"}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{user?.name ?? "Lenox"}</p>
              <p className="text-[10px] text-muted-foreground truncate">Acquisition OS</p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-60 bg-card border-r border-border flex flex-col transition-transform duration-200 lg:hidden",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className={cn(
        "hidden lg:flex flex-col border-r border-border transition-all duration-300 ease-in-out shrink-0 bg-card relative",
        collapsed ? "w-16" : "w-60"
      )}>
        <SidebarContent />
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 flex items-center justify-center bg-card border border-border rounded-full text-muted-foreground hover:text-foreground transition-colors z-10"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 border-b border-border flex items-center justify-between px-4 lg:px-6 bg-card/50 shrink-0">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-1.5 text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <Bell className="w-4 h-4" />
            </Button>
            {!isAuthenticated ? (
              <Button size="sm" className="h-8 text-xs" onClick={() => window.location.href = getLoginUrl()}>
                Sign In
              </Button>
            ) : (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <User className="w-4 h-4" />
              </Button>
            )}
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
