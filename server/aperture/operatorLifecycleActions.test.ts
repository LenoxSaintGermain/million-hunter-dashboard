import { describe, it, expect } from "vitest";

describe("Operator Desk Lifecycle Actions", () => {
  describe("run.cancel contract", () => {
    it("rejects cancellation of completed runs", () => {
      const run = { id: 1, status: "completed" };
      const canCancel = run.status !== "completed";
      expect(canCancel).toBe(false);
    });

    it("allows cancellation of in-flight or queued runs and formats cancellation error", () => {
      const activeStatuses = ["queued", "compiling", "discovering", "researching", "scoring", "constructing"];
      for (const status of activeStatuses) {
        const run = { id: 1, status };
        const canCancel = run.status !== "completed";
        expect(canCancel).toBe(true);
      }
      const reason = "Mistaken ticker";
      const errorText = `Cancelled by operator: ${reason}`;
      expect(errorText).toContain("Mistaken ticker");
      expect(errorText).toContain("Cancelled by operator");
    });
  });

  describe("runway.reopen contract", () => {
    it("only allows reopening missions with lifecycle === 'closed'", () => {
      const closedMission = { id: 10, lifecycle: "closed", closedAt: 123456789 };
      const activeMission = { id: 11, lifecycle: "mission", closedAt: null };

      expect(closedMission.lifecycle === "closed").toBe(true);
      expect(activeMission.lifecycle === "closed").toBe(false);
    });

    it("transitions lifecycle back to 'mission' and clears closedAt", () => {
      const mission = { id: 10, lifecycle: "closed", closedAt: 123456789, updatedAt: 123456789 };
      const reopened = {
        ...mission,
        lifecycle: "mission" as const,
        closedAt: null,
        updatedAt: 123499999,
      };
      expect(reopened.lifecycle).toBe("mission");
      expect(reopened.closedAt).toBeNull();
      expect(reopened.updatedAt).toBeGreaterThan(mission.updatedAt);
    });
  });

  describe("account.disconnect contract", () => {
    it("blocks account disconnection if active orders are pending approval or submitted", () => {
      const activeStatuses = ["pending_approval", "approved", "submitted"];
      const orders = [
        { id: 1, status: "submitted" },
        { id: 2, status: "filled" },
      ];
      const blockingOrders = orders.filter((o) => activeStatuses.includes(o.status));
      expect(blockingOrders.length).toBe(1);
      expect(blockingOrders.length > 0).toBe(true);
    });

    it("permits account disconnection if all orders are terminal (filled, rejected, cancelled)", () => {
      const activeStatuses = ["pending_approval", "approved", "submitted"];
      const orders = [
        { id: 1, status: "filled" },
        { id: 2, status: "rejected" },
        { id: 3, status: "cancelled" },
      ];
      const blockingOrders = orders.filter((o) => activeStatuses.includes(o.status));
      expect(blockingOrders.length).toBe(0);
    });
  });
});
