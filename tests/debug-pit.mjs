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

const WATCH = new Set(["NOR", "HAM", "PIA", "ANT", "SAI", "COL"]);
for (const c of eng.cars) {
  if (!WATCH.has(c.driver.short)) continue;
  const r = c.requestPit.bind(c), s = c.startPitStop.bind(c), x = c.cancelPit.bind(c);
  c.requestPit = (a, b) => { console.log(`t=${eng.raceTime.toFixed(0)} ${c.driver.short} REQUEST ${a} lap=${c.raceLaps} s=${c.s.toFixed(0)}`); return r(a, b); };
  c.startPitStop = (a, b, d) => { console.log(`   ${c.driver.short} STOPPED at s=${c.s.toFixed(0)}`); return s(a, b, d); };
  c.cancelPit = () => { console.log(`   ${c.driver.short} CANCELLED s=${c.s.toFixed(0)} inLane=${c.inPitLane}`); return x(); };
}
eng.begin();
// Also report, for the watched cars, the closest approach to the box each lap.
let nextLog = 0;
while (eng.state !== "finished" && eng.raceTime < 6 * 220) {
  eng.step(1/120, null);
  if (eng.raceTime > nextLog) {
    nextLog += 15;
    for (const c of eng.cars) {
      if (!WATCH.has(c.driver.short)) continue;
      const toBox = track.signedDelta(c.s, track.pit.boxS);
      if (toBox > -160 && toBox < 160) {
        console.log(`  t=${eng.raceTime.toFixed(0)} ${c.driver.short} nearBox toBox=${toBox.toFixed(0)} ` +
          `s=${c.s.toFixed(0)} lat=${c.lateral.toFixed(1)} inLane=${c.inPitLane} spd=${c.speed.toFixed(0)} ` +
          `req=${c.pit.requested} stopped=${c.pit.stopped} lap=${c.raceLaps}`);
      }
    }
  }
}
console.log("\nfinal stops:", eng.cars.filter(c=>WATCH.has(c.driver.short)).map(c=>`${c.driver.short}:${c.pitStops}`).join(" "));
