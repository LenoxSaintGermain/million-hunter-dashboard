/**
 * Public share card for a property dossier — /asset-share/:token
 *
 * This is a HIGHLIGHT CARD, not the dossier. The server sends only what an
 * outsider may see: headline scores, the two Tier-1 gates, the economics
 * summary, top strengths/risks. No source URL, no seller notes.
 *
 * The CTA branches on who is looking:
 *   signed in  → straight to the full dossier
 *   signed out → request access (publicAccess.requestAccess), or sign in if
 *                they already have an account
 */
import { useState } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { Loader2, MapPin, ArrowRight, Lock, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAskingPrice } from "@shared/pricing";

const TIER_LABEL: Record<string, string> = {
  tier1: "Tier 1", fasttrack: "Fast-Track", tier2: "Tier 2", tier3: "Tier 3", archive: "Archive",
};

function RequestAccess({ assetName }: { assetName: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [thesis, setThesis] = useState("");
  const [sent, setSent] = useState(false);

  const request = trpc.publicAccess.requestAccess.useMutation({
    onSuccess: () => { setSent(true); toast.success("Request sent."); },
    onError: (e) => toast.error(e.message),
  });

  if (sent) {
    return (
      <div className="border border-rule bg-paper p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-sage shrink-0 mt-0.5" />
          <div>
            <p className="font-card-title text-[18px] text-ink leading-tight mb-1">Request received</p>
            <p className="font-body-base text-[13px] text-muted-foreground leading-relaxed">
              We'll review and email you an invitation. Once you're in, this link opens the full
              dossier — scorecard, economics, provenance, and sourcing.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-rule bg-paper p-6">
      <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-2">
        Request access
      </p>
      <p className="font-body-base text-[13px] text-muted-foreground leading-relaxed mb-5">
        The full dossier for {assetName} is available to approved members.
      </p>

      <div className="space-y-3">
        <div>
          <Label className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 mt-1 border-rule bg-transparent" />
        </div>
        <div>
          <Label className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 mt-1 border-rule bg-transparent" />
        </div>
        <div>
          <Label className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Your thesis (optional)</Label>
          <Input value={thesis} onChange={(e) => setThesis(e.target.value)} placeholder="What are you looking for?" className="h-9 mt-1 border-rule bg-transparent" />
        </div>
      </div>

      <button
        onClick={() => request.mutate({ name: name.trim(), email: email.trim(), dealThesis: thesis.trim() || undefined })}
        disabled={request.isPending || !name.trim() || !email.trim()}
        className="w-full mt-5 flex items-center justify-center gap-2 bg-ink text-bone font-eyebrow text-eyebrow px-4 py-2.5 rounded-full hover:opacity-90 transition-all uppercase tracking-widest disabled:opacity-50">
        {request.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
        Request access
      </button>

      <p className="font-body-base text-[12px] text-muted-foreground text-center mt-4">
        Already a member?{" "}
        <a href={getLoginUrl()} className="text-amber hover:underline">Sign in</a>
      </p>
    </div>
  );
}

export default function AssetShare() {
  const [, params] = useRoute("/asset-share/:token");
  const token = params?.token ?? "";
  const q = trpc.assetShare.getByToken.useQuery({ token }, { enabled: !!token, retry: false });

  if (q.isLoading) {
    return (
      <div className="min-h-screen bg-bone flex items-center justify-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin text-amber" />
        <span className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Loading</span>
      </div>
    );
  }

  if (q.error || !q.data) {
    return (
      <div className="min-h-screen bg-bone flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="font-card-title text-card-title text-ink mb-3">This link is no longer active</p>
          <p className="font-body-base text-body-base text-muted-foreground">
            {q.error?.message ?? "The share link has expired or was revoked. Ask your contact for a fresh one."}
          </p>
        </div>
      </div>
    );
  }

  const { card, viewer } = q.data;
  const conf = Math.round(card.confidenceScore * 100);

  return (
    <div className="min-h-screen bg-bone py-12 px-6">
      <div className="max-w-[860px] mx-auto">

        {/* Masthead */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">
            {card.className}
          </span>
          <span className="w-8 h-px bg-rule" />
          <span className="font-eyebrow text-eyebrow text-amber border border-amber/40 px-2 py-0.5 rounded-sm uppercase tracking-widest">
            {TIER_LABEL[card.tier] ?? card.tier}
          </span>
          <span className="font-eyebrow text-eyebrow text-muted-foreground border border-rule px-2 py-0.5 rounded-sm uppercase tracking-widest">
            Market {card.marketTier}
          </span>
          <span className="font-eyebrow text-eyebrow text-muted-foreground flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5" />{card.city}, {card.state}
          </span>
        </div>

        <h1 className="font-hero-h1 text-[clamp(2rem,5vw,3.5rem)] text-ink leading-[1.05] mb-8">{card.name}</h1>

        {/* Headline numbers */}
        <div className="grid grid-cols-3 gap-0 border border-rule divide-x divide-rule mb-8">
          {[
            { label: "Rank Score", value: String(card.rankScore), accent: "text-amber" },
            { label: "Composite", value: String(card.compositeScore), accent: "text-ink" },
            { label: "Confidence", value: `${conf}%`, accent: conf >= 80 ? "text-sage" : "text-amber" },
          ].map((m) => (
            <div key={m.label} className="px-5 py-5 bg-paper">
              <p className={cn("font-data-mono text-section-h2 leading-none", m.accent)}>{m.value}</p>
              <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mt-2">{m.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10">
          <div className="space-y-8">
            {/* Asset facts */}
            <div className="grid grid-cols-3 gap-6 border-t border-b border-rule py-5">
              {[
                { label: "Asking Price", value: formatAskingPrice(card.askingPrice).display, hint: formatAskingPrice(card.askingPrice).hint },
                { label: "Square Feet", value: card.squareFootage ? Number(card.squareFootage).toLocaleString() : "—" },
                { label: "Year Built", value: card.yearBuilt ? String(card.yearBuilt) : "—" },
              ].map((x) => (
                <div key={x.label}>
                  <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-2">{x.label}</p>
                  <p className="font-data-mono text-[20px] text-ink leading-none">{x.value}</p>
                  {(x as any).hint && <p className="font-body-base text-[11px] text-muted-foreground mt-1 leading-snug">{(x as any).hint}</p>}
                </div>
              ))}
            </div>

            {/* Tier-1 gates */}
            <div>
              <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-3">Tier-1 gates</p>
              <div className="divide-y divide-rule border-t border-b border-rule">
                {card.gates.map((g) => (
                  <div key={g.key} className="py-2.5 flex items-baseline gap-3">
                    <span className="font-eyebrow text-eyebrow text-amber w-4">{g.key}</span>
                    <span className="flex-1 font-body-base text-[13px] text-ink">{g.label}</span>
                    <span className={cn("font-eyebrow text-eyebrow uppercase tracking-widest", g.pass ? "text-sage" : "text-clay")}>
                      {g.pass ? "pass" : "fail"}
                    </span>
                    <span className="font-data-mono text-[12px] text-muted-foreground w-12 text-right">{g.score}/{g.max}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Economics summary */}
            {card.economics && (
              <div>
                <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-3">Deal economics</p>
                <div className="grid grid-cols-3 gap-0 border border-rule divide-x divide-rule">
                  {card.economics.headline.map((x: { label: string; display: string }) => (
                    <div key={x.label} className="px-4 py-4 bg-paper">
                      <p className="font-data-mono text-[20px] text-ink leading-none">{x.display}</p>
                      <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mt-2">{x.label}</p>
                    </div>
                  ))}
                </div>
                <p className="font-body-base text-[12px] text-muted-foreground leading-relaxed mt-3">
                  {card.economics.disclaimer}
                </p>
              </div>
            )}

            {/* Strengths / risks */}
            {(card.strengths.length > 0 || card.risks.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-3">Strengths</p>
                  {card.strengths.length
                    ? card.strengths.map((x, i) => (
                        <p key={i} className="font-body-base text-[13px] text-ink/80 leading-relaxed mb-1.5">
                          <span className="text-sage">✓</span> {x}
                        </p>
                      ))
                    : <p className="font-body-base text-[13px] text-muted-foreground">None recorded.</p>}
                </div>
                <div>
                  <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-3">Risks</p>
                  {card.risks.length
                    ? card.risks.map((x, i) => (
                        <p key={i} className="font-body-base text-[13px] text-ink/80 leading-relaxed mb-1.5">
                          <span className="text-clay">!</span> {x}
                        </p>
                      ))
                    : <p className="font-body-base text-[13px] text-muted-foreground">None recorded.</p>}
                </div>
              </div>
            )}

            {card.unverifiedCount > 0 && (
              <p className="font-body-base text-[12px] text-muted-foreground border-l-2 border-amber pl-4">
                {card.unverifiedCount} of 5 critical fields are still unverified — this asset is
                capped below Tier 1 until they are confirmed.
              </p>
            )}
          </div>

          {/* CTA rail */}
          <aside className="lg:sticky lg:top-8 self-start">
            {viewer.isAuthenticated ? (
              <div className="border border-rule bg-paper p-6">
                <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-3">
                  You're signed in
                </p>
                <p className="font-body-base text-[13px] text-muted-foreground leading-relaxed mb-5">
                  Open the full dossier for the complete A–G scorecard, underwriting math,
                  diligence checklist, and sourcing.
                </p>
                <Link href={`/wingate/asset/${card.id}`}>
                  <span className="w-full flex items-center justify-center gap-2 bg-ink text-bone font-eyebrow text-eyebrow px-4 py-2.5 rounded-full hover:opacity-90 transition-all uppercase tracking-widest cursor-pointer">
                    Open full dossier <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>
              </div>
            ) : (
              <RequestAccess assetName={card.name} />
            )}
          </aside>
        </div>

        <p className="font-body-base text-[11px] text-muted-foreground mt-12 pt-6 border-t border-rule">
          Shared preview · Signal Hunter OS. Figures marked as estimates are modeled, not verified
          underwriting.
        </p>
      </div>
    </div>
  );
}
