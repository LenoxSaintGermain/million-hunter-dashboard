import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Parity plan PR-05b (signal-hunter-ux/parity/pr-plan.md): Capital surfaces use
// the house palette tokens and plain text labels, not off-palette Tailwind
// colours or emoji.
const root = resolve(__dirname, "../../client/src");
const SWEPT = [
  "components/aperture/AttentionDecisionCard.tsx",
  "components/aperture/ConstraintResolverCard.tsx",
  "components/aperture/GuidedDecisionQueue.tsx",
  "components/aperture/GuidedThesisWizard.tsx",
  "components/aperture/ManualOrderTicketModal.tsx",
  "components/aperture/MonitoringFindingCard.tsx",
  "components/aperture/MonitoringFindingReview.tsx",
  "components/aperture/MicroTooltip.tsx",
  "components/aperture/TodayAttentionBriefing.tsx",
  "pages/aperture/ApertureExecute.tsx",
  "pages/aperture/ApertureHome.tsx",
  "pages/aperture/AperturePlayDesk.tsx",
  "pages/aperture/CandidateBoard.tsx",
  "pages/aperture/ThesisGraphEditor.tsx",
];
// Pictographic emoji only; typographic marks such as ✓ ✗ · → stay allowed.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{26A0}\u{26A1}\u{2728}\u{1F6E1}]/u;
const OFF_PALETTE = /\b(?:dark:)?(?:hover:)?(?:bg|text|border)-(?:emerald|sky|slate)-\d{2,3}\b/;

describe("Capital colour and emoji sweep", () => {
  it.each(SWEPT)("%s has no pictographic emoji", (path) => {
    const source = readFileSync(resolve(root, path), "utf8");
    expect(source).not.toMatch(EMOJI);
  });

  it.each(SWEPT)("%s has no emerald, sky or slate utility colours", (path) => {
    const source = readFileSync(resolve(root, path), "utf8");
    expect(source.match(OFF_PALETTE)?.[0] ?? null).toBeNull();
  });

  it.each(["components/aperture/GuidedThesisWizard.tsx", "components/aperture/MicroTooltip.tsx"])("%s uses defined surface tokens (bg-surface is not a theme colour)", (path) => {
    const source = readFileSync(resolve(root, path), "utf8");
    expect(source).not.toMatch(/\b(?:hover:)?bg-surface(?:-2)?(?=[\s"`])/);
  });

  it("keeps the evidence and compile actions as plain labels", () => {
    const board = readFileSync(resolve(root, "pages/aperture/CandidateBoard.tsx"), "utf8");
    expect(board).toContain("Accept this evidence and clear the check");
    expect(board).not.toContain("Accept AI Evidence");
    for (const path of ["pages/aperture/ApertureHome.tsx", "pages/aperture/ThesisGraphEditor.tsx"]) {
      expect(readFileSync(resolve(root, path), "utf8")).toContain("Compile &amp; Stage Best Fit");
    }
  });

  it("renders Guided badges in the uppercase label style", () => {
    const queue = readFileSync(resolve(root, "components/aperture/GuidedDecisionQueue.tsx"), "utf8");
    expect(queue).toMatch(/text-\[11px\] font-semibold uppercase tracking-wider/);
  });
});
