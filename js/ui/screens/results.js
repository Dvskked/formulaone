// Resultados de la sesión recién disputada: posición, puntos, vuelta rápida,
// clasificación del campeonato y avance a la siguiente cita.

import { el, button } from '../dom.js';
import { resultTable, fastestLapCard, playerSummary, standingsTable, constructorsTable } from './tables.js';
import { buildStandings, playerRow, scoreSession } from '../../game/standings.js';
import { roundFinished, isSeasonOver } from '../../game/career.js';
import { ctx } from '../context.js';

export async function showResults(shell, { sessionDef, round, payload, wasDnf } = {}) {
  const state = ctx.career;
  const result = payload || ctx.lastResult;
  if (!result) return;
  const isQuali = result.kind === 'quali' || result.kind === 'sprintQuali';
  const isRace = result.kind === 'feature' || result.kind === 'sprint';
  const me = (result.entries || []).find((e) => e.driverId === state.driver.id);
  const standings = state.standings || buildStandings(state.series, state.history, state.entryList);
  const row = playerRow(standings, state.driver.id);
  const points = isRace ? (scoreSession(result).find((e) => e.driverId === state.driver.id)?.points ?? 0) : 0;

  const headline = isQuali
    ? `Parrilla ${me?.grid ?? '—'}`
    : `P${me?.position ?? '—'}${isRace ? ` · ${me?.points ?? 0} pts` : ''}`;

  const next = round?.sessions?.find((s) => s.required && !s.played);
  const finished = round ? roundFinished(state) : false;

  shell.stack.length = 0;

  const actions = [];
  if (next && !finished) {
    actions.push(button(`Ir a ${next.short}`, {
      kind: 'primary',
      onClick: async () => {
        if (finished && isSeasonOver(state)) {
          const { showPaddock } = await import('./paddock.js');
          await showPaddock(shell, {});
          return;
        }
        const { showSession } = await import('./session.js');
        await showSession(shell, { session: next, round });
      },
    }));
  }
  actions.push(button('Paddock', {
    kind: next ? 'ghost' : 'primary',
    onClick: async () => {
      const { showPaddock } = await import('./paddock.js');
      await showPaddock(shell, {});
    },
  }));

  shell.mount(el('div.screen', null, [
    el('div.screen-head', null, [
      el('div', null, [
        el('h2', { text: `${sessionDef?.name || 'Sesión'} · ${round?.circuit?.name || ''}` }),
        el('div.sub', { text: `${round?.flag || ''} ${round?.gp || ''} · ${round?.circuit?.weather || ''}` }),
      ]),
      el('div.row.row-tight', null, actions),
    ]),
    el('div.grid.grid-side', null, [
      el('div.stack', null, [
        el('div.card.accent', null, [
          el('div.row.between', null, [
            el('div', null, [
              el('div.eyebrow', { text: wasDnf ? 'Abandono' : 'Tu resultado' }),
              el('div', { style: { fontSize: '30px', fontWeight: '900' }, text: headline }),
            ]),
            el('div', { style: { textAlign: 'right' } }, [
              isRace ? el('div.big.mono', { text: `+${points}` }) : null,
              isRace ? el('div.dim', { style: { fontSize: '11px' }, text: 'puntos' }) : null,
            ]),
          ]),
          el('div.row.row-tight', { style: { marginTop: '10px' } }, [
            playerSummary(me),
            wasDnf && me?.retireReason ? el('span.chip.chip-red', { text: me.retireReason }) : null,
          ]),
        ]),
        el('div.card', null, [
          el('h3', { text: 'Clasificación de la sesión' }),
          el('div.table-scroll', null, resultTable(result, { playerId: state.driver.id, isQuali, series: state.series })),
        ]),
        isQuali && result.grid ? el('div.card', null, [
          el('h3', { text: 'Parrilla oficial' }),
          el('div.table-scroll', null, resultTable({ ...result, entries: result.grid }, { playerId: state.driver.id, isQuali: true, series: state.series })),
        ]) : null,
      ]),
      el('div.stack', null, [
        fastestLapCard(result, { playerId: state.driver.id }),
        el('div.card', null, [
          el('h3', { text: 'Mundial tras esta sesión' }),
          el('div.row.row-tight', null, [
            el('span.chip', { text: `P${row?.position ?? '—'}` }),
            el('span.chip', { text: `${row?.points ?? 0} pts` }),
            row?.best ? el('span.chip', { text: `Mejor: P${row.best}` }) : null,
          ]),
          el('div.table-scroll', { style: { marginTop: '8px' } }, standingsTable(standings, { playerId: state.driver.id, limit: 10, series: state.series })),
        ]),
        el('div.card', null, [
          el('h3', { text: 'Constructores' }),
          el('div.table-scroll', null, constructorsTable(standings, { teamId: state.teamId, limit: 5, series: state.series })),
        ]),
        next ? el('div.card.accent', null, [
          el('div.eyebrow', { text: 'Siguiente en el calendario' }),
          el('div', { style: { fontSize: '16px', fontWeight: '700' }, text: next.name }),
          el('div.hint', { text: `${next.minutes} minutos · ${next.required ? 'obligatoria' : 'opcional'}` }),
        ]) : null,
      ]),
    ]),
  ]));

  shell.setChrome({
    title: 'Resultados',
    subtitle: `${sessionDef?.name || ''} · ${round?.circuit?.name || ''}`,
    chips: [el('span.chip', { text: headline })],
  });
}
