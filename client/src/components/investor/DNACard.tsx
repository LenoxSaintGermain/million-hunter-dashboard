import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DNAProfile {
  archetype: string;
  archetypeCode: string;
  riskTolerance: number;
  timeHorizon: number;
  liquidityNeed: number;
  preferredSectors: string[];
  minDealSize: number;
  maxDealSize: number;
  targetIRR: number;
  preferredStructures: string[];
}

interface DNACardProps {
  compact?: boolean;
  className?: string;
}

// ─── Archetype metadata ───────────────────────────────────────────────────────

const ARCHETYPES: Record<string, { label: string; tagline: string; color: string; accent: string; glyph: string }> = {
  "ALPHA-7": {
    label: "Alpha Hunter",
    tagline: "High conviction. High velocity. First mover.",
    color: "oklch(0.72 0.19 142)",
    accent: "oklch(0.72 0.19 142 / 0.15)",
    glyph: "⚡",
  },
  "ANCHOR-3": {
    label: "Steady Anchor",
    tagline: "Cash flow first. Capital preservation always.",
    color: "oklch(0.72 0.19 230)",
    accent: "oklch(0.72 0.19 230 / 0.15)",
    glyph: "⚓",
  },
  "COMPOUNDER-5": {
    label: "Long Compounder",
    tagline: "Patient capital. Generational wealth.",
    color: "oklch(0.78 0.18 75)",
    accent: "oklch(0.78 0.18 75 / 0.15)",
    glyph: "🌱",
  },
  "CATALYST-9": {
    label: "Deal Catalyst",
    tagline: "Operational alpha. Value creation through action.",
    color: "oklch(0.72 0.19 300)",
    accent: "oklch(0.72 0.19 300 / 0.15)",
    glyph: "🔥",
  },
};

// ─── Animated strand bar ──────────────────────────────────────────────────────

function StrandBar({ label, value, color, delay = 0 }: { label: string; value: number; color: string; delay?: number }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--sh-fg-4)" }}>{label}</span>
        <span className="text-[10px] font-black font-mono" style={{ color }}>{Math.round(value * 100)}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--sh-surface-2)" }}>
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: animated ? `${value * 100}%` : "0%",
            background: `linear-gradient(90deg, ${color}, ${color.replace(")", " / 0.6)")})`,
            boxShadow: animated ? `0 0 8px ${color}` : "none",
          }}
        />
      </div>
    </div>
  );
}

// ─── Sector affinity dots ─────────────────────────────────────────────────────

function SectorAffinity({ sectors, color }: { sectors: string[]; color: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {sectors.map((s, i) => (
        <span
          key={s}
          className="px-2 py-0.5 rounded-md text-[10px] font-semibold"
          style={{
            background: `${color.replace(")", " / 0.12)")}`,
            color,
            border: `1px solid ${color.replace(")", " / 0.25)")}`,
            animationDelay: `${i * 80}ms`,
          }}
        >
          {s}
        </span>
      ))}
    </div>
  );
}

// ─── Genome visualization (mini bar chart) ────────────────────────────────────

function GenomeViz({ dna }: { dna: DNAProfile }) {
  const bars = [
    { v: dna.riskTolerance, label: "RISK" },
    { v: dna.timeHorizon, label: "TIME" },
    { v: 1 - dna.liquidityNeed, label: "LOCK" },
    { v: Math.min(dna.targetIRR / 30, 1), label: "IRR" },
    { v: dna.riskTolerance * 0.8, label: "ALPHA" },
    { v: dna.timeHorizon * 0.9, label: "HOLD" },
    { v: 1 - dna.liquidityNeed * 0.7, label: "ILLIQ" },
    { v: dna.riskTolerance * 0.6 + 0.2, label: "CONV" },
  ];

  const archMeta = ARCHETYPES[dna.archetypeCode] ?? ARCHETYPES["ALPHA-7"];

  return (
    <div className="flex items-end gap-[3px] h-8">
      {bars.map((b, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
          <div
            className="w-full rounded-sm transition-all duration-700"
            style={{
              height: `${Math.max(b.v * 28, 4)}px`,
              background: `linear-gradient(180deg, ${archMeta.color}, ${archMeta.color.replace(")", " / 0.4)")})`,
              transitionDelay: `${i * 60}ms`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Main DNA Card ────────────────────────────────────────────────────────────

export default function DNACard({ compact = false, className = "" }: DNACardProps) {
  const { data: dnaData } = trpc.investor.getDnaStatus.useQuery();
  const cardRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.1 });
    if (cardRef.current) obs.observe(cardRef.current);
    return () => obs.disconnect();
  }, []);

  if (!dnaData?.quizCompleted || !dnaData.archetypeCode) {
    return null;
  }

  const dna: DNAProfile = {
    archetype: (dnaData as any).archetypeLabel ?? "Alpha Hunter",
    archetypeCode: (dnaData as any).archetypeCode ?? "ALPHA-7",
    riskTolerance: (dnaData as any).riskTolerance ?? 0.7,
    timeHorizon: (dnaData as any).timeHorizon ?? 0.7,
    liquidityNeed: (dnaData as any).liquidityNeed ?? 0.3,
    preferredSectors: (dnaData as any).sectorAffinity ?? [],
    minDealSize: 500000,
    maxDealSize: 5000000,
    targetIRR: 20,
    preferredStructures: ["SBA 7(a)", "Seller Financing", "Equity"],
  };
  const archMeta = ARCHETYPES[dna.archetypeCode] ?? ARCHETYPES["ALPHA-7"];

  if (compact) {
    // ── Compact pill for sidebar / header ──
    return (
      <div
        ref={cardRef}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl ${className}`}
        style={{ background: archMeta.accent, border: `1px solid ${archMeta.color.replace(")", " / 0.25)")}` }}
      >
        <span className="text-base leading-none">{archMeta.glyph}</span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest leading-none" style={{ color: archMeta.color }}>{dna.archetypeCode}</p>
          <p className="text-[9px] font-medium truncate" style={{ color: "var(--sh-fg-3)" }}>{archMeta.label}</p>
        </div>
      </div>
    );
  }

  // ── Full card ──
  return (
    <div
      ref={cardRef}
      className={`rounded-2xl overflow-hidden transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"} ${className}`}
      style={{
        background: `linear-gradient(135deg, var(--sh-surface-1) 0%, ${archMeta.accent} 100%)`,
        border: `1px solid ${archMeta.color.replace(")", " / 0.2)")}`,
        boxShadow: `0 0 40px ${archMeta.color.replace(")", " / 0.08)")}`,
      }}
    >
      {/* Card header — archetype reveal */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${archMeta.color.replace(")", " / 0.12)")}` }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{archMeta.glyph}</span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: archMeta.color }}>
                  Investor DNA · {dna.archetypeCode}
                </p>
                <h3 className="text-lg font-black leading-tight" style={{ color: "var(--sh-fg-1)" }}>{archMeta.label}</h3>
              </div>
            </div>
            <p className="text-xs italic" style={{ color: "var(--sh-fg-3)" }}>{archMeta.tagline}</p>
          </div>
          {/* Genome mini-viz */}
          <div className="shrink-0 w-20">
            <GenomeViz dna={dna} />
          </div>
        </div>
      </div>

      {/* Strand bars */}
      <div className="px-5 py-4 space-y-3" style={{ borderBottom: `1px solid ${archMeta.color.replace(")", " / 0.08)")}` }}>
        <StrandBar label="Risk Appetite" value={dna.riskTolerance} color={archMeta.color} delay={100} />
        <StrandBar label="Time Horizon" value={dna.timeHorizon} color={archMeta.color} delay={200} />
        <StrandBar
          label="Illiquidity Tolerance"
          value={1 - dna.liquidityNeed}
          color={archMeta.color}
          delay={300}
        />
        <StrandBar
          label="Target IRR"
          value={Math.min(dna.targetIRR / 30, 1)}
          color={archMeta.color}
          delay={400}
        />
      </div>

      {/* Deal parameters */}
      <div className="px-5 py-4 grid grid-cols-2 gap-3" style={{ borderBottom: `1px solid ${archMeta.color.replace(")", " / 0.08)")}` }}>
        <div className="rounded-xl p-3" style={{ background: "var(--sh-surface-2)" }}>
          <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--sh-fg-4)" }}>Deal Range</p>
          <p className="text-sm font-black font-mono" style={{ color: "var(--sh-fg-1)" }}>
            ${(dna.minDealSize / 1000000).toFixed(1)}M – ${(dna.maxDealSize / 1000000).toFixed(1)}M
          </p>
        </div>
        <div className="rounded-xl p-3" style={{ background: "var(--sh-surface-2)" }}>
          <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--sh-fg-4)" }}>Target IRR</p>
          <p className="text-sm font-black font-mono" style={{ color: archMeta.color }}>{dna.targetIRR}%+</p>
        </div>
        {dna.preferredStructures?.length > 0 && (
          <div className="col-span-2 rounded-xl p-3" style={{ background: "var(--sh-surface-2)" }}>
            <p className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--sh-fg-4)" }}>Preferred Structures</p>
            <div className="flex flex-wrap gap-1.5">
              {dna.preferredStructures.map(s => (
                <span key={s} className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: archMeta.accent, color: archMeta.color }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sector affinity */}
      {dna.preferredSectors?.length > 0 && (
        <div className="px-5 py-4">
          <p className="text-[9px] font-bold uppercase tracking-wider mb-2.5" style={{ color: "var(--sh-fg-4)" }}>Sector Affinity</p>
          <SectorAffinity sectors={dna.preferredSectors} color={archMeta.color} />
        </div>
      )}
    </div>
  );
}
