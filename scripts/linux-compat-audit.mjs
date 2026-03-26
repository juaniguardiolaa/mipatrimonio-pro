import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, relative } from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['.git', 'node_modules', '.next']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const RESOLVABLE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.d.ts', '.json'];
const INDEX_EXTENSIONS = RESOLVABLE_EXTENSIONS.map((ext) => `/index${ext}`);

function toPosix(value) {
  return value.replaceAll('\\\\', '/');
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const abs = join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, out);
    else out.push(toPosix(relative(ROOT, abs)));
  }
  return out;
}

function collectImports(content) {
  const specs = [];
  const patterns = [
    /(?:import|export)\\s+(?:[^'"`]*?\\sfrom\\s*)?['"]([^'"`]+)['"]/g,
    /import\\(\\s*['"]([^'"`]+)['"]\\s*\\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      specs.push(match[1]);
    }
  }

  return specs;
}

function resolveCandidates(fromFile, specifier) {
  const importerDir = dirname(fromFile);
  const raw = specifier.startsWith('@/')
    ? specifier.slice(2)
    : toPosix(normalize(join(importerDir, specifier)));

  const hasExtension = extname(raw) !== '';
  if (hasExtension) return [toPosix(raw)];

  return [
    ...RESOLVABLE_EXTENSIONS.map((ext) => `${raw}${ext}`),
    ...INDEX_EXTENSIONS.map((suffix) => `${raw}${suffix}`),
  ];
}

const files = walk(ROOT);
const fileSet = new Set(files);
const filesByLower = new Map();

for (const file of files) {
  const key = file.toLowerCase();
  filesByLower.set(key, [...(filesByLower.get(key) ?? []), file]);
}

const collisions = [...filesByLower.values()].filter((group) => group.length > 1);
if (collisions.length > 0) {
  console.error('Case-collision files detected:');
  for (const group of collisions) {
    console.error(` - ${group.join(' | ')}`);
  }
  process.exit(1);
}

const casingMismatches = [];
for (const file of files) {
  if (!SOURCE_EXTENSIONS.has(extname(file))) continue;

  const content = readFileSync(join(ROOT, file), 'utf8');
  const imports = collectImports(content);

  for (const specifier of imports) {
    if (!specifier.startsWith('./') && !specifier.startsWith('../') && !specifier.startsWith('@/')) {
      continue;
    }

    const candidates = resolveCandidates(file, specifier);
    const exactMatch = candidates.find((candidate) => fileSet.has(candidate));
    if (exactMatch) continue;

    const mismatchedTarget = candidates
      .map((candidate) => filesByLower.get(candidate.toLowerCase()) ?? [])
      .flat();

    if (mismatchedTarget.length === 0) continue;

    casingMismatches.push({
      importer: file,
      specifier,
      resolvedCandidates: [...new Set(mismatchedTarget)].sort(),
    });
  }
}

if (casingMismatches.length > 0) {
  console.error('Import path casing mismatches detected:');
  for (const mismatch of casingMismatches) {
    console.error(
      ` - ${mismatch.importer}: "${mismatch.specifier}" differs by casing. Expected one of: ${mismatch.resolvedCandidates.join(', ')}`,
    );
  }
  process.exit(1);
}

console.log('Linux casing audit passed (files + imports).');
