import { useState, useEffect, useRef } from "react";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  TrendingUp,
  Vote,
  Brain,
  Bot,
  Radar,
  ArrowRight,
  ArrowRightLeft,
  LockOpen,
  Search,
  CheckCircle2,
  Timer,
  Lock,
  ShieldCheck,
  AlertTriangle,
  FileSearch,
  Layers,
  Zap,
} from "lucide-react";

// ─── Static data ─────────────────────────────────────────────────────────────
const STATS = [
  { value: "70–90%", label: "Acquisition failure rate, industry-wide" },
  { value: "54%", label: "Avg. revenue concentration in failed deals" },
  { value: "3.1×", label: "Avg. add-back inflation in broker-presented SDE" },
  { value: "48h", label: "From listing to full IC verdict" },
];

const FEATURES = [
  {
    eyebrow: "RED TEAM — ALWAYS ON",
    title: "The deal team that argues against you. On purpose.",
    body: "Every analysis runs a mandatory devil's advocate pass. The Red Team stress-tests the thesis, surfaces the failure modes, and tells you what the broker's deck buried in footnote 14 — before you've spent a dollar on diligence.",
    Icon: ShieldCheck,
  },
  {
    eyebrow: "QUALITY OF EARNINGS PROXY",
    title: "The add-backs that aren't add-backs.",
    body: "Owner salary above market replacement. Personal vehicles. Family consulting payments. One-time write-offs claimed as recurring. The QoE proxy flags every line before you commission the $25k report.",
    Icon: FileSearch,
  },
  {
    eyebrow: "IC CONSENSUS",
    title: "Three independent agents. One verdict. The divergence is the signal.",
    body: "The Structuralist, The Restructurer, and The Market Analyst run parallel investment committee reviews on every deal. When they disagree, the divergence flag tells you exactly where the risk lives — and why it matters.",
    Icon: Vote,
  },
  {
    eyebrow: "OWNER DEPENDENCE AUDIT",
    title: "How many hours does the business actually need the owner?",
    body: "The most common post-close surprise isn't financial — it's operational. The Owner Dependence Audit maps key-person risk, management layer gaps, and the real replacement cost before you're locked in.",
    Icon: Brain,
  },
  {
    eyebrow: "TIDE CAPITAL FLOW",
    title: "The federal government telegraphs its moves. Most people aren't listening.",
    body: "TIDE reads USASpending disbursements, Federal Register actions, and FEC filings to surface capital convergence events 60–90 days before they appear in deal flow.",
    Icon: TrendingUp,
  },
  {
    eyebrow: "SENTINEL SIGNALS",
    title: "The macro environment is a signal, not a headline.",
    body: "Rate shifts, SBA policy changes, sector tailwinds, and geographic arbitrage windows — weighted against your live pipeline. The market is always speaking. This is how you hear it.",
    Icon: Radar,
  },
];

const TESTIMONIALS = [
  {
    quote: "I ran three deals through the IC Review before my first LOI. The Structuralist flagged a cash flow restatement risk on deal two that the broker's deck buried in footnote 14. Saved me from a $2.1M mistake.",
    name: "Marcus T.",
    role: "Independent Sponsor, Southeast US",
    initial: "M",
  },
  {
    quote: "The Red Team flagged 54% customer concentration on a deal I was ready to sign. Both relationships were personal to the owner. The business would have been worth $400k, not $2.1M, six months after close.",
    name: "Priya S.",
    role: "Search Fund Operator, Atlanta",
    initial: "P",
  },
  {
    quote: "The Owner Dependence Audit showed the owner was working 60 hours a week and there was no management layer. The replacement cost alone erased the stated margins. We walked.",
    name: "Derek W.",
    role: "Acquisition Entrepreneur, Charlotte",
    initial: "D",
  },
];

const CAPITAL_OPTIONS = [
  "Under $250K",
  "$250K – $500K",
  "$500K – $1M",
  "$1M – $2.5M",
  "$2.5M – $5M",
  "$5M+",
];

const FAILURE_MODES = [
  {
    stat: "54%",
    label: "of failed deals had customer concentration >40% in owner-personal relationships",
    icon: AlertTriangle,
  },
  {
    stat: "3.1×",
    label: "average add-back inflation ratio in broker-presented SDE vs. verified QoE",
    icon: BarChart3,
  },
  {
    stat: "87%",
    label: "of post-close operational failures trace to undisclosed key-person dependency",
    icon: Layers,
  },
  {
    stat: "18mo",
    label: "median time-to-failure in deals with government contract re-compete risk at close",
    icon: Timer,
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
function FeatureCard({ eyebrow, title, body, Icon, index }: { eyebrow: string; title: string; body: string; Icon: React.ComponentType<{ className?: string }>; index: number }) {
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
      className="group border border-[#e8e0d4] bg-[#faf8f5] p-8 transition-all duration-700 hover:border-[#ffba20] hover:shadow-[0_4px_32px_rgba(255,186,32,0.08)]"
      style={{ transitionDelay: `${index * 80}ms`, opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)" }}
    >
      <div className="flex items-start gap-4 mb-5">
        <Icon className="text-[#ffba20] w-5 h-5 mt-0.5 shrink-0" />
        <span className="text-[10px] font-bold tracking-[0.2em] text-[#8b7355] uppercase pt-0.5">{eyebrow}</span>
      </div>
      <h3 className="font-['Fraunces',_serif] text-xl font-bold text-[#1a1208] mb-3 leading-snug group-hover:text-[#3d2e1e] transition-colors">{title}</h3>
      <p className="text-[#5c4a32] text-sm leading-relaxed">{body}</p>
    </div>
  );
}

// ─── Access Request Form ──────────────────────────────────────────────────────
function AccessRequestForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dealThesis, setDealThesis] = useState("");
  const [capitalAccess, setCapitalAccess] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const requestAccess = trpc.publicAccess.requestAccess.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (err) => setError(err.message || "Something went wrong. Please try again."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    requestAccess.mutate({ name: name.trim(), email: email.trim(), dealThesis: dealThesis.trim() || undefined, capitalAccess: capitalAccess || undefined });
  };

  if (submitted) {
    return (
      <div className="bg-[#1a1208] border border-[#ffba20]/30 p-10 text-center">
        <CheckCircle2 className="text-[#ffba20] w-10 h-10 mb-4 mx-auto" />
        <h3 className="font-['Fraunces',_serif] text-2xl font-black text-[#faf8f5] mb-3">Request received.</h3>
        <p className="text-[#8b7355] text-sm max-w-sm mx-auto">
          We review every request manually. If your thesis and capital access align with the platform's operator profile, you'll hear from us within 48 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#0f0c08] border border-[#3d2e1e] p-8 lg:p-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-px w-8 bg-[#ffba20]" />
        <span className="text-[10px] font-bold tracking-[0.2em] text-[#8b7355] uppercase">Request Operator Access</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-5 mb-5">
        <div>
          <label className="block text-[10px] font-bold tracking-[0.15em] text-[#8b7355] uppercase mb-2">Full Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full bg-[#1a1208] border border-[#3d2e1e] text-[#faf8f5] placeholder-[#5c4a32] px-4 py-3 text-sm focus:outline-none focus:border-[#ffba20] transition-colors"
            required
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-[0.15em] text-[#8b7355] uppercase mb-2">Email Address *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-[#1a1208] border border-[#3d2e1e] text-[#faf8f5] placeholder-[#5c4a32] px-4 py-3 text-sm focus:outline-none focus:border-[#ffba20] transition-colors"
            required
          />
        </div>
      </div>
      <div className="mb-5">
        <label className="block text-[10px] font-bold tracking-[0.15em] text-[#8b7355] uppercase mb-2">Capital Access</label>
        <select
          value={capitalAccess}
          onChange={(e) => setCapitalAccess(e.target.value)}
          className="w-full bg-[#1a1208] border border-[#3d2e1e] text-[#faf8f5] px-4 py-3 text-sm focus:outline-none focus:border-[#ffba20] transition-colors appearance-none"
        >
          <option value="">Select range...</option>
          {CAPITAL_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
      <div className="mb-7">
        <label className="block text-[10px] font-bold tracking-[0.15em] text-[#8b7355] uppercase mb-2">
          Deal Thesis <span className="text-[#5c4a32] normal-case tracking-normal font-normal">(optional — increases approval odds)</span>
        </label>
        <textarea
          value={dealThesis}
          onChange={(e) => setDealThesis(e.target.value)}
          placeholder="What type of business are you targeting? What's your acquisition thesis? What markets are you focused on?"
          rows={3}
          className="w-full bg-[#1a1208] border border-[#3d2e1e] text-[#faf8f5] placeholder-[#5c4a32] px-4 py-3 text-sm focus:outline-none focus:border-[#ffba20] transition-colors resize-none"
        />
      </div>
      {error && (
        <p className="text-red-400 text-sm mb-4">{error}</p>
      )}
      <button
        type="submit"
        disabled={requestAccess.isPending}
        className="w-full bg-[#ffba20] text-[#1a1208] font-bold text-sm py-4 hover:bg-[#ffd060] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {requestAccess.isPending ? (
          <>
            <Zap className="w-4 h-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <LockOpen className="w-4 h-4" />
            Submit Access Request
          </>
        )}
      </button>
      <p className="text-[#5c4a32] text-xs text-center mt-4">
        Access is reviewed manually. We approve operators with a defined thesis and verified capital access.
      </p>
    </form>
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
              <Radar className="text-[#ffba20] w-4 h-4" />
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
              Sign In
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="pt-32 pb-24 px-6 max-w-7xl mx-auto">
        <div className="max-w-4xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px w-12 bg-[#ffba20]" />
            <span className="text-[10px] font-bold tracking-[0.25em] text-[#8b7355] uppercase">Acquisition Diligence Intelligence</span>
          </div>
          <h1
            className="font-['Fraunces',_serif] font-black text-[#1a1208] leading-[0.92] mb-8"
            style={{ fontSize: "clamp(3.5rem, 9vw, 7rem)" }}
          >
            Most deals fail<br />
            <span className="text-[#ffba20]">before they close.</span>
          </h1>
          <p className="text-[#5c4a32] text-xl leading-relaxed max-w-2xl mb-4">
            70–90% of acquisitions fail to achieve their stated objectives. The failure modes are predictable. The signals are knowable before close. Signal Hunter OS surfaces them before you've spent a dollar on diligence.
          </p>
          <p className="text-[#8b7355] text-base leading-relaxed max-w-xl mb-10">
            Customer concentration. Add-back inflation. Owner dependence. Contract cliffs. The Red Team finds them. The IC votes on them. You decide with full information.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="#request-access"
              onClick={(e) => { e.preventDefault(); document.getElementById("request-access")?.scrollIntoView({ behavior: "smooth" }); }}
              className="inline-flex items-center justify-center gap-2 bg-[#1a1208] text-[#faf8f5] text-base font-semibold px-8 py-4 hover:bg-[#3d2e1e] transition-colors"
            >
              <LockOpen className="text-[#ffba20] w-5 h-5" />
              Request Operator Access
            </a>
            <Link
              href="/demo-tour"
              className="inline-flex items-center justify-center gap-2 border border-[#1a1208] text-[#1a1208] text-base font-medium px-8 py-4 hover:bg-[#1a1208] hover:text-[#faf8f5] transition-colors"
            >
              <Search className="w-5 h-5" />
              See a live diligence run
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center justify-center gap-2 text-[#5c4a32] text-base font-medium px-4 py-4 hover:text-[#1a1208] transition-colors underline underline-offset-4 decoration-[#ffba20]"
            >
              Browse active deals
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Decorative rule */}
        <div className="mt-20 border-t border-[#e8e0d4]" />
      </section>

      {/* ── Failure mode stats strip ── */}
      <section className="py-16 px-6 bg-[#1a1208]">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-10">
            <div className="h-px w-8 bg-[#ffba20]" />
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#8b7355] uppercase">The Failure Modes Are Knowable</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {FAILURE_MODES.map((f) => (
              <div key={f.stat} className="border-l-2 border-[#ffba20]/30 pl-5">
                <div className="font-['Fraunces',_serif] text-4xl lg:text-5xl font-black text-[#ffba20] leading-none mb-3">{f.stat}</div>
                <p className="text-[#8b7355] text-xs leading-relaxed">{f.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="py-16 px-6 bg-[#f2ede6]">
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
              Six diligence layers. Before the teaser.
            </h2>
            <p className="text-[#5c4a32] leading-relaxed mb-8">
              The failure modes in acquisition are predictable. The signals are in the data. Signal Hunter OS reads them before you open the broker deck — so you walk in knowing what you're actually buying.
            </p>
            <a
              href="#request-access"
              onClick={(e) => { e.preventDefault(); document.getElementById("request-access")?.scrollIntoView({ behavior: "smooth" }); }}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#1a1208] border-b-2 border-[#ffba20] pb-0.5 hover:text-[#ffba20] transition-colors"
            >
              Get operator access
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          <div className="lg:col-span-8 grid sm:grid-cols-2 gap-4">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.eyebrow} {...f} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo CTA strip ── */}
      <section className="py-16 px-6 bg-[#1a1208]">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px w-8 bg-[#ffba20]" />
              <span className="text-[10px] font-bold tracking-[0.2em] text-[#8b7355] uppercase">Live Demo</span>
            </div>
            <h2 className="font-['Fraunces',_serif] text-3xl lg:text-4xl font-black text-[#faf8f5] leading-tight mb-3">
              Watch the IC vote no on a $2.1M deal.<br />
              <span className="text-[#ffba20]">See exactly why.</span>
            </h2>
            <p className="text-[#8b7355] text-base max-w-xl">
              A real composite deal. Broker sheet signals only. Three agents. Unanimous NO. The failure modes were all knowable before close.
            </p>
          </div>
          <Link
            href="/demo-tour"
            className="shrink-0 inline-flex items-center gap-2 bg-[#ffba20] text-[#1a1208] font-bold text-sm px-8 py-4 hover:bg-[#ffd060] transition-colors whitespace-nowrap"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Run the demo diligence
          </Link>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 px-6 bg-[#f2ede6]">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px w-8 bg-[#ffba20]" />
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#8b7355] uppercase">From the Field</span>
          </div>
          <h2 className="font-['Fraunces',_serif] text-4xl font-black text-[#1a1208] mb-14">Deals that didn't close. On purpose.</h2>
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

      {/* ── Access Request Form Section ── */}
      <section id="request-access" className="py-28 px-6 bg-[#1a1208]">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            {/* Left — editorial copy */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px w-8 bg-[#ffba20]" />
                <span className="text-[10px] font-bold tracking-[0.2em] text-[#8b7355] uppercase">Access</span>
              </div>
              <h2 className="font-['Fraunces',_serif] text-5xl lg:text-6xl font-black text-[#faf8f5] leading-tight mb-6">
                The diligence<br />
                <span className="text-[#ffba20]">that protects you.</span>
              </h2>
              <p className="text-[#8b7355] text-lg mb-8 leading-relaxed">
                Signal Hunter OS is invite-only. Access is granted to operators with a defined deal thesis, verified capital access, and a bias toward execution over deliberation.
              </p>
              <div className="space-y-4">
                {[
                  { Icon: ShieldCheck, text: "Manual review — every request is read by a human" },
                  { Icon: Timer, text: "48-hour response for qualified operators" },
                  { Icon: Lock, text: "No credit card required to request access" },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-3">
                    <item.Icon className="text-[#ffba20] w-4 h-4 shrink-0" />
                    <span className="text-[#8b7355] text-sm">{item.text}</span>
                  </div>
                ))}
              </div>
              <div className="mt-10 pt-8 border-t border-[#3d2e1e]">
                <p className="text-[#5c4a32] text-sm mb-4">Already have access?</p>
                <a
                  href={loginUrl}
                  className="inline-flex items-center gap-2 text-[#faf8f5] text-sm font-medium border-b border-[#8b7355] pb-0.5 hover:border-[#ffba20] hover:text-[#ffba20] transition-colors"
                >
                  Sign in to your account
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Right — form */}
            <AccessRequestForm />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 px-6 border-t border-[#e8e0d4] bg-[#faf8f5]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-[#1a1208] rounded-sm flex items-center justify-center">
              <Radar className="text-[#ffba20] w-3 h-3" />
            </div>
            <span className="font-['Fraunces',_serif] font-black text-[#1a1208] text-xs">SIGNAL HUNTER OS</span>
          </div>
          <div className="text-[#8b7355] text-xs">
            A Third Signal Lab product. Acquisition diligence intelligence for the independent operator.
          </div>
          <div className="flex items-center gap-6 text-xs text-[#8b7355]">
            <Link href="/explore" className="hover:text-[#1a1208] transition-colors">Browse Deals</Link>
            <Link href="/demo-tour" className="hover:text-[#1a1208] transition-colors">Demo</Link>
            <a href={loginUrl} className="hover:text-[#1a1208] transition-colors">Sign In</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
