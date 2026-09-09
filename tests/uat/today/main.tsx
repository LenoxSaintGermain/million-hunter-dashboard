import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "../../../client/src/components/ui/tooltip";
import { DailyPlayList } from "../../../client/src/components/aperture/DailyPlayList";
import { completeRefresh, receipts, scenarios, setScenario } from "./queryFixture";
import "./fixture.css";

function Fixture() {
  const [scenario, select] = useState<typeof scenarios[number]>("Quiet");
  const [receipt, setReceipt] = useState("");
  return <TooltipProvider><main className="aperture-editorial mx-auto max-w-5xl space-y-4 p-4">
    <div className="rounded-xl border p-3 text-sm"><p className="font-semibold">Illustrative UAT · zero API · no orders</p>
      <label className="mt-2 flex flex-wrap items-center gap-2">Scenario<select className="min-h-11 rounded border px-2" value={scenario} onChange={event => { const value = event.target.value as typeof scenarios[number]; select(value); setScenario(value); }}>{scenarios.map(name => <option key={name}>{name}</option>)}</select></label>
      <div className="mt-2 flex flex-wrap gap-2"><button className="min-h-11 border px-3" onClick={completeRefresh}>Complete fixture refresh</button><button className="min-h-11 border px-3" onClick={() => setReceipt(JSON.stringify(receipts))}>Inspect fixture requests</button></div>
      <p role="status">{receipt}</p>
    </div>
    <DailyPlayList onNewMission={() => setReceipt("Navigation requested: Mission. No lifecycle mutation.")} onNewResearch={() => setReceipt("Navigation requested: Research. No lifecycle mutation.")} onOpenRun={(run, candidate, view) => setReceipt(`Exact task: ${run}/${candidate}/${view}`)} />
  </main></TooltipProvider>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
