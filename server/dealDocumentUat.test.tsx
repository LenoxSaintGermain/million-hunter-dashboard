import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, expect, it, vi } from "vitest";
import { DealDocumentStorageService } from "./dealDocumentStorage";
const state = vi.hoisted(() => ({ list: {} as any, detail: {} as any }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ dealDocument: { downloadDocument: { fetch: vi.fn() } } }),
  dealDocument: Object.fromEntries([
    ["uploadAvailability", { useQuery: () => ({data: {available:false, message:"Document uploads are unavailable until private durable storage is configured."}}) }],
    ["listDossiers", { useQuery: () => state.list }],
    ["getDossier", { useQuery: () => state.detail }],
    ...["createDossier", "uploadDocument", "confirmProposal", "revokeFact", "reviewMandate", "evaluate", "deleteDocument"].map(k => [k, {useMutation: () => ({mutate: vi.fn()})}]),
  ]),
} }));
import { DealDocumentReviewDesk } from "../client/src/components/DealDocumentReviewDesk";
it("does not offer confirmation of missing or failed extraction as a financial fact", () => {
  state.list = {data: [{id:"uat",name:"UAT",dealId:1}]};
  state.detail = {data: {dossier:{id:"uat",name:"UAT",dealId:1,currentRevision:2,documents:[],confirmedFacts:{},currency:"USD",reportingPeriod:"FY2025"}, snapshot:{fields:[],proposals:[{id:"missing",field:"sde",state:"extraction_failed",value:null,provenance:{page:1,documentVersion:1,extractionVersion:"test",span:""}}]}}};
  const $ = load(renderToStaticMarkup(<DealDocumentReviewDesk dealId={1} />));
  expect($('button:not(:disabled)').filter((_, el) => $(el).text().includes("Confirm Fact")).length).toBe(0);
  expect($.text()).toContain("Extraction needs review");
});
afterEach(() => vi.unstubAllEnvs());
it("rejects production uploads before touching temporary filesystem when durable storage is absent", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DEAL_DOCUMENT_S3_BUCKET", ""); vi.stubEnv("DEAL_DOCUMENT_STORAGE_BUCKET", "");
  const storage = new DealDocumentStorageService();
  expect(storage.uploadAvailability().available).toBe(false);
  await expect(storage.saveDocument({ownerUserId: 1, dossierId: "uat", documentId: "uat", filename: "uat.txt", buffer: Buffer.from("UAT"), mimeType: "text/plain"})).rejects.toThrow(/durable_storage_required/);
});
it("surfaces dossier read failure instead of a misleading empty intake", () => {
  state.list = {error: new Error("unavailable"), refetch: vi.fn()}; state.detail = {};
  const $ = load(renderToStaticMarkup(<DealDocumentReviewDesk />));
  expect($('[role="alert"]').text()).toContain("Dossiers could not be loaded");
});
it("does not silently select another deal's dossier and exposes a real upload button", () => {
  state.list = {data: [{id:"foreign-deal", name:"Other deal", dealId:2}]};
  state.detail = {};
  const empty = renderToStaticMarkup(<DealDocumentReviewDesk dealId={1} />);
  expect(empty).not.toContain('<option value="foreign-deal"');
  state.list = {data: [{id:"uat",name:"UAT",dealId:1}]};
  state.detail = {data: {dossier:{id:"uat", name:"UAT", dealId:1, currentRevision:1, documents:[],confirmedFacts:{},currency:"USD",reportingPeriod:"FY2025"}, snapshot:null}};
  const $ = load(renderToStaticMarkup(<DealDocumentReviewDesk dealId={1} />));
  expect($('button').text()).toContain("Choose PDF or TXT");
  expect($('button:disabled').text()).toContain("Choose PDF or TXT");
  expect($('[role="status"]').text()).toContain("private durable storage");
  expect($.text()).toContain("Up to 25 MB");
  expect($.text()).not.toContain("Attach Standard Mandate");
  expect($.text()).toContain("example mandate");
});
