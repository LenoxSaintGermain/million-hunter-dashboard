import type { Express } from "express";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { resolveMergedUser } from "./context";
export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    res.set("Cache-Control", "no-store");
    let user;
    try { user = await resolveMergedUser(await sdk.authenticateRequest(req)); }
    catch { res.status(401).send("Authentication required"); return; }
    if (user.role !== "admin") { res.status(403).send("Legacy storage requires administrator access"); return; }
    const key = req.path.replace(/^\/manus-storage\//, "");
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
