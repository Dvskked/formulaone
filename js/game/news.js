// Noticias de la categoría. Se generan a partir del estado real de la carrera:
// resultados del jugador, clasificación, incidentes y mercado, de modo que el
// telediario va contando la historia que está escribiendo el jugador.

import { makeRng } from '../core/rng.js';
import { pos } from '../core/util.js';

let counter = 0;

const TAGS = {
  player: { label: 'Tu piloto', css: 'player' },
  rival: { label: 'Clasificación', css: 'rival' },
  market: { label: 'Mercado', css: 'market' },
  technical: { label: 'Ingeniería', css: 'tech' },
  fia: { label: 'Reglamento', css: 'fia' },
};

function item({ tag, title, body, date, round, source = 'SportFeed', big = false }) {
  counter += 1;
  return { id: `n${counter}-${round}-${tag.css}`, tag: tag.css, tagLabel: tag.label, title, body, date, round, source, big };
}

const MARKET_TITLES = [
  'El mercado de fichajes se mueve',
  'Se aceleran las negociaciones',
  'Un equipo blinda a su piloto',
  'La lista de la próxima temporada toma forma',
];

const MARKET_BODIES = [
  'Varios equipos han registrado sus primeras reuniones con managers. Todavía no hay firmas, pero el mercado ya no está en calma.',
  'Fuentes cercanas al paddock confirman contactos entre equipos y representantes. Ninguna operación está cerrada.',
  'La dirección quiere cerrar los contratos de su piloto estrella antes de que empiece la segunda mitad del campeonato.',
  'Los primeros nombres de la próxima temporada siguen siendo un rumor, pero el proceso de negociación ya ha empezado.',
];

const TECH_TITLES = [
  'Ingeniería: las novedades del fin de semana',
  'Las mejoras que llegan a este circuito',
  'Neumáticos y aerodinámica: la apuesta',
  'Setup: qué se busca en este trazado',
];

const TECH_BODIES = [
  'El equipo llega con una revisión importante en el fondo. El objetivo es ganar tiempo en las curvas de alta.',
  'Se trabaja con un alerón trasero de menos deriva. En un circuito con tantas frenadas, cada metro cuenta.',
  'Neumáticos blandos extra y poco combustible. La estrategia prevista es de una sola parada.',
  'La línea de carrera es más lenta que la trazada ideal, pero más segura. El desgaste tiene prioridad.',
];

const FIA_TITLES = [
  'Los comisarios avisan sobre la zona de banderas',
  'Revisión del límite de pista en el sector final',
  'Nuevo protocolo de salida en frío',
  'La FIA actualiza el reglamento deportivo',
];

const FIA_BODIES = [
  'La FIA recuerda las normas de seguridad tras el análisis de los sectores finales del circuito.',
  'Tres pilotos citados a declarar por el uso del límite de pista. La sanción se decidirá después de la carrera.',
  'El protocolo se aplicará desde la próxima temporada y cambia la forma de entrar en boxes con el coche frío.',
  'El reglamento técnico y financiero recibe sus primeros ajustes de la temporada. Los equipos tienen hasta fin de mes para adaptarse.',
];

function resultNews(ctx) {
  const { player, position, grid, round, driverCount, retired, points, standings, team } = ctx;
  if (retired) {
    return item({
      tag: TAGS.player,
      big: true,
      title: `${player.name} abandona en ${round.gp}`,
      body: `El dorsal ${player.number} de ${team.name} se retiró en ${round.circuit.name}. De ${driverCount} coches en pista, ${Math.max(0, driverCount - 1)} llegaron a meta.`,
      date: round.days.sun,
      round: round.round,
    });
  }
  if (position === 1) {
    const lead = standings && standings.position === 1;
    const start = grid > 1 ? `desde la posición ${grid} de la parrilla` : 'desde la pole';
    return item({
      tag: TAGS.player,
      big: true,
      title: `${player.name} gana ${round.gp}`,
      body: `Victoria ${start} en ${round.circuit.name}. ${team.name} suma ${points} puntos y ${lead ? 'el dorsal asume el liderato' : 'se acerca a la punta'}.`,
      date: round.days.sun,
      round: round.round,
    });
  }
  if (position <= 3) {
    const champ = standings ? ` y ${pos(standings.position)} del campeonato` : '';
    return item({
      tag: TAGS.player,
      big: true,
      title: `Podio para ${player.name} en ${round.gp}`,
      body: `${pos(position)} en el podio de ${round.gp} para ${team.name}. ${points} puntos${champ}.`,
      date: round.days.sun,
      round: round.round,
    });
  }
  if (position <= 10) {
    return item({
      tag: TAGS.player,
      title: `${player.name} termina ${pos(position)} en ${round.gp}`,
      body: `Puntos y un fin de semana razonablemente solucionado para ${team.name}. ${points} puntos en el bolso.`,
      date: round.days.sun,
      round: round.round,
    });
  }
  return item({
    tag: TAGS.player,
    title: `Carrera sin puntos para ${player.name} en ${round.gp}`,
    body: `${pos(position)} en ${round.circuit.name}. El equipo analizará el desgaste antes de la próxima cita.`,
    date: round.days.sun,
    round: round.round,
  });
}

function qualiNews(ctx) {
  const { player, pole, round, team, grid } = ctx;
  if (pole) {
    return item({
      tag: TAGS.player,
      big: true,
      title: `Pole para ${player.name} en ${round.gp}`,
      body: `Mejor tiempo de la clasificación en ${round.circuit.name}. ${team.name} sale primero y el resto de la parrilla tiene que trabajar.`,
      date: round.days.sat,
      round: round.round,
    });
  }
  if (grid && grid <= 3) {
    return item({
      tag: TAGS.player,
      title: `${player.name} sale ${pos(grid)} en ${round.gp}`,
      body: `Primera línea para ${team.name} en ${round.circuit.name}. Buena oportunidad para el domingo.`,
      date: round.days.sat,
      round: round.round,
    });
  }
  if (grid && grid <= 10) {
    return item({
      tag: TAGS.player,
      title: `${player.name} queda ${pos(grid)} en la parrilla de ${round.gp}`,
      body: `Clasificación de fondo medio para ${team.name}. Trabajo pendiente en la trazada de ${round.circuit.name}.`,
      date: round.days.sat,
      round: round.round,
    });
  }
  return null;
}

function leaderNews(ctx) {
  const { standings, round, series } = ctx;
  const table = standings?.rows;
  if (!table || !table.length) return null;
  const leader = table[0];
  const wins = leader.wins === 1 ? 'victoria' : 'victorias';
  const verb = series === 'f1' ? 'lidera el campeonato' : 'domina la categoría';
  return item({
    tag: TAGS.rival,
    title: `${leader.name} ${verb}`,
    body: `${leader.points} puntos y ${leader.wins} ${wins} en ${round.round} jornadas. La próxima cita ya está en el calendario.`,
    date: round.days.sun,
    round: round.round,
  });
}

export function buildNews(state, round, summary) {
  counter = 0;
  const rng = makeRng(`${state.seed}|news|${state.series}|${round.round}`);
  const ctx = {
    player: state.driver,
    team: state.team,
    round,
    series: state.series,
    standings: state.standings,
    position: summary?.position ?? null,
    grid: summary?.grid ?? null,
    pole: Boolean(summary?.pole),
    retired: Boolean(summary?.retired),
    points: summary?.points ?? 0,
    driverCount: summary?.driverCount ?? 0,
  };

  const out = [];
  const quali = qualiNews(ctx);
  if (quali) out.push(quali);
  if (summary && (summary.position != null || summary.retired)) out.push(resultNews(ctx));
  const leader = leaderNews(ctx);
  if (leader) out.push(leader);

  out.push(item({ tag: TAGS.market, title: rng.pick(MARKET_TITLES), body: rng.pick(MARKET_BODIES), date: round.days.thu, round: round.round, source: 'Mundialsport' }));
  out.push(item({ tag: TAGS.technical, title: rng.pick(TECH_TITLES), body: rng.pick(TECH_BODIES), date: round.days.thu, round: round.round }));
  out.push(item({ tag: TAGS.fia, title: rng.pick(FIA_TITLES), body: rng.pick(FIA_BODIES), date: round.days.wed, round: round.round, source: 'FIAsport' }));

  out.sort((a, b) => Number(b.big) - Number(a.big));
  return out;
}
