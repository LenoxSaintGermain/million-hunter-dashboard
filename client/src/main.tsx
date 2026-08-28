import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import { useEffect, type ReactNode } from "react";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import { isJsonTrpcResponse, trpcNonJsonMessage } from "@shared/trpcResponseGuard";
import { isExpectedIsolatedReceiptDenial } from "@shared/expectedUatDenial";
import { installIsolatedUatNavigationBridge, readIsolatedUatCase, readIsolatedUatIdentity } from "@shared/isolatedUatIdentity";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
    if (event.type === "updated" && event.action.type === "error") {
      const error = event.query.state.error;
      redirectToLoginIfUnauthorized(error);
      if (isExpectedIsolatedReceiptDenial(error)) return;
      console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
    if (event.type === "updated" && event.action.type === "error") {
      const error = event.mutation.state.error;
      redirectToLoginIfUnauthorized(error);
      if (isExpectedIsolatedReceiptDenial(error)) return;
      console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async fetch(input, init) {
        const headers = new Headers(init?.headers);
        const isolatedFixture = readIsolatedUatIdentity();
        if (isolatedFixture) headers.set("x-isolated-uat-identity", isolatedFixture);
        const isolatedCase = readIsolatedUatCase();
        if (isolatedCase === "qualified-play") headers.set("x-isolated-uat-case", "qualified-play");
        const response = await globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
          headers,
        });
        if (!isJsonTrpcResponse(response.headers.get("content-type"))) {
          throw new Error(trpcNonJsonMessage(response.headers.get("content-type")));
        }
        return response;
      },
    }),
  ],
});

function IsolatedUatNavigationBridge({ children }: { children: ReactNode }) {
  useEffect(() => installIsolatedUatNavigationBridge(), []);
  return <>{children}</>;
}

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <IsolatedUatNavigationBridge><App /></IsolatedUatNavigationBridge>
    </QueryClientProvider>
  </trpc.Provider>
);
