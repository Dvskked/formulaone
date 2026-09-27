// Guardado automático en el hueco activo. Se llama tras cada acción que
// modifica la carrera para que el progreso nunca se pierda.

import { writeSlot, lastSlotIndex, hasAnySave } from '../core/storage.js';
import { playerRow, teamRow } from '../game/standings.js';
import { driverCard, teamCard } from '../game/career.js';
import { ctx } from './context.js';

/** Escribe la carrera en localStorage. Devuelve true si se guardó. */
export function persist() {
  const state = ctx.career;
  if (!state) return false;
  const slot = ctx.slot ?? lastSlotIndex() ?? 0;
  const card = driverCard(state);
  const crew = teamCard(state);
  const me = playerRow(state.standings || { drivers: [] }, state.driver.id);
  const team = teamRow(state.standings || { teams: [] }, state.teamId);
  const meta = {
    driverName: card.name,
    driverFlag: card.flag,
    driverNumber: card.number,
    teamName: crew.team.name,
    teamColor: crew.team.livery.primary,
    series: state.series,
    round: state.round,
    roundLabel: '',
    points: me?.points ?? 0,
    position: me?.position ?? null,
    teamPosition: team?.position ?? null,
    savedAt: new Date().toISOString(),
  };
  state.meta = meta;
  state.updatedAt = meta.savedAt;
  return writeSlot(slot, state, meta);
}

export function autosave() {
  if (!ctx.career) return;
  try {
    persist();
  } catch {
    /* el guardado nunca debe romper la partida */
  }
}

export { hasAnySave };
