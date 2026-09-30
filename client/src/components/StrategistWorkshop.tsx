import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { reviewKey, type StrategistReview, type AngleDisposition, type StrategistApproval } from "@shared/strategistReview";

type Props = {
  text: string; scope: "acquisition" | "property"; requestVersion: number;
  onChange: (text: string) => void; onApprove: (text: string, approval: StrategistApproval) => void; busy: boolean;
};

export function StrategistWorkshop({ text, scope, requestVersion, onChange, onApprove, busy }: Props) {
  const [review, setReview] = useState<StrategistReview | null>(null);
  const [feedback, setFeedback] = useState("");
  const [evaluatedKey, setEvaluatedKey] = useState("");
  const [original, setOriginal] = useState("");
  const [error, setError] = useState("");
  const [choices, setChoices] = useState<Record<number, AngleDisposition>>({});
  const [approved, setApproved] = useState(false);
  const [lens, setLens] = useState<"brief" | "preflight" | "angles">("brief");
  const key = reviewKey(text, scope, feedback);
  const latest = useRef(key); latest.current = key;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const refine = trpc.thesis.refine.useMutation();
  const stale = !!review && key !== evaluatedKey;
  useEffect(() => { setApproved(false); setChoices({}); }, [key]);

  async function evaluate() {
    if (refine.isPending || text.trim().length < 20) return;
    const started = key;
    setOriginal(previous => previous || text);
    setApproved(false); setError("");
    try {
      const result = await refine.mutateAsync({ thesisText: text, scope, feedback });
      if (!mounted.current) return;
      if (latest.current !== started) { setError("Your draft changed during review. Refresh to evaluate the current version."); return; }
      setReview(result); setChoices({}); setLens("brief");
      setEvaluatedKey(reviewKey(result.brief, scope, feedback));
      onChange(result.brief);
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Review unavailable. Your draft is unchanged."); }
  }
  // Only the explicit Refine action increments this value. Editing never makes a paid request.
  useEffect(() => { if (requestVersion > 0) void evaluate(); }, [requestVersion]);

  const unresolved = review?.angles.some((_, index) => !choices[index] || choices[index] === "pending");
  return <section className="strategist-workshop" aria-label="Strategist thesis workshop">
    <header><p className="eyebrow">STRATEGIST / WORKING REVIEW</p><h2>Make the idea hold up.</h2>
      <p>Preliminary reasoning, not diligence. No listings checked, tax qualification established, or investment approved.</p></header>
    <p role="status" className="strategist-status">{refine.isPending ? "Evaluating your draft…" : stale ? "Draft changed · evaluation and approvals are out of date" : review ? "Current draft reviewed · hypotheses remain unverified" : "Your idea comes first. Refinement does not save or launch a search."}</p>
    {error && <p role="alert">{error}</p>}
    <details className="strategist-feedback"><summary>Ask for a different angle or challenge an assumption</summary><label>Tell the Strategist what to change or challenge
      <textarea value={feedback} maxLength={2000} onChange={e => setFeedback(e.target.value)} placeholder="Less day-to-day involvement? Property ownership optional? Challenge the financing assumption…" />
    </label></details>
    <Button variant="outline" onClick={evaluate} disabled={refine.isPending || busy || text.trim().length < 20}>{review ? "Refresh evaluation" : "Refine & pre-evaluate"}</Button>
    {original && <details><summary>Your original starting point</summary><p>{original}</p></details>}
    {review && <>
      <nav className="strategist-lenses" aria-label="Review lenses">{([['brief','The brief'],['preflight','Pre-evaluation'],['angles',`Angles (${review.angles.length})`]] as const).map(([id,label]) => <button type="button" key={id} aria-pressed={lens===id} onClick={() => setLens(id)}>{label}</button>)}</nav>
      {lens === "brief" && <><section><p className="eyebrow">01 / EDITABLE BRIEF</p><h3>Your intent, sharpened.</h3>
        <p>{review.interpretation}</p>
        <label>Working thesis<textarea aria-label="Working thesis" value={text} maxLength={4000} onChange={e => onChange(e.target.value)} /></label>
        <p>Edit here or in your input. Changes appear in both; refresh the evaluation before approval.</p>
      </section>
      <details open><summary>Assumptions & questions to settle</summary>
        <h4>Proposed assumptions—not facts</h4>{review.assumptions.length ? <ul>{review.assumptions.map((v,i) => <li key={i}>{v}</li>)}</ul> : <p>No additional assumptions proposed.</p>}
        <h4>Still unanswered</h4>{review.questions.length ? <ul>{review.questions.map((v,i) => <li key={i}>{v}</li>)}</ul> : <p>No clarification questions returned. This is not evidence completeness.</p>}
      </details></>}
      {lens === "preflight" && <section className="strategist-preflight"><p className="eyebrow">02 / BEFORE YOU COMMIT</p><h3>What you may be taking on.</h3><p>{review.feasibility.summary}</p>
        <dl><dt>Capital & structure</dt><dd>{review.feasibility.capital}</dd><dt>Operating reality</dt><dd>{review.feasibility.operations}</dd></dl>
        <details><summary>Failure modes & the evidence to request</summary><h4>What could break it</h4><ul>{review.feasibility.failureModes.map((v,i) => <li key={i}>{v}</li>)}</ul><h4>Next evidence</h4><ul>{review.feasibility.nextEvidence.map((v,i) => <li key={i}>{v}</li>)}</ul></details>
      </section>}
      {lens === "angles" && <section><p className="eyebrow">03 / ALTERNATIVE ANGLES</p><h3>The opportunity behind the opportunity.</h3><p>Choose what deserves investigation. These ideas do not become search filters or silently change your asset scope.</p>
        {!review.angles.length && <p>No defensible alternative proposed from this input. More context may reveal one.</p>}
        {review.angles.map((angle, index) => <article className="strategist-angle" key={`${evaluatedKey}-${index}`}>
          <p className="eyebrow">{angle.scope} / UNVERIFIED HYPOTHESIS</p><h4>{angle.title}</h4><p>{angle.mechanism}</p>
          <details><summary>Why it could work—and how to disprove it</summary><dl>
            <dt>What must be true</dt><dd>{angle.mustBeTrue}</dd><dt>What could break it</dt><dd>{angle.downside}</dd>
            <dt>Evidence needed</dt><dd>{angle.evidence}</dd><dt>Next step</dt><dd>{angle.nextStep}</dd>
          </dl></details>
          {(angle.scope !== scope) && <p>Different angle: develop a separate linked thesis before any execution. This review does not create one.</p>}
          {(angle.professionalReview || angle.scope === "structure") && <p>Qualified legal/tax/financing review required. No eligibility or savings established.</p>}
          <label>Disposition for {angle.title}<select aria-label={`Disposition for ${angle.title}`} value={choices[index] ?? "pending"} disabled={stale || refine.isPending} onChange={e => { setApproved(false); setChoices(prev => ({ ...prev, [index]: e.target.value as AngleDisposition })); }}>
            <option value="pending">Awaiting your decision</option><option value="investigate">Approve for investigation only</option><option value="park">Park</option><option value="reject">Reject</option>
          </select></label>
        </article>)}
      </section>}
      <footer><p>Saving preserves your brief and angle decisions as review notes. It does not create angle tasks, change filters to match an alternative, or authorize execution.</p>
        {unresolved && <button type="button" onClick={() => setLens("angles")}>Review {review.angles.filter((_,i) => !choices[i] || choices[i] === "pending").length} undecided angle(s) →</button>}
        <label><input type="checkbox" checked={approved && !stale} disabled={stale || refine.isPending || unresolved} onChange={e => setApproved(e.target.checked)} /> I approve this brief for compilation, acknowledging its unanswered questions.</label>
        <Button onClick={() => { if (approved && !stale && !unresolved && !refine.isPending) onApprove(text, { review: { ...review, brief: text }, dispositions: review.angles.map((_, i) => choices[i] as "investigate" | "park" | "reject") }); }} disabled={!approved || stale || unresolved || refine.isPending || busy}>Approve brief & save search criteria</Button>
        <p>Compilation saves criteria. Launching research remains a separate action.</p>
      </footer>
    </>}
  </section>;
}
