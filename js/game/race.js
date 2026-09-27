// Motor de sesión:Practicas, clasificación (Q1/Q2/Q3) y carrera.
// Gestiona parrilla, semáforo, IA, paradas, banderas,cronometraje y resultados.

import { makeRng } from '../core/rng.js';
import { buildTrack, projectCar, indexAtS, pointAtS, speedProfile, minimap } from './track.js';
import { makeCarState, stepCar, stepAi, applyLaunch, maxSpeed, TYRES, ERS_CAPACITY } from './car.js';
import { clamp, mod, lerp, dist as dist2d } from '../core/util.js';

/* ───────────────────── Duraciones jugables (segundos) ───────────────────── */

export const DURATIONS = {
  fp: 240,
  sprintQualiSegment: 100,
  quali: [210, 175, 160],
  sprint: 165,
};

export const LENGTH_MODES = {
  corta: 0.12,
  media: 0.22,
  larga: 0.4,
  completa: 1,
};
export const LENGTH_LABELS = {
  corta: 'Corta (12 %)',
  media: 'Media (22 %)',
  larga: 'Larga (40 %)',
  completa: 'Completa (100 %)',
};

/** Pilotos que pasan de cada segmento de clasificación. */
export const QUALI_CUTOFFS = [18, 15, 10];

/* ───────────────────── Construcción ───────────────────── */

/**
 * Crea una sesión jugable.
 * @param {object} config
 * @param {object} config.circuit definición de circuito (data/circuits.js)
 * @param {Array} config.entryList participantes
 * @param {string} config.kind 'fp' | 'quali' | 'sprint' | 'feature'
 * @param {object} config.round ronda del calendario
 * @param {object} config.settings ajustes del juego
 * @param {number} [config.seed]
 * @param {object} [config.grid] posición de salida ya conocida (carrera)
 * @param {Array} [config.qualifyingOrder] orden de la Q anterior
 */
export function createSession(config) {
  const { circuit, entryList, kind, round, settings, grid = null, qualifyingOrder = null, seed = 1 } = config;
  const track = buildTrack(circuit);
  const rng = makeRng(`${seed}|${kind}|${round.round}`);
  const series = round.series;
  const weather = makeWeather(circuit, series, rng);

  const state = {
    kind,
    series,
    round,
    track,
    weather,
    settings,
    phase: 'formation',
    clock: 0,
    duration: 0,
    segment: 0,
    segmentsDone: [],
    eliminations: [],
    cars: [],
    player: null,
    order: [],
    grid: [],
    gridSource: grid ? 'quali' : qualifyingOrder ? 'quali' : 'grid',
    laps: 0,
    totalDistance: 0,
    raceDistance: 0,
    finished: false,
    results: null,
    lights: 0,
    lightTimer: 0,
    safetyCar: { active: false, remaining: 0, queue: [] },
    messages: [],
    fastestLap: { ms: 0, driverId: null },
    flags: { yellow: false, sc: false },
    event: null,
    pitWindowOpen: false,
    completed: false,
  };

  /* Parrilla: si no hay clasificación previa, se ordena por skill descendente */
  let startOrder = entryList.slice();
  if (grid) {
    const pos = new Map(grid.map((e, i) => [e.driverId, i + 1]));
    startOrder = entryList.slice().sort((a, b) => (pos.get(a.driverId) || 99) - (pos.get(b.driverId) || 99));
  } else if (qualifyingOrder) {
    startOrder = qualifyingOrder.slice();
  } else {
    startOrder = entryList.slice().sort((a, b) => b.skill - a.skill + rng.gauss(0.8));
  }
  state.grid = startOrder.map((e, i) => ({ driverId: e.driverId, position: i + 1 }));

  /* Neumáticos iniciales según el tipo de sesión */
  const startTyre = kind === 'quali' ? 'soft' : kind === 'fp' ? 'soft' : 'medium';
  const spacing = kind === 'fp' ? 90 : 9.5;
  const lateral = kind === 'fp' ? 0 : 1.9;

  state.cars = startOrder.map((entry, i) => {
    const c = makeCarState(track, entry, { grid: i + 1, tyre: startTyre });
    c.gridPosition = i + 1;
    c.rng = rng.fork(`ai-${entry.driverId}`);
    c.strategy = makeStrategy(rng.fork(`strat-${entry.driverId}`), kind, track);
    /* Colocación en pista */
    const back = kind === 'fp' ? -(i * spacing) - 40 : -(i * spacing) - 6;
    const s = mod(back, track.length);
    const p = pointAtS(track, s);
    const lat = kind === 'fp' ? 0 : (i % 2 === 0 ? -lateral : lateral);
    c.x = p.x + p.nx * lat;
    c.y = p.y + p.ny * lat;
    c.lateral = lat;
    c.idx = indexAtS(track, s);
    c.s = s;
    c.dist = back;
    c.lap = 0;
    c.qualifyingLap = 0;
    c.bestLapMs = 0;
    c.lastLapMs = 0;
    c.lapStartClock = 0;
    c.sectorTimes = [0, 0, 0];
    c.sectorStart = 0;
    c.outLap = true;
    c.sector = 1;
    c.drsAllowed = false;
    c.jumpStart = false;
    c.pitDone = 0;
    c.pitTimerLeft = 0;
    c.pitting = false;
    c.finished = false;
    c.finishTime = 0;
    c.classified = null;
    c.mechanicalRisk = 0;
    c.intro = 1;
    c.lapArmed = kind === 'feature' || kind === 'sprint';
    c.scTarget = null;
    c.qualiHistory = [];
    c.reachedSegment = -1;
    c.eliminatedIn = -1;
    if (!entry.isPlayer) c.skill = entry.skill;
    return c;
  });

  state.player = state.cars.find((c) => c.isPlayer) || null;
  if (state.player) {
    state.player.tyre = startTyre;
    state.player.skill = state.player.skill || 78;
  }

  /* Distancia de carrera según el modo de longitud elegido */
  const mode = LENGTH_MODES[settings?.raceLength] ?? LENGTH_MODES.corta;
  const fullLaps = track.laps;
  state.laps = Math.max(3, Math.round(fullLaps * (kind === 'sprint' ? mode * 0.7 : mode)));
  state.fullLaps = fullLaps;
  state.totalDistance = state.laps * track.length;
  state.raceDistance = state.totalDistance / 1000;
  state.entries = entryList;
  state.entryFor = (id) => entryList.find((e) => e.driverId === id) || null;

  /* Duración de la sesión */
  if (kind === 'fp') state.duration = DURATIONS.fp;
  else if (kind === 'quali') state.duration = DURATIONS.quali[0];
  else if (kind === 'sprintQuali') state.duration = DURATIONS.sprintQualiSegment;
  else state.duration = 0;

  state.speedRef = speedProfile(track, weather.wet ? 0.95 : 1);
  state.line = track.line;
  state.minimap = minimap(track);
  state.rng = rng;

  if (kind === 'fp') startPractice(state);
  else if (kind === 'quali' || kind === 'sprintQuali') startQualifying(state);
  else startRace(state);

  sortOrder(state);
  return state;
}

function makeWeather(circuit, series, rng) {
  const base = circuit.weather || 'dry';
  const wet = base === 'wet' || (base === 'variable' && rng.chance(series === 'f2' ? 0.18 : 0.3));
  const air = Math.round(lerp(wet ? 16 : 24, wet ? 14 : 32, rng.next()));
  return {
    kind: wet ? 'wet' : 'dry',
    wet,
    rain: wet ? clamp(0.35 + rng.next() * 0.5, 0.3, 0.9) : 0,
    air,
    track: Math.round(air + (wet ? 2 : 8)),
    label: wet ? 'Lluvia' : 'Seco',
  };
}

function makeStrategy(rng, kind, track) {
  if (kind === 'quali' || kind === 'fp' || kind === 'sprintQuali') {
    return { stops: 0, tyre: 'soft', second: null, pitLap: 0 };
  }
  const stops = track.laps > 40 ? (rng.chance(0.65) ? 1 : 2) : 1;
  const first = rng.weighted(['soft', 'medium', 'hard'], (t) => (t === 'medium' ? 5 : t === 'soft' ? 3 : 2));
  const pool = first === 'soft' ? ['medium', 'hard'] : first === 'medium' ? ['soft', 'hard'] : ['medium'];
  const second = stops > 1 ? rng.pick(pool) : rng.pick(pool);
  return { stops, tyre: first, second, pitLap: 0, planned: false };
}

/* ───────────────────── Arranque de cada tipo ───────────────────── */

function startPractice(state) {
  state.phase = 'running';
  state.clock = 0;
  for (const c of state.cars) {
    const p = pointAtS(state.track, c.s);
    c.angle = Math.atan2(p.dirY, p.dirX);
    c.speed = c.isPlayer ? 0 : 42 + c.rng.float(0, 12);
    c.vx = Math.cos(c.angle) * c.speed;
    c.vy = Math.sin(c.angle) * c.speed;
    c.started = true;
    c.lapStartClock = 0;
    c.sectorStart = 0;
  }
  state.messages.push({ text: 'Libres: no hay límite de vueltas. Recopila datos y vuelve al túnel.', kind: 'info' });
}

function startQualifying(state) {
  state.phase = 'running';
  state.clock = 0;
  state.segment = 0;
  state.qualifyingRows = state.cars.map((c) => ({
    driverId: c.driverId,
    name: c.name,
    teamId: c.teamId,
    number: c.number,
    flag: c.flag,
    team: c.color,
    car: c,
    bestLapMs: 0,
    position: 0,
    grid: 0,
    eliminated: false,
  }));
  for (const c of state.cars) {
    const p = pointAtS(state.track, c.s);
    c.angle = Math.atan2(p.dirY, p.dirX);
    c.started = true;
    c.lapStartClock = 0;
    c.sectorStart = 0;
  }
  const label = state.kind === 'sprintQuali' ? 'Shootout' : `Q${state.segment + 1}`;
  state.messages.push({ text: `${label}: pasa el corte el mejor tiempo. Tienes ${Math.round(state.duration / 60)} min.`, kind: 'quali' });
}

function startRace(state) {
  state.phase = 'countdown';
  state.lights = 0;
  state.lightTimer = 2.2;
  state.clock = 0;
  const rng = state.rng;
  for (const c of state.cars) {
    const p = pointAtS(state.track, c.s);
    c.angle = Math.atan2(p.dirY, p.dirX);
    c.speed = 0;
    c.vx = 0;
    c.vy = 0;
    c.lapStartClock = 0;
    c.sectorStart = 0;
    c.sector = 1;
    c.reactionRoll = rng.next();
  }
  state.messages.push({ text: `Semáforo de ${state.cars.length} coches. A fondo en el último.`, kind: 'start' });
}

/* ───────────────────── Bucle principal ───────────────────── */

/**
 * Avanza la sesión.
 * @param {object} state
 * @param {number} dt segundos reales
 * @param {object|null} input estado de conducción del jugador
 */
export function updateSession(state, dt, input) {
  if (state.completed) return;
  const { track, settings } = state;
  const isRace = state.kind === 'feature' || state.kind === 'sprint';
  const substeps = clamp(Math.ceil(dt / (1 / 90)), 1, 6);
  const h = dt / substeps;

  for (let k = 0; k < substeps; k++) {
    state.clock += h;
    if (state.phase === 'countdown') tickCountdown(state, h);
    tickCars(state, h, input, isRace);
    if (isRace) tickRaceProgress(state, h);
    else tickSessionProgress(state, h);
  }
  sortOrder(state);
  updateGaps(state);
  consumeEdgeInput(state, input);
}

function tickCountdown(state, dt) {
  state.lightTimer -= dt;
  if (state.lightTimer <= 0) {
    state.lights = Math.min(5, state.lights + 1);
    state.lightTimer = state.lights < 5 ? 0.85 + state.rng.float(0, 0.5) : 0.9;
    if (state.lights >= 5) {
      /* Cinco luces y se apagan */
      state.phase = 'green';
      state.greenAt = state.clock;
      state.greenTimer = state.rng.float(0.7, 1.5);
      state.lights = 0;
    }
  }
}

function tickCars(state, dt, input, isRace) {
  const { track, settings, weather } = state;
  const list = state.cars.filter((c) => !c.retired && !c.finished);
  const refs = buildAiRefs(state);
  const assists = {
    steeringAssist: settings?.steeringAssist ?? 0.4,
    autoDrs: settings?.autoDrs !== false,
  };

  for (const car of list) {
    if (state.phase === 'formation' || state.phase === 'countdown') {
      if (!car.isPlayer) {
        car.speed = 0;
        continue;
      }
      const pg = pointAtS(track, car.s);
      car.x = pg.x + pg.nx * car.lateral;
      car.y = pg.y + pg.ny * car.lateral;
      car.angle = Math.atan2(pg.dirY, pg.dirX);
      car.speed = 0;
      if (input && (input.throttle > 0.2 || input.brake > 0.2) && state.lights >= 5) car.jumpStart = true;
      continue;
    }
    if (car.pitting) {
      tickPit(state, car, dt);
      continue;
    }
    if (car.isPlayer) {
      if (!car.started && state.greenAt != null && state.clock > state.greenAt) {
        const good = Boolean(input && input.throttle > 0.15);
        const wasJump = car.jumpStart;
        applyLaunch(car, track, wasJump ? 0.12 : good ? 1 : 0.4, state.rng);
        car.jumpStart = false;
        car.started = true;
        car.lapStartClock = state.clock;
        car.sectorStart = state.clock;
        state.messages.push({
          text: wasJump ? 'Salida anticipada: penalización de la FIA.' : 'Semáforo verde, adelante.',
          kind: wasJump ? 'penalty' : 'green',
        });
      }
      const proj = projectCar(track, car.x, car.y, car.idx);
      car.proj = proj;
      stepCar(car, { steer: input?.steer || 0, throttle: input?.throttle || 0, brake: input?.brake || 0, drsPressed: Boolean(input?.drsPressed) }, track, proj, {
        dt,
        weather,
        assists,
        autoDrs: assists.autoDrs,
      });
      car.idx = proj.idx;
      car.s = proj.s;
      car.lateral = proj.lateral;
      car.onTrack = proj.onTrack;
      car.kerb = proj.kerb;
      car.dist += car.speed * dt;
      collideWithField(state, car);
    } else {
      const ref = refs.get(car.driverId);
      stepAi(car, {
        dt,
        track,
        line: state.line,
        weather,
        rng: car.rng,
        skill: car.skill,
        scActive: state.safetyCar.active,
        avoiding: ref?.ahead !== undefined,
        avoidLateral: ref?.avoid,
        defendLateral: ref?.defend,
      });
      if (!car.started) {
        const good = car.reactionRoll < 0.22 + car.skill / 430;
        /* La ventana de arranque se mide desde el verde, no por fase: si el
           semáforo ya pasó a verde-perdido, quien reaccionó tarde aún sale */
        const elapsed = state.greenAt == null ? 0 : state.clock - state.greenAt;
        if (elapsed > 0 && (good || elapsed > 1.5)) {
          applyLaunch(car, track, good ? 0.9 : 0.35, car.rng);
          car.started = true;
          car.lapStartClock = state.clock;
          car.sectorStart = state.clock;
        } else {
          car.speed = 0;
        }
        continue;
      }
      car.dist += car.speed * dt;
      collideWithField(state, car);
    }
  }
  if (state.phase === 'green' && state.greenTimer > 0) {
    state.greenTimer -= dt;
    if (state.greenTimer <= 0) state.phase = 'running';
  }
}

/** Referencias para que la IA se desvíe y defienda. */
function buildAiRefs(state) {
  const refs = new Map();
  const live = state.cars.filter((c) => !c.retired && !c.finished && c.started);
  for (const c of live) {
    let avoid = 0;
    let defend = 0;
    let found = false;
    for (const o of live) {
      if (o === c || o.retired) continue;
      const gap = c.dist - o.dist;
      /* Solo estorban los coches que están delante y en la misma trazada */
      const lat = Math.abs(c.lateral - o.lateral);
      if (gap > 0 && gap < 30 && lat < 3.4) {
        found = true;
        const strength = (1 - gap / 30) * (1 - lat / 3.4) * 4.6;
        avoid += (o.lateral > c.lateral ? -1 : 1) * strength;
      } else if (gap < 0 && gap > -16 && lat < 2.6) {
        const strength = (1 + gap / 16) * (1 - lat / 2.6) * 2.4;
        defend += (c.lateral > 0 ? -1 : 1) * strength;
      }
    }
    if (Math.abs(avoid) > 0.1 || Math.abs(defend) > 0.1) refs.set(c.driverId, { avoid, defend, ahead: found });
  }
  return refs;
}

/* Un monoplaza mide unos 2 m de ancho: dos coches en fila no están tocándose */
const CAR_CONTACT = 2.6;

/** Contacts between cars: lateral push, no violent crashes. */
function collideWithField(state, car) {
  for (const other of state.cars) {
    if (other === car || other.retired || other.finished) continue;
    const d = dist2d(car.x, car.y, other.x, other.y);
    if (d > CAR_CONTACT || d < 0.0001) continue;
    const nx = (car.x - other.x) / d;
    const ny = (car.y - other.y) / d;
    const overlap = CAR_CONTACT - d;
    const push = overlap * 0.5;
    car.x += nx * push;
    car.y += ny * push;
    if (!other.isPlayer) {
      other.x -= nx * push * 0.7;
      other.y -= ny * push * 0.7;
    }
    /* Transfer of speed: el que viene por detrás pierde, y solo en la medida
       del solape, para que un tren de coches no frene a todos cada fotograma */
    const closing = car.speed - other.speed;
    if (closing > 3) {
      const loss = Math.min(closing * 0.18, 3.4 * overlap);
      car.speed = Math.max(0, car.speed - loss);
      other.speed = Math.min(maxSpeed(other.car, other.drsOpen), other.speed + loss * 0.25);
      if (car.isPlayer) {
        car.damage = clamp(car.damage + 0.015 * overlap, 0, 1);
        if (car.speed < 6) state.messages.push({ text: 'Toque: cuidado con el coche de al lado.', kind: 'warn' });
      }
    }
  }
}

/* ───────────────────── Progreso: vueltas, sectores, banderas ───────────────────── */

function tickSessionProgress(state, dt) {
  /* Solo las sesiones de clasificación se cortan por tiempo: las carreras y los
     sprints terminan cuando el líder cruza la meta (véase finishRacers) */
  const isQuali = state.kind === 'quali' || state.kind === 'sprintQuali';
  if (state.phase !== 'running') return;

  /* Vueltas cronometradas en ambas modalidades */
  for (const c of state.cars) {
    if (c.retired) continue;
    const lapNow = Math.floor(c.dist / state.track.length);
    if (lapNow <= c.lap) continue;
    c.lap = lapNow;
    if (!c.lapArmed) {
      /* Vuelta de salida: no cuenta */
      c.lapArmed = true;
      c.lapStartClock = state.clock;
      c.sectorStart = state.clock;
      c.sector = 1;
      c.outLap = false;
      continue;
    }
    const lapMs = Math.round((state.clock - c.lapStartClock) * 1000);
    if (lapMs > 4000) {
      c.lastLapMs = lapMs;
      c.qualifyingLap += 1;
      if (isQuali) c.qualiHistory.push({ segment: state.segment, ms: lapMs });
      if (!c.bestLapMs || lapMs < c.bestLapMs) c.bestLapMs = lapMs;
      if (c.isPlayer) {
        const improved = lapMs === c.bestLapMs;
        state.messages.push({
          text: `${isQuali ? 'Vuelta' : 'Vuelta de libres'} ${c.lap}: ${formatMs(lapMs)}${improved ? ' (mejor)' : ''}`,
          kind: improved ? 'good' : 'info',
        });
      }
      if (c.bestLapMs && (!state.fastestLap.ms || c.bestLapMs < state.fastestLap.ms)) {
        state.fastestLap = { ms: c.bestLapMs, driverId: c.driverId, name: c.name };
      }
      c.lapStartClock = state.clock;
      c.sectorStart = state.clock;
      c.sector = 1;
      c.outLap = false;
    }
  }

  if (isQuali) {
    if (state.qualifyingRows && state.clock >= state.duration) closeQualifyingSegment(state);
  } else if (state.kind === 'fp' && state.clock >= state.duration) {
    finishSession(state);
  }
}

function closeQualifyingSegment(state) {
  const { track } = state;
  const rows = state.qualifyingRows.map((r) => {
    const best = r.car.bestLapMs || 0;
    const dist = r.car.retired ? -1 : r.car.dist;
    return { ...r, bestLapMs: best, dist };
  });
  rows.sort((a, b) => {
    if (!a.bestLapMs && !b.bestLapMs) return b.dist - a.dist;
    if (!a.bestLapMs) return 1;
    if (!b.bestLapMs) return -1;
    return a.bestLapMs - b.bestLapMs;
  });
  rows.forEach((r, i) => {
    r.position = i + 1;
  });

  const total = state.cars.filter((c) => !c.retired).length || rows.length;
  const isShootout = state.kind === 'sprintQuali';
  const segments = isShootout ? 2 : 3;
  const current = state.segment;
  /* Cortes reales: Q1 18, Q2 15, Q3 10; Shootout 8 y 8 */
  const cutoff = isShootout ? 8 : QUALI_CUTOFFS[current] || 10;
  const advancing = rows.slice(0, Math.min(cutoff, total));

  state.segmentsDone.push({
    segment: current,
    label: isShootout ? `Shootout ${current + 1}` : `Q${current + 1}`,
    rows: rows.map((r) => ({ ...r, car: undefined, eliminated: !advancing.includes(r) })),
  });

  const eliminated = rows.slice(advancing.length);
  for (const r of eliminated) {
    r.car.eliminated = true;
    r.car.retired = true;
    r.car.retireReason = 'eliminado';
    r.car.eliminatedIn = current;
  }
  for (const r of advancing) r.car.reachedSegment = current;

  if (current + 1 >= segments) {
    const order = advancing.map((r) => state.entryFor(r.driverId)).filter(Boolean);
    finishSession(state, {
      grid: advancing.map((r) => ({ driverId: r.driverId, position: r.position })),
      qualifyingOrder: order,
    });
    return;
  }

  /* Siguiente segmento: solo siguen los clasificados */
  state.qualifyingRows = advancing.slice();
  state.segment = current + 1;
  state.clock = 0;
  state.duration = isShootout ? DURATIONS.sprintQualiSegment : DURATIONS.quali[state.segment];
  for (const r of advancing) {
    r.car.bestLapMs = 0;
    r.car.lap = Math.floor(r.car.dist / track.length);
    r.car.lapArmed = false;
    r.car.lapStartClock = 0;
    r.car.sectorStart = 0;
    r.car.outLap = true;
  }
  state.messages.push({ text: `Corte de ${isShootout ? 'Shootout' : `Q${current + 1}`}: ${eliminated.length} pilotos eliminados.`, kind: 'quali' });
}

function tickRaceProgress(state, dt) {
  const { track } = state;
  if (state.phase === 'formation' || state.phase === 'countdown') return;

  for (const c of state.cars) {
    if (c.retired) continue;

    /* Vuelta completada */
    const lapNow = Math.floor(Math.max(0, c.dist) / track.length);
    if (lapNow > c.lap) {
      c.lap = lapNow;
      const lapMs = Math.round((state.clock - c.lapStartClock) * 1000);
      c.lastLapMs = lapMs;
      if (!c.bestLapMs || lapMs < c.bestLapMs) c.bestLapMs = lapMs;
      if (c.bestLapMs && (!state.fastestLap.ms || c.bestLapMs < state.fastestLap.ms)) {
        state.fastestLap = { ms: c.bestLapMs, driverId: c.driverId, name: c.name };
      }
      c.lapStartClock = state.clock;
      c.sectorStart = state.clock;
      c.sector = 1;
      if (c.isPlayer) {
        const total = state.laps;
        state.messages.push({
          text: `Vuelta ${c.lap}/${total} · ${formatMs(lapMs)}${c.lap === 1 ? ' (vuelta rápida)' : ''}`,
          kind: c.bestLapMs === lapMs ? 'good' : 'info',
        });
        if (state.safetyCar.active) state.messages.push({ text: 'Cierre del coche de seguridad. Acelera.', kind: 'sc' });
      }
      aiPitLogic(state, c);
      maybeMechanical(state, c);
    }

    /* Bandera a cuadros */
    if (!c.finished && c.dist >= state.totalDistance) {
      c.finished = true;
      c.finishTime = state.clock;
      c.classified = c.position;
      if (c.isPlayer) {
        state.messages.push({ text: 'Bandera a cuadros. Entra en boxes y termina la vuelta lenta.', kind: 'finish' });
      }
    }

    /* IA: una vez finishes, circulates at slower pace */
    if (c.finished && !c.isPlayer) {
      c.speed = Math.min(c.speed, 42);
    }
  }

  if (state.safetyCar.active) {
    state.safetyCar.remaining -= dt;
    for (const c of state.cars) {
      if (c.retired || c.finished) continue;
      c.scTarget = 22 + (c.skill - 70) / 12;
    }
    if (state.safetyCar.remaining <= 0) {
      exitSafetyCar(state);
      for (const c of state.cars) c.scTarget = null;
    }
  }

  if (state.player && state.player.finished && state.clock - state.player.finishTime > 22) finishSession(state);
  if (state.order.every((c) => c.retired || c.finished) && state.clock > 6) finishSession(state);
  if (!state.safetyCar.active && state.cars.filter((c) => !c.retired).length === 0) finishSession(state);
}

function aiPitLogic(state, c) {
  const st = c.strategy;
  if (!st || st.stops === 0 || c.retired || c.finished) return;
  const plannedLap = Math.round(state.laps * (0.42 + (c.skill - 70) / 220));
  const lap = c.lap;
  if (lap >= plannedLap && c.pitDone < st.stops && c.dist > trackLapDistance(state)) {
    enterPit(state, c, true);
  }
}

function trackLapDistance(state) {
  return state.track.length * 0.4;
}

function maybeMechanical(state, c) {
  if (c.retired || c.finished) return;
  const base = (100 - c.car.reliability) / 100;
  const risk = base * 0.012 * (0.4 + c.damage);
  if (state.rng.next() < risk) {
    retireCar(state, c, 'avería mecánica');
  } else if (c.damage >= 0.92 && state.rng.next() < 0.25) {
    retireCar(state, c, 'daño irreparable');
  }
}

export function retireCar(state, car, reason) {
  if (car.retired) return;
  car.retired = true;
  car.retireReason = reason;
  car.speed = 0;
  if (car.isPlayer) {
    state.messages.push({ text: `Abandono: ${reason}. Pulsa Intro para volver al menú.`, kind: 'dnf' });
    state.playerOut = true;
  } else {
    state.messages.push({ text: `${car.name} abandona (${reason}).`, kind: 'other' });
  }
  checkSafetyCar(state, car);
}

function checkSafetyCar(state, culprit) {
  if (state.kind !== 'feature' && state.kind !== 'sprint') return;
  if (state.safetyCar.active) return;
  const live = state.cars.filter((c) => !c.retired && !c.finished && c.dist > 0);
  if (live.length < 6) return;
  const near = live.filter((c) => Math.abs(c.dist - culprit.dist) < 260);
  if (near.length >= 3 && state.rng.chance(0.65)) {
    deploySafetyCar(state);
  }
}

export function deploySafetyCar(state) {
  state.safetyCar.active = true;
  state.safetyCar.remaining = 42 + state.rng.float(0, 22);
  state.flags.sc = true;
  state.flags.yellow = false;
  state.messages.push({ text: 'BANDERA AMARILLA - COCHE DE SEGURIDAD EN PISTA', kind: 'sc' });
}

function exitSafetyCar(state) {
  state.safetyCar.active = false;
  state.flags.sc = false;
  state.messages.push({ text: 'Pista verde. Se reanuda la carrera.', kind: 'green' });
}

/* ───────────────────── Parada en boxes ───────────────────── */

export function enterPit(state, car, forced = false) {
  if (car.pitting || car.pitStops >= 3) return false;
  if (!forced && car.speed > 34) return false;
  car.pitting = true;
  car.pitTimerLeft = forced ? 2.6 + state.rng.float(0, 1.2) : 2.2;
  car.pitStops += 1;
  car.pitDone = (car.pitDone || 0) + 1;
  car.pitLap = Math.max(1, Math.floor(car.dist / state.track.length));
  if (car.isPlayer) state.messages.push({ text: 'Parada en boxes: cambio de neumáticos.', kind: 'pit' });
  return true;
}

function tickPit(state, car, dt) {
  car.pitTimerLeft -= dt;
  car.speed = Math.min(car.speed, 22.2);
  /* Se sigue el trazado real de la calle de boxes, no un offset fijo */
  const path = state.track.pit.path;
  let target = path[0];
  let best = Infinity;
  for (const q of path) {
    const d = (q.x - car.x) * (q.x - car.x) + (q.y - car.y) * (q.y - car.y);
    if (d < best) {
      best = d;
      target = q;
    }
  }
  const k = Math.min(1, dt * 5);
  car.x = lerp(car.x, target.x, k);
  car.y = lerp(car.y, target.y, k);
  car.angle = Math.atan2(target.y - car.y, target.x - car.x);
  car.vx = Math.cos(car.angle) * car.speed;
  car.vy = Math.sin(car.angle) * car.speed;
  car.inPit = true;
  if (car.pitTimerLeft <= 0) {
    car.pitting = false;
    car.inPit = false;
    car.tyre = nextTyre(car.strategy, car);
    car.tyreWear = 0;
    car.tyreAge = 0;
    car.tyreTemp = 0.3;
  }
}

function nextTyre(strategy, car) {
  if (!strategy) return 'medium';
  if (car.pitDone <= 1) return strategy.second || 'medium';
  return 'soft';
}

/* ───────────────────── Entrada del jugador ───────────────────── */

function consumeEdgeInput(state, input) {
  if (!input) return;
  if (input.pitPressed) {
    const p = state.player;
    if (p && !p.retired) {
      const near = state.track.pit;
      const d = nearPitDistance(state.track, p.x, p.y);
      if (d < near.halfWidth + 14 || p.speed < 12) enterPit(state, p);
      else state.messages.push({ text: 'Pit stop: acércate más a la entrada de boxes.', kind: 'warn' });
    }
  }
  if (input.rescue) {
    const p = state.player;
    if (p && !p.retired) rescue(state, p);
  }
}

function nearPitDistance(track, x, y) {
  let best = Infinity;
  for (const q of track.pit.path) {
    const d = dist2d(x, y, q.x, q.y);
    if (d < best) best = d;
  }
  return best;
}

export function rescue(state, car) {
  const track = state.track;
  const s = mod(car.dist, track.length);
  const idx = indexAtS(track, s);
  const p = track.points[idx];
  car.x = p.x;
  car.y = p.y;
  car.lateral = 0;
  car.vx = 0;
  car.vy = 0;
  car.speed = Math.min(car.speed, 22);
  car.angle = Math.atan2(p.dirY, p.dirX);
  car.damage = clamp(car.damage * 0.5, 0, 1);
  if (car.isPlayer) state.messages.push({ text: 'Coche recuperado por el equipo de seguridad.', kind: 'info' });
}

/* ───────────────────── Orden, posiciones yolded gaps ───────────────────── */

function sortOrder(state) {
  const list = state.cars.slice();
  list.sort((a, b) => {
    if (a.retired !== b.retired) return a.retired ? 1 : -1;
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    return b.dist - a.dist;
  });
  list.forEach((c, i) => {
    c.position = i + 1;
  });
  state.order = list;
}

function updateGaps(state) {
  const list = state.order.filter((c) => !c.retired);
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const ahead = i > 0 ? list[i - 1] : null;
    const behind = i < list.length - 1 ? list[i + 1] : null;
    const v = Math.max(12, c.speed);
    c.gaps.ahead = ahead ? (ahead.dist - c.dist) / v : 0;
    c.gaps.behind = behind ? (c.dist - behind.dist) / Math.max(12, behind.speed) : 0;
    c.intervalMs = ahead ? Math.round((ahead.dist - c.dist) * 1000 / v) : 0;
  }
}

/* ───────────────────── Cierre ───────────────────── */

function finishSession(state, extra = {}) {
  if (state.completed) return;
  state.completed = true;
  state.phase = 'finished';
  if (state.safetyCar.active) exitSafetyCar(state);

  const isRace = state.kind === 'feature' || state.kind === 'sprint';
  if (extra.grid) state.grid = extra.grid;
  const grid = state.grid || [];
  const gridPosOf = new Map(grid.map((g) => [g.driverId, g.position]));

  let entries;
  if (isRace) {
    /* El intervalo en carrera es la distancia recorrida; en la clasificación
       final lo que cuenta es el tiempo de meta, y el resto va por intervalos */
    const leader = state.order[0];
    const leaderFinish = leader.finishTime || state.clock;
    entries = state.order.map((c, i) => {
      const fl = state.fastestLap.driverId === c.driverId ? 1 : 0;
      let gapMs = null;
      if (i === 0) gapMs = 0;
      else if (c.finished && leader.finished) gapMs = Math.round((c.finishTime - leaderFinish) * 1000);
      else if (!c.retired) gapMs = c.intervalMs;
      return {
        driverId: c.driverId,
        teamId: c.teamId,
        name: c.name,
        short: c.short,
        number: c.number,
        flag: c.flag,
        color: c.color,
        team: c.teamId,
        position: i + 1,
        grid: gridPosOf.get(c.driverId) || c.gridPosition,
        laps: c.lap,
        bestLapMs: c.bestLapMs,
        lastLapMs: c.lastLapMs,
        fastestLap: Boolean(fl),
        pitStops: c.pitStops,
        tyre: c.tyre,
        dsq: c.retired,
        retired: c.retired,
        retireReason: c.retireReason,
        finished: c.finished,
        gapMs,
      };
    });
  } else if (state.kind === 'fp') {
    const rows = state.cars
      .slice()
      .sort((a, b) => (b.bestLapMs || Infinity) - (a.bestLapMs || Infinity) || a.dist - b.dist);
    entries = rows.map((c, i) => ({
      driverId: c.driverId,
      teamId: c.teamId,
      name: c.name,
      short: c.short,
      number: c.number,
      flag: c.flag,
      color: c.color,
      position: i + 1,
      grid: 0,
      bestLapMs: c.bestLapMs,
      lastLapMs: c.lastLapMs,
      laps: c.lap,
      fastestLap: state.fastestLap.driverId === c.driverId,
      pitStops: c.pitStops,
      dsq: !c.bestLapMs,
    }));
  } else {
    /* Clasificación final: todos los pilotos, ordenados por el segmento
       más profundo al que llegaron y por su mejor tiempo en él */
    const last = state.segmentsDone[state.segmentsDone.length - 1];
    const gridPos = new Map((last?.rows || []).slice(0, 10).map((r) => [r.driverId, r.position]));
    const rows = state.cars.slice().sort((a, b) => {
      const sa = a.reachedSegment;
      const sb = b.reachedSegment;
      if (sa !== sb) return sb - sa;
      const ta = a.bestLapMs || (a.qualiHistory.length ? Math.min(...a.qualiHistory.map((h) => h.ms)) : 0) || Infinity;
      const tb = b.bestLapMs || (b.qualiHistory.length ? Math.min(...b.qualiHistory.map((h) => h.ms)) : 0) || Infinity;
      return ta - tb;
    });
    entries = rows.map((c, i) => ({
      driverId: c.driverId,
      teamId: c.teamId,
      name: c.name,
      short: c.short,
      number: c.number,
      flag: c.flag,
      color: c.color,
      position: i + 1,
      grid: gridPos.get(c.driverId) || 0,
      bestLapMs: c.bestLapMs,
      lastLapMs: c.lastLapMs,
      fastestLap: state.fastestLap.driverId === c.driverId,
      pitStops: 0,
      dsq: !c.bestLapMs && !c.qualiHistory.length,
      eliminated: c.reachedSegment < (state.segmentsDone.length - 1),
      segment: c.reachedSegment + 1,
    }));
  }

  state.results = {
    sessionId: state.round.sessions.find((s) => s.type === state.kind || (state.kind === 'feature' && s.type === 'feature'))?.id || state.kind,
    kind: state.kind,
    order: 0,
    entries,
    fastestLapDriverId: state.fastestLap.driverId,
    fastestLapMs: state.fastestLap.ms,
    playerPosition: entries.find((e) => e.driverId === 'player')?.position || null,
    playerGrid: gridPosOf.get('player') || null,
    laps: state.laps,
    weather: state.weather,
    retired: state.playerOut ? true : entries.find((e) => e.driverId === 'player')?.dsq || false,
    ...extra,
  };
}

/** Obliga a terminar la sesión (el jugador pulsa Intro en el podio). */
export function endSessionNow(state) {
  finishSession(state);
  return state.results;
}

export function formatMs(ms) {
  if (!ms || ms <= 0) return '--.---';
  const s = ms / 1000;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${String(Math.floor(ms % 1000)).padStart(3, '0')}`;
}

export { TYRES, ERS_CAPACITY };
