import React, { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  Trash2,
  RefreshCw,
  ShieldCheck,
  ChevronRight,
  Plus,
  HelpCircle,
  ArrowUpRight,
} from "lucide-react";
import { exampleMandate, type MoneyKey } from "@shared/acquisitionV2";

const MONEY_LABELS: Record<MoneyKey, string> = {
  ask: "Asking Price",
  revenue: "Gross Revenue",
  sde: "Seller’s Discretionary Earnings (SDE)",
  ebitda: "EBITDA",
  inventory: "Inventory",
  ffe: "Furniture, Fixtures & Equipment",
};

const formatUSD = (val?: number | null) => {
  if (val == null) return "—";
  return val.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
};

interface Props {
  dealId?: number;
  initialDossierId?: string;
}

export function DealDocumentReviewDesk({ dealId, initialDossierId }: Props) {
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(initialDossierId ?? null);
  const [isCreatingDossier, setIsCreatingDossier] = useState(false);
  const [newDossierName, setNewDossierName] = useState("");
  const [newReportingPeriod, setNewReportingPeriod] = useState("TTM-2026-Q1");

  // Confirmation Modal / Drawer state
  const [confirmingProposal, setConfirmingProposal] = useState<{
    proposalId: string;
    field: MoneyKey;
    value: number;
    page: number;
    span: string;
  } | null>(null);
  const [confirmationReason, setConfirmationReason] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [retentionPolicy, setRetentionPolicy] = useState<"permanent" | "90_day">("permanent");
  const [allowOcr, setAllowOcr] = useState<boolean>(true);

  // Queries
  const { data: dossiers, refetch: refetchDossiers } = trpc.dealDocument.listDossiers.useQuery();
  const activeDossierId = selectedDossierId ?? (dossiers && dossiers.length > 0 ? dossiers[0].id : null);

  const { data: dossierData, isLoading: isLoadingDossier, refetch: refetchActiveDossier } =
    trpc.dealDocument.getDossier.useQuery(
      { dossierId: activeDossierId! },
      { enabled: !!activeDossierId }
    );

  const dossier = dossierData?.dossier;
  const snapshot = dossierData?.snapshot;

  // Mutations
  const createDossier = trpc.dealDocument.createDossier.useMutation({
    onSuccess: (newD) => {
      toast.success("Dossier created");
      setIsCreatingDossier(false);
      setNewDossierName("");
      refetchDossiers();
      setSelectedDossierId(newD.id);
    },
    onError: (err) => toast.error(`Failed to create dossier: ${err.message}`),
  });

  const uploadDoc = trpc.dealDocument.uploadDocument.useMutation({
    onSuccess: () => {
      toast.success("Document uploaded, parsed, and indexed");
      setIsUploading(false);
      setUploadError(null);
      refetchActiveDossier();
    },
    onError: (err) => {
      setIsUploading(false);
      setUploadError(err.message);
      toast.error(`Upload rejected: ${err.message}`);
    },
  });

  const confirmFact = trpc.dealDocument.confirmProposal.useMutation({
    onSuccess: () => {
      toast.success("Fact confirmed by operator");
      setConfirmingProposal(null);
      setConfirmationReason("");
      refetchActiveDossier();
    },
    onError: (err) => toast.error(`Confirmation failed: ${err.message}`),
  });

  const revokeFact = trpc.dealDocument.revokeFact.useMutation({
    onSuccess: () => {
      toast.success("Fact confirmation revoked");
      refetchActiveDossier();
    },
    onError: (err) => toast.error(`Revocation failed: ${err.message}`),
  });

  const reviewMandate = trpc.dealDocument.reviewMandate.useMutation({
    onSuccess: () => {
      toast.success("Mandate recorded for dossier");
      refetchActiveDossier();
    },
    onError: (err) => toast.error(`Mandate review failed: ${err.message}`),
  });

  const evaluate = trpc.dealDocument.evaluate.useMutation({
    onSuccess: () => {
      toast.success("Diligence evaluation completed and receipt sealed");
      refetchActiveDossier();
    },
    onError: (err) => toast.error(`Evaluation failed: ${err.message}`),
  });

  const deleteDoc = trpc.dealDocument.deleteDocument.useMutation({
    onSuccess: () => {
      toast.success("Document removed; dependent analysis invalidated");
      refetchActiveDossier();
    },
    onError: (err) => toast.error(`Failed to remove document: ${err.message}`),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !dossier) return;

    if (file.size > 25 * 1024 * 1024) {
      setUploadError("File exceeds the 25MB bounded size limit");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadDoc.mutate({
        dossierId: dossier.id,
        revision: dossier.currentRevision,
        filename: file.name,
        mimeType: file.type || (file.name.endsWith(".txt") ? "text/plain" : "application/pdf"),
        base64Content: base64,
        basis: "source_claim",
        retentionPolicy,
        allowOcr,
      });
    };
    reader.onerror = () => {
      setIsUploading(false);
      setUploadError("Failed to read file from disk");
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = async (docId: string, filename: string) => {
    try {
      const response = await fetch(`/api/trpc/dealDocument.downloadDocument?input=${encodeURIComponent(JSON.stringify({ dossierId: activeDossierId, documentId: docId }))}`);
      const json = await response.json();
      if (json?.result?.data) {
        const link = document.createElement("a");
        link.href = `data:${json.result.data.mimeType};base64,${json.result.data.base64Content}`;
        link.download = filename;
        link.click();
      }
    } catch {
      toast.error("Download failed");
    }
  };

  return (
    <div className="v2-edition space-y-8">
      {/* 1. Header & Dossier Selector */}
      <div className="border-b border-rule pb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 font-mono text-xs uppercase tracking-widest text-[var(--sh-fg-3)]">
            <FileText className="w-4 h-4 text-amber-500" />
            <span>Production Deal Document Intake & Verification Desk</span>
          </div>
          <h2 className="text-3xl font-normal tracking-tight font-serif text-[var(--ink)]">
            {dossier ? dossier.name : "Select or Create Deal Dossier"}
          </h2>
          {dossier && (
            <div className="flex items-center gap-4 mt-2 text-xs font-mono text-[var(--sh-fg-3)]">
              <span>Revision {dossier.currentRevision}</span>
              <span>·</span>
              <span>Period: {dossier.reportingPeriod}</span>
              <span>·</span>
              <span>Currency: {dossier.currency}</span>
              <span>·</span>
              <span className="text-emerald-600 font-semibold">Owner Scoped</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {dossiers && dossiers.length > 0 && (
            <select
              value={activeDossierId ?? ""}
              onChange={(e) => setSelectedDossierId(e.target.value)}
              className="border border-rule bg-paper px-3 py-1.5 text-xs font-mono text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {dossiers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} (Rev {d.currentRevision})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setIsCreatingDossier(true)}
            className="inline-flex items-center gap-1.5 bg-paper border border-rule hover:border-amber-500 text-xs font-mono px-3 py-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Dossier</span>
          </button>
        </div>
      </div>

      {/* Modal / Inline form to create dossier */}
      {isCreatingDossier && (
        <div className="p-4 border border-amber-500/40 bg-amber-500/5 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-serif text-lg font-medium text-[var(--ink)]">Create Private Deal Dossier</h4>
            <button onClick={() => setIsCreatingDossier(false)} className="text-xs font-mono text-[var(--sh-fg-3)]">
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-[var(--sh-fg-3)] mb-1">Target Business Name</label>
              <input
                type="text"
                placeholder="e.g. Apex Precision Fabrication"
                value={newDossierName}
                onChange={(e) => setNewDossierName(e.target.value)}
                className="w-full border border-rule bg-paper px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-[var(--sh-fg-3)] mb-1">Reporting Period</label>
              <input
                type="text"
                placeholder="e.g. FY2025 or TTM-2026-Q1"
                value={newReportingPeriod}
                onChange={(e) => setNewReportingPeriod(e.target.value)}
                className="w-full border border-rule bg-paper px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              disabled={!newDossierName.trim() || createDossier.isPending}
              onClick={() =>
                createDossier.mutate({
                  name: newDossierName.trim(),
                  intent: "business_acquisition",
                  currency: "USD",
                  reportingPeriod: newReportingPeriod.trim(),
                  dealId,
                })
              }
              className="bg-black text-white hover:bg-neutral-800 text-xs font-mono px-4 py-2 transition-colors disabled:opacity-50"
            >
              {createDossier.isPending ? "Creating..." : "Initialize Dossier"}
            </button>
          </div>
        </div>
      )}

      {/* 2. Document Intake & Secure Private Storage */}
      {dossier && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-4">
            <div className="border border-rule p-5 bg-paper space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-xl font-medium text-[var(--ink)]">Source Filings</h3>
                <span className="text-xs font-mono text-[var(--sh-fg-3)]">
                  {dossier.documents.length} {dossier.documents.length === 1 ? "document" : "documents"}
                </span>
              </div>

              <p className="text-xs text-[var(--sh-fg-3)] leading-relaxed">
                Upload confidential broker teasers, CIMs, tax returns, or P&L schedules. Files are stored under private,
                owner-isolated storage and parsed by an in-memory bounded engine.
              </p>

              {/* Retention Policy & OCR Controls */}
              <div className="flex items-center justify-between gap-2 text-xs font-mono pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--sh-fg-3)] text-[11px]">Retention:</span>
                  <select
                    value={retentionPolicy}
                    onChange={(e) => setRetentionPolicy(e.target.value as "permanent" | "90_day")}
                    className="border border-rule bg-paper px-2 py-0.5 text-[11px] font-mono text-[var(--ink)]"
                  >
                    <option value="permanent">Permanent Archive</option>
                    <option value="90_day">90-Day Retention</option>
                  </select>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-[var(--sh-fg-3)]">
                  <input
                    type="checkbox"
                    checked={allowOcr}
                    onChange={(e) => setAllowOcr(e.target.checked)}
                    className="rounded border-rule text-amber-600 focus:ring-0"
                  />
                  <span>Vision OCR</span>
                </label>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-rule hover:border-amber-500 p-6 text-center cursor-pointer transition-colors bg-[var(--sh-surface-1)]/40"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.txt"
                  className="hidden"
                />
                <UploadCloud className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                <p className="text-xs font-mono text-[var(--ink)] font-semibold">
                  {isUploading ? "Parsing & Indexing File..." : "Click or Drop PDF / TXT here"}
                </p>
                <p className="text-[10px] font-mono text-[var(--sh-fg-3)] mt-1">
                  Bounded: $\le 25$MB · $\le 100$ pages · digital or scanned (Gemini OCR)
                </p>
              </div>

              {uploadError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-mono flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Upload Rejected</strong>
                    <p className="mt-0.5 leading-snug">{uploadError}</p>
                  </div>
                </div>
              )}

              {/* Document List */}
              <div className="divide-y divide-rule border-t border-rule mt-4">
                {dossier.documents.length === 0 ? (
                  <p className="py-4 text-xs font-mono text-[var(--sh-fg-3)] italic text-center">
                    No documents uploaded to this dossier yet.
                  </p>
                ) : (
                  dossier.documents.map((doc) => (
                    <div key={doc.id} className="py-3 flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <p className="font-mono font-medium text-[var(--ink)] truncate">{doc.filename}</p>
                          {doc.retentionPolicy === "90_day" && (
                            <span className="text-[9px] font-mono px-1 py-0.5 bg-neutral-200 text-neutral-700">90-Day</span>
                          )}
                          {doc.ocrApplied && (
                            <span className="text-[9px] font-mono px-1 py-0.5 bg-amber-500/10 text-amber-700 border border-amber-500/30">OCR</span>
                          )}
                        </div>
                        <p className="text-[10px] font-mono text-[var(--sh-fg-3)]">
                          {(doc.byteSize / 1024).toFixed(1)} KB · {doc.pageCount} pages · Hash: {doc.contentHash.slice(0, 8)}...
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleDownload(doc.id, doc.filename)}
                          title="Download private document"
                          className="p-1 hover:text-amber-600 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${doc.filename}? This will invalidate confirmed facts and evaluation.`)) {
                              deleteDoc.mutate({
                                dossierId: dossier.id,
                                revision: dossier.currentRevision,
                                documentId: doc.id,
                              });
                            }
                          }}
                          title="Delete document"
                          className="p-1 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Invalidation Policy Banner */}
            <div className="border border-rule p-4 bg-paper text-[11px] font-mono text-[var(--sh-fg-3)] space-y-1">
              <span className="font-semibold text-[var(--ink)] block">Cascading Invalidation Contract</span>
              <p>
                Adding, updating, or deleting any document immediately revokes all operator confirmations and seals any
                preceding evaluation. Precision requires verified integrity.
              </p>
            </div>
          </div>

          {/* 3. Evidence Reconciliation & Proposals Table */}
          <div className="lg:col-span-2 space-y-6">
            <div className="border border-rule p-6 bg-paper">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-serif text-2xl font-medium text-[var(--ink)]">Evidence Reconciliation Desk</h3>
                  <p className="text-xs text-[var(--sh-fg-3)]">
                    Cross-document proposals with exact page and character spans. Only operator-confirmed facts enter diligence calculations.
                  </p>
                </div>
              </div>

              {snapshot ? (
                <div className="space-y-6">
                  {(["ask", "revenue", "sde", "ebitda", "inventory", "ffe"] as MoneyKey[]).map((field) => {
                    const fieldStatus = snapshot.fields.find((f) => f.field === field);
                    const confirmedFact = dossier.confirmedFacts?.[field];
                    const proposals = snapshot.proposals.filter((p) => p.field === field);

                    return (
                      <div key={field} className="border border-rule p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-serif text-base font-medium text-[var(--ink)]">
                              {MONEY_LABELS[field]}
                            </span>
                            {confirmedFact ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" /> Confirmed
                              </span>
                            ) : proposals.length > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200">
                                <AlertTriangle className="w-3 h-3" /> Proposals Extracted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 bg-neutral-100 text-neutral-500 border border-neutral-200">
                                <HelpCircle className="w-3 h-3" /> Not Found
                              </span>
                            )}
                          </div>

                          <div className="text-right">
                            <span className="font-mono text-base font-semibold text-[var(--ink)]">
                              {confirmedFact ? formatUSD(confirmedFact.value) : "—"}
                            </span>
                            {confirmedFact && (
                              <button
                                onClick={() =>
                                  revokeFact.mutate({
                                    dossierId: dossier.id,
                                    revision: dossier.currentRevision,
                                    field,
                                  })
                                }
                                className="block text-[10px] font-mono text-red-600 hover:underline mt-0.5"
                              >
                                Revoke Fact
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Confirmed Fact Footnote */}
                        {confirmedFact && (
                          <div className="p-2.5 bg-neutral-50 border-l-2 border-emerald-500 text-xs font-mono text-[var(--sh-fg-3)] space-y-1">
                            <p>
                              <strong>Confirmed by:</strong> {confirmedFact.operator} on{" "}
                              {new Date(confirmedFact.confirmedAt).toLocaleDateString()}
                            </p>
                            <p>
                              <strong>Rationale:</strong> "{confirmedFact.reason}"
                            </p>
                          </div>
                        )}

                        {/* Available Proposals from Documents */}
                        {proposals.length > 0 && !confirmedFact && (
                          <div className="space-y-2 pt-2">
                            <p className="text-[11px] font-mono text-[var(--sh-fg-3)] uppercase tracking-wider">
                              Discovered Spans ({proposals.length})
                            </p>
                            <div className="space-y-2">
                              {proposals.map((p) => (
                                <div
                                  key={p.id}
                                  className="flex items-center justify-between p-3 border border-rule hover:border-amber-500/60 bg-[var(--sh-surface-1)]/30 text-xs transition-colors"
                                >
                                  <div className="space-y-1 pr-4">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-semibold text-[var(--ink)]">
                                        {formatUSD(p.value)}
                                      </span>
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-neutral-100 text-neutral-600 border border-neutral-200">
                                        Page {p.provenance.page}
                                      </span>
                                      <span className="text-[10px] font-mono text-[var(--sh-fg-3)]">
                                        Doc v{p.provenance.documentVersion} · {p.provenance.extractionVersion}
                                      </span>
                                    </div>
                                    <blockquote className="italic text-[var(--sh-fg-2)] text-[11px] border-l border-rule pl-2">
                                      "{p.provenance.span}"
                                    </blockquote>
                                  </div>

                                  <button
                                    onClick={() =>
                                      setConfirmingProposal({
                                        proposalId: p.id,
                                        field,
                                        value: p.value ?? 0,
                                        page: p.provenance.page,
                                        span: p.provenance.span,
                                      })
                                    }
                                    className="flex-shrink-0 bg-paper border border-rule hover:border-amber-500 text-xs font-mono px-3 py-1.5 transition-colors"
                                  >
                                    Confirm Fact
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-8 text-center text-xs font-mono text-[var(--sh-fg-3)]">
                  Upload documents on the left to extract financial proposals.
                </p>
              )}
            </div>

            {/* 4. Mandate Alignment & V2 Diligence Evaluation */}
            <div className="border border-rule p-6 bg-paper space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-2xl font-medium text-[var(--ink)]">Diligence Gate Evaluation</h3>
                  <p className="text-xs text-[var(--sh-fg-3)]">
                    Evaluate operator-confirmed facts against the approved acquisition mandate.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!dossier.mandate && (
                    <button
                      onClick={() =>
                        reviewMandate.mutate({
                          dossierId: dossier.id,
                          revision: dossier.currentRevision,
                          mandate: exampleMandate,
                        })
                      }
                      className="bg-paper border border-rule hover:border-amber-500 text-xs font-mono px-3 py-2 transition-colors"
                    >
                      Attach Standard Mandate
                    </button>
                  )}

                  <button
                    disabled={
                      !dossier.mandate ||
                      Object.keys(dossier.confirmedFacts).length === 0 ||
                      evaluate.isPending
                    }
                    onClick={() =>
                      evaluate.mutate({
                        dossierId: dossier.id,
                        revision: dossier.currentRevision,
                      })
                    }
                    className="bg-black text-white hover:bg-neutral-800 disabled:opacity-40 text-xs font-mono px-4 py-2 transition-colors flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{evaluate.isPending ? "Evaluating..." : "Run V2 Diligence Gate"}</span>
                  </button>
                </div>
              </div>

              {/* Evaluation Receipt Display */}
              {dossier.evaluationReceipt ? (
                <div className="border-t border-rule pt-6 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 p-4 border border-rule bg-neutral-50/50">
                    <div>
                      <span className="font-mono text-xs uppercase tracking-wider text-[var(--sh-fg-3)] block">
                        Durable Diligence Receipt · Revision {dossier.evaluationReceipt.revision}
                      </span>
                      <h4 className="font-serif text-3xl font-medium text-[var(--ink)] mt-1">
                        Verdict:{" "}
                        <span
                          className={
                            dossier.evaluationReceipt.verdict.value === "PURSUE"
                              ? "text-emerald-700"
                              : dossier.evaluationReceipt.verdict.value === "FAIL"
                              ? "text-red-700"
                              : "text-amber-700"
                          }
                        >
                          {dossier.evaluationReceipt.verdict.value}
                        </span>
                      </h4>
                      <p className="text-xs font-mono text-[var(--sh-fg-2)] mt-1">
                        {dossier.evaluationReceipt.verdict.reason}
                      </p>
                    </div>

                    <div className="text-right text-xs font-mono text-[var(--sh-fg-3)]">
                      <p>Evaluator: {dossier.evaluationReceipt.evaluatedBy}</p>
                      <p>Sealed: {new Date(dossier.evaluationReceipt.evaluatedAt).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Calculated Ratios Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-3 border border-rule bg-paper">
                      <span className="text-[10px] font-mono text-[var(--sh-fg-3)] uppercase block">Asking Multiple</span>
                      <strong className="text-xl font-serif text-[var(--ink)] block mt-1">
                        {dossier.evaluationReceipt.ratios.multiple?.value
                          ? `${dossier.evaluationReceipt.ratios.multiple.value.toFixed(2)}×`
                          : "—"}
                      </strong>
                      <small className="text-[10px] font-mono text-[var(--sh-fg-3)]">Price / Claimed SDE</small>
                    </div>

                    <div className="p-3 border border-rule bg-paper">
                      <span className="text-[10px] font-mono text-[var(--sh-fg-3)] uppercase block">SDE Margin</span>
                      <strong className="text-xl font-serif text-[var(--ink)] block mt-1">
                        {dossier.evaluationReceipt.ratios.sdeMargin?.value
                          ? `${(dossier.evaluationReceipt.ratios.sdeMargin.value * 100).toFixed(1)}%`
                          : "—"}
                      </strong>
                      <small className="text-[10px] font-mono text-[var(--sh-fg-3)]">SDE / Gross Revenue</small>
                    </div>

                    <div className="p-3 border border-rule bg-paper">
                      <span className="text-[10px] font-mono text-[var(--sh-fg-3)] uppercase block">Estimated DSCR</span>
                      <strong className="text-xl font-serif text-[var(--ink)] block mt-1">
                        {dossier.evaluationReceipt.ratios.dscr?.value
                          ? `${dossier.evaluationReceipt.ratios.dscr.value.toFixed(2)}×`
                          : "—"}
                      </strong>
                      <small className="text-[10px] font-mono text-[var(--sh-fg-3)]">Cash coverage</small>
                    </div>

                    <div className="p-3 border border-rule bg-paper">
                      <span className="text-[10px] font-mono text-[var(--sh-fg-3)] uppercase block">Hard Asset Share</span>
                      <strong className="text-xl font-serif text-[var(--ink)] block mt-1">
                        {dossier.evaluationReceipt.ratios.hardAssetShare?.value
                          ? `${(dossier.evaluationReceipt.ratios.hardAssetShare.value * 100).toFixed(1)}%`
                          : "—"}
                      </strong>
                      <small className="text-[10px] font-mono text-[var(--sh-fg-3)]">FF&E + Inv / Price</small>
                    </div>
                  </div>

                  {/* Gates Status Grid */}
                  <div className="space-y-2">
                    <span className="text-xs font-mono uppercase tracking-wider text-[var(--sh-fg-3)] block">
                      Screening Gates Status
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {dossier.evaluationReceipt.gates.map((g) => (
                        <div
                          key={g.id}
                          className={`p-2.5 border text-xs font-mono ${
                            g.result === "pass"
                              ? "border-emerald-300 bg-emerald-50/50 text-emerald-900"
                              : g.result === "fail"
                              ? "border-red-300 bg-red-50/50 text-red-900"
                              : "border-amber-300 bg-amber-50/50 text-amber-900"
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <strong>{g.id}</strong>
                            <span>{g.result === "pass" ? "✓" : g.result === "fail" ? "×" : "○"}</span>
                          </div>
                          <p className="text-[11px] leading-tight opacity-80">{g.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 border border-dashed border-rule text-center space-y-1">
                  <p className="text-xs font-mono text-[var(--sh-fg-3)]">
                    No active evaluation receipt for Revision {dossier.currentRevision}.
                  </p>
                  <p className="text-[11px] font-mono text-[var(--sh-fg-3)]">
                    Confirm required facts above to seal an evaluation receipt.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmingProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-paper border border-rule max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-[var(--sh-fg-3)]">
                  Confirm Operator Fact
                </span>
                <h4 className="font-serif text-2xl font-medium text-[var(--ink)] mt-1">
                  {MONEY_LABELS[confirmingProposal.field]}: {formatUSD(confirmingProposal.value)}
                </h4>
              </div>
              <button
                onClick={() => setConfirmingProposal(null)}
                className="text-xs font-mono text-[var(--sh-fg-3)] hover:text-black"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-neutral-50 border-l-2 border-amber-500 text-xs font-mono space-y-1">
              <p>
                <strong>Extracted from:</strong> Page {confirmingProposal.page}
              </p>
              <blockquote className="italic text-[var(--sh-fg-2)] mt-1">"{confirmingProposal.span}"</blockquote>
            </div>

            <div>
              <label className="block text-xs font-mono text-[var(--sh-fg-3)] mb-1">
                Operator Rationale / Verification Source
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Stated listing ask matches executive summary and broker disclosure schedule"
                value={confirmationReason}
                onChange={(e) => setConfirmationReason(e.target.value)}
                className="w-full border border-rule bg-paper p-2.5 text-xs font-mono text-[var(--ink)] focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmingProposal(null)}
                className="border border-rule px-3 py-1.5 text-xs font-mono"
              >
                Cancel
              </button>
              <button
                disabled={!confirmationReason.trim() || confirmFact.isPending}
                onClick={() =>
                  confirmFact.mutate({
                    dossierId: dossier!.id,
                    revision: dossier!.currentRevision,
                    proposalId: confirmingProposal.proposalId,
                    reason: confirmationReason.trim(),
                    consideredProposalIds: [confirmingProposal.proposalId],
                  })
                }
                className="bg-black text-white hover:bg-neutral-800 disabled:opacity-50 px-4 py-1.5 text-xs font-mono transition-colors"
              >
                {confirmFact.isPending ? "Confirming..." : "Confirm & Record"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
