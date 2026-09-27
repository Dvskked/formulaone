// Buzón: correo del equipo (jefe, ingeniero, mecánicos) y noticias.

import { el, button, formatDate } from '../dom.js';
import { markMailRead, markNewsRead, refreshInbox, refreshNews, currentRound } from '../../game/career.js';
import { roleLabel } from '../../game/mail.js';
import { ctx } from '../context.js';
import { autosave } from '../save.js';

export async function showInbox(shell, { tab = 'mail' } = {}) {
  const state = ctx.career;
  if (!state) return;
  let active = tab;

  const body = el('div.stack');
  const tabs = el('div.segmented', { style: { maxWidth: '320px' } });

  const renderTabs = () => {
    tabs.textContent = '';
    tabs.append(
      el('button', {
        type: 'button', text: `Correo (${state.unreadMail || 0})`,
        'aria-pressed': String(active === 'mail'),
        on: { click: () => { active = 'mail'; paint(); } },
      }),
      el('button', {
        type: 'button', text: `Noticias (${state.unreadNews || 0})`,
        'aria-pressed': String(active === 'news'),
        on: { click: () => { active = 'news'; paint(); } },
      }),
    );
  };

  const openMail = async (item) => {
    markMailRead(state, item.id);
    autosave();
    await shell.modal({
      title: item.subject,
      body: el('div.stack', null, [
        el('div.row.row-tight', null, [
          el('span.chip', { text: roleLabel(item.role) || 'Equipo' }),
          el('span.chip', { text: item.from }),
        ]),
        el('p', { style: { whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '13.5px' }, text: item.body }),
      ]),
      actions: [{ label: 'Entendido', kind: 'primary', value: 'ok' }],
    });
    paint();
  };

  const openNews = async (item) => {
    markNewsRead(state, item.id);
    autosave();
    await shell.modal({
      title: item.title,
      body: el('div.stack', null, [
        el('div.row.row-tight', null, [
          el('span.chip.chip-red', { text: item.tagLabel || 'Noticia' }),
          el('span.chip', { text: item.source || 'SportFeed' }),
          el('span.chip', { text: formatDate(item.date) }),
        ]),
        el('p', { style: { whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '13.5px' }, text: item.body }),
      ]),
      actions: [{ label: 'Cerrar', kind: 'primary', value: 'ok' }],
    });
    paint();
  };

  const paint = () => {
    renderTabs();
    body.textContent = '';
    const list = active === 'mail' ? (state.inbox || []) : (state.news || []);
    if (!list.length) {
      body.append(el('div.card', null, el('div.hint', { text: active === 'mail' ? 'No hay correo todavía.' : 'No hay noticias todavía.' })));
    }
    for (const item of [...list].reverse()) {
      if (active === 'mail') {
        body.append(el('button.mail-item', {
          class: item.unread ? 'unread' : '',
          type: 'button',
          on: { click: () => openMail(item) },
        }, [
          el('div.row.between', null, [
            el('span.from', { text: `${item.flag || ''} ${item.from} · ${roleLabel(item.role) || 'Equipo'}` }),
            item.unread ? el('span.chip.chip-red', { text: 'Nuevo' }) : null,
          ].filter(Boolean)),
          el('div.subject', { text: item.subject }),
        ]));
      } else {
        body.append(el('button.mail-item', {
          class: item.unread ? 'unread' : '',
          type: 'button',
          on: { click: () => openNews(item) },
        }, [
          el('div.row.between', null, [
            el('span.from', { text: `${item.tagLabel || 'Noticia'} · ${item.source || 'SportFeed'}` }),
            el('span.from', { text: formatDate(item.date) }),
          ]),
          el('div.subject', { text: item.title }),
        ]));
      }
    }
  };

  paint();

  const round = currentRound(state);
  shell.mount(el('div.screen', null, [
    el('div.screen-head', null, [
      el('div', null, [
        el('h2', { text: 'Buzón' }),
        el('div.sub', { text: round ? `Semana de ${round.gp}` : 'Temporada completada' }),
      ]),
      el('div.row.row-tight', null, [
        button('Actualizar', {
          kind: 'ghost',
          onClick: () => {
            refreshInbox(state);
            refreshNews(state);
            paint();
            shell.toast('Buzón actualizado.', 'good');
          },
        }),
        button('Marcar leídos', {
          kind: 'ghost',
          onClick: () => {
            markMailRead(state, null);
            markNewsRead(state, null);
            paint();
          },
        }),
      ]),
    ]),
    tabs,
    body,
  ]));

  shell.setChrome({
    title: 'Buzón',
    subtitle: `${state.unreadMail || 0} correos y ${state.unreadNews || 0} noticias sin leer`,
  });
}
