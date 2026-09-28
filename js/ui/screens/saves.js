// Gestión de partidas guardadas: tres huecos locales con exportar e importar.

import { el, button, formatDate } from '../dom.js';
import { listSlots, readSlot, deleteSlot, exportSlot, importSlot, pickTextFile, SLOT_COUNT } from '../../core/storage.js';
import { ctx } from '../context.js';

export async function showSaves(shell, { onPick, onBack } = {}) {
  const paint = () => {
    const slots = listSlots();
    const cards = slots.map((slot) => {
      const meta = slot.meta || {};
      const isActive = ctx.slot === slot.index;
      return el('div.card', { style: isActive ? 'border-color:var(--red)' : '' }, [
        el('div.row.between', null, [
          el('div.row.row-tight', null, [
            el('span.chip', { class: meta.series === 'f1' ? 'chip-red' : 'chip-blue', text: meta.series === 'f1' ? 'F1' : 'F2' }),
            el('span.chip', { text: `Hueco ${slot.index + 1}` }),
            isActive ? el('span.chip.chip-green', { text: 'En uso' }) : null,
          ].filter(Boolean)),
        ]),
        slot.empty
          ? el('div.hint', { text: 'Hueco libre.' })
          : el('div.stack', { style: { marginTop: '8px', gap: '4px' } }, [
            el('div', { style: { fontSize: '17px', fontWeight: '800' }, text: `${meta.driverFlag || ''} ${meta.driverName || 'Piloto'}` }),
            el('div.dim', { style: { fontSize: '12px' }, text: `${meta.teamName || ''} · ronda ${meta.round ?? '—'} · P${meta.position ?? '—'} · ${meta.points ?? 0} pts` }),
            el('div.dim', { style: { fontSize: '11px' }, text: meta.savedAt ? `Guardado ${formatDate(meta.savedAt.slice(0, 10))}` : '' }),
          ]),
        el('div.row.row-tight', { style: { marginTop: '12px' } }, [
          slot.empty ? null : button('Cargar', {
            kind: 'primary',
            small: true,
            onClick: async () => {
              const data = readSlot(slot.index);
              if (!data) return;
              const { hydrateState } = await import('../../game/career.js');
              ctx.career = hydrateState(data.state || data);
              ctx.slot = slot.index;
              shell.toast('Partida cargada.', 'good');
              onPick?.(slot.index);
            },
          }),
          slot.empty ? null : button('Exportar', { kind: 'ghost', small: true, onClick: () => exportSlot(slot.index) }),
          slot.empty ? null : button('Borrar', {
            kind: 'ghost',
            small: true,
            onClick: async () => {
              const ok = await shell.modal({
                title: 'Borrar partida',
                body: el('p.hint', { text: `Se eliminará el hueco ${slot.index + 1} de forma permanente.` }),
                actions: [{ label: 'Borrar', kind: 'primary', value: 'ok' }, { label: 'Cancelar', value: null }],
              });
              if (ok === 'ok') {
                deleteSlot(slot.index);
                if (ctx.slot === slot.index) ctx.career = null;
                paint();
                shell.toast('Partida borrada.', 'warn');
              }
            },
          }),
        ].filter(Boolean)),
      ]);
    });

    shell.mount(el('div.screen', null, [
      el('div.screen-head', null, [
        el('div', null, [
          el('h2', { text: 'Partidas guardadas' }),
          el('div.sub', { text: `${SLOT_COUNT} huecos en este dispositivo, sin cuentas ni nube` }),
        ]),
        el('div.row.row-tight', null, [
          button('Importar', {
            kind: 'ghost',
            onClick: async () => {
              const json = await pickTextFile();
              if (!json) return;
              try {
                const index = importSlot(json);
                shell.toast(`Partida importada en el hueco ${index + 1}.`, 'good');
                paint();
              } catch (err) {
                shell.toast(err.message || 'No se pudo importar.', 'bad');
              }
            },
          }),
          onBack ? button('Volver', { kind: 'primary', onClick: onBack }) : null,
        ].filter(Boolean)),
      ]),
      el('div.grid.grid-3', null, cards),
      el('div.card', null, el('div.hint', { text: 'El autoguardado se escribe después de cada sesión. Si el navegador bloquea el almacenamiento, la partida solo vive en memoria.' })),
    ]));
    shell.setChrome({ title: 'Partidas', subtitle: `${slots.filter((s) => !s.empty).length} de ${SLOT_COUNT} en uso` });
  };

  paint();
}
