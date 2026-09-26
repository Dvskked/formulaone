/**
 * career.js - the player-facing season model.
 *
 * Pure logic: no DOM, no canvas. Everything here is a plain object so it can be
 * unit tested in Node and serialised straight into localStorage.
 *
 * NOTE ON SERIALISATION: `standings` is a pair of Maps, which JSON cannot
 * represent. We therefore never persist it. The calendar's per-round `result`
 * payloads are the single source of truth and the tables are rebuilt from them
 * by `rebuildStandings()` on every load.
 */
import { storage, loadSettings } from "./storage.js";
import {
  cloneGrid, defaultUpgrades, buildCarSpecs, findTeam, createCustomDriver, TEAMS_2026,
} from "../data/teams-data.js";
import { buildCalendar } from "../data/circuits-data.js";
import { createStandings, applyRaceResult, driversTable, constructorsTable, standingsSummary } from "../game/standings.js";
import { clamp, clamp01, deepClone } from "./utils.js";

export const SAVE_SLOT = "career";
export const MAX_RD_LEVEL = 5;

/** Default stat block for a brand new custom driver (mid-grid rookie numbers). */
const ROOKIE_STATS = {
  pace: 78, racecraft: 74, consistency: 76, defence: 72, tyres: 75, aggression: 78,
};

/**
 * R&D branches. Every entry here has a real mechanical effect: the first four
 * map onto the upgrade keys that `buildCarSpecs` reads.
 */
export const RD_TREE = [
  { key: "power", name: "Power Unit", icon: "\u{1F50C}", max: MAX_RD_LEVEL, base: 220000, growth: 1.85,
    blurb: "More power and a higher top speed, paid for in weight and a little reliability.",
    effect: (lvl) => `+${(lvl * 1.4).toFixed(1)} power \u00b7 +${(lvl * 1.4 * 0.26 * 3.6).toFixed(0)} km/h` },
  { key: "aero", name: "Aerodynamics", icon: "\u{1F4B8}", max: MAX_RD_LEVEL, base: 200000, growth: 1.8,
    blurb: "More downforce and brake force. The single biggest lap-time lever on the grid.",
    effect: (lvl) => `+${(lvl * 1.5).toFixed(1)} aero \u00b7 +${(lvl * 1.5 * 0.11).toFixed(1)} m/s\u00b2 grip` },
  { key: "reliability", name: "Reliability", icon: "\u{1F527}", max: MAX_RD_LEVEL, base: 150000, growth: 1.7,
    blurb: "Fewer mechanical retirements. Unglamorous, and worth more than it looks.",
    effect: (lvl) => `+${(lvl * 1.2).toFixed(1)} reliability \u00b7 ${Math.round(lvl * 11)}% fewer failures` },
  { key: "pitCrew", name: "Pit Crew", icon: "\u{1F6E3}\u{FE0F}", max: MAX_RD_LEVEL, base: 120000, growth: 1.65,
    blurb: "Faster stops and calmer tyre management from the garage wall.",
    effect: (lvl) => `+${(lvl * 2).toFixed(0)} crew \u00b7 \u2212${(lvl * 0.22).toFixed(2)}s per stop` },
];

export function rdCost(branch, level) {
  return Math.round(branch.base * Math.pow(branch.growth, level));
}

const STARTING_FUNDS = 2_400_000;

/* ------------------------------------------------------------------ */
/* Creation                                                            */
/* ------------------------------------------------------------------ */

export function createCareer(opts = {}) {
  const {
    driverName = "New Driver",
    nation = "ESP",
    number = 99,
    teamId = TEAMS_2026[0].id,
    custom = false,
    stats = ROOKIE_STATS,
    seed = 1,
  } = opts;

  const grid = cloneGrid();
  const seat = findTeam(grid, teamId) || grid[0];
  const seatIndex = grid.indexOf(seat);

  // One identity drives the whole career: the player is always the nominated
  // seat's first driver, whether they wrote a custom name or took a real one.
  const player = createCustomDriver({
    name: driverName, nation, num: number,
    stats: custom ? { ...stats } : { ...ROOKIE_STATS },
  });
  player.custom = !!custom;

  const career = {
    version: 1,
    createdAt: Date.now(),
    season: 2026,
    driver: player,
    teamId: seat.id,
    funds: STARTING_FUNDS,
    upgrades: defaultUpgrades(),
    seasonDev: {},                 // per-team AI upgrade drift, grows each season
    reputation: 12,                // 0-100, drives end-of-season offers
    calendar: buildCalendar(2026).map(decorateRound),
    history: [],
    seed,
  };

  hydrate(career);
  return career;
}

const decorateRound = (r) => ({ ...r, short: String(r.name).replace(/\s+Grand Prix$/, ""), status: "pending", result: null });

/* ------------------------------------------------------------------ */
/* Derived data (rebuilt on every load, never persisted)               */
/* ------------------------------------------------------------------ */

/** The 2026 grid with the player's identity applied. */
export function careerGrid(career) {
  const grid = cloneGrid();
  const idx = grid.findIndex((t) => t.id === career.teamId);
  if (idx < 0) return grid;
  grid[idx] = { ...grid[idx], drivers: [{ ...career.driver }, { ...grid[idx].drivers[1] }] };
  return grid;
}

/** Only the player's own team gets funded upgrades; the AI runs its own drift. */
export function upgradesForTeam(career, teamId) {
  if (teamId === career.teamId) return career.upgrades;
  return career.seasonDev[teamId] || defaultUpgrades();
}

/** Grid entries in the shape `RaceEngine.fromGrid` and `createStandings` want. */
export function careerEntries(career) {
  const out = [];
  for (const team of careerGrid(career)) {
    const spec = buildCarSpecs(team, upgradesForTeam(career, team.id));
    for (const driver of team.drivers) out.push({ team, driver, spec });
  }
  return out;
}

export function playerEntry(career) {
  return careerEntries(career).find((e) => e.driver.id === career.driver.id) || null;
}

export function playerTeam(career) {
  return careerGrid(career).find((t) => t.id === career.teamId) || null;
}

/** Rebuild every non-serialisable field from the persisted race results. */
export function hydrate(career) {
  if (!career.seasonDev) career.seasonDev = {};
  if (!Array.isArray(career.calendar) || !career.calendar.length) {
    career.calendar = buildCalendar(career.season).map(decorateRound);
  }
  for (const r of career.calendar) {
    if (!r.short) r.short = String(r.name).replace(/\s+Grand Prix$/, "");
    if (!r.status) r.status = r.result ? "done" : "pending";
  }
  if (!Array.isArray(career.history)) career.history = [];
  rebuildStandings(career);
  return career;
}

/** Replay every completed round to derive the championship tables. */
export function rebuildStandings(career) {
  const entries = careerEntries(career);
  const s = createStandings(entries);
  for (const round of career.calendar) {
    if (round.status === "done" && round.result) applyRaceResult(s, round.result);
  }
  career.standings = s;
  return s;
}

export function currentRound(career) {
  return career.calendar.find((r) => r.status === "pending") || null;
}

export function nextRoundNumber(career) {
  return currentRound(career)?.round ?? null;
}

export function seasonComplete(career) {
  return !currentRound(career);
}

export function driverTable(career) {
  return driversTable(career.standings);
}

export function teamTable(career) {
  return constructorsTable(career.standings);
}

export function playerStanding(career) {
  return standingsSummary(career.standings, career.driver.id);
}

/* ------------------------------------------------------------------ */
/* Race resolution                                                     */
/* ------------------------------------------------------------------ */

/** Trim a results payload down to the fields worth keeping in a save file. */
const compressResults = (results) => ({
  rows: results.rows.map((r) => ({
    pos: r.pos, driverId: r.driverId, teamId: r.teamId,
    short: r.driver.short, name: r.driver.name, team: r.team.short,
    points: r.points, classified: r.classified, dnf: r.dnf, dnfReason: r.dnfReason,
    laps: r.laps, lapped: r.lapped, pitStops: r.pitStops,
    fastestLap: !!r.fastestLap, gridPos: r.gridPos, gained: r.gained,
    stints: r.stints,
  })),
  laps: results.laps,
  fastestLap: results.fastestLap ? {
    time: results.fastestLap.time,
    short: results.fastestLap.driver?.short ?? null,
    lap: results.fastestLap.lap,
  } : null,
});

/**
 * Fold a finished race into the championship. Safe to call twice for the same
 * round: the replay path rebuilds from scratch so points cannot double-count.
 */
export function applyRaceToCareer(career, roundNumber, results) {
  const slot = career.calendar.find((r) => r.round === roundNumber);
  if (!slot) return career;

  if (slot.status === "done") {
    rebuildStandings(career);
    return career;
  }

  const payload = compressResults(results);
  const me = payload.rows.find((r) => r.driverId === career.driver.id);
  const rawMe = results.rows.find((r) => r.driverId === career.driver.id);
  const mates = payload.rows.filter((r) => r.teamId === career.teamId);
  const myPos = me ? me.pos : payload.rows.length;
  const teamPos = mates.length ? Math.min(...mates.map((r) => r.pos)) : payload.rows.length;
  const myPoints = me ? me.points : 0;

  slot.status = "done";
  slot.result = {
    ...payload,
    playerPos: myPos,
    teamPos,
    playerPoints: myPoints,
    teamPoints: mates.reduce((s, r) => s + r.points, 0),
    myLap: bestLapOf(rawMe ? rawMe.bestLap : null),
    myDamage: rawMe ? rawMe.damage ?? 0 : 0,
  };

  // Income: a win pays the bills, a midfield finish barely covers the tyres.
  const purse = 1_100_000 / Math.max(1, myPos) + myPos * 22_000 + myPoints * 30_000;
  career.funds += Math.round(purse);
  // Reputation tracks results, not money.
  career.reputation = clamp(Math.round(career.reputation + (11 - myPos) * 1.1), 1, 100);

  career.history.push({
    season: career.season, round: slot.round, circuit: slot.name, short: slot.short,
    pos: myPos, points: myPoints, dnf: !me || !!me.dnf, teamPos,
  });

  rebuildStandings(career);
  if (seasonComplete(career)) rollIntoNextSeason(career);
  return career;
}

const bestLapOf = (time) => (typeof time === "number" ? time : null);

/**
 * A new season: fresh calendar and tables, player upgrades carry over as a
 * head start, and every AI team develops one branch so the grid stays alive.
 */
function rollIntoNextSeason(career) {
  const year = career.season + 1;
  const keys = RD_TREE.map((b) => b.key);
  for (const team of careerGrid(career)) {
    if (team.id === career.teamId) continue;
    const cur = career.seasonDev[team.id] || defaultUpgrades();
    const pick = keys[(team.id.charCodeAt(0) + year) % keys.length];
    career.seasonDev[team.id] = { ...cur, [pick]: (cur[pick] || 0) + 1 };
  }
  career.season = year;
  career.calendar = buildCalendar(year).map(decorateRound);
  career.seasonRollover = true;
  rebuildStandings(career);
}

/* ------------------------------------------------------------------ */
/* R&D                                                                 */
/* ------------------------------------------------------------------ */

export function canAfford(career, branchKey) {
  const branch = RD_TREE.find((b) => b.key === branchKey);
  if (!branch) return false;
  const lvl = career.upgrades[branchKey] || 0;
  if (lvl >= branch.max) return false;
  return career.funds >= rdCost(branch, lvl);
}

export function research(career, branchKey) {
  const branch = RD_TREE.find((b) => b.key === branchKey);
  if (!branch || !canAfford(career, branchKey)) return false;
  const lvl = career.upgrades[branchKey] || 0;
  career.funds -= rdCost(branch, lvl);
  career.upgrades[branchKey] = lvl + 1;
  return true;
}

export function researchBulk(career, branchKey, times = 1) {
  let n = 0;
  while (n < times && research(career, branchKey)) n++;
  return n;
}

export function resetResearch(career) {
  career.funds = STARTING_FUNDS;
  career.upgrades = defaultUpgrades();
  career.seasonDev = {};
  career.reputation = 12;
  career.season = 2026;
  career.calendar = buildCalendar(2026).map(decorateRound);
  career.history = [];
  career.seasonRollover = false;
  hydrate(career);
  return career;
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

export function saveCareer(career) {
  const { standings, ...persistable } = career;
  return storage.writeSave(SAVE_SLOT, deepClone({ ...persistable, savedAt: Date.now() }));
}

export function loadCareer() {
  const data = storage.loadSave(SAVE_SLOT);
  if (!data) return null;
  return hydrate(data);
}

export function hasCareer() {
  return !!storage.loadSave(SAVE_SLOT);
}

export function deleteCareer() {
  storage.deleteSave(SAVE_SLOT);
}

export function careerSavedAt() {
  return storage.saveInfo(SAVE_SLOT);
}

export function exportCareer(career) {
  const { standings, ...rest } = career;
  return JSON.stringify(rest, null, 2);
}

export function importCareer(json) {
  const parsed = typeof json === "string" ? JSON.parse(json) : json;
  if (!parsed || typeof parsed !== "object" || !parsed.driver) {
    throw new Error("Not a Predestinato career file");
  }
  const career = hydrate({ ...parsed, settings: { ...loadSettings(), ...(parsed.settings || {}) } });
  saveCareer(career);
  return career;
}

/* ------------------------------------------------------------------ */
/* End-of-season offers                                                */
/* ------------------------------------------------------------------ */

/**
 * Reputation-driven interest. A team only rings you if you are plausibly a
 * step above where you are now and your profile has some pull.
 */
export function generateOffers(career) {
  const table = teamTable(career);
  const mine = table.find((t) => t.teamId === career.teamId);
  const myPts = mine ? mine.points : 0;
  const offers = [];

  for (const t of table) {
    if (t.teamId === career.teamId) continue;
    const ahead = t.points - myPts;
    const interest = clamp01(0.1 + career.reputation / 150 - Math.max(0, ahead) / 700);
    if (interest <= 0.2) continue;
    offers.push({
      teamId: t.teamId,
      teamName: t.team.name,
      teamShort: t.team.short,
      code: t.team.code,
      color: t.team.color,
      interest: Math.round(interest * 100),
      // Prestige squads pay better; backmarkers are a lifeline, not a promotion.
      salary: Math.round((t.team.titles || 0) * 120_000 + interest * 1_200_000 + 400_000),
    });
  }
  return offers.sort((a, b) => b.interest - a.interest).slice(0, 4);
}

export function acceptOffer(career, teamId) {
  if (!teamId || teamId === career.teamId) return career;
  career.teamId = teamId;
  career.seasonRollover = false;
  rebuildStandings(career);
  return career;
}
