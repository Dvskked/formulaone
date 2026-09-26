/**
 * teams-data.js — the official 2026 Formula 1 World Championship grid.
 *
 * 11 constructors / 22 race seats, including the all-new Cadillac entry.
 * All trademarks belong to their respective owners; this is a non-commercial
 * fan project. Team colours and ratings are game values, not official data.
 */

export const DRIVER_STATS = {
  pace: "Raw one-lap speed",
  racecraft: "Overtaking & wheel-to-wheel skill",
  consistency: "Lap-time repeatability",
  defence: "Protecting a side",
  tyres: "Tyre management",
  aggression: "Willingness to risk it",
};

/** @type {Team[]} */
export const TEAMS_2026 = [
  {
    id: "mclaren",
    name: "McLaren Mastercard F1 Team",
    short: "McLaren",
    code: "MCL",
    color: "#ff8000",
    accent: "#00d2be",
    engine: "Mercedes",
    base: "Woking, UK",
    founded: 1963,
    titles: 10,
    stats: { power: 93, aero: 95, reliability: 86, pitCrew: 88 },
    drivers: [
      { id: "norris", name: "Lando Norris", short: "NOR", num: 1, nation: "GBR", flag: "\u{1F1EC}\u{1F1E7}", nationName: "United Kingdom",
        stats: { pace: 97, racecraft: 96, consistency: 92, defence: 90, tyres: 90, aggression: 84 } },
      { id: "piastri", name: "Oscar Piastri", short: "PIA", num: 81, nation: "AUS", flag: "\u{1F1E6}\u{1F1FA}", nationName: "Australia",
        stats: { pace: 95, racecraft: 94, consistency: 96, defence: 95, tyres: 93, aggression: 80 } },
    ],
  },
  {
    id: "redbull",
    name: "Oracle Red Bull Racing",
    short: "Red Bull",
    code: "RBR",
    color: "#3671c6",
    accent: "#fcdc04",
    engine: "Red Bull Ford",
    base: "Milton Keynes, UK",
    founded: 1977,
    titles: 11,
    stats: { power: 95, aero: 94, reliability: 90, pitCrew: 91 },
    drivers: [
      { id: "verstappen", name: "Max Verstappen", short: "VER", num: 3, nation: "NED", flag: "\u{1F1F3}\u{1F1F1}", nationName: "Netherlands",
        stats: { pace: 99, racecraft: 98, consistency: 91, defence: 94, tyres: 87, aggression: 99 } },
      { id: "hadjar", name: "Isack Hadjar", short: "HAD", num: 6, nation: "FRA", flag: "\u{1F1EB}\u{1F1F7}", nationName: "France",
        stats: { pace: 92, racecraft: 88, consistency: 90, defence: 86, tyres: 89, aggression: 85 } },
    ],
  },
  {
    id: "mercedes",
    name: "Mercedes-AMG Petronas F1 Team",
    short: "Mercedes",
    code: "MER",
    color: "#00d2be",
    accent: "#a7f3d8",
    engine: "Mercedes",
    base: "Brackley, UK",
    founded: 2010,
    titles: 9,
    stats: { power: 96, aero: 90, reliability: 88, pitCrew: 87 },
    drivers: [
      { id: "russell", name: "George Russell", short: "RUS", num: 63, nation: "GBR", flag: "\u{1F1EC}\u{1F1E7}", nationName: "United Kingdom",
        stats: { pace: 96, racecraft: 95, consistency: 97, defence: 96, tyres: 94, aggression: 88 } },
      { id: "antonelli", name: "Kimi Antonelli", short: "ANT", num: 12, nation: "ITA", flag: "\u{1F1EE}\u{1F1F9}", nationName: "Italy",
        stats: { pace: 93, racecraft: 90, consistency: 88, defence: 87, tyres: 90, aggression: 84 } },
    ],
  },
  {
    id: "ferrari",
    name: "Scuderia Ferrari HP",
    short: "Ferrari",
    code: "FER",
    color: "#e8002d",
    accent: "#ffd6a5",
    engine: "Ferrari",
    base: "Maranello, Italy",
    founded: 1947,
    titles: 16,
    stats: { power: 98, aero: 95, reliability: 82, pitCrew: 89 },
    drivers: [
      { id: "hamilton", name: "Lewis Hamilton", short: "HAM", num: 44, nation: "GBR", flag: "\u{1F1EC}\u{1F1E7}", nationName: "United Kingdom",
        stats: { pace: 98, racecraft: 98, consistency: 93, defence: 95, tyres: 92, aggression: 86 } },
      { id: "leclerc", name: "Charles Leclerc", short: "LEC", num: 16, nation: "MON", flag: "\u{1F1F2}\u{1F1FD}", nationName: "Monaco",
        stats: { pace: 97, racecraft: 92, consistency: 89, defence: 88, tyres: 90, aggression: 93 } },
    ],
  },
  {
    id: "racingbulls",
    name: "Visa Cash App Racing Bulls",
    short: "Racing Bulls",
    code: "RBS",
    color: "#4a63d8",
    accent: "#7ef0c8",
    engine: "Red Bull Ford",
    base: "Milton Keynes, UK",
    founded: 2006,
    titles: 0,
    stats: { power: 92, aero: 88, reliability: 84, pitCrew: 86 },
    drivers: [
      { id: "lawson", name: "Liam Lawson", short: "LAW", num: 30, nation: "NZL", flag: "\u{1F1F3}\u{1F1FF}", nationName: "New Zealand",
        stats: { pace: 89, racecraft: 88, consistency: 86, defence: 85, tyres: 86, aggression: 88 } },
      { id: "lindblad", name: "Arvid Lindblad", short: "LIN", num: 41, nation: "GBR", flag: "\u{1F1EC}\u{1F1E7}", nationName: "United Kingdom",
        stats: { pace: 88, racecraft: 84, consistency: 82, defence: 82, tyres: 84, aggression: 88 } },
    ],
  },
  {
    id: "alpine",
    name: "BWT Alpine F1 Team",
    short: "Alpine",
    code: "ALP",
    color: "#ff87bc",
    accent: "#0090ff",
    engine: "Mercedes",
    base: "Enstone, UK",
    founded: 1978,
    titles: 0,
    stats: { power: 89, aero: 86, reliability: 80, pitCrew: 84 },
    drivers: [
      { id: "gasly", name: "Pierre Gasly", short: "GAS", num: 10, nation: "FRA", flag: "\u{1F1EB}\u{1F1F7}", nationName: "France",
        stats: { pace: 90, racecraft: 91, consistency: 88, defence: 89, tyres: 89, aggression: 87 } },
      { id: "colapinto", name: "Franco Colapinto", short: "COL", num: 43, nation: "ARG", flag: "\u{1F1E6}\u{1F1F7}", nationName: "Argentina",
        stats: { pace: 86, racecraft: 87, consistency: 83, defence: 84, tyres: 85, aggression: 90 } },
    ],
  },
  {
    id: "haas",
    name: "TGR Haas F1 Team",
    short: "Haas",
    code: "HAAS",
    color: "#b6babd",
    accent: "#e10600",
    engine: "Ferrari",
    base: "Marlborough, USA",
    founded: 2016,
    titles: 0,
    stats: { power: 87, aero: 82, reliability: 78, pitCrew: 80 },
    drivers: [
      { id: "ocon", name: "Esteban Ocon", short: "OCO", num: 31, nation: "FRA", flag: "\u{1F1EB}\u{1F1F7}", nationName: "France",
        stats: { pace: 87, racecraft: 88, consistency: 89, defence: 87, tyres: 87, aggression: 86 } },
      { id: "bearman", name: "Oliver Bearman", short: "BEA", num: 87, nation: "GBR", flag: "\u{1F1EC}\u{1F1E7}", nationName: "United Kingdom",
        stats: { pace: 86, racecraft: 84, consistency: 82, defence: 82, tyres: 83, aggression: 84 } },
    ],
  },
  {
    id: "audi",
    name: "Audi Revolut F1 Team",
    short: "Audi",
    code: "AUD",
    color: "#f50537",
    accent: "#d5d8dc",
    engine: "Audi",
    base: "Hinwil, Switzerland",
    founded: 2026,
    titles: 0,
    stats: { power: 85, aero: 80, reliability: 70, pitCrew: 74 },
    drivers: [
      { id: "hulkenberg", name: "Nico Hülkenberg", short: "HUL", num: 27, nation: "GER", flag: "\u{1F1E9}\u{1F1EA}", nationName: "Germany",
        stats: { pace: 88, racecraft: 90, consistency: 90, defence: 88, tyres: 90, aggression: 82 } },
      { id: "bortoleto", name: "Gabriel Bortoleto", short: "BOR", num: 5, nation: "BRA", flag: "\u{1F1E7}\u{1F1F7}", nationName: "Brazil",
        stats: { pace: 85, racecraft: 83, consistency: 84, defence: 82, tyres: 85, aggression: 83 } },
    ],
  },
  {
    id: "williams",
    name: "Atlassian Williams Racing",
    short: "Williams",
    code: "WIL",
    color: "#00a3e0",
    accent: "#1e41ff",
    engine: "Mercedes",
    base: "Grove, UK",
    founded: 1977,
    titles: 9,
    stats: { power: 88, aero: 87, reliability: 83, pitCrew: 85 },
    drivers: [
      { id: "albon", name: "Alexander Albon", short: "ALB", num: 23, nation: "THA", flag: "\u{1F1F9}\u{1F1ED}", nationName: "Thailand",
        stats: { pace: 89, racecraft: 90, consistency: 91, defence: 90, tyres: 90, aggression: 88 } },
      { id: "sainz", name: "Carlos Sainz", short: "SAI", num: 55, nation: "ESP", flag: "\u{1F1EA}\u{1F1F8}", nationName: "Spain",
        stats: { pace: 90, racecraft: 91, consistency: 93, defence: 91, tyres: 92, aggression: 85 } },
    ],
  },
  {
    id: "aston",
    name: "Aston Martin Aramco F1 Team",
    short: "Aston Martin",
    code: "AST",
    color: "#006f62",
    accent: "#54d2c4",
    engine: "Honda",
    base: "Silverstone, UK",
    founded: 2017,
    titles: 0,
    stats: { power: 86, aero: 84, reliability: 76, pitCrew: 78 },
    drivers: [
      { id: "alonso", name: "Fernando Alonso", short: "ALO", num: 14, nation: "ESP", flag: "\u{1F1EA}\u{1F1F8}", nationName: "Spain",
        stats: { pace: 90, racecraft: 97, consistency: 93, defence: 95, tyres: 94, aggression: 90 } },
      { id: "stroll", name: "Lance Stroll", short: "STR", num: 18, nation: "CAN", flag: "\u{1F1E8}\u{1F1E6}", nationName: "Canada",
        stats: { pace: 84, racecraft: 79, consistency: 76, defence: 78, tyres: 79, aggression: 80 } },
    ],
  },
  {
    id: "cadillac",
    name: "Cadillac Formula One Team",
    short: "Cadillac",
    code: "CAD",
    color: "#1b2a5b",
    accent: "#b8c4e0",
    engine: "Ferrari",
    base: "Charlotte, USA",
    founded: 2026,
    titles: 0,
    stats: { power: 86, aero: 79, reliability: 72, pitCrew: 70 },
    drivers: [
      { id: "perez", name: "Sergio Pérez", short: "PER", num: 11, nation: "MEX", flag: "\u{1F1F2}\u{1F1FD}", nationName: "Mexico",
        stats: { pace: 87, racecraft: 88, consistency: 86, defence: 86, tyres: 86, aggression: 84 } },
      { id: "bottas", name: "Valtteri Bottas", short: "BOT", num: 77, nation: "FIN", flag: "\u{1F1EB}\u{1F1EE}", nationName: "Finland",
        stats: { pace: 87, racecraft: 86, consistency: 89, defence: 88, tyres: 88, aggression: 83 } },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Derived physics / AI parameters                                      */
/* ------------------------------------------------------------------ */

/**
 * Convert team ratings + R&D levels into concrete vehicle numbers.
 * Everything the simulation uses downstream is derived here, so upgrades
 * only need to touch this function's inputs.
 */
export function buildCarSpecs(team, upgrades = {}) {
  const s = team.stats;
  const up = (key, maxGain) => (upgrades[key] || 0) * maxGain;
  const power = clampStat(s.power + up("power", 1.4));
  const aero = clampStat(s.aero + up("aero", 1.5));
  const reliability = clampStat(s.reliability + up("reliability", 1.2));
  const pitCrew = clampStat(s.pitCrew + up("pitCrew", 2));

  return {
    // Top speed: m/s (world units are metres, 1 unit = 1 m)
    topSpeed: 78 + power * 0.26,                    // ~92-104 m/s -> 330-375 km/h
    // Peak lateral grip, m/s^2
    latAccel: 15.5 + aero * 0.11,                   // ~24-27 m/s^2
    // Power in kW-equivalent used by the drive model
    driveForce: 9800 + power * 145,                 // N per car
    brakeForce: 16500 + aero * 110,
    dragArea: 0.78 - power * 0.0011,                // lower = faster
    rollingResist: 0.014 + power * 0.00004,
    reliability: reliability / 100,
    pitCrew,
    mass: 780 + power * 0.45 - aero * 0.5,
  };
}

const clampStat = (v) => Math.max(40, Math.min(100, v));

/** Default R&D state for a freshly created career. */
export function defaultUpgrades() {
  return { power: 0, aero: 0, reliability: 0, pitCrew: 0, chassis: 0 };
}

/* ------------------------------------------------------------------ */
/* Grid construction helpers                                            */
/* ------------------------------------------------------------------ */

/** Deep copy of the pristine 2026 grid (safe to mutate). */
export function cloneGrid() {
  return TEAMS_2026.map((t) => ({
    ...t,
    stats: { ...t.stats },
    drivers: t.drivers.map((d) => ({ ...d, stats: { ...d.stats } })),
  }));
}

/** Flat list of every race seat: { team, driver }. */
export function gridEntries(teams) {
  const out = [];
  for (const team of teams) {
    for (const driver of team.drivers) out.push({ teamId: team.id, driverId: driver.id, driver, team });
  }
  return out;
}

export const findTeam = (teams, id) => teams.find((t) => t.id === id) || null;

/** Locate a seat by driver id. */
export function findSeat(teams, driverId) {
  for (const team of teams) {
    for (const driver of team.drivers) {
      if (driver.id === driverId) return { team, driver, index: team.drivers.indexOf(driver) };
    }
  }
  return null;
}

/**
 * Replace an existing driver with a custom one.
 * The replaced driver is returned so the caller can offer it back later.
 */
export function replaceDriver(teams, replacedDriverId, customDriver) {
  const seat = findSeat(teams, replacedDriverId);
  if (!seat) return null;
  seat.team.drivers[seat.index] = customDriver;
  return seat.driver;
}

/** Replace an entire constructor slot with a custom team (2 seats). */
export function replaceTeam(teams, replacedTeamId, customTeam) {
  const idx = teams.findIndex((t) => t.id === replacedTeamId);
  if (idx < 0) return null;
  const old = teams[idx];
  teams[idx] = customTeam;
  return old;
}

/* ------------------------------------------------------------------ */
/* Custom driver / constructor factories                                */
/* ------------------------------------------------------------------ */

const NATIONS = [
  { code: "GBR", flag: "\u{1F1EC}\u{1F1E7}", name: "United Kingdom" },
  { code: "ITA", flag: "\u{1F1EE}\u{1F1F9}", name: "Italy" },
  { code: "GER", flag: "\u{1F1E9}\u{1F1EA}", name: "Germany" },
  { code: "FRA", flag: "\u{1F1EB}\u{1F1F7}", name: "France" },
  { code: "ESP", flag: "\u{1F1EA}\u{1F1F8}", name: "Spain" },
  { code: "NED", flag: "\u{1F1F3}\u{1F1F1}", name: "Netherlands" },
  { code: "BEL", flag: "\u{1F1E7}\u{1F1EA}", name: "Belgium" },
  { code: "POR", flag: "\u{1F1F5}\u{1F1F9}", name: "Portugal" },
  { code: "FIN", flag: "\u{1F1EB}\u{1F1EE}", name: "Finland" },
  { code: "BRA", flag: "\u{1F1E7}\u{1F1F7}", name: "Brazil" },
  { code: "ARG", flag: "\u{1F1E6}\u{1F1F7}", name: "Argentina" },
  { code: "USA", flag: "\u{1F1FA}\u{1F1F8}", name: "United States" },
  { code: "CAN", flag: "\u{1F1E8}\u{1F1E6}", name: "Canada" },
  { code: "AUS", flag: "\u{1F1E6}\u{1F1FA}", name: "Australia" },
  { code: "NZL", flag: "\u{1F1F3}\u{1F1FF}", name: "New Zealand" },
  { code: "JPN", flag: "\u{1F1EF}\u{1F1F5}", name: "Japan" },
  { code: "UAE", flag: "\u{1F1E6}\u{1F1EA}", name: "United Arab Emirates" },
  { code: "SUI", flag: "\u{1F1E8}\u{1F1ED}", name: "Switzerland" },
  { code: "THA", flag: "\u{1F1F9}\u{1F1ED}", name: "Thailand" },
  { code: "MEX", flag: "\u{1F1F2}\u{1F1FD}", name: "Mexico" },
  { code: "MON", flag: "\u{1F1F2}\u{1F1FD}", name: "Monaco" },
  { code: "BRA2", flag: "\u{1F1E7}\u{1F1F7}", name: "Brazil" },
];

export const NATION_LIST = NATIONS.filter((n, i, a) => a.findIndex((x) => x.code === n.code) === i);

export function createCustomDriver({ name, nation, num, stats, isPlayer = true }) {
  const nationData = NATION_LIST.find((n) => n.code === nation) || NATION_LIST[0];
  const clean = String(name || "New Driver").replace(/\s+/g, " ").trim().slice(0, 28);
  const id = "custom_" + clean.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const words = clean.split(" ").filter(Boolean);
  return {
    id,
    name: clean,
    short: (words.length > 1 ? words[words.length - 1][0] + words[0][0] : clean.slice(0, 3)).toUpperCase(),
    num: Math.max(0, Math.min(99, Number(num) || 0)),
    nation: nationData.code,
    flag: nationData.flag,
    nationName: nationData.name,
    isCustom: true,
    isPlayer,
    stats: {
      pace: stats.pace, racecraft: stats.racecraft, consistency: stats.consistency,
      defence: stats.defence, tyres: stats.tyres, aggression: stats.aggression,
    },
  };
}

export function createCustomTeam({ name, short, code, color, accent, base, engine, stats, drivers }) {
  const clean = String(name || "New Team").replace(/\s+/g, " ").trim().slice(0, 32);
  const c = String(code || clean.slice(0, 3)).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  return {
    id: "custom_" + clean.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    name: clean,
    short: String(short || clean).slice(0, 18),
    code: c || "CUS",
    color: color || "#e10600",
    accent: accent || "#ffffff",
    engine: engine || "Custom",
    base: base || "Custom",
    founded: 2026,
    titles: 0,
    isCustom: true,
    stats: {
      power: stats.power, aero: stats.aero,
      reliability: stats.reliability, pitCrew: stats.pitCrew,
    },
    drivers,
  };
}

/**
 * Overall driver rating used for race pace & AI defaults.
 * Pace dominates; the rest shape behaviour in the AI controller.
 */
export function driverRating(driver) {
  const s = driver.stats;
  return (
    s.pace * 0.42 + s.racecraft * 0.18 + s.consistency * 0.2 +
    s.defence * 0.08 + s.tyres * 0.08 + s.aggression * 0.04
  );
}

/** Base speed multiplier for AI, normalised around the field average. */
export function paceFactor(driver, car) {
  const pace = driverRating(driver);
  return 0.9 + (pace / 100) * 0.2 + (car.topSpeed - 90) * 0.0018;
}
