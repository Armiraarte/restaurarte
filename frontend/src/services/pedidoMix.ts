/** Conserva cada renglón y reúne los de un mismo plato en el orden de su primera aparición. */
export function agruparMix<T>(lineas: T[], grupoDe: (linea: T) => number | null | undefined): { grupo: number | null; lineas: T[] }[] {
  const grupos: { grupo: number | null; lineas: T[] }[] = [];
  const porNumero = new Map<number, (typeof grupos)[number]>();
  for (const linea of lineas) {
    const numero = grupoDe(linea) ?? null;
    let grupo = numero === null ? undefined : porNumero.get(numero);
    if (!grupo) {
      grupo = { grupo: numero, lineas: [] };
      grupos.push(grupo);
      if (numero !== null) porNumero.set(numero, grupo);
    }
    grupo.lineas.push(linea);
  }
  return grupos;
}
