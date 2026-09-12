import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLocation, useRoute, useSearch } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { DecisionRunway } from "@/components/aperture/DecisionRunway";
import { ObjectiveMissionFlow } from "@/components/aperture/ObjectiveMissionFlow";
import { trpc } from "@/lib/trpc";

export default function ApertureMission() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const discovery = trpc.aperture.strategy.capabilities.useQuery(undefined, { retry: false });
  const [isReceiptRoute, receiptParams] = useRoute("/aperture/decision/:decisionRunId/revision/:revisionId");
  const receiptTarget = isReceiptRoute
    && Number.isSafeInteger(Number(receiptParams?.decisionRunId)) && Number(receiptParams?.decisionRunId) > 0
    && Number.isSafeInteger(Number(receiptParams?.revisionId)) && Number(receiptParams?.revisionId) > 0
    ? { decisionRunId: Number(receiptParams?.decisionRunId), revisionId: Number(receiptParams?.revisionId) }
    : null;
  const newObjective = !receiptTarget && new URLSearchParams(search).get("objective") === "1";
  // Carried from the three-tap entry so the operator is not asked the amount twice.
  const seedCapital = Number(new URLSearchParams(search).get("capital"));
  const seedCapitalCents = Number.isFinite(seedCapital) && seedCapital > 0 ? Math.round(seedCapital * 100) : null;
  const invalidReceipt = isReceiptRoute && !receiptTarget;

  return <DashboardLayout>
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <Button variant="ghost" className="min-h-11 px-0" onClick={() => navigate("/aperture")}><ArrowLeft className="mr-2 h-4 w-4" />Today</Button>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-signal)" }}>Capital Aperture · Mission</p>
        <h1 className="sr-only">{receiptTarget ? "Mission revision" : "Mission"}</h1>
      </div>
      {/* "Explore a capital objective" named the concept, not the action, and sat
          as a ghost-weight outline button among four others — the operator could
          not find the sentence entry at all and asked whether it had been
          removed. The label now says what you do, and the control is primary. */}
      {!isReceiptRoute && !newObjective && discovery.data?.enabled && <Button data-start-from-sentence className="min-h-11" onClick={() => navigate("/aperture/mission?objective=1")}>Start from a sentence<ArrowRight className="ml-2 h-4 w-4" /></Button>}
    </div>
    {invalidReceipt ? <section role="alert" className="rounded-xl border p-4" style={{ borderColor: "var(--sh-red)" }}>
      <h2 className="font-semibold">Mission link is incomplete</h2>
      <p className="mt-2 text-sm">Open the saved Mission from Today. This link has not started or replaced a Mission.</p>
    </section> : newObjective ? <ObjectiveMissionFlow newObjective seedCapitalCents={seedCapitalCents} onAccepted={({ decisionRunId, revisionId }) =>
      navigate(`/aperture/decision/${decisionRunId}/revision/${revisionId}`, { replace: true })} /> : <DecisionRunway
      key={receiptTarget ? `receipt:${receiptTarget.decisionRunId}:${receiptTarget.revisionId}` : "mission"}
      receiptTarget={receiptTarget}
      onNewResearch={() => navigate("/aperture?setup=1&draft=1")}
      onOpenResearchRun={(runId) => navigate(`/aperture/run/${runId}`)}
    />}
  </DashboardLayout>;
}
