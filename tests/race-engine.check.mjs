// Prueba de humo del motor de sesión: practices, Q1/Q2/Q3, parrilla y carrera.
import { buildTrack } from '../js/game/track.js';
import { createSession, updateSession, endSessionNow, formatMs } from '../js/game/race.js';
import { getCircuit } from '../js/data/circuits.js';
import { makeRng } from '../js/core/rng.js';
import { DEFAULT_SETTINGS } from '../js/core/storage.js';
import { createCareer, currentRound } from '../js/game/career.js';

let failures = 0;
function check(label, cond, extra = '') {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label} ${extra}`);
  }
}

function makeCareerState(series, seed) {
  return createCareer(
    {
      name: 'Test Piloto',
      birthDate: '2004-05-14',
      country: 'ESP',
      helmetPrimary: '#e10600',
      helmetSecondary: '#ffffff',
      helmetStyle: 'rayas',
    },
    { series, seed }
  );
}

function makeField(series, seed, size = 22) {
  const career = makeCareerState(series, seed);
  const list = career.entryList;
  if (size < list.length) {
    const keep = list.filter((e) => e.isPlayer).concat(list.filter((e) => !e.isPlayer).slice(0, size - 1));
    return { career, list: keep };
  }
  return { career, list };
}

function fakeInput() {
  return { steer: 0, throttle: 1, brake: 0, drsPressed: false, pitPressed: false, edges: {} };
}

function run(state, seconds, input) {
  const dt = 1 / 30;
  for (let t = 0; t < seconds; t += dt) {
    updateSession(state, dt, input);
    if (state.completed) break;
  }
  return state;
}

console.log('race-engine.check');

/* ── Prácticas ── */
{
  const { career, list } = makeField('f1', 7);
  const circuit = getCircuit(currentRound(career).circuitId);
  const track = buildTrack(circuit, makeRng(7));
  const state = createSession({
    circuit,
    entryList: list,
    kind: 'fp',
    round: currentRound(career),
    settings: { ...DEFAULT_SETTINGS, raceLength: 'corta' },
    seed: 11,
  });
  run(state, 200, fakeInput());
  check('fp: arranca la sesión', state.phase === 'running', `phase=${state.phase}`);
  check('fp: el jugador avanza', state.player.dist > 20, `dist=${state.player.dist.toFixed(1)}`);
  check('fp: hay vueltas cronometradas', state.cars.some((c) => c.bestLapMs > 0));
  check('fp: tiempos realistas', state.cars.every((c) => !c.bestLapMs || c.bestLapMs > 30000), `min=${Math.min(...state.cars.map((c) => c.bestLapMs || 1e9))}`);
  check('fp: la IA también corre', state.cars.filter((c) => !c.isPlayer).every((c) => c.dist > 10));
  const res = endSessionNow(state);
  check('fp: resultados completos', res.entries.length === 22, `n=${res.entries.length}`);
  check('fp: el jugador aparece', res.entries.some((e) => e.driverId === 'player'));
  console.log(`       mejor vuelta fp: ${formatMs(res.entries[0].bestLapMs)} (${res.entries[0].name})`);
}

/* ── Clasificación Q1/Q2/Q3 ── */
{
  const { career, list } = makeField('f1', 21);
  const round = { ...currentRound(career), circuitId: 'monaco', sessions: [
    { id: 'q1', type: 'quali', name: 'Q1', segment: 0 },
    { id: 'q2', type: 'quali', name: 'Q2', segment: 1 },
    { id: 'q3', type: 'quali', name: 'Q3', segment: 2 },
  ] };
  const circuit = getCircuit('monaco');
  const track = buildTrack(circuit, makeRng(21));
  const state = createSession({ circuit, entryList: list, kind: 'quali', round, settings: { ...DEFAULT_SETTINGS, raceLength: 'corta' }, seed: 5 });
  check('quali: arranca en Q1', state.segment === 0 && state.phase === 'running', `seg=${state.segment}`);
  run(state, 213, fakeInput());
  check('quali: Q1 cerrada con 22', state.segmentsDone.length === 1, `hechos=${state.segmentsDone.length}`);
  check('quali: pasa a Q2', state.phase === 'running' && state.segment === 1, `seg=${state.segment} phase=${state.phase}`);
  run(state, 179, fakeInput());
  check('quali: Q2 cerrada', state.segmentsDone.length === 2, `hechos=${state.segmentsDone.length}`);
  run(state, 165, fakeInput());
  check('quali: Q3 cierra la sesión', state.completed === true, `completed=${state.completed}`);
  const q3 = state.segmentsDone[state.segmentsDone.length - 1].rows;
  const withTime = q3.filter((r) => r.bestLapMs > 0);
  check('quali: los 15 de Q3 marcan tiempo', withTime.length === 15, `con tiempo=${withTime.length}`);
  check('quali: corte de Q3 en 10', state.grid.length === 10, `grid=${state.grid.length}`);
  check('quali: orden por tiempo', q3.every((r, i) => i === 0 || (q3[i - 1].bestLapMs || Infinity) <= (r.bestLapMs || Infinity)));
  check('quali: tiempos realistas', withTime.every((r) => r.bestLapMs > 30000), `${Math.min(...withTime.map((r) => r.bestLapMs))} ms`);
  check('quali: clasificación con los 22', state.results && state.results.entries.length === 22, `n=${state.results?.entries.length}`);
  check('quali: los 12 eliminados marcados', state.results.entries.filter((e) => e.eliminated).length === 12, `elim=${state.results.entries.filter((e) => e.eliminated).length}`);
  check('quali: top 10 con posición de parrilla', state.results.entries.slice(0, 10).every((e, i) => e.grid === i + 1));
  check('quali: pole en posición 1', state.results.entries[0].position === 1);
  check('quali: grid de carrera en el resultado', state.results.grid && state.results.grid.length === 10, `grid=${state.results.grid?.length}`);
  console.log(`       pole: ${state.results.entries[0].name} ${formatMs(state.results.entries[0].bestLapMs)}`);
}

/* ── Sprint ── */
{
  const { career, list } = makeField('f1', 33, 20);
  const round = { ...currentRound(career), circuitId: 'suzuka', sessions: [{ id: 'sprint', type: 'sprint', name: 'Sprint' }] };
  const circuit = getCircuit('suzuka');
  const state = createSession({
    circuit,
    entryList: list,
    kind: 'sprint',
    round,
    grid: list.map((e, i) => ({ driverId: e.driverId, position: i + 1 })),
    settings: { ...DEFAULT_SETTINGS, raceLength: 'corta' },
    seed: 9,
  });
  check('sprint: semáforo inicial', state.phase === 'countdown', `phase=${state.phase}`);
  check('sprint: coches en parrilla', state.cars.length === 20, `n=${state.cars.length}`);
  run(state, 14, fakeInput());
  check('sprint: semáforo apagado', state.lights === 0, `lights=${state.lights}`);
  check('sprint: carrera en marcha', state.phase === 'running' || state.completed, `phase=${state.phase}`);
  run(state, 190, fakeInput());
  const res = endSessionNow(state);
  check('sprint: resultados completos', res.entries.length === 20, `n=${res.entries.length}`);
  check('sprint: menos vueltas que la carrera', state.laps > 0 && state.laps < state.fullLaps, `laps=${state.laps}/${state.fullLaps}`);
  check('sprint: abandonos coherentes', res.entries.every((e) => e.retired === Boolean(e.retireReason)), `retirados=${res.entries.filter((e) => e.retired).length}`);
  check('sprint: posiciones 1..n sin huecos', res.entries.every((e, i) => e.position === i + 1));
  console.log(`       vueltas: ${state.laps} · abandonos: ${res.entries.filter((e) => e.retired).length} · lider: ${res.entries[0].name}`);
}

/* ── Carrera completa con parrilla coming de Q ── */
{
  const { career, list } = makeField('f1', 101);
  const round = { ...currentRound(career), circuitId: 'monza', sessions: [{ id: 'race', type: 'feature', name: 'Carrera' }] };
  const circuit = getCircuit('monza');
  const state = createSession({
    circuit,
    entryList: list,
    kind: 'feature',
    round,
    grid: list.map((e, i) => ({ driverId: e.driverId, position: i + 1 })),
    settings: { ...DEFAULT_SETTINGS, raceLength: 'media' },
    seed: 3,
  });
  const expected = Math.max(3, Math.round(state.fullLaps * 0.22));
  check('carrera: vueltas según longitud', state.laps === expected, `laps=${state.laps} esperado=${expected}`);
  run(state, 120, { steer: 0, throttle: 1, brake: 0, drsPressed: true, edges: {} });
  check('carrera: el jugador avanza', state.player.dist > 100, `dist=${state.player.dist.toFixed(0)}`);
  check('carrera: posiciones fluctuate', state.order.every((c, i) => c.position === i + 1));
  check('carrera: orden coherente', state.order.slice(1).every((c, i) => !state.order[i].retired || c.retired));
  const res = endSessionNow(state);
  check('carrera: resultado con 22', res.entries.length === 22, `n=${res.entries.length}`);
  check('carrera: posición del jugador', typeof res.playerPosition === 'number', `pos=${res.playerPosition}`);
  console.log(`       vueltas: ${state.laps} · lider: ${res.entries[0].name} · jugador P${res.playerPosition}`);
}

console.log(failures === 0 ? '\nTODO OK' : `\n${failures} comprobación(es) fallida(s)`);
process.exit(failures === 0 ? 0 : 1);

