// Física de monoplaza vista cenital. Modelo arcade-sim: vector de velocidad,
// agarre lateral con círculo de tracción, DRS, ERS, neumáticos y superficie.
//
// Unidades: metros, segundos, m/s. La pista la aporta track.js (proyección
// sobre la línea central) y aquí solo se resuelve la dinámica del coche.

import { clamp, lerp, sign, mod, TAU } from '../core/util.js';
import { inDrsZone, indexAtS } from './track.js';

/* Neumáticos de seco. La degradación se mide en VUELTAS recorridas: cada
   compuesto tiene una vida útil (`life`) y, al acercarse a ella, pierde
   rendimiento de golpe. De momento no hay gomas de lluvia ni intermedias. */
export const TYRES = {
  soft: { id: 'soft', name: 'Blando', code: 'C5', color: '#e8112d', life: 7, pace: 1.034, grip: 1.055, falloff: 0.17, warm: 'alta' },
  medium: { id: 'medium', name: 'Medio', code: 'C3', color: '#f5d000', life: 12, pace: 1, grip: 1, falloff: 0.1, warm: 'media' },
  hard: { id: 'hard', name: 'Duro', code: 'C2', color: '#e6e8ee', life: 16, pace: 0.966, grip: 0.962, falloff: 0.05, warm: 'baja' },
};

export const TYRE_ORDER = ['soft', 'medium', 'hard'];

/** Suaviza de 0 a 1 entre dos umbrales. */
function smoothstep(from, to, x) {
  const t = clamp((x - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Cuánto ha caido ya el compuesto por el desgaste (0 = nuevo, 1 = en su fin). */
export function tyreCliff(tyreId, wear) {
  const t = TYRES[tyreId] || TYRES.medium;
  return smoothstep(0.55, 1, clamp(wear, 0, 1)) * t.falloff;
}

/** Factor de velocidad punta que permite el compuesto con ese desgaste. */
export function tyrePace(tyreId, wear) {
  const t = TYRES[tyreId] || TYRES.medium;
  return t.pace * (1 - tyreCliff(tyreId, wear));
}

/** Factor de agarre lateral con ese desgaste. */
export function tyreGrip(tyreId, wear) {
  const t = TYRES[tyreId] || TYRES.medium;
  return t.grip * (1 - tyreCliff(tyreId, wear) * 0.7);
}

/** Vueltas de vida que le quedan al compuesto. */
export function tyreLapsLeft(tyreId, wear) {
  const t = TYRES[tyreId] || TYRES.medium;
  return Math.max(0, t.life * (1 - clamp(wear, 0, 1)));
}

/**
 * Acumula la distancia rodada y recalcula el desgaste 0..1 del compuesto.
 * @param {object} c estado del coche
 * @param {number} metres metros recorridos en este paso
 * @param {number} lapLength longitud del circuito en metros
 */
export function ageTyre(c, metres, lapLength) {
  c.lapDist = (c.lapDist || 0) + metres;
  const life = (TYRES[c.tyre] || TYRES.medium).life * (lapLength || 5000);
  c.tyreWear = clamp(c.lapDist / life, 0, 1.6);
  c.tyreAge = c.lapDist / (lapLength || 5000);
  return c.tyreWear;
}

/** Regulación 2026: gestión de energía con despliegue siempre disponible. */
export const PIT_SPEED_KMH = 80;
export const ERS_CAPACITY = 100;
export const ERS_DEPLOY_RATE = 26;
export const ERS_RECHARGE_RATE = 9.5;
export const DRS_BOOST = 1.17;

/* ───────────────────── Estado inicial ───────────────────── */

export function makeCarState(track, entry, options = {}) {
  const team = entry.team || {};
  const car = team.car || { power: 80, aero: 80, grip: 80, brakes: 80, reliability: 85, budget: 80 };
  return {
    driverId: entry.driverId,
    name: entry.name,
    short: entry.short,
    number: entry.number,
    flag: entry.flag,
    color: team.livery?.primary || '#888',
    teamId: entry.teamId,
    isPlayer: Boolean(entry.isPlayer),

    /* cinemática */
    x: track.start.x,
    y: track.start.y,
    vx: 0,
    vy: 0,
    angle: track.start.heading,
    speed: 0,

    /* posición en pista */
    idx: 0,
    s: 0,
    lap: 0,
    lateral: 0,
    progress: 0,
    position: 1,
    onTrack: true,
    offTrackTime: 0,
    lastOffIdx: -1,
    kerbTime: 0,

    /* Longitudinal */
    gear: 1,
    rpm: 0.2,
    ers: ERS_CAPACITY,
    drsOpen: false,
    drsAvailable: false,
    drsZone: null,

    /* neumáticos */
    tyre: options.tyre || 'medium',
    tyreAge: 0,
    tyreWear: 0,
    tyreTemp: 0.35,
    lapDist: 0,

    /* daños y estado */
    damage: 0,
    retired: false,
    retireReason: null,
    pitStops: 0,
    pitTimer: 0,
    inPit: false,
    lastPitLap: 0,

    /* cronometraje */
    lapMs: 0,
    lastLapMs: 0,
    bestLapMs: 0,
    lapStartMs: 0,
    sectorMs: [0, 0, 0],
    sectorStart: 0,
    positionAtStart: options.grid || 1,
    gaps: { ahead: 0, behind: 0 },
    intervalMs: 0,

    /* entrants */
    skill: entry.skill || 75,
    ratings: entry.ratings || {},
    car,
    started: false,
    reactionMs: 0,
    push: 0,
  };
}

/* ───────────────────── Parámetros derivados ───────────────────── */

export function powerFactor(car) {
  /* 78 => 0.93 · 96 => 1.07 */
  return 0.93 + (car.power - 78) * 0.0095;
}

export function gripFactor(car) {
  return 0.86 + (car.grip - 78) * 0.012;
}

export function brakeFactor(car) {
  return 0.88 + (car.brakes - 78) * 0.011;
}

export function aeroFactor(car) {
  return 0.9 + (car.aero - 78) * 0.0105;
}

export function maxSpeed(car, drs = false) {
  /* 78 => 68 m/s (245 km/h) · 96 => 83 m/s (300 km/h) */
  const base = 68 + (car.power - 78) * 0.9;
  return base * (drs ? DRS_BOOST : 1);
}

/* ───────────────────── Superficie ───────────────────── */

/**
 * Factor de agarre y resistencia extra en un punto de la pista.
 * @param {object} proj resultado de projectCar
 * @param {object} weather {wet:boolean, rain:number}
 */
export function surfaceAt(proj, weather = {}) {
  let grip = 1;
  let drag = 0;
  if (!proj.onTrack) {
    const over = proj.dist - proj.halfWidth;
    grip = over > 6 ? 0.56 : 0.78;
    drag = 2.4;
  } else if (proj.kerb) {
    grip = 0.9;
    drag = 0.5;
  }
  if (weather.wet) {
    grip *= proj.onTrack ? 0.93 : 0.85;
    drag += proj.onTrack ? 0.35 : 1.6;
  }
  return { grip, drag };
}

/* ───────────────────── Integración del jugador ───────────────────── */

/**
 * Integra el coche del jugador un paso de tiempo.
 * @param {object} c estado del coche (mutado)
 * @param {object} input {steer, throttle, brake, drsPressed}
 * @param {object} track circuito construido
 * @param {object} proj proyección sobre la pista
 * @param {object} env {weather, assists, dt}
 */
export function stepCar(c, input, track, proj, env = {}) {
  const dt = env.dt || 1 / 60;
  if (c.retired) return;
  const assists = env.assists || {};
  const weather = env.weather || {};
  const surf = surfaceAt(proj, weather);

  const v = Math.max(0, c.speed);
  const power = powerFactor(c.car) * (0.94 + (c.car.aero - 78) * 0.0012);
  const pace = tyrePace(c.tyre, c.tyreWear);
  const topSpeed = maxSpeed(c.car, c.drsOpen) * (weather.wet ? 0.94 : 1) * pace;

  /* ── Empuje longitudinal ── */
  let accel = 0;
  const throttle = clamp(input.throttle || 0, 0, 1);
  const brake = clamp(input.brake || 0, 0, 1);
  const useErs = c.ers > 1 && throttle > 0.2;
  const ersBoost = useErs ? 1 + Math.min(0.34, c.ers / ERS_CAPACITY) * 0.34 : 1;
  const speedFactor = clamp(1 - (v / topSpeed) * 0.92, 0, 1);
  accel += throttle * 13.6 * power * ersBoost * speedFactor;
  accel -= brake * brakeFactor(c.car) * 21 * clamp(v / 12, 0, 1);
  accel -= v * v * 0.0032;
  accel -= v * 0.06;
  accel -= surf.drag * (throttle > 0.1 ? 0.3 : 1);
  if (c.inPit) accel -= 6 + v * 0.9;
  c.push *= Math.exp(-4 * dt);

  const newSpeed = Math.max(0, v + (accel + c.push) * dt);
  c.speed = newSpeed;

  /* ── Dirección ── */
  const steer = clamp(input.steer || 0, -1, 1);
  const speedNorm = clamp(v / 92, 0, 1);
  /* Menos ángulo de/volante a alta velocidad */
  const maxYaw = lerp(2.5, 0.5, speedNorm * speedNorm);
  const assist = assists.steeringAssist ?? 0.4;
  const yawRate = steer * maxYaw * (1 - assist * 0.25);
  c.angle = mod(c.angle + yawRate * dt, TAU);

  /* ── Deslizamiento lateral y círculo de tracción ── */
  const fx = Math.cos(c.angle);
  const fy = Math.sin(c.angle);
  const rx = -fy;
  const ry = fx;
  let vLong = c.vx * fx + c.vy * fy;
  let vLat = c.vx * rx + c.vy * ry;

  const grip = gripFactor(c.car) * tyreGrip(c.tyre, c.tyreWear) * surf.grip * (c.damage > 0.4 ? 0.92 : 1);
  const latBudget = 34 * grip * dt;
  const longUse = clamp(Math.abs(throttle - brake) * 0.7 + brake * 0.4, 0, 1);
  const latCap = latBudget * (1 - longUse * 0.32);
  if (Math.abs(vLat) <= latCap) vLat *= 0.55;
  else vLat -= sign(vLat) * latCap;

  vLong = newSpeed;
  c.vx = fx * vLong + rx * vLat;
  c.vy = fy * vLong + ry * vLat;
  c.x += c.vx * dt;
  c.y += c.vy * dt;

  /* ── Estado de la mecánica ── */
  const gearCount = 8;
  const gear = clamp(Math.ceil((newSpeed / topSpeed) * gearCount), 1, gearCount);
  c.gear = gear;
  c.rpm = clamp(0.18 + (newSpeed / topSpeed) * 0.82, 0, 1);
  c.tyreTemp = clamp(lerp(c.tyreTemp, 0.4 + longUse * 0.6, dt * 0.6), 0, 1);
  ageTyre(c, newSpeed * dt, track.length);

  /* ── ERS ── */
  if (useErs) c.ers = clamp(c.ers - ERS_DEPLOY_RATE * dt, 0, ERS_CAPACITY);
  else c.ers = clamp(c.ers + ERS_RECHARGE_RATE * dt * (0.35 + (throttle > 0.85 ? 0.9 : 0.3)), 0, ERS_CAPACITY);

  /* ── DRS ── */
  c.drsZone = inDrsZone(track, proj.idx);
  c.drsAvailable = Boolean(c.drsZone);
  c.drsOpen = Boolean(c.drsAvailable && (env.autoDrs || (input.drsPressed && v > 22)));

  /* ── Desgaste y fiabilidad ── */
  if (surf.grip < 0.85) {
    c.offTrackTime += dt;
    c.tyreWear = clamp(c.tyreWear + dt * 0.012, 0, 1.6);
    if (c.offTrackTime > 0.9) c.damage = clamp(c.damage + dt * 0.07, 0, 1);
  } else {
    c.offTrackTime = Math.max(0, c.offTrackTime - dt * 2);
  }
  if (proj.kerb) c.kerbTime += dt;
  else c.kerbTime = Math.max(0, c.kerbTime - dt * 3);
}

/* ───────────────────── IA sobre la trazada ───────────────────── */

/**
 * Integra un coche de IA con un modelo ligero: avanza sobre el arco de la pista
 * con una velocidad objetivo, corrige su línea y repite errores humanos.
 * @param {object} c estado del coche
 * @param {object} ctx {dt, track, line, speedRef, skill, rng, weather, tyre, avoiding}
 */
export function stepAi(c, ctx) {
  const { dt, track, weather = {} } = ctx;
  if (c.retired) return;
  const m = track.points;
  const surfaceGrip = (weather.wet ? 0.93 : 1) * (c.onTrack ? 1 : 0.72);
  const grip = gripFactor(c.car) * tyreGrip(c.tyre, c.tyreWear) * surfaceGrip;
  const pace = tyrePace(c.tyre, c.tyreWear);

  /* Velocidad objetivo en función de la curva que viene */
  const ahead = 26;
  const i1 = c.idx;
  const i2 = (c.idx + Math.round(ahead / 4.2)) % m.length;
  const k = Math.max(1e-5, Math.abs(m[i2].curv));
  const latAccel = 17.6 * grip * (0.86 + c.skill / 480);
  const vCurve = clamp(Math.sqrt(latAccel / k), 12, maxSpeed(c.car, false) * pace);
  const vTop = maxSpeed(c.car, c.drsOpen) * 0.985 * pace;

  /* Frenada por la distancia a la próxima frenada */
  let target = Math.min(vTop, vCurve);
  const brakingLook = Math.round((vTop * vTop) / (2 * 26 * grip) / 4.2);
  for (let d = 1; d <= brakingLook; d++) {
    const p = m[(c.idx + d) % m.length];
    const kk = Math.max(1e-5, Math.abs(p.curv));
    const vc = clamp(Math.sqrt(latAccel / kk), 12, vTop);
    const dist = d * 4.2;
    const allowed = Math.sqrt(vc * vc + 2 * 26 * grip * dist);
    if (allowed < target) target = allowed;
  }
  /* Si va limpio, no frena de más */
  target = Math.min(target, vTop);
  if (c.avoiding) target *= 0.965;
  /* Coche de seguridad: ritmo de fila india */
  if (ctx.scActive) target = Math.min(target, c.scTarget || 24);

  const accel = target > c.speed ? 12.5 * (c.car.power / 90) : -30 * grip;  c.speed = Math.max(6, c.speed + accel * dt);

  /* Línea objetivo: trazada + anticipación de la frenada + evitación */
  const li = ctx.line[i1] || m[i1];
  const desired = li.offset;
  const brakeShift = clamp((vCurve - c.speed) * 0.6, -3.2, 3.2);
  let targetLateral = desired + brakeShift;
  const limit = Math.max(1.2, m[i1].halfWidth - 1.6);
  if (ctx.avoidLateral) targetLateral += ctx.avoidLateral;
  if (ctx.defendLateral) targetLateral += ctx.defendLateral;
  /* Si se va de pista, vuelve a la trazada antes de perder más tiempo */
  if (Math.abs(c.lateral) > m[i1].halfWidth) targetLateral = lerp(targetLateral, desired, 0.6);
  targetLateral = clamp(targetLateral, -limit, limit);
  c.lateral = lerp(c.lateral, targetLateral, Math.min(1, dt * 3.2));

  /* Deslizamiento y error humano */
  c.slip = (c.slip || 0) * 0.9 + c.rng.gauss(0.6) * dt;
  const wobble = clamp(c.slip, -2.4, 2.4);
  const p = m[i1];
  const lat = c.lateral + wobble;
  const nx = p.nx;
  const ny = p.ny;
  const fx = p.dirX;
  const fy = p.dirY;
  c.x = p.x + nx * lat;
  c.y = p.y + ny * lat;
  c.vx = fx * c.speed;
  c.vy = fy * c.speed;
  c.angle = Math.atan2(fy, fx);
  c.onTrack = Math.abs(lat) <= p.halfWidth + 0.4;
  /* El arco recorrido es la fuente de verdad: si se derivase del punto más
     cercano, el progreso sub-punto se perdería y el coche se quedaría parado */
  c.s = mod((Number.isFinite(c.s) ? c.s : p.s) + c.speed * dt, track.length);
  c.idx = indexAtS(track, c.s);
  c.kerb = Math.abs(lat) > p.halfWidth - 0.9 && Math.abs(lat) < p.halfWidth + 1.4;
  if (!c.onTrack) {
    c.offTrackTime += dt;
    c.tyreWear = clamp(c.tyreWear + dt * 0.006, 0, 1.6);
  } else {
    c.offTrackTime = Math.max(0, c.offTrackTime - dt * 2);
  }

  /* Marcha, ERS, neumáticos */
  c.gear = clamp(Math.ceil((c.speed / (maxSpeed(c.car, false) * pace)) * 8), 1, 8);
  c.rpm = clamp(0.18 + (c.speed / vTop) * 0.82, 0, 1);
  const useErs = c.ers > 2 && c.speed < vTop * 0.9;
  c.ers = clamp(c.ers + (useErs ? -ERS_DEPLOY_RATE : ERS_RECHARGE_RATE) * dt, 0, ERS_CAPACITY);
  ageTyre(c, c.speed * dt, track.length);
  c.tyreTemp = clamp(lerp(c.tyreTemp, 0.75, dt * 0.5), 0, 1);
  c.drsZone = !ctx.scActive && inDrsZone(track, c.idx);
  c.drsAvailable = Boolean(c.drsZone);
  c.drsOpen = Boolean(c.drsZone && c.drsAllowed);
}

/* ───────────────────── Arranque ───────────────────── */

export function applyLaunch(c, track, quality = 0.5, rng = null) {
  /* Comienzo de carrera: la velocidad inicial depende de la reacción */
  const base = 26 + quality * 16;
  c.speed = clamp(base + (rng ? rng.gauss(1.4) : 0), 8, 52);
  c.vx = Math.cos(track.start.heading) * c.speed;
  c.vy = Math.sin(track.start.heading) * c.speed;
  c.started = true;
}

/* ───────────────────── Pit stop ───────────────────── */

export function pitStopMs(state) {
  if (!state) return 0;
  return state.series === 'f2' ? 0 : 4200;
}

export const PIT_BASE_MS = 2400;
export const TYRE_CHANGE_MS = 2100;
