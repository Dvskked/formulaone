import { CIRCUITS } from '../js/data/circuits.js';
import { buildTrack, projectCar } from '../js/game/track.js';

const MIN_SEP = 260; // metros de arco mínimos entre dos puntos a comparar
for (const def of CIRCUITS) {
  const t = buildTrack(def);
  const pts = t.points;
  const m = pts.length;
  let worst = Infinity;
  let pair = null;
  for (let i = 0; i < m; i += 3) {
    for (let j = i + MIN_SEP; j < m; j += 3) {
      if (Math.min(j - i, m - (j - i)) < MIN_SEP / 4.2) continue;
      const dx = pts[i].x - pts[j].x;
      const dy = pts[i].y - pts[j].y;
      const d = Math.hypot(dx, dy);
      if (d < worst) {
        worst = d;
        pair = [i, j];
      }
    }
  }
  const need = pts[pair[0]].halfWidth + pts[pair[1]].halfWidth;
  const lapDist = Math.min(pair[1] - pair[0], m - (pair[1] - pair[0])) * 4.2;
  let pitWorst = Infinity;
  let pitAt = -1;
  for (let k = 0; k < t.pit.path.length; k++) {
    const p = t.pit.path[k];
    const proj = projectCar(t, p.x, p.y, p.idx);
    if (proj.onTrack) {
      const d = Math.abs(proj.lateral) - proj.halfWidth;
      if (-d < pitWorst) {
        pitWorst = -d;
        pitAt = k;
      }
    }
  }
  const flag = worst < need ? 'OVERLAP' : worst < need + 12 ? 'justo' : 'ok';
  console.log(
    `${def.id.padEnd(13)} minsep ${worst.toFixed(1).padStart(6)}m (hace falta ${need.toFixed(1)}) en idx ${pair[0]}/${pair[1]} ` +
      `arco ${Math.round(lapDist)}m  pit ${pitAt >= 0 ? `invade ${pitWorst.toFixed(1)}m en ${pitAt}` : 'libre'}  ${flag}`
  );
}
