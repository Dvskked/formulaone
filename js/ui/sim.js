// Simulación de sesiones que el jugador no quiere conducir: rellena los
// libres y, opcionalmente, adelanta al siguiente bloque con resultados
// coherentes generados a partir del rendimiento del coche y del rival.

import { createSession, updateSession } from '../game/race.js';
import { getCircuit } from '../data/circuits.js';
import { recordSession, currentRound, advanceToNextRound, roundFinished, gridEntryList } from '../game/career.js';
import { ctx } from './context.js';
import { autosave } from './save.js';

/**
 * Simula una sesión completa sin renderizado.
 * @returns {object|null} resultado de la sesión
 */
export function simulateSession(state, round, sessionDef) {
  const session = createSession({
    circuit: getCircuit(round.circuitId),
    entryList: gridEntryList(state),
    kind: sessionDef.type,
    round,
    settings: ctx.settings,
    seed: `${state.seed}|${state.series}|${state.round}|${sessionDef.id}`,
  });
  const dt = 1 / 20;
  let guard = 0;
  while (!session.completed && guard < 240000) {
    updateSession(session, dt, { steer: 0, throttle: 1, brake: 0, handbrake: false, drsPressed: false, pitPressed: false });
    guard++;
  }
  if (!session.completed) return null;
  return session.results;
}

/**
 * Rellena todas las sesiones pendientes de la ronda actual hasta la siguiente
 * obligatoria incluida. Útil para «simular hasta la clasificación».
 */
export function simulateRest(context = ctx, shell = null) {
  const state = context.career;
  if (!state) return 0;
  const round = currentRound(state);
  if (!round) return 0;
  const target = round.sessions.find((s) => s.required && !s.played);
  if (!target) return 0;
  let done = 0;
  for (const def of round.sessions) {
    if (def.played) continue;
    if (def.required && def.id !== target.id) break;
    const results = simulateSession(state, round, def);
    if (!results) break;
    recordSession(state, { ...results, kind: def.type, round: state.round, sessionId: def.id });
    done++;
    if (def.id === target.id) break;
  }
  if (roundFinished(state)) advanceToNextRound(state);
  autosave();
  shell?.toast(`${done} sesión(es) simulada(s).`, 'good');
  return done;
}

/** Adelanta toda una ronda (todas las sesiones, incluida la obligatoria). */
export function simulateRound(context = ctx, shell = null) {
  const state = context.career;
  if (!state) return 0;
  const round = currentRound(state);
  if (!round) return 0;
  let done = 0;
  for (const def of round.sessions) {
    if (def.played) continue;
    const results = simulateSession(state, round, def);
    if (!results) break;
    recordSession(state, { ...results, kind: def.type, round: state.round, sessionId: def.id });
    done++;
  }
  if (roundFinished(state)) advanceToNextRound(state);
  autosave();
  shell?.toast(`Ronda completa simulada (${done} sesiones).`, 'good');
  return done;
}
