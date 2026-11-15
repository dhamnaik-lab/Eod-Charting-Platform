// Isolated renderer acceptance: no desktop API, database, or release build.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer as createNetServer } from 'node:net';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const evidence = resolve('tmp/fixtures/audit-bounded-ui-20261115', String(Date.now()));
mkdirSync(evidence, { recursive: true });
const html = `<!doctype html><html><body><button id="outside">Outside</button><div id="root"></div>
<script type="module">
import React from '/node_modules/.vite/deps/react.js';
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
import {FloatingDialogShell} from '/src/components/common/FloatingDialogShell.tsx';
import {useActionConfirmation} from '/src/components/common/useActionConfirmation.tsx';
import {ChartTabs} from '/src/components/ChartTabs.tsx';
import {useChartStore} from '/src/store/chartStore.ts';
import {CorporateActionClassicDialog} from '/src/features/corporateActions/workspace/CorporateActionClassicWorkspace.tsx';
import {ChartEngine} from '/src/engine/ChartEngine.ts';
import {DARK_THEME,DEFAULT_CHART_VISUAL_SETTINGS} from '/src/engine/types.ts';
window.auditStore=useChartStore;
useChartStore.setState({chartTabs:[{id:'one',title:'One',displayBars:[]},{id:'two',title:'Two',displayBars:[]}],activeChartTabId:'one'});
const e=React.createElement;
function App(){
 const [mode,setMode]=React.useState(null);
 const confirmation=useActionConfirmation();
 const close=()=>setMode(null);
 const ask=async()=>{window.answer=await confirmation.confirm('Review this action. No data is changed.');};
 return e(React.Fragment,null,
  e(ChartTabs),
  e('button',{id:'open-modal',onClick:()=>setMode('modal')},'Modal'),
  e('button',{id:'open-modeless',onClick:()=>setMode('modeless')},'Modeless'),
  e('button',{id:'open-classic',onClick:()=>setMode('classic')},'Classic'),
  e('button',{id:'confirm',onClick:ask},'Confirm'),
  mode==='classic'?e(CorporateActionClassicDialog,{title:'Classic parent',onClose:close},e('button',{id:'nested-confirm',onClick:ask},'Nested confirm')):
  mode?e(FloatingDialogShell,{title:'Audit dialog',onClose:close,isModeless:mode==='modeless',width:400,height:300},
   e('input',{id:'field'}),e('button',{id:'last'},'Last')):null,
  confirmation.dialog);
}
ReactDOM.createRoot(document.getElementById('root')).render(e(App));
window.startEngineProfile=async()=>{
 const host=document.createElement('div');host.style='width:800px;height:480px';document.body.append(host);
 const engine=new ChartEngine(host,{theme:DARK_THEME,visualSettings:DEFAULT_CHART_VISUAL_SETTINGS,timeframe:'D',chartType:'candles'});
 const original=window.requestAnimationFrame;let callbacks=0;
 window.requestAnimationFrame=callback=>original(time=>{callbacks++;callback(time)});
 try{
  engine.mount();await new Promise(r=>setTimeout(r,100));
  const before=callbacks;await new Promise(r=>setTimeout(r,300));const idleCallbacks=callbacks-before;
  const diag=engine.getRenderDiagnostics();engine.markOverlayDirty();await new Promise(r=>setTimeout(r,60));
  const next=engine.getRenderDiagnostics();
  return {idleCallbacks,baseDelta:next.baseRenderCount-diag.baseRenderCount,overlayDelta:next.overlayRenderCount-diag.overlayRenderCount};
 }finally{engine.unmount();host.remove();window.requestAnimationFrame=original;}
};
window.auditReady=true;
</script></body></html>`;
let browser, ws, server;
const results = [];
try {
  server = await createServer({ configFile: false, plugins: [react()], resolve: { alias: { '@': resolve('src') } },
    optimizeDeps: { entries: [], noDiscovery: true, include: ['react', 'react-dom/client', 'zustand', 'zustand/shallow', 'zustand/vanilla', 'technicalindicators', 'date-fns'] },
    server: { host: '127.0.0.1', port: 0, watch: null }, appType: 'custom' });
  server.middlewares.use(async (req, res, next) => {
    if (req.url !== '/__audit') return next();
    res.setHeader('Content-Type', 'text/html');
    res.end(await server.transformIndexHtml('/__audit', html));
  });
  await server.listen();
  const port = server.httpServer.address().port;
  const probe = createNetServer();
  await new Promise(r => probe.listen(0, '127.0.0.1', r));
  const debugPort = probe.address().port;
  await new Promise(r => probe.close(r));
  browser = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--no-first-run', '--disable-sync', '--disable-extensions', '--disable-background-networking', '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${resolve(evidence, 'browser-profile')}`, 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  let pages;
  for (let i = 0; i < 100; i++) {
    try { pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json(); break; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  assert(pages?.length, 'Browser debugging endpoint');
  ws = new WebSocket(pages[0].webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
  let seq = 0;
  const pending = new Map();
  ws.addEventListener('message', e => { const message = JSON.parse(e.data); pending.get(message.id)?.(message);
    if (message.method === 'Runtime.exceptionThrown') console.error(JSON.stringify(message.params));
  });
  const cdp = (method, params = {}) => new Promise((r, j) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); j(Error(`${method} timed out`)); }, 20000);
    pending.set(id, message => { clearTimeout(timer); pending.delete(id); message.error ? j(Error(JSON.stringify(message.error))) : r(message.result); });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const response = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const pause = () => new Promise(r => setTimeout(r, 70));
  const click = async id => { await evaluate(`document.getElementById(${JSON.stringify(id)}).focus();document.getElementById(${JSON.stringify(id)}).click()`); await pause(); };
  const key = async (key, code, modifiers = 0) => {
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code, modifiers });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code, modifiers });
    await pause();
  };
  const check = async (name, expression) => { assert.equal(await evaluate(expression), true, name); results.push({ name, pass: true }); };
  await cdp('Runtime.enable');
  console.log('Browser connected; loading isolated renderer');
  await cdp('Page.navigate', { url: `http://127.0.0.1:${port}/__audit` });
  for (let i = 0; i < 120 && !await evaluate('Boolean(window.auditReady && document.getElementById("open-modal"))'); i++) await new Promise(r => setTimeout(r, 100));
  await check('Harness ready', 'Boolean(window.auditReady && document.getElementById("open-modal"))');
  await click('open-modal');
  await evaluate('document.getElementById("last").focus()'); await key('Tab', 9);
  await check('Modal Tab wraps', 'document.activeElement.getAttribute("role")==="group"');
  await key('Tab', 9, 8);
  await check('Modal Shift+Tab wraps', 'document.activeElement.id==="last"');
  await evaluate('document.getElementById("outside").focus()');
  await check('Modal rejects outside focus', 'document.querySelector("[role=dialog]").contains(document.activeElement)');
  await key('Escape', 27);
  await check('Escape closes and returns focus', '!document.querySelector("[role=dialog]") && document.activeElement.id==="open-modal"');
  await click('open-modeless');
  await evaluate('document.getElementById("outside").focus()');
  await check('Modeless permits chart focus', 'document.activeElement.id==="outside"');
  await evaluate('document.getElementById("last").focus()'); await key('Escape', 27);
  await evaluate('document.querySelector("[role=tab]").focus()'); await key('ArrowRight', 39);
  await check('Tab arrow activates and focuses sibling', 'window.auditStore.getState().activeChartTabId==="two" && document.activeElement.textContent==="Two"');
  await key('Home', 36);
  await check('Tab Home selects first; close is a sibling', 'window.auditStore.getState().activeChartTabId==="one" && !document.querySelector("[role=tab] button")');
  await click('confirm'); await key('Escape', 27);
  await check('Confirmation defaults to cancel', 'window.answer===false && !document.querySelector("[role=alertdialog]")');
  await click('open-classic'); await click('nested-confirm'); await key('Escape', 27);
  await check('Nested Escape closes only confirmation', 'window.answer===false && document.querySelector("[role=dialog]")?.textContent.includes("Classic parent") && !document.querySelector("[role=alertdialog]")');
  await key('Escape', 27);
  await click('confirm');
  await evaluate('document.querySelector("[role=alertdialog] button:last-child").click()'); await pause();
  await check('Explicit confirmation resolves true', 'window.answer===true');
  await click('confirm');
  await evaluate('window.auditStore.setState({isDatabaseTransitioning:true})'); await pause();
  await check('Database switch cancels confirmation', 'window.answer===false && !document.querySelector("[role=alertdialog]")');
  const engine = await evaluate('window.startEngineProfile()');
  assert.deepEqual(engine, { idleCallbacks: 0, baseDelta: 0, overlayDelta: 1 });
  results.push({ name: 'Real browser canvas idle and overlay profile', ...engine, pass: true });
  writeFileSync(resolve(evidence, 'result.json'), JSON.stringify({ status: 'PASS', results }, null, 2));
  console.log(JSON.stringify({ status: 'PASS', evidence, results }, null, 2));
  await cdp('Browser.close').catch(() => {});
} catch (error) {
  writeFileSync(resolve(evidence, 'result.json'), JSON.stringify({ status: 'FAIL', results, error: String(error) }, null, 2));
  throw error;
} finally {
  ws?.close();
  if (browser?.exitCode === null) browser.kill();
  await server?.close();
}
