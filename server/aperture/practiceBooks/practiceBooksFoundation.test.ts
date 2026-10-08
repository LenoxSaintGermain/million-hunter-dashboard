import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDb, type MemoryDb } from "./memoryDb.testing";

const h = vi.hoisted(() => ({ mem: null as MemoryDb | null, getAccount: vi.fn(), getPositions: vi.fn() }));
vi.mock("../../db", () => ({ getDb: async () => h.mem!.db }));
vi.mock("../brokers/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../brokers/index")>();
  const alpaca = { ...actual.alpacaPaperBroker, available: () => true, getAccount: h.getAccount, getPositions: h.getPositions };
  return { ...actual, alpacaPaperBroker: alpaca, brokerFor: vi.fn(() => alpaca) };
});

import { portfolioAccounts, uatBookAdjustments, uatHouseBaselines, uatPracticeBooks } from "../../../drizzle/schema";
import { appRouter } from "../../routers";
import { brokerFor } from "../brokers/index";
import { OWNER_ONLY_BROKER_MESSAGE } from "../brokers/envBrokerOwner";
import { logPracticeBooksMode, practiceBooksConfigured, practiceBooksEnabled, practiceBooksMode, usesPracticeBooks } from "./flags";
import * as repository from "./repository";

const OWNER = { id: 1, openId: "owner-open-id", role: "admin" } as const;
const TESTER = { id: 2, openId: "tester-open-id", role: "capital_operator" } as const;
const caller = (user: typeof OWNER | typeof TESTER) => appRouter.createCaller({ user, req: { headers: {} }, res: {} } as any);
const NOW = Date.UTC(2026, 9, 8, 15);

beforeEach(() => {
  h.mem = createMemoryDb();
  h.getAccount.mockReset();
  h.getPositions.mockReset();
  vi.mocked(brokerFor).mockClear();
  vi.stubEnv("OWNER_OPEN_ID", OWNER.openId);
  delete process.env.UAT_PRACTICE_BOOKS;
  delete process.env.ALPACA_SHARED_KEY_OWNER_ONLY;
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); delete process.env.UAT_PRACTICE_BOOKS; delete process.env.ALPACA_SHARED_KEY_OWNER_ONLY; });

describe("UAT_PRACTICE_BOOKS flag", () => {
  it("is on by default, off only when explicitly disabled, and inert under owner-only", () => {
    expect([practiceBooksConfigured(), practiceBooksEnabled(), practiceBooksMode()]).toEqual([true, true, "on"]);
    for (const off of ["false", "0", "off", "FALSE"]) {
      vi.stubEnv("UAT_PRACTICE_BOOKS", off);
      expect([practiceBooksConfigured(), practiceBooksEnabled(), practiceBooksMode()]).toEqual([false, false, "off"]);
    }
    vi.stubEnv("UAT_PRACTICE_BOOKS", "true");
    expect(practiceBooksEnabled()).toBe(true);
    vi.stubEnv("ALPACA_SHARED_KEY_OWNER_ONLY", "true");
    expect([practiceBooksConfigured(), practiceBooksEnabled(), practiceBooksMode()]).toEqual([true, false, "inert"]);
  });

  it("treats every non-owner as a tester and keeps the owner in broker mode", () => {
    expect(usesPracticeBooks(TESTER.openId)).toBe(true);
    expect(usesPracticeBooks(OWNER.openId)).toBe(false);
    vi.stubEnv("OWNER_OPEN_ID", "");
    expect(usesPracticeBooks(OWNER.openId)).toBe(true);
    vi.stubEnv("ALPACA_SHARED_KEY_OWNER_ONLY", "true");
    expect(usesPracticeBooks(TESTER.openId)).toBe(false);
  });

  it("logs one startup line per mode, warns when inert, and errors without OWNER_OPEN_ID", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    logPracticeBooksMode();
    expect(info.mock.calls.at(-1)?.[0]).toMatch(/^\[uat\] practice books on/);
    vi.stubEnv("UAT_PRACTICE_BOOKS", "false");
    logPracticeBooksMode();
    expect(info.mock.calls.at(-1)?.[0]).toMatch(/^\[uat\] practice books off/);
    vi.stubEnv("UAT_PRACTICE_BOOKS", "true");
    vi.stubEnv("ALPACA_SHARED_KEY_OWNER_ONLY", "true");
    logPracticeBooksMode();
    expect(warn).toHaveBeenCalledWith("[uat] practice books are on but the shared Alpaca key is owner-only; books are inert");
    expect(error).not.toHaveBeenCalled();
    vi.stubEnv("ALPACA_SHARED_KEY_OWNER_ONLY", "");
    vi.stubEnv("OWNER_OPEN_ID", "");
    logPracticeBooksMode();
    expect(error.mock.calls.at(-1)?.[0]).toMatch(/^\[uat\] OWNER_OPEN_ID is not set/);
  });

  it("with both flags on, a non-owner is refused on the env rail by the existing #64 gate", async () => {
    vi.stubEnv("ALPACA_SHARED_KEY_OWNER_ONLY", "true");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const [row] = h.mem!.seed(portfolioAccounts, { userId: TESTER.id, label: "Alpaca", brokerId: "alpaca_paper", isPaper: true, practiceBookId: 7, createdAt: NOW, updatedAt: NOW });
    await expect(caller(TESTER).aperture.account.sync({ id: row.id })).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: OWNER_ONLY_BROKER_MESSAGE });
    expect(brokerFor).not.toHaveBeenCalled();
    expect(h.getAccount).not.toHaveBeenCalled();
  });
});

describe("ownerProcedure", () => {
  it("refuses a capital operator who is not OWNER_OPEN_ID, and admits the owner", async () => {
    await expect(caller(TESTER).aperture.uat.status()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(OWNER).aperture.uat.status()).resolves.toMatchObject({ mode: "on", ownerConfigured: true, houseBaselines: [] });
  });

  it("refuses everyone, the owner included, when OWNER_OPEN_ID is unset", async () => {
    vi.stubEnv("OWNER_OPEN_ID", "");
    await expect(caller(OWNER).aperture.uat.status()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(TESTER).aperture.uat.captureHouseBaseline()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(h.getAccount).not.toHaveBeenCalled();
  });
});

describe("book tables", () => {
  it("creates a book, its starting-cash adjustment and the account pointer together", async () => {
    const [row] = h.mem!.seed(portfolioAccounts, { userId: TESTER.id, label: "Alpaca", brokerId: "alpaca_paper", isPaper: true, createdAt: NOW, updatedAt: NOW });
    const { bookId } = await repository.createPracticeBook(h.mem!.db, { userId: TESTER.id, portfolioAccountId: row.id, createdBy: TESTER.id, now: NOW });
    expect(h.mem!.rows(uatPracticeBooks)).toEqual([expect.objectContaining({
      id: bookId, userId: TESTER.id, portfolioAccountId: row.id, startingCashCents: 10_000_000, status: "active", generation: 1, scenarioPreset: "fresh_100k",
    })]);
    expect(h.mem!.rows(uatBookAdjustments)).toEqual([expect.objectContaining({ bookId, kind: "starting_cash", cashCents: 10_000_000, brokerBacked: false })]);
    expect(h.mem!.rows(portfolioAccounts)[0].practiceBookId).toBe(bookId);
    expect(await repository.activeBookForAccount(h.mem!.db, { practiceBookId: bookId, userId: TESTER.id })).toMatchObject({ id: bookId });
    // Scoped: another user's id never resolves this book.
    expect(await repository.activeBookForAccount(h.mem!.db, { practiceBookId: bookId, userId: OWNER.id })).toBeNull();
  });

  it("keeps adjustments append-only: the repository exposes no update or delete, and no server code writes one", () => {
    expect(Object.keys(repository).filter((name) => /update|delete|remove|edit/i.test(name) && /adjust/i.test(name))).toEqual([]);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const file = path.join(dir, name);
        if (statSync(file).isDirectory()) { if (name !== "node_modules") walk(file); continue; }
        if (!/\.ts$/.test(name) || /\.test\.ts$/.test(name)) continue;
        if (/\.(update|delete)\(\s*uatBookAdjustments\b/.test(readFileSync(file, "utf8"))) offenders.push(file);
      }
    };
    walk(path.resolve(import.meta.dirname, "../.."));
    expect(offenders).toEqual([]);
    return expect(repository.appendBookAdjustment(h.mem!.db, { bookId: 1, kind: "cash_adjustment", cashCents: 1, note: "  ", createdBy: 1, createdAt: NOW }))
      .rejects.toThrow("needs a note");
  });

  it("records the house starting snapshot once per house account and never overwrites it", async () => {
    const snapshot = { externalAccountId: "PA-HOUSE-0001", cashCents: 10_000_000, buyingPowerCents: 20_000_000, equityValueCents: 10_000_000,
      positions: [{ symbol: "SPY", qty: 1, avgCostCents: 50_000, lastPriceCents: 51_000 }] };
    const first = await repository.ensureHouseBaseline(h.mem!.db, snapshot, null, NOW);
    const second = await repository.ensureHouseBaseline(h.mem!.db, { ...snapshot, cashCents: 1 }, OWNER.id, NOW + 1);
    expect([first.created, second.created]).toEqual([true, false]);
    expect(h.mem!.rows(uatHouseBaselines)).toEqual([expect.objectContaining({ houseExternalAccountId: "PA-HOUSE-0001", cashCents: 10_000_000, capturedBy: null, capturedAt: NOW })]);
  });

  it("captureHouseBaseline: the owner records the house once (reads only) and sees the account number masked", async () => {
    h.getAccount.mockResolvedValue({ externalAccountId: "PA-HOUSE-0001", cashCents: 10_000_000, buyingPowerCents: 20_000_000, equityValueCents: 10_000_000,
      optionsApprovedLevel: null, optionsTradingLevel: null, optionsBuyingPowerCents: null, isPaper: true, asOf: NOW });
    h.getPositions.mockResolvedValue([]);
    await expect(caller(OWNER).aperture.uat.captureHouseBaseline()).resolves.toMatchObject({ created: true, houseExternalAccountId: "••••0001" });
    await expect(caller(OWNER).aperture.uat.captureHouseBaseline()).resolves.toMatchObject({ created: false });
    const status = await caller(OWNER).aperture.uat.status();
    expect(JSON.stringify(status)).not.toContain("PA-HOUSE-0001");
    expect(h.mem!.log.filter((entry) => entry.kind !== "select").map((entry) => entry.table)).toEqual(["uat_house_baselines"]);
  });
});

describe("migration 0070", () => {
  const root = path.resolve(import.meta.dirname, "../../..");
  const up = readFileSync(path.join(root, "drizzle/0070_uat_practice_books.sql"), "utf8");
  const down = readFileSync(path.join(root, "drizzle/rollback/0070_uat_practice_books.down.sql"), "utf8");
  const statements = (text: string) => text.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n").split(";").map((s) => s.trim()).filter(Boolean);

  it("is additive: only CREATE TABLE and ALTER TABLE … ADD, in the shape the reviewed release tool accepts", () => {
    const upStatements = statements(up);
    expect(upStatements).toHaveLength(5);
    for (const statement of upStatements) {
      expect(statement).toMatch(/^(CREATE TABLE|ALTER TABLE)\s/);
      expect(statement).not.toMatch(/\b(DROP|MODIFY|RENAME|CHANGE|UPDATE|DELETE|TRUNCATE)\b/i);
      if (statement.startsWith("ALTER")) expect(statement).toMatch(/ADD COLUMN practice_book_id INT NULL/);
    }
  });

  it("is reversible: the rollback drops exactly what the migration adds, columns first", () => {
    const created = [...up.matchAll(/CREATE TABLE (\w+)/g)].map((m) => m[1]).sort();
    const dropped = [...down.matchAll(/DROP TABLE (\w+)/g)].map((m) => m[1]).sort();
    expect(dropped).toEqual(created);
    expect(down).toMatch(/ALTER TABLE broker_orders DROP INDEX broker_orders_book_idx, DROP COLUMN practice_book_id/);
    expect(down).toMatch(/ALTER TABLE portfolio_accounts DROP COLUMN practice_book_id/);
    expect(down.indexOf("ALTER TABLE")).toBeLessThan(down.indexOf("DROP TABLE"));
  });
});
