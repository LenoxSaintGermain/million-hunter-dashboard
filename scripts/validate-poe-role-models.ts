/**
 * Validate the provider-diverse Poe role models used by Signal Hunter.
 *
 * Safe and read-only: fetches Poe's public catalog, then sends one tiny JSON
 * completion per candidate when Poe_api_key is present. It never touches the DB.
 */
import "dotenv/config";
import OpenAI from "openai";
import {
  POE_DEEPSEEK_V4_FLASH,
  POE_DEEPSEEK_V4_PRO,
  POE_KIMI_K3,
} from "../shared/models";

const CANDIDATES = [POE_KIMI_K3, POE_DEEPSEEK_V4_PRO, POE_DEEPSEEK_V4_FLASH] as const;

async function main() {
  const catalogResponse = await fetch("https://api.poe.com/v1/models");
  if (!catalogResponse.ok) throw new Error(`Poe catalog failed (${catalogResponse.status})`);
  const catalog = await catalogResponse.json() as { data?: Array<{ id?: string; owned_by?: string }> };
  const ids = new Map((catalog.data ?? []).map((model) => [model.id, model]));

  console.log(`Poe role-model validation — ${new Date().toISOString()}`);
  for (const id of CANDIDATES) {
    const model = ids.get(id);
    console.log(`  catalog ${id}: ${model ? `PASS (${model.owned_by ?? "unknown provider"})` : "FAIL"}`);
    if (!model) process.exitCode = 1;
  }

  const key = process.env.Poe_api_key;
  if (!key) {
    console.log("Poe_api_key is absent; catalog validation complete, live probes skipped.");
    return;
  }

  const client = new OpenAI({ apiKey: key, baseURL: "https://api.poe.com/v1" });
  for (const model of CANDIDATES) {
    const started = Date.now();
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: 'Return only {"ok":true}' }],
        max_tokens: 256,
        temperature: 0,
      });
      const text = response.choices[0]?.message?.content ?? "";
      const ok = /"ok"\s*:\s*true/.test(text);
      console.log(`  probe   ${model}: ${ok ? "PASS" : "FAIL"} (${Date.now() - started}ms)`);
      if (!ok) process.exitCode = 1;
    } catch (error: any) {
      console.log(`  probe   ${model}: FAIL (${String(error?.message ?? error).slice(0, 180)})`);
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error("Poe role-model validator crashed:", error);
  process.exit(1);
});
