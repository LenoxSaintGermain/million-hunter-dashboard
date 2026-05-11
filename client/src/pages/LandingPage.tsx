import { useState, useEffect, useRef } from "react";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";

// ─── Static data ─────────────────────────────────────────────────────────────
const STATS = [
  { value: "$2.4M", label: "Avg. deal cash flow" },
  { value: "3.2×", label: "Avg. acquisition multiple" },
  { value: "94%", label: "SBA 7(a) eligibility rate" },
  { value: "48h", label: "Avg. time to scored deal" },
];

const FEATURES = [
  {
    eyebrow: "SIGNAL INTELLIGENCE",
    title: "Every deal scored before you read it.",
    body: "Six-dimension AI scoring — financial health, capital stack fit, operational alpha, macro arbitrage, deal structure, and strategic alignment — runs automatically on every inbound listing.",
    icon: "analytics",
  },
  {
    eyebrow: "TIDE CAPITAL FLOW",
    title: "Follow the federal money before it lands.",
    body: "TIDE tracks USAspending disbursements, Federal Register actions, and FEC filings to surface capital convergence events 60–90 days before they show up in deal flow.",
    icon: "trending_up",
  },
  {
    eyebrow: "IC REVIEW",
    title: "Three AI models. One consensus verdict.",
    body: "Claude, Gemini, and Perplexity run parallel investment committee reviews. When they disagree, the divergence flag tells you exactly where the risk lives.",
    icon: "how_to_vote",
  },
  {
    eyebrow: "BEHAVIORAL PROFILE",
    title: "Know the seller before the first call.",
    body: "AI-generated owner psychology profiles, negotiation rehearsal scenarios, and agentic friction scoring — so you walk in with leverage, not questions.",
    icon: "psychology",
  },
  {
    eyebrow: "AGENT ORCHESTRATION",
    title: "Your deal team. Automated.",
    body: "Multi-model agent runs (Red Team, Capital Stack, Digital Audit, Behavioral) execute in parallel and stream results into your Intelligence Dossier in real time.",
    icon: "smart_toy",
  },
  {
    eyebrow: "SENTINEL SIGNALS",
    title: "Macro headwinds and tailwinds, live.",
    body: "A curated signal feed tracks interest rate shifts, SBA policy changes, sector tailwinds, and geographic arbitrage windows — weighted and scored against your active pipeline.",
    icon: "radar",
  },
];

const TESTIMONIALS = [
  {
    quote: "I ran three deals through the IC Review before my first LOI. The divergence flag on deal two saved me from a $2.1M mistake.",
    name: "Marcus T.",
    role: "Independent Sponsor, Southeast US",
    initial: "M",
  },
  {
    quote: "The TIDE tracker surfaced a $180M BeltLine TAD commitment two months before any broker knew about it. We had three qualified targets identified before the press release.",
    name: "Priya S.",
    role: "Search Fund Operator, Atlanta",
    initial: "P",
  },
  {
    quote: "The behavioral profile on my target seller was more accurate than the NDA package. Walked into the LOI negotiation knowing exactly what levers to pull.",
    name: "Derek W.",
    role: "Acquisition Entrepreneur, Charlotte",
    initial: "D",
  },
];

// ─── Animated counter ────────────────────────────────────────────────────────
function AnimatedStat({ value, label }: { value: string; label: string }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
      <div className="font-['Fraunces',_serif] text-5xl lg:text-6xl font-black text-[#ffba20] leading-none mb-2">{value}</div>
      <div className="text-[#8b7355] text-sm uppercase tracking-widest font-medium">{label}</div>
    </div>
  );
}

// ─── Feature card ────────────────────────────────────────────────────────────
function FeatureCard({ eyebrow, title, body, icon, index }: { eyebrow: string; title: string; body: string; icon: string; index: number }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`group border border-[#e8e0d4] bg-[#faf8f5] p-8 transition-all duration-700 hover:border-[#ffba20] hover:shadow-[0_4px_32px_rgba(255,186,32,0.08)]`}
      style={{ transitionDelay: `${index * 80}ms`, opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)" }}
    >
      <div className="flex items-start gap-4 mb-5">
        <span className="material-symbols-outlined text-[#ffba20] text-2xl mt-0.5">{icon}</span>
        <span className="text-[10px] font-bold tracking-[0.2em] text-[#8b7355] uppercase pt-1">{eyebrow}</span>
      </div>
      <h3 className="font-['Fraunces',_serif] text-xl font-bold text-[#1a1208] mb-3 leading-snug group-hover:text-[#3d2e1e] transition-colors">{title}</h3>
      <p className="text-[#5c4a32] text-sm leading-relaxed">{body}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const loginUrl = getLoginUrl();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#1a1208]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Top nav ── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#faf8f5]/95 backdrop-blur-sm border-b border-[#e8e0d4] shadow-sm" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-[#1a1208] rounded-sm flex items-center justify-center">
              <span className="material-symbols-outlined text-[#ffba20] text-[16px]">radar</span>
            </div>
            <div>
              <div className="font-['Fraunces',_serif] font-black text-[#1a1208] text-sm leading-none">SIGNAL HUNTER</div>
              <div className="text-[9px] tracking-[0.2em] text-[#8b7355] uppercase leading-none mt-0.5">OS EDITORIAL</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/explore" className="text-sm text-[#5c4a32] hover:text-[#1a1208] transition-colors hidden sm:block">
              Browse Deals
            </Link>
            <a
              href={loginUrl}
              className="bg-[#1a1208] text-[#faf8f5] text-sm font-medium px-5 py-2 hover:bg-[#3d2e1e] transition-colors"
            >
              Request Access
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="pt-32 pb-24 px-6 max-w-7xl mx-auto">
        <div className="max-w-4xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px w-12 bg-[#ffba20]" />
            <span className="text-[10px] font-bold tracking-[0.25em] text-[#8b7355] uppercase">Acquisition Intelligence Platform</span>
          </div>
          <h1
            className="font-['Fraunces',_serif] font-black text-[#1a1208] leading-[0.92] mb-8"
            style={{ fontSize: "clamp(3.5rem, 9vw, 7rem)" }}
          >
            Find the deal.<br />
            <span className="text-[#ffba20]">Before</span> the<br />
            broker does.
          </h1>
          <p className="text-[#5c4a32] text-xl leading-relaxed max-w-2xl mb-10">
            Signal Hunter OS is an AI-powered acquisition intelligence platform for independent sponsors and search fund operators targeting $1M–$10M cash flow businesses in the Southeast US.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href={loginUrl}
              className="inline-flex items-center justify-center gap-2 bg-[#1a1208] text-[#faf8f5] text-base font-semibold px-8 py-4 hover:bg-[#3d2e1e] transition-colors"
            >
              <span className="material-symbols-outlined text-[#ffba20] text-[20px]">lock_open</span>
              Request Operator Access
            </a>
            <Link
              href="/explore"
              className="inline-flex items-center justify-center gap-2 border border-[#1a1208] text-[#1a1208] text-base font-medium px-8 py-4 hover:bg-[#1a1208] hover:text-[#faf8f5] transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">search</span>
              Browse Active Deals
            </Link>
          </div>
        </div>

        {/* Decorative rule */}
        <div className="mt-20 border-t border-[#e8e0d4]" />
      </section>

      {/* ── Stats strip ── */}
      <section className="py-16 px-6 bg-[#1a1208]">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-12">
          {STATS.map((s) => (
            <AnimatedStat key={s.label} value={s.value} label={s.label} />
          ))}
        </div>
      </section>

      {/* ── "How it works" editorial section ── */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-12 gap-16 items-start">
          <div className="lg:col-span-4 lg:sticky lg:top-24">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px w-8 bg-[#ffba20]" />
              <span className="text-[10px] font-bold tracking-[0.2em] text-[#8b7355] uppercase">The System</span>
            </div>
            <h2 className="font-['Fraunces',_serif] text-4xl lg:text-5xl font-black text-[#1a1208] leading-tight mb-6">
              Six layers of intelligence. One pipeline.
            </h2>
            <p className="text-[#5c4a32] leading-relaxed mb-8">
              Most acquisition tools give you a spreadsheet. Signal Hunter OS gives you a war room — with AI analysts running parallel diligence before you've read the teaser.
            </p>
            <a
              href={loginUrl}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#1a1208] border-b-2 border-[#ffba20] pb-0.5 hover:text-[#ffba20] transition-colors"
            >
              Get operator access
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </a>
          </div>
          <div className="lg:col-span-8 grid sm:grid-cols-2 gap-4">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.eyebrow} {...f} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 px-6 bg-[#f2ede6]">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px w-8 bg-[#ffba20]" />
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#8b7355] uppercase">From the Field</span>
          </div>
          <h2 className="font-['Fraunces',_serif] text-4xl font-black text-[#1a1208] mb-14">Operators in the pipeline.</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-[#faf8f5] border border-[#e8e0d4] p-8">
                <p className="text-[#3d2e1e] text-base leading-relaxed mb-8 italic">"{t.quote}"</p>
                <div className="flex items-center gap-3 border-t border-[#e8e0d4] pt-6">
                  <div className="w-9 h-9 bg-[#1a1208] rounded-full flex items-center justify-center text-[#ffba20] font-bold text-sm font-['Fraunces',_serif]">
                    {t.initial}
                  </div>
                  <div>
                    <div className="font-semibold text-[#1a1208] text-sm">{t.name}</div>
                    <div className="text-[#8b7355] text-xs">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-28 px-6 bg-[#1a1208]">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px w-8 bg-[#ffba20]" />
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#8b7355] uppercase">Access</span>
            <div className="h-px w-8 bg-[#ffba20]" />
          </div>
          <h2 className="font-['Fraunces',_serif] text-5xl lg:text-6xl font-black text-[#faf8f5] leading-tight mb-6">
            The pipeline is live.<br />
            <span className="text-[#ffba20]">Are you?</span>
          </h2>
          <p className="text-[#8b7355] text-lg mb-10 max-w-xl mx-auto">
            Signal Hunter OS is invite-only. Operators are vetted for deal focus, capital access, and execution velocity.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={loginUrl}
              className="inline-flex items-center justify-center gap-2 bg-[#ffba20] text-[#1a1208] text-base font-bold px-10 py-4 hover:bg-[#ffd060] transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">lock_open</span>
              Request Operator Access
            </a>
            <Link
              href="/explore"
              className="inline-flex items-center justify-center gap-2 border border-[#8b7355] text-[#8b7355] text-base font-medium px-10 py-4 hover:border-[#faf8f5] hover:text-[#faf8f5] transition-colors"
            >
              Browse Active Deals
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 px-6 border-t border-[#e8e0d4] bg-[#faf8f5]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-[#1a1208] rounded-sm flex items-center justify-center">
              <span className="material-symbols-outlined text-[#ffba20] text-[11px]">radar</span>
            </div>
            <span className="font-['Fraunces',_serif] font-black text-[#1a1208] text-xs">SIGNAL HUNTER OS</span>
          </div>
          <div className="text-[#8b7355] text-xs">
            A Third Signal Lab product. Acquisition intelligence for the independent operator.
          </div>
          <div className="flex items-center gap-6 text-xs text-[#8b7355]">
            <Link href="/explore" className="hover:text-[#1a1208] transition-colors">Browse Deals</Link>
            <a href={loginUrl} className="hover:text-[#1a1208] transition-colors">Sign In</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
