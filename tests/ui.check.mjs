// Comprueba el front-end sin navegador: que todos los símbolos importados
// existan, que las rutas dinámicas apunten a archivos reales y que las clases
// usadas en el DOM estén definidas en la hoja de estilo.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
let checks = 0;

function check(ok, label, detail = '') {
  checks++;
  if (!ok) failures.push(detail ? `${label} — ${detail}` : label);
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (extname(full) === '.js') out.push(full);
  }
  return out;
}

const files = walk(join(ROOT, 'js'));

/* ── 1. Símbolos importados frente a exports reales ───────────────── */

const IMPORT_RE = /import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/g;
const exportsCache = new Map();

async function exportsOf(absPath) {
  if (exportsCache.has(absPath)) return exportsCache.get(absPath);
  let names = null;
  try {
    const mod = await import(pathToFileURL(absPath).href);
    names = new Set(Object.keys(mod));
  } catch (err) {
    names = new Set([`ERROR:${err.message}`]);
  }
  exportsCache.set(absPath, names);
  return names;
}

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(IMPORT_RE)) {
    const [, rawNames, spec] = match;
    const target = resolve(dirname(file), spec);
    check(existsSync(target), 'Importa un archivo inexistente', `${relative(ROOT, file)} → ${spec}`);
    if (!existsSync(target)) continue;
    const available = await exportsOf(target);
    if ([...available].some((n) => n.startsWith('ERROR:'))) {
      check(false, 'No se pudo importar un módulo', `${relative(ROOT, target)}: ${[...available][0]}`);
      continue;
    }
    for (const raw of rawNames.split(',')) {
      const name = raw.trim().split(/\s+as\s+/)[0].trim();
      if (!name) continue;
      check(available.has(name), 'Símbolo importado inexistente', `${relative(ROOT, file)} importa «${name}» de ${relative(ROOT, target)}`);
    }
  }
}

/* ── 2. Importaciones dinámicas ───────────────────────────────────── */

const DYNAMIC_RE = /import\(\s*['"](\.[^'"]+)['"]\s*\)/g;
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(DYNAMIC_RE)) {
    const target = resolve(dirname(file), match[1]);
    check(existsSync(target), 'Import dinámico a un archivo inexistente', `${relative(ROOT, file)} → ${match[1]}`);
  }
}

/* ── 3. Clases del DOM definidas en la hoja de estilo ─────────────── */

const css = readFileSync(join(ROOT, 'css', 'styles.css'), 'utf8');
const cssClasses = new Set([...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]));
const STATE_CLASSES = new Set([
  'me', 'next', 'played', 'unread', 'grow', 'spacer', 'chip', 'accent', 'center', 'between',
  'stack', 'grid', 'row', 'card', 'btn', 'pad', 'stick', 'info-card', 'table', 'swatch', 'pick',
  'bad', 'warn', 'good', 'out', 'r', 'p', 'g', 'ok', 'invalid', 't', 'd', 'dim', 'muted', 'mono',
]);
const TAG_RE = /el\(\s*'([a-zA-Z][^']*)'/g;
for (const file of files.filter((f) => f.includes(`${join('ui', 'screens')}`) || f.includes('render') || f.includes('ui') || f.endsWith('main.js'))) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(TAG_RE)) {
    const spec = match[1];
    for (const token of spec.split(/(?=[.#])/).slice(1)) {
      if (!token.startsWith('.')) continue;
      const cls = token.slice(1);
      if (STATE_CLASSES.has(cls)) continue;
      check(cssClasses.has(cls), 'Clase usada sin definir en el CSS', `${relative(ROOT, file)} usa .${cls}`);
    }
  }
}

/* ── 4. Referencias del menú y rutas de pantallas ────────────────── */

const main = readFileSync(join(ROOT, 'js', 'main.js'), 'utf8');
const navIds = [...main.matchAll(/id:\s*'([a-z-]+)',\s*label:/g)].map((m) => m[1]);
check(navIds.length >= 5, 'El menú define al menos cinco pestañas', `hay ${navIds.length}`);
for (const id of navIds) {
  check(main.includes(`${id}: () => import(`), 'Cada pestaña del menú tiene su pantalla', id);
}

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
for (const id of ['boot', 'menu', 'app', 'appbar', 'app-body', 'toasts', 'modal-root', 'menu-canvas', 'boot-fill', 'boot-status', 'boot-pct', 'boot-tip', 'mc-continue', 'mc-new', 'mc-saves', 'mc-how', 'menu-sound', 'menu-settings', 'menu-side', 'menu-foot-text']) {
  check(html.includes(`id="${id}"`), 'index.html no define un elemento usado', `#${id}`);
}
check(html.includes('js/main.js'), 'index.html no carga js/main.js');
check(html.includes('css/styles.css'), 'index.html no carga la hoja de estilo');

/* ── Resultado ────────────────────────────────────────────────────── */

for (const failure of failures) console.log(`  ✗ ${failure}`);
console.log(`${failures.length ? 'FALLA' : 'Todo OK'}: ${checks} comprobaciones de interfaz, ${failures.length} fallo(s)`);
process.exit(failures.length ? 1 : 0);
