# Escudos de las escuderías

`f1/<id>.png` y `f2/<id>.png` son PNG con fondo transparente que se muestran en
las tablas (clasificación de pilotos, constructores y resultados), en el selector
de escudería de F1 y en el garaje.

## Logos oficiales

Descargados de Wikimedia Commons, recortados al contenido y con el fondo
transparente. Fuente de cada fichero:

| Fichero | Origen |
| --- | --- |
| `f1/mclaren.png` | [McLaren Speedmark](https://commons.wikimedia.org/wiki/File:McLaren_Speedmark.svg) |
| `f1/ferrari.png` | [Ferrari F430 EngineLogo Scudetto rosso noBG](https://commons.wikimedia.org/wiki/File:Ferrari_F430_EngineLogo_Scudetto_rosso_noBG.png) |
| `f1/mercedes.png` | [Mercedes AMG Petronas F1 Logo](https://commons.wikimedia.org/wiki/File:Mercedes_AMG_Petronas_F1_Logo.svg) |
| `f1/redbull.png` | [Logo of Red bull](https://commons.wikimedia.org/wiki/File:Logo_of_Red_bull.svg) |
| `f1/aston.png` | [Astonmartinlogo](https://commons.wikimedia.org/wiki/File:Astonmartinlogo.png) |
| `f1/alpine.png` | [Alpine F1 Team Logo](https://commons.wikimedia.org/wiki/File:Alpine_F1_Team_Logo.svg) |
| `f1/williams.png` | [Atlassian Williams F1 Team logo](https://commons.wikimedia.org/wiki/File:Atlassian_Williams_F1_Team_logo.svg) |
| `f1/haas.png` | [MoneyGram Haas F1 Team Logo](https://commons.wikimedia.org/wiki/File:MoneyGram_Haas_F1_Team_Logo.svg) |
| `f1/audi.png` | [Audi-Logo 2016](https://commons.wikimedia.org/wiki/File:Audi-Logo_2016.svg) |
| `f1/cadillac.png` | [Cadillac Logo 2021](https://commons.wikimedia.org/wiki/File:Cadillac_Logo_2021.svg) |
| `f2/mp.png` | [MP Motorsport logo](https://commons.wikimedia.org/wiki/File:MP_Motorsport_logo.svg) |
| `f2/rodin.png` | [Rodin Motorsport logo](https://commons.wikimedia.org/wiki/File:Rodin_Motorsport_logo.svg) |
| `f2/aix.png` | [AIXRacingLogo](https://commons.wikimedia.org/wiki/File:AIXRacingLogo.png) |
| `f2/var.png` | [VAR logo](https://commons.wikimedia.org/wiki/File:VAR_logo.png) |

Los ficheros de Commons conservan su licencia original; consúltala en la página
de cada imagen antes de reutilizar el juego.

## Escudos generados

No hay logo oficial publicado en Commons para `f1/racingbulls`, ni para
`f2/invicta`, `f2/hitech`, `f2/campos`, `f2/dams`, `f2/prema`, `f2/art` y
`f2/trident`. Esos ocho escudos los dibuja el propio juego con los colores de
cada escudería y su código de tres letras:

```
node tools/make-team-logos.mjs
```

Juego de fans, no oficial. Sin relación con Formula One, la FIA ni los equipos
citados.
