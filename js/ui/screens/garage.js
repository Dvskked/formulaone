// Garage: estado del coche, atributos, plantilla y modelo para la próxima cita.

import { el, button, bar } from '../dom.js';
import { teamCard, carStats, driverCard, currentRound, deepClone } from '../../game/career.js';
import { ctx } from '../context.js';
import { autosave } from '../save.js';

const UPGRADE_COST = 1;
const FIELD_BY_LABEL = { Potencia: 'power', Aerodinámica: 'aero', Agarre: 'grip', Frenos: 'brakes', Fiabilidad: 'reliability' };

export async function showGarage(shell) {
  const state = ctx.career;
  if (!state) return;
  const crew = teamCard(state);
  const card = driverCard(state);
  const stats = carStats(state);
  const round = currentRound(state);
  const teammates = (state.entryList || []).filter((e) => e.teamId === state.teamId && e.driverId !== state.driver.id);
  const budget = crew.team.car?.budget ?? 0;
  const development = state.teamDevelopment ?? 0;

  const spend = (label) => {
    const field = FIELD_BY_LABEL[label];
    if (!field) return;
    if (development + UPGRADE_COST > budget) {
      shell.toast('No queda presupuesto de desarrollo.', 'bad');
      return;
    }
    /* El equipo viene del módulo de datos, así que se copia antes de tocarlo
       para que el desarrollo no se filtre a otras partidas */
    if (!state.teamUpgraded) {
      state.team = deepClone(state.team);
      state.teamUpgraded = true;
    }
    state.team.car[field] = Math.min(99, (state.team.car[field] || 0) + 1);
    state.teamDevelopment = development + UPGRADE_COST;
    autosave();
    shell.toast(`${label} mejorado.`, 'good');
    showGarage(shell);
  };

  shell.mount(el('div.screen', null, [
    el('div.screen-head', null, [
      el('div', null, [
        el('h2', { text: `Garaje · ${crew.team.name}` }),
        el('div.sub', { text: `${crew.team.fullName || ''} ${crew.team.flag || ''}` }),
      ]),
      el('div.row.row-tight', null, [
        el('span.chip', { text: `Presupuesto ${budget - development}/${budget}` }),
        el('span.chip', { text: `Nivel ${crew.level || 1}` }),
      ]),
    ]),
    el('div.grid.grid-side', null, [
      el('div.stack', null, [
        el('div.card', null, [
          el('h3', { text: 'Monocasco' }),
          el('div.grid.grid-3', null, stats.filter((s) => s.key !== 'Presupuesto').map((s) => el('div.pad-sm', { style: { background: 'var(--ink-3)', borderRadius: 'var(--r-sm)' } }, [
            el('div.row.between', null, [
              el('span.dim', { style: { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.08em' }, text: s.key }),
              el('b.mono', { text: String(s.value) }),
            ]),
            bar(s.value, 100, s.value >= 90 ? 'good' : s.value >= 75 ? '' : 'warn'),
            FIELD_BY_LABEL[s.key] ? button(`Mejorar (${UPGRADE_COST})`, {
              kind: 'ghost',
              small: true,
              disabled: development + UPGRADE_COST > budget,
              onClick: () => spend(s.key),
            }) : null,
          ]))),
          el('div.hint', { style: { marginTop: '8px' }, text: 'Cada punto de desarrollo consume presupuesto de la escudería y sube el rendimiento del coche durante el resto de la temporada.' }),
        ]),
        el('div.card', null, [
          el('h3', { text: 'Tu piloto' }),
          el('div.grid.grid-2', null, Object.entries(card.ratings || {}).map(([key, value]) => el('div.stat-line', null, [
            el('span.muted', { text: RATING_LABELS[key] || key }),
            el('b', { text: String(value) }),
          ]))),
          el('div.row.row-tight', { style: { marginTop: '8px' } }, (card.traits || []).map((t) => el('span.chip.chip-blue', { text: t }))),
        ]),
      ]),
      el('div.stack', null, [
        el('div.card.accent', null, [
          el('h3', { text: 'Compañeros' }),
          ...teammates.map((e) => el('div.stat-line', null, [
            el('span', null, el('div.driver-cell', null, [el('span.flag', { text: e.flag || '' }), el('span', { text: e.name })])),
            el('b.mono', { text: e.ratings ? String(Math.round(Object.values(e.ratings).reduce((a, b) => a + b, 0) / Object.values(e.ratings).length)) : '—' }),
          ])),
          teammates.length === 0 ? el('div.hint', { text: 'Slot libre: piloto titular en pruebas.' }) : null,
        ]),
        el('div.card', null, [
          el('h3', { text: 'Staff' }),
          ...Object.entries(crew.team.staff || {}).map(([role, person]) => el('div.stat-line', null, [
            el('span', null, el('div', null, [
              el('div', { text: person.name }),
              el('div.dim', { style: { fontSize: '11px' }, text: `${ROLE[role] || role} · ${person.style}` }),
            ])),
            el('span.flag', { text: person.flag || '' }),
          ])),
          el('div.hint', { style: { marginTop: '8px' }, text: crew.team.motto || '' }),
        ]),
        el('div.card', null, [
          el('h3', { text: 'Próxima cita' }),
          el('div.hint', { text: round ? `${round.flag} ${round.gp} · ${round.circuit.name} (${round.circuit.length} km)` : 'Temporada completada' }),
        ]),
      ]),
    ]),
  ]));

  shell.setChrome({ title: 'Garaje', subtitle: crew.team.name });
}

const RATING_LABELS = {
  pace: 'Ritmo',
  braking: 'Frenada',
  control: 'Control',
  consistency: 'Consistencia',
  racecraft: 'Oficio',
  quali: 'Clasificación',
  tyre: 'Gestión de neumáticos',
  starts: 'Salidas',
  wet: 'Mojado',
};

const ROLE = {
  principal: 'Jefe de equipo',
  deputy: 'Director deportivo',
  chiefMechanic: 'Jefe de mecánicos',
  raceEngineer: 'Ingeniero de pista',
  performance: 'Director de rendimiento',
};
