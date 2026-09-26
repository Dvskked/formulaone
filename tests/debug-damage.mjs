import { RaceEngine } from "../js/game/race-engine.js";
import { Track } from "../js/game/track.js";
import { CIRCUITS } from "../js/data/circuits-data.js";
import { cloneGrid, buildCarSpecs, defaultUpgrades } from "../js/data/teams-data.js";

const N = Number(process.argv[2] || 22);
const CI = Number(process.argv[3] || 0);
const grid = cloneGrid();
const entries = [];
for (const team of grid) {
  const spec = buildCarSpecs(team, defaultUpgrades());
  for (const driver of team.drivers) {
    if (entries.length >= N) break;
    entries.push({ team, driver, spec, gridPos: entries.length });
  }
}
const track = new Track(CIRCUITS[CI]);
const engine = RaceEngine.fromGrid({ track, entries, playerId: null, laps: 6, seed: 7 });

// damage accounting
const acc = new Map();
for (const v of engine.cars) acc.set(v.id, { contact: 0, cSev: 0, barrier: 0, bSev: 0, worstC: 0, worstB: 0 });
const origContact = engine._onContact.bind(engine);
let dumped = 0;
engine._onContact = (A, B, sev) => {
  const a = acc.get(A.id), b = acc.get(B.id);
  a.contact++; a.cSev += sev; a.worstC = Math.max(a.worstC, sev);
  b.contact++; b.cSev += sev; b.worstC = Math.max(b.worstC, sev);
  if (sev > 30 && dumped < 4) {
    dumped++;
    console.log(`SEV ${sev.toFixed(1)} ${A.driver.short}(${A.vx.toFixed(1)},${A.vy.toFixed(1)}) s=${A.s.toFixed(0)} lat=${A.lateral.toFixed(1)} inLane=${A.inPitLane} spd=${(A.speed*3.6).toFixed(0)}  vs  ${B.driver.short}(${B.vx.toFixed(1)},${B.vy.toFixed(1)}) s=${B.s.toFixed(0)} lat=${B.lateral.toFixed(1)} inLane=${B.inPitLane} spd=${(B.speed*3.6).toFixed(0)} ds=${track.signedDelta(A.s,B.s).toFixed(1)} dlat=${(A.lateral-B.lateral).toFixed(1)} dxy=${Math.hypot(A.x-B.x,A.y-B.y).toFixed(1)}`);
  }
  origContact(A, B, sev);
};
const origBarriers = engine._applyBarriers.bind(engine);
engine._applyBarriers = (v) => {
  const before = v.damage;
  origBarriers(v);
  if (v.damage > before + 1e-6) {
    const a = acc.get(v.id);
    a.barrier++; a.bSev += v.damage - before; a.worstB = Math.max(a.worstB, v.lastImpact);
  }
};

engine.begin();
let steps = 0;
while (engine.state !== "finished" && steps < 120000) { engine.step(1 / 120, null); steps++; }
console.log(`steps=${steps} t=${engine.raceTime.toFixed(1)}`);
for (const v of engine.cars.slice().sort((a, b) => b.damage - a.damage)) {
  const a = acc.get(v.id);
  console.log(
    v.driver.short.padEnd(4), "dmg", v.damage.toFixed(2).padStart(5),
    "contact", String(a.contact).padStart(4), "cSev", a.cSev.toFixed(0).padStart(4), "worstC", a.worstC.toFixed(1).padStart(5),
    "barrier", String(a.barrier).padStart(3), "bSev", a.bSev.toFixed(2).padStart(5), "worstB", a.worstB.toFixed(1).padStart(5)
  );
}
