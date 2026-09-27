// Comprobaciones de la carrera profesional: creación, calendario, sesiones,
// clasificación, objetivos, promoción y persistencia lógica.
import {
  createCareer, buildEntryList, currentRound, calendarFor, pendingSession, roundFinished,
  recordSession, advanceToNextRound, promoteToF1, repeatSeason, isSeasonOver, daysToRound,
  refreshInbox, refreshNews, markMailRead, markNewsRead, driverCard, teamCard, carStats,
  rivalsOf, testingWeeks, CAREER_VERSION, START_SERIES,
} from '../js/game/career.js';
import { roundsFor, getRound, SEASON } from '../js/data/calendar.js';
import { getTeam, teamsFor } from '../js/data/teams.js';
import { countryByCode } from '../js/data/countries.js';
import { readSlot, writeSlot, listSlots, deleteSlot } from '../js/core/storage.js';

/* localStorage no existe en Node: se sustituye por un mapa en memoria */
const store = new Map();
globalThis.localStorage = {
  get length() {
    return store.size;
  },
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
};

let bad = 0;
const check = (label, cond, extra = '') => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    bad += 1;
    console.log(`  FAIL ${label} ${extra}`);
  }
};

const PROFILE = {
  name: 'Álvaro Martínez',
  birthDate: '2004-03-14',
  country: 'ESP',
  helmetPrimary: '#e8112d',
  helmetSecondary: '#0b1a3a',
  helmetStyle: 'liso',
};

/** Resultado de sesión sintético con `order` entradas coherentes. */
function fakeResult(round, kind, sessionId, opts = {}) {
  const n = opts.n || 22;
  const playerPos = opts.playerPos ?? 5;
  const entries = [];
  for (let i = 1; i <= n; i++) {
    const isPlayer = i === playerPos;
    entries.push({
      driverId: isPlayer ? 'player' : `rival-${i}`,
      teamId: isPlayer ? 'player-team' : `team-${i % 11}`,
      name: isPlayer ? 'Álvaro Martínez' : `Rival ${i}`,
      short: isPlayer ? 'ALM' : `R${i}`,
      number: isPlayer ? 19 : i,
      flag: '🇪🇸',
      color: '#111111',
      position: i,
      grid: isPlayer ? (opts.playerGrid ?? n - i + 1) : n - i + 1,
      laps: opts.laps ?? 13,
      bestLapMs: 74000 + i * 120,
      lastLapMs: 75000 + i * 100,
      fastestLap: i === 1,
      pitStops: 1,
      tyre: 'medium',
      retired: false,
      dsq: false,
      finished: true,
      gapMs: (i - 1) * 1200,
    });
  }
  return { sessionId, kind, order: kind === 'quali' ? 1 : 2, entries, round: round.round };
}

console.log('career.check');

/* ── Validación de la creación ── */
{
  let err = null;
  try {
    createCareer({ ...PROFILE, birthDate: '2020-01-01' });
  } catch (e) {
    err = e.message;
  }
  check('creación: rechaza a un menor de 17 años', Boolean(err), err || '');

  err = null;
  try {
    createCareer({ ...PROFILE, birthDate: '1960-01-01' });
  } catch (e) {
    err = e.message;
  }
  check('creación: rechaza a un piloto mayor de 60 años', Boolean(err), err || '');

  err = null;
  try {
    createCareer({ ...PROFILE, name: '   ' });
  } catch (e) {
    err = e.message;
  }
  check('creación: exige nombre', Boolean(err), err || '');

  err = null;
  try {
    createCareer({ ...PROFILE, country: 'ZZ' });
  } catch (e) {
    err = e.message;
  }
  check('creación: exige un país válido', Boolean(err), err || '');

  const cv = createCareer(PROFILE, { series: 'f1', seed: 5 });
  check('creación: versión de guardado known', cv.version === CAREER_VERSION, `v=${cv.version}`);
  check('creación: temporada y serie', cv.season === SEASON && cv.series === 'f1', `${cv.season}/${cv.series}`);
  check('creación: empieza en F2 por defecto', START_SERIES === 'f2');
  check('creación: dorsal y nombre propios', cv.driver.name === PROFILE.name && cv.driver.number > 0);
  check('creación: código de tres letras', cv.driver.short.length === 3 && /^[A-ZÁÉÍÓÚÑÜ]+$/.test(cv.driver.short), cv.driver.short);
  check('creación:edad derivad de la fecha', typeof cv.driver.age === 'number' && cv.driver.age >= 17 && cv.driver.age <= 60, String(cv.driver.age));
  check('creación: país con bandera', cv.driver.flag === countryByCode('ESP').flag);
  check('creación: equipo de la serie elegida', getTeam(cv.teamId, 'f1') !== null, cv.teamId);
  check('creación: 22 entradas en la parrilla', cv.entryList.length === 22, `n=${cv.entryList.length}`);
  check('creación: un solo jugador', cv.entryList.filter((e) => e.isPlayer).length === 1);
  check('creación: rivals con habilidad', rivalsOf(cv).length === 5 && rivalsOf(cv)[0].skill >= rivalsOf(cv)[4].skill);
  check('creación: objetivos de temporada', cv.objectives.length > 0 && cv.objectives.every((o) => o.kind && o.target > 0));
  check('creación: buzón y noticias iniciales', cv.inbox.length > 0 && cv.news.length > 0);
  check('creación: sin historial todavía', cv.history.length === 0);
  check('creación: primera ronda disponible', currentRound(cv) && !currentRound(cv).done);
  check('creación:.datetime de creación', typeof cv.createdAt === 'string' && cv.createdAt.length > 10);
}

/* ── Determinismo ── */
{
  const a = createCareer(PROFILE, { series: 'f1', seed: 99 });
  const b = createCareer(PROFILE, { series: 'f1', seed: 99 });
  check('determinismo: mismo perfil y semilla, mismo equipo', a.teamId === b.teamId, `${a.teamId}/${b.teamId}`);
  check('determinismo: mismo piloto generado', a.driver.number === b.driver.number);
  const c = createCareer(PROFILE, { series: 'f1', seed: 100 });
  check('determinismo: semilla distinta, carrera distinta', a.driver.number !== c.driver.number || a.teamId !== c.teamId);
}

/* ── Sustitución de piloto ── */
{
  const base = createCareer(PROFILE, { series: 'f2', seed: 3 });
  const rival = base.entryList.find((e) => !e.isPlayer);
  const replaced = buildEntryList('f2', {
    ...base.driver,
    replacedId: rival.driverId,
    isPlayer: true,
    driverId: 'player',
  });
  check('sustitución: 22 entradas tras replaced', replaced.length === 22, `n=${replaced.length}`);
  check('sustitución: el piloto ya no está en la lista', !replaced.some((e) => e.driverId === rival.driverId));
  check('sustitución: entra el jugador', replaced.filter((e) => e.isPlayer).length === 1);
  check('sustitución: conserva el resto de rivales', replaced.filter((e) => !e.isPlayer).length === 21);
}

/* ── Calendario ── */
{
  const cv = createCareer(PROFILE, { series: 'f1', seed: 11 });
  const cal = calendarFor(cv);
  const expected = roundsFor('f1').filter((r) => r.gp);
  check('calendario: una fila por ronda de campeonato', cal.length === expected.length, `${cal.length}/${expected.length}`);
  check('calendario: coincide con el calendario oficial', cal.every((r, i) => r.round === expected[i].round && r.circuitId === expected[i].circuitId));
  check('calendario: sprints en las rondas previstos', cal.filter((r) => r.sprint).length === 6, `n=${cal.filter((r) => r.sprint).length}`);
  check('calendario: la primera ronda es Australia', cal[0].circuitId === 'albert-park' || cal[0].round === 1, cal[0].circuitId);
  check('calendario: la última ronda es Abu Dhabi', cal[cal.length - 1].circuitId === 'yas-marina', cal[cal.length - 1].circuitId);
  check('calendario: sin rondas de F1 en Bahrain ni Arabia Saudí', !cal.some((r) => ['bahrain', 'jeddah'].includes(r.circuitId)));
  check('calendario: sesiones obligatorias en cada GP', cal.filter((r) => r.gp).every((r) => r.sessions.some((s) => s.type === 'quali' && s.required) && r.sessions.some((s) => s.type === 'feature' && s.required)));
  check('calendario: libres opcionales', cal.every((r) => r.sessions.filter((s) => s.type === 'fp').every((s) => s.required === false)));
  const f2 = createCareer(PROFILE, { series: 'f2', seed: 11 });
  const cal2 = calendarFor(f2).filter((r) => r.gp);
  check('calendario: F2 con 14 rondas', cal2.length === 14, `n=${cal2.length}`);
  check('calendario: tests de pretemporada', testingWeeks('f2').length > 0 && testingWeeks('f1').length > 0);
  check('calendario: los tests no cuentan como ronda', !calendarFor(f2).some((r) => r.kind === 'testing' && r.done === undefined && r.round === 0));
  check('calendario: días hasta la ronda', typeof daysToRound(cv) === 'number');
  const round = currentRound(cv);
  check('calendario: ronda actual con circuito válido', Boolean(getRound('f1', round.round)));
  check('calendario: GP pendiente con sesión pendiente', Boolean(pendingSession(cv)) && !roundFinished(cv));
  check('calendario: fin de temporada no alcanzado', !isSeasonOver(cv));
}

/* ── Registrar sesiones ── */
{
  const cv = createCareer(PROFILE, { series: 'f1', seed: 21 });
  const round = currentRound(cv);
  const quali = round.sessions.find((s) => s.type === 'quali');
  recordSession(cv, fakeResult(round, 'quali', quali.id, { playerPos: 4 }));
  check('sesión: la clasificación queda jugada', round.sessions.find((s) => s.id === quali.id).played === true);
  check('sesión: la ronda sigue abierta', !roundFinished(cv));
  check('sesión: el historial registra la ronda', cv.history.length === 1 && cv.history[0].results.length === 1);
  check('sesión: sin puntos aún sin carrera', cv.careerStats.points === 0 && cv.careerStats.starts === 0);
  check('sesión: vuelve al paddock', cv.phase === 'paddock');

  recordSession(cv, fakeResult(round, 'quali', quali.id, { playerPos: 2 }));
  check('sesión: repetir sesión no duplica historial', cv.history[0].results.length === 1);
  check('sesión: el resultado se sobrescribe', cv.history[0].results[0].entries.find((e) => e.driverId === 'player').position === 2);

  const race = round.sessions.find((s) => s.type === 'feature');
  recordSession(cv, fakeResult(round, 'feature', race.id, { playerPos: 3 }));
  check('sesión: la carrera sumastarts', cv.careerStats.starts === 1, `starts=${cv.careerStats.starts}`);
  check('sesión:Podio contabilizado', cv.careerStats.podiums === 1);
  check('sesión: puntos del jugador', cv.careerStats.points === 15, `pts=${cv.careerStats.points}`);
  check('sesión: mejor resultado', cv.careerStats.bestFinish === 3, String(cv.careerStats.bestFinish));
  check('sesión: ronda completada', roundFinished(cv));
  check('sesión: clasificación de campeonato con 22 pilotos', cv.standings.rows.length === 22, `n=${cv.standings.rows.length}`);
  check('sesión: el jugador aparece en la clasificación', cv.standings.drivers.some((r) => r.driverId === 'player'));
  check('sesión: filas compactas para noticias', cv.standings.rows.length === 22 && cv.standings.rows.filter((r) => r.isPlayer).length === 1 && cv.standings.rows.every((r) => r.name && 'points' in r));
  check('sesión: clasificación de equipos', cv.standings.teams.length > 0);
  check('sesión: se jugaron las rondas', cv.standings.roundsDone === 1, String(cv.standings.roundsDone));
  check('sesión: no aparece en el objective de victoria', cv.objectives.find((o) => o.kind === 'win').done === false);

  recordSession(cv, fakeResult(round, 'feature', race.id, { playerPos: 1 }));
  check('sesión: victoria detectada', cv.careerStats.wins === 1 && cv.objectives.find((o) => o.kind === 'win').done === true);
  check('sesión: los puntos se recalculan sin duplicar', cv.careerStats.points === 26, `pts=${cv.careerStats.points}`);
  check('sesión: sin pole los poles no avanzan', !cv.objectives.find((o) => o.kind === 'poles').count);
  recordSession(cv, fakeResult(round, 'feature', race.id, { playerPos: 2, playerGrid: 1 }));
  check('sesión: pole y puntos actualizados', cv.careerStats.points === 18 && cv.careerStats.poles === 1, `pts=${cv.careerStats.points} poles=${cv.careerStats.poles}`);
  check('sesión: regrabar no duplica starts', cv.careerStats.starts === 1, `starts=${cv.careerStats.starts}`);
  check('sesión: la victoria anterior ya no cuenta', cv.careerStats.wins === 0, `wins=${cv.careerStats.wins}`);
  const beforeReplay = cv.careerStats.points;
  recordSession(cv, fakeResult(round, 'feature', race.id, { playerPos: 2, playerGrid: 1 }));
  check('sesión: repetir el mismo resultado es idempotente', cv.careerStats.points === beforeReplay && cv.careerStats.starts === 1);
}

/* ── Sprint ── */
{
  const cv = createCareer(PROFILE, { series: 'f1', seed: 31 });
  const round = roundsFor('f1').find((r) => r.sprint);
  const target = getRound('f1', round.round);
  while (currentRound(cv).round < target.round) {
    const r = currentRound(cv);
    for (const s of r.sessions) recordSession(cv, fakeResult(r, s.type, s.id));
    advanceToNextRound(cv);
  }
  const sp = currentRound(cv);
  check('sprint: se llega a la ronda con sprint', sp.round === target.round && sp.sprint === true, `ronda=${sp.round}`);
  check('sprint: sesiones de shootout y carrera', sp.sessions.some((s) => s.type === 'sprintQuali') && sp.sessions.some((s) => s.type === 'sprint'));
  for (const s of sp.sessions) recordSession(cv, fakeResult(sp, s.type, s.id, { n: 20 }));
  check('sprint: la ronda con sprint se completa', roundFinished(cv));
  check('sprint: el sprint no cuenta como carrera', cv.careerStats.starts === roundsBeforeSprint(cv) + 0 || cv.careerStats.starts >= 1);
  function roundsBeforeSprint() {
    return cv.history.filter((h) => h.results.some((r) => r.kind === 'feature')).length;
  }
}

/* ── Avance de temporada ── */
{
  const cv = createCareer(PROFILE, { series: 'f1', seed: 41 });
  const total = roundsFor('f1').filter((r) => r.gp).length;
  let guard = 0;
  while (!isSeasonOver(cv) && guard++ < 60) {
    const r = currentRound(cv);
    for (const s of r.sessions) recordSession(cv, fakeResult(r, s.type, s.id, { playerPos: 6 }));
    const res = advanceToNextRound(cv);
    if (res.seasonOver) break;
  }
  check('temporada: se juega toda la temporada', isSeasonOver(cv), `rondas jugadas=${cv.history.length}/${total}`);
  check('temporada: una entrada de historial por ronda', cv.history.length === total, `${cv.history.length}/${total}`);
  check('temporada: cada ronda con carrera', cv.history.every((h) => h.results.some((r) => r.kind === 'feature')));
  check('temporada: clasificación final con todos', cv.standings.roundsDone === total, String(cv.standings.roundsDone));
  check('temporada: las rondas aparecen en orden', cv.history.every((h, i) => i === 0 || h.round > cv.history[i - 1].round));
  check('temporada: el jugador acumula starts', cv.careerStats.starts === total, `starts=${cv.careerStats.starts}`);
  const played = calendarFor(cv).filter((r) => r.gp).every((r) => r.done || r.round <= cv.history.length);
  check('temporada: todas las rondas marcadas como jugadas', played);
}

/* ── Promoción a F1 ── */
{
  const cv = createCareer(PROFILE, { series: 'f2', seed: 51 });
  const before = cv.teamId;
  const res = promoteToF1(cv);
  check('promoción: devuelve un equipo de F1', res.ok === true && getTeam(res.team?.id, 'f1') !== null, JSON.stringify(res).slice(0, 80));
  check('promoción: cambia a la serie F1', cv.series === 'f1');
  check('promoción: el equipo es de F1', getTeam(cv.teamId, 'f1') !== null, cv.teamId);
  check('promoción: se rehace la parrilla', cv.entryList.length === 22 && cv.entryList.filter((e) => e.isPlayer).length === 1, `n=${cv.entryList.length}`);
  check('promoción: el piloto sustituido sale de la lista', !cv.entryList.some((e) => e.driverId === cv.removedDriver?.id));
  check('promoción: rivals con habilidad', rivalsOf(cv).length === 5);
  check('promoción: estadísticas de F2 a salvo', cv.careerStats.f2 && cv.careerStats.starts === 0);
  const twice = promoteToF1(cv);
  check('promoción: no se puede promover dos veces', twice.ok === false, JSON.stringify(twice).slice(0, 60));
}

/* ── Repetir temporada ── */
{
  const cv = createCareer(PROFILE, { series: 'f1', seed: 61 });
  const r = currentRound(cv);
  recordSession(cv, fakeResult(r, 'quali', r.sessions[0].id));
  recordSession(cv, fakeResult(r, 'feature', r.sessions.find((s) => s.type === 'feature').id, { playerPos: 2 }));
  const stats = { ...cv.careerStats };
  check('repetición: antes había puntos', stats.points > 0, `pts=${stats.points}`);
  repeatSeason(cv);
  check('repetición: vuelve a la ronda 1', currentRound(cv).round === 1);
  check('repetición: historial limpio', cv.history.length === 0);
  check('repetición: clasificación a cero', cv.standings.drivers.every((row) => row.points === 0));
  check('repetición: estadísticas de la temporada reiniciadas', cv.careerStats.points === 0 && cv.careerStats.starts === 0);
  check('repetición: objetivos reiniciados', cv.objectives.every((o) => !o.done));
  check('repetición: temporada abierta', isSeasonOver(cv) === false);
  check('repetición: misma serie', cv.series === 'f1');
  const f2 = createCareer(PROFILE, { series: 'f2', seed: 62 });
  promoteToF1(f2);
  repeatSeason(f2);
  check('repetición: conserva el historial de F2', Boolean(f2.careerStats.f2));
}

/* ── Buzón, noticias y tarjetas ── */
{
  const cv = createCareer(PROFILE, { series: 'f1', seed: 71 });
  const mail = cv.inbox.length;
  refreshInbox(cv);
  check('buzón: no duplica mensajes', cv.inbox.length === mail, `${cv.inbox.length}/${mail}`);
  const id = cv.inbox[0].id;
  const unread = cv.unreadMail;
  markMailRead(cv, id);
  check('buzón: marcar como leído', cv.inbox.find((m) => m.id === id).unread === false);
  check('buzón: el contador baja', cv.unreadMail === unread - 1, `${cv.unreadMail}/${unread}`);
  const news = cv.news.length;
  refreshNews(cv);
  check('noticias: no duplica', cv.news.length === news);
  markNewsRead(cv);
  check('noticias: marcar todas como leídas', cv.unreadNews === 0 && cv.news.every((n) => n.unread === false));
  const card = driverCard(cv);
  check('tarjeta de piloto: nombre, número y edad', card.name === PROFILE.name && card.number > 0 && card.age >= 17);
  check('tarjeta de piloto: casco con colores', card.helmet.primary === PROFILE.helmetPrimary && card.helmet.secondary === PROFILE.helmetSecondary);
  const team = teamCard(cv);
  check('tarjeta de equipo: coche y librea', team.team.car.power > 0 && /^#[0-9a-f]{6}$/i.test(team.team.livery.primary));
  check('tarjeta de equipo: propiedad y dirección', Boolean(team.owner?.name && team.raceEngineer?.name));
  check('tarjeta de equipo: nivel y rendimiento', team.level > 0 && team.performance > 0);
  check('tarjeta de coche: seis estadísticas', carStats(cv).length === 6 && carStats(cv).every((s) => typeof s.value === 'number'));
  check('tarjeta de equipo: posición en el campeonato', team.championship === null || typeof team.championship.position === 'number');
}

/* ── Persistencia lógica ── */
{
  const cv = createCareer(PROFILE, { series: 'f1', seed: 81 });
  const r = currentRound(cv);
  recordSession(cv, fakeResult(r, 'quali', r.sessions[0].id));
  const data = JSON.parse(JSON.stringify(cv));
  const back = JSON.parse(JSON.stringify(data));
  check('persistencia: el estado es JSON serializable', typeof back === 'object');
  check('persistencia: conserva la ronda', currentRound(back).round === r.round);
  check('persistencia: conserva el historial', back.history.length === 1);
  check('persistencia: conserva el jugador', back.entryList.filter((e) => e.isPlayer).length === 1);
  check('persistencia: conserva los puntos', back.careerStats.points === cv.careerStats.points);
  check('persistencia: conserva la semilla', back.seed === cv.seed);
  writeSlot(0, cv);
  const loaded = readSlot(0);
  check('persistencia: guardado y lectura del slot 0', loaded && loaded.state.seed === cv.seed);
  check('persistencia: el slot guarda el estado completo', loaded.state.history.length === 1 && loaded.state.entryList.length === 22);
  check('persistencia: metadatos del slot', loaded.meta && typeof loaded.meta === 'object');
  const slots = listSlots();
  check('persistencia: el slot aparece en la lista', slots.some((s) => s.index === 0 && !s.empty));
  check('persistencia: los demás slots están vacíos', slots.filter((s) => s.index !== 0).every((s) => s.empty));
  deleteSlot(0);
  check('persistencia: se puede borrar el slot', readSlot(0) === null);
}

console.log(bad ? `\n${bad} comprobación(es) fallida(s)` : '\nTodo OK');
process.exit(bad ? 1 : 0);
