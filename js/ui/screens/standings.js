// Clasificación del campeonato: pilotos, constructores y por rondas.

import { el } from '../dom.js';
import { standingsTable, constructorsTable } from './tables.js';
import { buildStandings, playerRow, teamRow } from '../../game/standings.js';
import { calendarFor } from '../../game/career.js';
import { ctx } from '../context.js';

export async function showStandings(shell) {
  const state = ctx.career;
  if (!state) return;
  const standings = state.standings || buildStandings(state.series, state.history, state.entryList);
  const me = playerRow(standings, state.driver.id);
  const myTeam = teamRow(standings, state.teamId);
  const rounds = calendarFor(state);
  const played = state.history.length;

  const table = el('table.table');
  table.append(el('thead', null, el('tr', null, [
    el('th', { text: 'GP' }),
    el('th.num', { text: 'Acumulado' }),
    el('th.num', { text: 'Victorias' }),
    el('th.num', { text: 'Podios' }),
    el('th.num', { text: 'Poles' }),
    el('th.num', { text: 'Aband.' }),
  ])));
  const body = el('tbody');
  state.history.forEach((h, i) => {
    const partial = buildStandings(state.series, state.history.slice(0, i + 1), state.entryList);
    const row = playerRow(partial, state.driver.id);
    body.append(el('tr', { class: h.round === state.round ? 'me' : '' }, [
      el('td', null, el('div.driver-cell', null, [
        el('span.flag', { text: rounds.find((r) => r.round === h.round)?.flag || '' }),
        el('span.grow', { text: h.gp || `Ronda ${h.round}` }),
      ])),
      el('td.num', { text: `${row?.points ?? 0} (P${row?.position ?? '—'})` }),
      el('td.num', { text: String(row?.wins ?? 0) }),
      el('td.num', { text: String(row?.podiums ?? 0) }),
      el('td.num', { text: String(row?.poles ?? 0) }),
      el('td.num', { text: String(row?.dnfs ?? 0) }),
    ]));
  });
  const history = el('div.table-scroll', null, table);

  shell.mount(el('div.screen', null, [
    el('div.screen-head', null, [
      el('div', null, [
        el('h2', { text: `Mundial ${state.series === 'f1' ? 'F1' : 'F2'} 2026` }),
        el('div.sub', { text: `${played} de ${rounds.length} rondas disputadas` }),
      ]),
      el('div.row.row-tight', null, [
        el('span.chip.chip-red', { text: `P${me?.position ?? '—'}` }),
        el('span.chip', { text: `${me?.points ?? 0} pts` }),
        myTeam ? el('span.chip', { text: `Equipo P${myTeam.position}` }) : null,
      ]),
    ]),
    el('div.grid.grid-side', null, [
      el('div.card', null, [
        el('h3', { text: 'Pilotos' }),
        el('div.table-scroll', null, standingsTable(standings, { playerId: state.driver.id, series: state.series, showTrend: true })),
      ]),
      el('div.stack', null, [
        el('div.card', null, [
          el('h3', { text: 'Constructores' }),
          el('div.table-scroll', null, constructorsTable(standings, { teamId: state.teamId, series: state.series })),
        ]),
        el('div.card', null, [el('h3', { text: 'Tus rondas' }), history]),
      ]),
    ]),
  ]));

  shell.setChrome({ title: 'Clasificación', subtitle: state.series === 'f1' ? 'Fórmula 1' : 'Fórmula 2' });
}
