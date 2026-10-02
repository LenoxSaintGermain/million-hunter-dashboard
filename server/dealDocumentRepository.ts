import crypto from "node:crypto";
import { eq, and } from "drizzle-orm";
import { researchResults } from "../drizzle/schema";
import { getDb } from "./db";
import {
  type DealDossier,
  type DealDocument,
  type StoredDocumentMetadata,
  dealDossierSchema,
  dealDocumentSchema,
} from "../shared/dealDocument";

const dossierKey = (ownerUserId: number, dossierId: string) => `deal-document:user:${ownerUserId}:dossier:${dossierId}`;
const ownerIndexKey = (dossierId: string) => `deal-document:dossier:${dossierId}:owner`;
const documentPagesKey = (dossierId: string, documentId: string, version: number) =>
  `deal-document:dossier:${dossierId}:doc:${documentId}:v${version}`;

// In-memory test store fallback when DATABASE_URL is unset
const memoryStore = new Map<string, string>();

export class DealDocumentRepository {
  private async getRaw(key: string): Promise<string | null> {
    const db = await getDb();
    if (!db) {
      return memoryStore.get(key) ?? null;
    }
    const [row] = await db
      .select({ content: researchResults.content })
      .from(researchResults)
      .where(eq(researchResults.subjectKey, key))
      .limit(1);
    return row?.content ?? null;
  }

  private async setRaw(key: string, content: string): Promise<void> {
    const db = await getDb();
    if (!db) {
      memoryStore.set(key, content);
      return;
    }
    const [existing] = await db
      .select({ id: researchResults.id })
      .from(researchResults)
      .where(eq(researchResults.subjectKey, key))
      .limit(1);

    if (existing) {
      await db
        .update(researchResults)
        .set({ content, createdAt: Date.now() })
        .where(eq(researchResults.id, existing.id));
    } else {
      await db.insert(researchResults).values({
        subjectKey: key,
        subjectType: "deal",
        model: "deal-document-engine",
        query: key,
        content,
        citations: [],
        createdAt: Date.now(),
        expiresAt: Date.now() + 365 * 86400 * 1000, // 1 year retention
      });
    }
  }

  private async deleteRaw(key: string): Promise<void> {
    const db = await getDb();
    if (!db) {
      memoryStore.delete(key);
      return;
    }
    await db.delete(researchResults).where(eq(researchResults.subjectKey, key));
  }

  async getDossierOwner(dossierId: string): Promise<number | null> {
    const raw = await this.getRaw(ownerIndexKey(dossierId));
    if (!raw) return null;
    const owner = Number(raw);
    return Number.isSafeInteger(owner) && owner > 0 ? owner : null;
  }

  async createDossier(params: {
    ownerUserId: number;
    name: string;
    intent: "business_acquisition" | "scenario_analysis";
    currency: "USD";
    reportingPeriod: string;
    dealId?: number | null;
  }): Promise<DealDossier> {
    const dossierId = crypto.randomUUID();
    const now = new Date().toISOString();

    const dossier: DealDossier = dealDossierSchema.parse({
      id: dossierId,
      ownerUserId: params.ownerUserId,
      dealId: params.dealId ?? null,
      name: params.name,
      intent: params.intent,
      currency: params.currency,
      reportingPeriod: params.reportingPeriod,
      currentRevision: 1,
      documents: [],
      confirmedFacts: {},
      mandate: null,
      reviewReceipt: null,
      evaluationReceipt: null,
      createdAt: now,
      updatedAt: now,
    });

    await this.setRaw(dossierKey(params.ownerUserId, dossierId), JSON.stringify(dossier));
    await this.setRaw(ownerIndexKey(dossierId), String(params.ownerUserId));

    return dossier;
  }

  async getDossier(ownerUserId: number, dossierId: string): Promise<DealDossier> {
    const owner = await this.getDossierOwner(dossierId);
    if (owner !== null && owner !== ownerUserId) {
      throw new Error("forbidden_access: Access denied to foreign dossier");
    }

    const raw = await this.getRaw(dossierKey(ownerUserId, dossierId));
    if (!raw) {
      throw new Error("dossier_not_found: The requested dossier was not found");
    }

    const parsed = dealDossierSchema.parse(JSON.parse(raw));
    if (parsed.ownerUserId !== ownerUserId) {
      throw new Error("forbidden_access: Access denied to foreign dossier");
    }
    return parsed;
  }

  async updateDossier(ownerUserId: number, dossier: DealDossier, expectedRevision: number): Promise<DealDossier> {
    const existing = await this.getDossier(ownerUserId, dossier.id);

    if (existing.currentRevision !== expectedRevision) {
      throw new Error("concurrent_modification: Dossier was modified concurrently; please reload");
    }

    const updated: DealDossier = dealDossierSchema.parse({
      ...dossier,
      ownerUserId, // Enforce server-derived owner
      currentRevision: existing.currentRevision + 1,
      updatedAt: new Date().toISOString(),
    });

    await this.setRaw(dossierKey(ownerUserId, dossier.id), JSON.stringify(updated));
    return updated;
  }

  async listDossiers(ownerUserId: number): Promise<DealDossier[]> {
    const db = await getDb();
    if (!db) {
      const prefix = `deal-document:user:${ownerUserId}:dossier:`;
      const dossiers: DealDossier[] = [];
      for (const [k, v] of Array.from(memoryStore.entries())) {
        if (k.startsWith(prefix)) {
          try {
            dossiers.push(dealDossierSchema.parse(JSON.parse(v)));
          } catch {
            // Ignore malformed
          }
        }
      }
      return dossiers.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    }

    const prefix = `deal-document:user:${ownerUserId}:dossier:%`;
    const rows = await db
      .select({ content: researchResults.content })
      .from(researchResults)
      .where(and(eq(researchResults.subjectType, "deal"), eq(researchResults.model, "deal-document-engine")));

    const userPrefix = `deal-document:user:${ownerUserId}:dossier:`;
    const list: DealDossier[] = [];
    for (const r of rows) {
      try {
        const item = JSON.parse(r.content);
        if (item && item.ownerUserId === ownerUserId && item.id) {
          list.push(dealDossierSchema.parse(item));
        }
      } catch {
        // Skip
      }
    }
    return list.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  async saveDocumentPages(dossierId: string, doc: DealDocument): Promise<void> {
    const validated = dealDocumentSchema.parse(doc);
    const key = documentPagesKey(dossierId, validated.id, validated.version);
    await this.setRaw(key, JSON.stringify(validated));
  }

  async getDocumentPages(dossierId: string, documentId: string, version: number): Promise<DealDocument | null> {
    const key = documentPagesKey(dossierId, documentId, version);
    const raw = await this.getRaw(key);
    if (!raw) return null;
    return dealDocumentSchema.parse(JSON.parse(raw));
  }

  async deleteDossier(ownerUserId: number, dossierId: string): Promise<boolean> {
    const existing = await this.getDossier(ownerUserId, dossierId);
    if (!existing) return false;

    // Delete document pages
    for (const doc of existing.documents) {
      await this.deleteRaw(documentPagesKey(dossierId, doc.id, doc.version));
    }

    await this.deleteRaw(dossierKey(ownerUserId, dossierId));
    await this.deleteRaw(ownerIndexKey(dossierId));
    return true;
  }

  // Clear memory store for test isolation
  _clearMemoryStore(): void {
    memoryStore.clear();
  }
}

export const dealDocumentRepository = new DealDocumentRepository();
