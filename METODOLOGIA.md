# Simulador 29-N · Metodología

> **Para qué sirve este documento:** auditar el modelo paso a paso. Cada cifra que publica la web se puede reproducir con los comandos de la §9.
> **Corte de datos:** 27-oct-2026, 18:24 UTC.
> - Última encuesta: trabajo de campo hasta el **25-oct-2026**.
> - Escenarios: actualizados tras el cierre de candidaturas del 26-oct.
> - Las cifras de §0 y §6 son de ese corte; las vigentes están siempre en `data/state.json`.
>
> **Solo datos reales.** El modelo nació contrastándose con un análisis en vídeo de referencia. Desde el 27-oct ninguna entrada sale de él: cada estado, probabilidad y parámetro procede de una tarjeta con su fuente original (BOE, Junta Electoral Central, INE, CIS o prensa enlazada). Los parámetros sin dato publicado se declaran como **supuestos** (§7), con su efecto medido. Las cifras de aquel análisis solo se conservan como contraste del motor (§5.2) y no alimentan nada.

---

## 0. Respuestas directas

**¿Está actualizado?**
- Sí, a fecha del corte:
  - Las 14 encuestas más recientes de cada empresa.
  - La estimación oficial del último barómetro del CIS (estudio 3582), leída del PDF de cis.es.
  - Los escaños oficiales de 2026 (BOE).
  - El pacto PP–Vox del Senado (26-oct), con el seguimiento medido por la encuesta de Data 10 (21-oct).
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
| Media de encuestas | 200 | 197,9 | **179–218** | **97,2 %** |
| CIS · estimación oficial | 150 | 150,1 | **127–172** | **2,5 %** |
| CIS · reestimaciones independientes | 186 | 181,0 | **160–201** | **67,7 %** |

Las tres fuentes no coinciden. La estimación oficial del CIS da al PSOE 34 % y al PP 22,3 %, 12 puntos de diferencia que ninguna empresa privada recoge; las reestimaciones independientes de los mismos datos brutos dejan PP y PSOE empatados. Por eso se muestran por separado y no se promedian.

**Prueba de estrés:** si hoy se repitiera el fallo de la media de encuestas de 2023 a 33 días:
- Media de encuestas: la derecha bajaría a **190** y conservaría la mayoría.
- CIS reestimado: bajaría a **170**, sin mayoría, y la investidura sin Junts subiría a 172. Junts volvería a decidir.
- CIS oficial: el fallo de 2023 se midió sobre las empresas privadas; aplicarlo a la estimación del CIS es solo ilustrativo (derecha 150 → 136).

---

## 1. Qué hace el modelo, en una línea

> votos 2023 por provincia → oferta de partidos 2026 → escalado hasta la encuesta nacional (IPF) → escenarios de candidaturas → D'Hondt (Congreso) y voto limitado (Senado) → 5.000 simulaciones con error de encuesta.

Es un modelo de **traslación votos → escaños**, no un modelo de comportamiento electoral. No predice el voto: lo toma de las encuestas.

---

## 2. Fuentes de datos

| Archivo | Contenido | Fuente | Script | Comprobación automática |
|---|---|---|---|---|
| `data/congreso-2023.json` | Votos de cada candidatura por provincia, blancos, válidos y electos (52 circ.) | **BOE-A-2023-18907** (Junta Electoral Central, escrutinio general): tablas HTML de los Cuadros II y III y Cuadro I del PDF | `build-oficial-2023.js` | En cada provincia, suma de candidaturas = Cuadro I; candidaturas + blanco = válidos; escaños = total. Idéntico voto a voto a la versión anterior (Wikipedia) |
| `data/senado-2023.json` | Votos de cada candidato y electos (59 circ.) | **BOE-A-2023-18907** (relación de candidatos electos y no electos, PDF), con la corrección **BOE-A-2023-19537** | `build-oficial-2023.js` | En cada circunscripción, electos = escaños; 208 en total; PP 120 |
| `data/cera-voto-2023.json` | Voto de los residentes en el extranjero en 2023, por provincia y partido | **Junta Electoral Central** (resolución de 24-oct-2023, PDF de resultados por provincias) | `build-cera-voto-2023.js` | Se anotan en el propio archivo los descuadres del PDF oficial |
| `data/europeas-2024.json` | % por provincia (1 decimal) | en.wikipedia, "Results of the 2024 European Parliament election in Spain" | `build-europeas.js` | 52 provincias, sin celdas vacías |
| `data/andaluzas-2026.json` | % por provincia, autonómicas del 17-may-2026 | en.wikipedia | `build-andaluzas.js` | 8 provincias |
| `data/seats-2026.json` | Diputados por provincia | **BOE-A-2026-20742** (RD 806/2026), anexo | `build-seats.js` | 52 circ., 350. Cambios frente a 2023: Madrid 37→38, Cádiz 9→8 |
| `data/senado-designados.json` | Senadores designados por comunidad | Tabla "Senate of Spain" (en.wikipedia) + resultados autonómicos | `build-designados.js` | Suma 58 |
| `data/cera.json` | Electores CERA por provincia y por país, 2023 y 2026 | **INE**, Oficina del Censo Electoral, tablas 3 y 8 | `build-cera.js` | Los países suman el total de cada provincia. 2.325.310 → 2.769.645 |
| `data/polls.json` | Encuestas 2026 y las tres fuentes de intención de voto (§4.1), cada encuesta con su enlace original | Índice: en.wikipedia, "Opinion polling for the 2026 Spanish general election". Estimación oficial: **PDF del CIS** (cis.es, estudio 3582) | `fetch-polls.js`, `lib/cis.js` | El PDF del CIS se lee por columnas; PP incluye UPN |
| `data/scenarios.json` | Catálogo de mecanismos de escenario (sin estados). Los parámetros sin dato llevan su explicación en `assumptions`; los que tienen dato oficial, en `data` | — | manual | — |
| `data/news.json` | Tarjetas de noticias y datos oficiales, cada una con enlaces a sus fuentes originales y sus efectos | Prensa enlazada, BOE, Junta Electoral Central, INE | manual (F4: automática) | Tests: cada tarjeta con efecto tiene fuentes |
| `data/sources.json` | Todas las tarjetas (incluidas las encuestas) con su estado por defecto y su efecto | Generado | `simulate.js` | Cada tarjeta con efecto tiene su impacto |

**Incidencias detectadas en las fuentes**
- **Wikipedia, Cáceres 2023:** los votos válidos tienen +40.000 de errata.
  - Ya no se usa Wikipedia para 2023: el BOE da los válidos oficiales.
- **Wikipedia, Senado 2023:** mezclaba el escrutinio provisional con sumas aproximadas por partido; en 49 casos el voto de partido difería más de un 1 % del oficial.
  - Con los votos oficiales, T6 pasa de 82/114 a **exacto** (80/116).
- **Junta Electoral Central, voto exterior 2023 (PDF):**
  - La fila "PAÍS VASCO" incluye La Rioja y la fila "C. VALENCIANA" incluye Ceuta y Melilla.
  - El "TOTAL ESTATAL" no cuadra con la suma de provincias.
  - Albacete aparece con 862 electores y 860 votantes; el INE da 8.055 electores.
  - Solución: se usan las filas provinciales y los electores del INE, y cada descuadre queda anotado en `data/cera-voto-2023.json` → `notes`.
- **infoelectoral.interior.gob.es, senado.es y BOJA:** no responden desde la red local. Se descargarán desde GitHub Actions (paso 2).
- **Datos que siguen saliendo de Wikipedia:**
  - europeas 2024 y andaluzas 2026 (base territorial de Podemos, SALF y AA);
  - composición de los designados;
  - el índice de encuestas (cada encuesta enlaza a su publicación original).
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

**CIS · estimación oficial**
- La estimación de voto que publica el propio CIS para su último barómetro (hoy, estudio 3582). Se localiza el estudio en el índice de encuestas y se lee la tabla de estimación del PDF de cis.es por posición de columnas (`scripts/lib/cis.js`).
- "Sumar" en el PDF es la cifra conjunta de FA + FV: se reparte con la proporción media de las encuestas que los dan por separado. UPN se suma al PP.
- Los partidos que el CIS no estima (AA) se completan con la media de encuestas.

**CIS · reestimaciones independientes**
- Media de las reestimaciones de terceros sobre los datos brutos del mismo barómetro: hoy Opina 360 y Ateneo del Dato, con trabajo de campo del 1 al 6-oct.
- Los partidos que no dan esas reestimaciones se completan con la media de encuestas.

Las tres fuentes son tarjetas (§4.10): cada encuesta o estimación puede desactivarse y la fuente se recalcula sin ella.

**Entradas actuales** (% sobre voto válido)

| | PP+UPN | PSOE | Vox | FA | FV | Podemos | SALF | ERC | Junts | Bildu | PNV | BNG | CC | AA |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Media | 31,30 | 26,76 | 19,18 | 5,89 | 0,97 | 2,34 | 1,88 | 2,34 | 1,48 | 1,33 | 0,91 | 0,92 | 0,39 | 1,14 |
| CIS oficial | 22,30 | 34,00 | 17,10 | 5,23 | 0,87 | 3,10 | 1,80 | 3,00 | 1,10 | 1,60 | 0,60 | 0,90 | 0,20 | (media) |
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

El estado y la probabilidad de cada escenario los fija la tarjeta que manda (§4.10); los parámetros con dato, la tarjeta que los aporta.

| Escenario | Estado (27-oct) | Prob. | Según | Mecanismo y parámetros |
|---|---|---|---|---|
| Podemos separado | confirmado | 1 | El Español (12-oct), Cadena SER y La Vanguardia (16-oct), Infobae (17-oct) | Incluido en la reasignación (§3) |
| Senado de Progreso (PSOE + FA + FV) | confirmado | 1 | Infobae, Demócrata y CMM (17-oct) | Lista conjunta en todas las circunscripciones salvo Cataluña y Canarias (excepto La Gomera); las 3 que faltan para llegar a 47 quedan pendientes del BOE. **Seguimiento: 92 % de los votantes del PSOE y 95 % de los del socio** (Data 10) |
| Teruel sin FA/CHA | confirmado | 1 | Prensa del 26-oct | El FA no se presenta al Congreso en Teruel. Fracción de su voto que va al PSOE: **50 %, supuesto** (no hay dato); el resto se abstiene |
| FA se retira de provincias pequeñas | **descartado** | 0 | Prensa del 26-oct (listas en 51 de 52) | Supera al rumor del 20-oct (prob. 15 %). Solo como "qué pasaría si"; trasvase **50 %, supuesto** |
| **Pacto PP–Vox al Senado** | confirmado | 1 | Prensa del 26-oct | Ver detalle abajo. **Seguimiento: 94 % de los votantes del PP y 86 % de los de Vox** (Data 10) |
| Voto exterior extra | hipotético | 0 | Supremo (23-oct): voto suspendido | Solo como "qué pasaría si" (§4.7) |

**Seguimiento de las listas conjuntas.** Encuesta de Data 10 publicada por OKDiario el 21-oct y recogida por Libertad Digital (no se publica la muestra; tarjeta marcada "sin verificar"). Es el único dato publicado sobre cuántos votantes de cada partido apoyarían una lista conjunta al Senado. Si se desactiva, el seguimiento vuelve al 100 % mecánico.

**Detalle del pacto PP–Vox.** Se modela a nivel de candidato:
- **Vox se retira en 6 provincias** (Las Palmas, S. C. de Tenerife, Cádiz, Valencia, Castellón y Baleares): la lista del PP recibe el 94 % del voto del PP y el 86 % del de Vox.
- **El PP se retira en 3** (Gipuzkoa, Girona y Tarragona): la lista de Vox recibe el 86 % del voto de Vox y el 94 % del del PP.
- **Vox presenta un único candidato en 14 provincias:** el 86 % de sus votantes da sus otras 2 marcas a los dos primeros candidatos del PP.

**Descartado por falta de base real**
- *"Vox se retira casi en toda España"*: era una hipótesis de análisis; el pacto real del 26-oct la supera.
- *Una "decena larga" de provincias sin lista del FA*: ninguna fuente lo sostiene; el FA y Maíllo lo desmintieron el 21-oct.

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

El Supremo mantiene suspendido el voto de los 163.020 nacionalizados (23-oct), así que el escenario tiene probabilidad 0 y solo aparece en "qué pasaría si". No está en el espectro (§4.9): con datos reales no mueve ningún escaño.

**Realista** (modo por defecto, todo con datos oficiales)
- Votos de una provincia = `163.020 × (crecimiento del CERA en Latinoamérica 2023→2026 de la provincia / total) × fracción que puede votar × participación` (censo: INE).
- **Participación: 8,87 %**, la escrutada del voto exterior en 2023 (Junta Electoral Central). Da ≈ 14.460 votos.
- **Reparto por partido:** no hay encuestas de este electorado, así que se usa **cómo votó el exterior en 2023 en esa provincia** (Junta Electoral Central, pasado a la oferta de 2026): nacionalmente, PP 33 %, PSOE 29 %, Vox 11 %, FA 8 %, Podemos 5 %. En "qué pasaría si" se puede cambiar.

**Techo** (cota teórica, no un escenario)
- Los mismos votos, todos al PSOE y colocados de forma óptima: una mochila exacta que maximiza los escaños quitados a partidos de fuera del bloque de investidura.
- En el Monte Carlo se recoloca en cada iteración, es decir, con información perfecta. Ningún electorado real se reparte así.

**Resultado** (proyección central, derecha en el Congreso)

| Fuente | Sin voto extra | Realista | Techo |
|---|---|---|---|
| Media de encuestas | 200 | 200 | 196 |
| CIS oficial | 150 | 150 | 146 |
| CIS reestimado | 186 | 186 | 182 |

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

**Bloques** (según la votación de investidura del 16-nov-2023: 179 sí, 171 no)
- Derecha = PP + Vox + UPN (votaron no).
- Investidura sin Junts = PSOE + FA + FV + Podemos + ERC + Bildu + PNV + BNG + CC: los que votaron sí, con los herederos de Sumar.
- Junts, aparte: votó sí, pero es el socio que decide.
- "Otros": AA, SALF, CUP, NC, Existe…

**Proyección central y media del Monte Carlo**
- La proyección central es la del Congreso sin ruido (con el CIS reestimado: derecha 186).
- La media del Monte Carlo es algo menor (181,0). D'Hondt no es lineal: el ruido provincial reduce de media la prima del partido que lidera en provincias muy igualadas.
- **Para leer probabilidades y tendencias, la media o la mediana del Monte Carlo es más fiable que la central**, que salta a escalones (ver §4.9).

**Calibración**
- **`HISTORICAL_NOISE`** (por defecto): elegido con el backtest 2019→2023 (§5.3), es decir, con el error real de una elección.
- `VIDEO_NOISE` (σ_b 1,5 · σ_p 0,75 · σ_prov 0,06) se conserva solo como alternativa de sensibilidad: era la dispersión implícita en el análisis de referencia, y con ella el resultado real de 2023 quedaba en el borde del intervalo.

### 4.10 Fuentes como tarjetas

**Archivos:** `src/engine/evidence.js`, `data/news.json` y `data/sources.json`.

**Objetivo:** el resultado no es una predicción, sino lo que dicen las fuentes de hoy. Por eso todo lo que lo alimenta es una tarjeta con origen, enlace y efecto:
- **Noticias y datos oficiales** (`data/news.json`): modifican escenarios del catálogo (`data/scenarios.json`). Cada tarjeta enlaza a sus publicaciones originales. El catálogo solo define los mecanismos; sin fuentes, cada escenario queda en "sin datos" con probabilidad 0 y parámetros mecánicos (seguimiento del 100 %).
- **Encuestas**, en tres grupos (media, CIS oficial, CIS reestimado): cada una entra en su fuente con su peso. Desactivarla recalcula esa fuente.
- **Base del modelo y contexto** (BOE, Junta Electoral Central, INE, alianzas incluidas en la reasignación, votación de investidura de 2023): son fijos y no se pueden desactivar.

**Del estado de una noticia a una probabilidad** (convención fija, no un juicio caso a caso): rumor 15 % · negociación 50 % · confirmado 100 % · descartado 0 %.

**Resolución, campo a campo:** el estado (estado + probabilidad) y cada parámetro de un escenario se resuelven por separado. Así, una tarjeta que solo aporta un dato (el seguimiento de Data 10) no queda superada por otra que solo fija el estado (el pacto confirmado). Para cada campo, las tarjetas se aplican de menor a mayor prioridad y manda la última:
1. rango del tipo: oficial > noticia > análisis;
2. a igualdad de rango, la verificada sobre la sin verificar;
3. a igualdad, la más reciente.

**Por defecto:**
- Están activas todas las tarjetas con efecto, salvo las superadas en todos sus campos. Por ejemplo, el rumor del FA (20-oct) queda superado por la noticia de que el FA se presenta en 51 de 52 provincias (26-oct).
- Las superadas siguen visibles y se pueden reactivar. Si la que las supera sigue activa, no tienen efecto, y la web lo indica.
- En cada escenario, la web muestra qué tarjeta fija el estado ("Según"), cuál los parámetros ("Parámetros según"), los supuestos sin dato ("Supuesto") y los datos oficiales usados ("Dato").

**Efecto de cada tarjeta:** `scripts/simulate.js` compara el resultado con todas las tarjetas por defecto y el resultado cambiando solo esa (Monte Carlo de 1.000 iteraciones con la misma semilla en los dos cálculos). Se muestra el efecto sobre:
- los escaños medios de la derecha en el Congreso;
- la derecha del Senado (proyección central);
- P(mayoría).

Efectos a 27-oct, con la media de encuestas:
- Pacto PP–Vox: Senado +12.
- Senado de Progreso: Senado −2.
- Teruel sin FA: Congreso −0,1.
- Seguimiento de Data 10: Senado 0 con la media; **+5** con el CIS oficial y con el CIS reestimado. La lista de la izquierda pierde más apoyo (8 % del PSOE y 5 % del socio) que la del pacto.
- Cada encuesta: entre −0,7 y +0,7 escaños de la derecha.

**En la web:**
- Al cambiar tarjetas, el resultado se recalcula en el navegador con el mismo motor, y un aviso indica que no es el resultado por defecto.
- "Qué pasaría si" aplica sus ajustes **sobre** las fuentes activas.

**Captura automática (F4):** los titulares nuevos entrarán en `data/news.json` con `captured: 'auto'` y `verified: false`.
- Estarán activos por defecto y llevarán la etiqueta "sin verificar".
- Una fuente oficial o una noticia verificada posterior los supera.

### 4.9 Espectro izquierda ↔ derecha (laboratorio)

`src/engine/spectrum.js` y `scripts/spectrum.js`, que genera `data/spectrum.json`.
- **No forma parte de la proyección oficial:** no escribe `state.json` ni `history.json`.
- **En la web:** tiene pestaña propia (`#espectro`). El fondo se tiñe del color del bloque hacia el que se avanza, hasta un 30 % en el extremo. La posición se indica también con texto, así que el color no es la única pista.
- **Niveles:** 9, de −4 a +4. El nivel 0 es la proyección oficial.
- **Cómo se acumulan:** cada nivel hacia un lado añade un escenario favorable a ese bloque, del más plausible al menos plausible. Cuando un nivel intensifica uno anterior (marcado como "sustituye"), el anterior se descarta.
- **Retiradas de listas:** ya no son posibles tras el cierre de candidaturas. Se emulan con "voto útil": el partido sigue presentándose, pero una fracción de su voto pasa a otro.
- **Por qué no hay nivel 5:** más allá del fallo completo de las encuestas de 2023, que es un dato real, no queda ningún escenario con base real que mueva más el resultado. El voto de los nacionalizados, con su participación y su reparto reales, no mueve ningún escaño (§4.7), y el modo techo es una cota teórica, no un escenario. Los niveles de intensidad son hipótesis de laboratorio; se apoyan en datos reales cuando existen (el error de 2023, el seguimiento de Data 10).

| Nivel | A favor de la izquierda | A favor de la derecha |
|---|---|---|
| 1 | Encuestas: 40 % del fallo de 2023 (PSOE +2,1) | Encuestas: +2 pts de la investidura a PP + Vox |
| 2 | Voto útil: 30 % del FA → PSOE en las 29 provincias de ≤5 escaños | Voto útil: 30 % de Vox → PP en las 29 provincias de ≤5 escaños |
| 3 | Pacto PP–Vox del Senado al 60 % (por defecto: 94 % PP y 86 % Vox, Data 10) | Pacto al 100 % y SALF se hunde (50 % a Vox, 30 % al PP) |
| 4 | Fallo completo de las encuestas de 2023 (sustituye al nivel 1) | Desmovilización: FA, FV y Podemos −25 % |

**Cálculo por nivel**
- Proyección central más Monte Carlo de 2.000 iteraciones.
- **Modificaciones de la encuesta:** conservan la suma de la encuesta, de modo que la abstención sube a todos los partidos en proporción.
  - El "error de 2023" usa el vector real − encuesta del backtest a 33 días.
  - Lo que falta para cuadrar lo ceden el resto de partidos en proporción a su voto.

**Puntos de vuelco:** primer nivel, desde el centro, en que un resultado pasa a ser más probable que su contrario (P ≥ 50 % en el Monte Carlo).
- La derecha pierde la mayoría.
- Investidura + Junts suman 176.
- La investidura suma 176 sola.
- La derecha logra la mayoría.

Se usan probabilidades y no la proyección central porque, con D'Hondt, **la central salta a escalones**. Con el CIS reestimado, la central da 186 a la derecha y la media del Monte Carlo 181,0: varios escaños se ganan por muy pocos votos. Por eso, al trasladar 2 puntos (nivel +1), la central solo sube 1 escaño mientras P(mayoría) pasa del 67 % al 89 %.

**Resultado a 27-oct**
- **Media de encuestas:** ni en el nivel −4 pierde la derecha la mayoría (P = 78 %; central 190).
- **CIS oficial:** la derecha ya no tiene mayoría en el nivel 0 (P = 2,7 %) y la investidura suma 176 sola (P = 80 %). Ni en el nivel +4 la recupera (P = 23 %).
- **CIS reestimado:**
  - En el nivel −2, la derecha pierde la mayoría (P = 48 %).
  - En el nivel −4, la investidura + Junts suman 176 (P = 60 %); la investidura sola no llega (P = 45 %).

---

## 5. Validación

### 5.1 Reproducción exacta de 2023 (`npm test`, 45 tests en total)

T1, T5 y T6 se comparan con el resultado oficial. T2–T4, T7 y T8 reproducen simulaciones de un análisis externo sobre los votos oficiales de 2023: comprueban que el motor calcula igual que un cálculo independiente, pero no alimentan el modelo.

| # | Caso (votos de 2023) | Esperado (oficial o análisis externo) | Modelo |
|---|---|---|---|
| T1 | Congreso real | PP 137 · PSOE 121 · Vox 33 · Sumar 31… | **Exacto en las 52 provincias** |
| T2 | Sumar y Podemos separados (europeas) | extrema izquierda 17 · PSOE 129 · PP 142 · derecha 176 | **Exacto** |
| T3 | Sumar fuera de las 29 provincias de ≤5 escaños (100 %) | PSOE 131 · PP 132 · investidura 181 · derecha 162 | **Exacto** |
| T4 | Ídem con trasvase del 70 % | investidura 179 | **Exacto** |
| T5 | Senado real | PP 120 | Datos exactos. El modelo por partido falla en 4 carreras igualadas (<3,5 %) con voto cruzado 2+2: Badajoz, Cáceres, Huelva y Valencia |
| T6 | Senado PSOE+Sumar | PP 80 · izquierda 116 | **Exacto** (con los votos oficiales del BOE) |
| T7 | Senado con ambas listas conjuntas | derecha 126 · izquierda 75 | 124 · 76 (±2) |
| T8 | +14.000 votos al PSOE, colocación óptima | PSOE +7 · investidura 179 · derecha 166 | **Exacto** (con 12.256 votos) |

### 5.2 Contraste con un análisis externo (no es fuente)

Registro histórico, 26-oct: el modelo, ejecutado **con los supuestos de aquel análisis** (seguimiento del 85 %, trasvases del 70 %, 37.000 votos exteriores), reproducía sus cifras de 2026. Solo comprueba que el motor es coherente con un cálculo independiente. Esos supuestos ya no se usan: las cifras vigentes, con datos reales, están en §0 y §6.

| Caso | Análisis externo | Modelo (26-oct) |
|---|---|---|
| Media: derecha / investidura | ~205 / 140 | 200 / 140 |
| CIS: derecha | ~188 | 186 |
| CIS + FA fuera: PSOE | 124 | 124 |
| +37.000 votos exteriores (techo) | derecha −7/−8 | −7,5 |
| Tormenta perfecta (CIS) | derecha ~175 · investidura ~170 | 171 · 169 |

### 5.3 Backtest 2019 → 2023

`scripts/backtest-2023.js` → `data/backtest-2023.json`.

**Planteamiento:** el mismo método con base de **noviembre de 2019** (**BOE-A-2019-17344**, Junta Electoral Central, leído del PDF y comprobado contra el Cuadro I en las 52 provincias), los escaños de 2023 y la oferta de 2023. Reasignación:
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

| Partido | Media de encuestas | CIS oficial | CIS reestimado |
|---|---|---|---|
| PP | 129 [114–145] | 89 [74–104] | 117 [100–133] |
| PSOE | 107 [91–123] | 149 [131–169] | 117 [102–134] |
| Vox | 68 [56–80] | 61 [49–73] | 63 [51–74] |
| FA | 8 [4–13] | 7 [3–11] | 11 [6–17] |
| ERC | 9 [5–13] | 13 [8–17] | 9 [6–13] |
| EH Bildu | 7 [2–11] | 8 [5–13] | 7 [2–11] |
| Junts | 6 [2–9] | 4 [1–7] | 6 [2–9] |
| PNV | 4 [1–7] | 2 [0–5] | 4 [1–7] |
| **Derecha** | **198 [179–218] · P(≥176) 97,2 %** | **151 [127–172] · P(≥176) 2,5 %** | **181 [160–201] · P(≥176) 67,7 %** |
| Investidura sin Junts | 143 [123–161] | 187 [165–210] · P(≥176) 80,4 % | 158 [138–178] |
| P(Junts decisivo) | 0,8 % | 6,9 % | 9,0 % |

**Senado** (267 miembros)

| | Media de encuestas | CIS oficial | CIS reestimado |
|---|---|---|---|
| Derecha, central | 165 | 82 | 146 |
| Derecha, mediana [90 %] | 162 [139–172] | 86 [70–118] | 143 [108–164] |
| P(mayoría absoluta, ≥134) | 97,1 % | 0,8 % | 67,9 % |
| P(3/5, ≥161) | 55,5 % | 0 % | 10,8 % |

**Prueba de estrés** (proyección central con el error de la media de encuestas de 2023 a 33 días aplicado a hoy)

| Fuente | Derecha (Congreso) | Investidura | Senado, derecha |
|---|---|---|---|
| Media de encuestas | 200 → **190** | 142 → 155 | 165 → 155 |
| CIS reestimado | 186 → **170** | 152 → 172 | 146 → 118 |
| CIS oficial (ilustrativo) | 150 → 136 | 187 → 202 | 82 → 70 |

---

## 7. Supuestos y su sensibilidad

**Supuestos sin dato publicado.** Son los únicos parámetros que no salen de una fuente. Cada uno se declara en `scenarios.json` → `assumptions` (o en el código, si es de la reasignación) y la web lo muestra como "Supuesto". Efecto sobre la proyección central, derecha en el Congreso / en el Senado:

| Supuesto | Valor usado | Alternativa probada | Media de encuestas | CIS oficial | CIS reestimado | Cómo se verifica |
|---|---|---|---|---|---|---|
| Fracción del resto de Sumar 2023 que va a Compromís–FV | 0,85 | 0,5 / 1 | 200/165 → 200/165 / 199/165 | 150/82 → 150/85 / 150/82 | 186/146 → 185/152 / 186/146 | Resultados del 29-N |
| Voto del FA en Teruel que va al PSOE | 50 % (neutro) | 0 % / 100 % | 0 | 0 | 0 | — |
| Voto del FA que va al PSOE si se retirara de las pequeñas | 50 % (neutro) | ajustable | solo "qué pasaría si" | | | — |

**Parámetros con dato y su sensibilidad**

| Parámetro | Valor (fuente) | Alternativa | Media de encuestas | CIS oficial | CIS reestimado | Cómo se verifica |
|---|---|---|---|---|---|---|
| Seguimiento de las listas conjuntas | Data 10: PP 94 %, Vox 86 %; PSOE 92 %, socio 95 % | 100 % (sin la tarjeta) | Senado 165 → 165 | 82 → 77 | 146 → 141 | Resultados del 29-N |
| Circunscripciones de Senado de Progreso | Todas salvo Cataluña y Canarias (excepto La Gomera) (prensa del 17-oct) | las 60 | Senado 165 → 163 | 82 → 82 | 146 → 145 | **BOE, candidaturas proclamadas** |
| Ruido del Monte Carlo | histórico (backtest, §5.3) | estrecho (`VIDEO_NOISE`) | P(mayoría, 2.000 sim.) 97,2 % → 99,4 % | 2,7 % → 0,7 % | 67,2 % → 74,8 % | Backtest (§5.3) |

**Supuestos estructurales no cuantificados**
- **Swing proporcional uniforme:** cada partido varía lo mismo, en proporción, en todas las provincias. No capta dinámicas regionales propias (Cataluña, País Vasco, Galicia, Canarias) salvo por la base de 2023. Es la causa principal del error de +3 de §5.3 A.
- **Participación de 2023 constante** por provincia.
- **Semillas de SALF (europeas 2024) y AA (andaluzas 2026):** su reparto territorial puede diferir en unas generales.
- **Las tres fuentes de voto discrepan mucho:** entre la estimación oficial del CIS y la media de encuestas hay 50 escaños de diferencia en el bloque de derecha. Es la mayor incertidumbre del modelo, mayor que la del Monte Carlo de cada fuente.
- **"CIS reestimado":** se basa en dos reestimaciones de terceros de un barómetro con trabajo de campo de hace 3 semanas.
- **Índice de las encuestas:** Wikipedia, que es secundaria; cada encuesta enlaza a su publicación original. Se contrasta con el agregador de Demócrata. La estimación oficial del CIS se lee directamente de cis.es.
- **Seguimiento de Data 10:** una sola encuesta sin muestra publicada. Por eso su tarjeta va marcada "sin verificar" y se puede desactivar.
- **Senado con voto de partido:** no capta el voto personal cruzado; en 2023 falló en 4 provincias muy igualadas.
- **Formentera:** base estimada, 1 escaño.
- **Designados:** 4 de las 17 comunidades son estimación. Andalucía, con AA en 8 escaños, podría dar 1 designado a AA en lugar de al PP.
- **Probabilidades de los escenarios:** salen del estado que da la noticia más fuerte (rumor 15 %, negociación 50 %, confirmado 100 %, descartado 0 %). Es una convención, no una estimación. Hoy todos los escenarios activos están confirmados o descartados, así que no influye en el resultado por defecto.
- **Voto exterior realista:** el crecimiento del CERA latinoamericano se usa como aproximación del lugar de inscripción de los 163.020 afectados.

---

## 8. Qué no es este modelo

- **No es una predicción del voto.** Hereda el error de las encuestas, que en 2023 fue de varios puntos en un partido.
- **No modela campaña, debates, participación diferencial ni voto útil**, más allá de lo que recojan las encuestas.
- **No incluye el voto exterior extra en la proyección oficial** (probabilidad 0). Solo aparece en "qué pasaría si".
- **Veda electoral (LOREG art. 69.7):** del 24 al 28-nov no se pueden difundir sondeos en España. Falta decidir cómo se comporta la web esos días.

**Aviso inicial en la web** (`src/app/components/Notice.jsx`): antes de entrar, el visitante lee qué es el simulador, su objetivo, cómo se hizo y de qué fuentes sale, y lo acepta marcando una casilla. La aceptación se guarda solo en su navegador (`localStorage`, clave `aviso`). Si el texto cambia de forma sustancial, se sube su versión y se vuelve a pedir. Se puede releer desde el pie de página.

---

## 9. Reproducir y auditar

```sh
npm ci
npm run data          # regenera la base (BOE, Junta Electoral Central, INE y, para europeas, andaluzas y designados, Wikipedia)
npm test              # 45 tests: reproducción de 2023, escenarios, proyección, Monte Carlo, espectro, fuentes
npm run polls         # encuestas → data/polls.json
npm run simulate      # → data/state.json, data/history.json (semilla fija)
node scripts/backtest-2023.js --n 2000   # → data/backtest-2023.json
npm run spectrum      # espectro izquierda ↔ derecha → data/spectrum.json
```

**Lista de comprobación**

- [ ] **Base del Congreso:** `data/congreso-2023.json` suma 24.688.087 válidos y 350 electos con el reparto oficial (lo verifica T1).
- [ ] **Escaños de 2026:** coinciden con el anexo del BOE-A-2026-20742 (Madrid 38, Cádiz 8).
- [ ] **Senado 2023:** 208 electos y PP 120 (T5). **Senado 2026:** 60 circunscripciones y 209 electos (test).
- [ ] **Designados:** 58. Revisar a mano las 4 comunidades estimadas (§4.6).
- [ ] **Encuestas:** las 14 de la media, en `polls.json` → `sources.media.items`, coinciden con sus publicaciones originales (cada una lleva su enlace). Fechas y cifras.
- [ ] **CIS oficial:** `polls.json` → `sources.cisOficial.values` coincide con la tabla de estimación del PDF del estudio (enlace en `items[0].url`).
- [ ] **Tarjetas:** cada tarjeta con efecto de `data/news.json` enlaza a una publicación que dice lo que la tarjeta afirma (test: ninguna tarjeta con efecto sin fuentes).
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
| 27-oct | Fuentes como tarjetas: el estado de los escenarios lo fijan las tarjetas activas, no un valor manual | El resultado no es una predicción: debe verse de dónde sale cada efecto y poder quitarse |
| 27-oct | Resultados de 2023 (Congreso y Senado) y de 2019 (backtest) desde el BOE en lugar de Wikipedia; voto exterior 2023 de la Junta Electoral Central | Fuente oficial. Congreso idéntico; Senado con el escrutinio definitivo |
| 27-oct | Senado de Progreso sin Cataluña ni Canarias (salvo La Gomera); FA y Podemos juntos en Canarias | Infobae y Demócrata (17-oct). Sustituye al supuesto anterior de "las 47 provincias de 4 senadores" |
| 27-oct | **Solo datos reales:** ninguna entrada sale ya del análisis en vídeo de referencia. Estado, probabilidad y parámetros de cada escenario vienen de tarjetas con su fuente original; lo que no tiene dato se declara como supuesto | El análisis sirvió para validar el motor (§5.1–5.2); el modelo debe apoyarse en fuentes comprobables |
| 27-oct | Seguimiento de las listas conjuntas: Data 10 (PP 94 %, Vox 86 %; PSOE 92 %, socio 95 %) en lugar del 85 % supuesto | Único dato publicado. Resolución campo a campo para que no lo anule la tarjeta del pacto |
| 27-oct | Estimación oficial del CIS como tercera fuente, leída del PDF de cis.es | Sustituye el criterio anterior de elegir la variante del CIS que reproducía las cifras del análisis de referencia. Se muestran las tres fuentes por separado |
| 27-oct | Trasvases FA → PSOE (Teruel y retirada hipotética): del 70 % al 50 % neutro, declarado como supuesto | No hay dato publicado; entre 0 % y 100 % no cambia ningún escaño en Teruel |
| 27-oct | Voto exterior: participación (8,87 %) y reparto (exterior 2023) de la Junta Electoral Central. Sale del espectro, que pasa de 5 a 4 niveles | Con datos reales no mueve ningún escaño; el modo techo queda como cota teórica |
| 27-oct | Se eliminan "Vox se retira casi en toda España" y la "decena larga" de retiradas del FA | Sin base real: el pacto del 26-oct supera la primera; la segunda la desmintieron el FA y Maíllo (21-oct) |
| 27-oct | Bloques definidos por la votación de investidura del 16-nov-2023 | Dato oficial (179 sí, 171 no) en lugar de una definición tomada del análisis |
