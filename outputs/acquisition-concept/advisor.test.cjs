const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,f),'utf8');
const context=vm.createContext({assert,window:{addEventListener(){}}});
vm.runInContext(read('index.html').match(/^const deals=.*;$/m)[0]+'\n'+read('analytics.js').split('function bars(')[0]+'\n'+read('senior-read.js')+'\n'+read('advisor-timeline.js')+'\n'+read('advisor.js'),context);
vm.runInContext(`
 assert.equal(advisorFigure('margin'),'29.8');
 assert.equal(advisorFigure('marginCents'),'30');
 assert.equal(advisorFigure('coverage'),'2.06');
 shock=-40;
 assert.equal(advisorResolve('Coverage {compute:coverage}× at {compute:shock}'),'Coverage 1.55× at −40%');
 assert.throws(()=>advisorFigure('confidence'));
 assert.equal(Object.keys(advisorScript.branches).length,3);
 const allowed=new Set(['point_to_anchor','set_scenario','compute','get_context','open_note','draft_dig','draft_sponsor_note']);
 for(const segment of [advisorScript.events,...Object.values(advisorScript.branches)]){
  let last=-1;
  for(const e of segment){
   assert.ok(e.t>=last);last=e.t;
   if(e.type==='tool'){assert.ok(allowed.has(e.name));if(e.name==='set_scenario')assert.ok(Number.isInteger(e.args.shock)&&e.args.shock>=-80&&e.args.shock<=30&&e.args.shock%5===0)}
   if(e.type==='transcript')assert.ok(!advisorResolve(e.text).includes('{compute:'));
  }
 }
 for(const branch of Object.values(advisorScript.branches))assert.ok(branch.some(e=>['draft_dig','draft_sponsor_note','open_note'].includes(e.name)));
 assert.equal(advisorScript.label,'Scripted sample: authored, not a recorded session');
`,context);
for(const file of ['advisor.js','advisor-timeline.js']){
 assert.doesNotMatch(read(file),/getUserMedia|fetch\s*\(|WebSocket|XMLHttpRequest|localStorage|sessionStorage|gemini-/);
}
const svg=read('advisor-sprites.svg');
for(const pose of ['idle','idle-breathe','reading','listening','thinking','talk-closed','talk-mid','talk-open','point-left','point-down','skeptical','nod','blink'])assert.ok(svg.includes('id="'+pose+'"'));
assert.doesNotMatch(svg,/<image\b/);
console.log('Advisor: computed captions, timeline schema, safe branches, zero-provider surface and 13 vector poses passed.');
