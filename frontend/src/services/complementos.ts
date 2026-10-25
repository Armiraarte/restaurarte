import { SOLO_QUESO } from './formatoProductoCocina.ts';

export const esQueso = (c: { nombre: string }) => c.nombre.trim().toLocaleLowerCase('es') === 'queso';
export const ordenarComplementos = <T extends { nombre: string }>(lista: T[]): T[] =>
  [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));

/**
 * Lo más corto para cocina (en la comanda SIN sale como NO). Con todo no agrega renglones.
 *   - Se quitó todo:                 SOLO
 *   - Se quitó más de lo que queda:  CON LECHUGA, CEBOLLA   (lo que sí lleva; lo demás no va)
 *   - Si no:                         SIN CHILE, CEBOLLA, CREMA   (lo que se quitó)
 * Si lo único que queda es el queso va SOLO_QUESO, que en papel sale «CON QUESO» (ver formatoProductoCocina).
 */
export function complementosTicket<T extends { id: number; nombre: string }>(
  ofrecidos: T[],
  quitados: T[],
  { sinQueso = false, conQueso = false }: { sinQueso?: boolean; conQueso?: boolean } = {},
): string[] {
  const nombre = (c: { nombre: string }) => c.nombre.trim().toLocaleUpperCase('es');
  const nombres = [...new Set(quitados.map(nombre).filter(Boolean))];
  if (sinQueso && !nombres.includes('QUESO')) nombres.push('QUESO');
  const quitado = (c: T) => (sinQueso && esQueso(c)) || quitados.some((q) => q.id === c.id || nombre(q) === nombre(c));
  const todoQuitado = ofrecidos.length > 0 && ofrecidos.every(quitado);
  const quedan = [...new Set(ofrecidos.filter((c) => !quitado(c)).map(nombre))];
  // Queso de base que no está entre los complementos (quesadillas): SOLO no lo cubre, se avisa aparte.
  const quesoDeBaseFuera = sinQueso && !ofrecidos.some(esQueso);
  const sinQuesoAparte = quesoDeBaseFuera ? ['SIN QUESO'] : [];
  const cuantosQuitados = nombres.length - (quesoDeBaseFuera ? 1 : 0);
  return [
    // El queso incluido de base no se repite; una adición que no está entre los complementos sí se conserva.
    ...(conQueso && !sinQueso && !ofrecidos.some(esQueso) ? ['CON QUESO'] : []),
    ...(todoQuitado
      ? ['SOLO', ...sinQuesoAparte]
      : quedan.length && cuantosQuitados > quedan.length
        ? [quedan.length === 1 && quedan[0] === 'QUESO' ? SOLO_QUESO : `CON ${quedan.join(', ')}`, ...sinQuesoAparte]
        : nombres.length ? [`SIN ${nombres.join(', ')}`] : []),
  ];
}

/**
 * En tacos el queso no va de base: solo se menciona CON QUESO si se agregó.
 */
export function complementosTicketQuesoOpcional<T extends { id: number; nombre: string }>(ofrecidos: T[], quitados: T[], conQueso: boolean): string[] {
  const otros = ofrecidos.filter((c) => !esQueso(c));
  const quitadosOtros = quitados.filter((c) => !esQueso(c));
  return [...(conQueso ? ['CON QUESO'] : []), ...complementosTicket(otros, quitadosOtros)];
}
