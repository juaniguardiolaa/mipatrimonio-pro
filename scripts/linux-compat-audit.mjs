import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['.git', 'node_modules', '.next']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const abs = join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, out);
    else out.push(relative(ROOT, abs).replaceAll('\\', '/'));
  }
  return out;
}

const files = walk(ROOT);
const byLower = new Map();
for (const file of files) {
  const key = file.toLowerCase();
  byLower.set(key, [...(byLower.get(key) ?? []), file]);
}

const conflicts = [...byLower.values()].filter((group) => group.length > 1);
if (conflicts.length > 0) {
  console.error('Case-collision files detected:');
  for (const group of conflicts) console.error(' -', group.join(' | '));
  process.exit(1);
}

console.log('Linux casing audit passed.');
