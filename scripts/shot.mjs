// Headless Chrome shots of web/art.html.
// Usage: node scripts/shot.mjs "<url-params>" <out.png>
//   e.g. node scripts/shot.mjs "view=city&seed=7&skip=1" shots/city.png
// Writes <out.png> (page screenshot) and <out>-native.png (the canvas itself, at its native size,
// via art.html's dump=1 mode). Prints any page errors and exits 1 if there were some.
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { serve } from './serve.mjs';

const CHROME = process.env.CHROME || `${homedir()}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const [params = '', outArg] = process.argv.slice(2);
if (!outArg) { console.error('usage: shot.mjs <url-params> <out.png>'); process.exit(2) }
const out = resolve(outArg);
await mkdir(dirname(out), { recursive: true });

const run = args => new Promise((ok, bad) => {
  const p = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--force-device-scale-factor=1', '--virtual-time-budget=4000', ...args]);
  let so = ''; p.stdout.on('data', d => so += d); p.stderr.on('data', () => {});
  p.on('error', bad); p.on('close', code => code === 0 ? ok(so) : bad(new Error('chrome exited ' + code)));
});

const server = await serve(0);
const base = `http://127.0.0.1:${server.address().port}/art.html?${params}`;
try {
  await run([`--screenshot=${out}`, '--window-size=1000,640', base]);
  const dom = await run(['--dump-dom', base + '&dump=1']);
  const m = dom.match(/<pre id="dump">data:image\/png;base64,([^<]+)<\/pre>/);
  const errs = [...dom.matchAll(/<li class="err">([^<]*)<\/li>/g)].map(x => x[1]);
  if (m) await writeFile(out.replace(/\.png$/, '') + '-native.png', Buffer.from(m[1], 'base64'));
  else errs.push('no canvas dump found');
  console.log(out + (m ? ' (+ native)' : ''));
  if (errs.length) { console.error('page errors:\n  ' + errs.join('\n  ')); process.exitCode = 1 }
} finally { server.close() }
