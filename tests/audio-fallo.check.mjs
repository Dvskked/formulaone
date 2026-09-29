// Comprueba que el fallo era EXACTAMENTE el del usuario:
// "Cannot read properties of undefined (reading 'frequency')"
import assert from 'node:assert/strict';
import { audio } from '../js/core/audio.js';

function param() {
  return {
    value: 0, setValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime() {},
    linearRampToValueAtTime() {}, cancelScheduledValues() {}, getValueAtTime() { return 0; },
  };
}
const nodo = () => ({ connect(d) { return d; }, disconnect() {}, start() {}, stop() {} });
class Ctx {
  constructor() { this.state = 'running'; this.sampleRate = 48000; this.currentTime = 0; this.destination = nodo(); }
  resume() { return Promise.resolve(); }
  createGain() { return Object.assign(nodo(), { gain: param() }); }
  createOscillator() { return Object.assign(nodo(), { frequency: param(), detune: param(), type: 'sine' }); }
  createBiquadFilter() { return Object.assign(nodo(), { frequency: param(), Q: param(), gain: param(), type: 'lowpass', detune: param() }); }
  createWaveShaper() { return Object.assign(nodo(), { curve: null, oversample: 'none' }); }
  createDynamicsCompressor() {
    const n = nodo();
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = param();
    return n;
  }
  createBuffer(c, l) { const d = []; for (let i = 0; i < c; i++) d.push(new Float32Array(l)); return { length: l, getChannelData: (i) => d[i] }; }
  createBufferSource() { return Object.assign(nodo(), { buffer: null, loop: false }); }
}
globalThis.window = { AudioContext: Ctx, addEventListener() {}, removeEventListener() {} };

audio.init();
audio.startEngine({ baseFreq: 46 });

/* La linea exacta del fallo: updateEngine tocaba estos filtros, pero nodes no
   los guardaba, asi que salia "Cannot read properties of undefined (reading
   'frequency')" en el primer fotograma y tumbaba el bucle de carrera. */
const sinFiltro = { ...audio.nodes };
delete sinFiltro.intakeFilter;
delete sinFiltro.windFilter;
assert.throws(
  () => sinFiltro.intakeFilter.frequency.setTargetAtTime(1, 0, 0.1),
  { message: "Cannot read properties of undefined (reading 'frequency')" },
  'sin los filtros guardados, la linea del fallo da exactamente ese error',
);
assert.throws(() => sinFiltro.windFilter.frequency.setTargetAtTime(1, 0, 0.1), {
  message: "Cannot read properties of undefined (reading 'frequency')",
});

/* Con el codigo ya arreglado, ese mismo estado no rompe la carrera: el motor
   se apaga y el juego sigue. */
delete audio.nodes.intakeFilter;
delete audio.nodes.windFilter;
assert.doesNotThrow(() => audio.updateEngine({ rpm: 9000, throttle: 0.8, speed: 55, gear: 5, ers: 0.4 }));
assert.equal(audio.engineOn, false, 'nodos rotos apagan el motor en vez de reventar la carrera');

/* Y con los filtros en su sitio, el motor suena. */
audio.startEngine({ baseFreq: 46 });
for (const k of ['intakeFilter', 'windFilter', 'ersFilter']) {
  assert.ok(audio.nodes[k], `nodes debe guardar ${k}`);
  assert.equal(typeof audio.nodes[k].frequency.setTargetAtTime, 'function');
}
assert.doesNotThrow(() => audio.updateEngine({ rpm: 9000, throttle: 0.8, speed: 55, gear: 5, ers: 0.4 }));
assert.equal(audio.engineOn, true);
console.log('ok   la linea rota daba "Cannot read properties of undefined (reading frequency)"');
console.log('ok   un nodo que falte apaga el motor y no tumba la carrera');
console.log('ok   con los filtros guardados el motor suena');
console.log('Todo correcto');
