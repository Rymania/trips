// Fails when the JavaScript loaded on first visit exceeds the constitution's
// 150 KB gzipped budget. "First visit" = the entry chunk plus every chunk it
// statically imports (modulepreload links in dist/index.html); lazy chunks
// such as the Supabase client and settings routes don't count.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const BUDGET_KB = Number(process.env.BUNDLE_BUDGET_KB ?? 150);
const dist = 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const files = [
  ...html.matchAll(/<script[^>]+src="\/([^"]+\.js)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/([^"]+\.js)"/g),
].map((m) => m[1]);

if (files.length === 0) {
  console.error('No entry scripts found in dist/index.html. Run `npm run build` first.');
  process.exit(1);
}

let total = 0;
for (const f of new Set(files)) {
  const kb = gzipSync(readFileSync(join(dist, f))).length / 1024;
  total += kb;
  console.log(`${kb.toFixed(1).padStart(7)} KB  ${f}`);
}
console.log(`${total.toFixed(1).padStart(7)} KB  total (budget ${BUDGET_KB} KB gzipped)`);
if (total > BUDGET_KB) {
  console.error(`Initial JavaScript is over budget by ${(total - BUDGET_KB).toFixed(1)} KB.`);
  process.exit(1);
}
