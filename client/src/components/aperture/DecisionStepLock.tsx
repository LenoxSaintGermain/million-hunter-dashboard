import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";

type Authority = {
  branch: "research" | "eligible" | "conditional" | "cash";
  decisionRunId: number;
  revisionId: number;
  blocker?: string | null;
};

export function decisionAuthorityAllowsDownstream(authority: Authority | null | undefined) {
  return authority == null || authority.branch === "research" || authority.branch === "eligible";
}

export function DecisionStepLock({ authority, step, onOpenReceipt }: {
  authority: Authority;
  step: "Play Slate" | "Ticket";
  onOpenReceipt: () => void;
}) {
  const conditional = authority.branch === "conditional";
  return <section className="mx-auto max-w-3xl rounded-xl border p-5 sm:p-6" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface)" }}>
    <div className="flex items-start gap-3">
      <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--sh-signal)" }} />
      <div className="min-w-0">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>{step} locked by the current mission</p>
        <h1 className="mt-1 font-serif text-2xl" style={{ color: "var(--sh-text-primary)" }}>{conditional ? "Resolve the conditional receipt first." : "This mission currently preserves cash."}</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{authority.blocker || (conditional ? "Required context is not verified. The earlier research run remains historical and cannot be used to bypass the current mission gate." : "No downstream ticket is available from a cash decision.")}</p>
        <Button type="button" className="mt-4 min-h-11 w-full sm:w-auto" onClick={onOpenReceipt}>{conditional ? "Open conditional receipt" : "Open cash decision"}</Button>
      </div>
    </div>
  </section>;
}
