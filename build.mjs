// Empaquetador mínimo: convierte el grafo de módulos ES en un único script
// clásico para que el juego también funcione abriendo index.html con doble
// clic (file://), donde el navegador bloquea los módulos.
//
//   node build.mjs        -> escribe dist/predestinato.bundle.js

import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const ENTRY = 'js/main.js';
const OUT = join(ROOT, 'dist', 'predestinato.bundle.js');

/* Sello de compilacion. Se escribe en el paquete y en un fichero suelto para
   que se pueda comprobar de un vistazo que el navegador esta con el codigo
   actual y no con una copia guardada en la cache. */
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const STAMP = `${pkg.version || '0.0.0'}+${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)}`;
writeFileSync(join(ROOT, 'dist', 'build.json'), JSON.stringify({ stamp: STAMP, modules: 0, bytes: 0 }, null, 2), 'utf8');

const IMPORT_NAMED = /^import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?[ \t]*$/gm;
const IMPORT_BARE = /^import\s*['"]([^'"]+)['"];?[ \t]*$/gm;
const DYNAMIC = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
const EXPORT_LIST = /^export\s*\{([^}]*)\};?[ \t]*$/gm;
const EXPORT_DECL = /^export\s+(async\s+function|function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;

const cache = new Map();

/** Resuelve una ruta relativa entre módulos y la normaliza a clave de proyecto. */
function resolveId(fromId, spec) {
  if (!spec.startsWith('.')) throw new Error(`Import externo no soportado: ${spec} (en ${fromId})`);
  const abs = resolve(dirname(join(ROOT, fromId)), spec);
  const rel = relative(ROOT, abs).split('\\').join('/');
  if (!statSync(abs, { throwIfNoEntry: false })) throw new Error(`No existe ${spec} importado desde ${fromId}`);
  return rel;
}

/** Convierte `{ a, b as c }` en `{ a, b: c }`. */
function specToDestructure(list) {
  return list
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(part);
      return m ? `${m[1]}: ${m[2]}` : part;
    })
    .join(', ');
}

function load(id) {
  if (cache.has(id)) return cache.get(id);
  const source = readFileSync(join(ROOT, id), 'utf8');
  const mod = { id, deps: new Set(), exports: [] };
  cache.set(id, mod);

  const deps = new Set();
  const dynDeps = new Set();
  let code = source
    .replace(IMPORT_NAMED, (_, names, spec) => {
      const target = resolveId(id, spec);
      deps.add(target);
      return `const { ${specToDestructure(names)} } = __req(${JSON.stringify(target)});`;
    })
    .replace(IMPORT_BARE, (_, spec) => {
      const target = resolveId(id, spec);
      deps.add(target);
      return `__req(${JSON.stringify(target)});`;
    })
    .replace(DYNAMIC, (_, spec) => {
      const target = resolveId(id, spec);
      /* Los import() dinámicos no son aristas estáticas: se resuelven al vuelo. */
      dynDeps.add(target);
      return `__lazy(${JSON.stringify(target)})`;
    })
    /* El sello de compilacion se graba aqui, no en el archivo de origen. */
    .replace(/'PENDIENTE_BUILD_MJS'/g, JSON.stringify(STAMP));

  const exported = [];
  code = code.replace(EXPORT_LIST, (_, list) => {
    for (const part of list.split(',')) {
      const clean = part.trim();
      if (!clean) continue;
      const m = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(clean);
      if (m) exported.push([m[2], m[1]]);
      else exported.push([clean, clean]);
    }
    return '';
  });
  code = code.replace(EXPORT_DECL, (_, kind, name) => {
    exported.push([name, name]);
    return `${kind} ${name}`;
  });

  if (/^\s*export\s+default/m.test(code)) throw new Error(`"export default" no está soportado (${id})`);
  if (/^\s*export\s+/m.test(code)) throw new Error(`Forma de export no soportada en ${id}`);

  mod.deps = deps;
  mod.dynDeps = dynDeps;
  mod.exports = exported;
  mod.code = code;
  return mod;
}

/* ── Recorrido en profundidad: solo aristas estáticas (los import() no
      crean ciclo, se resuelven cuando se ejecutan) ─────────────────────── */
const marks = new Map();
function walk(id, trail = []) {
  const mark = marks.get(id);
  if (mark === 'done') return;
  if (mark === 'visiting') throw new Error(`Ciclo de import estático: ${[...trail, id].join(' -> ')}`);
  marks.set(id, 'visiting');
  const mod = load(id);
  for (const dep of mod.deps) walk(dep, [...trail, id]);
  marks.set(id, 'done');
}

walk(ENTRY);

/* Los módulos alcanzados solo por import() también deben entrar en el paquete,
   y con ellos todos sus imports estáticos. */
const queue = [...cache.keys()];
const seen = new Set();
while (queue.length) {
  const id = queue.shift();
  if (seen.has(id)) continue;
  seen.add(id);
  const mod = cache.get(id);
  if (!mod) continue;
  for (const dep of mod.dynDeps) {
    queue.push(dep);
    walk(dep, [`${id} (import dinámico)`]);
  }
}

const modules = [...cache.values()].filter((m) => m.code !== undefined)
  .sort((a, b) => a.id.localeCompare(b.id));
const banner = `/* FORMULA 1: PREDESTINATO — paquete autogenerado por build.mjs. No editar a mano. */`;
const stampLine = `window.__BUILD__ = ${JSON.stringify(STAMP)};`;

const parts = [
  banner,
  stampLine,
  '(function () {',
  "'use strict';",
  'var __registry = {};',
  'var __cache = {};',
  'function __req(id) {',
  '  if (__cache[id]) return __cache[id];',
  '  var exports = (__cache[id] = {});',
  '  var factory = __registry[id];',
  "  if (!factory) throw new Error('Modulo no encontrado: ' + id);",
  '  factory(exports, __req);',
  '  return exports;',
  '}',
  'function __lazy(id) { return Promise.resolve().then(function () { return __req(id); }); }',
];

for (const mod of modules) {
  const assigns = mod.exports
    .map(([name, local]) => `  __x.${name} = ${local};`)
    .join('\n');
  parts.push(
    `__registry[${JSON.stringify(mod.id)}] = function (__x, __req) {`,
    mod.code,
    assigns,
    '};',
  );
}

parts.push(`__req(${JSON.stringify(ENTRY)});`, '})();');

mkdirSync(dirname(OUT), { recursive: true });
const bundle = parts.join('\n');
writeFileSync(OUT, bundle, 'utf8');

/* Avisa de los ficheros de js/ que no entran en el paquete. */
const bundled = new Set(modules.map((m) => m.id));
const orphans = [];
for (const file of readdirSync(join(ROOT, 'js'), { recursive: true })) {
  if (!String(file).endsWith('.js')) continue;
  const id = `js/${String(file).split('\\').join('/')}`;
  if (!bundled.has(id)) orphans.push(id);
}

const kb = (bundle.length / 1024).toFixed(1);
writeFileSync(join(ROOT, 'dist', 'build.json'), JSON.stringify({ stamp: STAMP, modules: modules.length, bytes: bundle.length }, null, 2), 'utf8');
console.log(`build: ${modules.length} módulos -> dist/predestinato.bundle.js (${kb} kB)`);
console.log(`build: sello ${STAMP}`);
if (orphans.length) {
  console.log(`AVISO: ${orphans.length} fichero(s) de js/ fuera del paquete:`);
  for (const id of orphans) console.log(`  - ${id}`);
}
