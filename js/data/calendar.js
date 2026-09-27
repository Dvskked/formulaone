// Calendarios oficiales de la temporada 2026 de Fórmula 1 y de Fórmula 2.
// Fechas reales publicadas por la FIA: 23 Grandes Premios en F1 y 14 rondas en F2.
// Bahrain y Arabia Saudí se caen de la F1 de 2026 y ambos fichajes pasan a la F2.
// Fuente: calendarsporting de la FIA y formula1.com/en/racing/2026.

import { getCircuit } from './circuits.js';
import { addDays } from '../core/util.js';

export const SEASON = 2026;

export const SERIES = {
  f1: { id: 'f1', name: 'Fórmula 1', short: 'F1', flag: '🏎️' },
  f2: { id: 'f2', name: 'Fórmula 2', short: 'F2', flag: '🏁' },
};

/** Tabla de puntos 2026 (idéntica a 2025): 25-18-15-12-10-8-6-4-2-1 + vuelta rápida. */
export const POINTS_TABLE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const FASTEST_LAP_POINT = 1;

/* ─────────────────── F1 2026: 23 Grandes Premios ─────────────────── */

const F1_BASE = [
  ['albert-park', 'Australian Grand Prix', '2026-03-06', false],
  ['shanghai', 'Chinese Grand Prix', '2026-03-13', true],
  ['suzuka', 'Japanese Grand Prix', '2026-03-27', false],
  ['miami', 'Miami Grand Prix', '2026-05-01', true],
  ['montreal', 'Canadian Grand Prix', '2026-05-22', true],
  ['monaco', 'Monaco Grand Prix', '2026-06-05', false],
  ['barcelona', 'Barcelona-Catalunya Grand Prix', '2026-06-12', false],
  ['spielberg', 'Austrian Grand Prix', '2026-06-26', false],
  ['silverstone', 'British Grand Prix', '2026-07-03', true],
  ['spa', 'Belgian Grand Prix', '2026-07-17', false],
  ['hungaroring', 'Hungarian Grand Prix', '2026-07-24', false],
  ['zandvoort', 'Dutch Grand Prix', '2026-08-21', true],
  ['monza', 'Italian Grand Prix', '2026-09-04', false],
  ['madring', 'Spanish Grand Prix', '2026-09-11', false],
  ['baku', 'Azerbaijan Grand Prix', '2026-09-24', false],
  ['sepang', 'Malaysian Grand Prix', '2026-10-02', false],
  ['marina-bay', 'Singapore Grand Prix', '2026-10-09', true],
  ['cota', 'United States Grand Prix', '2026-10-23', false],
  ['mexico', 'Mexico City Grand Prix', '2026-10-30', false],
  ['interlagos', 'São Paulo Grand Prix', '2026-11-06', false],
  ['las-vegas', 'Las Vegas Grand Prix', '2026-11-19', false],
  ['lusail', 'Qatar Grand Prix', '2026-11-27', false],
  ['yas-marina', 'Abu Dhabi Grand Prix', '2026-12-04', false],
];

/* ─────────────────── F2 2026: 14 rondas ─────────────────── */

const F2_BASE = [
  ['albert-park', 'Melbourne', '2026-03-06'],
  ['miami', 'Miami', '2026-05-01'],
  ['montreal', 'Montréal', '2026-05-22'],
  ['monaco', 'Monte-Carlo', '2026-06-04'],
  ['barcelona', 'Barcelona', '2026-06-12'],
  ['spielberg', 'Spielberg', '2026-06-26'],
  ['silverstone', 'Silverstone', '2026-07-03'],
  ['spa', 'Spa-Francorchamps', '2026-07-17'],
  ['hungaroring', 'Budapest', '2026-07-24'],
  ['monza', 'Monza', '2026-09-04'],
  ['madring', 'Madrid', '2026-09-11'],
  ['baku', 'Baku', '2026-09-24'],
  ['lusail', 'Lusail', '2026-11-27'],
  ['yas-marina', 'Yas Marina', '2026-12-04'],
];

/* ─────────────────── Estructura de fin de semana ─────────────────── */

/**
 * F1 sin sprint:  Jue FP1 · Vie FP2 · Sáb FP3 + Q1/Q2/Q3 · Dom Carrera
 * F1 con sprint:   Jue FP1 · Vie FP2 + Shootout · Sáb Sprint + Q1/Q2/Q3 · Dom Carrera
 * F2:              Jue FP1 · Vie FP2 · Sáb Q1/Q2 · Dom Sprint + Carrera
 */
const SESSION_TYPES = {
  fp: { kind: 'fp', required: false, segments: 0 },
  sprint: { kind: 'sprint', required: true, segments: 0 },
  sprintQuali: { kind: 'sprintQuali', required: true, segments: 2 },
  quali: { kind: 'quali', required: true, segments: 3 },
  feature: { kind: 'feature', required: true, segments: 0 },
};

function session(id, name, day, date, minutes, type) {
  const meta = SESSION_TYPES[type];
  return {
    id,
    name,
    short: name.replace('Libres', 'FP'),
    day,
    date,
    minutes,
    type: meta.kind,
    required: meta.required,
    segments: meta.segments,
    played: false,
    result: null,
  };
}

function buildWeekend(series, circuitId, gpName, sunday, sprint) {
  const thu = addDays(sunday, -3);
  const fri = addDays(sunday, -2);
  const sat = addDays(sunday, -1);
  const circuit = getCircuit(circuitId);
  const sessions = [];

  if (series === 'f2') {
    sessions.push(session('fp1', 'Libres 1', 'thu', thu, 45, 'fp'));
    sessions.push(session('fp2', 'Libres 2', 'fri', fri, 45, 'fp'));
    sessions.push(session('quali', 'Clasificación', 'sat', sat, 25, 'quali'));
    sessions.push(session('sprint', 'Carrera Sprint', 'sun', sunday, 45, 'sprint'));
    sessions.push(session('feature', 'Carrera Principal', 'sun', sunday, 70, 'feature'));
  } else if (sprint) {
    sessions.push(session('fp1', 'Libres 1', 'thu', thu, 60, 'fp'));
    sessions.push(session('fp2', 'Libres 2', 'fri', fri, 45, 'fp'));
    sessions.push(session('sprintQuali', 'Shootout', 'fri', fri, 15, 'sprintQuali'));
    sessions.push(session('sprint', 'Carrera Sprint', 'sat', sat, 25, 'sprint'));
    sessions.push(session('quali', 'Clasificación', 'sat', sat, 25, 'quali'));
    sessions.push(session('race', 'Gran Premio', 'sun', sunday, 120, 'feature'));
  } else {
    sessions.push(session('fp1', 'Libres 1', 'thu', thu, 60, 'fp'));
    sessions.push(session('fp2', 'Libres 2', 'fri', fri, 60, 'fp'));
    sessions.push(session('fp3', 'Libres 3', 'sat', sat, 30, 'fp'));
    sessions.push(session('quali', 'Clasificación', 'sat', sat, 25, 'quali'));
    sessions.push(session('race', 'Gran Premio', 'sun', sunday, 120, 'feature'));
  }

  return {
    circuitId,
    circuit,
    gp: gpName,
    sprint,
    days: { thu, fri, sat, sun: sunday },
    sessions,
  };
}

function buildRounds(series, base) {
  return base.map((row, i) => {
    const [circuitId, gp, sunday, sprint] = row;
    return {
      series,
      round: i + 1,
      circuitId,
      circuit: getCircuit(circuitId),
      country: getCircuit(circuitId).country,
      flag: getCircuit(circuitId).flag,
      gp: gp,
      sprint: Boolean(sprint),
      ...buildWeekend(series, circuitId, gp, sunday, Boolean(sprint)),
    };
  });
}

export const F1_ROUNDS = buildRounds('f1', F1_BASE);
export const F2_ROUNDS = buildRounds('f2', F2_BASE);

/** Fechas de los tests de pretemporada de 2026. */
export const TESTING = {
  f1: [
    { name: 'Tests 1', circuitId: 'sakhir', from: '2026-02-11', to: '2026-02-13' },
    { name: 'Tests 2', circuitId: 'sakhir', from: '2026-02-18', to: '2026-02-20' },
  ],
  f2: [{ name: 'Tests de F2', circuitId: 'barcelona', from: '2026-02-17', to: '2026-02-19' }],
};

/* ─────────────────── Consultas ─────────────────── */

const BY_SERIES = { f1: F1_ROUNDS, f2: F2_ROUNDS };

export function roundsFor(series) {
  return BY_SERIES[series] || F1_ROUNDS;
}

export function roundCount(series) {
  return roundsFor(series).length;
}

export function getRound(series, roundNumber) {
  return roundsFor(series)[Math.max(0, Math.min(roundsFor(series).length - 1, roundNumber - 1))];
}

export function findRoundByCircuit(series, circuitId) {
  return roundsFor(series).find((r) => r.circuitId === circuitId) || null;
}

/** Sesión obligatoria o opcional más próxima que el jugador aún no ha corrido. */
export function nextPendingSession(round) {
  return round.sessions.find((s) => !s.played && s.required) || null;
}

export function firstOptionalSession(round) {
  return round.sessions.find((s) => !s.played && !s.required) || null;
}

export function roundRaceSession(round) {
  return round.sessions.find((s) => s.type === 'feature') || null;
}

export function roundIsComplete(round) {
  return round.sessions.filter((s) => s.required).every((s) => s.played);
}

/** Etiqueta corta de fin de semana: "6–8 MAR". */
export function weekendLabel(round) {
  const { fri, sun } = round.days;
  const month = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'][
    new Date(`${sun}T00:00:00Z`).getUTCMonth()
  ];
  return `${fri.slice(8, 10)}–${sun.slice(8, 10)} ${month}`;
}

/** Etiqueta del tipo de carrera que se corre: "Gran Premio", "Carrera Principal"... */
export function mainSessionName(round) {
  return round.series === 'f2' ? 'Carrera Principal' : 'Gran Premio';
}
