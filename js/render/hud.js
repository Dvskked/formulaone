// HUD de carrera: se construye con DOM (texto nítido y accesible) y se
// sincroniza con el estado de sesión en cada fotograma.

import { el, formatTime, formatGap } from '../ui/dom.js';
import { Minimap } from './minimap.js';
import { TYRE_STYLE } from './palette.js';

const SECTOR_LABELS = ['S1', 'S2', 'S3'];

export class Hud {
  constructor(root) {
    this.root = root;
    this.minimapVisible = true;
    this.units = 'metric';
    this.bestSectors = [Infinity, Infinity, Infinity];
    this.build();
  }

  build() {
    this.root.className = 'hud';
    this.root.textContent = '';

    this.posBox = el('div.hud-box', null, [
      el('div.hud-pos', null, [el('b', { text: '—' }), el('span', { text: '/—' })]),
      el('div.hud-laps', null, [el('b', { text: 'V1' }), ' vuelta']),
    ]);
    this.posValue = this.posBox.querySelector('.hud-pos b');
    this.posTotal = this.posBox.querySelector('.hud-pos span');
    this.lapValue = this.posBox.querySelector('.hud-laps b');

    const row = (label, ...values) => [el('i', { text: label }), ...values];
    this.timing = el('div.hud-box.hud-times', null, [
      ...row('Vuelta', ...Array.from({ length: 3 }, () => el('b', { text: '—' }))),
      ...row('Sectores', ...Array.from({ length: 3 }, () => el('b', { text: '—' }))),
      ...row('Intervalo', el('b', { text: '—', style: { gridColumn: 'span 3' } })),
    ]);
    const cells = [...this.timing.querySelectorAll('b')];
    this.cellActual = cells[0];
    this.cellLast = cells[1];
    this.cellBest = cells[2];
    this.cellSectors = cells.slice(3, 6);
    this.cellGap = cells[6];

    this.standings = el('div.hud-box.hud-standings');
    this.speedBox = el('div.hud-box', null, [el('div.hud-speed', null, [el('b', { text: '0' }), el('span', { text: 'km/h' })])]);
    this.speedValue = this.speedBox.querySelector('b');
    this.speedUnit = this.speedBox.querySelector('span');
    this.gearBox = el('div.hud-gear', { text: 'N' });

    this.tyreRow = el('div.hud-box', null, [
      el('div.hud-tyre', null, Array.from({ length: 4 }, () => el('i'))),
      el('div.hud-ers', null, el('i')),
      el('div.hud-drs', { text: 'DRS' }),
    ]);
    this.tyreCells = [...this.tyreRow.querySelectorAll('.hud-tyre i')];
    this.ersBar = this.tyreRow.querySelector('.hud-ers i');
    this.drsLabel = this.tyreRow.querySelector('.hud-drs');

    this.messages = el('div.hud-box.hud-msg', { text: '' });
    this.lights = el('div.hud-lights', null, Array.from({ length: 5 }, () => el('i')));
    this.banner = el('div.hud-banner', { text: '' });
    this.banner.style.display = 'none';

    this.mapCanvas = el('canvas.minimap', { width: 172, height: 172, 'aria-hidden': 'true' });
    this.mapCanvas.style.width = '172px';
    this.mapCanvas.style.height = '172px';

    this.root.append(
      el('div.hud-tl', null, [this.posBox, this.timing]),
      el('div.hud-tr', null, [this.messages]),
      el('div.hud-bl', null, [this.speedBox, this.gearBox, this.tyreRow]),
      el('div.hud-br', null, [this.standings, this.mapCanvas]),
      el('div.hud-bc', null, [this.banner, this.lights]),
    );
    this.minimap = new Minimap(this.mapCanvas);
  }

  setTrack(track) {
    this.minimap.setTrack(track);
    this.bestSectors = [Infinity, Infinity, Infinity];
  }

  setMinimapVisible(on) {
    this.minimapVisible = Boolean(on);
    this.mapCanvas.hidden = !this.minimapVisible;
    /* Al volver a mostrarse hay que recalcular el tamaño del lienzo. */
    if (this.minimapVisible) this.minimap.layout();
  }

  setUnits(units) {
    this.units = units === 'imperial' ? 'imperial' : 'metric';
  }

  /** Reinicia los mejores valores al cambiar de sesión. */
  reset() {
    this.bestSectors = [Infinity, Infinity, Infinity];
  }

  /** Sincroniza el HUD con el estado de la sesión. */
  update(state) {
    const p = state.player;
    if (!p) return;

    const total = state.entries?.length || 0;
    this.posValue.textContent = p.retired ? '—' : (p.position || 0);
    this.posTotal.textContent = `/${total}`;
    this.lapValue.textContent = p.retired ? '—' : `V${Math.max(1, p.lap || 1)}`;

    const running = state.phase === 'running' || state.phase === 'green';
    this.cellActual.textContent = running ? formatTime(p.lapMs) : '—';
    this.cellLast.textContent = formatTime(p.lastLapMs);
    this.cellBest.textContent = formatTime(p.bestLapMs);
    this.cellGap.textContent = p.retired ? '—' : formatGap(p.intervalMs ?? null);
    this.paintSectors(p);

    const factor = this.units === 'imperial' ? 2.23694 : 3.6;
    this.speedUnit.textContent = this.units === 'imperial' ? 'mph' : 'km/h';
    this.speedValue.textContent = Math.round((p.speed || 0) * factor);
    this.gearBox.textContent = p.retired ? '—' : (p.speed < 1 ? 'N' : String(p.gear || 1));
    this.gearBox.style.borderColor = p.drsOpen ? '#22c55e' : '';

    this.updateTyres(p);
    this.ersBar.style.width = `${Math.round((p.ers || 0) * 100)}%`;
    this.drsLabel.classList.toggle('on', Boolean(p.drsOpen));
    this.drsLabel.textContent = p.drsOpen ? 'DRS' : p.drsZone ? 'DRS?' : 'DRS';

    this.updateStandings(state);
    this.updateBanner(state);
    this.updateLights(state);
    this.updateMessages(state);

    if (this.minimapVisible) this.minimap.draw(state);
  }

  /** Colorea los cronos de sector según el mejor personal de la sesión. */
  paintSectors(p) {
    for (let i = 0; i < 3; i++) {
      const ms = p.sectorTimes?.[i];
      const cell = this.cellSectors[i];
      if (!Number.isFinite(ms) || ms <= 0) {
        cell.textContent = '—';
        cell.style.color = '';
        continue;
      }
      cell.textContent = `${SECTOR_LABELS[i]} ${formatTime(ms)}`;
      if (ms < this.bestSectors[i]) {
        this.bestSectors[i] = ms;
        cell.style.color = '#4ade80';
      } else {
        cell.style.color = ms < this.bestSectors[i] * 1.02 ? '#e2e8f0' : '#facc15';
      }
    }
  }

  updateTyres(p) {
    const style = TYRE_STYLE[p.tyre] || TYRE_STYLE.medium;
    const wear = Math.min(2, Math.floor((p.tyreWear || 0) / 34));
    for (const cell of this.tyreCells) {
      cell.className = wear > 0 ? `wear-${wear}` : '';
      cell.style.background = wear > 0 ? '' : style.color;
    }
  }

  updateStandings(state) {
    const order = state.order || [];
    const cars = state.cars || [];
    const me = state.player;
    const live = cars
      .filter((c) => !c.retired)
      .slice()
      .sort((a, b) => order.indexOf(a.driverId) - order.indexOf(b.driverId));
    const shown = live.slice(0, 5);
    const meIdx = order.indexOf(me?.driverId);
    if (meIdx >= 5 && me && !me.retired) shown.push(me);
    this.standings.textContent = '';
    for (const car of shown) {
      if (!car || car.retired) continue;
      const pos = order.indexOf(car.driverId) + 1;
      const gap = pos === 1 ? null : (car.gaps?.[me?.driverId] ?? null);
      this.standings.append(el('div.r', { class: car.isPlayer ? 'me' : '' }, [
        el('span.p', { text: String(pos) }),
        el('span', { text: car.short || String(car.name || '').split(' ').pop() }),
        el('span.g', { text: pos === 1 ? 'Líder' : formatGap(gap) }),
      ]));
    }
  }

  updateBanner(state) {
    let text = '';
    let kind = '';
    if (state.safetyCar?.active) {
      text = `CARRERA DE SEGURIDAD ${Math.max(0, state.safetyCar.remaining || 0).toFixed(0)}s`;
      kind = 'sc';
    } else if (state.flags?.sc) {
      text = 'SALIDA NEUTRALIZADA';
      kind = 'yellow';
    } else if (state.flags?.yellow) {
      text = `BANDERA AMARILLA ${Math.max(0, state.flags.yellow).toFixed(0)}s`;
      kind = 'yellow';
    } else if (state.flags?.green) {
      text = 'PISTA LIBRE';
      kind = 'green';
    } else if (state.player?.finished) {
      text = `BANDEERA A CUADROS · P${state.player.position}`;
      kind = 'finish';
    }
    this.banner.textContent = text;
    this.banner.style.display = text ? '' : 'none';
    this.banner.className = `hud-banner ${kind}`;
  }

  updateLights(state) {
    if (state.phase !== 'countdown') {
      this.lights.style.display = 'none';
      return;
    }
    this.lights.style.display = '';
    const lit = state.lights || 0;
    [...this.lights.children].forEach((cell, i) => cell.classList.toggle('on', i < lit));
  }

  updateMessages(state) {
    const list = state.messages || [];
    const last = list[list.length - 1];
    this.messages.textContent = last ? last.text : '';
  }

  destroy() {
    this.root.textContent = '';
  }
}
