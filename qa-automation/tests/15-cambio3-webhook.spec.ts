import { test, expect } from '../src/fixtures/roles';
import { CoursePage } from '../src/pages/CoursePage';
import { QuestionBankPage } from '../src/pages/QuestionBankPage';
import { QuizContentPage } from '../src/pages/QuizContentPage';
import { QuizSettingsPage } from '../src/pages/QuizSettingsPage';
import { StudentAttemptPage } from '../src/pages/StudentAttemptPage';
import { config } from '../src/config';
import { leerBitacoraWebhook, esperarNuevaEntradaEnBitacora } from '../src/utils/webhookBitacora';

// Cambio 3: "Notificación de resultado a sistema externo" -- al quedar
// finalizada la nota de un intento, Moodle manda un webhook con el
// resultado a un endpoint externo (receptor.php en este entorno, que hace
// de "sistema externo" para poder probarlo end-to-end sin depender de un
// tercero real).
//
// No hay ninguna pantalla de Moodle que muestre "se mandó el webhook" -- el
// efecto es una llamada HTTP servidor-a-servidor. Se verifica por fuera del
// browser: receptor.php registra cada payload recibido en un archivo de
// texto dentro de una carpeta pública del plugin, así que se lee
// directamente por HTTP antes y después del envío del intento.

test.describe('Cambio 3 · Notificación de resultado a sistema externo', () => {
  test('al enviar el intento, el resultado llega realmente al endpoint receptor', async ({
    teacherPage,
    studentPage,
  }) => {
    // El envío inmediato del Cambio 3 es "el camino feliz rápido" (según el
    // propio comentario de observador.php) -- si por lo que sea no llega a
    // completarse en esa misma request (ej. en un entorno de CI más cargado
    // que un dev local), la resiliencia real es el cron (procesar_webhooks),
    // que corre cada 60s (ver entrypoint.sh). El timeout del test tiene que
    // dar margen para ese ciclo completo, no solo para el camino rápido.
    test.setTimeout(120_000);

    const cursoPage = new CoursePage(teacherPage);
    const bancoPage = new QuestionBankPage(teacherPage);
    const quizSettingsPage = new QuizSettingsPage(teacherPage);
    const quizContentPage = new QuizContentPage(teacherPage);
    const alumnoPage = new StudentAttemptPage(studentPage);

    const courseId = await cursoPage.getCourseIdByShortname(config.courseShortname);

    const cmid = await test.step('Crear un examen dedicado', async () => {
      await cursoPage.gotoAddQuizForm(courseId, 1);
      await quizSettingsPage.completarYGuardar({
        name: 'Examen QA E2E - Webhook',
        attempts: 1,
      });
      return quizSettingsPage.obtenerCmIdDeUrlActual();
    });

    await test.step('Agregarle una pregunta', async () => {
      const idPregunta = await bancoPage.obtenerIdPregunta(courseId, 'QA - Verdadero o Falso');
      await quizContentPage.agregarPreguntaDelBanco(cmid, idPregunta);
    });

    const contenidoAntes = await leerBitacoraWebhook(teacherPage);

    await test.step('El alumno rinde y envía el intento', async () => {
      await alumnoPage.iniciarIntento(cmid);
      await expect(studentPage).toHaveURL(/mod\/quiz\/attempt\.php/, { timeout: 15_000 });

      await alumnoPage.responderVerdaderoFalso(true);
      await alumnoPage.siguientePagina();
      await alumnoPage.confirmarEnvioDesdeResumen();
    });

    // Assert real: la bitácora del receptor creció, y lo nuevo que se
    // agregó incluye la fecha de hoy -- confirma que es una entrada
    // genuinamente nueva de esta corrida, no una vieja que ya estaba ahí
    // (el archivo no se borra con el reset del curso).
    const contenidoDespues = await esperarNuevaEntradaEnBitacora(teacherPage, contenidoAntes, 90_000);
    const fechaHoy = new Date().toISOString().slice(0, 10);
    const entradaNueva = contenidoDespues.slice(contenidoAntes.length);
    expect(entradaNueva).toContain(fechaHoy);
    expect(entradaNueva).toContain('nota_final');
  });
});