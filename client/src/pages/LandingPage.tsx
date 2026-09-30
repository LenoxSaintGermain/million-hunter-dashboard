import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { AlignmentPortrait } from "@/components/AlignmentPortrait";
import { HunterPublicShell } from "@/components/HunterPublicShell";
import { HUNTER_EXAMPLE, walkthroughMeasures } from "@shared/hunterWalkthrough";
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  FileSearch,
} from "lucide-react";


const CAPITAL_OPTIONS = [
  "Under $250K",
  "$250K – $500K",
  "$500K – $1M",
  "$1M – $2.5M",
  "$2.5M – $5M",
  "$5M+",
];

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

  if (submitted) return <div className="hunter-access-form" role="status"><CheckCircle2 aria-hidden="true" /><h3 className="font-serif text-2xl my-3">Request received.</h3><p>Your request is queued for manual review. Submission does not grant access; we will contact you about the next step.</p></div>;
  return <form onSubmit={handleSubmit} className="hunter-access-form">
    <p className="hunter-eyebrow">Request operator access</p>
    <div className="grid sm:grid-cols-2 gap-5 mb-5">
      <div><label htmlFor="access-name">Full name *</label><input id="access-name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required /></div>
      <div><label htmlFor="access-email">Email *</label><input id="access-email" autoComplete="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
    </div>
    <div className="mb-5"><label htmlFor="access-capital">Capital access · optional</label><select id="access-capital" value={capitalAccess} onChange={e => setCapitalAccess(e.target.value)}><option value="">Choose a range</option>{CAPITAL_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}</select></div>
    <div className="mb-5"><label htmlFor="access-thesis">Your deal or investment thesis · optional</label><textarea id="access-thesis" value={dealThesis} onChange={e => setDealThesis(e.target.value)} placeholder="What are you evaluating, and what needs checking? No confidential deal details here." rows={3} /></div>
    {error && <p role="alert" className="mb-3 text-sm">{error}</p>}
    <button type="submit" className="hunter-cta w-full" disabled={requestAccess.isPending}>{requestAccess.isPending ? "Submitting…" : "Submit access request"}</button>
    <p className="mt-3 text-xs text-muted-foreground">Your details are sent only when you submit. Access is reviewed manually.</p>
  </form>;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LandingPage() {
  return <HunterPublicShell><main className="hunter-public-main">
    <section className="hunter-spread"><div><p className="hunter-eyebrow">Evidence-first deal diligence & decision desk</p><h1>Pressure-test the deal before committing capital.</h1><p className="hunter-lead">For buyers, acquisition entrepreneurs, sponsors and investment teams. Put the seller’s claims, your assumptions and the missing evidence under scrutiny.</p><Link className="hunter-cta" href="/walkthrough">Work through a case <ArrowRight size={17} /></Link><p className="text-xs text-muted-foreground mt-3">No login. Illustrative data. No live agent calls.</p></div><AlignmentPortrait title={HUNTER_EXAMPLE.name} subtitle="Illustrative — composite deal, not a real customer" measures={walkthroughMeasures("asset", 0)} /></section>
    <section className="hunter-public-section"><p className="hunter-eyebrow">A working story, not another dashboard</p><h2>From interesting to investigated.</h2><div className="hunter-jobs">{[
      { Icon: FileSearch, title: "Start with the evidence", body: "A broker introduction, an existing target or a search result can start the case. Search is one entrypoint; the decision is the work." },
      { Icon: FileSearch, title: "Test the case", body: "Reveal the basis of an assessment. Change an assumption. See the modeled consequence without confusing it with verified evidence." },
      { Icon: ShieldCheck, title: "Prepare the decision", body: "Bring the case, the counterargument and the outstanding evidence into a review. Research informs the decision; you authorize the next action." },
    ].map(({ Icon, title, body }) => <article key={title}><Icon aria-hidden="true" size={23} /><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    <section className="hunter-public-section hunter-spread"><div><p className="hunter-eyebrow">One visual language. Different decisions.</p><h2>Assets to investigate.<br />Capital ideas to pressure-test.</h2><p className="mt-4">Business acquisition, property diligence and capital research keep their own measures and evidence. Capital execution remains practice trading only—not a route to live orders.</p><Link href="/walkthrough" className="inline-flex items-center gap-2 underline mt-4">Explore both workflows <ArrowRight size={16} /></Link></div><div className="border-l-2 border-amber pl-6"><h3 className="font-serif text-2xl">A claim is not a conclusion.</h3><p className="mt-3">Reported, modeled, corroborated and unknown are different states. The portrait keeps them separate. A source link does not independently verify a seller's claim.</p></div></section>
    <section className="hunter-public-section"><p className="hunter-eyebrow">Document-first journey · roadmap preview</p><h2>Bring your own deal evidence.</h2><p className="mt-4">The intended journey: bring a CIM, financial statements and contracts; review extracted claims and source references; challenge assumptions; prepare a decision with open questions intact.</p><p className="mt-3">PDF upload and ingestion are not connected here. This is a preview, not an upload tool. Signal Hunter sits upstream of Quality of Earnings (QoE), not in place of independent accounting, legal or lender diligence.</p></section>
    <section id="request-access" className="hunter-public-section hunter-spread"><div><p className="hunter-eyebrow">Your next case</p><h2>Bring a decision worth testing.</h2><p className="mt-4">Tell us what you are evaluating. This sends an access request—not deal documents, a search, a broker message or an investment instruction.</p></div><AccessRequestForm /></section>
  </main></HunterPublicShell>;
}
