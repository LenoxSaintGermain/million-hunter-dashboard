import React from "react";

const REQUIREMENTS = {
  acquisition: [
    ["Economics", "Price range · cash flow · financing limits", "Listing capture, then reconciled financials"],
    ["Durability", "What makes the cash repeat?", "Contracts, renewals and customer concentration"],
    ["Handover", "What must survive the owner’s exit?", "Management, licenses and operating responsibilities"],
  ],
  property: [
    ["Income", "NOI · price · occupancy requirements", "Rent roll, leases and operating expenses"],
    ["Condition", "Building age · acceptable capital work", "Inspections, condition and capital expenditure records"],
    ["Use", "Location · permitted use · historic status", "Zoning and register records, not listing claims"],
  ],
  capital: [
    ["Premise", "Catalyst · mechanism · expiry", "Dated sources and disconfirming evidence"],
    ["Exposure", "Allocation · overlap · maximum loss", "Current account and portfolio checks"],
    ["Exit", "Invalidation · price · time boundary", "A reviewed plan before any paper order"],
  ],
} as const;

/** Guidance, never inferred evidence or an invented thesis-fit score. */
export function ThesisRequirementPortrait({ scope, hasDraft }: { scope: keyof typeof REQUIREMENTS; hasDraft: boolean }) {
  return <section className="thesis-requirement-portrait" aria-label="Thesis to reality requirements">
    <header><span className="eyebrow">Thesis → reality / requirements map</span><h2>What must be true?</h2>
      <p>Your criteria set the target. Evidence has to meet it.</p></header>
    <div className="thesis-portrait-key"><span>YOUR TARGET</span><span>REALITY TO ESTABLISH</span></div>
    {REQUIREMENTS[scope].map(([name, target, basis], index) => <details key={name} className="thesis-requirement-row">
      <summary><span className="thesis-requirement-number">0{index + 1}</span><span><strong>{name}</strong><em>{target}</em></span><span className="thesis-open-marker" aria-label="Not assessed">○</span></summary>
      <p><strong>Evidence to seek:</strong> {basis}. This is a prompt, not an extracted or verified finding.</p>
    </details>)}
    <footer><strong>{hasDraft ? "Draft entered. Requirements not compiled yet." : "Set the target before judging the opportunity."}</strong>
      <p>Open a row for the evidence to seek. These hints are not saved criteria. Create the thesis to review its actual requirements.</p></footer>
  </section>;
}
