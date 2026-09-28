// Ajustes: sonido, ayudas de conducción y datos.

import { el, button, segmented, toggle } from '../dom.js';
import { RACE_LAPS, SPRINT_LAPS, MAX_PIT_STOPS } from '../../game/race.js';
import { storageInfo, downloadText, DEFAULT_SETTINGS } from '../../core/storage.js';
import { audio } from '../../core/audio.js';
import { ctx, setSettings } from '../context.js';

const DIFFICULTY = {
  amateur: { label: 'Aficionado', desc: 'Estabilidad alta, IA más lenta y menos desgaste.' },
  pro: { label: 'Profesional', desc: 'Equilibrio de carrera.' },
  legendary: { label: 'Leyenda', desc: 'IA rápida y recuperación limitada tras errores.' },
};

export async function showSettings(shell, { onBack } = {}) {
  const paint = () => {
    const s = ctx.settings;
    shell.mount(el('div.screen', null, [
      el('div.screen-head', null, [
        el('div', null, [
          el('h2', { text: 'Ajustes' }),
          el('div.sub', { text: 'Se guardan en este dispositivo' }),
        ]),
        onBack ? button('Volver', { kind: 'primary', onClick: onBack }) : null,
      ]),
      el('div.grid.grid-side', null, [
        el('div.stack', null, [
          el('div.card', null, [
            el('h3', { text: 'Conducción' }),
            el('div.field', null, [
              el('label', { text: 'Dificultad' }),
              segmented(Object.entries(DIFFICULTY).map(([value, d]) => ({ value, label: d.label })), s.difficulty, (value) => {
                setSettings({ difficulty: value });
                paint();
              }),
              el('div.err', { text: DIFFICULTY[s.difficulty]?.desc || '' }),
            ]),
            toggle('Ayudas de conducción', 'Control de tracción, ABS y asistencia de dirección', s.assists, (v) => { setSettings({ assists: v }); }),
            toggle('Control de tracción', null, s.tractionControl, (v) => { setSettings({ tractionControl: v }); }),
            toggle('ABS', null, s.abs, (v) => { setSettings({ abs: v }); }),
            toggle('Freno automático', null, s.brakeAssist, (v) => { setSettings({ brakeAssist: v }); }),
            toggle('DRS automático', 'Abre la palanca al entrar en zona', s.autoDrs, (v) => { setSettings({ autoDrs: v }); }),
            el('div.field', null, [
              el('label', { text: `Asistencia de dirección ${Math.round(s.steeringAssist * 100)}%` }),
              el('input', {
                type: 'range', min: '0', max: '100', value: String(Math.round(s.steeringAssist * 100)),
                on: {
                  input: (e) => {
                    setSettings({ steeringAssist: Number(e.target.value) / 100 });
                    e.target.previousElementSibling.textContent = `Asistencia de dirección ${e.target.value}%`;
                  },
                },
              }),
            ]),
            el('div.field', null, [
              el('label', { text: `Estabilidad ${Math.round(s.stability * 100)}%` }),
              el('input', {
                type: 'range', min: '0', max: '100', value: String(Math.round(s.stability * 100)),
                on: {
                  input: (e) => {
                    setSettings({ stability: Number(e.target.value) / 100 });
                    e.target.previousElementSibling.textContent = `Estabilidad ${e.target.value}%`;
                  },
                },
              }),
            ]),
          ]),
          el('div.card', null, [
            el('h3', { text: 'Sesión' }),
            el('p.muted', { text: `Las carreras son siempre de ${RACE_LAPS} vueltas (el sprint, ${SPRINT_LAPS}) con ${MAX_PIT_STOPS === 1 ? 'una' : MAX_PIT_STOPS} parada obligatoria y una sola salida en seco.` }),
            el('div.field', null, [
              el('label', { text: 'Unidades' }),
              segmented([{ value: 'metric', label: 'Métrico (km/h)' }, { value: 'imperial', label: 'Imperial (mph)' }], s.units, (value) => {
                setSettings({ units: value });
                paint();
              }),
            ]),
            toggle('Minimapa', null, s.showMinimap, (v) => { setSettings({ showMinimap: v }); ctx.hud?.setMinimapVisible(v); }),
            toggle('Cronometría en pantalla', null, s.showTiming, (v) => { setSettings({ showTiming: v }); }),
            toggle('Reducir movimiento', 'Menos animaciones y transiciones', s.reduceMotion, (v) => { setSettings({ reduceMotion: v }); }),
          ]),
        ]),
        el('div.stack', null, [
          el('div.card', null, [
            el('h3', { text: 'Sonido' }),
            toggle('Sonido', 'Silencia todo el juego', s.sound, (v) => {
              setSettings({ sound: v });
              audio.setEnabled(v);
              paint();
            }),
            toggle('Efectos', null, s.sfx, (v) => { setSettings({ sfx: v }); }),
            el('div.field', null, [
              el('label', { text: `Motor ${Math.round(s.engineVolume * 100)}%` }),
              el('input', {
                type: 'range', min: '0', max: '100', value: String(Math.round(s.engineVolume * 100)),
                on: { input: (e) => { setSettings({ engineVolume: Number(e.target.value) / 100 }); applyVolumes(); } },
              }),
            ]),
            el('div.field', null, [
              el('label', { text: `Música ${Math.round(s.musicVolume * 100)}%` }),
              el('input', {
                type: 'range', min: '0', max: '100', value: String(Math.round(s.musicVolume * 100)),
                on: { input: (e) => { setSettings({ musicVolume: Number(e.target.value) / 100 }); applyVolumes(); } },
              }),
            ]),
            el('div.field', null, [
              el('label', { text: `Público ${Math.round(s.crowdVolume * 100)}%` }),
              el('input', {
                type: 'range', min: '0', max: '100', value: String(Math.round(s.crowdVolume * 100)),
                on: { input: (e) => { setSettings({ crowdVolume: Number(e.target.value) / 100 }); applyVolumes(); } },
              }),
            ]),
          ]),
          el('div.card', null, [
            el('h3', { text: 'Datos' }),
            el('div.hint', { text: storageText() }),
            el('div.row.row-tight', { style: { marginTop: '10px' } }, [
              button('Restablecer', {
                kind: 'ghost',
                onClick: async () => {
                  const ok = await shell.modal({
                    title: 'Restablecer ajustes',
                    body: el('p.hint', { text: 'Se vuelven a los valores de fábrica. Las partidas guardadas no se tocan.' }),
                    actions: [{ label: 'Sí', kind: 'primary', value: 'ok' }, { label: 'Cancelar', value: null }],
                  });
                  if (ok === 'ok') {
                    setSettings({ ...DEFAULT_SETTINGS });
                    applyVolumes();
                    paint();
                    shell.toast('Ajustes restablecidos.', 'good');
                  }
                },
              }),
              button('Descargar datos', {
                kind: 'ghost',
                onClick: () => {
                  downloadText('predestinato-ajustes.json', JSON.stringify(ctx.settings, null, 2));
                  shell.toast('Ajustes descargados.', 'good');
                },
              }),
            ]),
          ]),
        ]),
      ]),
    ]));
    shell.setChrome({ title: 'Ajustes', subtitle: 'Conducción, sesión y sonido' });
  };

  const applyVolumes = () => audio.setVolumes({
    engine: ctx.settings.engineVolume,
    music: ctx.settings.musicVolume,
    crowd: ctx.settings.crowdVolume,
  });

  paint();
}

function storageText() {
  const info = storageInfo();
  const where = info.inMemory ? 'memoria temporal (sin almacenamiento persistente)' : 'almacenamiento local';
  return `${info.kilobytes} KB usados en ${where}.`;
}
