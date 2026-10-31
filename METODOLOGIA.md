# Simulador 29-N · Metodología

> **Para qué sirve este documento:** auditar el modelo paso a paso. Cada cifra que publica la web se puede reproducir con los comandos de la §9.
> **Corte de datos:** 27-oct-2026 (encuestas y escenarios). **Modelo:** revisado el 28-oct tras una auditoría (§10); las cifras se recalcularon con los mismos datos.
> - Última encuesta: trabajo de campo hasta el **25-oct-2026**.
> - Escenarios: actualizados tras el cierre de candidaturas del 26-oct.
> - Las cifras de §0, §6 y §7 son de ese corte; las vigentes están siempre en `data/state.json` y `data/sensitivity.json`.
>
> **Solo datos reales.** El modelo nació contrastándose con un análisis en vídeo de referencia. Desde el 27-oct ninguna entrada sale de él: cada estado, probabilidad y parámetro procede de una tarjeta con su fuente original (BOE, Junta Electoral Central, INE, CIS o prensa enlazada). Los parámetros sin dato publicado se declaran como **supuestos** (§7), con su efecto medido. Las cifras de aquel análisis solo se conservan como contraste del motor (§5.2) y no alimentan nada.

---

## 0. Respuestas directas

<!-- veda -->

**¿Está actualizado?**
- Sí, a fecha del corte:
  - La encuesta más reciente de cada una de 14 empresas (con el peso por recencia, las 6 últimas suman el 81 %).
  - La estimación oficial del último barómetro del CIS (estudio 3582), leída del PDF de cis.es.
  - Los escaños oficiales de 2026 (BOE).
  - El pacto PP–Vox del Senado (26-oct), con el seguimiento medido por la encuesta de Data 10 (21-oct).
  - La permanencia del Frente Amplio en 51 de 52 provincias.
  - El censo exterior del INE para el 29-N.
- Contraste externo: el agregador de Demócrata (15 institutos) da PP 31,4 · PSOE 26,9 · Vox 18,8; nuestra media da 31,3 · 26,8 · 19,2.
- Pendiente:
  - La proclamación oficial de candidaturas en el BOE (≈2-nov). Fija dónde va Senado de Progreso y el detalle del pacto. Se aplica sola cuando salga (§4.5).
  - La actualización automática de noticias (fase F4).

**¿"Si las elecciones fueran hoy", saldría esto?**
- Saldría esto **si el voto de hoy coincidiera con la media de las encuestas**.
- El modelo traduce bien votos a escaños: con la base provincial de 2019 y el resultado nacional real de 2023 como "encuesta perfecta", falla **+3 escaños** en el bloque de derecha (§5.3 A). Con los votos provinciales reales de 2023, reproduce el reparto exacto (T1).
- Lo que no controla es el error de las propias encuestas. En 2023, a 33 días de la votación, la media infravaloró al PSOE en 5,3 puntos, y la proyección de la derecha salió **+9 escaños** por encima de la real (§5.3).

**¿Qué margen de error hay?**

Con la incertidumbre por defecto (5.000 simulaciones), contrastada con una sola elección (backtest 2019→2023, §5.3: cubre a la derecha, pero no al PSOE a 33 días), el intervalo del 90 % para PP + Vox + UPN es:

| Fuente | Central | Media MC | Intervalo 90 % | P(≥ 176) | P(≥ 176) con CC |
|---|---|---|---|---|---|
| Media de encuestas | 200 | 199,0 | **180–218** | **98,0 %** | 98,2 % |
| CIS · estimación oficial | 155 | 154,2 | **131–175** | **4,6 %** | 5,0 % |
| CIS · reestimaciones independientes | 187 | 182,9 | **163–202** | **74,0 %** | 76,5 % |

Las tres fuentes no coinciden. La estimación oficial del CIS da al PSOE 34 % y al PP 22,3 %, 12 puntos de diferencia que ninguna empresa privada recoge; las reestimaciones independientes de los mismos datos brutos dejan PP y PSOE empatados. Por eso se muestran por separado y no se promedian.

Coalición Canaria (1 escaño) votó en 2023 tanto a Feijóo (29-sep) como a Sánchez (16-nov). Cuenta en el bloque de investidura, y la última columna muestra la probabilidad si sumara con la derecha.

**Prueba de estrés:** si hoy se repitiera el fallo de la media de encuestas de 2023 a 33 días (`data/sensitivity.json` → `stress`):
- Media de encuestas: la derecha bajaría a **190** y conservaría la mayoría.
- CIS reestimado: bajaría a **171**, sin mayoría, y la investidura sin Junts subiría a 173: ninguna de las dos llegaría a 176 sola.
- CIS oficial: el fallo de 2023 se midió sobre las empresas privadas; aplicarlo a la estimación del CIS es solo ilustrativo (derecha 155 → 140).

<!-- /veda -->

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
| `data/europeas-2024.json` | % por provincia sobre válidos (2 decimales) | **Ministerio del Interior**, resultados oficiales (`07202406_TOTA.zip`, ficheros 03, 07 y 08) | `build-europeas.js`, `lib/interior.js` | En cada provincia, suma de candidaturas = total oficial. Coincide con la versión anterior (Wikipedia) con ±0,05 pp de redondeo |
| `data/andaluzas-2026.json` | % por provincia sobre válidos, autonómicas del 17-may-2026 | **Junta Electoral de Andalucía**, BOJA núm. 108 (8-jun-2026) y corrección del BOJA núm. 115 | `build-andaluzas.js` | Escaños por provincia = total; candidaturas + blanco = válidos. Coincide con la versión anterior (Wikipedia) con ±0,05 pp de redondeo |
| `data/seats-2026.json` | Diputados por provincia | **BOE-A-2026-20742** (RD 806/2026), anexo | `build-seats.js` | 52 circ., 350. Cambios frente a 2023: Madrid 37→38, Cádiz 9→8 |
| `data/senado-designados.json` | Senadores designados por comunidad | Tabla "Senate of Spain" (en.wikipedia) + resultados autonómicos. En las 4 comunidades estimadas, composición del parlamento contrastada con su fuente oficial (BOJA; webs de las Cortes de Aragón, las Cortes de Castilla y León y la Asamblea de Extremadura) | `build-designados.js` | Suma 58; falla si un parlamento estimado no cuadra con su fuente oficial |
| `data/cera.json` | Electores CERA por provincia y por país, 2023 y 2026 | **INE**, Oficina del Censo Electoral, tablas 3 y 8 | `build-cera.js` | Los países suman el total de cada provincia. 2.325.310 → 2.769.645 |
| `data/poll-checks.json` | Verificación de cada encuesta por otro canal (§4.1): estado, canal, cifras encontradas | Publicación original, gráficos, RSS | `fetch-polls.js`, `lib/verify-polls.js` | Test: cada tarjeta indica su índice y su comprobación |
| `data/polls.json` | Encuestas 2026 y las tres fuentes de intención de voto (§4.1), cada encuesta con su enlace original | Índice: en.wikipedia, "Opinion polling for the 2026 Spanish general election". Estimación oficial: **PDF del CIS** (cis.es, estudio 3582) | `fetch-polls.js`, `lib/cis.js` | El PDF del CIS se lee por columnas; PP incluye UPN |
| `data/scenarios.json` | Catálogo de mecanismos de escenario (sin estados). Los parámetros sin dato llevan su explicación en `assumptions`; los que tienen dato oficial, en `data` | — | manual | — |
| `data/news.json` | Tarjetas de noticias y datos oficiales, cada una con enlaces a sus fuentes originales y sus efectos | Prensa enlazada, BOE, Junta Electoral Central, INE | manual (F4: automática) | Tests: cada tarjeta con efecto tiene fuentes |
| `data/sources.json` | Todas las tarjetas (incluidas las encuestas) con su estado por defecto y su efecto | Generado | `simulate.js` | Cada tarjeta con efecto tiene su impacto |
| `data/sensitivity.json` | Prueba de estrés (§0, §6) y sensibilidad de cada supuesto y parámetro (§7) | Generado | `sensitivity.js` | — |

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
- **infoelectoral.interior.gob.es, senado.es y BOJA:** se descargarán desde GitHub Actions.
- **Datos que siguen saliendo de Wikipedia:**
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
| Canarias | FA (FA y Podemos concurren juntos al Congreso) | FA |
| Resto de España | PODEMOS | FA |

   - `compromisShare = 0,85` es un supuesto. Con 0,5 o con 1, la derecha varía como mucho 1 escaño en el Congreso y 3 en el Senado (§7).

2. **Partidos sin voto en 2023**
   - **SALF:** semilla = válidos × % de SALF en las europeas de 2024.
   - **Adelante Andalucía:** semilla = válidos × % de AA en las andaluzas de 2026, sustituyendo los 9.191 votos de Cádiz en 2023.
   - Las semillas solo fijan la **distribución territorial**; el nivel nacional lo pone la encuesta.

3. **PP + UPN** se tratan como un grupo, porque las encuestas los dan juntos. Ambos se escalan con el mismo factor.

4. **Partidos pequeños sin dato en la encuesta** (Existe, UPL, Soria ¡Ya!, NC, CUP, PACMA…: el 2,3 % en 2023) y el voto en blanco (0,8 %) cubren lo que la encuesta no asigna hasta el 100 % (§4.2).

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
- Media de las reestimaciones de terceros sobre los datos brutos del mismo barómetro (empresas y fechas, en sus tarjetas).
- Los partidos que no dan esas reestimaciones se completan con la media de encuestas.

Las tres fuentes son tarjetas (§4.10): cada encuesta o estimación puede desactivarse y la fuente se recalcula sin ella.

**De dónde sale cada cifra y cómo se verifica** (`scripts/lib/verify-polls.js`, `data/poll-checks.json`)
- **Índice:** la tabla de encuestas de Wikipedia. Cada tarjeta lo indica.
- **Verificación por otro canal:** en cada ejecución, el sistema intenta comprobar cada encuesta en un canal distinto del índice, por este orden:
  1. el texto de la publicación original enlazada;
  2. los datos que esa publicación incrusta para sus gráficos;
  3. los gráficos Datawrapper de esa publicación (su tabla de datos);
  4. el RSS del medio, si lo tiene.
- **Regla:** queda **verificada** si las cifras de PP, PSOE y Vox aparecen en ese canal y, en total, al menos el 70 % de las cifras de la encuesta (partidos con 1 % o más). Los decimales se aceptan con coma o punto; un entero tiene que ir con "%" para no confundirse con fechas o escaños. El PP vale como PP+UPN (como da el índice) o como PP solo, si se conoce la cifra de UPN.
- **Resultado:** la tarjeta muestra "verificada en <canal>" con su enlace o "sin verificar: cifra tomada del índice". La cifra que entra en el modelo es la misma en los dos casos; la marca solo dice si se pudo confirmar.
- **Solo canales abiertos:** si una web bloquea la lectura automática (403, `robots.txt`) no se insiste, y X no se usa. Una encuesta verificada no se vuelve a comprobar mientras no cambien sus cifras; las no verificadas se reintentan cada 24 horas.
- La estimación oficial del CIS se lee directamente de su PDF: está verificada por construcción.
- **Ediciones en Wikipedia** (`scripts/lib/poll-edits.js`, `data/poll-edits.json`): cada hora se compara el índice con la descarga anterior. Si cambian las cifras de una encuesta ya publicada, o desaparece, se registra con las ediciones de Wikipedia de ese intervalo (fecha, editor y comentario), la tarjeta lo indica durante 14 días y, si la encuesta entra en alguna fuente, se abre un aviso. Cada fila se identifica por empresa, fecha y orden, porque a veces hay dos estudios de la misma empresa el mismo día.

<!-- veda -->

**Entradas actuales** (% sobre voto válido)

| | PP+UPN | PSOE | Vox | FA | FV | Podemos | SALF | ERC | Junts | Bildu | PNV | BNG | CC | AA |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Media | 31,30 | 26,76 | 19,18 | 5,89 | 0,97 | 2,34 | 1,88 | 2,34 | 1,48 | 1,33 | 0,91 | 0,92 | 0,39 | 1,14 |
| CIS oficial | 22,30 | 34,00 | 17,10 | 5,23 | 0,87 | 3,10 | 1,80 | 3,00 | 1,10 | 1,60 | 0,60 | 0,90 | 0,20 | (media) |
| CIS reest. | 28,15 | 28,30 | 17,65 | 6,51 | 1,09 | 3,25 | 2,00 | (de la media) | | | | | | |

<!-- /veda -->

### 4.2 Proyección provincial (swing proporcional con IPF)

`src/engine/projection.js`. Notación:
- *v_ik*: votos base del partido *k* en la provincia *i*.
- *g(k)*: grupo de encuesta al que pertenece el partido.
- *t_g*: objetivo nacional del grupo, según la encuesta.
- *V_i*: votos válidos de 2023 en la provincia (la participación se mantiene constante).

**Lo no asignado** (`R = 100 − suma de la encuesta`) cubre dos grupos: los partidos sin dato en la encuesta ("otros", cuota base *O₀*) y el voto en blanco (*B₀*).
- Si `R ≥ O₀ + B₀`: "otros" se queda en su cuota de 2023 y el excedente va con el blanco a un grupo **sin escaño**. Sin dato, no se sabe a quién va ese voto (el CIS, por ejemplo, estima «otros partidos» sin repartirlos). Escalarlo todo junto, como hasta el 27-oct, lo concentraba en los regionalistas (CUP, UPL, NC, Soria ¡Ya!, Existe) y les daba escaños sin ningún dato (§7).
- Si `R < O₀ + B₀`: los dos grupos bajan en la misma proporción.
- Una clave de encuesta sin votos en la base (una columna sin mapear) no se puede alcanzar: su porcentaje pasa a lo no asignado, y los scripts lo avisan.

Iteración:
1. `x_ik = v_ik · f_g(k)`; el blanco se escala con su propio factor.
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
- Ceuta y Melilla: 2 escaños; hasta 2 marcas (LOREG, art. 166). Lo confirman los votos de 2023: el ganador se lleva los dos.
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

**Listas conjuntas, por candidato** (Senado de Progreso y pacto PP–Vox, §4.5). El voto al Senado es por candidato, así que la lista conjunta se reparte candidato a candidato:
- Una fracción de los votantes de cada partido apoya la lista (seguimiento, la encuesta de seguimiento de §4.5): vota a todos sus candidatos.
- Quien no la apoya vota solo a los candidatos de su propio partido dentro de la lista; si no tiene ninguno, se abstiene. Es un **supuesto** (§7); la alternativa, que se abstenga siempre, era la regla hasta el 27-oct.
- Con seguimiento del 100 %, equivale a sumar los votos de los partidos (test).
- Ganan los candidatos más votados; cada escaño cuenta para el partido del candidato.

**Formentera:** sin resultados propios en 2023, se le asigna el 7 % del voto de Pitiusas con el mismo reparto.

### 4.5 Escenarios

`data/scenarios.json`, `scenarios.js`, `model.js`.

El estado y la probabilidad de cada escenario los fija la tarjeta que manda (§4.10); los parámetros con dato, la tarjeta que los aporta.

| Escenario | Estado (27-oct) | Prob. | Según | Mecanismo y parámetros |
|---|---|---|---|---|
| Podemos separado | confirmado | 1 | El Español (12-oct), Cadena SER y La Vanguardia (16-oct), Infobae (17-oct) | Incluido en la reasignación (§3) |
| Senado de Progreso (PSOE + FA + FV) | confirmado | 1 | Infobae, Demócrata y CMM (17-oct) | Lista conjunta salvo en Cataluña y Canarias (excepto La Gomera): quedan 50 circunscripciones posibles. Las fuentes dicen 47 sin decir cuáles faltan: el modelo la aplica en las 50, así que **sobran 3 desconocidas** (supuesto, rango en §7; lo fija el BOE). Composición: 1 candidato del socio en las listas de 2 o 3 puestos, el resto del PSOE (**supuesto**). Seguimiento: la encuesta de seguimiento (abajo) |
| Teruel sin FA/CHA | confirmado | 1 | Prensa del 26-oct | El FA no se presenta al Congreso en Teruel. Fracción de su voto que va al PSOE: **50 %, supuesto** (no hay dato); el resto se abstiene. En el Senado sí concurre, dentro de Senado de Progreso |
| FA se retira de provincias pequeñas | **descartado** | 0 | Prensa del 26-oct (listas en 51 de 52) | Supera al rumor del 20-oct (prob. 15 %). Solo como "qué pasaría si"; trasvase **50 %, supuesto** |
| **Pacto PP–Vox al Senado** | confirmado | 1 | Prensa del 26-oct | Ver detalle abajo. Seguimiento: la encuesta de seguimiento (abajo) |
| Voto exterior extra | hipotético | 0 | Supremo (23-oct): voto suspendido | Solo como "qué pasaría si" (§4.7) |

**Seguimiento de las listas conjuntas.** Una encuesta publicada el 21-oct (no se publica la muestra; tarjeta marcada `sondeo` y "sin verificar"; empresa y medio en la tarjeta, que no se muestra durante la veda). Es el único dato publicado sobre cuántos votantes de cada partido apoyarían una lista conjunta al Senado. Si se desactiva, el seguimiento vuelve al 100 % mecánico. Qué hace quien no la apoya es un supuesto (§4.4, §7).

<!-- veda -->

Valores: apoyarían la lista conjunta el 94 % de los votantes del PP y el 86 % de los de Vox; el 92 % de los del PSOE y el 95 % de los de su socio.

<!-- /veda -->

**Circunscripciones de Senado de Progreso en el modelo (50).** Las 43 provinciales de 4 senadores fuera de Cataluña: Álava, Albacete, Alicante, Almería, Asturias, Ávila, Badajoz, Bizkaia, Burgos, Cáceres, Cádiz, Cantabria, Castellón, Ciudad Real, Córdoba, A Coruña, Cuenca, Gipuzkoa, Granada, Guadalajara, Huelva, Huesca, Jaén, León, Lugo, Madrid, Málaga, Murcia, Navarra, Ourense, Palencia, Pontevedra, La Rioja, Salamanca, Segovia, Sevilla, Soria, Teruel, Toledo, Valencia, Valladolid, Zamora y Zaragoza. Además, Ceuta y Melilla (2 senadores), Mallorca (3), Menorca, Ibiza, Formentera y La Gomera (1). Las fuentes hablan de 47: sobran 3 de estas, sin saber cuáles. En Baleares el acuerdo es con Més (prensa del 17-oct). En el resto de Canarias, el FA va con Podemos y fuera de la lista conjunta, y su voto no tiene seguimiento.

El seguimiento del socio solo se midió para el FA; el modelo lo aplica igual al FV en la C. Valenciana (**supuesto**, §7).

**Detalle del pacto PP–Vox.** Se modela a nivel de candidato (§4.4):
- **Vox se retira en 6 provincias** (Las Palmas, S. C. de Tenerife, Cádiz, Valencia, Castellón y Baleares).
  - En las islas, en todas: «Vox no se presentará en ninguna de las circunscripciones de las dos provincias canarias, ni de Baleares, cuyos senadores se eligen por cada una de las islas» (COPE, 26-oct). Son 14 circunscripciones; con los datos de hoy, las 11 insulares aportan 7 de los 16 escaños que gana la derecha con el pacto (media de encuestas).
  - La lista del PP lleva un independiente propuesto por Vox «en la segunda o tercera posición» (El Español). Solo cabe en las listas de 2 o más puestos: Cádiz, Valencia, Castellón, Mallorca, Gran Canaria y Tenerife, que son los «seis candidatos independientes» (The Objective). Su escaño cuenta para el PP.
- **El PP se retira en 3** (Gipuzkoa, Girona y Tarragona) y no pone independientes en las listas de Vox (El Español): los votantes del PP que no apoyan la lista de Vox no tienen candidato propio.
- **Vox presenta un único candidato en 14 provincias:** los votantes de Vox que siguen la consigna dan sus otras 2 marcas a los dos primeros candidatos del PP.

**Candidaturas proclamadas (BOE, automático).** `scripts/watch-boe.js` revisa cada hora el sumario del BOE (API de datos abiertos). Cuando aparecen las candidaturas proclamadas del Real Decreto 806/2026:
1. lee las listas al Senado de cada una de las 60 circunscripciones (`lib/proclamacion.js`);
2. comprueba que están todas, que ninguna lista lleva más candidatos que escaños y que los resultados son plausibles;
3. si todo cuadra, crea una tarjeta **oficial** con las circunscripciones reales de Senado de Progreso (las que tienen una lista con ese nombre) y del pacto: Vox sin lista y PP con ella → retirada de Vox; al revés → retirada del PP; Vox con un solo candidato → candidato único. Al ser oficial, supera a la prensa en esos parámetros (§4.10), y el supuesto de las "3 que sobran" deja de serlo.
4. Si algo no cuadra, no aplica nada, lo guarda en `data/candidaturas-2026.json` (`problems`) y el workflow abre un aviso.

Probado con la proclamación de 2023 (BOE-A-2023-15066): lee las 59 circunscripciones de entonces, y en 58 el número de listas coincide con los resultados oficiales. Con ese BOE se niega a aplicar, como debe, porque falta Formentera (no existía como circunscripción) y no hay Senado de Progreso. La composición de las listas conjuntas (cuántos candidatos de cada partido) no se puede leer del BOE con seguridad y sigue siendo un supuesto.

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

Con los datos reales, el modo realista no mueve ningún escaño; el techo es solo una cota.

**¿Es sólido ese cero?** (`data/sensitivity.json` → `exteriorScan`). Con el reparto del exterior de 2023, **ni con una participación del 100 %** (163.020 votos) se mueve un escaño, en ninguna fuente. Solo si votaran todos al PSOE (colocados según el censo, no de forma óptima) empezaría a moverse: −1 escaño para la derecha desde un 15–25 % de participación y hasta −4 con el 100 %. El Senado no se mueve en ningún caso. No se modela el crecimiento ordinario del censo exterior (+444.335 electores desde 2023), parte del cual son nacionalizados que ya pueden votar (§7).

<!-- veda -->

**Resultado** (proyección central, derecha en el Congreso)

| Fuente | Sin voto extra | Realista | Techo |
|---|---|---|---|
| Media de encuestas | 200 | 200 | 196 |
| CIS oficial | 155 | 155 | 149 |
| CIS reestimado | 187 | 187 | 183 |

<!-- /veda -->

### 4.8 Monte Carlo

`src/engine/montecarlo.js`. 5.000 iteraciones, con la semilla fija 29112026 (reproducible). En cada iteración se aplican tres fuentes de ruido y se sortean los escenarios.

**Ruido**

| Componente | Fórmula | σ por defecto (`HISTORICAL_NOISE`) |
|---|---|---|
| Error común de bloque | `S ~ N(0, σ_b)` pp. Se suma a la derecha y se resta a la investidura, en proporción a la cuota de cada partido dentro de su bloque | σ_b = 2,0 |
| Error de partido | `ε_k ~ N(0, σ_p · √(t_k/10))` pp | σ_p = 1,0 (PP o PSOE: ≈ 1,7 pp) |
| Error provincial | multiplicador `exp(N(0, σ_prov))` por provincia y partido, antes del IPF | σ_prov = 0,08 |

**La encuesta con ruido suma lo mismo que la original:** tras aplicar los errores, todos los partidos se reescalan en proporción para conservar la suma. Así lo que gana un partido lo pierden los demás. Hasta el 27-oct no se conservaba, y lo no asignado ("otros" y blanco) absorbía ±3 pp en cada simulación: con la media de encuestas daba 2,4 escaños por simulación a partidos sin dato en la encuesta. El backtest (§5.3) se repitió con esta regla y la calibración se mantiene.

El error provincial es independiente entre provincias: no hay un componente regional común (por ejemplo, todo Cataluña a la vez). Es una limitación declarada (§7).

**Escenarios:** cada uno se activa con probabilidad `prob`.

**Salidas**
- Media y percentiles 5/50/95 de escaños por bloque y por partido.
- `P(mayoría derecha) = P(PP + Vox + UPN ≥ 176)`.
- `P(mayoría derecha con CC) = P(PP + Vox + UPN + CC ≥ 176)`.
- `P(Junts decisivo) = P(derecha < 176, investidura < 176 y investidura + Junts ≥ 176)`.
- Senado: P(derecha ≥ 134) y P(derecha ≥ 161), contando los designados.
- No se modela la segunda votación de investidura (mayoría simple), en la que bastan las abstenciones.

**Bloques** (según la votación de investidura del 16-nov-2023: 179 sí, 171 no)
- Derecha = PP + Vox + UPN (votaron no).
- Investidura sin Junts = PSOE + FA + FV + Podemos + ERC + Bildu + PNV + BNG + CC: los que votaron sí, con los herederos de Sumar.
- Junts, aparte: votó sí, pero es el socio que decide.
- CC votó también a Feijóo el 29-sep-2023 (172 votos: PP, Vox, UPN y CC). Su escaño se cuenta en la investidura, y la probabilidad con CC sumando a la derecha se publica aparte.
- "Otros": AA, SALF, CUP, NC, Existe…

**Proyección central y media del Monte Carlo**
- La proyección central es la del Congreso sin ruido.
- La media del Monte Carlo puede quedar por debajo o por encima de la central; en alguna fuente la diferencia pasa de 4 escaños (§0). No viene del ruido provincial: sin él la media sale igual. Viene del ruido nacional sobre una función de escalones. D'Hondt no es lineal, y la central puede caer justo en un escalón alto, ganado por pocos votos en varias provincias.
- **Para leer probabilidades y tendencias, la media o la mediana del Monte Carlo es más fiable que la central**, que salta a escalones (ver §4.9).

**Calibración**
- **`HISTORICAL_NOISE`** (por defecto): elegido con el backtest 2019→2023 (§5.3), es decir, con el error real de una elección. Es una calibración dentro de la muestra (la misma elección que valida), con una sola elección.
- `VIDEO_NOISE` (σ_b 1,5 · σ_p 0,75 · σ_prov 0,06) se conserva solo como alternativa de sensibilidad: era la dispersión implícita en el análisis de referencia, y con ella el resultado real de 2023 quedaba en el borde del intervalo.

### 4.9 Espectro izquierda ↔ derecha (laboratorio)

`src/engine/spectrum.js` y `scripts/spectrum.js`, que genera `data/spectrum.json`.
- **No forma parte de la proyección oficial:** no escribe `state.json` ni `history.json`.
- **En la web:** tiene pestaña propia (`#espectro`). El fondo se tiñe del color del bloque hacia el que se avanza, hasta un 30 % en el extremo. La posición se indica también con texto, así que el color no es la única pista.
- **Niveles:** 9, de −4 a +4. El nivel 0 es la proyección oficial.
- **Cómo se acumulan:** cada nivel hacia un lado añade un escenario pensado a favor de ese bloque, del más plausible al menos plausible. Con D'Hondt, alguno puede no favorecerlo en todas las fuentes (ver el resultado, abajo). Cuando un nivel intensifica uno anterior (marcado como "sustituye"), el anterior se descarta.
- **Palancas condicionadas:** las del pacto PP–Vox (nivel 3) solo se aplican si el pacto está vigente en las fuentes; si no, se omiten y la web lo indica.
- **Pasos que no favorecen:** si en una fuente un paso perjudica al lado que dice favorecer (P(mayoría) se mueve al revés más de 1 punto), queda marcado (`contrary`) y la web lo avisa.
- Las palancas en sí y sus intensidades (30 % de voto útil, 60 % de seguimiento, 50/30 % de SALF, −25 % de desmovilización) siguen fijadas a mano en `src/engine/spectrum.js`: son hipótesis de laboratorio.
- **Retiradas de listas:** ya no son posibles tras el cierre de candidaturas. Se emulan con "voto útil": el partido sigue presentándose, pero una fracción de su voto pasa a otro.
- **Por qué no hay nivel 5:** más allá del fallo completo de las encuestas de 2023, que es un dato real, no queda ningún escenario con base real que mueva más el resultado. El voto de los nacionalizados, con su participación y su reparto reales, no mueve ningún escaño (§4.7), y el modo techo es una cota teórica, no un escenario. Los niveles de intensidad son hipótesis de laboratorio; se apoyan en datos reales cuando existen (el error de 2023, la encuesta de seguimiento).

| Nivel | A favor de la izquierda | A favor de la derecha |
|---|---|---|
| 1 | Encuestas: 40 % del fallo de 2023 (PSOE +2,1) | Encuestas: +2 pts de la investidura a PP + Vox |
| 2 | Voto útil: 30 % del FA → PSOE en las 29 provincias de ≤5 escaños | Voto útil: 30 % de Vox → PP en las 29 provincias de ≤5 escaños |
| 3 | Pacto PP–Vox del Senado con un seguimiento uniforme del 60 % para PP y Vox (en lugar del medido por la encuesta de seguimiento) | Pacto al 100 % y SALF se hunde (50 % a Vox, 30 % al PP) |
| 4 | Fallo completo de las encuestas de 2023 (sustituye al nivel 1) | Desmovilización: FA, FV y Podemos −25 % |

**Cálculo por nivel**
- Proyección central más Monte Carlo de 2.000 iteraciones: por eso sus probabilidades difieren en unas décimas de las de §0 y §6, que usan 5.000.
- **Modificaciones de la encuesta:** conservan la suma de la encuesta, de modo que la abstención sube a todos los partidos en proporción.
  - El "error de 2023" usa el vector real − encuesta del backtest a 33 días.
  - Lo que falta para cuadrar lo ceden el resto de partidos en proporción a su voto.

**Puntos de vuelco:** primer nivel, desde el centro, en que un resultado pasa a ser más probable que su contrario (P ≥ 50 % en el Monte Carlo).
- La derecha pierde la mayoría.
- Investidura + Junts suman 176.
- La investidura suma 176 sola.
- La derecha logra la mayoría.

Se usan probabilidades y no la proyección central porque, con D'Hondt, **la central salta a escalones**: varios escaños se ganan por muy pocos votos.

<!-- veda -->

Ejemplo, CIS reestimado a 27-oct: la central da 187 a la derecha y la media del Monte Carlo 182,6. Al trasladar 2 puntos (nivel +1), la central solo sube 2 escaños mientras P(mayoría) pasa del 73 % al 92 %.

<!-- /veda -->

<!-- veda -->

**Resultado a 27-oct** (modelo del 28-oct)
- **Media de encuestas:** ni en el nivel −4 pierde la derecha la mayoría (P = 81 %; central 190).
- **CIS oficial:** la derecha no tiene mayoría en el nivel 0 (P = 4,8 %) y la investidura suma 176 sola (P = 86 %). Ni en el nivel +4 la recupera (P = 32 %). El voto útil de Vox al PP (nivel +2) le resta: central 168 → 165.
- **CIS reestimado:**
  - Hasta el nivel −3 la derecha conserva la mayoría por poco (P = 54 %).
  - En el nivel −4 la pierde (P = 29 %), y la investidura suma 176 sola (P = 50 %) y con Junts (P = 64 %).

<!-- /veda -->

### 4.10 Fuentes como tarjetas

**Archivos:** `src/engine/evidence.js`, `data/news.json` y `data/sources.json`.

**Objetivo:** el resultado no es una predicción, sino lo que dicen las fuentes de hoy. Por eso todo lo que lo alimenta es una tarjeta con origen, enlace y efecto:
- **Noticias y datos oficiales** (`data/news.json`): modifican escenarios del catálogo (`data/scenarios.json`). Cada tarjeta enlaza a sus publicaciones originales. El catálogo solo define los mecanismos; sin fuentes, cada escenario queda en "sin datos" con probabilidad 0 y parámetros mecánicos (seguimiento del 100 %).
- **Encuestas**, en tres grupos (media, CIS oficial, CIS reestimado): cada una entra en su fuente con su peso. Desactivarla recalcula esa fuente.
- **Base del modelo y contexto** (BOE, Junta Electoral Central, INE, alianzas incluidas en la reasignación, votación de investidura de 2023): son fijos y no se pueden desactivar.

**Del estado de una noticia a una probabilidad** (convención fija, no un juicio caso a caso): rumor 15 % · negociación 50 % · confirmado 100 % · descartado 0 %. Además, "sin datos" (ninguna tarjeta) y "hipotético" (solo para "qué pasaría si", como el voto exterior) valen 0 %.

**Resolución, campo a campo:** el estado (estado + probabilidad) y cada parámetro de un escenario se resuelven por separado. Así, una tarjeta que solo aporta un dato (el seguimiento de la encuesta de seguimiento) no queda superada por otra que solo fija el estado (el pacto confirmado). Para cada campo, las tarjetas se aplican de menor a mayor prioridad y manda la última:
1. rango del tipo: oficial > noticia > análisis;
2. a igualdad de rango, la verificada sobre la sin verificar;
3. a igualdad, la más reciente.

**Por defecto:**
- Están activas todas las tarjetas con efecto, salvo las superadas en todos sus campos. Por ejemplo, el rumor del FA (20-oct) queda superado por la noticia de que el FA se presenta en 51 de 52 provincias (26-oct).
- Las superadas siguen visibles y se pueden reactivar. Si la que las supera sigue activa, no tienen efecto, y la web lo indica.
- En cada escenario, la web muestra qué tarjeta fija el estado ("Según"), cuál los parámetros ("Parámetros según"), los supuestos sin dato ("Supuesto") y los datos oficiales usados ("Dato").

**Efecto de cada tarjeta:** `scripts/simulate.js` compara el resultado con todas las tarjetas por defecto y el resultado cambiando solo esa (Monte Carlo de 1.000 iteraciones con la misma semilla en los dos cálculos). Los escenarios se sortean con un generador aparte, así que el ruido de encuesta de cada iteración es el mismo en los dos cálculos aunque la tarjeta cambie la probabilidad de un escenario. Aun así, efectos por debajo de ~1 escaño en el Congreso deben leerse como "sin efecto apreciable". Se muestra el efecto sobre:
- los escaños medios de la derecha en el Congreso;
- la derecha del Senado (proyección central);
- P(mayoría).

<!-- veda -->

Efectos a 27-oct (modelo del 28-oct), derecha del Senado con media de encuestas / CIS oficial / CIS reestimado:
- Pacto PP–Vox: +16 / +6 / +23.
- Senado de Progreso: −4 / −10 / −19.
- Teruel sin FA: Congreso 0 con la media; −0,1 con el CIS oficial.
- Seguimiento de Data 10: −2 / +4 / −1. Con las listas por candidato, quien no apoya una lista conjunta sigue votando a los de su partido; el efecto depende de qué candidatos quedan en el filo en cada circunscripción.
- Cada encuesta de la media: entre −0,5 y +0,8 escaños de la derecha en el Congreso.

<!-- /veda -->

**En la web:**
- Al cambiar tarjetas, el resultado se recalcula en el navegador con el mismo motor, y un aviso indica que no es el resultado por defecto.
- "Qué pasaría si" aplica sus ajustes **sobre** las fuentes activas.

**Captura automática de noticias** (`scripts/fetch-news.js`). Cada hora lee los RSS de 10 medios de distinta línea editorial (lista en `scripts/fetch-news.js`), filtra los titulares que pueden tocar un escenario y una IA los clasifica:
- **La IA solo puede decir escenario y estado** (rumor, negociación, confirmado, descartado), nunca cifras, y solo de escenarios que ya existen en el catálogo. Tiene que aportar una **cita literal** que aparezca en el texto del medio; si no aparece, se descarta.
- **Activación (opción C):** un rumor o una negociación se activa solo si lo cuentan al menos **dos medios distintos**. Un "confirmado" o "descartado" queda **pendiente de revisión** (inactivo) y se abre un aviso: para aprobarlo se marca `verified: true`; para rechazarlo, se borra.
- Si lo que propone coincide con el estado vigente del escenario, no se crea nada. Una tarjeta automática sin verificar nunca supera a una verificada (§ resolución, arriba).
- **Proveedor de IA:** configurable, compatible con la API de OpenAI (secretos `NEWS_AI_URL`, `NEWS_AI_KEY`, `NEWS_AI_MODEL`). Sin ellos, el paso se salta y las noticias siguen siendo manuales. Configurado desde el 31-oct: **Gemini** (Google, plan gratuito), con varios modelos Flash en orden de respaldo por si uno está saturado. Una autoprueba (workflow "Prueba de la IA") comprueba que detecta un caso positivo y descarta uno negativo. GitHub Models, previsto al principio, se retiró el 30-jul-2026.

---

## 5. Validación

### 5.1 Reproducción exacta de 2023 (`npm test`, 64 tests en total)

T1 y T5 se comparan con el resultado oficial. T2–T4 y T6–T8 son contrafactuales (por ejemplo, T6: PSOE y Sumar en lista conjunta al Senado, que en 2023 no existió) y reproducen simulaciones de un análisis externo sobre los votos oficiales de 2023: comprueban que el motor calcula igual que un cálculo independiente, pero no alimentan el modelo.

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

<!-- veda -->

| Caso | Análisis externo | Modelo (26-oct) |
|---|---|---|
| Media: derecha / investidura | ~205 / 140 | 200 / 140 |
| CIS: derecha | ~188 | 186 |
| CIS + FA fuera: PSOE | 124 | 124 |
| +37.000 votos exteriores (techo) | derecha −7/−8 | −7,5 |
| Tormenta perfecta (CIS) | derecha ~175 · investidura ~170 | 171 · 169 |

<!-- /veda -->

### 5.3 Backtest 2019 → 2023

`scripts/backtest-2023.js` → `data/backtest-2023.json`.

**Planteamiento:** el mismo método con base de **noviembre de 2019** (**BOE-A-2019-17344**, Junta Electoral Central, leído del PDF y comprobado contra el Cuadro I en las 52 provincias), los escaños de 2023 y la oferta de 2023. Reasignación:
- UP + Más País + Compromís → Sumar.
- Ciudadanos desaparece.
- NA+ → UPN.

**Resultados**

| Caso | Encuesta − real (pp) | Derecha central | Real | Error | Error medio por partido | 90 % (histórico) | P(≥176) | ¿Real dentro del 90 %? |
|---|---|---|---|---|---|---|---|---|
| **A** · Encuesta perfecta (error del modelo) | 0 | 174 | 171 | **+3** | 0,55 esc. | 150–191 | 39 % | sí |
| **B** · Media a 33 días (como hoy) | PSOE −5,3 · Vox +1,9 · Sumar +0,9 · PP +0,3 | 180 | 171 | **+9** | 3,5 esc. | 163–198 | 73 % | sí |
| **C** · Últimas encuestas publicables (17-jul) | PSOE −3,4 · PP +0,9 · Vox +0,9 · Sumar +1,0 | 180 | 171 | **+9** | 2,7 esc. | 159–196 | 65 % | sí |

Recalculado el 28-oct con el ruido que conserva la suma (§4.8) y con la columna de ERC de 2023 bien leída: algunas tablas la llaman con el nombre de la coalición de 2019 y se contaba dos veces, lo que daba +11 en B. La columna "Empty Spain" (España Vaciada) no tiene equivalente en la base y pasa a lo no asignado; el script lo avisa.

**Lectura**
1. **El modelo traduce bien.** Con la encuesta perfecta, el error es de +3 escaños en el bloque y de 0,55 escaños de media por partido. Sesgo: el PP sale +1 y Sumar, Junts y ERC entre −1 y −2.
2. **El error dominante es el de las encuestas.** En 2023 sobrestimaron a la derecha en ≈2 pp y, sobre todo, infravaloraron al PSOE (−5,3 pp a 33 días).
3. **La cobertura es buena en el bloque y corta en los partidos de cola.**
   - Con `HISTORICAL_NOISE`, el resultado real de la derecha cae dentro del 90 % en los tres casos.
   - El PSOE real (121) quedó **fuera** del 90 % a 33 días (88–113) incluso con ruido histórico, y también con uno mayor (84–118).
   - Los intervalos por partido infravaloran las colas.
4. **Limitación del backtest:** es **una sola elección**, una muestra de 1, y la misma que se usó para elegir el ruido. Sirve para detectar problemas groseros, no para calibrar con precisión.

---

## 6. Resultados actuales con su incertidumbre (27-oct, modelo del 28-oct)

<!-- veda -->

**Congreso**, Monte Carlo (5.000 simulaciones, `HISTORICAL_NOISE`). Mediana [percentil 5–95]:

| Partido | Media de encuestas | CIS oficial | CIS reestimado |
|---|---|---|---|
| PP | 129 [114–146] | 91 [76–105] | 118 [102–134] |
| PSOE | 108 [92–123] | 151 [133–171] | 119 [103–135] |
| Vox | 68 [57–81] | 63 [51–75] | 65 [52–75] |
| FA | 8 [4–13] | 7 [3–12] | 11 [6–17] |
| ERC | 9 [5–13] | 13 [8–17] | 9 [6–13] |
| EH Bildu | 7 [2–11] | 8 [5–13] | 7 [2–11] |
| Junts | 6 [2–9] | 4 [1–7] | 6 [2–9] |
| PNV | 4 [1–7] | 2 [0–5] | 4 [1–7] |
| **Derecha** | **199 [180–218] · P(≥176) 98,0 %** | **155 [131–175] · P(≥176) 4,6 %** | **183 [163–202] · P(≥176) 74,0 %** |
| Derecha + CC, P(≥176) | 98,2 % | 5,0 % | 76,5 % |
| Investidura sin Junts | 144 [124–163] | 190 [169–213] · P(≥176) 86,3 % | 160 [140–179] |
| P(Junts decisivo) | 0,9 % | 5,7 % | 10,6 % |

Ningún partido sin dato en la encuesta (CUP, UPL, NC, Soria ¡Ya!, Existe) llega a una media de 0,5 escaños en ninguna fuente.

**Senado** (267 miembros)

| | Media de encuestas | CIS oficial | CIS reestimado |
|---|---|---|---|
| Derecha, central | 163 | 84 | 140 |
| Derecha, mediana [90 %] | 160 [135–172] | 87 [72–117] | 140 [106–163] |
| P(mayoría absoluta, ≥134) | 95,8 % | 0,7 % | 62,4 % |
| P(3/5, ≥161) | 49,3 % | 0 % | 8,8 % |

**Prueba de estrés** (proyección central con el error de la media de encuestas de 2023 a 33 días aplicado a hoy; `data/sensitivity.json` → `stress`)

| Fuente | Derecha (Congreso) | Investidura | Senado, derecha |
|---|---|---|---|
| Media de encuestas | 200 → **190** | 142 → 155 | 163 → 146 |
| CIS reestimado | 187 → **171** | 155 → 173 | 140 → 116 |
| CIS oficial (ilustrativo) | 155 → 140 | 189 → 206 | 84 → 73 |

<!-- /veda -->

---

## 7. Supuestos y su sensibilidad

Todas las cifras de esta sección salen de `node scripts/sensitivity.js` (`data/sensitivity.json`): cada fila cambia un solo supuesto o parámetro sobre las fuentes por defecto.

**Supuestos sin dato publicado.** Son los únicos parámetros que no salen de una fuente. Cada uno se declara en `scenarios.json` → `assumptions` (o en el código, si es de la reasignación o de la proyección) y la web lo muestra como "Supuesto". Efecto sobre la proyección central, derecha en el Congreso / en el Senado:

<!-- veda -->

| Supuesto | Valor usado | Alternativa probada | Media de encuestas | CIS oficial | CIS reestimado | Cómo se verifica |
|---|---|---|---|---|---|---|
| Partidos sin dato en la encuesta ("otros") | tope en su cuota de 2023; el excedente, sin escaño | escalado proporcional con el blanco (regla hasta el 27-oct) | 200/163 → 200/163 | 155/84 → 150/78 | 187/140 → 186/140 | Resultados del 29-N |
| Quien no apoya una lista conjunta al Senado | vota a los candidatos de su partido en ella | se abstiene (regla hasta el 27-oct) | 200/163 → 200/165 | 155/84 → 155/88 | 187/140 → 187/148 | Resultados del 29-N por candidato |
| Candidatos del socio en Senado de Progreso | 1 en las listas de 2 o 3 puestos | 0 (todos del PSOE) | Senado 163 → 163 | 84 → 77 | 140 → 136 | **BOE, candidaturas proclamadas** |
| Las 3 circunscripciones sin Senado de Progreso (de 50 posibles a 47) | se aplica en las 50 | faltan 3 cualesquiera | Senado +0 a +3 | −2 a +6 | +0 a +5 | **BOE, candidaturas proclamadas** |
| Fracción del resto de Sumar 2023 que va a Compromís–FV | 0,85 | 0,5 / 1 | 200/163 → 200/162 / 199/163 | 155/84 → 155/84 / 154/82 | 187/140 → 186/143 / 187/140 | Resultados del 29-N |
| Voto del FA en Teruel que va al PSOE | 50 % (neutro) | 0 % / 100 % | 0 | 0 | 0 | — |
| Voto del FA que va al PSOE si se retirara de las pequeñas | 50 % (neutro) | ajustable | solo "qué pasaría si" | | | — |

<!-- /veda -->

**Parámetros con dato y su sensibilidad**

<!-- veda -->

| Parámetro | Valor (fuente) | Alternativa | Media de encuestas | CIS oficial | CIS reestimado | Cómo se verifica |
|---|---|---|---|---|---|---|
| Seguimiento de las listas conjuntas | Data 10: PP 94 %, Vox 86 %; PSOE 92 %, socio 95 % | 100 % (sin la tarjeta) | Senado 163 → 165 | 84 → 80 | 140 → 141 | Resultados del 29-N |
| Circunscripciones de Senado de Progreso | Todas salvo Cataluña y Canarias (excepto La Gomera) (prensa del 17-oct) | las 60 | Senado 163 → 162 | 84 → 84 | 140 → 138 | **BOE, candidaturas proclamadas** |
| Retirada de Vox en las islas | todas las de Canarias y Baleares (COPE, 26-oct) | — | dato; las 11 islas aportan 7 de los +16 del pacto con la media | | | **BOE, candidaturas proclamadas** |
| Ruido del Monte Carlo | histórico (backtest, §5.3) | estrecho (`VIDEO_NOISE`) | P(mayoría, 2.000 sim.) 98,1 % → 99,6 % | 4,8 % → 1,6 % | 73,0 % → 80,5 % | Backtest (§5.3) |
| Bloque de CC | investidura (votación del 16-nov-2023) | con la derecha (también votó a Feijóo) | P(mayoría) 98,0 % → 98,2 % | 4,6 % → 5,0 % | 74,0 % → 76,5 % | Votación de investidura tras el 29-N |

<!-- /veda -->

**Supuestos sin dato, declarados pero no cuantificados**
- **Seguimiento del FV:** la encuesta de seguimiento solo da el dato del FA; se aplica también al FV.
- **Bloque de investidura fijo a 2023:** incluye a Podemos, que en 2023 votó dentro de Sumar y hoy concurre por separado con posición propia. CC se trata aparte (§4.8).
- **Voto exterior realista:** `canVote = 1` (los 163.020 podrían votar todos) y la participación de 8,87 % de 2023. El crecimiento ordinario del censo exterior (+444.335 electores desde 2023) no se modela: la base es el voto de 2023, que ya incluye el exterior de entonces.
- **Ruido de partido:** σ_p no se ajusta para cubrir el fallo del PSOE de 2023 (que queda fuera del 90 % a 33 días, §5.3), y el error de bloque está centrado en cero aunque en 2023 fue direccional. Es una decisión: ajustar el ruido a una sola elección sería sobreajustar.
- **Lo que el backtest no prueba:** el reparto de Podemos con las europeas de 2024 y las semillas de SALF y AA. Son las partes más especulativas de la base de 2026 y no tienen equivalente en 2023.
- **Comparabilidad de las fuentes:** las dos fuentes del CIS completan con la media de encuestas los partidos que no dan, con otras fechas y métodos.

**Supuestos estructurales no cuantificados**
- **Swing proporcional uniforme:** cada partido varía lo mismo, en proporción, en todas las provincias. No capta dinámicas regionales propias (Cataluña, País Vasco, Galicia, Canarias) salvo por la base de 2023. Es la causa principal del error de +3 de §5.3 A.
- **Participación de 2023 constante** por provincia.
- **Semillas de SALF (europeas 2024) y AA (andaluzas 2026):** su reparto territorial puede diferir en unas generales.
- **Las tres fuentes de voto discrepan mucho** en el bloque de derecha (§0 y §6). Es la mayor incertidumbre del modelo, mayor que la del Monte Carlo de cada fuente.
- **"CIS reestimado":** se basa en dos reestimaciones de terceros, publicadas sobre los microdatos abiertos de un barómetro con trabajo de campo de hace 3 semanas. Se usa porque son estimaciones publicadas e independientes de los mismos datos, no por parecerse a ninguna cifra de referencia.
- **Índice de las encuestas:** Wikipedia, que es secundaria; cada encuesta enlaza a su publicación original y se verifica automáticamente por otro canal cuando es posible (§4.1). Las no verificadas entran igual, marcadas. Se contrasta con el agregador de Demócrata. La estimación oficial del CIS se lee directamente de cis.es.
- **Seguimiento de las listas conjuntas:** la encuesta de seguimiento es una sola encuesta sin muestra publicada. Por eso su tarjeta va marcada "sin verificar" y se puede desactivar.
- **Senado con voto de partido:** fuera de las listas conjuntas, cada partido presenta candidatos con el mismo voto. No capta el voto personal cruzado; en 2023 falló en 4 provincias muy igualadas.
- **Error provincial independiente:** el Monte Carlo no tiene un error regional común (una comunidad entera desviada a la vez), así que puede infravalorar la incertidumbre en Cataluña, País Vasco o Canarias.
- **Segunda votación de investidura:** no se modela; solo la mayoría absoluta (176).
- **Formentera:** base estimada, 1 escaño.
- **Designados:** 4 de las 17 comunidades son estimación. Andalucía, con AA en 8 escaños, podría dar 1 designado a AA en lugar de al PP.
- **Probabilidades de los escenarios:** salen del estado que da la noticia más fuerte (rumor 15 %, negociación 50 %, confirmado 100 %, descartado 0 %). Es una convención, no una estimación. Hoy todos los escenarios activos están confirmados o descartados, así que no influye en el resultado por defecto.
- **Voto exterior realista:** el crecimiento del CERA latinoamericano se usa como aproximación del lugar de inscripción de los 163.020 afectados.

---

## 8. Qué no es este modelo

- **No es una predicción del voto.** Hereda el error de las encuestas, que en 2023 fue de varios puntos en un partido.
- **No modela campaña, debates, participación diferencial ni voto útil**, más allá de lo que recojan las encuestas.
- **No incluye el voto exterior extra en la proyección oficial** (probabilidad 0). Solo aparece en "qué pasaría si".
- **Veda electoral (LOREG, art. 69.7):** en los cinco días anteriores a la votación no se pueden publicar, difundir ni reproducir sondeos. Del 24-nov a las 00:00 (hora peninsular) al cierre de las últimas urnas el 29-N: las 20:00 en Canarias, que son las 21:00 peninsulares, la web pasa a una versión sin encuestas (`src/veda.js`, `src/app/Veda.jsx`):
  - Simulador con los porcentajes que escribe el usuario. De partida, el resultado real de las generales de 2023 con el voto de Sumar repartido según la oferta de 2026; SALF, que no se presentó, en 0 % (`data/veda.json`, generado por `scripts/veda.js`).
  - Noticias y escenarios sin sondeos: las tarjetas marcadas `sondeo` quedan fuera y sus parámetros vuelven al valor mecánico, ajustable.
  - Metodología sin los bloques con cifras de encuestas (marcados en este archivo con un comentario HTML `veda`).
  - Sin proyección, espectro, evolución ni tarjetas de encuestas.
  - **Servidor:** desde 4 horas antes del inicio, GitHub Actions deja de descargar encuestas y de guardar datos, y publica la versión de veda (`vite build --mode veda`). Esa versión solo lleva los datos de `VEDA_FILES` y la metodología ya recortada en el código.
  - **Navegador:** cambia solo a la hora de inicio, aunque la página esté abierta, por si el despliegue se retrasa. Se puede probar con `?veda` en la dirección.
  - **Comprobación diaria:** cada ejecución del workflow compila también la versión de veda y comprueba que no lleva archivos de encuestas ni nombres de empresas de sondeos (`scripts/check-veda.js`).
  - **Pendiente de revisión legal:** el repositorio de GitHub conserva, en su historial, los datos de encuestas anteriores a la veda.

**Noche electoral** (`scripts/fetch-results.js`, workflow `results.yml`). Al terminar la veda (20:00 UTC del 29-N, 21:00 peninsulares), se lee cada 5 minutos, hasta las 06:00 UTC del 30-N, el escrutinio provisional. GitHub retrasa o se salta a veces las ejecuciones programadas, así que no se depende de un cron cada 5 minutos: basta con que arranque una ejecución (hay un intento cada hora), que se queda leyendo en bucle y publica la web cada vez que cambia algo:
- **Fuente:** el escrutinio provisional del Ministerio del Interior tal como lo publica **RTVE** en ficheros JSON (total nacional y 52 provincias). infoelectoral no responde fuera de España, y RTVE recibe los mismos datos por el canal de Interior para medios.
- **Contraste:** el total nacional se compara con el que publica **Público**; la web dice si coinciden.
- **En la web:** un bloque encima de todo con el porcentaje escrutado, la hora, el hemiciclo y los escaños frente a la proyección, con la advertencia de que no es el resultado oficial.
- **Probado con 2023:** las 52 provincias, 350 escaños y el reparto real (PP 137, PSOE 121, Vox 33, Sumar 31…), coincidente con Público.
- **Después:** el escrutinio definitivo lo publica la Junta Electoral Central en el BOE. La ruta de 2026 se detecta sola en la página de RTVE.
- **Comparación final** (`scripts/compare-final.js`, `data/final-comparison.json`): el resultado frente a la **última proyección publicada antes de la veda**, que se toma del historial de git (`data/projection-final.json`) para que no la cambien las encuestas posteriores. Dice si el resultado cae dentro de los intervalos del 90 % de cada fuente y el error de cada encuesta por partido. La noche electoral se hace con el escrutinio provisional; desde el 1-dic, el vigilante del BOE busca el escrutinio definitivo, lo lee (`build-oficial-2023.js --year 2026`) y repite la comparación con él.

**Aviso inicial en la web** (`src/app/components/Notice.jsx`): antes de entrar, el visitante lee qué es el simulador, su objetivo, cómo se hizo y de qué fuentes sale, y lo acepta marcando una casilla.
- Indica que el proyecto se desarrolló con ayuda de inteligencia artificial (Claude, de Anthropic) para el código, la lectura de las fuentes oficiales y las comprobaciones.
- Enlaza a este documento, que la web muestra en la sección **Metodología** (`#metodologia`). Se puede leer antes de aceptar el aviso.
- La aceptación se guarda solo en el navegador del visitante (`localStorage`, clave `aviso`). Si el texto cambia de forma sustancial, se sube su versión y se vuelve a pedir (versión actual: 2). Se puede releer desde el pie de página.

---

## 9. Reproducir y auditar

```sh
npm ci
npm run data          # regenera la base (BOE, Junta Electoral Central, INE y, para europeas, andaluzas y designados, Wikipedia)
npm test              # 64 tests: reproducción de 2023, escenarios, proyección, Monte Carlo, espectro, fuentes, veda
npm run polls         # encuestas → data/polls.json
npm run simulate      # → data/state.json, data/history.json (semilla fija)
node scripts/backtest-2023.js --n 2000   # → data/backtest-2023.json
npm run spectrum      # espectro izquierda ↔ derecha → data/spectrum.json
npm run sensitivity   # prueba de estrés y §7 → data/sensitivity.json
node scripts/watch-boe.js --dry   # candidaturas proclamadas del BOE (--date AAAA-MM-DD --decree 400/2023 para probar con 2023)
node scripts/fetch-results.js --year 2023 --month 7   # lector de resultados, probado con 2023
```

**Lista de comprobación**

- [ ] **Base del Congreso:** `data/congreso-2023.json` suma 24.688.087 válidos y 350 electos con el reparto oficial (lo verifica T1).
- [ ] **Escaños de 2026:** coinciden con el anexo del BOE-A-2026-20742 (Madrid 38, Cádiz 8).
- [ ] **Senado 2023:** 208 electos y PP 120 (T5). **Senado 2026:** 60 circunscripciones y 209 electos (test).
- [ ] **Designados:** 58. Revisar a mano las 4 comunidades estimadas (§4.6).
- [ ] **Encuestas:** las 14 de la media, en `polls.json` → `sources.media.items`, coinciden con sus publicaciones originales (cada una lleva su enlace). Fechas y cifras. `data/poll-checks.json` dice cuáles verificó el sistema y en qué canal; revisar a mano las no verificadas.
- [ ] **CIS oficial:** `polls.json` → `sources.cisOficial.values` coincide con la tabla de estimación del PDF del estudio (enlace en `items[0].url`).
- [ ] **Tarjetas:** cada tarjeta con efecto de `data/news.json` enlaza a una publicación que dice lo que la tarjeta afirma (test: ninguna tarjeta con efecto sin fuentes).
- [ ] **Proyección:** las cuotas nacionales proyectadas reproducen la encuesta con error < 0,05 pp, y los partidos sin dato en la encuesta no superan su cuota de 2023 (tests).
- [ ] **Listas conjuntas del Senado:** con seguimiento del 100 % equivalen a sumar votos (test). Contrastar la composición y las 47 circunscripciones con el BOE.
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
| `src/engine/projection.js` | IPF y regla de "otros" |
| `src/engine/scenarios.js` | Retiradas, votos extra, optimizador, escaños en el aire |
| `src/engine/model.js` | Composición del modelo, Senado 2026, listas conjuntas por candidato, pacto, voto exterior realista |
| `scripts/sensitivity.js` | Prueba de estrés y sensibilidad (§7) |
| `src/engine/montecarlo.js` | Ruido y simulación |

---

## 10. Registro de decisiones

| Fecha | Decisión | Motivo |
|---|---|---|
| 26-oct | Escaños 2026 del BOE en lugar de los de 2023 | RD 806/2026: Madrid +1, Cádiz −1 |
| 26-oct | Ceuta y Melilla: 2 marcas por elector en el Senado | LOREG, art. 166; lo confirman los votos de 2023 (PP 2 en ambas) |
| 27-oct | "CIS bruto" = reestimaciones de terceros | La intención directa no reproduce las cifras del vídeo. *Motivo sustituido el 28-oct (abajo).* |
| 27-oct | Formentera como circunscripción propia; Senado de 267 | BOE y Wikipedia ("Constituencies established in 2026") |
| 27-oct | FA fuera de provincias pequeñas → descartado; pacto PP–Vox → confirmado | Cierre de candidaturas del 26-oct (prensa enlazada en `scenarios.json`) |
| 27-oct | Ruido por defecto: `HISTORICAL_NOISE` en lugar de `VIDEO_NOISE` | Backtest 2019→2023: la calibración del vídeo era demasiado estrecha |
| 27-oct | Fuentes como tarjetas: el estado de los escenarios lo fijan las tarjetas activas, no un valor manual | El resultado no es una predicción: debe verse de dónde sale cada efecto y poder quitarse |
| 27-oct | Resultados de 2023 (Congreso y Senado) y de 2019 (backtest) desde el BOE en lugar de Wikipedia; voto exterior 2023 de la Junta Electoral Central | Fuente oficial. Congreso idéntico; Senado con el escrutinio definitivo |
| 27-oct | Senado de Progreso sin Cataluña ni Canarias (salvo La Gomera); FA y Podemos juntos en Canarias | Infobae y Demócrata (17-oct). Sustituye al supuesto anterior de "las 47 provincias de 4 senadores" |
| 27-oct | **Solo datos reales:** ninguna entrada sale ya del análisis en vídeo de referencia. Estado, probabilidad y parámetros de cada escenario vienen de tarjetas con su fuente original; lo que no tiene dato se declara como supuesto | El análisis sirvió para validar el motor (§5.1–5.2); el modelo debe apoyarse en fuentes comprobables |
| 27-oct | Seguimiento de las listas conjuntas según la encuesta de seguimiento en lugar del 85 % supuesto | Único dato publicado. Resolución campo a campo para que no lo anule la tarjeta del pacto |
| 27-oct | Estimación oficial del CIS como tercera fuente, leída del PDF de cis.es | Sustituye el criterio anterior de elegir la variante del CIS que reproducía las cifras del análisis de referencia. Se muestran las tres fuentes por separado |
| 27-oct | Trasvases FA → PSOE (Teruel y retirada hipotética): del 70 % al 50 % neutro, declarado como supuesto | No hay dato publicado; entre 0 % y 100 % no cambia ningún escaño en Teruel |
| 27-oct | Voto exterior: participación (8,87 %) y reparto (exterior 2023) de la Junta Electoral Central. Sale del espectro, que pasa de 5 a 4 niveles | Con datos reales no mueve ningún escaño; el modo techo queda como cota teórica |
| 27-oct | Se eliminan "Vox se retira casi en toda España" y la "decena larga" de retiradas del FA | Sin base real: el pacto del 26-oct supera la primera; la segunda la desmintieron el FA y Maíllo (21-oct) |
| 27-oct | Bloques definidos por la votación de investidura del 16-nov-2023 | Dato oficial (179 sí, 171 no) en lugar de una definición tomada del análisis |
| 27-oct | Veda electoral: del 24-nov al cierre de las urnas, versión sin encuestas (simulador con porcentajes propios desde el resultado de 2023) | LOREG, art. 69.7: prohíbe publicar, difundir o reproducir sondeos, también los anteriores a la veda |
| 28-oct | Auditoría del modelo. Partidos sin dato en la encuesta: tope en su cuota de 2023; el excedente va a un grupo sin escaño | Escalarlos con lo no asignado daba escaños a regionalistas sin ningún dato (§7) |
| 28-oct | El ruido de encuesta del Monte Carlo conserva la suma | Lo no asignado absorbía ±3 pp por simulación; el backtest se repitió y la calibración se mantiene |
| 28-oct | Listas conjuntas del Senado por candidato: quien no apoya la lista vota a los de su partido | El voto al Senado es por candidato; la abstención total era un supuesto no declarado. Composición de Senado de Progreso declarada como supuesto |
| 28-oct | Retirada de Vox en todas las islas de Canarias y Baleares, ahora como dato | COPE (26-oct); el independiente de Vox solo cabe en las 6 listas de 2 o más puestos, los «seis candidatos independientes» |
| 28-oct | Senado de Progreso: 50 circunscripciones en el modelo frente a 47 en las fuentes, declarado con su rango | Ninguna fuente dice cuáles 3 faltan |
| 28-oct | Nueva salida: P(mayoría) con CC sumando a la derecha | CC votó a Feijóo y a Sánchez en 2023 |
| 28-oct | Backtest: ERC leída con su nombre de coalición de 2019; aviso de columnas sin mapear | Se contaba dos veces en B (+11 → +9) |
| 28-oct | "CIS reestimado" se mantiene por ser reestimaciones publicadas e independientes de los microdatos del CIS | Sustituye al motivo del 27-oct, que dependía del análisis de referencia |
| 28-oct | Prueba de estrés y §7 generadas por `scripts/sensitivity.js` | Cada cifra del documento debe poder reproducirse |
| 28-oct | Segunda auditoría: los escenarios se sortean con un generador aparte en el Monte Carlo | Con escenarios probables, el efecto de una tarjeta se mezclaba con ruido de Monte Carlo |
| 28-oct | Las tarjetas capturadas automáticamente sin verificar (F4) entran inactivas | Un titular sin revisar no debe cambiar el resultado por defecto |
| 28-oct | `check-veda` revisa también la empresa y los medios de las tarjetas `sondeo`; la metodología ya no los nombra fuera de los bloques de veda | Punto ciego: solo revisaba las empresas del índice de encuestas |
| 28-oct | Lista explícita de las 50 circunscripciones de Senado de Progreso; seguimiento del FV, Podemos en el bloque, `canVote`, σ_p y límites del backtest declarados como supuestos | Segunda auditoría |
| 30-oct | Europeas 2024 desde los ficheros oficiales del Ministerio del Interior en lugar de Wikipedia | Fuente oficial. Mismas cifras con ±0,05 pp de redondeo; P(mayoría) varía una décima. infoelectoral solo responde desde España: la descarga es puntual y el ZIP queda en caché |
| 30-oct | Wikipedia se mantiene como índice de encuestas, y cada encuesta se verifica automáticamente por otro canal (publicación original, sus gráficos o el RSS del medio); la tarjeta muestra el canal o "sin verificar" | Al sustituir Wikipedia por fuentes oficiales solo se hallaron errores en resultados ya cerrados (Congreso y Senado 2023) y desfase en los designados; en las encuestas comprobadas no hubo discrepancias. Así el sistema trabaja solo y se ve qué está confirmado |
| 30-oct | Vigilante del BOE: las candidaturas proclamadas fijan solas las circunscripciones de Senado de Progreso y del pacto, mediante una tarjeta oficial; si algo no cuadra, aviso y no se aplica | Que el sistema funcione solo con el dato oficial en cuanto se publica |
| 30-oct | Noche electoral: escrutinio provisional de Interior vía RTVE cada 5 minutos, contrastado con Público | infoelectoral no responde fuera de España; RTVE recibe el mismo dato por el canal para medios |
| 30-oct | Voto de los nacionalizados: medido el punto de corte de participación | Comprobar si el "no mueve escaños" es sólido: lo es con el reparto de 2023 |
| 30-oct | Espectro: las palancas del pacto solo se aplican si está vigente, y se marcan los pasos que no favorecen al lado que dicen | Que el laboratorio no se quede viejo con las noticias |
| 30-oct | Cron horario activado; acciones de GitHub actualizadas (Node 20 retirado) | Funcionamiento autónomo |
| 30-oct | Detección de ediciones en Wikipedia de encuestas ya publicadas, con aviso si afectan a las fuentes | Que un cambio en el índice no pase desapercibido |
| 30-oct | Captura automática de noticias con IA, opción C (rumor o negociación con dos medios se activan solos; confirmado o descartado esperan revisión). Proveedor de IA configurable | GitHub Models, previsto al principio, se retiró el 30-jul-2026 |
| 30-oct | Andaluzas 2026 desde el BOJA (Junta Electoral de Andalucía); parlamentos estimados de los designados contrastados con su fuente oficial | Fuente oficial; mismas cifras que Wikipedia |
| 30-oct | Comparación final automática con la última proyección antes de la veda, provisional la noche electoral y definitiva con el BOE | Comprobar el modelo con el resultado real sin intervención |
| 31-oct | IA de noticias: Gemini con modelos Flash de respaldo y autoprueba; noche electoral en bucle dentro de una sola ejecución | Los Flash más nuevos estaban saturados; GitHub no garantiza los crons cada 5 minutos |
