// Estado global de la aplicación. Las pantallas leen y escriben aquí para
// evitar imports circulares entre main.js y las pantallas.

import { loadSettings, saveSettings } from '../core/storage.js';
import { currentRound, calendarFor, isSeasonOver, pendingSession } from '../game/career.js';
import { getTeam } from '../data/teams.js';

export const ctx = {
  career: null,
  slot: null,
  settings: loadSettings(),
  session: null,
  view: null,
  hud: null,
  shell: null,
  running: false,
  lastResult: null,
  teamsById: {},
};

export function setSettings(patch) {
  ctx.settings = { ...ctx.settings, ...patch };
  saveSettings(ctx.settings);
  return ctx.settings;
}

export function resetSettings() {
  return setSettings({});
}

/** Índice de la serie activa. */
export function series(state = ctx.career) {
  return state?.series || 'f2';
}

export function isF1(state = ctx.career) {
  return series(state) === 'f1';
}

export function currentRoundDef(state = ctx.career) {
  return currentRound(state);
}

export function calendar(state = ctx.career) {
  return calendarFor(state);
}

export function seasonOver(state = ctx.career) {
  return isSeasonOver(state);
}

export function pending(state = ctx.career) {
  return pendingSession(state);
}

export function teamOf(id, serie = series()) {
  return getTeam(id, serie);
}

/** Índice de equipos por id, para el render de coches. */
export function buildTeamIndex(serie = series()) {
  const index = {};
  for (const state of [ctx.career]) {
    if (!state) continue;
    for (const entry of state.entryList || []) {
      if (entry.teamId) index[entry.teamId] = getTeam(entry.teamId, state.series || serie);
    }
  }
  if (ctx.session) {
    for (const entry of ctx.session.entries || []) {
      if (entry.teamId) index[entry.teamId] = getTeam(entry.teamId, ctx.session.series || serie);
    }
  }
  ctx.teamsById = index;
  return index;
}

/** Próxima sesión jugable de la ronda activa. */
export function nextSession(state = ctx.career) {
  const round = currentRound(state);
  if (!round) return null;
  return round.sessions.find((s) => s.required && !s.played) || null;
}

/** ¿Se puede correr la sesión indicada? */
export function canRun(session, round, state = ctx.career) {
  if (!session || session.played) return false;
  if (!session.required) return true;
  const order = round.sessions.filter((s) => s.required);
  const index = order.indexOf(session);
  if (index <= 0) return true;
  return order.slice(0, index).every((s) => s.played);
}
