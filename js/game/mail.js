// Buzón del piloto: mensajes del jefe de equipo, ingenieros, rivales, propietarios y prensa.
// Todo se genera con RNG sembrado por carrera + ronda, de modo que un buzón es
// estable entre recargas pero distinto en cada partida.

import { makeRng } from '../core/rng.js';
import { staffFor, ownerFor } from '../data/teams.js';
import { pos } from '../core/util.js';

let counter = 0;

const ROLE = {
  principal: { label: 'Jefe de equipo', tag: 'jefe' },
  raceEngineer: { label: 'Ingeniero de carrera', tag: 'ingeniero' },
  chiefMechanic: { label: 'Jefe de mecánicos', tag: 'mecanico' },
  owner: { label: 'Propietario', tag: 'propietario' },
  press: { label: 'Prensa', tag: 'prensa' },
  rival: { label: 'Rival', tag: 'rival' },
  fia: { label: 'Comisarios', tag: 'fia' },
};

export function roleLabel(role) {
  return ROLE[role]?.label || 'Contacto';
}

export function roleTag(role) {
  return ROLE[role]?.tag || 'otro';
}

function makeMessage({ from, role, subject, body, kind, date, weight = 1 }) {
  counter += 1;
  return { id: `m${counter}-${kind}-${role}`, from, role, subject, body, kind, date, unread: true, weight };
}

/* ───────────────────── Plantillas de texto ───────────────────── */

function principalBody(ctx) {
  const { driver, team, standings, lastResult, rng, round, series, principal } = ctx;
  const owner = ownerFor(team, series);
  const surname = driver.name.split(' ').slice(-1)[0];
  const lines = [];

  if (!lastResult) {
    lines.push(
      `Bienvenido a ${team.name}, ${surname}. Soy ${principal} y desde hoy este equipo es también tu casa.`,
      `No te voy a vender una película: el objetivo es el campeonato. Pero ${owner.name} ha apostado por ti y eso es una carrera entera.`
    );
  } else if (lastResult.position === 1) {
    lines.push(
      `Todavía no me lo creo. Victoria en ${round.circuit.name} y el paddock hablando de ti.`,
      'Esto es justo lo que firmamos. Ahora viene lo difícil: repetirlo sin que nadie te toque.'
    );
  } else if (lastResult.position >= 2 && lastResult.position <= 3) {
    lines.push(`Podio en ${round.gp}. Buen trabajo. Esta noche no se toca el coche: nos quedamos con esta configuración.`);
  } else if (lastResult.retired) {
    lines.push('Vamos a ser sinceros: abandonamos. No pasa nada, pero este rendimiento no nos vale. Repasamos datos en el debrief.');
  } else {
    lines.push(
      `${pos(lastResult.position)}. Hay puntos en la bolsa, pero el ritmo no era el nuestro.`,
      'La próxima vez, la primera vuelta con el depósito más ligero.'
    );
  }

  if (lastResult && lastResult.grid <= 3 && lastResult.position > lastResult.grid) {
    lines.push('Y la salida nos costó puntos. El criterio está claro: nada de saltar a la primera curva.');
  }
  if (standings && standings.position <= 3) {
    lines.push(`Vas ${pos(standings.position)} del campeonato. Así se sube.`);
  }
  lines.push(rng.pick(['Confío en ti.', 'Este es el bloque que nos define. A por él.', 'El lunes revisamos datos.']));
  return lines.join('\n\n');
}

function engineerBody(ctx) {
  const { driver, lastResult, rng, round, corner, weather } = ctx;
  const first = driver.name.split(' ')[0];
  const lines = [];
  if (!lastResult) {
    lines.push(
      `${first}, bienvenido. Soy tu ingeniero. En los libres te voy leyendo datos; en carrera solo te diré una palabra: box.`,
      `La base para ${round.circuit.name}: alerones un punto más blandos en ${round.circuit.corners[0] || 'la primera curva'} y Diff alto para la salida de ${round.circuit.corners[2] || 'curva lenta'}.`
    );
  } else if (lastResult.retired) {
    lines.push(
      `Vimos el toque en la curva ${corner}. ${rng.pick(['Hubo presión de más por delante.', 'El neumático ya estaba fuera de ventana.', 'Entramos demasiado caliente.'])}`,
      'Mañana bajamos el Diff dos puntos y te damos más margen en la frenada.'
    );
  } else {
    lines.push(
      `Tu mejor vuelta (${lastResult.bestLapText || 'sin referencia'}) confirma que el coche está donde tiene que estar.`,
      weather === 'wet'
        ? 'Con pista mojada ese milisegundo vale por diez. Nada de heroísmos en la primera vuelta.'
        : 'Seco y limpio. Nos falta ritmo en la recta larga, probaremos el ala trasera más baja.'
    );
  }
  lines.push(rng.pick(['¿Alguna duda antes de salir?', 'Sin preguntas entonces. Nos vemos en pista.', 'Avísame si el asiento te molesta.']));
  return lines.join('\n\n');
}

function mechanicBody(ctx) {
  const { driver, rng, team } = ctx;
  const pitLap = rng.int(12, 28);
  return (
    `Segunda persona: ${driver.name}. Hoy sales con ${rng.pick(['blandos nuevos', 'medios usados', 'duros de repuesto'])} ` +
    `y el pit stop previsto en la vuelta ${pitLap}.\n\n` +
    `Confianza al ${100 - Math.round(team.car.reliability * 0.25)} %. No me hagas gastarte los neumáticos antes de tiempo, ¿entendido?`
  );
}

function pressBody(ctx) {
  const { driver, standings, rng, lastResult, team, round, series } = ctx;
  const title = series === 'f1' ? 'Fórmula 1' : 'Fórmula 2';
  if (standings && standings.position === 1) {
    return (
      `"${driver.name} lidera el campeonato y nadie lo discute." En ${title} el paddock ya habla de ` +
      `${round.circuit.name} y de si este nivel se sostiene hasta noviembre. ${team.name} ha encontrado un piloto que da miedo.`
    );
  }
  if (lastResult && lastResult.position === 1) {
    return `Victoria de ${driver.name} en ${round.gp}. La prensa no habla de otra cosa: es el nombre de la semana.`;
  }
  if (lastResult && lastResult.retired) {
    return `Abandono de ${driver.name} en ${round.circuit.name}. La escudería descarta un problema mecánico: "Fue un error nuestro".`;
  }
  return (
    `"${driver.name} sigue ${pos(standings ? standings.position : 1)} del campeonato." El paddock ya ` +
    `${rng.pick(['especula', 'cuenta los puntos', 'calcula', 'apuesta'])} por su ` +
    `${rng.pick(['contrato', 'promoción', 'próximo test', 'siguiente carrera'])}.`
  );
}

function rivalBody(ctx) {
  const { lastResult, rng, rivals, round } = ctx;
  if (!rivals || !rivals.length) return `Buena suerte en ${round.circuit.name}. Nos vemos en la pista.`;
  const rival = rng.pick(rivals);
  let body;
  if (lastResult && lastResult.position === 1) {
    body = `Enhorabuena en ${round.gp}. Nos lo trabajaremos en ${round.circuit.name}.`;
  } else if (lastResult && lastResult.position && lastResult.position <= 6) {
    body = `Buen ritmo. En ${round.circuit.name} quiero probar el coche en la zona de ${rng.pick(['frenada', 'trazada rota', 'curva lenta', 'recta de meta'])}.`;
  } else {
    body = `¿Has visto lo de ${round.circuit.name}? Es ${rng.pick(['engañoso', 'técnico', 'divertido', 'físico'])}. Cuidado en ${round.circuit.corners[3] || 'la última curva'}.`;
  }
  return `${rival.name}\n\n${body}`;
}

function fiaBody(ctx) {
  const { rng, driver, round } = ctx;
  return (
    `Investigación cerrada sobre ${driver.name} (${round.gp}): ` +
    rng.pick([
      'sin sanciones.',
      'se archiva sin cargos.',
      'no se encuentra ninguna infracción.',
      'se confirma que el límite de pista se cruzó sin intención.',
    ])
  );
}

function templateFor(role) {
  switch (role) {
    case 'principal':
      return principalBody;
    case 'raceEngineer':
      return engineerBody;
    case 'chiefMechanic':
      return mechanicBody;
    case 'press':
      return pressBody;
    case 'rival':
      return rivalBody;
    default:
      return fiaBody;
  }
}

const PRESS_OUTLETS = ['Autosprint', 'F1 Magazine', 'El Mundo Motor', 'La Gaceta del paddock', 'SportFeed', 'Mundialsport'];

/**
 * Genera el buzón completo de una ronda.
 * @param {object} state estado de carrera
 * @param {object} round ronda actual
 * @param {object|null} summary resumen de la ronda anterior
 * @returns {Array<object>} mensajes, los importantes primero
 */
export function buildInbox(state, round, summary = null) {
  counter = 0;
  const rng = makeRng(`${state.seed}|inbox|${state.series}|${round.round}`);
  const team = state.team;
  const staff = staffFor(team, state.series);
  const principalName = staff.principal?.name || 'Dirección del equipo';
  const base = {
    driver: state.driver,
    team,
    standings: state.standings,
    lastResult: summary,
    rng,
    round,
    series: state.series,
    weather: round.circuit.weather,
    corner: rng.int(3, 12),
    principal: principalName,
    rivals: state.rivals,
  };

  const drafts = [
    { role: 'principal', from: principalName, weight: 3, subject: summary ? `Después de ${round.gp}` : 'Tu primer día en el equipo' },
    { role: 'raceEngineer', from: staff.raceEngineer?.name || 'Ingeniero de carrera', weight: 2, subject: 'Datos y plan de carrera' },
    { role: 'chiefMechanic', from: staff.chiefMechanic?.name || 'Jefe de mecánicos', weight: 1, subject: 'Pit stop y neumáticos' },
    { role: 'press', from: rng.pick(PRESS_OUTLETS), weight: 1, subject: `Crónica de ${round.gp}` },
  ];
  if (rng.chance(0.35)) {
    drafts.push({ role: 'rival', from: 'Mensaje en el paddock', weight: 0, subject: rng.pick(['Antes de este fin de semana', 'Telegram del paddock', 'Mensaje directo']) });
  }
  if (rng.chance(0.3)) {
    drafts.push({ role: 'fia', from: 'Comisarios deportivos', weight: 0, subject: 'Aviso de los comisarios' });
  }

  const out = [];
  for (const d of drafts) {
    out.push(
      makeMessage({
        from: d.from,
        role: d.role,
        subject: d.subject,
        body: templateFor(d.role)(base),
        kind: round.round,
        date: round.days.thu,
        weight: d.weight,
      })
    );
  }
  out.sort((a, b) => b.weight - a.weight);
  return out;
}

export function unreadCount(inbox) {
  return inbox.filter((m) => m.unread).length;
}

export function markAllRead(inbox) {
  for (const m of inbox) m.unread = false;
  return inbox;
}

/** Banderas del organigrama del equipo, para los avatares del buzón. */
export function staffFlagsFor(state) {
  const staff = staffFor(state.team, state.series);
  return {
    principal: staff.principal?.flag || state.team.flag || '🏁',
    raceEngineer: staff.raceEngineer?.flag || '🏁',
    chiefMechanic: staff.chiefMechanic?.flag || '🏁',
  };
}
