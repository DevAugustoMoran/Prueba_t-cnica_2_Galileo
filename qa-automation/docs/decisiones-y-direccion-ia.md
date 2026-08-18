# Decisiones técnicas y dirección de IA

## Qué se construyó, y por qué

**Playwright + TypeScript**, con **Page Object Model** (una clase por
pantalla/flujo: `QuizSettingsPage`, `StudentAttemptPage`, `GradingPage`,
etc.) en vez de tests planos. La razón: Moodle tiene comportamiento real que
no está en ningún lado documentado (ver más abajo), y descubrirlo cuesta
caro — pagarlo una sola vez por pantalla, encapsulado, es mucho más barato
que pagarlo de nuevo en cada test que toca esa pantalla.

**Reset completo antes de cada corrida**, no limpieza incremental. Un curso
de prueba se borra y se recrea de cero cada vez (`local_qa_seed`, un plugin
auxiliar). Se descartó deliberadamente la alternativa de "limpiar después
de cada test": es más lenta de razonar, más frágil ante un test que corta a
mitad de camino, y no garantiza el mismo punto de partida en cada corrida.

**Exámenes dedicados para casos que no deben interferir entre sí**
(contraseña, ventana de fechas, límite de tiempo corto, período de gracia)
en vez de sobrecargar un único examen con toda la configuración. Permite que
cada test sea legible por separado y que un cambio en uno no rompa
silenciosamente otro.

**Mocking deliberado en dos lugares, no en todos**: la llamada a la API de
IA (Cambio 1) se intercepta con una respuesta simulada — no tiene sentido
que la suite dependa de cuota real ni de la variabilidad de una IA. La
llamada al webhook (Cambio 3), en cambio, **no** se mockea: se deja pegarle
de verdad a un receptor real dentro del mismo entorno, porque ahí lo que se
quiere probar es justamente que la entrega ocurra — mockearla habría
probado el mock, no el sistema.

**GitHub Actions con tres disparadores** (mensual, en cada push, a demanda)
en vez de solo el cron mensual: un cambio nuevo al plugin se valida solo
apenas se sube, no hay que esperar al día 1 del mes siguiente para
enterarse de que algo se rompió.

## Cómo se dirigió la IA

Se delegó la implementación completa: cada Page Object, cada test, los
scripts de infraestructura (`setup.sh`/`.ps1`, el workflow de CI), y el
diagnóstico de cada fallo. Lo que no se delegó fue la validación: **ninguna
pieza de código se dio por buena sin una corrida real** — ni la compilación
de TypeScript, ni "debería andar" alcanzaban. El patrón de trabajo, repetido
decenas de veces a lo largo de la sesión, fue: escribir el código
consultando el código fuente real de Moodle (no memoria/entrenamiento) para
confirmar selectores y comportamientos → correrlo → si fallaba, pedir el
reporte real de Playwright (o el log real de CI) → diagnosticar contra esa
evidencia concreta, no contra una suposición → corregir → repetir.

Las decisiones de producto (qué constituye un fallo aceptable, si un log
fallido debería devolver error o fallar en silencio, qué grado de tolerancia
de timing es razonable para un test) las tomó el humano en cada punto de
la sesión; la IA proponía la opción técnica y el porqué, no la decisión en
sí cuando había una compensación real de por medio (por ejemplo: extender
un timeout vs. hacer el disparo de una tarea determinístico — se eligió lo
segundo, más lento de construir pero no dependiente de timing impredecible).

## Qué se encontró en el camino

Varios comportamientos reales de Moodle 4.3.12 no coinciden con lo que
documenta el código fuente por sí solo, y solo aparecieron al correr contra
la instancia real (el detalle completo, con cada uno confirmado contra
fuente o instancia, está en `coverage-map.md`):

- El control de "marcar pregunta para revisar" es un `<button>` con estado
  toggle en la pantalla real del intento, no el `<input type="checkbox">`
  que documenta el motor de preguntas genérico.
- El modal de confirmación de envío se salta en un intento ya vencido
  (dentro del período de gracia): el primer click ya envía directo, sin el
  segundo click que sí hace falta en un envío normal a tiempo.
- El campo de contraseña del examen arranca oculto detrás de un link
  "click para insertar texto" (comportamiento *unmask*) — tanto en la
  configuración del examen como en la pantalla de verificación antes de
  iniciar el intento.
- MariaDB arranca en dos etapas en su primer boot (instancia temporal de
  inicialización, reinicio, instancia final): un healthcheck ingenuo desde
  afuera puede dar un falso positivo contra la instancia temporal.
- `cron.php` de Moodle mantiene una ventana interna de ~100-180s revisando
  tareas *adhoc* antes de reevaluar las tareas *programadas* — el ciclo real
  de background es más largo e impredecible que un simple "cada 60s".

Y un bug real de nuestro propio plugin, encontrado (no buscado a propósito)
mientras se armaba el test del Cambio 3: `receptor.php` ignoraba el
resultado de su propia escritura de auditoría — si fallaba por permisos,
igual respondía éxito. Quedó corregido: ahora, si no puede persistir el
registro, responde error real (para que el emisor reintente) y deja rastro
en el log del servidor.