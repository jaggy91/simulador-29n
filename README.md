# Simulador 29-N

Simulador del reparto de escaños (Congreso y Senado) de las elecciones generales del 29 de noviembre de 2026. Proyecta las encuestas provincia a provincia, aplica los escenarios de candidaturas (retiradas, listas conjuntas, pacto PP–Vox al Senado, voto exterior) y calcula probabilidades con Monte Carlo. Se actualiza solo cada hora con GitHub Actions y se publica en GitHub Pages.

**Metodología auditable, validación y margen de error: [METODOLOGIA.md](METODOLOGIA.md)**, también legible en la propia web (sección «Metodología»).

Desarrollado con ayuda de inteligencia artificial (Claude, de Anthropic). Al entrar en la web hay que aceptar un aviso que explica el objetivo, el método y las fuentes.

## Uso

```sh
npm ci
npm run dev        # web en local (lee ./data)
npm test           # 64 tests: reproduce 2023, contraste con un análisis externo, el modelo 2026, el espectro, las fuentes y la veda
npm run polls      # encuestas: media (índice de Wikipedia), estimación oficial del CIS (PDF de cis.es) y reestimaciones del CIS
npm run simulate   # resultado con las fuentes activas + efecto de cada tarjeta → data/state.json, data/sources.json, data/history.json
npm run data       # regenera los datos base: 2023 del BOE, voto exterior de la JEC, escaños del BOE, censo del INE; europeas 2024 de Interior; andaluzas del BOJA; designados (Wikipedia, con los parlamentos estimados contrastados con su fuente oficial)
npm run backtest   # aplica el método a 2023 desde la base de 2019 → data/backtest-2023.json
npm run spectrum   # laboratorio izquierda ↔ derecha (9 niveles, −4…+4) → data/spectrum.json
npm run sensitivity # prueba de estrés y sensibilidad de cada supuesto → data/sensitivity.json
npm run build      # web estática en dist/
```

## Estructura

- `src/engine/` — motor (sin dependencias, Node y navegador): D'Hondt, Senado, remapeo 2023→2026, proyección, escenarios, Monte Carlo.
- `src/app/` — web (React + Vite); el modo "qué pasaría si" ejecuta el motor en un Web Worker.
- `scripts/` — descarga de datos, encuestas y simulación.
- `data/` — JSON versionados: el historial son los commits.
- `test/` — validación contra los resultados oficiales de 2023 y contraste del motor con un análisis externo.

## Fuentes

Solo datos reales: cada estado, probabilidad y parámetro sale de una tarjeta con su fuente original, y lo que no tiene dato publicado se declara como supuesto.

Oficiales: BOE (resultados de 2019 y 2023 de la Junta Electoral Central; Real Decreto 806/2026, escaños), Junta Electoral Central (voto exterior de 2023), CIS (estimación oficial del último barómetro) e INE (censo de residentes en el extranjero). Ministerio del Interior (europeas 2024), Junta Electoral de Andalucía (andaluzas 2026). Wikipedia para los designados ya nombrados y como índice de encuestas, con verificación automática en la publicación original (cada una enlaza a su publicación). Prensa enlazada en cada tarjeta de fuente.

Es un modelo, no una predicción. El voto exterior extra es solo una hipótesis para "qué pasaría si".

## Licencia

El código está bajo licencia [MIT](LICENSE). Los datos oficiales que se incluyen (BOE, Junta Electoral Central, INE, CIS) siguen sujetos a las condiciones de sus fuentes.
