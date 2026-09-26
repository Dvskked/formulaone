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

const byLap = new Map();
const byS = new Map();
const bySeverity = { slight: 0, big: 0 };
const wasOk = new Map();
while (eng.state !== "finished" && eng.raceTime < 6 * 220) {
  eng.step(1/120, null);
  for (const c of eng.cars) {
    const edge = track.halfWidth[c.trackIndex];
    const ok = Math.abs(c.lateral) <= edge + 1.5;
    const prev = wasOk.get(c.id);
    if (prev && !ok) {
      const lap = c.raceLaps;
      byLap.set(lap, (byLap.get(lap) || 0) + 1);
      const bucket = Math.round(c.s / 100) * 100;
      byS.set(bucket, (byS.get(bucket) || 0) + 1);
      const over = Math.abs(c.lateral) - edge;
      if (over > 5) bySeverity.big++; else bySeverity.slight++;
    }
    wasOk.set(c.id, ok);
  }
}
eng.buildResults();

console.log("excursions by race lap:", [...byLap.entries()].sort((a,b)=>a[0]-b[0]).map(([l,n])=>`L${l}:${n}`).join(" "));
console.log("excursions by track s (100m buckets):", [...byS.entries()].sort((a,b)=>a[0]-b[0]).map(([s,n])=>`${s}m:${n}`).join(" "));
console.log("severity:", bySeverity, " (slight = <5m wide, big = >5m)");
console.log("\ntrack corners:");
for (const c of track.corners) {
  const bucket = Math.round(c.s / 100) * 100;
  console.log(`  T${String(c.number).padStart(2)} s=${c.s.toFixed(0).padStart(4)} sev=${c.severity.toFixed(4)} dir=${c.dir > 0 ? "R" : "L"} excursions=${byS.get(bucket) || 0}`);
}
console.log("\nhalfWidth min/max:", Math.min(...track.halfWidth).toFixed(1), Math.max(...track.halfWidth).toFixed(1));
const gaps = eng.results.rows.filter(r => !r.dnf).map(r => r.time - eng.results.rows[0].time).sort((a,b)=>a-b);
console.log("finish gaps:", gaps.map(g => g.toFixed(1)).join(" "));
console.log("laps completed:", eng.results.rows.map(r => r.laps).join(" "));
