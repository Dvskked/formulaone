import { RaceEngine } from "../js/game/race-engine.js";
import { Track } from "../js/game/track.js";
import { CIRCUITS } from "../js/data/circuits-data.js";
import { cloneGrid, buildCarSpecs, defaultUpgrades } from "../js/data/teams-data.js";

const N = Number(process.argv[2] || 2);
const CI = Number(process.argv[3] || 0);
const WHO = Number(process.argv[4] || 1);
const FROM = Number(process.argv[5] || 0);
const TO = Number(process.argv[6] === undefined ? 60 : Number(process.argv[6]));

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
engine.begin();
const v = engine.cars[WHO];
const c = engine.controllers.get(v.id);
console.log(`${v.driver.short} q=${c.quality.toFixed(2)} bias=${c.laneBias.toFixed(2)} L=${track.length.toFixed(0)}`);
let next = FROM;
for (let i = 0; i < TO * 120; i++) {
  engine.step(1 / 120, null);
  const t = engine.raceTime;
  if (t >= next) {
    next += 1;
    console.log(
      `t=${t.toFixed(0).padStart(3)}`,
      "s", v.s.toFixed(0).padStart(4),
      "idx", String(v.trackIndex).padStart(3),
      "spd", (v.speed * 3.6).toFixed(0).padStart(3),
      "lat", v.lateral.toFixed(1).padStart(5),
      "tgt", c.targetLateral.toFixed(1).padStart(5),
      "lane", v.inPitLane ? "Y" : "n",
      "surf", (v.surface || "").slice(0, 4),
      "thr", v.controls.throttle.toFixed(2),
      "brk", v.controls.brake.toFixed(2),
      "str", v.controls.steer.toFixed(2),
      "slip", v.slipAngle.toFixed(2),
      "k", (track.rlKappa[v.trackIndex] || 0).toFixed(4),
      "hw", track.halfWidth[v.trackIndex].toFixed(1)
    );
  }
}
