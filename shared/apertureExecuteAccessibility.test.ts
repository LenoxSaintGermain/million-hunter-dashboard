import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const executeSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/aperture/ApertureExecute.tsx"),
  "utf8",
);
const tabsSource = readFileSync(
  resolve(process.cwd(), "client/src/components/ui/tabs.tsx"),
  "utf8",
);

describe("Aperture Execute mobile and accessibility contract", () => {
  it("uses the clear three-step paper lifecycle language", () => {
    expect(executeSource).toContain(">Paper ticket</TabsTrigger>");
    expect(executeSource).toContain(">Check whether thesis still holds</TabsTrigger>");
    expect(executeSource).toContain(">Outcome &amp; notes</TabsTrigger>");
    expect(executeSource).not.toContain("Decision follow-through");
  });

  it("keeps lifecycle navigation semantic and keyboard managed", () => {
    expect(executeSource).toContain('aria-label="Paper lifecycle"');
    expect(executeSource.match(/<TabsTrigger className="min-h-11/g)).toHaveLength(3);
    expect(tabsSource).toContain("TabsPrimitive.List");
    expect(tabsSource).toContain("TabsPrimitive.Trigger");
  });

  it("stacks mobile order content and removes undersized actions", () => {
    expect(executeSource).toContain("flex min-w-0 flex-col gap-3 lg:flex-row");
    expect(executeSource).toContain("grid-cols-1 gap-1 p-1 sm:grid-cols-3");
    expect(executeSource).toContain("min-h-11 w-full text-xs sm:w-auto");
    expect(executeSource).not.toContain('className="h-7 text-xs"');
    expect(executeSource).not.toContain("overflow-x-auto");
  });

  it("keeps rejection secondary to the single approval action", () => {
    const pendingActionStart = executeSource.lastIndexOf('{o.status === "pending_approval" && (');
    const pendingActions = executeSource.slice(
      pendingActionStart,
      executeSource.indexOf('{o.status === "approved" && (', pendingActionStart),
    );

    expect(pendingActionStart).toBeGreaterThan(0);
    expect(pendingActions).toContain("Approve paper ticket");
    expect(pendingActions).toContain('<Button variant="outline"');
    expect(pendingActions).toContain("Do not approve");
  });
});
