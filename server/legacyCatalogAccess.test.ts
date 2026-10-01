import { describe, expect, it, vi } from "vitest";
import { LEGACY_CATALOG_ROUTERS } from "./_core/legacyCatalogAccess";
import { publicProcedure, protectedProcedure, operatorProcedure, router } from "./_core/trpc";

describe("legacy catalog containment before resolver execution", () => {
  for (const name of LEGACY_CATALOG_ROUTERS) {
    it(`${name}: denies anonymous and every non-admin role for reads and mutations`, async () => {
      const resolver = vi.fn(() => "private");
      const app = router({ [name]: router({
        read: publicProcedure.query(resolver),
        write: protectedProcedure.mutation(resolver),
        operate: operatorProcedure.mutation(resolver),
      }) });
      for (const role of [null, "user", "investor", "insurance", "capital_operator"]) {
        const caller = app.createCaller({ user: role ? { id: 2, role } : null } as any);
        for (const action of ["read", "write", "operate"]) {
          await expect((caller as any)[name][action]()).rejects.toMatchObject({ code: role ? "FORBIDDEN" : "UNAUTHORIZED" });
        }
      }
      expect(resolver).not.toHaveBeenCalled();
      await expect((app.createCaller({ user: { id: 1, role: "admin" } } as any) as any)[name].read()).resolves.toBe("private");
    });
  }
  it("leaves public fixtures and independently scoped Capital handlers to their existing policies", async () => {
    const app = router({ publicDeals: router({ search: publicProcedure.query(() => "fixture") }), aperture: router({ read: protectedProcedure.query(() => "scoped") }) });
    await expect(app.createCaller({ user: null } as any).publicDeals.search()).resolves.toBe("fixture");
    await expect(app.createCaller({ user: { id: 2, role: "capital_operator" } } as any).aperture.read()).resolves.toBe("scoped");
  });
});
