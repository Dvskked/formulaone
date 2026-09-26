import { CIRCUITS } from "../js/data/circuits-data.js";
import { Track } from "../js/game/track.js";
import { RaceEngine } from "../js/game/race-engine.js";
import { runQualifying } from "../js/game/qualifying.js";
import { cloneGrid, buildCarSpecs, defaultUpgrades } from "../js/data/teams-data.js";
import { tyreLifeEstimate } from "../js/game/tires.js";

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
console.log("totalLaps", eng.totalLaps, " pit.boxS", track.pit.boxS.toFixed(0));
console.log("drv  plan                 open  target  cursor  stopDur   life/compound");
for (const c of eng.cars) {
  const plan = (c.stintPlan || []).map(s => `${s.compound}${s.laps}`).join(" ");
  console.log(`${c.driver.short.padEnd(4)} ${plan.padEnd(18)}  ${(c.tire.compound || "").padEnd(4)} ` +
    `${String(c.pitLapTarget).padStart(6)}  ${String(c.stintCursor).padStart(6)}  ` +
    `${String(eng.track.pit.boxS && c.pit.stationaryFor).padStart(5)}  ` +
    `${tyreLifeEstimate(c.tire.compound, track).toFixed(1)}`);
}
