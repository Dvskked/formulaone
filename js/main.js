// Punto de entrada: pantalla de carga, menú principal y arranque de la aplicación.
// Todo se monta dentro de init() para que el módulo pueda importarse sin DOM.

import { $, el } from './ui/dom.js';
import { Shell } from './ui/shell.js';
import { ctx, setSettings } from './ui/context.js';
import { MenuBackground } from './render/menu-bg.js';
import { audio, audioBoot } from './core/audio.js';
import { listSlots, lastSlotIndex, readSlot, SLOT_COUNT } from './core/storage.js';
import { TIPS } from './ui/tips.js';

let shell = null;
let menuBg = null;
let dom = null;

const BOOT_STEPS = [
  ['Iniciando motores', () => { audioBoot(); }],
  ['Cargando circuitos', async () => { const m = await import('./data/circuits.js'); ctx.circuitCount = m.circuitCount(); }],
  ['Cargando calendario', async () => { await import('./data/calendar.js'); }],
  ['Cargando pilotos', async () => { await import('./data/drivers.js'); }],
  ['Cargando escuderías', async () => { await import('./data/teams.js'); }],
  ['Preparando la física', async () => { await import('./game/car.js'); }],
  ['Afinando el motor de carrera', async () => { await import('./game/race.js'); }],
  ['Montando la interfaz', () => { setupShell(); }],
  ['Listo', () => { finishBoot(); }],
];

/* ─────────────────────────── Arranque ─────────────────────────── */

async function runBoot() {
  dom.boot.tip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  for (let i = 0; i < BOOT_STEPS.length; i++) {
    const [label, run] = BOOT_STEPS[i];
    dom.boot.status.textContent = label;
    const pct = Math.round(((i + 1) / BOOT_STEPS.length) * 100);
    dom.boot.pct.textContent = `${pct}%`;
    dom.boot.fill.style.width = `${pct}%`;
    await new Promise((r) => setTimeout(r, 90 + Math.random() * 130));
    try {
      await run();
    } catch (err) {
      console.error(`Fallo en «${label}»`, err);
    }
  }
}

function finishBoot() {
  dom.boot.root.style.transition = 'opacity .45s ease';
  dom.boot.root.style.opacity = '0';
  setTimeout(() => {
    dom.boot.root.hidden = true;
    showMenu();
  }, 460);
}

/* ─────────────────────────── Menú ─────────────────────────── */

function showMenu() {
  dom.menu.root.hidden = false;
  dom.app.root.hidden = true;
  menuBg?.start();
  refreshMenuCards();
  renderMenuSide();
}

function hideMenu() {
  dom.menu.root.hidden = true;
  menuBg?.stop();
  dom.app.root.hidden = false;
}

function refreshMenuCards() {
  const withData = listSlots().filter((s) => !s.empty);
  const last = withData.find((s) => s.index === lastSlotIndex()) || withData[0] || null;
  const btn = dom.menu.continueBtn;
  if (last) {
    const meta = last.meta || {};
    btn.disabled = false;
    dom.menu.continueTitle.textContent = `Continuar · ${meta.driverName || 'Piloto'}`;
    dom.menu.continueDesc.textContent = `${meta.series === 'f1' ? 'F1' : 'F2'} · ${meta.teamName || 'sin equipo'} · ronda ${meta.round ?? '—'} · ${meta.points ?? 0} pts`;
    btn.onclick = () => startCareer(last.index);
  } else {
    btn.disabled = true;
    dom.menu.continueTitle.textContent = 'Modo Carrera';
    dom.menu.continueDesc.textContent = 'No hay ninguna carrera guardada en este dispositivo.';
    btn.onclick = null;
  }
  dom.menu.soundBtn.textContent = ctx.settings.sound ? 'Sonido ON' : 'Sonido OFF';
  dom.menu.soundBtn.setAttribute('aria-pressed', String(Boolean(ctx.settings.sound)));
  const total = withData.length;
  dom.menu.foot.textContent = total
    ? `${total} de ${SLOT_COUNT} huecos en uso. Todo ocurre en tu dispositivo, sin cuentas ni nube.`
    : 'Todo ocurre en tu dispositivo. Sin anuncios, sin registro, sin instalaciones.';
}

function renderMenuSide() {
  const slots = listSlots();
  dom.menu.side.textContent = '';
  dom.menu.side.append(
    el('div.info-card', null, [
      el('h3', { text: 'Temporada 2026' }),
      el('div.big', { text: '23 + 14' }),
      el('div.hint', { text: 'Grandes premios de F1 y citas de F2, con seis fines de semana de Sprint en F1.' }),
    ]),
    el('div.info-card', null, [
      el('h3', { text: 'Modo Carrera' }),
      el('ul', null, [
        el('li', { text: 'Empiezas en F2 con un equipo a elegir.' }),
        el('li', { text: 'Clasifícate en el podio final para subir a F1.' }),
        el('li', { text: 'Garaje, buzón y objetivos entre semana.' }),
      ]),
    ]),
    el('div.info-card', null, [
      el('h3', { text: 'Partidas' }),
      el('div.row.between', null, [
        el('span.muted', { text: 'Huecos usados' }),
        el('b.mono', { text: `${slots.filter((s) => !s.empty).length}/${SLOT_COUNT}` }),
      ]),
    ]),
  );
}

/* ─────────────────────────── Aplicación ─────────────────────────── */

const NAV_ITEMS = [
  { id: 'paddock', label: 'Paddock' },
  { id: 'calendar', label: 'Calendario' },
  { id: 'standings', label: 'Mundial' },
  { id: 'inbox', label: 'Buzón' },
  { id: 'garage', label: 'Garaje' },
];

function setupShell() {
  shell = new Shell({
    appbar: $('#appbar'),
    body: $('#app-body'),
    toasts: $('#toasts'),
    modalRoot: $('#modal-root'),
  });
  ctx.shell = shell;
  shell.setNav(NAV_ITEMS);
  shell.onNavigate = (id) => navigate(id);
}

async function navigate(id) {
  if (ctx.running || !ctx.career) return;
  shell.setNav(NAV_ITEMS);
  shell.setActive(id);
  const screens = {
    paddock: () => import('./ui/screens/paddock.js').then((m) => m.showPaddock(shell, {})),
    calendar: () => import('./ui/screens/calendar.js').then((m) => m.showCalendar(shell)),
    standings: () => import('./ui/screens/standings.js').then((m) => m.showStandings(shell)),
    inbox: () => import('./ui/screens/inbox.js').then((m) => m.showInbox(shell, {})),
    garage: () => import('./ui/screens/garage.js').then((m) => m.showGarage(shell)),
  };
  await screens[id]?.();
}

/** Entra en la aplicación con la partida del hueco indicado. */
function startCareer(slotIndex) {
  const data = readSlot(slotIndex);
  if (!data) {
    refreshMenuCards();
    return;
  }
  ctx.career = data.state;
  ctx.slot = slotIndex;
  hideMenu();
  navigate('paddock');
  audio.startMusic('menu');
}

/** Arranca una carrera nueva desde la pantalla de creación de piloto. */
async function startNewCareer() {
  const { driverCreateScreen } = await import('./ui/screens/driver-create.js');
  const free = listSlots().find((s) => s.empty);
  ctx.slot = free ? free.index : 0;
  ctx.career = null;
  hideMenu();
  shell.stack.length = 0;
  shell.current = driverCreateScreen;
  await driverCreateScreen.render(shell, {});
  shell.setChrome({ title: driverCreateScreen.title, subtitle: driverCreateScreen.subtitle });
}

async function openOverlay(loader, extra = {}) {
  const mod = await loader();
  hideMenu();
  dom.app.root.hidden = false;
  await mod(shell, {
    ...extra,
    onBack: () => {
      dom.app.root.hidden = true;
      showMenu();
    },
  });
}

/* ─────────────────────────── Ciclo de vida ─────────────────────────── */

function wireMenu() {
  dom.menu.newBtn.addEventListener('click', startNewCareer);
  dom.menu.savesBtn.addEventListener('click', () => openOverlay(() => import('./ui/screens/saves.js').then((m) => m.showSaves), {
    onPick: () => {
      dom.app.root.hidden = true;
      startCareer(ctx.slot);
    },
  }));
  dom.menu.howBtn.addEventListener('click', () => openOverlay(() => import('./ui/screens/howto.js').then((m) => m.showHowTo)));
  dom.menu.settingsBtn.addEventListener('click', () => openOverlay(() => import('./ui/screens/settings.js').then((m) => m.showSettings)));
  dom.menu.soundBtn.addEventListener('click', () => {
    const on = !ctx.settings.sound;
    setSettings({ sound: on });
    audio.setEnabled(on);
    refreshMenuCards();
    audio.sfx('click');
  });
}

function wireLifecycle() {
  window.addEventListener('resize', () => menuBg?.resize());
  window.addEventListener('beforeunload', () => {
    if (ctx.career && ctx.slot !== null) {
      import('./ui/save.js').then((m) => m.persist()).catch(() => {});
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.stopLoops();
    else if (!ctx.running) audio.startMusic('menu');
  });
}

function init() {
  dom = {
    boot: {
      root: $('#boot'), fill: $('#boot-fill'), status: $('#boot-status'),
      pct: $('#boot-pct'), tip: $('#boot-tip'),
    },
    menu: {
      root: $('#menu'), side: $('#menu-side'),
      continueBtn: $('#mc-continue'), continueTitle: $('#mc-continue-title'), continueDesc: $('#mc-continue-desc'),
      newBtn: $('#mc-new'), savesBtn: $('#mc-saves'), howBtn: $('#mc-how'),
      soundBtn: $('#menu-sound'), settingsBtn: $('#menu-settings'), foot: $('#menu-foot-text'),
    },
    app: { root: $('#app') },
  };
  menuBg = new MenuBackground($('#menu-canvas'));
  wireMenu();
  wireLifecycle();
  runBoot();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}
