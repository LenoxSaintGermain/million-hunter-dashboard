// The Weekly Income fixture renders presentation components only. Any attempt
// to reach the API from a fixture is a bug, so the client fails loudly.
export const trpc = new Proxy({}, { get() { throw new Error("Weekly Income fixture: no API access."); } });
