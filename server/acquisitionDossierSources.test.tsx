import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("react", async (original) => ({ ...(await original<any>()), useState: () => [true, vi.fn()] }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("streamdown", () => ({ Streamdown: ({ children }: any) => <div>{children}</div> }));
vi.mock("framer-motion", () => ({ AnimatePresence: ({ children }: any) => children, motion: { div: ({ children }: any) => <div>{children}</div> } }));
vi.mock("@/lib/trpc", () => ({ trpc: { research: {
  getForDeal: { useQuery: () => ({ data: { createdAt: 0, content: "Claim [15]", citations: Array.from({ length: 15 }, (_, i) => `https://example.com/source-${i + 1}`) }, refetch: vi.fn() }) },
  refreshForDeal: { useMutation: () => ({ mutate, isPending: false }) },
} } }));
import { DealDossierModule } from "../client/src/components/AgentMonitoringPanel";
afterEach(() => vi.unstubAllGlobals());
it("makes every numbered research citation inspectable without running research", () => {
  vi.stubGlobal("React", React);
  const html = renderToStaticMarkup(<DealDossierModule dealId={1} />);
  for (let i = 1; i <= 15; i++) expect(html).toContain(`href="https://example.com/source-${i}"`);
  expect(html).toContain("[15]");
  expect(mutate).not.toHaveBeenCalled();
});
