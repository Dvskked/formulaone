import { CIRCUITS } from "../js/data/circuits-data.js";
import { Track } from "../js/game/track.js";
import { RaceEngine } from "../js/game/race-engine.js";
import { runQualifying } from "../js/game/qualifying.js";
import { cloneGrid, buildCarSpecs, defaultUpgrades } from "../js/data/teams-data.js";
import { tyreLifeEstimate, COMPOUNDS } from "../js/game/tires.js";

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

console.log("pit window:", {
  entry: (eng.track.pit.entryS).toFixed(0),
  exit: (eng.track.pit.exitS).toFixed(0),
  box: (eng.track.pit.boxS).toFixed(0),
  wall0: (eng.track.pit.wallS0).toFixed(0),
  wall1: (eng.track.pit.wallS1).toFixed(0),
  length: eng.track.length.toFixed(0),
});
console.log("tyre life S/M/H:", ["soft","medium","hard"].map(c=>tyreLifeEstimate(c, track).toFixed(1)).join(" / "));

const watch = new Set(eng.cars.map(c => c.driver.short));
let lastLog = 0;
while (eng.state !== "finished" && eng.raceTime < 6 * 200) {
  eng.step(1/120, null);
  if (eng.raceTime - lastLog > 20) {
    lastLog = eng.raceTime;
    const p = eng.player;
    const leader = eng.cars[0];
    console.log(`t=${eng.raceTime.toFixed(0)}s lap ${leader.lapsDone} flag=${eng.flag} | ` +
      eng.cars.slice(0, 4).map(c => `${c.driver.short} L${c.lapsDone} P${c.position} ${c.pitStops}st ${COMPOUNDS[c.tire.compound].short}${c.tire.wear.toFixed(2)} d${c.damage.toFixed(2)}${c.retired ? " RET:" + c.retireReason : ""}`).join(" | "));
  }
}
eng.buildResults();
console.log("\npos driver  team        laps stops  stint        wear  dmg   retires");
for (const r of eng.results.rows) {
  console.log(String(r.pos).padStart(3), r.driver.short.padEnd(7), r.team.short.padEnd(12),
    String(r.laps).padStart(4), String(r.pitStops).padStart(5), " ",
    r.stints.map(s=>COMPOUNDS[s.compound].short+s.laps).join("-").padEnd(14),
    r.tyreEnd.toFixed(2), r.damage.toFixed(2), r.dnf ? " " + r.dnfReason : "");
}
console.log("\nleader lapsDone at flag:", eng.cars[0].lapsDone, "totalLaps", eng.totalLaps, "chequeredAt", eng.chequeredAt?.toFixed(1), "raceTime", eng.raceTime.toFixed(1));
const gaps = eng.cars.filter(c=>c.classified).map(c => c.finishTime - eng.cars[0].finishTime).sort((a,b)=>a-b);
console.log("finish gaps:", gaps.map(g=>g.toFixed(1)).join(" "));
