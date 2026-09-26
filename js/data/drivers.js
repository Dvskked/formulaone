// Parrilla 2026: 22 pilotos de Fórmula 1 y 22 de Fórmula 2.
// Nombres, dorsales y equipos corresponden a la temporada 2026.

const r = (pace, braking, control, consistency, racecraft, quali, tyre, starts, wet) => ({
  pace,
  braking,
  control,
  consistency,
  racecraft,
  quali,
  tyre,
  starts,
  wet,
});

export const F1_DRIVERS = [
  { id: 'norris', name: 'Lando Norris', short: 'NOR', code: 'NOR', number: 1, country: 'GBR', flag: '🇬🇧', teamId: 'mclaren', age: 26, helmet: { primary: '#ff8700', secondary: '#0b1a3a' }, ratings: r(96, 93, 92, 92, 92, 95, 91, 88, 88), traits: ['Rápido en clasificación', 'Frenada tardía'] },
  { id: 'piastri', name: 'Óscar Piastri', short: 'PIA', code: 'PIA', number: 81, country: 'AUS', flag: '🇦🇺', teamId: 'mclaren', age: 25, helmet: { primary: '#ff8700', secondary: '#121a3d' }, ratings: r(94, 95, 95, 94, 90, 94, 93, 86, 90), traits: ['Frío', 'Frenada brutal'] },
  { id: 'hamilton', name: 'Lewis Hamilton', short: 'HAM', code: 'HAM', number: 44, country: 'GBR', flag: '🇬🇧', teamId: 'ferrari', age: 41, helmet: { primary: '#00d2a0', secondary: '#e8112d' }, ratings: r(96, 97, 95, 90, 94, 95, 94, 97, 94), traits: ['Maestro de la gestión', 'Neumáticos salvadores'] },
  { id: 'leclerc', name: 'Charles Leclerc', short: 'LEC', code: 'LEC', number: 16, country: 'MON', flag: '🇲🇨', teamId: 'ferrari', age: 29, helmet: { primary: '#e8112d', secondary: '#15161c' }, ratings: r(95, 94, 93, 88, 91, 96, 90, 88, 86), traits: ['Récord en clasificación', 'Polémica en pista'] },
  { id: 'russell', name: 'George Russell', short: 'RUS', code: 'RUS', number: 63, country: 'GBR', flag: '🇬🇧', teamId: 'mercedes', age: 32, helmet: { primary: '#00d2a0', secondary: '#0a1c2b' }, ratings: r(93, 93, 92, 91, 92, 94, 92, 90, 89), traits: ['Ingeniero de pista', 'Militar'] },
  { id: 'antonelli', name: 'Kimi Antonelli', short: 'ANT', code: 'ANT', number: 12, country: 'ITA', flag: '🇮🇹', teamId: 'mercedes', age: 19, helmet: { primary: '#00d2a0', secondary: '#f5d000' }, ratings: r(92, 90, 89, 85, 88, 92, 87, 84, 84), traits: ['Aprendizaje rápido', 'Racha de victorias'] },
  { id: 'verstappen', name: 'Max Verstappen', short: 'VER', code: 'VER', number: 3, country: 'NED', flag: '🇳🇱', teamId: 'redbull', age: 29, helmet: { primary: '#1b3b8f', secondary: '#f5d000' }, ratings: r(98, 97, 96, 89, 95, 95, 92, 95, 92), traits: ['Máquina de carrera', 'Duro con el rival'] },
  { id: 'hadjar', name: 'Isack Hadjar', short: 'HAD', code: 'HAD', number: 6, country: 'FRA', flag: '🇫🇷', teamId: 'redbull', age: 26, helmet: { primary: '#1b3b8f', secondary: '#e8112d' }, ratings: r(88, 87, 87, 87, 86, 88, 86, 85, 85), traits: ['Presión de la academia', 'Tranquilo'] },
  { id: 'alonso', name: 'Fernando Alonso', short: 'ALO', code: 'ALO', number: 14, country: 'ESP', flag: '🇪🇸', teamId: 'aston', age: 45, helmet: { primary: '#1f6f4a', secondary: '#d8f0e4' }, ratings: r(90, 91, 93, 93, 96, 90, 95, 97, 94), traits: ['Oveja negra', 'Defiende posiciones'] },
  { id: 'stroll', name: 'Lance Stroll', short: 'STRO', code: 'STR', number: 18, country: 'CAN', flag: '🇨🇦', teamId: 'aston', age: 27, helmet: { primary: '#1f6f4a', secondary: '#c8102e' }, ratings: r(82, 82, 80, 78, 76, 82, 79, 74, 78), traits: ['Presión permanente', 'Malas salidas'] },
  { id: 'gasly', name: 'Pierre Gasly', short: 'GAS', code: 'GAS', number: 10, country: 'FRA', flag: '🇫🇷', teamId: 'alpine', age: 30, helmet: { primary: '#ff7ac8', secondary: '#1230c8' }, ratings: r(88, 88, 87, 86, 87, 88, 86, 86, 86), traits: ['Especialista en poles', 'Fuerte con la lluvia'] },
  { id: 'colapinto', name: 'Franco Colapinto', short: 'COL', code: 'COL', number: 43, country: 'ARG', flag: '🇦🇷', teamId: 'alpine', age: 23, helmet: { primary: '#ff7ac8', secondary: '#0a0d18' }, ratings: r(83, 83, 82, 80, 81, 84, 81, 79, 82), traits: ['Coraje', 'Sin miedo'] },
  { id: 'albon', name: 'Alexander Albon', short: 'ALB', code: 'ALB', number: 23, country: 'THA', flag: '🇹🇭', teamId: 'williams', age: 30, helmet: { primary: '#1868db', secondary: '#0a1f4d' }, ratings: r(87, 87, 88, 89, 88, 87, 90, 89, 88), traits: ['Gestor de gomas', 'Fiel al equipo'] },
  { id: 'sainz', name: 'Carlos Sainz', short: 'SAI', code: 'SAI', number: 55, country: 'ESP', flag: '🇪🇸', teamId: 'williams', age: 37, helmet: { primary: '#1868db', secondary: '#00d2a0' }, ratings: r(89, 90, 90, 92, 91, 90, 92, 92, 90), traits: ['Ingeniero de carrera', 'Campeón con varios equipos'] },
  { id: 'lawson', name: 'Liam Lawson', short: 'LAW', code: 'LAW', number: 30, country: 'NZL', flag: '🇳🇿', teamId: 'racingbulls', age: 24, helmet: { primary: '#6a4df0', secondary: '#1fd7c3' }, ratings: r(85, 84, 84, 82, 82, 85, 83, 82, 82), traits: ['Agresivo', 'Buen debrief'] },
  { id: 'lindblad', name: 'Arvid Lindblad', short: 'LIN', code: 'LIN', number: 41, country: 'GBR', flag: '🇬🇧', teamId: 'racingbulls', age: 19, helmet: { primary: '#6a4df0', secondary: '#f5d000' }, ratings: r(84, 82, 80, 77, 80, 85, 79, 78, 79), traits: ['Novato atolondrado', 'Debut en F1'] },
  { id: 'bearman', name: 'Oliver Bearman', short: 'BEA', code: 'BEA', number: 87, country: 'GBR', flag: '🇬🇧', teamId: 'haas', age: 26, helmet: { primary: '#b6babd', secondary: '#0a0d16' }, ratings: r(83, 82, 83, 83, 82, 84, 82, 82, 83), traits: ['En casa es otra historia', 'Gran fin de semana'] },
  { id: 'ocon', name: 'Esteban Ocon', short: 'OCO', code: 'OCO', number: 31, country: 'FRA', flag: '🇫🇷', teamId: 'haas', age: 30, helmet: { primary: '#b6babd', secondary: '#e8112d' }, ratings: r(82, 82, 81, 80, 81, 82, 80, 80, 80), traits: ['Combativo', 'Túnel de boxes'] },
  { id: 'bortoleto', name: 'Gabriel Bortoleto', short: 'BOR', code: 'BOR', number: 5, country: 'BRA', flag: '🇧🇷', teamId: 'audi', age: 22, helmet: { primary: '#f22f27', secondary: '#1b1b1f' }, ratings: r(79, 79, 80, 79, 79, 80, 78, 78, 79), traits: ['Campeón de F3', 'Método'] },
  { id: 'hulkenberg', name: 'Nico Hülkenberg', short: 'HUL', code: 'HUL', number: 27, country: 'GER', flag: '🇩🇪', teamId: 'audi', age: 53, helmet: { primary: '#f22f27', secondary: '#e8e8ea' }, ratings: r(83, 83, 82, 82, 84, 84, 84, 84, 83), traits: ['Récord de poles', 'Nunca en el podio'] },
  { id: 'bottas', name: 'Valtteri Bottas', short: 'BOT', code: 'BOT', number: 88, country: 'FIN', flag: '🇫🇮', teamId: 'cadillac', age: 36, helmet: { primary: '#0a2540', secondary: '#d8dde6' }, ratings: r(84, 84, 85, 85, 84, 85, 86, 89, 84), traits: ['Ingeniería de pista', 'Pole en 2019'] },
  { id: 'perez', name: 'Sergio Pérez', short: 'PER', code: 'PER', number: 11, country: 'MEX', flag: '🇲🇽', teamId: 'cadillac', age: 36, helmet: { primary: '#0a2540', secondary: '#e8112d' }, ratings: r(84, 84, 83, 82, 85, 85, 88, 88, 84), traits: ['Experiencia en gestión', 'Remontadas de noche'] },
];

export const F2_DRIVERS = [
  { id: 'camara', name: 'Rafael Câmara', short: 'CAM', code: 'CAM', number: 1, country: 'BRA', flag: '🇧🇷', teamId: 'invicta', age: 23, helmet: { primary: '#1f4fd8', secondary: '#e8112d' }, ratings: r(84, 83, 83, 82, 81, 83, 82, 80, 82), traits: ['Campeón invicto', 'Constante'] },
  { id: 'duerksen', name: 'Joshua Dürksen', short: 'DUE', code: 'DUE', number: 2, country: 'LUX', flag: '🇱🇺', teamId: 'invicta', age: 23, helmet: { primary: '#1f4fd8', secondary: '#00d2a0' }, ratings: r(83, 82, 82, 81, 80, 82, 81, 79, 81), traits: ['Rivale interno', 'Rápido en trazadas largas'] },
  { id: 'miyata', name: 'Ritomo Miyata', short: 'MIY', code: 'MIY', number: 3, country: 'JPN', flag: '🇯🇵', teamId: 'hitech', age: 21, helmet: { primary: '#00b3a4', secondary: '#f5d000' }, ratings: r(80, 80, 80, 79, 78, 80, 79, 78, 79), traits: ['Academia Toyota', 'Debutante'] },
  { id: 'herta', name: 'Colton Herta', short: 'HER', code: 'HER', number: 4, country: 'USA', flag: '🇺🇸', teamId: 'hitech', age: 26, helmet: { primary: '#00b3a4', secondary: '#f5d000' }, ratings: r(83, 82, 82, 81, 83, 83, 81, 84, 81), traits: ['Experiencia en IndyCar', 'Duro con el rival'] },
  { id: 'leon', name: 'Noel León', short: 'LEO', code: 'LEO', number: 5, country: 'ESP', flag: '🇪🇸', teamId: 'campos', age: 22, helmet: { primary: '#1a7a3c', secondary: '#e8112d' }, ratings: r(80, 80, 80, 80, 79, 80, 80, 78, 79), traits: ['Polivalente', 'Buen carácter'] },
  { id: 'tsolov', name: 'Nikola Tsolov', short: 'TSO', code: 'TSO', number: 6, country: 'BUL', flag: '🇧🇬', teamId: 'campos', age: 22, helmet: { primary: '#1a7a3c', secondary: '#f5d000' }, ratings: r(81, 81, 81, 81, 80, 81, 81, 80, 80), traits: ['Mano suave', 'Trazada técnica'] },
  { id: 'beganovic', name: 'Dino Beganovic', short: 'BEG', code: 'BEG', number: 7, country: 'SVN', flag: '🇸🇮', teamId: 'dams', age: 21, helmet: { primary: '#ffd100', secondary: '#141414' }, ratings: r(81, 81, 81, 80, 80, 81, 80, 79, 80), traits: ['Academia Ferrari', 'Constante'] },
  { id: 'bilinski', name: 'Roman Bilinski', short: 'BIL', code: 'BIL', number: 8, country: 'POL', flag: '🇵🇱', teamId: 'dams', age: 23, helmet: { primary: '#ffd100', secondary: '#1560bd' }, ratings: r(78, 78, 79, 79, 78, 79, 79, 78, 78), traits: ['Firme', 'Sin errores'] },
  { id: 'mini', name: 'Gabriele Minì', short: 'MIN', code: 'MIN', number: 9, country: 'ITA', flag: '🇮🇹', teamId: 'mp', age: 20, helmet: { primary: '#ff7a00', secondary: '#111820' }, ratings: r(83, 82, 82, 81, 82, 83, 82, 80, 81), traits: ['Campeón de F3', 'Velocidad en recta'] },
  { id: 'goethe', name: 'Oliver Goethe', short: 'GOE', code: 'GOE', number: 10, country: 'DE', flag: '🇩🇪', teamId: 'mp', age: 21, helmet: { primary: '#ff7a00', secondary: '#00d2a0' }, ratings: r(79, 79, 79, 78, 78, 79, 78, 77, 78), traits: ['Escuela alemana', 'Metódico'] },
  { id: 'montoya', name: 'Sebastián Montoya', short: 'MON', code: 'MON', number: 11, country: 'COL', flag: '🇨🇴', teamId: 'prema', age: 21, helmet: { primary: '#e8112d', secondary: '#f5d000' }, ratings: r(79, 79, 80, 79, 78, 80, 79, 78, 79), traits: ['Tardío al frenar', 'Rápido en F3'] },
  { id: 'boya', name: 'Mari Boya', short: 'BOY', code: 'BOY', number: 12, country: 'ESP', flag: '🇪🇸', teamId: 'prema', age: 20, helmet: { primary: '#e8112d', secondary: '#101014' }, ratings: r(80, 80, 80, 79, 79, 80, 80, 78, 79), traits: ['Constancia', 'Sin dramas'] },
  { id: 'stenshorne', name: 'Martinius Stenshorne', short: 'STE', code: 'STE', number: 14, country: 'NOR', flag: '🇳🇴', teamId: 'rodin', age: 20, helmet: { primary: '#12a37a', secondary: '#f5d000' }, ratings: r(77, 77, 78, 77, 77, 78, 77, 76, 77), traits: ['Joven', 'Curioso'] },
  { id: 'dunne', name: 'Alexander Dunne', short: 'DUN', code: 'DUN', number: 15, country: 'IRL', flag: '🇮🇪', teamId: 'rodin', age: 21, helmet: { primary: '#12a37a', secondary: '#0b1c16' }, ratings: r(86, 85, 85, 84, 83, 85, 84, 82, 84), traits: ['Favorito al título', 'Trazada limpia'] },
  { id: 'maini', name: 'Kush Maini', short: 'MAI', code: 'MAI', number: 16, country: 'IND', flag: '🇮🇳', teamId: 'art', age: 21, helmet: { primary: '#5b2d8e', secondary: '#ff4fd8' }, ratings: r(80, 80, 80, 79, 79, 81, 79, 78, 80), traits: ['Velocidad en F3', 'Agresivo'] },
  { id: 'inthraphuvasak', name: 'Tasanapol Inthraphuvasak', short: 'INT', code: 'INT', number: 17, country: 'THA', flag: '🇹🇭', teamId: 'art', age: 22, helmet: { primary: '#5b2d8e', secondary: '#120b22' }, ratings: r(76, 76, 77, 77, 76, 77, 76, 75, 76), traits: ['Academia Alpine', 'Disciplinado'] },
  { id: 'fittipaldi', name: 'Emerson Fittipaldi', short: 'FIT', code: 'FIT', number: 20, country: 'BRA', flag: '🇧🇷', teamId: 'aix', age: 19, helmet: { primary: '#00c2a8', secondary: '#ff4f00' }, ratings: r(77, 77, 78, 77, 77, 78, 77, 76, 77), traits: ['Sangre nueva', 'Nombre con peso'] },
  { id: 'shields', name: 'Cian Shields', short: 'SHI', code: 'SHI', number: 21, country: 'IRL', flag: '🇮🇪', teamId: 'aix', age: 21, helmet: { primary: '#00c2a8', secondary: '#0a1a1e' }, ratings: r(75, 75, 76, 76, 75, 76, 75, 75, 75), traits: ['Aprendiz', 'Constante'] },
  { id: 'varrone', name: 'Nico Varrone', short: 'VAR', code: 'VAR', number: 22, country: 'ITA', flag: '🇮🇹', teamId: 'var', age: 21, helmet: { primary: '#f2f4f8', secondary: '#101418' }, ratings: r(78, 78, 79, 78, 78, 78, 78, 77, 78), traits: ['Italiano', 'Duro en la trazada'] },
  { id: 'villagomez', name: 'Rafael Villagómez', short: 'VIL', code: 'VIL', number: 23, country: 'MEX', flag: '🇲🇽', teamId: 'var', age: 23, helmet: { primary: '#f2f4f8', secondary: '#1560bd' }, ratings: r(76, 76, 77, 77, 76, 77, 76, 76, 76), traits: ['Veterano de la categoría', 'Táctico'] },
  { id: 'vanhoepen', name: 'Laurens van Hoepen', short: 'VHO', code: 'VHO', number: 24, country: 'NED', flag: '🇳🇱', teamId: 'trident', age: 22, helmet: { primary: '#123a8f', secondary: '#00d2a0' }, ratings: r(75, 75, 76, 76, 75, 76, 75, 75, 75), traits: ['Neerlandés', 'Tranquilo'] },
  { id: 'bennett', name: 'John Bennett', short: 'BEN', code: 'BEN', number: 25, country: 'USA', flag: '🇺🇸', teamId: 'trident', age: 21, helmet: { primary: '#123a8f', secondary: '#0a1020' }, ratings: r(77, 77, 78, 77, 77, 78, 77, 76, 77), traits: ['Universidad de Indiana', 'Curioso'] },
];

export const NATIONALITIES = {
  GBR: 'Británico',
  USA: 'Estadounidense',
  AUS: 'Australiano',
  ITA: 'Italiano',
  MON: 'Monegasco',
  DEU: 'Alemán',
  DE: 'Alemán',
  NED: 'Neerlandés',
  FRA: 'Francés',
  ESP: 'Español',
  CAN: 'Canadiense',
  THA: 'Tailandés',
  NZL: 'Neozelandés',
  BRA: 'Brasileño',
  MEX: 'Mexicano',
  ARG: 'Argentino',
  FIN: 'Finés',
  SUI: 'Suizo',
  BEL: 'Belga',
  LUX: 'Luxemburgués',
  JPN: 'Japonés',
  BUL: 'Búlgaro',
  SVN: 'Esloveno',
  POL: 'Polaco',
  COL: 'Colombiano',
  IRL: 'Irlandés',
  NOR: 'Noruego',
  IND: 'Indio',
  AUT: 'Austríaco',
};

const F1_BY_ID = new Map(F1_DRIVERS.map((d) => [d.id, d]));
const F2_BY_ID = new Map(F2_DRIVERS.map((d) => [d.id, d]));

export function driversFor(series) {
  return series === 'f2' ? F2_DRIVERS : F1_DRIVERS;
}

export function findDriver(id, series = 'f1') {
  return (series === 'f2' ? F2_BY_ID : F1_BY_ID).get(id) || null;
}

export function driverNationality(d) {
  return NATIONALITIES[d.country] || d.country;
}

/** Media ponderada de atributos: base del OVR de la IA y del jugador. */
export function averageRating(ratings) {
  const weights = { pace: 1.35, braking: 1.1, control: 1.15, consistency: 1.2, racecraft: 1.05, quali: 1.1, tyre: 0.95, starts: 0.7, wet: 0.6 };
  let total = 0;
  let weight = 0;
  for (const [key, value] of Object.entries(ratings)) {
    const w = weights[key] ?? 1;
    total += value * w;
    weight += w;
  }
  return Math.round(total / weight);
}

export const F1_NUMBERS = F1_DRIVERS.map((d) => d.number);
