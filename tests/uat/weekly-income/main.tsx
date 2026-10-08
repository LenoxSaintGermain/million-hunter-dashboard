import { createRoot } from "react-dom/client";
import { SCENARIOS } from "./scenarios";
import "./fixture.css";

// ?s=<scenario> renders one state for screenshots; no parameter renders all.
function Fixture() {
  const selected = new URLSearchParams(window.location.search).get("s");
  const entries = Object.entries(SCENARIOS).filter(([key]) => !selected || key === selected);
  return (
    <main className="aperture-editorial mx-auto max-w-4xl space-y-6 p-6" style={{ background: "var(--bone)", minHeight: "100vh" }}>
      <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>Fixture render · zero API · no orders · Guided mode</p>
      {entries.map(([key, scenario]) => (
        <div key={key} data-scenario={key} className="space-y-2">
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>{scenario.title}</p>
          {scenario.render()}
        </div>
      ))}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
