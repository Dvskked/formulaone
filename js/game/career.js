// Estado de la carrera: perfil del jugador, equipo, calendario, historial,
// buzón, noticias y objetivos. Es el objeto que se guarda en localStorage.

import { makeRng, randomSeed } from '../core/rng.js';
import { SEASON, roundsFor, getRound, TESTING, roundIsComplete, nextPendingSession } from '../data/calendar.js';
import { getTeam, teamsFor, carLevel, carPerformance, staffFor, ownerFor } from '../data/teams.js';
import { F1_DRIVERS, F2_DRIVERS, findDriver, averageRating, driverNationality } from '../data/drivers.js';
import { countryByCode, ageAt, validateBirth, MIN_AGE, MAX_AGE } from '../data/countries.js';
import { buildInbox } from './mail.js';
import { buildNews } from './news.js';
import { buildStandings, playerRow, teamRow, pointsForPosition, scoreSession } from './standings.js';
import { deepClone, clamp, fmtLap } from '../core/util.js';

export const CAREER_VERSION = 3;
export const START_SERIES = 'f2';

/* ───────────────────── Perfil del jugador ───────────────────── */

/** Dorsales disponibles: los de F1/F2 más los reservados para el jugador. */
const PLAYER_NUMBERS = [7, 11, 14, 18, 19, 21, 23, 27, 31, 44, 55, 63, 77, 81, 87, 88, 99];

function pickNumber(series, rng, replacedId) {
  const used = new Set(
    (series === 'f2' ? F2_DRIVERS : F1_DRIVERS).filter((d) => d.id !== replacedId).map((d) => d.number)
  );
  const free = PLAYER_NUMBERS.filter((n) => !used.has(n));
  return free.length ? rng.pick(free) : 99;
}

/** Crea el piloto jugador a partir del formulario de la pantalla de creación. */
export function makeDriver(profile, series, replacedDriver, team) {
  const rng = makeRng(`${profile.name}|${profile.birthDate}|${profile.country}|${series}`);
  const age = ageAt(profile.birthDate, '2026-03-05');
  const country = countryByCode(profile.country);
  /* Código de tres letras al estilo de la FIA: una por nombre y, si no llega,
     se completa con la letra siguiente de cada palabra */
  const words = profile.name.split(/\s+/).filter(Boolean);
  let short = words.map((w) => w[0]).join('');
  for (const w of words) {
    if (short.length >= 3) break;
    for (let i = 1; i < w.length && short.length < 3; i++) short += w[i];
  }
  short = short.replace(/[^\p{L}]/gu, '').slice(0, 3).toUpperCase();
  const base = replacedDriver ? averageRating(replacedDriver.ratings) : 72;
  /* Los puntos de partida suben con la edad, como en la vida real */
  const ageBonus = clamp((age - MIN_AGE) * 0.55, 0, 14);
  const skill = clamp(Math.round(base * 0.62 + ageBonus + rng.gauss(2)), 58, 88);
  const qualiBonus = rng.int(-4, 5);
  return {
    id: 'player',
    name: profile.name.trim(),
    short,
    code: short,
    number: pickNumber(series, rng, replacedDriver?.id),
    country: profile.country,
    flag: country.flag,
    nationality: country.demonym,
    age,
    birthDate: profile.birthDate,
    helmet: { primary: profile.helmetPrimary, secondary: profile.helmetSecondary, style: profile.helmetStyle },
    isPlayer: true,
    replacedId: replacedDriver ? replacedDriver.id : null,
    traits: buildTraits(rng, age),
    ratings: {
      pace: clamp(skill + rng.int(-3, 3), 50, 92),
      braking: clamp(skill + rng.int(-4, 2), 50, 92),
      control: clamp(skill + rng.int(-3, 4), 50, 92),
      consistency: clamp(skill + rng.int(-2, 5), 50, 92),
      racecraft: clamp(skill + rng.int(-5, 3), 50, 92),
      quali: clamp(skill + qualiBonus, 50, 94),
      tyre: clamp(skill + rng.int(-4, 3), 50, 92),
      starts: clamp(skill + rng.int(-6, 3), 50, 92),
      wet: clamp(skill + rng.int(-6, 4), 50, 92),
    },
    potential: clamp(skill + rng.int(8, 20), 70, 97),
    form: 0,
    fatigue: 0,
    morale: 70,
    teamId: team.id,
  };
}

function buildTraits(rng, age) {
  const pool = [
    'Arranque rápido',
    'Frenada tardía',
    'Gestión de neumáticos',
    'Muy fuerte con lluvia',
    'Recupera posiciones',
    'Polivalente',
    'Valiente en los adelantamientos',
    'Frío en la pole',
    'Se complica en el tráfico',
    'Especialista en circuitos',
  ];
  const traits = [];
  const a = rng.pick(pool);
  const b = rng.pick(pool.filter((t) => t !== a));
  traits.push(a, b);
  if (age >= 40) traits.push('Experiencia en boxes');
  if (age <= 19) traits.push('Joven y sin miedo');
  return traits;
}

/* ───────────────────── Creación de carrera ───────────────────── */

/**
 * Fichaje: elige equipo aleatorio de F2 y, opcionalmente, piloto a sustituir.
 * @param {object} profile {name, birthDate, country, helmetPrimary, helmetSecondary, helmetStyle}
 * @param {object} options {series, replaceDriverId, teamId, seed}
 */
export function createCareer(profile, options = {}) {
  const validation = validateBirth(profile.birthDate);
  if (!validation.ok) throw new Error(validation.error);
  if (!profile.name || !profile.name.trim()) throw new Error('Falta el nombre del piloto.');
  const country = countryByCode(profile.country);
  if (!country || country.code === 'INT') throw new Error('País no válido.');

  const series = options.series || START_SERIES;
  const seed = options.seed || randomSeed();
  const rng = makeRng(`${seed}|career`);
  const pool = teamsFor(series);
  /* Un equipo por azar ponderado: los grandes atraen más a los managers */
  const team = options.teamId ? getTeam(options.teamId, series) : rng.weighted(pool, (t) => 40 + t.car.budget * 1.6);

  const roster = (series === 'f2' ? F2_DRIVERS : F1_DRIVERS).filter((d) => d.teamId === team.id);
  let replaced = null;
  if (options.replaceDriverId) {
    replaced = findDriver(options.replaceDriverId, series);
    if (replaced && replaced.teamId !== team.id) replaced = null;
  }
  if (!replaced) {
    /* Si no se elige piloto, el jugador occupies un asiento libre del equipo */
    const free = pool.filter((t) => t.id !== team.id);
    if (free.length && rng.chance(0.12)) {
      return createCareer(profile, { ...options, series, seed: seed + 1, teamId: rng.pick(free).id, replaceDriverId: null });
    }
    replaced = roster.length ? rng.pick(roster) : null;
  }

  const driver = makeDriver(profile, series, replaced, team);
  const entryList = buildEntryList(series, driver);

  const state = {
    version: CAREER_VERSION,
    seed,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    season: SEASON,
    series,
    round: 1,
    phase: 'paddock',
    driver,
    team,
    teamId: team.id,
    entryList,
    removedDriver: replaced ? { id: replaced.id, name: replaced.name, teamId: replaced.teamId, number: replaced.number } : null,
    history: [],
    inbox: [],
    news: [],
    unreadMail: 0,
    unreadNews: 0,
    careerStats: { starts: 0, wins: 0, podiums: 0, poles: 0, points: 0, bestFinish: null, dnfs: 0 },
    objectives: buildObjectives(series, driver),
    pending: null,
    meta: {
      driverName: driver.name,
      driverFlag: driver.flag,
      teamName: team.name,
      teamColor: team.livery.primary,
      series,
      round: 1,
      roundLabel: '',
    },
  };

  refreshDerived(state);
  const round = getRound(state.series, state.round);
  state.inbox = unreadInbox(state, buildInbox(state, round, null));
  state.news = unreadNews(state, buildNews(state, round, null));
  return state;
}

/** Plantilla de objetivos que se muestra en el menú del piloto. */
function buildObjectives(series, driver) {
  if (series === 'f2') {
    return [
      { id: 'o1', text: 'Termina entre los tres primeros del campeonato de F2', kind: 'championship', target: 3, done: false },
      { id: 'o2', text: 'Consigue tu primera pole', kind: 'pole', target: 1, done: false },
      { id: 'o3', text: 'Sube a un equipo de Fórmula 1', kind: 'promotion', target: 1, done: false },
    ];
  }
  return [
    { id: 'o1', text: 'Termina entre los tres primeros del campeonato', kind: 'championship', target: 3, done: false },
    { id: 'o2', text: 'Gana un Gran Premio', kind: 'win', target: 1, done: false },
    { id: 'o3', text: 'Consigue tres poles', kind: 'poles', target: 3, done: false },
  ];
}

/**
 * Lista de participantes de una categoría con el jugador sustituido por su homónimo.
 * @returns {Array} entradas {driverId, name, short, flag, number, teamId, team, isPlayer, ratings, skill}
 */
export function buildEntryList(series, playerDriver) {
  const list = (series === 'f2' ? F2_DRIVERS : F1_DRIVERS)
    .filter((d) => d.id !== playerDriver.replacedId)
    .map((d) => ({
      driverId: d.id,
      name: d.name,
      short: d.short,
      code: d.code,
      flag: d.flag,
      number: d.number,
      country: d.country,
      teamId: d.teamId,
      team: getTeam(d.teamId, series),
      isPlayer: false,
      ratings: d.ratings,
      skill: averageRating(d.ratings),
      traits: d.traits,
      age: d.age,
    }));
  list.push({
    driverId: 'player',
    name: playerDriver.name,
    short: playerDriver.short,
    code: playerDriver.code,
    flag: playerDriver.flag,
    number: playerDriver.number,
    country: playerDriver.country,
    teamId: playerDriver.teamId,
    team: getTeam(playerDriver.teamId, series),
    isPlayer: true,
    ratings: playerDriver.ratings,
    skill: averageRating(playerDriver.ratings),
    traits: playerDriver.traits,
    age: playerDriver.age,
  });
  return list;
}

/** Rival más cercano en la parrilla para los mensajes privados. */
export function rivalsOf(state) {
  return state.entryList
    .filter((e) => !e.isPlayer)
    .sort((a, b) => b.skill - a.skill)
    .slice(0, 5);
}

/* ───────────────────── Datos derivados ───────────────────── */

/** Recalcula standings, meta y contadores a partir del historial. */
export function refreshDerived(state) {
  const table = buildStandings(state.series, state.history, metaFor(state));
  state.standings = {
    drivers: table.drivers,
    teams: table.teams,
    self: playerRow(table, 'player'),
    team: teamRow(table, state.teamId),
    roundsDone: table.roundsDone,
    roundsTotal: table.roundsTotal,
  };
  /* Formato compacto para noticias y correo */
  state.standings.rows = table.drivers.map((d) => ({
    name: d.name,
    flag: d.flag,
    points: d.points,
    wins: d.wins,
    isPlayer: d.driverId === 'player',
  }));
  state.driver.points = state.standings.self?.points || 0;
  state.driver.championship = state.standings.self || null;
  state.meta.round = state.round;
  state.meta.series = state.series;
  state.meta.teamName = state.team.name;
  state.meta.teamColor = state.team.livery.primary;
  state.meta.driverName = state.driver.name;
  state.meta.driverFlag = state.driver.flag;
  state.meta.points = state.driver.points;
  state.meta.position = state.standings.self?.position || null;
  state.updatedAt = new Date().toISOString();
  return state;
}

function metaFor(state) {
  const out = {};
  for (const e of state.entryList) {
    out[e.driverId] = { teamId: e.teamId, name: e.name, flag: e.flag, short: e.short, color: e.team?.livery?.primary };
  }
  return out;
}

/* ───────────────────── Consultas de calendario ───────────────────── */

export function currentRound(state) {
  const list = roundsFor(state.series);
  /* Con la temporada cerrada se sigue viendo la última ronda */
  return getRound(state.series, state.round) || list[list.length - 1] || null;
}

export function calendarFor(state) {
  return roundsFor(state.series);
}

export function isSeasonOver(state) {
  return Boolean(state.seasonOver) || state.round > roundsFor(state.series).length;
}

/** Sesión obligatoria pendiente de la ronda actual. */
export function pendingSession(state) {
  const round = currentRound(state);
  return nextPendingSession(round);
}

export function roundFinished(state) {
  return roundIsComplete(currentRound(state));
}

/** Días hasta el próximo Gran Premio desde una fecha de referencia. */
export function daysToRound(state) {
  const round = currentRound(state);
  const today = state.meta.today || '2026-03-01';
  const target = round.days.sun;
  const a = new Date(`${today}T00:00:00Z`).getTime();
  const b = new Date(`${target}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

export function testingWeeks(series) {
  return TESTING[series] || [];
}

/* ───────────────────── Avanzar en el calendario ───────────────────── */

/**
 * Salta al siguiente evento tras completar todas las sesiones obligatorias.
 * Genera buzón y noticias de la nueva ronda.
 */
export function advanceToNextRound(state) {
  if (!roundFinished(state)) return { ok: false, error: 'Todavía quedan sesiones obligatorias.' };
  const total = roundsFor(state.series).length;
  if (state.round >= total) {
    return finishSeason(state);
  }
  state.round += 1;
  state.phase = 'paddock';
  const round = currentRound(state);
  state.meta.today = round.days.wed;
  state.inbox = unreadInbox(state, buildInbox(state, round, lastSummary(state)));
  state.news = unreadNews(state, buildNews(state, round, lastSummary(state)));
  return { ok: true, round };
}

function lastSummary(state) {
  const prev = state.history[state.history.length - 1];
  if (!prev) return null;
  const main = prev.results.find((r) => r.kind === 'feature');
  if (!main) return null;
  const mine = main.entries.find((e) => e.driverId === 'player');
  const quali = prev.results.find((r) => r.kind === 'quali');
  const myQuali = quali ? quali.entries.find((e) => e.driverId === 'player') : null;
  const scored = scoreSession(main).find((e) => e.driverId === 'player');
  return {
    position: mine ? mine.position : null,
    grid: myQuali ? myQuali.grid : mine ? mine.grid : null,
    pole: Boolean(myQuali && myQuali.position === 1),
    retired: Boolean(mine && mine.dsq),
    bestLapText: mine && mine.bestLapMs ? fmtLap(mine.bestLapMs) : null,
    points: scored ? scored.points : 0,
    corner: mine ? Math.max(1, Math.round(mine.position)) : 6,
  };
}

  /** Fin de temporada: decide si hay ascenso a F1 o título. */
function finishSeason(state) {
  const standings = state.standings;
  const self = standings.self;
  const total = roundsFor(state.series).length;
  const champion = Boolean(self && self.position === 1);
  state.seasonOver = true;
  if (state.series === 'f2') {
    if (champion) {
      state.pending = { kind: 'promotion', text: 'Campeón de Fórmula 2. Hay tres equipos de F1 preguntando por ti.' };
    } else if (self && self.position <= 3) {
      state.pending = { kind: 'promotion', text: `Terminas ${self.position}º en F2. Un equipo de F1 quiere llevarte a la categoría reina.` };
    } else {
      state.pending = { kind: 'f2-stay', text: 'Temporada cerrada sin ascenso. Puedes repetir la temporada con este equipo.' };
    }
  } else {
    state.pending = {
      kind: champion ? 'champion' : 'season-end',
      text: champion ? '¡Campeón del mundo! Temporada cerrada.' : 'Temporada de F1 cerrada.',
    };
  }
  state.meta.roundsTotal = total;
  return { ok: true, seasonOver: true, pending: state.pending };
}

/* ───────────────────── Resultados ───────────────────── */

/** Registra el resultado de una sesión ya resuelta. */
export function recordSession(state, sessionResult) {
  const round = currentRound(state);
  const session = round.sessions.find((s) => s.id === sessionResult.sessionId);
  if (session) {
    session.played = true;
    session.result = sessionResult;
  }
  let entry = state.history.find((h) => h.round === round.round);
  if (!entry) {
    entry = { round: round.round, circuitId: round.circuitId, gp: round.gp, date: round.days.sun, results: [] };
    state.history.push(entry);
  }
  entry.results = entry.results.filter((r) => r.sessionId !== sessionResult.sessionId);
  entry.results.push(sessionResult);
  entry.results.sort((a, b) => a.order - b.order);

  const main = sessionResult.kind === 'feature' ? sessionResult : null;
  /* Las estadísticas se recalculan desde el historial: así volver a jugar una
     sesión ya registrada no duplica starts ni puntos */
  recomputeCareerStats(state);
  if (main) {
    const scored = scoreSession(main);
    const me = scored.find((e) => e.driverId === 'player');
    updateObjectives(state, {
      win: Boolean(me && me.position === 1),
      pole: Boolean(me && me.grid === 1),
      pod: Boolean(me && me.position <= 3),
      position: me ? me.position : null,
    });
  }
  refreshDerived(state);
  state.phase = 'paddock';
  return state;
}

/** Deriva las estadísticas de carrera del historial completo. */
function recomputeCareerStats(state) {
  const stats = { starts: 0, wins: 0, podiums: 0, poles: 0, points: 0, bestFinish: null, dnfs: 0 };
  if (state.careerStats && state.careerStats.f2) stats.f2 = state.careerStats.f2;
  for (const round of state.history) {
    for (const result of round.results) {
      if (result.kind !== 'feature' && result.kind !== 'sprint') continue;
      const me = scoreSession(result).find((e) => e.driverId === 'player');
      if (!me) continue;
      stats.points += me.points;
      if (result.kind !== 'feature') continue;
      stats.starts += 1;
      if (me.position === 1) stats.wins += 1;
      if (me.position <= 3) stats.podiums += 1;
      if (me.grid === 1) stats.poles += 1;
      if (me.dsq || me.position > 10) stats.dnfs += 1;
      if (!stats.bestFinish || me.position < stats.bestFinish) stats.bestFinish = me.position;
    }
  }
  stats.points = Math.round(stats.points * 100) / 100;
  state.careerStats = stats;
  return stats;
}

function updateObjectives(state, { win, pole, pod, position }) {
  const self = state.standings.self;
  for (const o of state.objectives) {
    if (o.kind === 'win' && win) o.done = true;
    if (o.kind === 'pole' && pole) o.done = true;
    if (o.kind === 'podium' && pod) o.done = true;
    /* Objetivos con cantidad: poles, podios, Starts... */
    if (o.kind === 'poles' && pole) {
      o.progress = Math.min(1, ((o.progress || 0) + (o.count || 0) + 1) / o.target);
      o.count = (o.count || 0) + 1;
      o.done = o.count >= o.target;
    }
    if (o.kind === 'podiums' && pod) {
      o.progress = Math.min(1, ((o.progress || 0) + (o.count || 0) + 1) / o.target);
      o.count = (o.count || 0) + 1;
      o.done = o.count >= o.target;
    }
    if (o.kind === 'championship' && self && self.position <= o.target) o.progress = Math.min(1, self.position / o.target);
  }
}

/* ───────────────────── Ascenso a F1 ───────────────────── */

/**
 * Sube al jugador a un equipo de F1. Elige el equipo con mejor hueco
 * y genera el evento de fichaje.
 * @param {string} [f1TeamId] equipo elegido por el jugador
 */
export function promoteToF1(state, f1TeamId = null) {
  if (state.series === 'f1') return { ok: false, error: 'Ya estás en Fórmula 1.' };
  const rng = makeRng(`${state.seed}|promotion|${state.round}`);
  const pool = teamsFor('f1');
  const team = f1TeamId ? getTeam(f1TeamId, 'f1') : rng.weighted(pool, (t) => 20 + t.car.budget * 1.2);

  /* El equipo de F1 sustituye a uno de sus pilotos: se elige el peor clasificado */
  const roster = F1_DRIVERS.filter((d) => d.teamId === team.id);
  const replaced = roster.length ? roster[rng.int(0, roster.length - 1)] : null;

  const oldDriver = state.driver;
  oldDriver.ratingBase = Math.round(averageRating(oldDriver.ratings));
  const driver = {
    ...oldDriver,
    number: pickNumber('f1', rng, replaced ? replaced.id : null),
    teamId: team.id,
    isPromoted: true,
  };
  /* Al subir de categoría el techo baja: hay menos margen para el error */
  const cap = 92;
  for (const k of Object.keys(driver.ratings)) {
    driver.ratings[k] = clamp(driver.ratings[k] + 3, 55, cap);
  }
  driver.potential = clamp(oldDriver.potential, 70, 98);

  state.series = 'f1';
  state.round = 1;
  state.team = team;
  state.teamId = team.id;
  state.driver = driver;
  /* El piloto al que sustituye sale de la lista: si no, la parrilla tendría 23 */
  state.entryList = buildEntryList('f1', { ...driver, replacedId: replaced ? replaced.id : null });
  state.removedDriver = replaced ? { id: replaced.id, name: replaced.name, teamId: replaced.teamId, number: replaced.number } : null;
  state.history = [];
  state.careerStats = { starts: 0, wins: 0, podiums: 0, poles: 0, points: 0, bestFinish: null, dnfs: 0, f2: state.careerStats };
  state.objectives = buildObjectives('f1', driver);
  state.pending = null;
  state.seasonOver = false;
  state.promoted = { at: new Date().toISOString(), from: 'f2', teamId: team.id, teamName: team.name, replaced: replaced?.name || null };
  refreshDerived(state);
  const round = currentRound(state);
  state.meta.today = '2026-03-01';
  state.inbox = unreadInbox(state, buildInbox(state, round, null));
  state.news = unreadNews(state, buildNews(state, round, null));
  return { ok: true, team, replaced };
}

/** Repite la temporada de F2 con el mismo equipo (opción si no hay ascenso). */
export function repeatSeason(state) {
  state.round = 1;
  state.history = [];
  state.seasonOver = false;
  state.pending = null;
  /* Al repetir se reinicia la temporada en curso, pero el historial de F2 se
     conserva dentro de las estadísticas de carrera */
  const previous = state.careerStats.f2 || null;
  state.careerStats = { starts: 0, wins: 0, podiums: 0, poles: 0, points: 0, bestFinish: null, dnfs: 0, ...(previous ? { f2: previous } : {}) };
  state.objectives = buildObjectives(state.series, state.driver);
  refreshDerived(state);
  const round = currentRound(state);
  state.meta.today = '2026-03-01';
  state.inbox = unreadInbox(state, buildInbox(state, round, null));
  state.news = unreadNews(state, buildNews(state, round, null));
  return { ok: true };
}

/* ───────────────────── Buzón y noticias ───────────────────── */

export function refreshInbox(state) {
  state.inbox = unreadInbox(state, buildInbox(state, currentRound(state), lastSummary(state)));
  return state.inbox;
}

export function refreshNews(state) {
  state.news = unreadNews(state, buildNews(state, currentRound(state), lastSummary(state)));
  return state.news;
}

/** Marca todo el buzón como pendiente de lectura y actualiza el contador. */
function unreadInbox(state, list) {
  for (const m of list) m.unread = true;
  state.unreadMail = list.length;
  return list;
}

/** Igual para las noticias de la pantalla de inicio. */
function unreadNews(state, list) {
  for (const n of list) n.unread = true;
  state.unreadNews = list.length;
  return list;
}

export function markMailRead(state, id = null) {
  for (const m of state.inbox) {
    if ((id === null || m.id === id) && m.unread !== false) {
      m.unread = false;
      state.unreadMail = Math.max(0, (state.unreadMail || 0) - 1);
    }
  }
  return state;
}

export function markNewsRead(state, id = null) {
  for (const n of state.news) {
    if ((id === null || n.id === id) && n.unread !== false) {
      n.unread = false;
      state.unreadNews = Math.max(0, (state.unreadNews || 0) - 1);
    }
  }
  return state;
}

/* ───────────────────── Datos para las pantallas ───────────────────── */

export function driverCard(state) {
  return {
    name: state.driver.name,
    short: state.driver.short,
    number: state.driver.number,
    flag: state.driver.flag,
    country: countryByCode(state.driver.country).name,
    nationality: driverNationality(state.driver),
    age: state.driver.age,
    birthDate: state.driver.birthDate,
    helmet: state.driver.helmet,
    traits: state.driver.traits,
    ratings: state.driver.ratings,
    ovr: averageRating(state.driver.ratings),
    potential: state.driver.potential,
    team: state.team,
    series: state.series,
    points: state.driver.points,
    championship: state.standings.self,
  };
}

/**
 * Lista de entrada para la parrilla con el coche actual del jugador.
 * Las entradas guardan una copia del equipo en el momento de crearse, así que
 * sin esto el desarrollo comprado en el garaje no se notaría en pista.
 * @param {object} state estado de carrera
 * @returns {Array<object>}
 */
export function gridEntryList(state) {
  const list = state?.entryList;
  if (!Array.isArray(list)) return [];
  const team = state.team;
  if (!team) return list.slice();
  return list.map((entry) => (entry.teamId === state.teamId ? { ...entry, team } : entry));
}

export function teamCard(state) {
  const staff = staffFor(state.team, state.series);
  return {
    team: state.team,
    series: state.series,
    level: carLevel(state.team, state.series),
    performance: carPerformance(state.team, state.series),
    owner: ownerFor(state.team, state.series),
    principal: staff.principal,
    raceEngineer: staff.raceEngineer,
    chiefMechanic: staff.chiefMechanic,
    championship: state.standings.team,
  };
}

export function carStats(state) {
  const c = state.team.car;
  return [
    { key: 'Potencia', value: c.power },
    { key: 'Aerodinámica', value: c.aero },
    { key: 'Agarre', value: c.grip },
    { key: 'Frenos', value: c.brakes },
    { key: 'Fiabilidad', value: c.reliability },
    { key: 'Presupuesto', value: c.budget },
  ];
}

export { pointsForPosition, deepClone };
