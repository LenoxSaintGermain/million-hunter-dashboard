/**
 * Operator Identity — Personal Bureau
 * The user's private digital office: clearance badge, Investment DNA Heatmap,
 * Agentic Command interface for hunting parameters, and Security & Access log.
 * Accessible to all authenticated users.
 */
import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import EditorialTopNav from "@/components/EditorialTopNav";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ArrowRight, Loader2, ChevronRight, Eye, EyeOff } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ROLE_CLEARANCE: Record<string, { label: string; level: string; colorClass: string }> = {
  admin: { label: "ADMIN", level: "L-LEVEL-00", colorClass: "text-amber-700 border-amber-500/40 bg-amber-500/10" },
  user: { label: "OPERATOR", level: "L-LEVEL-07", colorClass: "text-emerald-700 border-emerald-600/40 bg-emerald-600/10" },
  investor: { label: "INVESTOR", level: "L-LEVEL-04", colorClass: "text-blue-700 border-blue-600/40 bg-blue-600/10" },
  insurance: { label: "INSURANCE", level: "L-LEVEL-03", colorClass: "text-purple-700 border-purple-600/40 bg-purple-600/10" },
};

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function dnaProfile(userId: number) {
  const seed = userId || 1;
  return {
    riskTolerance: ((seed * 3571) % 40) + 45,
    sectorBias: ((seed * 7919) % 35) + 50,
    dealVelocity: ((seed * 1009) % 45) + 40,
    capitalDeployment: ((seed * 4649) % 30) + 55,
    negotiationStyle: ((seed * 2311) % 50) + 35,
    diligenceDepth: ((seed * 6271) % 40) + 50,
  };
}

// ─── Heat Bar ────────────────────────────────────────────────────────────────
function HeatBar({ label, value }: { label: string; value: number }) {
  const [animated, setAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(t);
  }, []);

  const barColor = value >= 75 ? "var(--signal-gold)" : value >= 60 ? "var(--amber)" : "var(--clay)";
  const textColor = value >= 75 ? "var(--signal-gold)" : value >= 60 ? "var(--amber)" : "var(--sh-fg-3)";

  return (
    <div ref={ref} className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="label-caps" style={{ color: "var(--sh-fg-4)" }}>{label}</span>
        <span className="text-[11px] font-bold tabular-nums" style={{ color: textColor, fontFamily: "var(--font-mono)" }}>
          {value}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--sh-primary-8)" }}>
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: animated ? `${value}%` : "0%", background: barColor }}
        />
      </div>
    </div>
  );
}

// ─── DNA Heat Grid ────────────────────────────────────────────────────────────
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
            background: v >= 75
              ? `oklch(0.78 0.15 80 / ${v / 100})`
              : v >= 55
              ? `oklch(0.65 0.14 50 / ${(v / 100) * 0.8})`
              : `oklch(0.50 0.04 60 / ${(v / 100) * 0.5})`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Agentic Command Panel ────────────────────────────────────────────────────
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
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--rule)" }}>
      {/* Section header */}
      <div className="px-6 py-5 border-b" style={{ background: "var(--bone)", borderColor: "var(--rule)" }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="h-px w-6" style={{ background: "var(--signal-gold)" }} />
          <span className="label-caps" style={{ color: "var(--sh-fg-4)" }}>AGENTIC INTERFACE</span>
        </div>
        <h3
          className="text-xl font-black mb-1"
          style={{ fontFamily: "var(--font-display)", color: "var(--sh-fg-1)" }}
        >
          Direct Configuration
        </h3>
        <p className="text-xs leading-relaxed" style={{ color: "var(--sh-fg-3)" }}>
          The OS does not utilize static forms. Instruct your assigned agents via natural language to refine signal filters, threshold alerts, and deal prioritization logic.
        </p>
      </div>

      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x" style={{ borderColor: "var(--rule)" }}>
        {/* Active protocol examples */}
        <div className="px-5 py-5" style={{ background: "var(--paper)" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--signal-gold)" }} />
            <span className="label-caps" style={{ color: "var(--signal-gold)" }}>ACTIVE PROTOCOL</span>
          </div>
          <div className="space-y-2">
            {EXAMPLE_PROMPTS.map((p, i) => (
              <button
                key={i}
                onClick={() => { setCommand(p); textareaRef.current?.focus(); }}
                className="w-full text-left text-[11px] italic px-3 py-2 rounded border transition-all hover:border-[var(--signal-gold)]/40"
                style={{
                  color: "var(--sh-fg-3)",
                  borderColor: "var(--rule)",
                  background: "var(--bone)",
                }}
              >
                &ldquo;{p}&rdquo;
              </button>
            ))}
          </div>
        </div>

        {/* Command input */}
        <div className="px-5 py-5" style={{ background: "var(--paper)" }}>
          <div
            className="rounded border overflow-hidden"
            style={{ borderColor: "var(--rule)", background: "var(--bone)" }}
          >
            <div className="px-4 pt-3 pb-1 border-b" style={{ borderColor: "var(--rule)" }}>
              <span className="label-caps" style={{ color: "var(--sh-fg-4)" }}>COMMAND INPUT</span>
            </div>
            <textarea
              ref={textareaRef}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Instruct the Signal Hunter OS..."
              rows={5}
              className="w-full bg-transparent px-4 py-3 text-sm focus:outline-none resize-none"
              style={{
                color: "var(--sh-fg-1)",
                fontFamily: "var(--font-mono)",
              }}
            />
            <div
              className="flex items-center justify-between px-4 py-2.5 border-t"
              style={{ borderColor: "var(--rule)" }}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[9px]" style={{ color: "var(--sh-fg-4)", fontFamily: "var(--font-mono)" }}>
                  COMMITTED TO
                </span>
                <span
                  className="text-[9px] font-bold"
                  style={{ color: "var(--signal-gold)", fontFamily: "var(--font-mono)" }}
                >
                  CLAUDE_01_CORE
                </span>
              </div>
              <button
                onClick={handleCommit}
                disabled={transmitting || !command.trim()}
                className={cn(
                  "flex items-center gap-1.5 text-[10px] font-bold tracking-[0.12em] px-3 py-1.5 rounded transition-all disabled:opacity-40",
                  committed
                    ? "bg-emerald-600/10 border border-emerald-600/40 text-emerald-700"
                    : "text-[var(--ink)]"
                )}
                style={!committed ? {
                  background: "var(--signal-gold)",
                  fontFamily: "var(--font-mono)",
                } : {
                  fontFamily: "var(--font-mono)",
                }}
              >
                {transmitting ? (
                  <><Loader2 className="w-3 h-3 animate-spin" />TRANSMITTING</>
                ) : committed ? (
                  <>COMMITTED</>
                ) : (
                  <>TRANSMIT INSTRUCTION<ArrowRight className="w-3 h-3" /></>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Security Panel ───────────────────────────────────────────────────────────
function SecurityPanel({ user }: { user: any }) {
  const [hashVisible, setHashVisible] = useState(false);
  const identityHash = user?.openId
    ? `SHA256:${user.openId.slice(0, 8).toUpperCase()}...${user.openId.slice(-4).toUpperCase()}`
    : "SHA256:PENDING...";

  const SESSION_LOG = [
    { time: "14:22:01", event: "Vault Access: Sector Heatmap", detail: `IP: 10.0.0.1 · ZURICH_NODE_A` },
    { time: "12:05:45", event: "Protocol Shift: Atlanta Logistics", detail: "ORCHESTRATOR_SYNC_COMPLETE" },
    { time: "09:15:22", event: "Biometric Auth: Identity Confirmed", detail: "KEY_ROTATION_ACCESS" },
  ];

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--rule)" }}>
      <div className="px-6 py-4 border-b" style={{ background: "var(--bone)", borderColor: "var(--rule)" }}>
        <h3
          className="text-xl font-black"
          style={{ fontFamily: "var(--font-display)", color: "var(--sh-fg-1)" }}
        >
          Security & Access
        </h3>
      </div>
      <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x" style={{ borderColor: "var(--rule)" }}>
        {/* Session log */}
        <div className="px-5 py-5" style={{ background: "var(--paper)" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="label-caps" style={{ color: "var(--sh-fg-4)" }}>ENCRYPTED SESSION LOG</span>
            <span className="label-caps" style={{ color: "var(--sh-fg-4)" }}>STATE: ACTIVE</span>
          </div>
          <div className="space-y-1">
            {SESSION_LOG.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 py-2.5 px-2 rounded cursor-pointer transition-colors hover:bg-[var(--bone)] border-b last:border-b-0"
                style={{ borderColor: "var(--rule)" }}
              >
                <span
                  className="text-[10px] w-14 shrink-0 mt-0.5 tabular-nums"
                  style={{ color: "var(--sh-fg-4)", fontFamily: "var(--font-mono)" }}
                >
                  {item.time}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium" style={{ color: "var(--sh-fg-1)" }}>{item.event}</p>
                  <p
                    className="text-[10px] mt-0.5 truncate"
                    style={{ color: "var(--sh-fg-4)", fontFamily: "var(--font-mono)" }}
                  >
                    {item.detail}
                  </p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--sh-fg-4)" }} />
              </div>
            ))}
          </div>
        </div>

        {/* Hardware key + identity hash */}
        <div className="px-5 py-5 space-y-5" style={{ background: "var(--paper)" }}>
          <div>
            <span className="label-caps block mb-2" style={{ color: "var(--sh-fg-4)" }}>HARDWARE KEY</span>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: "var(--sh-fg-1)" }}>YubiKey Elite</span>
              <button onClick={() => setHashVisible(v => !v)} style={{ color: "var(--sh-fg-4)" }}>
                {hashVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--sh-fg-3)" }}>
              Primary hardware authorization for all TIDE-level transaction signing.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="label-caps" style={{ color: "var(--sh-fg-4)" }}>Signal Strength</span>
              <span className="text-[9px] font-bold text-emerald-700" style={{ fontFamily: "var(--font-mono)" }}>
                OPTIMAL
              </span>
            </div>
          </div>

          <div className="border-t pt-4" style={{ borderColor: "var(--rule)" }}>
            <span className="label-caps block mb-2" style={{ color: "var(--sh-fg-4)" }}>IDENTITY HASH</span>
            <p
              className="text-[10px] break-all leading-relaxed"
              style={{ color: "var(--sh-fg-3)", fontFamily: "var(--font-mono)" }}
            >
              {hashVisible ? identityHash : "SHA256:••••••••...••••"}
            </p>
            <button
              className="mt-3 w-full rounded border py-2 text-[10px] font-bold tracking-[0.12em] transition-colors hover:border-[var(--signal-gold)] hover:text-[var(--signal-gold)]"
              style={{
                borderColor: "var(--rule)",
                color: "var(--sh-fg-3)",
                fontFamily: "var(--font-mono)",
              }}
            >
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
    { name: "Claude Orchestrator", status: "Active Orchestration", active: true },
    { name: "Perplexity Research", status: "Standby", active: false },
    { name: "Gemini Analysis", status: "Standby", active: false },
  ];

  if (isLoading) {
    return (
      <EditorialTopNav>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--signal-gold)" }} />
        </div>
      </EditorialTopNav>
    );
  }

  return (
    <EditorialTopNav>
      <div className="max-w-[1280px] mx-auto px-6 py-10 space-y-8 pb-16">

        {/* ── Header ── */}
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Left — identity headline */}
          <div className="lg:col-span-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px w-8" style={{ background: "var(--signal-gold)" }} />
              <span className="label-caps" style={{ color: "var(--sh-fg-4)" }}>PERSONAL BUREAU</span>
            </div>
            <h1
              className="font-black leading-none tracking-tight mb-5"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--sh-fg-1)",
                fontSize: "clamp(2.5rem, 6vw, 4rem)",
              }}
            >
              Operator<br />Identity
            </h1>
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <div className="flex items-center gap-3">
                <span className="label-caps" style={{ color: "var(--sh-fg-4)" }}>CLEARANCE</span>
                <span
                  className={cn("text-[10px] font-bold border px-2 py-0.5 rounded tracking-widest", clearance.colorClass)}
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {clearance.level}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="label-caps" style={{ color: "var(--sh-fg-4)" }}>ACTIVE MODULES</span>
                <span
                  className="text-[10px] font-bold text-emerald-700"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  14 ACTIVE
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="label-caps" style={{ color: "var(--sh-fg-4)" }}>DESIGNATION</span>
                <span
                  className="text-[10px] font-bold"
                  style={{ color: "var(--sh-fg-1)", fontFamily: "var(--font-mono)" }}
                >
                  {clearance.label}
                </span>
              </div>
            </div>
          </div>

          {/* Right — agent monitoring */}
          <div className="lg:col-span-4">
            <div
              className="rounded-lg border overflow-hidden"
              style={{ borderColor: "var(--rule)" }}
            >
              <div
                className="px-4 py-3 border-b flex items-center gap-2"
                style={{ background: "var(--bone)", borderColor: "var(--rule)" }}
              >
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--sage)" }} />
                <span className="label-caps" style={{ color: "var(--sh-fg-4)" }}>AGENT MONITORING</span>
              </div>
              <div style={{ background: "var(--paper)" }}>
                {AGENTS.map((agent, i) => (
                  <div
                    key={agent.name}
                    className={cn(
                      "px-4 py-3 flex items-center gap-3 border-b last:border-b-0",
                      agent.active ? "" : "opacity-60"
                    )}
                    style={{
                      borderColor: "var(--rule)",
                      background: agent.active ? "var(--sh-primary-8)" : "transparent",
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded flex items-center justify-center text-[11px] font-bold shrink-0"
                      style={{
                        background: agent.active ? "var(--sh-primary-15)" : "var(--sh-primary-8)",
                        color: agent.active ? "var(--sh-fg-1)" : "var(--sh-fg-4)",
                      }}
                    >
                      {agent.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-xs font-semibold truncate"
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
        </div>

        {/* ── Investment DNA ── */}
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--rule)" }}>
          <div className="px-6 py-5 border-b" style={{ background: "var(--bone)", borderColor: "var(--rule)" }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-px w-6" style={{ background: "var(--signal-gold)" }} />
              <span className="label-caps" style={{ color: "var(--sh-fg-4)" }}>VISUAL PROFILE</span>
            </div>
            <h2
              className="text-2xl font-black"
              style={{ fontFamily: "var(--font-display)", color: "var(--sh-fg-1)" }}
            >
              Investment DNA
            </h2>
            <p className="text-xs mt-1 max-w-md" style={{ color: "var(--sh-fg-3)" }}>
              Your algorithmic footprint across global sectors. This visual map represents a synthesis of your historical deployments, risk tolerance adjustments, and sector-specific alpha.
            </p>
          </div>

          <div
            className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x"
            style={{ borderColor: "var(--rule)" }}
          >
            {/* Heatmap grid */}
            <div className="p-6" style={{ background: "var(--paper)" }}>
              <DNAHeatGrid dna={dna} />
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="label-caps" style={{ color: "var(--sh-fg-4)" }}>DETERMINACY</span>
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: "var(--sh-fg-1)", fontFamily: "var(--font-mono)" }}
                    >
                      ASYMMETRIC / AGGRESSIVE
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: "var(--signal-gold)" }} />
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: "var(--signal-gold)", fontFamily: "var(--font-mono)" }}
                    >
                      ACTIVE
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="label-caps" style={{ color: "var(--sh-fg-4)" }}>SECTOR BIAS</span>
                  <span
                    className="text-[10px] font-bold"
                    style={{ color: "var(--sh-fg-1)", fontFamily: "var(--font-mono)" }}
                  >
                    INFRASTRUCTURE & LOGISTICS
                  </span>
                </div>
              </div>
            </div>

            {/* DNA bars */}
            <div className="p-6 space-y-4" style={{ background: "var(--paper)" }}>
              <HeatBar label="RISK TOLERANCE" value={dna.riskTolerance} />
              <HeatBar label="SECTOR BIAS" value={dna.sectorBias} />
              <HeatBar label="DEAL VELOCITY" value={dna.dealVelocity} />
              <HeatBar label="CAPITAL DEPLOYMENT" value={dna.capitalDeployment} />
              <HeatBar label="NEGOTIATION STYLE" value={dna.negotiationStyle} />
              <HeatBar label="DILIGENCE DEPTH" value={dna.diligenceDepth} />
            </div>
          </div>
        </div>

        {/* ── Agentic Command ── */}
        <AgenticCommandPanel userId={profile?.id ?? 0} initialParams={profile?.huntingParams ?? null} />

        {/* ── Security & Access ── */}
        <SecurityPanel user={profile} />
      </div>
    </EditorialTopNav>
  );
}
