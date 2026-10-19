export const esQueso = (c: { nombre: string }) => c.nombre.trim().toLocaleLowerCase('es') === 'queso';
export const ordenarComplementos = <T extends { nombre: string }>(lista: T[]): T[] =>
  [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
