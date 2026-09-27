// Prueba de arranque: monta el index.html real con un DOM mínimo y comprueba
// que la pantalla de carga termina, que aparece el menú y que se puede entrar
// en "Nueva carrera" y llegar al paddock.
//
//   node tests/boot.check.mjs              -> arranca con los módulos ES
//   node tests/boot.check.mjs --bundle     -> compila y arranca el paquete file://

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { installDom } from './dom.stub.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = process.argv.includes('--bundle');

let failures = 0;
const fail = (msg) => { failures++; console.log(`  ✗ ${msg}`); };
const ok = (msg) => console.log(`  OK   ${msg}`);

if (BUNDLE) {
  try {
    const out = execFileSync(process.execPath, [join(ROOT, 'build.mjs')], { encoding: 'utf8' });
    ok(out.split('\n')[0].trim());
  } catch (err) {
    fail(`build.mjs falló: ${err.stderr?.split('\n')[0] || err.message}`);
  }
}

console.log(BUNDLE ? 'boot.check (paquete file://)' : 'boot.check (módulos ES)');

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const dom = installDom(html);

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

/* Errores no capturados: cualquier fallo en el arranque se reporta. */
const errors = [];
process.on('uncaughtException', (err) => errors.push(`uncaught: ${err.message}`));
process.on('unhandledRejection', (err) => errors.push(`rejection: ${err?.message || err}`));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const $ = (sel) => dom.document.querySelector(sel);
const boot = $('#boot');
const menu = $('#menu');
const app = $('#app');

if (!boot || !menu || !app) {
  fail('index.html no contiene #boot, #menu o #app');
  console.log(failures ? '\nFALLA' : '\nTodo correcto');
  process.exit(1);
}
if (menu.hidden !== true) fail('#menu debería empezar oculto');
if (app.hidden !== true) fail('#app debería empezar oculto');
if (boot.hidden === true) fail('#boot debería empezar visible');

/* El arranque real: con los módulos ES o con el paquete compilado. */
if (BUNDLE) {
  const code = readFileSync(join(ROOT, 'dist', 'predestinato.bundle.js'), 'utf8');
  new Function(code)();
} else {
  await import('../js/main.js');
}

let waited = 0;
while (boot.hidden !== true && waited < 8000) {
  await wait(50);
  waited += 50;
}

if (boot.hidden !== true) {
  fail(`La pantalla de carga no termina (estado: "${$('#boot-status')?.textContent}", barra ${$('#boot-fill')?.style?.width || '?'})`);
} else {
  ok(`Pantalla de carga completada en ${waited} ms (${$('#boot-pct')?.textContent || ''})`);
}
if (menu.hidden !== false) fail('El menú no se muestra tras el arranque');
else ok('Menú visible');
if (!$('#menu-side')?.childNodes.length) fail('El menú lateral está vacío');
else ok(`Panel lateral con ${$('#menu-side').childNodes.length} bloques`);

/* Idioma: los textos deben estar en español y sin caracteres corruptos. */
const bodyText = dom.body.textContent;
if (/Iniciando sistemas/.test(bodyText)) ok('El texto de carga sigue en el documento (oculto)');
const tips = $('#boot-tip')?.textContent || '';
if (tips.length > 4) ok(`Consejo de carga: "${tips.slice(0, 48)}…"`);

/* Entrar en "Nueva carrera" y crear un piloto hasta el paddock. */
const newBtn = $('#mc-new');
if (!newBtn) fail('No existe el botón de nueva carrera');
else {
  newBtn.dispatch('click');
  await wait(120);
  const appBody = $('#app-body');
  if (app.hidden !== false) fail('La aplicación no se muestra al pulsar Nueva carrera');
  if (!appBody?.childNodes.length) fail('La pantalla de creación de piloto está vacía');
  else ok(`Creación de piloto montada (${appBody.textContent.length} chars)`);

  /* Rellenar el nombre y elegir un equipo. */
  const nameInput = appBody.querySelector('input');
  if (nameInput) {
    nameInput.value = 'Probador Veloz';
    nameInput.dispatch('input');
    await wait(30);
  }
  const teamOption = appBody.querySelectorAll('button').find((b) => b.classList.contains('team-card'));
  if (teamOption) {
    teamOption.dispatch('click');
    await wait(30);
    ok('Equipo seleccionado en la pantalla de piloto');
  }
  const start = appBody.querySelectorAll('button').find((b) => /Empezar|Comenzar|Crear/.test(b.textContent));
  if (start) {
    start.dispatch('click');
    await wait(300);
    if (/Paddock|Melbourne|Fin de semana|Circuito/i.test(appBody.textContent)) {
      ok(`Carrera creada: paddock visible (${appBody.textContent.slice(0, 60).replace(/\s+/g, ' ').trim()}…)`);
    } else {
      fail(`El paddock no aparece tras empezar: "${appBody.textContent.slice(0, 120).replace(/\s+/g, ' ').trim()}"`);
    }
  } else {
    fail('No hay botón para empezar la carrera');
  }
}

if (errors.length) {
  for (const e of [...new Set(errors)].slice(0, 6)) fail(e);
} else {
  ok('Sin errores en tiempo de ejecución durante el arranque');
}

/* El vigilante del index.html debe avisar si el juego no arranca. */
{
  const checks = [
    ['predestinato:ready', /predestinato:ready/],
    ['detecta file://', /location\.protocol === 'file:'/],
    ['usa el paquete en file://', /dist\/predestinato\.bundle\.js/],
    ['usa los módulos en http', /js\/main\.js/],
    ['mensaje de error', /No se pudo iniciar el juego/],
  ];
  const missing = checks.filter(([, re]) => !re.test(html)).map(([name]) => name);
  if (missing.length) fail(`El vigilante de arranque no cubre: ${missing.join(', ')}`);
  else ok(`Vigilante de arranque completo (${checks.length} comprobaciones)`);
}

console.log(failures ? `\nFALLA: ${failures} fallo(s)` : '\nTodo correcto');
process.exit(failures ? 1 : 0);
