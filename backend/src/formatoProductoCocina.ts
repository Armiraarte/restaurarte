// Formato puro compartido por el papel y la vista Cocina. No cambia el nombre guardado en el catálogo.
interface ProductoCocina {
  nombre: string;
  categoria?: string;
  cantidad: number;
  con_queso?: boolean;
  descripcion: string[];
  reparto?: { opcion: string; cantidad: number }[];
}

const normal = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es');
const ABREVIATURAS: Record<string, string> = {
  tacos: 'T', 'tacos dorados': 'T', quesadillas: 'Q', sopes: 'SOPE', enchiladas: 'Ench',
  tostadas: 'TOS', burritas: 'Burri', lonches: 'Lonch', hamburguesas: 'Ham', ensaladas: 'Ensa', salchichas: 'Salch',
};

export function formatoProductoCocina(p: ProductoCocina) {
  const categoria = normal(p.categoria ?? '');
  const conQueso = p.con_queso ?? p.descripcion.some((d) => normal(d) === 'con queso');
  const marcarQueso = (nombre: string) => conQueso && !/\sQ$/i.test(nombre) ? `${nombre} Q` : nombre;
  let nombre = p.nombre.trim();
  const prefijo = p.categoria?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (prefijo) nombre = nombre.replace(new RegExp(`^${prefijo}\\s*[·:–—-]\\s*`, 'i'), '');
  if (categoria === 'papas a la francesa' || categoria === 'papas') {
    nombre = /media orden/i.test(nombre) ? 'Media orden de papas' : 'Orden de papas';
  } else if (ABREVIATURAS[categoria]) {
    const abreviatura = ABREVIATURAS[categoria];
    if (!new RegExp(`^${abreviatura}(?:\\s|$)`, 'i').test(nombre)) nombre = `${abreviatura} ${nombre}`;
  }
  const alitasMixtas = categoria === 'alitas' && !!p.reparto?.length;
  const renglones = alitasMixtas
    ? p.reparto!.map((r) => ({ cantidad: r.cantidad, nombre: marcarQueso(r.opcion) }))
    : [{ cantidad: p.cantidad, nombre: marcarQueso(nombre) }];
  const sabores = new Set((p.reparto ?? []).map((r) => normal(`${r.cantidad} ${r.opcion}`)));
  const descripcion = p.descripcion.filter((d) => !['con todo', 'con queso'].includes(normal(d)) && (!alitasMixtas || !sabores.has(normal(d))));
  return { renglones, descripcion };
}
