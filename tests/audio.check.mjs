// Audio: el motor, los neumáticos, el público y los efectos no pueden lanzar.
// Reproduce la Web Audio API con un doble que registra las llamadas, para
// detectar nodos que updateEngine usa pero nodes nunca guarda.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { audio, audioBoot } from '../js/core/audio.js';
import { fileURLToPath } from 'node:url';

const RUTA = 'js/core/audio.js';

/* ───────── doble de Web Audio ───────── */
function paramDummy() {
  return {
    value: 0,
    setValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime() {},
    linearRampToValueAtTime() {}, cancelScheduledValues() {}, getValueAtTime() { return 0; },
  };
}

function nodo(ctx) {
  const base = {
    connect(dest) { base._to = dest; return dest; },
    disconnect() {},
    start() { base._arrancado = true; },
    stop() { base._parado = true; },
  };
  return base;
}

class FalsoAudioContext {
  constructor() {
    this.state = 'running';
    this.sampleRate = 48000;
    this.currentTime = 0;
    this.destination = nodo(this);
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
  createGain() { const n = nodo(this); n.gain = paramDummy(); return n; }
  createOscillator() { const n = nodo(this); n.frequency = paramDummy(); n.detune = paramDummy(); n.type = 'sine'; return n; }
  createBiquadFilter() { const n = nodo(this); n.frequency = paramDummy(); n.Q = paramDummy(); n.gain = paramDummy(); n.type = 'lowpass'; n.detune = paramDummy(); return n; }
  createWaveShaper() { const n = nodo(this); n.curve = null; n.oversample = 'none'; return n; }
  createDynamicsCompressor() {
    const n = nodo(this);
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = paramDummy();
    return n;
  }
  createStereoPanner() { const n = nodo(this); n.pan = paramDummy(); return n; }
  createBuffer(canales, largo, sampleRate) {
    const datos = [];
    for (let c = 0; c < canales; c++) datos.push(new Float32Array(largo));
    return { length: largo, sampleRate, numberOfChannels: canales, getChannelData: (c) => datos[c] };
  }
  createBufferSource() { const n = nodo(this); n.buffer = null; n.loop = false; n.playbackRate = { value: 1 }; return n; }
}

globalThis.window = {
  AudioContext: FalsoAudioContext,
  webkitAudioContext: FalsoAudioContext,
  addEventListener() {},
  removeEventListener() {},
};
globalThis.addEventListener = globalThis.window.addEventListener;
globalThis.removeEventListener = globalThis.window.removeEventListener;

audioBoot();

/* ───────── 1. el contexto arranca ───────── */
assert.equal(audio.init(), true, 'el doble de Web Audio deberia permitir init()');
assert.equal(audio.ready, true);

/* ───────── 2. todo nodo que usa updateEngine existe en nodes ───────── */
const fuente = readFileSync(RUTA, 'utf8');
const cuerpo = fuente.slice(fuente.indexOf('updateEngine(s = {}) {'), fuente.indexOf('stopEngine() {'));
const usados = new Set([...cuerpo.matchAll(/\bn\.([a-zA-Z]\w*)/g)].map((m) => m[1]));
assert.ok(usados.size >= 10, `updateEngine deberia tocar varios nodos, tocaba ${usados.size}`);

const perfiles = [
  {},
  { baseFreq: 46, harmonics: [1, 2, 3.02, 4.1] },
  { baseFreq: 31, sawtooth: 'square', harmonics: [1, 2] },
  { baseFreq: 120, harmonics: [1, 2, 3, 4, 5, 6, 7] },
];
for (const perfil of perfiles) {
  audio.startEngine(perfil);
  const faltan = [...usados].filter((k) => audio.nodes[k] === undefined);
  assert.deepEqual(faltan, [], `al crear el motor faltan nodos: ${faltan.join(', ')}`);
  assert.ok(audio.nodes.harmonics.length >= 2, 'harmonics debe traer al menos 2 parciales');
}

/* ───────── 3. updateEngine aguanta muchos estados sin lanzar ───────── */
audio.startEngine({ baseFreq: 46 });
const estados = [];
for (let i = 0; i < 240; i++) {
  estados.push({
    rpm: 700 + i * 60,
    throttle: (i % 17) / 17,
    speed: (i % 90) + (i % 7),
    gear: 1 + (i % 8),
    ers: (i % 11) / 11,
    drs: i % 3 === 0,
    offTrack: i % 23 === 0,
    kerb: i % 5 === 0 ? 1 : 0,
    load: (i % 13) / 13,
  });
}
for (const e of estados) audio.updateEngine(e);
audio.updateEngine();
audio.updateEngine({});
audio.updateEngine({ rpm: 0, throttle: 0, speed: 0, ers: null, load: undefined, drs: false });
assert.equal(audio.engineOn, true, 'el motor debe seguir sonando tras 240 actualizaciones');

/* ───────── 4. los bucles y efectos tampoco lanzan ───────── */
for (let i = 0; i <= 10; i++) {
  audio.setTireScreech(i / 10);
  audio.setSurface(i / 10);
  audio.setCrowd(i / 20);
  audio.setRain(i / 30);
}
for (const nombre of ['click', 'hover', 'back', 'confirm', 'error', 'pit', 'overtake', 'lap', 'tyre', 'wind', 'radio', 'finish', 'penalty', 'lights', 'gear', 'collision', 'setup', 'qualify']) {
  audio.sfx(nombre);
  audio.sfx(nombre, { cooldown: 0 });
}
audio.setEnabled(false);
audio.setEnabled(true);
audio.setVolumes({ engine: 0.4, sfx: 0.6, music: 0.2, crowd: 0.3 });
audio.stopEngine();
audio.updateEngine({ rpm: 12000, throttle: 1 });
audio.startEngine();
audio.updateEngine({ rpm: 6000, throttle: 0.5 });
audio.stopEngine();

/* ───────── 5. sin Web Audio el juego no se rompe ───────── */
const original = globalThis.window.AudioContext;
globalThis.window.AudioContext = undefined;
globalThis.window.webkitAudioContext = undefined;
const antes = audio.ctx;
audio.ctx = null;
audio.ready = false;
assert.equal(audio.init(), false, 'sin AudioContext init() debe devolver false, no lanzar');
audio.startEngine();
audio.updateEngine({ rpm: 5000, throttle: 1 });
audio.setTireScreech(1);
audio.setCrowd(1);
audio.sfx('click');
assert.equal(audio.ctx, null, 'no debe crear contexto si no hay API');
globalThis.window.AudioContext = original;
globalThis.window.webkitAudioContext = original;

/* ───────── 6. si un nodo desaparece, apaga el motor y no lanza ───────── */
audio.init();
audio.startEngine({ baseFreq: 46 });
delete audio.nodes.intakeFilter;
delete audio.nodes.windFilter;
audio.updateEngine({ rpm: 9000, throttle: 0.8, speed: 60 });
assert.equal(audio.engineOn, false, 'con nodos rotos el motor debe apagarse, no reventar la carrera');
audio.nodes = { oscA: {}, dead: false };
assert.doesNotThrow(() => audio.updateEngine({ rpm: 9000 }));

/* ───────── 7. el bucle de sesion aísla el audio ───────── */
const sesion = readFileSync('js/ui/screens/session.js', 'utf8');
const dibujo = sesion.indexOf('view.draw(session)');
const eventos = sesion.indexOf('checkEvents(session)');
assert.ok(dibujo > 0 && eventos > 0 && dibujo > eventos, 'dibujar despues de resolver eventos, nunca al reves');
assert.ok(
  /try \{ updateAudio\(session, controls\); runner\.avisoAudio = false; \} catch/.test(sesion),
  'updateAudio debe ir protegido y avisar una sola vez si falla',
);

console.log('ok   updateEngine usa nodos que el motor crea de verdad');
console.log(`ok   240 actualizaciones de motor sin lanzar (${usados.size} nodos vigilados)`);
console.log('ok   neumáticos, público, lluvia y efectos aguantan');
console.log('ok   sin Web Audio el juego sigue vivo');
console.log('ok   nodos rotos apagan el motor en vez de tumbar la carrera');
console.log('ok   el bucle de sesión aísla el audio y avisa una vez');
console.log('Todo correcto');
