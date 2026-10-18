export function terminosCategoria<T extends { nombre: string }>(categoria: string, terminos: T[]): T[] {
  if (categoria === 'Tacos') return terminos;
  if (categoria === 'Tacos Dorados') return terminos.filter((t) => t.nombre !== 'Dorado');
  return [];
}
