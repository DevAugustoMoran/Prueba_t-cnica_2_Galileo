import { test, expect } from '../src/fixtures/roles';
import { CoursePage } from '../src/pages/CoursePage';
import { QuestionBankPage } from '../src/pages/QuestionBankPage';
import { config } from '../src/config';

// Scope #2 (enunciado): "Banco de preguntas: crear preguntas de varios tipos
// (opción múltiple, verdadero/falso, respuesta corta, numérica, emparejamiento,
// ensayo)."
//
// Las preguntas creadas acá las usa el test 03 (agregar preguntas al examen).

test.describe('Scope 2 · Banco de preguntas — varios tipos', () => {
  test('el profesor crea una pregunta de cada tipo requerido y todas quedan en el banco con su tipo correcto', async ({
    teacherPage,
  }) => {
    const cursoPage = new CoursePage(teacherPage);
    const bancoPage = new QuestionBankPage(teacherPage);

    const courseId = await cursoPage.getCourseIdByShortname(config.courseShortname);
    const categoryId = await bancoPage.getDefaultCategoryId(courseId, config.courseShortname);

    await test.step('Opción múltiple', async () => {
      await bancoPage.crearOpcionMultiple(courseId, categoryId, {
        nombre: 'QA - Opción múltiple',
        enunciado: '¿Cuál es la capital de Francia?',
        correcta: 'París',
        incorrectas: ['Madrid', 'Roma'],
      });
      await bancoPage.verificarEnListado(courseId, 'QA - Opción múltiple', 'multichoice');
    });

    await test.step('Verdadero/Falso', async () => {
      await bancoPage.crearVerdaderoFalso(courseId, categoryId, {
        nombre: 'QA - Verdadero o Falso',
        enunciado: 'El sol es una estrella.',
        respuestaCorrecta: true,
      });
      await bancoPage.verificarEnListado(courseId, 'QA - Verdadero o Falso', 'truefalse');
    });

    await test.step('Respuesta corta', async () => {
      await bancoPage.crearRespuestaCorta(courseId, categoryId, {
        nombre: 'QA - Respuesta corta',
        enunciado: '¿En qué idioma se originó la palabra "Moodle"?',
        respuestasCorrectas: ['inglés', 'ingles'],
      });
      await bancoPage.verificarEnListado(courseId, 'QA - Respuesta corta', 'shortanswer');
    });

    await test.step('Numérica', async () => {
      await bancoPage.crearNumerica(courseId, categoryId, {
        nombre: 'QA - Numérica',
        enunciado: '¿Cuánto es 15 + 27?',
        respuestaCorrecta: 42,
        tolerancia: 0,
      });
      await bancoPage.verificarEnListado(courseId, 'QA - Numérica', 'numerical');
    });

    await test.step('Emparejamiento', async () => {
      await bancoPage.crearEmparejamiento(courseId, categoryId, {
        nombre: 'QA - Emparejamiento',
        enunciado: 'Uní cada país con su capital.',
        pares: [
          { pregunta: 'Francia', respuesta: 'París' },
          { pregunta: 'España', respuesta: 'Madrid' },
          { pregunta: 'Italia', respuesta: 'Roma' },
        ],
      });
      await bancoPage.verificarEnListado(courseId, 'QA - Emparejamiento', 'match');
    });

    await test.step('Ensayo', async () => {
      await bancoPage.crearEnsayo(courseId, categoryId, {
        nombre: 'QA - Ensayo',
        enunciado: 'Explicá con tus palabras qué es un examen automatizado.',
      });
      await bancoPage.verificarEnListado(courseId, 'QA - Ensayo', 'essay');
    });
  });
});