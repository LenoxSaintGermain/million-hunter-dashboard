/** Explicit Cloud Run job only. Synthetic bytes; no DB, auth session or broker calls. */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { DealDocumentStorageService } from "./dealDocumentStorage";
async function main() {
const [mode, probe] = process.argv.slice(2);
assert.ok(mode === "write" || mode === "read");
assert.match(probe ?? "", /^uat-[a-f0-9]{7}-[0-9]+$/);
assert.equal(process.env.DATABASE_URL ?? "", "");
assert.equal(process.env.DEAL_DOCUMENT_GCS_BUCKET, "third-signal-v2-capital-documents-us-central1");
const bytes = Buffer.from(`Illustrative storage UAT only. Not a customer document. ${probe}\n`);
const hash = crypto.createHash("sha256").update(bytes).digest("hex");
const storage = new DealDocumentStorageService();
if (mode === "write") {
  const receipt = await storage.saveDocument({ownerUserId:987654321,dossierId:probe,documentId:"synthetic-probe",filename:"synthetic-probe.txt",buffer:bytes,mimeType:"text/plain",retentionPolicy:"90_day"});
  assert.equal(receipt.storageBackend,"cloud_gcs");
  assert.equal(receipt.contentHash,hash);
}
assert.deepEqual(await storage.readDocument(987654321,probe,"synthetic-probe",hash),bytes);
console.log(JSON.stringify({check:"private-document-storage",mode,probe,hash,passed:true,database:false,orders:0}));
}
main().catch(error => { console.error("Storage probe failed:", error.message); process.exitCode = 1; });
