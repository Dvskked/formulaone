import { RaceEngine } from "../js/game/race-engine.js";
import { Track } from "../js/game/track.js";
import { CIRCUITS } from "../js/data/circuits-data.js";
import { cloneGrid, buildCarSpecs, defaultUpgrades } from "../js/data/teams-data.js";

const N = Number(process.argv[2] || 1);
const CI = Number(process.argv[3] || 0);
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
let steps = 0;
const t0 = Date.now();
while (engine.state !== "finished" && steps < 120000) { engine.step(1 / 120, null); steps++; }
console.log(`N=${N} ci=${CI} steps=${steps} wall=${((Date.now() - t0) / 1000).toFixed(1)}s state=${engine.state} t=${engine.raceTime.toFixed(1)}`);
for (const v of engine.cars) {
  console.log(
    v.driver.short.padEnd(4), "lap", v.lapsDone,
    "best", v.bestLapTime ? v.bestLapTime.toFixed(2) : "-",
    "laps", v.lapTimes.map((t) => t.toFixed(1)).join("/"),
    "dmg", v.damage.toFixed(2), "wear", v.tire.wear.toFixed(2),
    "fuel", v.fuel.toFixed(1), "pit", v.pitStops,
    v.retired ? "RET " + v.retireReason : ""
  );
}
const tally = new Map();
for (const m of engine.messages) {
  const k = m.text.replace(/[A-Z]{3} [A-Za-z'-]+/g, "X").replace(/[\d.]+/g, "N");
  tally.set(k, (tally.get(k) || 0) + 1);
}
console.log("messages:", [...tally].map(([k, n]) => `${n}x ${k}`).join(" | "));
for (const v of engine.cars) {
  const c = engine.controllers.get(v.id);
  console.log(
    v.driver.short.padEnd(4),
    "pace", v.driver.stats.pace, "qual", c.profile.pace.toFixed(3), "q", c.quality.toFixed(2),
    "cons", c.profile.consistency.toFixed(2), "top", (v.spec.topSpeed * 3.6).toFixed(0),
    "latAcc", v.spec.latAccel.toFixed(1), "laneBias", c.laneBias.toFixed(2)
  );
}
