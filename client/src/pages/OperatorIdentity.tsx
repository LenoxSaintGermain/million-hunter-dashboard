/**
 * Operator Identity — Personal Bureau
 * The user's private digital office: clearance badge, Investment DNA Heatmap,
 * Agentic Command interface for hunting parameters, and Security & Access log.
 * Accessible to all authenticated users.
 */
import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ROLE_CLEARANCE: Record<string, { label: string; level: string; color: string }> = {
  admin: { label: "ADMIN", level: "L-LEVEL-00", color: "text-[#ffba20] border-[#ffba20]/40" },
  user: { label: "OPERATOR", level: "L-LEVEL-07", color: "text-emerald-400 border-emerald-400/40" },
  investor: { label: "INVESTOR", level: "L-LEVEL-04", color: "text-blue-400 border-blue-400/40" },
  insurance: { label: "INSURANCE", level: "L-LEVEL-03", color: "text-purple-400 border-purple-400/40" },
};

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// Deterministic DNA heatmap values from user ID
function dnaProfile(userId: number) {
  const seed = userId || 1;
  return {
    riskTolerance: ((seed * 3571) % 40) + 45,      // 45–85
    sectorBias: ((seed * 7919) % 35) + 50,          // 50–85
    dealVelocity: ((seed * 1009) % 45) + 40,        // 40–85
    capitalDeployment: ((seed * 4649) % 30) + 55,   // 55–85
    negotiationStyle: ((seed * 2311) % 50) + 35,    // 35–85
    diligenceDepth: ((seed * 6271) % 40) + 50,      // 50–90
  };
}

function HeatBar({ label, value, active = true }: { label: string; value: number; active?: boolean }) {
  const [animated, setAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(t);
  }, []);

  const color = value >= 75 ? "#ffba20" : value >= 60 ? "#f97316" : "#8b7355";
  return (
    <div ref={ref} className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold tracking-[0.12em] text-[#8b7355] uppercase">{label}</span>
        <span className="text-[11px] font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 bg-[#1a1208] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: animated ? `${value}%` : "0%", background: color }}
        />
      </div>
    </div>
  );
}

// Visual heatmap grid — 5×8 cells colored by DNA intensity
function DNAHeatGrid({ dna }: { dna: ReturnType<typeof dnaProfile> }) {
  const values = Object.values(dna);
  const cells = Array.from({ length: 40 }, (_, i) => {
    const base = values[i % values.length];
    const jitter = ((i * 1337) % 20) - 10;
    return Math.max(10, Math.min(100, base + jitter));
  });

  return (
    <div className="grid grid-cols-8 gap-1">
      {cells.map((v, i) => (
        <div
          key={i}
          className="h-5 rounded-sm transition-all duration-500"
          style={{
            background: v >= 75 ? `rgba(255,186,32,${v / 100})` :
                        v >= 55 ? `rgba(249,115,22,${v / 100 * 0.8})` :
                                  `rgba(139,115,85,${v / 100 * 0.5})`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Agentic Command Input ────────────────────────────────────────────────────
function AgenticCommandPanel({ userId, initialParams }: { userId: number; initialParams: string | null }) {
  const [command, setCommand] = useState(initialParams ?? "");
  const [committed, setCommitted] = useState(false);
  const [transmitting, setTransmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const saveParams = trpc.user.saveHuntingParams.useMutation({
    onSuccess: () => {
      setTransmitting(false);
      setCommitted(true);
      toast.success("Hunting parameters committed to OS");
      setTimeout(() => setCommitted(false), 3000);
    },
    onError: () => {
      setTransmitting(false);
      toast.error("Transmission failed");
    },
  });

  const handleCommit = () => {
    if (!command.trim()) return;
    setTransmitting(true);
    setCommitted(false);
    saveParams.mutate({ params: command.trim() });
  };

  const EXAMPLE_PROMPTS = [
    "Only show Atlanta logistics with >15% SDE margins and primary debt coverage above 1.4x.",
    "Flag any distress indicators in Midwest manufacturing portfolios immediately via encrypted tunnel.",
    "Prioritize owner-operated businesses under $3M asking with retirement signals in Southeast US.",
  ];

  return (
    <div className="border border-[#2a2010] bg-[#0f0c08]">
      <div className="px-5 py-4 border-b border-[#1a1208]">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-px w-6 bg-[#ffba20]" />
          <span className="text-[10px] font-bold tracking-[0.2em] text-[#8b7355] uppercase">Agentic Interface</span>
        </div>
        <h3 className="font-['Fraunces',_serif] text-xl font-black text-[#faf8f5]">Direct Configuration</h3>
        <p className="text-[#5c4a32] text-xs mt-1 leading-relaxed">
          The OS does not utilize static forms. Instruct your assigned agents via natural language to refine signal filters, threshold alerts, and deal prioritization logic.
        </p>
      </div>

      {/* Active protocol examples */}
      <div className="px-5 py-4 border-b border-[#1a1208]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-[#ffba20] animate-pulse" />
          <span className="text-[10px] font-bold tracking-[0.15em] text-[#ffba20] uppercase">Active Protocol</span>
        </div>
        <div className="space-y-2">
          {EXAMPLE_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => { setCommand(p); textareaRef.current?.focus(); }}
              className="w-full text-left text-xs text-[#8b7355] italic px-3 py-2 border border-[#1a1208] hover:border-[#3d2e1e] hover:text-[#faf8f5] transition-colors"
            >
              "{p}"
            </button>
          ))}
        </div>
      </div>

      {/* Command input */}
      <div className="px-5 py-4">
        <div className="border border-[#2a2010] bg-[#080604] focus-within:border-[#ffba20]/50 transition-colors">
          <div className="px-4 pt-3 pb-1">
            <span className="text-[9px] font-bold tracking-[0.2em] text-[#5c4a32] uppercase">Command Input</span>
          </div>
          <textarea
            ref={textareaRef}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Instruct the Signal Hunter OS..."
            rows={4}
            className="w-full bg-transparent text-[#faf8f5] placeholder-[#3d2e1e] px-4 pb-3 text-sm focus:outline-none resize-none"
          />
          <div className="flex items-center justify-between px-4 pb-3 border-t border-[#1a1208] pt-2">
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-[#5c4a32] font-mono">COMMITTED TO</span>
              <span className="text-[9px] text-[#ffba20] font-mono font-bold">CLAUDE_01_CORE</span>
            </div>
            <button
              onClick={handleCommit}
              disabled={transmitting || !command.trim()}
              className={cn(
                "flex items-center gap-2 text-[10px] font-bold tracking-[0.15em] px-4 py-1.5 transition-all disabled:opacity-40",
                committed
                  ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                  : "bg-[#ffba20] text-[#1a1208] hover:bg-[#ffd060]"
              )}
            >
              {transmitting ? (
                <>
                  <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                  TRANSMITTING
                </>
              ) : committed ? (
                <>
                  <span className="material-symbols-outlined text-[14px]">check</span>
                  COMMITTED
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  TRANSMIT INSTRUCTION
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Security & Access ────────────────────────────────────────────────────────
function SecurityPanel({ user }: { user: any }) {
  const identityHash = user?.openId
    ? `SHA256:${user.openId.slice(0, 8).toUpperCase()}...${user.openId.slice(-4).toUpperCase()}`
    : "SHA256:PENDING...";

  const SESSION_LOG = [
    { time: "14:22:01", event: "Vault Access: Sector Heatmap", detail: `IP: 10.0.0.1 · ZURICH_NODE_A` },
    { time: "12:05:45", event: "Protocol Shift: Atlanta Logistics", detail: "ORCHESTRATOR_SYNC_COMPLETE" },
    { time: "09:15:22", event: "Biometric Auth: Identity Confirmed", detail: "KEY_ROTATION_ACCESS" },
  ];

  return (
    <div className="border border-[#2a2010] bg-[#0f0c08]">
      <div className="px-5 py-4 border-b border-[#1a1208]">
        <h3 className="font-['Fraunces',_serif] text-xl font-black text-[#faf8f5]">Security & Access</h3>
      </div>
      <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#1a1208]">
        {/* Session log */}
        <div className="px-5 py-4">
          <span className="text-[10px] font-bold tracking-[0.15em] text-[#8b7355] uppercase block mb-3">Encrypted Session Log</span>
          <div className="space-y-3">
            {SESSION_LOG.map((item, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-[#1a1208] last:border-b-0 cursor-pointer hover:bg-[#1a1208] -mx-2 px-2 transition-colors">
                <span className="text-[10px] text-[#5c4a32] font-mono w-14 flex-shrink-0 mt-0.5">{item.time}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[#faf8f5] text-xs font-medium">{item.event}</p>
                  <p className="text-[#5c4a32] text-[10px] font-mono mt-0.5 truncate">{item.detail}</p>
                </div>
                <span className="material-symbols-outlined text-[#3d2e1e] text-[14px] flex-shrink-0 mt-0.5">chevron_right</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hardware key + identity hash */}
        <div className="px-5 py-4 space-y-5">
          <div>
            <span className="text-[10px] font-bold tracking-[0.15em] text-[#8b7355] uppercase block mb-2">Hardware Key</span>
            <div className="flex items-center justify-between">
              <span className="text-[#faf8f5] text-sm font-semibold">YubiKey Elite</span>
              <span className="material-symbols-outlined text-[#8b7355] text-[18px]">visibility_off</span>
            </div>
            <p className="text-[#5c4a32] text-xs mt-1">Primary hardware authorization for all TIDE-level transaction signing.</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[9px] text-[#5c4a32] uppercase tracking-widest">Signal Strength</span>
              <span className="text-[9px] text-emerald-400 font-bold">OPTIMAL</span>
            </div>
          </div>

          <div className="border-t border-[#1a1208] pt-4">
            <span className="text-[10px] font-bold tracking-[0.15em] text-[#8b7355] uppercase block mb-2">Identity Hash</span>
            <p className="text-[#5c4a32] text-[10px] font-mono break-all leading-relaxed">{identityHash}</p>
            <button className="mt-3 w-full border border-[#3d2e1e] text-[#8b7355] text-[10px] font-bold tracking-[0.15em] py-2 hover:border-[#ffba20] hover:text-[#ffba20] transition-colors">
              ROTATE IDENTITY KEY
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OperatorIdentity() {
  const { user: authUser } = useAuth();
  const { data: profile, isLoading } = trpc.user.getProfile.useQuery();

  const role = (authUser as any)?.role ?? "user";
  const clearance = ROLE_CLEARANCE[role] ?? ROLE_CLEARANCE.user;
  const dna = dnaProfile(profile?.id ?? 1);

  const AGENTS = [
    { name: "Claude Orchestrator", status: "Active Orchestration", icon: "smart_toy", active: true },
    { name: "Perplexity Research", status: "Standby", icon: "search", active: false },
    { name: "Gemini Analysis", status: "Standby", icon: "analytics", active: false },
  ];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <span className="material-symbols-outlined text-[#ffba20] text-3xl animate-spin">progress_activity</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-12">
        {/* ── Header ── */}
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Left — identity headline */}
          <div className="lg:col-span-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-px w-8 bg-[#ffba20]" />
              <span className="text-[10px] font-bold tracking-[0.2em] text-[#8b7355] uppercase">Personal Bureau</span>
            </div>
            <div className="flex items-end gap-6 flex-wrap">
              <div>
                <h1 className="font-['Fraunces',_serif] font-black text-foreground leading-none" style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)" }}>
                  Operator<br />Identity
                </h1>
              </div>
              <div className="flex flex-col gap-2 pb-1">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-[#5c4a32] uppercase tracking-widest">Clearance</span>
                  <span className={cn("text-[10px] font-bold border px-2 py-0.5 tracking-widest", clearance.color)}>
                    {clearance.level}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-[#5c4a32] uppercase tracking-widest">Active Modules</span>
                  <span className="text-[10px] font-bold text-emerald-400">14 ACTIVE</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-[#5c4a32] uppercase tracking-widest">Designation</span>
                  <span className="text-[10px] font-bold text-[#faf8f5]">{clearance.label}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right — agent monitoring sidebar */}
          <div className="lg:col-span-4">
            <div className="border border-[#2a2010] bg-[#0f0c08]">
              <div className="px-4 py-3 border-b border-[#1a1208] flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold tracking-[0.15em] text-[#8b7355] uppercase">Agent Monitoring</span>
              </div>
              <div className="divide-y divide-[#1a1208]">
                {AGENTS.map((agent) => (
                  <div key={agent.name} className={cn("px-4 py-3 flex items-center gap-3", agent.active ? "bg-[#1a1208]" : "")}>
                    <span className={cn("material-symbols-outlined text-[18px]", agent.active ? "text-[#ffba20]" : "text-[#3d2e1e]")}>
                      {agent.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-xs font-semibold", agent.active ? "text-[#faf8f5]" : "text-[#5c4a32]")}>{agent.name}</div>
                      <div className={cn("text-[10px]", agent.active ? "text-emerald-400" : "text-[#3d2e1e]")}>{agent.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Investment DNA ── */}
        <div className="border border-[#2a2010] bg-[#0f0c08]">
          <div className="px-6 py-5 border-b border-[#1a1208]">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-px w-6 bg-[#ffba20]" />
              <span className="text-[10px] font-bold tracking-[0.2em] text-[#8b7355] uppercase">Visual Profile</span>
            </div>
            <h2 className="font-['Fraunces',_serif] text-2xl font-black text-[#faf8f5]">Investment DNA</h2>
            <p className="text-[#5c4a32] text-xs mt-1 max-w-md">
              Your algorithmic footprint across global sectors. This visual map represents a synthesis of your historical deployments, risk tolerance adjustments, and sector-specific alpha.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#1a1208]">
            {/* Heatmap grid */}
            <div className="p-6">
              <DNAHeatGrid dna={dna} />
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-[#5c4a32] uppercase tracking-widest">Determinacy</span>
                  <span className="text-[10px] font-bold text-[#faf8f5]">ASYMMETRIC / AGGRESSIVE</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#ffba20]" />
                  <span className="text-[10px] text-[#ffba20] font-bold">ACTIVE</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-[#5c4a32] uppercase tracking-widest">Sector Bias</span>
                  <span className="text-[10px] font-bold text-[#faf8f5]">INFRASTRUCTURE & LOGISTICS</span>
                </div>
              </div>
            </div>

            {/* DNA bars */}
            <div className="p-6 space-y-4">
              <HeatBar label="Risk Tolerance" value={dna.riskTolerance} />
              <HeatBar label="Sector Bias" value={dna.sectorBias} />
              <HeatBar label="Deal Velocity" value={dna.dealVelocity} />
              <HeatBar label="Capital Deployment" value={dna.capitalDeployment} />
              <HeatBar label="Negotiation Style" value={dna.negotiationStyle} />
              <HeatBar label="Diligence Depth" value={dna.diligenceDepth} />
            </div>
          </div>
        </div>

        {/* ── Agentic Command ── */}
        <AgenticCommandPanel userId={profile?.id ?? 0} initialParams={profile?.huntingParams ?? null} />

        {/* ── Security & Access ── */}
        <SecurityPanel user={profile} />
      </div>
    </DashboardLayout>
  );
}
