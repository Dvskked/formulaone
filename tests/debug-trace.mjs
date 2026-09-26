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
const oco = eng.cars.find(c => c.driver.short === "OCO");
const per = eng.cars.find(c => c.driver.short === "PER");
let next = 0;
console.log("  t   |  OCO: spd  s   lat  hw  surf   pit  thr brk steer | PER: spd  s   lat  surf");
while (eng.state !== "finished" && eng.raceTime < 400) {
  eng.step(1/120, null);
  if (eng.raceTime >= next && eng.raceTime > 1) {
    next += 4;
    const f = (c) => `${c.speed.toFixed(0).padStart(3)} ${c.s.toFixed(0).padStart(4)} ${c.lateral.toFixed(1).padStart(5)} ` +
      `${track.halfWidth[c.trackIndex].toFixed(1).padStart(4)} ${(c.surface||"").padEnd(7)} ${c.pitLaneLatex||""} ` +
      `${c.pit.stopped ? "STOP" : c.inPitLane ? "LANE" : c.pit.requested ? "REQ " : "    "} ` +
      `${oco === c ? `${c.controls.throttle.toFixed(1)} ${c.controls.brake.toFixed(1)} ${c.controls.steer.toFixed(1)}` : "            "}`;
    console.log(`${eng.raceTime.toFixed(0).padStart(4)}  |  ${f(oco)} | ${f(per)}`);
  }
}
