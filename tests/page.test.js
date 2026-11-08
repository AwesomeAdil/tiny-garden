// The real page (web/index.html + main.js) in headless Chrome, with a fake Swift bridge that records every message.
// Regression tests for the New map / New sandbox prompt across developer mode: a prompt never survives a boot, and
// confirming a stale one never sends an untagged new-map (which would archive save.json and replace the real garden).
// Skipped when Chrome for Testing isn't installed (CHROME=/path overrides, as for scripts/shot.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from '../scripts/serve.mjs';

const CHROME = process.env.CHROME || `${homedir()}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const skip = !existsSync(CHROME) || typeof WebSocket !== 'function' ? 'Chrome for Testing not found' : false;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function openPage() {
  const server = await serve(0), dir = mkdtempSync(join(tmpdir(), 'tg-page-'));
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${dir}`, '--no-first-run', '--window-size=1512,944', 'about:blank'], { stdio: 'ignore' });
  let port;
  for (let i = 0; i < 80 && !port; i++) { await sleep(100); try { port = +readFileSync(join(dir, 'DevToolsActivePort'), 'utf8').split('\n')[0] } catch {} }
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r });
  let id = 0; const pend = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) });
  const ev = async expr => {
    const r = (await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result;
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  await cdp('Page.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__sent=[]; window.webkit={messageHandlers:{garden:{postMessage:m=>window.__sent.push(JSON.parse(JSON.stringify(m)))}}};' });
  await cdp('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/index.html` });
  for (let i = 0; i < 100; i++) { await sleep(100); if (await ev('typeof garden === "object" && __sent.some(m => m.type === "ready")').catch(() => false)) break }
  const close = () => { ws.close(); ch.kill(); server.close(); try { rmSync(dir, { recursive: true, force: true }) } catch {} };
  return { ev, close };
}

const KEY = `document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD',key:'Î',altKey:true,shiftKey:true,bubbles:true})); 0`;
const SENT = `__sent.map(m => m.type + (m.dev ? '*' : ''))`;
const promptState = `({ asking: __app.asking, armed: __app.askArmed, hidden: document.getElementById('ask').hidden })`;
const CLOSED = { asking: false, armed: false, hidden: true };

test('the prompt never survives entering or leaving dev, and a stale one never makes a real new map', { skip }, async () => {
  const p = await openPage();
  try {
    // Swift: boot the real garden in play.
    await p.ev(`garden.boot(null, 'play', Date.now(), { topInset: 0 }); window.__real = __app.game.seed; 0`);

    // The real "New map?" prompt is open, then ⌥⇧D and Swift's sandbox boot: the prompt is gone.
    await p.ev(`document.getElementById('newbtn').click(); 0`);
    assert.equal(await p.ev(`document.getElementById('askt').textContent`), 'Start a new map?');
    await p.ev(KEY);
    await p.ev(`garden.boot(null, 'play', Date.now(), { topInset: 0, dev: true }); 0`);
    assert.equal(await p.ev(`__app.dev.on`), true);
    assert.deepEqual(await p.ev(promptState), CLOSED, 'closed after entering dev');

    // In dev, "New sandbox?" is open, then ⌥⇧D leaves: the prompt is gone and the real garden is back.
    await p.ev(`document.querySelector('[data-dev="new"]').click(); 0`);
    assert.equal(await p.ev(`document.getElementById('askt').textContent`), 'Start a new sandbox?');
    await p.ev(KEY);
    assert.equal(await p.ev(`__app.dev.on`), false);
    assert.equal(await p.ev(`__app.game.seed === __real`), true);
    assert.deepEqual(await p.ev(promptState), CLOSED, 'closed after leaving dev');

    // Confirming anyway (the reviewer's repro: click Yes) sends nothing.
    await p.ev(`__sent.length = 0; document.querySelector('[data-ask="yes"]').click(); 0`);
    assert.deepEqual((await p.ev(SENT)).filter(t => t.startsWith('new-map')), []);

    // A stale "New sandbox?" forced open in normal mode: confirming it never sends an untagged new-map.
    await p.ev(`__sent.length = 0; Object.assign(__app, { asking: true, askArmed: true, askKind: 'dev' }); document.getElementById('ask').hidden = false; document.querySelector('[data-ask="yes"]').click(); 0`);
    assert.deepEqual((await p.ev(SENT)).filter(t => t === 'new-map'), []);
    assert.equal(await p.ev(`__app.game.seed === __real`), true, 'the real garden is still there');
    // And a direct call with the wrong kind is refused too.
    assert.equal(await p.ev(`__app.newMap('dev')`), false);

    // A stale "New map?" forced open in dev never makes a sandbox from the wrong prompt either.
    await p.ev(KEY); await p.ev(`garden.boot(null, 'play', Date.now(), { topInset: 0, dev: true }); 0`);
    await p.ev(`__sent.length = 0; window.__sand = __app.game.seed; Object.assign(__app, { asking: true, askArmed: true, askKind: 'map' }); document.querySelector('[data-ask="yes"]').click(); 0`);
    assert.deepEqual((await p.ev(SENT)).filter(t => t.startsWith('new-map')), []);
    assert.equal(await p.ev(`__app.game.seed === __sand`), true);

    // The right prompt still works: New sandbox in dev sends a dev-tagged new-map only.
    await p.ev(`__sent.length = 0; document.querySelector('[data-dev="new"]').click(); document.querySelector('[data-ask="yes"]').click(); 0`);
    const sent = await p.ev(SENT);
    assert.ok(sent.includes('new-map*') && !sent.includes('new-map'), JSON.stringify(sent));
    assert.equal(await p.ev(`window.__errs.length`), 0, 'no page errors');
  } finally { p.close() }
});
