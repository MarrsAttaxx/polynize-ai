#!/usr/bin/env node
/**
 * Fails the build when a component references a CSS-module class that does not exist.
 *
 * WHY THIS IS A BUILD STEP AND NOT A LINT RULE YOU CAN IGNORE. TypeScript types a
 * `*.module.css` import as a plain string index, so `s.doesNotExist` compiles, typechecks
 * and builds clean, then renders `class="undefined"` in the browser. Two different
 * production failures on this site came from exactly that:
 *
 *   1. An unstyled SVG shape does not fall back to "plain". SVG defaults it to
 *      fill:black, stroke:none, so on a dark page the shape paints black on black and
 *      disappears. The torch figure on /mapping and /capability-mapping shipped with all
 *      eleven of its classes missing and read as an empty grid for days.
 *   2. Several elements all carrying `class="undefined"` means any stray `.undefined`
 *      selector matches every one of them at once. That took the second half of /mapping
 *      down when a delete removed the only definitions of three animation classes.
 *
 * Both are invisible to `tsc` and to `next build`. Hence this.
 *
 * WHAT IT CANNOT SEE, so do not read a pass as proof of nothing wrong: dynamic access
 * (`s[key]`), classes reached through `composes`, and anything built by string
 * concatenation. It only checks literal `ident.member` reads, which is the shape ~all of
 * this codebase uses. It errs towards false negatives on purpose: a checker that cries
 * wolf is a checker somebody adds `|| true` to.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ROOTS = ['app', 'lib'];
const SOURCE = /\.tsx?$/;

/** Every `import <ident> from '<path>.module.css'` in a file. */
const IMPORT_RE = /import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+\.module\.css)['"]/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (SOURCE.test(entry)) out.push(p);
  }
  return out;
}

/**
 * Class names a stylesheet defines. Deliberately greedy: it collects every `.token` in
 * the file, including ones inside media queries and compound selectors. Over-collecting
 * can only hide a real problem, never invent one.
 */
function definedClasses(cssPath) {
  const css = readFileSync(cssPath, 'utf8');
  return new Set([...css.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].map((m) => m[1]));
}

const cssCache = new Map();
const problems = [];
let filesChecked = 0;

for (const root of ROOTS) {
  let files;
  try {
    files = walk(root);
  } catch {
    continue; // root does not exist in this checkout
  }

  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const [, ident, spec] of src.matchAll(IMPORT_RE)) {
      const cssPath = resolve(dirname(file), spec);
      if (!cssCache.has(cssPath)) {
        try {
          cssCache.set(cssPath, definedClasses(cssPath));
        } catch {
          problems.push({ file, detail: `cannot read ${spec}` });
          cssCache.set(cssPath, new Set());
        }
      }
      const defined = cssCache.get(cssPath);
      filesChecked++;

      const used = new Set(
        [...src.matchAll(new RegExp(`\\b${ident}\\.([A-Za-z_$][\\w$]*)`, 'g'))].map((m) => m[1])
      );
      const missing = [...used].filter((c) => !defined.has(c)).sort();
      if (missing.length) {
        problems.push({
          file,
          detail: `${missing.map((c) => `${ident}.${c}`).join(', ')}  ->  not defined in ${spec}`,
        });
      }
    }
  }
}

if (problems.length) {
  console.error('\n[31mCSS module check failed.[0m');
  console.error(
    'These render as class="undefined". On SVG that means black on black; in bulk it means\n' +
      'any stray .undefined selector matches all of them at once.\n'
  );
  for (const p of problems) {
    console.error(`  ${relative(process.cwd(), p.file)}`);
    console.error(`    ${p.detail}`);
  }
  console.error('');
  process.exit(1);
}

console.log(`CSS module check passed (${filesChecked} stylesheet imports).`);
