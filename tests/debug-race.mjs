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
const log = [];
const origReq = engine.cars.length ? null : null;
for (const v of engine.cars) {
  const orig = v.requestPit.bind(v);
  v.requestPit = (c, f) => { log.push(`REQ ${v.driver.short} lap${v.lapsDone} ${c} target=${v.pitLapTarget} wear=${v.tire.wear.toFixed(2)}`); return orig(c, f); };
  const origStart = v.startPitStop.bind(v);
  v.startPitStop = (t, c, f) => { log.push(`STOP ${v.driver.short} lap${v.lapsDone} ${c} ${t.toFixed(2)}s`); return origStart(t, c, f); };
  const origCancel = v.cancelPit.bind(v);
  v.cancelPit = () => { log.push(`CANCEL ${v.driver.short} lap${v.lapsDone} s=${v.s.toFixed(0)} lane=${v.inPitLane}`); return origCancel(); };
}
let steps = 0;
const t0 = Date.now();
while (engine.state !== "finished" && steps < 120000) { engine.step(1 / 120, null); steps++; }
console.log(`N=${N} ci=${CI} steps=${steps} wall=${((Date.now() - t0) / 1000).toFixed(1)}s state=${engine.state} t=${engine.raceTime.toFixed(1)} totalLaps=${engine.totalLaps} cheq=${engine.chequered} cheqAt=${engine.chequeredAt?.toFixed(1)} maxLap=${Math.max(...engine.cars.map((v) => v.lapsDone))} startOdo=${engine.cars[0].startOdo}`);
for (const v of engine.cars) {
  console.log(
    v.driver.short.padEnd(4), "lap", v.lapsDone, "odo", v.odo.toFixed(1), "startOdo", v.startOdo, "L", v._length, v.finished ? "FIN" : "   ",
    "best", v.bestLapTime ? v.bestLapTime.toFixed(2) : "-",
    "laps", v.lapTimes.map((t) => t.toFixed(1)).join("/"),
    "dmg", v.damage.toFixed(2), "wear", v.tire.wear.toFixed(2),
    "fuel", v.fuel.toFixed(1), "pit", v.pitStops,
    v.retired ? "RET " + v.retireReason : ""
  );
}
if (engine.results) {
  console.log("RESULTS:");
  for (const r of engine.results.rows.slice(0, 8)) {
    console.log(` ${String(r.pos).padStart(2)}. ${r.driver.short.padEnd(4)} L${r.laps} cls=${r.classified} dnf=${r.dnf || "-"} t=${r.time?.toFixed(2)} pts=${r.points}`);
  }
}
const tally = new Map();
console.log("PIT LOG:\n  " + log.join("\n  "));
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
