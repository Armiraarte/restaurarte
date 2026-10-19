/** El servidor confirma este número al guardar, teniendo en cuenta las demás tablets. */
export function siguienteNumeroMesa(nombres: Iterable<string>): number | null {
  const ocupadas = new Set([...nombres].filter((n) => /^[1-9]$/.test(n)).map(Number));
  const mayor = Math.max(0, ...ocupadas);
  for (let numero = mayor + 1; numero <= 9; numero++) {
    if (!ocupadas.has(numero)) return numero;
  }
  for (let numero = 1; numero <= 9; numero++) {
    if (!ocupadas.has(numero)) return numero;
  }
  return null;
}
