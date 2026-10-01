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
  check('Capital reading desk is included', bundle.body.includes('What needs your judgment.') && bundle.body.includes('Boundary not measured'));
  check('Document-first framing is included', bundle.body.includes('Pressure-test the deal before committing capital.'));
  check('Illustrative venture route is included', bundle.body.includes('/jims-file'));
  check('Portfolio portrait is included', bundle.body.includes('Where capital sits.'));
  check('Public Capital UAT preview is included', bundle.body.includes('/walkthrough/capital-desk') && bundle.body.includes('illustrative composite records'));
  check('Deal Senior reading desk is included', bundle.body.includes('Follow the sources') && bundle.body.includes('Challenge the cash'));
  check('Scan story harness is included', bundle.body.includes('Find the next question.'));
  check('Thesis requirements reading desk is included', bundle.body.includes('Conviction needs a boundary.') && bundle.body.includes('What must be true?'));
  check('Editable Strategist and approval gate are included', bundle.body.includes('Make the idea hold up.') && bundle.body.includes('Approve brief & save search criteria') && bundle.body.includes('evaluation and approvals are out of date'));
  check('Deployment and scenario reading desks are included', bundle.body.includes('Give your capital a clear job.') && bundle.body.includes('Where the example holds—or breaks') && bundle.body.includes('Small allocation. Same discipline.'));
  const health = await read('/api/trpc/system.health?input='+encodeURIComponent(JSON.stringify({ json: { timestamp: Date.now() } })));
  check('API health returns JSON, not hosting fallback HTML', health.response.status === 200 && (health.response.headers.get('content-type') ?? '').includes('application/json') && JSON.parse(health.body)?.result?.data?.json?.ok === true);
  const protectedRead = await read('/api/trpc/aperture.account.list');
  check('Unauthenticated account access remains denied', protectedRead.response.status === 401 && (protectedRead.response.headers.get('content-type') ?? '').includes('application/json'));
  for (const [path, input] of [
    ['deals.list', null], ['deals.getById', { id: 2880003 }],
    ['signals.getByDealId', { dealId: 2880003 }], ['memos.list', null],
    ['memos.getByDealId', { dealId: 2880003 }], ['outreach.list', null],
    ['outreach.getByDealId', { dealId: 2880003 }], ['dashboard.stats', null],
    ['activity.list', null],
    ['scan.getLatest', null], ['scan.getStatus', { jobId: 1 }],
    ['scan.getThesisComparison', { jobId: 1 }],
  ]) {
    const result = await read('/api/trpc/' + path + (input ? '?input=' + encodeURIComponent(JSON.stringify({ json: input })) : ''));
    check('Anonymous legacy access denied: ' + path,
      result.response.status === 401 &&
      (result.response.headers.get('content-type') ?? '').includes('application/json') &&
      JSON.parse(result.body)?.error?.json?.data?.code === 'UNAUTHORIZED');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Release verification failed');
  process.exitCode = 1;
} finally {
  console.log(JSON.stringify({ origin: base.origin, sha, checkedAt: new Date().toISOString(), mutations: 0, receipts }, null, 2));
}
