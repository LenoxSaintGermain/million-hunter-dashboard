import { z } from "zod";
import { acquisitionMandateSchema, evaluateAcquisitionV2, extractListingEvidence,
  type AcquisitionMandate, type ListingEvidence, type MoneyField, type MoneyKey } from "../shared/acquisitionV2";
import { dealDocumentSchema, dealDocumentMoneyKeys,
  type DealDocument, type DocumentIntent, type DocumentReview, type ExtractionProposal,
  type OperatorConfirmedFact } from "../shared/dealDocument";

const actorSchema = z.string().trim().min(1).max(128);
const reasonSchema = z.string().trim().min(1).max(2000);
const fieldSchema = z.enum(["ask", "revenue", "sde", "ebitda", "inventory", "ffe"]);
const intentSchema = z.enum(["business_acquisition", "scenario_analysis"]);
type Evaluation = { revision: number; label: string;
  confirmedFacts: Partial<Record<MoneyKey, OperatorConfirmedFact>>;
  result: ReturnType<typeof evaluateAcquisitionV2> };

export function proposeDealDocument(input: unknown): ExtractionProposal[] {
  const doc = dealDocumentSchema.parse(input);
  return [...doc.pages].sort((a, b) => a.page - b.page).flatMap(page => {
    // No execution, provider, prompt, URL fetch, or instruction channel exists here.
    const evidence = extractListingEvidence({ url: doc.source, fetchedAt: doc.capturedAt, type: "primary", text: page.text });
    return dealDocumentMoneyKeys.map(field => ({
      id: JSON.stringify([doc.id, doc.version, page.page, field]), field,
      value: evidence.fields[field].value, state: evidence.fields[field].state,
      basis: doc.basis, status: "proposed" as const,
      provenance: { documentId: doc.id, documentVersion: doc.version, source: doc.source,
        capturedAt: doc.capturedAt, extractionVersion: doc.extractionVersion,
        page: page.page, span: evidence.fields[field].span },
    }));
  });
}

/** Process-local aggregate. Never deserialize client state into this class as trusted state. */
export class DealDocumentEngine {
  private documents: DealDocument[] = [];
  private facts: Partial<Record<MoneyKey, OperatorConfirmedFact>> = {};
  private revision = 0;
  private reviewReceipt: DocumentReview | null = null;
  private evaluation: Evaluation | null = null;
  private intent: DocumentIntent;

  constructor(intent: DocumentIntent) { this.intent = intentSchema.parse(intent); }

  private invalidate() { this.revision++; this.reviewReceipt = null; this.evaluation = null; }

  putDocument(input: unknown) {
    const doc = dealDocumentSchema.parse(input);
    const old = this.documents.find(d => d.id === doc.id);
    if (old && doc.version <= old.version) throw new Error("Document edit requires a higher version");
    if (!old && this.documents.length >= 20) throw new Error("Document count budget exceeded");
    const next = [...this.documents.filter(d => d.id !== doc.id), doc];
    if (next.reduce((n, d) => n + d.pages.reduce((s, p) => s + p.text.length, 0), 0) > 2_000_000)
      throw new Error("Dossier text budget exceeded");
    this.documents = next;
    // New evidence may contradict ANY prior confirmation; require explicit reconfirmation.
    this.facts = {};
    this.invalidate();
  }

  removeDocument(id: string) {
    if (!this.documents.some(d => d.id === id)) throw new Error("Unknown document");
    this.documents = this.documents.filter(d => d.id !== id);
    this.facts = {};
    this.invalidate();
  }

  setIntent(intent: DocumentIntent) {
    this.intent = intentSchema.parse(intent);
    this.invalidate();
  }

  get snapshot() {
    const proposals = this.documents.flatMap(proposeDealDocument);
    const fields = dealDocumentMoneyKeys.map(field => {
      const candidates = proposals.filter(p => p.field === field && p.state !== "not_disclosed");
      const conflicting = candidates.some(p => p.state === "conflicting") ||
        new Set(candidates.filter(p => p.value !== null).map(p => p.value)).size > 1;
      return { field, candidates, conflicting, confirmed: this.facts[field] ?? null,
        missing: !this.facts[field],
        reason: this.facts[field] ? "operator_confirmed_source_claim" : conflicting ? "unresolved_conflict" :
          !candidates.length ? "not_disclosed" : "operator_confirmation_required" };
    });
    return structuredClone({ revision: this.revision, intent: this.intent, documents: this.documents,
      proposals, fields, review: this.reviewReceipt, evaluation: this.evaluation });
  }

  confirmProposal(input: { proposalId: string; operator: string; reason: string; consideredProposalIds: string[] }) {
    const operator = actorSchema.parse(input.operator), reason = reasonSchema.parse(input.reason);
    const proposals = this.snapshot.proposals;
    const selected = proposals.find(p => p.id === input.proposalId);
    if (!selected || selected.state !== "value" || selected.value === null || selected.basis !== "source_claim")
      throw new Error("Only exact source-claim proposals may be confirmed; assumptions and derivations stay separate");
    const considered = proposals.filter(p => p.field === selected.field && p.state !== "not_disclosed").map(p => p.id).sort();
    if (JSON.stringify([...input.consideredProposalIds].sort()) !== JSON.stringify(considered))
      throw new Error("Review every candidate for this field, including conflicts");
    this.facts[selected.field] = { field: selected.field, value: selected.value, proposalId: selected.id,
      provenance: selected.provenance, operator, reason, consideredProposalIds: considered,
      status: "operator_confirmed_source_claim" };
    this.invalidate();
  }

  revokeFact(field: MoneyKey) {
    delete this.facts[fieldSchema.parse(field)];
    this.invalidate();
  }

  review(input: AcquisitionMandate, operatorInput: string) {
    if (this.intent !== "business_acquisition") throw new Error("Acquisition mandate incompatible with scenario analysis");
    const mandate = acquisitionMandateSchema.parse(input), operator = actorSchema.parse(operatorInput);
    if (!this.documents.length) throw new Error("Document evidence required");
    this.invalidate();
    this.reviewReceipt = { revision: this.revision, mandate, operator };
    return structuredClone(this.reviewReceipt);
  }

  evaluate() {
    if (!this.reviewReceipt || this.reviewReceipt.revision !== this.revision) throw new Error("Current operator review required");
    const source = { url: "document-dossier:operator-reviewed", type: "primary" as const,
      fetchedAt: this.documents.map(d => d.capturedAt).sort((a, b) => Date.parse(a) - Date.parse(b))[0] };
    const fieldReviews = this.snapshot.fields;
    const fields = Object.fromEntries(dealDocumentMoneyKeys.map(key => {
      const fact = this.facts[key];
      const review = fieldReviews.find(f => f.field === key)!;
      const unresolvedState = review.conflicting ? "conflicting" :
        review.candidates.some(p => p.state === "extraction_failed") ? "extraction_failed" :
        review.candidates.some(p => p.state === "approximate") ? "approximate" :
        review.candidates.some(p => p.state === "on_request") ? "on_request" : "not_disclosed";
      const field: MoneyField = fact ? { value: fact.value, state: "value", span: fact.provenance.span,
        source: { url: fact.provenance.source, fetchedAt: fact.provenance.capturedAt, type: "primary" } } :
        { value: null, state: unresolvedState, span: "No operator-confirmed exact source claim", source };
      return [key, field];
    })) as ListingEvidence["fields"];
    // Deliberately empty: unreviewed narrative must not trigger V2 positive gates or instructions.
    const result = evaluateAcquisitionV2({ source, fields, text: "" }, this.reviewReceipt.mandate);
    this.evaluation = { revision: this.revision, confirmedFacts: structuredClone(this.facts),
      label: "Partial document screening — operator-confirmed claims, not audited facts; narrative checks unavailable", result };
    return structuredClone(this.evaluation);
  }
}
