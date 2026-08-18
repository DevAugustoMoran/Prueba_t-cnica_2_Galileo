/**
 * Extrae un parámetro entero de una URL (absoluta o relativa). Se repetía el
 * mismo patrón de parseo (resolver curso/categoría/cmid/pregunta desde un
 * href) en varios Page Objects; centralizado acá para no duplicarlo.
 */
export function extraerParametroEntero(url: string, nombreParametro: string, baseUrl: string): number {
  const resuelto = new URL(url, baseUrl);
  const valor = resuelto.searchParams.get(nombreParametro);
  if (!valor) {
    throw new Error(`La URL "${url}" no tiene el parámetro "${nombreParametro}".`);
  }
  const numero = parseInt(valor, 10);
  if (Number.isNaN(numero)) {
    throw new Error(`El parámetro "${nombreParametro}" de "${url}" no es un número: "${valor}".`);
  }
  return numero;
}
