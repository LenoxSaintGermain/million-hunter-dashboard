/** Public, read-only release smoke check. Never signs in or calls a mutation. */
const [baseArgument, sha] = process.argv.slice(2);
if (!baseArgument || !/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error('Usage: node scripts/verify-capital-release.mjs <https origin> <40-character SHA>');
const base = new URL(baseArgument);
if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash || !(
  base.hostname === 'third-signal-capital-aperture.web.app' ||
  base.hostname === 'capital-aperture-oxiyp4dcpq-uc.a.run.app' ||
  /^[a-z0-9-]+---capital-aperture-oxiyp4dcpq-uc\.a\.run\.app$/.test(base.hostname)
)) throw new Error('Use the verified Capital Aperture production or tagged origin');

const receipts = [];
async function read(path) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30_000), redirect: 'error' });
  return { response, body: await response.text() };
}
function check(label, passed) {
  receipts.push({ label, passed });
  if (!passed) throw new Error(`Release check failed: ${label}`);
}
try {
  const page = await read('/aperture');
  check('App shell is available', page.response.status === 200 && (page.response.headers.get('content-type') ?? '').includes('text/html'));
  const asset = page.body.match(/src="(\/assets\/[^"\s]+\.js)"/)?.[1];
  check('Same-origin application bundle is referenced', !!asset);
  const bundle = await read(asset);
  check('Served bundle matches the exact source SHA', bundle.response.status === 200 && bundle.body.includes(sha));
  check('Compact Today copy is included', bundle.body.includes('At a glance'));
  const health = await read('/api/trpc/system.health?input='+encodeURIComponent(JSON.stringify({ json: { timestamp: Date.now() } })));
  check('API health returns JSON, not hosting fallback HTML', health.response.status === 200 && (health.response.headers.get('content-type') ?? '').includes('application/json') && JSON.parse(health.body)?.result?.data?.json?.ok === true);
  const protectedRead = await read('/api/trpc/aperture.account.list');
  check('Unauthenticated account access remains denied', protectedRead.response.status === 401 && (protectedRead.response.headers.get('content-type') ?? '').includes('application/json'));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Release verification failed');
  process.exitCode = 1;
} finally {
  console.log(JSON.stringify({ origin: base.origin, sha, checkedAt: new Date().toISOString(), mutations: 0, receipts }, null, 2));
}
