// Static check: every named import refers to a name the target module really exports.
import fs from 'node:fs';
import path from 'node:path';

const roots = ['public/js', 'server', 'test', 'tools'];
const files = ['server.js'];
for (const r of roots) {
  (function walk(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (/\.m?js$/.test(f.name)) files.push(p);
    }
  })(r);
}
const exportsOf = new Map();
function exportsFor(file) {
  if (exportsOf.has(file)) return exportsOf.get(file);
  const t = fs.readFileSync(file, 'utf8');
  const names = new Set();
  for (const m of t.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of t.matchAll(/export\s*\{([^}]*)\}(?:\s*from\s*'([^']+)')?/g)) for (const n of m[1].split(',')) if (n.trim()) names.add(n.trim().split(/\s+as\s+/).pop());
  if (/export\s+default/.test(t)) names.add('default');
  exportsOf.set(file, names);
  return names;
}
let bad = 0;
for (const file of files) {
  const t = fs.readFileSync(file, 'utf8');
  for (const m of t.matchAll(/import\s*\{([^}]*)\}\s*from\s*'(\.[^']+)'/g)) {
    const target = path.resolve(path.dirname(file), m[2]);
    if (!fs.existsSync(target)) {
      console.log(`${file}: missing module ${m[2]}`);
      bad++;
      continue;
    }
    const ex = exportsFor(target);
    for (const n of m[1].split(',')) {
      const name = n.trim().split(/\s+as\s+/)[0];
      if (name && !ex.has(name)) {
        console.log(`${file}: '${name}' is not exported by ${m[2]}`);
        bad++;
      }
    }
  }
  for (const m of t.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from\s*'(\.[^']+)'/g)) {
    const target = path.resolve(path.dirname(file), m[2]);
    if (!exportsFor(target).has('default')) {
      console.log(`${file}: default import from ${m[2]} has no default export`);
      bad++;
    }
  }
}
console.log(bad ? `${bad} problem(s)` : `imports OK across ${files.length} files`);
process.exitCode = bad ? 1 : 0;
