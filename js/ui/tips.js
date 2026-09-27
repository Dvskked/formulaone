// Consejos que se muestran durante la carga.

export const TIPS = [
  'El DRS solo se abre en las zonas marcadas del circuito: busca el tramo verde antes de la frenada.',
  'Frenar tarde da más tiempo total: la trazada ideal se calcula con el frenado al límite.',
  'Los neumáticos C5 blandos dan más agarre, pero se degradan antes que los C2 duros.',
  'El ERS se carga frenando y se descarga en las rectas. Úsalo para defenderse en la recta de meta.',
  'Si acumulas daño sin pasar por boxes, el coche se acabará parando.',
  'La clasificación decide la parrilla: un hueco en Q3 puede valer más que una décima por vuelta.',
  'El coche de seguridad neutraliza la carrera: mantén la distancia y no intentes ganar posiciones.',
  'Los sprints puntúan, pero suelen ser más caóticos que la carrera principal.',
  'Repetir la temporada mejora el coche y conserva tus estadísticas en F2.',
  'El ERS del motor se recupera en las zonas de frenada y se gasta en las rectas.',
  'Salir limpio en las cinco luces vale más que arrancar con agresividad y romper el tren de atrás.',
  'Los entrenamientos son opcionales, pero simularlos da datos para afinar la estrategia.',
  'Cambia de cámara con la tecla C cuando quieras ver el margen de pista.',
  'En el paddock, el correo del jefe de equipo marca los objetivos de la temporada.',
  'Guarda con Exportar: el archivo se puede recuperar en otro dispositivo.',
  'En móvil aparecen los mandos táctiles; también vale con un mando.',
];

export function randomTip() {
  return TIPS[Math.floor(Math.random() * TIPS.length)];
}
