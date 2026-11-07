// Headless Chrome shots of web/index.html (standalone mode).
// Usage: node scripts/shot.mjs "<url-params>" <out.png> [width,height]
//   e.g. node scripts/shot.mjs "seed=3&mode=play&view=planet" shots/play.png 1512,944
// Writes <out.png> (the page at that window size, default 1512,944), <out>-native.png (the 320x200 map canvas
// at its true size) and, in play mode, <out>-view.png (the 200x120 close-up), via index.html's dump=1 mode.
// Prints any page errors and exits 1 if there were some.
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { serve } from './serve.mjs';

const CHROME = process.env.CHROME || `${homedir()}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const [params = '', outArg, size = '1512,944'] = process.argv.slice(2);
if (!outArg) { console.error('usage: shot.mjs <url-params> <out.png> [width,height]'); process.exit(2) }
const out = resolve(outArg), stem = out.replace(/\.png$/, '');
await mkdir(dirname(out), { recursive: true });

const run = args => new Promise((ok, bad) => {
  const p = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--force-device-scale-factor=1', '--virtual-time-budget=4000', `--window-size=${size}`, ...args]);
  let so = ''; p.stdout.on('data', d => so += d); p.stderr.on('data', () => {});
  p.on('error', bad); p.on('close', code => code === 0 ? ok(so) : bad(new Error('chrome exited ' + code)));
});

const server = await serve(0);
const base = `http://127.0.0.1:${server.address().port}/index.html?${params}`;
try {
  await run([`--screenshot=${out}`, base]);
  const dom = await run(['--dump-dom', base + '&dump=1']);
  const grab = id => (dom.match(new RegExp(`<pre id="${id}"[^>]*>data:image/png;base64,([^<]+)</pre>`)) || [])[1];
  const errs = [...dom.matchAll(/<li class="err">([^<]*)<\/li>/g)].map(x => x[1]);
  const map = grab('dump-map'), view = grab('dump-view');
  if (map) await writeFile(stem + '-native.png', Buffer.from(map, 'base64')); else errs.push('no canvas dump found');
  if (view && !/mode=wallpaper/.test(params)) await writeFile(stem + '-view.png', Buffer.from(view, 'base64'));
  console.log(out + (map ? ' (+ native)' : ''));
  if (errs.length) { console.error('page errors:\n  ' + errs.join('\n  ')); process.exitCode = 1 }
} finally { server.close() }
