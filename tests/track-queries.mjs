import { CIRCUITS } from '../js/data/circuits.js';
import {
  buildTrack,
  projectCar,
  indexAtS,
  pointAtS,
  inDrsZone,
  sectorAt,
  inPitLane,
  minimap,
  speedProfile,
  idealLapTime,
} from '../js/game/track.js';

let fails = 0;
const check = (name, cond, extra = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${extra ? `  ${extra}` : ''}`);
};

for (const def of CIRCUITS) {
  const track = buildTrack(def);
  const m = track.points.length;

  check(`${def.id}: puntos suficientes`, m > 300, `${m}`);
  check(`${def.id}: indices de distancia crecientes`, (() => {
    for (let i = 1; i < m; i++) if (track.points[i].s <= track.points[i - 1].s) return false;
    return true;
  })());
  check(`${def.id}: indexAtS devuelve indices validos`, (() => {
    for (let i = 0; i < 96; i++) {
      const s = (i * track.length) / 96;
      const idx = indexAtS(track, s);
      if (idx < 0 || idx >= m) return false;
      if (Math.abs(track.points[idx].s - s) > 8) return false;
    }
    return true;
  })());
  check(`${def.id}: proyeccion sobre la linea central`, (() => {
    for (let i = 0; i < m; i += 17) {
      const p = track.points[i];
      const proj = projectCar(track, p.x, p.y, i);
      if (!proj.onTrack) return false;
      if (Math.abs(proj.lateral) > 1.2) return false;
      if (Math.abs(proj.dist) > 1.2) return false;
    }
    return true;
  })());
  check(`${def.id}: fuera de pista detectado`, (() => {
    const p = track.points[10];
    const off = p.halfWidth + 25;
    const x = p.x + p.nx * off;
    const y = p.y + p.ny * off;
    return !projectCar(track, x, y, 10).onTrack;
  })());
  check(`${def.id}: sectores 1-3`, (() => {
    const s1 = sectorAt(track, track.length * 0.1);
    const s2 = sectorAt(track, track.length * 0.5);
    const s3 = sectorAt(track, track.length * 0.9);
    return s1 === 1 && s2 === 2 && s3 === 3;
  })());
  check(`${def.id}: zonas DRS alcanzables`, track.drsZones.length > 0 && track.drsZones.some((z) => inDrsZone(track, z.from)));
  check(`${def.id}: boxes dentro del pit lane`, (() => {
    for (const b of track.pit.boxes) {
      if (!inPitLane(track, b.x, b.y)) return false;
    }
    return true;
  })());
  check(`${def.id}: pit lane paralelo sin invadir la pista`, (() => {
    const path = track.pit.path;
    const from = Math.round(path.length * 0.14);
    const to = Math.round(path.length * 0.86);
    for (let i = from; i <= to; i++) {
      if (projectCar(track, path[i].x, path[i].y, path[i].idx).onTrack) return false;
    }
    return true;
  })());
  check(`${def.id}: pit lane entra y sale de la pista`, (() => {
    const path = track.pit.path;
    const first = path[0];
    const last = path[path.length - 1];
    return projectCar(track, first.x, first.y, first.idx).dist < 14 && projectCar(track, last.x, last.y, last.idx).dist < 14;
  })());
  check(`${def.id}: linea de meta en el inicio`, (() => {
    const p = pointAtS(track, 0);
    return Math.hypot(p.x - track.start.x, p.y - track.start.y) < 5;
  })());
  check(`${def.id}: minimapa dentro del viewBox`, (() => {
    const mm = minimap(track);
    const nums = mm.d.match(/-?\d+(\.\d+)?/g).map(Number);
    for (const n of nums) {
      if (n < -0.5 || n > 100.5) return false;
    }
    return true;
  })());
  check(`${def.id}: perfil de velocidad usa todo el rango`, (() => {
    const v = speedProfile(track, 1);
    const max = Math.max(...v) * 3.6;
    const min = Math.min(...v) * 3.6;
    return max > 280 && max <= 355 && min > 35 && min < 110;
  })());
  check(`${def.id}: mas agarre = vuelta mas rapida`, idealLapTime(track, 1) > idealLapTime(track, 1.12));
  check(`${def.id}: trazada de carrera dentro de pista`, (() => {
    for (let i = 0; i < track.line.length; i++) {
      if (Math.abs(track.line[i].offset) > track.points[i].halfWidth) return false;
    }
    return true;
  })());
}

console.log(`\n${fails ? `${fails} comprobaciones fallidas` : 'todas las comprobaciones pasan'}`);
process.exit(fails ? 1 : 0);
