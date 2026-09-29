// Pantalla de sesión: monta el lienzo, el HUD y el bucle de simulación.
// Es la pantalla más pesada: mantiene su propio requestAnimationFrame y
// detiene el resto de la interfaz mientras corre.

import { el, button, formatTime } from '../dom.js';
import { createSession, updateSession, RACE_LAPS, SPRINT_LAPS, MAX_PIT_STOPS } from '../../game/race.js';
import { TYRES, TYRE_ORDER, tyrePace } from '../../game/car.js';
import { getCircuit } from '../../data/circuits.js';
import { recordSession, currentRound, roundFinished, advanceToNextRound, gridEntryList } from '../../game/career.js';
import { TrackView } from '../../render/track-view.js';
import { Hud } from '../../render/hud.js';
import { input } from '../../core/input.js';
import { audio } from '../../core/audio.js';
import { ctx, buildTeamIndex } from '../context.js';
import { autosave } from '../save.js';

const SIM_STEP = 1 / 60;

/** Vueltas según el tipo de sesión. */
function lapsFor(kind) {
  if (kind === 'sprint') return SPRINT_LAPS;
  if (kind === 'feature') return RACE_LAPS;
  return 0;
}

/**
 * Pantalla previa a la parrilla: el jugador elige con qué neumático sale.
 * Los blandos son los más rápidos pero duran 7 vueltas, así que hay que
 * llegar a la parada con ellos.
 */
async function pickStartTyre(shell, { laps, lastTyre }) {
  const detail = (id) => {
    const t = TYRES[id];
    const pace = Math.round((tyrePace(id, 0) - 1) * 100);
    return `${t.name} · vida ${t.life} vueltas · ${pace >= 0 ? '+' : ''}${pace}% de ritmo`;
  };
  const pick = await shell.modal({
    title: 'Neumático de salida',
    body: el('div.stack', null, [
      el('p.muted', {
        text: `${laps} vueltas y ${MAX_PIT_STOPS} parada${MAX_PIT_STOPS > 1 ? 's' : ''} obligatoria${MAX_PIT_STOPS > 1 ? 's' : ''}. Elige con qué compuesto sales: el desgaste llega al final de su vida.`,
      }),
      el('ul.tyre-list', null, TYRE_ORDER.map((id) =>
        el('li.tyre-item', null, [
          el('span.tyre-dot', { style: `background:${TYRES[id].color}` }),
          el('span.tyre-name', { text: TYRES[id].name }),
          el('span.tyre-life', { text: detail(id) }),
        ])
      )),
      el('p.muted.hint', { text: `Salir con el ${TYRES[lastTyre]?.name || 'medio'} te permite alargar la primera entrada.`, }),
    ]),
    actions: TYRE_ORDER.map((id) => ({
      label: TYRES[id].name,
      kind: id === (lastTyre || 'medium') ? 'primary' : 'ghost',
      value: id,
    })),
    dismissable: true,
  });
  return TYRES[pick] ? pick : lastTyre || 'medium';
}

let active = null;

/** Detiene cualquier sesión en curso. */
export function stopSession() {
  if (!active) return;
  active.stop();
  active = null;
}

export async function showSession(shell, { session: sessionDef, round } = {}) {
  const state = ctx.career;
  stopSession();
  shell.closeAllModals();
  shell.stack.length = 0;
  resetAudioTriggers();

  const raceRound = round || currentRound(state);
  const circuit = getCircuit(raceRound.circuitId);
  const teamsById = buildTeamIndex(state.series);

  /* Elección de neumático antes de salir a pista */
  const laps = lapsFor(sessionDef.type);
  const startTyre = laps > 0
    ? await pickStartTyre(shell, { laps, lastTyre: ctx.settings.startTyre || 'medium' })
    : 'soft';
  if (laps > 0) ctx.settings.startTyre = startTyre;

  const session = createSession({
    circuit,
    entryList: gridEntryList(state),
    kind: sessionDef.type,
    round: raceRound,
    settings: ctx.settings,
    seed: `${state.seed}|${state.series}|${state.round}|${sessionDef.id}`,
    startTyre,
  });
  ctx.session = session;

  const canvas = el('canvas.race-canvas');
  const hudRoot = el('div');
  const touch = el('div.touch', null, [
    el('div.pad.pad-steer', { dataset: { touch: 'steer' } }, el('div.stick')),
    el('div.pad.pad-thr', { dataset: { touch: 'throttle' }, text: 'ACELERAR' }),
    el('div.pad.pad-brk', { dataset: { touch: 'brake' }, text: 'FRENO' }),
    el('div.pad.pad-drs', { dataset: { actionTouch: 'drs' }, text: 'DRS' }),
    el('div.pad.pad-pit', { dataset: { actionTouch: 'pit' }, text: 'BOXES' }),
  ]);
  const pauseBtn = el('button.btn.btn-ghost.hud-btn', { type: 'button', text: '||', title: 'Pausa (Esc)' });

  const wrap = el('div.race', null, [canvas, hudRoot, touch, pauseBtn]);
  shell.mount(wrap);
  shell.setNav([]);
  shell.setChrome({
    title: `${sessionDef.name} · ${circuit.name}`,
    subtitle: laps > 0
      ? `${raceRound.flag} ${raceRound.gp} · ${laps} vueltas · ${MAX_PIT_STOPS} parada obligatoria · ${TYRES[startTyre].name}`
      : `${raceRound.flag} ${raceRound.gp} · ${circuit.length} km`,
    chips: [
      el('span.chip.chip-red', { text: state.series === 'f1' ? 'F1' : 'F2' }),
      el('span.chip', { text: 'Seco' }),
      laps > 0 ? el('span.chip', { text: `${TYRES[startTyre].name} · ${TYRES[startTyre].life} vueltas` }) : null,
    ].filter(Boolean),
  });

  const view = new TrackView(canvas);
  view.setTrack(session.track, teamsById);
  const hud = new Hud(hudRoot);
  hud.setTrack(session.track);
  hud.setUnits(ctx.settings.units);
  hud.setMinimapVisible(ctx.settings.showMinimap !== false);
  ctx.view = view;
  ctx.hud = hud;

  input.attach(window);
  input.setDrivingEnabled(true);
  input.captureText = false;
  if (window.matchMedia?.('(pointer: coarse)').matches) {
    touch.classList.add('on');
    input.bindTouch(touch);
  }

  audio.resume();
  audio.startEngine({ series: state.series });
  audio.setCrowd(session.kind === 'feature' || session.kind === 'sprint' ? 0.5 : 0.12);

  const runner = {
    session,
    raf: 0,
    accumulator: 0,
    last: performance.now(),
    paused: false,
    finished: false,
    countdown: session.phase === 'countdown' ? 5.9 : 0,
    startedAt: Date.now(),
    pitPrompt: false,
    resizeFrames: 30,
    errores: 0,
    stop() {
      if (this.raf) cancelAnimationFrame(this.raf);
      if (this.onResize) window.removeEventListener('resize', this.onResize);
      if (this.onKey) window.removeEventListener('keydown', this.onKey);
      this.aviso?.remove();
      input.setDrivingEnabled(false);
      input.detach();
      audio.stopEngine();
      audio.stopLoops();
      audio.setCrowd(0);
      ctx.session = null;
      ctx.view = null;
      ctx.hud = null;
      ctx.running = false;
    },
  };
  active = runner;
  ctx.running = true;

  const onResize = () => {
    view.resize();
    hud.minimap.layout();
  };
  window.addEventListener('resize', onResize);
  runner.onResize = onResize;

  const onKey = (e) => {
    if (e.code === 'Escape' || e.code === 'Tab') {
      e.preventDefault();
      togglePause();
    } else if (e.code === 'KeyC') {
      shell.toast(`Cámara: ${view.cycleCamera()}`, 'warn');
    } else if (e.code === 'Digit4' || e.code === 'Digit5' || e.code === 'Digit6') {
      setSimSpeed(Number(e.code.slice(5)) - 3);
    }
  };
  window.addEventListener('keydown', onKey);
  runner.onKey = onKey;

  const setSimSpeed = (value) => {
    const speeds = [1, 2, 3];
    const next = speeds.includes(value) ? value : 1;
    ctx.settings.simSpeed = next;
    shell.toast(`Simulación ×${next}`, 'warn');
  };
  runner.setSimSpeed = setSimSpeed;

  const togglePause = async () => {
    if (runner.finished) return;
    runner.paused = !runner.paused;
    if (runner.paused) {
      input.setDrivingEnabled(false);
      const choice = await shell.modal({
        title: 'Pausa',
        body: el('div.stack', null, [
          el('div.row.row-tight', null, [
            el('span.chip', {
              text: session.laps > 0
                ? `Vuelta ${Math.max(1, session.player.lap)}/${session.laps}`
                : `Vuelta ${Math.max(1, session.player.lap)} · ${formatTime(session.clock * 1000)} de ${formatTime(session.duration * 1000)}`,
            }),
            el('span.chip', { text: `P${session.player.position}` }),
            el('span.chip', { text: `Mejor ${formatTime(session.player.bestLapMs)}` }),
          ]),
          el('div.hint', { text: 'C: cambia de cámara · 4/5/6: velocidad de simulación · P: entrar en boxes · R: reincorporarse.' }),
        ]),
        actions: [
          { label: 'Continuar', kind: 'primary', value: 'resume' },
          { label: 'Reiniciar sesión', value: 'restart' },
          { label: 'Abandonar', value: 'quit' },
        ],
        dismissable: true,
        onClose: () => {
          if (runner.finished) return;
          runner.paused = false;
          input.setDrivingEnabled(true);
        },
      });
      if (choice === 'restart') {
        runner.stop();
        await showSession(shell, { session: sessionDef, round: raceRound });
      } else if (choice === 'quit') {
        runner.stop();
        ctx.career = state;
        const { showPaddock } = await import('./paddock.js');
        await showPaddock(shell, {});
      }
    } else {
      input.setDrivingEnabled(true);
    }
  };
  runner.togglePause = togglePause;
  pauseBtn.addEventListener('click', togglePause);

  const finish = async () => {
    if (runner.finished) return;
    runner.finished = true;
    runner.stop();
    audio.sfx('finish');

    const payload = { ...session.results, kind: sessionDef.type, round: state.round, sessionId: sessionDef.id };
    recordSession(state, payload);
    if (roundFinished(state)) advanceToNextRound(state);
    autosave();

    const { showResults } = await import('./results.js');
    await showResults(shell, { sessionDef, round: raceRound, payload, wasDnf: Boolean(session.results.entries.find((e) => e.driverId === state.driver.id)?.retired) });
  };

  /* El fotograma se pide ANTES de dibujar y todo va protegido: si algo falla
     una vez, la sesión sigue corriendo en vez de dejar la pantalla en negro
     con el motor sonando. */
  const frame = (now) => {
    if (!active) return;
    runner.raf = requestAnimationFrame(frame);
    try {
      const wall = Math.min(0.1, (now - runner.last) / 1000);
      runner.last = now;

      if (!runner.paused) {
        const speed = ctx.settings.simSpeed || 1;
        runner.accumulator += wall * speed;
        let steps = 0;
        const controls = input.driving(SIM_STEP);
        runner.controls = controls;
        while (runner.accumulator >= SIM_STEP && steps < 12) {
          updateSession(session, SIM_STEP, controls);
          runner.accumulator -= SIM_STEP;
          steps++;
        }
        if (steps >= 12) runner.accumulator = 0;
        input.endFrame();
        /* El sonido va aparte: si el navegador no tiene Web Audio, o falla un
           nodo, la carrera sigue igual. */
        try { updateAudio(session, controls); } catch { /* audio sin audio */ }
        checkEvents(session);
      }

      /* Si el lienzo no tenía tamaño real (ventana oculta al montar, carga
         tardía), se reintenta hasta que lo tenga. */
      if (runner.resizeFrames > 0) {
        runner.resizeFrames -= 1;
        if (!view.listo) { view.resize(); runner.resizeFrames = 30; }
      }
      view.draw(session);
      hud.update(session);

      if (session.completed && !runner.finished) {
        finish();
      }
    } catch (err) {
      runner.errores = (runner.errores || 0) + 1;
      if (runner.errores < 3) console.error('Error en el bucle de sesión', err);
      if (runner.errores === 3) {
        /* Un fallo de dibujo no puede quedarse en negro y sin decir nada: se
           avisa en pantalla con el motivo y se sigue jugando. */
        shell.toast('Aviso: ha habido un fallo al dibujar la pista.', 'bad');
        const aviso = el('div.race-error', null, [
          el('b', { text: 'Fallo al dibujar la pista' }),
          el('span', { text: String(err && err.message ? err.message : err).slice(0, 160) }),
        ]);
        wrap.appendChild(aviso);
        runner.aviso = aviso;
      }
    }
  };
  runner.raf = requestAnimationFrame(frame);

  shell.toast(`${sessionDef.name}: pulsa Esc para pausar.`, 'warn');
  return runner;
}

function updateAudio(session, controls = {}) {
  const p = session.player;
  if (!p) return;
  const throttle = Math.max(0, controls.throttle || 0);
  const brake = Math.max(0, controls.brake || 0);
  audio.updateEngine({
    rpm: p.rpm || 900,
    speed: p.speed || 0,
    throttle: p.speed < 1 ? 0.35 : throttle,
    load: p.drsOpen ? 1 : 0.45 + throttle * 0.55,
  });
  const sliding = !p.onTrack ? 0.55 : (brake > 0.6 && p.speed > 25 ? 0.22 : 0.04);
  audio.setTireScreech(p.speed > 10 ? sliding : 0);
  audio.setSurface(p.onTrack ? 0.12 : 0.5);
}

let lastLap = 1;
let lastPhase = '';
let lastLights = 0;
let lastGear = 1;
let lastDrs = false;
let lastRetired = false;

/** Reinicia los disparadores de sonido entre sesiones. */
function resetAudioTriggers() {
  lastLap = 1;
  lastPhase = '';
  lastLights = 0;
  lastGear = 1;
  lastDrs = false;
  lastRetired = false;
}

function checkEvents(session) {
  const p = session.player;
  if (session.phase !== lastPhase) {
    if (session.phase === 'green') audio.sfx('beepGo');
    lastPhase = session.phase;
  }
  /* Una baliza por luz roja encendida, y el pitido largo al apagarse todas */
  if (session.lights !== lastLights) {
    if (session.lights > lastLights) audio.sfx('beep');
    lastLights = session.lights;
  }
  if (p.lap !== lastLap) {
    lastLap = p.lap;
    audio.sfx('lap');
  }
  if (p.gear !== lastGear) {
    lastGear = p.gear;
    if (p.gear > 1) audio.sfx('gear');
  }
  if (p.drsOpen && !lastDrs) audio.sfx('drs');
  lastDrs = p.drsOpen;
  if (p.retired && !lastRetired) audio.sfx('crash');
  lastRetired = p.retired;
}
