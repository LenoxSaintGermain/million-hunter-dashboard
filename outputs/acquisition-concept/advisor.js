/* Phase 0: authored events -> closed UI effects. No voice, network or authority. */
const advisorSeen = new Set();
const advisorAnchorKeys = {margin:'cashFlow',coupled:'coverage',recurring:'repeat',concentration:'repeat',license:'location',unasked:'checklist'};
const advisorPoses = new Set(['idle','idle-breathe','reading','listening','thinking','talk-closed','talk-mid','talk-open','point-left','point-down','skeptical','nod','blink']);
let advisorRuntime = null;
function disposeAdvisor(){advisorRuntime?.dispose();advisorRuntime=null}
function advisorFigure(metric){
 const d=seniorDeal();if(!d)throw new Error('No business context');
 const x=seniorDerived(d);
 const values={coverage:x.coverage.toFixed(2),breakEven:(x.breakEven*100).toFixed(1),margin:(x.margin*100).toFixed(1),marginCents:String(Math.round(x.margin*100)),multiple:x.multiple.toFixed(2),shock:signed(shock)};
 if(!Object.hasOwn(values,metric))throw new Error('Unsupported metric');
 return values[metric];
}
function advisorResolve(text){return text.replace(/\{compute:([A-Za-z]+)\}/g,(_,metric)=>advisorFigure(metric))}
function advisorSprite(pose='idle',className=''){return '<svg class="advisor-art '+className+'" viewBox="0 0 132 160" aria-hidden="true"><use href="advisor-sprites.svg#'+pose+'"></use></svg>'}
function mountAdvisor(){
 if(!seniorDeal())return;
 const deal=$('deal'),d=seniorDeal(),timers=new Set(),pending=new Set(),handled=new Set();
 let alive=true,playing=false,events=[],cursor=0,lastT=0,serial=0,pose='idle',pointed=null,turns=[],effects=[],mouthUntil=0,paused=false,sheetReturnFocus=true,leanUntil=0;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),mobile=matchMedia('(max-width: 700px)');
 const widget=document.createElement('aside');widget.id='advisor-widget';widget.setAttribute('aria-label','The Senior · scripted advisor');
 widget.innerHTML='<div class="advisor-box"><div class="advisor-brand"><div class="advisor-home">'+advisorSprite('reading')+'</div><div><span class="eyebrow">Signal Hunter</span><h2>The<br>Senior.</h2><p>Your margin<br>partner.</p></div></div><p class="advisor-label">'+advisorScript.label+'</p><div class="advisor-desktop-controls"><button data-advisor-talk>Talk it through</button></div><div class="advisor-conversation"><p class="advisor-status" role="status">A silent comic-strip walkthrough. No microphone or agents.</p><p class="advisor-status" data-voice-help hidden>Voice is planned for the signed-in app. This preview plays a scripted sample. No microphone is opened.</p><div class="advisor-balloons" aria-live="polite"></div><div class="advisor-choices"></div><div class="advisor-playback"><button data-advisor-pause>Pause sample</button><button data-advisor-next>Next panel</button><button data-advisor-replay>Replay sample</button></div><details class="advisor-history"><summary>The strip · <span data-turn-count>0</span> panels</summary><ol></ol></details></div></div><button class="advisor-mobile-launch" aria-label="Talk it through — scripted sample">'+advisorSprite('idle')+'<span><strong>The Senior</strong><small>'+advisorScript.label+'</small></span></button><svg class="advisor-tail" aria-hidden="true"><path></path></svg>';
 const sheet=document.createElement('dialog');sheet.id='advisor-sheet';sheet.className='advisor-sheet';sheet.setAttribute('aria-labelledby','advisor-sheet-title');
 sheet.innerHTML='<header><h2 id="advisor-sheet-title">The Senior / the strip</h2><button data-sheet-close aria-label="Close advisor strip">×</button></header><p class="advisor-label">'+advisorScript.label+'</p><div data-sheet-content></div>';
 deal.append(widget,sheet);
 const box=widget.querySelector('.advisor-box'),conversation=widget.querySelector('.advisor-conversation');
 const status=widget.querySelector('.advisor-status'),balloons=widget.querySelector('.advisor-balloons'),choices=widget.querySelector('.advisor-choices'),historyList=widget.querySelector('.advisor-history ol');
 function later(fn,ms){const id=setTimeout(()=>{timers.delete(id);if(alive)fn()},ms);timers.add(id);return id}
 function stopTimers(){timers.forEach(clearTimeout);timers.clear()}
 function reflow(){const root=deal.querySelector('.senior-desktop');if(root)arrangeSenior(root)}
 function place(){
  if(mobile.matches)deal.append(widget);else deal.querySelector('.senior-desktop').prepend(widget);
  if(!mobile.matches&&sheet.open)sheet.close();
  reflow();
 }
 function setPose(next){
  if(!advisorPoses.has(next)||next==='thinking'||next==='listening')return; // No actual call or mic in Phase 0.
  if(Date.now()<leanUntil&&!next.startsWith('point-'))return;
  pose=next;widget.querySelectorAll('.advisor-art use').forEach(use=>use.setAttribute('href','advisor-sprites.svg#'+next));
  widget.dataset.pose=next;
 }
 function ambient(){
  if(!alive||paused)return;
  if(!reduce.matches&&!playing&&Date.now()>mouthUntil){setPose('idle-breathe');later(()=>setPose('idle'),2000)}
  later(ambient,4000);
 }
 function blink(){
  if(!alive||paused)return;
  if(!reduce.matches&&Date.now()>mouthUntil&&!playing){const previous=pose;setPose('blink');later(()=>setPose(previous),120)}
  later(blink,4000+Math.random()*5000);
 }
 function caption(text,role='advisor'){
  const resolved=advisorResolve(text);turns.push({text:resolved,role,anchor:pointed,pose,effects:effects.splice(0)});
  balloons.innerHTML=turns.slice(-2).map(t=>'<p class="advisor-balloon '+t.role+'"><span class="eyebrow">'+(t.role==='advisor'?'The Senior':'You')+'</span>'+escapeDossier(t.text)+'</p>').join('');
  historyList.innerHTML=turns.map((t,i)=>'<li><button data-panel-index="'+i+'">'+advisorSprite(t.pose)+'<span><small>'+escapeDossier(t.role==='advisor'?'The Senior':'You')+'</small>'+escapeDossier(t.text)+(t.effects.length?'<em>'+escapeDossier(t.effects.join(' · '))+'</em>':'')+'</span></button></li>').join('');
  conversation.querySelector('[data-turn-count]').textContent=turns.length;
  historyList.querySelectorAll('[data-panel-index]').forEach(b=>b.onclick=()=>{const t=turns[Number(b.dataset.panelIndex)];if(t.anchor)point(t.anchor,false);status.textContent='Revisiting this panel. Scenario and judgments are unchanged.'});
  if(role==='advisor'&&!reduce.matches){const duration=Math.min(1800,Math.max(400,resolved.length*12));mouthUntil=Date.now()+duration;let n=0;const flap=()=>{if(Date.now()>=mouthUntil){setPose('idle');return}setPose(['talk-closed','talk-mid','talk-open','talk-mid'][n++%4]);later(flap,120)};flap()}
  reflow();
 }
 function targetAnchor(id,prepare=true){
  const key=advisorAnchorKeys[id];if(!key)throw new Error('Unknown anchor');
  if(mobile.matches){
   if(prepare){readerState='notes';renderReader()}
   return deal.querySelector('#mobile-reader [data-anchor="'+key+'"]');
  }
  return deal.querySelector('.senior-body [data-anchor="'+key+'"]');
 }
 function point(id,lean=true){
  const anchor=targetAnchor(id);if(!anchor)return;
  deal.querySelectorAll('.advisor-pointed').forEach(el=>el.classList.remove('advisor-pointed'));anchor.classList.add('advisor-pointed');pointed=id;
  if(lean){setPose(mobile.matches?'point-down':'point-left');leanUntil=Date.now()+700;later(()=>{leanUntil=0;setPose('idle')},700)}
  if(mobile.matches){anchor.scrollIntoView({block:'center',behavior:'auto'});widget.querySelector('.advisor-tail').hidden=true}
  else {
   const start=widget.querySelector('.advisor-home').getBoundingClientRect(),end=anchor.getBoundingClientRect(),origin=widget.getBoundingClientRect();
   const tail=widget.querySelector('.advisor-tail');tail.hidden=false;tail.style.width=widget.clientWidth+'px';tail.style.height='1px';
   tail.querySelector('path').setAttribute('d','M '+(start.left-origin.left+8)+' '+(start.top-origin.top+82)+' Q '+(end.right-origin.left+24)+' '+(start.top-origin.top+82)+' '+(end.right-origin.left)+' '+(end.top-origin.top+end.height/2));
  }
 }
 function showNotes(){
  if(mobile.matches){if(sheet.open){sheetReturnFocus=false;sheet.close()}readerState='notes';renderReader()}
  return mobile.matches?deal.querySelector('#mobile-reader .senior-read'):deal.querySelector('.senior-desktop');
 }
 function tool(name,args={},id){
  if(handled.has(id)||pending.has(id))return;
  pending.add(id);
  try{
   if(name==='compute')return advisorFigure(args.metric);
   if(name==='get_context'){if(!['brief','thesis','notes','evidence','ledger'].includes(args.section))throw new Error('Unknown context');return {deal:d.name,section:args.section,source:'Illustrative composite; unverified',data:args.section==='thesis'?structuredClone(thesisDraft):args.section==='notes'?seniorNotes.business(d,seniorDerived(d)):args.section==='ledger'?structuredClone(seniorSession(d).ledger):args.section==='evidence'?{supportedCriteria:1,totalCriteria:6,verified:false}:{price:d.price,cashFlow:d.cashFlow,coverage:advisorFigure('coverage')}}}
   if(name==='point_to_anchor'){point(args.anchorId);effects.push('Highlighted '+args.anchorId)}
   else if(name==='set_scenario'){
    if(!Number.isInteger(args.shock)||args.shock<-80||args.shock>30||args.shock%5)throw new Error('Scenario outside the catalog');
    const input=deal.querySelector('#shock');if(!input)throw new Error('Scenario unavailable');
    input.value=String(args.shock);input.dispatchEvent(new Event('input',{bubbles:true})); // Same operator path.
    if(mobile.matches)renderReader();
    effects.push('Moved scenario to '+signed(args.shock));point('coupled',false);
   } else if(['open_note','draft_dig','draft_sponsor_note'].includes(name)){
    if(!seniorNotes.business(d,seniorDerived(d)).some(n=>n.id===args.noteId))throw new Error('Unknown note');
    const scope=showNotes(),note=scope.querySelector('#'+(mobile.matches?'mobile':'desktop')+'-'+args.noteId);
    if(name==='open_note'){const details=note.querySelector('details');if(details)details.open=true;note.focus();note.scrollIntoView({block:'center',behavior:'auto'})}
    else {const mode=name==='draft_dig'?'dig':'sponsor',button=note.querySelector('[data-fork="'+mode+'"]');if(!button)throw new Error('Reopen this settled note yourself before drafting');button.click();note.querySelector('textarea, [data-confirm]')?.focus();note.scrollIntoView({block:'center',behavior:'auto'})}
    effects.push(name==='open_note'?'Opened the existing note':'Opened existing approval draft · nothing sent');
   } else throw new Error('Tool not in the Phase 0 catalog');
   handled.add(id);
  } finally {pending.delete(id);reflow()}
 }
 function runEvent(event){
  if(event.type==='pose')setPose(event.pose);
  else if(event.type==='tool')tool(event.name,event.args,'segment-'+serial+'-'+cursor);
  else if(event.type==='transcript')caption(event.text,event.role);
  else if(event.type==='await_operator'){
   playing=false;choices.innerHTML=event.choices.map(key=>'<button data-branch="'+key+'">'+({dig:'Dig into the add-backs',sponsor:'Ask my sponsor',read:'Keep reading'})[key]+'</button>').join('');
   choices.querySelectorAll('button').forEach(b=>b.onclick=()=>{choices.innerHTML='';play(advisorScript.branches[b.dataset.branch])});
   status.textContent='Your turn. Choose a scripted branch; no action is sent.';conversation.querySelector('[data-advisor-pause]').disabled=true;conversation.querySelector('[data-advisor-next]').disabled=true;setPose('idle');ambient();blink();reflow();
  } else if(event.type==='end'){if(effects.length)caption('The existing review controls are ready. Nothing has been sent.');playing=false;paused=false;conversation.querySelector('[data-advisor-pause]').disabled=true;conversation.querySelector('[data-advisor-next]').disabled=true;ambient();blink();status.textContent='Sample complete. The note and any draft are yours to review. Nothing was sent.';setPose('idle');reflow()}
  else throw new Error('Unsupported event');
 }
 function schedule(){
  if(!alive||!playing||cursor>=events.length)return;
  const event=events[cursor];later(()=>{if(!playing)return;try{runEvent(event);lastT=event.t;cursor++;schedule()}catch(error){playing=false;status.textContent='Sample paused: '+error.message;setPose('idle')}},Math.max(0,event.t-lastT));
 }
 function play(segment=advisorScript.events){
  stopTimers();serial++;events=segment;cursor=0;lastT=0;playing=true;paused=false;choices.innerHTML='';
  conversation.querySelector('[data-advisor-pause]').disabled=false;conversation.querySelector('[data-advisor-next]').disabled=false;conversation.querySelector('[data-advisor-pause]').textContent='Pause sample';status.textContent='Scripted walkthrough · silent, authored captions.';schedule();
 }
 function pause(){playing=false;paused=true;leanUntil=0;stopTimers();setPose('idle');conversation.querySelector('[data-advisor-pause]').textContent='Resume sample';status.textContent='Sample paused. Nothing is listening.'}
 function talk(){conversation.querySelector('[data-voice-help]').hidden=false;status.textContent='Voice is planned for the signed-in app. This preview plays a scripted sample; no microphone is opened.';if(mobile.matches){sheet.querySelector('[data-sheet-content]').append(conversation);sheet.showModal();sheet.querySelector('[data-sheet-close]').focus()}if(!events.length)play();reflow()}
 widget.querySelector('[data-advisor-talk]').onclick=talk;widget.querySelector('.advisor-mobile-launch').onclick=talk;
 widget.querySelector('[data-advisor-replay]').onclick=()=>{turns=[];effects=[];balloons.innerHTML='';historyList.innerHTML='';conversation.querySelector('[data-turn-count]').textContent='0';play()};
 conversation.querySelector('[data-advisor-pause]').onclick=()=>{if(playing)pause();else{playing=true;paused=false;conversation.querySelector('[data-advisor-pause]').textContent='Pause sample';schedule()}};
 conversation.querySelector('[data-advisor-next]').onclick=()=>{pause();if(cursor<events.length){try{runEvent(events[cursor]);lastT=events[cursor++].t}catch(error){status.textContent=error.message}}};
 sheet.querySelector('[data-sheet-close]').onclick=()=>sheet.close();
 sheet.addEventListener('close',()=>{box.append(conversation);if(sheetReturnFocus)widget.querySelector('.advisor-mobile-launch').focus();sheetReturnFocus=true;reflow()});
 const onAction=e=>{if(e.target.closest('[data-confirm]')){setPose('nod');later(()=>setPose('idle'),600)}};
 const onVisibility=()=>{if(document.hidden)pause()};
 deal.addEventListener('click',onAction);document.addEventListener('visibilitychange',onVisibility);mobile.addEventListener('change',place);
 place();
 const observer=new ResizeObserver(reflow);observer.observe(box);
 advisorRuntime={dispose(){alive=false;stopTimers();observer.disconnect();mobile.removeEventListener('change',place);document.removeEventListener('visibilitychange',onVisibility);deal.removeEventListener('click',onAction);widget.remove();sheet.remove()}};
 if(!advisorSeen.has(d.name)){advisorSeen.add(d.name);later(()=>play(),100)}else{status.textContent='Scripted sample ready. Replay when you want a second read.';setPose('idle');ambient();blink()}
}
