// Guía rápida: controles, sistemas de carrera y camino a F1.

import { el, button } from '../dom.js';
import { RACE_LAPS, SPRINT_LAPS, MAX_PIT_STOPS, MISSED_PIT_PENALTY_S } from '../../game/race.js';

export async function showHowTo(shell, { onBack } = {}) {
  const section = (title, rows) => el('div.card', null, [
    el('h3', { text: title }),
    el('dl.kv', null, rows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })])),
  ]);

  shell.mount(el('div.screen', null, [
    el('div.screen-head', null, [
      el('div', null, [
        el('h2', { text: 'Cómo se juega' }),
        el('div.sub', { text: 'Controles, sistemas de carrera y ascenso a F1' }),
      ]),
      onBack ? button('Volver', { kind: 'primary', onClick: onBack }) : null,
    ]),
    el('div.grid.grid-side', null, [
      el('div.stack', null, [
        section('Controles', [
          ['Subir acelerador', 'W / ↑'],
          ['Frenar y marcha atrás', 'S / ↓'],
          ['Dirección', 'A / D o ← / →'],
          ['Freno de mano', 'Espacio'],
          ['DRS', 'E'],
          ['Entrar en boxes', 'P'],
          ['Reincorporarse', 'R'],
          ['Cámara', 'C'],
          ['Pausa', 'Esc o Tab'],
          ['Simulación ×1/×2/×3', '4 / 5 / 6'],
        ]),
        section('Carrera', [
          ['Distancia', `${RACE_LAPS} vueltas en F1 y F2; el sprint son ${SPRINT_LAPS}`],
          ['Parada obligatoria', `${MAX_PIT_STOPS === 1 ? 'Una sola parada' : `${MAX_PIT_STOPS} paradas`}; sin parar, +${MISSED_PIT_PENALTY_S} s de penalización`],
          ['Neumáticos', 'C5 blandos (7 vueltas, los más rápidos), C3 medios (12), C2 duros (16, algo más lentos)'],
          ['Pista', 'Siempre en seco: no hay gomas de lluvia'],
          ['ERS', 'Se despliega en las rectas y se recupera frenando'],
          ['Daño', 'Sin pasar por boxes se acumula y acaba en el abandono'],
          ['Bandera amarilla', 'No se puede ganar posición; el coche de seguridad te devuelve a pista'],
        ]),
      ]),
      el('div.stack', null, [
        el('div.card', null, [
          el('h3', { text: 'Modo carrera' }),
          el('ul', { style: { margin: '6px 0 0', paddingLeft: '18px', fontSize: '13px', lineHeight: '1.7', color: 'var(--text-2)' } }, [
            el('li', { text: 'Empiezas en F2 con 14 citas y 22 pilotos.' }),
            el('li', { text: 'Ganas puntos en carrera, sprint y vuelta rápida.' }),
            el('li', { text: 'Termina entre los tres primeros para subir a F1.' }),
            el('li', { text: 'Si no llegas, repites la temporada con mejoras.' }),
            el('li', { text: 'En F1 son 23 grandes premios y sprints en seis citas.' }),
            el('li', { text: 'El jefe escribe correos con objetivos: léelos y complétalos.' }),
          ]),
        ]),
        el('div.card.accent', null, [
          el('h3', { text: 'Juego de fans' }),
          el('div.hint', { text: 'Proyecto no oficial, sin relación con Formula One, la FIA ni los equipos y pilotos citados. Todo el guardado es local.' }),
        ]),
      ]),
    ]),
  ]));

  shell.setChrome({ title: 'Guía', subtitle: 'Controles y sistemas' });
}
