import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ─── DNA Strand Visualization ─────────────────────────────────────────────────
function DnaStrand({ scores }: { scores: { timeHorizon: number; riskTolerance: number; liquidityNeed: number; esgConviction: number } }) {
  const strands = [
    { label: "Time Horizon", value: scores.timeHorizon, color: "var(--sh-signal)" },
    { label: "Risk Tolerance", value: scores.riskTolerance, color: "var(--sh-amber)" },
    { label: "Liquidity Need", value: 1 - scores.liquidityNeed, color: "var(--sh-red)" },
    { label: "ESG Conviction", value: scores.esgConviction, color: "#a78bfa" },
  ];

  return (
    <div className="space-y-3">
      {strands.map((s) => (
        <div key={s.label} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span style={{ color: "var(--sh-text-secondary)" }}>{s.label}</span>
            <span style={{ color: s.color, fontFamily: "var(--font-mono)" }}>{Math.round(s.value * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--sh-surface-2)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${s.value * 100}%`, background: s.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Archetype Card ────────────────────────────────────────────────────────────
const ARCHETYPE_DESCRIPTIONS: Record<string, { tagline: string; description: string; traits: string[] }> = {
  "ALPHA-7": {
    tagline: "You hunt asymmetric returns.",
    description: "High conviction, long horizon, high risk tolerance. You see deals others miss and move fast when the signal is clear.",
    traits: ["Concentrated positions", "Operator-friendly", "5-10 year holds"],
  },
  "IMPACT-4": {
    tagline: "Returns with a reason.",
    description: "You want your capital to compound AND create change. You prioritize businesses that build community wealth alongside financial returns.",
    traits: ["ESG-aligned deals", "Community impact", "Patient capital"],
  },
  "COMPOUNDER-9": {
    tagline: "Slow money, deep roots.",
    description: "You think in decades. You lock capital into durable cash-flowing businesses and let compounding do the work.",
    traits: ["Long-duration holds", "Cash flow focus", "Low turnover"],
  },
  "SPRINT-3": {
    tagline: "Fast in, faster out.",
    description: "You want velocity. Short holds, clear exits, and a deal flow that keeps your capital working without waiting.",
    traits: ["2-3 year exits", "High IRR focus", "Active portfolio management"],
  },
  "ANCHOR-1": {
    tagline: "Steady, reliable, compounding.",
    description: "You value stability over excitement. You want predictable cash flow from proven businesses with low operational risk.",
    traits: ["Stable cash flow", "Low volatility", "Diversified exposure"],
  },
};

// ─── Quiz Steps ───────────────────────────────────────────────────────────────
const SECTORS = [
  "Commercial Services", "Logistics & Distribution", "Healthcare Services",
  "Government Contracting", "Technology Services", "Food & Beverage",
  "Real Estate Services", "Environmental Services", "Education", "Manufacturing",
];

interface QuizState {
  timeHorizon: number;
  riskTolerance: number;
  liquidityNeed: number;
  esgConviction: number;
  sectorAffinity: string[];
}

const INITIAL_STATE: QuizState = {
  timeHorizon: 0.5,
  riskTolerance: 0.5,
  liquidityNeed: 0.5,
  esgConviction: 0.5,
  sectorAffinity: [],
};

function SliderQuestion({
  question,
  leftLabel,
  rightLabel,
  value,
  onChange,
}: {
  question: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-6">
      <p className="text-lg font-medium" style={{ color: "var(--sh-text-primary)", fontFamily: "var(--font-display)" }}>
        {question}
      </p>
      <div className="space-y-4">
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(value * 100)}
          onChange={(e) => onChange(parseInt(e.target.value) / 100)}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, var(--sh-signal) 0%, var(--sh-signal) ${value * 100}%, var(--sh-surface-2) ${value * 100}%, var(--sh-surface-2) 100%)`,
            accentColor: "var(--sh-signal)",
          }}
        />
        <div className="flex justify-between text-xs" style={{ color: "var(--sh-text-secondary)" }}>
          <span>{leftLabel}</span>
          <span style={{ color: "var(--sh-signal)", fontFamily: "var(--font-mono)" }}>{Math.round(value * 100)}%</span>
          <span>{rightLabel}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function InvestorOnboarding() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [quiz, setQuiz] = useState<QuizState>(INITIAL_STATE);
  const [archetype, setArchetype] = useState<{ code: string; label: string } | null>(null);

  const saveDna = trpc.investor.saveDna.useMutation({
    onSuccess: (data) => {
      setArchetype({ code: data.archetypeCode, label: data.archetypeLabel });
      setStep(5); // Archetype reveal
    },
    onError: () => toast.error("Failed to save your profile. Please try again."),
  });

  const steps = [
    // Step 0: Welcome
    null,
    // Step 1: Time Horizon
    <SliderQuestion
      key="time"
      question="How long are you comfortable holding an investment before expecting returns?"
      leftLabel="12–18 months"
      rightLabel="5–10 years"
      value={quiz.timeHorizon}
      onChange={(v) => setQuiz((q) => ({ ...q, timeHorizon: v }))}
    />,
    // Step 2: Risk Tolerance
    <SliderQuestion
      key="risk"
      question="How do you feel about investment risk?"
      leftLabel="Preserve capital, steady returns"
      rightLabel="Accept volatility for higher upside"
      value={quiz.riskTolerance}
      onChange={(v) => setQuiz((q) => ({ ...q, riskTolerance: v }))}
    />,
    // Step 3: Liquidity Need
    <SliderQuestion
      key="liquidity"
      question="How important is it that you can access your capital quickly?"
      leftLabel="I need liquidity options"
      rightLabel="I can lock capital long-term"
      value={1 - quiz.liquidityNeed}
      onChange={(v) => setQuiz((q) => ({ ...q, liquidityNeed: 1 - v }))}
    />,
    // Step 4: Sector + ESG
    <div key="sector" className="space-y-6">
      <p className="text-lg font-medium" style={{ color: "var(--sh-text-primary)", fontFamily: "var(--font-display)" }}>
        Which sectors align with your investment thesis?
      </p>
      <div className="flex flex-wrap gap-2">
        {SECTORS.map((s) => (
          <button
            key={s}
            onClick={() =>
              setQuiz((q) => ({
                ...q,
                sectorAffinity: q.sectorAffinity.includes(s)
                  ? q.sectorAffinity.filter((x) => x !== s)
                  : [...q.sectorAffinity, s],
              }))
            }
            className="px-3 py-1.5 rounded-full text-sm transition-all"
            style={{
              background: quiz.sectorAffinity.includes(s) ? "var(--sh-signal)" : "var(--sh-surface-2)",
              color: quiz.sectorAffinity.includes(s) ? "var(--sh-bg)" : "var(--sh-text-secondary)",
              border: `1px solid ${quiz.sectorAffinity.includes(s) ? "var(--sh-signal)" : "var(--sh-border)"}`,
              fontFamily: "var(--font-display)",
            }}
          >
            {s}
          </button>
        ))}
      </div>
      <SliderQuestion
        question="How much does social/community impact factor into your investment decisions?"
        leftLabel="Returns only"
        rightLabel="Impact is essential"
        value={quiz.esgConviction}
        onChange={(v) => setQuiz((q) => ({ ...q, esgConviction: v }))}
      />
    </div>,
  ];

  const totalSteps = 4;
  const isLastQuizStep = step === totalSteps;
  const isReveal = step === 5;

  const handleNext = () => {
    if (isLastQuizStep) {
      saveDna.mutate(quiz);
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--sh-bg)" }}
    >
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-6">
            <img src="/api/storage-proxy/sh-icon-final.png" alt="Signal Hunter OS" className="w-8 h-8" />
            <span className="text-sm font-medium tracking-widest uppercase" style={{ color: "var(--sh-text-secondary)", fontFamily: "var(--font-mono)" }}>
              Signal Hunter OS
            </span>
          </div>
          {!isReveal && (
            <>
              <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--sh-text-primary)", fontFamily: "var(--font-display)" }}>
                {step === 0 ? "Build Your Investor DNA" : `Step ${step} of ${totalSteps}`}
              </h1>
              <p style={{ color: "var(--sh-text-secondary)" }}>
                {step === 0
                  ? "5 questions to calibrate your deal feed and surface opportunities that match your thesis."
                  : "Your answers shape which deals surface first in your Deal Room."}
              </p>
            </>
          )}
        </div>

        {/* Progress bar */}
        {step > 0 && !isReveal && (
          <div className="mb-8 h-1 rounded-full overflow-hidden" style={{ background: "var(--sh-surface-2)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(step / totalSteps) * 100}%`, background: "var(--sh-signal)" }}
            />
          </div>
        )}

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{ background: "var(--sh-surface)", border: "1px solid var(--sh-border)" }}
        >
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center space-y-6">
              <div className="text-6xl">🧬</div>
              <div className="space-y-3">
                <h2 className="text-xl font-semibold" style={{ color: "var(--sh-text-primary)", fontFamily: "var(--font-display)" }}>
                  Welcome to Signal Hunter
                </h2>
                <p style={{ color: "var(--sh-text-secondary)", lineHeight: "1.7" }}>
                  Your operator has curated a live deal flow of acquisition opportunities. Before you access the Deal Room,
                  we'll build your <strong style={{ color: "var(--sh-signal)" }}>Investor DNA</strong> — a profile that
                  surfaces deals matching your thesis and flags mismatches before you waste time on the wrong opportunities.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  { icon: "⚡", label: "5 questions", sub: "Takes 2 minutes" },
                  { icon: "🎯", label: "DNA-matched deals", sub: "Curated for your thesis" },
                  { icon: "🔒", label: "Operator-controlled", sub: "AI analysis on request" },
                  { icon: "📊", label: "Live deal flow", sub: "Updated daily" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl p-4 text-left"
                    style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border)" }}
                  >
                    <div className="text-2xl mb-2">{item.icon}</div>
                    <div className="font-medium" style={{ color: "var(--sh-text-primary)" }}>{item.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--sh-text-secondary)" }}>{item.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quiz steps 1-4 */}
          {step > 0 && step <= totalSteps && (
            <div className="space-y-8">
              {steps[step]}
              {/* Live DNA preview */}
              {step > 1 && (
                <div
                  className="rounded-xl p-4"
                  style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border)" }}
                >
                  <p className="text-xs font-medium mb-3" style={{ color: "var(--sh-text-secondary)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>
                    LIVE DNA PREVIEW
                  </p>
                  <DnaStrand scores={quiz} />
                </div>
              )}
            </div>
          )}

          {/* Archetype Reveal */}
          {isReveal && archetype && (
            <div className="text-center space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-medium tracking-widest uppercase" style={{ color: "var(--sh-signal)", fontFamily: "var(--font-mono)" }}>
                  Your Investor Archetype
                </p>
                <h2 className="text-4xl font-bold" style={{ color: "var(--sh-text-primary)", fontFamily: "var(--font-display)" }}>
                  {archetype.label}
                </h2>
                <p className="text-sm font-mono" style={{ color: "var(--sh-text-secondary)" }}>
                  {archetype.code}
                </p>
              </div>

              {ARCHETYPE_DESCRIPTIONS[archetype.code] && (
                <div className="space-y-4">
                  <p className="text-lg font-medium italic" style={{ color: "var(--sh-signal)" }}>
                    "{ARCHETYPE_DESCRIPTIONS[archetype.code].tagline}"
                  </p>
                  <p style={{ color: "var(--sh-text-secondary)", lineHeight: "1.7" }}>
                    {ARCHETYPE_DESCRIPTIONS[archetype.code].description}
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {ARCHETYPE_DESCRIPTIONS[archetype.code].traits.map((t) => (
                      <span
                        key={t}
                        className="px-3 py-1 rounded-full text-xs"
                        style={{ background: "var(--sh-surface-2)", color: "var(--sh-text-secondary)", border: "1px solid var(--sh-border)" }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Final DNA */}
              <div
                className="rounded-xl p-4 text-left"
                style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border)" }}
              >
                <p className="text-xs font-medium mb-3" style={{ color: "var(--sh-text-secondary)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>
                  YOUR DNA PROFILE
                </p>
                <DnaStrand scores={quiz} />
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-6">
          {step > 0 && !isReveal ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="px-4 py-2 text-sm rounded-lg transition-colors"
              style={{ color: "var(--sh-text-secondary)", background: "var(--sh-surface-2)", border: "1px solid var(--sh-border)" }}
            >
              ← Back
            </button>
          ) : (
            <div />
          )}

          {!isReveal ? (
            <button
              onClick={handleNext}
              disabled={saveDna.isPending}
              className="px-6 py-2.5 rounded-lg font-medium text-sm transition-all"
              style={{
                background: "var(--sh-signal)",
                color: "var(--sh-bg)",
                fontFamily: "var(--font-display)",
                opacity: saveDna.isPending ? 0.7 : 1,
              }}
            >
              {saveDna.isPending ? "Building profile…" : isLastQuizStep ? "Reveal My Archetype →" : step === 0 ? "Start →" : "Continue →"}
            </button>
          ) : (
            <button
              onClick={() => navigate("/investor")}
              className="px-6 py-2.5 rounded-lg font-medium text-sm"
              style={{ background: "var(--sh-signal)", color: "var(--sh-bg)", fontFamily: "var(--font-display)" }}
            >
              Enter Deal Room →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
