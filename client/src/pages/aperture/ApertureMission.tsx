import { ArrowLeft } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { DecisionRunway } from "@/components/aperture/DecisionRunway";

export default function ApertureMission() {
  const [, navigate] = useLocation();
  const [isReceiptRoute, receiptParams] = useRoute("/aperture/decision/:decisionRunId/revision/:revisionId");
  const receiptTarget = isReceiptRoute
    && Number.isInteger(Number(receiptParams?.decisionRunId))
    && Number.isInteger(Number(receiptParams?.revisionId))
    ? { decisionRunId: Number(receiptParams?.decisionRunId), revisionId: Number(receiptParams?.revisionId) }
    : null;

  return <DashboardLayout>
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <Button variant="ghost" className="min-h-11 px-0" onClick={() => navigate("/aperture")}><ArrowLeft className="mr-2 h-4 w-4" />Today</Button>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-signal)" }}>Capital Aperture · Mission</p>
        <h1 className="mt-1 font-serif text-3xl leading-tight" style={{ color: "var(--sh-text-primary)" }}>{receiptTarget ? "Review this mission revision." : "Create or revise the plan."}</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--sh-fg-muted)" }}>Three sections, one underwriting action. Saved decisions remain available when you return.</p>
      </div>
    </div>
    <DecisionRunway
      receiptTarget={receiptTarget}
      onNewResearch={() => navigate("/aperture?setup=1&draft=1")}
      onOpenResearchRun={(runId) => navigate(`/aperture/run/${runId}`)}
    />
  </DashboardLayout>;
}
