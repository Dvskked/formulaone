# FORMULA 1: PREDESTINATO

Juego web de Fórmula 1 y Fórmula 2 con **modo carrera de piloto**, al estilo de los juegos de fútbol: no pilotas un equipo entero, pilotas a un piloto. Empiezas en la Fórmula 2 de 2026 con un asiento real en la parrilla, una escudería, un jefe de equipo con objetivos y un buzón que se llena cada semana. Si terminas entre los tres primeros del campeonato, subes a Fórmula 1.

Todo funciona en el navegador con JavaScript puro, Canvas 2D y `localStorage`. Sin frameworks, sin cuentas, sin anuncios y sin instalaciones.

> Juego de fans, no oficial. Sin relación con Formula One, la FIA ni los equipos y pilotos citados.

## Cómo jugar

```bash
npm start          # sirve el proyecto en http://localhost:8080
```

También vale cualquier servidor estático:

```bash
python -m http.server 8080
```

Abre `http://localhost:8080` y pulsa **Nueva carrera**.

## Modo carrera

1. **Crea tu piloto**: nombre, fecha de nacimiento (entre 17 y 60 años en 2026), nacionalidad, casco, escudería y el asiento que sustituyes. El equipo y el rival salido se sortean con semilla, así que una misma semilla da siempre la misma distribución.
2. **Temporada de F2**: 14 citas. Cada fin de semana tiene Libres 1, Libres 2, Clasificación, Sprint y Carrera Principal.
3. **Puntúa** en carrera, sprint y vuelta rápida.
4. **Objetivos del jefe**: los recibes por correo al principio de cada ronda.
5. **Sube a F1** si terminas entre los tres primeros. En F1 son 23 grandes premios, con Sprint en China, Miami, Canadá, Gran Britain, Países Bajos y Singapur.
6. Si no llegas, **repite la temporada**: el coche mejora y conservas tus estadísticas en F2.

## Controles

| Acción | Teclado | Mando |
| --- | --- | --- |
| Acelerar | `W` / `↑` | Gatillo derecho |
| Frenar y marcha atrás | `S` / `↓` | Gatillo izquierdo |
| Dirección | `A` `D` / `←` `→` | Stick izquierdo |
| Freno de mano | `Espacio` | A |
| DRS | `E` | X |
| Entrar en boxes | `P` | B |
| Reincorporarse tras salirte | `R` | Y |
| Cambiar de cámara | `C` | Botón izquierdo |
| Pausa | `Esc` / `Tab` | Start |
| Simulación ×1 ×2 ×3 | `4` `5` `6` | — |

En móviles aparecen mandos táctiles en pantalla.

## Sistemas de carrera

- **Física de coches** con potencia, aerodinámica, agarre, frenos y fiabilidad por escudería.
- **Neumáticos** C5, C3 y C2 con degradación, temperatura y desgaste; verde de lluvia y azul de agua.
- **DRS** solo en las zonas marcadas de cada trazado.
- **ERS** que se carga frenando y se descarga en las rectas.
- **Daño** acumulado, Boxes, neumáticos y stint.
- **Carrera de seguridad** y banderas amarillas que reorganizan la carrera.
- **IA** con ofensa y defensa, ataque al DRS y errores por nivel de dificultad.
- **Salida de carrera** con cinco luces, reacción por piloto y penalización por salto de salida.

## Estructura

```
index.html            arranque, pantalla de carga y menú
css/styles.css        hoja de estilo completa
js/main.js            carga, menú y navegación
js/core/              utilidades: audio, entrada, azar con semilla, almacenamiento
js/data/              circuitos, calendario, pilotos, escuderías, países
js/game/              física, motor de carrera, clasificación, progreso de carrera
js/render/            renderizadores de canvas: pista, HUD, minimapa, fondo del menú
js/ui/                shell, contexto, componentes de DOM y pantallas
tests/                comprobaciones de datos, física, carrera, interfaz y texto
```

## Ajustes

Desde el menú: sonido y volúmenes, dificultad, ayudas de conducción (control de tracción, ABS, freno automático, DRS automático, asistencia de dirección y estabilidad), duración de carrera (corta, media, larga o completa), unidades, minimapa, cronometría y reducción de movimiento.

## Guardado

Tres huecos en `localStorage`, con autoguardado tras cada sesión, exportación e importación en JSON. Si el navegador bloquea el almacenamiento, el juego avisa y funciona solo en memoria.

## Pruebas

```bash
npm test             # todas las suites
npm run check        # solo sintaxis e imports
```

| Suite | Qué comprueba |
| --- | --- |
| `syntax.mjs` | Todos los módulos importan sin errores. |
| `circuits.check.mjs` | 24 trazados (23 de campeonato y Sakhir) con geometría válida. |
| `track-queries.mjs` | Consultas de trazada: sectores, DRS, boxes, proyección. |
| `data.check.mjs` | Calendario 2026 de F1 y F2, entradas y clasificaciones. |
| `physics.check.mjs` | Parámetros, neumáticos, DRS, ERS, IA y determinismo. |
| `career.check.mjs` | Perfil, sustitución, temporadas, promoción, buzón y guardado. |
| `race-engine.check.mjs` | Sesiones completas de FP, clasificación, sprint y carrera. |
| `ui.check.mjs` | Símbolos importados, rutas de pantallas y clases del CSS. |
| `text.mjs` | Codificación UTF-8 y texto sin caracteres corruptos. |

## Datos de referencia

- [Fórmula 1 — calendario 2026](https://www.formula1.com/en/racing/2026)
- [FIA Fórmula 2 — calendario 2026](https://www.fiaformula2.com/en/racing/2026)
- [F1 — calendario de Sprint 2026](https://www.formula1.com/en/latest/article/formula-1-and-fia-announce-2026-sprint-calendar.3PyLPAazrBNe8kQIS3wOfY)
