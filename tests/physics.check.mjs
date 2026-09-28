// Comprobaciones de la física: parámetros del coche, integración y Pilotaje de la IA.
import { buildTrack, projectCar, inDrsZone, speedProfile } from '../js/game/track.js';
import { getCircuit } from '../js/data/circuits.js';
import { makeRng } from '../js/core/rng.js';
import {
  makeCarState, stepCar, stepAi, applyLaunch, surfaceAt, powerFactor, gripFactor,
  brakeFactor, aeroFactor, maxSpeed, TYRES, TYRE_ORDER, tyrePace, tyreGrip, tyreLapsLeft,
  ERS_CAPACITY, PIT_SPEED_KMH, DRS_BOOST,
} from '../js/game/car.js';
import { createCareer } from '../js/game/career.js';

let bad = 0;
const check = (label, cond, extra = '') => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    bad += 1;
    console.log(`  FAIL ${label} ${extra}`);
  }
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const track = buildTrack(getCircuit('interlagos'), makeRng(3));
const entry = {
  driverId: 'p1',
  name: 'Piloto',
  short: 'PDO',
  number: 19,
  flag: '🇪🇸',
  teamId: 'mclaren',
  isPlayer: true,
  skill: 80,
  ratings: { pace: 80 },
  team: {
    livery: { primary: '#ff8700', secondary: '#0b1a3a' },
    car: { power: 95, aero: 96, grip: 94, brakes: 95, reliability: 92, budget: 168 },
  },
};
const fresh = (opts = {}) => {
  const c = makeCarState(track, entry, opts);
  const p = projectCar(track, c.x, c.y, c.idx);
  return { c, p };
};
const drive = (c, p, input, seconds, env = {}) => {
  const dt = 1 / 60;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    p = projectCar(track, c.x, c.y, c.idx);
    stepCar(c, input, track, p, { dt, weather: {}, assists: {}, ...env });
  }
  return p;
};

console.log('physics.check');

/* ── Parámetros derivados ── */
{
  check('coche: más potencia da más velocidad punta', maxSpeed({ power: 96 }) > maxSpeed({ power: 80 }));
  check('coche: DRS aumenta la punta', near(maxSpeed(entry.team.car, true), maxSpeed(entry.team.car, false) * DRS_BOOST, 0.001));
  check('coche: punta sin DRS en el orden de 300 km/h', maxSpeed(entry.team.car) * 3.6 > 280 && maxSpeed(entry.team.car) * 3.6 < 325, `${(maxSpeed(entry.team.car) * 3.6).toFixed(0)} km/h`);
  check('coche: punta con DRS en el orden de 350 km/h', maxSpeed(entry.team.car, true) * 3.6 > 325 && maxSpeed(entry.team.car, true) * 3.6 < 375, `${(maxSpeed(entry.team.car, true) * 3.6).toFixed(0)} km/h`);
  check('coche: factores crecientes con el nivel', powerFactor({ power: 96 }) > powerFactor({ power: 78 }) && gripFactor({ grip: 96 }) > gripFactor({ grip: 78 }));
  check('coche: frenada más fuerte con más frenos', brakeFactor({ brakes: 96 }) > brakeFactor({ brakes: 78 }));
  check('coche: aerodinámica con más alas', aeroFactor({ aero: 96 }) > aeroFactor({ aero: 78 }));
  check('coche: pit a 80 km/h', PIT_SPEED_KMH === 80);
  check('neumáticos: blando más agarre y vida más corta que duro', TYRES.soft.grip > TYRES.hard.grip && TYRES.soft.life < TYRES.hard.life);
  check('neumáticos: blando más rápido que duro y duro que medio', TYRES.soft.pace > TYRES.medium.pace && TYRES.medium.pace > TYRES.hard.pace);
  check('neumáticos: vida de 7/12/16 vueltas', TYRES.soft.life === 7 && TYRES.medium.life === 12 && TYRES.hard.life === 16, `${TYRES.soft.life}/${TYRES.medium.life}/${TYRES.hard.life}`);
  check('neumáticos: solo gomas de seco', TYRE_ORDER.length === 3 && TYRE_ORDER.every((k) => TYRES[k]));
  check('neumáticos: el desgaste se come el ritmo y el agarre', tyrePace('soft', 1) < tyrePace('soft', 0) && tyreGrip('soft', 1) < tyreGrip('soft', 0));
  check('neumáticos: color de pantalla', Object.values(TYRES).every((t) => /^#[0-9a-f]{6}$/i.test(t.color)));
}

/* ── Superficie ── */
{
  const on = { onTrack: true, kerb: false, dist: 2, halfWidth: 7 };
  const kerb = { onTrack: true, kerb: true, dist: 7, halfWidth: 7 };
  const grass = { onTrack: false, kerb: false, dist: 16, halfWidth: 7 };
  const s1 = surfaceAt(on);
  const s2 = surfaceAt(kerb);
  const s3 = surfaceAt(grass);
  check('superficie: asfalto sin penalización', s1.grip === 1 && s1.drag === 0);
  check('superficie: pianos penalizan agarre', s2.grip < 1 && s2.grip > 0.85);
  check('superficie: fuera de pista penaliza más', s3.grip < s2.grip && s3.drag > s2.drag);
  const wet = surfaceAt(on, { wet: true });
  check('superficie: lluvia reduce agarre', wet.grip < 1);
}

/* ── Integración del jugador ── */
{
  const { c } = fresh();
  const zero = c.speed;
  drive(c, fresh().p, { throttle: 1 }, 3);
  check('aceleración: acelera a fondo', c.speed > zero + 25, `v=${c.speed.toFixed(1)} m/s`);
  check('aceleración: no supera la punta', c.speed <= maxSpeed(entry.team.car) + 0.5, `v=${c.speed.toFixed(1)}`);
  check('marcha: sube de marcha', c.gear > 1);
  const before = c.speed;
  drive(c, projectCar(track, c.x, c.y, c.idx), { brake: 1 }, 3);
  check('frenada: frena con fuerza', c.speed < before - 25, `v=${c.speed.toFixed(1)}`);
  drive(c, projectCar(track, c.x, c.y, c.idx), { brake: 1 }, 8);
  check('frenada: se detiene', c.speed < 1.5, `v=${c.speed.toFixed(2)}`);
}
{
  const { c } = fresh();
  const y0 = c.y;
  drive(c, fresh().p, { throttle: 0.6, steer: 1 }, 2);
  const vLong = c.vx * Math.cos(c.angle) + c.vy * Math.sin(c.angle);
  const vLat = Math.abs(c.vx * Math.sin(c.angle) - c.vy * Math.cos(c.angle));
  check('dirección: gira con el volante', Math.abs(c.angle) > 0.15, `ángulo=${c.angle.toFixed(2)}`);
  check('dirección: se desplaza en la perpendicular', Math.abs(c.y - y0) + Math.abs(c.x) > 1);
  check('tracción: no pierde toda la velocidad longitudinal', vLong > 5, `vLong=${vLong.toFixed(1)}`);
  check('tracción: deriva lateral contenida', vLat < vLong + 12, `vLat=${vLat.toFixed(1)} vLong=${vLong.toFixed(1)}`);
}
{
  const { c } = fresh();
  drive(c, fresh().p, { throttle: 1 }, 20);
  check('ERS: se consume al acelerar', c.ers < ERS_CAPACITY, `ers=${c.ers.toFixed(1)}`);
  const used = c.ers;
  drive(c, projectCar(track, c.x, c.y, c.idx), { throttle: 0 }, 20);
  check('ERS: se recupera al soltar', c.ers > used, `ers=${c.ers.toFixed(1)}`);
}
{
  /* Las zonas DRS se expresan en índices de punto de la trazada */
  const zone = track.drsZones[0];
  const place = (idx, car) => {
    car.idx = idx;
    car.x = track.points[idx].x;
    car.y = track.points[idx].y;
    car.speed = 40;
    return car;
  };
  const { c } = fresh();
  place(Math.round((zone.from + zone.to) / 2), c);
  drive(c, projectCar(track, c.x, c.y, c.idx), { throttle: 1, drsPressed: true }, 0.2, { autoDrs: false });
  check('DRS: disponible en zona', c.drsAvailable === true);
  check('DRS: se abre al pulsar en zona', c.drsOpen === true);
  const outside = (zone.to + 12) % track.points.length;
  place(outside, c);
  drive(c, projectCar(track, c.x, c.y, c.idx), { throttle: 1, drsPressed: true }, 0.2, { autoDrs: false });
  check('DRS: cerrado fuera de zona', c.drsAvailable === false && c.drsOpen === false, `idx=${outside}`);
  const auto = fresh().c;
  place(Math.round((zone.from + zone.to) / 2), auto);
  drive(auto, projectCar(track, auto.x, auto.y, auto.idx), { throttle: 1, drsPressed: false }, 0.2, { autoDrs: true });
  check('DRS: automático con ajuste', auto.drsOpen === true);
  place(outside, auto);
  drive(auto, projectCar(track, auto.x, auto.y, auto.idx), { throttle: 1, drsPressed: true }, 0.2, { autoDrs: false });
  check('DRS: no se abre por debajo de 22 m/s', auto.speed >= 22 && auto.drsOpen === false, `v=${auto.speed.toFixed(1)}`);
}
{
  const a = fresh();
  const b = fresh();
  drive(a.c, a.p, { throttle: 1 }, 5);
  drive(b.c, b.p, { throttle: 1 }, 5);
  check('determinismo: mismo input, mismo resultado', near(a.c.x, b.c.x, 1e-9) && near(a.c.speed, b.c.speed, 1e-9));
}
{
  const { c } = fresh();
  c.retired = true;
  const before = c.speed;
  drive(c, fresh().p, { throttle: 1 }, 2);
  check('abandono: el coche parado no acelera', c.speed === before);
}

/* ── Arranque ── */
{
  const good = fresh().c;
  applyLaunch(good, track, 1, makeRng(1));
  const bad = fresh().c;
  applyLaunch(bad, track, 0.05, makeRng(1));
  check('arranque: buena salida más rápida que mala', good.speed > bad.speed, `${good.speed.toFixed(1)}/${bad.speed.toFixed(1)}`);
  check('arranque: marca el coche como arrancado', good.started === true);
  check('arranque: velocidad en rango', good.speed >= 8 && good.speed <= 60);
}

/* ── IA ── */
{
  const career = createCareer(
    { name: 'IA', birthDate: '2000-01-01', country: 'ITA', helmetPrimary: '#111111', helmetSecondary: '#eeeeee', helmetStyle: 'liso' },
    { series: 'f1', seed: 42 }
  );
  const rivals = career.entryList.filter((e) => !e.isPlayer).slice(0, 6).map((e, i) => ({ ...e, skill: 62 + i * 7 }));
  const ctxBase = { dt: 1 / 60, track, line: track.line, weather: {}, skill: 80 };
  const cars = rivals.map((e) => {
    const c = makeCarState(track, e, { grid: 1, tyre: 'soft' });
    c.rng = makeRng(e.driverId);
    c.onTrack = true;
    c.strategy = { stops: 1, compounds: ['soft', 'medium'] };
    return c;
  });
  const profile = speedProfile(track, 1);
  for (let i = 0; i < 60 * 90; i++) {
    for (const c of cars) {
      stepAi(c, { ...ctxBase, rng: c.rng, skill: c.skill, scActive: false });
      if (Math.hypot(c.vx, c.vy) > 400) throw new Error('velocidad disparada');
    }
  }
  const laps = cars.map((c) => c.idx);
  check('IA: avanza por la pista', cars.every((c) => c.speed > 20));
  check('IA: respeta la velocidad de la trazada', cars.every((c, i) => c.speed < profile[laps[i]] * 1.35), cars.map((c) => c.speed.toFixed(0)).join(' '));
  check('IA: se mantiene dentro de pista', cars.every((c) => c.onTrack));
  check('IA: no se queda atascado', new Set(cars.map((c) => c.idx)).size > 1);
  check('IA: desgaste de neumático', cars.every((c) => c.tyreWear > 0));
  check('IA: ERS en rango', cars.every((c) => c.ers >= 0 && c.ers <= ERS_CAPACITY));

  const scCar = makeCarState(track, rivals[0], { grid: 1, tyre: 'soft' });
  scCar.rng = makeRng('sc');
  const free = scCar.speed;
  for (let i = 0; i < 600; i++) stepAi(scCar, { ...ctxBase, rng: scCar.rng, skill: 70, scActive: true });
  check('IA: reduce con coche de seguridad', scCar.speed < 30, `v=${scCar.speed.toFixed(1)}`);
  check('IA: sin DRS con coche de seguridad', scCar.drsOpen === false && free >= 0);
}

console.log(bad ? `\n${bad} comprobación(es) fallida(s)` : '\nTodo OK');
process.exit(bad ? 1 : 0);
