import { beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => vi.fn());
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: auth } }));
vi.mock("./_core/context", () => ({ resolveMergedUser: async (user: unknown) => user }));
import { registerStorageProxy } from "./_core/storageProxy";
beforeEach(() => vi.clearAllMocks());
it.each([null, "user", "investor", "capital_operator"])("does not sign storage for %s", async role => {
  let handler: any;
  registerStorageProxy({ get: (_path: string, fn: unknown) => { handler = fn; } } as any);
  if (role) auth.mockResolvedValue({ role }); else auth.mockRejectedValue(new Error("No session"));
  const response: any = { set: vi.fn(), status: vi.fn(), send: vi.fn(), redirect: vi.fn() };
  response.status.mockReturnValue(response);
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Must not sign"));
  try {
    await handler({ path: "/manus-storage/private.pdf" }, response);
    expect(response.status).toHaveBeenCalledWith(role ? 403 : 401);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.redirect).not.toHaveBeenCalled();
  } finally { fetchSpy.mockRestore(); }
});
