/**
 * tires.js — compound definitions, degradation model and pit-stop arithmetic.
 * Tyre behaviour is deliberately simple but strategic: grip peaks after a few
 * laps then falls away, and the cliff arrives sooner the softer the compound.
 */

import { clamp, lerp, clamp01 } from "../core/utils.js";

export const COMPOUNDS = {
  soft: {
    key: "soft", name: "Soft", short: "S", color: "#ff4d5e", ring: "#ff2b3f",
    baseGrip: 1.0, warmup: 2.4, life: 0.80, degFactor: 1.0, pitWin: [0, 0.32], pitLoss: 24,
  },
  medium: {
    key: "medium", name: "Medium", short: "M", color: "#ffd166", ring: "#ffc23d",
    baseGrip: 0.965, warmup: 3.2, life: 1.0, degFactor: 0.72, pitWin: [0.14, 0.55], pitLoss: 20,
  },
  hard: {
    key: "hard", name: "Hard", short: "H", color: "#d8dee9", ring: "#c3cad8",
    baseGrip: 0.93, warmup: 4.0, life: 1.3, degFactor: 0.52, pitWin: [0.30, 0.78], pitLoss: 18,
  },
  inter: {
    key: "inter", name: "Intermediate", short: "I", color: "#35d07f", ring: "#28b96a",
    baseGrip: 0.90, warmup: 2.0, life: 0.95, degFactor: 0.85, pitWin: [0, 0.7], pitLoss: 26,
    wetBonus: 1.12,
  },
  wet: {
    key: "wet", name: "Wet", short: "W", color: "#5cc8ff", ring: "#41b6f0",
    baseGrip: 0.82, warmup: 2.6, life: 0.88, degFactor: 0.9, pitWin: [0, 0.7], pitLoss: 30,
    wetBonus: 1.2,
  },
};

export const COMPOUND_LIST = Object.values(COMPOUNDS);

export function createTyre(compound = "soft") {
  const c = COMPOUNDS[compound] || COMPOUNDS.soft;
  return {
    compound: c.key,
    wear: 0,            // 0 = fresh, 1 = destroyed
    age: 0,             // laps on this set
    temp: 0.35,         // 0 = cold, 1 = in the window
    stintStartLap: 1,
    laps: 0,
    grained: 0,
    lifeLimit: 1,       // compound life before the cliff (scaled by circuit)
  };
}

export function tyreLifeEstimate(compoundKey, track, laps = 6) {
  const c = COMPOUNDS[compoundKey] || COMPOUNDS.soft;
  const base = { soft: 4.2, medium: 6.0, hard: 8.0, inter: 5.2, wet: 4.8 }[c.key] || 5;
  return Math.max(1.5, base * c.life / (track.abrasiveness || 1) - 0.4 + laps * 0.02);
}

export function makeTyre(compoundKey, track, stintStartLap = 1) {
  const t = createTyre(compoundKey);
  t.stintStartLap = stintStartLap;
  t.lifeLimit = tyreLifeEstimate(compoundKey, track);
  return t;
}

/**
 * Advance a tyre by one lap.
 * @param {object} t tyre state
 * @param {object} opts { track, load, skill, isPlayer }
 */
export function wearTyre(t, opts) {
  const c = COMPOUNDS[t.compound] || COMPOUNDS.soft;
  const { track, load = 1, skill = 0.85 } = opts;
  const ab = track?.abrasiveness ?? 1;

  // Base degradation, modulated by how hard the car is being pushed.
  let rate = 0.115 * c.degFactor * ab * (0.7 + load * 0.55);
  // Clean drivers degrade the tyres less.
  rate *= lerp(1.06, 0.9, clamp01(skill));
  t.wear = clamp01(t.wear + rate);
  t.age += 1;
  t.laps += 1;

  // Temperature: comes in over the first few laps, then slowly drifts.
  if (t.laps <= c.warmup) t.temp = lerp(0.3, 0.92, t.laps / c.warmup);
  else t.temp = clamp(0.92 - 0.03 * (t.laps - c.warmup), 0.4, 1);

  // Graining: hard tyres pick up degradation faster as they get old.
  if (t.laps > t.lifeLimit * 0.55) t.grained = clamp01((t.laps - t.lifeLimit * 0.55) / (t.lifeLimit * 0.45));
  return t;
}

/** Grip multiplier from a tyre, including temperature and the end-of-life cliff. */
export function tyreGrip(t) {
  const c = COMPOUNDS[t.compound] || COMPOUNDS.soft;
  // Temperature window: 0.6-1.0 is the sweet spot.
  const tempFactor = 0.9 + 0.1 * Math.sin(clamp01(t.temp) * Math.PI);
  const life = 1 - t.wear * 0.26;
  const cliff = t.wear > 0.82 ? 1 - (t.wear - 0.82) * 1.35 : 1;
  const grained = 1 - t.grained * 0.05;
  return clamp(c.baseGrip * tempFactor * life * cliff * grained, 0.42, 1.06);
}

export function tyreStatus(t) {
  if (t.wear < 0.45) return { key: "good", label: "Healthy", color: "#35d07f" };
  if (t.wear < 0.68) return { key: "used", label: "Used", color: "#ffd166" };
  if (t.wear < 0.85) return { key: "worn", label: "Worn", color: "#ff9f43" };
  return { key: "critical", label: "Critical", color: "#ff4d5e" };
}

/**
 * Strategy planner — chooses a stint plan for the player's race distance.
 * Returns an ordered list of stints with the compound for each.
 */
export function planStrategy(track, totalLaps, preferred = "balanced") {
  const plans = {
    aggressive: [
      { compound: "soft", laps: Math.max(2, Math.round(totalLaps * 0.45)) },
      { compound: "soft", laps: Math.max(2, totalLaps - Math.round(totalLaps * 0.45)) },
    ],
    balanced: [
      { compound: "medium", laps: Math.max(2, Math.round(totalLaps * 0.55)) },
      { compound: "soft", laps: Math.max(2, totalLaps - Math.round(totalLaps * 0.55)) },
    ],
    oneStop: [
      { compound: "hard", laps: Math.max(3, Math.round(totalLaps * 0.62)) },
      { compound: "medium", laps: Math.max(2, totalLaps - Math.round(totalLaps * 0.62)) },
    ],
    long: [
      { compound: "hard", laps: Math.max(3, totalLaps - 2) },
      { compound: "soft", laps: 2 },
    ],
  };
  const list = (plans[preferred] || plans.balanced).map((s) => ({ ...s }));
  // Re-balance so the stints always add up to the race distance.
  let acc = 0;
  for (let i = 0; i < list.length - 1; i++) {
    list[i].laps = Math.max(2, Math.min(list[i].laps, totalLaps - acc - 2 * (list.length - 1 - i)));
    acc += list[i].laps;
  }
  list[list.length - 1].laps = Math.max(2, totalLaps - acc);
  return list;
}

/** Estimated total pit time (stationary + pit lane loss) for a car. */
export function pitStopTime(car, teamStats, compoundKey) {
  const c = COMPOUNDS[compoundKey] || COMPOUNDS.soft;
  const crew = (teamStats?.pitCrew ?? 80) / 100;
  const base = 2.35 / (0.7 + crew * 0.55);
  const compPenalty = compoundKey === "soft" ? 0.35 : compoundKey === "hard" ? -0.1 : 0.12;
  return {
    stationary: clamp(base + compPenalty, 1.5, 5.5),
    laneLoss: 4.5 + (c.pitLoss || 18) * 0.18,
  };
}

/** 2026-style fuel burn: ~110 kg per race, less than half a kilo per lap. */
export const FUEL_PER_LAP = 1.05;

export function raceFuelLoad(totalLaps) {
  return +(totalLaps * FUEL_PER_LAP + 2.2).toFixed(2);
}

export const fuelBurnRate = (throttle, speed) => 0.0042 + throttle * 0.0102 + speed * 0.000045;
