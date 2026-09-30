// Diagnóstico de conducción: mide respuesta al volante, límites dinámicos,
// coherencia jugador/IA y tiempos por vuelta. No forma parte de la suite.
import { buildTrack, projectCar, speedProfile, indexAtS } from '../js/game/track.js';
import { getCircuit } from '../js/data/circuits.js';
import { makeCarState, stepCar, stepAi, maxSpeed, gripFactor, tyreGrip } from '../js/game/car.js';
import { makeRng } from '../js/core/rng.js';

const track = buildTrack(getCircuit('interlagos'));
const entry = {
  driverId: 'p1', name: 'Piloto', short: 'PDO', number: 19, flag: '🇪🇸',
  teamId: 'm', isPlayer: true, skill: 80, ratings: {},
  team: { livery: { primary: '#f80' }, car: { power: 95, aero: 96, grip: 94, brakes: 95, reliability: 92 } },
};
const CAR = entry.team.car;

const spawn = (s, lat = 0) => {
  const idx = indexAtS(track, s);
  const p = track.points[idx];
  const c = makeCarState(track, entry, {});
  c.idx = idx; c.s = s; c.lateral = lat;
  c.x = p.x + p.nx * lat; c.y = p.y + p.ny * lat;
  c.angle = Math.atan2(p.dirY, p.dirX);
  c.vx = Math.cos(c.angle) * 0; c.vy = Math.sin(c.angle) * 0;
  c.speed = 0;
  return c;
};

const step = (c, input, dt, env = {}) => {
  const proj = projectCar(track, c.x, c.y, c.idx);
  stepCar(c, input, track, proj, { dt, weather: {}, assists: {}, ...env });
  return proj;
};

console.log('=== 1. Radio de giro real frente al máximo teórico del agarre ===');
for (const v of [20, 40, 60, 80]) {
  const c = spawn(500);
  c.speed = v;
  c.vx = Math.cos(c.angle) * v;
  c.vy = Math.sin(c.angle) * v;
  let t = 0;
  const dt = 1 / 60;
  const a0 = c.angle;
  for (let i = 0; i < 240; i++) {
    step(c, { throttle: 0, steer: 1 }, dt);
    t += dt;
    if (Math.abs(((c.angle - a0 + Math.PI) % (Math.PI * 2)) - Math.PI) > Math.PI) break;
  }
  const radius = t > 0.01 ? (v * t) / (Math.abs(c.angle - a0) || 1e-9) : Infinity;
  const aLat = (v * v) / Math.max(1e-6, radius);
  const grip = gripFactor(CAR) * tyreGrip('medium', 0);
  console.log(
    `  v=${String(v).padStart(2)} m/s  radio=${radius.toFixed(0).padStart(4)} m  a_lat=${aLat.toFixed(1).padStart(5)} m/s²  (${(aLat / 9.81).toFixed(2)} g)  agarre_lineal=${(grip * 34).toFixed(1)} m/s²`
  );
}

console.log('\n=== 2. ¿Puede el coche seguir una esquina de la pista a ritmo de carrera? ===');
{
  // Radio mínimo del trazado
  let minR = Infinity, minI = 0;
  track.points.forEach((p, i) => { if (p.radius < minR) { minR = p.radius; minI = i; } });
  const grip = gripFactor(CAR) * tyreGrip('medium', 0);
  console.log(`  radio mínimo del trazado: ${minR.toFixed(0)} m en idx ${minI}`);
  console.log(`  velocidad de la IA para ese radio: ${Math.sqrt(17.6 * grip / (1 / minR)).toFixed(1)} m/s`);
  console.log(`  velocidad MÁXIMA a la que el jugador puede tomar ese radio: ${Math.sqrt((34 * grip) * minR).toFixed(1)} m/s`);
  console.log('  -> si el segundo número es mucho mayor, el jugador va "trazado libre" y la IA parece frenarse sola');
}

console.log('\n=== 3. El coche sale recto sin deriva? (línea recta) ===');
{
  // Recta más larga del trazado
  let best = 0, bestS = 0, runStart = 0;
  for (let i = 0; i <= track.n; i++) {
    const p = track.points[i % track.n];
    if (Math.abs(p.curv) > 0.002) {
      const len = p.s - runStart;
      if (len > best) { best = len; bestS = runStart; }
      runStart = p.s;
    }
  }
  const c = spawn(bestS + 20);
  c.speed = 60; c.vx = Math.cos(c.angle) * 60; c.vy = Math.sin(c.angle) * 60;
  const a0 = c.angle;
  let maxSlip = 0;
  for (let i = 0; i < 240; i++) {
    step(c, { throttle: 1, steer: 0 }, 1 / 60);
    const slip = Math.abs(((c.angle - Math.atan2(c.vy, c.vx) + Math.PI) % (Math.PI * 2)) - Math.PI);
    maxSlip = Math.max(maxSlip, slip);
  }
  console.log(`  recta de ${best.toFixed(0)} m; deriva máxima sin tocar el volante: ${(maxSlip * 180 / Math.PI).toFixed(2)}°  (cambio de rumbo ${((c.angle - a0) * 180 / Math.PI).toFixed(1)}°)`);
}

console.log('\n=== 4. Simetría izquierda/derecha ===');
{
  const run = (steer) => {
    const c = spawn(500);
    c.speed = 50; c.vx = Math.cos(c.angle) * 50; c.vy = Math.sin(c.angle) * 50;
    for (let i = 0; i < 120; i++) step(c, { throttle: 0.3, steer }, 1 / 60);
    return c.angle;
  };
  const l = run(-1), r = run(1);
  console.log(`  ángulo con volante a la izquierda: ${(l * 180 / Math.PI).toFixed(1)}°`);
  console.log(`  ángulo con volante a la derecha:     ${(r * 180 / Math.PI).toFixed(1)}°`);
}

console.log('\n=== 5. Volante fijo a alta velocidad: ¿aguanta la curva? ===');
{
  for (const v of [40, 60, 70, 80]) {
    const c = spawn(1000);
    c.speed = v; c.vx = Math.cos(c.angle) * v; c.vy = Math.sin(c.angle) * v;
    let lateral = 0;
    for (let i = 0; i < 90; i++) {
      const proj = step(c, { throttle: 0, steer: 0.35 }, 1 / 60);
      lateral = Math.max(lateral, Math.abs(proj.lateral));
    }
    console.log(`  v=${v} m/s, volante 35%: desviación lateral máx ${lateral.toFixed(1)} m (semiancho ${track.points[c.idx].halfWidth.toFixed(1)} m)`);
  }
}

console.log('\n=== 6. Tiempos por vuelta: jugador "perfecto" vs IA ===');
{
  const c = spawn(0);
  const line = track.line;
  const prof = speedProfile(track, 1);
  const dt = 1 / 60;
  let prevS = 0, lapStart = 0, t = 0;
  const laps = [];
  let off = 0, steps = 0, maxErr = 0;
  for (let i = 0; i < 60 * 60 * 8; i++) {
    const proj = projectCar(track, c.x, c.y, c.idx);
    const want = line[(c.idx + 8) % track.n].offset;
    const want2 = line[(c.idx + 22) % track.n].offset;
    const err = want - proj.lateral;
    const err2 = want2 - proj.lateral;
    const headingErr = ((proj.heading - c.angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    const steer = Math.max(-1, Math.min(1, err * 0.16 - err2 * 0.045 + headingErr * 3.2));
    const target = prof[c.idx] * 0.95;
    const brake = c.speed > target ? 1 : 0;
    const p2 = step(c, { throttle: brake ? 0 : 1, brake, steer }, dt);
    t += dt; steps++;
    maxErr = Math.max(maxErr, Math.abs(p2.lateral - line[c.idx].offset));
    if (Math.abs(p2.lateral) > p2.halfWidth) off += dt;
    if (prevS > track.length - 300 && c.s < 300) { laps.push(t - lapStart); lapStart = t; }
    prevS = c.s;
    if (laps.length >= 4) break;
  }
  console.log(`  vueltas: ${laps.length}`);
  console.log(`  tiempos: ${laps.map((l) => l.toFixed(2)).join(', ')} s`);
  console.log(`  tiempo fuera de pista: ${off.toFixed(1)} s de ${t.toFixed(0)} s (${(100 * off / t).toFixed(0)}%)`);
  console.log(`  error máximo respecto a la trazada: ${maxErr.toFixed(1)} m`);
}

console.log('\n=== 7. IA: tiempo por vuelta y variación ===');
{
  const ai = makeCarState(track, { ...entry, driverId: 'ai', isPlayer: false, skill: 80 }, { tyre: 'medium' });
  ai.rng = makeRng('ai');
  const ctxBase = { dt: 1 / 60, track, line: track.line, weather: {}, skill: 80 };
  const laps = [];
  let t = 0, lastS = ai.s, lapStart = 0, prevS = ai.s;
  let maxLat = 0;
  for (let i = 0; i < 60 * 60 * 6; i++) {
    stepAi(ai, { ...ctxBase, rng: ai.rng });
    t += 1 / 60;
    maxLat = Math.max(maxLat, Math.abs(ai.lateral));
    if (prevS > track.length - 300 && ai.s < 300) { laps.push(t - lapStart); lapStart = t; }
    prevS = ai.s;
  }
  const valid = laps.slice(1);
  console.log(`  vueltas completadas: ${valid.length}`);
  console.log(`  tiempo: ${valid.map((l) => (l).toFixed(2)).join(', ')} s`);
  console.log(`  desviación lateral máx respecto a la trazada: ${maxLat.toFixed(1)} m (semiancho medio ${(track.baseWidth / 2).toFixed(1)} m)`);
  const prof = speedProfile(track, 1);
  console.log(`  velocidad media de la trazada: ${(prof.reduce((a, b) => a + b, 0) / prof.length * 3.6).toFixed(0)} km/h`);
}

console.log('\n=== 8. La trazada de carrera y su curvatura real ===');
{
  const line = track.line;
  const curv = line.map((p, i) => {
    const a = line[(i - 2 + line.length) % line.length];
    const b = line[i];
    const c = line[(i + 2) % line.length];
    const d1 = Math.atan2(b.y - a.y, b.x - a.x);
    const d2 = Math.atan2(c.y - b.y, c.x - b.x);
    let dh = (d2 - d1 + Math.PI) % (Math.PI * 2);
    if (dh < 0) dh += Math.PI * 2;
    if (dh > Math.PI) dh -= Math.PI * 2;
    return dh / 12.6;
  });
  const maxLineCurv = Math.max(...curv.map(Math.abs));
  let maxCentreCurv = 0;
  track.points.forEach((p) => { maxCentreCurv = Math.max(maxCentreCurv, Math.abs(p.curv)); });
  console.log(`  curvatura máx. línea central: ${maxCentreCurv.toFixed(5)} (radio ${(1 / maxCentreCurv).toFixed(0)} m)`);
  console.log(`  curvatura máx. trazada:       ${maxLineCurv.toFixed(5)} (radio ${(1 / maxLineCurv).toFixed(0)} m)`);
  console.log(`  radio ${(1 / maxCentreCurv).toFixed(0)} m necesita frenada; la trazada solo ${(1 / maxLineCurv).toFixed(0)} m`);
}

console.log('\n=== 9. Reacción visual: píxeles por fotograma ===');
{
  for (const [name, zoom] of [['Cockpit', 10.5], ['Alta', 7], ['Cenital', 3.4]]) {
    for (const v of [40, 60, 75]) {
      const dt = 1 / 60;
      console.log(`  ${name.padEnd(8)} zoom ${zoom} · v=${v} m/s -> ${(v * dt * zoom).toFixed(0)} px/fotograma, pantalla 1920 px recorrida en ${(1920 / (v * zoom)).toFixed(2)} s`);
    }
  }
}
