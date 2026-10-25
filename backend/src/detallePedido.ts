import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

const PRECIO_CARNE_EXTRA = 20;
/** Complemento EXTRA (doble toque en la pantalla de opciones): cada uno cuesta esto por pieza. */
export const PRECIO_COMPLEMENTO_EXTRA = 1;

export function terminoPermitido(categoria: string, nombre: string | undefined): boolean {
  return nombre !== undefined && (categoria === 'Tacos' || (categoria === 'Tacos Dorados' && nombre !== 'Dorado'));
}

export interface ItemPedido {
  idProducto: number;
  cantidad: number;
  sin?: number[];
  mezcla?: string[];
  sinQueso?: boolean;
  conQueso?: boolean;
  carneExtra?: number;
  terminoId?: number | null;
  conPapas?: boolean;
  /** Identificador temporal del borrador; se asigna un número definitivo bajo el bloqueo de la orden. */
  mixGrupo?: number | null;
  /** MIXTAS (cualquier categoría): cuántas piezas de cada sabor en un solo renglón; suman `cantidad`. */
  reparto?: RepartoPedido[];
  /** Complementos EXTRA (IDs, de los del producto), cada uno con costo por pieza; no pueden estar también en `sin`. */
  complementosExtra?: number[];
  /** Comentario del platillo (lo que no está en el menú ni en las opciones): sale como NOTA en la comanda. */
  nota?: string;
}

/** Comentario de un platillo: texto de 1 a 200 caracteres (se guarda sin espacios repetidos). */
export const MAX_NOTA = 200;
const notaValida = (nota: unknown) => typeof nota === 'string' && nota.trim().length > 0 && nota.length <= MAX_NOTA;

export interface RepartoPedido {
  nombre: string;
  cantidad: number;
  /** Lo pone el servidor al guardar: el precio de una pieza de ese sabor. */
  precio?: number;
}

/**
 * MIXTAS: el producto de cada sabor del reparto (misma categoría y tamaño), en el mismo orden. Con él cada pieza
 * se cobra a su precio y se aceptan los complementos de todos los sabores.
 */
export type ProductosReparto = Map<ItemPedido, { id: number; precio: number }[]>;

/** Al menos dos sabores distintos, cada uno con piezas, y que sumen la cantidad del renglón. */
function repartoValido(reparto: unknown, cantidad: number): boolean {
  if (!Array.isArray(reparto) || reparto.length < 2 || reparto.length > 40) return false;
  const nombres = new Set<string>();
  let suma = 0;
  for (const r of reparto) {
    if (typeof r?.nombre !== 'string' || !r.nombre.trim() || r.nombre.length > 255 || nombres.has(r.nombre)) return false;
    if (!Number.isSafeInteger(r.cantidad) || r.cantidad < 1) return false;
    nombres.add(r.nombre);
    suma += r.cantidad;
  }
  return suma === cantidad;
}

export function itemsValidos(items: ItemPedido[]): boolean {
  return items.length > 0 && items.every((i) =>
    Number.isSafeInteger(i?.idProducto) && i.idProducto > 0 &&
    Number.isSafeInteger(i?.cantidad) && i.cantidad > 0 &&
    (i.sin === undefined || (Array.isArray(i.sin) && i.sin.every((id) => Number.isSafeInteger(id) && id > 0))) &&
    (i.mezcla === undefined || (Array.isArray(i.mezcla) && i.mezcla.length <= 40 && i.mezcla.every((n) => typeof n === 'string' && n.trim().length > 0 && n.length <= 255))) &&
    (i.sinQueso === undefined || typeof i.sinQueso === 'boolean') &&
    (i.conQueso === undefined || typeof i.conQueso === 'boolean') &&
    (i.conPapas === undefined || typeof i.conPapas === 'boolean') &&
    !(i.sinQueso && i.conQueso) &&
    (i.terminoId == null || (Number.isSafeInteger(i.terminoId) && i.terminoId > 0)) &&
    (i.carneExtra === undefined || (Number.isSafeInteger(i.carneExtra) && i.carneExtra >= 0 && i.carneExtra <= 2)) &&
    (i.mixGrupo == null || (Number.isSafeInteger(i.mixGrupo) && i.mixGrupo > 0 && i.mixGrupo <= 2147483647)) &&
    (i.reparto === undefined || repartoValido(i.reparto, i.cantidad)) &&
    (i.nota === undefined || notaValida(i.nota)) &&
    (i.complementosExtra === undefined || (Array.isArray(i.complementosExtra) && i.complementosExtra.length <= 20 &&
      new Set(i.complementosExtra).size === i.complementosExtra.length &&
      i.complementosExtra.every((id) => Number.isSafeInteger(id) && id > 0 && !i.sin?.includes(id))))
  );
}

export interface PapasPedido {
  idProducto: number;
  nombre: string;
  tamano: string;
  precio: number;
}

/** Se ejecuta dentro de la transacción que ya bloqueó la orden. Nunca fusiona renglones. */
export async function guardarDetallePedido(
  conexion: Pick<PoolConnection, 'query' | 'execute'>,
  idOrden: number,
  items: ItemPedido[],
  productos: Map<number, RowDataPacket>,
  complementos: Map<number, { id: number; nombre: string }[]>,
  ahora: Date,
  papas: PapasPedido | null = null,
  productosReparto: ProductosReparto = new Map(),
): Promise<{ idDetalle_Orden: number; mix_grupo: number | null }[]> {
  const grupos = new Map<number, number>();
  let ultimo = 0;
  if (items.some((i) => i.mixGrupo != null)) {
    const [filas] = await conexion.query<RowDataPacket[]>(
      'SELECT COALESCE(MAX(mix_grupo), 0) AS ultimo FROM orden_has_detalle WHERE idOrden = ?', [idOrden],
    );
    ultimo = Number(filas[0].ultimo);
  }
  const guardados: { idDetalle_Orden: number; mix_grupo: number | null }[] = [];
  for (const item of items) {
    if (item.conPapas && !papas) throw new Error('La orden completa de papas no está disponible.');
    if (item.mixGrupo != null && !grupos.has(item.mixGrupo)) grupos.set(item.mixGrupo, ++ultimo);
    const mix = item.mixGrupo == null ? null : grupos.get(item.mixGrupo)!;
    const p = productos.get(item.idProducto)!;
    const carneExtra = item.carneExtra ?? 0;
    // MIXTAS: cada sabor con su producto; los complementos que se ofrecen son los de todos ellos.
    const sabores = item.reparto ? productosReparto.get(item) : undefined;
    const ofrecidos = sabores
      ? [...new Map([item.idProducto, ...sabores.map((s) => s.id)].flatMap((id) => complementos.get(id) ?? []).map((c) => [c.id, c])).values()]
      : complementos.get(item.idProducto) ?? [];
    const extra = ofrecidos.filter((c) => item.complementosExtra?.includes(c.id));
    // En centavos. En MIXTAS cada pieza a su precio; lo extra (carnes, EXTRA y papas) va en cada pieza.
    const base = sabores
      ? item.reparto!.reduce((acc, r, i) => acc + Math.round(sabores[i].precio * 100) * r.cantidad, 0)
      : Math.round(Number(p.precio) * 100) * item.cantidad;
    const porPieza = carneExtra * PRECIO_CARNE_EXTRA * 100 + extra.length * PRECIO_COMPLEMENTO_EXTRA * 100 +
      (item.conPapas ? Math.round(papas!.precio * 100) : 0);
    const subtotal = (base + porPieza * item.cantidad) / 100;
    const opciones = {
      sin: ofrecidos.filter((c) => item.sin?.includes(c.id)),
      mezcla: item.mezcla ?? [],
      ...(item.reparto && {
        reparto: item.reparto.map((r, i) => ({ nombre: r.nombre, cantidad: r.cantidad, ...(sabores && { precio: sabores[i].precio }) })),
      }),
      ...(extra.length && { complementosExtra: extra, precioComplementoExtra: PRECIO_COMPLEMENTO_EXTRA }),
      ...(item.nota && { nota: item.nota.trim().replace(/\s+/g, ' ') }),
      ...(item.conPapas && { papas }),
    };
    const [resultado] = await conexion.execute<ResultSetHeader>(
      `INSERT INTO orden_has_detalle
        (idOrden, idProducto, cantidad, sin_queso, con_queso, carne_extra, mix_grupo, opciones, subtotal, creado_en, actualizado_en, termino_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [idOrden, item.idProducto, item.cantidad, item.sinQueso ? 1 : 0, item.conQueso ? 1 : 0,
        carneExtra, mix, JSON.stringify(opciones), subtotal.toFixed(2), ahora, ahora, item.terminoId ?? null],
    );
    guardados.push({ idDetalle_Orden: resultado.insertId, mix_grupo: mix });
  }
  return guardados;
}
