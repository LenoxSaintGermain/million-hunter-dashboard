const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/editorial.js','utf8');
const handler=source.slice(source.lastIndexOf("document.addEventListener('click'"),source.lastIndexOf("if(location.hash"));
for(const type of ['shortlist','profile','lead']){
 const origin={id:'overview',setAttribute(){}},grid={},row={},profile={},lead={};
 const button={closest(selector){if(selector==='.screen')return origin;if(selector==='#overview-list')return type==='shortlist'?grid:null;if(selector==='.opportunity-profile')return type==='profile'?profile:null;if(selector==='.list-row, .lead')return type==='shortlist'?row:type==='lead'?lead:null;return null}};
 const context={document:{addEventListener(name,fn){fn({target:{closest(){return button}}})}},$:()=>null,shock:0,unfoldTrigger:null,unfoldAnchor:null};
 vm.runInNewContext(handler,context);
 assert.equal(context.unfoldAnchor,type==='shortlist'?grid:type==='profile'?profile:lead,`${type}: report must attach outside card grid`);
}
console.log('Inline report placement: shortlist grid, profile and lead passed.');
