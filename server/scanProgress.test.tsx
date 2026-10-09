import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ query: {} as any, refetch: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: { scan: { getV2State: { useQuery: () => ({ data: null }) }, getV2Report: { useQuery: () => ({ data: [] }) }, getThesisComparison: { useQuery: () => ({ data: null }) }, getStatus: { useQuery: () => ({ ...state.query, refetch: state.refetch }) } } } }));
import ScanProgress, { scanStatusQueryOptions } from "../client/src/components/ScanProgress";
import { load } from "cheerio";
beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
it("keeps completed scan machinery behind one receipt, without hiding a failure", () => {
  state.query = { data: { status: "completed", listingsFound: 12, listingsQualified: 3, dealsScored: 3, phaseDetail: "Three source checks unresolved" } };
  const $ = load(renderToStaticMarkup(<ScanProgress jobId={1} />));
  expect($("details").attr("open")).toBeUndefined();
  expect($("details").text()).toContain("Three source checks unresolved");
  expect($.text()).not.toContain("ConnectScanExtract");
  expect($.text()).toContain("12 listings found · 3 qualified · 3 scored");
  expect($('summary').text()).toBe("Search receipt · 12 found / 3 scored");
  expect($.text()).toContain("Scored listings are available in the validation queue");
  expect(state.refetch).not.toHaveBeenCalled();
});
it.each([0, 3])("uses source-screening counts for completed V2 with %s candidates and zero legacy scores", (listingsQualified) => {
  state.query = { data: { status: "completed", sources: ["marketplace", "__acquisition_v2_pending__"], listingsFound: 12, listingsQualified, dealsScored: 0 } };
  const $ = load(renderToStaticMarkup(<ScanProgress jobId={4} />));
  expect($('summary').text()).toBe(`Source-screening receipt · 12 source records / ${listingsQualified} screening candidates`);
  expect($('details[open]')).toHaveLength(0);
  expect($.text()).toContain("No shared catalog scores changed");
  expect($.text()).toContain("unavailable checks and unverified source claims");
  expect($.text()).not.toMatch(/0 scored|No candidates were added|validation queue/);
  expect(state.refetch).not.toHaveBeenCalled();
});
it("does not turn missing V2 counts into zero", () => {
  state.query = { data: { status: "completed", sources: ["__acquisition_v2_pending__"], dealsScored: 0 } };
  const $ = load(renderToStaticMarkup(<ScanProgress jobId={5} />));
  expect($('summary').text()).toContain("Not recorded source records / Not recorded screening candidates");
  expect($.text()).not.toContain("0 screening candidates");
});
it("does not use V2 completion copy for a failed V2 search", () => {
  state.query = { data: { status: "failed", sources: ["__acquisition_v2_pending__"], dealsScored: 0 } };
  const html = renderToStaticMarkup(<ScanProgress jobId={6} />);
  expect(html).toContain("Search could not finish");
  expect(html).not.toContain("Source screening is complete");
});
it("does not claim targets were added when no listings qualified", () => {
  state.query = { data: { status: "completed", listingsFound: 0, listingsQualified: 0, dealsScored: 0 } };
  const html = renderToStaticMarkup(<ScanProgress jobId={1} />);
  expect(html).not.toContain("Targets added");
  expect(html).toContain("No candidates were added");
});
it("exposes query failure rather than an endless connecting message", () => {
  state.query = { isError: true };
  const html = renderToStaticMarkup(<ScanProgress jobId={2} />);
  expect(html).toContain("Search status unavailable");
  expect(html).not.toContain("Connecting to scan engine");
  expect(state.refetch).not.toHaveBeenCalled();
});
it("does not expose persisted database errors in a failed search", () => {
  state.query = { data: { status: "failed", errorMessage: "Failed query: insert into deals params: private-thesis" } };
  const html = renderToStaticMarkup(<ScanProgress jobId={3} />);
  expect(html).not.toContain("private-thesis");
  expect(html).toContain("Search could not finish");
});

it("stops polling and shows one clear state when the search is not found (#106)", () => {
  const notFound = { data: { code: "NOT_FOUND", httpStatus: 404 } };
  state.query = { isLoading: true, isError: false, error: notFound };
  const html = renderToStaticMarkup(<ScanProgress jobId={3840001} />);
  expect(html).toContain("Search status unavailable");
  expect(html).not.toContain("Connecting to scan engine");
  const opts = scanStatusQueryOptions(false);
  expect(opts.refetchInterval({ state: { error: notFound } })).toBe(false);
  expect(opts.retry(0, notFound)).toBe(false);
  expect(opts.refetchInterval({ state: { error: null } })).toBe(1200);
  expect(opts.retry(0, new Error("network"))).toBe(true);
  expect(scanStatusQueryOptions(true).refetchInterval({ state: { error: null } })).toBe(false);
});
