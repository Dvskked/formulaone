// Calendario completo de la temporada con el estado de cada ronda.

import { el } from '../dom.js';
import { calendarFor, currentRound, isSeasonOver } from '../../game/career.js';
import { formatDate } from '../dom.js';
import { ctx } from '../context.js';

export async function showCalendar(shell) {
  const state = ctx.career;
  if (!state) return;
  const rounds = calendarFor(state);
  const current = currentRound(state);
  const resultsByRound = new Map(state.history.map((h) => [h.round, h]));
  const over = isSeasonOver(state);

  const rows = rounds.map((r) => {
    const entry = resultsByRound.get(r.round);
    const main = entry?.results?.find((x) => x.kind === 'feature');
    const me = main?.entries?.find((e) => e.driverId === state.driver.id);
    const isCurrent = current && r.round === current.round;
    const isPast = Boolean(entry) || r.round < (current?.round ?? 0);
    return el('tr', { class: isCurrent ? 'me' : '' }, [
      el('td.pos-cell', { text: String(r.round) }),
      el('td', null, el('div.driver-cell', null, [
        el('span.flag', { text: r.flag }),
        el('span.grow', { text: r.gp }),
        el('span.dim', { style: { fontSize: '11px' }, text: r.circuit.name }),
      ])),
      el('td', { class: 'dim', text: formatDate(r.days.sun) }),
      el('td', null, r.sprint || state.series === 'f2' ? el('span.chip', { text: 'Sprint' }) : el('span.dim', { text: '—' })),
      el('td.num', { text: me?.position ? `P${me.position}` : isPast ? '—' : '' }),
      el('td.num', { text: isCurrent ? '→' : isPast ? '✓' : '' }),
    ]);
  });

  const table = el('table.table', null, [
    el('thead', null, el('tr', null, [
      el('th', { text: '#' }),
      el('th', { text: 'Gran Premio' }),
      el('th', { text: 'Fecha' }),
      el('th', { text: 'Formato' }),
      el('th.num', { text: 'Tu resultado' }),
      el('th.num', { text: '' }),
    ])),
    el('tbody', null, rows),
  ]);

  shell.mount(el('div.screen', null, [
    el('div.screen-head', null, [
      el('div', null, [
        el('h2', { text: `Calendario ${state.series === 'f1' ? 'F1' : 'F2'} 2026` }),
        el('div.sub', { text: `${rounds.length} citas · ${rounds.filter((r) => r.sprint || state.series === 'f2').length} con Sprint` }),
      ]),
      el('div.row.row-tight', null, [
        el('span.chip', { text: over ? 'Temporada cerrada' : `Ronda ${state.round}` }),
      ]),
    ]),
    el('div.card', null, [el('div.table-scroll', null, table)]),
  ]));

  shell.setChrome({ title: 'Calendario', subtitle: `${rounds.length} rondas` });
}
