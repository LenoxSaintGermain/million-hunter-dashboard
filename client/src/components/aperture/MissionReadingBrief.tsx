import React from "react";
import "@/styles/mission-reading-brief.css";

/** Presentation only: preserve every word, split only at explicit section cues. */
export function missionReadingPassages(text: string) {
  return text.split(/\n\s*\n|(?=(?:Evidence basis:|All eligibility gates are required:|Use shares only,|Preserve cash if|Invalidate if|Close by|Desired ending value))/g).filter(part => part.trim()).map(part => {
    const body = part.trim();
    const label = body.startsWith("Evidence basis:") ? "The stated evidence" : body.startsWith("All eligibility gates") ? "Conditions to satisfy" : body.startsWith("Use shares only,") ? "Position & loss boundaries" : body.startsWith("Preserve cash if") ? "When to stand aside" : body.startsWith("Invalidate if") ? "What breaks the thesis" : body.startsWith("Close by") ? "Exit & review" : body.startsWith("Desired ending value") ? "The aspiration—not a forecast" : "The research instruction";
    return { label, body };
  });
}

export function MissionReadingBrief({ title, text, horizon, edited }: { title: string; text: string; horizon: string; edited: boolean }) {
  const passages = missionReadingPassages(text);
  return <div className="mission-reading-brief">
    <header className="mission-brief-heading"><p>Research brief / paper only</p><h3>{title.length <= 100 ? title : "Your capital mission"}</h3><span>{edited ? "Run-specific draft · saved thesis unchanged" : "Saved wording · review before this run"}</span></header>
    <div className="mission-brief-spread">
      <div className="mission-brief-copy">{passages.map((passage,i) => <section key={i} className="mission-brief-passage"><h4><span aria-hidden="true">{String(i+1).padStart(2,"0")}</span>{passage.label}</h4><p>{passage.body}</p></section>)}{!passages.length && <p>No mission wording yet. Choose Edit mission to write the instruction.</p>}</div>
      <aside className="mission-brief-margin" aria-label="Mission review notes"><p className="mission-brief-eyebrow">Before you continue</p><h4>A saved belief.<br/>A fresh decision.</h4><dl><dt>Selected horizon</dt><dd>{horizon}</dd><dt>Execution boundary</dt><dd>Paper research only</dd></dl><p>Dates and conditions in saved wording are not refreshed automatically. Check that they still describe the run you intend.</p><p>Evidence quoted in the thesis is context—not a new verification. Loading it does not satisfy its entry conditions.</p><div className="mission-brief-next"><span>Next / account & risk</span><p>Confirm the capital and loss limit. A target never increases allowed risk.</p></div></aside>
    </div>
  </div>;
}
