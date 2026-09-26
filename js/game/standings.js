/**
 * standings.js — Drivers' and Constructors' World Championship tables.
 * Official tiebreakers: points, then wins, then podiums, then fastest laps.
 */

export function createStandings(entries) {
  const drivers = new Map();
  const teams = new Map();
  for (const e of entries) {
    drivers.set(e.driver.id, {
      driverId: e.driver.id, driver: e.driver, teamId: e.team.id, team: e.team,
      points: 0, wins: 0, podiums: 0, poles: 0, fastestLaps: 0, top10: 0, races: 0,
      bestFinish: null, dnfs: 0, form: [],
    });
    if (!teams.has(e.team.id)) {
      teams.set(e.team.id, {
        teamId: e.team.id, team: e.team, points: 0, wins: 0, podiums: 0,
        races: 0, bestFinish: null,
      });
    } else {
      const t = teams.get(e.team.id);
      t.team = e.team;
    }
  }
  return { drivers, teams, round: 0 };
}

/** Fold a race result into the championship tables. */
export function applyRaceResult(standings, results) {
  for (const row of results.rows) {
    const d = standings.drivers.get(row.driverId);
    if (d) {
      d.points += row.points;
      d.races += 1;
      if (row.pos === 1) d.wins++;
      if (row.pos <= 3) d.podiums++;
      if (row.pos <= 10) d.top10++;
      if (row.fastestLap) d.fastestLaps++;
      if (row.dnf) d.dnfs++;
      if (row.classified && (d.bestFinish == null || row.pos < d.bestFinish)) d.bestFinish = row.pos;
      d.form = [row.pos, ...d.form].slice(0, 5);
    }
    const t = standings.teams.get(row.teamId);
    if (t) {
      t.points += row.points;
      t.races += 1;
      if (row.pos === 1) t.wins++;
      if (row.pos <= 3) t.podiums++;
      if (row.classified && (t.bestFinish == null || row.pos < t.bestFinish)) t.bestFinish = row.pos;
    }
  }
  standings.round = (standings.round || 0) + 1;
  return standings;
}

const driverCmp = (a, b) =>
  b.points - a.points ||
  b.wins - a.wins ||
  b.podiums - a.podiums ||
  b.fastestLaps - a.fastestLaps ||
  a.driver.name.localeCompare(b.driver.name);

const teamCmp = (a, b) =>
  b.points - a.points || b.wins - a.wins || b.podiums - a.podiums || a.team.name.localeCompare(b.team.name);

export function driversTable(standings) {
  return [...standings.drivers.values()].sort(driverCmp).map((d, i) => ({ ...d, pos: i + 1 }));
}

export function constructorsTable(standings) {
  return [...standings.teams.values()].sort(teamCmp).map((t, i) => ({ ...t, pos: i + 1 }));
}

export function driverStanding(standings, driverId) {
  return driversTable(standings).find((d) => d.driverId === driverId) || null;
}

export function teamStanding(standings, teamId) {
  return constructorsTable(standings).find((t) => t.teamId === teamId) || null;
}

export function championshipDecider(standings) {
  const d = driversTable(standings);
  const t = constructorsTable(standings);
  return { drivers: d[0] || null, teams: t[0] || null };
}

/** Human-readable summary used by the career hub. */
export function standingsSummary(standings, driverId) {
  const dt = driversTable(standings);
  const ct = constructorsTable(standings);
  const me = dt.find((d) => d.driverId === driverId);
  const myTeam = me ? ct.find((t) => t.teamId === me.teamId) : null;
  return {
    driversLeader: dt[0], teamLeader: ct[0],
    player: me, playerTeam: myTeam,
    playerDriverPos: me?.pos ?? null,
    playerTeamPos: myTeam?.pos ?? null,
  };
}
