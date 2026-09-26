import { CIRCUITS } from "../js/data/circuits-data.js";
import { Track } from "../js/game/track.js";
import { RaceEngine } from "../js/game/race-engine.js";
import { runQualifying } from "../js/game/qualifying.js";
import { cloneGrid, buildCarSpecs, defaultUpgrades } from "../js/data/teams-data.js";
import { COMPOUNDS } from "../js/game/tires.js";

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

const stat = eng.cars.map(c => ({ slow: 0, grass: 0, kerb: 0, gravel: 0, inLane: 0, minSpd: 999, maxLat: 0, samples: 0 }));
while (eng.state !== "finished" && eng.raceTime < 6 * 220) {
  eng.step(1/120, null);
  for (let i = 0; i < eng.cars.length; i++) {
    const c = eng.cars[i], s = stat[i];
    s.samples++;
    if (c.speed < 8) s.slow++;
    if (c.surface === "grass") s.grass++;
    if (c.surface === "kerb") s.kerb++;
    if (c.surface === "gravel") s.gravel++;
    if (c.inPitLane) s.inLane++;
    if (c.speed < s.minSpd) s.minSpd = c.speed;
    const over = Math.abs(c.lateral) - track.halfWidth[c.trackIndex];
    if (over > s.maxLat) s.maxLat = over;
  }
}
eng.buildResults();

console.log("driver lap stops  tyre  wear  slow%  grass%  kerb%  gravel%  lane%  maxWide  fuel  dmg  retires");
for (let i = 0; i < eng.cars.length; i++) {
  const c = eng.cars[i], r = eng.results.rows.find(x => x.driverId === c.driver.id), s = stat[i];
  console.log(`${c.driver.short.padEnd(5)} ${String(r.laps).padStart(3)} ${String(r.pitStops).padStart(5)}  ` +
    `${COMPOUNDS[c.tire.compound].short}  ${c.tire.wear.toFixed(2)}  ` +
    `${(100*s.slow/s.samples).toFixed(0).padStart(4)}%  ${(100*s.grass/s.samples).toFixed(0).padStart(5)}%  ` +
    `${(100*s.kerb/s.samples).toFixed(0).padStart(4)}%  ${(100*s.gravel/s.samples).toFixed(0).padStart(5)}%  ` +
    `${(100*s.inLane/s.samples).toFixed(0).padStart(4)}%  ${s.maxLat.toFixed(1).padStart(6)}  ` +
    `${c.fuel.toFixed(1).padStart(4)}  ${c.damage.toFixed(2)}  ${r.dnf ? r.dnfReason : ""}`);
}
console.log("\npit window entry/wall0/box/wall1/exit:",
  [eng.track.pit.entryS, eng.track.pit.wallS0, eng.track.pit.boxS, eng.track.pit.wallS1, eng.track.pit.exitS].map(v=>v.toFixed(0)).join(" / "));
console.log("track length", eng.track.length.toFixed(0), " halfWidth ~", (track.halfWidth[0]*2).toFixed(1));
