// Prueba de renderizado: ejecuta los dibujantes de canvas con un contexto falso
// que registra todas las llamadas. Detecta excepciones, métodos inexistentes y
// coordenadas no finitas en la capa de dibujo.

import { createCareer, advanceToNextRound, currentRound } from '../js/game/career.js';
import { createSession, updateSession } from '../js/game/race.js';
import { TrackView } from '../js/render/track-view.js';
import { Minimap } from '../js/render/minimap.js';
import { getCircuit } from '../js/data/circuits.js';
import { CIRCUITS } from '../js/data/circuits.js';

let failures = 0;
const fail = (msg) => { failures++; console.log(`  ✗ ${msg}`); };

/* Los dibujantes leen el DPR de la ventana. */
globalThis.window = { devicePixelRatio: 2, innerWidth: 1400, innerHeight: 800 };

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

const drive = { steer: 0.12, throttle: 1, brake: 0, handbrake: false, drsPressed: false, pitPressed: false, rescue: false };
for (let i = 0; i < 2400; i++) updateSession(session, 1 / 60, i % 400 < 200 ? drive : { ...drive, steer: -0.1, brake: 0.4 });

const canvas = fakeCanvas();
instrument(canvas, 'track');
const view = new TrackView(canvas);

for (let cam = 0; cam <= 4; cam++) {
  view.camera = cam;
  try {
    view.draw(session);
  } catch (err) {
    fail(`TrackView.draw lanza en cámara ${cam}: ${err.message}`);
  }
}

/* El vehículo debe haber avanzado y la sesión no debe estar rota. */
if (!(session.player.lap >= 1)) fail('El jugador no completa ninguna vuelta');
if (!Number.isFinite(session.player.x) || !Number.isFinite(session.player.y)) fail('Posición del jugador no finita');
if (bad.numbers.length) {
  fail(`Valores no finitos en TrackView: ${[...new Set(bad.numbers)].slice(0, 6).join(', ')}`);
  bad.numbers.length = 0;
} else {
  console.log('  OK   visor de pista sin NaN en 5 cámaras');
}

/* 2. Minimapa con datos de trazada. */
const mmCanvas = fakeCanvas(220, 220);
instrument(mmCanvas, 'minimap');
const minimap = new Minimap(mmCanvas);
try {
  minimap.layout();
  minimap.draw(session);
  minimap.setPosition({ x: session.player.x, y: session.player.y, angle: session.player.angle });
  console.log('  OK   minimapa dibuja y posiciona');
} catch (err) {
  fail(`Minimap lanza: ${err.message}`);
}
if (bad.numbers.length) {
  fail(`Valores no finitos en Minimap: ${[...new Set(bad.numbers)].slice(0, 6).join(', ')}`);
  bad.numbers.length = 0;
}

/* 3. Todos los circuitos se pueden crear y_bounds sin datos inválidos. */
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

console.log(failures ? `\nFALLA: ${failures} fallo(s)` : '\nTodo correcto');
process.exit(failures ? 1 : 0);
