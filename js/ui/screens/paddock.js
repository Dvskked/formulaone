// Paddock: pantalla central de la carrera profesional.
// Muestra la próxima cita, el estado del championship, los objetivos del jefe
// y da acceso al fin de semana, clasificación, calendario, buzón y garage.

import { el, button, bar, formatDate } from '../dom.js';
import { standingsTable } from './tables.js';
import { buildStandings, playerRow, teamRow } from '../../game/standings.js';
import {
  currentRound, daysToRound, isSeasonOver, repeatSeason, promoteToF1,
  driverCard, teamCard, carStats,
} from '../../game/career.js';
import { ctx, canRun } from '../context.js';

export async function showPaddock(shell, params = {}) {
  const state = ctx.career;
  if (!state) return;
  const round = currentRound(state);
  const card = driverCard(state);
  const crew = teamCard(state);
  const seriesName = state.series === 'f1' ? 'Fórmula 1' : 'Fórmula 2';
  const standings = state.standings || buildStandings(state.series, state.history, state.entryList);
  const me = playerRow(standings, state.driver.id);
  const myTeam = teamRow(standings, state.teamId);
  const pending = round ? round.sessions.find((s) => s.required && !s.played) : null;
  const days = daysToRound(state);
  const seasonOver = isSeasonOver(state);
  const played = round ? round.sessions.filter((s) => s.played).length : 0;
  const total = round ? round.sessions.length : 0;

  const chips = [
    el('span.chip.chip-red', { text: seriesName }),
    el('span.chip', { text: `Ronda ${state.round}/${state.series === 'f1' ? 23 : 14}` }),
    me ? el('span.chip', { text: `P${me.position} · ${me.points} pts` }) : null,
    state.unreadMail ? el('span.chip.chip-amber', { text: `${state.unreadMail} sin leer` }) : null,
  ];

  const seasonCard = el('div.card.accent', null, [
    el('div.row.between', null, [
      el('div', null, [
        el('div.eyebrow', { text: seasonOver ? 'Temporada cerrada' : 'Próxima cita' }),
        el('div', { style: { fontSize: '22px', fontWeight: '800' }, text: round ? `${round.flag} ${round.gp}` : 'Temporada completada' }),
        el('div.dim', { style: { fontSize: '12px' }, text: round ? `${round.circuit.name} · ${round.circuit.length} km · ${played}/${total} sesiones` : '' }),
      ]),
      el('div', { style: { textAlign: 'right' } }, [
        el('div.big.mono', { text: days !== null ? String(days) : '—' }),
        el('div.dim', { style: { fontSize: '11px' }, text: days === null ? '' : days === 1 ? 'día para el domingo' : 'días para el domingo' }),
      ]),
    ]),
    el('div.row', { style: { marginTop: '12px' } }, [
      button(round ? 'Abrir fin de semana' : 'Ver clasificación', {
        kind: 'primary',
        onClick: async () => {
          const { showWeekend } = await import('./weekend.js');
          await showWeekend(shell, {});
        },
      }),
      pending && round ? button(`Simular hasta ${pending.short}`, {
        kind: 'ghost',
        title: 'Rellena las sesiones opcionales que falten',
        onClick: async () => {
          const { simulateRest } = await import('../sim.js');
          simulateRest(ctx, shell);
          await showPaddock(shell, {});
        },
      }) : null,
      seasonOver ? button('Cerrar temporada', { kind: 'primary', onClick: () => showSeasonEnd(shell) }) : null,
    ]),
  ]);

  const weekend = round ? el('div.card', null, [
    el('h3', { text: 'Programa del fin de semana' }),
    el('div.week', null, round.sessions.map((s) => {
      const runnable = canRun(s, round);
      return el('button.session-row', {
        class: `${s.played ? 'played' : ''} ${pending && s.id === pending.id ? 'next' : ''}`,
        type: 'button',
        disabled: s.played || !runnable,
        on: {
          click: async () => {
            const { showSession } = await import('./session.js');
            await showSession(shell, { session: s, round });
          },
        },
      }, [
        el('div', { style: { width: '46px' } }, [
          el('div.when', { text: formatDate(s.date) }),
          el('div.state', { text: `${s.minutes} min` }),
        ]),
        el('div.grow', null, [
          el('div.what', { text: s.name }),
          el('div.state', {
            text: s.played
              ? `Completada · ${s.result?.player?.position ? `P${s.result.player.position}` : 'sin posición'}`
              : s.required ? 'Obligatoria' : 'Opcional',
          }),
        ]),
        s.result?.player ? el('span.chip', { text: `P${s.result.player.position}` }) : null,
        el('span.chip', { class: s.played ? 'chip-green' : pending && s.id === pending.id ? 'chip-red' : '', text: s.played ? 'Hecho' : pending && s.id === pending.id ? 'Siguiente' : canRun(s, round) ? 'Disponible' : 'Bloqueada' }),
      ]);
    })),
  ]) : null;

  const objectives = el('div.card', null, [
    el('h3', { text: 'Objectives del jefe' }),
    ...(state.objectives || []).map((o) => el('div', { style: { padding: '7px 0', borderTop: '1px solid rgba(35,40,56,.6)' } }, [
      el('div.row.between', null, [
        el('span', { style: { fontSize: '13px' }, text: o.text }),
        el('span.chip', { class: o.done ? 'chip-green' : '', text: o.done ? 'Hecho' : `${Math.round((o.progress || 0) * 100)}%` }),
      ]),
      bar((o.progress || 0) * 100, 100, o.done ? 'good' : ''),
    ])),
    el('div.hint', { style: { marginTop: '8px' }, text: staffHint(state) }),
  ]);

  const standingsCard = el('div.card', null, [
    el('div.row.between', null, [
      el('h3', { text: 'Mundial' }),
      button('Completo', { kind: 'ghost', small: true, onClick: async () => { const { showStandings } = await import('./standings.js'); await showStandings(shell, {}); } }),
    ]),
    el('div.table-scroll', null, standingsTable(standings, { playerId: state.driver.id, limit: 8 })),
    myTeam ? el('div.hint', { style: { marginTop: '8px' }, text: `${crew.team.name}: ${myTeam.position}º con ${myTeam.points} puntos.` }) : null,
  ]);

  const garageCard = el('div.card', null, [
    el('div.row.between', null, [
      el('h3', { text: 'Garaje' }),
      button('Abrir', { kind: 'ghost', small: true, onClick: async () => { const { showGarage } = await import('./garage.js'); await showGarage(shell, {}); } }),
    ]),
    el('div.grid.grid-3', { style: { marginTop: '4px' } }, carStats(state).map((s) => el('div', null, [
      el('div.dim', { style: { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.1em' }, text: s.key }),
      el('div.mono', { style: { fontSize: '17px', fontWeight: '800' }, text: String(s.value) }),
    ]))),
  ]);

  const newsCard = el('div.card', null, [
    el('div.row.between', null, [
      el('h3', { text: 'Últimas noticias' }),
      button('Buzón', { kind: 'ghost', small: true, onClick: async () => { const { showInbox } = await import('./inbox.js'); await showInbox(shell, {}); } }),
    ]),
    ...(state.news || []).slice(0, 3).map((n) => el('div', { style: { padding: '6px 0', borderTop: '1px solid rgba(35,40,56,.6)' } }, [
      el('div.row.row-tight', null, [
        el('span.chip', { class: n.unread ? 'chip-red' : '', text: n.tagLabel || 'Noticia' }),
        el('span.dim', { style: { fontSize: '11px' }, text: formatDate(n.date) }),
      ]),
      el('div', { style: { fontSize: '13px', fontWeight: '600' }, text: n.title }),
    ])),
    (state.news || []).length === 0 ? el('div.hint', { text: 'Todavía no hay noticias.' }) : null,
  ]);

  shell.mount(el('div.screen', null, [
    el('div.screen-head', null, [
      el('div', null, [
        el('h2', { text: `${card.flag} ${card.name}` }),
        el('div.sub', { text: `${card.nationality} · ${card.age} años · #${card.number} · ${crew.team.name}` }),
      ]),
      el('div.row.row-tight', null, chips),
    ]),
    el('div.grid.grid-side', null, [
      el('div.stack', null, [seasonCard, weekend, standingsCard]),
      el('div.stack', null, [objectives, garageCard, newsCard]),
    ]),
  ]));

  shell.setChrome({
    title: 'Paddock',
    subtitle: round ? `${round.flag} ${round.gp}` : 'Temporada completada',
    chips,
  });
}

function staffHint(state) {
  const staff = state.team?.staff;
  if (!staff) return '';
  const principal = staff.principal;
  return `${principal.name}, ${principal.style}: «${staff.motto || 'trabaja conmigo'}»`;
}

async function showSeasonEnd(shell) {
  const state = ctx.career;
  const standings = state.standings || buildStandings(state.series, state.history, state.entryList);
  const me = playerRow(standings, state.driver.id);
  const champion = standings.drivers?.[0];
  const position = me?.position ?? 99;
  const promoted = state.series === 'f2' && position <= 3;

  const body = el('div.stack', null, [
    el('p', { text: promoted
      ? `Terminas ${position}º el campeonato de F2 con ${me.points} puntos. Hay un asiento en F1 esperándote.`
      : `Terminas ${position}º el campeonato con ${me.points} puntos. El objetivo del jefe no se cumple este año.` }),
    el('div.table-scroll', null, standingsTable(standings, { playerId: state.driver.id, limit: 5 })),
  ]);

  const actions = [];
  if (promoted) actions.push({ label: 'Firmar por F1', kind: 'primary', value: 'promote' });
  actions.push({ label: 'Repetir temporada', value: 'repeat' });

  const choice = await shell.modal({
    title: promoted ? '¡Subes a Fórmula 1!' : 'Fin de temporada',
    body,
    actions,
    dismissable: false,
  });

  if (choice === 'promote') {
    const choice2 = await pickF1Team(shell);
    if (!choice2) {
      shell.toast('No has elegido equipo. Repite temporada.', 'warn');
      repeatSeason(state);
      await showPaddock(shell, {});
      return;
    }
    promoteToF1(state, choice2);
    shell.toast('Fichaje firmado. Bienvenido a la parrilla de F1.', 'good');
    await showPaddock(shell, {});
  } else if (choice === 'repeat') {
    repeatSeason(state);
    shell.toast('Temporada repetida. Vuelta a empezar.', 'warn');
    await showPaddock(shell, {});
  } else {
    await showPaddock(shell, {});
  }
}

async function pickF1Team(shell) {
  const { teamsFor } = await import('../../data/teams.js');
  const teams = teamsFor('f1').slice().sort((a, b) => (a.tier || 0) - (b.tier || 0));
  let picked = null;
  const list = el('div.pick-list');
  const paint = () => {
    list.textContent = '';
    for (const team of teams) {
      list.append(el('button.pick', {
        type: 'button',
        'aria-pressed': String(picked === team.id),
        on: { click: () => { picked = team.id; paint(); } },
      }, [
        el('span.swatch-team', { style: { background: team.livery.primary } }),
        el('span.grow', null, [
          el('span.t', { text: team.name }),
          el('span.d', { text: `${team.titles} títulos · potencia ${team.car.power} · ${team.hq}` }),
        ]),
        el('span.chip', { text: team.tier === 1 ? 'Top' : team.tier === 2 ? 'Media' : 'Resto' }),
      ]));
    }
  };
  paint();
  const choice = await shell.modal({
    title: 'Elige tu escudería de F1',
    body: el('div.stack', null, [el('p.hint', { text: 'El equipo con más títulos ofrece mejor coche, pero la presión también es mayor.' }), list]),
    actions: [{ label: 'Firmar', kind: 'primary', value: 'ok' }, { label: 'Cancelar', value: null }],
  });
  return choice === 'ok' ? picked : null;
}

export const paddockScreen = { id: 'paddock', render: (shell) => showPaddock(shell, {}) };
