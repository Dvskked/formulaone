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

console.log("plan  driver  compound start  plan                pitTarget  life  pitting");
for (const c of eng.cars.slice(0, 8)) {
  console.log(`      ${c.driver.short.padEnd(5)} ${COMPOUNDS[c.tire.compound].short} wear=${c.tire.wear.toFixed(2)}  ` +
    `${c.stintPlan.map(s => COMPOUNDS[s.compound].short + s.laps).join("-").padEnd(16)} ${String(c.pitLapTarget).padEnd(8)} ${tyreLifeEstimate(c.tire.compound, track).toFixed(1)}  ${c.hasPitController ? "AI" : "PLAYER"}`);
}

// Count incidents and pit requests
const incidents = eng.cars.map(() => ({ barrier: 0, contact: 0, pitReq: 0, pitDone: 0, offTrack: 0 }));
const origMsg = eng.pushMessage.bind(eng);
eng.pushMessage = (text, kind, v) => {
  if (v) {
    const i = eng.cars.indexOf(v);
    if (i >= 0) {
      if (text.includes("barrier")) incidents[i].barrier++;
      if (text.includes("Contact")) incidents[i].contact++;
    }
  }
  return origMsg(text, kind, v);
};
const lastLateralOk = new Map();
while (eng.state !== "finished" && eng.raceTime < 6 * 220) {
  eng.step(1/120, null);
  for (let i = 0; i < eng.cars.length; i++) {
    const c = eng.cars[i];
    const edge = track.halfWidth[c.trackIndex];
    const wasOk = lastLateralOk.get(c.id);
    const isOk = Math.abs(c.lateral) <= edge + 1.5;
    if (wasOk && !isOk) incidents[i].offTrack++;
    lastLateralOk.set(c.id, isOk);
  }
}
eng.buildResults();

console.log("\ndriver lap stops barrier contact offtrack  dmg  retires");
let tb = 0, tc = 0, to = 0;
for (let i = 0; i < eng.cars.length; i++) {
  const c = eng.cars[i], r = eng.results.rows.find(x => x.driverId === c.driver.id), s = incidents[i];
  tb += s.barrier; tc += s.contact; to += s.offTrack;
  console.log(`${c.driver.short.padEnd(5)} ${String(r.laps).padStart(3)} ${String(r.pitStops).padStart(5)} ` +
    `${String(s.barrier).padStart(7)} ${String(s.contact).padStart(7)} ${String(s.offTrack).padStart(8)}  ` +
    `${r.damage.toFixed(2)}  ${r.dnf ? r.dnfReason : ""}`);
}
console.log(`\nTOTALS: barrier=${tb} contact=${tc} offTrackExcursions=${to} DNFs=${eng.results.rows.filter(r=>r.dnf).length}`);
