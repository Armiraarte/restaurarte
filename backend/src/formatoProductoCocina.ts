// Formato puro compartido por el papel y la vista Cocina. No cambia el nombre guardado en el catálogo.
interface ProductoCocina {
  nombre: string;
  categoria?: string;
  cantidad: number;
  con_queso?: boolean;
  descripcion: string[];
  reparto?: { opcion: string; cantidad: number; con_queso?: boolean }[];
}

const normal = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es');
export const mayusculasComanda = (texto: string) => texto.toLocaleUpperCase('es-MX');
export const indicacionComanda = (texto: string) => mayusculasComanda(texto).replace(/(?<![\p{L}\p{M}\p{N}_])SIN(?![\p{L}\p{M}\p{N}_])/gu, 'NO');
/**
 * Se quit\u00f3 todo menos el queso (complementos.ts). En papel sale \u00abCON QUESO\u00bb; adentro se escribe distinto porque
 * \u00abCON QUESO\u00bb a secas es la marca de queso agregado, que no se imprime (ya va como Q en el nombre).
 */
export const SOLO_QUESO = 'CON QUESO NADA M\u00c1S';
const textoIndicacion = (d: string) => (normal(d) === normal(SOLO_QUESO) ? 'CON QUESO' : indicacionComanda(d));
const ABREVIATURAS: Record<string, string> = {
  tacos: 'T', 'tacos dorados': 'T', quesadillas: 'Q', sopes: 'SOP', enchiladas: 'ENCHI',
  tostadas: 'TOS', burritas: 'Burri', lonches: 'Lonch', hamburguesas: 'Ham', ensaladas: 'Ensa', salchichas: 'Salch',
};

const PRODUCTOS_ABREVIADOS: Record<string, Record<string, string>> = {
  'tacos dorados': { papa: 'PAPA', frijol: 'FRIJOL', jamon: 'JAM', salchicha: 'SAL' },
  tacos: { barbacoa: 'B', chicharron: 'H', pollo: 'POLLO', salchicha: 'SAL' },
  quesadillas: { papa: 'PAPA', frijol: 'FRIJ', picadillo: 'PICA', pollo: 'POLLO', jamon: 'JAM', chicharron: 'H', jalapeno: 'JALAP', queso: 'Q' },
  sopes: { papa: 'PAPA', frijol: 'FRI', picadillo: 'PICA', pollo: 'POLLO', chicharron: 'H', pierna: 'PIERNA', queso: 'Q' },
  enchiladas: { papa: 'PAPA', frijol: 'FRIJOL', picadillo: 'PICA', pollo: 'POLLO', queso: 'Q', 'queso/cebolla': 'CEBOLLA Q' },
  tostadas: { frijol: 'FRIJO', jamon: 'JAM', pollo: 'POLLO', mixta: 'MIX', cuerito: 'CUERI' },
};

const PALABRAS_ABREVIADAS: Record<string, string> = {
  'pollo a la plancha': 'POLLO/PLANCHA',
  barbacoa: 'B', milanesa: 'MILA', chicharron: 'H', jamon: 'JAM', picadillo: 'PICA',
  jalapeno: 'JALAP', frijol: 'FRIJ', mixta: 'MIX', mixto: 'MIX', cuerito: 'CUERI',
  salchicha: 'SAL', queso: 'Q',
};

/** Conserva las presentaciones y las mezclas; cada categoría tiene sus propias abreviaturas. */
function abreviarSabor(nombre: string, categoria: string): string {
  const abreviaturas = PRODUCTOS_ABREVIADOS[categoria];
  const buscar = (palabra: string) => {
    const clave = normal(palabra);
    if (abreviaturas && Object.hasOwn(abreviaturas, clave)) return abreviaturas[clave];
    return Object.hasOwn(PALABRAS_ABREVIADAS, clave) ? PALABRAS_ABREVIADAS[clave] : undefined;
  };
  return nombre.split(/(\s+con\s+|,\s*)/i).map((parte, i) => {
    if (i % 2) return ' CON ';
    const [, sabor, tamano = ''] = parte.match(/^(.*?)(\s*\([^)]*\))?$/)!;
    const abreviado = buscar(sabor) ?? sabor.replace(/[\p{L}\p{M}]+/gu, (palabra) => buscar(palabra) ?? mayusculasComanda(palabra));
    return `${abreviado}${tamano}`;
  }).join('');
}

export function formatoProductoCocina(p: ProductoCocina): { renglones: { cantidad: number; nombre: string }[]; descripcion: string[] } {
  const categoria = normal(p.categoria ?? '');
  const conQueso = p.con_queso ?? p.descripcion.some((d) => ['con queso', normal(SOLO_QUESO)].includes(normal(d)));
  if (p.reparto?.length) {
    const tamano = p.nombre.match(/(\s*\([^)]*\))\s*(?:Q)?$/i)?.[1] ?? '';
    const sabores = new Set(p.reparto.map((r) => normal(`${r.cantidad} ${r.opcion}`)));
    return {
      // Cada sabor es un renglón del producto: sin encabezado MIXTAS, total ni Q general.
      renglones: p.reparto.flatMap((r) => formatoProductoCocina({
        categoria: p.categoria,
        nombre: `${r.opcion}${tamano && !r.opcion.endsWith(tamano.trim()) ? tamano : ''}`,
        cantidad: r.cantidad,
        con_queso: r.con_queso ?? conQueso,
        descripcion: [],
      }).renglones),
      descripcion: p.descripcion.filter((d) => !['con todo', 'con queso'].includes(normal(d)) && !sabores.has(normal(d))).map(textoIndicacion),
    };
  }
  let quesoEnRelleno = false;
  // Hamburguesas y lonches no llevan la Q del queso (el queso va de base; si no lo lleva, sale NO QUESO).
  const sinMarcaQueso = categoria === 'hamburguesas' || categoria === 'lonches';
  const marcarQueso = (nombre: string) => {
    if (sinMarcaQueso) return quesoEnRelleno ? nombre : nombre.replace(/\s+Q$/i, '');
    if (quesoEnRelleno) return nombre;
    return conQueso && !/\sQ$/i.test(nombre) ? `${nombre} Q` : nombre;
  };
  let nombre = p.nombre.trim();
  const prefijo = p.categoria?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (prefijo) nombre = nombre.replace(new RegExp(`^${prefijo}\\s*[·:–—-]\\s*`, 'i'), '');
  if (categoria === 'alitas') nombre = nombre.replace(/\bbuffalo\b/gi, 'BFF').replace(/\bmango(?:\s+habanero)?\b/gi, 'MANGO');
  if (categoria === 'papas a la francesa' || categoria === 'papas') {
    nombre = /\bmedia\b/i.test(nombre) ? 'MEDIA PAPAS' : 'ORDEN PAPAS';
  } else if (ABREVIATURAS[categoria]) {
    const abreviatura = ABREVIATURAS[categoria];
    // Acepta también un nombre que ya venga abreviado, sin duplicar prefijos ni la Q final.
    nombre = nombre.replace(new RegExp(`^${abreviatura}\\s+`, 'i'), '');
    if (categoria === 'sopes') nombre = nombre.replace(/^SOPE\s+/i, '');
    if (categoria === 'enchiladas') nombre = nombre.replace(/^ENCH\s+/i, '');
    const quesoEnNombre = /(?:^|\s)Q$/i.test(nombre);
    nombre = nombre.replace(/(?:^|\s)Q$/i, '').trim();
    if (categoria === 'tacos') nombre = nombre.replace(/^T(?=[BH](?:\s|$))/i, '');
    nombre = abreviarSabor(nombre, categoria);
    quesoEnRelleno = /(?:^|\s)Q(?=\s|$)/i.test(nombre);
    nombre = `${abreviatura} ${nombre}${quesoEnNombre && !quesoEnRelleno ? ' Q' : ''}`.replace(/\s+/g, ' ').trim();
  } else {
    nombre = abreviarSabor(nombre, categoria);
    quesoEnRelleno = /(?:^|\s)Q(?=\s|$)/i.test(nombre);
  }
  const renglones = [{ cantidad: p.cantidad, nombre: mayusculasComanda(marcarQueso(nombre).replace(/\s+con\s+/gi, ', ')) }];
  const descripcion = p.descripcion.filter((d) => !['con todo', 'con queso'].includes(normal(d))).map(textoIndicacion);
  return { renglones, descripcion };
}
