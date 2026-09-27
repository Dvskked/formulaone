import { CIRCUITS } from '../js/data/circuits.js';

const id = process.argv[2] || 'hungaroring';
const mod = process.argv[3] || '../js/game/track.js';
const { buildTrack } = await import(mod);
const def = CIRCUITS.find((c) => c.id === id);
const t = buildTrack(def);
const pts = t.points;
const m = pts.length;
const neg = [];
for (let i = 0; i < m; i++) if (pts[i].curv < -0.0005) neg.push(i);
console.log(`${id}: puntos con curvatura negativa: ${neg.length} de ${m}`);
if (neg.length) {
  const runs = [];
  let start = neg[0];
  let prev = neg[0];
  for (let k = 1; k < neg.length; k++) {
    if (neg[k] !== prev + 1) {
      runs.push([start, prev]);
      start = neg[k];
    }
    prev = neg[k];
  }
  runs.push([start, prev]);
  for (const [a, b] of runs) {
    const worst = Math.min(...pts.slice(a, b + 1).map((p) => p.curv));
    console.log(`  tramo ${a}-${b} (s ${Math.round(pts[a].s)}-${Math.round(pts[b].s)} m) curv min ${worst.toFixed(4)} radio ${Math.round(1 / -worst)} m`);
  }
}
let total = 0;
for (let i = 0; i < m; i++) total += Math.abs(pts[i].curv) * 4.2;
console.log('giro total en grados:', ((total * 180) / Math.PI).toFixed(1));
let sum = 0;
for (let i = 0; i < m; i++) sum += pts[i].curv * 4.2;
console.log('giro neto en grados:', ((sum * 180) / Math.PI).toFixed(1));
