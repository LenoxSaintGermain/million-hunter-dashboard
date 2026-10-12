/** Local harness entry only; never imported by the product or public demo. */
import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "../client/src/lib/trpc";
import DealEvidenceDesk from "../client/src/components/DealEvidenceDesk";
import "../client/src/index.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const client = trpc.createClient({ links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })] });
createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={client} queryClient={queryClient}><QueryClientProvider client={queryClient}>
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
      <p className="border-y border-rule py-3 font-mono text-xs">LOCAL UAT · illustrative deal and identity · isolated storage · controlled analysis responses · no orders</p>
      <h1 className="my-6 font-serif text-3xl">The evidence behind the argument.</h1>
      <DealEvidenceDesk dealId={987654321} />
    </main>
  </QueryClientProvider></trpc.Provider>,
);
