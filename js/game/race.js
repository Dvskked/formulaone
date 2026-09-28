// Motor de sesiÃ³n:Practicas, clasificaciÃ³n (Q1/Q2/Q3) y carrera.
// Gestiona parrilla, semÃ¡foro, IA, paradas, banderas,cronometraje y resultados.

import { makeRng } from '../core/rng.js';
import { buildTrack, projectCar, indexAtS, pointAtS, speedProfile, minimap } from './track.js';
import { makeCarState, stepCar, stepAi, applyLaunch, maxSpeed, TYRES, tyreLapsLeft, ERS_CAPACITY } from './car.js';
import { clamp, mod, lerp, dist as dist2d } from '../core/util.js';

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Reglas de carrera â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/** Toda carrera es de 20 vueltas, en F1 y en F2. */
export const RACE_LAPS = 20;
/** El sprint es corto: 8 vueltas. */
export const SPRINT_LAPS = 8;
/** Una sola parada en boxes, es obligatoria. */
export const MAX_PIT_STOPS = 1;
/** Segundos de penalizaciÃ³n por no parar. */
export const MISSED_PIT_PENALTY_S = 5;
/** NeumÃ¡ticos disponibles al salir de boxes. */
export const START_TYRES = ['soft', 'medium', 'hard'];

/** Duraciones jugables (segundos) */

export const DURATIONS = {
  fp: 240,
  sprintQualiSegment: 100,
  quali: [210, 175, 160],
  sprint: 165,
};

/** Pilotos que pasan de cada segmento de clasificaciÃ³n. */
export const QUALI_CUTOFFS = [18, 15, 10];

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ ConstrucciÃ³n â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/**
 * Crea una sesiÃ³n jugable.
 * @param {object} config
 * @param {object} config.circuit definiciÃ³n de circuito (data/circuits.js)
 * @param {Array} config.entryList participantes
 * @param {string} config.kind 'fp' | 'quali' | 'sprint' | 'feature'
 * @param {object} config.round ronda del calendario
 * @param {object} config.settings ajustes del juego
 * @param {number} [config.seed]
 * @param {string} [config.startTyre] compuesto elegido por el jugador
 * @param {object} [config.grid] posiciÃ³n de salida ya conocida (carrera)
 * @param {Array} [config.qualifyingOrder] orden de la Q anterior
 */
export function createSession(config) {
  const { circuit, entryList, kind, round, settings, grid = null, qualifyingOrder = null, seed = 1 } = config;
  const track = buildTrack(circuit);
  const rng = makeRng(`${seed}|${kind}|${round.round}`);
  const series = round.series;
  const weather = makeWeather(circuit);
  const isRace = kind === 'feature' || kind === 'sprint';

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
    lightOffAt: 0,
    safetyCar: { active: false, remaining: 0, queue: [] },
    messages: [],
    fastestLap: { ms: 0, driverId: null },
    flags: { yellow: false, sc: false },
    event: null,
    pitWindowOpen: false,
    pitDistance: Infinity,
    playerPenaltyS: 0,
    maxStops: isRace ? MAX_PIT_STOPS : 2,
    completed: false,
  };

  /* Parrilla: si no hay clasificaciÃ³n previa, se ordena por skill descendente */
  let startOrder = entryList.slice();
  if (grid) {
    const pos = new Map(grid.map((e, i) => [e.driverId, i + 1]));
    startOrder = entryList.slice().sort((a, b) => (pos.get(a.driverId) || 99) - (pos.get(b.driverId) || 99));
  } else if (qualifyingOrder) {
    startOrder = qualifyingOrder.slice();
  } else {
    startOrder = entryList.slice().sort((a, b) => b.skill - a.skill + rng.gauss(0.8));
  }
  const isTimeSession = kind === 'fp' || kind === 'quali' || kind === 'sprintQuali';
  if (isTimeSession) {
    /* En practicas y clasificacion manda el crono: el jugador sale el primero y
       con pista libre. Si no, arranca el ultimo, a casi dos kilometros de la
       linea y detras de 21 coches, y la sesion no se puede jugar. */
    startOrder = startOrder.slice().sort((a, b) => (a.isPlayer ? -1 : 0) - (b.isPlayer ? -1 : 0));
  }
  state.grid = startOrder.map((e, i) => ({ driverId: e.driverId, position: i + 1 }));

  /* Distancia de carrera: 20 vueltas en todos los grandes, 8 en el sprint */
  const laps = kind === 'sprint' ? SPRINT_LAPS : kind === 'feature' ? RACE_LAPS : 0;
  state.laps = laps;
  state.fullLaps = laps;

  /* NeumÃ¡ticos iniciales: el jugador elige en la pantalla previa, la IA con su
     estrategia. En prÃ¡cticas y clasificaciÃ³n se sale siempre con blandos. */
  const defaultTyre = kind === 'feature' || kind === 'sprint' ? 'medium' : 'soft';
  const startTyre = TYRES[config.startTyre] ? config.startTyre : defaultTyre;
  /* Practicas: los coches salen en tres columnas y bien separados, como en una
     sesion real. Carrera y clasificacion: parrilla de dos en dos. */
  const spacing = kind === 'fp' ? 46 : 9.5;
  const lateral = kind === 'fp' ? 3.4 : 1.9;

  state.cars = startOrder.map((entry, i) => {
    const c = makeCarState(track, entry, { grid: i + 1, tyre: startTyre });
    c.gridPosition = i + 1;
    c.rng = rng.fork(`ai-${entry.driverId}`);
    c.strategy = makeStrategy(rng.fork(`strat-${entry.driverId}`), kind, state.laps);
    /* Colocación en pista */
    const back = kind === 'fp' ? -(i * spacing) - 150 : -(i * spacing) - 8;
    const s = mod(back, track.length);
    const p = pointAtS(track, s);
    const lat = kind === 'fp'
      ? [0, -lateral, lateral, -lateral * 2, lateral * 2][i % 5]
      : (i % 2 === 0 ? -lateral : lateral);
    c.x = p.x + p.nx * lat;
    c.y = p.y + p.ny * lat;
    c.lateral = lat;
    c.idx = indexAtS(track, s);
    c.s = s;
    c.dist = back;
    /* En carreras la parrilla está detrás de la línea pero la vuelta 1 empieza
       con la señal. En prácticas y clasificación el primer cruce sí arma el
       cronómetro: si no, la primera vuelta rápida se gasta como vuelta de
       salida y el jugador se queda sin ningún tiempo. */
    c.lap = isRace ? 0 : Math.floor(back / track.length);
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
    c.pitStops = 0;
    c.penaltyMs = 0;
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
    if (!entry.isPlayer) {
      c.skill = entry.skill;
      if (isRace) c.tyre = c.strategy.tyre;
    }
    return c;
  });

  state.player = state.cars.find((c) => c.isPlayer) || null;
  if (state.player) {
    const pitLap = plannedPitLap(state.laps, startTyre);
    state.player.tyre = startTyre;
    state.player.skill = state.player.skill || 78;
    state.player.strategy = {
      stops: state.maxStops,
      tyre: startTyre,
      second: secondTyreFor(state.laps - pitLap),
      pitLap,
    };
  }

  /* Distancia de carrera: 20 vueltas en todos los grandes, 8 en el sprint */
  state.totalDistance = laps > 0 ? laps * track.length : Infinity;
  state.raceDistance = laps > 0 ? (laps * track.length) / 1000 : 0;
  state.entries = entryList;
  state.entryFor = (id) => entryList.find((e) => e.driverId === id) || null;

  /* DuraciÃ³n de la sesiÃ³n */
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

/** Sin gomas de lluvia por ahora: todas las sesiones se disputan en seco. */
function makeWeather(circuit) {
  const air = Math.round(lerp(24, 32, hash01(circuit.id || 'x') * 0.6));
  return {
    kind: 'dry',
    wet: false,
    rain: 0,
    air,
    track: Math.round(air + 8),
    label: 'Seco',
  };
}

/** Semilla estable a partir de un texto, para climas reproducibles. */
function hash01(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/** Vuelta en la que la IA tiene previsto entrar a boxes. */
function plannedPitLap(laps, firstTyre) {
  if (!laps) return 0;
  const life = TYRES[firstTyre].life;
  return clamp(Math.round(laps * 0.45), 2, Math.max(2, Math.min(laps - 3, life)));
}

/**
 * Compuesto con el que se sale tras la Ãºnica parada obligatoria: el mÃ¡s rÃ¡pido
 * que aguante las vueltas que quedan hasta meta.
 */
function secondTyreFor(remainingLaps = 0) {
  const need = Math.max(0, remainingLaps);
  if (need <= TYRES.soft.life) return 'soft';
  if (need <= TYRES.medium.life) return 'medium';
  return 'hard';
}

/**
 * Estrategia de la IA: una sola parada, y el compuesto inicial tiene que llegar
 * hasta esa vuelta sin romperse.
 */
function makeStrategy(rng, kind, laps) {
  if (kind !== 'feature' && kind !== 'sprint') {
    return { stops: 0, tyre: 'soft', second: null, pitLap: 0 };
  }
  const planned = clamp(Math.round(laps * 0.45), 2, Math.max(2, laps - 3));
  /* El primer stint no puede superar la vida del compuesto */
  const pool = START_TYRES.filter((t) => TYRES[t].life >= planned - 1);
  const options = pool.length ? pool : ['medium'];
  const first = rng.weighted(options, (t) => (t === 'medium' ? 6 : t === 'hard' ? 4 : 2));
  const pitLap = clamp(planned, 2, Math.max(2, Math.min(laps - 3, TYRES[first].life)));
  return { stops: 1, tyre: first, second: secondTyreFor(laps - pitLap), pitLap };
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Arranque de cada tipo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function startPractice(state) {
  state.phase = 'running';
  state.clock = 0;
  for (const c of state.cars) {
    const p = pointAtS(state.track, c.s);
    c.angle = Math.atan2(p.dirY, p.dirX);
    /* Todos salen rodando y desparramados: nadie se queda parado en la trazada
       y el jugador no arranca con 21 coches detrás a 150 km/h */
    const roll = c.isPlayer ? 34 : 38 + c.rng.float(0, 14);
    c.speed = roll;
    c.vx = Math.cos(c.angle) * c.speed;
    c.vy = Math.sin(c.angle) * c.speed;
    c.started = true;
    c.lapStartClock = 0;
    c.sectorStart = 0;
  }
  state.messages.push({ text: 'Libres: no hay límite de vueltas. Suelta el acelerador cuando quieras volver al túnel.', kind: 'info' });
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
    /* También en clasificación se sale rodando: parado en la parrilla, el
       jugador solo sufre el tren de coches que le llega detrás */
    const roll = c.isPlayer ? 30 : 34 + c.rng.float(0, 12);
    c.speed = roll;
    c.vx = Math.cos(c.angle) * c.speed;
    c.vy = Math.sin(c.angle) * c.speed;
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
  /* Las cinco luces rojas se encienden una a una: cuando se apagan, todos salen */
  state.lightTimer = 3.2;
  state.lightOffAt = 0;
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
  const tyre = TYRES[state.player?.tyre || 'medium'];
  state.messages.push({
    text: `Parrilla: ${state.cars.length} coches, ${state.laps} vueltas y una parada obligatoria. NeumÃ¡tico ${tyre.name}.`,
    kind: 'start',
  });
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Bucle principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/**
 * Avanza la sesiÃ³n.
 * @param {object} state
 * @param {number} dt segundos reales
 * @param {object|null} input estado de conducciÃ³n del jugador
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
  if (state.lightTimer > 0) return;
  if (state.lights < 5) {
    state.lights += 1;
    /* Entre luz y luz hay algo menos de un segundo, como en la FIA */
    state.lightTimer = 0.75 + state.rng.float(0, 0.45);
    if (state.lights === 5) state.lightTimer = 1.1 + state.rng.float(0, 0.9);
    return;
  }
  /* Las cinco estÃ¡n encendidas: se apagan todas y la carrera sale */
  state.phase = 'green';
  state.greenAt = state.clock;
  state.greenTimer = state.rng.float(0.7, 1.5);
  state.lights = 0;
  state.lightOffAt = state.clock;
  state.startedAt = state.clock;
  state.messages.push({ text: 'Â¡SemÃ¡foro verde! Todos fuera.', kind: 'green' });
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
          text: wasJump ? 'Salida anticipada: penalizaciÃ³n de la FIA.' : 'SemÃ¡foro verde, adelante.',
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
           semÃ¡foro ya pasÃ³ a verde-perdido, quien reaccionÃ³ tarde aÃºn sale */
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

/** Referencias para que la IA se desvÃ­e y defienda. */
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
      /* Solo estorban los coches que estÃ¡n delante y en la misma trazada */
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

/* Un monoplaza mide unos 2 m de ancho: dos coches en fila no estÃ¡n tocÃ¡ndose */
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
    /* Transfer of speed: el que viene por detrÃ¡s pierde, y solo en la medida
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Progreso: vueltas, sectores, banderas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function tickSessionProgress(state, dt) {
  /* Solo las sesiones de clasificaciÃ³n se cortan por tiempo: las carreras y los
     sprints terminan cuando el lÃ­der cruza la meta (vÃ©ase finishRacers) */
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
  pitAdvice(state);

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
        const left = tyreLapsLeft(c.tyre, c.tyreWear);
        state.messages.push({
          text: `Vuelta ${c.lap}/${total} Â· ${formatMs(lapMs)} Â· ${TYRES[c.tyre].name} (${left.toFixed(1)} vueltas)${c.lap === 1 ? ' (vuelta rÃ¡pida)' : ''}`,
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
    /* La parada es obligatoria: el que cruza sin parar pierde cinco segundos */
    if (c.pitStops < state.maxStops) {
      c.penaltyMs = MISSED_PIT_PENALTY_S * 1000;
      c.penaltyAdded = true;
      if (c.isPlayer) {
        state.playerPenaltyS = MISSED_PIT_PENALTY_S;
        state.messages.push({
          text: `Bandera a cuadros sin parar: +${MISSED_PIT_PENALTY_S} s de penalizaciÃ³n en la clasificaciÃ³n.`,
          kind: 'penalty',
        });
      }
    } else if (c.isPlayer) {
      state.messages.push({ text: 'Bandera a cuadros: entras en boxes y terminas la vuelta lenta.', kind: 'finish' });
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
  /* El jugador entra en boxes cuando pulsa P, nunca automÃ¡ticamente */
  if (c.isPlayer) return;
  if (!st || st.stops === 0 || c.retired || c.finished) return;
  const plannedLap = st.pitLap || Math.round(state.laps * 0.45);
  /* Ajuste por Conductividad: los coches rÃ¡pidos entran algo antes */
  const lap = c.lap + (c.skill > 84 ? 0 : c.skill < 74 ? 1 : 0);
  if (lap >= plannedLap && c.pitDone < st.stops && c.dist > trackLapDistance(state)) {
    enterPit(state, c, true);
  }
}

function trackLapDistance(state) {
  return state.track.length * 0.4;
}

/** Avisa al jugador de la parada obligatoria y de la vida que le queda. */
function pitAdvice(state) {
  const p = state.player;
  if (!p || p.retired || p.finished || state.kind !== 'feature' && state.kind !== 'sprint') return;
  if (p.pitStops >= state.maxStops) {
    if (p.pitAdvice !== 'done') {
      p.pitAdvice = 'done';
      state.messages.push({ text: 'Parada hecha. A la vuelta con el compound nuevo.', kind: 'pit' });
    }
    return;
  }
  const left = tyreLapsLeft(p.tyre, p.tyreWear);
  const remaining = Math.max(0, state.laps - p.lap);
  if (left <= 2.2 && remaining > 1) {
    if (p.pitAdvice !== 'now') {
      p.pitAdvice = 'now';
      state.messages.push({ text: `Â¡NeumÃ¡tico al lÃ­mite! Entra en boxes (te quedan ${left.toFixed(1)} vueltas de vida).`, kind: 'pit' });
    }
  } else if (remaining <= 6 && p.pitAdvice !== 'late') {
    p.pitAdvice = 'late';
    state.messages.push({ text: `Quedan ${remaining} vueltas y aÃºn no has parado: penalizaciÃ³n de ${MISSED_PIT_PENALTY_S} s.`, kind: 'penalty' });
  }
}

function maybeMechanical(state, c) {
  if (c.retired || c.finished) return;
  const base = (100 - c.car.reliability) / 100;
  const risk = base * 0.012 * (0.4 + c.damage);
  if (state.rng.next() < risk) {
    retireCar(state, c, 'averÃ­a mecÃ¡nica');
  } else if (c.damage >= 0.92 && state.rng.next() < 0.25) {
    retireCar(state, c, 'daÃ±o irreparable');
  }
}

export function retireCar(state, car, reason) {
  if (car.retired) return;
  car.retired = true;
  car.retireReason = reason;
  car.speed = 0;
  if (car.isPlayer) {
    state.messages.push({ text: `Abandono: ${reason}. Pulsa Intro para volver al menÃº.`, kind: 'dnf' });
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Parada en boxes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export function enterPit(state, car, forced = false) {
  if (car.pitting) return false;
  const maxStops = state.maxStops ?? MAX_PIT_STOPS;
  if (car.pitStops >= maxStops) {
    if (car.isPlayer) {
      state.messages.push({
        text: maxStops === 1 ? 'Solo puedes parar una vez: la parada obligatoria ya estÃ¡ hecha.' : 'No te quedan mÃ¡s paradas en esta sesiÃ³n.',
        kind: 'warn',
      });
    }
    return false;
  }
  if (!forced && car.speed > 34) return false;
  const newTyre = nextTyre(car.strategy, car);
  car.pitting = true;
  car.pitTimerLeft = forced ? 2.6 + state.rng.float(0, 1.2) : 2.2;
  car.pitStops += 1;
  car.pitDone = (car.pitDone || 0) + 1;
  car.pitLap = Math.max(1, Math.floor(car.dist / state.track.length));
  if (car.isPlayer) {
    state.messages.push({ text: `Parada en boxes: montamos ${TYRES[newTyre].name} (vida ${TYRES[newTyre].life} vueltas).`, kind: 'pit' });
  }
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
    car.lapDist = 0;
    car.tyreTemp = 0.3;
  }
}

/* Con una sola parada el compuesto nuevo es el que fija la estrategia. */
function nextTyre(strategy, car) {
  if (!strategy) return car?.isPlayer ? secondTyreFor(0) : 'medium';
  if (car.pitDone <= 1) return strategy.second || secondTyreFor(strategy.tyre);
  return 'soft';
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Entrada del jugador â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function consumeEdgeInput(state, input) {
  if (!input) return;
  if (input.pitPressed) {
    const p = state.player;
    if (p && !p.retired) {
      const near = state.track.pit;
      const d = nearPitDistance(state.track, p.x, p.y);
      if (d < near.halfWidth + 14 || p.speed < 12) enterPit(state, p);
      else state.messages.push({ text: 'Pit stop: acÃ©rcate mÃ¡s a la entrada de boxes.', kind: 'warn' });
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Orden, posiciones y diferencias â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function sortOrder(state) {
  const list = state.cars.slice();
  list.sort((a, b) => {
    if (a.retired !== b.retired) return a.retired ? 1 : -1;
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    /* Quien no parÃ³ pierde cinco segundos depenalizaciÃ³n */
    if (a.finished && b.finished) {
      return a.finishTime + (a.penaltyMs || 0) - (b.finishTime + (b.penaltyMs || 0));
    }
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
    if (ahead && ahead.finished && c.finished) {
      const t = (ahead.finishTime + (ahead.penaltyMs || 0)) - (c.finishTime + (c.penaltyMs || 0));
      c.gaps.ahead = Math.max(0, t);
      c.intervalMs = Math.round(t * 1000);
    } else {
      c.gaps.ahead = ahead ? (ahead.dist - c.dist) / v : 0;
      c.intervalMs = ahead ? Math.round((ahead.dist - c.dist) * 1000 / v) : 0;
    }
    c.gaps.behind = behind ? (c.dist - behind.dist) / Math.max(12, behind.speed) : 0;
  }
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Cierre â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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
    /* La parada es obligatoria: al cerrar la sesiÃ³n se comprueba que todo el
       que haya cruzado meta la haya hecho, y se aplica la penalizaciÃ³n */
    for (const c of state.cars) {
      if (!c.finished || c.pitStops >= state.maxStops) continue;
      c.penaltyMs = MISSED_PIT_PENALTY_S * 1000;
      if (c.isPlayer) state.playerPenaltyS = MISSED_PIT_PENALTY_S;
    }
    sortOrder(state);
    state.order.forEach((c) => { c.classified = c.position; });
    /* El intervalo en carrera es la distancia recorrida; en la clasificaciÃ³n
       final lo que cuenta es el tiempo de meta, y el resto va por intervalos */
    const leader = state.order[0];
    const leaderFinish = (leader.finishTime || state.clock) + (leader.penaltyMs || 0);
    entries = state.order.map((c, i) => {
      const fl = state.fastestLap.driverId === c.driverId ? 1 : 0;
      let gapMs = null;
      if (i === 0) gapMs = 0;
      else if (c.finished && leader.finished) gapMs = Math.round((c.finishTime + (c.penaltyMs || 0) - leaderFinish) * 1000);
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
        penaltyMs: c.penaltyMs || 0,
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
    /* ClasificaciÃ³n final: todos los pilotos, ordenados por el segmento
       mÃ¡s profundo al que llegaron y por su mejor tiempo en Ã©l */
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

/** Obliga a terminar la sesiÃ³n (el jugador pulsa Intro en el podio). */
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

