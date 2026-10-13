import { afterEach, expect, it, vi } from "vitest";
import { DealDocumentStorageService } from "./dealDocumentStorage";
import { DealDocumentRepository } from "./dealDocumentRepository";
vi.mock("./db", () => ({ getDb: async () => null }));
afterEach(() => vi.unstubAllEnvs());
const params = {ownerUserId: 101, dossierId:"uat-dossier", documentId:"uat-document", filename:"fixture.txt", buffer:Buffer.from("Illustrative UAT only"), mimeType:"text/plain"};
function fixture() {
  const blobs = new Map<string, Buffer>();
  const save = vi.fn(async (key: string, data: Buffer) => { blobs.set(key, data); });
  const bucket = {file: (key: string) => ({
    save: (data: Buffer, options: unknown) => save(key, data, options),
    download: async () => { if (!blobs.has(key)) throw Object.assign(new Error("missing"), {code:404}); return [blobs.get(key)]; },
    delete: async () => { blobs.delete(key); },
  })};
  return {bucket, blobs, save};
}
it("uses private GCS and reads exact bytes from a separate storage instance", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const f = fixture();
  const a = new DealDocumentStorageService({gcsBucket: f.bucket as any, gcsBucketName:"private-uat"});
  const saved = await a.saveDocument({...params, retentionPolicy:"90_day"});
  expect(saved.storageBackend).toBe("cloud_gcs");
  expect(saved.bucket).toBe("private-uat");
  const options = f.save.mock.calls[0][2] as any;
  expect(options.preconditionOpts.ifGenerationMatch).toBe(0);
  expect(options.metadata.cacheControl).toBe("private, no-store");
  expect(options.metadata.customTime).toBe(saved.purgeAfter);
  const b = new DealDocumentStorageService({gcsBucket:f.bucket as any,gcsBucketName:"private-uat"});
  expect(await b.readDocument(101, params.dossierId, params.documentId, saved.contentHash)).toEqual(params.buffer);
  await expect(b.readDocument(202, params.dossierId, params.documentId,saved.contentHash)).rejects.toThrow(/document_not_found/);
  f.blobs.set(saved.storageKey,Buffer.from("corrupt"));
  await expect(b.readDocument(101,params.dossierId,params.documentId,saved.contentHash)).rejects.toThrow(/integrity/);
});
it("does not hide a cloud permission failure with a local write", async () => {
  const bucket = {file:()=>({save:async()=>{throw new Error("permission denied")}})};
  const storage = new DealDocumentStorageService({gcsBucket:bucket as any,gcsBucketName:"private-uat"});
  await expect(storage.saveDocument(params)).rejects.toThrow("permission denied");
});
it("never falls back to memory for production dossier persistence", async () => {
  vi.stubEnv("NODE_ENV","production");
  await expect(new DealDocumentRepository().listDossiers(101)).rejects.toThrow(/database_unavailable/);
});
