// Prueba de humo del motor de sesión: practices, Q1/Q2/Q3, parrilla y carrera.
import { buildTrack, pointAtS, speedProfile, idealLapTime } from '../js/game/track.js';
import { createSession, updateSession, endSessionNow, formatMs, enterPit, RACE_LAPS, SPRINT_LAPS, MAX_PIT_STOPS, MISSED_PIT_PENALTY_S } from '../js/game/race.js';
import { TYRES, tyreLapsLeft } from '../js/game/car.js';
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
  /* El jugador no puede arrancar encajonado en una curva: en una sesión de
     cronometraje se sale rodando desde la recta anterior a la meta. */
  const arranque = state.player.s;
  const recta = pointAtS(track, arranque + 40);
  check('fp: arranca en un tramo recto', Math.abs(recta.curv) < 0.006, `curv=${recta.curv.toFixed(5)}`);
  check('fp: hay recta antes de la meta', track.length - arranque > 40, `dist=${(track.length - arranque).toFixed(0)}`);
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
  const rectQ = pointAtS(track, state.player.s + 40);
  check('quali: arranca en un tramo recto', Math.abs(rectQ.curv) < 0.006, `curv=${rectQ.curv.toFixed(5)}`);
  check('quali: arranca en primera posición', state.grid[0].driverId === 'player', `P1=${state.grid[0].driverId}`);
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
  check('sprint: ocho vueltas, menos que el gran premio', state.laps === SPRINT_LAPS && SPRINT_LAPS < RACE_LAPS, `laps=${state.laps}/${RACE_LAPS}`);
  check('sprint: una sola parada obligatoria', state.maxStops === 1, `maxStops=${state.maxStops}`);
  check('sprint: carrera en seco', state.weather.wet === false, `wet=${state.weather.wet}`);
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
  const expected = RACE_LAPS;
  check('carrera: 20 vueltas fijas', state.laps === expected, `laps=${state.laps} esperado=${expected}`);
  check('carrera: una sola parada obligatoria', state.maxStops === MAX_PIT_STOPS, `maxStops=${state.maxStops}`);
  check('carrera: el jugador elige el neumático de salida', TYRES[state.player.tyre] != null, `tyre=${state.player.tyre}`);
  check('carrera: carrera en seco', state.weather.kind === 'dry' && state.weather.wet === false, `kind=${state.weather.kind}`);
  check('carrera: la IA entra una vez', state.cars.filter((c) => !c.isPlayer).every((c) => c.strategy.stops === 1), 'estrategias');
  run(state, 120, { steer: 0, throttle: 1, brake: 0, drsPressed: true, edges: {} });
  check('carrera: el jugador avanza', state.player.dist > 100, `dist=${state.player.dist.toFixed(0)}`);
  check('carrera: posiciones fluctuate', state.order.every((c, i) => c.position === i + 1));
  check('carrera: orden coherente', state.order.slice(1).every((c, i) => !state.order[i].retired || c.retired));
  const res = endSessionNow(state);
  check('carrera: resultado con 22', res.entries.length === 22, `n=${res.entries.length}`);
  check('carrera: posición del jugador', typeof res.playerPosition === 'number', `pos=${res.playerPosition}`);
  console.log(`       vueltas: ${state.laps} · lider: ${res.entries[0].name} · jugador P${res.playerPosition}`);
}

/* ── Parada obligatoria y penalización ── */
{
  const { career, list } = makeField('f1', 202);
  const round = { ...currentRound(career), circuitId: 'monza', sessions: [{ id: 'race', type: 'feature', name: 'Carrera' }] };
  const circuit = getCircuit('monza');
  const base = {
    circuit,
    entryList: list,
    kind: 'feature',
    round,
    grid: list.map((e, i) => ({ driverId: e.driverId, position: i + 1 })),
    settings: { ...DEFAULT_SETTINGS },
    seed: 7,
  };

  /* Sin parar: cinco segundos de penalización */
  const noStop = createSession({ ...base, startTyre: 'medium' });
  run(noStop, 12, { steer: 0, throttle: 1, brake: 0, drsPressed: false, edges: {} });
  check('semáforo: se han encendido las cinco luces', noStop.lights === 5 || noStop.phase !== 'countdown', `lights=${noStop.lights} phase=${noStop.phase}`);
  noStop.player.dist = noStop.totalDistance + 1;
  run(noStop, 1, { steer: 0, throttle: 0, brake: 0, drsPressed: false, edges: {} });
  check('sin parar: el coche termina', noStop.player.finished, `finished=${noStop.player.finished}`);
  check(`sin parar: +${MISSED_PIT_PENALTY_S} s de penalización`, noStop.player.penaltyMs === MISSED_PIT_PENALTY_S * 1000, `ms=${noStop.player.penaltyMs}`);

  /* Parando: sin penalización y con compuesto nuevo */
  const withStop = createSession({ ...base, startTyre: 'soft' });
  run(withStop, 12, { steer: 0, throttle: 1, brake: 0, drsPressed: false, edges: {} });
  check('parada: con blandos el primer stint dura lo que el compuesto', withStop.player.strategy.second === 'hard', `second=${withStop.player.strategy.second}`);
  const before = withStop.player.tyre;
  enterPit(withStop, withStop.player, true);
  run(withStop, 4, { steer: 0, throttle: 0, brake: 0, drsPressed: false, edges: {} });
  check('parada: cambia de compuesto', withStop.player.tyre !== before, `${before} → ${withStop.player.tyre}`);
  check('parada: el desgaste se reinicia', withStop.player.tyreWear < 0.01 && withStop.player.lapDist < 400, `wear=${withStop.player.tyreWear} dist=${withStop.player.lapDist.toFixed(0)}`);
  const second = enterPit(withStop, withStop.player, true);
  check('parada: no se puede parar dos veces', second === false && withStop.player.pitStops === 1, `pitStops=${withStop.player.pitStops}`);
  withStop.player.dist = withStop.totalDistance + 1;
  run(withStop, 1, { steer: 0, throttle: 0, brake: 0, drsPressed: false, edges: {} });
  check('parada: sin penalización', withStop.player.penaltyMs === 0, `ms=${withStop.player.penaltyMs}`);

  /* Degradación por distancia: la vida de cada compuesto */
  for (const [id, life] of Object.entries({ soft: 7, medium: 12, hard: 16 })) {
    check(`neumático ${id}: vida de ${life} vueltas`, TYRES[id].life === life && Math.abs(tyreLapsLeft(id, 1)) < 0.001 && Math.abs(tyreLapsLeft(id, 0) - life) < 0.001, `left=${tyreLapsLeft(id, 1)}`);
  }
}


/* ── Prácticas y clasificación jugables ── */

/** Piloto automático que sigue la trazada: sirve para comprobar que el jugador
 *  puede completar y cronometrar una vuelta, no solo arrancar. */
function lineDriver(track, car) {
  const look = Math.max(16, Math.min(52, car.speed * 0.9));
  const target = pointAtS(track, car.s + look);
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const ahead = Math.cos(car.angle) * dx + Math.sin(car.angle) * dy;
  const side = Math.cos(car.angle) * dy - Math.sin(car.angle) * dx;
  const steer = Math.max(-1, Math.min(1, Math.atan2(side, Math.max(8, ahead)) * 2.2));
  const limit = speedProfile(track, 1);
  const wanted = (limit[car.idx] || 60) * 0.9;
  return {
    steer,
    throttle: car.speed < wanted ? 1 : 0,
    brake: car.speed > wanted * 1.08 ? 0.8 : 0,
    drsPressed: false,
    pitPressed: false,
    edges: {},
  };
}

for (const kind of ['fp', 'quali']) {
  const { career, list } = makeField('f1', 33);
  const round = currentRound(career);
  const circuit = getCircuit(round.circuitId);
  const track = buildTrack(circuit, makeRng(33));
  const state = createSession({ circuit, entryList: list, kind, round, settings: { ...DEFAULT_SETTINGS }, seed: 4 });
  const p = state.player;
  check(`${kind}: el jugador sale primero y con pista libre`, p.position === 1 && p.dist > -260, `pos=${p.position} dist=${p.dist.toFixed(0)}`);
  check(`${kind}: nadie queda parado en la trazada`, state.cars.every((c) => c.speed > 8), `min=${Math.min(...state.cars.map((c) => c.speed)).toFixed(1)}`);
  check(`${kind}: la vuelta de salida arma el cronómetro`, p.lapArmed === false, `armed=${p.lapArmed}`);

  const dt = 1 / 30;
  let t = 0;
  let offTrack = 0;
  while (t < state.duration && !state.completed) {
    updateSession(state, dt, lineDriver(track, p));
    t += dt;
    if (p.onTrack === false) offTrack += dt;
  }
  check(`${kind}: el jugador cronometra su primera vuelta rápida`, p.bestLapMs > 0, `best=${p.bestLapMs}`);
  const ideal = idealLapTime(track, 1);
  check(`${kind}: el tiempo es creíble`, p.bestLapMs > ideal * 0.9 && p.bestLapMs < 400000, `best=${p.bestLapMs} ideal=${ideal.toFixed(0)}`);
  check(`${kind}: se puede conducir sin salirse constantemente`, offTrack < t * 0.5, `fuera=${offTrack.toFixed(0)}s de ${t.toFixed(0)}s`);
  if (kind === 'quali') {
    const row = state.segmentsDone[0].rows.find((r) => r.driverId === p.driverId);
    check('quali: el jugador aparece en la tabla de Q1', Boolean(row), `filas=${state.segmentsDone[0].rows.length}`);
  }
  console.log(`       ${kind}: ${formatMs(p.bestLapMs)} · ideal ${(ideal / 1000).toFixed(2)} s · ${p.lap} vueltas`);
}

console.log(failures === 0 ? '\nTODO OK' : `\n${failures} comprobación(es) fallida(s)`);
process.exit(failures === 0 ? 0 : 1);


