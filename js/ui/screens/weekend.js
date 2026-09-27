// Fin de semana: programa de la ronda con acceso a cada sesión y datos del circuito.

import { el, button } from '../dom.js';
import { currentRound, calendarFor, daysToRound } from '../../game/career.js';
import { weekendLabel } from '../../data/calendar.js';
import { ctx, canRun } from '../context.js';
import { simulateRound } from '../sim.js';

export async function showWeekend(shell) {
  const state = ctx.career;
  if (!state) return;
  const round = currentRound(state);
  if (!round) {
    const { showPaddock } = await import('./paddock.js');
    return showPaddock(shell, {});
  }
  const circuit = round.circuit;
  const required = round.sessions.filter((s) => s.required);
  const done = required.filter((s) => s.played).length;

  const list = el('div.week', null, round.sessions.map((def) => {
    const runnable = canRun(def, round);
    const isNext = required.find((s) => !s.played)?.id === def.id;
    const me = def.result?.entries?.find((e) => e.driverId === state.driver.id);
    return el('button.session-row', {
      class: `${def.played ? 'played' : ''} ${isNext ? 'next' : ''}`,
      type: 'button',
      disabled: def.played || !runnable,
      on: {
        click: async () => {
          const { showSession } = await import('./session.js');
          await showSession(shell, { session: def, round });
        },
      },
    }, [
      el('div', { style: { width: '58px' } }, [
        el('div.when', { text: DAY[def.day] || def.day }),
        el('div.state', { text: `${def.minutes} min` }),
      ]),
      el('div.grow', null, [
        el('div.what', { text: def.name }),
        el('div.state', { text: def.result
          ? (def.result.kind === 'quali' ? `Parrilla P${me?.grid ?? '—'}` : `P${me?.position ?? '—'}`)
          : def.required ? 'Sesión obligatoria' : 'Sesión opcional' }),
      ]),
      el('span.chip', {
        class: def.played ? 'chip-green' : isNext ? 'chip-red' : '',
        text: def.played ? 'Completada' : isNext ? 'Siguiente' : runnable ? 'Disponible' : 'Bloqueada',
      }),
    ]);
  }));

  shell.mount(el('div.screen', null, [
    el('div.screen-head', null, [
      el('div', null, [
        el('h2', { text: `${round.flag} ${round.gp}` }),
        el('div.sub', { text: `${circuit.name} · ${weekendLabel(round)} · ${daysToRound(state)} días` }),
      ]),
      el('div.row.row-tight', null, [
        el('span.chip', { text: `${done}/${required.length} obligatorias` }),
        button('Simular ronda', {
          kind: 'ghost',
          title: 'Simula todas las sesiones de la ronda, incluida la obligatoria',
          onClick: async () => {
            simulateRound(ctx, shell);
            await showWeekend(shell);
          },
        }),
      ]),
    ]),
    el('div.grid.grid-side', null, [
      el('div.card', null, [el('h3', { text: 'Programa' }), list]),
      el('div.stack', null, [
        el('div.card.accent', null, [
          el('h3', { text: 'Datos del circuito' }),
          el('dl.kv', null, [
            el('dt', { text: 'Longitud' }), el('dd', { text: `${circuit.length} km` }),
            el('dt', { text: 'Vueltas' }), el('dd', { text: String(circuit.laps) }),
            el('dt', { text: 'Ancho' }), el('dd', { text: `${circuit.width} m` }),
            el('dt', { text: 'Clima' }), el('dd', { text: circuit.weather }),
            el('dt', { text: 'Récord' }), el('dd', { text: circuit.record || '—' }),
            el('dt', { text: 'Curvas' }), el('dd', { text: String(circuit.corners?.length || 0) }),
          ]),
        ]),
        el('div.card', null, [
          el('h3', { text: 'Claves del circuito' }),
          el('div.hint', { text: 'Repite la zona de DRS y el sector 2 es donde se decide la clasificación.' }),
        ]),
        el('div.card', null, [
          el('h3', { text: 'Temporada' }),
          el('div.hint', { text: `Ronda ${state.round} de ${calendarFor(state).length}. ${
            round.sprint || state.series === 'f2' ? 'Fin de semana con carrera Sprint.' : 'Fin de semana sin Sprint.'
          }` }),
        ]),
      ]),
    ]),
  ]));

  shell.setChrome({ title: 'Fin de semana', subtitle: `${round.flag} ${round.gp}` });
}

const DAY = { thu: 'Jue', fri: 'Vie', sat: 'Sáb', sun: 'Dom' };
