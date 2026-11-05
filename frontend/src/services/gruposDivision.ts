// Dividir cuenta «Por productos»: las piezas se muestran agrupadas como se pidieron (un platillo MIX con sus extras,
// unas MIXTAS, 3 tacos juntos) para dar el platillo completo a una persona con un toque, o repartir sus piezas si lo
// comparten. Las claves de las piezas no cambian: son las de unidadesDeCuenta (dividirCuenta.ts), «idDetalle-n» y
// «extra-id», así el servidor calcula igual.

export interface PiezaCuenta {
  clave: string;
  nombre: string;
  detalle?: string;
  centavos: number;
}

export interface GrupoCuenta<P extends PiezaCuenta = PiezaCuenta> {
  clave: string; // «mix-3», «renglon-12» o «extra-5»
  mix: boolean; // platillo MIX: varios productos (y sus extras) en un plato
  titulo: string; // MIX: lo que lleva («Sopes · Papa + Sopes · Frijol»); si no, el producto como se pidió
  detalle?: string;
  piezas: P[];
  centavos: number;
}

/**
 * Agrupa las piezas en platillos: los renglones con el mismo MIX (orden_has_detalle.mix_grupo) y sus extras
 * (orden_extra.mix_grupo) en un solo platillo; cada otro renglón, con todas sus piezas; cada cobro extra suelto aparte.
 * Mismo orden en que se pidieron; los extras sueltos al final.
 */
export function agruparPiezas<P extends PiezaCuenta>(
  piezas: P[],
  renglones: { clave: string; mixGrupo: number | null; titulo: string; detalle?: string }[],
  extras: { clave: string; mixGrupo: number | null; titulo: string }[] = [],
): GrupoCuenta<P>[] {
  const grupos = new Map<string, GrupoCuenta<P>>();
  const grupoDe = new Map<string, string>(); // clave del renglón o «extra-id» → clave del grupo
  const contenidoMix = new Map<string, string[]>();
  for (const r of renglones) {
    const clave = r.mixGrupo != null ? `mix-${r.mixGrupo}` : `renglon-${r.clave}`;
    if (!grupos.has(clave)) {
      grupos.set(clave, { clave, mix: r.mixGrupo != null, titulo: r.titulo, detalle: r.mixGrupo != null ? undefined : r.detalle, piezas: [], centavos: 0 });
    }
    if (r.mixGrupo != null) contenidoMix.set(clave, [...(contenidoMix.get(clave) ?? []), r.titulo]);
    grupoDe.set(r.clave, clave);
  }
  for (const e of extras) {
    const mix = e.mixGrupo != null ? `mix-${e.mixGrupo}` : null;
    const clave = mix && grupos.has(mix) ? mix : `extra-${e.clave}`;
    if (!grupos.has(clave)) grupos.set(clave, { clave, mix: false, titulo: e.titulo, detalle: 'Cobro extra', piezas: [], centavos: 0 });
    grupoDe.set(`extra-${e.clave}`, clave);
  }
  for (const [clave, titulos] of contenidoMix) grupos.get(clave)!.titulo = titulos.join(' + ');

  for (const p of piezas) {
    const origen = p.clave.startsWith('extra-') ? p.clave : p.clave.slice(0, p.clave.lastIndexOf('-'));
    const clave = grupoDe.get(origen) ?? `pieza-${p.clave}`;
    if (!grupos.has(clave)) grupos.set(clave, { clave, mix: false, titulo: p.nombre, detalle: p.detalle, piezas: [], centavos: 0 });
    const grupo = grupos.get(clave)!;
    grupo.piezas.push(p);
    grupo.centavos += p.centavos;
  }
  // Los extras sueltos van al final, como en la cuenta.
  const todos = [...grupos.values()].filter((g) => g.piezas.length > 0);
  return [...todos.filter((g) => !g.clave.startsWith('extra-')), ...todos.filter((g) => g.clave.startsWith('extra-'))];
}

/**
 * Tocar un platillo: sus piezas libres son para `persona`; si ya no hay libres, se le quitan las suyas.
 * Las que tiene otra persona no cambian (primero las libera quien las tiene).
 */
export function alternarGrupo(asignadas: Record<string, number>, claves: string[], persona: number): Record<string, number> {
  const libres = claves.filter((c) => asignadas[c] === undefined);
  const nuevas = { ...asignadas };
  if (libres.length) {
    for (const c of libres) nuevas[c] = persona;
    return nuevas;
  }
  const mias = claves.filter((c) => asignadas[c] === persona);
  if (!mias.length) return asignadas;
  for (const c of mias) delete nuevas[c];
  return nuevas;
}

/** De quién es el platillo: una sola persona (`dueno`), varias (`personas` > 1) o nadie; y cuántas piezas siguen libres. */
export function estadoGrupo(asignadas: Record<string, number>, claves: string[]) {
  const duenos = new Set(claves.map((c) => asignadas[c]).filter((p): p is number => p !== undefined));
  const libres = claves.filter((c) => asignadas[c] === undefined).length;
  return { dueno: libres === 0 && duenos.size === 1 ? [...duenos][0] : null, personas: duenos.size, libres };
}
