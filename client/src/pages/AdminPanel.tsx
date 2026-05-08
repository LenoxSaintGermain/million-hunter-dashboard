/**
 * Admin Panel — User Management & Platform Stats
 *
 * Accessible only to users with role="admin".
 * Provides user list, role management, and platform health overview.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Users, Shield, TrendingUp, Building2, BarChart3,
  RefreshCw, ChevronDown, Lock, UserCheck, Activity
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<string, string> = {
  admin: "text-red-400 bg-red-400/10 border-red-400/20",
  investor: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  insurance: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  user: "text-muted-foreground bg-muted/20 border-border",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  investor: "Investor",
  insurance: "Insurance",
  user: "User",
};

function formatDate(ts: string | number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── User Row ─────────────────────────────────────────────────────────────────
interface UserRow {
  id: number;
  name: string | null;
  email: string | null;
  role: string;
  created_at: string;
  last_signed_in: string;
  login_method: string | null;
}

function UserTableRow({ user, onRoleChange }: {
  user: UserRow;
  onRoleChange: (userId: number, role: string) => void;
}) {
  const [isChanging, setIsChanging] = useState(false);
  const roleClass = ROLE_COLORS[user.role] ?? ROLE_COLORS.user;

  const handleRoleChange = async (newRole: string) => {
    if (newRole === user.role) return;
    setIsChanging(true);
    onRoleChange(user.id, newRole);
    setTimeout(() => setIsChanging(false), 1000);
  };

  return (
    <div
      className="flex items-center gap-4 py-3 px-4 rounded-lg border transition-colors hover:border-primary/20"
      style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border)" }}
    >
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-2)" }}
      >
        {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{user.name ?? "Unnamed User"}</p>
        <p className="text-[11px] text-muted-foreground truncate">{user.email ?? "No email"}</p>
      </div>

      {/* Login Method */}
      <div className="hidden md:block text-[11px] text-muted-foreground w-20 text-center">
        {user.login_method ?? "—"}
      </div>

      {/* Last Sign In */}
      <div className="hidden lg:block text-[11px] text-muted-foreground w-28 text-right">
        {formatDate(user.last_signed_in)}
      </div>

      {/* Joined */}
      <div className="hidden lg:block text-[11px] text-muted-foreground w-28 text-right">
        {formatDate(user.created_at)}
      </div>

      {/* Role Badge + Selector */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${roleClass}`}>
          {ROLE_LABELS[user.role] ?? user.role}
        </span>
        <div className="relative">
          <select
            value={user.role}
            onChange={(e) => handleRoleChange(e.target.value)}
            disabled={isChanging}
            className="h-7 text-xs rounded border border-[var(--sh-border)] bg-transparent text-muted-foreground pl-2 pr-6 cursor-pointer hover:border-primary/40 transition-colors appearance-none"
          >
            <option value="user">User</option>
            <option value="investor">Investor</option>
            <option value="insurance">Insurance</option>
            <option value="admin">Admin</option>
          </select>
          <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();

  const { data: users, isLoading: usersLoading } = trpc.admin.listUsers.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const { data: stats } = trpc.admin.platformStats.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const updateRole = trpc.admin.updateRole.useMutation({
    onSuccess: () => {
      utils.admin.listUsers.invalidate();
      utils.admin.platformStats.invalidate();
      toast.success("Role updated");
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  // Guard: non-admin users see a locked state
  if (currentUser && currentUser.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <Lock className="w-16 h-16 text-muted-foreground/20 mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Admin Access Required</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            This panel is restricted to platform administrators. Contact the operator to request access.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const userList = (users ?? []) as unknown as UserRow[];

  // Compute role distribution from stats
  const roleStats = (stats?.users ?? []) as Array<{ role: string; count: number }>;
  const dealStats = (stats?.deals ?? []) as Array<{ stage: string; count: number }>;
  const prospectStats = (stats?.prospects ?? []) as Array<{ status: string; count: number }>;

  const totalUsers = roleStats.reduce((sum, r) => sum + Number(r.count), 0);
  const totalDeals = dealStats.reduce((sum, d) => sum + Number(d.count), 0);
  const totalProspects = prospectStats.reduce((sum, p) => sum + Number(p.count), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <p className="eyebrow text-muted-foreground mb-1">Platform Administration</p>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Admin Panel
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            User management, role assignment, and platform health overview.
          </p>
        </div>

        {/* Platform Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Total Users",
              value: totalUsers.toString(),
              icon: Users,
              sub: `${roleStats.find(r => r.role === "admin")?.count ?? 0} admins`,
            },
            {
              label: "Active Deals",
              value: totalDeals.toString(),
              icon: Building2,
              sub: `${dealStats.find(d => d.stage === "high_priority")?.count ?? 0} high priority`,
            },
            {
              label: "Insurance Prospects",
              value: totalProspects.toString(),
              icon: Shield,
              sub: `${prospectStats.find(p => p.status === "quoted")?.count ?? 0} quoted`,
            },
            {
              label: "Investor Users",
              value: (roleStats.find(r => r.role === "investor")?.count ?? 0).toString(),
              icon: TrendingUp,
              sub: `${roleStats.find(r => r.role === "insurance")?.count ?? 0} insurance`,
            },
          ].map((stat) => (
            <Card key={stat.label} style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border)" }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{stat.label}</p>
                  <stat.icon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <p className="text-xl font-bold tabular-nums font-mono text-foreground">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{stat.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Role Distribution */}
        {roleStats.length > 0 && (
          <Card style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border)" }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Role Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {roleStats.map((r) => (
                  <div
                    key={r.role}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                    style={{ background: "var(--sh-surface-2)", borderColor: "var(--sh-border)" }}
                  >
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${ROLE_COLORS[r.role] ?? ROLE_COLORS.user}`}>
                      {ROLE_LABELS[r.role] ?? r.role}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-foreground">{r.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* User Management Table */}
        <Card style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border)" }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-primary" />
                  Users ({userList.length})
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Manage roles to control feature access. Role changes take effect immediately.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-[var(--sh-border)]"
                onClick={() => utils.admin.listUsers.invalidate()}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Table Header */}
            <div className="flex items-center gap-4 py-2 px-4 mb-2">
              <div className="w-8" />
              <div className="flex-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">User</div>
              <div className="hidden md:block text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-20 text-center">Method</div>
              <div className="hidden lg:block text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-28 text-right">Last Sign In</div>
              <div className="hidden lg:block text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-28 text-right">Joined</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-40 text-right">Role</div>
            </div>

            {usersLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : userList.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">No users found</div>
            ) : (
              <div className="space-y-2">
                {userList.map((user) => (
                  <UserTableRow
                    key={user.id}
                    user={user}
                    onRoleChange={(userId, role) =>
                      updateRole.mutate({ userId, role: role as "user" | "admin" | "investor" | "insurance" })
                    }
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Role Guide */}
        <Card style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border)" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Role Access Guide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                {
                  role: "admin",
                  label: "Admin",
                  description: "Full platform access. User management, all modules, admin panel.",
                  access: ["Command Center", "Market Scan", "Deal Room", "TIDE Intelligence", "Admin Panel", "All modules"],
                },
                {
                  role: "investor",
                  label: "Investor",
                  description: "Investor-facing modules. Can view deals, submit interest, access dossiers.",
                  access: ["Investor Dossier", "Freedom Map", "Strategy Blender", "Opportunity Radar", "Market Scan (read)"],
                },
                {
                  role: "insurance",
                  label: "Insurance",
                  description: "Insurance prospecting module. Scores deals as insurance prospects, generates pre-call briefs.",
                  access: ["Insurance Prospector", "Deal Pipeline (read-only)", "Prospect Briefs", "Status Management"],
                },
                {
                  role: "user",
                  label: "User",
                  description: "Default role. Limited access pending operator review.",
                  access: ["Command Center (read)", "Basic deal view"],
                },
              ].map((r) => (
                <div
                  key={r.role}
                  className="p-3 rounded-lg border"
                  style={{ background: "var(--sh-surface-2)", borderColor: "var(--sh-border)" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${ROLE_COLORS[r.role]}`}>
                      {r.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{r.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {r.access.map((a) => (
                      <span key={a} className="text-[9px] px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground border border-border">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
