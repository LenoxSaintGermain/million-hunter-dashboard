/** Connected disposable UI UAT; no user Chrome profile or production host. */
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const loseResearchResponse = process.argv[2] === "--lose-research-response";
const interruptResearch = process.argv[2] === "--interrupt-research" || loseResearchResponse;
const evidenceRecovery = process.argv[2] === "--evidence-recovery" || interruptResearch;
const inspectResearch = process.argv[2] === "--inspect-research";
const inspectToday = process.argv[2] === "--inspect-today";
if (process.argv.length > (evidenceRecovery || inspectResearch || inspectToday ? 3 : 2)) throw Error("Use --evidence-recovery, --inspect-research, --inspect-today, --interrupt-research or --lose-research-response");
const output = mkdtempSync("/tmp/aperture-mobile-journey.");
const profile = mkdtempSync("/tmp/aperture-mobile-profile.");
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--disable-gpu",
  "--no-first-run", "--no-default-browser-check", "--disable-background-networking", `--user-data-dir=${profile}`,
  "--remote-debugging-port=0", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
const watchdog = setTimeout(() => chrome.kill("SIGTERM"), 180000);
let ws;
const requests = [], results = [];
try {
  const url = await new Promise((resolve, reject) => {
    let text = "";
    chrome.stderr.on("data", chunk => { text += chunk; const match = text.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) resolve(match[1]); });
    chrome.once("exit", code => reject(new Error(`Chrome exited: ${code}`)));
  });
  ws = new WebSocket(url);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let serial = 0; const pending = new Map();
  let researchInterrupted = false;
  ws.onmessage = event => {
    const value = JSON.parse(event.data);
    if (value.method === "Fetch.requestPaused") {
      const interrupt = interruptResearch && !researchInterrupted && value.params.request.url.includes('startResearch');
      if (interrupt) researchInterrupted = true;
      ws.send(JSON.stringify({ id: ++serial, sessionId: value.sessionId,
        method: interrupt ? "Fetch.failRequest" : "Fetch.continueRequest",
        params: {requestId:value.params.requestId,...(interrupt ? {errorReason:'Failed'} : {})} }));
    }
    if (value.method === "Network.requestWillBeSent" && value.params.request.url.includes("/api/trpc"))
      requests.push({ method: value.params.request.method, url: value.params.request.url });
    if (value.id && pending.has(value.id)) { const p = pending.get(value.id); pending.delete(value.id); value.error ? p.reject(Error(JSON.stringify(value.error))) : p.resolve(value.result); }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++serial; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
  async function page() {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const call = (method, params) => send(method, params, sessionId);
    await call("Page.enable"); await call("Network.enable");
    await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    const evaluate = async expression => {
      const r = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw Error(r.exceptionDetails.text + ": " + r.exceptionDetails.exception?.description);
      return r.result.value;
    };
    const wait = async expression => {
      for (let n = 0; n < 300; n++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 100)); }
      throw Error(`Timed out: ${expression}\n${await evaluate("document.body.innerText")}`);
    };
    const element = text => `[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(text)} && e.getClientRects().length)`;
    const click = async text => {
      await wait(`!!(${element(text)}) && !(${element(text)}).disabled`);
      const point = await evaluate(`(()=>{const e=${element(text)};e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      await call("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
      await call("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point });
    };
    const field = label => `document.getElementById([...document.querySelectorAll('label')].find(e=>e.textContent.trim()===${JSON.stringify(label)}).htmlFor)`;
    const fill = async (label, value) => {
      await wait(`!(${field(label)}).disabled && !!(${field(label)}).getClientRects().length`);
      await evaluate(`(()=>{const e=${field(label)};e.scrollIntoView({block:'center',behavior:'instant'});e.focus();e.select();})()`);
      await call("Input.insertText", { text: value });
      await wait(`(${field(label)}).value === ${JSON.stringify(value)}`);
    };
    const select = async (label, text) => {
      await wait(`!(${field(label)}).disabled && !!(${field(label)}).getClientRects().length`);
      return evaluate(`(()=>{const e=${field(label)}; const o=[...e.options].find(o=>o.textContent===${JSON.stringify(text)});if(!o)throw Error('Option unavailable');e.value=o.value;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    };
    const capture = async (name, expectedWidth = 390) => {
      await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
      const layout = await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,text:document.body.innerText,path:location.pathname,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches})`);
      if (layout.width !== expectedWidth || layout.scrollWidth > expectedWidth) {
        const overflow = await evaluate(`([...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>${expectedWidth}).map(e=>({tag:e.tagName,classes:e.className,text:e.textContent.slice(0,180),right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})))`);
        writeFileSync(`${output}/${name}-overflow.json`,JSON.stringify({layout,overflow},null,2));
        const shot = await call("Page.captureScreenshot",{format:"png",captureBeyondViewport:true});
        writeFileSync(`${output}/${name}-overflow.png`,Buffer.from(shot.data,"base64"));
      }
      assert.equal(layout.width,expectedWidth); assert(layout.scrollWidth<=expectedWidth, `Horizontal overflow at ${name}: ${layout.scrollWidth}`); assert(layout.reduced);
      assert(layout.text.length > 200, `Blank or incomplete frame at ${name}`);
      const controls = await evaluate(`([...document.querySelectorAll('button,a')].filter(e=>e.getClientRects().length && /^(Underwrite|Validate this play|Review mission|Continue to|Save draft|Inspect effective constraint|Open saved analysis)/.test(e.textContent.trim())).map(e=>({label:e.textContent.trim(),height:e.getBoundingClientRect().height,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth})))`);
      assert(controls.every(c=>c.height>=44), `Important touch control below 44px at ${name}`);
      assert(controls.every(c=>c.scrollWidth<=c.clientWidth), `Action content overflows at ${name}`);
      layout.controls = controls;
      const shot = await call("Page.captureScreenshot", {format:"png",captureBeyondViewport:true,clip:{x:0,y:0,width:expectedWidth,height:layout.height,scale:1}});
      writeFileSync(`${output}/${name}.png`,Buffer.from(shot.data,"base64")); results.push({name,...layout});
    };
    return { call, evaluate, wait, click, fill, select, capture, navigate: url => call("Page.navigate",{url}) };
  }
  let p = await page();
  if (inspectToday) {
    await p.navigate("http://127.0.0.1:3114/aperture");
    await p.wait("document.body.innerText.includes('Review unresolved finding')");
    await p.capture("today-before-review");
    await p.click("Review unresolved finding");
    await p.wait("document.body.innerText.includes('What is your assessment?')");
    assert(await p.evaluate("!!document.querySelector('a[href=\"https://example.org/illustrative-monitoring-fixture\"]')"), 'Saved source missing from inline evidence');
    assert(await p.evaluate("document.body.innerText.includes('Unresolved finding · stale evidence')"), 'Staleness erased the sourced concern');
    assert.equal(await p.evaluate("location.pathname"), '/aperture', 'Review navigated away from Today');
    assert.equal(requests.filter(r=>r.method==='POST' && !r.url.includes('markSeen')).length, 0, 'Opening review mutated work');
    await p.capture("today-inline-review-mobile");
    await p.evaluate("document.querySelector('input[type=radio][name^=review-]').click()");
    await p.fill("Reason or next check", "Illustrative UAT: request fresh catalyst evidence; keep the concern open.");
    await p.click("Save review");
    await p.wait("document.body.innerText.includes('Review saved')");
    await p.capture("today-inline-review-saved");
    await p.call("Page.reload");
    await p.wait("document.body.innerText.includes('Review unresolved finding')");
    await p.click("Review unresolved finding");
    await p.wait("document.body.innerText.includes('Review saved')");
    assert.equal(await p.evaluate("location.pathname"), '/aperture');
    await p.call("Emulation.setDeviceMetricsOverride", {width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await p.capture("today-inline-review-desktop",1280);
    await p.click("Review the exact gate");
    await p.wait("document.body.innerText.includes('Why it was held')");
    assert.equal(await p.evaluate("location.pathname"), '/aperture', 'Gate review navigated away from Today');
    assert(await p.evaluate("document.body.innerText.includes('Illustrative account context was unverified')"));
    assert(await p.evaluate("document.body.innerText.includes('it has not been re-evaluated')"));
    await p.capture("today-inline-gate-desktop",1280);
    await p.call("Emulation.setDeviceMetricsOverride", {width:390,height:844,deviceScaleFactor:1,mobile:true});
    await p.capture("today-inline-gate-mobile");
    assert(await p.evaluate("fetch('/isolated-uat/integrity').then(r=>r.json()).then(r=>r.unchanged)"), 'Review changed a protected order, check, gate or decision record');
    const mutations = requests.filter(r=>r.method==='POST' && !r.url.includes('markSeen'));
    assert.equal(mutations.length,1, 'Expected only the explicit review receipt mutation');
    assert(mutations[0].url.includes('monitor.reviews.record'));
    writeFileSync(`${output}/results.json`,JSON.stringify({passed:true,results,requests},null,2));
    console.log(JSON.stringify({output,passed:true,checkpoints:results.length}));
    ws.close(); chrome.kill("SIGTERM"); clearTimeout(watchdog); process.exit(0);
  }
  if (inspectResearch) {
    await p.navigate("http://127.0.0.1:3114/aperture/run/1?view=evidence");
    await p.wait("document.body.innerText.includes('All required checks')");
    await p.capture("mobile-existing-evidence");
    const evidenceActions = await p.evaluate(`([...document.querySelectorAll('button')].filter(e=>e.getClientRects().length).map(e=>e.textContent.trim()))`);
    assert.equal(evidenceActions.filter(label=>label==='Build source record').length,1,'The active evidence task must expose one source-building action, not duplicate controls');
    assert(!evidenceActions.some(label=>/^Compare 0 other candidates$/.test(label)),'Do not offer comparison when no alternative exists');
    await p.evaluate("[...document.querySelectorAll('details')].find(e=>e.querySelector('summary')?.textContent.includes('All required checks')).open=true");
    await p.capture("mobile-expanded-evidence");
    await p.navigate("http://127.0.0.1:3114/aperture/decision/2/revision/2/underwrite");
    await p.click("Check saved research");
    await p.wait("location.pathname === '/aperture/run/1' && location.search.includes('view=evidence') && document.body.innerText.includes('All required checks')");
    await p.capture("mobile-recovered-evidence");
    await p.evaluate("document.documentElement.style.fontSize='32px'");
    await p.capture("mobile-evidence-large-text");
    await p.evaluate("document.documentElement.style.fontSize='16px'");
    await p.call("Emulation.setDeviceMetricsOverride", {width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await p.capture("desktop-evidence",1280);
    assert.equal(requests.filter(r=>r.method==='POST').length,0,'Inspection/recovery created work');
    writeFileSync(`${output}/results.json`,JSON.stringify({passed:true,results,requests},null,2));
    console.log(JSON.stringify({output,passed:true}));
    ws.close(); chrome.kill("SIGTERM"); clearTimeout(watchdog); process.exit(0);
  }
  await p.navigate("http://127.0.0.1:3114/aperture/mission?objective=1");
  await p.wait("!!document.querySelector('input[id$=\"-mission\"]')");
  await p.fill("What should we research?", "Illustrative mobile UAT: investigate usage-linked swing opportunities without allocation.");
  await p.select("Primary horizon", "Swing");
  await p.click("Continue to account & risk");
  await p.select("Named Paper account", "Illustrative disposable paper account · Paper");
  await p.fill("Declared capital (USD)", "2000"); await p.fill("Maximum planned loss (USD)", "100");
  await p.click("Save draft");
  await p.wait("document.body.innerText.includes('Saved') && !document.body.innerText.includes('Unsaved changes')");
  await p.capture("mobile-saved-account-section");
  const mutationsBeforeReturn = requests.filter(r=>r.method==="POST").length;
  p = await page(); // Fresh page state, same server-owned user; no local draft copied.
  await p.navigate("http://127.0.0.1:3114/aperture/mission");
  await p.wait("document.body.innerText.includes('What should we research?') || document.body.innerText.includes('Declared capital (USD)')");
  await p.capture("mobile-resumed-draft");
  assert.equal(requests.filter(r=>r.method==="POST").length,mutationsBeforeReturn,"Resume performed an unexpected mutation");
  assert.equal(await p.evaluate(`document.querySelector('input[id$="-capital"]')?.value`),"2000");
  assert.equal(await p.evaluate(`document.querySelector('input[id$="-maxLoss"]')?.value`),"100");
  await p.click("Review mission"); await p.click("Inspect effective constraint");
  await p.wait("document.body.innerText.replace(/\\s+/g,' ').includes('Effective constraint $15.00')");
  await p.capture("mobile-effective-constraint");
  await p.click("Underwrite my mission");
  await p.wait("document.body.innerText.includes('Underwrite this lead')");
  await p.capture("mobile-positive-lead");
  await p.click("Underwrite this lead");
  await p.wait("location.pathname.endsWith('/underwrite') && document.body.innerText.includes('Portfolio impact not measured')");
  await p.capture("mobile-saved-underwriting");
  const beforeReload = requests.filter(r=>r.method==="POST").length;
  const navigationOrigin = await p.evaluate("performance.timeOrigin");
  await p.call("Page.reload");
  await p.wait(`performance.timeOrigin > ${navigationOrigin} && document.readyState === 'complete' && document.body.innerText.includes('Portfolio impact not measured')`);
  assert.equal(requests.filter(r=>r.method==="POST").length,beforeReload,"Result reload repeated a mutation");
  await p.evaluate("document.documentElement.style.fontSize='32px'");
  await p.capture("mobile-result-large-text");
  if (evidenceRecovery) {
    const underwritingPath = await p.evaluate("location.pathname");
    await p.evaluate("document.documentElement.style.fontSize='16px'");
    if (interruptResearch) await p.call("Fetch.enable", {patterns:[{urlPattern:'*startResearch*',requestStage:loseResearchResponse ? 'Response' : 'Request'}]});
    await p.click("Validate this play");
    if (interruptResearch) {
      await p.wait("[...document.querySelectorAll('button')].some(e=>e.textContent.trim()==='Check saved research' && !e.disabled)");
      assert(researchInterrupted,'Research request was not interrupted');
      await p.navigate(`http://127.0.0.1:3114${underwritingPath}`);
      await p.wait("[...document.querySelectorAll('button')].some(e=>e.textContent.trim()==='Continue selected research' && !e.disabled)");
      await p.capture("mobile-interrupted-selection");
      await p.click("Continue selected research");
    }
    await p.wait("/^\\/aperture\\/run\\/[0-9]+$/.test(location.pathname) && location.search.includes('view=evidence')");
    await p.wait("document.body.innerText.length > 300 && !document.body.innerText.includes('Loading run')");
    const researchPath = await p.evaluate("location.pathname + location.search");
    await p.capture("mobile-research-handoff");
    const postDispatch = requests.filter(r=>r.method==='POST').length;
    await p.navigate(`http://127.0.0.1:3114${underwritingPath}`);
    await p.click("Check saved research");
    await p.wait(`location.pathname + location.search === ${JSON.stringify(researchPath)}`);
    await p.wait("document.body.innerText.length > 300");
    await p.capture("mobile-recovered-research");
    assert.equal(requests.filter(r=>r.method==='POST').length,postDispatch,'Recovery repeated a mutation');
    assert.equal(requests.filter(r=>r.method==='POST' && r.url.includes('startResearch')).length,interruptResearch && !loseResearchResponse ? 2 : 1);
    assert.equal(requests.filter(r=>r.method==='POST' && r.url.includes('validatePlay')).length,1);
  }
  const forbidden = requests.filter(r=>r.method==="POST" && (evidenceRecovery ? /approve|submit|proposal/ : /approve|submit|proposal|startResearch|validatePlay/).test(r.url));
  assert.equal(forbidden.length,0);
  writeFileSync(`${output}/results.json`,JSON.stringify({passed:true,interruption:researchInterrupted ? loseResearchResponse ? 'response' : 'request' : null,results,requests},null,2));
  console.log(JSON.stringify({output,passed:true,checkpoints:results.length}));
} catch(error) {
  writeFileSync(`${output}/failure.json`,JSON.stringify({error:String(error),results,requests},null,2));
  console.error(JSON.stringify({output,error:String(error)})); process.exitCode=1;
} finally { ws?.close();chrome.kill("SIGTERM");clearTimeout(watchdog); setTimeout(()=>process.exit(process.exitCode ?? 0),1000); }
