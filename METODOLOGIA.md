# Simulador 29-N · Metodología

> **Para qué sirve este documento:** auditar el modelo paso a paso. Cada cifra que publica la web se puede reproducir con los comandos de la §9.
> **Corte de datos:** 27-oct-2026, 04:37 UTC.
> - Última encuesta: trabajo de campo hasta el **25-oct-2026**.
> - Escenarios: actualizados tras el cierre de candidaturas del 26-oct.

---

## 0. Respuestas directas

**¿Está actualizado?**
- Sí, a fecha del corte:
  - Las 14 encuestas más recientes de cada empresa.
  - Los escaños oficiales de 2026 (BOE).
  - El pacto PP–Vox del Senado (26-oct).
  - La permanencia del Frente Amplio en 51 de 52 provincias.
  - El censo exterior del INE para el 29-N.
- Contraste externo: el agregador de Demócrata (15 institutos) da PP 31,4 · PSOE 26,9 · Vox 18,8; nuestra media da 31,3 · 26,8 · 19,2.
- Pendiente:
  - La proclamación oficial de candidaturas en el BOE (≈2-nov). Fija dónde va Senado de Progreso y el detalle del pacto.
  - La actualización automática de noticias (fase F4).

**¿"Si las elecciones fueran hoy", saldría esto?**
- Saldría esto **si el voto de hoy coincidiera con la media de las encuestas**.
- El modelo traduce bien votos a escaños: con el resultado real de 2023 como entrada falla **+3 escaños** en el bloque de derecha.
- Lo que no controla es el error de las propias encuestas. En 2023, a 33 días de la votación, la media infravaloró al PSOE en 5,3 puntos, y la proyección de la derecha salió **+11 escaños** por encima de la real (§5.3).

**¿Qué margen de error hay?**

Con la incertidumbre por defecto, validada con el backtest de 2023, el intervalo del 90 % para PP + Vox + UPN es:

| Fuente | Central | Media MC | Intervalo 90 % | P(≥ 176) |
|---|---|---|---|---|
| Media de encuestas | 200 | 198,5 | **180–218** | **97,7 %** |
| CIS reestimado | 186 | 181,5 | **161–201** | **69,8 %** |

**Prueba de estrés:** si hoy se repitiera el fallo de las encuestas de 2023 a 33 días:
- Media de encuestas: la derecha bajaría a **188** y conservaría la mayoría.
- CIS reestimado: bajaría a **169**, sin mayoría, y la investidura sin Junts subiría a 175. Junts volvería a decidir.

---

## 1. Qué hace el modelo, en una línea

> votos 2023 por provincia → oferta de partidos 2026 → escalado hasta la encuesta nacional (IPF) → escenarios de candidaturas → D'Hondt (Congreso) y voto limitado (Senado) → 5.000 simulaciones con error de encuesta.

Es un modelo de **traslación votos → escaños**, no un modelo de comportamiento electoral. No predice el voto: lo toma de las encuestas.

---

## 2. Fuentes de datos

| Archivo | Contenido | Fuente | Script | Comprobación automática |
|---|---|---|---|---|
| `data/congreso-2023.json` | Votos por partido y provincia, blancos y electos (52 circ.) | en.wikipedia, artículos "<Provincia> (Congress of Deputies constituency)" | `build-base.js` | Totales nacionales = oficiales (24.688.087 válidos; PP 8.160.837…). Electos = 350 y reparto oficial |
| `data/senado-2023.json` | Votos por candidato o por partido y electos (59 circ.) | en.wikipedia, "<X> (Senate constituency)" | `build-senate.js` | 208 electos; PP 120 |
| `data/europeas-2024.json` | % por provincia (1 decimal) | en.wikipedia, "Results of the 2024 European Parliament election in Spain" | `build-europeas.js` | 52 provincias, sin celdas vacías |
| `data/andaluzas-2026.json` | % por provincia, autonómicas del 17-may-2026 | en.wikipedia | `build-andaluzas.js` | 8 provincias |
| `data/seats-2026.json` | Diputados por provincia | **BOE-A-2026-20742** (RD 806/2026), anexo | `build-seats.js` | 52 circ., 350. Cambios frente a 2023: Madrid 37→38, Cádiz 9→8 |
| `data/senado-designados.json` | Senadores designados por comunidad | Tabla "Senate of Spain" (en.wikipedia) + resultados autonómicos | `build-designados.js` | Suma 58 |
| `data/cera.json` | Electores CERA por provincia y por país, 2023 y 2026 | **INE**, Oficina del Censo Electoral, tablas 3 y 8 | `build-cera.js` | Los países suman el total de cada provincia. 2.325.310 → 2.769.645 |
| `data/polls.json` | Encuestas 2026 (168 filas) y medias | en.wikipedia, "Opinion polling for the 2026 Spanish general election" | `fetch-polls.js` | — |
| `data/scenarios.json` | Escenarios, estado, probabilidad, parámetros y fuentes | Transcripción de referencia + prensa (enlazada en cada escenario) | manual | — |

**Incidencias detectadas en las fuentes**
- **Wikipedia, Cáceres 2023:** los votos válidos tienen +40.000 de errata.
  - Los válidos se calculan siempre como candidaturas + blanco.
- **infoelectoral.interior.gob.es:** no responde desde la red local.
  - Los resultados se toman de Wikipedia y se verifican contra los totales oficiales.
- **Tabla de designados de Wikipedia:** desfasada en 4 comunidades (§4.6).

---

## 3. Oferta de partidos 2026 y reasignación del voto de 2023

`src/engine/remap.js`. Por provincia *p*:

1. **Sumar 2023 → FA / FV / Podemos.**
   - Parte Podemos: `pod = Sumar₂₀₂₃ × POD_eu / (SUM_eu + POD_eu)`, con los % de las europeas de 2024 en la provincia.
   - Resto: `rest = Sumar₂₀₂₃ − pod`.
   - Destino según la comunidad:

| Comunidad | Parte Podemos (`pod`) | Resto (`rest`) |
|---|---|---|
| Cataluña | ERC (Podemos apoya a ERC) | FA (Comuns) |
| C. Valenciana | FV (Compromís–Front Valencià = Compromís + Podemos) | FV recibe `0,85 × rest`; FA, el `0,15` restante |
| Resto de España | PODEMOS | FA |

   - `compromisShare = 0,85` es un supuesto. Con 0,5 o con 1, la derecha en el Congreso varía como mucho 1 escaño (§7).

2. **Partidos sin voto en 2023**
   - **SALF:** semilla = válidos × % de SALF en las europeas de 2024.
   - **Adelante Andalucía:** semilla = válidos × % de AA en las andaluzas de 2026, sustituyendo los 9.191 votos de Cádiz en 2023.
   - Las semillas solo fijan la **distribución territorial**; el nivel nacional lo pone la encuesta.

3. **PP + UPN** se tratan como un grupo, porque las encuestas los dan juntos. Ambos se escalan con el mismo factor.

4. **Partidos pequeños sin dato en la encuesta** (Existe, UPL, Soria ¡Ya!, NC, CUP…) y el voto en blanco forman el grupo "otros", que cubre el resto hasta el 100 %.

---

## 4. Cálculo

### 4.1 Encuestas

`scripts/lib/polls.js`, `fetch-polls.js`.

**Media de encuestas**
- Se toma la última encuesta de cada empresa con trabajo de campo en los 21 días anteriores a la encuesta más reciente.
- Se excluyen el CIS y las encuestas encargadas por partidos.
- Peso: `w = 0,5^(días/7) × √min(muestra, 3000)`; si la muestra no consta, se toma 1.000.
- **Cifras conjuntas** (FA+FV, o "Sumar" en encuestas anteriores): se reparten con la proporción media de las encuestas que dan ambos por separado.

**"CIS (datos brutos reestimados)"**
- Media de las reestimaciones independientes de los datos brutos del **último barómetro del CIS**: hoy Opina 360 y Ateneo del Dato, con trabajo de campo del 1 al 6-oct.
- Los partidos que no dan esas reestimaciones se completan con la media de encuestas.
- No es la estimación oficial del CIS ni su intención directa de voto. La intención directa pone al PSOE 10 puntos por delante y no reproduce las cifras del vídeo de referencia.

**Entradas actuales** (% sobre voto válido)

| | PP+UPN | PSOE | Vox | FA | FV | Podemos | SALF | ERC | Junts | Bildu | PNV | BNG | CC | AA |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Media | 31,30 | 26,76 | 19,18 | 5,89 | 0,97 | 2,34 | 1,88 | 2,34 | 1,48 | 1,33 | 0,91 | 0,92 | 0,39 | 1,14 |
| CIS reest. | 28,15 | 28,30 | 17,65 | 6,51 | 1,09 | 3,25 | 2,00 | (de la media) | | | | | | |

### 4.2 Proyección provincial (swing proporcional con IPF)

`src/engine/projection.js`. Notación:
- *v_ik*: votos base del partido *k* en la provincia *i*.
- *g(k)*: grupo de encuesta al que pertenece el partido.
- *t_g*: objetivo nacional del grupo, según la encuesta.
- *V_i*: votos válidos de 2023 en la provincia (la participación se mantiene constante).

Iteración:
1. `x_ik = v_ik · f_g(k)`; el blanco se escala con el factor de "otros".
2. `s_i = V_i / Σ_k x_ik`, y después `x_ik ← x_ik · s_i`. Cada provincia vuelve a sumar sus válidos.
3. `a_g` = cuota nacional obtenida del grupo, y `f_g ← f_g · t_g / a_g`.
4. Se repite hasta que `max |a_g − t_g| < 10⁻⁶`. Son 30 iteraciones como máximo en la proyección central y 10 en el Monte Carlo.

Resultado: las cuotas nacionales coinciden con la encuesta (test: error < 0,05 pp), y la estructura provincial de 2023 se conserva en términos relativos.

### 4.3 Congreso: D'Hondt

`src/engine/dhondt.js`. Por circunscripción, con los escaños de 2026:
- **Umbral:** 3 % de los votos válidos (candidaturas + blanco), según el art. 163 de la LOREG.
- **Asignación:** escaño a escaño al mayor cociente `v / (escaños + 1)`.
- **Empate de cocientes:** gana el partido con más votos.

### 4.4 Senado: voto limitado

`src/engine/senate.js`, `model.js`.

**Circunscripciones de 2026:** 60.
- 47 provincias: 4 escaños; cada elector marca hasta 3 candidatos.
- Gran Canaria, Mallorca y Tenerife: 3 escaños; hasta 2 marcas.
- Ceuta y Melilla: 2 escaños; hasta 2 marcas. Lo confirman los votos de 2023: el ganador se lleva los dos.
- Ibiza, **Formentera** (nueva en 2026), Menorca, Fuerteventura, Lanzarote, La Palma, La Gomera y El Hierro: 1 escaño cada una.
- Total: **209 electos**.

**Voto de partido en 2023:** media de sus candidatos (hasta el máximo de marcas). Si la fuente da la suma por partido, se divide entre el número de marcas.

**Reparto:** cada partido presenta tantos candidatos como marcas tiene el elector, todos con el mismo voto.
- Provincias: 3 + 1.
- Islas de 3 escaños: 2 + 1.
- Ceuta y Melilla: 2 + 0.

**Proyección de 2026**
- Cada partido se mueve en la circunscripción del Senado con el factor de su provincia en el Congreso: `cuota proyectada / cuota base`. Las islas usan su provincia.
- Los partidos sin voto al Senado en 2023 entran con su cuota proyectada en el Congreso.
- El Senado se calcula **antes** de las retiradas de listas al Congreso, que no le afectan.

**Formentera:** sin resultados propios en 2023, se le asigna el 7 % del voto de Pitiusas con el mismo reparto.

### 4.5 Escenarios

`data/scenarios.json`, `scenarios.js`, `model.js`.

| Escenario | Estado (27-oct) | Prob. | Mecanismo |
|---|---|---|---|
| Podemos separado | confirmado | 1 | Incluido en la reasignación (§3) |
| Senado de Progreso (PSOE + FA + FV) | confirmado | 1 | Lista conjunta, que suma votos. **Supuesto:** las 47 provincias de 4 senadores, hasta que lo confirme el BOE |
| Teruel sin FA/CHA | confirmado | 1 | El FA no se presenta en Teruel; el 70 % de su voto pasa al PSOE y el resto se abstiene |
| FA se retira de provincias pequeñas | **descartado** | 0 | Solo como "qué pasaría si": 15 o 29 provincias, trasvase ajustable |
| **Pacto PP–Vox al Senado** (26-oct) | confirmado | 1 | Ver detalle abajo |
| Vox se retira casi en toda España (hipótesis del vídeo) | superado | 0 | Solo como "qué pasaría si" |
| Voto exterior extra | hipotético | 0 | Solo como "qué pasaría si" (§4.7) |

**Detalle del pacto PP–Vox.** Se modela a nivel de candidato:
- **Vox se retira en 6 provincias** (Las Palmas, S. C. de Tenerife, Cádiz, Valencia, Castellón y Baleares): el PP recibe el 85 % del voto de Vox.
- **El PP se retira en 3** (Gipuzkoa, Girona y Tarragona): Vox recibe el 85 % del voto del PP.
- **Vox presenta un único candidato en 14 provincias:** sus votantes dan sus otras 2 marcas (85 %) a los dos primeros candidatos del PP.

### 4.6 Senadores designados (58)

- **13 comunidades:** reparto real vigente, según la tabla de Wikipedia.
- **4 comunidades con autonómicas posteriores a esa tabla:** estimación por D'Hondt sobre los escaños de su parlamento.
  - Extremadura (dic-25): PP 1, PSOE 1.
  - Aragón (feb-26): PP 1, PSOE 1.
  - Castilla y León (mar-26): PP 2, PSOE 1.
  - Andalucía (may-26): PP 5, PSOE 3, Vox 1.
- **Nota:** D'Hondt no reproduce todas las designaciones reales. Por ejemplo, el País Vasco designó PNV 1, Bildu 1 y PSE 1, cuando D'Hondt daría 2 al PNV. Por eso se usa el reparto real allí donde existe.
- **Total actual:** PP 26, PSOE 19, Vox 2, Junts 3 y otros 8. Derecha: 28.
- **Senado total:** 267 miembros. Mayoría absoluta: **134**. 3/5: **161**.

### 4.7 Voto exterior (Ley de Nietos)

Dos modos:

**Techo estratégico** (supuesto del vídeo)
- *N* votos extra al PSOE colocados de forma óptima.
- Es una mochila exacta: maximiza los escaños quitados a partidos de fuera del bloque de investidura.
- En el Monte Carlo se recoloca en cada iteración, es decir, con información perfecta. Es una **cota máxima**.

**Realista**
- Votos de una provincia = `163.020 × (crecimiento del CERA en Latinoamérica 2023→2026 de la provincia / total) × fracción que puede votar × participación`.
- El reparto por partido es un parámetro, porque **no hay encuestas de este electorado**.
- Participación de referencia: 10,04 % (todo el CERA en 2023).

**Resultado:**
- Los mismos 37.000 votos, todos al PSOE, repartidos según dónde creció el censo mueven **~0 escaños**.
- Colocados de forma óptima mueven ~7.

### 4.8 Monte Carlo

`src/engine/montecarlo.js`. 5.000 iteraciones, con la semilla fija 29112026 (reproducible). En cada iteración se aplican tres fuentes de ruido y se sortean los escenarios.

**Ruido**

| Componente | Fórmula | σ por defecto (`HISTORICAL_NOISE`) |
|---|---|---|
| Error común de bloque | `S ~ N(0, σ_b)` pp. Se suma a la derecha y se resta a la investidura, en proporción a la cuota de cada partido dentro de su bloque | σ_b = 2,0 |
| Error de partido | `ε_k ~ N(0, σ_p · √(t_k/10))` pp | σ_p = 1,0 (PP o PSOE: ≈ 1,7 pp) |
| Error provincial | multiplicador `exp(N(0, σ_prov))` por provincia y partido, antes del IPF | σ_prov = 0,08 |

**Escenarios:** cada uno se activa con probabilidad `prob`.

**Salidas**
- Media y percentiles 5/50/95 de escaños por bloque y por partido.
- `P(mayoría derecha) = P(PP + Vox + UPN ≥ 176)`.
- `P(Junts decisivo) = P(derecha < 176, investidura < 176 y investidura + Junts ≥ 176)`.
- Senado: P(derecha ≥ 134) y P(derecha ≥ 161), contando los designados.

**Bloques** (definición del vídeo)
- Derecha = PP + Vox + UPN.
- Investidura sin Junts = PSOE + FA + FV + Podemos + ERC + Bildu + PNV + BNG + CC.
- "Otros": AA, SALF, CUP, NC, Existe…

**Proyección central y media del Monte Carlo**
- La proyección central es la del Congreso sin ruido (con el CIS: derecha 186).
- La media del Monte Carlo es algo menor (181,5). D'Hondt no es lineal: el ruido provincial reduce de media la prima del partido que lidera en provincias muy igualadas.

**Calibración** (dos opciones)
- `VIDEO_NOISE` (σ_b 1,5 · σ_p 0,75 · σ_prov 0,06): reproduce la dispersión implícita en el vídeo y sus cifras del Senado (P(3/5) ≈ 6 % con la media y 0 % con el CIS).
- **`HISTORICAL_NOISE`** (por defecto desde el 27-oct): elegido con el backtest (§5.3). Es más honesto: con `VIDEO_NOISE`, el resultado real de 2023 quedaba en el borde del intervalo.

---

## 5. Validación

### 5.1 Reproducción exacta de 2023 (`npm test`, 28 tests)

| # | Caso (votos de 2023) | Esperado (oficial o vídeo) | Modelo |
|---|---|---|---|
| T1 | Congreso real | PP 137 · PSOE 121 · Vox 33 · Sumar 31… | **Exacto en las 52 provincias** |
| T2 | Sumar y Podemos separados (europeas) | extrema izquierda 17 · PSOE 129 · PP 142 · derecha 176 | **Exacto** |
| T3 | Sumar fuera de las 29 provincias de ≤5 escaños (100 %) | PSOE 131 · PP 132 · investidura 181 · derecha 162 | **Exacto** |
| T4 | Ídem con trasvase del 70 % | investidura 179 | **Exacto** |
| T5 | Senado real | PP 120 | Datos exactos. El modelo por partido falla en 4 carreras igualadas (<3,5 %) con voto cruzado 2+2: Badajoz, Cáceres, Huelva y Valencia |
| T6 | Senado PSOE+Sumar | PP 80 · izquierda 116 | 82 · 114 (±2) |
| T7 | Senado con ambas listas conjuntas | derecha 126 · izquierda 75 | 124 · 76 (±2) |
| T8 | +14.000 votos al PSOE, colocación óptima | PSOE +7 · investidura 179 · derecha 166 | **Exacto** (con 12.256 votos) |

### 5.2 Contraste con las cifras de 2026 del vídeo (proyección central)

| Caso | Vídeo | Modelo |
|---|---|---|
| Media: derecha / investidura | ~205 / 140 | 200 / 140 |
| CIS: derecha | ~188 | 186 |
| CIS + FA fuera: PSOE | 124 | 124 |
| +37.000 votos exteriores (techo) | derecha −7/−8 | −7,5 |
| Tormenta perfecta (CIS) | derecha ~175 · investidura ~170 | 171 · 169 |

### 5.3 Backtest 2019 → 2023

`scripts/backtest-2023.js` → `data/backtest-2023.json`.

**Planteamiento:** el mismo método con base de **noviembre de 2019**, los escaños de 2023 y la oferta de 2023. Reasignación:
- UP + Más País + Compromís → Sumar.
- Ciudadanos desaparece.
- NA+ → UPN.

**Resultados**

| Caso | Encuesta − real (pp) | Derecha central | Real | Error | Error medio por partido | 90 % (histórico) | P(≥176) | ¿Real dentro del 90 %? |
|---|---|---|---|---|---|---|---|---|
| **A** · Encuesta perfecta (error del modelo) | 0 | 174 | 171 | **+3** | 0,55 esc. | 150–190 | 37 % | sí |
| **B** · Media a 33 días (como hoy) | PSOE −5,3 · Vox +1,9 · Sumar +0,9 · PP +0,3 | 182 | 171 | **+11** | 3,6 esc. | 165–199 | 76 % | sí |
| **C** · Últimas encuestas publicables (17-jul) | PSOE −3,4 · PP +0,9 · Vox +0,9 · Sumar +1,0 | 180 | 171 | **+9** | 2,9 esc. | 160–198 | 65 % | sí |

**Lectura**
1. **El modelo traduce bien.** Con la encuesta perfecta, el error es de +3 escaños en el bloque y de 0,55 escaños de media por partido. Sesgo: el PP sale +1 y Sumar, Junts y ERC entre −1 y −2.
2. **El error dominante es el de las encuestas.** En 2023 sobrestimaron a la derecha en ≈2 pp y, sobre todo, infravaloraron al PSOE (−5,3 pp a 33 días).
3. **La cobertura es buena en el bloque y corta en los partidos de cola.**
   - Con `HISTORICAL_NOISE`, el resultado real de la derecha cae dentro del 90 % en los tres casos.
   - El PSOE real (121) quedó **fuera** del 90 % a 33 días (88–113) incluso con ruido histórico, y también con uno mayor (84–118).
   - Los intervalos por partido infravaloran las colas.
4. **Limitación del backtest:** es **una sola elección**, una muestra de 1. Sirve para detectar problemas groseros, no para calibrar con precisión.

---

## 6. Resultados actuales con su incertidumbre (27-oct)

**Congreso**, Monte Carlo (5.000 simulaciones, `HISTORICAL_NOISE`). Mediana [percentil 5–95]:

| Partido | Media de encuestas | CIS reestimado |
|---|---|---|
| PP | 129 [114–145] | 118 [101–133] |
| PSOE | 107 [91–122] | 118 [102–134] |
| Vox | 68 [56–80] | 64 [51–74] |
| FA | 7 [4–12] | 10 [6–16] |
| ERC | 9 [5–13] | 9 [6–13] |
| EH Bildu | 7 [2–11] | 7 [2–11] |
| Junts | 6 [2–9] | 6 [2–9] |
| PNV | 4 [1–7] | 4 [1–7] |
| **Derecha** | **198 [180–218] · P(≥176) 97,7 %** | **182 [161–201] · P(≥176) 69,8 %** |
| Investidura sin Junts | 142 [123–160] | 157 [138–178] |
| P(Junts decisivo) | 0,8 % | 7,9 % |

**Senado** (267 miembros)

| | Media de encuestas | CIS reestimado |
|---|---|---|
| Derecha, central | 163 | 139 |
| Derecha, mediana [90 %] | 157 [130–169] | 134 [97–159] |
| P(mayoría absoluta, ≥134) | 92,7 % | 51,1 % |
| P(3/5, ≥161) | 35,6 % | 4,0 % |

**Prueba de estrés** (proyección central con el error de las encuestas de 2023 a 33 días aplicado a hoy)

| Fuente | Derecha (Congreso) | Investidura | Senado, derecha |
|---|---|---|---|
| Media de encuestas | 200 → **188** | 142 → 156 | 163 → 144 |
| CIS reestimado | 186 → **169** | 152 → 175 | 139 → 105 |

---

## 7. Supuestos y su sensibilidad

Efecto sobre la proyección central (derecha en el Congreso / en el Senado):

| Supuesto | Valor usado | Alternativa probada | Media de encuestas | CIS reestimado | Cómo se verifica |
|---|---|---|---|---|---|
| Fracción de Compromís en FV | 0,85 | 0,5 / 1 | 0 / ±1 | ±1 / ±2 | Resultados del 29-N |
| Seguidores de la consigna del pacto PP–Vox | 85 % | 70 % / 100 % | 0 / 0 | Senado 136 / 141 | — |
| Circunscripciones de Senado de Progreso | 47 de 4 escaños | las 60 | Senado −1 | Senado −6 (133 < 134) | **BOE, candidaturas proclamadas** |
| Trasvase FA→PSOE en Teruel | 70 % | 100 % | 0 | 0 | — |
| Ruido del Monte Carlo | histórico | vídeo | P(mayoría) 97,7 % → 99,5 % | 69,8 % → 77 % | Backtest (§5.3) |

**Supuestos estructurales no cuantificados**
- **Swing proporcional uniforme:** cada partido varía lo mismo, en proporción, en todas las provincias. No capta dinámicas regionales propias (Cataluña, País Vasco, Galicia, Canarias) salvo por la base de 2023. Es la causa principal del error de +3 de §5.3 A.
- **Participación de 2023 constante** por provincia.
- **Semillas de SALF (europeas 2024) y AA (andaluzas 2026):** su reparto territorial puede diferir en unas generales.
- **"CIS reestimado":** se basa en dos reestimaciones de terceros de un barómetro con trabajo de campo de hace 3 semanas.
- **Fuente de las encuestas:** Wikipedia, que es secundaria. Se contrasta con el agregador de Demócrata.
- **Senado con voto de partido:** no capta el voto personal cruzado; en 2023 falló en 4 provincias muy igualadas.
- **Formentera:** base estimada, 1 escaño.
- **Designados:** 4 de las 17 comunidades son estimación. Andalucía, con AA en 8 escaños, podría dar 1 designado a AA en lugar de al PP.
- **Probabilidades de los escenarios:** se fijan a mano en `scenarios.json` hasta que entre el pipeline de noticias (F4).
- **Voto exterior realista:** el crecimiento del CERA latinoamericano se usa como aproximación del lugar de inscripción de los 163.020 afectados.

---

## 8. Qué no es este modelo

- **No es una predicción del voto.** Hereda el error de las encuestas, que en 2023 fue de varios puntos en un partido.
- **No modela campaña, debates, participación diferencial ni voto útil**, más allá de lo que recojan las encuestas.
- **No incluye el voto exterior extra en la proyección oficial** (probabilidad 0). Solo aparece en "qué pasaría si".
- **Veda electoral (LOREG art. 69.7):** del 24 al 28-nov no se pueden difundir sondeos en España. Falta decidir cómo se comporta la web esos días.

---

## 9. Reproducir y auditar

```sh
npm ci
npm run data          # regenera la base (Wikipedia, BOE, INE)
npm test              # 28 tests: reproducción de 2023, escenarios, proyección, Monte Carlo
npm run polls         # encuestas → data/polls.json
npm run simulate      # → data/state.json, data/history.json (semilla fija)
node scripts/backtest-2023.js --n 2000   # → data/backtest-2023.json
```

**Lista de comprobación**

- [ ] **Base del Congreso:** `data/congreso-2023.json` suma 24.688.087 válidos y 350 electos con el reparto oficial (lo verifica T1).
- [ ] **Escaños de 2026:** coinciden con el anexo del BOE-A-2026-20742 (Madrid 38, Cádiz 8).
- [ ] **Senado 2023:** 208 electos y PP 120 (T5). **Senado 2026:** 60 circunscripciones y 209 electos (test).
- [ ] **Designados:** 58. Revisar a mano las 4 comunidades estimadas (§4.6).
- [ ] **Encuestas:** las 14 de la media, en `polls.json` → `sources.media.polls`, coinciden con las filas de Wikipedia. Fechas y cifras.
- [ ] **Proyección:** las cuotas nacionales proyectadas reproducen la encuesta con error < 0,05 pp (test).
- [ ] **Escenarios:** cada uno con estado y fuente. Contrastar el pacto PP–Vox y las listas del FA con el **BOE de candidaturas proclamadas**.
- [ ] **Monte Carlo:** reproducible con la semilla. El test de reproducibilidad compara dos ejecuciones.
- [ ] **Backtest:** con el resultado real de 2023 como entrada, la derecha sale a +3 (§5.3 A).
- [ ] **D'Hondt a mano en una provincia:** por ejemplo Teruel, 3 escaños, con `state.json` → `results.media.central.byProvince['44']`.

**Código**

| Archivo | Contenido |
|---|---|
| `src/engine/dhondt.js` | D'Hondt y votos para el siguiente escaño |
| `src/engine/senate.js` | Senado por partido y por candidato |
| `src/engine/remap.js` | Reasignación 2023→2026 |
| `src/engine/projection.js` | IPF |
| `src/engine/scenarios.js` | Retiradas, votos extra, optimizador, escaños en el aire |
| `src/engine/model.js` | Composición del modelo, Senado 2026, pacto, voto exterior realista |
| `src/engine/montecarlo.js` | Ruido y simulación |

---

## 10. Registro de decisiones

| Fecha | Decisión | Motivo |
|---|---|---|
| 26-oct | Escaños 2026 del BOE en lugar de los de 2023 | RD 806/2026: Madrid +1, Cádiz −1 |
| 26-oct | Ceuta y Melilla: 2 marcas por elector en el Senado | Lo confirman los votos de 2023 (PP 2 en ambas) |
| 27-oct | "CIS bruto" = reestimaciones de terceros | La intención directa no reproduce las cifras del vídeo |
| 27-oct | Formentera como circunscripción propia; Senado de 267 | BOE y Wikipedia ("Constituencies established in 2026") |
| 27-oct | FA fuera de provincias pequeñas → descartado; pacto PP–Vox → confirmado | Cierre de candidaturas del 26-oct (prensa enlazada en `scenarios.json`) |
| 27-oct | Ruido por defecto: `HISTORICAL_NOISE` en lugar de `VIDEO_NOISE` | Backtest 2019→2023: la calibración del vídeo era demasiado estrecha |
