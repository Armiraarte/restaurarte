export const esQueso = (c: { nombre: string }) => c.nombre.trim().toLocaleLowerCase('es') === 'queso';
export const ordenarComplementos = <T extends { nombre: string }>(lista: T[]): T[] =>
  [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));

/** "crema", "crema ni lechuga", "crema, lechuga ni salsa" (o con «Y»). */
const enLista = (nombres: string[], union: string) =>
  nombres.length < 2 ? nombres.join('') : `${nombres.slice(0, -1).join(', ')} ${union} ${nombres[nombres.length - 1]}`;

/**
 * Complementos en el ticket de cocina, con los menos renglones posibles:
 *   nada quitado → CON TODO · todo quitado → SIN NADA
 *   quedan menos de los que se quitaron → SOLO CON QUESO Y SALSA
 *   si no, lo que no quiere en un renglón (Sin crema ni lechuga), con SIN QUESO / CON QUESO aparte para que no haya duda.
 * `ofrecidos`: los complementos que tenía el platillo; `quitados`: los que el cliente no quiere.
 */
export function complementosTicket<T extends { id: number; nombre: string }>(
  ofrecidos: T[],
  quitados: T[],
  { sinQueso = false, conQueso = false }: { sinQueso?: boolean; conQueso?: boolean } = {},
): string[] {
  // Sin queso cuando el queso no es un complemento que se pueda quitar: se avisa aparte, como siempre.
  const quesoAparte = sinQueso && !ofrecidos.some(esQueso) ? ['SIN QUESO'] : [];
  if (ofrecidos.length === 0) return quesoAparte;
  const fuera = new Set(quitados.map((c) => c.id));
  const quedan = ofrecidos.filter((c) => !fuera.has(c.id));
  if (quitados.length === 0) return [...quesoAparte, 'CON TODO'];
  if (quedan.length === 0) return [...quesoAparte, 'SIN NADA'];
  if (quedan.length < quitados.length) return [...quesoAparte, `SOLO CON ${enLista(quedan.map((c) => c.nombre.toUpperCase()), 'Y')}`];
  const sinDescritos = quitados.filter((c) => !sinQueso || !esQueso(c));
  return [
    ...(sinQueso ? ['SIN QUESO'] : []),
    ...(conQueso ? ['CON QUESO'] : []),
    ...(sinDescritos.length ? [`Sin ${enLista(sinDescritos.map((c) => c.nombre.toLowerCase()), 'ni')}`] : []),
  ];
}
