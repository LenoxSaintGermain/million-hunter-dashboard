const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const context = vm.createContext({ window: { addEventListener() {} }, assert });
const fixtures = read('index.html').match(/^const deals=.*;$/m)[0];
const math = read('analytics.js').split('function bars(')[0];
vm.runInContext(fixtures + '\n' + math + '\n' +
  'const escapeDossier=s=>String(s); const thesisDraft={ceiling:5,priorities:[{name:"Recurring revenue",required:true}]};\n' +
  read('senior-read.js'), context);
vm.runInContext(`
  const cedar=deals[0], forge=deals[1], oak=deals[2];
  assert.equal((seniorDerived(cedar).margin*100).toFixed(1),'29.8');
  assert.equal((seniorDerived(forge).margin*100).toFixed(1),'12.2');
  assert.equal((seniorDerived(oak).margin*100).toFixed(1),'59.9');
  assert.equal(seniorDerived(cedar).coverage.toFixed(2),'2.06');
  assert.equal(seniorNotes.business(cedar,seniorDerived(cedar)).length,5);
  assert.equal(seniorOpen(cedar).length,3);
  seniorSession(cedar).notes.margin={state:'queued'};
  assert.equal(seniorOpen(cedar).length,3);
  seniorSession(cedar).notes.margin={state:'settled',reason:'Accept the risk'};
  assert.equal(seniorOpen(cedar).length,2);
  assert.equal(seniorOpen(forge).length,1);
  seniorSession(cedar).notes.margin={state:'open'};
  assert.equal(seniorOpen(cedar).length,3);
  shock=-40;
  assert.match(seniorNotes.business(cedar,seniorDerived(cedar)).find(n=>n.id==='coupled').text,/1.55×/);
  shock=-20;
  assert.match(seniorNotes.business(cedar,seniorDerived(cedar)).find(n=>n.id==='coupled').text,/not independent/);
  assert.match(seniorTension(cedar),/a must-have/);
  thesisDraft.priorities[0].required=false;
  assert.match(seniorTension(cedar),/a preference/);
  assetKey='property';
  assert.equal(seniorDeal(),null);
`, context);
console.log('Senior Read: fixture math, reactive copy, isolated dispositions and thesis checks passed.');
