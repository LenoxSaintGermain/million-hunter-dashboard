import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const config = vi.hoisted(() => ({
  secUserAgent: "Test Fixture fixture@example.test",
}));
vi.mock("./_core/env", () => ({ ENV: config }));
let adapter: typeof import("./secSubmissions");
let network: ReturnType<typeof vi.fn>;
const cik = "0000320193";
const first = {
  accessionNumber: "0000320193-26-000001",
  form: "10-K",
  filingDate: "2026-10-09",
  reportDate: "2026-09-26",
  primaryDocument: "report.htm",
};
function payload(rows = [first]): Record<string, any> {
  const recent: Record<string, unknown[]> = {};
  for (const key of Object.keys(first))
    recent[key] = rows.map(r => r[key as keyof typeof first]);
  return {
    cik: 320193,
    name: "Illustrative Test Company",
    filings: { recent, files: [{ name: "not-fetched.json" }] },
  };
}
const response = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-11T12:00:00Z"));
  config.secUserAgent = "Test Fixture fixture@example.test";
  network = vi.fn().mockRejectedValue(new Error("Unexpected mock fetch"));
  vi.stubGlobal("fetch", network);
  adapter = await import("./secSubmissions");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("SEC submissions identity and evidence", () => {
  it("normalizes a CIK and preserves exact source evidence and archive URL", async () => {
    network.mockResolvedValueOnce(response(payload()));
    const result = await adapter.fetchSecSubmissions("320193");
    expect(result).toEqual({
      status: "ok",
      sourceUrl: "https://data.sec.gov/submissions/CIK0000320193.json",
      retrievedAt: "2026-10-11T12:00:00.000Z",
      company: { cik, name: "Illustrative Test Company" },
      filings: [
        {
          ...first,
          url: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000001/report.htm",
        },
      ],
      message: expect.stringContaining("Recent SEC submissions only"),
      failureCode: null,
    });
    expect(network).toHaveBeenCalledTimes(1);
    expect(network.mock.calls[0][1]).toMatchObject({
      redirect: "error",
      headers: {
        "User-Agent": config.secUserAgent,
        Accept: "application/json",
      },
    });
  });
  it.each([
    "",
    "0",
    "0000000000",
    "-1",
    "1.2",
    " 320193",
    "320193 ",
    "12345678901",
    "CIK0000320193",
    "../320193",
    "３２０１９３",
  ])("rejects invalid input %j before network", async input => {
    expect(await adapter.fetchSecSubmissions(input)).toMatchObject({
      status: "unavailable",
      failureCode: "INVALID_CIK",
      company: null,
      retrievedAt: null,
      filings: [],
    });
    expect(network).not.toHaveBeenCalled();
  });
  it.each([
    "",
    " ",
    "Missing contact",
    "email@example.test",
    "Org contact@example.test\nInjected: yes",
  ])("requires declared real-contact configuration %#", async identity => {
    config.secUserAgent = identity;
    expect(await adapter.fetchSecSubmissions(cik)).toMatchObject({
      status: "unavailable",
      failureCode: "IDENTITY_NOT_CONFIGURED",
    });
    expect(network).not.toHaveBeenCalled();
  });
  it("accepts padded response CIK and empty report date", async () => {
    const data = payload([{ ...first, reportDate: "" }]);
    data.cik = cik;
    network.mockResolvedValueOnce(response(data));
    expect(
      (await adapter.fetchSecSubmissions(cik)).filings[0].reportDate
    ).toBeNull();
  });
  it("rejects response CIK mismatch without returning unrelated company data", async () => {
    const data = payload();
    data.cik = 123;
    network.mockResolvedValueOnce(response(data));
    expect(await adapter.fetchSecSubmissions(cik)).toMatchObject({
      failureCode: "CIK_MISMATCH",
      company: null,
      filings: [],
      retrievedAt: null,
    });
  });
  it("returns empty only for a validated company with empty parallel arrays", async () => {
    network.mockResolvedValueOnce(response(payload([])));
    expect(await adapter.fetchSecSubmissions(cik)).toMatchObject({
      status: "empty",
      company: { cik },
      filings: [],
      failureCode: null,
    });
  });
  it("deduplicates identical accessions stably, preserving separate amendments", async () => {
    const amendment = {
      ...first,
      accessionNumber: "0000320193-26-000002",
      form: "10-K/A",
    };
    network.mockResolvedValueOnce(response(payload([first, first, amendment])));
    const result = await adapter.fetchSecSubmissions(cik);
    expect(result.filings.map(r => [r.accessionNumber, r.form])).toEqual([
      [first.accessionNumber, "10-K"],
      [amendment.accessionNumber, "10-K/A"],
    ]);
    expect(result.filings[1]).not.toHaveProperty("amends");
  });
  it("does not mistake an accession's filing-agent prefix for company CIK", async () => {
    network.mockResolvedValueOnce(
      response(payload([{ ...first, accessionNumber: "0001193125-26-000001" }]))
    );
    expect((await adapter.fetchSecSubmissions(cik)).status).toBe("ok");
  });
  it.each(["form", "filingDate", "primaryDocument"] as const)(
    "rejects duplicate accession conflicting in %s",
    async key => {
      const changed = {
        ...first,
        [key]:
          key === "form"
            ? "10-K/A"
            : key === "filingDate"
              ? "2026-10-10"
              : "other.htm",
      };
      network.mockResolvedValueOnce(response(payload([first, changed])));
      expect(await adapter.fetchSecSubmissions(cik)).toMatchObject({
        failureCode: "CONFLICTING_ACCESSION",
        filings: [],
      });
    }
  );
  it("detects conflicts even in unreturned source columns", async () => {
    const data = payload([first, first]);
    data.filings.recent.size = [1, 2];
    network.mockResolvedValueOnce(response(data));
    expect((await adapter.fetchSecSubmissions(cik)).failureCode).toBe(
      "CONFLICTING_ACCESSION"
    );
  });
});

describe("SEC runtime validation", () => {
  it.each([
    { accessionNumber: "320193-26-1" },
    { form: "" },
    { filingDate: "2026-02-30" },
    { filingDate: "2025-02-29" },
    { filingDate: "0000-01-01" },
    { reportDate: "2026-13-01" },
    { reportDate: 123 },
    { primaryDocument: "" },
    { primaryDocument: "../report.htm" },
    { primaryDocument: "/report.htm" },
    { primaryDocument: "a/../../report.htm" },
    { primaryDocument: "%2e%2e/report.htm" },
    { primaryDocument: "a%2freport.htm" },
    { primaryDocument: "https://evil.test/report.htm" },
    { primaryDocument: "report.htm?x=y" },
    { primaryDocument: "report.htm#section" },
    { primaryDocument: "a\\report.htm" },
  ])("rejects malformed row fields %#", async change => {
    network.mockResolvedValueOnce(
      response(payload([{ ...first, ...change } as typeof first]))
    );
    expect(await adapter.fetchSecSubmissions(cik)).toMatchObject({
      status: "unavailable",
      failureCode: "INVALID_RESPONSE",
      filings: [],
    });
  });
  it("allows real leap dates and safe SEC document subdirectories", async () => {
    network.mockResolvedValueOnce(
      response(
        payload([
          {
            ...first,
            filingDate: "2024-02-29",
            primaryDocument: "xslF345X05/ownership.xml",
          },
        ])
      )
    );
    expect((await adapter.fetchSecSubmissions(cik)).filings[0].url).toContain(
      "/xslF345X05/ownership.xml"
    );
  });
  it.each([0, 1, null])(
    "accepts the observed SEC isXBRLNumeric parallel flag %s",
    async flag => {
      const data = payload();
      Object.assign(data.filings.recent, {
        isXBRLNumeric: [flag],
        isInlineXBRL: [0],
        isXBRL: [1],
        size: [4822],
        core_type: ["10-K"],
        acceptanceDateTime: ["2026-10-09T02:30:32.000Z"],
      });
      network.mockResolvedValueOnce(response(data));
      expect((await adapter.fetchSecSubmissions(cik)).status).toBe("ok");
    }
  );
  it("rejects nonbinary isXBRLNumeric flags", async () => {
    const data = payload();
    data.filings.recent.isXBRLNumeric = [2];
    network.mockResolvedValueOnce(response(data));
    expect((await adapter.fetchSecSubmissions(cik)).failureCode).toBe(
      "INVALID_RESPONSE"
    );
  });
  it.each(["cik", "name", "filings"])("rejects missing %s", async field => {
    const data = payload();
    delete data[field];
    network.mockResolvedValueOnce(response(data));
    expect((await adapter.fetchSecSubmissions(cik)).failureCode).toBe(
      "INVALID_RESPONSE"
    );
  });
  it.each([
    "accessionNumber",
    "form",
    "filingDate",
    "reportDate",
    "primaryDocument",
  ])("rejects missing parallel array %s", async field => {
    const data = payload();
    delete data.filings.recent[field];
    network.mockResolvedValueOnce(response(data));
    expect((await adapter.fetchSecSubmissions(cik)).failureCode).toBe(
      "INVALID_RESPONSE"
    );
  });
  it.each([
    { form: [] },
    { form: "10-K" },
    { size: ["100"] },
    { size: [] },
    { isXBRL: [2] },
    { primaryDocDescription: [null] },
    { invented: ["x"] },
    { acceptanceDateTime: ["2026-02-30T15:00:00Z"] },
    { acceptanceDateTime: ["invalid"] },
  ])("checks ALL array lengths and types %#", async columns => {
    const data = payload();
    Object.assign(data.filings.recent, columns);
    network.mockResolvedValueOnce(response(data));
    expect((await adapter.fetchSecSubmissions(cik)).failureCode).toBe(
      "INVALID_RESPONSE"
    );
  });
  it("rejects oversized row count rather than silently truncating", async () => {
    network.mockResolvedValueOnce(response(payload(Array(10001).fill(first))));
    expect(await adapter.fetchSecSubmissions(cik)).toMatchObject({
      failureCode: "INVALID_RESPONSE",
      filings: [],
    });
  });
});

describe("SEC transport and fair access", () => {
  it("omits a global retry deadline for local process spacing", async () => {
    network.mockResolvedValueOnce(response(payload()));
    const success = await adapter.fetchSecSubmissions(cik);
    expect(success).not.toHaveProperty("retryAt");
    const throttled = await adapter.fetchSecSubmissions(cik);
    expect(throttled).toMatchObject({
      failureCode: "RATE_LIMITED",
    });
    expect(throttled).not.toHaveProperty("retryAt");
    expect(network).toHaveBeenCalledTimes(1);
  });
  it("omits retryAt on other failures", async () => {
    network.mockRejectedValueOnce(new Error("offline"));
    const result = await adapter.fetchSecSubmissions(cik);
    expect(result.failureCode).toBe("NETWORK_ERROR");
    expect(result).not.toHaveProperty("retryAt");
  });
  it.each([403, 404, 500, 302])(
    "discloses HTTP %s without fake empty data",
    async status => {
      network.mockResolvedValueOnce(new Response("unavailable", { status }));
      expect(await adapter.fetchSecSubmissions(cik)).toMatchObject({
        status: "unavailable",
        failureCode: "HTTP_ERROR",
        message: "SEC returned HTTP " + status + ".",
        filings: [],
      });
    }
  );
  it("hides raw network exceptions and configured identity", async () => {
    network.mockRejectedValueOnce(new Error(config.secUserAgent));
    const result = await adapter.fetchSecSubmissions(cik);
    expect(result.failureCode).toBe("NETWORK_ERROR");
    expect(JSON.stringify(result)).not.toContain(config.secUserAgent);
  });
  it("rejects HTML despite HTTP 200", async () => {
    network.mockResolvedValueOnce(
      new Response("<html>Blocked</html>", {
        headers: { "Content-Type": "text/html" },
      })
    );
    expect((await adapter.fetchSecSubmissions(cik)).failureCode).toBe(
      "INVALID_RESPONSE"
    );
  });
  it("rejects malformed JSON", async () => {
    network.mockResolvedValueOnce(
      new Response("{", { headers: { "Content-Type": "application/json" } })
    );
    expect((await adapter.fetchSecSubmissions(cik)).failureCode).toBe(
      "INVALID_JSON"
    );
  });
  it.each([true, false])(
    "bounds actual bytes with/without declared size %s",
    async declared => {
      network.mockResolvedValueOnce(
        new Response("x".repeat(5 * 1024 * 1024 + 1), {
          headers: {
            "Content-Type": "application/json",
            ...(declared
              ? { "Content-Length": String(5 * 1024 * 1024 + 1) }
              : {}),
          },
        })
      );
      expect((await adapter.fetchSecSubmissions(cik)).failureCode).toBe(
        "BODY_TOO_LARGE"
      );
    }
  );
  it("deadline bounds headers even when fetch ignores abort", async () => {
    network.mockImplementationOnce(() => new Promise(() => {}));
    const pending = adapter.fetchSecSubmissions(cik);
    await vi.advanceTimersByTimeAsync(8001);
    expect((await pending).failureCode).toBe("TIMEOUT");
    expect(network.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it("deadline covers stalled body and cancels stream", async () => {
    const cancel = vi.fn();
    network.mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode("{"));
          },
          cancel,
        }),
        { headers: { "Content-Type": "application/json" } }
      )
    );
    const pending = adapter.fetchSecSubmissions(cik);
    await vi.advanceTimersByTimeAsync(8001);
    expect((await pending).failureCode).toBe("TIMEOUT");
    expect(cancel).toHaveBeenCalled();
  });
  it("does not cache or coalesce manual requests", async () => {
    network.mockImplementation(async () => response(payload()));
    expect((await adapter.fetchSecSubmissions(cik)).status).toBe("ok");
    expect((await adapter.fetchSecSubmissions(cik)).failureCode).toBe(
      "RATE_LIMITED"
    );
    await vi.advanceTimersByTimeAsync(250);
    expect((await adapter.fetchSecSubmissions(cik)).status).toBe("ok");
    expect(network).toHaveBeenCalledTimes(2);
  });
  it.each(["120", "Sun, 11 Oct 2026 12:02:00 GMT"])(
    "honors SEC Retry-After %s across CIKs",
    async retryAfter => {
      network.mockResolvedValueOnce(
        new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": retryAfter },
        })
      );
      expect(await adapter.fetchSecSubmissions(cik)).toMatchObject({
        failureCode: "RATE_LIMITED",
        retryAt: "2026-10-11T12:02:00.000Z",
      });
      await vi.advanceTimersByTimeAsync(60_000);
      expect(await adapter.fetchSecSubmissions("123")).toMatchObject({
        failureCode: "RATE_LIMITED",
        retryAt: "2026-10-11T12:02:00.000Z",
      });
      expect(network).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(60_001);
      network.mockResolvedValueOnce(response(payload()));
      expect((await adapter.fetchSecSubmissions(cik)).status).toBe("ok");
    }
  );
  it("uses a minimum one-minute cooldown for absent/invalid Retry-After", async () => {
    network.mockResolvedValueOnce(
      new Response("", { status: 429, headers: { "Retry-After": "invalid" } })
    );
    expect(await adapter.fetchSecSubmissions(cik)).toMatchObject({
      failureCode: "RATE_LIMITED",
      retryAt: "2026-10-11T12:01:00.000Z",
    });
    await vi.advanceTimersByTimeAsync(59_999);
    expect((await adapter.fetchSecSubmissions(cik)).failureCode).toBe(
      "RATE_LIMITED"
    );
    expect(network).toHaveBeenCalledTimes(1);
  });
  it("bounds concurrent in-flight requests even when spaced out", async () => {
    network.mockImplementation(() => new Promise(() => {}));
    const a = adapter.fetchSecSubmissions(cik);
    await vi.advanceTimersByTimeAsync(250);
    const b = adapter.fetchSecSubmissions("123");
    await vi.advanceTimersByTimeAsync(250);
    const throttled = await adapter.fetchSecSubmissions("456");
    expect(throttled.failureCode).toBe("RATE_LIMITED");
    expect(throttled).not.toHaveProperty("retryAt");
    expect(network).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(8001);
    expect((await a).failureCode).toBe("TIMEOUT");
    expect((await b).failureCode).toBe("TIMEOUT");
  });
});
