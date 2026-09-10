import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseTargetFromUrl, openReleaseConnection, openReleaseExecutionConnection } from './aperture-release-connection.mjs';
import { buildReleasePlan } from './aperture-release-plan.mjs';
import { readFileSync } from 'node:fs';
const plan = buildReleasePlan(file => readFileSync(new URL('../drizzle/'+file, import.meta.url)));
const url='mysql://fixture:secret@127.0.0.1:3306/owned_fixture';
const expectedFingerprint=releaseTargetFromUrl(url).fingerprint;
test('target fingerprint excludes passwords but distinguishes host, database and principal', () => {
  assert.equal(releaseTargetFromUrl(url.replace('secret','changed')).fingerprint,expectedFingerprint);
  for (const next of [url.replace('owned_fixture','another'),url.replace('127.0.0.1','localhost'),url.replace('fixture:','other:')])
    assert.notEqual(releaseTargetFromUrl(next).fingerprint,expectedFingerprint);
});
test('rejects a configured target mismatch before connecting', async () => {
  let called=false;
  await assert.rejects(openReleaseConnection({connectionUrl:url,expectedFingerprint:'wrong',connect:async()=>{called=true;}}));
  assert.equal(called,false);
});
test('closes a connection whose actual database differs', async () => {
  let closed=false;
  await assert.rejects(openReleaseConnection({connectionUrl:url,expectedFingerprint,connect:async()=>({execute:async()=>[[{databaseName:'other'}]],end:async()=>{closed=true;}})}));
  assert.equal(closed,true);
});
test('inspection executes metadata reads only and exposes no DDL method', async () => {
  const sql=[];
  const adapter=await openReleaseConnection({connectionUrl:url,expectedFingerprint,connect:async()=>({execute:async q=>{sql.push(q);return [q.startsWith('SELECT DATABASE')?[{databaseName:'owned_fixture'}]:[]];},end:async()=>{}})});
  await adapter.readSchema(); await adapter.close();
  assert(sql.every(q=>q.startsWith('SELECT ')));
  assert.equal(adapter.execute,undefined);
});
test('recovery capture uses only the two altered tables and always ends its read transaction', async () => {
  const sql=[]; let rolledBack=0;
  const adapter=await openReleaseConnection({connectionUrl:url,expectedFingerprint,connect:async()=>({
    execute:async q=>{sql.push(q);return [q.startsWith('SELECT DATABASE')?[{databaseName:'owned_fixture'}]:q.startsWith('SHOW CREATE')?[{'Create Table':'illustrative definition'}]:[{id:1,context_snapshot:'{"original":true}'}]];},
    beginTransaction:async()=>{},rollback:async()=>{rolledBack++;},end:async()=>{},
  })});
  const recovery=await adapter.captureReceiptRecovery();
  assert.equal(recovery.restoreVerified,false);
  assert.deepEqual(recovery.tables.map(t=>t.table),['aperture_decision_runs','aperture_decision_revisions']);
  assert.equal(recovery.tables[0].rows[0].context_snapshot,'{"original":true}');
  assert.equal(rolledBack,1);
  assert(sql.every(q=>q.startsWith('SELECT ')||q.startsWith('SHOW CREATE')));
});
test('execution adapter rejects modified plans before connection and arbitrary SQL after connection', async () => {
  let connected = 0; const writes = [];
  const connect = async () => { connected++; return {
    execute: async () => [[{databaseName:'owned_fixture'}]],
    query: async sql => { writes.push(sql); }, end: async () => {},
  }; };
  await assert.rejects(openReleaseExecutionConnection({plan:{...plan,steps:[]},connectionUrl:url,expectedFingerprint,connect}));
  assert.equal(connected,0);
  const adapter = await openReleaseExecutionConnection({plan,connectionUrl:url,expectedFingerprint,connect});
  await assert.rejects(adapter.execute('DROP TABLE anything',plan.steps[0].id));
  await assert.rejects(adapter.execute(plan.steps[0].sql,'unknown'));
  assert.equal(writes.length,0);
  await adapter.execute(plan.steps[0].sql,plan.steps[0].id);
  assert.deepEqual(writes,[plan.steps[0].sql]);
  await adapter.close();
});
