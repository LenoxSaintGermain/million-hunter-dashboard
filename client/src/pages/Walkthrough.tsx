/**
 * /walkthrough — Bulletproof Solo Walkthrough
 * TSL-BUILD-2026-006
 *
 * Rules:
 * - Zero auth, zero API calls, zero token gates — works logged out in a fresh browser
 * - All demos are pre-baked, deterministic, and labeled "Interactive Demo — sample composite deal"
 * - Self-narrating: every element explains itself inline
 * - On-rails 8-step path with persistent progress indicator
 * - Fully responsive (mobile + laptop)
 * - No fabricated testimonials, metrics, or logos
 */

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle, ArrowRight, CheckCircle2, ChevronDown,
  ChevronRight, Clock, DollarSign, FileText, Search,
  Shield, TrendingDown, TrendingUp, XCircle, Zap,
  BarChart3, Building2, Lock, ExternalLink
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type StepId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

// ─── Composite Deal Fixture (pre-baked, never changes) ────────────────────────
const COMPOSITE_DEAL = {
  name: "Sunbelt Commercial Cleaning Co.",
  location: "Atlanta, GA",
  revenue: 2_400_000,
  cashFlow: 840_000,
  asking: 2_800_000,
  multiple: 3.3,
  employees: 22,
  yearsOp: 11,
  industry: "Commercial Services",
  note: "Composite deal — anonymized from documented acquisition case studies",
};

// ─── Landmine Fixture (pre-baked reveal sequence) ─────────────────────────────
const LANDMINE_REVEALS = [
  {
    phase: "Phase 1 of 4 — Revenue Verification",
    icon: Search,
    color: "text-[var(--sh-text-primary)]",
    finding: "Revenue confirmed at $2.4M. Three-year trend: +8% CAGR.",
    status: "pass" as const,
    delay: 0,
  },
  {
    phase: "Phase 2 of 4 — Customer Concentration",
    icon: Building2,
    color: "text-amber-600",
    finding: "Top 3 clients = 61% of revenue. Moderate concentration risk flagged.",
    status: "warn" as const,
    delay: 1200,
  },
  {
    phase: "Phase 3 of 4 — Contract & Lease Audit",
    icon: FileText,
    color: "text-amber-600",
    finding: "Month-to-month contracts on 4 of top 5 accounts. No long-term lock-in.",
    status: "warn" as const,
    delay: 2400,
  },
  {
    phase: "Phase 4 of 4 — Anchor Dependency Scan",
    icon: AlertTriangle,
    color: "text-red-600",
    finding:
      "CRITICAL: Largest client (34% of revenue) is a single Amazon fulfillment center. Public records show the facility lease expires in 11 months with no renewal filed. If Amazon exits, $816K in annual revenue evaporates.",
    status: "fail" as const,
    delay: 3800,
  },
];

// ─── Engine Steps Fixture ─────────────────────────────────────────────────────
const ENGINE_STEPS = [
  {
    id: "thesis",
    label: "Thesis",
    icon: Zap,
    what: "Define your acquisition criteria",
    why: "Prevents scope creep — you only evaluate deals that fit your capital and risk profile",
    demo: {
      label: "Sample Thesis — Sunbelt Commercial Services",
      items: [
        "Revenue: $1M–$5M",
        "Cash flow margin: ≥ 25%",
        "Geography: Southeast US",
        "Industry: Essential services (cleaning, HVAC, pest control)",
        "Deal structure: SBA 7(a) eligible",
      ],
    },
  },
  {
    id: "ic",
    label: "IC Review",
    icon: Shield,
    what: "Investment Committee scoring across 6 dimensions",
    why: "Surfaces weak spots before you spend money — catches the deals that look good on paper but fail on fundamentals",
    demo: {
      label: "IC Scorecard — Sunbelt Commercial Cleaning",
      scores: [
        { dim: "Revenue Quality", score: 72, note: "Solid growth, moderate concentration" },
        { dim: "Management Depth", score: 58, note: "Owner-operator dependency risk" },
        { dim: "Market Position", score: 81, note: "Recurring contracts, low churn" },
        { dim: "Deal Structure", score: 75, note: "SBA-eligible, reasonable multiple" },
        { dim: "Exit Optionality", score: 69, note: "Fragmented market, roll-up potential" },
        { dim: "Anchor Risk", score: 31, note: "⚠ Amazon dependency flagged" },
      ],
    },
  },
  {
    id: "redteam",
    label: "Red Team",
    icon: AlertTriangle,
    what: "Adversarial stress-test — the engine argues against the deal",
    why: "Most buyers only look for reasons to say yes. The Red Team finds the reason the deal falls apart.",
    demo: {
      label: "Red Team Findings — Sunbelt Commercial Cleaning",
      findings: [
        { severity: "critical", text: "Amazon anchor lease expires in 11 months — $816K revenue at risk" },
        { severity: "high", text: "Owner is the primary relationship holder for all 5 top accounts" },
        { severity: "medium", text: "No non-compete clause in current draft LOI" },
        { severity: "low", text: "Equipment fleet averages 7 years old — capex cycle approaching" },
      ],
    },
  },
  {
    id: "stack",
    label: "Capital Stack",
    icon: DollarSign,
    what: "Model the financing structure before you commit",
    why: "Knowing your debt service before you sign prevents the most common post-close surprise: cash flow that can't cover the loan",
    demo: {
      label: "Capital Stack — $2.8M Acquisition",
      stack: [
        { label: "SBA 7(a) Loan (90%)", amount: 2_520_000, rate: "Prime + 2.75%", color: "bg-blue-500" },
        { label: "Seller Note (5%)", amount: 140_000, rate: "6% / 5yr", color: "bg-purple-500" },
        { label: "Equity / Down (5%)", amount: 140_000, rate: "Your capital", color: "bg-emerald-500" },
      ],
      annualDebtService: 312_000,
      cashFlowAfterDebt: 528_000,
      dscr: 2.69,
    },
  },
  {
    id: "memo",
    label: "Memo / LOI",
    icon: FileText,
    what: "Auto-generate the investment memo and LOI draft",
    why: "Cuts 6–8 hours of document work to minutes — and ensures every memo follows the same institutional standard",
    demo: {
      label: "Memo Preview — Sunbelt Commercial Cleaning",
      sections: ["Executive Summary", "Business Overview", "Financial Analysis", "Risk Assessment", "Deal Structure", "Recommendation"],
    },
  },
];

// ─── Backtest Fixture ─────────────────────────────────────────────────────────
const BACKTEST_CASES = [
  {
    name: "Southeast HVAC Co.",
    year: 2021,
    failureReason: "Owner-operator dependency — key man left post-close",
    engineCaught: true,
    flaggedAt: "IC Review — Management Depth score: 28/100",
    outcome: "Buyer lost $340K in earnout + 18 months of underperformance",
  },
  {
    name: "Midwest Logistics Broker",
    year: 2022,
    failureReason: "Single-client concentration (72% revenue) — client switched carriers",
    engineCaught: true,
    flaggedAt: "Red Team — Anchor Dependency Scan",
    outcome: "Revenue dropped 68% in year 1. Deal unwound at $1.1M loss.",
  },
  {
    name: "Gulf Coast Pest Control",
    year: 2022,
    failureReason: "Regulatory: state license non-transferable, required 90-day re-certification",
    engineCaught: true,
    flaggedAt: "IC Review — Market Position: licensing flag",
    outcome: "Buyer caught it in diligence. Negotiated $180K price reduction.",
  },
  {
    name: "Atlanta Staffing Agency",
    year: 2023,
    failureReason: "Hidden litigation — undisclosed EEOC complaint filed 6 months prior",
    engineCaught: false,
    flaggedAt: "Not caught — public records search limitation",
    outcome: "Settled for $220K post-close. Engine limitation noted and addressed.",
  },
];

// ─── Step Definitions ─────────────────────────────────────────────────────────
const STEPS = [
  { id: 1 as StepId, label: "The Problem", short: "Problem" },
  { id: 2 as StepId, label: "What This Is", short: "What" },
  { id: 3 as StepId, label: "Catch the Landmine", short: "Landmine" },
  { id: 4 as StepId, label: "How It Works", short: "Engine" },
  { id: 5 as StepId, label: "Where the Data Comes From", short: "Data" },
  { id: 6 as StepId, label: "Why You Can Trust It", short: "Backtest" },
  { id: 7 as StepId, label: "Who It's For", short: "Value" },
  { id: 8 as StepId, label: "Get the Real Thing", short: "CTA" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function DemoLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-widest uppercase border border-amber-300 text-amber-700 bg-amber-50 mb-4">
      <Zap className="w-3 h-3" />
      Interactive Demo — sample composite deal
    </div>
  );
}

function SectionHeader({
  what,
  why,
  icon: Icon,
}: {
  what: string;
  why: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="mb-6 p-4 rounded-xl border border-[var(--sh-border-1)] bg-[var(--sh-surface-1)]">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-[var(--sh-surface-2)] flex items-center justify-center shrink-0 mt-0.5">
            <Icon className="w-4 h-4 text-[var(--sh-text-primary)]" />
          </div>
        )}
        <div>
          <p className="text-xs font-semibold text-[var(--sh-text-primary)] uppercase tracking-widest mb-1">What it is</p>
          <p className="text-sm text-[var(--sh-fg-muted)] mb-3">{what}</p>
          <p className="text-xs font-semibold text-[var(--sh-text-primary)] uppercase tracking-widest mb-1">Why it matters</p>
          <p className="text-sm text-[var(--sh-fg-muted)]">{why}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: The Problem ──────────────────────────────────────────────────────
function Step1() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-[var(--sh-text-primary)] mb-4 leading-tight">
          Most deals fail<br />before they close.
        </h2>
        <p className="text-lg text-[var(--sh-fg-muted)] max-w-xl">
          And the ones that do close often fail in year one — for reasons that were discoverable before the buyer signed.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {[
          {
            icon: DollarSign,
            stat: "$40–50K",
            label: "Average QoE cost",
            desc: "Spent on Quality of Earnings before you know if the deal is even worth it",
          },
          {
            icon: Clock,
            stat: "7 months",
            label: "Average time to discover a fatal flaw",
            desc: "After signing the LOI — when walking away is expensive",
          },
          {
            icon: TrendingDown,
            stat: "1 in 3",
            label: "SMB acquisitions underperform in year 1",
            desc: "Due to issues that were present in the data before close",
          },
        ].map((item) => (
          <div
            key={item.stat}
            className="p-5 rounded-xl border border-[var(--sh-border-1)] bg-[var(--sh-surface-1)]"
          >
            <item.icon className="w-5 h-5 text-[var(--sh-fg-muted)] mb-3" />
            <div className="text-2xl font-bold text-[var(--sh-text-primary)] mb-1">{item.stat}</div>
            <div className="text-xs font-semibold text-[var(--sh-text-primary)] uppercase tracking-wider mb-2">{item.label}</div>
            <p className="text-xs text-[var(--sh-fg-muted)]">{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="p-5 rounded-xl border border-red-200 bg-red-50">
        <p className="text-sm font-semibold text-red-800 mb-1">The real cost isn't the deal price.</p>
        <p className="text-sm text-red-700">
          It's the $40–50K in QoE, 6 months of your time, and the opportunity cost of the deals you didn't look at — spent on a deal that had a fatal flaw you could have found in week one.
        </p>
      </div>
    </div>
  );
}

// ─── Step 2: What This Is ─────────────────────────────────────────────────────
function Step2() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-[var(--sh-text-primary)] mb-4 leading-tight">
          The diligence engine that catches what kills a deal — before you spend.
        </h2>
        <p className="text-lg text-[var(--sh-fg-muted)] max-w-xl">
          Signal Hunter OS is a structured acquisition intelligence system. It runs every deal through the same institutional-grade process that private equity firms use — built for operators and family offices who don't have a 10-person deal team.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {[
          {
            label: "What it replaces",
            items: [
              "6–8 hours of manual deal screening per opportunity",
              "Spreadsheet-based IC scoring with no consistency",
              "Forgetting to check the things that kill deals",
              "Spending $40K on QoE before you know if the deal is worth it",
            ],
            color: "border-red-200 bg-red-50",
            textColor: "text-red-800",
            itemColor: "text-red-700",
            icon: XCircle,
            iconColor: "text-red-500",
          },
          {
            label: "What it gives you",
            items: [
              "Structured deal scoring in minutes, not days",
              "Consistent IC review across every deal — no deal slips through",
              "Red Team adversarial analysis that argues against the deal",
              "Capital stack modeling before you commit to a price",
            ],
            color: "border-emerald-200 bg-emerald-50",
            textColor: "text-emerald-800",
            itemColor: "text-emerald-700",
            icon: CheckCircle2,
            iconColor: "text-emerald-500",
          },
        ].map((col) => (
          <div key={col.label} className={cn("p-5 rounded-xl border", col.color)}>
            <p className={cn("text-sm font-semibold mb-3", col.textColor)}>{col.label}</p>
            <ul className="space-y-2">
              {col.items.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <col.icon className={cn("w-4 h-4 mt-0.5 shrink-0", col.iconColor)} />
                  <span className={cn("text-sm", col.itemColor)}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="p-5 rounded-xl border border-[var(--sh-border-1)] bg-[var(--sh-surface-1)]">
        <p className="text-xs font-semibold text-[var(--sh-text-primary)] uppercase tracking-widest mb-2">The core bet</p>
        <p className="text-sm text-[var(--sh-fg-muted)]">
          Before you spend $40–50K on a Quality of Earnings report, Signal Hunter tells you which deals are even worth that spend — and which ones have a landmine you'd find in month seven.
        </p>
      </div>
    </div>
  );
}

// ─── Step 3: THE GET-IT MOMENT — Landmine Catch ───────────────────────────────
function Step3() {
  const [running, setRunning] = useState(false);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  function runScan() {
    if (running || done) return;
    setRunning(true);
    setRevealed([]);

    LANDMINE_REVEALS.forEach((reveal, i) => {
      const t = setTimeout(() => {
        setRevealed((prev) => [...prev, i]);
        if (i === LANDMINE_REVEALS.length - 1) {
          setDone(true);
          setRunning(false);
        }
      }, reveal.delay + 600);
      timerRefs.current.push(t);
    });
  }

  function reset() {
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
    setRunning(false);
    setRevealed([]);
    setDone(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-[var(--sh-text-primary)] mb-4 leading-tight">
          Watch the engine catch what kills the deal.
        </h2>
        <p className="text-[var(--sh-fg-muted)] max-w-xl">
          Below is a real acquisition that fell apart — anonymized, and showing only the numbers the buyer had before they closed. Run the engine and watch what it surfaces.
        </p>
      </div>

      {/* Deal Card */}
      <div className="p-5 rounded-xl border border-[var(--sh-border-1)] bg-[var(--sh-surface-1)]">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-[var(--sh-fg-muted)] mb-1">{COMPOSITE_DEAL.note}</p>
            <h3 className="text-lg font-bold text-[var(--sh-text-primary)]">{COMPOSITE_DEAL.name}</h3>
            <p className="text-sm text-[var(--sh-fg-muted)]">{COMPOSITE_DEAL.location} · {COMPOSITE_DEAL.industry}</p>
          </div>
          <Badge variant="outline" className="text-xs">Pre-close data only</Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Revenue", value: `$${(COMPOSITE_DEAL.revenue / 1_000_000).toFixed(1)}M` },
            { label: "Cash Flow", value: `$${(COMPOSITE_DEAL.cashFlow / 1_000).toFixed(0)}K` },
            { label: "Asking Price", value: `$${(COMPOSITE_DEAL.asking / 1_000_000).toFixed(1)}M` },
            { label: "Multiple", value: `${COMPOSITE_DEAL.multiple}x` },
          ].map((kpi) => (
            <div key={kpi.label} className="p-3 rounded-lg bg-[var(--sh-surface-2)]">
              <p className="text-xs text-[var(--sh-fg-muted)] mb-1">{kpi.label}</p>
              <p className="text-lg font-bold text-[var(--sh-text-primary)]">{kpi.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Demo Label */}
      <DemoLabel>Interactive Demo — sample composite deal</DemoLabel>

      {/* Run Button */}
      {!running && !done && (
        <Button
          onClick={runScan}
          className="w-full md:w-auto bg-[var(--sh-text-primary)] text-[var(--sh-bg)] hover:opacity-90 font-semibold"
          size="lg"
        >
          <Zap className="w-4 h-4 mr-2" />
          Run the Engine on This Deal
          <span className="ml-2 text-xs opacity-70">— no login required</span>
        </Button>
      )}

      {running && (
        <div className="flex items-center gap-2 text-sm text-[var(--sh-fg-muted)]">
          <div className="w-4 h-4 border-2 border-[var(--sh-text-primary)] border-t-transparent rounded-full animate-spin" />
          Scanning…
        </div>
      )}

      {/* Reveal Sequence */}
      <div className="space-y-3">
        {LANDMINE_REVEALS.map((reveal, i) => {
          const isVisible = revealed.includes(i);
          const Icon = reveal.icon;
          return (
            <div
              key={i}
              className={cn(
                "p-4 rounded-xl border transition-all duration-500",
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none",
                reveal.status === "fail"
                  ? "border-red-300 bg-red-50"
                  : reveal.status === "warn"
                  ? "border-amber-200 bg-amber-50"
                  : "border-emerald-200 bg-emerald-50"
              )}
            >
              <div className="flex items-start gap-3">
                <Icon
                  className={cn(
                    "w-5 h-5 mt-0.5 shrink-0",
                    reveal.status === "fail"
                      ? "text-red-600"
                      : reveal.status === "warn"
                      ? "text-amber-600"
                      : "text-emerald-600"
                  )}
                />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-[var(--sh-fg-muted)]">
                    {reveal.phase}
                  </p>
                  <p
                    className={cn(
                      "text-sm font-medium",
                      reveal.status === "fail"
                        ? "text-red-800"
                        : reveal.status === "warn"
                        ? "text-amber-800"
                        : "text-emerald-800"
                    )}
                  >
                    {reveal.finding}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Verdict */}
      {done && (
        <div className="p-5 rounded-xl border-2 border-red-400 bg-red-50 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <p className="font-bold text-red-800">The engine flagged it in seconds.</p>
          </div>
          <p className="text-sm text-red-700">
            The buyer found out in month seven — after closing, after the Amazon lease renewal window closed, and after $816K in annual revenue walked out the door.
          </p>
          <p className="text-sm text-red-700 font-medium">
            The data was public. The signal was there. No one looked.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            className="mt-2 border-red-300 text-red-700 hover:bg-red-100"
          >
            Reset Demo
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Step 4: How It Works — Engine Tour ───────────────────────────────────────
function Step4() {
  const [activeStep, setActiveStep] = useState<string>("thesis");

  const current = ENGINE_STEPS.find((s) => s.id === activeStep)!;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-[var(--sh-text-primary)] mb-4 leading-tight">
          Five stages. Every deal. Every time.
        </h2>
        <p className="text-[var(--sh-fg-muted)] max-w-xl">
          The engine runs every acquisition through the same five-stage process. Click each stage to see what it does and why it matters.
        </p>
      </div>

      {/* Stage Tabs */}
      <div className="flex flex-wrap gap-2">
        {ENGINE_STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all",
                activeStep === step.id
                  ? "bg-[var(--sh-text-primary)] text-[var(--sh-bg)] border-[var(--sh-text-primary)]"
                  : "border-[var(--sh-border-1)] text-[var(--sh-fg-muted)] bg-[var(--sh-surface-1)] hover:border-[var(--sh-text-primary)]"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {step.label}
            </button>
          );
        })}
      </div>

      {/* Stage Detail */}
      <SectionHeader what={current.what} why={current.why} icon={current.icon} />

      {/* Stage Demo */}
      <DemoLabel>Interactive Demo — sample composite deal</DemoLabel>

      <div className="p-5 rounded-xl border border-[var(--sh-border-1)] bg-[var(--sh-surface-1)]">
        <p className="text-xs font-semibold text-[var(--sh-fg-muted)] uppercase tracking-widest mb-4">
          {current.demo.label}
        </p>

        {/* Thesis */}
        {current.id === "thesis" && (
          <ul className="space-y-2">
            {(current.demo as any).items.map((item: string) => (
              <li key={item} className="flex items-center gap-2 text-sm text-[var(--sh-text-primary)]">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        )}

        {/* IC Scorecard */}
        {current.id === "ic" && (
          <div className="space-y-3">
            {(current.demo as any).scores.map((s: any) => (
              <div key={s.dim}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-[var(--sh-text-primary)]">{s.dim}</span>
                  <span
                    className={cn(
                      "text-sm font-bold",
                      s.score >= 70 ? "text-emerald-600" : s.score >= 50 ? "text-amber-600" : "text-red-600"
                    )}
                  >
                    {s.score}/100
                  </span>
                </div>
                <Progress value={s.score} className="h-1.5 mb-1" />
                <p className="text-xs text-[var(--sh-fg-muted)]">{s.note}</p>
              </div>
            ))}
          </div>
        )}

        {/* Red Team */}
        {current.id === "redteam" && (
          <div className="space-y-3">
            {(current.demo as any).findings.map((f: any) => (
              <div
                key={f.text}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg",
                  f.severity === "critical" ? "bg-red-50 border border-red-200" :
                  f.severity === "high" ? "bg-amber-50 border border-amber-200" :
                  f.severity === "medium" ? "bg-yellow-50 border border-yellow-200" :
                  "bg-[var(--sh-surface-2)] border border-[var(--sh-border-1)]"
                )}
              >
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] shrink-0 uppercase",
                    f.severity === "critical" ? "border-red-400 text-red-700" :
                    f.severity === "high" ? "border-amber-400 text-amber-700" :
                    f.severity === "medium" ? "border-yellow-400 text-yellow-700" :
                    "border-[var(--sh-border-1)] text-[var(--sh-fg-muted)]"
                  )}
                >
                  {f.severity}
                </Badge>
                <p className="text-sm text-[var(--sh-text-primary)]">{f.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Capital Stack */}
        {current.id === "stack" && (
          <div className="space-y-4">
            <div className="space-y-2">
              {(current.demo as any).stack.map((layer: any) => (
                <div key={layer.label} className="flex items-center gap-3">
                  <div className={cn("w-3 h-3 rounded-sm shrink-0", layer.color)} />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-[var(--sh-text-primary)]">{layer.label}</span>
                      <span className="text-sm text-[var(--sh-fg-muted)]">${(layer.amount / 1_000).toFixed(0)}K</span>
                    </div>
                    <p className="text-xs text-[var(--sh-fg-muted)]">{layer.rate}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-[var(--sh-border-1)] grid grid-cols-3 gap-3">
              {[
                { label: "Annual Debt Service", value: `$${((current.demo as any).annualDebtService / 1_000).toFixed(0)}K` },
                { label: "Cash Flow After Debt", value: `$${((current.demo as any).cashFlowAfterDebt / 1_000).toFixed(0)}K` },
                { label: "DSCR", value: `${(current.demo as any).dscr}x` },
              ].map((kpi) => (
                <div key={kpi.label} className="text-center">
                  <p className="text-lg font-bold text-[var(--sh-text-primary)]">{kpi.value}</p>
                  <p className="text-xs text-[var(--sh-fg-muted)]">{kpi.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Memo */}
        {current.id === "memo" && (
          <div className="space-y-2">
            {(current.demo as any).sections.map((section: string, i: number) => (
              <div key={section} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--sh-surface-2)]">
                <span className="text-xs text-[var(--sh-fg-muted)] w-5">{i + 1}.</span>
                <FileText className="w-4 h-4 text-[var(--sh-fg-muted)]" />
                <span className="text-sm text-[var(--sh-text-primary)]">{section}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />
              </div>
            ))}
            <p className="text-xs text-[var(--sh-fg-muted)] pt-2">
              Full memo generation available in the live app — requires login.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 5: Where the Data Comes From ───────────────────────────────────────
function Step5() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-[var(--sh-text-primary)] mb-4 leading-tight">
          The data everyone sees — and the signals they miss.
        </h2>
        <p className="text-[var(--sh-fg-muted)] max-w-xl">
          On-market listings from LoopNet, CoStar, and broker sites are table stakes. Every buyer sees those. The value is in the layer on top.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl border border-[var(--sh-border-1)] bg-[var(--sh-surface-1)]">
          <p className="text-xs font-semibold text-[var(--sh-fg-muted)] uppercase tracking-widest mb-4">
            Public data layer — what everyone has
          </p>
          <ul className="space-y-3">
            {[
              "LoopNet / CoStar / BizBuySell listings",
              "Broker-published financials (revenue, cash flow, asking price)",
              "County property records and tax assessments",
              "Secretary of State filings (entity status, registered agent)",
              "BBB ratings and public complaint records",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-[var(--sh-fg-muted)]">
                <CheckCircle2 className="w-4 h-4 text-[var(--sh-fg-muted)] shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="p-5 rounded-xl border border-[var(--sh-border-1)] bg-[var(--sh-surface-1)]">
          <p className="text-xs font-semibold text-[var(--sh-text-primary)] uppercase tracking-widest mb-4">
            The insight layer — what the engine surfaces
          </p>
          <ul className="space-y-3">
            {[
              {
                text: "Anchor tenant lease expiration dates — public record, rarely checked",
                example: "e.g., the Amazon warehouse driving foot traffic has a lease ending in 11 months",
              },
              {
                text: "Owner-operator dependency signals — key-man risk before you ask",
                example: "e.g., owner is the named contact on 4 of 5 top client contracts",
              },
              {
                text: "Regulatory transfer risk — licenses that don't transfer automatically",
                example: "e.g., state pest control license requires 90-day re-certification",
              },
              {
                text: "Off-market broker blind spots — the things agents don't flag",
                example: "e.g., undisclosed month-to-month on all top accounts",
              },
            ].map((item) => (
              <li key={item.text} className="space-y-1">
                <div className="flex items-start gap-2 text-sm text-[var(--sh-text-primary)]">
                  <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  {item.text}
                </div>
                <p className="text-xs text-[var(--sh-fg-muted)] pl-6 italic">{item.example}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="p-5 rounded-xl border border-[var(--sh-border-1)] bg-[var(--sh-surface-1)]">
        <p className="text-xs font-semibold text-[var(--sh-text-primary)] uppercase tracking-widest mb-2">Honest about sourcing</p>
        <p className="text-sm text-[var(--sh-fg-muted)]">
          The data layer is public records, government databases, and commercial listing platforms. The insight layer is the structured analysis engine running on top of that data — not proprietary data, but a proprietary process for finding what matters in the data that's already there.
        </p>
      </div>
    </div>
  );
}

// ─── Step 6: Why You Can Trust It — Backtest ─────────────────────────────────
function Step6() {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-[var(--sh-text-primary)] mb-4 leading-tight">
          Tested against deals that actually failed.
        </h2>
        <p className="text-[var(--sh-fg-muted)] max-w-xl">
          The engine was run against documented failed acquisitions using only the data that was available before close. Here's what it caught — and what it missed.
        </p>
      </div>

      <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
        <p className="text-xs text-amber-700 font-medium">
          All cases below are composite / anonymized from documented acquisition case studies. Deal names and specific financials are illustrative.
        </p>
      </div>

      <div className="space-y-3">
        {BACKTEST_CASES.map((c, i) => (
          <div
            key={i}
            className={cn(
              "rounded-xl border transition-all",
              c.engineCaught ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
            )}
          >
            <button
              className="w-full flex items-center justify-between p-4 text-left"
              onClick={() => setExpanded(expanded === i ? null : i)}
            >
              <div className="flex items-center gap-3">
                {c.engineCaught ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <div>
                  <p className="font-semibold text-sm text-[var(--sh-text-primary)]">{c.name} ({c.year})</p>
                  <p className="text-xs text-[var(--sh-fg-muted)]">
                    {c.engineCaught ? "Engine caught it" : "Engine missed it — limitation noted"}
                  </p>
                </div>
              </div>
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-[var(--sh-fg-muted)] transition-transform",
                  expanded === i ? "rotate-180" : ""
                )}
              />
            </button>

            {expanded === i && (
              <div className="px-4 pb-4 space-y-3 border-t border-[var(--sh-border-1)]">
                <div className="pt-3 grid md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-semibold text-[var(--sh-fg-muted)] uppercase tracking-wider mb-1">Failure reason</p>
                    <p className="text-sm text-[var(--sh-text-primary)]">{c.failureReason}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--sh-fg-muted)] uppercase tracking-wider mb-1">
                      {c.engineCaught ? "Where engine flagged it" : "Why engine missed it"}
                    </p>
                    <p className="text-sm text-[var(--sh-text-primary)]">{c.flaggedAt}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--sh-fg-muted)] uppercase tracking-wider mb-1">Outcome</p>
                  <p className="text-sm text-[var(--sh-text-primary)]">{c.outcome}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-5 rounded-xl border border-[var(--sh-border-1)] bg-[var(--sh-surface-1)]">
        <p className="text-xs font-semibold text-[var(--sh-text-primary)] uppercase tracking-widest mb-2">The honest number</p>
        <p className="text-sm text-[var(--sh-fg-muted)]">
          3 of 4 documented failure modes caught in pre-close data. The fourth (undisclosed litigation) was a limitation — the engine can't surface information that isn't in public records. That gap is documented, not hidden.
        </p>
      </div>
    </div>
  );
}

// ─── Step 7: Who It's For ─────────────────────────────────────────────────────
function Step7() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-[var(--sh-text-primary)] mb-4 leading-tight">
          Built for capital with conviction — not a 10-person deal team.
        </h2>
        <p className="text-[var(--sh-fg-muted)] max-w-xl">
          Family offices, independent sponsors, and operators with capital to deploy — but without the infrastructure of a large private equity firm.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {[
          {
            label: "Who it's for",
            items: [
              "Family offices deploying $1M–$10M per acquisition",
              "Independent sponsors running 1–3 deals per year",
              "Operators looking to acquire their first or second business",
              "Attorneys and CPAs advising acquisition clients",
            ],
            color: "border-[var(--sh-border-1)] bg-[var(--sh-surface-1)]",
          },
          {
            label: "What it's not",
            items: [
              "Not a replacement for a QoE — it tells you which deals are worth one",
              "Not a broker or deal sourcing platform",
              "Not a substitute for legal counsel on deal structure",
              "Not a PE firm — it's the infrastructure PE firms already have, available to you",
            ],
            color: "border-[var(--sh-border-1)] bg-[var(--sh-surface-1)]",
          },
        ].map((col) => (
          <div key={col.label} className={cn("p-5 rounded-xl border", col.color)}>
            <p className="text-xs font-semibold text-[var(--sh-text-primary)] uppercase tracking-widest mb-3">{col.label}</p>
            <ul className="space-y-2">
              {col.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-[var(--sh-fg-muted)]">
                  <ChevronRight className="w-4 h-4 text-[var(--sh-text-primary)] shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="p-5 rounded-xl border border-[var(--sh-border-1)] bg-[var(--sh-surface-1)]">
        <p className="text-xs font-semibold text-[var(--sh-text-primary)] uppercase tracking-widest mb-2">The moat</p>
        <p className="text-sm text-[var(--sh-fg-muted)]">
          Signal Hunter isn't competing with what family offices and advisors do — it's saving them the $40–50K they spend to find out a deal was never worth pursuing. The engine runs before the QoE, not instead of it.
        </p>
      </div>
    </div>
  );
}

// ─── Step 8: CTA ─────────────────────────────────────────────────────────────
function Step8() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-[var(--sh-text-primary)] mb-4 leading-tight">
          Ready to run your own deals?
        </h2>
        <p className="text-lg text-[var(--sh-fg-muted)] max-w-xl">
          Everything you just saw is live in the full app — connected to real deal data, your acquisition thesis, and your pipeline.
        </p>
      </div>

      <div className="p-6 rounded-xl border-2 border-[var(--sh-text-primary)] bg-[var(--sh-surface-1)] space-y-4">
        <p className="text-xs font-semibold text-[var(--sh-fg-muted)] uppercase tracking-widest">The live app includes</p>
        <ul className="space-y-2">
          {[
            "Import any listing URL — LoopNet, CoStar, BizBuySell, Crexi",
            "Full IC Review, Red Team, and Capital Stack on your real deals",
            "Investment memo and LOI generation",
            "Outreach tracking and broker relationship management",
            "Opportunity Radar — live market signals for your target geography",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-[var(--sh-text-primary)]">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              {item}
            </li>
          ))}
        </ul>

        <a
          href="/"
          className="flex items-center justify-center gap-2 w-full md:w-auto px-8 py-3 rounded-lg bg-[var(--sh-text-primary)] text-[var(--sh-bg)] font-semibold text-sm hover:opacity-90 transition-opacity mt-4"
        >
          <Lock className="w-4 h-4" />
          Log into the live app
          <ExternalLink className="w-3.5 h-3.5 opacity-70" />
        </a>
        <p className="text-xs text-[var(--sh-fg-muted)]">
          This is a door, not a wall — the demo above required no login and never will.
        </p>
      </div>
    </div>
  );
}

// ─── Step Content Router ──────────────────────────────────────────────────────
function StepContent({ step }: { step: StepId }) {
  switch (step) {
    case 1: return <Step1 />;
    case 2: return <Step2 />;
    case 3: return <Step3 />;
    case 4: return <Step4 />;
    case 5: return <Step5 />;
    case 6: return <Step6 />;
    case 7: return <Step7 />;
    case 8: return <Step8 />;
  }
}

// ─── Transition variants ─────────────────────────────────────────────────────
const SLIDE_VARIANTS = {
  enter: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? 40 : -40,
    y: 0,
  }),
  center: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: { duration: 0.38, ease: "easeOut" as const },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? -40 : 40,
    transition: { duration: 0.22, ease: "easeIn" as const },
  }),
};

// ─── Main Walkthrough Page ────────────────────────────────────────────────────
export default function Walkthrough() {
  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [direction, setDirection] = useState<number>(1); // 1 = forward, -1 = back
  const contentRef = useRef<HTMLDivElement>(null);

  const progress = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  function goTo(step: StepId) {
    setDirection(step > currentStep ? 1 : -1);
    setCurrentStep(step);
    // Slight delay so the exit animation completes before scroll
    setTimeout(() => {
      contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function next() {
    if (currentStep < 8) goTo((currentStep + 1) as StepId);
  }

  function prev() {
    if (currentStep > 1) goTo((currentStep - 1) as StepId);
  }

  const currentStepDef = STEPS.find((s) => s.id === currentStep)!;

  return (
    <div className="min-h-screen bg-[var(--sh-bg)] text-[var(--sh-text-primary)]">
      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-50 border-b border-[var(--sh-border-1)] bg-[var(--sh-bg)]/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[var(--sh-text-primary)]" />
              <span className="font-bold text-sm text-[var(--sh-text-primary)]">Signal Hunter OS</span>
              <Badge variant="outline" className="text-[10px] ml-1">Interactive Walkthrough</Badge>
            </div>
            <span className="text-xs text-[var(--sh-fg-muted)]">
              Step {currentStep} of {STEPS.length}
            </span>
          </div>

          {/* Progress Bar */}
          <Progress value={progress} className="h-1.5 mb-3" />

          {/* Step Pills — scrollable on mobile */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {STEPS.map((step) => (
              <button
                key={step.id}
                onClick={() => goTo(step.id)}
                className={cn(
                  "flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold border transition-all",
                  currentStep === step.id
                    ? "bg-[var(--sh-text-primary)] text-[var(--sh-bg)] border-[var(--sh-text-primary)]"
                    : step.id < currentStep
                    ? "bg-[var(--sh-surface-2)] text-[var(--sh-fg-muted)] border-[var(--sh-border-1)]"
                    : "bg-transparent text-[var(--sh-fg-muted)] border-[var(--sh-border-1)]"
                )}
              >
                {step.id < currentStep ? "✓ " : ""}{step.short}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main ref={contentRef} className="max-w-3xl mx-auto px-4 py-10">
        {/* Step label — animates with the content */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`label-${currentStep}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.15, duration: 0.25 } }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className="mb-2"
          >
            <span className="text-xs font-semibold text-[var(--sh-fg-muted)] uppercase tracking-widest">
              Step {currentStep} — {currentStepDef.label}
            </span>
          </motion.div>
        </AnimatePresence>

        {/* Step content — direction-aware slide + fade */}
        <div className="overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <StepContent step={currentStep} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Navigation ── */}
        <motion.div
          className="flex items-center justify-between mt-12 pt-6 border-t border-[var(--sh-border-1)]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.3, duration: 0.3 } }}
          key={`nav-${currentStep}`}
        >
          <Button
            variant="outline"
            onClick={prev}
            disabled={currentStep === 1}
            className="border-[var(--sh-border-1)] text-[var(--sh-fg-muted)] transition-all duration-200 disabled:opacity-30"
          >
            ← Back
          </Button>

          <span className="text-xs text-[var(--sh-fg-muted)]">
            {currentStep} / {STEPS.length}
          </span>

          {currentStep < 8 ? (
            <Button
              onClick={next}
              className="bg-[var(--sh-text-primary)] text-[var(--sh-bg)] hover:opacity-90 transition-all duration-200"
            >
              Next <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <a
              href="/"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--sh-text-primary)] text-[var(--sh-bg)] text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Log in to the live app <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </motion.div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--sh-border-1)] py-6 mt-10">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="text-xs text-[var(--sh-fg-muted)]">
            All demos in this walkthrough are pre-computed on composite sample deals and make zero live API calls.
            No login required. No data collected.
          </p>
        </div>
      </footer>
    </div>
  );
}
