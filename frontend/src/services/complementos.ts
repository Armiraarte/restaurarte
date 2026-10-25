export const esQueso = (c: { nombre: string }) => c.nombre.trim().toLocaleLowerCase('es') === 'queso';
export const ordenarComplementos = <T extends { nombre: string }>(lista: T[]): T[] =>
  [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));

/**
 * Solo se imprime lo que se quitó: SIN CHILE, CEBOLLA, CREMA.
 * Con todo no agrega renglones; ni SIN NADA ni SOLO CON sustituyen los nombres.
 */
export function complementosTicket<T extends { id: number; nombre: string }>(
  ofrecidos: T[],
  quitados: T[],
  { sinQueso = false, conQueso = false }: { sinQueso?: boolean; conQueso?: boolean } = {},
): string[] {
  const nombres = [...new Set(quitados.map((c) => c.nombre.trim().toLocaleUpperCase('es')).filter(Boolean))];
  if (sinQueso && !nombres.includes('QUESO')) nombres.push('QUESO');
  return [
    // El queso incluido de base no se repite; una adición que no está entre los complementos sí se conserva.
    ...(conQueso && !sinQueso && !ofrecidos.some(esQueso) ? ['CON QUESO'] : []),
    ...(nombres.length ? [`SIN ${nombres.join(', ')}`] : []),
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
