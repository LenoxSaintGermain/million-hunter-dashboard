/** Isolated local Chrome layout assertions. No user profile, cookies or APIs. */
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const output = mkdtempSync("/tmp/aperture-result-layout.");
const profile = mkdtempSync("/tmp/aperture-result-chrome.");
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-background-networking",
  `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
const watchdog = setTimeout(() => chrome.kill("SIGTERM"), 60000);
let ws;
try {
  const url = await new Promise((resolve, reject) => {
    let stderr = "";
    chrome.stderr.on("data", chunk => { stderr += chunk; const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) resolve(match[1]); });
    chrome.once("exit", code => reject(new Error(`Chrome stopped before ready: ${code}`)));
  });
  ws = new WebSocket(url);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  ws.onmessage = event => { const value = JSON.parse(event.data); if (value.id && pending.has(value.id)) {
    const { resolve, reject } = pending.get(value.id); pending.delete(value.id);
    value.error ? reject(new Error(JSON.stringify(value.error))) : resolve(value.result);
  } };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const call = (method, params) => send(method, params, sessionId);
  await call("Page.enable");
  const results = [];
  for (const width of [390, 1280]) for (const state of ["incomplete", "failed"]) for (const textScale of width === 390 ? [1, 2] : [1]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 1, mobile: width === 390 });
    await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await call("Page.navigate", { url: `http://127.0.0.1:3113/__objective-result?state=${state}` });
    // Wait on actual DOM readiness, not a fabricated progress timer.
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = await call("Runtime.evaluate", { expression: 'document.readyState === "complete" && !!document.querySelector("[data-discovery-status]")', returnByValue: true });
      if (result.result.value) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert(ready, "Fixture did not render");
    await call("Runtime.evaluate", { expression: `document.documentElement.style.fontSize = '${16 * textScale}px'` });
    const { result } = await call("Runtime.evaluate", { expression: `(() => {
      const visible = el => el.getClientRects().length > 0;
      const controls = [...document.querySelectorAll('button,summary')].filter(visible);
      return {width:innerWidth, scrollWidth:document.documentElement.scrollWidth, height:document.documentElement.scrollHeight,
        heading:document.querySelector('h2').textContent,
        controlHeights:controls.map(el=>el.getBoundingClientRect().height),
        outcome:document.querySelector('[aria-label="Research outcome"]').textContent,
        reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,
        bodyText:document.body.innerText,
        apiRequests:performance.getEntriesByType('resource').filter(r=>r.name.includes('/api/')).length};
    })()`, returnByValue: true });
    const report = result.value;
    assert.equal(report.width, width); assert(report.scrollWidth <= width, "Horizontal overflow");
    assert(report.controlHeights.every(height => height >= 44), "Touch control below 44px");
    assert.equal(report.heading, state === "failed" ? "Research needs attention" : "Research incomplete");
    assert(report.outcome.includes("Reopen when:")); assert(report.outcome.includes("evidence is unverified"));
    assert(report.bodyText.includes("No allocation or order is created"));
    assert(!report.bodyText.includes("Underwrite a lead")); assert(report.reduced); assert.equal(report.apiRequests, 0);
    await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    const focus = await call("Runtime.evaluate", { expression: "document.activeElement.tagName", returnByValue: true });
    assert.equal(focus.result.value, "BUTTON");
    await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    const disclosure = await call("Runtime.evaluate", { expression: "document.activeElement.tagName", returnByValue: true });
    assert.equal(disclosure.result.value, "SUMMARY");
    await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", text: "\r", unmodifiedText: "\r", windowsVirtualKeyCode: 13 });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    const opened = await call("Runtime.evaluate", { expression: "document.activeElement.parentElement.open", returnByValue: true });
    assert.equal(opened.result.value, true);
    await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", text: "\r", unmodifiedText: "\r", windowsVirtualKeyCode: 13 });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    const screenshot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height: report.height, scale: 1 } });
    writeFileSync(`${output}/${width}-${state}-${textScale}x.png`, Buffer.from(screenshot.data, "base64"));
    results.push({ width, state, textScale, ...report, keyboardFirstControl: focus.result.value, keyboardDisclosureOpened: opened.result.value });
  }
  writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ output, scenarios: results.length, passed: true }));
} finally {
  ws?.close(); chrome.kill("SIGTERM"); clearTimeout(watchdog);
}
