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
const who = process.argv[2] || "SAI";
const car = eng.cars.find(c => c.driver.short === who);
let last = -1;
while (eng.state !== "finished" && eng.raceTime < 6 * 220) {
  eng.step(1/120, null);
  const toEntry = track.delta(car.s, track.pit.entryS);
  // Sample the whole pit approach: from 420m out to the box, then to the exit.
  if (car.pit.requested && toEntry < 420 && last < 0) last = 0;
  if (last >= 0) {
    const toBox = track.signedDelta(car.s, track.pit.boxS);
    const bucket = Math.round(car.s / 20) * 20;
    if (bucket !== last) {
      last = bucket;
      if (car.s < 900) {
        console.log(`t=${eng.raceTime.toFixed(0).padStart(3)} s=${car.s.toFixed(0).padStart(4)} lat=${car.lateral.toFixed(1).padStart(5)} ` +
          `hw=${track.halfWidth[car.trackIndex].toFixed(1)} spd=${car.speed.toFixed(1).padStart(5)} ` +
          `toBox=${toBox.toFixed(0).padStart(5)} inLane=${String(car.inPitLane).padEnd(5)} req=${String(car.pit.requested).padEnd(5)} ` +
          `wall=${track.inPitWall(car.s)} thr=${car.controls.throttle.toFixed(1)} brk=${car.controls.brake.toFixed(1)}`);
      }
    }
    if (car.s > 900) break;
  }
}
console.log(`pitStops=${car.pitStops}`);
