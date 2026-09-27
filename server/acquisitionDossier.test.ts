import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getDealById: vi.fn(), getDealDossier: vi.fn(), getCachedResearch: vi.fn() }));
vi.mock("./db", () => ({ getDealById: mocks.getDealById }));
vi.mock("./deepResearch", () => ({ ...mocks, dealDossierKey: () => "deal:123:source-v2", getRadarSignals: vi.fn(), getIndustryResearch: vi.fn() }));
import { researchRouter } from "./routers/research";
afterEach(() => vi.resetAllMocks());
const deal = { id: 123, name: "Illustrative listing", location: "GA", industry: "HVAC", listingUrl: "https://example.com/listing", description: "Source-reported claims" };
const result = { id: 1, citations: [], content: "Saved research" };
const caller = () => researchRouter.createCaller({ user: { id: 1, role: "admin" } } as any);
it("reading a dossier never starts research, including an old forceRefresh query", async () => {
  mocks.getDealById.mockResolvedValue(deal);
  mocks.getCachedResearch.mockResolvedValue(null);
  mocks.getDealDossier.mockResolvedValue(result);
  expect(await caller().getForDeal({ dealId: 123, forceRefresh: true })).toBeNull();
  expect(mocks.getDealDossier).not.toHaveBeenCalled();
});
it("returns saved evidence without a new provider request", async () => {
  mocks.getDealById.mockResolvedValue(deal);
  mocks.getCachedResearch.mockResolvedValue(result);
  mocks.getDealDossier.mockResolvedValue(result);
  expect((await caller().getForDeal({ dealId: 123 }))?.content).toBe("Saved research");
  expect(mocks.getDealDossier).not.toHaveBeenCalled();
});
it("a deliberate refresh carries the exact source and bypasses the old cache", async () => {
  mocks.getDealById.mockResolvedValue(deal);
  mocks.getDealDossier.mockResolvedValue(result);
  await caller().refreshForDeal({ dealId: 123 });
  expect(mocks.getDealDossier).toHaveBeenCalledOnce();
  expect(mocks.getDealDossier).toHaveBeenCalledWith(123, deal.name, "GA", "HVAC", true, deal.listingUrl, deal.description);
});
it("a read-only account cannot start new dossier work", async () => {
  const readOnly = researchRouter.createCaller({ user: { id: 2, role: "investor" } } as any);
  await expect(readOnly.refreshForDeal({ dealId: 123 })).rejects.toThrow();
  expect(mocks.getDealDossier).not.toHaveBeenCalled();
});
