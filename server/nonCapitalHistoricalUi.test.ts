import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const detail = readFileSync(new URL("../client/src/pages/DealDetail.tsx", import.meta.url), "utf8");
const studio = readFileSync(new URL("../client/src/pages/ThesisStudio.tsx", import.meta.url), "utf8");

describe("non-Capital historical UI contracts", () => {
  it("separates historical outputs from current figures without claiming a verified fingerprint", () => {
    expect(detail).toContain("Historical analysis · current inputs unverified");
    expect(detail).toContain("There is no verified input fingerprint");
    expect(detail).toContain("a new run is also not independent verification");
    expect(detail).not.toContain("Analysis cached — re-run to refresh with latest data");
    expect(detail).not.toContain("signal.redTeamSummary.slice");
  });

  it("keeps specialist output in initially closed native disclosure and reruns explicit", () => {
    const specialist = detail.slice(detail.indexOf("function SignalCard"), detail.indexOf("export default function"));
    expect(specialist).toContain("<details");
    expect(specialist).toContain("<summary");
    expect(specialist).not.toMatch(/<details[^>]*\bopen\b/);
    expect(detail).toContain("onClick={() => analyzeSignals.mutate({ dealId, force: true })}");
    expect(detail).not.toMatch(/useEffect\s*\(/);
  });

  it("uses general intake language and distinguishes an unavailable library from empty", () => {
    expect(studio).not.toMatch(/Wingate|Chad|Cincinnati/);
    expect(studio).toContain("Saved criteria could not be loaded.");
    expect(studio).toContain("No saved property criteria yet.");
    expect(studio).toContain("{t.name}");
    expect(studio).toContain("{t.clientLabel}");
  });
});
