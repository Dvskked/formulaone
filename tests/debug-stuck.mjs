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

const stuckFor = eng.cars.map(() => 0);
const worst = eng.cars.map(() => ({ dur: 0, s: 0, lat: 0, surf: "", stuck: 0, thr: 0, brk: 0, steer: 0, t: 0, near: 0 }));
while (eng.state !== "finished" && eng.raceTime < 6 * 220) {
  eng.step(1/120, null);
  for (let i = 0; i < eng.cars.length; i++) {
    const c = eng.cars[i];
    if (c.speed < 6 && !c.retired) {
      stuckFor[i] += 1/120;
      if (stuckFor[i] > worst[i].dur) {
        // How many other cars are within 12m? That is what usually pins them.
        let near = 0;
        for (const o of eng.cars) {
          if (o === c) continue;
          if (Math.hypot(o.x - c.x, o.y - c.y) < 12) near++;
        }
        worst[i] = { dur: stuckFor[i], s: c.s, lat: c.lateral, surf: c.surface,
          stuck: c.aiStuck ?? -1, thr: c.controls.throttle, brk: c.controls.brake,
          steer: c.controls.steer, t: eng.raceTime, near, inLane: c.inPitLane, parked: c.parked };
      }
    } else stuckFor[i] = 0;
  }
}
console.log("driver  maxStuck   at t     s     lat   surf      thr brk steer  near inLane parked");
for (let i = 0; i < eng.cars.length; i++) {
  const c = eng.cars[i], w = worst[i];
  if (w.dur < 3) continue;
  console.log(`${c.driver.short.padEnd(6)} ${w.dur.toFixed(1).padStart(6)}s ${w.t.toFixed(0).padStart(5)}s ` +
    `${w.s.toFixed(0).padStart(5)} ${w.lat.toFixed(1).padStart(6)} ${(w.surf||"").padEnd(7)} ` +
    `${w.thr.toFixed(1)} ${w.brk.toFixed(1)} ${w.steer.toFixed(1).padStart(5)}  ${String(w.near).padStart(3)} ` +
    `${String(w.inLane).padEnd(6)} ${w.parked}`);
}
