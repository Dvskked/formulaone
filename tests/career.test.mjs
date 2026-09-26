/**
 * career.test.mjs - Node-runnable checks for the season model.
 * Run with: node tests/career.test.mjs
 */
import assert from "node:assert/strict";
import {
  createCareer, hydrate, careerEntries, playerEntry, applyRaceToCareer, rebuildStandings,
  driverTable, teamTable, playerStanding, research, canAfford, rdCost, RD_TREE,
  generateOffers, acceptOffer, resetResearch, currentRound, seasonComplete,
} from "../js/core/career.js";
import { RaceEngine } from "../js/game/race-engine.js";
import { Track } from "../js/game/track.js";
import { getCircuit, CIRCUITS } from "../js/data/circuits-data.js";
import { saveSettings, SETTINGS_DEFAULTS } from "../js/core/storage.js";

let pass = 0;
const check = (label, fn) => {
  try { fn(); pass++; console.log("  ok  " + label); }
  catch (err) { console.error("FAIL  " + label + "\n      " + err.message); process.exitCode = 1; }
};

console.log("\ncareer model");

check("creates a career on the 2026 calendar", () => {
  const c = createCareer({ driverName: "Test Piloto", nation: "ESP", number: 44, teamId: "ferrari" });
  assert.equal(c.season, 2026);
  assert.equal(c.calendar.length, CIRCUITS.length);
  assert.equal(c.calendar.filter((r) => r.status === "pending").length, CIRCUITS.length);
  assert.equal(c.teamId, "ferrari");
  assert.equal(c.driver.num, 44);
  assert.equal(c.driver.name, "Test Piloto");
  assert.equal(currentRound(c).round, 1);
  assert.equal(seasonComplete(c), false);
});

check("builds 22 entries with 11 constructors and 2 drivers each", () => {
  const c = createCareer({ driverName: "Test Piloto", teamId: "ferrari" });
  const entries = careerEntries(c);
  assert.equal(entries.length, 22);
  assert.equal(new Set(entries.map((e) => e.team.id)).size, 11);
  for (const t of new Set(entries.map((e) => e.team.id))) {
    assert.equal(entries.filter((e) => e.team.id === t).length, 2, "team " + t);
  }
  assert.ok(entries.every((e) => e.spec && e.spec.topSpeed > 0), "every entry needs a car spec");
});

check("player occupies the nominated seat and is findable", () => {
  const c = createCareer({ driverName: "Test Piloto", teamId: "alpine" });
  const mine = playerEntry(c);
  assert.equal(mine.driver.id, c.driver.id);
  assert.equal(mine.team.id, "alpine");
  assert.equal(careerEntries(c).filter((e) => e.team.id === "alpine").length, 2);
});

check("only the player's team receives funded upgrades", () => {
  const c = createCareer({ driverName: "Test Piloto", teamId: "ferrari" });
  c.upgrades.aero = 3;
  const entries = careerEntries(c);
  const ferrari = entries.find((e) => e.team.id === "ferrari");
  const rival = entries.find((e) => e.team.id !== "ferrari");
  assert.equal(ferrari.spec.latAccel > rival.spec.latAccel, true, "funded aero should add grip");
});

check("run a full race and fold it into the championship", () => {
  const c = createCareer({ driverName: "Test Piloto", teamId: "ferrari" });
  const circuit = CIRCUITS[0];
  const track = new Track(circuit);
  const entries = careerEntries(c);
  const engine = RaceEngine.fromGrid({
    track, entries, playerId: c.driver.id, laps: 4, seed: 7,
    assists: SETTINGS_DEFAULTS.assists, autopilot: true,
  });
  engine.begin();
  let guard = 0;
  while (!engine.results && guard++ < 200000) engine.step(1 / 60, null);
  assert.ok(engine.results, "race must finish");
  const res = engine.results;
  assert.equal(res.rows.length, 22);
  const before = driverTable(c)[0].points;
  applyRaceToCareer(c, 1, res);
  assert.equal(c.calendar[0].status, "done");
  assert.equal(c.history.length, 1);
  assert.ok(driverTable(c)[0].points > before, "leader should have scored");
  assert.equal(c.funds > 2_400_000, true, "a finished race should pay something");
});

check("replaying a round cannot double-count points", () => {
  const c = createCareer({ driverName: "Test Piloto", teamId: "ferrari" });
  const circuit = CIRCUITS[1];
  const track = new Track(circuit);
  const entries = careerEntries(c);
  const engine = RaceEngine.fromGrid({
    track, entries, playerId: c.driver.id, laps: 3, seed: 9,
    assists: SETTINGS_DEFAULTS.assists, autopilot: true,
  });
  engine.begin();
  let guard = 0;
  while (!engine.results && guard++ < 200000) engine.step(1 / 60, null);
  const res = engine.results;
  applyRaceToCareer(c, 1, res);
  const once = driverTable(c).reduce((s, d) => s + d.points, 0);
  applyRaceToCareer(c, 1, res);
  const twice = driverTable(c).reduce((s, d) => s + d.points, 0);
  assert.equal(once, twice, "points must be stable across a replay");
  assert.ok(once > 0);
});

check("standings rebuild from persisted results (Maps are not serialised)", () => {
  const c = createCareer({ driverName: "Test Piloto", teamId: "ferrari" });
  const track = new Track(CIRCUITS[0]);
  const engine = RaceEngine.fromGrid({
    track, entries: careerEntries(c), playerId: c.driver.id, laps: 3, seed: 3,
    assists: SETTINGS_DEFAULTS.assists, autopilot: true,
  });
  engine.begin();
  let guard = 0;
  while (!engine.results && guard++ < 200000) engine.step(1 / 60, null);
  applyRaceToCareer(c, 1, engine.results);

  // Simulate a save/load round trip: JSON only, no Maps allowed through.
  const { standings, ...persistable } = c;
  const revived = hydrate(JSON.parse(JSON.stringify(persistable)));
  assert.ok(revived.standings.drivers instanceof Map, "drivers table must be a Map again");
  assert.equal(revived.standings.teams instanceof Map, true);
  assert.deepEqual(
    driverTable(revived).map((d) => d.points),
    driverTable(c).map((d) => d.points),
    "points must survive the round trip",
  );
  assert.equal(revived.history.length, 1);
  assert.equal(revived.calendar[0].status, "done");
});

check("R&D spends funds, levels up and respects the cap", () => {
  const c = createCareer({ driverName: "Test Piloto" });
  c.funds = 10_000_000;
  const start = c.upgrades.aero;
  assert.equal(canAfford(c, "aero"), true);
  assert.equal(research(c, "aero"), true);
  assert.equal(c.upgrades.aero, start + 1);
  const cost = rdCost(RD_TREE.find((b) => b.key === "aero"), start);
  assert.equal(c.funds, 10_000_000 - cost);

  c.funds = 0;
  assert.equal(canAfford(c, "power"), false);
  assert.equal(research(c, "power"), false, "cannot research without funds");

  // Cap out and confirm it refuses.
  c.funds = 999_999_999;
  for (let i = 0; i < 20; i++) research(c, "power");
  assert.equal(c.upgrades.power, RD_TREE.find((b) => b.key === "power").max);
  assert.equal(canAfford(c, "power"), false);
});

check("upgrades actually change the car", () => {
  const c = createCareer({ driverName: "Test Piloto", teamId: "ferrari" });
  const before = careerEntries(c).find((e) => e.team.id === "ferrari").spec;
  c.funds = 999_999_999;
  for (let i = 0; i < 5; i++) { research(c, "power"); research(c, "aero"); }
  const after = careerEntries(c).find((e) => e.team.id === "ferrari").spec;
  assert.ok(after.topSpeed > before.topSpeed, "power must raise top speed");
  assert.ok(after.latAccel > before.latAccel, "aero must raise grip");
});

check("season rollover starts a new year and keeps player upgrades", () => {
  const c = createCareer({ driverName: "Test Piloto", teamId: "ferrari" });
  c.funds = 999_999_999;
  research(c, "aero");
  const aero = c.upgrades.aero;
  const track = new Track(CIRCUITS[0]);
  for (const round of c.calendar) {
    const engine = RaceEngine.fromGrid({
      track, entries: careerEntries(c), playerId: c.driver.id, laps: 2, seed: 5,
      assists: SETTINGS_DEFAULTS.assists, autopilot: true,
    });
    engine.begin();
    let guard = 0;
    while (!engine.results && guard++ < 200000) engine.step(1 / 60, null);
    applyRaceToCareer(c, round.round, engine.results);
  }
  assert.equal(c.season, 2027, "a full calendar should roll the season over");
  assert.equal(c.calendar.every((r) => r.status === "pending"), true, "new season starts clean");
  assert.equal(c.calendar[0].season ?? c.season, 2027);
  assert.equal(c.upgrades.aero, aero, "player upgrades carry over");
  assert.ok(Object.keys(c.seasonDev).length > 0, "AI teams develop between seasons");
  assert.equal(seasonComplete(c), false);
});

check("reset returns a pristine season", () => {
  const c = createCareer({ driverName: "Test Piloto" });
  c.funds = 5_000_000; research(c, "power"); c.season = 2030;
  resetResearch(c);
  assert.equal(c.funds, 2_400_000);
  assert.equal(c.upgrades.power, 0);
  assert.equal(c.season, 2026);
  assert.equal(c.history.length, 0);
});

check("offers are reputation-driven and never include the current team", () => {
  const c = createCareer({ driverName: "Test Piloto", teamId: "haas" });
  c.reputation = 5;
  assert.equal(generateOffers(c).length, 0, "a rookie gets no phone calls");
  c.reputation = 100;
  const offers = generateOffers(c);
  assert.ok(offers.length > 0, "a proven driver attracts interest");
  assert.equal(offers.some((o) => o.teamId === "haas"), false, "no offer from your own team");
  assert.equal(offers.length <= 4, true);
  const target = offers[0].teamId;
  acceptOffer(c, target);
  assert.equal(c.teamId, target);
  assert.equal(playerEntry(c).team.id, target, "the player must move seats");
});

check("player standing resolves against the rebuilt tables", () => {
  const c = createCareer({ driverName: "Test Piloto", teamId: "ferrari" });
  const s = playerStanding(c);
  assert.ok(s, "should return a summary");
  assert.equal(teamTable(c).length, 11);
  assert.equal(driverTable(c).length, 22);
});

console.log(`\n${pass} checks passed.\n`);
