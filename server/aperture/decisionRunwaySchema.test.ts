import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Decision Runway authoritative schema", () => {
  it("adds immutable revisions and exact order bindings without rewriting legacy history", () => {
    const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0055_aperture_decision_runway_authority.sql"), "utf8");

    expect(schema).toContain('mysqlTable("aperture_decision_runs"');
    expect(schema).toContain('mysqlTable("aperture_decision_revisions"');
    expect(schema).toContain('mysqlTable("aperture_pending_outcomes"');
    expect(schema).toContain('decisionRunId: int("decision_run_id")');
    expect(schema).toContain('decisionRevisionId: int("decision_revision_id")');
    expect(schema).toContain('clientOrderId: varchar("client_order_id"');
    expect(schema).toContain('dispatchError: text("dispatch_error")');
    expect(migration).toContain("UNIQUE KEY `aperture_decision_runs_research_run_uq`");
    expect(migration).toContain("UNIQUE KEY `aperture_decision_revisions_version_uq`");
    expect(migration).toContain("UNIQUE KEY `broker_orders_client_order_uq`");
    expect(migration).not.toMatch(/INSERT\s+INTO\s+`?aperture_runway_states/i);
    expect(migration).not.toMatch(/UPDATE\s+`?aperture_runway_states/i);
  });

  it("enforces the current Decision Run inside every paper-order lifecycle boundary", () => {
    const orderFlow = readFileSync(resolve(process.cwd(), "server/aperture/orderFlow.ts"), "utf8");
    const router = readFileSync(resolve(process.cwd(), "server/apertureRouter.ts"), "utf8");

    expect(orderFlow).toContain('evaluateOrder(input, "preflight")');
    expect(orderFlow).toContain('evaluateOrder(input, "create_proposal")');
    expect(orderFlow).toContain('rerunStoredOrder(order, userId, "approve")');
    expect(orderFlow).toContain('rerunStoredOrder(order, userId, "submit")');
    expect(orderFlow).toContain("decisionRunId: decisionAuthorization?.decisionRunId ?? null");
    expect(orderFlow).toContain("queuePaperOutcome");
    expect(orderFlow).toContain('for("update")');
    expect(orderFlow).toContain("lockCurrentDecisionRevision");
    expect(router).toContain('eq(brokerOrders.status, "submitted")');
    expect(router).toContain("isNull(brokerOrders.brokerOrderId)");
    expect(orderFlow).toContain("getOrderByClientOrderId(order.clientOrderId)");
    expect(orderFlow).toContain("The order remains locked for broker reconciliation");
    expect(router).toContain("A paper order dispatch is still resolving for this Decision Run");
    expect(router).toContain("Arbitrary run attachment is retired");
    expect(router).toContain("Decision history is immutable");
  });
});
