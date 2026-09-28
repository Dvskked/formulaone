// Tablas compartidas por clasificación, resultados y calendario.

import { el, formatTime, formatGap } from '../dom.js';
import { getTeam, teamLogo } from '../../data/teams.js';
import { TYRES } from '../../game/car.js';

const NEUTRAL = '#3a4152';

function teamBar(teamId, series) {
  const team = teamId ? getTeam(teamId, series) : null;
  return el('span.team-bar', { style: { background: team?.livery?.primary || NEUTRAL } });
}

/**
 * Escudo de la escudería en PNG. Si el fichero no existe (o el equipo no tiene
 * escudo) cae a la barrita de color, para que la tabla nunca se rompa.
 */
export function teamBadge(teamId, series = 'f1', { size = 20 } = {}) {
  const team = teamId ? getTeam(teamId, series) : null;
  const bar = teamBar(teamId, series);
  const src = team ? teamLogo(team, series) : '';
  const wrap = el('span.team-crest', { title: team ? team.name : '' });
  if (!src) {
    wrap.append(bar);
    return wrap;
  }
  const img = el('img.team-logo', {
    src,
    alt: team.name,
    width: size,
    height: size,
    loading: 'lazy',
    decoding: 'async',
    on: { error: () => { img.remove(); wrap.append(bar); } },
  });
  wrap.append(img);
  return wrap;
}

function statusChip(entry) {
  if (entry.dsq) return el('span.chip.chip-red', { text: 'Descalificado' });
  if (entry.retired) return el('span.chip.chip-amber', { text: entry.retireReason || 'Abandono' });
  if (entry.eliminated) return el('span.chip', { text: `Eliminado en Q${(entry.segment || 0) + 1}` });
  return el('span.chip.chip-green', { text: 'Clasificado' });
}

/** Neumático final y cumplimiento de la parada obligatoria. */
function tyreCell(entry) {
  const t = TYRES[entry.tyre];
  const row = el('div.row.row-tight');
  row.append(el('span.tyre-dot', { style: `background:${t?.color || '#888'}` }));
  row.append(el('span', { text: t ? `${t.name}` : '—' }));
  if (entry.penaltyMs) row.append(el('span.chip.chip-red', { text: `+${entry.penaltyMs / 1000}s` }));
  else if (entry.pitStops) row.append(el('span.chip.chip-green', { text: 'Parada OK' }));
  else row.append(el('span.chip.chip-amber', { text: 'Sin parar' }));
  return row;
}

/** Tabla de clasificación de campeonato. */
export function standingsTable(standings, { playerId = 'player', limit = 0, series = 'f1', showTrend = false } = {}) {
  const rows = standings.drivers || [];
  const shown = limit ? rows.slice(0, limit) : rows;
  const table = el('table.table');
  table.append(el('thead', null, el('tr', null, [
    el('th', { text: '#' }),
    el('th', { text: 'Piloto' }),
    el('th.num', { text: 'Pts' }),
    el('th.num', { text: 'Vict' }),
    el('th.num', { text: 'Pod' }),
    el('th.num', { text: 'PP' }),
    showTrend ? el('th.num', { text: 'Top10' }) : null,
    el('th.num', { text: 'Aband.' }),
  ].filter(Boolean))));
  const body = el('tbody');
  shown.forEach((d, i) => {
    body.append(el('tr', { class: d.driverId === playerId ? 'me' : '' }, [
      el('td.pos-cell', { text: String(i + 1) }),
      el('td', null, el('div.driver-cell', null, [
        teamBadge(d.teamId, series),
        el('span.flag', { text: d.flag || '🏁' }),
        el('span.grow', { text: d.name }),
        el('span.dim.mono', { style: { fontSize: '11px' }, text: d.short || '' }),
      ])),
      el('td.num', { text: String(d.points) }),
      el('td.num', { text: String(d.wins) }),
      el('td.num', { text: String(d.podiums) }),
      el('td.num', { text: String(d.poles) }),
      showTrend ? el('td.num', { text: String(d.top10) }) : null,
      el('td.num', { class: d.dnfs ? 'neg' : '', text: String(d.dnfs) }),
    ].filter(Boolean)));
  });
  table.append(body);
  if (!rows.length) {
    table.append(el('tbody', null, el('tr', null, el('td', { colspan: '8', class: 'dim', text: 'Todavía no hay resultados.' }))));
  }
  return table;
}

/** Tabla de constructores. */
export function constructorsTable(standings, { teamId = null, limit = 0, series = 'f1' } = {}) {
  const rows = standings.teams || [];
  const shown = limit ? rows.slice(0, limit) : rows;
  const table = el('table.table');
  table.append(el('thead', null, el('tr', null, [
    el('th', { text: '#' }),
    el('th', { text: 'Escudería' }),
    el('th.num', { text: 'Pts' }),
    el('th.num', { text: 'Vict' }),
  ])));
  const body = el('tbody');
  shown.forEach((t, i) => {
    const team = getTeam(t.teamId, series) || {};
    body.append(el('tr', { class: t.teamId === teamId ? 'me' : '' }, [
      el('td.pos-cell', { text: String(i + 1) }),
      el('td', null, el('div.driver-cell', null, [
        teamBadge(t.teamId, series),
        el('span.flag', { text: team.flag || '' }),
        el('span.grow', { text: team.name || t.teamId }),
      ])),
      el('td.num', { text: String(t.points) }),
      el('td.num', { text: String(t.wins) }),
    ]));
  });
  table.append(body);
  if (!rows.length) {
    table.append(el('tbody', null, el('tr', null, el('td', { colspan: '4', class: 'dim', text: 'Sin equipos todavía.' }))));
  }
  return table;
}

/** Tabla de resultados de una sesión (carrera, sprint, clasificación o libres). */
export function resultTable(result, { playerId = 'player', isQuali = false, series = 'f1' } = {}) {
  const entries = result?.entries || [];
  const table = el('table.table');
  table.append(el('thead', null, el('tr', null, [
    el('th', { text: 'P' }),
    el('th', { text: 'Piloto' }),
    el('th.num', { text: isQuali ? 'Mejor vuelta' : 'Diferencia' }),
    el('th.num', { text: isQuali ? 'Q' : 'Par' }),
    el('th.num', { text: 'Vueltas' }),
    isQuali ? null : el('th', { text: 'Neumático' }),
    el('th', { text: 'Estado' }),
  ].filter(Boolean))));
  const body = el('tbody');
  for (const d of entries) {
    const time = isQuali
      ? formatTime(d.bestLapMs)
      : (d.position === 1 && d.gapMs === 0 ? 'Líder' : formatGap(d.gapMs));
    body.append(el('tr', { class: d.driverId === playerId ? 'me' : '' }, [
      el('td.pos-cell', { text: d.position ? String(d.position) : '—' }),
      el('td', null, el('div.driver-cell', null, [
        teamBadge(d.teamId, series),
        el('span.flag', { text: d.flag || '🏁' }),
        el('span.grow', { text: d.name }),
        d.fastestLap ? el('span.chip', { class: 'chip-purple', text: 'VR' }) : null,
      ].filter(Boolean))),
      el('td.num', { text: time }),
      el('td.num', { text: isQuali ? `Q${(d.segment ?? 3) + 1}` : (d.grid ? String(d.grid) : '—') }),
      el('td.num', { text: String(d.laps ?? 0) }),
      isQuali ? null : el('td', null, tyreCell(d)),
      el('td', null, statusChip(d)),
    ].filter(Boolean)));
  }
  table.append(body);
  if (!entries.length) {
    table.append(el('tbody', null, el('tr', null, el('td', { colspan: '6', class: 'dim', text: 'Sin datos de la sesión.' }))));
  }
  return table;
}

/** Tarjeta con la vuelta más rápida de la sesión. */
export function fastestLapCard(result, { playerId = 'player' } = {}) {
  if (!result?.fastestLapDriverId) return null;
  const entry = (result.entries || []).find((e) => e.driverId === result.fastestLapDriverId);
  const isMe = result.fastestLapDriverId === playerId;
  return el(`div.card.pad-sm${isMe ? '.accent' : ''}`, null, [
    el('div.eyebrow', { text: 'Vuelta más rápida' }),
    el('div.row.between', null, [
      el('b', { text: `${entry?.flag || ''} ${entry?.name || ''}` }),
      el('b.mono', { text: formatTime(result.fastestLapMs) }),
    ]),
    isMe ? el('div.hint', { text: 'Punto extra en el championship.' }) : null,
  ]);
}

/** Fila de chips con el resumen del jugador. */
export function playerSummary(entry, { playerId = 'player' } = {}) {
  if (!entry) return null;
  return el('div.row.row-tight', null, [
    el('span.chip', { text: `P${entry.position ?? '—'}` }),
    el('span.chip', { text: `Par ${entry.grid || '—'}` }),
    el('span.chip', { text: `Mejor ${formatTime(entry.bestLapMs)}` }),
    el('span.chip', { text: `${entry.laps ?? 0} vueltas` }),
    entry.pitStops ? el('span.chip', { text: `${entry.pitStops} parada(s)` }) : null,
    entry.penaltyMs ? el('span.chip.chip-red', { text: `+${entry.penaltyMs / 1000}s de penalización` }) : null,
  ]);
}
