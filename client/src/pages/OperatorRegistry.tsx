/**
 * Operator Registry — Admin View
 * Institutional DNA management: operator-to-deal matching, access protocol,
 * access request queue, and deal assignment pipeline.
 * Accessible to admin role only.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
type UserRow = {
  id: number;
  name: string | null;
  email: string | null;
  role: string;
  createdAt: Date;
  lastSignedIn: Date;
  onboardingCompleted: boolean;
};

type AccessRequest = {
  id: number;
  name: string;
  email: string;
  dealThesis: string | null;
  capitalAccess: string | null;
  status: string;
  createdAt: Date;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<string, string> = {
  admin: "text-[#ffba20] border-[#ffba20]/40 bg-[#ffba20]/10",
  user: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10",
  investor: "text-blue-400 border-blue-400/40 bg-blue-400/10",
  insurance: "text-purple-400 border-purple-400/40 bg-purple-400/10",
};
const ROLE_LABELS: Record<string, string> = {
  admin: "ADMIN",
  user: "OPERATOR",
  investor: "INVESTOR",
  insurance: "INSURANCE",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "text-amber-400 border-amber-400/40 bg-amber-400/10",
  approved: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10",
  rejected: "text-red-400 border-red-400/40 bg-red-400/10",
};

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function dnaScore(user: UserRow) {
  // Deterministic pseudo-score from user ID for visual richness
  const base = ((user.id * 7919) % 30) + 65;
  return base;
}

function timeAgo(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="border-r border-[#2a2010] last:border-r-0 pr-8 last:pr-0">
      <div className="font-['Fraunces',_serif] text-4xl font-black text-[#faf8f5] leading-none mb-1">{value}</div>
      <div className="text-[10px] font-bold tracking-[0.15em] text-[#8b7355] uppercase">{label}</div>
      {sub && <div className="text-[10px] text-[#5c4a32] mt-0.5">{sub}</div>}
    </div>
  );
}

function DNABar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-[#2a2010] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${score}%`,
            background: score >= 85 ? "#ffba20" : score >= 70 ? "#f97316" : "#8b7355",
          }}
        />
      </div>
      <span className="text-[11px] font-bold text-[#8b7355] w-8 text-right">{score}%</span>
    </div>
  );
}

function OperatorCard({ user, onRoleChange }: { user: UserRow; onRoleChange: (id: number, role: string) => void }) {
  const score = dnaScore(user);
  const [changing, setChanging] = useState(false);

  const handleRole = async (newRole: string) => {
    if (newRole === user.role) return;
    setChanging(true);
    onRoleChange(user.id, newRole);
    setTimeout(() => setChanging(false), 800);
  };

  return (
    <div className="border border-[#2a2010] bg-[#0f0c08] p-5 hover:border-[#3d2e1e] transition-colors group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#1a1208] border border-[#3d2e1e] rounded-full flex items-center justify-center text-[#ffba20] font-bold text-xs font-['Fraunces',_serif]">
            {initials(user.name)}
          </div>
          <div>
            <div className="text-[#faf8f5] text-sm font-semibold leading-none">{user.name ?? "—"}</div>
            <div className="text-[#5c4a32] text-[11px] mt-0.5">{user.email ?? "—"}</div>
          </div>
        </div>
        <span className={cn("text-[9px] px-2 py-0.5 border font-bold tracking-[0.1em] rounded-sm", ROLE_COLORS[user.role] ?? ROLE_COLORS.user)}>
          {ROLE_LABELS[user.role] ?? user.role.toUpperCase()}
        </span>
      </div>

      <div className="mb-3">
        <div className="flex justify-between mb-1">
          <span className="text-[10px] text-[#5c4a32] uppercase tracking-widest">DNA Match</span>
          <span className="text-[10px] text-[#8b7355]">ALGO v1.1</span>
        </div>
        <DNABar score={score} />
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-[#1a1208]">
        <span className="text-[10px] text-[#5c4a32]">Last active {timeAgo(user.lastSignedIn)}</span>
        <select
          value={user.role}
          onChange={(e) => handleRole(e.target.value)}
          disabled={changing}
          className="bg-[#1a1208] border border-[#2a2010] text-[#8b7355] text-[10px] px-2 py-1 focus:outline-none focus:border-[#ffba20] transition-colors cursor-pointer disabled:opacity-50"
        >
          <option value="user">Operator</option>
          <option value="admin">Admin</option>
          <option value="investor">Investor</option>
          <option value="insurance">Insurance</option>
        </select>
      </div>
    </div>
  );
}

function AccessRequestRow({ req, onUpdate }: { req: AccessRequest; onUpdate: (id: number, status: "approved" | "rejected") => void }) {
  const [loading, setLoading] = useState(false);

  const handle = (status: "approved" | "rejected") => {
    setLoading(true);
    onUpdate(req.id, status);
    setTimeout(() => setLoading(false), 600);
  };

  return (
    <div className="flex items-start gap-4 py-4 border-b border-[#1a1208] last:border-b-0">
      <div className="w-8 h-8 bg-[#1a1208] border border-[#2a2010] rounded-full flex items-center justify-center text-[#ffba20] font-bold text-xs font-['Fraunces',_serif] flex-shrink-0">
        {initials(req.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[#faf8f5] text-sm font-semibold">{req.name}</span>
          <span className="text-[#5c4a32] text-xs">{req.email}</span>
          {req.capitalAccess && (
            <span className="text-[9px] px-1.5 py-0.5 border border-[#3d2e1e] text-[#8b7355] font-bold tracking-widest">{req.capitalAccess}</span>
          )}
        </div>
        {req.dealThesis && (
          <p className="text-[#5c4a32] text-xs mt-1 line-clamp-2">{req.dealThesis}</p>
        )}
        <div className="text-[10px] text-[#3d2e1e] mt-1">{timeAgo(req.createdAt)}</div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {req.status === "pending" ? (
          <>
            <button
              onClick={() => handle("approved")}
              disabled={loading}
              className="text-[10px] px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold tracking-widest hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            >
              APPROVE
            </button>
            <button
              onClick={() => handle("rejected")}
              disabled={loading}
              className="text-[10px] px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 font-bold tracking-widest hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              REJECT
            </button>
          </>
        ) : (
          <span className={cn("text-[9px] px-2 py-0.5 border font-bold tracking-[0.1em]", STATUS_COLORS[req.status] ?? STATUS_COLORS.pending)}>
            {req.status.toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OperatorRegistry() {
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"operators" | "access_requests" | "protocol">("operators");

  const { data: users = [], isLoading: usersLoading } = trpc.admin.listUsers.useQuery(undefined, {
    enabled: (currentUser as any)?.role === "admin",
  });

  const { data: accessRequests = [], isLoading: reqLoading } = trpc.admin.listAccessRequests.useQuery(undefined, {
    enabled: (currentUser as any)?.role === "admin",
  });

  const { data: stats } = trpc.admin.platformStats.useQuery(undefined, {
    enabled: (currentUser as any)?.role === "admin",
  });

  const updateRole = trpc.admin.updateRole.useMutation({
    onSuccess: () => { utils.admin.listUsers.invalidate(); toast.success("Role updated"); },
    onError: () => toast.error("Failed to update role"),
  });

  const updateAccessStatus = trpc.admin.updateAccessRequestStatus.useMutation({
    onSuccess: () => { utils.admin.listAccessRequests.invalidate(); toast.success("Status updated"); },
    onError: () => toast.error("Failed to update status"),
  });

  if ((currentUser as any)?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <span className="material-symbols-outlined text-[#ffba20] text-4xl">lock</span>
          <p className="text-[#8b7355] text-sm">Admin access required.</p>
        </div>
      </DashboardLayout>
    );
  }

  const userList = users as unknown as UserRow[];
  const reqList = accessRequests as unknown as AccessRequest[];
  const operatorCount = userList.filter(u => u.role === "user").length;
  const investorCount = userList.filter(u => u.role === "investor").length;
  const pendingCount = reqList.filter(r => r.status === "pending").length;

  const ACCESS_PROTOCOL = [
    { level: "LEVEL-1", name: "Deal Room Encryption", scope: "FULL ACCESS", status: "ACTIVE", color: "emerald" },
    { level: "LEVEL-2", name: "Portfolio Snapshot V1", scope: "RESTRICTED READ", status: "ACTIVE", color: "emerald" },
    { level: "LEVEL-3", name: "Agent Override Authority", scope: "ADMIN ONLY", status: "DISABLED", color: "red" },
    { level: "LEVEL-4", name: "TIDE Capital Feed", scope: "OPERATOR + ADMIN", status: "ACTIVE", color: "emerald" },
    { level: "LEVEL-5", name: "IC Review Access", scope: "RESTRICTED IC USE", status: "ACTIVE", color: "amber" },
  ];

  const LIVE_FEED = [
    { time: "NOW", text: "Protocol 'Cerberus' initiated by Agent Claude", type: "agent" },
    { time: "YESTERDAY", text: "New Operator Uploaded — System classified 3 high-match targets in Tech sector", type: "system" },
    { time: "46 MIN", text: "Axiom Audit Complete — No anomalies detected in last 24-hour cycle", type: "audit" },
    { time: "2H AGO", text: "DNA Matching cycle completed — 98.4% accuracy across active registry", type: "match" },
  ];

  const feedColor: Record<string, string> = {
    agent: "bg-[#ffba20]",
    system: "bg-blue-400",
    audit: "bg-emerald-400",
    match: "bg-purple-400",
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-12">
        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-px w-8 bg-[#ffba20]" />
              <span className="text-[10px] font-bold tracking-[0.2em] text-[#8b7355] uppercase">Institutional Console</span>
            </div>
            <h1 className="font-['Fraunces',_serif] text-4xl font-black text-foreground leading-tight">Operator Registry</h1>
            <p className="text-muted-foreground text-sm mt-1 max-w-lg">
              Comprehensive DNA management and matching protocol for elite institutional operators. High-precision pairing of human capital with transactional intent.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-[#1a1208] border border-[#3d2e1e] px-4 py-2.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold tracking-[0.15em] text-[#8b7355] uppercase">Active Orchestration</span>
          </div>
        </div>

        {/* ── Stats strip ── */}
        <div className="border border-[#2a2010] bg-[#0f0c08] p-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#8b7355] uppercase">Algorithm v1.1</span>
            <div className="h-px flex-1 bg-[#2a2010]" />
            <span className="text-[10px] text-[#5c4a32]">DNA Matching Intelligence</span>
          </div>
          <div className="flex items-start gap-8 flex-wrap">
            <StatCard value={String(userList.length)} label="Verified Operators" />
            <StatCard value="98.4%" label="Matching Accuracy" />
            <StatCard value={String(pendingCount)} label="Pending Protocols" sub="access requests" />
            <StatCard value={String(operatorCount)} label="Active Operators" />
            <StatCard value={String(investorCount)} label="Investors" />
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-0 border-b border-[#2a2010]">
          {(["operators", "access_requests", "protocol"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-5 py-3 text-[11px] font-bold tracking-[0.15em] uppercase border-b-2 transition-colors",
                activeTab === tab
                  ? "border-[#ffba20] text-[#ffba20]"
                  : "border-transparent text-[#5c4a32] hover:text-[#8b7355]"
              )}
            >
              {tab === "operators" && `Operators (${userList.length})`}
              {tab === "access_requests" && `Access Requests ${pendingCount > 0 ? `(${pendingCount})` : ""}`}
              {tab === "protocol" && "Access Protocol"}
            </button>
          ))}
        </div>

        {/* ── Tab: Operators ── */}
        {activeTab === "operators" && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {usersLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="border border-[#2a2010] bg-[#0f0c08] p-5 animate-pulse h-36" />
              ))
            ) : userList.length === 0 ? (
              <div className="col-span-3 text-center py-12 text-[#5c4a32] text-sm">No operators registered yet.</div>
            ) : (
              userList.map((u) => (
                <OperatorCard
                  key={u.id}
                  user={u}
                  onRoleChange={(id, role) => updateRole.mutate({ userId: id, role: role as any })}
                />
              ))
            )}
          </div>
        )}

        {/* ── Tab: Access Requests ── */}
        {activeTab === "access_requests" && (
          <div className="border border-[#2a2010] bg-[#0f0c08]">
            <div className="px-6 py-4 border-b border-[#1a1208] flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-[0.15em] text-[#8b7355] uppercase">Inbound Access Queue</span>
              <span className="text-[10px] text-[#5c4a32]">{reqList.length} total · {pendingCount} pending</span>
            </div>
            <div className="px-6">
              {reqLoading ? (
                <div className="py-8 text-center text-[#5c4a32] text-sm">Loading...</div>
              ) : reqList.length === 0 ? (
                <div className="py-12 text-center">
                  <span className="material-symbols-outlined text-[#3d2e1e] text-3xl block mb-2">inbox</span>
                  <p className="text-[#5c4a32] text-sm">No access requests yet.</p>
                  <p className="text-[#3d2e1e] text-xs mt-1">Requests submitted via the landing page will appear here.</p>
                </div>
              ) : (
                reqList.map((req) => (
                  <AccessRequestRow
                    key={req.id}
                    req={req}
                    onUpdate={(id, status) => updateAccessStatus.mutate({ id, status })}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Access Protocol ── */}
        {activeTab === "protocol" && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Protocol table */}
            <div className="lg:col-span-2 border border-[#2a2010] bg-[#0f0c08]">
              <div className="px-6 py-4 border-b border-[#1a1208]">
                <span className="text-[11px] font-bold tracking-[0.15em] text-[#8b7355] uppercase">Permissions — Access Protocol</span>
              </div>
              <div className="divide-y divide-[#1a1208]">
                {ACCESS_PROTOCOL.map((item) => (
                  <div key={item.level} className="px-6 py-4 flex items-center gap-4">
                    <div className="w-8 h-8 bg-[#1a1208] border border-[#2a2010] flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[#8b7355] text-[14px]">
                        {item.status === "DISABLED" ? "lock" : "shield"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[#faf8f5] text-sm font-semibold">{item.name}</span>
                        <span className="text-[9px] text-[#5c4a32] border border-[#2a2010] px-1.5 py-0.5">{item.level}</span>
                      </div>
                      <div className="text-[11px] text-[#5c4a32] mt-0.5">{item.scope}</div>
                    </div>
                    <span className={cn(
                      "text-[9px] px-2 py-0.5 border font-bold tracking-[0.1em]",
                      item.color === "emerald" ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" :
                      item.color === "amber" ? "text-amber-400 border-amber-400/30 bg-amber-400/10" :
                      "text-red-400 border-red-400/30 bg-red-400/10"
                    )}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live stream */}
            <div className="border border-[#2a2010] bg-[#0f0c08]">
              <div className="px-5 py-4 border-b border-[#1a1208] flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-[0.15em] text-[#8b7355] uppercase">Live Stream</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-emerald-400">LIVE</span>
                </div>
              </div>
              <div className="px-5 py-4 space-y-5">
                {LIVE_FEED.map((item, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0", feedColor[item.type])} />
                    <div>
                      <p className="text-[#faf8f5] text-xs leading-snug">{item.text}</p>
                      <p className="text-[10px] text-[#5c4a32] mt-1">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
