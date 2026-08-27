/** A tRPC response must be JSON; HTML means the request reached an SPA/Vite fallback rather than the API middleware. */
export function isJsonTrpcResponse(contentType: string | null | undefined) {
  return Boolean(contentType?.toLowerCase().includes("application/json"));
}

export function trpcNonJsonMessage(contentType: string | null | undefined) {
  return `Capital API is unavailable: expected JSON from /api/trpc but received ${contentType || "an unknown response type"}. Open the current isolated API preview and retry; no contextual Mission Library data was used.`;
}
