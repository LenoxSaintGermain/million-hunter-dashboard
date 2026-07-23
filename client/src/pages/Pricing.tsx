import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, TrendingUp, Shield, Zap, Building2, Users, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";

// ─── Data ─────────────────────────────────────────────────────────────────────

const TIERS = [
  {
    id: "scout",
    name: "Scout",
    tagline: "The pre-QoE filter",
    price: 297,
    annual: 2970,
    target: "Solo operators, SBA searchers, first-time acquirers",
    color: "var(--sh-accent)",
    badge: null,
    features: [
      "Up to 10 active deals in pipeline",
      "Full Third Signal analysis per deal",
      "Thesis → IC Review → Red Team → Capital Stack",
      "URL import with Sonar-pro extraction (10/mo)",
      "Investment memo generation",
      "Investor DNA profile",
      "Community access",
    ],
    cta: "Start with Scout",
    anchor: "Pays for itself the first time it saves you from a bad LOI.",
  },
  {
    id: "operator",
    name: "Operator",
    tagline: "Your deal team's second brain",
    price: 697,
    annual: 6970,
    target: "Independent sponsors running 5–15 active deals",
    color: "#c9a96e",
    badge: "Most Popular",
    features: [
      "Everything in Scout",
      "Unlimited active deals",
      "Unlimited URL imports",
      "Seller simulation (negotiation prep)",
      "AI-drafted outreach pipeline",
      "Priority AI processing (no queue)",
      "Slack/email deal alerts",
      "1 investor seat for LP dossier sharing",
    ],
    cta: "Start with Operator",
    anchor: "One avoided dead deal per quarter pays for 12 months.",
  },
  {
    id: "family-office",
    name: "Family Office",
    tagline: "Diligence infrastructure",
    price: 2500,
    annual: 25000,
    target: "Single-family offices, small MFOs, sponsors with LP relationships",
    color: "#8b7355",
    badge: null,
    features: [
      "Everything in Operator",
      "Up to 5 team seats",
      "White-label dossier exports (your branding)",
      "Custom Investor DNA for multiple allocators",
      "Dedicated onboarding + quarterly strategy review",
      "API access for portfolio integration",
      "Priority support (4-hour SLA)",
    ],
    cta: "Talk to us",
    anchor: "Benchmarks against analyst salaries, not SaaS tools.",
  },
  {
    id: "institutional",
    name: "Institutional",
    tagline: "Custom infrastructure",
    price: null,
    annual: null,
    target: "Multi-family offices, RIAs, lower-middle-market PE",
    color: "#5a4a3a",
    badge: null,
    features: [
      "Everything in Family Office",
      "Unlimited seats",
      "Custom AI model configuration",
      "Dedicated instance (data isolation)",
      "Custom CRM / portfolio management integration",
      "Quarterly model recalibration to your thesis",
      "SLA-backed uptime guarantee",
    ],
    cta: "Request a briefing",
    anchor: "Floor: $8,000/month. Scoped to your deal infrastructure.",
  },
];

const COMPETITORS = [
  { name: "DealOrb", category: "SMB Platform", cost: "$1,188–$11,988/yr", does: "Deal sourcing + pipeline", doesnt: "Pre-QoE diligence, Red Team, Capital Stack" },
  { name: "Kumo", category: "Listing Aggregator", cost: "$948–$2,988/yr", does: "On-market listing aggregation", doesnt: "Any analysis layer" },
  { name: "Sourcescrub", category: "LMM Data", cost: "$20,000–$50,000+/yr", does: "Private company coverage", doesnt: "Workflow, diligence, or scoring" },
  { name: "PitchBook", category: "Institutional Data", cost: "$25,000+/yr per seat", does: "Deal history, fund data", doesnt: "SMB coverage, diligence workflow" },
  { name: "4Degrees", category: "Relationship CRM", cost: "$1,500–$3,000/seat/yr", does: "Relationship intelligence", doesnt: "Deal analysis of any kind" },
  { name: "Signal Hunter OS", category: "Diligence Engine", cost: "$2,970–$25,000/yr", does: "Pre-QoE diligence, scoring, Red Team, Capital Stack, Memo/LOI", doesnt: "Nothing in this category" },
];

const PROJECTIONS = [
  {
    year: "Year 1",
    arr: "$612K",
    scout: 120,
    operator: 45,
    familyOffice: 8,
    institutional: 1,
    note: "Organic growth through independent sponsor and ETA searcher communities",
  },
  {
    year: "Year 2",
    arr: "$1.94M",
    scout: 380,
    operator: 140,
    familyOffice: 28,
    institutional: 4,
    note: "Channel partnerships with SBA lenders and M&A advisors",
  },
  {
    year: "Year 3",
    arr: "$4.3M",
    scout: 800,
    operator: 320,
    familyOffice: 65,
    institutional: 10,
    note: "Family office and RIA channel fully activated",
  },
];

// ─── ROI Calculator ────────────────────────────────────────────────────────────

function ROICalculator() {
  const [dealsPerYear, setDealsPerYear] = useState(12);
  const [badDealRate, setBadDealRate] = useState(30);
  const [costPerBadDeal, setCostPerBadDeal] = useState(40000);
  const [tier, setTier] = useState<"scout" | "operator" | "family-office">("operator");

  const tierCost = tier === "scout" ? 2970 : tier === "operator" ? 6970 : 25000;
  const badDealsPerYear = Math.round((dealsPerYear * badDealRate) / 100);
  const costWithoutSignalHunter = badDealsPerYear * costPerBadDeal;
  const netSavings = costWithoutSignalHunter - tierCost;
  const roi = tierCost > 0 ? Math.round((netSavings / tierCost) * 100) : 0;

  return (
    <div className="bg-[var(--sh-card)] border border-[var(--sh-border)] rounded-2xl p-8 space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-[var(--sh-text)]">ROI Calculator</h3>
        <p className="text-sm text-[var(--sh-muted)] mt-1">
          The real question: what does a bad acquisition cost you?
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-[var(--sh-muted)] uppercase tracking-wider">
              Deals screened per year
            </label>
            <div className="flex items-center gap-3 mt-2">
              <input
                type="range" min={4} max={60} step={2} value={dealsPerYear}
                onChange={e => setDealsPerYear(Number(e.target.value))}
                className="flex-1 accent-[var(--sh-accent)]"
              />
              <span className="text-lg font-bold text-[var(--sh-text)] w-8 text-right">{dealsPerYear}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--sh-muted)] uppercase tracking-wider">
              % that fail post-LOI without pre-screening
            </label>
            <div className="flex items-center gap-3 mt-2">
              <input
                type="range" min={10} max={60} step={5} value={badDealRate}
                onChange={e => setBadDealRate(Number(e.target.value))}
                className="flex-1 accent-[var(--sh-accent)]"
              />
              <span className="text-lg font-bold text-[var(--sh-text)] w-10 text-right">{badDealRate}%</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--sh-muted)] uppercase tracking-wider">
              Cost per failed deal (QoE + legal + time)
            </label>
            <div className="flex items-center gap-3 mt-2">
              <input
                type="range" min={15000} max={100000} step={5000} value={costPerBadDeal}
                onChange={e => setCostPerBadDeal(Number(e.target.value))}
                className="flex-1 accent-[var(--sh-accent)]"
              />
              <span className="text-lg font-bold text-[var(--sh-text)] w-20 text-right">
                ${(costPerBadDeal / 1000).toFixed(0)}K
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--sh-muted)] uppercase tracking-wider">
              Plan
            </label>
            <div className="flex gap-2 mt-2">
              {(["scout", "operator", "family-office"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    tier === t
                      ? "bg-[var(--sh-accent)] text-white"
                      : "bg-[var(--sh-bg)] text-[var(--sh-muted)] border border-[var(--sh-border)]"
                  }`}
                >
                  {t === "scout" ? "Scout" : t === "operator" ? "Operator" : "Family Office"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-[var(--sh-bg)] rounded-xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--sh-muted)]">Bad deals per year</span>
              <span className="font-semibold text-[var(--sh-text)]">{badDealsPerYear}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--sh-muted)]">Cost without Signal Hunter</span>
              <span className="font-semibold text-red-500">
                ${costWithoutSignalHunter.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--sh-muted)]">Signal Hunter annual cost</span>
              <span className="font-semibold text-[var(--sh-text)]">${tierCost.toLocaleString()}</span>
            </div>
            <div className="border-t border-[var(--sh-border)] pt-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-[var(--sh-text)]">Net savings</span>
                <span className={`font-bold text-lg ${netSavings > 0 ? "text-emerald-600" : "text-red-500"}`}>
                  ${netSavings.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
            <div className="text-4xl font-black text-emerald-700">{roi > 0 ? `${roi}%` : "—"}</div>
            <div className="text-sm text-emerald-600 font-medium mt-1">Annual ROI</div>
            <div className="text-xs text-emerald-500 mt-2">
              {roi > 0
                ? `Breaks even after ${Math.ceil((tierCost / (costWithoutSignalHunter / 12)))} months`
                : "Adjust sliders to see your ROI"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Projection Bar ────────────────────────────────────────────────────────────

function ProjectionBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="w-full bg-[var(--sh-bg)] rounded-full h-2 overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        whileInView={{ width: `${(value / max) * 100}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        viewport={{ once: true }}
      />
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function Pricing() {
  const [billingAnnual, setBillingAnnual] = useState(true);
  const [activeYear, setActiveYear] = useState(0);
  const [expandedCompetitor, setExpandedCompetitor] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[var(--sh-bg)] text-[var(--sh-text)]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[var(--sh-bg)]/90 backdrop-blur-md border-b border-[var(--sh-border)] px-6 py-4 flex items-center justify-between">
        <Link href="/">
          <span className="font-bold text-[var(--sh-text)] tracking-tight cursor-pointer">
            SIGNAL HUNTER OS
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/walkthrough">
            <span className="text-sm text-[var(--sh-muted)] hover:text-[var(--sh-text)] transition-colors cursor-pointer">
              See how it works
            </span>
          </Link>
          <a href={getLoginUrl()}>
            <Button size="sm" className="bg-[var(--sh-accent)] hover:bg-[var(--sh-accent)]/90 text-white">
              Get access
            </Button>
          </a>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-16 space-y-24">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-6"
        >
          <Badge variant="outline" className="text-[var(--sh-accent)] border-[var(--sh-accent)]/30 bg-[var(--sh-accent)]/5 px-4 py-1.5">
            Monetization & Pricing
          </Badge>
          <h1 className="text-5xl md:text-6xl font-black text-[var(--sh-text)] leading-tight tracking-tight">
            A bad acquisition costs<br />
            <span className="text-[var(--sh-accent)]">$40,000–$80,000.</span>
          </h1>
          <p className="text-xl text-[var(--sh-muted)] max-w-2xl mx-auto leading-relaxed">
            Signal Hunter surfaces the landmine before you spend a dollar on professional diligence.
            This is not a productivity tool. It is a pre-QoE diligence engine — priced accordingly.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <span className={`text-sm font-medium ${!billingAnnual ? "text-[var(--sh-text)]" : "text-[var(--sh-muted)]"}`}>Monthly</span>
            <button
              onClick={() => setBillingAnnual(!billingAnnual)}
              className={`relative w-12 h-6 rounded-full transition-colors ${billingAnnual ? "bg-[var(--sh-accent)]" : "bg-[var(--sh-border)]"}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${billingAnnual ? "translate-x-7" : "translate-x-1"}`} />
            </button>
            <span className={`text-sm font-medium ${billingAnnual ? "text-[var(--sh-text)]" : "text-[var(--sh-muted)]"}`}>
              Annual <span className="text-emerald-600 font-semibold">(2 months free)</span>
            </span>
          </div>
        </motion.div>

        {/* Tier Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true }}
              className={`relative bg-[var(--sh-card)] border rounded-2xl p-6 flex flex-col gap-5 ${
                tier.badge ? "border-[var(--sh-accent)] shadow-lg shadow-[var(--sh-accent)]/10" : "border-[var(--sh-border)]"
              }`}
            >
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-[var(--sh-accent)] text-white text-xs px-3 py-1">{tier.badge}</Badge>
                </div>
              )}

              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-[var(--sh-muted)] mb-1">{tier.name}</div>
                <div className="text-sm text-[var(--sh-text)] font-medium leading-snug">{tier.tagline}</div>
              </div>

              <div>
                {tier.price ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-[var(--sh-text)]">
                      ${billingAnnual ? Math.round((tier.annual ?? 0) / 12).toLocaleString() : tier.price.toLocaleString()}
                    </span>
                    <span className="text-[var(--sh-muted)] text-sm">/mo</span>
                  </div>
                ) : (
                  <div className="text-2xl font-black text-[var(--sh-text)]">Custom</div>
                )}
                {billingAnnual && tier.annual && (
                  <div className="text-xs text-[var(--sh-muted)] mt-1">
                    ${tier.annual.toLocaleString()} billed annually
                  </div>
                )}
              </div>

              <div className="text-xs text-[var(--sh-muted)] leading-relaxed border-l-2 border-[var(--sh-border)] pl-3">
                {tier.target}
              </div>

              <ul className="space-y-2.5 flex-1">
                {tier.features.map((f, fi) => (
                  <li key={fi} className="flex items-start gap-2.5">
                    <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-xs text-[var(--sh-text)] leading-relaxed">{f}</span>
                  </li>
                ))}
              </ul>

              <div className="space-y-3">
                <p className="text-xs text-[var(--sh-muted)] italic leading-relaxed">{tier.anchor}</p>
                <a href={tier.id === "institutional" || tier.id === "family-office" ? "mailto:lenox@signalhunter.io" : getLoginUrl()}>
                  <Button
                    className="w-full text-sm"
                    style={{ backgroundColor: tier.id === "operator" ? "var(--sh-accent)" : undefined }}
                    variant={tier.id === "operator" ? "default" : "outline"}
                  >
                    {tier.cta}
                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </a>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ROI Calculator */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-[var(--sh-text)]">What does a bad deal cost you?</h2>
            <p className="text-[var(--sh-muted)] mt-2">Adjust the sliders to your deal reality.</p>
          </div>
          <ROICalculator />
        </motion.div>

        {/* Competitive Positioning */}
        <div>
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-[var(--sh-text)]">The white space no one else occupies</h2>
            <p className="text-[var(--sh-muted)] mt-2 max-w-xl mx-auto">
              Every other tool in the stack finds deals or tracks relationships. Signal Hunter validates them.
              That is a different category.
            </p>
          </div>

          <div className="space-y-2">
            {COMPETITORS.map((c, i) => (
              <motion.div
                key={c.name}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                viewport={{ once: true }}
                className={`bg-[var(--sh-card)] border rounded-xl overflow-hidden ${
                  c.name === "Signal Hunter OS"
                    ? "border-[var(--sh-accent)] shadow-md shadow-[var(--sh-accent)]/10"
                    : "border-[var(--sh-border)]"
                }`}
              >
                <button
                  className="w-full px-6 py-4 flex items-center justify-between text-left"
                  onClick={() => setExpandedCompetitor(expandedCompetitor === i ? null : i)}
                >
                  <div className="flex items-center gap-4">
                    <span className={`font-semibold text-sm ${c.name === "Signal Hunter OS" ? "text-[var(--sh-accent)]" : "text-[var(--sh-text)]"}`}>
                      {c.name}
                    </span>
                    <Badge variant="outline" className="text-xs text-[var(--sh-muted)]">{c.category}</Badge>
                    <span className="text-xs text-[var(--sh-muted)] hidden md:block">{c.cost}</span>
                  </div>
                  {expandedCompetitor === i ? (
                    <ChevronUp className="h-4 w-4 text-[var(--sh-muted)]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[var(--sh-muted)]" />
                  )}
                </button>
                <AnimatePresence>
                  {expandedCompetitor === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-[var(--sh-border)]">
                        <div className="pt-4">
                          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">Does well</div>
                          <p className="text-sm text-[var(--sh-text)]">{c.does}</p>
                        </div>
                        <div className="pt-4">
                          <div className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2">
                            {c.name === "Signal Hunter OS" ? "Gap it fills" : "Does not do"}
                          </div>
                          <p className={`text-sm ${c.name === "Signal Hunter OS" ? "text-[var(--sh-accent)] font-medium" : "text-[var(--sh-text)]"}`}>
                            {c.doesnt}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Revenue Projections */}
        <div>
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-[var(--sh-text)]">3-Year Revenue Model</h2>
            <p className="text-[var(--sh-muted)] mt-2">
              Conservative ramp. Operator and Family Office tiers drive ARR quality.
              Scout drives volume and word-of-mouth.
            </p>
          </div>

          {/* Year selector */}
          <div className="flex justify-center gap-2 mb-8">
            {PROJECTIONS.map((p, i) => (
              <button
                key={p.year}
                onClick={() => setActiveYear(i)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  activeYear === i
                    ? "bg-[var(--sh-accent)] text-white shadow-md"
                    : "bg-[var(--sh-card)] text-[var(--sh-muted)] border border-[var(--sh-border)]"
                }`}
              >
                {p.year}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeYear}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              className="bg-[var(--sh-card)] border border-[var(--sh-border)] rounded-2xl p-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-[var(--sh-muted)]">
                    {PROJECTIONS[activeYear].year} ARR Target
                  </div>
                  <div className="text-5xl font-black text-[var(--sh-accent)] mt-1">
                    {PROJECTIONS[activeYear].arr}
                  </div>
                  <p className="text-sm text-[var(--sh-muted)] mt-2 max-w-md">
                    {PROJECTIONS[activeYear].note}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 md:gap-6">
                  {[
                    { label: "Scout", value: PROJECTIONS[activeYear].scout, color: "var(--sh-accent)" },
                    { label: "Operator", value: PROJECTIONS[activeYear].operator, color: "#c9a96e" },
                    { label: "Family Office", value: PROJECTIONS[activeYear].familyOffice, color: "#8b7355" },
                    { label: "Institutional", value: PROJECTIONS[activeYear].institutional, color: "#5a4a3a" },
                  ].map(seg => (
                    <div key={seg.label} className="text-center">
                      <div className="text-2xl font-bold text-[var(--sh-text)]">{seg.value}</div>
                      <div className="text-xs text-[var(--sh-muted)]">{seg.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { label: "Scout", value: PROJECTIONS[activeYear].scout, max: 800, color: "var(--sh-accent)" },
                  { label: "Operator", value: PROJECTIONS[activeYear].operator, max: 320, color: "#c9a96e" },
                  { label: "Family Office", value: PROJECTIONS[activeYear].familyOffice, max: 65, color: "#8b7355" },
                  { label: "Institutional", value: PROJECTIONS[activeYear].institutional, max: 10, color: "#5a4a3a" },
                ].map(seg => (
                  <div key={seg.label} className="flex items-center gap-4">
                    <div className="w-28 text-xs text-[var(--sh-muted)] text-right">{seg.label}</div>
                    <div className="flex-1">
                      <ProjectionBar value={seg.value} max={seg.max} color={seg.color} />
                    </div>
                    <div className="w-12 text-xs font-semibold text-[var(--sh-text)] text-right">{seg.value}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Unit Economics */}
        <div>
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-[var(--sh-text)]">Unit Economics</h2>
            <p className="text-[var(--sh-muted)] mt-2">
              High-margin software licensing. AI COGS under 1% of revenue at Operator pricing.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: TrendingUp, label: "Gross Margin (Y3)", value: "85%", sub: "Software-native economics" },
              { icon: Shield, label: "Annual Churn (est.)", value: "8%", sub: "Embedded in deal workflow" },
              { icon: Zap, label: "LTV:CAC (Y3)", value: "21.9×", sub: "Compounding with usage" },
              { icon: Building2, label: "AI COGS / Analysis", value: "<$0.15", sub: "Sonar-pro + 5 agents" },
            ].map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="bg-[var(--sh-card)] border border-[var(--sh-border)] rounded-xl p-5 text-center"
              >
                <m.icon className="h-5 w-5 text-[var(--sh-accent)] mx-auto mb-3" />
                <div className="text-2xl font-black text-[var(--sh-text)]">{m.value}</div>
                <div className="text-xs font-semibold text-[var(--sh-text)] mt-1">{m.label}</div>
                <div className="text-xs text-[var(--sh-muted)] mt-1">{m.sub}</div>
              </motion.div>
            ))}
          </div>
        </div>


        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center space-y-6 py-8"
        >
          <h2 className="text-3xl font-bold text-[var(--sh-text)]">
            The deal of your life is already listed somewhere.
          </h2>
          <p className="text-[var(--sh-muted)] max-w-lg mx-auto">
            Signal Hunter makes sure you don't buy the wrong one first.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href={getLoginUrl()}>
              <Button size="lg" className="bg-[var(--sh-accent)] hover:bg-[var(--sh-accent)]/90 text-white px-8">
                Get access to the live app
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </a>
            <Link href="/walkthrough">
              <Button size="lg" variant="outline" className="px-8">
                See the walkthrough first
              </Button>
            </Link>
          </div>
          <p className="text-xs text-[var(--sh-muted)]">
            No credit card required for Scout tier · Cancel anytime
          </p>
        </motion.div>

      </div>
    </div>
  );
}
