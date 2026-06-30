/**
 * InvestorBrief.tsx — /brief
 * Scrollytelling investor pitch page for Signal Hunter OS.
 * Audience: FIS catalog investors, capital allocators evaluating the asset.
 *
 * ZERO live API calls. All simulators are deterministic, pre-baked from GT-001 fixture.
 * Every simulator labeled "Interactive Demo — sample composite deal."
 * No fabricated traction, revenue, user counts, logos, or testimonials.
 * Forward-looking items labeled Projection or Roadmap.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import {
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Shield,
  Zap,
  FileText,
  BarChart3,
  Users,
  Database,
  ArrowRight,
  Lock,
  Play,
  ChevronDown,
  Target,
  Layers,
} from "lucide-react";

// ─── DEMO FIXTURE (GT-001 composite — no real company) ────────────────────────
const GT001 = {
  codename: "Apex Commercial Cleaning",
  industry: "Commercial Cleaning Services",
  geography: "Charlotte, NC",
  asking: 2_100_000,
  stated_sde: 720_000,
  stated_revenue: 1_850_000,
  multiple_asked: 2.9,
  years: 11,
  employees: 14,
  broker_note: "Established commercial cleaning company with 11-year track record. Consistent revenue growth. Owner retiring. Strong recurring contract base. SBA pre-qualified.",
};

const RED_TEAM_FLAGS = [
  {
    id: "F1",
    severity: "critical" as const,
    category: "Customer Concentration",
    headline: "54% revenue in 2 clients — both owner-personal relationships",
    detail: "Client A (hospital system): $512k/yr, 28% of revenue. Client B (office park): $484k/yr, 26% of revenue. Both relationships are personal to the owner. No formal contract with Client B — month-to-month verbal agreement.",
    loss_exposure: "$984k/yr at risk",
  },
  {
    id: "F2",
    severity: "critical" as const,
    category: "Contract Cliff",
    headline: "Hospital contract up for competitive rebid in 14 months",
    detail: "Client A's master services agreement expires 14 months post-close. Hospital procurement policy requires competitive rebid above $400k/yr. No auto-renewal clause. Incumbent advantage is not guaranteed.",
    loss_exposure: "$512k/yr binary event",
  },
  {
    id: "F3",
    severity: "critical" as const,
    category: "Add-Back Inflation",
    headline: "True normalized SDE is ~$497k, not $720k",
    detail: "$223k in add-backs: $85k owner salary above market replacement, $62k personal vehicle fleet, $41k 'consulting' payments to family members, $35k one-time equipment write-off claimed as recurring. Buyer is paying 4.2x real earnings, not 2.9x.",
    loss_exposure: "Effective multiple: 4.2×",
  },
  {
    id: "F4",
    severity: "critical" as const,
    category: "Owner Dependence",
    headline: "Owner works 55-60 hrs/week — no management layer below",
    detail: "Owner handles all sales, all client relationship management, all hiring/firing, and covers shifts when workers call out. No operations manager. No sales process. No CRM. 14 employees, all hourly cleaners.",
    loss_exposure: "Replacement cost erases margins",
  },
  {
    id: "F5",
    severity: "high" as const,
    category: "Operational Risk",
    headline: "87% annual employee turnover masked by revenue stability",
    detail: "Revenue stability is maintained only because the owner personally covers gaps. A new owner without this capacity will face immediate service quality degradation and accelerated client churn.",
    loss_exposure: "Service quality cliff at transition",
  },
];

const IC_VOTES = [
  {
    agent: "The Structuralist",
    role: "Structural Risk Analysis",
    vote: "NO" as const,
    confidence: 91,
    color: "#dc2626",
    rationale: "The customer concentration pattern here is not a negotiable risk — it is a structural defect. Two relationships that are personal to the seller represent 54% of revenue. No earnout structure adequately protects against this because the risk materializes after the earnout measurement period. The QoE gap alone ($223k in questionable add-backs) warrants a full stop pending independent verification.",
  },
  {
    agent: "The Restructurer",
    role: "Deal Architecture",
    vote: "RESTRUCTURE" as const,
    confidence: 87,
    color: "#d97706",
    rationale: "The business has real underlying value — 11 years of operation, established client relationships, recurring revenue model. The problem is entirely structural: the value is trapped in the owner's personal relationships. A restructured deal at $1.2–1.4M with 35–40% earnout tied to 24-month client retention, combined with an 18-month owner transition agreement, could work.",
  },
  {
    agent: "The Market Analyst",
    role: "Market Comparables",
    vote: "NO" as const,
    confidence: 89,
    color: "#dc2626",
    rationale: "Market data supports the concern: commercial cleaning businesses with >40% customer concentration in owner-personal relationships trade at 1.8–2.2× SDE, not 2.9×. The hospital contract rebid risk alone — a binary $512k/yr revenue event 14 months post-close — is unacceptable without contractual protection.",
  },
];

const THESIS_CRITERIA = [
  { label: "Industry", value: "Commercial Services (cleaning, pest, HVAC)", status: "match" as const },
  { label: "Revenue Range", value: "$1M – $5M", status: "match" as const },
  { label: "Geography", value: "Southeast US — Atlanta, Charlotte, Tampa", status: "match" as const },
  { label: "Years in Business", value: "≥ 7 years", status: "match" as const },
  { label: "SDE Multiple", value: "≤ 3.5× verified SDE", status: "flag" as const },
  { label: "Customer Concentration", value: "No single client > 25%", status: "fail" as const },
  { label: "Owner Hours/Week", value: "< 40 hrs (transferable)", status: "fail" as const },
];

const CAPITAL_STACK = {
  deal_price: 2_100_000,
  equity_down: 420_000,
  sba_7a: 1_470_000,
  seller_note: 210_000,
  annual_debt_service: 198_000,
  true_sde: 497_000,
  dscr: 2.51,
  dscr_on_stated: 3.64,
  note: "DSCR looks healthy on stated SDE. On true normalized SDE ($497k), DSCR drops to 2.51× — still above SBA minimum of 1.25×, but leaves thin margin for revenue decline.",
};

const SELLER_PROFILE = {
  archetype: "Founder-Operator Exiting",
  motivation: "Retirement — owner has been running this business for 11 years and is ready to exit. Emotional attachment to legacy and employees.",
  leverage_points: [
    "Owner needs a clean exit — willing to carry a seller note to get the deal done",
    "Emotional attachment to employees creates pressure to close rather than re-list",
    "SBA pre-qualification signals urgency to transact",
  ],
  risk_signals: [
    "May resist QoE audit — add-backs are aggressive and owner knows it",
    "Personal relationships with top clients create disclosure risk",
    "Will resist written contract requirement for Client B (verbal relationship is intentional)",
  ],
  negotiation_read: "Motivated seller with leverage asymmetry. Buyer has information advantage post-diligence. Conditional offer with written contract requirement as closing condition is the right move — it forces the seller to either deliver the contract or reveal it cannot be obtained.",
};

const MEMO_EXCERPT = {
  deal_id: "GT-001-DEMO",
  date: "Sample — composite deal",
  executive_summary: "Apex Commercial Cleaning presents as a stable, recurring-revenue commercial services business with an 11-year track record. However, diligence reveals three structural defects that make the deal non-viable at current terms: (1) 54% revenue concentration in two owner-personal relationships with no contractual protection, (2) a $223k add-back inflation that inflates the stated SDE by 45%, and (3) complete owner dependence with no management layer. The IC panel voted unanimously to reject at current terms.",
  recommendation: "DO NOT PROCEED at $2.1M. Conditional restructure path available at $1.2M with earnout.",
  key_risks: [
    "Customer concentration — structural, not addressable through earnout",
    "Add-back inflation — true multiple is 4.2×, not 2.9×",
    "Owner dependence — replacement cost erases stated margins",
    "Hospital contract rebid — binary $512k/yr event 14 months post-close",
  ],
};

// ─── CAPABILITY MATRIX ────────────────────────────────────────────────────────
const CAPABILITY_MATRIX = [
  { capability: "Thesis Engine", description: "Structure and score a buy-box against live deal flow", status: "Live" as const },
  { capability: "IC Agent Consensus", description: "Multi-agent panel scoring with divergence detection", status: "Live" as const },
  { capability: "Red Team — Always On", description: "Adversarial diligence: surfaces landmines from pre-close signals", status: "Live" as const },
  { capability: "Owner / Seller Simulation", description: "Seller persona, motivation read, negotiation leverage map", status: "Live" as const },
  { capability: "Capital Stack Modeler", description: "SBA 7(a) + seller note + equity stack with DSCR validation", status: "Live" as const },
  { capability: "Investment Memo + LOI", description: "Diligence brief and LOI draft from deal signals", status: "Live" as const },
  { capability: "TIDE Intelligence", description: "Federal spend, SBA policy, and macro signal monitoring", status: "Live" as const },
  { capability: "Market Scan", description: "LLM-synthesized deal sourcing across listing platforms", status: "Demo" as const },
  { capability: "Opportunity Radar", description: "Permit, zoning, and capital convergence signal detection", status: "Demo" as const },
  { capability: "Searcher Intelligence DB", description: "Demand-side dataset from every diligence run — the moat", status: "Roadmap" as const },
  { capability: "Gated Free Run (/try)", description: "Public diligence run with email gate — top-of-funnel acquisition", status: "Roadmap" as const },
  { capability: "Matching Engine", description: "Thesis-to-deal matching using Searcher Intelligence DB", status: "Roadmap" as const },
];

// ─── NAV SECTIONS ─────────────────────────────────────────────────────────────
const NAV_SECTIONS = [
  { id: "hook", label: "The Claim" },
  { id: "problem", label: "Why Now" },
  { id: "thesis", label: "Thesis Engine" },
  { id: "ic", label: "IC Consensus" },
  { id: "redteam", label: "Red Team" },
  { id: "seller", label: "Seller Sim" },
  { id: "capital", label: "Capital Stack" },
  { id: "memo", label: "Memo + LOI" },
  { id: "moat", label: "The Moat" },
  { id: "model", label: "Business Model" },
  { id: "rigor", label: "Rigor Gate" },
  { id: "ask", label: "The Ask" },
  { id: "matrix", label: "Capability Matrix" },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

function DemoLabel() {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.15em] uppercase px-2 py-0.5 rounded"
      style={{
        color: "var(--sh-signal)",
        background: "oklch(0.66 0.14 55 / 0.12)",
        border: "1px solid oklch(0.66 0.14 55 / 0.30)",
        fontFamily: "var(--font-mono)",
      }}
    >
      Interactive Demo — sample composite deal
    </span>
  );
}

function StatusBadge({ status }: { status: "Live" | "Demo" | "Roadmap" }) {
  const styles = {
    Live: { color: "#16a34a", bg: "oklch(0.55 0.12 145 / 0.10)", border: "oklch(0.55 0.12 145 / 0.30)" },
    Demo: { color: "var(--sh-signal)", bg: "oklch(0.66 0.14 55 / 0.10)", border: "oklch(0.66 0.14 55 / 0.30)" },
    Roadmap: { color: "var(--sh-fg-3)", bg: "var(--sh-primary-8)", border: "var(--sh-border)" },
  };
  const s = styles[status];
  return (
    <span
      className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
    >
      {status}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-px w-8" style={{ background: "var(--sh-signal)" }} />
      <span
        className="text-[10px] font-bold tracking-[0.2em] uppercase"
        style={{ color: "var(--sh-fg-4)", fontFamily: "var(--font-mono)" }}
      >
        {children}
      </span>
    </div>
  );
}

function useIntersection(ref: React.RefObject<HTMLElement>, threshold = 0.3) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, threshold]);
  return visible;
}

// ─── SIMULATORS ───────────────────────────────────────────────────────────────

function ThesisSimulator() {
  const [revealed, setRevealed] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const visible = useIntersection(ref as React.RefObject<HTMLElement>);

  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => {
      setRevealed((r) => {
        if (r >= THESIS_CRITERIA.length) { clearInterval(timer); return r; }
        return r + 1;
      });
    }, 350);
    return () => clearInterval(timer);
  }, [visible]);

  const statusIcon = (s: "match" | "flag" | "fail") => {
    if (s === "match") return <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#16a34a" }} />;
    if (s === "flag") return <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "var(--sh-signal)" }} />;
    return <XCircle className="w-4 h-4 shrink-0" style={{ color: "#dc2626" }} />;
  };

  return (
    <div ref={ref} className="rounded-xl p-6" style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border-1)" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>Buy-Box Validation</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--sh-fg-muted)" }}>GT-001 · {GT001.codename}</p>
        </div>
        <DemoLabel />
      </div>
      <div className="space-y-2">
        {THESIS_CRITERIA.slice(0, revealed).map((c) => (
          <div
            key={c.label}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-300"
            style={{
              background: c.status === "fail" ? "oklch(0.55 0.12 25 / 0.06)" : c.status === "flag" ? "oklch(0.66 0.14 55 / 0.06)" : "oklch(0.55 0.12 145 / 0.04)",
              border: `1px solid ${c.status === "fail" ? "oklch(0.55 0.12 25 / 0.20)" : c.status === "flag" ? "oklch(0.66 0.14 55 / 0.20)" : "oklch(0.55 0.12 145 / 0.15)"}`,
            }}
          >
            {statusIcon(c.status)}
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>{c.label}</span>
              <span className="text-xs ml-2" style={{ color: "var(--sh-fg-muted)" }}>{c.value}</span>
            </div>
          </div>
        ))}
        {revealed < THESIS_CRITERIA.length && (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: "var(--sh-signal)" }} />
            <span className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>Validating criteria…</span>
          </div>
        )}
      </div>
      {revealed >= THESIS_CRITERIA.length && (
        <div
          className="mt-4 rounded-lg px-4 py-3 flex items-center gap-3"
          style={{ background: "oklch(0.55 0.12 25 / 0.08)", border: "1px solid oklch(0.55 0.12 25 / 0.25)" }}
        >
          <XCircle className="w-5 h-5 shrink-0" style={{ color: "#dc2626" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "#dc2626" }}>Buy-Box Fail — 2 critical criteria violated</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--sh-fg-muted)" }}>Customer concentration exceeds threshold. Owner hours exceed transferability limit.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ICSimulator() {
  const [step, setStep] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const visible = useIntersection(ref as React.RefObject<HTMLElement>);

  useEffect(() => {
    if (!visible || step > 0) return;
    const timers = [
      setTimeout(() => setStep(1), 600),
      setTimeout(() => setStep(2), 1800),
      setTimeout(() => setStep(3), 3200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [visible, step]);

  return (
    <div ref={ref} className="rounded-xl p-6" style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border-1)" }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>IC Agent Panel</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--sh-fg-muted)" }}>GT-001 · {GT001.codename}</p>
        </div>
        <DemoLabel />
      </div>
      <div className="space-y-3">
        {IC_VOTES.map((v, i) => (
          <div
            key={v.agent}
            className="rounded-lg p-4 transition-all duration-500"
            style={{
              opacity: step > i ? 1 : 0.15,
              transform: step > i ? "translateY(0)" : "translateY(6px)",
              background: "var(--sh-surface-3)",
              border: `1px solid var(--sh-border-1)`,
            }}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{v.agent}</p>
                <p className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>{v.role}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded"
                  style={{
                    color: v.vote === "RESTRUCTURE" ? "#d97706" : "#dc2626",
                    background: v.vote === "RESTRUCTURE" ? "oklch(0.66 0.14 55 / 0.12)" : "oklch(0.55 0.12 25 / 0.10)",
                    border: `1px solid ${v.vote === "RESTRUCTURE" ? "oklch(0.66 0.14 55 / 0.30)" : "oklch(0.55 0.12 25 / 0.25)"}`,
                  }}
                >
                  {v.vote}
                </span>
                <span className="text-xs font-mono" style={{ color: "var(--sh-fg-muted)" }}>{v.confidence}%</span>
              </div>
            </div>
            {step > i && (
              <p className="text-xs leading-relaxed" style={{ color: "var(--sh-fg-muted)" }}>
                {v.rationale}
              </p>
            )}
            {step > i && (
              <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "var(--sh-border-1)" }}>
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${v.confidence}%`, background: v.color }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      {step >= 3 && (
        <div
          className="mt-4 rounded-lg px-4 py-3 flex items-center gap-3"
          style={{ background: "oklch(0.55 0.12 25 / 0.08)", border: "1px solid oklch(0.55 0.12 25 / 0.25)" }}
        >
          <XCircle className="w-5 h-5 shrink-0" style={{ color: "#dc2626" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "#dc2626" }}>Unanimous NO at current terms</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--sh-fg-muted)" }}>The Restructurer identifies a conditional path at $1.2–1.4M. The Structuralist and The Market Analyst are hard stops.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function RedTeamSimulator() {
  const [revealed, setRevealed] = useState(0);
  const [running, setRunning] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const run = useCallback(() => {
    if (running || revealed > 0) return;
    setRunning(true);
    RED_TEAM_FLAGS.forEach((_, i) => {
      setTimeout(() => {
        setRevealed(i + 1);
        if (i === RED_TEAM_FLAGS.length - 1) setRunning(false);
      }, 800 + i * 1200);
    });
  }, [running, revealed]);

  const severityColor = (s: "critical" | "high") =>
    s === "critical" ? "#dc2626" : "#d97706";

  return (
    <div ref={ref} className="rounded-xl p-6" style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border-1)" }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>Red Team — Always On</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--sh-fg-muted)" }}>GT-001 · {GT001.codename}</p>
        </div>
        <DemoLabel />
      </div>

      {revealed === 0 && !running && (
        <div className="text-center py-8">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "oklch(0.55 0.12 25 / 0.10)", border: "1px solid oklch(0.55 0.12 25 / 0.25)" }}
          >
            <Shield className="w-7 h-7" style={{ color: "#dc2626" }} />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: "var(--sh-text-primary)" }}>Pre-acquisition signals loaded</p>
          <p className="text-xs mb-5" style={{ color: "var(--sh-fg-muted)" }}>Broker sheet only. No outcome data. Red Team runs cold.</p>
          <button
            onClick={run}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: "#dc2626",
              color: "#fff",
            }}
          >
            <Play className="w-4 h-4" />
            Run Red Team
          </button>
        </div>
      )}

      {(running || revealed > 0) && (
        <div className="space-y-3">
          {RED_TEAM_FLAGS.slice(0, revealed).map((f) => (
            <div
              key={f.id}
              className="rounded-lg p-4 transition-all duration-500"
              style={{
                background: f.severity === "critical" ? "oklch(0.55 0.12 25 / 0.06)" : "oklch(0.66 0.14 55 / 0.06)",
                border: `1px solid ${f.severity === "critical" ? "oklch(0.55 0.12 25 / 0.25)" : "oklch(0.66 0.14 55 / 0.25)"}`,
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: severityColor(f.severity) }} />
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: severityColor(f.severity) }}>
                    {f.severity} · {f.category}
                  </span>
                </div>
                <span className="text-xs font-mono shrink-0" style={{ color: severityColor(f.severity) }}>{f.loss_exposure}</span>
              </div>
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--sh-text-primary)" }}>{f.headline}</p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--sh-fg-muted)" }}>{f.detail}</p>
            </div>
          ))}
          {running && revealed < RED_TEAM_FLAGS.length && (
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: "#dc2626" }} />
              <span className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>Surfacing next concern…</span>
            </div>
          )}
        </div>
      )}

      {revealed >= RED_TEAM_FLAGS.length && (
        <div
          className="mt-4 rounded-lg px-4 py-3"
          style={{ background: "oklch(0.55 0.12 25 / 0.08)", border: "1px solid oklch(0.55 0.12 25 / 0.25)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "#dc2626" }}>
            {RED_TEAM_FLAGS.filter(f => f.severity === "critical").length} critical · {RED_TEAM_FLAGS.filter(f => f.severity === "high").length} high — DO NOT PROCEED at current terms
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--sh-fg-muted)" }}>
            Conditional restructure path: price at $1.2M max, 40% earnout tied to Client A + Client B retention at 24 months post-close.
          </p>
        </div>
      )}
    </div>
  );
}

function SellerSimulator() {
  const [tab, setTab] = useState<"profile" | "leverage" | "risks" | "read">("profile");
  return (
    <div className="rounded-xl p-6" style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border-1)" }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>Owner / Seller Simulation</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--sh-fg-muted)" }}>GT-001 · {GT001.codename}</p>
        </div>
        <DemoLabel />
      </div>
      <div className="flex gap-1 mb-4 flex-wrap">
        {(["profile", "leverage", "risks", "read"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all"
            style={{
              background: tab === t ? "var(--sh-primary)" : "var(--sh-surface-3)",
              color: tab === t ? "var(--sh-primary-fg)" : "var(--sh-fg-muted)",
              border: `1px solid ${tab === t ? "var(--sh-primary)" : "var(--sh-border-1)"}`,
            }}
          >
            {t === "read" ? "Negotiation Read" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === "profile" && (
        <div className="space-y-3">
          <div className="rounded-lg px-4 py-3" style={{ background: "var(--sh-surface-3)", border: "1px solid var(--sh-border-1)" }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "var(--sh-fg-muted)" }}>Archetype</p>
            <p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{SELLER_PROFILE.archetype}</p>
          </div>
          <div className="rounded-lg px-4 py-3" style={{ background: "var(--sh-surface-3)", border: "1px solid var(--sh-border-1)" }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "var(--sh-fg-muted)" }}>Primary Motivation</p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--sh-text-secondary)" }}>{SELLER_PROFILE.motivation}</p>
          </div>
        </div>
      )}
      {tab === "leverage" && (
        <div className="space-y-2">
          {SELLER_PROFILE.leverage_points.map((p, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg px-3 py-2.5" style={{ background: "oklch(0.55 0.12 145 / 0.05)", border: "1px solid oklch(0.55 0.12 145 / 0.15)" }}>
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#16a34a" }} />
              <p className="text-sm" style={{ color: "var(--sh-text-secondary)" }}>{p}</p>
            </div>
          ))}
        </div>
      )}
      {tab === "risks" && (
        <div className="space-y-2">
          {SELLER_PROFILE.risk_signals.map((r, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg px-3 py-2.5" style={{ background: "oklch(0.55 0.12 25 / 0.05)", border: "1px solid oklch(0.55 0.12 25 / 0.20)" }}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#d97706" }} />
              <p className="text-sm" style={{ color: "var(--sh-text-secondary)" }}>{r}</p>
            </div>
          ))}
        </div>
      )}
      {tab === "read" && (
        <div className="rounded-lg px-4 py-4" style={{ background: "var(--sh-surface-3)", border: "1px solid var(--sh-border-1)" }}>
          <p className="text-sm leading-relaxed" style={{ color: "var(--sh-text-secondary)" }}>{SELLER_PROFILE.negotiation_read}</p>
        </div>
      )}
    </div>
  );
}

function CapitalStackSimulator() {
  const equity_pct = Math.round((CAPITAL_STACK.equity_down / CAPITAL_STACK.deal_price) * 100);
  const sba_pct = Math.round((CAPITAL_STACK.sba_7a / CAPITAL_STACK.deal_price) * 100);
  const note_pct = Math.round((CAPITAL_STACK.seller_note / CAPITAL_STACK.deal_price) * 100);

  return (
    <div className="rounded-xl p-6" style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border-1)" }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>Capital Stack Modeler</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--sh-fg-muted)" }}>GT-001 · {GT001.codename}</p>
        </div>
        <DemoLabel />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Equity Down", value: fmt(CAPITAL_STACK.equity_down), pct: `${equity_pct}%`, color: "var(--sh-primary)" },
          { label: "SBA 7(a)", value: fmt(CAPITAL_STACK.sba_7a), pct: `${sba_pct}%`, color: "#2563eb" },
          { label: "Seller Note", value: fmt(CAPITAL_STACK.seller_note), pct: `${note_pct}%`, color: "#7c3aed" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg px-3 py-3 text-center" style={{ background: "var(--sh-surface-3)", border: "1px solid var(--sh-border-1)" }}>
            <p className="text-lg font-bold" style={{ color: item.color }}>{item.value}</p>
            <p className="text-xs font-mono" style={{ color: "var(--sh-fg-muted)" }}>{item.pct}</p>
            <p className="text-[11px] mt-1" style={{ color: "var(--sh-fg-muted)" }}>{item.label}</p>
          </div>
        ))}
      </div>
      {/* Stack bar */}
      <div className="h-4 rounded-full overflow-hidden flex mb-4">
        <div style={{ width: `${equity_pct}%`, background: "var(--sh-primary)" }} />
        <div style={{ width: `${sba_pct}%`, background: "#2563eb" }} />
        <div style={{ width: `${note_pct}%`, background: "#7c3aed" }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Deal Price", value: fmt(CAPITAL_STACK.deal_price) },
          { label: "Annual Debt Service", value: fmt(CAPITAL_STACK.annual_debt_service) },
          { label: "DSCR (stated SDE)", value: `${CAPITAL_STACK.dscr_on_stated}×`, flag: false },
          { label: "DSCR (true SDE)", value: `${CAPITAL_STACK.dscr}×`, flag: true },
        ].map((row) => (
          <div key={row.label} className="rounded-lg px-3 py-2.5" style={{ background: "var(--sh-surface-3)", border: "1px solid var(--sh-border-1)" }}>
            <p className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>{row.label}</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: (row as any).flag ? "#d97706" : "var(--sh-text-primary)" }}>{row.value}</p>
          </div>
        ))}
      </div>
      <p className="text-xs mt-3 leading-relaxed" style={{ color: "var(--sh-fg-muted)" }}>{CAPITAL_STACK.note}</p>
    </div>
  );
}

function MemoSimulator() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl p-6" style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border-1)" }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>Diligence Brief + LOI</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--sh-fg-muted)" }}>GT-001 · {GT001.codename}</p>
        </div>
        <DemoLabel />
      </div>
      <div className="rounded-lg p-4 mb-4" style={{ background: "var(--sh-surface-3)", border: "1px solid var(--sh-border-1)" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--sh-fg-muted)" }}>Executive Summary</p>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: "oklch(0.55 0.12 25 / 0.10)", color: "#dc2626", border: "1px solid oklch(0.55 0.12 25 / 0.25)" }}>
            DO NOT PROCEED
          </span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--sh-text-secondary)" }}>
          {expanded ? MEMO_EXCERPT.executive_summary : MEMO_EXCERPT.executive_summary.slice(0, 180) + "…"}
        </p>
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs flex items-center gap-1 transition-colors"
          style={{ color: "var(--sh-signal)" }}
        >
          {expanded ? "Collapse" : "Read full summary"}
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--sh-fg-muted)" }}>Key Risks Documented</p>
        {MEMO_EXCERPT.key_risks.map((r, i) => (
          <div key={i} className="flex items-start gap-2.5 rounded-lg px-3 py-2" style={{ background: "oklch(0.55 0.12 25 / 0.05)", border: "1px solid oklch(0.55 0.12 25 / 0.15)" }}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#dc2626" }} />
            <p className="text-xs" style={{ color: "var(--sh-text-secondary)" }}>{r}</p>
          </div>
        ))}
      </div>
      <div
        className="mt-4 rounded-lg px-4 py-3 flex items-center gap-3"
        style={{ background: "var(--sh-surface-3)", border: "1px solid var(--sh-border-1)" }}
      >
        <Lock className="w-4 h-4 shrink-0" style={{ color: "var(--sh-fg-muted)" }} />
        <p className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>LOI draft available on the live platform — conditional offer template with earnout and written contract closing conditions pre-populated.</p>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function InvestorBrief() {
  const [activeSection, setActiveSection] = useState("hook");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    NAV_SECTIONS.forEach(({ id }) => {
      const el = sectionRefs.current[id];
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { threshold: 0.2, rootMargin: "-80px 0px -60% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const scrollTo = (id: string) => {
    const el = sectionRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const setRef = (id: string) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background: "var(--sh-bg)",
        color: "var(--sh-text-primary)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* ── Top bar ── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6"
        style={{
          height: "52px",
          background: "var(--sh-bg)",
          borderBottom: "1px solid var(--sh-border-1)",
        }}
      >
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: "var(--sh-primary)" }}>
              <TrendingUp className="w-3.5 h-3.5" style={{ color: "var(--sh-primary-fg)" }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>Signal Hunter OS</span>
            <span className="text-xs px-1.5 py-0.5 rounded ml-1" style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)", border: "1px solid var(--sh-border-1)", fontFamily: "var(--font-mono)" }}>
              Investor Brief
            </span>
          </div>
        </Link>
        <a
          href={getLoginUrl()}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
          style={{ background: "var(--sh-primary)", color: "var(--sh-primary-fg)" }}
        >
          Log in to run the live flow
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </header>

      <div className="flex pt-[52px]">
        {/* ── Sticky nav rail ── */}
        <aside
          className="hidden lg:flex flex-col sticky top-[52px] h-[calc(100vh-52px)] w-52 shrink-0 overflow-y-auto py-8 px-4"
          style={{ borderRight: "1px solid var(--sh-border-1)" }}
        >
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase mb-4 px-2" style={{ color: "var(--sh-fg-muted)", fontFamily: "var(--font-mono)" }}>
            Contents
          </p>
          <nav className="space-y-0.5">
            {NAV_SECTIONS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2"
                style={{
                  color: activeSection === id ? "var(--sh-text-primary)" : "var(--sh-fg-muted)",
                  background: activeSection === id ? "var(--sh-surface-2)" : "transparent",
                  fontWeight: activeSection === id ? 600 : 400,
                }}
              >
                {activeSection === id && (
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--sh-signal)" }} />
                )}
                {label}
              </button>
            ))}
          </nav>
          <div className="mt-auto pt-6">
            <a
              href={getLoginUrl()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
              style={{ background: "var(--sh-primary)", color: "var(--sh-primary-fg)" }}
            >
              Run live flow
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 min-w-0 max-w-3xl mx-auto px-6 py-16 space-y-24">

          {/* ── 1. HOOK ── */}
          <section ref={setRef("hook")} id="hook" className="scroll-mt-20">
            <SectionLabel>The Claim</SectionLabel>
            <h1
              className="text-4xl lg:text-5xl font-black leading-tight mb-6"
              style={{ fontFamily: "var(--font-serif, 'Fraunces', serif)", color: "var(--sh-text-primary)" }}
            >
              Signal Hunter OS is the diligence-and-decision layer for the $4.5 trillion small-business acquisition wave.
            </h1>
            <p className="text-lg leading-relaxed mb-6" style={{ color: "var(--sh-text-secondary)" }}>
              It does one thing: catch the deals that look clean on the broker sheet but will cost the buyer $1–2M after close. Every feature is built around a single question — <em>what kills this deal?</em> — not <em>how do we close it faster?</em>
            </p>
            <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>
              Market size estimate sourced from BizBuySell 2025 Insight Report and SBA Office of Advocacy SMB data. $4.5T represents total estimated value of US small businesses with owner age ≥55 expected to transact 2025–2035.
            </p>
          </section>

          {/* ── 2. PROBLEM / WHY NOW ── */}
          <section ref={setRef("problem")} id="problem" className="scroll-mt-20">
            <SectionLabel>Why Now</SectionLabel>
            <h2 className="text-3xl font-black mb-6" style={{ fontFamily: "var(--font-serif, 'Fraunces', serif)", color: "var(--sh-text-primary)" }}>
              The silver tsunami is real. The diligence gap is bigger.
            </h2>
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              {[
                { stat: "~$4.5T", label: "estimated value of US small businesses with owners ≥55 expected to transact by 2035", source: "SBA Office of Advocacy, estimate" },
                { stat: "10,000+", label: "new ETA searchers entering the market annually, per Stanford GSB ETA survey data", source: "Stanford GSB, estimate" },
                { stat: "~30%", label: "of SBA 7(a) acquisitions experience significant post-close revenue decline within 24 months", source: "SBA OIG analysis, estimate" },
              ].map((item) => (
                <div key={item.stat} className="rounded-xl p-5" style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border-1)" }}>
                  <p className="text-3xl font-black mb-1" style={{ color: "var(--sh-signal)", fontFamily: "var(--font-serif, 'Fraunces', serif)" }}>{item.stat}</p>
                  <p className="text-sm leading-snug mb-2" style={{ color: "var(--sh-text-secondary)" }}>{item.label}</p>
                  <p className="text-[10px]" style={{ color: "var(--sh-fg-muted)" }}>{item.source}</p>
                </div>
              ))}
            </div>
            <p className="text-base leading-relaxed" style={{ color: "var(--sh-text-secondary)" }}>
              The ETA market has a structural diligence gap: searchers are trained to find deals, not stress-test them. Brokers are incentivized to close. QoE firms charge $15–30k and take 6–8 weeks. Signal Hunter OS runs the adversarial analysis in minutes, before the LOI, from the broker sheet alone.
            </p>
          </section>

          {/* ── 3. THESIS ENGINE ── */}
          <section ref={setRef("thesis")} id="thesis" className="scroll-mt-20">
            <SectionLabel>Feature 1 of 6</SectionLabel>
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border-1)" }}>
                <Target className="w-5 h-5" style={{ color: "var(--sh-primary)" }} />
              </div>
              <div>
                <h2 className="text-2xl font-black" style={{ fontFamily: "var(--font-serif, 'Fraunces', serif)", color: "var(--sh-text-primary)" }}>Thesis Engine</h2>
                <p className="text-sm mt-1" style={{ color: "var(--sh-text-secondary)" }}>Structure a buy-box. Every deal is scored against it before analysis begins.</p>
              </div>
            </div>
            <p className="text-base leading-relaxed mb-6" style={{ color: "var(--sh-text-secondary)" }}>
              The Thesis Engine forces the buyer to define their criteria before they see a deal — not after. It prevents the most common ETA failure mode: falling in love with a deal and retrofitting the thesis to fit. The engine validates each incoming deal against the buyer's stated criteria and flags violations before any analysis runs.
            </p>
            <ThesisSimulator />
          </section>

          {/* ── 4. IC CONSENSUS ── */}
          <section ref={setRef("ic")} id="ic" className="scroll-mt-20">
            <SectionLabel>Feature 2 of 6</SectionLabel>
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border-1)" }}>
                <Users className="w-5 h-5" style={{ color: "var(--sh-primary)" }} />
              </div>
              <div>
                <h2 className="text-2xl font-black" style={{ fontFamily: "var(--font-serif, 'Fraunces', serif)", color: "var(--sh-text-primary)" }}>IC Agent Consensus</h2>
                <p className="text-sm mt-1" style={{ color: "var(--sh-text-secondary)" }}>A three-agent investment committee. Divergence is the signal.</p>
              </div>
            </div>
            <p className="text-base leading-relaxed mb-6" style={{ color: "var(--sh-text-secondary)" }}>
              Three independent agents — The Structuralist, The Restructurer, and The Market Analyst — each score the deal from a different analytical frame. When they agree, confidence is high. When they diverge, the platform flags it and surfaces the disagreement for human review. The IC is not a rubber stamp — it is a structured adversarial process.
            </p>
            <ICSimulator />
          </section>

          {/* ── 5. RED TEAM ── */}
          <section ref={setRef("redteam")} id="redteam" className="scroll-mt-20">
            <SectionLabel>Feature 3 of 6 — The Wow</SectionLabel>
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "oklch(0.55 0.12 25 / 0.10)", border: "1px solid oklch(0.55 0.12 25 / 0.25)" }}>
                <Shield className="w-5 h-5" style={{ color: "#dc2626" }} />
              </div>
              <div>
                <h2 className="text-2xl font-black" style={{ fontFamily: "var(--font-serif, 'Fraunces', serif)", color: "var(--sh-text-primary)" }}>Red Team — Always On</h2>
                <p className="text-sm mt-1" style={{ color: "var(--sh-text-secondary)" }}>The adversarial diligence engine. It is trying to kill the deal.</p>
              </div>
            </div>
            <p className="text-base leading-relaxed mb-4" style={{ color: "var(--sh-text-secondary)" }}>
              The Red Team runs from the broker sheet alone — no outcome data, no prompting. It surfaces the landmines that sink deals after close: customer concentration, owner dependence, add-back inflation, contract cliffs, undisclosed key-person risk. The demo below runs cold on GT-001, the same composite deal that resulted in a $1.76M buyer loss in the documented failure pattern.
            </p>
            <div
              className="rounded-lg px-4 py-3 mb-5 flex items-start gap-3"
              style={{ background: "oklch(0.55 0.12 25 / 0.06)", border: "1px solid oklch(0.55 0.12 25 / 0.20)" }}
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#d97706" }} />
              <p className="text-xs leading-relaxed" style={{ color: "var(--sh-text-secondary)" }}>
                <strong>Rigor gate note:</strong> The Red Team surfaces customer concentration, add-back inflation, and owner dependence reliably from broker-sheet signals alone. Contract cliff risk (e.g., hospital rebid) is surfaced when contract terms are provided but may require prompting without explicit term dates. This limitation is documented in the rigor gate section below.
              </p>
            </div>
            <RedTeamSimulator />
          </section>

          {/* ── 6. SELLER SIM ── */}
          <section ref={setRef("seller")} id="seller" className="scroll-mt-20">
            <SectionLabel>Feature 4 of 6</SectionLabel>
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border-1)" }}>
                <Users className="w-5 h-5" style={{ color: "var(--sh-primary)" }} />
              </div>
              <div>
                <h2 className="text-2xl font-black" style={{ fontFamily: "var(--font-serif, 'Fraunces', serif)", color: "var(--sh-text-primary)" }}>Owner / Seller Simulation</h2>
                <p className="text-sm mt-1" style={{ color: "var(--sh-text-secondary)" }}>Read the seller before you sit across the table from them.</p>
              </div>
            </div>
            <p className="text-base leading-relaxed mb-6" style={{ color: "var(--sh-text-secondary)" }}>
              The Seller Sim builds a profile of the owner's archetype, motivation, leverage points, and disclosure risk signals from deal data. It tells the buyer where the seller has information asymmetry and how to structure the offer to surface it.
            </p>
            <SellerSimulator />
          </section>

          {/* ── 7. CAPITAL STACK ── */}
          <section ref={setRef("capital")} id="capital" className="scroll-mt-20">
            <SectionLabel>Feature 5 of 6</SectionLabel>
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border-1)" }}>
                <Layers className="w-5 h-5" style={{ color: "var(--sh-primary)" }} />
              </div>
              <div>
                <h2 className="text-2xl font-black" style={{ fontFamily: "var(--font-serif, 'Fraunces', serif)", color: "var(--sh-text-primary)" }}>Capital Stack Modeler</h2>
                <p className="text-sm mt-1" style={{ color: "var(--sh-text-secondary)" }}>SBA 7(a) + seller note + equity. DSCR validated on true SDE.</p>
              </div>
            </div>
            <p className="text-base leading-relaxed mb-6" style={{ color: "var(--sh-text-secondary)" }}>
              The Capital Stack Modeler builds the financing structure and validates DSCR against the normalized SDE — not the broker's stated SDE. This is where the add-back inflation problem becomes a financing problem: a deal that looks fine on stated SDE can fail SBA underwriting on true SDE.
            </p>
            <CapitalStackSimulator />
          </section>

          {/* ── 8. MEMO + LOI ── */}
          <section ref={setRef("memo")} id="memo" className="scroll-mt-20">
            <SectionLabel>Feature 6 of 6</SectionLabel>
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border-1)" }}>
                <FileText className="w-5 h-5" style={{ color: "var(--sh-primary)" }} />
              </div>
              <div>
                <h2 className="text-2xl font-black" style={{ fontFamily: "var(--font-serif, 'Fraunces', serif)", color: "var(--sh-text-primary)" }}>Diligence Brief + LOI</h2>
                <p className="text-sm mt-1" style={{ color: "var(--sh-text-secondary)" }}>From signals to paper. The full diligence artifact in one pass.</p>
              </div>
            </div>
            <p className="text-base leading-relaxed mb-6" style={{ color: "var(--sh-text-secondary)" }}>
              After the IC panel votes and the Red Team surfaces its concerns, the platform compiles a structured diligence brief and a conditional LOI draft. The brief documents every risk, the IC rationale, and the recommended restructure path. The LOI pre-populates earnout conditions and written contract closing requirements.
            </p>
            <MemoSimulator />
          </section>

          {/* ── 9. MOAT ── */}
          <section ref={setRef("moat")} id="moat" className="scroll-mt-20">
            <SectionLabel>The Moat — Roadmap</SectionLabel>
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border-1)" }}>
                <Database className="w-5 h-5" style={{ color: "var(--sh-primary)" }} />
              </div>
              <div>
                <h2 className="text-2xl font-black" style={{ fontFamily: "var(--font-serif, 'Fraunces', serif)", color: "var(--sh-text-primary)" }}>Searcher Intelligence DB</h2>
                <div className="mt-1">
                  <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: "oklch(0.55 0.12 145 / 0.10)", color: "#16a34a", border: "1px solid oklch(0.55 0.12 145 / 0.25)" }}>
                    Roadmap — not yet built
                  </span>
                </div>
              </div>
            </div>
            <p className="text-base leading-relaxed mb-4" style={{ color: "var(--sh-text-secondary)" }}>
              Every diligence run captures a searcher's live thesis: what they're looking for, what they rejected, what they flagged as a deal-killer. Aggregated across thousands of runs, this becomes a proprietary demand-side dataset that no competitor holds — a real-time map of what the acquisition market actually wants, before it appears in any listing or broker data.
            </p>
            <p className="text-base leading-relaxed mb-6" style={{ color: "var(--sh-text-secondary)" }}>
              The Searcher Intelligence DB is the path from a diligence tool to a data and matching business. The wedge is the free run. The moat is what the free run captures.
            </p>
            <div className="rounded-xl p-6" style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border-1)" }}>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { icon: Zap, label: "Demand Signal", desc: "Every run captures a live thesis — what the searcher wants, what they rejected, what killed the deal." },
                  { icon: BarChart3, label: "Compound Value", desc: "Each run makes the dataset richer. The 10,000th run is worth more than the 100th." },
                  { icon: Target, label: "Matching Engine", desc: "Roadmap: match sellers to the searchers most likely to close — before the deal hits a listing platform." },
                ].map((item) => (
                  <div key={item.label} className="text-center p-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "var(--sh-surface-3)", border: "1px solid var(--sh-border-1)" }}>
                      <item.icon className="w-5 h-5" style={{ color: "var(--sh-primary)" }} />
                    </div>
                    <p className="text-sm font-semibold mb-1" style={{ color: "var(--sh-text-primary)" }}>{item.label}</p>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--sh-fg-muted)" }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── 10. BUSINESS MODEL ── */}
          <section ref={setRef("model")} id="model" className="scroll-mt-20">
            <SectionLabel>Business Model</SectionLabel>
            <h2 className="text-3xl font-black mb-6" style={{ fontFamily: "var(--font-serif, 'Fraunces', serif)", color: "var(--sh-text-primary)" }}>
              Wedge → Conversion → Data Asset
            </h2>
            <div className="space-y-4 mb-6">
              {[
                {
                  step: "1",
                  label: "Free Gated Run",
                  status: "Roadmap",
                  desc: "Searcher inputs a deal. Red Team runs. One concern surfaced free, rest locked. Name + email captured. Searcher Intelligence DB record written with consent.",
                },
                {
                  step: "2",
                  label: "Subscription Conversion",
                  status: "Live",
                  desc: "Full platform access: all 6 modules, unlimited runs, IC consensus, memo generation. Priced for the individual searcher and the search fund.",
                },
                {
                  step: "3",
                  label: "Data Asset Compounding",
                  status: "Roadmap",
                  desc: "Every run enriches the Searcher Intelligence DB. At scale: matching, broker partnerships, institutional licensing. The tool is the wedge; the data is the business.",
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-4 rounded-xl p-5" style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border-1)" }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold" style={{ background: "var(--sh-primary)", color: "var(--sh-primary-fg)" }}>
                    {item.step}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{item.label}</p>
                      <StatusBadge status={item.status as any} />
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--sh-text-secondary)" }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>
              Revenue projections not shown — no fabricated traction numbers. Business model is structural; projections will be shared in direct investor conversation.
            </p>
          </section>

          {/* ── 11. RIGOR GATE ── */}
          <section ref={setRef("rigor")} id="rigor" className="scroll-mt-20">
            <SectionLabel>Validation — Rigor Gate</SectionLabel>
            <h2 className="text-3xl font-black mb-4" style={{ fontFamily: "var(--font-serif, 'Fraunces', serif)", color: "var(--sh-text-primary)" }}>
              The costly, falsifiable signal.
            </h2>
            <p className="text-base leading-relaxed mb-6" style={{ color: "var(--sh-text-secondary)" }}>
              The rigor gate is the credibility centerpiece: the Red Team was tested against documented failed deals using only pre-close data — no outcome information, no prompting for the answer. The results below are the raw gate output, not a prose summary.
            </p>
            <div className="space-y-4">
              {[
                {
                  id: "GT-001",
                  deal: "Apex Commercial Cleaning (composite)",
                  result: "PASS",
                  confidence: 94,
                  surfaced: ["Customer concentration (54%, owner-personal)", "Add-back inflation ($223k, true SDE $497k)", "Owner dependence (55-60 hrs/week, no management layer)", "Recommended QoE as immediate next step", "Recommended contract review for top 2 clients"],
                  missed: ["Hospital contract rebid risk surfaced only after prompting to check contract terms — gap documented"],
                  note: "All 5 primary failure modes surfaced from broker-sheet signals alone. Contract cliff risk requires explicit term date input or prompting.",
                },
                {
                  id: "GT-002",
                  deal: "Piedmont Pest Control (composite)",
                  result: "PARTIAL",
                  confidence: 78,
                  surfaced: ["Add-back inflation (labor cost misclassified as owner discretionary)", "Revenue growth driven by price increases, not account growth", "22% annual churn rate flagged as above industry average"],
                  missed: ["Lead technician departure risk NOT surfaced cold — requires employee reference check data as input. This is a known gap: the Red Team cannot surface undisclosed key-person risk without employee-level data."],
                  note: "GT-002 demonstrates the Red Team's limitation: it cannot surface what is not in the input signals. Undisclosed key-person departure requires employee reference data.",
                },
                {
                  id: "GT-003",
                  deal: "Logistics Express Charlotte (composite)",
                  result: "PASS",
                  confidence: 96,
                  surfaced: ["Government contract expiration (47% revenue, 18 months post-close)", "Binary revenue cliff flagged as existential risk", "Driver shortage structural constraint identified", "True enterprise value without government contract: ~$3.2M"],
                  missed: [],
                  note: "Contract cliff risk surfaced immediately — government contract expiration date is public on SAM.gov. This is the failure mode the Red Team catches most reliably when contract terms are in the input.",
                },
              ].map((gate) => (
                <div key={gate.id} className="rounded-xl p-5" style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border-1)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{gate.id} — {gate.deal}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{
                          color: gate.result === "PASS" ? "#16a34a" : "#d97706",
                          background: gate.result === "PASS" ? "oklch(0.55 0.12 145 / 0.10)" : "oklch(0.66 0.14 55 / 0.10)",
                          border: `1px solid ${gate.result === "PASS" ? "oklch(0.55 0.12 145 / 0.25)" : "oklch(0.66 0.14 55 / 0.25)"}`,
                        }}
                      >
                        {gate.result}
                      </span>
                      <span className="text-xs font-mono" style={{ color: "var(--sh-fg-muted)" }}>{gate.confidence}% confidence</span>
                    </div>
                  </div>
                  <div className="space-y-1 mb-3">
                    <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--sh-fg-muted)" }}>Surfaced cold:</p>
                    {gate.surfaced.map((s, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#16a34a" }} />
                        <p className="text-xs" style={{ color: "var(--sh-text-secondary)" }}>{s}</p>
                      </div>
                    ))}
                  </div>
                  {gate.missed.length > 0 && (
                    <div className="space-y-1 mb-3">
                      <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "#d97706" }}>Missed / gap:</p>
                      {gate.missed.map((m, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#d97706" }} />
                          <p className="text-xs" style={{ color: "var(--sh-text-secondary)" }}>{m}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs leading-relaxed" style={{ color: "var(--sh-fg-muted)" }}>{gate.note}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── 12. THE ASK ── */}
          <section ref={setRef("ask")} id="ask" className="scroll-mt-20">
            <SectionLabel>The Ask</SectionLabel>
            <h2 className="text-3xl font-black mb-4" style={{ fontFamily: "var(--font-serif, 'Fraunces', serif)", color: "var(--sh-text-primary)" }}>
              What the catalog needs. What comes next.
            </h2>
            <p className="text-base leading-relaxed mb-8" style={{ color: "var(--sh-text-secondary)" }}>
              Signal Hunter OS is in active development with a working platform, documented rigor gate results, and a clear path to the Searcher Intelligence DB moat. The next build priorities are the gated free run (/try), the Searcher Intelligence DB schema, and the matching engine foundation.
            </p>
            <div
              className="rounded-2xl p-8 text-center"
              style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border-1)" }}
            >
              <p className="text-lg font-semibold mb-2" style={{ color: "var(--sh-text-primary)" }}>Ready to run the live flow?</p>
              <p className="text-sm mb-6" style={{ color: "var(--sh-text-secondary)" }}>Log in to run a real deal through the full IC panel, Red Team, and capital stack — not a demo.</p>
              <a
                href={getLoginUrl()}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-base font-semibold transition-all"
                style={{ background: "var(--sh-primary)", color: "var(--sh-primary-fg)" }}
              >
                Log in to run the live flow
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </section>

          {/* ── 13. CAPABILITY MATRIX ── */}
          <section ref={setRef("matrix")} id="matrix" className="scroll-mt-20">
            <SectionLabel>Capability Matrix — FIS Catalog</SectionLabel>
            <h2 className="text-3xl font-black mb-6" style={{ fontFamily: "var(--font-serif, 'Fraunces', serif)", color: "var(--sh-text-primary)" }}>
              Honest status per capability.
            </h2>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--sh-border-1)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--sh-surface-2)", borderBottom: "1px solid var(--sh-border-1)" }}>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--sh-fg-muted)" }}>Capability</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide hidden sm:table-cell" style={{ color: "var(--sh-fg-muted)" }}>What it does</th>
                    <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--sh-fg-muted)" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {CAPABILITY_MATRIX.map((row, i) => (
                    <tr
                      key={row.capability}
                      style={{
                        borderBottom: i < CAPABILITY_MATRIX.length - 1 ? "1px solid var(--sh-border-1)" : "none",
                        background: i % 2 === 0 ? "transparent" : "var(--sh-surface-2)",
                      }}
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--sh-text-primary)" }}>{row.capability}</td>
                      <td className="px-4 py-3 hidden sm:table-cell" style={{ color: "var(--sh-text-secondary)" }}>{row.description}</td>
                      <td className="px-4 py-3 text-right">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs mt-4" style={{ color: "var(--sh-fg-muted)" }}>
              Live = deployed and functional in the current build. Demo = working simulator, not connected to live data. Roadmap = scoped and designed, not yet built. No capability is labeled Live unless it is running in production.
            </p>
          </section>

        </main>
      </div>

      {/* ── Mobile bottom CTA ── */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 px-4 py-3 flex items-center justify-between"
        style={{ background: "var(--sh-bg)", borderTop: "1px solid var(--sh-border-1)" }}
      >
        <p className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>Signal Hunter OS · Investor Brief</p>
        <a
          href={getLoginUrl()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "var(--sh-primary)", color: "var(--sh-primary-fg)" }}
        >
          Run live flow
          <ChevronRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
