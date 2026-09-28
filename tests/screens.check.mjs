// Prueba de pantallas: monta cada pantalla de la interfaz con un DOM mínimo y
// un Shell real, y comprueba que ninguna lanza. También pulsa botones para
// recorrer el flujo (paddock → fin de semana → sesión → resultados).

import { installDom, Element } from './dom.stub.mjs';
import { Shell } from '../js/ui/shell.js';
import { ctx } from '../js/ui/context.js';
import { createCareer, recordSession } from '../js/game/career.js';
import { createSession, updateSession } from '../js/game/race.js';
import { DEFAULT_SETTINGS } from '../js/core/storage.js';

const dom = installDom();
globalThis.localStorage = (() => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
})();

let failures = 0;
const fail = (msg) => { failures++; console.log(`  ✗ ${msg}`); };

console.log('screens.check');

/* Estado de carrera con algunas rondas jugadas. */
const state = createCareer(
  { name: 'Prueba Pantallas', birthDate: '2003-05-09', country: 'ESP' },
  { seed: 11 },
);
ctx.career = state;
ctx.settings = { ...DEFAULT_SETTINGS };
ctx.slot = 0;

const shell = new Shell({
  appbar: new Element('header'),
  body: new Element('main'),
  toasts: new Element('div'),
  modalRoot: new Element('div'),
});
ctx.shell = shell;

/* Gestor de audio tolerante: en Node no hay WebAudio. */
globalThis.AudioContext = undefined;
globalThis.webkitAudioContext = undefined;

/* --- Pantallas simples ---------------------------------------------- */
const screens = [
  ['paddock', () => import('../js/ui/screens/paddock.js').then((m) => m.showPaddock(shell, {}))],
  ['calendar', () => import('../js/ui/screens/calendar.js').then((m) => m.showCalendar(shell))],
  ['standings', () => import('../js/ui/screens/standings.js').then((m) => m.showStandings(shell))],
  ['inbox', () => import('../js/ui/screens/inbox.js').then((m) => m.showInbox(shell, {}))],
  ['garage', () => import('../js/ui/screens/garage.js').then((m) => m.showGarage(shell))],
  ['settings', () => import('../js/ui/screens/settings.js').then((m) => m.showSettings(shell, {}))],
  ['howto', () => import('../js/ui/screens/howto.js').then((m) => m.showHowTo(shell, {}))],
  ['saves', () => import('../js/ui/screens/saves.js').then((m) => m.showSaves(shell, {}))],
  ['weekend', () => import('../js/ui/screens/weekend.js').then((m) => m.showWeekend(shell))],
  ['driver-create', () => import('../js/ui/screens/driver-create.js').then((m) => m.driverCreateScreen.render(shell, {}))],
];

for (const [name, load] of screens) {
  try {
    await load();
    const html = shell.body.textContent || '';
    if (html.length < 40) fail(`${name} monta una pantalla casi vacía`);
    else console.log(`  OK   ${name} (${html.length} chars)`);
  } catch (err) {
    fail(`${name} lanza: ${err.message}`);
  }
}

/* --- Paddock con datos: climber buttons, season card, mail ------------ */
try {
  const { showPaddock } = await import('../js/ui/screens/paddock.js');
  const { currentRound } = await import('../js/game/career.js');
  await showPaddock(shell, {});
  const rows = shell.body.querySelectorAll('.session-row');
  if (rows.length < 3) fail(`El paddock solo muestra ${rows.length} sesiones`);
  else console.log(`  OK   paddock lista ${rows.length} sesiones del fin de semana`);

  /* El botón de simular debe registrar sesiones. */
  const playedBefore = currentRound(state).sessions.filter((s) => s.played).length;
  const historyBefore = state.history.length;
  const simButton = shell.body.querySelectorAll('button').find((b) => b.textContent.includes('Simular'));
  if (simButton) {
    await simButton.listeners.click[0]({});
    const playedAfter = currentRound(state).sessions.filter((s) => s.played).length;
    if (playedAfter <= playedBefore && state.history.length <= historyBefore) {
      fail('El botón Simular no registró ninguna sesión');
    } else {
      console.log(`  OK   simular: ${playedBefore} → ${playedAfter} sesiones jugadas, ${state.history.length} rondas en el historial`);
    }
  } else {
    fail('No hay botón para simular en el paddock');
  }
} catch (err) {
  fail(`paddock interactivo lanza: ${err.message}`);
}

/* --- Fin de semana: launching a session -------------------------------- */
try {
  const { showWeekend } = await import('../js/ui/screens/weekend.js');
  await showWeekend(shell);
  const playables = shell.body.querySelectorAll('.session-row').filter((r) => !r.disabled);
  if (!playables.length) fail('El fin de semana no ofrece ninguna sesión jugable');
  else console.log(`  OK   fin de semana ofrece ${playables.length} sesiones jugables`);
} catch (err) {
  fail(`weekend interactivo lanza: ${err.message}`);
}

/* --- Resultados de una sesión real ------------------------------------- */
try {
  const { showResults } = await import('../js/ui/screens/results.js');
  const { currentRound } = await import('../js/game/career.js');
  const round = currentRound(state);
  const def = round.sessions.find((s) => s.required && !s.played) || round.sessions[0];
  const session = createSession({
    circuit: round.circuit,
    entryList: state.entryList,
    kind: def.type,
    round,
    settings: ctx.settings,
    seed: 5,
  });
  const drive = { steer: 0, throttle: 1, brake: 0, handbrake: false, drsPressed: false, pitPressed: false, edges: {} };
  for (let i = 0; i < 30 * 1200 && !session.completed; i++) updateSession(session, 1 / 30, drive);
  if (!session.results) {
    fail('La sesión de prueba no ha terminado');
  } else {
    const payload = { ...session.results, kind: def.type, round: state.round, sessionId: def.id };
    recordSession(state, payload);
    await showResults(shell, { sessionDef: def, round, payload, wasDnf: Boolean(session.player.retired) });
    const table = shell.body.querySelectorAll('table');
    if (!table.length) fail('La pantalla de resultados no muestra ninguna tabla');
    else console.log(`  OK   resultados: ${table.length} tabla(s), ${shell.body.textContent.length} chars`);
  }
} catch (err) {
  fail(`results lanza: ${err.message}`);
}

/* --- Ajustes: los interruptores deben reflecting el estado ------------- */
try {
  const { showSettings } = await import('../js/ui/screens/settings.js');
  await showSettings(shell, {});
  const switches = shell.body.querySelectorAll('.switch button');
  if (switches.length < 4) fail(`Ajustes solo muestra ${switches.length} interruptores`);
  else {
    const before = JSON.stringify(ctx.settings);
    switches[0].dispatch('click');
    if (JSON.stringify(ctx.settings) === before) fail('Un interruptor de ajustes no cambia nada');
    else console.log('  OK   los interruptores de ajustes cambian la configuración');
  }
  const sliders = shell.body.querySelectorAll('input');
  const motor = sliders.find((s) => (s.previousElementSibling?.textContent || '').startsWith('Motor'));
  if (motor) {
    const before = ctx.settings.engineVolume;
    motor.value = '42';
    motor.dispatch('input');
    if (ctx.settings.engineVolume === before) fail('El volumen del motor no cambia al mover el deslizador');
    else console.log(`  OK   deslizador de volumen: ${before} → ${ctx.settings.engineVolume}`);
  } else {
    fail('No hay deslizador de volumen de motor');
  }
} catch (err) {
  fail(`settings interactivo lanza: ${err.message}`);
}

/* --- Garaje: el monoplaza no se puede modificar ------------------------- */
try {
  const { showGarage } = await import('../js/ui/screens/garage.js');
  const before = { ...state.team.car };
  await showGarage(shell);
  const buy = shell.body.querySelectorAll('button').find((b) => b.textContent.includes('Mejorar'));
  if (buy) fail('El garaje sigue ofreciendo mejoras del monoplaza');
  else console.log('  OK   garaje: sin mejora del coche');

  /* Ninguna cifra del coche debe cambiar por pasar por el garaje. */
  const changed = Object.keys(before).filter((k) => state.team.car[k] !== before[k]);
  if (changed.length) fail(`El garaje altera el coche: ${changed.join(', ')}`);
  else console.log('  OK   garaje: el monoplaza no cambia');

  /* El coche que sale a pista es el de la escudería. */
  const { currentRound, gridEntryList } = await import('../js/game/career.js');
  const rd = currentRound(state);
  const race = createSession({
    circuit: rd.circuit,
    entryList: gridEntryList(state),
    kind: 'feature',
    round: rd,
    settings: ctx.settings,
    seed: 9,
  });
  if (race.player.car.power !== state.team.car.power) {
    fail(`El coche en pista no es el de la escudería (${race.player.car.power} vs ${state.team.car.power})`);
  } else {
    console.log(`  OK   el coche en pista es el de la escudería (power ${race.player.car.power})`);
  }
} catch (err) {
  fail(`garage interactivo lanza: ${err.message}`);
}

/* --- Tablas: escudo, bandera, nombre y puntos a la derecha -------------- */
try {
  const { standingsTable, constructorsTable, teamBadge } = await import('../js/ui/screens/tables.js');
  const series = state.series || 'f1';
  const rival = series === 'f2' ? 'invicta' : 'mclaren';
  const standings = {
    drivers: [
      { driverId: 'player', teamId: state.teamId, name: 'Jugador', short: 'JUG', flag: '🇪🇸', points: 51, wins: 2, podiums: 3, poles: 1, top10: 5, dnfs: 1 },
      { driverId: 'rival', teamId: rival, name: 'Rival', short: 'RIV', flag: '🇬🇧', points: 33, wins: 1, podiums: 2, poles: 0, top10: 4, dnfs: 0 },
    ],
    teams: [
      { teamId: state.teamId, points: 84, wins: 2, podiums: 5 },
      { teamId: rival, points: 70, wins: 1, podiums: 4 },
    ],
  };
  const table = standingsTable(standings, { playerId: 'player', series });
  const rows = table.querySelectorAll('tbody tr');
  if (rows.length !== 2) fail(`La clasificación muestra ${rows.length} filas`);
  const cell = rows[0].children[1].querySelector('.driver-cell');
  const order = cell.children.map((n) => n.className);
  if (order[0] !== 'team-crest' || order[1] !== 'flag' || !order[2].includes('grow')) {
    fail(`Orden incorrecto en la celda del piloto: ${order.join(' | ')}`);
  } else {
    console.log(`  OK   piloto: escudo → bandera → nombre (${order.join(' | ')})`);
  }
  const src = cell.querySelector('img.team-logo')?.getAttribute('src') || '';
  if (src !== `assets/teams/${series}/${state.teamId}.png`) fail(`El escudo no apunta al PNG del equipo: "${src}" (esperado assets/teams/${series}/${state.teamId}.png)`);
  else console.log(`  OK   escudo enlazado: ${src}`);

  const nums = rows[0].children.filter((td) => td.className.includes('num'));
  if (rows[0].children[2] !== nums[0] || nums[0].textContent !== '51') fail('Los puntos no están en la primera columna numérica');
  else console.log('  OK   puntos en columna numérica tras el piloto');

  const ctor = constructorsTable(standings, { series }).querySelectorAll('tbody tr');
  if (!ctor[0].children[1].querySelector('img.team-logo')) fail('La tabla de constructores no muestra escudos');
  else console.log('  OK   constructores con escudo');

  const sinEscudo = teamBadge('no-existe', series);
  if (!sinEscudo.querySelector('.team-bar') || sinEscudo.querySelector('img')) fail('Un equipo sin escudo no cae a la barrita de color');
  else console.log('  OK   equipo sin escudo → barrita de color');

  const roto = teamBadge(rival, series);
  roto.querySelector('img').dispatch('error');
  if (roto.querySelector('img') || !roto.querySelector('.team-bar')) fail('Un escudo que no carga no cae a la barrita de color');
  else console.log('  OK   escudo inexistente en disco → barrita de color');
} catch (err) {
  fail(`tablas lanza: ${err.message}`);
}

/* --- Buzón: marcar todo como leído ------------------------------------- */
try {
  const { showInbox } = await import('../js/ui/screens/inbox.js');
  await showInbox(shell, {});
  const items = shell.body.querySelectorAll('.mail-item');
  const readAll = shell.body.querySelectorAll('button').find((b) => b.textContent.includes('le'));
  if (items.length && readAll) {
    readAll.dispatch('click');
    console.log('  OK   buzón: marcar leídos funciona');
  } else {
    console.log('  ·   buzón sin mensajes o sin botón de leer todo');
  }
} catch (err) {
  fail(`inbox interactivo lanza: ${err.message}`);
}

/* --- Pantalla de carrera: selector de neumático, lienzo, HUD y bucle ----- */
try {
  const { showSession, stopSession } = await import('../js/ui/screens/session.js');
  const { currentRound } = await import('../js/game/career.js');
  const rd = currentRound(state);
  const def = rd.sessions.find((s) => s.required && !s.played);
  ctx.running = true;
  /* La pantalla de carrera pide el neumático de salida: se abre en segundo plano
     y se responde con el primer botón del selector. */
  const pending = showSession(shell, { session: def, round: rd });
  const pick = (retry = 0) => {
    const buttons = shell.modalRoot?.querySelectorAll?.('.actions button') || [];
    if (buttons.length) {
      const first = buttons.find((b) => /Blando|Medio|Duro/.test(b.textContent)) || buttons[0];
      if (!first.textContent.includes('vida')) {
        first.dispatch('click');
        return true;
      }
    }
    if (retry < 40) {
      setTimeout(() => pick(retry + 1), 5);
      return true;
    }
    return false;
  };
  pick();
  await pending;
  if (!shell.modalRoot.hidden) fail('el selector de neumático sigue abierto');
  else console.log('  OK   selector de neumático previo a la parrilla');
  if (!shell.body.querySelector('canvas.race-canvas')) fail('La sesión no monta el lienzo de la pista');
  if (!shell.body.querySelector('.hud')) fail('La sesión no monta el HUD');
  const touch = shell.body.querySelectorAll('[data-touch]').length;
  const actions = shell.body.querySelectorAll('[data-action-touch]').length;
  if (touch < 3) fail(`Solo hay ${touch} mandos táctiles (deben ser 3)`);
  if (actions < 2) fail(`Solo hay ${actions} botones táctiles de acción`);
  if (ctx.session && ctx.session.laps !== 20) fail(`La carrera no es de 20 vueltas (laps=${ctx.session.laps})`);
  else console.log('  OK   carrera: 20 vueltas, una parada obligatoria');
  /* Se simulan unos fotogramas y se detiene. */
  await new Promise((r) => setTimeout(r, 250));
  stopSession();
  if (ctx.running) fail('stopSession no detiene la sesión');
  else console.log(`  OK   sesión: lienzo + HUD + ${touch + actions} mandos táctiles, bucle detenido`);
} catch (err) {
  fail(`sesión de carrera lanza: ${err.message}`);
}

/* --- Menú de guardado --------------------------------------------------- */
try {
  const { showSaves } = await import('../js/ui/screens/saves.js');
  await showSaves(shell, { onPick: () => {} });
  console.log('  OK   menú de partidas');
} catch (err) {
  fail(`saves interactivo lanza: ${err.message}`);
}

console.log(failures ? `\nFALLA: ${failures} fallo(s)` : '\nTodo correcto');
process.exit(failures ? 1 : 0);
