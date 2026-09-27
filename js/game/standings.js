// Campeonato: puntos, clasificaciones de pilotos y equipos e historial de podios.
// Todo se deriva de un array de resultados ya calculados, de modo que la simulación
// de las IA y los resultados del jugador se mezclan sin código especial.

import { POINTS_TABLE, FASTEST_LAP_POINT, roundsFor } from '../data/calendar.js';
import { teamsFor } from '../data/teams.js';

/**
 * Un resultado de sesión (carrera o sprint) ya ordenado por posición.
 * @typedef {{entries: Array<{driverId:string,teamId:string,position:number,lapMs:number,
 *   bestLapMs:number,grid:number,fastestLap:boolean,pitStops:number,dsq?:boolean}>,
 *   fastestLapDriverId?:string}} SessionResult
 */

export function pointsForPosition(position) {
  if (position < 1) return 0;
  return POINTS_TABLE[position - 1] || 0;
}

/** Añade el punto de vuelta rápida al piloto que la hizo, si positions vale. */
export function scoreSession(result) {
  const out = [];
  let fastestGiven = false;
  for (const e of result.entries) {
    let pts = e.dsq ? 0 : pointsForPosition(e.position);
    if (!e.dsq && e.fastestLap && !fastestGiven) {
      pts += FASTEST_LAP_POINT;
      fastestGiven = true;
    }
    out.push({ ...e, points: pts });
  }
  return out;
}

export function gridString(position) {
  return position === 1 ? 'pole' : `P${position}`;
}

/* ─────────────────────── Clasificaciones ─────────────────────── */

function buildTable(rows) {
  return rows
    .map((r) => ({ ...r, points: Math.round(r.points * 100) / 100 }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins || b.podiums - a.podiums || b.best - a.best);
}

/**
 * Construye las clasificaciones de championship a partir del historial.
 * @param {string} series
 * @param {Array<{round:number, results: SessionResult[], driverMeta:Object}>} history
 */
export function buildStandings(series, history, driversMeta) {
  const rows = new Map();
  for (const [id, meta] of Object.entries(driversMeta)) {
    rows.set(id, {
      driverId: id,
      teamId: meta.teamId,
      name: meta.name,
      flag: meta.flag,
      short: meta.short,
      color: meta.color,
      points: 0,
      wins: 0,
      podiums: 0,
      poles: 0,
      top10: 0,
      races: 0,
      best: 0,
      dnfs: 0,
      trend: [],
    });
  }

  const teamRows = new Map();
  const ensureTeam = (id) => {
    if (!teamRows.has(id)) {
      const t = teamsFor(series).find((x) => x.id === id) || { id, name: id, livery: { primary: '#888' } };
      teamRows.set(id, { teamId: id, name: t.name, livery: t.livery, points: 0, wins: 0, podiums: 0 });
    }
    return teamRows.get(id);
  };

  for (const round of history) {
    const main = round.results.find((r) => r.kind === 'feature');
    if (!main) continue;
    const scored = scoreSession(main);
    for (const e of scored) {
      const row = rows.get(e.driverId);
      if (!row) continue;
      row.races += 1;
      row.points += e.points;
      row.trend.push(e.position);
      if (e.position === 1) row.wins += 1;
      if (e.position <= 3) row.podiums += 1;
      if (e.position <= 10) row.top10 += 1;
      if (e.position > 10 || e.dsq) row.dnfs += 1;
      if (e.grid === 1) row.poles += 1;
      if (e.bestLapMs && (!row.best || e.bestLapMs < row.best)) row.best = e.bestLapMs;
      const team = ensureTeam(e.teamId);
      team.points += e.points;
      if (e.position === 1) team.wins += 1;
      if (e.position <= 3) team.podiums += 1;
    }
  }

  return {
    drivers: buildTable([...rows.values()]),
    teams: [...teamRows.values()].sort((a, b) => b.points - a.points || b.wins - a.wins),
    roundsDone: history.length,
    roundsTotal: roundsFor(series).length,
  };
}

/** Puesto del jugador en la clasificación de pilotos. */
export function playerRow(standings, driverId) {
  const idx = standings.drivers.findIndex((d) => d.driverId === driverId);
  return idx < 0 ? null : { ...standings.drivers[idx], position: idx + 1 };
}

export function teamRow(standings, teamId) {
  const idx = standings.teams.findIndex((t) => t.teamId === teamId);
  return idx < 0 ? null : { ...standings.teams[idx], position: idx + 1 };
}

/* ─────────────── Clasificación de una sesión deFP / quali ─────────────── */

/**
 * Ordena una sesión de clasificación por mejor vuelta.
 * @param {Array} rows objetos {driverId, bestLapMs, ...}
 * @param {(a,b)=>number} tiebreaker
 */
export function sortQualifying(rows, tiebreaker = (a, b) => a.bestLapMs - b.bestLapMs) {
  return rows.slice().sort(tiebreaker);
}

/** Reparte los puestos de una Q1 (se eliminan los últimos). */
export function eliminateQ1(order, advance) {
  const idx = order.findIndex((r) => r.driverId === '__none__');
  const out = order.slice(0, advance);
  return { advancing: out, eliminated: order.slice(advance) };
}

/* ─────────────── Resumen de fin de semana para la UI ─────────────── */

export function weekendSummary(round, history) {
  const entry = history.find((h) => h.round === round.round);
  if (!entry) return null;
  const quali = entry.results.find((r) => r.kind === 'quali');
  const main = entry.results.find((r) => r.kind === 'feature');
  return {
    quali: quali ? quali.entries : [],
    main: main ? main.entries : [],
    bestQ: quali && quali.entries[0],
    winner: main && main.entries[0],
  };
}

export function pointsString(points) {
  return Number.isInteger(points) ? String(points) : points.toFixed(1);
}
