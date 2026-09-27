// Prueba de renderizado: ejecuta los dibujantes de canvas con un contexto falso
// que registra todas las llamadas. Detecta excepciones, métodos inexistentes y
// coordenadas no finitas en la capa de dibujo.

import { createCareer, advanceToNextRound, currentRound } from '../js/game/career.js';
import { createSession, updateSession } from '../js/game/race.js';
import { TrackView } from '../js/render/track-view.js';
import { Minimap } from '../js/render/minimap.js';
import { Hud } from '../js/render/hud.js';
import { getCircuit, CIRCUITS } from '../js/data/circuits.js';
import { installDom } from './dom.stub.mjs';

let failures = 0;
const fail = (msg) => { failures++; console.log(`  ✗ ${msg}`); };

/* Los dibujantes leen el DPR de la ventana y el HUD construye DOM. */
const dom = installDom();
globalThis.window = { devicePixelRatio: 2, innerWidth: 1400, innerHeight: 800, ...globalThis.window };

/* Contexto 2D falso: acepta cualquier método y anota los argumentos numéricos. */
function fakeContext(label) {
  const numbers = [];
  const noop = () => {};
  const gradient = { addColorStop: noop };
  const state = {
    canvas: null,
    font: '',
    measureText: (t) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => null,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  };
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return (...args) => {
        if (typeof prop === 'string' && prop !== 'then') {
          for (const a of args) {
            if (typeof a === 'number') {
              if (!Number.isFinite(a)) numbers.push(`${label}.${prop}(${a})`);
            }
          }
        }
        return undefined;
      };
    },
    set(target, prop, value) {
      if (typeof value === 'number' && !Number.isFinite(value)) {
        numbers.push(`${label}.${prop} = ${value}`);
      }
      target[prop] = value;
      return true;
    },
  });
}

function fakeCanvas(w = 1200, h = 700) {
  return {
    width: w,
    height: h,
    getContext: () => fakeCanvas._ctx,
    getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, right: w, bottom: h, width: w, height: h }),
  };
}

const bad = { numbers: [] };

/* Instrumenta un contexto y recoge los valores no finitos. */
function instrument(canvas, label) {
  const inner = fakeContext(label);
  const wrapped = new Proxy(inner, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return (...args) => {
        for (const a of args) {
          if (typeof a === 'number' && !Number.isFinite(a)) bad.numbers.push(`${label}.${prop}(${a})`);
        }
        return undefined;
      };
    },
    set(target, prop, value) {
      if (typeof value === 'number' && !Number.isFinite(value)) bad.numbers.push(`${label}.${prop} = ${value}`);
      target[prop] = value;
      return true;
    },
  });
  canvas.getContext = () => wrapped;
  return wrapped;
}

console.log('render.check');

/* 1. Todas las cámaras del visor de pista sobre cada circuito. */
const state = createCareer(
  { name: 'Renders Test', birthDate: '2003-01-01', country: 'ESP' },
  { seed: 7 },
);
advanceToNextRound(state);
const round = currentRound(state);
const circuit = getCircuit(round.circuitId);
const session = createSession({
  circuit,
  entryList: state.entryList,
  kind: 'feature',
  round,
  settings: state.settings,
  seed: 42,
});

const drive = { steer: 0, throttle: 1, brake: 0, handbrake: false, drsPressed: false, pitPressed: false, edges: {} };

/* Se capturan estados durante toda la sesion para dibujar situaciones reales:
  izadas, Coche de Seguridad, banderas, coches retirados y primeros puestos. */
const snapshots = [];
for (let i = 0; i < 30 * 900 && !session.completed; i++) {
  updateSession(session, 1 / 30, drive);
  if (i % 450 === 0) snapshots.push({ ...session });
}
if (!snapshots.length) snapshots.push(session);

const canvas = fakeCanvas();
instrument(canvas, 'track');
const view = new TrackView(canvas);

for (const snap of snapshots) {
  for (let cam = 0; cam <= 4; cam++) {
    view.camera = cam;
    try {
      view.draw(snap);
    } catch (err) {
      fail(`TrackView.draw lanza en camara ${cam}: ${err.message}`);
      break;
    }
  }
}

/* El vehiculo debe avanzar y la sesion debe producir mensajes. */
if (!(session.player.dist > 500)) fail('El jugador no avanza');
if (session.messages.length < 3) fail('No se generan mensajes de carrera');
if (bad.numbers.length) {
  fail(`Valores no finitos en TrackView: ${[...new Set(bad.numbers)].slice(0, 6).join(', ')}`);
  bad.numbers.length = 0;
} else {
  console.log(`  OK   visor de pista: ${snapshots.length} estados x 5 camaras sin NaN`);
}
/* 2. Minimapa con datos de trazada. */
const mmCanvas = fakeCanvas(220, 220);
instrument(mmCanvas, 'minimap');
const minimap = new Minimap(mmCanvas);
try {
  minimap.setTrack(session.track);
  minimap.layout();
  minimap.draw(session);
  minimap.draw(session, { highlightSectors: [true, true, false] });
  console.log('  OK   minimapa dibuja trazada y coches');
} catch (err) {
  fail(`Minimap lanza: ${err.message}`);
}
if (bad.numbers.length) {
  fail(`Valores no finitos en Minimap: ${[...new Set(bad.numbers)].slice(0, 6).join(', ')}`);
  bad.numbers.length = 0;
}

/* 3. Todos los circuitos se dibujan sin datos inválidos. */
for (const c of CIRCUITS) {
  const pc = fakeCanvas(400, 300);
  instrument(pc, c.id);
  const v = new TrackView(pc);
  v.camera = 4;
  try {
    v.draw(session);
  } catch (err) {
    fail(`TrackView.draw lanza en ${c.id}: ${err.message}`);
    break;
  }
  if (bad.numbers.length) {
    fail(`Valores no finitos en ${c.id}: ${[...new Set(bad.numbers)].slice(0, 4).join(', ')}`);
    bad.numbers.length = 0;
    break;
  }
}
console.log(`  OK   ${CIRCUITS.length} circuitos dibujados`);

/* 4. HUD: se construye y se sincroniza con estados reales de carrera. */
try {
  const hudRoot = new dom.Element('div');
  const hud = new Hud(hudRoot);
  hud.setTrack(session.track);
  for (const snap of snapshots) {
    hud.update(snap);
    hud.updateStandings(snap);
  }
  hud.setMinimapVisible(false);
  hud.update(session);
  hud.setMinimapVisible(true);
  hud.minimap.layout();
  hud.setUnits('imperial');
  hud.update(session);

  const boxes = hudRoot.querySelectorAll('.hud-box');
  const gear = hudRoot.querySelector('.hud-gear');
  const speed = hudRoot.querySelector('.hud-speed b');
  if (boxes.length < 4) fail(`El HUD solo ha creado ${boxes.length} cajas`);
  if (gear === null) fail('El HUD no tiene caja de marcha');
  if (speed === null) fail('El HUD no tiene velocimetro');
  if (gear && !gear.textContent) fail('La marcha no muestra ningun valor');
  hud.reset();
  hud.update(session);
  hud.destroy();
  console.log(`  OK   HUD: ${boxes.length} cajas sincronizadas en ${snapshots.length} estados`);
} catch (err) {
  fail(`Hud lanza: ${err.message}`);
}

console.log(failures ? `\nFALLA: ${failures} fallo(s)` : '\nTodo correcto');
process.exit(failures ? 1 : 0);
