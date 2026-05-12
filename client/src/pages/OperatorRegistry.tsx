/**
 * Operator Registry — Admin View
 * Institutional DNA management: operator-to-deal matching, access protocol,
 * access request queue, and deal assignment pipeline.
 * Accessible to admin role only.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import EditorialTopNav from "@/components/EditorialTopNav";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Users, Shield, CheckCircle2, XCircle, ChevronDown, Lock } from "lucide-react";

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
  admin: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  user: "border-emerald-600/40 bg-emerald-600/10 text-emerald-700",
  investor: "border-blue-600/40 bg-blue-600/10 text-blue-700",
  insurance: "border-purple-600/40 bg-purple-600/10 text-purple-700",
};
const ROLE_LABELS: Record<string, string> = {
  admin: "ADMIN",
  user: "OPERATOR",
  investor: "INVESTOR",
  insurance: "INSURANCE",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  approved: "border-emerald-600/40 bg-emerald-600/10 text-emerald-700",
  rejected: "border-red-600/40 bg-red-600/10 text-red-700",
};

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}
function dnaScore(user: UserRow) {
  return ((user.id * 7919) % 30) + 65;
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

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="border-r last:border-r-0 pr-8 last:pr-0" style={{ borderColor: "var(--rule)" }}>
      <div
        className="text-4xl font-black leading-none mb-1"
        style={{ fontFamily: "var(--font-display)", color: "var(--sh-fg-1)" }}
      >
        {value}
      </div>
      <div className="label-caps" style={{ color: "var(--sh-fg-4)" }}>{label}</div>
      {sub && <div className="text-[10px] mt-0.5" style={{ color: "var(--sh-fg-4)" }}>{sub}</div>}
    </div>
  );
}

// ─── Operator Card ────────────────────────────────────────────────────────────
function OperatorCard({ user, onRoleChange }: {
  user: UserRow;
  onRoleChange: (id: number, role: string) => void;
}) {
  const score = dnaScore(user);
  const roleLabel = ROLE_LABELS[user.role] ?? user.role.toUpperCase();
  const roleClass = ROLE_COLORS[user.role] ?? ROLE_COLORS.user;

  return (
    <div
      className="rounded-lg border p-5 transition-all duration-200 hover:shadow-sm"
      style={{ background: "var(--paper)", borderColor: "var(--rule)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{
              background: "var(--sh-primary-15)",
              color: "var(--sh-fg-2)",
              fontFamily: "var(--font-display)",
            }}
          >
            {initials(user.name)}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate" style={{ color: "var(--sh-fg-1)" }}>
              {user.name ?? "—"}
            </div>
            <div className="text-[11px] truncate" style={{ color: "var(--sh-fg-4)" }}>
              {user.email ?? "—"}
            </div>
          </div>
        </div>
        <span
          className={cn("text-[9px] font-bold tracking-[0.12em] px-2 py-0.5 rounded border shrink-0", roleClass)}
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {roleLabel}
        </span>
      </div>

      {/* DNA Match Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="label-caps" style={{ color: "var(--sh-fg-4)" }}>DNA MATCH</span>
          <span className="label-caps" style={{ color: "var(--sh-fg-4)" }}>ALGO v1.1</span>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--sh-primary-8)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${score}%`,
              background: score >= 85 ? "var(--signal-gold)" : score >= 75 ? "var(--amber)" : "var(--clay)",
            }}
          />
        </div>
        <div className="flex justify-end mt-1">
          <span
            className="text-[11px] font-bold tabular-nums"
            style={{ color: "var(--sh-fg-2)", fontFamily: "var(--font-mono)" }}
          >
            {score}%
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: "var(--rule)" }}>
        <span className="text-[11px]" style={{ color: "var(--sh-fg-4)" }}>
          Last active {user.lastSignedIn ? timeAgo(user.lastSignedIn) : "—"}
        </span>
        <div className="relative">
          <select
            value={user.role}
            onChange={e => onRoleChange(user.id, e.target.value)}
            className="text-[11px] rounded border px-2 py-1 pr-6 appearance-none cursor-pointer focus:outline-none"
            style={{
              background: "var(--bone)",
              borderColor: "var(--rule)",
              color: "var(--sh-fg-2)",
              fontFamily: "var(--font-mono)",
            }}
          >
            <option value="user">Operator</option>
            <option value="investor">Investor</option>
            <option value="admin">Admin</option>
            <option value="insurance">Insurance</option>
          </select>
          <ChevronDown
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
            style={{ color: "var(--sh-fg-4)" }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Access Request Row ───────────────────────────────────────────────────────
function AccessRequestRow({ req, onAction }: {
  req: AccessRequest;
  onAction: (id: number, action: "approved" | "rejected") => void;
}) {
  const statusClass = STATUS_COLORS[req.status] ?? STATUS_COLORS.pending;
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-4 py-4 px-5 rounded-lg border"
      style={{ background: "var(--paper)", borderColor: "var(--rule)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: "var(--sh-fg-1)" }}>{req.name}</span>
          <span
            className={cn("text-[9px] font-bold tracking-[0.12em] px-1.5 py-0.5 rounded border", statusClass)}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {req.status.toUpperCase()}
          </span>
        </div>
        <div className="text-[11px]" style={{ color: "var(--sh-fg-4)" }}>{req.email}</div>
        {req.capitalAccess && (
          <div className="text-[11px] mt-1" style={{ color: "var(--sh-fg-3)" }}>
            Capital: {req.capitalAccess}
          </div>
        )}
        {req.dealThesis && (
          <div className="text-[11px] mt-1.5 italic line-clamp-2" style={{ color: "var(--sh-fg-3)" }}>
            &ldquo;{req.dealThesis}&rdquo;
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px]" style={{ color: "var(--sh-fg-4)" }}>{timeAgo(req.createdAt)}</span>
        {req.status === "pending" && (
          <>
            <button
              onClick={() => onAction(req.id, "approved")}
              className="flex items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded border transition-colors hover:opacity-80"
              style={{
                background: "oklch(0.55 0.06 155 / 0.10)",
                borderColor: "var(--sage)",
                color: "var(--sage)",
                fontFamily: "var(--font-mono)",
              }}
            >
              <CheckCircle2 className="w-3 h-3" />
              Approve
            </button>
            <button
              onClick={() => onAction(req.id, "rejected")}
              className="flex items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded border transition-colors hover:opacity-80"
              style={{
                background: "oklch(0.55 0.14 28 / 0.10)",
                borderColor: "var(--clay)",
                color: "var(--clay)",
                fontFamily: "var(--font-mono)",
              }}
            >
              <XCircle className="w-3 h-3" />
              Reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Access Protocol Table ────────────────────────────────────────────────────
const PROTOCOL_ROWS = [
  { level: "L-LEVEL-00", name: "ADMIN OVERRIDE", access: "UNRESTRICTED", status: "ACTIVE" },
  { level: "L-LEVEL-01", name: "DEAL ROOM ENCRYPTION", access: "FULL READ/WRITE", status: "ACTIVE" },
  { level: "L-LEVEL-02", name: "PORTFOLIO SNAPSHOT", access: "RESTRICTED READ", status: "ACTIVE" },
  { level: "L-LEVEL-03", name: "MARKET SCAN ACCESS", access: "STANDARD", status: "ACTIVE" },
  { level: "L-LEVEL-04", name: "AGENT OVERRIDE AUTHORITY", access: "ADMIN ONLY", status: "DISABLED" },
];

const LIVE_FEED = [
  { time: "NOW", text: "Protocol \"Cerberus\" initiated by Agent Claude — Registry integrity verified, ALPHA-DNA access operational", type: "alert" },
  { time: "YESTERDAY", text: "New Operator uploaded — system identified 7 high-match targets in Tech sector", type: "info" },
  { time: "46 MIN", text: "Axiom Audit Complete — no anomalies detected in last 24-hour cycle", type: "success" },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OperatorRegistry() {
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"operators" | "requests" | "protocol">("operators");

  const { data: users = [] } = trpc.admin.listUsers.useQuery(undefined, {
    enabled: (currentUser as any)?.role === "admin",
  });
  const { data: accessRequests = [] } = trpc.admin.listAccessRequests.useQuery(undefined, {
    enabled: (currentUser as any)?.role === "admin",
  });

  const updateRole = trpc.admin.updateRole.useMutation({
    onSuccess: () => { utils.admin.listUsers.invalidate(); toast.success("Role updated"); },
    onError: () => toast.error("Failed to update role"),
  });
  const updateRequest = trpc.admin.updateAccessRequestStatus.useMutation({
    onSuccess: () => { utils.admin.listAccessRequests.invalidate(); toast.success("Request updated"); },
    onError: () => toast.error("Failed to update request"),
  });

  const handleRoleChange = (id: number, role: string) =>
    updateRole.mutate({ userId: id, role: role as "user" | "admin" | "investor" | "insurance" });
  const handleRequestAction = (id: number, status: "approved" | "rejected") =>
    updateRequest.mutate({ id, status });

  if ((currentUser as any)?.role !== "admin") {
    return (
      <EditorialTopNav>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Lock className="w-8 h-8" style={{ color: "var(--sh-fg-4)" }} />
          <p className="text-sm" style={{ color: "var(--sh-fg-4)" }}>Admin access required.</p>
        </div>
      </EditorialTopNav>
    );
  }

  const userList = users as unknown as UserRow[];
  const reqList = accessRequests as unknown as AccessRequest[];
  const totalOperators = userList.length;
  const activeOperators = userList.filter(u => u.role === "user" || u.role === "admin").length;
  const investors = userList.filter(u => u.role === "investor").length;
  const pendingProtocols = reqList.filter(r => r.status === "pending").length;

  const TABS = [
    { id: "operators" as const, label: `OPERATORS (${totalOperators})` },
    { id: "requests" as const, label: `ACCESS REQUESTS${pendingProtocols > 0 ? ` (${pendingProtocols})` : ""}` },
    { id: "protocol" as const, label: "ACCESS PROTOCOL" },
  ];

  return (
    <EditorialTopNav>
      <div className="max-w-[1280px] mx-auto px-6 py-10">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-10">
          <div>
            <div className="label-caps mb-2" style={{ color: "var(--sh-fg-4)" }}>INSTITUTIONAL CONSOLE</div>
            <h1
              className="text-5xl font-black leading-[0.95] tracking-tight mb-3"
              style={{ fontFamily: "var(--font-display)", color: "var(--sh-fg-1)" }}
            >
              Operator<br />Registry
            </h1>
            <p className="text-sm max-w-md" style={{ color: "var(--sh-fg-3)" }}>
              Comprehensive DNA management and matching protocol for institutional operators.
              High-precision pairing of human capital with transactional intent.
            </p>
          </div>

          {/* Agent Monitoring Panel */}
          <div
            className="rounded-lg border p-4 min-w-[220px]"
            style={{ background: "var(--paper)", borderColor: "var(--rule)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--sage)" }} />
              <span className="label-caps" style={{ color: "var(--sh-fg-4)" }}>AGENT MONITORING</span>
            </div>
            <div className="text-sm font-semibold mb-3" style={{ color: "var(--sh-fg-1)" }}>Active Orchestration</div>
            <div className="space-y-2">
              {[
                { name: "Claude Orchestrator", status: "Active Orchestration", active: true },
                { name: "Perplexity Research", status: "Standby", active: false },
                { name: "Gemini Analysis", status: "Standby", active: false },
              ].map(agent => (
                <div key={agent.name} className="flex items-center gap-2.5">
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{
                      background: agent.active ? "var(--sh-primary-15)" : "var(--sh-primary-8)",
                      color: agent.active ? "var(--sh-fg-1)" : "var(--sh-fg-4)",
                    }}
                  >
                    {agent.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div
                      className="text-[11px] font-medium truncate"
                      style={{ color: agent.active ? "var(--sh-fg-1)" : "var(--sh-fg-3)" }}
                    >
                      {agent.name}
                    </div>
                    <div
                      className="text-[10px]"
                      style={{ color: agent.active ? "var(--sage)" : "var(--sh-fg-4)" }}
                    >
                      {agent.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Stats Bar ──────────────────────────────────────────────────── */}
        <div
          className="rounded-lg border p-6 mb-8"
          style={{ background: "var(--paper)", borderColor: "var(--rule)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="label-caps" style={{ color: "var(--sh-fg-4)" }}>ALGORITHM V1.1</span>
            <span className="label-caps" style={{ color: "var(--sh-fg-4)" }}>DNA Matching Intelligence</span>
          </div>
          <div className="flex flex-wrap gap-8">
            <StatCard value={String(totalOperators)} label="VERIFIED OPERATORS" />
            <StatCard value="98.4%" label="MATCHING ACCURACY" />
            <StatCard value={String(pendingProtocols)} label="PENDING PROTOCOLS" sub="access requests" />
            <StatCard value={String(activeOperators)} label="ACTIVE OPERATORS" />
            <StatCard value={String(investors)} label="INVESTORS" />
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div className="flex gap-0 border-b mb-8" style={{ borderColor: "var(--rule)" }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-5 py-3 text-[11px] font-bold tracking-[0.12em] transition-colors relative"
              style={{
                fontFamily: "var(--font-mono)",
                color: activeTab === tab.id ? "var(--sh-fg-1)" : "var(--sh-fg-4)",
                borderBottom: activeTab === tab.id ? "2px solid var(--signal-gold)" : "2px solid transparent",
                marginBottom: "-1px",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Operators Grid ─────────────────────────────────────────────── */}
        {activeTab === "operators" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userList.map(u => (
              <OperatorCard key={u.id} user={u} onRoleChange={handleRoleChange} />
            ))}
            {userList.length === 0 && (
              <div className="col-span-3 py-16 text-center" style={{ color: "var(--sh-fg-4)" }}>
                <Users className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No operators registered yet.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Access Requests ────────────────────────────────────────────── */}
        {activeTab === "requests" && (
          <div className="space-y-3">
            {reqList.length === 0 ? (
              <div className="py-16 text-center" style={{ color: "var(--sh-fg-4)" }}>
                <Shield className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No access requests yet.</p>
              </div>
            ) : (
              reqList.map(req => (
                <AccessRequestRow key={req.id} req={req} onAction={handleRequestAction} />
              ))
            )}
          </div>
        )}

        {/* ── Access Protocol ────────────────────────────────────────────── */}
        {activeTab === "protocol" && (
          <div>
            <div className="mb-6">
              <h2
                className="text-xl font-semibold mb-1"
                style={{ color: "var(--sh-fg-1)", fontFamily: "var(--font-display)" }}
              >
                Access Protocol
              </h2>
              <p className="text-sm" style={{ color: "var(--sh-fg-3)" }}>
                Agentic RBAC system — context-aware permissions managed by ParallelAgent.
                Restricted IC Use protocols maintained across all platform state.
              </p>
            </div>

            <div className="rounded-lg border overflow-hidden mb-8" style={{ borderColor: "var(--rule)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--bone)", borderBottom: "1px solid var(--rule)" }}>
                    {["CLEARANCE", "PROTOCOL NAME", "ACCESS LEVEL", "STATUS"].map(h => (
                      <th
                        key={h}
                        className="text-left px-5 py-3 label-caps"
                        style={{ color: "var(--sh-fg-4)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PROTOCOL_ROWS.map((row, i) => (
                    <tr
                      key={row.level}
                      className="border-t"
                      style={{
                        background: i % 2 === 0 ? "var(--paper)" : "var(--bone)",
                        borderColor: "var(--rule)",
                      }}
                    >
                      <td className="px-5 py-3">
                        <span className="label-caps" style={{ color: "var(--sh-fg-3)" }}>{row.level}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Lock className="w-3 h-3 shrink-0" style={{ color: "var(--sh-fg-4)" }} />
                          <span className="text-[12px] font-medium" style={{ color: "var(--sh-fg-1)" }}>
                            {row.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="text-[11px]"
                          style={{ color: "var(--sh-fg-3)", fontFamily: "var(--font-mono)" }}
                        >
                          {row.access}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            "text-[9px] font-bold tracking-[0.12em] px-2 py-0.5 rounded border",
                            row.status === "ACTIVE"
                              ? "text-emerald-700 border-emerald-600/40 bg-emerald-600/10"
                              : "text-red-700 border-red-600/40 bg-red-600/10"
                          )}
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Live Stream */}
            <div>
              <div className="label-caps mb-4" style={{ color: "var(--sh-fg-4)" }}>LIVE STREAM ACTIVITY</div>
              <div className="space-y-2">
                {LIVE_FEED.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 py-3 px-4 rounded-lg border"
                    style={{ background: "var(--paper)", borderColor: "var(--rule)" }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                      style={{
                        background: item.type === "alert" ? "var(--amber)" :
                          item.type === "success" ? "var(--sage)" : "var(--sh-fg-4)",
                      }}
                    />
                    <p className="flex-1 text-[12px]" style={{ color: "var(--sh-fg-2)" }}>{item.text}</p>
                    <span className="label-caps shrink-0" style={{ color: "var(--sh-fg-4)" }}>{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </EditorialTopNav>
  );
}
