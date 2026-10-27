# Simulador 29-N

Simulador del reparto de escaños (Congreso y Senado) de las elecciones generales del 29 de noviembre de 2026. Proyecta las encuestas provincia a provincia, aplica los escenarios de candidaturas (retiradas, listas conjuntas, pacto PP–Vox al Senado, voto exterior) y calcula probabilidades con Monte Carlo. Se actualiza solo cada hora con GitHub Actions y se publica en GitHub Pages.

Plan y estado: [plan-v2.md](plan-v2.md). **Metodología auditable, validación y margen de error: [METODOLOGIA.md](METODOLOGIA.md).**

## Uso

```sh
npm ci
npm run dev        # web en local (lee ./data)
npm test           # 44 tests: reproduce 2023, las simulaciones del vídeo, el modelo 2026, el espectro y las fuentes
npm run polls      # descarga y promedia encuestas (Wikipedia)
npm run simulate   # resultado con las fuentes activas + efecto de cada tarjeta → data/state.json, data/sources.json, data/history.json
npm run data       # regenera los datos base (2023, europeas, andaluzas, BOE, designados, INE)
npm run backtest   # aplica el método a 2023 desde la base de 2019 → data/backtest-2023.json
npm run spectrum   # laboratorio izquierda ↔ derecha (11 niveles) → data/spectrum.json
npm run build      # web estática en dist/
```

## Estructura

- `src/engine/` — motor (sin dependencias, Node y navegador): D'Hondt, Senado, remapeo 2023→2026, proyección, escenarios, Monte Carlo.
- `src/app/` — web (React + Vite); el modo "qué pasaría si" ejecuta el motor en un Web Worker.
- `scripts/` — descarga de datos, encuestas y simulación.
- `data/` — JSON versionados: el historial son los commits.
- `test/` — validación contra 2023 y contra las cifras del vídeo.

## Fuentes

Wikipedia (resultados 2023, europeas 2024, andaluzas 2026, encuestas), BOE (Real Decreto 806/2026: escaños), INE (censo electoral de residentes en el extranjero) y prensa enlazada en cada escenario.

Es un modelo, no una predicción. El voto exterior extra es solo una hipótesis para "qué pasaría si".
