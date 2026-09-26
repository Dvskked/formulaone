import { CIRCUITS } from '../js/data/circuits.js';
import { buildTrack, speedProfile } from '../js/game/track.js';

const fmt = (ms) => {
  const t = ms / 1000;
  return `${Math.floor(t / 60)}:${(t % 60).toFixed(3).padStart(6, '0')}`;
};

let ok = 0;
const t0 = performance.now();
for (const def of CIRCUITS) {
  const track = buildTrack(def);
  const m = track.points.length;
  const last = track.points[m - 1];
  const gap = Math.hypot(last.x - track.points[0].x, last.y - track.points[0].y);
  const km = track.length / 1000;
  const v = speedProfile(track, 1);
  const vmin = Math.min(...v) * 3.6;
  const vmax = Math.max(...v) * 3.6;
  const lap = track.idealLap / 1000;
  const problems = [];
  if (gap > 5) problems.push('gap');
  if (Math.abs(km - def.length) / def.length > 0.01) problems.push('largo');
  if (track.drsZones.length < 2) problems.push('drs');
  if (vmin > 105) problems.push('sin curvas lentas');
  if (vmin < 38) problems.push('curva imposible');
  if (lap < 45 || lap > 125) problems.push('tiempo');
  if (track.laps < 15) problems.push('pocas vueltas');
  if (!problems.length) ok++;
  console.log(
    `${problems.length ? 'FAIL' : 'OK  '} ${def.id.padEnd(13)} ${km.toFixed(2)}km ${fmt(track.idealLap).padStart(9)} ` +
      `v ${String(Math.round(vmin)).padStart(3)}-${Math.round(vmax)} drs ${track.drsZones.length} gap ${gap.toFixed(1)}m ` +
      `${String(track.laps).padStart(2)}v ${Math.round(track.raceDistance)}km ${problems.join(',')}`
  );
}
console.log(`\n${ok}/${CIRCUITS.length} circuitos correctos en ${Math.round(performance.now() - t0)}ms`);
