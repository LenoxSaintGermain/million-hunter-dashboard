import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, ChevronLeft, Sparkles } from "lucide-react";

// ─── DNA Strand Visualization ─────────────────────────────────────────────────
function DnaStrand({ scores }: { scores: { timeHorizon: number; riskTolerance: number; liquidityNeed: number; esgConviction: number } }) {
  const strands = [
    { label: "Time Horizon", value: scores.timeHorizon, color: "var(--sh-signal)" },
    { label: "Risk Tolerance", value: scores.riskTolerance, color: "var(--sh-amber)" },
    { label: "Illiquidity Tolerance", value: 1 - scores.liquidityNeed, color: "#a78bfa" },
    { label: "Impact Conviction", value: scores.esgConviction, color: "#34d399" },
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
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${s.value * 100}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{ background: s.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Archetype metadata ────────────────────────────────────────────────────────
const ARCHETYPES: Record<string, { label: string; tagline: string; description: string; traits: string[]; glyph: string; color: string }> = {
  "ALPHA-7": {
    label: "Alpha Hunter",
    glyph: "⚡",
    color: "var(--sh-signal)",
    tagline: "High conviction. Zero tolerance for hidden risk.",
    description: "You move fast when the signal is clear — but you won't move at all if the diligence doesn't hold. The platform weights customer concentration, owner dependence, and add-back inflation as hard stops for your lens.",
    traits: ["Concentrated positions", "Operator-friendly", "5–10 year holds"],
  },
  "IMPACT-4": {
    label: "Impact Allocator",
    glyph: "🌿",
    color: "#a78bfa",
    tagline: "Returns with a reason. Risks with a cost.",
    description: "You want capital to compound and create change. The platform flags deals where community impact claims mask operational fragility — because a failing business helps no one.",
    traits: ["ESG-aligned deals", "Community impact", "Patient capital"],
  },
  "COMPOUNDER-9": {
    label: "Long Compounder",
    glyph: "🌳",
    color: "var(--sh-amber)",
    tagline: "Slow money demands clean books.",
    description: "You think in decades. That means the QoE proxy, the owner dependence audit, and the add-back analysis are non-negotiable — because a structural defect at year one compounds into a decade of drag.",
    traits: ["Long-duration holds", "Cash flow focus", "Low turnover"],
  },
  "SPRINT-3": {
    label: "Sprint Allocator",
    glyph: "🚀",
    color: "var(--sh-red)",
    tagline: "Velocity requires clean exits. Clean exits require clean diligence.",
    description: "Short holds and high IRR targets mean you can't afford post-close surprises. The platform front-loads the failure modes so you're not discovering them at month 18.",
    traits: ["2–3 year exits", "High IRR focus", "Active portfolio management"],
  },
  "ANCHOR-1": {
    label: "Steady Anchor",
    glyph: "⚓",
    color: "#34d399",
    tagline: "Predictable cash flow starts with verified cash flow.",
    description: "You value stability over excitement. The platform's QoE proxy and owner dependence audit exist precisely for your thesis — because the most dangerous deals are the ones that look stable until they aren't.",
    traits: ["Stable cash flow", "Low volatility", "Diversified exposure"],
  },
};

// ─── Sectors ──────────────────────────────────────────────────────────────────
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
  esgConviction: 0.3,
  sectorAffinity: [],
};

// ─── Slider ───────────────────────────────────────────────────────────────────
function SliderQuestion({
  question,
  subtext,
  leftLabel,
  rightLabel,
  value,
  onChange,
}: {
  question: string;
  subtext?: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xl font-semibold leading-snug" style={{ color: "var(--sh-text-primary)", fontFamily: "var(--font-display)" }}>
          {question}
        </p>
        {subtext && (
          <p className="text-sm mt-2" style={{ color: "var(--sh-text-secondary)" }}>{subtext}</p>
        )}
      </div>
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
          <span className="font-mono font-bold" style={{ color: "var(--sh-signal)" }}>{Math.round(value * 100)}%</span>
          <span>{rightLabel}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Step content definitions ─────────────────────────────────────────────────
const STEP_META = [
  { label: "Welcome", title: "Calibrate Your Diligence Lens" },
  { label: "Time Horizon", title: "How long do you hold?" },
  { label: "Risk Profile", title: "How do you think about risk?" },
  { label: "Liquidity", title: "How liquid do you need to stay?" },
  { label: "Sectors & Impact", title: "What do you want to own?" },
];

// ─── Main Component ────────────────────────────────────────────────────────────
export default function InvestorOnboarding() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [quiz, setQuiz] = useState<QuizState>(INITIAL_STATE);
  const [archetype, setArchetype] = useState<{ code: string; label: string } | null>(null);

  const utils = trpc.useUtils();
  const markComplete = trpc.user.markOnboardingComplete.useMutation();

  const saveDna = trpc.investor.saveDna.useMutation({
    onSuccess: async (data) => {
      await markComplete.mutateAsync();
      await utils.investor.getDnaStatus.invalidate();
      await utils.user.onboardingStatus.invalidate();
      setArchetype({ code: data.archetypeCode, label: data.archetypeLabel });
      setDirection(1);
      setStep(5);
    },
    onError: () => toast.error("Failed to save your profile. Please try again."),
  });

  const totalSteps = 4;
  const isLastQuizStep = step === totalSteps;
  const isReveal = step === 5;

  const goNext = () => {
    if (isLastQuizStep) {
      saveDna.mutate(quiz);
    } else {
      setDirection(1);
      setStep((s) => s + 1);
    }
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => s - 1);
  };

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -40 : 40, opacity: 0 }),
  };

  const stepContent = [
    // Step 0: Welcome
    <div key="welcome" className="text-center space-y-6">
      <div className="text-6xl">🧬</div>
      <div className="space-y-3">
        <h2 className="text-xl font-semibold" style={{ color: "var(--sh-text-primary)", fontFamily: "var(--font-display)" }}>
          Before you see a single deal —
        </h2>
        <p style={{ color: "var(--sh-text-secondary)", lineHeight: "1.7" }}>
          Signal Hunter doesn't surface opportunities. It validates them — and kills the ones that would cost you.
          Your <strong style={{ color: "var(--sh-signal)" }}>Investor DNA</strong> configures the diligence engine:
          which risks to weight, which sectors to flag, and which deal structures to reject before you've spent a dollar.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {[
          { icon: "⚡", label: "5 questions", sub: "Takes 2 minutes" },
          { icon: "🛡", label: "Risk-weighted lens", sub: "Flags your failure modes first" },
          { icon: "🔒", label: "Operator-controlled", sub: "Every analysis on demand" },
          { icon: "⚠️", label: "Landmine detection", sub: "Before you commission diligence" },
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
    </div>,

    // Step 1: Time Horizon
    <SliderQuestion
      key="time"
      question="How long are you comfortable holding before expecting returns?"
      subtext="This determines how the engine weights growth trajectory vs. immediate cash flow."
      leftLabel="12–18 months"
      rightLabel="5–10 years"
      value={quiz.timeHorizon}
      onChange={(v) => setQuiz((q) => ({ ...q, timeHorizon: v }))}
    />,

    // Step 2: Risk Tolerance
    <SliderQuestion
      key="risk"
      question="How do you think about investment risk?"
      subtext="This calibrates how aggressively the engine flags customer concentration and owner dependence."
      leftLabel="Preserve capital, steady returns"
      rightLabel="Accept volatility for higher upside"
      value={quiz.riskTolerance}
      onChange={(v) => setQuiz((q) => ({ ...q, riskTolerance: v }))}
    />,

    // Step 3: Liquidity
    <SliderQuestion
      key="liquidity"
      question="How important is it that you can access your capital quickly?"
      subtext="Illiquid positions can unlock better deal structures — but only if you can hold through cycles."
      leftLabel="I need liquidity options"
      rightLabel="I can lock capital long-term"
      value={1 - quiz.liquidityNeed}
      onChange={(v) => setQuiz((q) => ({ ...q, liquidityNeed: 1 - v }))}
    />,

    // Step 4: Sectors + ESG
    <div key="sector" className="space-y-6">
      <div>
        <p className="text-xl font-semibold leading-snug" style={{ color: "var(--sh-text-primary)", fontFamily: "var(--font-display)" }}>
          Which sectors align with your investment thesis?
        </p>
        <p className="text-sm mt-2" style={{ color: "var(--sh-text-secondary)" }}>
          Select all that apply. The engine will prioritize deal flow in these categories.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {SECTORS.map((s) => {
          const active = quiz.sectorAffinity.includes(s);
          return (
            <button
              key={s}
              onClick={() =>
                setQuiz((q) => ({
                  ...q,
                  sectorAffinity: active
                    ? q.sectorAffinity.filter((x) => x !== s)
                    : [...q.sectorAffinity, s],
                }))
              }
              className="px-3 py-1.5 rounded-full text-sm transition-all"
              style={{
                background: active ? "var(--sh-signal)" : "var(--sh-surface-2)",
                color: active ? "var(--sh-bg)" : "var(--sh-text-secondary)",
                border: `1px solid ${active ? "var(--sh-signal)" : "var(--sh-border)"}`,
                fontFamily: "var(--font-display)",
              }}
            >
              {s}
            </button>
          );
        })}
      </div>
      <SliderQuestion
        question="How much does social/community impact factor into your decisions?"
        leftLabel="Returns only"
        rightLabel="Impact is essential"
        value={quiz.esgConviction}
        onChange={(v) => setQuiz((q) => ({ ...q, esgConviction: v }))}
      />
    </div>,
  ];

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--sh-bg)" }}
    >
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <img src="/api/storage-proxy/sh-icon-final.png" alt="Signal Hunter OS" className="w-8 h-8" />
            <span className="text-sm font-medium tracking-widest uppercase" style={{ color: "var(--sh-text-secondary)", fontFamily: "var(--font-mono)" }}>
              Signal Hunter OS
            </span>
          </div>

          {/* Step label */}
          {!isReveal && (
            <AnimatePresence mode="wait">
              <motion.div
                key={`label-${step}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.25 }}
              >
                <h1 className="text-3xl font-bold mb-1" style={{ color: "var(--sh-text-primary)", fontFamily: "var(--font-display)" }}>
                  {step === 0 ? STEP_META[0].title : STEP_META[step]?.label ?? ""}
                </h1>
                {step === 0 && (
                  <p style={{ color: "var(--sh-text-secondary)" }}>
                    5 questions to configure which risks the platform flags first.
                  </p>
                )}
                {step > 0 && (
                  <p className="text-sm" style={{ color: "var(--sh-text-secondary)" }}>
                    Step {step} of {totalSteps}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Progress bar */}
        {step > 0 && !isReveal && (
          <div className="mb-6 h-1 rounded-full overflow-hidden" style={{ background: "var(--sh-surface-2)" }}>
            <motion.div
              className="h-full rounded-full"
              initial={false}
              animate={{ width: `${(step / totalSteps) * 100}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              style={{ background: "var(--sh-signal)" }}
            />
          </div>
        )}

        {/* Card */}
        <div
          className="rounded-2xl p-8 overflow-hidden"
          style={{ background: "var(--sh-surface)", border: "1px solid var(--sh-border)" }}
        >
          {!isReveal ? (
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                {stepContent[step]}

                {/* Live DNA preview (steps 2+) */}
                {step > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-8 rounded-xl p-4"
                    style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border)" }}
                  >
                    <p className="text-xs font-medium mb-3" style={{ color: "var(--sh-text-secondary)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>
                      LIVE DNA PREVIEW
                    </p>
                    <DnaStrand scores={quiz} />
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            /* Archetype Reveal */
            archetype && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="text-center space-y-6"
              >
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                  className="text-6xl"
                >
                  {ARCHETYPES[archetype.code]?.glyph ?? "🧬"}
                </motion.div>

                <div className="space-y-2">
                  <p className="text-xs font-medium tracking-widest uppercase" style={{ color: "var(--sh-signal)", fontFamily: "var(--font-mono)" }}>
                    Your Investor Archetype
                  </p>
                  <h2 className="text-4xl font-bold" style={{ color: "var(--sh-text-primary)", fontFamily: "var(--font-display)" }}>
                    {ARCHETYPES[archetype.code]?.label ?? archetype.label}
                  </h2>
                  <p className="text-sm font-mono" style={{ color: "var(--sh-text-secondary)" }}>
                    {archetype.code}
                  </p>
                </div>

                {ARCHETYPES[archetype.code] && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="space-y-4"
                  >
                    <p className="text-lg font-medium italic" style={{ color: ARCHETYPES[archetype.code].color }}>
                      "{ARCHETYPES[archetype.code].tagline}"
                    </p>
                    <p style={{ color: "var(--sh-text-secondary)", lineHeight: "1.7" }}>
                      {ARCHETYPES[archetype.code].description}
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {ARCHETYPES[archetype.code].traits.map((t) => (
                        <span
                          key={t}
                          className="px-3 py-1 rounded-full text-xs"
                          style={{ background: "var(--sh-surface-2)", color: "var(--sh-text-secondary)", border: "1px solid var(--sh-border)" }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Final DNA */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="rounded-xl p-4 text-left"
                  style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border)" }}
                >
                  <p className="text-xs font-medium mb-3" style={{ color: "var(--sh-text-secondary)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>
                    YOUR DNA PROFILE
                  </p>
                  <DnaStrand scores={quiz} />
                </motion.div>
              </motion.div>
            )
          )}
        </div>

        {/* Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex justify-between items-center mt-6"
        >
          {step > 0 && !isReveal ? (
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg transition-colors"
              style={{ color: "var(--sh-text-secondary)", background: "var(--sh-surface-2)", border: "1px solid var(--sh-border)" }}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          {!isReveal ? (
            <button
              onClick={goNext}
              disabled={saveDna.isPending}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all"
              style={{
                background: "var(--sh-signal)",
                color: "var(--sh-bg)",
                fontFamily: "var(--font-display)",
                opacity: saveDna.isPending ? 0.7 : 1,
              }}
            >
              {saveDna.isPending ? (
                "Calibrating lens…"
              ) : isLastQuizStep ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  Reveal My Archetype
                </>
              ) : step === 0 ? (
                <>
                  Configure Lens
                  <ChevronRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => navigate("/investor")}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm"
              style={{ background: "var(--sh-signal)", color: "var(--sh-bg)", fontFamily: "var(--font-display)" }}
            >
              Enter the Deal Room
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
