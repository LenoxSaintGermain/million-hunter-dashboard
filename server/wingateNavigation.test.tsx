import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ role: "admin", profile: undefined as { quizCompleted: boolean; assetClass: string } | undefined }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { role: state.role }, isAuthenticated: true, logout: vi.fn() }) }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  investor: { getDnaStatus: { useQuery: () => ({ data: state.profile }) } },
  publicDeals: { search: { useQuery: () => ({ data: undefined, isLoading: false }) } },
} }));
vi.mock("wouter", () => ({ useLocation: () => ["/", vi.fn()], Link: ({ href, children }: any) => <a href={href}>{children}</a> }));
import EditorialTopNav from "../client/src/components/EditorialTopNav";
afterEach(() => { vi.unstubAllGlobals(); state.role = "admin"; state.profile = undefined; });
it("keeps Wingate out of primary navigation until the relevant saved investor profile is present", () => {
  vi.stubGlobal("React", React);
  const primaryWingate = () => load(renderToStaticMarkup(<EditorialTopNav>Fixture</EditorialTopNav>))("nav a[href='/wingate']").length;
  expect(primaryWingate()).toBe(0);
  state.role = "investor";
  expect(primaryWingate()).toBe(0);
  state.profile = { quizCompleted: true, assetClass: "private_mna" };
  expect(primaryWingate()).toBe(0);
  state.profile.assetClass = "historic";
  expect(primaryWingate()).toBe(1);
});
