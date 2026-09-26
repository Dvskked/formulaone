import { CIRCUITS } from "../js/data/circuits-data.js";
import { Track } from "../js/game/track.js";
import { RaceEngine } from "../js/game/race-engine.js";
import { runQualifying } from "../js/game/qualifying.js";
import { cloneGrid, buildCarSpecs, defaultUpgrades } from "../js/data/teams-data.js";

const track = new Track(CIRCUITS[0]);
const grid = cloneGrid();
const entries = [];
for (const team of grid) {
  const spec = buildCarSpecs(team, defaultUpgrades());
  for (const driver of team.drivers) entries.push({ team, driver, spec });
}
const q = runQualifying({ track, entries, playerId: null, seed: 2024 });
const gridRows = q.grid.map((row, i) => ({
  team: row.entry.team, driver: row.entry.driver, spec: row.entry.spec, gridPos: i + 1,
}));
const eng = RaceEngine.fromGrid({ track, entries: gridRows, playerId: null, laps: 6, seed: 2024 });
eng.begin();
const L = track.length;

const last = new Map();
for (const c of eng.cars) last.set(c.id, { odo: c.odo, reanchors: 0, maxDrop: 0 });
let prevLaps = new Map();

while (eng.state !== "finished" && eng.raceTime < 6 * 200) {
  const before = eng.cars.map(c => c.odo);
  eng.step(1/120, null);
  for (const c of eng.cars) {
    const L2 = last.get(c.id);
    const drop = L2.odo - c.odo;
    if (drop > 40) {
      L2.reanchors++;
      L2.maxDrop = Math.max(L2.maxDrop, drop);
      if (L2.reanchors <= 4) {
        console.log(`REANCHOR ${c.driver.short} t=${eng.raceTime.toFixed(1)} drop=${drop.toFixed(0)}m ` +
          `odo ${L2.odo.toFixed(0)}->${c.odo.toFixed(0)}  s=${c.s.toFixed(0)} idx=${c.trackIndex} lat=${c.lateral.toFixed(1)} ` +
          `hw=${track.halfWidth[c.trackIndex].toFixed(1)} surf=${c.surface} spd=${c.speed.toFixed(0)} ret=${c.retired}`);
      }
    }
    L2.odo = c.odo;
  }
  const curLaps = new Map(eng.cars.map(c => [c.id, c.raceLaps]));
  for (const [id, lp] of curLaps) {
    if (prevLaps.has(id) && lp < prevLaps.get(id)) {
      console.log(`LAP REGRESSION ${eng.cars.find(c=>c.id===id).driver.short} ${prevLaps.get(id)} -> ${lp} at t=${eng.raceTime.toFixed(1)}`);
    }
    prevLaps.set(id, lp);
  }
}
eng.buildResults();
console.log("\nlap monotonicity over the whole race:");
for (const c of eng.cars.slice(0, 6)) {
  const s = last.get(c.id);
  console.log(` ${c.driver.short.padEnd(4)} reanchors=${s.reanchors} maxDrop=${s.maxDrop.toFixed(0)}m  final odo=${c.odo.toFixed(0)} raceLaps=${c.raceLaps} done=${c.lapsDone} laps=${(L/1000).toFixed(2)}km`);
}
console.log("\nresults laps:", eng.results.rows.map(r => `${r.driver.short}:${r.laps}${r.dnf ? "DNF" : ""}`).join(" "));
console.log("totalLaps", eng.totalLaps, "chequeredAt", eng.chequeredAt?.toFixed(1), "raceTime", eng.raceTime.toFixed(1));
