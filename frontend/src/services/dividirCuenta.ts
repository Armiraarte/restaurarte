// Dividir la cuenta (botón junto al historial en la pantalla de la orden). Solo calcula cuánto le toca a cada
// persona: no cambia la orden ni el cobro. Todo en centavos para que las partes sumen exacto el total.

/** Una pieza de la cuenta que se puede asignar a una persona (un taco, un refresco, un cobro extra). */
export interface UnidadCuenta {
  clave: string;
  nombre: string;
  detalle?: string;
  centavos: number;
}

/** Reparte `centavos` en `partes`; los centavos que sobran van a las primeras («$10.00» en 3 → 3.34, 3.33, 3.33). */
export function repartir(centavos: number, partes: number): number[] {
  const n = Math.max(1, Math.floor(partes));
  const base = Math.floor(centavos / n);
  const sobran = centavos - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < sobran ? 1 : 0));
}

/** Partes iguales de un total en pesos; devuelve centavos por persona. */
export const partesIguales = (total: number, personas: number) => repartir(Math.round(total * 100), personas);

/** Solo la persona que tiene una pieza puede liberarla; las demás no pueden cambiarla de dueño. */
export function alternarAsignacion(asignadas: Record<string, number>, clave: string, persona: number): Record<string, number> {
  const propietario = asignadas[clave];
  if (propietario !== undefined && propietario !== persona) return asignadas;
  const nuevas = { ...asignadas };
  if (propietario === persona) delete nuevas[clave];
  else nuevas[clave] = persona;
  return nuevas;
}

/**
 * Cada renglón de la cuenta se separa en piezas (3 tacos → 3 piezas) para poder dárselas a distintas personas;
 * el subtotal del renglón se reparte entre sus piezas sin perder centavos. Los cobros extra son una pieza cada uno.
 * MIXTAS (`reparto`): cada pieza lleva el nombre de su sabor y su precio; lo demás del renglón (carnes extra,
 * EXTRA, papas) se reparte entre todas. Sin precio por sabor (renglones viejos), en partes iguales.
 */
export function unidadesDeCuenta(
  renglones: {
    clave: string;
    nombre: string;
    detalle?: string;
    cantidad: number;
    subtotal: number;
    reparto?: { nombre: string; cantidad: number; precio?: number }[];
  }[],
  extras: { clave: string; descripcion: string; importe: number }[] = [],
): UnidadCuenta[] {
  const unidades: UnidadCuenta[] = [];
  for (const r of renglones) {
    const total = Math.round(r.subtotal * 100);
    const sabores = r.reparto?.length && r.reparto.reduce((acc, s) => acc + s.cantidad, 0) === r.cantidad ? r.reparto : null;
    if (sabores) {
      const conPrecio = sabores.every((s) => s.precio != null);
      const piezas = sabores.flatMap((s) =>
        Array.from({ length: s.cantidad }, () => ({ nombre: s.nombre, centavos: conPrecio ? Math.round(s.precio! * 100) : 0 })));
      const resto = total - piezas.reduce((acc, p) => acc + p.centavos, 0);
      const extra = resto >= 0 ? repartir(resto, piezas.length) : null;
      const iguales = repartir(total, piezas.length);
      piezas.forEach((p, i) =>
        unidades.push({ clave: `${r.clave}-${i}`, nombre: p.nombre, detalle: r.detalle, centavos: extra ? p.centavos + extra[i] : iguales[i] }));
      continue;
    }
    const piezas = repartir(total, r.cantidad);
    piezas.forEach((centavos, i) => unidades.push({ clave: `${r.clave}-${i}`, nombre: r.nombre, detalle: r.detalle, centavos }));
  }
  for (const e of extras) unidades.push({ clave: `extra-${e.clave}`, nombre: e.descripcion, detalle: 'Cobro extra', centavos: Math.round(e.importe * 100) });
  return unidades;
}

/** Total de cada persona (índice 0 = Persona 1) y lo que falta por asignar, en centavos. */
export function totalesPorPersona(unidades: UnidadCuenta[], asignadas: Record<string, number>, personas: number) {
  const totales = Array.from({ length: personas }, () => 0);
  let sinAsignar = 0;
  for (const u of unidades) {
    const persona = asignadas[u.clave];
    if (persona !== undefined && persona < personas) totales[persona] += u.centavos;
    else sinAsignar += u.centavos;
  }
  return { totales, sinAsignar };
}
