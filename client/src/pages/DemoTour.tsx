import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { cn } from "@/lib/utils";
import {
  Radar, Waves, TrendingUp, ChevronRight, ChevronLeft,
  Lock, Zap, DollarSign, AlertTriangle, CheckCircle2,
  Building2, MapPin, BarChart3, Users, Star,
  ArrowRight, Play, Shield, Cpu, Target,
} from "lucide-react";

// ─── Static demo data — no API calls, no real data ───────────────────────────

const DEMO_DEAL = {
  name: "Apex Commercial Cleaning Solutions",
  location: "New Albany, OH",
  industry: "Commercial Services",
  revenue: "$2.1M",
  cashFlow: "$680K",
  asking: "$2.4M",
  multiple: "3.5×",
  employees: 24,
  founded: 2011,
  sbaEligible: true,
};

const SCORE_BREAKDOWN = [
  { label: "Cash Flow Health", value: 0.87, note: "Recurring B2B contracts, 94% retention" },
  { label: "Capital Stack Fit", value: 0.91, note: "SBA 7(a) eligible, 10% equity injection" },
  { label: "Operational Leverage", value: 0.76, note: "Route density, 3 supervisors in place" },
  { label: "Macro Timing", value: 0.94, note: "Intel campus 4.2mi — anchor demand locked" },
  { label: "Deal Structure", value: 0.82, note: "Seller carry available, 18-month earnout" },
  { label: "Strategic Alignment", value: 0.79, note: "Fragmented market, roll-up optionality" },
];

const TIDE_SIGNALS = [
  { type: "CHIPS Act", amount: "$20B", note: "Intel Ohio fab — 4.2mi from target" },
  { type: "SBA 7(a) Volume", amount: "+34%", note: "Ohio Q1 2026 approval rate surge" },
  { type: "Federal Workforce", amount: "7,000 jobs", note: "Construction phase hiring, 2026–2028" },
];

const IC_VERDICTS = [
  {
    model: "The Quant",
    verdict: "APPROVE",
    score: 0.88,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    note: "DCF at 3.5× yields 22% IRR at 5-year hold. SBA structure reduces equity exposure to $240K.",
  },
  {
    model: "The Skeptic",
    verdict: "APPROVE",
    score: 0.79,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    note: "Key-man risk on owner (sole sales contact). Require 24-month transition clause and non-compete.",
  },
  {
    model: "The Scout",
    verdict: "APPROVE",
    score: 0.91,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    note: "Intel campus creates 10-year demand floor. No comparable competitor within 15mi. First-mover window is now.",
  },
];

const MAIN_STREET_PLAYS = [
  {
    rank: 1,
    title: "Acquire Apex + Expand Intel Contract",
    urgency: "Act Now",
    urgencyColor: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    investment: "$240K equity",
    cashFlow: "$680K/yr",
    stack: "SBA 7(a) $2.16M · Seller carry $240K · Equity $240K",
    description: "Acquire the existing business and immediately pursue the Intel campus janitorial contract. The anchor tenant creates a demand floor that de-risks the acquisition thesis.",
  },
  {
    rank: 2,
    title: "EV Fleet Charging Hub — Licking County",
    urgency: "6-Month Window",
    urgencyColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    investment: "$380K–$520K",
    cashFlow: "$190K/yr",
    stack: "SBA 504 · DOE grant eligible · Equity 10%",
    description: "3 EV chargers within 10mi of the Intel campus. 7,000 construction workers + 3,000 permanent staff create sustained charging demand. First-mover captures fleet contracts.",
  },
];

// ─── Tour steps ───────────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 1,
    chapter: "Step 1 of 4",
    eyebrow: "SIGNAL DETECTED",
    title: "The anchor just filed. Most people won't notice for 6 months.",
    subtitle: "RippleEffect Scanner surfaces anchor developments before they appear in deal flow.",
    icon: Waves,
    iconColor: "text-cyan-400",
    iconBg: "bg-cyan-500/10 border-cyan-500/20",
  },
  {
    id: 2,
    chapter: "Step 2 of 4",
    eyebrow: "DEAL SCORED",
    title: "Six dimensions. One verdict. Before you open the teaser.",
    subtitle: "Signal Hunter OS scores every deal across cash flow, capital stack, macro timing, and four other dimensions — automatically.",
    icon: BarChart3,
    iconColor: "text-[#ffba20]",
    iconBg: "bg-[#ffba20]/10 border-[#ffba20]/20",
  },
  {
    id: 3,
    chapter: "Step 3 of 4",
    eyebrow: "IC CONSENSUS",
    title: "Three independent minds. The disagreements are the point.",
    subtitle: "The Quant, The Skeptic, and The Scout run parallel investment committee reviews. When they diverge, the flag tells you exactly where the risk lives.",
    icon: Cpu,
    iconColor: "text-purple-400",
    iconBg: "bg-purple-500/10 border-purple-500/20",
  },
  {
    id: 4,
    chapter: "Step 4 of 4",
    eyebrow: "MAIN STREET PLAYS",
    title: "The gap is the opportunity. The opportunity is the acquisition.",
    subtitle: "Every anchor development creates infrastructure gaps. Signal Hunter OS surfaces the picks-and-shovels businesses that fill them — ranked by urgency and capital efficiency.",
    icon: Target,
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
  },
];

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ label, value, note }: { label: string; value: number; note: string }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 65 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-[#5c4a32] uppercase tracking-wide">{label}</span>
        <span className={cn("text-xs font-bold tabular-nums", pct >= 80 ? "text-emerald-600" : pct >= 65 ? "text-amber-600" : "text-rose-600")}>
          {pct}
        </span>
      </div>
      <div className="h-1.5 w-full bg-[#e8e0d4] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }}
          className={cn("h-full rounded-full", color)}
        />
      </div>
      <p className="text-[10px] text-[#8b7355] leading-snug">{note}</p>
    </div>
  );
}

// ─── Step content panels ──────────────────────────────────────────────────────

function StepContent({ step }: { step: number }) {
  if (step === 1) {
    return (
      <div className="space-y-4">
        {/* Deal card */}
        <div className="rounded-2xl border border-[#e8e0d4] bg-[#faf8f5] p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2.5">
              <Building2 className="h-4 w-4 text-cyan-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1a1208]">{DEMO_DEAL.name}</h3>
              <div className="flex items-center gap-1 text-xs text-[#8b7355] mt-0.5">
                <MapPin className="h-3 w-3" />{DEMO_DEAL.location}
              </div>
            </div>
            <div className="ml-auto">
              <span className="text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20 rounded-full px-2 py-0.5">
                High Priority
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-[#f2ede6] p-3">
              <div className="text-sm font-bold text-[#1a1208]">{DEMO_DEAL.revenue}</div>
              <div className="text-[10px] text-[#8b7355] uppercase tracking-wide">Revenue</div>
            </div>
            <div className="rounded-lg bg-[#f2ede6] p-3">
              <div className="text-sm font-bold text-[#1a1208]">{DEMO_DEAL.cashFlow}</div>
              <div className="text-[10px] text-[#8b7355] uppercase tracking-wide">Cash Flow</div>
            </div>
            <div className="rounded-lg bg-[#f2ede6] p-3">
              <div className="text-sm font-bold text-[#1a1208]">{DEMO_DEAL.asking}</div>
              <div className="text-[10px] text-[#8b7355] uppercase tracking-wide">Asking</div>
            </div>
          </div>
        </div>

        {/* TIDE signals */}
        <div className="rounded-2xl border border-[#e8e0d4] bg-[#faf8f5] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-3.5 w-3.5 text-cyan-600" />
            <span className="text-xs font-bold text-[#1a1208] uppercase tracking-wide">TIDE Capital Signals</span>
          </div>
          <div className="space-y-2">
            {TIDE_SIGNALS.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-[#f2ede6] px-3 py-2">
                <div>
                  <span className="text-xs font-semibold text-[#1a1208]">{s.type}</span>
                  <span className="text-xs text-[#8b7355] ml-2">{s.note}</span>
                </div>
                <span className="text-xs font-bold text-cyan-700 shrink-0 ml-2">{s.amount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-4">
        {/* Overall score */}
        <div className="rounded-2xl border border-[#ffba20]/30 bg-[#ffba20]/5 p-5 text-center">
          <div className="text-5xl font-black text-[#1a1208] font-['Fraunces',_serif] mb-1">0.847</div>
          <div className="text-xs font-bold text-[#8b7355] uppercase tracking-widest">Composite Score</div>
          <div className="text-xs text-[#5c4a32] mt-1">Top 8% of deals reviewed this quarter</div>
        </div>
        {/* Score breakdown */}
        <div className="rounded-2xl border border-[#e8e0d4] bg-[#faf8f5] p-5 space-y-4">
          {SCORE_BREAKDOWN.map((s) => (
            <ScoreBar key={s.label} label={s.label} value={s.value} note={s.note} />
          ))}
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="space-y-3">
        {IC_VERDICTS.map((v, i) => (
          <motion.div
            key={v.model}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 }}
            className="rounded-2xl border border-[#e8e0d4] bg-[#faf8f5] p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-bold text-[#1a1208]">{v.model}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-bold tabular-nums", v.color)}>
                  {Math.round(v.score * 100)}
                </span>
                <span className={cn("text-[10px] font-bold border rounded-full px-2 py-0.5", v.bg, v.color)}>
                  {v.verdict}
                </span>
              </div>
            </div>
            <p className="text-xs text-[#5c4a32] leading-relaxed">{v.note}</p>
          </motion.div>
        ))}
        {/* Consensus badge */}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div>
            <div className="text-sm font-bold text-[#1a1208]">Unanimous Approval</div>
            <div className="text-xs text-[#5c4a32]">3/3 models approve · Avg score 0.86 · Key risk: key-man dependency</div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="space-y-4">
        {MAIN_STREET_PLAYS.map((play, i) => (
          <motion.div
            key={play.rank}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.15 }}
            className="rounded-2xl border border-[#e8e0d4] bg-[#faf8f5] p-5 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#ffba20] bg-[#ffba20]/10 rounded-full w-5 h-5 flex items-center justify-center">
                  {play.rank}
                </span>
                <span className="text-sm font-bold text-[#1a1208]">{play.title}</span>
              </div>
              <span className={cn("text-[10px] font-bold border rounded-full px-2 py-0.5 shrink-0", play.urgencyColor)}>
                {play.urgency}
              </span>
            </div>
            <p className="text-xs text-[#5c4a32] leading-relaxed">{play.description}</p>
            <div className="flex flex-wrap gap-4">
              <div className="text-xs">
                <span className="text-[#8b7355]">Investment: </span>
                <span className="font-semibold text-[#1a1208]">{play.investment}</span>
              </div>
              <div className="text-xs">
                <span className="text-[#8b7355]">Cash Flow: </span>
                <span className="font-semibold text-emerald-700">{play.cashFlow}</span>
              </div>
            </div>
            <div className="rounded-lg bg-[#f2ede6] px-3 py-2 text-xs text-[#5c4a32]">
              <span className="font-semibold text-[#1a1208]">Stack: </span>{play.stack}
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DemoTour() {
  const [step, setStep] = useState(1);
  const [entered, setEntered] = useState(false);
  const loginUrl = getLoginUrl();

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 80);
    return () => clearTimeout(t);
  }, []);

  const currentStep = STEPS[step - 1];
  const StepIcon = currentStep.icon;
  const isLast = step === STEPS.length;

  return (
    <div
      className={cn(
        "min-h-screen bg-[#faf8f5] text-[#1a1208] transition-opacity duration-700",
        entered ? "opacity-100" : "opacity-0"
      )}
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── Top bar ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#faf8f5]/95 backdrop-blur-sm border-b border-[#e8e0d4]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-[#1a1208] rounded-sm flex items-center justify-center">
              <Radar className="w-3.5 h-3.5 text-[#ffba20]" />
            </div>
            <div>
              <div className="font-['Fraunces',_serif] font-black text-[#1a1208] text-xs leading-none">SIGNAL HUNTER</div>
              <div className="text-[8px] tracking-[0.2em] text-[#8b7355] uppercase leading-none mt-0.5">LIVE DEMO</div>
            </div>
          </div>
          {/* Step progress */}
          <div className="flex items-center gap-2">
            {STEPS.map((s) => (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  step === s.id ? "bg-[#ffba20] w-6" : step > s.id ? "bg-[#1a1208]" : "bg-[#e8e0d4]"
                )}
              />
            ))}
          </div>
          <a
            href={loginUrl}
            className="text-xs font-medium text-[#5c4a32] hover:text-[#1a1208] transition-colors flex items-center gap-1"
          >
            <Lock className="h-3 w-3" />
            Request Access
          </a>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="pt-14 min-h-screen flex flex-col lg:flex-row">
        {/* Left — narrative panel */}
        <div className="lg:w-[420px] lg:min-h-screen lg:sticky lg:top-14 lg:h-[calc(100vh-56px)] bg-[#1a1208] p-8 lg:p-10 flex flex-col justify-between">
          <div>
            {/* Chapter indicator */}
            <div className="flex items-center gap-2 mb-8">
              <div className={cn("rounded-xl border p-2.5", currentStep.iconBg)}>
                <StepIcon className={cn("h-4 w-4", currentStep.iconColor)} />
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-[0.2em] text-[#8b7355] uppercase">{currentStep.chapter}</div>
                <div className="text-[10px] font-bold text-[#ffba20] uppercase tracking-wider">{currentStep.eyebrow}</div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
              >
                <h2 className="font-['Fraunces',_serif] text-2xl lg:text-3xl font-black text-[#faf8f5] leading-tight mb-4">
                  {currentStep.title}
                </h2>
                <p className="text-[#8b7355] text-sm leading-relaxed">
                  {currentStep.subtitle}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Step list */}
            <div className="mt-10 space-y-3">
              {STEPS.map((s) => {
                const SIcon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => setStep(s.id)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200",
                      step === s.id
                        ? "bg-[#ffba20]/10 border border-[#ffba20]/20"
                        : "hover:bg-white/5 border border-transparent"
                    )}
                  >
                    <SIcon className={cn("h-3.5 w-3.5 shrink-0", step === s.id ? s.iconColor : "text-[#5c4a32]")} />
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-xs font-semibold truncate", step === s.id ? "text-[#faf8f5]" : "text-[#5c4a32]")}>
                        {s.eyebrow}
                      </div>
                    </div>
                    {step > s.id && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                    {step === s.id && <ChevronRight className="h-3.5 w-3.5 text-[#ffba20] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="mt-8 pt-6 border-t border-[#3d2e1e]">
            <p className="text-[#5c4a32] text-xs mb-4">
              This is a static walkthrough. The real platform runs live AI analysis on every deal you source.
            </p>
            <a
              href="/#request-access"
              className="flex items-center justify-center gap-2 w-full bg-[#ffba20] text-[#1a1208] font-bold text-sm py-3 rounded-xl hover:bg-[#ffd060] transition-colors"
            >
              <Shield className="h-4 w-4" />
              Request Operator Access
            </a>
          </div>
        </div>

        {/* Right — interactive content */}
        <div className="flex-1 p-6 lg:p-10 lg:overflow-y-auto">
          {/* Deal header */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex-1">
              <div className="text-[10px] font-bold tracking-[0.2em] text-[#8b7355] uppercase mb-1">Demo Deal</div>
              <h1 className="font-['Fraunces',_serif] text-xl font-black text-[#1a1208]">{DEMO_DEAL.name}</h1>
              <div className="flex items-center gap-3 mt-1 text-xs text-[#8b7355]">
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{DEMO_DEAL.location}</span>
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{DEMO_DEAL.employees} employees</span>
                <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{DEMO_DEAL.multiple} multiple</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-[#ffba20]/30 bg-[#ffba20]/5 px-3 py-1.5">
              <Star className="h-3.5 w-3.5 text-[#ffba20] fill-current" />
              <span className="text-xs font-bold text-[#ffba20]">0.847</span>
            </div>
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.3 }}
            >
              <StepContent step={step} />
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
              className="flex items-center gap-2 text-sm font-medium text-[#5c4a32] hover:text-[#1a1208] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>

            {isLast ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/explore"
                  className="flex items-center gap-2 text-sm font-medium text-[#5c4a32] border border-[#e8e0d4] px-5 py-2.5 rounded-xl hover:border-[#1a1208] transition-colors"
                >
                  Browse Deals
                </Link>
                <a
                  href="/#request-access"
                  className="flex items-center gap-2 bg-[#1a1208] text-[#faf8f5] text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-[#3d2e1e] transition-colors"
                >
                  Request Access
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            ) : (
              <button
                onClick={() => setStep(Math.min(STEPS.length, step + 1))}
                className="flex items-center gap-2 bg-[#1a1208] text-[#faf8f5] text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-[#3d2e1e] transition-colors"
              >
                {STEPS[step]?.eyebrow ?? "Next"}
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Watermark */}
          <div className="mt-10 pt-6 border-t border-[#e8e0d4] flex items-center gap-2 text-[#c4b89a]">
            <Lock className="h-3 w-3" />
            <span className="text-[10px] tracking-wide uppercase">Static demo — no live data, no API calls, no account required</span>
          </div>
        </div>
      </div>
    </div>
  );
}
