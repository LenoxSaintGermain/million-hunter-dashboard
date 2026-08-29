import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Capital Aperture Play Desk contract", () => {
  it("exposes one cross-run operator route in both Capital nav modes", () => {
    const app = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
    const shell = readFileSync(resolve(process.cwd(), "client/src/components/aperture/ApertureShell.tsx"), "utf8");

    expect(app).toContain('<Route path="/aperture/plays"');
    expect(shell.match(/href: "\/aperture\/plays", label: "Play Desk"/g)).toHaveLength(2);
  });

  it("keeps the desk read-only and owner scoped", () => {
    const router = readFileSync(resolve(process.cwd(), "server/apertureRouter.ts"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/aperture/AperturePlayDesk.tsx"), "utf8");

    expect(router).toContain("desk: router({");
    expect(router).toContain("summary: capitalOperatorProcedure.query");
    expect(router).toContain("eq(portfolioAccounts.userId, ctx.user.id)");
    expect(router).toContain("eq(apertureDecisionRuns.userId, ctx.user.id)");
    expect(router).toContain("state.netQty > 0 && state.latestOpenId === order.id");
    expect(page).toContain("Review, approval, and submission remain separate human actions.");
    expect(page).toContain("Dispatch unresolved");
    expect(page).toContain('order.status === "filled" && order.intent !== "close"');
    expect(page).not.toContain(".useMutation(");
  });

  it("gives a skipped memo a safe continuation instead of a dead end", () => {
    const memo = readFileSync(resolve(process.cwd(), "client/src/pages/aperture/MemoDrawer.tsx"), "utf8");

    expect(memo).toContain("Return to evidence");
    expect(memo).toContain("Open Play Desk");
    expect(memo).toContain("Nothing is ready to approve from this memo.");
  });
});
