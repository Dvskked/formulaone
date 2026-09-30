// Banco de pruebas de render: cuenta las llamadas al contexto 2D por fotograma
// y cronometra la construcción de un trazado. Diagnóstico, no suite.
import { installDom } from './dom.stub.mjs';
import { buildTrack } from '../js/game/track.js';
import { getCircuit } from '../js/data/circuits.js';
import { createSession } from '../js/game/race.js';
import { createCareer } from '../js/game/career.js';
import { buildTeamIndex } from '../js/ui/context.js';

installDom();
globalThis.performance = globalThis.performance || { now: () => Date.now() };

const COSTS = {
  moveTo: 1, lineTo: 1, closePath: 0.4, stroke: 6, fill: 5, fillRect: 0.6,
  arc: 2, save: 0.3, restore: 0.3, translate: 0.2, rotate: 0.2, scale: 0.2,
  createLinearGradient: 14, createRadialGradient: 22, fillText: 8, setTransform: 0.2,
  clip: 4, rect: 1, clearRect: 0.2, beginPath: 0.3, setLineDash: 0.5,
};

function countingCanvas() {
  const counts = {};
  const gradient = { addColorStop: () => { counts.addColorStop = (counts.addColorStop || 0) + 1; } };
  const factory = new Set(['createLinearGradient', 'createRadialGradient']);
  const ctx = new Proxy({}, {
    get(_t, prop) {
      if (factory.has(prop)) {
        return (...a) => { counts[prop] = (counts[prop] || 0) + 1; void a; return gradient; };
      }
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop in counts) return (...a) => { counts[prop]++; void a; };
      return () => undefined;
    },
    set(_t, prop, value) { counts[`set:${String(prop)}`] = (counts[`set:${String(prop)}`] || 0) + 1; void value; return true; },
  });
  return { ctx, counts, reset() { for (const k of Object.keys(counts)) delete counts[k]; } };
}

/* ── 1. Coste de construir un trazado ── */
console.log('=== Construcción del trazado ===');
{
  const t0 = performance.now();
  const t = buildTrack(getCircuit('interlagos'));
  const t1 = performance.now();
  console.log(`  buildTrack: ${(t1 - t0).toFixed(1)} ms, ${t.n} puntos (${(t.length / 1000).toFixed(2)} km)`);
  const t2 = performance.now();
  for (const c of ['monaco', 'spa', 'monza', 'baku', 'interlagos', 'yas-marina']) buildTrack(getCircuit(c));
  console.log(`  6 trazados: ${(performance.now() - t2).toFixed(0)} ms (con caché el segundo turno es gratis)`);
}

/* ── 2. Coste de dibujo por fotograma ── */
console.log('\n=== Coste de dibujo por fotograma ===');
{
  const { TrackView } = await import('../js/render/track-view.js');
  const { Hud } = await import('../js/render/hud.js');
  const career = createCareer(
    { name: 'Bench', birthDate: '2000-01-01', country: 'ITA', helmetPrimary: '#111', helmetSecondary: '#eee', helmetStyle: 'liso' },
    { series: 'f1', seed: 7 }
  );
  const { gridEntryList } = await import('../js/game/career.js');
  const round = { round: 1, series: 'f1', circuitId: 'interlagos', sessions: [{ id: 'r', type: 'feature', name: 'GP' }] };
  const session = createSession({
    circuit: getCircuit('interlagos'),
    entryList: gridEntryList(career),
    kind: 'feature', round, settings: {}, seed: 'bench',
  });
  // Calienta la sesión 3 s
  for (let i = 0; i < 180; i++) {
    session.phase = 'running';
    (await import('../js/game/race.js')).updateSession(session, 1 / 60, { throttle: 1, steer: 0, brake: 0 });
  }

  const canvas = {
    getContext: () => countingCtx.ctx,
    getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, right: 1920, bottom: 1080, width: 1920, height: 1080 }),
  };
  const countingCtx = countingCanvas();
  const view = new TrackView(canvas);
  view.setTrack(session.track, buildTeamIndex('f1'));
  const hudRoot = globalThis.document.createElement('div');
  globalThis.document.body.append(hudRoot);
  const hud = new Hud(hudRoot);
  hud.setTrack(session.track);

  for (const cam of [1, 2, 3, 4]) {
    view.setCamera(cam);
    view.draw(session); // calentar
    countingCtx.reset();
    const t0 = performance.now();
    const FRAMES = 30;
    for (let i = 0; i < FRAMES; i++) view.draw(session);
    const dt = (performance.now() - t0) / FRAMES;
    let cost = 0;
    const top = [];
    for (const [k, v] of Object.entries(countingCtx.counts)) {
      const unit = COSTS[k] ?? 1;
      cost += v * unit;
      top.push([k, v]);
    }
    top.sort((a, b) => (COSTS[b[0]] ?? 1) * b[1] - (COSTS[a[0]] ?? 1) * a[1]);
    console.log(`  cámara ${cam} (${view.cameraName}): ${dt.toFixed(2)} ms/fotograma (stub) · coste estimado ${cost.toFixed(0)} u`);
    console.log(`    ${top.slice(0, 8).map(([k, v]) => `${k}=${v}`).join('  ')}`);
  }

  countingCtx.reset();
  let t0 = performance.now();
  for (let i = 0; i < 30; i++) hud.update(session);
  console.log(`  HUD: ${((performance.now() - t0) / 30).toFixed(2)} ms/fotograma`);
  const domOps = Object.entries(countingCtx.counts).filter(([k]) => k.startsWith('set:'));
  console.log(`    (lecturas del contexto desde el HUD: ${domOps.length})`);
}
