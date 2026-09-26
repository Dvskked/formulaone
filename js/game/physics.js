/**
 * physics.js — the driving model.
 *
 * A compact bicycle model with load-sensitive grip, a surface model
 * (asphalt / kerb / grass), fuel mass, damage and an 8-speed gearbox.
 * Everything is in SI units: metres, seconds, kilograms, newtons.
 */

import { clamp, clamp01, lerp, wrapPi, sign } from "../core/utils.js";

export const CAR = {
  length: 5.2,
  width: 2.0,
  wheelbase: 3.6,
  maxSteer: 0.56,        // rad at full lock, standstill
  steerSpeedFalloff: 0.055,
  gears: [3.1, 2.05, 1.52, 1.18, 0.95, 0.79, 0.66, 0.55],
  finalDrive: 3.6,
  shiftUpRpm: 11800,
  shiftDownRpm: 6400,
  idleRpm: 3600,
  maxRpm: 13200,
  shiftTime: 0.16,
};

export const SURFACES = {
  asphalt: { grip: 1.0, drag: 1.0, rumble: 0, name: "Track" },
  kerb: { grip: 0.93, drag: 1.1, rumble: 1, name: "Kerb" },
  // Run-off has to be survivable. If drag here outruns the available drive
  // force, a car that puts one wheel over the white line is stranded at
  // walking pace for the rest of the race, which is neither realistic nor
  // fun. These numbers cost a couple of seconds, not a lap.
  grass: { grip: 0.70, drag: 1.45, rumble: 0.3, name: "Run-off" },
  gravel: { grip: 0.42, drag: 4.6, rumble: 0.8, name: "Gravel" },
};

/** Torque curve, normalised 0..1 across the rev range. */
const REVERSE_MAX = 6;            // m/s, fastest the reverse gear will push

export function torqueFactor(rpm) {
  const x = clamp01((rpm - CAR.idleRpm) / (CAR.maxRpm - CAR.idleRpm));
  // Rises quickly, plateaus, falls away at the top (soft limiter).
  return clamp(0.55 + 0.62 * Math.sin(Math.PI * Math.pow(x, 0.82)) - Math.pow(x, 6) * 0.35, 0.2, 1.08);
}

/**
 * Advance one vehicle by dt seconds.
 * Mutates `v` in place. `env` supplies the environment (see Session).
 */
export function stepVehicle(v, dt, env) {
  const car = v.spec;
  const mass = car.mass + v.fuel;          // kg, fuel is a real load
  const surface = SURFACES[v.surface] || SURFACES.asphalt;

  // --- basis vectors -----------------------------------------------------
  const fx = Math.cos(v.heading), fy = Math.sin(v.heading);
  const rx = -fy, ry = fx;
  let vLong = v.vx * fx + v.vy * fy;
  let vLat = v.vx * rx + v.vy * ry;
  const absLong = Math.abs(vLong);
  const speed = Math.hypot(v.vx, v.vy);

  // --- steering ----------------------------------------------------------
  const lockScale = 1 / (1 + absLong * CAR.steerSpeedFalloff);
  const maxSteer = CAR.maxSteer * lockScale * (v.assists?.understeerAssist ? 1.06 : 1);
  const steerAngle = v.controls.steer * maxSteer;
  const desiredYaw = (vLong / CAR.wheelbase) * Math.tan(steerAngle);

  // --- longitudinal ------------------------------------------------------
  const vMax = car.topSpeed * (1 - v.damage * 0.14);
  let drive = 0;
  if (v.controls.throttle > 0 && !v.pitStopped) {
    const spool = clamp01(1 - absLong / (vMax * 1.08));
    const tc = v.assists?.tractionControl ? 0.72 : 1;
    drive = car.driveForce * v.controls.throttle * torqueFactor(v.rpm) * spool * tc;
  }
  let braking = 0;
  if (v.controls.brake > 0 && !v.pitStopped) {
    if (vLong > 0.4) {
      braking = -car.brakeForce * v.controls.brake * (v.assists?.abs ? 0.88 : 1);
    } else if (!v.inPitLane && !v.ended && vLong > -REVERSE_MAX) {
      // Reverse gear. Capped: without a speed limit, holding the brake while
      // travelling backwards feeds in full reverse thrust and accelerates the
      // car away down the circuit faster and faster.
      drive = -car.driveForce * 0.24 * v.controls.brake;   // reverse
    }
  }
  if (v.controls.handbrake) braking = -car.brakeForce * 0.5 * sign(vLong);

  const drag = car.dragArea * vLong * absLong * surface.drag * (v.towFactor ?? 1);
  const rolling = car.rollingResist * vLong * (v.surface === "asphalt" ? 1 : 4);
  const offTrack = v.surface === "asphalt" ? 0 : 0.3 * vLong * absLong;

  const aLong = (drive + braking - drag - rolling - offTrack) / mass;
  vLong += aLong * dt;
  if (v.controls.throttle === 0 && v.controls.brake === 0 && Math.abs(vLong) < 0.35) vLong *= 0.6;

  // --- lateral grip ------------------------------------------------------
  const latCap = car.latAccel * v.latGrip * surface.grip * (1 - v.damage * 0.12);
  const gripDamp = v.assists?.tractionControl ? 7.5 : 5.6;
  const latForce = clamp(-vLat * gripDamp, -latCap, latCap);   // m/s^2
  vLat += latForce * dt;

  // Cornering scrub: hard cornering bleeds longitudinal speed.
  vLong -= sign(vLong) * Math.abs(latForce) * 0.3 * dt;

  // --- yaw ---------------------------------------------------------------
  const yawCap = latCap / Math.max(7, absLong);
  const yaw = clamp(desiredYaw, -yawCap, yawCap);
  v.yawRate = lerp(v.yawRate, yaw, 1 - Math.exp(-18 * dt));
  v.heading = wrapPi(v.heading + v.yawRate * dt);
  v.slipAngle = Math.atan2(vLat, Math.max(7, absLong));

  // --- recompose velocity in the new frame -------------------------------
  const nfx = Math.cos(v.heading), nfy = Math.sin(v.heading);
  const nrx = -nfy, nry = nfx;
  v.vx = nfx * vLong + nrx * vLat;
  v.vy = nfy * vLong + nry * vLat;

  v.speed = Math.hypot(v.vx, v.vy);
  v.vLong = nfx * v.vx + nfy * v.vy;
  v.vLat = nrx * v.vx + nry * v.vy;
  v.lateralG = latForce;
  v.slipMagnitude = clamp01(Math.abs(v.slipAngle) / 0.32);
  v.wheelSpin = v.controls.throttle > 0.5 && v.speed < 0.6 ? 1 : 0;

  // --- position integration ----------------------------------------------
  v.x += v.vx * dt;
  v.y += v.vy * dt;

  return v;
}

/** Update the gearbox from road speed. Call once per physics step. */
export function updateGearbox(v, dt) {
  const car = v.spec;
  const topSpeed = car.topSpeed;
  const ratios = CAR.gears;
  if (v.shiftTimer > 0) v.shiftTimer -= dt;

  // Simple automatic gearbox: shift up near the limiter, down when rpm drops.
  // The decision is made on *speed* against the current gear's span rather than
  // on rpm. The rpm model below pins rpm at exactly `shiftUpRpm` at the top of
  // a gear, so a strict `rpm > shiftUpRpm` test could never fire and every car
  // stayed in first gear for the whole race on soft-limiter torque.
  const gearSpan = 1 / ratios.length;
  const g = v.gear - 1;
  const vTop = topSpeed * ((g + 1) / ratios.length);
  let targetGear = v.gear;
  if (v.speed >= vTop && v.gear < ratios.length) targetGear = v.gear + 1;
  else if (v.rpm < CAR.shiftDownRpm && v.gear > 1) targetGear = v.gear - 1;

  if (targetGear !== v.gear && v.shiftTimer <= 0) {
    v.gear = targetGear;
    v.shiftTimer = CAR.shiftTime;
    v.justShifted = true;
  } else {
    v.justShifted = false;
  }

  // Map speed onto the gearbox so the needle sweeps per gear.
  const span = topSpeed * (g / ratios.length + gearSpan * 0.5) ;
  const vStart = topSpeed * (g / ratios.length);
  const t = clamp01((v.speed - vStart) / Math.max(1, span - vStart));
  v.rpm = lerp(CAR.shiftDownRpm, CAR.shiftUpRpm, t);
  if (v.speed < 3) v.rpm = lerp(CAR.idleRpm, CAR.shiftDownRpm, clamp01(v.speed / 3));
  if (v.controls.throttle > 0.6 && v.speed > 2) v.rpm = Math.max(v.rpm, CAR.idleRpm + 900);
  v.rpm = clamp(v.rpm, CAR.idleRpm, CAR.maxRpm);
  return v;
}

/** Slipstream / tow: less drag when running close behind another car. */
export function applySlipstream(v, factor) {
  v.slipstream = clamp01(factor);
  v.towFactor = 1 - 0.24 * v.slipstream;
  return v;
}

/** Impact response for car-to-car and barrier contact. */
export function applyImpact(v, nx, ny, strength, damageScale = 1) {
  const vn = v.vx * nx + v.vy * ny;
  v.vx += nx * strength;
  v.vy += ny * strength;
  const spin = (nx * Math.cos(v.heading) + ny * Math.sin(v.heading)) * 0.9;
  v.heading = wrapPi(v.heading + spin * 0.25);
  if (strength > 2) {
    v.damage = clamp01(v.damage + strength * 0.004 * damageScale);
    v.impactFlash = 1;
  }
  v.lastImpact = Math.max(v.lastImpact || 0, strength);
  return vn;
}

export const forwardVector = (a) => ({ x: Math.cos(a), y: Math.sin(a) });
export const rightVector = (a) => ({ x: -Math.sin(a), y: Math.cos(a) });
