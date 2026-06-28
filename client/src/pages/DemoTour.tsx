import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { cn } from "@/lib/utils";
import {
  Radar, Waves, TrendingUp, ChevronRight, ChevronLeft,
  Lock, Zap, DollarSign, AlertTriangle, XCircle,
  Building2, MapPin, BarChart3, Users, Star,
  ArrowRight, Shield, Cpu, Target, FileWarning,
  CheckCircle2, Circle, AlertOctagon, Flame, Eye,
  TrendingDown, Clock, UserX, FileX, MinusCircle,
} from "lucide-react";

// ─── GT-001 composite deal data — static, no API calls ───────────────────────
// Source: server/fixtures/ground-truth-deals.json GT-001
// Composite anonymized from Acquiring Minds post-mortems. Not a real company.

const GT001 = {
  codename: "Apex Commercial Cleaning",
  industry: "Commercial Cleaning Services",
  location: "Charlotte, NC",
  askingPrice: "$2.1M",
  statedSDE: "$720K",
  statedRevenue: "$1.85M",
  multipleAsked: "2.9×",
  trueSDE: "$497K",
  trueMultiple: "4.2×",
  yearsInBusiness: 11,
  employees: 14,
  brokerTeaser: "Established commercial cleaning company with 11-year track record. Consistent revenue growth. Owner retiring. Strong recurring contract base. SBA pre-qualified.",
  totalBuyerLoss: "$1.76M",
};

// Chapter 1 — Signal Detected
const RIPPLE_SIGNAL = {
  headline: "Charlotte MSA: 3 new commercial office park permits filed — Ballantyne submarket",
  anchorType: "Commercial Real Estate",
  confidence: 0.87,
  timeAgo: "6 hours ago",
  detail: "3 office park permits totaling 480,000 sq ft filed with Mecklenburg County. Construction phase: 18 months. Estimated 2,400 permanent office workers at buildout.",
  gapSignal: "Commercial cleaning demand gap: ~$1.1M/yr in new janitorial contracts entering the market within 24 months.",
  dealFound: "RippleEffect surfaced 1 existing commercial cleaning business within 8mi of anchor development.",
};

// Chapter 2 — Deal Scored
const SCORE_BREAKDOWN = [
  { label: "Cash Flow Health", value: 0.81, note: "Recurring B2B contracts — but add-back analysis pending" },
  { label: "Capital Stack Fit", value: 0.88, note: "SBA 7(a) eligible, 10% equity injection at stated price" },
  { label: "Macro Timing", value: 0.91, note: "Ballantyne anchor — 8mi proximity, demand floor locked" },
  { label: "Operational Leverage", value: 0.62, note: "14 employees, no supervisors — owner-run flag" },
  { label: "Customer Diversification", value: 0.44, note: "Revenue concentration analysis required" },
  { label: "Deal Structure", value: 0.74, note: "Seller carry available, 6-month transition offered" },
];

// Chapter 3 — Red Team Fires
const RED_TEAM_FLAGS = [
  {
    id: "RT-001",
    category: "Customer Concentration",
    severity: "critical" as const,
    flag: "Top 2 clients = 54% of revenue",
    detail: "Client A (regional hospital): $512K/yr, 28% of revenue. Client B (office park co): $484K/yr, 26% of revenue. Both relationships are personal to the owner.",
    detection: "Revenue-by-customer schedule — standard diligence request",
    icon: AlertOctagon,
  },
  {
    id: "RT-002",
    category: "Customer Concentration",
    severity: "critical" as const,
    flag: "Hospital contract up for rebid in 14 months",
    detail: "Client A's MSA expires 14 months post-close. No auto-renewal. Hospital procurement policy requires competitive rebid above $400K/yr.",
    detection: "Contract review — request all customer agreements with term dates",
    icon: Clock,
  },
  {
    id: "RT-003",
    category: "Owner Dependence",
    severity: "critical" as const,
    flag: "Client B is a verbal month-to-month handshake",
    detail: "$484K/yr with zero contractual protection. Client B's property manager has been a personal friend of the owner for 9 years. No written agreement.",
    detection: "Contract review reveals no written agreement; customer reference call confirms personal relationship",
    icon: FileX,
  },
  {
    id: "RT-004",
    category: "Financial Quality",
    severity: "critical" as const,
    flag: "Add-backs inflate SDE by 31% — true earnings are $497K",
    detail: "$223K in add-backs: $85K owner salary above market, $62K personal vehicle fleet, $41K family 'consulting' payments, $35K one-time equipment write-off claimed as recurring. Real multiple: 4.2×, not 2.9×.",
    detection: "Quality of Earnings analysis — normalized SDE drops to ~$497K",
    icon: TrendingDown,
  },
  {
    id: "RT-005",
    category: "Owner Dependence",
    severity: "high" as const,
    flag: "Owner works 55–60 hrs/week — zero management layer",
    detail: "Owner handles all sales, all client relationships, all hiring/firing, and covers shifts when workers call out. No operations manager. No CRM. No SOPs.",
    detection: "Owner time audit + employee reference checks",
    icon: UserX,
  },
];

// Chapter 4 — IC Consensus
const IC_VOTES = [
  {
    model: "Claude",
    role: "The Structuralist",
    vote: "NO" as const,
    confidence: 0.91,
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/20",
    rationale: "The customer concentration pattern here is not a negotiable risk — it is a structural defect. Two relationships that are personal to the seller represent 54% of revenue. No earnout structure adequately protects against this because the risk materializes after the earnout measurement period. The QoE gap alone ($223K in questionable add-backs) warrants a full stop pending independent verification. I would not proceed at any price above $1.1M without written contracts from both concentration clients and a verified QoE.",
  },
  {
    model: "Gemini",
    role: "The Restructurer",
    vote: "NO — RESTRUCTURE REQUIRED" as const,
    confidence: 0.87,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    rationale: "The business has real underlying value — 11 years of operation, established client relationships, recurring revenue model. The problem is entirely structural: the value is trapped in the owner's personal relationships and not transferable at the stated price. A restructured deal at $1.2–1.4M with 35–40% earnout tied to 24-month client retention, combined with an 18-month owner transition agreement, could work. At $2.1M with a standard 6-month transition, this deal has a high probability of failure.",
  },
  {
    model: "Sonar",
    role: "The Market Analyst",
    vote: "NO" as const,
    confidence: 0.89,
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/20",
    rationale: "Market data supports the concern: commercial cleaning businesses with >40% customer concentration in owner-personal relationships trade at 1.8–2.2× SDE, not 2.9×. The hospital contract rebid risk alone — a binary $512K/yr revenue event 14 months post-close — is unacceptable without contractual protection. Current market has multiple comparable businesses at 2.2–2.5× with diversified client bases. The opportunity cost of this deal is high.",
  },
];

// Chapter 5 — Main Street Play
const MAIN_STREET_PLAY = {
  title: "Piedmont Commercial Cleaning — Concord, NC",
  distance: "22mi from Ballantyne anchor",
  asking: "$1.4M",
  sde: "$510K",
  multiple: "2.7×",
  clients: "31 clients — largest is 11% of revenue",
  contract: "All clients on written annual contracts",
  owner: "Operations manager in place — owner works 20 hrs/week",
  stack: "SBA 7(a) $1.26M · Seller carry $140K · Equity $140K",
  urgency: "Act within 60 days",
  whyBetter: [
    "No single client above 11% of revenue — concentration risk eliminated",
    "All contracts written, all auto-renewing — no rebid cliffs",
    "Operations manager already in seat — owner is not the business",
    "True SDE verified at $510K — no add-back games",
    "2.7× multiple on real earnings vs. 4.2× on inflated Apex numbers",
  ],
};

// ─── Tour chapters ────────────────────────────────────────────────────────────

const CHAPTERS = [
  {
    id: 1,
    label: "Signal Detected",
    eyebrow: "RIPPLEEFFECT SCANNER",
    title: "The anchor filed. Most buyers won't see the opportunity for 6 months.",
    subtitle: "RippleEffect surfaces anchor developments — permits, EDC announcements, workforce filings — before they appear in deal flow. Then it finds the businesses that will benefit.",
    icon: Waves,
    iconColor: "text-cyan-400",
    iconBg: "bg-cyan-500/10 border-cyan-500/20",
  },
  {
    id: 2,
    label: "Deal Scored",
    eyebrow: "TIDE INTELLIGENCE",
    title: "The broker sheet looked clean. Six dimensions told a different story.",
    subtitle: "Signal Hunter OS scores every deal across cash flow, capital stack, macro timing, and three other dimensions. Two flags were already amber before diligence opened.",
    icon: BarChart3,
    iconColor: "text-[#ffba20]",
    iconBg: "bg-[#ffba20]/10 border-[#ffba20]/20",
  },
  {
    id: 3,
    label: "Red Team Fires",
    eyebrow: "RED TEAM ANALYSIS",
    title: "Five flags. Four critical. The deal was dead before the LOI.",
    subtitle: "Red Team runs adversarial diligence on every deal — not to find reasons to buy, but to find the reasons deals fail. This one had all three of the most common failure modes.",
    icon: FileWarning,
    iconColor: "text-rose-400",
    iconBg: "bg-rose-500/10 border-rose-500/20",
  },
  {
    id: 4,
    label: "IC Votes",
    eyebrow: "IC CONSENSUS",
    title: "Three models. Unanimous NO. The dissent is where the value lives.",
    subtitle: "Claude, Gemini, and Sonar run independent investment committee reviews. When they agree, the signal is strong. When they diverge, the flag tells you exactly where the risk lives.",
    icon: Cpu,
    iconColor: "text-purple-400",
    iconBg: "bg-purple-500/10 border-purple-500/20",
  },
  {
    id: 5,
    label: "Better Play Found",
    eyebrow: "MAIN STREET PLAY",
    title: "The scanner found a better deal 22 miles away. Same thesis. Half the risk.",
    subtitle: "Rejecting Apex wasn't the end of the search — it was the beginning of a better one. The same anchor development that surfaced Apex also surfaced a cleaner target with verified earnings and no concentration risk.",
    icon: Target,
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfidenceBar({ value, color = "bg-[#ffba20]" }: { value: number; color?: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-[#3d2e1e] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={cn("h-full rounded-full", color)}
        />
      </div>
      <span className="text-[10px] font-bold tabular-nums text-[#8b7355] w-7 text-right">{pct}%</span>
    </div>
  );
}

function ScoreBar({ label, value, note }: { label: string; value: number; note: string }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-rose-500";
  const textColor = pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-amber-600" : "text-rose-600";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-[#5c4a32] uppercase tracking-wide">{label}</span>
        <span className={cn("text-xs font-bold tabular-nums", textColor)}>{pct}</span>
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

const SEVERITY_STYLES = {
  critical: {
    badge: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    border: "border-rose-500/20",
    bg: "bg-rose-500/5",
    icon: "text-rose-500",
  },
  high: {
    badge: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    border: "border-amber-500/20",
    bg: "bg-amber-500/5",
    icon: "text-amber-500",
  },
};

// ─── Chapter content panels ───────────────────────────────────────────────────

function ChapterContent({ chapter }: { chapter: number }) {

  // Chapter 1 — Signal Detected
  if (chapter === 1) {
    return (
      <div className="space-y-4">
        {/* Anchor signal card */}
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2.5 shrink-0">
              <Waves className="h-4 w-4 text-cyan-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-bold tracking-[0.15em] text-cyan-700 uppercase">Anchor Development</span>
                <span className="text-[9px] text-[#8b7355]">{RIPPLE_SIGNAL.timeAgo}</span>
              </div>
              <p className="text-sm font-semibold text-[#1a1208] leading-snug">{RIPPLE_SIGNAL.headline}</p>
            </div>
          </div>
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#8b7355]">Signal confidence</span>
              <span className="font-bold text-cyan-700">{Math.round(RIPPLE_SIGNAL.confidence * 100)}%</span>
            </div>
            <ConfidenceBar value={RIPPLE_SIGNAL.confidence} color="bg-cyan-500" />
          </div>
          <p className="text-xs text-[#5c4a32] leading-relaxed">{RIPPLE_SIGNAL.detail}</p>
        </div>

        {/* Gap signal */}
        <div className="rounded-2xl border border-[#e8e0d4] bg-[#faf8f5] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-3.5 w-3.5 text-[#ffba20]" />
            <span className="text-xs font-bold text-[#1a1208] uppercase tracking-wide">Gap Signal Detected</span>
          </div>
          <p className="text-sm text-[#1a1208] font-medium leading-snug mb-3">{RIPPLE_SIGNAL.gapSignal}</p>
          <div className="rounded-xl bg-[#f2ede6] p-3 flex items-center gap-3">
            <Building2 className="h-4 w-4 text-[#ffba20] shrink-0" />
            <p className="text-xs text-[#5c4a32]">{RIPPLE_SIGNAL.dealFound}</p>
          </div>
        </div>

        {/* Demo watermark */}
        <div className="flex items-center gap-2 text-[#c4b89a]">
          <Eye className="h-3 w-3" />
          <span className="text-[10px] tracking-wide uppercase">Demo Mode — Composite signal, not a real filing</span>
        </div>
      </div>
    );
  }

  // Chapter 2 — Deal Scored
  if (chapter === 2) {
    return (
      <div className="space-y-4">
        {/* Deal header */}
        <div className="rounded-2xl border border-[#e8e0d4] bg-[#faf8f5] p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="rounded-xl border border-[#e8e0d4] bg-[#f2ede6] p-2.5 shrink-0">
              <Building2 className="h-4 w-4 text-[#5c4a32]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1a1208]">{GT001.codename}</h3>
              <div className="flex items-center gap-1 text-xs text-[#8b7355] mt-0.5">
                <MapPin className="h-3 w-3" />{GT001.location}
              </div>
            </div>
            <div className="ml-auto shrink-0">
              <span className="text-[10px] font-bold bg-[#ffba20]/10 text-[#b8860b] border border-[#ffba20]/30 rounded-full px-2 py-0.5">
                Broker Teaser
              </span>
            </div>
          </div>
          <p className="text-xs text-[#5c4a32] italic leading-relaxed mb-4">"{GT001.brokerTeaser}"</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-[#f2ede6] p-3">
              <div className="text-sm font-bold text-[#1a1208]">{GT001.statedRevenue}</div>
              <div className="text-[10px] text-[#8b7355] uppercase tracking-wide">Revenue</div>
            </div>
            <div className="rounded-lg bg-[#f2ede6] p-3">
              <div className="text-sm font-bold text-[#1a1208]">{GT001.statedSDE}</div>
              <div className="text-[10px] text-[#8b7355] uppercase tracking-wide">Stated SDE</div>
            </div>
            <div className="rounded-lg bg-[#f2ede6] p-3">
              <div className="text-sm font-bold text-[#1a1208]">{GT001.askingPrice}</div>
              <div className="text-[10px] text-[#8b7355] uppercase tracking-wide">Asking</div>
            </div>
          </div>
        </div>

        {/* Score breakdown */}
        <div className="rounded-2xl border border-[#e8e0d4] bg-[#faf8f5] p-5 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-[#1a1208] uppercase tracking-wide">6-Dimension Score</span>
            <span className="text-xs font-bold text-amber-600">2 flags amber</span>
          </div>
          {SCORE_BREAKDOWN.map((s) => (
            <ScoreBar key={s.label} label={s.label} value={s.value} note={s.note} />
          ))}
        </div>

        <div className="flex items-center gap-2 text-[#c4b89a]">
          <Eye className="h-3 w-3" />
          <span className="text-[10px] tracking-wide uppercase">Demo Mode — Scores derived from GT-001 composite deal</span>
        </div>
      </div>
    );
  }

  // Chapter 3 — Red Team Fires
  if (chapter === 3) {
    return (
      <div className="space-y-3">
        {/* Summary bar */}
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 flex items-center gap-3">
          <AlertOctagon className="h-5 w-5 text-rose-500 shrink-0" />
          <div>
            <div className="text-sm font-bold text-[#1a1208]">5 flags raised — 4 critical</div>
            <div className="text-xs text-[#5c4a32]">Customer concentration · Owner dependence · Add-back inflation</div>
          </div>
        </div>

        {/* Flags */}
        {RED_TEAM_FLAGS.map((flag, i) => {
          const styles = SEVERITY_STYLES[flag.severity];
          const FlagIcon = flag.icon;
          return (
            <motion.div
              key={flag.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={cn("rounded-2xl border p-4 space-y-2", styles.border, styles.bg)}
            >
              <div className="flex items-start gap-2">
                <FlagIcon className={cn("h-4 w-4 shrink-0 mt-0.5", styles.icon)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={cn("text-[9px] font-bold border rounded-full px-2 py-0.5 uppercase tracking-wide", styles.badge)}>
                      {flag.severity}
                    </span>
                    <span className="text-[10px] text-[#8b7355] uppercase tracking-wide">{flag.category}</span>
                  </div>
                  <p className="text-xs font-semibold text-[#1a1208]">{flag.flag}</p>
                </div>
              </div>
              <p className="text-xs text-[#5c4a32] leading-relaxed pl-6">{flag.detail}</p>
              <div className="pl-6 flex items-center gap-1.5">
                <Eye className="h-3 w-3 text-[#8b7355]" />
                <span className="text-[10px] text-[#8b7355] italic">{flag.detection}</span>
              </div>
            </motion.div>
          );
        })}

        <div className="flex items-center gap-2 text-[#c4b89a]">
          <Eye className="h-3 w-3" />
          <span className="text-[10px] tracking-wide uppercase">Demo Mode — Flags from GT-001 composite deal</span>
        </div>
      </div>
    );
  }

  // Chapter 4 — IC Consensus
  if (chapter === 4) {
    return (
      <div className="space-y-3">
        {IC_VOTES.map((v, i) => (
          <motion.div
            key={v.model}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.15 }}
            className="rounded-2xl border border-[#e8e0d4] bg-[#faf8f5] p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-purple-500" />
                <div>
                  <span className="text-sm font-bold text-[#1a1208]">{v.model}</span>
                  <span className="text-xs text-[#8b7355] ml-2">{v.role}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn("text-[10px] font-bold border rounded-full px-2 py-0.5", v.bg, v.color)}>
                  {v.vote}
                </span>
              </div>
            </div>
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[#8b7355]">Confidence</span>
                <span className={cn("font-bold", v.color)}>{Math.round(v.confidence * 100)}%</span>
              </div>
              <ConfidenceBar
                value={v.confidence}
                color={v.vote === "NO — RESTRUCTURE REQUIRED" ? "bg-amber-500" : "bg-rose-500"}
              />
            </div>
            <p className="text-xs text-[#5c4a32] leading-relaxed">{v.rationale}</p>
          </motion.div>
        ))}

        {/* Consensus badge */}
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 flex items-start gap-3">
          <XCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-[#1a1208]">Unanimous NO at current terms</div>
            <div className="text-xs text-[#5c4a32] mt-1">
              Claude and Sonar: hard stop. Gemini: conditional path at $1.2–1.4M with earnout + 18-month transition.
              All three agree: at $2.1M with a 6-month transition, this deal fails.
            </div>
          </div>
        </div>

        {/* Conditional path */}
        <div className="rounded-2xl border border-[#e8e0d4] bg-[#faf8f5] p-4">
          <div className="text-xs font-bold text-[#1a1208] uppercase tracking-wide mb-2">Conditional Restructure Path</div>
          <div className="space-y-1.5 text-xs text-[#5c4a32]">
            {[
              "Price at $1.2M max on true SDE ($497K)",
              "40% earnout tied to Client A + Client B retention at 24 months",
              "Owner employment agreement minimum 18 months",
              "Hospital contract renewal as closing condition",
              "Written contract with Client B as closing condition",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <MinusCircle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[#c4b89a]">
          <Eye className="h-3 w-3" />
          <span className="text-[10px] tracking-wide uppercase">Demo Mode — IC votes from GT-001 composite deal</span>
        </div>
      </div>
    );
  }

  // Chapter 5 — Main Street Play
  if (chapter === 5) {
    return (
      <div className="space-y-4">
        {/* Rejected deal tombstone */}
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 flex items-center gap-3">
          <XCircle className="h-5 w-5 text-rose-500 shrink-0" />
          <div>
            <div className="text-xs font-bold text-rose-700 line-through">{GT001.codename} — {GT001.askingPrice}</div>
            <div className="text-[10px] text-[#8b7355] mt-0.5">Rejected · True multiple 4.2× · Estimated buyer loss if closed: {GT001.totalBuyerLoss}</div>
          </div>
        </div>

        {/* Better play card */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2 shrink-0">
              <Target className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <div className="text-[9px] font-bold tracking-[0.15em] text-emerald-700 uppercase">Scanner Found — Same Thesis</div>
              <h3 className="text-sm font-bold text-[#1a1208]">{MAIN_STREET_PLAY.title}</h3>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-[#8b7355] mb-4">
            <MapPin className="h-3 w-3" />
            {MAIN_STREET_PLAY.distance}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center mb-4">
            <div className="rounded-lg bg-[#f2ede6] p-3">
              <div className="text-sm font-bold text-[#1a1208]">{MAIN_STREET_PLAY.asking}</div>
              <div className="text-[10px] text-[#8b7355] uppercase tracking-wide">Asking</div>
            </div>
            <div className="rounded-lg bg-[#f2ede6] p-3">
              <div className="text-sm font-bold text-emerald-700">{MAIN_STREET_PLAY.sde}</div>
              <div className="text-[10px] text-[#8b7355] uppercase tracking-wide">True SDE</div>
            </div>
            <div className="rounded-lg bg-[#f2ede6] p-3">
              <div className="text-sm font-bold text-[#1a1208]">{MAIN_STREET_PLAY.multiple}</div>
              <div className="text-[10px] text-[#8b7355] uppercase tracking-wide">Multiple</div>
            </div>
          </div>

          <div className="space-y-1.5 mb-4">
            {MAIN_STREET_PLAY.whyBetter.map((reason, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-[#5c4a32]">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>{reason}</span>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-[#f2ede6] px-3 py-2.5 text-xs">
            <span className="font-semibold text-[#1a1208]">Capital stack: </span>
            <span className="text-[#5c4a32]">{MAIN_STREET_PLAY.stack}</span>
          </div>
        </div>

        {/* Urgency */}
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-3">
          <Flame className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="text-xs text-[#5c4a32]">
            <span className="font-bold text-[#1a1208]">{MAIN_STREET_PLAY.urgency} — </span>
            Ballantyne anchor development creates a demand floor for both targets. The window for acquiring at pre-anchor pricing is closing.
          </div>
        </div>

        <div className="flex items-center gap-2 text-[#c4b89a]">
          <Eye className="h-3 w-3" />
          <span className="text-[10px] tracking-wide uppercase">Demo Mode — Composite alternative target, not a real listing</span>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DemoTour() {
  const [chapter, setChapter] = useState(1);
  const [entered, setEntered] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const loginUrl = getLoginUrl();

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Scroll content panel to top on chapter change
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [chapter]);

  const current = CHAPTERS[chapter - 1];
  const ChapterIcon = current.icon;
  const isLast = chapter === CHAPTERS.length;
  const isFirst = chapter === 1;

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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-6 h-6 bg-[#1a1208] rounded-sm flex items-center justify-center">
              <Radar className="w-3.5 h-3.5 text-[#ffba20]" />
            </div>
            <div className="hidden sm:block">
              <div className="font-['Fraunces',_serif] font-black text-[#1a1208] text-xs leading-none">SIGNAL HUNTER</div>
              <div className="text-[8px] tracking-[0.2em] text-[#8b7355] uppercase leading-none mt-0.5">DEMO MODE</div>
            </div>
          </div>

          {/* Chapter progress dots */}
          <div className="flex items-center gap-1.5">
            {CHAPTERS.map((c) => (
              <button
                key={c.id}
                onClick={() => setChapter(c.id)}
                title={c.label}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  chapter === c.id
                    ? "bg-[#ffba20] w-6"
                    : chapter > c.id
                    ? "bg-[#1a1208] w-2"
                    : "bg-[#e8e0d4] w-2"
                )}
              />
            ))}
          </div>

          {/* CTA */}
          <a
            href={loginUrl}
            className="shrink-0 text-xs font-semibold text-[#faf8f5] bg-[#1a1208] hover:bg-[#3d2e1e] transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
          >
            <Lock className="h-3 w-3" />
            <span className="hidden sm:inline">Request Access</span>
            <span className="sm:hidden">Access</span>
          </a>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="pt-14 min-h-screen flex flex-col lg:flex-row">

        {/* ── Left — narrative panel (dark) ── */}
        <div className="lg:w-[400px] xl:w-[440px] lg:min-h-screen lg:sticky lg:top-14 lg:h-[calc(100vh-56px)] bg-[#1a1208] p-6 lg:p-8 xl:p-10 flex flex-col justify-between">
          <div>
            {/* Chapter indicator */}
            <div className="flex items-center gap-2.5 mb-7">
              <div className={cn("rounded-xl border p-2.5 shrink-0", current.iconBg)}>
                <ChapterIcon className={cn("h-4 w-4", current.iconColor)} />
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-[0.2em] text-[#5c4a32] uppercase">
                  Chapter {chapter} of {CHAPTERS.length}
                </div>
                <div className="text-[10px] font-bold text-[#ffba20] uppercase tracking-wider">{current.eyebrow}</div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={chapter}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
              >
                <h2 className="font-['Fraunces',_serif] text-2xl xl:text-3xl font-black text-[#faf8f5] leading-tight mb-4">
                  {current.title}
                </h2>
                <p className="text-[#8b7355] text-sm leading-relaxed">
                  {current.subtitle}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Chapter nav list */}
            <div className="mt-8 space-y-1.5">
              {CHAPTERS.map((c) => {
                const CIcon = c.icon;
                return (
                  <button
                    key={c.id}
                    onClick={() => setChapter(c.id)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200",
                      chapter === c.id
                        ? "bg-[#ffba20]/10 border border-[#ffba20]/20"
                        : "hover:bg-white/5 border border-transparent"
                    )}
                  >
                    <CIcon className={cn("h-3.5 w-3.5 shrink-0", chapter === c.id ? c.iconColor : "text-[#5c4a32]")} />
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        "text-xs font-semibold truncate",
                        chapter === c.id ? "text-[#faf8f5]" : "text-[#5c4a32]"
                      )}>
                        {c.label}
                      </div>
                    </div>
                    {chapter > c.id && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                    {chapter === c.id && <ChevronRight className="h-3.5 w-3.5 text-[#ffba20] shrink-0" />}
                    {chapter < c.id && <Circle className="h-3.5 w-3.5 text-[#3d2e1e] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="mt-8 pt-6 border-t border-[#3d2e1e]">
            <p className="text-[#5c4a32] text-xs mb-4 leading-relaxed">
              This is a static walkthrough using a composite deal from documented acquisition failures.
              The real platform runs live AI analysis on every deal you source.
            </p>
            <a
              href={loginUrl}
              className="flex items-center justify-center gap-2 w-full bg-[#ffba20] text-[#1a1208] font-bold text-sm py-3 rounded-xl hover:bg-[#ffd060] transition-colors"
            >
              <Shield className="h-4 w-4" />
              Run This on a Real Deal
            </a>
          </div>
        </div>

        {/* ── Right — interactive content ── */}
        <div
          ref={contentRef}
          className="flex-1 p-5 sm:p-6 lg:p-8 xl:p-10 lg:overflow-y-auto lg:h-[calc(100vh-56px)] lg:sticky lg:top-14"
        >
          {/* Deal identity header */}
          <div className="mb-5 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold tracking-[0.2em] text-[#8b7355] uppercase mb-1">
                GT-001 · Composite Deal
              </div>
              <h1 className="font-['Fraunces',_serif] text-lg sm:text-xl font-black text-[#1a1208] leading-tight">
                {GT001.codename}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-[#8b7355]">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />{GT001.location}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />{GT001.employees} employees
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />{GT001.yearsInBusiness} yrs in business
                </span>
              </div>
            </div>
            {/* Outcome badge — shown from chapter 3 onward */}
            {chapter >= 3 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="shrink-0 flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/5 px-3 py-1.5"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                <span className="text-xs font-bold text-rose-600">DO NOT PROCEED</span>
              </motion.div>
            )}
            {chapter < 3 && (
              <div className="shrink-0 flex items-center gap-1.5 rounded-full border border-[#ffba20]/30 bg-[#ffba20]/5 px-3 py-1.5">
                <Star className="h-3.5 w-3.5 text-[#ffba20] fill-current" />
                <span className="text-xs font-bold text-[#b8860b]">{GT001.multipleAsked}</span>
              </div>
            )}
          </div>

          {/* Chapter content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={chapter}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.3 }}
            >
              <ChapterContent chapter={chapter} />
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => setChapter(Math.max(1, chapter - 1))}
              disabled={isFirst}
              className="flex items-center gap-2 text-sm font-medium text-[#5c4a32] hover:text-[#1a1208] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>

            {isLast ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <Link
                  href="/"
                  className="flex items-center gap-2 text-sm font-medium text-[#5c4a32] border border-[#e8e0d4] px-4 py-2.5 rounded-xl hover:border-[#1a1208] transition-colors"
                >
                  Back to Home
                </Link>
                <a
                  href={loginUrl}
                  className="flex items-center gap-2 bg-[#1a1208] text-[#faf8f5] text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#3d2e1e] transition-colors"
                >
                  Run a Real Deal
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            ) : (
              <button
                onClick={() => setChapter(Math.min(CHAPTERS.length, chapter + 1))}
                className="flex items-center gap-2 bg-[#1a1208] text-[#faf8f5] text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#3d2e1e] transition-colors"
              >
                {CHAPTERS[chapter]?.label ?? "Next"}
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Footer watermark */}
          <div className="mt-8 pt-5 border-t border-[#e8e0d4] flex items-center gap-2 text-[#c4b89a]">
            <Lock className="h-3 w-3" />
            <span className="text-[10px] tracking-wide uppercase">
              Static demo · No live data · No API calls · No account required · GT-001 composite deal
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
