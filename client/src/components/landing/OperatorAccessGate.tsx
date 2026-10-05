import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, ShieldCheck, Lock, ArrowRight, Shield } from "lucide-react";

const DESK_TYPES = [
  "Search Fund / Independent Sponsor (Acquisition Diligence)",
  "Family Office Principal / High-Net-Worth Allocator",
  "Liquid Macro Portfolio Manager / Options Allocator (Capital Aperture)",
  "Corporate Development / PE Deal Lead",
  "M&A Advisor / Diligence Specialist",
];

const TARGET_ASSET_CLASSES = [
  "B2B Commercial / Facility Services ($1M–$10M EV)",
  "Light Industrial / Distribution & Logistics",
  "HVAC / Plumbing / Essential Field Trade Routes",
  "Concentrated Liquid Equity / Macro Volatility Options",
  "Multi-Location Specialty Healthcare / Vet",
  "Other Direct Private Asset",
];

export function OperatorAccessGate() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [deskType, setDeskType] = useState("");
  const [assetClass, setAssetClass] = useState("");
  const [dealContext, setDealContext] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const requestAccess = trpc.publicAccess.requestAccess.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: err =>
      setError(err.message || "Failed to submit request. Please try again."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !email.trim()) {
      setError("Full name and institutional email are required.");
      return;
    }

    const compiledThesis = [
      deskType ? `Desk Type: ${deskType}` : "",
      assetClass ? `Target Asset Class: ${assetClass}` : "",
      dealContext.trim() ? `Context: ${dealContext.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    requestAccess.mutate({
      name: name.trim(),
      email: email.trim(),
      dealThesis: compiledThesis || undefined,
    });
  };

  if (submitted) {
    return (
      <div className="sh-single-col-gate" role="status">
        <div className="sh-gate-success-box">
          <div className="flex items-center gap-2 text-[oklch(0.35_0.08_155)] mb-3">
            <CheckCircle2 size={24} aria-hidden="true" />
            <h3 className="font-serif text-2xl m-0 text-[var(--ink)]">Operator Mandate Received</h3>
          </div>
          <p className="text-sm leading-relaxed text-[var(--sh-fg-2)] mb-4">
            Your credentials have been submitted for manual operator qualification. Signal Hunter is
            deployed selectively to active searchers, family offices, and sovereign allocators.
          </p>
          <div className="p-3 bg-[var(--paper)] border-l-2 border-[var(--sage)] text-xs font-mono text-[var(--sh-fg-3)]">
            Confirmation routed to {email}. Typical turnaround: under 24 business hours.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="request-access" className="sh-single-col-gate">
      <div className="sh-gate-header">
        <div className="sh-hero-eyebrow">
          <span aria-hidden="true" />
          <span>Operator Qualification · Private Tenant</span>
        </div>
        <h3 className="font-serif text-3xl text-[var(--ink)] m-0">Request Sovereign Desk Access</h3>
        <p className="text-sm text-[var(--sh-fg-2)] mt-2 max-w-xl mx-auto">
          Tell us about your mandate. Signal Hunter is designed for principals and allocators
          evaluating active deals or concentrated risk.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="sh-single-col-form">
        {/* Field 1: Full Name */}
        <div className="sh-form-field">
          <label htmlFor="gate-name" className="sh-form-label">
            Full Name *
          </label>
          <input
            id="gate-name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Marcus Vance"
            className="sh-form-input"
          />
        </div>

        {/* Field 2: Email */}
        <div className="sh-form-field">
          <label htmlFor="gate-email" className="sh-form-label">
            Institutional / Work Email *
          </label>
          <input
            id="gate-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="marcus@vancecapital.com"
            className="sh-form-input"
          />
        </div>

        {/* Field 3: Desk Type */}
        <div className="sh-form-field">
          <label htmlFor="gate-desk" className="sh-form-label">
            Operating Desk Type *
          </label>
          <select
            id="gate-desk"
            required
            value={deskType}
            onChange={e => setDeskType(e.target.value)}
            className="sh-form-select"
          >
            <option value="">Select your operating desk</option>
            {DESK_TYPES.map(desk => (
              <option key={desk} value={desk}>
                {desk}
              </option>
            ))}
          </select>
        </div>

        {/* Field 4: Current Target Asset Class */}
        <div className="sh-form-field">
          <label htmlFor="gate-asset" className="sh-form-label">
            Current Target Asset Class *
          </label>
          <select
            id="gate-asset"
            required
            value={assetClass}
            onChange={e => setAssetClass(e.target.value)}
            className="sh-form-select"
          >
            <option value="">Select current target asset class</option>
            {TARGET_ASSET_CLASSES.map(cls => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>

        {/* Optional Context */}
        <div className="sh-form-field">
          <label htmlFor="gate-context" className="sh-form-label">
            Current Mandate or Deal Focus (Optional)
          </label>
          <input
            id="gate-context"
            type="text"
            value={dealContext}
            onChange={e => setDealContext(e.target.value)}
            placeholder="e.g. Under LOI on $3.5M commercial cleaning company; or macro equity options"
            className="sh-form-input"
          />
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 bg-[var(--paper)] border-l-2 border-[var(--clay)] text-xs text-[var(--clay)] font-mono"
          >
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={requestAccess.isPending}
          className="sh-btn-primary w-full justify-center py-3.5 text-sm font-semibold"
        >
          <span>{requestAccess.isPending ? "Submitting Application…" : "Request Desk Access"}</span>
          <ArrowRight size={16} aria-hidden="true" />
        </button>

        {/* Sovereign Guarantee */}
        <div className="sh-sovereign-guarantee">
          <Shield size={16} className="text-[oklch(0.35_0.08_155)] shrink-0" />
          <p className="m-0 text-xs text-[var(--sh-fg-2)] leading-relaxed">
            <strong>Sovereignty Guarantee:</strong> Runs sovereignly. Your deal documents and
            theses are never stored, syndicated, or used for model training. Private tenant
            isolation ensures zero leakage.
          </p>
        </div>
      </form>
    </div>
  );
}
