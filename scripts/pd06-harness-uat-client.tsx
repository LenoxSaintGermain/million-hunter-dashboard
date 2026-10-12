/** Actual product page with visible server-defined scenarios; no cache injection. */
import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { Route, Switch } from "wouter";
import { Toaster } from "sonner";
import { trpc } from "../client/src/lib/trpc";
import DealDetail from "../client/src/pages/DealDetail";
import CandidateBoard from "../client/src/pages/aperture/CandidateBoard";
import { TooltipProvider } from "../client/src/components/ui/tooltip";
import "../client/src/index.css";

type State = { manifest: Record<string, { dealId: number; receiptId: string | null; cik: string; description: string; capital?: { runId: number; candidateId: number; securityId: number; symbol: string } }>; counters: Record<string, unknown> };
const scenario = new URLSearchParams(location.search).get("scenario") ?? "success";
const allowed = ["success", "failure", "stale", "missing", "contradictory"];
if (!allowed.includes(scenario)) throw new Error("Unknown UAT scenario");
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } } });
const client = trpc.createClient({ links: [httpBatchLink({ url: `/api/trpc/${scenario}`, transformer: superjson })] });
function Harness() {
  const [state, setState] = React.useState<State | null>(null);
  const [error, setError] = React.useState("");
  const inspect = () => fetch("/__uat/state").then(r => { if (!r.ok) throw new Error("Harness state unavailable"); return r.json(); }).then(setState).catch(e => setError(String(e)));
  React.useEffect(() => { void inspect(); }, []);
  const fixture = state?.manifest[scenario];
  return <>
    <aside className="border-b border-rule bg-paper p-4" aria-label="Synthetic UAT controls">
      <strong>SYNTHETIC LOCAL UAT · actual DealDetail · no live providers · no real customer</strong>
      <p>Harness-only legacy read disables the public-demo flag to exercise explicit evidence actions. SQL fixtures and all outputs remain synthetic.</p>
      <p>Account shell is deliberately unavailable: no broker snapshot, account limits, or trading authority is supplied. The account-limits alert is expected in this fixture.</p>
      <p>Scenario: {scenario}. {fixture?.description}</p>
      <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="UAT scenarios">{state && Object.entries(state.manifest).map(([name, value]) => <a className="underline" key={name} href={`/deals/${value.dealId}?scenario=${name}`}>{name}</a>)}</nav>
      <p>Receipt: {fixture?.receiptId ?? "No receipt"} · confirmed test CIK: {fixture?.cik}</p>
      {state?.manifest.success.capital && <p className="break-words"><a className="underline" href={`/aperture/run/${state.manifest.success.capital.runId}?candidate=${state.manifest.success.capital.candidateId}&inspect=0&scenario=success`}>Open synthetic CandidateBoard · explicit binding required</a> · Security ID {state.manifest.success.capital.securityId} · {state.manifest.success.capital.symbol} · use a saved v2 analysis from deal {state.manifest.success.dealId}.</p>}
      <button className="border border-rule p-2" onClick={() => void inspect()}>Inspect request counters (read-only)</button>
      <details><summary>Server counters — compare before and after navigation</summary><pre className="overflow-auto">{JSON.stringify(state?.counters, null, 2)}</pre></details>
      {error && <p role="alert">{error}</p>}
    </aside>
    {fixture && <Switch><Route path="/deals/:id"><DealDetail /></Route><Route path="/aperture/run/:id"><CandidateBoard /></Route><Route><main className="p-4"><p>Choose a synthetic scenario above. Other product routes are intentionally not mounted.</p><a className="underline" href={`/deals/${fixture.dealId}?scenario=${scenario}`}>Open actual DealDetail</a></main></Route></Switch>}
    <Toaster />
  </>;
}
createRoot(document.getElementById("root")!).render(<trpc.Provider client={client} queryClient={queryClient}><QueryClientProvider client={queryClient}><TooltipProvider><Harness /></TooltipProvider></QueryClientProvider></trpc.Provider>);
