// Comprobaciones de los datos: circuitos, equipos, pilotos, calendario y países.
import { CIRCUITS, getCircuit, circuitCount } from '../js/data/circuits.js';
import { F1_TEAMS, F2_TEAMS, getTeam, teamsFor, carPerformance, staffFor, ownerFor } from '../js/data/teams.js';
import { F1_DRIVERS, F2_DRIVERS, driversFor, findDriver, averageRating } from '../js/data/drivers.js';
import { F1_ROUNDS, F2_ROUNDS, roundsFor, getRound, SEASON, TESTING, roundIsComplete } from '../js/data/calendar.js';
import { COUNTRY_LIST, HELMET_COLORS, countryByCode, validateBirth, ageAt, MIN_AGE, MAX_AGE } from '../js/data/countries.js';
import { pointsForPosition, buildStandings, playerRow, teamRow } from '../js/game/standings.js';

let bad = 0;
const check = (label, cond, extra = '') => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    bad += 1;
    console.log(`  FAIL ${label} ${extra}`);
  }
};
const hex = /^#[0-9a-f]{6}$/i;
const recordRe = /^\d+:\d{2}\.\d{3}$/;
const isoRe = /^\d{4}-\d{2}-\d{2}$/;

console.log('data.check');

/* ── Circuitos ── */
{
  check('circuitos: 23 escenarios y 24 trazados', CIRCUITS.length === 24 && circuitCount() === 24 && CIRCUITS.filter((c) => c.gp).length === 23, `n=${CIRCUITS.length}`);
  check('circuitos: Sakhir reservado a los tests', CIRCUITS.filter((c) => !c.gp).map((c) => c.id).join(',') === 'sakhir');
  check('circuitos: identificadores únicos', new Set(CIRCUITS.map((c) => c.id)).size === CIRCUITS.length);
  check('circuitos: buscar por id', CIRCUITS.every((c) => getCircuit(c.id) === c));
  check('circuitos: id desconocido devuelve null', getCircuit('no-existe') === null);
  check('circuitos: longitud y vueltas', CIRCUITS.every((c) => c.length > 3 && c.length < 7.5 && c.laps >= 8 && c.laps <= 20), CIRCUITS.filter((c) => c.laps < 8 || c.laps > 20).map((c) => c.id).join(','));
  check('circuitos: segmentos válidos', CIRCUITS.every((c) => Array.isArray(c.seg) && c.seg.length >= 6));
  check('circuitos: curvas nombradas', CIRCUITS.every((c) => Array.isArray(c.corners) && c.corners.length >= 5));
  check('circuitos: récord con formato', CIRCUITS.every((c) => recordRe.test(c.record)), CIRCUITS.filter((c) => !recordRe.test(c.record)).map((c) => c.id).join(','));
  check('circuitos: Sakhir solo para tests', CIRCUITS.filter((c) => !c.gp).map((c) => c.id).join(',') === 'sakhir');
  check('circuitos: bandera presente', CIRCUITS.every((c) => typeof c.flag === 'string' && c.flag.length >= 1));
}

/* ── Equipos ── */
{
  const all = [...F1_TEAMS, ...F2_TEAMS];
  const carKeys = ['power', 'grip', 'aero', 'brakes', 'reliability'];
  check('equipos: 11 en F1 y 11 en F2', F1_TEAMS.length === 11 && F2_TEAMS.length === 11, `${F1_TEAMS.length}/${F2_TEAMS.length}`);
  check('equipos: identificadores únicos', new Set(all.map((t) => t.id)).size === all.length);
  check('equipos: nombre y colores', all.every((t) => t.name && t.code && hex.test(t.livery?.primary || '') && hex.test(t.livery?.secondary || '')));
  check('equipos: parámetros de coche', all.every((t) => carKeys.every((k) => typeof t.car[k] === 'number')));
  check('equipos: valores de 0 a 100', all.every((t) => carKeys.every((k) => t.car[k] >= 0 && t.car[k] <= 100)));
  check('equipos: presupuesto positivo', all.every((t) => t.car.budget > 0));
  check('equipos: personal completo', all.every((t) => {
    const st = staffFor(t, F1_TEAMS.includes(t) ? 'f1' : 'f2');
    return st?.principal?.name && st?.raceEngineer?.name && st?.chiefMechanic?.name;
  }));
  check('equipos: propietario con nombre', all.every((t) => ownerFor(t, F1_TEAMS.includes(t) ? 'f1' : 'f2')?.name));
  check('equipos: lema presente en F1', F1_TEAMS.every((t) => typeof t.motto === 'string' && t.motto.length > 4));
  check('equipos: búsqueda con serie', getTeam(F1_TEAMS[0].id, 'f1') !== null && getTeam('no-existe') === null);
  check('equipos: serie incorrecta devuelve null', getTeam(F2_TEAMS[0].id, 'f1') === null);
  check('equipos: lista por serie', teamsFor('f1').length === 11 && teamsFor('f2').length === 11);
  check('equipos: rendimiento positivo', F1_TEAMS.every((t) => carPerformance(t, 'f1') > 0));
}

/* ── Pilotos ── */
{
  const all = [...F1_DRIVERS, ...F2_DRIVERS];
  const codeRe = /^[A-ZÁÉÍÓÚÑ]{3}$/;
  check('pilotos: 22 en cada categoría', F1_DRIVERS.length === 22 && F2_DRIVERS.length === 22, `${F1_DRIVERS.length}/${F2_DRIVERS.length}`);
  check('pilotos: identificadores únicos', new Set(all.map((d) => d.id)).size === 44);
  check('pilotos: dorsal único en F1', new Set(F1_DRIVERS.map((d) => d.number)).size === 22, F1_DRIVERS.map((d) => d.number).join(','));
  check('pilotos: dorsal único en F2', new Set(F2_DRIVERS.map((d) => d.number)).size === 22, F2_DRIVERS.map((d) => d.number).join(','));
  check('pilotos: código de tres letras', all.every((d) => d.name && codeRe.test(d.code)), all.filter((d) => !codeRe.test(d.code)).map((d) => d.id).join(','));
  check('pilotos: valoraciones en rango', all.every((d) => d.ratings && Object.values(d.ratings).every((v) => v >= 40 && v <= 100)));
  check('pilotos: bandera y país', all.every((d) => d.flag && d.country && d.teamId));
  check('pilotos: todos con equipo real', F1_DRIVERS.every((d) => getTeam(d.teamId, 'f1')) && F2_DRIVERS.every((d) => getTeam(d.teamId, 'f2')));
  check('pilotos: búsqueda', findDriver(F1_DRIVERS[0].id, 'f1') !== null && findDriver('nadie') === null);
  check('pilotos: promedio de valoración', all.every((d) => averageRating(d.ratings) > 40 && averageRating(d.ratings) < 100));
  check('pilotos: lista por categoría', driversFor('f1').length === 22 && driversFor('f2').length === 22);
}

/* ── Calendario ── */
{
  const all = [...F1_ROUNDS, ...F2_ROUNDS];
  const sprints = F1_ROUNDS.filter((r) => r.sprint);
  const dates = (r) => r.sessions.map((s) => s.date).filter(Boolean);
  check('calendario: temporada 2026', SEASON === 2026, `season=${SEASON}`);
  check('calendario: 23 rondas F1 y 14 F2', F1_ROUNDS.length === 23 && F2_ROUNDS.length === 14, `${F1_ROUNDS.length}/${F2_ROUNDS.length}`);
  check('calendario: fechas de sesión con formato', all.every((r) => dates(r).length > 0 && dates(r).every((d) => isoRe.test(d))));
  check('calendario: fines de semana en orden', F1_ROUNDS.every((r, i) => i === 0 || r.days.sun > F1_ROUNDS[i - 1].days.sun), F1_ROUNDS.map((r) => r.days?.sun).join(' '));
  check('calendario: fines de semana F2 en orden', F2_ROUNDS.every((r, i) => i === 0 || r.days.sun > F2_ROUNDS[i - 1].days.sun), F2_ROUNDS.map((r) => r.days?.sun).join(' '));
  check('calendario: sin Bahrain ni Arabia Saudí', !F1_ROUNDS.some((r) => /bahrain|arab|saudi/i.test(`${r.gp} ${r.circuitId}`)));
  check('calendario: circuitos existentes', all.every((r) => getCircuit(r.circuitId) && r.circuit));
  check('calendario: rondas numeradas sin repetir', new Set(F1_ROUNDS.map((r) => r.round)).size === 23 && new Set(F2_ROUNDS.map((r) => r.round)).size === 14);
  check('calendario: cita con bandera y país', all.every((r) => r.gp && r.circuit.flag && r.country));
  check('calendario: seis sprints F1', sprints.length === 6, `${sprints.length}`);
  check('calendario: cada sprint con shootout', sprints.every((r) => r.sessions.some((s) => s.type === 'sprintQuali') && r.sessions.some((s) => s.type === 'sprint')));
  check('calendario: libres, Q y carrera en toda ronda', all.every((r) => ['fp', 'quali', 'feature'].every((t) => r.sessions.some((s) => s.type === t))));
  check('calendario: sesión con id, nombre y minutos', all.every((r) => r.sessions.every((s) => s.id && s.name && s.type && Number.isFinite(s.minutes))));
  check('calendario: clasificación y carrera obligatorias', all.every((r) => r.sessions.filter((s) => ['quali', 'feature'].includes(s.type)).every((s) => s.required === true)));
  check('calendario: clasificación en tres segmentos', all.every((r) => r.sessions.filter((s) => s.type === 'quali').every((s) => s.segments === 3)));
  check('calendario: ronda sin sessions pendientes', roundIsComplete(F1_ROUNDS[0]) === false);
  check('calendario: ronda pendiente', roundIsComplete(F1_ROUNDS[0], []) === false);
  check('calendario: rondas por categoría', roundsFor('f1').length === 23 && roundsFor('f2').length === 14);
  check('calendario: consulta de ronda', getRound('f1', 1).round === 1 && getRound('f1', 23).round === 23 && getRound('f2', 14).round === 14);
  check('calendario: consulta fuera de rango se recorta', getRound('f1', 99).round === 23 && getRound('f1', 0).round === 1);
  check('calendario: tests con circuito existente', [...TESTING.f1, ...TESTING.f2].every((t) => getCircuit(t.circuitId) && t.from && t.to), JSON.stringify(TESTING));
  check('calendario: tests en Sakhir y Barcelona', TESTING.f1.every((t) => t.circuitId === 'sakhir') && TESTING.f2.every((t) => t.circuitId === 'barcelona'));
}

/* ── Países ── */
{
  check('países: lista suficiente', COUNTRY_LIST.length >= 40, `n=${COUNTRY_LIST.length}`);
  check('países: códigos únicos', new Set(COUNTRY_LIST.map((c) => c.code)).size === COUNTRY_LIST.length);
  check('países: bandera y gentilicio', COUNTRY_LIST.every((c) => c.flag && c.demonym && c.name));
  check('países: búsqueda por código', ['ESP', 'ITA', 'GBR', 'BRA', 'ARG', 'JPN'].every((c) => countryByCode(c).code === c));
  check('países: código desconocido', countryByCode('ZZZ').code === 'INT');
  check('países: colores de casco', HELMET_COLORS.length >= 8 && HELMET_COLORS.every((c) => hex.test(c.primary) && hex.test(c.secondary) && c.name));
  check('países: edad mínima válida', validateBirth('2009-01-01').ok === true);
  check('países: rechaza menor de 17 años', validateBirth('2010-01-01').ok === false);
  check('países: rechaza mayor de 60 años', validateBirth('1960-01-01').ok === false);
  check('países: rechaza fecha inválida', validateBirth('ayer').ok === false);
  check('países: edad calculada', ageAt('2004-05-14', '2026-03-05') === 21 && MIN_AGE === 17 && MAX_AGE === 60);
}

/* ── Clasificación ── */
{
  check('puntos: 25-18-15-12-10-8-6-4-2-1', pointsForPosition(1) === 25 && pointsForPosition(2) === 18 && pointsForPosition(10) === 1);
  check('puntos: fuera de rango cero', pointsForPosition(11) === 0 && pointsForPosition(0) === 0);
  const race = (entries) => [{ kind: 'feature', entries }];
  const history = [
    { round: 1, results: race([
      { driverId: 'a', teamId: 'ferrari', position: 1, fastestLap: true, bestLapMs: 78000, grid: 2 },
      { driverId: 'b', teamId: 'ferrari', position: 2, bestLapMs: 78400, grid: 1 },
      { driverId: 'c', teamId: 'mclaren', position: 3, bestLapMs: 79000, grid: 3 },
    ]) },
    { round: 2, results: race([
      { driverId: 'a', teamId: 'ferrari', position: 1, bestLapMs: 77500, grid: 1 },
      { driverId: 'c', teamId: 'mclaren', position: 2, bestLapMs: 78100, grid: 2 },
      { driverId: 'b', teamId: 'ferrari', position: 3, bestLapMs: 78600, grid: 4 },
    ]) },
  ];
  const meta = {
    a: { name: 'A', short: 'A', flag: '🇪🇸', teamId: 'ferrari', color: '#111111' },
    b: { name: 'B', short: 'B', flag: '🇮🇹', teamId: 'ferrari', color: '#111111' },
    c: { name: 'C', short: 'C', flag: '🇧🇷', teamId: 'mclaren', color: '#222222' },
  };
  const s = buildStandings('f1', history, meta);
  const points = s.drivers.map((r) => `${r.driverId}:${r.points}`).join(' ');
  check('puntos: suma por piloto con vuelta rápida', s.drivers[0].driverId === 'a' && s.drivers[0].points === 51, points);
  check('puntos: desempate por mejor vuelta', s.drivers[1].driverId === 'b' && s.drivers[1].points === 33, points);
  check('puntos: Poles contabilizados', s.drivers[0].poles === 1);
  check('puntos: mejor vuelta guardada', s.drivers[0].best === 77500);
  check('puntos: constructores', s.teams.length === 2 && s.teams[0].teamId === 'ferrari' && s.teams[0].points === 84, s.teams.map((t) => `${t.teamId}:${t.points}`).join(' '));
  check('puntos: rondas jugadas', s.roundsDone === 2);
  check('puntos: fila del jugador', playerRow(s, 'a').points === 51 && playerRow(s, 'nadie') === null);
  check('puntos: fila de constructor', teamRow(s, 'mclaren').points === 33);
}

console.log(bad ? `\n${bad} comprobación(es) fallida(s)` : '\nTodo OK');
process.exit(bad ? 1 : 0);
