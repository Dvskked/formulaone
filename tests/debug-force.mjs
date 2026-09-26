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
const car = eng.cars.find(c => c.driver.short === "SAI");
const orig = car.stepPhysics.bind(car);
let prev = null, logged = 0;
car.stepPhysics = (dt, tr, surf) => {
  const before = car.vLong;
  const desired = { ...car.desiredControls };
  orig(dt, tr, surf);
  const t = eng.raceTime;
  // Log the window where the car refuses to slow down, at full detail.
  if (t > 168.0 && t < 168.4 && logged < 26) {
    const dd = (car.vLong - before) / dt;
    console.log(`t=${t.toFixed(2)} s=${car.s.toFixed(1).padStart(6)} vLong ${before.toFixed(2).padStart(7)}->${car.vLong.toFixed(2).padStart(7)}` +
      ` a=${dd.toFixed(1).padStart(6)} vLat=${car.vLat.toFixed(1).padStart(6)} slip=${car.slipAngle.toFixed(2).padStart(5)}` +
      ` surf=${(surf||"").padEnd(7)} desBrk=${desired.brake.toFixed(2)} ctlBrk=${car.controls.brake.toFixed(2)}` +
      ` desThr=${desired.throttle.toFixed(2)} ctlThr=${car.controls.throttle.toFixed(2)} pitStopped=${car.pitStopped} rpm=${car.rpm.toFixed(0)} gear=${car.gear}`);
    logged++;
  }
  prev = car.vLong;
};
while (eng.state !== "finished" && eng.raceTime < 6 * 220) eng.step(1/120, null);
