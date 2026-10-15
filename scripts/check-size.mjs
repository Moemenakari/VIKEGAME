// Fails the build when the shipped JavaScript grows past the mobile budget
// (docs/ARCHITECTURE.md §7: ≤ 600 KB gzip of app code, Three.js included).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 600;
const dir = 'packages/client/dist/assets';
const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
let total = 0;
for (const f of files) {
  const kb = gzipSync(readFileSync(join(dir, f))).length / 1024;
  total += kb;
  console.log(`${f.padEnd(40)} ${kb.toFixed(1)} KB gzip`);
}
console.log(`Total JS: ${total.toFixed(1)} KB gzip (budget ${BUDGET_KB} KB)`);
if (total > BUDGET_KB) {
  console.error('Bundle is over budget.');
  process.exit(1);
}
