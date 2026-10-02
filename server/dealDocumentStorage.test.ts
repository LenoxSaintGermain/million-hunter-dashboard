import { describe, expect, it, beforeEach } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import { DealDocumentStorageService } from "./dealDocumentStorage";
import { parseDealDocument } from "./dealDocumentParser";
import { DealDocumentRepository } from "./dealDocumentRepository";
import { DealDocumentService } from "./dealDocumentService";
import { exampleMandate } from "../shared/acquisitionV2";

describe("Deal Document Production Engine & Storage Pipeline", () => {
  const testStorageDir = path.resolve(process.cwd(), "storage", "test-deal-documents");
  let storage: DealDocumentStorageService;
  let repo: DealDocumentRepository;
  let service: DealDocumentService;

  beforeEach(async () => {
    await fs.rm(testStorageDir, { recursive: true, force: true });
    storage = new DealDocumentStorageService(testStorageDir);
    repo = new DealDocumentRepository();
    repo._clearMemoryStore();
    service = new DealDocumentService();
  });

  describe("1. Bounded File Storage & Security", () => {
    it("stores files under server-controlled private directory with SHA-256 hash", async () => {
      const buffer = Buffer.from("Hello Deal World, Asking Price: $1,500,000", "utf8");
      const res = await storage.saveDocument({
        ownerUserId: 101,
        dossierId: "dossier-abc",
        documentId: "doc-123",
        filename: "test.txt",
        buffer,
        mimeType: "text/plain",
      });

      expect(res.byteSize).toBe(buffer.length);
      expect(res.contentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(res.storageKey).toContain("101/dossier-abc/doc-123-");

      // Verify file is readable and verified by hash
      const readBack = await storage.readDocument(101, "dossier-abc", "doc-123", res.contentHash);
      expect(readBack.toString("utf8")).toBe(buffer.toString("utf8"));
    });

    it("rejects files exceeding the 25MB bounded size limit", async () => {
      const oversized = Buffer.alloc(26 * 1024 * 1024); // 26MB
      await expect(storage.saveDocument({
        ownerUserId: 101,
        dossierId: "dossier-abc",
        documentId: "doc-over",
        filename: "big.pdf",
        buffer: oversized,
        mimeType: "application/pdf",
      })).rejects.toThrow(/file_size_exceeded/);
    });

    it("rejects unsupported MIME types", async () => {
      const buffer = Buffer.from("malicious executable", "utf8");
      await expect(storage.saveDocument({
        ownerUserId: 101,
        dossierId: "dossier-abc",
        documentId: "doc-bad",
        filename: "evil.exe",
        buffer,
        mimeType: "application/x-msdownload",
      })).rejects.toThrow(/unsupported_mime_type/);
    });

    it("handles permanent and 90-day retention policies with metadata sidecars", async () => {
      const buf1 = Buffer.from("Permanent filing data", "utf8");
      const res1 = await storage.saveDocument({
        ownerUserId: 101,
        dossierId: "dossier-abc",
        documentId: "doc-perm",
        filename: "perm.txt",
        buffer: buf1,
        mimeType: "text/plain",
        retentionPolicy: "permanent",
      });
      expect(res1.retentionPolicy).toBe("permanent");
      expect(res1.purgeAfter).toBeUndefined();

      const meta1 = await storage.getMetadata(101, "dossier-abc", "doc-perm", res1.contentHash);
      expect(meta1?.retentionPolicy).toBe("permanent");

      const buf2 = Buffer.from("90-day confidential teaser", "utf8");
      const res2 = await storage.saveDocument({
        ownerUserId: 101,
        dossierId: "dossier-abc",
        documentId: "doc-90d",
        filename: "temp.txt",
        buffer: buf2,
        mimeType: "text/plain",
        retentionPolicy: "90_day",
      });
      expect(res2.retentionPolicy).toBe("90_day");
      expect(res2.purgeAfter).toBeDefined();
      const purgeDate = new Date(res2.purgeAfter!).getTime();
      const now = Date.now();
      expect(purgeDate - now).toBeGreaterThan(89 * 24 * 60 * 60 * 1000);
      expect(purgeDate - now).toBeLessThanOrEqual(91 * 24 * 60 * 60 * 1000);
    });

    it("supports S3 cloud storage client when configured", async () => {
      const mockS3Client = {
        send: async (cmd: any) => {
          if (cmd.constructor.name === "PutObjectCommand") {
            return {};
          }
          if (cmd.constructor.name === "GetObjectCommand") {
            const buf = Buffer.from("S3 payload content", "utf8");
            return {
              Body: (async function* () {
                yield buf;
              })(),
            };
          }
          if (cmd.constructor.name === "DeleteObjectCommand") {
            return {};
          }
          return {};
        },
      } as any;

      const s3Storage = new DealDocumentStorageService({
        s3Bucket: "third-signal-deal-documents",
        s3Client: mockS3Client,
      });

      const buf = Buffer.from("S3 payload content", "utf8");
      const saved = await s3Storage.saveDocument({
        ownerUserId: 101,
        dossierId: "dossier-s3",
        documentId: "doc-s3-1",
        filename: "test.txt",
        buffer: buf,
        mimeType: "text/plain",
      });

      expect(saved.storageBackend).toBe("cloud_s3");
      expect(saved.bucket).toBe("third-signal-deal-documents");
      expect(saved.storageKey).toContain("deal-documents/101/dossier-s3/doc-s3-1-");

      const read = await s3Storage.readDocument(101, "dossier-s3", "doc-s3-1", saved.contentHash);
      expect(read.toString("utf8")).toBe("S3 payload content");

      const deleted = await s3Storage.deleteDocument(101, "dossier-s3", "doc-s3-1", saved.contentHash);
      expect(deleted).toBe(true);
    });
  });

  describe("2. Isolated Document Parser Failure Modes", () => {
    it("detects malformed PDF missing %PDF- header", async () => {
      const corrupted = Buffer.from("NOT_A_REAL_PDF_FILE", "utf8");
      await expect(parseDealDocument({
        buffer: corrupted,
        mimeType: "application/pdf",
        filename: "broken.pdf",
      })).rejects.toThrow(/malformed_pdf/);
    });

    it("parses plain text documents into bounded pages", async () => {
      const textContent = "Asking Price: $2,500,000\nRevenue: $4,000,000\nSDE: $950,000";
      const parsed = await parseDealDocument({
        buffer: Buffer.from(textContent, "utf8"),
        mimeType: "text/plain",
        filename: "deal_teaser.txt",
      });

      expect(parsed.format).toBe("text_pages");
      expect(parsed.pageCount).toBe(1);
      expect(parsed.pages[0].text).toBe(textContent);
      expect(parsed.totalCharacters).toBe(textContent.length);
    });

    it("rejects text documents exceeding text budget", async () => {
      const hugeText = "A".repeat(1_000_001);
      await expect(parseDealDocument({
        buffer: Buffer.from(hugeText, "utf8"),
        mimeType: "text/plain",
        filename: "huge.txt",
      })).rejects.toThrow(/text_budget_exceeded/);
    });
  });

  describe("3. Multi-Tenant Owner Isolation", () => {
    it("prevents User 202 from accessing, downloading, or updating User 101's dossier", async () => {
      const dossier = await service.createDossier(101, {
        name: "Confidential Alpha Corp",
        intent: "business_acquisition",
        reportingPeriod: "FY2025",
      });

      expect(dossier.ownerUserId).toBe(101);

      // User 202 attempts to read dossier
      await expect(service.getDossier(202, dossier.id)).rejects.toThrow(/forbidden_access/);

      // User 202 attempts to upload document to User 101's dossier
      const textBuf = Buffer.from("Asking Price: $1,000,000; Revenue: $2,000,000; SDE: $500,000", "utf8");
      await expect(service.uploadDocument(202, {
        dossierId: dossier.id,
        revision: dossier.currentRevision,
        filename: "teaser.txt",
        mimeType: "text/plain",
        buffer: textBuf,
      })).rejects.toThrow(/forbidden_access/);

      // User 202 listing dossiers does not see User 101's dossier
      const user2List = await service.listDossiers(202);
      expect(user2List.find(d => d.id === dossier.id)).toBeUndefined();

      // User 101 sees it
      const user1List = await service.listDossiers(101);
      expect(user1List.find(d => d.id === dossier.id)).toBeDefined();
    });
  });

  describe("4. End-to-End Workflow: Upload -> Evidence Review -> Confirmation -> Invalidation -> Evaluation", () => {
    it("executes complete lifecycle with cascading invalidation and optimistic concurrency", async () => {
      const owner = 301;
      const initialDossier = await service.createDossier(owner, {
        name: "Summit Precision Tooling",
        intent: "business_acquisition",
        reportingPeriod: "TTM-2026-Q1",
      });

      expect(initialDossier.currentRevision).toBe(1);

      // 1. Upload first document
      const doc1Text = "Asking Price: $2,500,000\nGross Revenue: $5,200,000\nSDE: $1,200,000";
      const upload1 = await service.uploadDocument(owner, {
        dossierId: initialDossier.id,
        revision: 1,
        filename: "summit_teaser.txt",
        mimeType: "text/plain",
        buffer: Buffer.from(doc1Text, "utf8"),
      });

      expect(upload1.dossier.currentRevision).toBe(2);
      expect(upload1.dossier.documents.length).toBe(1);
      expect(upload1.snapshot.proposals.length).toBeGreaterThan(0);

      const askProposal = upload1.snapshot.proposals.find(p => p.field === "ask" && p.value === 2_500_000)!;
      const revProposal = upload1.snapshot.proposals.find(p => p.field === "revenue" && p.value === 5_200_000)!;
      const sdeProposal = upload1.snapshot.proposals.find(p => p.field === "sde" && p.value === 1_200_000)!;

      expect(askProposal).toBeDefined();
      expect(revProposal).toBeDefined();
      expect(sdeProposal).toBeDefined();

      // 2. Confirm operator facts
      const conf1 = await service.confirmProposal(owner, {
        dossierId: initialDossier.id,
        revision: 2,
        proposalId: askProposal.id,
        reason: "Stated listing ask from initial executive summary",
        consideredProposalIds: [askProposal.id],
      });
      expect(conf1.dossier.currentRevision).toBe(3);

      const conf2 = await service.confirmProposal(owner, {
        dossierId: initialDossier.id,
        revision: 3,
        proposalId: revProposal.id,
        reason: "Stated gross revenue from verified summary",
        consideredProposalIds: [revProposal.id],
      });
      expect(conf2.dossier.currentRevision).toBe(4);

      const conf3 = await service.confirmProposal(owner, {
        dossierId: initialDossier.id,
        revision: 4,
        proposalId: sdeProposal.id,
        reason: "Stated SDE before add-back adjustments",
        consideredProposalIds: [sdeProposal.id],
      });
      expect(conf3.dossier.currentRevision).toBe(5);

      // Verify facts are registered
      expect(conf3.dossier.confirmedFacts["ask"]).toBeDefined();
      expect(conf3.dossier.confirmedFacts["revenue"]).toBeDefined();
      expect(conf3.dossier.confirmedFacts["sde"]).toBeDefined();

      // 3. Review mandate
      const reviewRes = await service.reviewMandate(owner, {
        dossierId: initialDossier.id,
        revision: 5,
        mandate: exampleMandate,
      });
      expect(reviewRes.dossier.currentRevision).toBe(6);
      expect(reviewRes.dossier.reviewReceipt?.operator).toBe(`user_${owner}`);

      // 4. Evaluate
      const evalRes = await service.evaluate(owner, {
        dossierId: initialDossier.id,
        revision: 6,
      });
      expect(evalRes.dossier.currentRevision).toBe(7);
      expect(evalRes.evaluation.verdict.value).toBe("HOLD"); // In document evaluation without narrative, missing positive narrative checks keep verdict at HOLD
      expect(evalRes.evaluation.ratios.multiple.value).toBeCloseTo(2_500_000 / 1_200_000);
      expect(evalRes.evaluation.confirmedFacts["ask"].value).toBe(2_500_000);

      // 5. Test Optimistic Concurrency Rejection
      await expect(service.confirmProposal(owner, {
        dossierId: initialDossier.id,
        revision: 2, // STALE REVISION!
        proposalId: askProposal.id,
        reason: "Stale edit",
        consideredProposalIds: [askProposal.id],
      })).rejects.toThrow(/modified concurrently/i);

      // 6. Test Cascading Invalidation on Document Upload
      // When a second document is added, all prior confirmations and evaluations MUST be invalidated!
      const doc2Text = "Revised SDE: $800,000 after inventory adjustment";
      const upload2 = await service.uploadDocument(owner, {
        dossierId: initialDossier.id,
        revision: 7,
        filename: "revised_cbr.txt",
        mimeType: "text/plain",
        buffer: Buffer.from(doc2Text, "utf8"),
      });

      expect(upload2.dossier.currentRevision).toBe(8);
      expect(upload2.dossier.documents.length).toBe(2);
      // Invalidation verified:
      expect(Object.keys(upload2.dossier.confirmedFacts).length).toBe(0);
      expect(upload2.dossier.reviewReceipt).toBeNull();
      expect(upload2.dossier.evaluationReceipt).toBeNull();

      // 7. Test Authorized Download
      const dl = await service.downloadDocument(owner, {
        dossierId: initialDossier.id,
        documentId: upload1.dossier.documents[0].id,
      });
      expect(dl.filename).toBe("summit_teaser.txt");
      expect(Buffer.from(dl.base64Content, "base64").toString("utf8")).toBe(doc1Text);

      // Foreign user cannot download
      await expect(service.downloadDocument(999, {
        dossierId: initialDossier.id,
        documentId: upload1.dossier.documents[0].id,
      })).rejects.toThrow(/forbidden_access/);

      // 8. Test Document Deletion
      const afterDel = await service.deleteDocument(owner, {
        dossierId: initialDossier.id,
        revision: 8,
        documentId: upload2.dossier.documents[1].id,
      });
      expect(afterDel.dossier.currentRevision).toBe(9);
      expect(afterDel.dossier.documents.length).toBe(1);
    });
  });
});
