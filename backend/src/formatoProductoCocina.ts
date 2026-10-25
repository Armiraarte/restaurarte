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
  tacos: 'T', 'tacos dorados': 'T', quesadillas: 'Q', sopes: 'SOP', enchiladas: 'ENCHI',
  tostadas: 'TOS', burritas: 'Burri', lonches: 'Lonch', hamburguesas: 'Ham', ensaladas: 'Ensa', salchichas: 'Salch',
};

const PRODUCTOS_ABREVIADOS: Record<string, Record<string, string>> = {
  'tacos dorados': { papa: 'PAPA', frijol: 'FRIJOL', jamon: 'JAM', salchicha: 'SAL' },
  tacos: { barbacoa: 'B', chicharron: 'H', pollo: 'POLLO', salchicha: 'SAL' },
  quesadillas: { papa: 'PAPA', frijol: 'FRIJ', picadillo: 'PICA', pollo: 'POLLO', jamon: 'JAM', chicharron: 'H', jalapeno: 'JALAP' },
  sopes: { papa: 'PAPA', frijol: 'FRI', picadillo: 'PICA', pollo: 'POLLO', chicharron: 'H', pierna: 'PIERNA' },
  enchiladas: { papa: 'PAPA', frijol: 'FRIJOL', picadillo: 'PICA', pollo: 'POLLO', 'queso/cebolla': 'QUESO CEBOLLA' },
  tostadas: { frijol: 'FRIJO', jamon: 'JAM', pollo: 'POLLO', mixta: 'MIX', cuerito: 'CUERI' },
};

/** Conserva las presentaciones y las mezclas; cada categoría tiene sus propias abreviaturas. */
function abreviarSabor(nombre: string, categoria: string): string {
  const abreviaturas = PRODUCTOS_ABREVIADOS[categoria];
  if (!abreviaturas) return nombre;
  return nombre.split(/(\s+con\s+)/i).map((parte, i) => {
    if (i % 2) return ' CON ';
    const [, sabor, tamano = ''] = parte.match(/^(.*?)(\s*\([^)]*\))?$/)!;
    return `${abreviaturas[normal(sabor)] ?? sabor.toLocaleUpperCase('es')}${tamano}`;
  }).join('');
}

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
    if (PRODUCTOS_ABREVIADOS[categoria]) {
      // Acepta también un nombre que ya venga abreviado, sin duplicar prefijos ni la Q final.
      const quesoEnNombre = /\sQ$/i.test(nombre);
      nombre = nombre.replace(/\sQ$/i, '').replace(new RegExp(`^${abreviatura}\\s+`, 'i'), '');
      if (categoria === 'sopes') nombre = nombre.replace(/^SOPE\s+/i, '');
      if (categoria === 'enchiladas') nombre = nombre.replace(/^ENCH\s+/i, '');
      if (categoria === 'tacos') nombre = nombre.replace(/^T(?=[BH](?:\s|$))/i, '');
      nombre = abreviarSabor(nombre, categoria);
      const separacion = categoria === 'tacos' && /^(B|H)(\s*\([^)]*\))?$/.test(nombre) ? '' : ' ';
      nombre = `${abreviatura}${separacion}${nombre}${quesoEnNombre ? ' Q' : ''}`;
    } else if (!new RegExp(`^${abreviatura}(?:\\s|$)`, 'i').test(nombre)) nombre = `${abreviatura} ${nombre}`;
  }
  const alitasMixtas = categoria === 'alitas' && !!p.reparto?.length;
  const renglones = alitasMixtas
    ? p.reparto!.map((r) => ({ cantidad: r.cantidad, nombre: marcarQueso(r.opcion) }))
    : [{ cantidad: p.cantidad, nombre: marcarQueso(nombre) }];
  const sabores = new Set((p.reparto ?? []).map((r) => normal(`${r.cantidad} ${r.opcion}`)));
  const reparto = new Map((p.reparto ?? []).map((r) => [normal(`${r.cantidad} ${r.opcion}`), `${r.cantidad} ${abreviarSabor(r.opcion, categoria)}`]));
  const descripcion = p.descripcion
    .filter((d) => !['con todo', 'con queso'].includes(normal(d)) && (!alitasMixtas || !sabores.has(normal(d))))
    .map((d) => reparto.get(normal(d)) ?? d);
  return { renglones, descripcion };
}
