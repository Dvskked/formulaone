// Los 11 equipos de Fórmula 1 de la temporada 2026 y los 11 de Fórmula 2.
// Los colores son aproximaciones a partir de la decoración de cada escudería.

export const F1_TEAMS = [
  {
    id: 'mclaren',
    name: 'McLaren',
    code: 'MCL',
    fullName: 'McLaren Mastercard Formula 1 Team',
    country: 'GBR',
    flag: '🇬🇧',
    hq: 'Woking, Inglaterra',
    founded: 1963,
    titles: 9,
    engine: 'Mercedes',
    tier: 1,
    livery: { primary: '#ff8700', secondary: '#0b1a3a', accent: '#00d2a0', style: 'papaya' },
    car: { power: 95, aero: 96, grip: 94, brakes: 95, reliability: 92, budget: 168 },
    staff: {
      principal: { name: 'Andrea Stella', style: 'exigente', flag: '🇮🇹' },
      deputy: { name: 'Zak Brown', style: 'ambicioso', flag: '🇺🇸' },
      chiefMechanic: { name: 'Gilberto de la Fuente', style: 'práctico', flag: '🇲🇽' },
      raceEngineer: { name: 'Will Marshall', style: 'analítico', flag: '🇬🇧' },
      performance: { name: 'Dave Charman', style: 'exigente', flag: '🇬🇧' },
    },
    motto: 'Ganar con rapidísimo y con estilo.',
  },
  {
    id: 'ferrari',
    name: 'Ferrari',
    code: 'FER',
    fullName: 'Scuderia Ferrari',
    country: 'ITA',
    flag: '🇮🇹',
    hq: 'Maranello, Italia',
    founded: 1929,
    titles: 16,
    engine: 'Ferrari',
    tier: 1,
    livery: { primary: '#e8112d', secondary: '#f5d000', accent: '#15161c', style: 'italian' },
    car: { power: 96, aero: 95, grip: 94, brakes: 94, reliability: 90, budget: 172 },
    staff: {
      principal: { name: 'Frédéric Vasseur', style: 'calculador', flag: '🇫🇷' },
      deputy: { name: 'Laurent Kebous', style: 'técnico', flag: '🇧🇪' },
      chiefMechanic: { name: 'Riccardo Crucino', style: 'tradicional', flag: '🇮🇹' },
      raceEngineer: { name: 'Bryan Bozzi', style: 'detallista', flag: '🇫🇷' },
      performance: { name: 'Andrea De Cesaro', style: 'analítico', flag: '🇮🇹' },
    },
    motto: 'El rojo más rápido del mundo.',
  },
  {
    id: 'mercedes',
    name: 'Mercedes',
    code: 'MER',
    fullName: 'Mercedes-AMG PETRONAS Formula One Team',
    country: 'DEU',
    flag: '🇩🇪',
    hq: 'Brackley, Inglaterra',
    founded: 2010,
    titles: 9,
    engine: 'Mercedes',
    tier: 1,
    livery: { primary: '#00d2a0', secondary: '#0a1c2b', accent: '#d9fbf2', style: 'petronas' },
    car: { power: 97, aero: 95, grip: 93, brakes: 94, reliability: 91, budget: 170 },
    staff: {
      principal: { name: 'Toto Wolff', style: 'estratéga', flag: '🇦🇹' },
      deputy: { name: 'James Dow', style: 'organizado', flag: '🇬🇧' },
      chiefMechanic: { name: 'James Matthews', style: 'metódico', flag: '🇬🇧' },
      raceEngineer: { name: 'Chris Medland', style: 'relajado', flag: '🇬🇧' },
      performance: { name: 'Rob Killian', style: 'analítico', flag: '🇮🇪' },
    },
    motto: 'Una leyenda que se reescribe cada fin de semana.',
  },
  {
    id: 'redbull',
    name: 'Red Bull Racing',
    code: 'RBR',
    fullName: 'Oracle Red Bull Racing Ford',
    country: 'AUT',
    flag: '🇦🇹',
    hq: 'Milton Keynes, Inglaterra',
    founded: 2005,
    titles: 6,
    engine: 'Ford',
    tier: 1,
    livery: { primary: '#1b3b8f', secondary: '#f5d000', accent: '#e8112d', style: 'navy' },
    car: { power: 94, aero: 95, grip: 94, brakes: 93, reliability: 90, budget: 168 },
    staff: {
      principal: { name: 'Laurent Mekies', style: 'intenso', flag: '🇫🇷' },
      deputy: { name: 'Horst Saibold', style: 'veterano', flag: '🇦🇹' },
      chiefMechanic: { name: 'Steve Nielsen', style: 'exigente', flag: '🇩🇰' },
      raceEngineer: { name: 'Paul Rogers', style: 'práctico', flag: '🇬🇧' },
      performance: { name: 'Gunnar Nørgaard', style: 'analítico', flag: '🇩🇰' },
    },
    motto: 'Todo está predestinado… pero se gana en la pista.',
  },
  {
    id: 'aston',
    name: 'Aston Martin',
    code: 'AST',
    fullName: 'Aston Martin Aramco Formula One Team',
    country: 'GBR',
    flag: '🇬🇧',
    hq: 'Silverstone, Inglaterra',
    founded: 2017,
    titles: 0,
    engine: 'Mercedes',
    tier: 2,
    livery: { primary: '#1f6f4a', secondary: '#d8f0e4', accent: '#c8102e', style: 'british' },
    car: { power: 91, aero: 90, grip: 90, brakes: 90, reliability: 88, budget: 148 },
    staff: {
      principal: { name: 'Enzo Deti', style: 'apasionado', flag: '🇮🇹' },
      deputy: { name: 'Andy Cowell', style: 'técnico', flag: '🇬🇧' },
      chiefMechanic: { name: 'Marek Seitz', style: 'cercano', flag: '🇩🇪' },
      raceEngineer: { name: 'Jack Millar', style: 'detallista', flag: '🇬🇧' },
      performance: { name: 'Bernie Collins', style: 'analítico', flag: '🇨🇦' },
    },
    motto: 'El verde que rompe con el escudo histórico de Aston Martin.',
  },
  {
    id: 'alpine',
    name: 'Alpine',
    code: 'ALP',
    fullName: 'BWT Alpine Formula One Team',
    country: 'FRA',
    flag: '🇫🇷',
    hq: 'Enstone, Inglaterra',
    founded: 2016,
    titles: 0,
    engine: 'Mercedes',
    tier: 2,
    livery: { primary: '#ff7ac8', secondary: '#1230c8', accent: '#0a0d18', style: 'alpine' },
    car: { power: 90, aero: 91, grip: 90, brakes: 89, reliability: 89, budget: 146 },
    staff: {
      principal: { name: 'Flavio Briatore', style: 'político', flag: '🇮🇹' },
      deputy: { name: 'Gunnar Stein', style: 'práctico', flag: '🇩🇪' },
      chiefMechanic: { name: 'Giorgio Scarano', style: 'duro', flag: '🇮🇹' },
      raceEngineer: { name: 'Pierre Lacroix', style: 'analítico', flag: '🇫🇷' },
      performance: { name: 'Alan Munday', style: 'analítico', flag: '🇬🇧' },
    },
    motto: 'Alternativa y persistente, sin techo.',
  },
  {
    id: 'williams',
    name: 'Williams',
    code: 'WIL',
    fullName: 'Atlassian Williams F1 Team',
    country: 'GBR',
    flag: '🇬🇧',
    hq: 'Grove, Inglaterra',
    founded: 1977,
    titles: 9,
    engine: 'Mercedes',
    tier: 2,
    livery: { primary: '#1868db', secondary: '#0a1f4d', accent: '#00d2a0', style: 'blue' },
    car: { power: 90, aero: 89, grip: 88, brakes: 88, reliability: 86, budget: 138 },
    staff: {
      principal: { name: 'Jenson Button', style: 'inspirador', flag: '🇬🇧' },
      deputy: { name: 'Vince Gardner', style: 'cercano', flag: '🇦🇺' },
      chiefMechanic: { name: 'Dave Hutsby', style: 'práctico', flag: '🇬🇧' },
      raceEngineer: { name: 'Freddie Houghton', style: 'analítico', flag: '🇬🇧' },
      performance: { name: 'Gareth Dicker', style: 'analítico', flag: '🇬🇧' },
    },
    motto: 'Construir desde la base, ganar desde el paddock.',
  },
  {
    id: 'racingbulls',
    name: 'Racing Bulls',
    code: 'RBS',
    fullName: 'Visa Cash App Racing Bulls Formula One Team',
    country: 'ITA',
    flag: '🇮🇹',
    hq: 'Faenza, Italia',
    founded: 1985,
    titles: 0,
    engine: 'Ford',
    tier: 3,
    livery: { primary: '#6a4df0', secondary: '#0b0d16', accent: '#1fd7c3', style: 'bull' },
    car: { power: 88, aero: 88, grip: 88, brakes: 87, reliability: 88, budget: 128 },
    staff: {
      principal: { name: 'Alessandro Albon', style: 'directo', flag: '🇹🇭' },
      deputy: { name: 'Graziano Baldini', style: 'veterano', flag: '🇮🇹' },
      chiefMechanic: { name: 'Luca Bassi', style: 'cercano', flag: '🇮🇹' },
      raceEngineer: { name: 'Emanuele Haddad', style: 'analítico', flag: '🇮🇹' },
      performance: { name: 'Gian Piovesana', style: 'analítico', flag: '🇮🇹' },
    },
    motto: 'Joven, valiente y con cero miedo al gran premio.',
  },
  {
    id: 'haas',
    name: 'Haas',
    code: 'HAA',
    fullName: 'MoneyGram Haas F1 Team',
    country: 'USA',
    flag: '🇺🇸',
    hq: 'Staunton, Virginia',
    founded: 2016,
    titles: 0,
    engine: 'Ferrari',
    tier: 3,
    livery: { primary: '#b6babd', secondary: '#0a0d16', accent: '#e8112d', style: 'grey' },
    car: { power: 86, aero: 86, grip: 85, brakes: 85, reliability: 85, budget: 118 },
    staff: {
      principal: { name: 'David Grignon', style: 'pragmático', flag: '🇨🇦' },
      deputy: { name: 'Travis Baxter', style: 'cercano', flag: '🇨🇦' },
      chiefMechanic: { name: 'Randy Ertman', style: 'veterano', flag: '🇺🇸' },
      raceEngineer: { name: 'Rob Wainwright', style: 'analítico', flag: '🇬🇧' },
      performance: { name: 'Grant Engle', style: 'analítico', flag: '🇺🇸' },
    },
    motto: 'Prepárate y la ocasión llegará.',
  },
  {
    id: 'audi',
    name: 'Audi',
    code: 'AUD',
    fullName: 'Revolut Audi F1 Team',
    country: 'DEU',
    flag: '🇩🇪',
    hq: 'Neuburg an der Donau, Alemania',
    founded: 2026,
    titles: 0,
    engine: 'Audi',
    tier: 3,
    livery: { primary: '#f22f27', secondary: '#1b1b1f', accent: '#e8e8ea', style: 'rings' },
    car: { power: 84, aero: 85, grip: 85, brakes: 85, reliability: 80, budget: 122 },
    staff: {
      principal: { name: 'Gérard Ducarouge', style: 'técnico', flag: '🇫🇷' },
      deputy: { name: 'Ralf Kelleners', style: 'veterano', flag: '🇩🇪' },
      chiefMechanic: { name: 'Christian Fries', style: 'meticuloso', flag: '🇩🇪' },
      raceEngineer: { name: 'Mert Özer', style: 'analítico', flag: '🇹🇷' },
      performance: { name: 'Rob Mallen', style: 'analítico', flag: '🇺🇸' },
    },
    motto: 'Cien años de ingenio en un solo depósito.',
  },
  {
    id: 'cadillac',
    name: 'Cadillac',
    code: 'CAD',
    fullName: 'Cadillac Formula One Team',
    country: 'USA',
    flag: '🇺🇸',
    hq: 'Detroit, Michigan',
    founded: 2026,
    titles: 0,
    engine: 'GM',
    tier: 4,
    livery: { primary: '#0a2540', secondary: '#d8dde6', accent: '#e8112d', style: 'cadillac' },
    car: { power: 82, aero: 82, grip: 82, brakes: 83, reliability: 79, budget: 116 },
    staff: {
      principal: { name: 'TWG Motorsport', style: 'estratégico', flag: '🇺🇸' },
      deputy: { name: 'Jonathan Bell', style: 'práctico', flag: '🇬🇧' },
      chiefMechanic: { name: 'Sérgio Henriques', style: 'técnico', flag: '🇵🇹' },
      raceEngineer: { name: 'Charles Bacon', style: 'analítico', flag: '🇺🇸' },
      performance: { name: 'Mark McMillan', style: 'analítico', flag: '🇺🇸' },
    },
    motto: 'Debut con exceptionalismo americano.',
  },
];

export const F2_TEAMS = [
  { id: 'invicta', name: 'Invicta Racing', code: 'INV', country: 'GBR', flag: '🇬🇧', livery: { primary: '#1f4fd8', secondary: '#0a1230', accent: '#e8112d', style: 'blue' }, car: { power: 93, aero: 92, grip: 92, brakes: 90, reliability: 90, budget: 96 } },
  { id: 'hitech', name: 'Hitech TGR', code: 'HIT', country: 'GBR', flag: '🇬🇧', livery: { primary: '#00b3a4', secondary: '#0a1c22', accent: '#f5d000', style: 'petronas' }, car: { power: 89, aero: 90, grip: 90, brakes: 89, reliability: 91, budget: 88 } },
  { id: 'campos', name: 'Campos Racing', code: 'CAM', country: 'ESP', flag: '🇪🇸', livery: { primary: '#1a7a3c', secondary: '#0a1c12', accent: '#e8112d', style: 'british' }, car: { power: 88, aero: 88, grip: 89, brakes: 88, reliability: 90, budget: 86 } },
  { id: 'dams', name: 'DAMS Lucas Oil', code: 'DAM', country: 'FRA', flag: '🇫🇷', livery: { primary: '#ffd100', secondary: '#141414', accent: '#1560bd', style: 'grey' }, car: { power: 88, aero: 87, grip: 88, brakes: 87, reliability: 90, budget: 85 } },
  { id: 'mp', name: 'MP Motorsport', code: 'MPM', country: 'NLD', flag: '🇳🇱', livery: { primary: '#ff7a00', secondary: '#111820', accent: '#00d2a0', style: 'papaya' }, car: { power: 87, aero: 87, grip: 87, brakes: 86, reliability: 89, budget: 84 } },
  { id: 'prema', name: 'PREMA Racing', code: 'PRM', country: 'ITA', flag: '🇮🇹', livery: { primary: '#e8112d', secondary: '#101014', accent: '#ffffff', style: 'italian' }, car: { power: 87, aero: 86, grip: 87, brakes: 86, reliability: 89, budget: 83 } },
  { id: 'rodin', name: 'Rodin Motorsport', code: 'ROD', country: 'GBR', flag: '🇬🇧', livery: { primary: '#12a37a', secondary: '#0b1c16', accent: '#f5d000', style: 'rings' }, car: { power: 86, aero: 86, grip: 86, brakes: 85, reliability: 88, budget: 82 } },
  { id: 'art', name: 'ART Grand Prix', code: 'ART', country: 'FRA', flag: '🇫🇷', livery: { primary: '#5b2d8e', secondary: '#120b22', accent: '#ff4fd8', style: 'bull' }, car: { power: 85, aero: 85, grip: 85, brakes: 84, reliability: 87, budget: 80 } },
  { id: 'aix', name: 'AIX Racing', code: 'AIX', country: 'ESP', flag: '🇪🇸', livery: { primary: '#00c2a8', secondary: '#0a1a1e', accent: '#ff4f00', style: 'rings' }, car: { power: 84, aero: 84, grip: 84, brakes: 83, reliability: 86, budget: 78 } },
  { id: 'var', name: 'Van Amersfoort Racing', code: 'VAR', country: 'NLD', flag: '🇳🇱', livery: { primary: '#f2f4f8', secondary: '#101418', accent: '#1560bd', style: 'grey' }, car: { power: 84, aero: 83, grip: 84, brakes: 83, reliability: 87, budget: 77 } },
  { id: 'trident', name: 'TRIDENT', code: 'TRI', country: 'GBR', flag: '🇬🇧', livery: { primary: '#123a8f', secondary: '#0a1020', accent: '#00d2a0', style: 'blue' }, car: { power: 83, aero: 83, grip: 83, brakes: 82, reliability: 86, budget: 76 } },
];

export const F2_STAFF = {
  invicta: { principal: { name: 'Sacha Modena', style: 'ambicioso', flag: '🇮🇹' }, chiefMechanic: { name: 'Tom Bishop', style: 'práctico', flag: '🇬🇧' }, raceEngineer: { name: 'Arnaud Lemoine', style: 'analítico', flag: '🇫🇷' } },
  hitech: { principal: { name: 'Oliver Oakes', style: 'calculador', flag: '🇬🇧' }, chiefMechanic: { name: 'Diego Rueda', style: 'cercano', flag: '🇪🇸' }, raceEngineer: { name: 'Nils Bauer', style: 'analítico', flag: '🇩🇪' } },
  campos: { principal: { name: 'Julio Iñiguez', style: 'cercano', flag: '🇪🇸' }, chiefMechanic: { name: 'Marc Prieto', style: 'práctico', flag: '🇪🇸' }, raceEngineer: { name: 'Ana Beltrán', style: 'analítico', flag: '🇪🇸' } },
  dams: { principal: { name: 'Guy Savage', style: 'veterano', flag: '🇬🇧' }, chiefMechanic: { name: 'Aurélien Mercier', style: 'práctico', flag: '🇫🇷' }, raceEngineer: { name: 'Lucie Marchand', style: 'analítico', flag: '🇫🇷' } },
  mp: { principal: { name: 'Sander van der Marel', style: 'práctico', flag: '🇳🇱' }, chiefMechanic: { name: 'Hugo Visser', style: 'cercano', flag: '🇳🇱' }, raceEngineer: { name: 'Eva Kraan', style: 'analítico', flag: '🇳🇱' } },
  prema: { principal: { name: 'Angelo Rosin', style: 'resolutivo', flag: '🇮🇹' }, chiefMechanic: { name: 'Dario Ferraro', style: 'práctico', flag: '🇮🇹' }, raceEngineer: { name: 'Chiara Rinaldi', style: 'analítico', flag: '🇮🇹' } },
  rodin: { principal: { name: 'Denis Sanaeff', style: 'político', flag: '🇬🇧' }, chiefMechanic: { name: 'Luca Fabbri', style: 'cercano', flag: '🇮🇹' }, raceEngineer: { name: 'Mika Halonen', style: 'analítico', flag: '🇫🇮' } },
  art: { principal: { name: 'Frédéric Sausset', style: 'exigente', flag: '🇫🇷' }, chiefMechanic: { name: 'Pablo Duarte', style: 'práctico', flag: '🇪🇸' }, raceEngineer: { name: 'Clara Noël', style: 'analítico', flag: '🇫🇷' } },
  aix: { principal: { name: 'Gerard Riba', style: 'dinámico', flag: '🇪🇸' }, chiefMechanic: { name: 'Iker Salazar', style: 'práctico', flag: '🇪🇸' }, raceEngineer: { name: 'Mar Costa', style: 'analítico', flag: '🇵🇹' } },
  var: { principal: { name: 'Mathieu van der Berg', style: 'serio', flag: '🇳🇱' }, chiefMechanic: { name: 'Bram de Wit', style: 'práctico', flag: '🇳🇱' }, raceEngineer: { name: 'Sanne Visser', style: 'analítico', flag: '🇳🇱' } },
  trident: { principal: { name: 'Jonny Mackintosh', style: 'cercano', flag: '🇬🇧' }, chiefMechanic: { name: 'Callum Ridge', style: 'práctico', flag: '🇬🇧' }, raceEngineer: { name: 'Oscar Lund', style: 'analítico', flag: '🇸🇪' } },
};

export const F2_OWNERS = {
  invicta: { name: 'Raúl Camarero', style: 'exigente', flag: '🇪🇸' },
  hitech: { name: 'Olga Senís', style: 'analítica', flag: '🇪🇸' },
  dams: { name: 'Jacques Lemaire', style: 'pragmático', flag: '🇫🇷' },
  mp: { name: 'Bram van Dam', style: 'cercano', flag: '🇳🇱' },
  prema: { name: 'Grupo PREMA', style: 'resolutivo', flag: '🇮🇹' },
  rodin: { name: 'Racing Steps Foundation', style: 'político', flag: '🇬🇧' },
  art: { name: 'Frédéric Sausset', style: 'exigente', flag: '🇫🇷' },
  aix: { name: 'Jorge Martínez', style: 'dinámico', flag: '🇪🇸' },
  var: { name: 'Van Amersfoort Sport', style: 'serio', flag: '🇳🇱' },
  trident: { name: 'Jonny Mackintosh', style: 'cercano', flag: '🇬🇧' },
};

const F1_BY_ID = new Map(F1_TEAMS.map((t) => [t.id, t]));
const F2_BY_ID = new Map(F2_TEAMS.map((t) => [t.id, t]));

export function getTeam(id, series = 'f1') {
  if (series === 'f2') return F2_BY_ID.get(id) || F2_TEAMS[0];
  return F1_BY_ID.get(id) || F1_TEAMS[0];
}

export function teamsFor(series) {
  return series === 'f2' ? F2_TEAMS : F1_TEAMS;
}

export function staffFor(team, series = 'f1') {
  if (series === 'f2') {
    return (
      F2_STAFF[team.id] || {
        principal: { name: 'Dirección del equipo', style: 'cercano', flag: '🇪🇺' },
        chiefMechanic: { name: 'Jefe de mecánicos', style: 'práctico', flag: '🇪🇺' },
        raceEngineer: { name: 'Ingeniero de carrera', style: 'analítico', flag: '🇪🇺' },
      }
    );
  }
  return team.staff;
}

export function ownerFor(team, series = 'f1') {
  if (series === 'f1') return { name: `Grupo ${team.name}`, style: 'negociador', flag: team.flag };
  const o = F2_OWNERS[team.id];
  return o ? o : { name: `Accionistas de ${team.name}`, style: 'negociador', flag: team.flag };
}

/** Nivel global del monoplaza 1..100 con el que corre el jugador. */
export function carLevel(team, series = 'f1') {
  const c = team.car;
  return Math.round(c.power * 0.3 + c.aero * 0.3 + c.grip * 0.22 + c.brakes * 0.1 + c.reliability * 0.08);
}

/**
 * Multiplicador de rendimiento frente a la referencia.
 * Un Haas o un Cadillac son claramente más lentos que un Ferrari: eso se nota en la pista.
 */
export function carPerformance(team, series = 'f1') {
  const level = carLevel(team, series);
  return 0.9 + (level - 82) * 0.0075;
}

export const F1_TEAM_TIERS = [
  { tier: 1, label: 'Élite de la parrilla', ids: ['mclaren', 'ferrari', 'mercedes', 'redbull'] },
  { tier: 2, label: 'Aspirantes', ids: ['aston', 'alpine', 'williams'] },
  { tier: 3, label: 'Supervivientes', ids: ['racingbulls', 'haas', 'audi'] },
  { tier: 4, label: 'Novatos', ids: ['cadillac'] },
];
