import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Every web module must parse, including main.js (which can't be imported in node). The app runs in WebKit,
// so JavaScriptCore checks them too when it is on this machine.
const files = [], walk = d => readdirSync(d).forEach(f => { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p) });
walk(new URL('../web/js', import.meta.url).pathname);
const JSC = '/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc';

test('every web module parses', () => {
  assert.ok(files.length > 20);
  for (const f of files) {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    if (existsSync(JSC)) assert.equal(execFileSync(JSC, ['-e', `try { checkModuleSyntax(read(${JSON.stringify(f)})) } catch (e) { print(e) }`]).toString().trim(), '', f);
  }
});
