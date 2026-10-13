import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Storage, type Bucket } from "@google-cloud/storage";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "application/octet-stream",
]);

export type RetentionPolicy = "permanent" | "90_day";

export interface StoredDocumentStorageResult {
  storageKey: string;
  contentHash: string;
  byteSize: number;
  retentionPolicy: RetentionPolicy;
  createdAt: string;
  purgeAfter?: string;
  storageBackend: "local_fs" | "cloud_s3" | "cloud_gcs";
  bucket?: string;
}

const storageBaseDir = process.env.DEAL_DOCUMENT_STORAGE_DIR
  ? path.resolve(process.env.DEAL_DOCUMENT_STORAGE_DIR)
  : path.resolve(process.cwd(), "storage", "deal-documents");

export class DealDocumentStorageService {
  private baseDir: string;
  private s3Client: S3Client | null = null;
  private s3Bucket: string | null = null;
  private gcsBucket: Bucket | null = null;
  private gcsBucketName: string | null = null;

  constructor(options?: { customBaseDir?: string; s3Bucket?: string; s3Client?: S3Client; gcsBucket?: Bucket; gcsBucketName?: string }) {
    this.baseDir = options?.customBaseDir ? path.resolve(options.customBaseDir) : storageBaseDir;
    const bucket = options?.s3Bucket ?? process.env.DEAL_DOCUMENT_S3_BUCKET ?? process.env.DEAL_DOCUMENT_STORAGE_BUCKET;
    const gcs = options?.gcsBucketName ?? process.env.DEAL_DOCUMENT_GCS_BUCKET;
    if (gcs && bucket) throw new Error("ambiguous_document_storage: Configure only one cloud backend");
    if (gcs) {
      this.gcsBucketName = gcs;
      this.gcsBucket = options?.gcsBucket ?? new Storage().bucket(gcs);
    }
    if (bucket) {
      this.s3Bucket = bucket;
      this.s3Client = options?.s3Client ?? new S3Client({
        region: process.env.DEAL_DOCUMENT_S3_REGION ?? process.env.AWS_REGION ?? "us-central1",
        ...(process.env.DEAL_DOCUMENT_S3_ENDPOINT ? { endpoint: process.env.DEAL_DOCUMENT_S3_ENDPOINT, forcePathStyle: true } : {}),
      });
    }
  }

  private async ensureDir(dirPath: string) {
    await fs.mkdir(dirPath, { recursive: true });
  }

  uploadAvailability() {
    const available = process.env.NODE_ENV !== "production" || !!(this.s3Client && this.s3Bucket) || !!this.gcsBucket;
    return { available, message: available ? null : "Document uploads are unavailable until private durable storage is configured. Existing dossier records remain readable." };
  }

  assertStoredLocation(meta: {storageBackend?: string; bucket?: string}) {
    const backend = this.gcsBucket ? "cloud_gcs" : this.s3Client ? "cloud_s3" : "local_fs";
    if ((meta.storageBackend ?? "local_fs") !== backend || (meta.bucket && meta.bucket !== (this.gcsBucketName ?? this.s3Bucket))) {
      throw new Error("document_storage_location_unavailable: This original belongs to a different storage backend; no substitute was returned.");
    }
  }

  getStoragePath(ownerUserId: number, dossierId: string, documentId: string, contentHash: string): string {
    const safeOwner = String(ownerUserId).replace(/[^0-9]/g, "");
    const safeDossier = dossierId.replace(/[^a-zA-Z0-9-]/g, "");
    const safeDoc = documentId.replace(/[^a-zA-Z0-9-]/g, "");
    const safeHash = contentHash.replace(/[^a-f0-9]/g, "");
    return path.join(this.baseDir, safeOwner, safeDossier, `${safeDoc}-${safeHash}.bin`);
  }

  getS3StorageKey(ownerUserId: number, dossierId: string, documentId: string, contentHash: string): string {
    const safeOwner = String(ownerUserId).replace(/[^0-9]/g, "");
    const safeDossier = dossierId.replace(/[^a-zA-Z0-9-]/g, "");
    const safeDoc = documentId.replace(/[^a-zA-Z0-9-]/g, "");
    const safeHash = contentHash.replace(/[^a-f0-9]/g, "");
    return `deal-documents/${safeOwner}/${safeDossier}/${safeDoc}-${safeHash}.bin`;
  }

  async saveDocument(params: {
    ownerUserId: number;
    dossierId: string;
    documentId: string;
    filename: string;
    buffer: Buffer;
    mimeType: string;
    retentionPolicy?: RetentionPolicy;
  }): Promise<StoredDocumentStorageResult> {
    const { ownerUserId, dossierId, documentId, buffer, mimeType } = params;
    if (!this.uploadAvailability().available) {
      throw new Error("durable_storage_required: Document upload is unavailable until private durable storage is configured. No file was saved.");
    }
    const retentionPolicy = params.retentionPolicy ?? "permanent";

    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`file_size_exceeded: Document size ${buffer.length} exceeds 25MB limit`);
    }

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new Error(`unsupported_mime_type: MIME type ${mimeType} is not supported`);
    }

    const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");
    const now = new Date().toISOString();
    const purgeAfter = retentionPolicy === "90_day"
      ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    if (this.gcsBucket && this.gcsBucketName) {
      const storageKey = this.getS3StorageKey(ownerUserId, dossierId, documentId, contentHash);
      await this.gcsBucket.file(storageKey).save(buffer, {
        resumable: false,
        validation: "crc32c",
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: {
          contentType: mimeType,
          cacheControl: "private, no-store",
          ...(purgeAfter ? { customTime: purgeAfter } : {}),
          metadata: { owneruserid: String(ownerUserId), dossierid: dossierId, documentid: documentId, contenthash: contentHash, retentionpolicy: retentionPolicy, createdat: now, ...(purgeAfter ? { purgeafter: purgeAfter } : {}) },
        },
      });
      return {storageKey, contentHash, byteSize: buffer.length, retentionPolicy, createdAt: now, purgeAfter, storageBackend: "cloud_gcs", bucket: this.gcsBucketName};
    }

    // S3-compatible storage path
    if (this.s3Client && this.s3Bucket) {
      const s3Key = this.getS3StorageKey(ownerUserId, dossierId, documentId, contentHash);
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: mimeType,
        Metadata: {
          owneruserid: String(ownerUserId),
          dossierid: dossierId,
          documentid: documentId,
          contenthash: contentHash,
          retentionpolicy: retentionPolicy,
          createdat: now,
          ...(purgeAfter ? { purgeafter: purgeAfter } : {}),
        },
      }));

      return {
        storageKey: s3Key,
        contentHash,
        byteSize: buffer.length,
        retentionPolicy,
        createdAt: now,
        purgeAfter,
        storageBackend: "cloud_s3",
        bucket: this.s3Bucket,
      };
    }

    // Local filesystem storage path
    const targetPath = this.getStoragePath(ownerUserId, dossierId, documentId, contentHash);
    const targetDir = path.dirname(targetPath);
    await this.ensureDir(targetDir);
    await fs.writeFile(targetPath, buffer);

    const relativeStorageKey = path.relative(this.baseDir, targetPath);
    const metaPath = targetPath.replace(/\.bin$/, ".meta.json");
    const metaRecord: StoredDocumentStorageResult = {
      storageKey: relativeStorageKey,
      contentHash,
      byteSize: buffer.length,
      retentionPolicy,
      createdAt: now,
      purgeAfter,
      storageBackend: "local_fs",
    };
    await fs.writeFile(metaPath, JSON.stringify(metaRecord, null, 2), "utf8");

    return metaRecord;
  }

  async readDocument(ownerUserId: number, dossierId: string, documentId: string, contentHash: string): Promise<Buffer> {
    if (this.gcsBucket) {
      try {
        const [buffer] = await this.gcsBucket.file(this.getS3StorageKey(ownerUserId, dossierId, documentId, contentHash)).download({validation:"crc32c"});
        if (crypto.createHash("sha256").update(buffer).digest("hex") !== contentHash) throw new Error("document_integrity_compromised: Hash mismatch on storage read");
        return buffer;
      } catch (err) {
        if ((err as {code?: number}).code === 404) throw new Error("document_not_found: The requested document file does not exist");
        throw err;
      }
    }
    if (this.s3Client && this.s3Bucket) {
      const s3Key = this.getS3StorageKey(ownerUserId, dossierId, documentId, contentHash);
      try {
        const res = await this.s3Client.send(new GetObjectCommand({
          Bucket: this.s3Bucket,
          Key: s3Key,
        }));
        if (!res.Body) {
          throw new Error("document_not_found: The requested document stream was empty");
        }
        const chunks: Uint8Array[] = [];
        for await (const chunk of res.Body as any) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        const readHash = crypto.createHash("sha256").update(buffer).digest("hex");
        if (readHash !== contentHash) {
          throw new Error("document_integrity_compromised: Hash mismatch on storage read");
        }
        return buffer;
      } catch (err: unknown) {
        const anyErr = err as any;
        if (anyErr.name === "NoSuchKey" || anyErr.$metadata?.httpStatusCode === 404) {
          throw new Error("document_not_found: The requested document file does not exist");
        }
        throw err;
      }
    }

    const targetPath = this.getStoragePath(ownerUserId, dossierId, documentId, contentHash);
    try {
      const buffer = await fs.readFile(targetPath);
      // Verify integrity
      const readHash = crypto.createHash("sha256").update(buffer).digest("hex");
      if (readHash !== contentHash) {
        throw new Error("document_integrity_compromised: Hash mismatch on storage read");
      }
      return buffer;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error("document_not_found: The requested document file does not exist");
      }
      throw err;
    }
  }

  async getMetadata(ownerUserId: number, dossierId: string, documentId: string, contentHash: string): Promise<StoredDocumentStorageResult | null> {
    if (this.gcsBucket) {
      const storageKey = this.getS3StorageKey(ownerUserId, dossierId, documentId, contentHash);
      const [meta] = await this.gcsBucket.file(storageKey).getMetadata();
      return {storageKey, contentHash, byteSize: Number(meta.size), retentionPolicy: meta.metadata?.retentionpolicy === "90_day" ? "90_day" : "permanent", createdAt: String(meta.metadata?.createdat ?? meta.timeCreated), purgeAfter: meta.metadata?.purgeafter ? String(meta.metadata.purgeafter) : undefined, storageBackend:"cloud_gcs", bucket:this.gcsBucketName!};
    }
    const targetPath = this.getStoragePath(ownerUserId, dossierId, documentId, contentHash);
    const metaPath = targetPath.replace(/\.bin$/, ".meta.json");
    try {
      const data = await fs.readFile(metaPath, "utf8");
      return JSON.parse(data) as StoredDocumentStorageResult;
    } catch {
      return null;
    }
  }

  async deleteDocument(ownerUserId: number, dossierId: string, documentId: string, contentHash: string): Promise<boolean> {
    if (this.gcsBucket) {
      await this.gcsBucket.file(this.getS3StorageKey(ownerUserId, dossierId, documentId, contentHash)).delete({ignoreNotFound:true});
      return true;
    }
    if (this.s3Client && this.s3Bucket) {
      const s3Key = this.getS3StorageKey(ownerUserId, dossierId, documentId, contentHash);
      try {
        await this.s3Client.send(new DeleteObjectCommand({
          Bucket: this.s3Bucket,
          Key: s3Key,
        }));
        return true;
      } catch (error) {
        throw error;
      }
    }

    const targetPath = this.getStoragePath(ownerUserId, dossierId, documentId, contentHash);
    const metaPath = targetPath.replace(/\.bin$/, ".meta.json");
    try {
      await fs.unlink(targetPath);
      try { await fs.unlink(metaPath); } catch {}
      return true;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      throw err;
    }
  }

  async deleteDossierStorage(ownerUserId: number, dossierId: string): Promise<void> {
    if (this.gcsBucket || this.s3Client) throw new Error("cloud_dossier_delete_requires_explicit_documents: Delete each authorized document first");
    const safeOwner = String(ownerUserId).replace(/[^0-9]/g, "");
    const safeDossier = dossierId.replace(/[^a-zA-Z0-9-]/g, "");
    const dossierDir = path.join(this.baseDir, safeOwner, safeDossier);
    try {
      await fs.rm(dossierDir, { recursive: true, force: true });
    } catch {
      // Ignore if dir does not exist
    }
  }
}

export const dealDocumentStorage = new DealDocumentStorageService();
