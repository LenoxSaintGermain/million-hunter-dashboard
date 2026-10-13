/** Read-only, no-retry first requests after a fresh production revision. */
import assert from 'node:assert/strict';
const revision = process.argv[2];
assert.match(revision ?? '', /^capital-aperture-startup-[a-f0-9]{7}-[a-z0-9]+$/);
const marker = `${revision}-${Date.now()}`;
const origins = [
  'https://third-signal-capital-aperture.web.app',
  'https://capital-aperture-325422432428.us-central1.run.app',
];
const results = await Promise.all(origins.map(async origin => {
  const startedAt = new Date().toISOString();
  const start = performance.now();
  try {
    const response = await fetch(`${origin}/readyz?cold_start_check=${marker}`, {
      redirect: 'error', signal: AbortSignal.timeout(60000), headers: { 'Cache-Control': 'no-cache' },
    });
    const body = await response.text();
    const passed = response.status === 200 && response.headers.get('content-type')?.includes('application/json') &&
      response.headers.get('cache-control')?.includes('no-store') && JSON.parse(body)?.ready === true;
    return { origin, startedAt, status: response.status, elapsedMs: Math.round(performance.now() - start), passed: Boolean(passed) };
  } catch (error) {
    return { origin, startedAt, passed: false, error: error instanceof Error ? error.message : 'Unknown failure' };
  }
}));
console.log(JSON.stringify({ expectedRevision: revision, marker, retries: 0, mutations: 0, results }, null, 2));
if (results.some(result => !result.passed)) process.exitCode = 1;
// Match marker to Cloud Run request logs and new instance/startup logs separately.
// A successful HTTP response alone does not prove a cold start or serving revision.
