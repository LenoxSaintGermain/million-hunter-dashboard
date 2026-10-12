import React, { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button as BaseButton } from "@/components/ui/button";
import { DealEvidenceReceiptSummary } from "./DealEvidenceReceiptSummary";
import { DealEvidenceRunComparison } from "./DealEvidenceRunComparison";
import { SEC_ANALYSIS_LIMITATION } from "@shared/dealEvidence";
import type {
  DealEvidenceAttachment,
  DealEvidenceRun,
} from "../../../server/dealEvidenceRepository";

const options = {
  retry: false as const,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
};
const muted = "text-xs text-[var(--sh-text-secondary)]";
const action =
  "min-h-11 h-auto whitespace-normal border border-[var(--sh-border)] bg-[var(--sh-primary)] text-[var(--sh-primary-fg)] hover:bg-[var(--sh-primary)] hover:opacity-90 motion-reduce:transition-none";
const inputStyle =
  "mt-1 block min-h-11 w-full min-w-0 rounded-none border border-[var(--sh-border)] bg-[var(--sh-surface-1)] p-2 text-sm text-[var(--sh-text-primary)]";
const reviewSeats = [
  "The Structuralist",
  "The Restructurer",
  "The Market Analyst",
];
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fallbackId = "00000000-0000-4000-8000-000000000000";
function Button({
  className = "",
  ...props
}: React.ComponentProps<typeof BaseButton>) {
  return (
    <BaseButton
      {...props}
      className={`${className} rounded-none shadow-none motion-reduce:transition-none`}
    />
  );
}
function time(value: Date | string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Unknown";
}
function modeLabel(mode: DealEvidenceRun["mode"]) {
  return mode === "ic" ? "Investment Committee" : "Red Team";
}
function Source({ url, children }: { url: string; children: React.ReactNode }) {
  return /^https:\/\/(?:www\.|data\.)?sec\.gov\//i.test(url) ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-4 break-all"
    >
      {children} ↗
    </a>
  ) : (
    <span>{children} · link unavailable</span>
  );
}

/** Each immutable operation intent keeps its request key until a terminal save. */
export function createDealEvidenceRequests() {
  const requests = new Map<string, string>();
  return {
    async submit<T>(
      key: string,
      invoke: (requestId: string) => Promise<T>,
      terminal: (value: T) => boolean = () => true
    ) {
      const requestId = requests.get(key) || crypto.randomUUID();
      requests.set(key, requestId);
      const result = await invoke(requestId);
      if (terminal(result)) requests.delete(key);
      return result;
    },
  };
}

function LongText({ text, label }: { text: string; label: string }) {
  return text.length <= 240 ? (
    <p className="whitespace-pre-wrap break-words text-sm">{text}</p>
  ) : (
    <div>
      <p className="break-words text-sm">{text.slice(0, 240)}…</p>
      <details>
        <summary className="min-h-11 cursor-pointer py-3 text-xs">
          {label}
        </summary>
        <p className="whitespace-pre-wrap break-words text-sm">{text}</p>
      </details>
    </div>
  );
}

export function DealEvidenceRunView({
  run,
  previous = null,
  historical = false,
}: {
  run: DealEvidenceRun;
  previous?: DealEvidenceRun | null;
  historical?: boolean;
}) {
  const output = run.status === "complete" ? run.output : null;
  const redTeam = output && "redFlags" in output ? output : null;
  const committee = output && "scores" in output ? output : null;
  const cited =
    redTeam?.citations ||
    committee?.scores.flatMap(score => score.citations) ||
    [];
  const citations = cited.filter(
    (entry, index) =>
      cited.findIndex(
        other =>
          other.citationId === entry.citationId && other.quote === entry.quote
      ) === index
  );
  const citationRow = (citation: (typeof citations)[number], index: number) => {
    const source = run.inputSnapshot.citations.find(
      item => item.id === citation.citationId
    );
    return (
      <li key={`${citation.citationId}-${index}`}>
        <details className="border-t border-[var(--sh-border)]">
          <summary className="min-h-11 cursor-pointer py-3 text-xs font-mono">
            {citation.citationId} · inspect cited evidence
          </summary>
          <div className="space-y-2 pb-3 text-xs [overflow-wrap:anywhere]">
            <p>
              <strong>Model quote:</strong> {citation.quote}
            </p>
            {source ? (
              <>
                <p>
                  <strong>Recorded source fact:</strong> {source.fact}
                </p>
                <p>
                  <Source url={source.sourceUrl}>SEC source</Source>
                </p>
                <p>Receipt: {source.receiptId}</p>
                <p>Hash: {source.payloadHash}</p>
              </>
            ) : (
              <p role="alert">Citation source not found in this saved input.</p>
            )}
          </div>
        </details>
      </li>
    );
  };
  return (
    <article
      aria-label="Selected evidence analysis"
      className="min-w-0 space-y-4 border border-[var(--sh-border)] bg-[var(--sh-surface-1)] p-3 sm:p-4"
    >
      <header>
        <p className={`${muted} font-mono`}>
          {historical ? "Historical saved run" : "Selected saved run"} ·{" "}
          {modeLabel(run.mode)}
        </p>
        <h3 className="mt-1 break-words font-serif text-lg">
          {run.inputSnapshot.deal.name}
        </h3>
        <p className={`mt-1 ${muted}`}>
          Started {time(run.startedAt)} · Completed {time(run.completedAt)}
        </p>
      </header>
      <p
        role={run.status === "failed" ? "alert" : "status"}
        className="text-sm font-medium"
      >
        {run.status === "pending"
          ? "Pending — no completed result is recorded."
          : run.status === "failed"
            ? "Analysis failed — no decision recorded."
            : "Saved model analysis — requires human review; not approval."}
      </p>
      {run.message && <p className="break-words text-sm">{run.message}</p>}
      {run.failureCode && (
        <p className={`${muted} font-mono`}>Failure code: {run.failureCode}</p>
      )}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">
          Exact evidence used · {run.inputSnapshot.evidence.length} receipt
          versions
        </h4>
        <p className="text-xs font-mono tabular-nums">
          {run.inputSnapshot.evidence.reduce(
            (sum, item) => sum + item.includedFilings,
            0
          )}{" "}
          of{" "}
          {run.inputSnapshot.evidence.reduce(
            (sum, item) => sum + item.totalFilings,
            0
          )}{" "}
          captured metadata entries included · summed across versions, not
          deduplicated
        </p>
        {run.inputSnapshot.evidence.some(item => item.staleAtRun) && (
          <p className={muted}>Includes an expired snapshot at run time.</p>
        )}
        <details>
          <summary className="min-h-11 cursor-pointer py-3 text-xs">
            Inspect evidence versions & provenance
          </summary>
          {run.inputSnapshot.evidence.map(item => (
            <div
              key={item.attachmentId}
              className="border-l-2 border-[var(--sh-border)] pl-3 text-xs"
            >
              <p className="break-words">
                {item.issuerName} · CIK {item.cik}
              </p>
              <p className="mt-1 font-mono tabular-nums">
                {item.includedFilings} of {item.totalFilings} captured filing
                entries included
              </p>
              <p className={`mt-1 ${muted}`}>
                {item.staleAtRun
                  ? "Expired at run time"
                  : "Within receipt expiry at run time"}{" "}
                · retrieved {time(item.retrievedAt)}
              </p>
            </div>
          ))}
        </details>
      </div>
      {output && (
        <LongText text={output.summary} label="Read full saved summary" />
      )}
      {redTeam && (
        <div className="space-y-2">
          <p className="text-xs font-mono">
            Model-estimated kill probability:{" "}
            {Number.isFinite(redTeam.killProbability) &&
            redTeam.killProbability >= 0 &&
            redTeam.killProbability <= 1
              ? `${(redTeam.killProbability * 100).toFixed(1)}%`
              : "Unknown"}{" "}
            · not a calibrated probability
          </p>
          <h4 className="text-sm font-medium">
            Diligence hypotheses · {redTeam.redFlags.length}
          </h4>
          <ul className="space-y-2">
            {redTeam.redFlags.slice(0, 3).map((flag, index) => (
              <li key={index}>
                <LongText text={flag} label="Read full hypothesis" />
              </li>
            ))}
          </ul>
          {redTeam.redFlags.length > 3 && (
            <details>
              <summary className="min-h-11 cursor-pointer py-3 text-xs">
                Show remaining {redTeam.redFlags.length - 3} hypotheses
              </summary>
              <ul className="space-y-3">
                {redTeam.redFlags.slice(3).map((flag, index) => (
                  <li key={index} className="break-words text-sm">
                    {flag}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {committee && (
        <div className="space-y-3">
          <p className="text-xs font-mono">
            Model consensus score: {committee.consensusScore.toFixed(3)} ·
            divergence: {committee.divergenceScore.toFixed(3)} ·{" "}
            {committee.divergenceFlag
              ? "Disagreement flagged"
              : "No disagreement flag returned"}
          </p>
          <p className={muted}>
            Review-seat labels, not verified provider roles. Model scores · 0–1
            scale · not probabilities. Open a row for its rationale.
          </p>
          {committee.scores.map((score, index) => (
            <details key={index} className="border-t border-[var(--sh-border)]">
              <summary className="min-h-11 cursor-pointer py-3 text-xs font-mono">
                <span className="inline-grid w-[calc(100%-1rem)] grid-cols-[auto_1fr_auto] items-center gap-3">
                  <span>
                    {reviewSeats[index] || `Review seat ${index + 1}`}
                  </span>
                  <span
                    aria-hidden="true"
                    className="h-1.5 bg-[var(--sh-border)]"
                  >
                    <span
                      className="block h-full bg-[var(--sh-text-primary)]"
                      style={{
                        width: `${Number.isFinite(score.score) && score.score >= 0 && score.score <= 1 ? score.score * 100 : 0}%`,
                      }}
                    />
                  </span>
                  <span>
                    {Number.isFinite(score.score) &&
                    score.score >= 0 &&
                    score.score <= 1
                      ? score.score.toFixed(3)
                      : "Unknown"}
                  </span>
                </span>
              </summary>
              <p className="whitespace-pre-wrap break-words text-sm">
                {score.rationale}
              </p>
            </details>
          ))}
        </div>
      )}
      {run.status === "complete" && !output && (
        <p role="alert" className="text-sm">
          Saved output unavailable; do not infer a successful analysis.
        </p>
      )}
      {citations.length > 0 && (
        <section aria-label="Saved analysis citations">
          <h4 className="text-sm font-medium">
            Citations · {citations.length}
          </h4>
          <ul>{citations.slice(0, 3).map(citationRow)}</ul>
          {citations.length > 3 && (
            <details>
              <summary className="min-h-11 cursor-pointer py-3 text-xs">
                Show remaining {citations.length - 3} citations
              </summary>
              <ul>{citations.slice(3).map(citationRow)}</ul>
            </details>
          )}
        </section>
      )}
      <DealEvidenceRunComparison
        previous={previous?.inputSnapshot || null}
        next={run.inputSnapshot}
      />
      <details>
        <summary className="min-h-11 cursor-pointer py-3 text-xs font-mono">
          Saved input provenance & limitations
        </summary>
        <div className="space-y-3 text-xs [overflow-wrap:anywhere]">
          <p>Run ID: {run.id}</p>
          <p>Request ID: {run.requestId}</p>
          <p>Prompt version: {run.inputSnapshot.promptVersion}</p>
          <p>Input request hash: {run.requestHash}</p>
          <p>Models: {run.models.join(", ")}</p>
          {run.inputSnapshot.evidence.map(item => (
            <dl
              key={item.attachmentId}
              className="space-y-1 border-t border-[var(--sh-border)] pt-2"
            >
              <div>
                <dt>Receipt / attachment</dt>
                <dd>
                  {item.receiptId} / {item.attachmentId}
                </dd>
              </div>
              <div>
                <dt>Payload hash</dt>
                <dd>{item.payloadHash}</dd>
              </div>
              <div>
                <dt>Relation</dt>
                <dd>
                  Same legal entity · owner-confirmed, not independently
                  verified
                </dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>
                  <Source url={item.sourceUrl}>{item.sourceUrl}</Source>
                </dd>
              </div>
            </dl>
          ))}
          <ul className="space-y-2">
            {run.inputSnapshot.gaps.map((gap, index) => (
              <li key={index}>{gap}</li>
            ))}
          </ul>
        </div>
      </details>
      <p className={muted}>{SEC_ANALYSIS_LIMITATION}</p>
    </article>
  );
}

export default function DealEvidenceDesk({
  dealId,
  demo = false,
}: {
  dealId: number;
  demo?: boolean;
}) {
  if (demo)
    return (
      <section className="border-y border-[var(--sh-border)] py-4">
        <h2 className="font-serif text-xl">Public evidence</h2>
        <p className={muted}>
          Illustrative demo — live receipt attachment and analysis are disabled.
          No evidence requests are made.
        </p>
      </section>
    );
  if (!Number.isSafeInteger(dealId) || dealId <= 0)
    return <p role="alert">A valid deal is required to view evidence.</p>;
  return <ConnectedDealEvidenceDesk key={dealId} dealId={dealId} />;
}

function ConnectedDealEvidenceDesk({ dealId }: { dealId: number }) {
  const attachments = trpc.dealEvidence.attachments.useQuery(
    { dealId },
    options
  );
  const runs = trpc.dealEvidence.runs.useQuery({ dealId }, options);
  const attach = trpc.dealEvidence.attach.useMutation({ retry: false });
  const redTeam = trpc.dealEvidence.runRedTeam.useMutation({ retry: false });
  const committee = trpc.dealEvidence.runIC.useMutation({ retry: false });
  const requests = useRef(createDealEvidenceRequests());
  const lock = useRef(false);
  const [receiptInput, setReceiptInput] = useState("");
  const [issuerInput, setIssuerInput] = useState("");
  const [lookupCik, setLookupCik] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [confirmedCik, setConfirmedCik] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [savedAttachment, setSavedAttachment] =
    useState<DealEvidenceAttachment | null>(null);
  const [savedRun, setSavedRun] = useState<DealEvidenceRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const receipt = trpc.publicEvidence.get.useQuery(
    { id: receiptId || fallbackId },
    { ...options, enabled: Boolean(receiptId), staleTime: Infinity }
  );
  const savedReceipts = trpc.publicEvidence.list.useQuery(
    { cik: lookupCik || "0000000001" },
    { ...options, enabled: Boolean(lookupCik) }
  );
  const attachmentRows = [...(attachments.data || [])];
  if (
    savedAttachment &&
    !attachmentRows.some(row => row.id === savedAttachment.id)
  )
    attachmentRows.unshift(savedAttachment);
  const runRows = [...(runs.data || [])];
  if (savedRun) {
    const index = runRows.findIndex(run => run.id === savedRun.id);
    if (index >= 0) {
      if (runRows[index].status === "pending") runRows[index] = savedRun;
    } else runRows.unshift(savedRun);
  }
  runRows.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
  const activeId = selectedRun || runRows[0]?.id;
  const runDetail = trpc.dealEvidence.getRun.useQuery(
    { dealId, id: activeId || fallbackId },
    { ...options, enabled: Boolean(activeId) }
  );
  const active =
    runDetail.data?.id === activeId
      ? runDetail.data
      : runRows.find(run => run.id === activeId);
  const activeIndex = runRows.findIndex(run => run.id === activeId);
  const previous = activeIndex >= 0 ? runRows[activeIndex + 1] || null : null;
  const selectedRows = attachmentRows.filter(row => selection.includes(row.id));
  const selectedCiks = new Set(selectedRows.map(row => row.confirmedCik));
  const duplicateReceipts =
    new Set(selectedRows.map(row => row.receiptId)).size !==
    selectedRows.length;
  const canRun =
    selection.length > 0 &&
    selection.length <= 3 &&
    selectedRows.length === selection.length &&
    selectedCiks.size === 1 &&
    !duplicateReceipts &&
    !attachments.error;
  const loadedReceipt =
    receipt.data?.id === receiptId ? receipt.data : undefined;
  const canAttach =
    loadedReceipt &&
    loadedReceipt.status !== "unavailable" &&
    loadedReceipt.payload.company?.cik === confirmedCik &&
    /^\d{10}$/.test(confirmedCik) &&
    confirmed &&
    !receipt.error;
  async function perform(label: string, operation: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      await operation();
    } catch (cause) {
      setError(
        `${label} not confirmed: ${cause instanceof Error ? cause.message : "Request failed"}. Retry with the same inputs to recover the same request.`
      );
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }
  function inspect(id: string) {
    setReceiptId(id);
    setReceiptInput(id);
    setConfirmed(false);
    setConfirmedCik("");
  }
  async function attachSelected() {
    if (!canAttach || !loadedReceipt) return;
    await perform("Attachment save", async () => {
      const payload = {
        dealId,
        receiptId: loadedReceipt.id,
        confirmedCik,
        relation: "same_legal_entity" as const,
        confirmed: true as const,
      };
      const saved = await requests.current.submit(
        `attach:${JSON.stringify(payload)}`,
        requestId => attach.mutateAsync({ ...payload, requestId })
      );
      setSavedAttachment(saved);
      setNotice(
        "Exact receipt version attached. No analysis has been run by this action."
      );
      setConfirmed(false);
      void attachments.refetch();
    });
  }
  async function run(mode: "red_team" | "ic") {
    if (!canRun) return;
    const attachmentIds = [...selection].sort();
    await perform(`${modeLabel(mode)} run/save`, async () => {
      const saved = await requests.current.submit(
        `run:${dealId}:${mode}:${attachmentIds.join(",")}`,
        requestId =>
          (mode === "ic" ? committee : redTeam).mutateAsync({
            dealId,
            attachmentIds,
            requestId,
          }),
        result => result.status !== "pending"
      );
      setSavedRun(saved);
      setSelectedRun(saved.id);
      setNotice(
        saved.status === "failed"
          ? "Failed analysis saved; no decision recorded."
          : saved.status === "pending"
            ? "Run pending; no completed result confirmed."
            : "Analysis saved against the selected receipt versions. Review the result and citations below."
      );
      void runs.refetch();
    });
  }
  const attachmentRow = (row: DealEvidenceAttachment) => (
    <li
      key={row.id}
      className="min-w-0 space-y-2 border-t border-[var(--sh-border)] py-3"
    >
      <label className="flex min-h-11 items-start gap-2 text-sm">
        <input
          className="mt-1 size-4 shrink-0"
          type="checkbox"
          checked={selection.includes(row.id)}
          disabled={
            Boolean(busy) ||
            (!selection.includes(row.id) && selection.length >= 3)
          }
          onChange={e =>
            setSelection(
              e.target.checked
                ? [...selection, row.id]
                : selection.filter(id => id !== row.id)
            )
          }
        />
        <span className="min-w-0 break-words">
          CIK {row.confirmedCik}
          <span className={`mt-1 block ${muted}`}>
            Version{" "}
            <span className="font-mono">{row.receiptId.slice(0, 8)}</span> ·
            attached {time(row.createdAt)}
          </span>
          <span className={`mt-1 block ${muted}`}>
            Owner-confirmed same legal entity
          </span>
        </span>
      </label>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 h-auto whitespace-normal text-xs motion-reduce:transition-none"
        disabled={Boolean(busy)}
        onClick={() => inspect(row.receiptId)}
      >
        Inspect this receipt version
      </Button>
      <details>
        <summary className="min-h-11 cursor-pointer py-3 text-xs">
          Attachment provenance
        </summary>
        <p className="text-xs [overflow-wrap:anywhere]">
          Receipt {row.receiptId}
          <br />
          Attachment {row.id}
          <br />
          Payload hash {row.payloadHash}
          <br />
          Identity basis: owner-confirmed, not independently verified
        </p>
      </details>
    </li>
  );
  return (
    <section
      aria-label="Deal public evidence desk"
      className="my-6 min-w-0 space-y-5 border-y border-[var(--sh-border)] py-5 text-[var(--sh-text-primary)]"
    >
      <header>
        <p className={`${muted} font-mono uppercase tracking-widest`}>
          Deal #{dealId} · public evidence
        </p>
        <h2 className="mt-2 font-serif text-xl">
          The evidence behind the argument.
        </h2>
        <p className={`mt-2 ${muted}`}>
          Pin a saved version. Run analysis explicitly. Review its sources—not
          automatic approval.
        </p>
      </header>
      <ol
        aria-label="Evidence workflow"
        className="grid grid-cols-3 border-y border-[var(--sh-border)] py-3 text-xs"
      >
        <li className="min-w-0 border-r border-[var(--sh-border)] pr-2">
          <span className="font-mono">01 · Attach</span>
          <span className={`mt-1 block ${muted}`}>
            {attachments.data && !attachments.error
              ? `${attachmentRows.length} saved`
              : "Not confirmed"}
          </span>
        </li>
        <li className="min-w-0 border-r border-[var(--sh-border)] px-2">
          <span className="font-mono">02 · Analyze</span>
          <span className={`mt-1 block ${muted}`}>
            {selection.length} selected
          </span>
        </li>
        <li className="min-w-0 pl-2">
          <span className="font-mono">03 · Review</span>
          <span className={`mt-1 block ${muted}`}>
            {runs.data && !runs.error
              ? `${runRows.length} saved runs`
              : "Not confirmed"}
          </span>
        </li>
      </ol>
      {busy && (
        <p role="status" className="text-sm">
          {busy} pending. No new saved outcome confirmed yet.
        </p>
      )}
      {error && (
        <p role="alert" className="break-words text-sm">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      <details open={!attachmentRows.length}>
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
          Find & confirm a saved receipt
        </summary>
        <div className="space-y-4 pt-2">
          <form
            onSubmit={e => {
              e.preventDefault();
              const cik = issuerInput.trim();
              if (!/^\d{1,10}$/.test(cik) || /^0+$/.test(cik)) {
                setError("Enter a valid issuer CIK (1–10 digits).");
                return;
              }
              const normalized = cik.padStart(10, "0");
              setError(null);
              if (normalized === lookupCik) void savedReceipts.refetch();
              else {
                setLookupCik(normalized);
                setReceiptId(null);
                setConfirmed(false);
                setConfirmedCik("");
              }
            }}
          >
            <label className="block text-xs">
              Issuer CIK
              <input
                className={inputStyle}
                inputMode="numeric"
                maxLength={10}
                value={issuerInput}
                disabled={Boolean(busy)}
                onChange={e => setIssuerInput(e.target.value)}
              />
            </label>
            <Button
              type="submit"
              variant="outline"
              className="mt-2 min-h-11"
              disabled={Boolean(busy) || savedReceipts.isFetching}
            >
              Find saved receipts
            </Button>
            <p className={`mt-2 ${muted}`}>
              Saved versions only; this lookup does not contact the SEC.{" "}
              <a
                href="/public-intelligence"
                className="underline underline-offset-4"
              >
                Find an issuer or capture evidence in Public Intelligence
              </a>
              .
            </p>
          </form>
          {lookupCik && savedReceipts.isFetching && (
            <p role="status" className={muted}>
              Loading saved versions for CIK {lookupCik}…
            </p>
          )}
          {lookupCik && savedReceipts.error && (
            <p role="alert" className="text-sm">
              Saved receipts unavailable: {savedReceipts.error.message}. Select
              Find saved receipts to retry.
            </p>
          )}
          {lookupCik &&
            !savedReceipts.error &&
            savedReceipts.data &&
            (savedReceipts.data.length ? (
              <label className="block text-xs">
                Saved receipt version · CIK {lookupCik}
                <select
                  className={inputStyle}
                  value={
                    savedReceipts.data.some(item => item.id === receiptId)
                      ? receiptId || ""
                      : ""
                  }
                  disabled={Boolean(busy)}
                  onChange={e => {
                    if (e.target.value) inspect(e.target.value);
                    else {
                      setReceiptId(null);
                      setConfirmed(false);
                    }
                  }}
                >
                  <option value="">Choose a saved version</option>
                  {savedReceipts.data.map(item => (
                    <option key={item.id} value={item.id}>
                      {time(item.recordedAt)} · {item.status} ·{" "}
                      {item.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
                <span className={`mt-1 block ${muted}`}>
                  Up to 20 latest versions. Select one to inspect the
                  source-reported issuer name.
                </span>
              </label>
            ) : (
              <p role="status" className={muted}>
                No saved receipts returned for CIK {lookupCik}. Capture one in
                Public Intelligence first.
              </p>
            ))}
          <details>
            <summary className="min-h-11 cursor-pointer py-3 text-xs">
              Advanced: open a receipt ID
            </summary>
            <form
              onSubmit={e => {
                e.preventDefault();
                const id = receiptInput.trim().toLowerCase();
                if (!uuid.test(id)) {
                  setError("Enter a valid receipt UUID.");
                  return;
                }
                setError(null);
                if (id === receiptId) void receipt.refetch();
                else inspect(id);
              }}
            >
              <label className="block text-xs">
                Receipt ID
                <input
                  className={inputStyle}
                  maxLength={36}
                  value={receiptInput}
                  disabled={Boolean(busy)}
                  onChange={e => setReceiptInput(e.target.value)}
                />
              </label>
              <Button
                type="submit"
                variant="outline"
                className="mt-2 min-h-11"
                disabled={Boolean(busy) || receipt.isFetching}
              >
                Load saved receipt
              </Button>
              <p className={`mt-2 ${muted}`}>
                Lookup reads saved evidence only.{" "}
                <a
                  href="/public-intelligence"
                  className="underline underline-offset-4"
                >
                  Find or capture a receipt in Public Intelligence
                </a>
                .
              </p>
            </form>
          </details>
          {receiptId && receipt.isFetching && (
            <p role="status" className={muted}>
              Loading saved receipt…
            </p>
          )}
          {receiptId && receipt.error && (
            <div role="alert" className="space-y-2 text-sm">
              <p>Receipt lookup failed: {receipt.error.message}.</p>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={receipt.isFetching || Boolean(busy)}
                onClick={() => receipt.refetch()}
              >
                Retry selected receipt
              </Button>
            </div>
          )}
          {loadedReceipt && (
            <>
              <DealEvidenceReceiptSummary
                receipt={loadedReceipt}
                attached={attachmentRows.some(
                  row => row.receiptId === loadedReceipt.id
                )}
              />
              {loadedReceipt.status !== "unavailable" &&
              loadedReceipt.payload.company ? (
                <form
                  className="space-y-3"
                  onSubmit={e => {
                    e.preventDefault();
                    void attachSelected();
                  }}
                >
                  <label className="block text-xs">
                    Confirm issuer CIK (10 digits)
                    <input
                      className={inputStyle}
                      inputMode="numeric"
                      maxLength={10}
                      value={confirmedCik}
                      disabled={Boolean(busy)}
                      onChange={e => {
                        setConfirmedCik(e.target.value);
                        setConfirmed(false);
                      }}
                    />
                  </label>
                  {confirmedCik &&
                    confirmedCik !== loadedReceipt.payload.company.cik && (
                      <p role="alert" className="text-xs">
                        CIK must exactly match{" "}
                        {loadedReceipt.payload.company.cik}.
                      </p>
                    )}
                  <label className="flex min-h-11 items-start gap-2 text-sm">
                    <input
                      className="mt-1 size-4 shrink-0"
                      type="checkbox"
                      checked={confirmed}
                      disabled={Boolean(busy)}
                      onChange={e => setConfirmed(e.target.checked)}
                    />
                    <span>
                      I confirm {loadedReceipt.payload.company.name} (CIK{" "}
                      {loadedReceipt.payload.company.cik}) is the same legal
                      entity as deal #{dealId}, not a competitor, parent, or
                      similarly named company.
                    </span>
                  </label>
                  <p className={muted}>
                    This is your confirmation, not independent identity
                    verification. Expired snapshots stay labeled; attachments
                    never update to a newer capture automatically.
                  </p>
                  <Button
                    type="submit"
                    className={action}
                    disabled={!canAttach || Boolean(busy)}
                  >
                    Attach this exact receipt version
                  </Button>
                </form>
              ) : (
                <p className={muted}>
                  A failed capture cannot be attached. Select a successful
                  receipt with a verified source CIK.
                </p>
              )}
            </>
          )}
        </div>
      </details>
      <section aria-label="Attached evidence versions" className="space-y-3">
        <h3 className="font-serif text-lg">Choose analysis inputs</h3>
        {attachments.error ? (
          <div role="alert" className="space-y-2 text-sm">
            <p>Attachments unavailable: {attachments.error.message}</p>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => attachments.refetch()}
              disabled={attachments.isFetching}
            >
              Retry attachments
            </Button>
          </div>
        ) : attachments.isFetching ? (
          <p role="status" className={muted}>
            Loading saved attachments…
          </p>
        ) : (
          !attachmentRows.length && (
            <p className={muted}>
              No saved attachments. Load and confirm a receipt above.
            </p>
          )
        )}
        <ul>{attachmentRows.slice(0, 3).map(attachmentRow)}</ul>
        {attachmentRows.length > 3 && (
          <details>
            <summary className="min-h-11 cursor-pointer py-3 text-xs">
              Show remaining {attachmentRows.length - 3} attachments
            </summary>
            <ul>{attachmentRows.slice(3).map(attachmentRow)}</ul>
          </details>
        )}
        <p className={muted}>
          {selection.length} of 3 versions selected · All must refer to one
          confirmed CIK; duplicate receipts are not allowed. Showing up to 100
          saved attachments.
        </p>
        {(selectedCiks.size > 1 || duplicateReceipts) && (
          <p role="alert" className="text-sm">
            Select distinct receipt versions for the same legal entity.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className={action}
            disabled={!canRun || Boolean(busy)}
            onClick={() => run("red_team")}
          >
            Run Red Team on selected evidence
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 h-auto whitespace-normal motion-reduce:transition-none"
            disabled={!canRun || Boolean(busy)}
            onClick={() => run("ic")}
          >
            Run IC on selected evidence
          </Button>
        </div>
        <p className={muted}>
          Each explicit run may call paid models. Reading history does not. A
          new source capture never rewrites a saved run.
        </p>
      </section>
      <section aria-label="Evidence analysis history" className="space-y-3">
        <h3 className="font-serif text-lg">Review a saved run</h3>
        <p className={muted}>
          Review the exact inputs and cited hypotheses. Viewing is not a
          recorded approval or review attestation.
        </p>
        {runs.error ? (
          <p role="alert" className="text-sm">
            Run history unavailable: {runs.error.message}
          </p>
        ) : runs.isFetching ? (
          <p role="status" className={muted}>
            Loading saved run history…
          </p>
        ) : (
          !runRows.length && (
            <p className={muted}>No saved evidence-aware runs.</p>
          )
        )}
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={runs.isFetching || runDetail.isFetching || Boolean(busy)}
          onClick={() => {
            void runs.refetch();
            if (activeId) void runDetail.refetch();
          }}
        >
          Refresh saved run status
        </Button>
        {runRows[0]?.status === "failed" && (
          <p role="status" className="text-sm">
            Latest saved run failed. An older success is historical, not the
            latest outcome.
          </p>
        )}
        {runRows.length > 0 && (
          <label className="block text-xs">
            Saved run version (latest 20)
            <select
              className={inputStyle}
              value={activeId || ""}
              onChange={e => setSelectedRun(e.target.value)}
            >
              {runRows.map(saved => (
                <option key={saved.id} value={saved.id}>
                  {time(saved.startedAt)} · {modeLabel(saved.mode)} ·{" "}
                  {saved.status} · {saved.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
        )}
        {activeId && runDetail.isFetching && !active && (
          <p role="status" className={muted}>
            Loading selected run…
          </p>
        )}
        {activeId && runDetail.error && (
          <p role="alert" className="text-sm">
            Selected run could not be refreshed: {runDetail.error.message}. Use
            Refresh saved run status to retry.
          </p>
        )}
        {active && (
          <DealEvidenceRunView
            run={active}
            previous={previous}
            historical={
              active.id !== runRows[0]?.id ||
              Boolean(busy || error || runs.error || runDetail.error)
            }
          />
        )}
      </section>
    </section>
  );
}
