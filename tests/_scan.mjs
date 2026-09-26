import { CIRCUITS } from '../js/data/circuits.js';
import { buildTrack, indexAtS } from '../js/game/track.js';

for (const def of CIRCUITS) {
  const t = buildTrack(def);
  const bad = t.points.filter(
    (p) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.s) || !Number.isFinite(p.curv) || !Number.isFinite(p.halfWidth) || !Number.isFinite(p.radius)
  );
  let worst = 0;
  let worstS = 0;
  for (let s = 0; s < t.length; s += t.length / 97) {
    const i = indexAtS(t, s);
    const d = Math.abs(t.points[i].s - s);
    if (d > worst) {
      worst = d;
      worstS = s;
    }
  }
  if (bad.length || worst > 8) {
    console.log(def.id, 'invalidos', bad.length, 'peor idxAtS', worst.toFixed(2), 'en s', worstS.toFixed(1), 'de', t.length.toFixed(1));
    if (bad.length) console.log('   ejemplo', JSON.stringify(bad[0]));
  }
}
console.log('fin');
