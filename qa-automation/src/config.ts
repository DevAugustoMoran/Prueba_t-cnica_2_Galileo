import * as dotenv from 'dotenv';

dotenv.config();

function requerido(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno "${nombre}". Copiá .env.example a .env y completala.`
    );
  }
  return valor;
}

export const config = {
  baseURL: process.env.MOODLE_BASE_URL || 'http://localhost:8080',
  admin: {
    username: requerido('ADMIN_USERNAME'),
    password: requerido('ADMIN_PASSWORD'),
  },
  teacher: {
    username: requerido('TEACHER_USERNAME'),
    password: requerido('TEACHER_PASSWORD'),
  },
  student: {
    username: requerido('STUDENT_USERNAME'),
    password: requerido('STUDENT_PASSWORD'),
  },
  courseShortname: process.env.COURSE_SHORTNAME || 'QA-AUTOMATION',
};
