import { describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { resolveServerPort, listenHttp } from "./_core/serverStartup";

describe("production readiness", () => {
  it.each(["production", "test", undefined])("never opens a temporary listener in %s", async NODE_ENV => {
    const scan = vi.fn(async () => 8081);
    expect(await resolveServerPort({ PORT: "8080", NODE_ENV }, scan)).toBe(8080);
    expect(scan).not.toHaveBeenCalled();
  });
  it("retains development port discovery", async () => {
    const scan = vi.fn(async () => 3001);
    expect(await resolveServerPort({ NODE_ENV: "development" }, scan)).toBe(3001);
    expect(scan).toHaveBeenCalledWith(3000);
  });
  it.each(["0", "65536", "8080garbage", "-1", "1.5", ""])("rejects invalid PORT %s", async PORT => {
    await expect(resolveServerPort({ PORT, NODE_ENV: "production" }, vi.fn())).rejects.toThrow("PORT");
  });
  it("serves HTTP immediately after listen and rejects a busy port without fallback", async () => {
    const server = createServer((_req, res) => res.end("ready"));
    const duplicate = createServer();
    await listenHttp(server, 0);
    const port = (server.address() as { port: number }).port;
    try {
      expect(await (await fetch(`http://127.0.0.1:${port}`)).text()).toBe("ready");
      await expect(listenHttp(duplicate, port)).rejects.toMatchObject({ code: "EADDRINUSE" });
      expect(duplicate.listening).toBe(false);
    } finally {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
